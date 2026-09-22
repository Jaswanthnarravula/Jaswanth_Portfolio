/**
 * Windows Terminal — the e2e acceptance tests of plans/windows/apps/windows-terminal.md (P4):
 *   WIN-TERM-01 `e2e: N2 tabs + dropdown; blur count within cap` · WIN-TERM-05 `e2e: start resume → Edge PDF tab` ·
 *   WIN-TERM-07 `e2e: choosing it asks to switch; never switches silently`.
 * Same patterns as windows.spec.ts: every step waits on an end state (never a sleep for correctness) and focus never
 * rests on <body>. Desktop opens Terminal from its taskbar button (N2); phones (compact, where the taskbar lists only
 * running apps) arrive by its deep link, which opens only the named app.
 */
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { committed, expectFocusNotOnBody, waitForOs } from './helpers';

const COMPACT = ['iphone', 'pixel', 'iphone-landscape'];
/**
 * End states reached through an OS or window transition. Headless WebKit on the phone projects renders ~2 frames/s while
 * a window closes or the OS changes (any window — measured on GitHub too), so these waits allow for that; timing itself
 * is the motion suite's job (WIN-MOTION-*), not this one's.
 */
const TRANSITION = { timeout: 20_000 };
const isCompact = (info: TestInfo) => COMPACT.includes(info.project.name);

const taskbar = (page: Page) => page.getByRole('navigation', { name: 'Taskbar' });
const tbApp = (page: Page, name: string) => taskbar(page).getByRole('link', { name: new RegExp(`^${name}(, .*)?$`) });
const win = (page: Page, role: string) => page.locator(`[data-window="windows:${role}"]`);
const terminal = (page: Page) => win(page, 'terminal');
const tabs = (page: Page) => terminal(page).getByRole('tablist', { name: 'Terminal tabs' }).getByRole('tab');
const panel = (page: Page) => terminal(page).getByRole('tabpanel');
const prompt = (page: Page) => panel(page).getByRole('textbox', { name: /^Command, current directory/ });
/** The visual prompt string (hidden from assistive tech; the input's label carries the cwd). */
const promptText = (page: Page) => panel(page).locator('form [aria-hidden="true"]').first();

/** Settled: no window opening/closing and no motion tween running. */
async function settle(page: Page) {
  await page.waitForFunction(() => {
    if (document.querySelector('[data-window][data-phase="opening"],[data-window][data-phase="closing"]')) return false;
    const motion = (window as unknown as { __motion?: { debug(): { tweens: number } } }).__motion;
    return !motion || motion.debug().tweens === 0;
  });
}

/** Terminal, the way each posture reaches it: its taskbar button (N2) or, in compact mode, its deep link. */
async function openTerminal(page: Page, info: TestInfo) {
  if (isCompact(info)) {
    await page.goto('/windows/terminal');
    await waitForOs(page, 'windows');
  } else {
    await page.goto('/windows');
    await waitForOs(page, 'windows');
    await settle(page);
    await tbApp(page, 'Terminal').click();
    await expect(page).toHaveURL(/\/windows\/terminal$/);
  }
  await settle(page);
  await expect(terminal(page)).toBeVisible();
  // The engine chunk has landed (commands typed before it are queued anyway; this keeps the steps deterministic).
  await expect(panel(page).locator('[data-terminal]')).toHaveAttribute('data-ready');
}

/** Live `backdrop-filter` surfaces inside the OS (shared/06 cap: ≤ 3 per screen — the X5 probe of windows.spec.ts). */
const liveBlurs = (page: Page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll('.os-root *')].filter((el) => {
        const css = getComputedStyle(el);
        const value = css.backdropFilter || (css as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter;
        return value && value !== 'none';
      }).length,
  );

