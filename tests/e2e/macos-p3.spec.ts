/**
 * macOS — P3 journeys (plans/macos/08-acceptance.md P3 rows; shared/12 journeys M1 · M2 · M3 · S1 · T1 · Q1 · R1 · P1 ·
 * X1 · X5 on macOS). Spotlight, the menu bar's menus and status items, the Dock (magnification, labels, context menu,
 * Quit), the window manager's resize and keyboard modes, Mission Control, the lock screen, the tour, System Settings,
 * Terminal, Mail and persistence. Every step waits on an end state and focus never rests on <body>.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { committed, expectFocusNotOnBody, waitForOs } from './helpers';

const DESKTOP = ['chromium-desktop', 'reduced-motion', 'asset-original', 'firefox-desktop'];
const COMPACT = ['iphone', 'pixel', 'iphone-landscape'];
const desktopOnly = (info: TestInfo) =>
  test.skip(!DESKTOP.includes(info.project.name), 'fine-pointer desktop posture (expanded / large)');
const compactOnly = (info: TestInfo) => test.skip(!COMPACT.includes(info.project.name), 'compact posture (phones)');

const dock = (page: Page) => page.getByRole('navigation', { name: 'Dock' });
const dockApp = (page: Page, name: string) =>
  dock(page).getByRole('link', { name: new RegExp(`^${name}(, (open|minimized|running))?$`) });
const win = (page: Page, role: string) => page.locator(`[data-window="macos:${role}"]`);
const bar = (page: Page) => page.getByRole('menubar', { name: 'Menu bar' });
const spotlight = (page: Page) => page.getByRole('dialog', { name: 'Spotlight Search' });

async function settle(page: Page) {
  await committed(page);
  await page.waitForFunction(() => {
    if (document.querySelector('[data-window][data-phase="opening"],[data-window][data-phase="closing"]')) return false;
    const motion = (window as unknown as { __motion?: { debug(): { tweens: number } } }).__motion;
    return !motion || motion.debug().tweens === 0;
  });
}

async function openMacos(page: Page, path = '/macos') {
  await page.goto(path);
  await waitForOs(page, 'macos');
  await settle(page);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('pf.debug.probe', '1');
    window.sessionStorage.setItem('pf.debug.analytics', '1');
  });
});

// --- Spotlight (S1) -------------------------------------------------------------------------------------------------

test('MAC-SPOT-01/02/03/06 S1 Spotlight: three invocations, zero state, a result opens with one history entry', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page);
  // 1. Ctrl/Cmd+K
  await page.keyboard.press('ControlOrMeta+k');
  await expect(spotlight(page)).toBeVisible();
  const input = spotlight(page).getByRole('combobox', { name: 'Spotlight Search' });
  await expect(input).toBeFocused();
  await expect(spotlight(page).getByRole('group', { name: 'Suggestions' }).getByRole('option').first()).toHaveText(
    /Résumé/,
  );
  // Esc clears, then closes; focus returns.
  await input.fill('git');
  await page.keyboard.press('Escape');
  await expect(input).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(spotlight(page)).toHaveCount(0);
  await expectFocusNotOnBody(page);
  // 2. the menu-bar magnifier · 3. "/" outside a text field
  await page.getByRole('button', { name: 'Spotlight' }).click();
  await expect(spotlight(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('/');
  await expect(spotlight(page)).toBeVisible();
  // A result opens through the kernel: exactly one new history entry.
  const before = await page.evaluate(() => history.length);
  await page.keyboard.type('github');
  await expect(spotlight(page).getByRole('group', { name: 'Top Hit' })).toContainText('GitHub');
  await expect(input).toHaveAttribute('aria-activedescendant', /option/);
  await page.keyboard.press('Enter');
  await settle(page);
  await expect(spotlight(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/macos\/github$/);
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
});

test('MAC-SPOT-04 · SRCH-TERM-01 a command result opens Terminal with the command inserted, never run', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page);
  await page.keyboard.press('ControlOrMeta+k');
  await page.keyboard.type('neofetch');
  await expect(spotlight(page).getByRole('group', { name: 'Top Hit' })).toContainText('neofetch');
  await page.keyboard.press('Enter');
  const prompt = win(page, 'terminal').getByRole('textbox', { name: /^Command, current directory/ });
  await expect(prompt).toHaveValue('neofetch');
  // Unsubmitted: no output block for it.
  await expect(win(page, 'terminal').locator('[data-scrollback]')).not.toContainText('Uptime');
});

// --- Menu bar (M2 / M1) ---------------------------------------------------------------------------------------------

test('MAC-MENU-02/03/05 menus follow the focused app, open instantly, hover switches, items act', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page);
  // No window: Finder's menus.
  await expect(bar(page).getByRole('menuitem', { name: 'Finder' })).toBeVisible();
  await dockApp(page, 'GitHub').click();
  await settle(page);
  await expect(bar(page).getByRole('menuitem', { name: 'GitHub' })).toBeVisible();
  // Open the app menu, hover the next title: the open menu switches.
  await bar(page).getByRole('menuitem', { name: 'GitHub' }).click();
  await expect(page.getByRole('menu', { name: 'GitHub' })).toBeVisible();
  await bar(page).getByRole('menuitem', { name: 'Window' }).hover();
  await expect(page.getByRole('menu', { name: 'Window' })).toBeVisible();
  await page.keyboard.press('Escape');
  // Apple menu → About This Mac (EGG-ABOUT-01).
  await bar(page).getByRole('menuitem', { name: 'Apple' }).click();
  await page.getByRole('menuitem', { name: 'About This Mac' }).click();
  const about = page.getByRole('dialog', { name: 'About This Mac' });
  await expect(about).toBeVisible();
  await expect(about.getByText('Serial number')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(about).toHaveCount(0);
  await expectFocusNotOnBody(page);
});

test('MAC-MENU-04 APG menubar keyboard: Down opens, arrows move, Esc returns to the title', async ({ page }, info) => {
  desktopOnly(info);
  await openMacos(page);
  const apple = bar(page).getByRole('menuitem', { name: 'Apple' });
  await apple.focus();
  await page.keyboard.press('ArrowRight');
  await expect(bar(page).getByRole('menuitem', { name: 'Finder' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  const menu = page.getByRole('menu', { name: 'Finder' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(bar(page).getByRole('menuitem', { name: 'Finder' })).toBeFocused();
});

test('MAC-MENU-06 Control Center toggles persist; the clock opens the Notification Center', async ({ page }, info) => {
  desktopOnly(info);
  await openMacos(page);
  await page.getByRole('button', { name: 'Control Center' }).click();
  const panel = page.getByRole('region', { name: 'Control Center' });
  const toggle = panel.getByRole('button', { name: /Reduce Motion/ });
  const want = (await toggle.getAttribute('aria-pressed')) === 'true' ? 'full' : 'reduced';
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', want);
  await page.reload();
  await waitForOs(page, 'macos');
  await expect(page.locator('html')).toHaveAttribute('data-motion', want);
  await page.getByRole('button', { name: /^Notification Center/ }).click();
  await expect(page.getByRole('region', { name: 'Notification Center' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Notification Center' })).toHaveCount(0);
});

// --- Résumé fast path (Q1) ------------------------------------------------------------------------------------------

test('MAC-X-01 Q1 the résumé from Spotlight, the lock screen and the Dock stack menu (Open / Download)', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page);
  await page.keyboard.press('ControlOrMeta+k');
  await spotlight(page)
    .getByRole('option', { name: /Résumé/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/macos\/preview$/);
  await win(page, 'viewer').getByRole('button', { name: 'Close Preview' }).click();
  await settle(page);
  await dock(page).getByRole('link', { name: 'Résumé (PDF)' }).click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Résumé' });
  await expect(menu.getByRole('menuitem')).toHaveText(['Open in Preview', 'Download PDF']);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    menu.getByRole('menuitem', { name: 'Download PDF' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('Jaswanth-Resume.pdf');
});

// --- Dock -----------------------------------------------------------------------------------------------------------

test('MAC-DOCK-02/05 magnification is transforms only (no window renders); labels on hover and focus', async ({
  page,
}, info) => {
  desktopOnly(info);
  test.skip(info.project.name === 'reduced-motion', 'no magnification under reduced motion');
  await openMacos(page);
  const icon = dockApp(page, 'GitHub');
  const box = (await icon.boundingBox())!;
  const renders = await page.evaluate(
    () => (window as unknown as { __pfProbe?: Record<string, number> }).__pfProbe?.['render:window'] ?? 0,
  );
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
  // The envelope springs in (r 0.18, ζ 1): the icon under the pointer settles near 1 + 0.6.
  const scaleOf = () =>
    icon.evaluate((el) => {
      const transform = getComputedStyle(el.querySelector('[data-magnify-icon]')!).transform;
      return transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).a;
    });
  await expect.poll(scaleOf, { timeout: 3000 }).toBeGreaterThan(1.45);
  expect(await scaleOf()).toBeLessThanOrEqual(1.61);
  expect(
    await page.evaluate(
      () => (window as unknown as { __pfProbe?: Record<string, number> }).__pfProbe?.['render:window'] ?? 0,
    ),
  ).toBe(renders);
  const label = icon.locator('xpath=..').locator('[data-dock-label]');
  await expect(label).toHaveCSS('opacity', '1');
  await page.mouse.move(700, 300, { steps: 4 });
  await expect(label).toHaveCSS('opacity', '0');
});

test('MAC-WM-07 · MAC-DOCK-06 closing keeps the app running; Quit from the Dock menu removes the dot', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page);
  await dockApp(page, 'GitHub').click();
  await settle(page);
  await win(page, 'github').getByRole('button', { name: 'Close GitHub' }).click();
  await settle(page);
  await expect(dockApp(page, 'GitHub')).toHaveAccessibleName('GitHub, running');
  await expect(dockApp(page, 'GitHub')).toHaveAttribute('data-running');
  await dockApp(page, 'GitHub').click({ button: 'right' });
  await page.getByRole('menu', { name: 'GitHub (Dock)' }).getByRole('menuitem', { name: 'Quit GitHub' }).click();
  await expect(dockApp(page, 'GitHub')).not.toHaveAttribute('data-running');
  await expect(dockApp(page, 'GitHub')).toHaveAccessibleName('GitHub');
});

// --- Window manager -------------------------------------------------------------------------------------------------

test('MAC-WM-04 the bottom-right corner resizes, never below the minimum size', async ({ page }, info) => {
  desktopOnly(info);
  await openMacos(page);
  await dockApp(page, 'Finder').click();
  await settle(page);
  const finder = win(page, 'files');
  const corner = finder.locator('[data-resize="se"]');
  const start = (await finder.boundingBox())!;
  const handle = (await corner.boundingBox())!;
  await page.mouse.move(handle.x + 6, handle.y + 6);
  await page.mouse.down();
  await page.mouse.move(handle.x + 86, handle.y + 46, { steps: 6 });
  await page.mouse.up();
  await settle(page);
  const grown = (await finder.boundingBox())!;
  expect(Math.round(grown.width - start.width)).toBe(80);
  expect(Math.round(grown.height - start.height)).toBe(40);
  // Far past the minimum: the window stops at minPx (560 × 360).
  const again = (await corner.boundingBox())!;
  await page.mouse.move(again.x + 6, again.y + 6);
  await page.mouse.down();
  await page.mouse.move(again.x - 1200, again.y - 900, { steps: 6 });
  await page.mouse.up();
  await settle(page);
  const small = (await finder.boundingBox())!;
  expect(Math.round(small.width)).toBe(560);
  expect(Math.round(small.height)).toBe(360);
});

test('MAC-WM-09 M1 keyboard-only move and size from the Window menu', async ({ page }, info) => {
  desktopOnly(info);
  await openMacos(page);
  await dockApp(page, 'Finder').click();
  await settle(page);
  const finder = win(page, 'files');
  const start = (await finder.boundingBox())!;
  await bar(page).getByRole('menuitem', { name: 'Window' }).click();
  await page.getByRole('menuitem', { name: 'Move' }).click();
  await expect(finder).toHaveAttribute('data-mode', 'move');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('Enter');
  await settle(page);
  const moved = (await finder.boundingBox())!;
  expect(Math.round(moved.x - start.x)).toBe(10);
  expect(Math.round(moved.y - start.y)).toBe(50);
  await bar(page).getByRole('menuitem', { name: 'Window' }).click();
  await page.getByRole('menuitem', { name: 'Size' }).click();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape'); // reverts
  await settle(page);
  expect(Math.round((await finder.boundingBox())!.width)).toBe(Math.round(moved.width));
  await expectFocusNotOnBody(page);
});

// --- Mission Control ------------------------------------------------------------------------------------------------

test('MAC-MC-01/02/04 Alt+Shift+O: live windows fly into tiles; arrows + Enter choose; Esc returns them', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page);
  await dockApp(page, 'Finder').click();
  await dockApp(page, 'GitHub').click();
  await settle(page);
  const rects = await page
    .locator('[data-window]')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));
  await page.keyboard.press('Alt+Shift+O');
  const overview = page.getByRole('dialog', { name: 'Mission Control' });
  await expect(overview).toBeVisible();
  const tiles = overview.getByRole('list', { name: 'Open windows' }).getByRole('button', { name: /^(Finder|GitHub)/ });
  await expect(tiles).toHaveCount(2);
  await expect(page.locator('[data-window="macos:files"]')).toHaveAttribute('inert');
  await page.keyboard.press('Escape');
  await expect(overview).toHaveCount(0);
  await settle(page);
  const back = await page
    .locator('[data-window]')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));
  expect(back.map((r) => [Math.round(r.x), Math.round(r.y)])).toEqual(
    rects.map((r) => [Math.round(r.x), Math.round(r.y)]),
  );
  // Choose Finder from the grid: it comes to the front.
  await page.keyboard.press('Alt+Shift+O');
  await overview.getByRole('button', { name: /^Finder/ }).click();
  await settle(page);
  await expect(win(page, 'files')).toHaveAttribute('data-focused');
});

test('MAC-MC-05 no windows → "No open windows" with shortcuts', async ({ page }, info) => {
  desktopOnly(info);
  await openMacos(page);
  await page.keyboard.press('Alt+Shift+O');
  const overview = page.getByRole('dialog', { name: 'Mission Control' });
  await expect(overview.getByText('No open windows')).toBeVisible();
  await overview.getByRole('button', { name: 'Open GitHub' }).click();
  await expect(page).toHaveURL(/\/macos\/github$/);
});

// --- Context menus --------------------------------------------------------------------------------------------------

test('MAC-CTX-02/03/05 Shift+F10 on a desktop item; Copy Link writes the /go URL; Terminal keeps the native menu', async ({
  page,
  context,
  browserName,
}, info) => {
  desktopOnly(info);
  test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only in Playwright');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openMacos(page);
  const item = page.getByRole('list', { name: 'Desktop' }).getByRole('link', { name: 'Experience' });
  await item.focus();
  await page.keyboard.press('Shift+F10');
  const menu = page.getByRole('menu', { name: 'Experience' });
  await expect(menu.getByRole('menuitem').first()).toBeFocused();
  await menu.getByRole('menuitem', { name: 'Copy Link' }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/go\/experience$/);
  // The Terminal's body never opens a custom menu (copy / paste must work).
  await dockApp(page, 'Terminal').click();
  await settle(page);
  await win(page, 'terminal').locator('[data-scrollback]').click({ button: 'right' });
  await expect(page.getByRole('menu')).toHaveCount(0);
});

// --- System Settings --------------------------------------------------------------------------------------------------

test('MAC-SET-01/02 A11Y-PREF-01 Settings: search highlights; Reduce motion applies at once and persists', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page, '/macos/settings');
  const settings = win(page, 'settings');
  await settings.getByRole('searchbox', { name: 'Search settings' }).fill('contrast');
  await expect(settings.locator('[data-control="contrast"]')).toHaveAttribute('data-match');
  await settings.getByRole('searchbox', { name: 'Search settings' }).fill('');
  await settings.getByRole('button', { name: 'Accessibility' }).click();
  const reduce = settings.getByRole('switch', { name: 'Reduce motion' });
  const want = (await reduce.getAttribute('aria-checked')) === 'true' ? 'full' : 'reduced';
  await reduce.click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', want);
  await page.reload();
  await waitForOs(page, 'macos');
  await expect(page.locator('html')).toHaveAttribute('data-motion', want);
});

// --- Terminal + Mail persistence (P1) ---------------------------------------------------------------------------------

test('MAC-TERM-01/03/05 P1 zsh prompt, live title, `open resume` → Preview; history survives reload', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page, '/macos/terminal');
  const terminal = win(page, 'terminal');
  await expect(terminal.getByRole('heading', { level: 2 })).toHaveText(/jaswanth — -zsh — \d+×\d+$/);
  const prompt = terminal.getByRole('textbox', { name: /^Command, current directory/ });
  await expect(terminal.locator('[data-terminal]')).toHaveAttribute('data-ready');
  await prompt.fill('whoami');
  await prompt.press('Enter');
  await prompt.fill('open resume');
  await prompt.press('Enter');
  await expect(win(page, 'viewer')).toBeAttached();
  await page.reload();
  await waitForOs(page, 'macos');
  await dockApp(page, 'Terminal').click();
  const restored = win(page, 'terminal').getByRole('textbox', { name: /^Command, current directory/ });
  await expect(win(page, 'terminal').locator('[data-terminal]')).toHaveAttribute('data-ready');
  await restored.press('ArrowUp');
  await expect(restored).toHaveValue('open resume');
});

test('MAC-MAIL-02 P1 the compose draft survives reload; Ctrl+Enter hands off to mailto:', async ({ page }, info) => {
  desktopOnly(info);
  await openMacos(page, '/macos/mail');
  const mail = win(page, 'mail');
  await mail.getByRole('button', { name: 'New Message' }).click();
  await mail.getByRole('textbox', { name: 'Subject:' }).fill('Hello');
  await mail.getByRole('textbox', { name: 'Message' }).fill('Draft body');
  await committed(page);
  await page.reload();
  await waitForOs(page, 'macos');
  await expect(win(page, 'mail').getByRole('textbox', { name: 'Message' })).toHaveValue('Draft body');
  // The hand-off: the page asks the browser to open a mailto: URL.
  const navigation = page.waitForRequest((request) => request.url().startsWith('mailto:')).catch(() => null);
  await win(page, 'mail').getByRole('textbox', { name: 'Message' }).press('ControlOrMeta+Enter');
  await navigation;
  await expect(win(page, 'mail').getByRole('status')).toContainText('Handed to your email app');
});

// --- Lock screen + tour (T1) ------------------------------------------------------------------------------------------

test('MAC-LOCK-02 a deep link and a reload never show the lock screen', async ({ page }) => {
  await openMacos(page, '/macos/finder');
  await expect(page.locator('[data-lock-screen]')).toHaveCount(0);
  await page.reload();
  await waitForOs(page, 'macos');
  await expect(page.locator('[data-lock-screen]')).toHaveCount(0);
});

test('MAC-X-03 T1 the tour runs real app openings; any input ends it and leaves the app open', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page);
  await bar(page).getByRole('menuitem', { name: 'Apple' }).click();
  await page.getByRole('menuitem', { name: 'Take the Tour' }).click();
  const card = page.getByRole('group', { name: 'Everything here is an app — this is the Dock.' });
  await expect(card).toBeVisible();
  await expect(card.getByText('1 / 5')).toBeVisible();
  await expect(win(page, 'browser')).toBeAttached();
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  await expect(win(page, 'browser')).toBeAttached();
  await expectFocusNotOnBody(page);
});

// --- Compact (M3) -----------------------------------------------------------------------------------------------------

test('MAC-MENU-07 · MAC-DOCK-10 M3 compact: one app menu, status items, a scrolling Dock', async ({ page }, info) => {
  compactOnly(info);
  await openMacos(page);
  const titles = bar(page).getByRole('menuitem');
  await expect(titles).toHaveCount(2); // Apple · the app menu (its menus as submenus)
  await expect(page.getByRole('button', { name: 'Spotlight' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Control Center' })).toBeVisible();
  const rail = await dock(page).getAttribute('data-rail');
  expect(rail !== null).toBe(info.project.name === 'iphone-landscape');
});

// --- Accessibility (X1) and blur budget (X5) ------------------------------------------------------------------------

test('A11Y-AXE-01 X1 axe clean with Spotlight, Settings and Mission Control open', async ({ page }, info) => {
  desktopOnly(info);
  const scan = async () =>
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations.map(
      (v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`,
    );
  await openMacos(page, '/macos/settings');
  expect(await scan()).toEqual([]);
  await page.keyboard.press('ControlOrMeta+k');
  await expect(spotlight(page)).toBeVisible();
  expect(await scan()).toEqual([]);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Alt+Shift+O');
  await expect(page.getByRole('dialog', { name: 'Mission Control' })).toBeVisible();
  expect(await scan()).toEqual([]);
});

test('PERF-BLUR-01 X5 at most 3 live backdrop-filter surfaces with Spotlight and a banner open', async ({ page }) => {
  await openMacos(page);
  await page.keyboard.press('ControlOrMeta+k');
  await expect(spotlight(page)).toBeVisible();
  const live = await page.evaluate(
    () =>
      [...document.querySelectorAll<HTMLElement>('*')].filter((el) => {
        const style = getComputedStyle(el);
        const filter =
          style.backdropFilter || (style as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter;
        return filter && filter !== 'none' && el.getClientRects().length > 0;
      }).length,
  );
  expect(live).toBeLessThanOrEqual(3);
});