/** The Terminal body's blur follows the shell's budget: live when granted, the tint alone otherwise; solid glass off. */
const bodyBlur = (page: Page) =>
  terminal(page)
    .locator('[data-acrylic]')
    .evaluate((body) => {
      const css = getComputedStyle(body);
      const value = css.backdropFilter || (css as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter;
      const root = document.documentElement;
      return {
        live: !!value && value !== 'none',
        granted: body.closest('[data-terminal-acrylic]')?.getAttribute('data-terminal-acrylic') ?? null,
        solid: root.dataset.glass === 'solid' || root.dataset.tier === '0',
      };
    });

async function expectBodyBlurFollowsBudget(page: Page) {
  const blur = await bodyBlur(page);
  expect(blur.granted).toMatch(/^(live|tint)$/);
  expect(blur.live).toBe(blur.granted === 'live' && !blur.solid);
}

/** The profiles menu is painted on top of the Terminal window: a press at an item's centre lands on that item. */
async function expectMenuOnTop(menu: Locator) {
  const items = menu.getByRole('menuitem');
  for (const item of await items.all()) {
    const name = (await item.textContent()) ?? '';
    const onTop = await item.evaluate((element) => {
      const r = element.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return hit !== null && element.contains(hit);
    });
    expect(onTop, `the "${name}" item is painted under another surface`).toBe(true);
  }
}

test.beforeEach(async ({ page, browserName }) => {
  // Headless WebKit starves rendering during window transitions (a few frames/s while GitHub or Edge opens or closes).
  test.slow(browserName === 'webkit', 'headless WebKit renders window transitions at a few frames per second');
  await page.addInitScript(() => {
    window.sessionStorage.setItem('pf.debug.probe', '1');
    window.sessionStorage.setItem('pf.debug.analytics', '1');
  });
});

test('WIN-TERM-01 N2 tabs + dropdown; blur count within cap', async ({ page }, info) => {
  await openTerminal(page, info);
  const app = terminal(page);

  // The tab strip lives in the (tall) title bar: one "Windows PowerShell" tab, "+", the ▾ profiles button.
  const header = app.locator('header[data-drag-region]');
  await expect(header).toHaveAttribute('data-tall');
  await expect(header.getByRole('tablist', { name: 'Terminal tabs' })).toBeVisible();
  await expect(tabs(page)).toHaveText(['Windows PowerShell']);
  await expect(tabs(page).first()).toHaveAttribute('aria-selected', 'true');
  await expect(promptText(page)).toHaveText('PS C:\\Users\\jaswanth>');
  await expectBodyBlurFollowsBudget(page);
  expect(await liveBlurs(page)).toBeLessThanOrEqual(3);

  // "+" opens fresh PowerShell tabs, at most three.
  const newTab = app.getByRole('button', { name: 'New tab' });
  await newTab.click();
  await expect(tabs(page)).toHaveCount(2);
  await expect(tabs(page).nth(1)).toHaveAttribute('aria-selected', 'true');
  await newTab.click();
  await expect(tabs(page)).toHaveCount(3);
  await expect(newTab).toBeDisabled();

  // ▾ is a Menu of profiles; at three tabs only Ubuntu can be chosen. Menu + taskbar + Terminal stay within the cap.
  const profiles = app.getByRole('button', { name: 'Profiles' });
  await profiles.click();
  const menu = page.getByRole('menu', { name: 'Profiles' });
  await expect(menu).toBeVisible();
  await expectMenuOnTop(menu);
  await expect(menu.getByRole('menuitem')).toHaveText(['Windows PowerShell', 'Command Prompt', 'Ubuntu']);
  await expect(menu.getByRole('menuitem', { name: 'Command Prompt' })).toHaveAttribute('aria-disabled', 'true');
  expect(await liveBlurs(page)).toBeLessThanOrEqual(3);
  await expectBodyBlurFollowsBudget(page);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(profiles).toBeFocused();

  // APG tabs: arrows move and activate; Delete closes the focused tab (167 ms fade) and keeps focus in the strip.
  await tabs(page).nth(2).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(tabs(page).nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(tabs(page).nth(1)).toBeFocused();
  await page.keyboard.press('Delete');
  await expect(tabs(page)).toHaveCount(2);
  await expect(newTab).toBeEnabled();
  await expectFocusNotOnBody(page);

  // Command Prompt from the dropdown: its own tab, prompt and colours.
  await profiles.click();
  await menu.getByRole('menuitem', { name: 'Command Prompt' }).click();
  await expect(tabs(page)).toHaveText(['Windows PowerShell', 'Windows PowerShell', 'Command Prompt']);
  await expect(tabs(page).nth(2)).toHaveAttribute('aria-selected', 'true');
  await expect(panel(page)).toHaveAttribute('data-profile', 'cmd');
  await expect(promptText(page)).toHaveText('C:\\Users\\jaswanth>');
  await expect(panel(page).locator('[data-terminal]')).toHaveAttribute('data-ready');

  // `exit` closes its tab; ✕ closes the rest; closing the last tab closes the window.
  await prompt(page).fill('exit');
  await prompt(page).press('Enter');
  await expect(tabs(page)).toHaveCount(2);
  await tabs(page).nth(1).locator('[data-tab-close]').click();
  await expect(tabs(page)).toHaveCount(1);
  await tabs(page).first().locator('[data-tab-close]').click();
  await expect(terminal(page)).toHaveCount(0, TRANSITION);
  await expect(page).toHaveURL(/\/windows$/);
  await expectFocusNotOnBody(page);
});

test('WIN-TERM-05 start resume → Edge PDF tab', async ({ page }, info) => {
  await openTerminal(page, info);
  await prompt(page).fill('start resume');
  await prompt(page).press('Enter');
  // The owning Windows app opens — Edge on its PDF tab — through the kernel (a real route, not a page link).
  await expect(page).toHaveURL(/\/windows\/edge\/resume$/);
  await settle(page);
  const edge = win(page, 'browser');
  await expect(edge).toBeVisible();
  await expect(edge).toHaveAttribute('data-focused');
  await expect(edge.getByRole('tab', { name: 'Résumé.pdf' })).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveTitle(/^Résumé · Microsoft Edge · Windows 11/);
  // The terminal reported it and stays open behind (hidden in compact mode, which shows one window at a time).
  await expect(terminal(page)).toBeAttached();
  await expect(terminal(page).locator('[role="tabpanel"]:not([hidden]) [data-scrollback]')).toContainText(
    'Opening resume.pdf…',
  );
  await expectFocusNotOnBody(page);
});

test('WIN-TERM-07 choosing it asks to switch; never switches silently', async ({ page }, info) => {
  await openTerminal(page, info);
  const app = terminal(page);
  const profiles = app.getByRole('button', { name: 'Profiles' });
  const chooseUbuntu = async () => {
    await profiles.click();
    const menu = page.getByRole('menu', { name: 'Profiles' });
    await expect(menu).toBeVisible();
    await expectMenuOnTop(menu);
    await menu.getByRole('menuitem', { name: 'Ubuntu' }).click();
    const dialog = app.getByRole('dialog', { name: 'Switch to the Linux experience?' });
    await expect(dialog).toBeVisible();
    return dialog;
  };
  const stillWindows = async () => {
    await committed(page);
    await expect(page).toHaveURL(/\/windows\/terminal$/);
    await expect(page.locator('.os-root')).toHaveAttribute('data-os', 'windows');
    await expect(terminal(page)).toBeVisible();
  };

  // Choosing Ubuntu only asks: a modal dialog, focus on Cancel, the tab strip inert behind it — nothing switched.
  let dialog = await chooseUbuntu();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  expect(await app.locator('[role="tablist"]').evaluate((el) => el.closest('[inert]') !== null)).toBe(true);
  await stillWindows();

  // Cancel never switches; focus returns to the profiles button.
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(profiles).toBeFocused();
  await stillWindows();

  // Esc never switches either.
  dialog = await chooseUbuntu();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await stillWindows();
  await expect(tabs(page)).toHaveCount(1); // Ubuntu never became a tab

  // Only Switch leaves Windows — for the Linux experience.
  dialog = await chooseUbuntu();
  await dialog.getByRole('button', { name: 'Switch' }).click();
  await expect(page).toHaveURL(/\/linux(\/.*)?$/);
  await expect(page.locator('.os-root[data-os="linux"] [data-os-shell="linux"]')).toBeAttached(TRANSITION);
  await expectFocusNotOnBody(page);
});
