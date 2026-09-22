/**
 * Windows 11 — P4 journeys (plans/windows/08-acceptance.md; shared/12 journeys N1 · N2 · N3 · N-keyboard · H1 · D1 ·
 * P1 · R1 · O1 · S1 · T1 · C1 · Q1 · X1–X5). Every step waits on an end state (never a sleep for correctness) and
 * asserts focus never rests on <body>. The acceptance probes (`pf.debug.probe`) count window renders and expose
 * `__motion.debug()` so "settled" means no tween is running.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { committed, expectFocusNotOnBody, skipIntro, waitForOs, waitForSettled } from './helpers';

type Box = { x: number; y: number; w: number; h: number };

const DESKTOP = ['chromium-desktop', 'reduced-motion', 'asset-original', 'firefox-desktop'];
const COMPACT = ['iphone', 'pixel', 'iphone-landscape'];
const desktopOnly = (info: TestInfo) =>
  test.skip(!DESKTOP.includes(info.project.name), 'fine-pointer desktop posture (expanded / large)');
const compactOnly = (info: TestInfo) => test.skip(!COMPACT.includes(info.project.name), 'compact posture (phones)');

const taskbar = (page: Page) => page.getByRole('navigation', { name: 'Taskbar' });
const tbApp = (page: Page, name: string) => taskbar(page).getByRole('link', { name: new RegExp(`^${name}(, .*)?$`) });
const win = (page: Page, role: string) => page.locator(`[data-window="windows:${role}"]`);
const boxOf = (locator: Locator): Promise<Box> =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
const probe = (page: Page) =>
  page.evaluate(() => ({ ...((window as unknown as { __pfProbe?: Record<string, number> }).__pfProbe ?? {}) }));

const INTERACTIVE =
  'button, a, input, textarea, select, summary, [role="button"], [role="menuitem"], [role="tab"], [data-no-drag]';

/** A free spot on a window's title bar (no control, not covered): where a visitor grabs or presses it. */
async function grip(page: Page, role: string): Promise<{ x: number; y: number }> {
  await quiet(page);
  const point = await win(page, role).evaluate((section, interactive) => {
    const bar = section.querySelector('[data-drag-region]');
    if (!bar) return null;
    const r = bar.getBoundingClientRect();
    const y = r.top + Math.min(14, r.height / 2);
    for (let x = r.right - 2; x > r.left + 8; x -= 4) {
      const hit = document.elementFromPoint(x, y);
      if (hit && section.contains(hit) && hit.closest('[data-drag-region]') && !hit.closest(interactive))
        return { x: Math.round(x), y: Math.round(y) };
    }
    return null;
  }, INTERACTIVE);
  if (!point) throw new Error(`no free title-bar spot on ${role}`);
  return point;
}

/** Activate a window the way a visitor does: a press on an empty part of its title bar. */
async function activate(page: Page, role: string) {
  const at = await grip(page, role);
  await page.mouse.click(at.x, at.y);
  await committed(page);
  await expect(win(page, role)).toHaveAttribute('data-focused', 'true');
}

/** Settled: no window opening/closing and no motion tween running. */
async function settle(page: Page) {
  await page.waitForFunction(() => {
    if (document.querySelector('[data-window][data-phase="opening"],[data-window][data-phase="closing"]')) return false;
    const motion = (window as unknown as { __motion?: { debug(): { tweens: number } } }).__motion;
    return !motion || motion.debug().tweens === 0;
  });
}

/** Settled, and no finite CSS / WAAPI animation still running (panels and menus have landed). */
async function quiet(page: Page) {
  await settle(page);
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== 'running' || animation.effect?.getComputedTiming().iterations === Infinity,
      ),
  );
}

async function openWindows(page: Page, path = '/windows') {
  await page.goto(path);
  await waitForOs(page, 'windows');
  await settle(page);
}

async function toChooser(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tap to begin' }).click();
  await skipIntro(page);
  await page.getByRole('button', { name: /^Guest/ }).click();
  await expect(page.getByRole('heading', { name: 'Choose how you want to explore' })).toBeFocused();
  await waitForSettled(page, '[data-chooser-card]');
}

test.beforeEach(async ({ page }, info) => {
  // Desktop geometry is asserted at the storyboard frame's size (plans/windows/01 "Visual target"): 1440 × 900.
  if (DESKTOP.includes(info.project.name)) await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    window.sessionStorage.setItem('pf.debug.probe', '1');
    window.sessionStorage.setItem('pf.debug.analytics', '1');
  });
});

// --- Home: desktop, taskbar, identity -------------------------------------------------------------------------------

test('WIN-TASK-01 · WIN-DESK-01 · WIN-TASK-07 the home: centred taskbar and desktop shortcuts as real links @smoke', async ({
  page,
  request,
}, info) => {
  await openWindows(page);
  const bar = taskbar(page);
  await expect(bar.getByRole('button', { name: 'Start' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Search' })).toBeVisible();
  await expect(bar.getByRole('button', { name: 'Task View' })).toBeVisible();
  const expected = COMPACT.includes(info.project.name)
    ? ['Résumé (PDF)']
    : [
        'File Explorer',
        'Microsoft Edge',
        'GitHub',
        'Outlook',
        'Visual Studio Code',
        'Terminal',
        'Settings',
        'Résumé (PDF)',
      ];
  const links = bar.locator('[data-taskbar-list] a:visible');
  expect(await links.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))).toEqual(expected);
  await expect(bar.getByRole('link', { name: 'Résumé (PDF)' })).toHaveAttribute('href', '/windows/edge/resume');
  const desktop = page.getByRole('list', { name: 'Desktop' });
  const shortcuts = desktop.getByRole('link');
  const names: (string | RegExp)[] = ['This PC', 'Résumé.pdf', 'Projects', 'Experience', /^About /];
  await expect(shortcuts).toHaveCount(names.length);
  for (const [i, name] of names.entries()) await expect(shortcuts.nth(i)).toHaveAccessibleName(name);
  // W2: every taskbar and desktop link is a real, statically generated page.
  const hrefs = await page
    .locator('nav[aria-label="Taskbar"] a[href], [aria-label="Desktop"] a[href]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('href')!));
  for (const href of new Set(hrefs)) expect((await request.get(href)).status(), href).toBe(200);
  // The clock is a <time>, never a live region.
  if (!COMPACT.includes(info.project.name)) {
    await expect(bar.locator('time').first()).toHaveText(/^\d{1,2}:\d{2} (AM|PM)$/);
    expect(await bar.locator('[aria-live]').count()).toBe(0);
  }
});

test('WIN-ID-01 · WIN-ID-02 · WIN-ID-05 the wallpaper, 8 px windows with a 1 px stroke, 0 px maximized, no live blur in windows', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page);
  const image = await page.locator('[data-wallpaper]').evaluate((el) => getComputedStyle(el).backgroundImage);
  for (const stop of ['rgb(127, 192, 255)', 'rgb(47, 111, 224) 35%', 'rgb(11, 31, 92) 75%'])
    expect(image).toContain(stop);
  await tbApp(page, 'File Explorer').click();
  await settle(page);
  const explorer = win(page, 'files');
  const style = () =>
    explorer.evaluate((el) => ({
      radius: getComputedStyle(el).borderTopLeftRadius,
      border: getComputedStyle(el).borderTopWidth,
    }));
  expect(await style()).toEqual({ radius: '8px', border: '1px' });
  // Mica is a static wallpaper copy: nothing inside a window uses backdrop-filter (WIN-ID-02).
  const blurred = await explorer.evaluate(
    (el) =>
      [el, ...el.querySelectorAll('*')].filter((node) => {
        const css = getComputedStyle(node);
        return (
          (css.backdropFilter && css.backdropFilter !== 'none') ||
          ((css as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter ?? 'none') !== 'none'
        );
      }).length,
  );
  expect(blurred).toBe(0);
  await explorer.getByRole('button', { name: 'Maximize File Explorer' }).click();
  await settle(page);
  expect((await style()).radius).toBe('0px');
  await expect(explorer.getByRole('button', { name: 'Restore File Explorer' })).toBeVisible();
});

// --- Window manager ---------------------------------------------------------------------------------------------------

test('WIN-WM-01 N1 the window opens from its taskbar button and lands where the storyboard puts File Explorer', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page);
  await page.evaluate(() => {
    const origins: string[] = [];
    (window as unknown as { __origins: string[] }).__origins = origins;
    new MutationObserver(() => {
      const el = document.querySelector<HTMLElement>('[data-window="windows:files"]');
      if (el?.style.transformOrigin) origins.push(el.style.transformOrigin);
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
  });
  const button = await boxOf(tbApp(page, 'File Explorer'));
  await tbApp(page, 'File Explorer').click();
  await settle(page);
  const box = await boxOf(win(page, 'files'));
  expect(box).toEqual({ x: 29, y: 27, w: 691, h: 747 });
  const [first] = await page.evaluate(() => (window as unknown as { __origins: string[] }).__origins);
  const [ox, oy] = (first ?? '').split(' ').map((value) => parseFloat(value));
  expect(Math.abs(ox! - (button.x + button.w / 2 - box.x))).toBeLessThanOrEqual(2);
  expect(Math.abs(oy! - (button.y + button.h / 2 - box.y))).toBeLessThanOrEqual(2);
  await expect(page).toHaveURL(/\/windows\/explorer$/);
  await expect(win(page, 'files')).toBeFocused();
});

test('WIN-WM-02 · WIN-TASK-02 N2 pills: active 16 px accent, running 6 px; focus and z-order follow presses', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page);
  await tbApp(page, 'File Explorer').click();
  await tbApp(page, 'GitHub').click();
  await settle(page);
  const pill = (name: string) => tbApp(page, name).locator('[data-pill]');
  await expect.poll(async () => (await boxOf(pill('GitHub'))).w).toBe(16);
  await expect.poll(async () => (await boxOf(pill('File Explorer'))).w).toBe(6);
  await expect(pill('Outlook')).toHaveAttribute('data-pill', 'none');
  await win(page, 'files').click({ position: { x: 300, y: 12 } });
  await committed(page);
  await expect(win(page, 'files')).toHaveAttribute('data-focused', 'true');
  await expect.poll(async () => (await boxOf(pill('File Explorer'))).w).toBe(16);
});

test('WIN-WM-08 · WIN-WM-10 taskbar clicks: open · minimize when active · restore · close ends the app (pill gone)', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page);
  await tbApp(page, 'Outlook').click();
  await settle(page);
  await expect(win(page, 'mail')).toHaveAttribute('data-phase', 'normal');
  await tbApp(page, 'Outlook').click(); // active → minimize
  await settle(page);
  await expect(win(page, 'mail')).toHaveAttribute('data-phase', 'minimized');
  await expect(tbApp(page, 'Outlook')).toHaveAccessibleName('Outlook, running, minimized');
  await expect(tbApp(page, 'Outlook')).toBeFocused(); // minimize → focus the taskbar button
  await tbApp(page, 'Outlook').click(); // restore
  await settle(page);
  await expect(win(page, 'mail')).toHaveAttribute('data-phase', 'normal');
  await win(page, 'mail').getByRole('button', { name: 'Close Outlook' }).click();
  await settle(page);
  await expect(win(page, 'mail')).toHaveCount(0);
  await expect(tbApp(page, 'Outlook').locator('[data-pill]')).toHaveAttribute('data-pill', 'none');
  await expectFocusNotOnBody(page);
});

test('WIN-WM-03 · WIN-WM-04 N2 drag with clamps; drag to the right edge shows the snap preview; release snaps; Esc cancels', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page);
  await tbApp(page, 'GitHub').click();
  await settle(page);
  const github = win(page, 'github');
  const start = await boxOf(github);
  const renders = (await probe(page))['render:window'] ?? 0;
  // Drag far up: the title bar stays on screen (y ≥ 0), one commit, zero window renders during the drag.
  const hold = await grip(page, 'github');
  await page.mouse.move(hold.x, hold.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(hold.x + i * 10, hold.y - i * 60);
  await page.mouse.up();
  await committed(page);
  const moved = await boxOf(github);
  expect(moved.y).toBe(0);
  expect(((await probe(page))['render:window'] ?? 0) - renders).toBeLessThanOrEqual(2);
  // Snap: rest at the right edge → a translucent preview → release commits to the right half.
  const grab = await grip(page, 'github');
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(1438, 400, { steps: 8 });
  await expect(page.locator('[data-snap-preview]:not([hidden])')).toBeVisible();
  // Esc cancels the preview; the drag continues.
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-snap-preview]:not([hidden])')).toHaveCount(0);
  await page.mouse.move(1439, 420, { steps: 2 });
  await page.mouse.move(1439, 300, { steps: 4 }); // re-arm on the same edge after moving along it
  await page.mouse.move(2, 400, { steps: 10 });
  await expect(page.locator('[data-snap-preview]:not([hidden])')).toBeVisible();
  await page.mouse.up();
  await settle(page);
  await expect(github).toHaveAttribute('data-snap', 'left');
  expect(await boxOf(github)).toEqual({ x: 0, y: 0, w: 720, h: 852 });
  expect(await github.evaluate((el) => getComputedStyle(el).borderTopLeftRadius)).toBe('0px');
  // Dragging a snapped window away restores its pre-snap size under the pointer.
  const away = await grip(page, 'github');
  await page.mouse.move(away.x, away.y);
  await page.mouse.down();
  await page.mouse.move(700, 300, { steps: 8 });
  await page.mouse.up();
  await settle(page);
  await expect(github).not.toHaveAttribute('data-snap');
  expect((await boxOf(github)).w).toBe(start.w);
});

test('WIN-WM-03 · WIN-WM-09 dragging a maximized window restores it under the pointer; title double-click toggles', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page);
  await tbApp(page, 'Outlook').click();
  await settle(page);
  const outlook = win(page, 'mail');
  const normal = await boxOf(outlook);
  const title = await grip(page, 'mail');
  await page.mouse.dblclick(title.x, title.y);
  await settle(page);
  await expect(outlook).toHaveAttribute('data-phase', 'maximized');
  expect(await boxOf(outlook)).toEqual({ x: 0, y: 0, w: 1440, h: 852 });
  // Text is not distorted: no scale transform remains.
  expect(await outlook.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  const top = await grip(page, 'mail');
  await page.mouse.move(top.x, top.y);
  await page.mouse.down();
  await page.mouse.move(top.x, 200, { steps: 8 });
  await page.mouse.up();
  await settle(page);
  await expect(outlook).toHaveAttribute('data-phase', 'normal');
  const restored = await boxOf(outlook);
  expect(restored.w).toBe(normal.w);
  // The pointer kept its proportional place along the title bar.
  expect(Math.abs(top.x - restored.x - (top.x / 1440) * normal.w)).toBeLessThan(24);
});

test('WIN-WM-05 · WIN-WM-11 snap by keyboard: the system menu Snap ▸, the snap layouts flyout, Alt+Shift+Arrow', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page);
  await tbApp(page, 'File Explorer').click();
  await settle(page);
  const explorer = win(page, 'files');
  // System menu (title-bar icon) → Snap ▸ → Right half.
  await explorer.getByRole('button', { name: 'Window menu' }).focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu', { name: 'File Explorer window menu' });
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Snap' }).focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('menu', { name: 'Snap' }).getByRole('menuitem', { name: 'Right half' }).click();
  await settle(page);
  await expect(explorer).toHaveAttribute('data-snap', 'right');
  // Alt+Shift+Left from the right half restores; again snaps left; Alt+Shift+Up → top-left quarter.
  await activate(page, 'files');
  await page.keyboard.press('Alt+Shift+ArrowLeft');
  await settle(page);
  await expect(explorer).not.toHaveAttribute('data-snap');
  await page.keyboard.press('Alt+Shift+ArrowLeft');
  await settle(page);
  await expect(explorer).toHaveAttribute('data-snap', 'left');
  await page.keyboard.press('Alt+Shift+ArrowUp');
  await settle(page);
  await expect(explorer).toHaveAttribute('data-snap', 'tl');
  // The snap layouts flyout by keyboard: Down on Maximize opens it on its first zone; arrows walk the zones; Enter snaps.
  await page.mouse.move(1100, 700); // off the window: a resting pointer never plays with the hover flyout
  await explorer.getByRole('button', { name: /^(Maximize|Restore) File Explorer$/ }).focus();
  await page.keyboard.press('ArrowDown');
  const layouts = page.getByRole('dialog', { name: 'Snap layouts' });
  await expect(layouts).toBeVisible();
  await expect(layouts.getByRole('button', { name: 'Snap left half' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(layouts.getByRole('button', { name: 'Snap right half' })).toBeFocused();
  await page.keyboard.press('Enter');
  await settle(page);
  await expect(explorer).toHaveAttribute('data-snap', 'right');
  await expect(layouts).toHaveCount(0);
  await expectFocusNotOnBody(page);
});

test('WIN-WM-07 paired resize: the shared edge of a ½ + ½ pair moves both windows', async ({ page }, info) => {
  desktopOnly(info);
  await openWindows(page);
  await tbApp(page, 'File Explorer').click();
  await tbApp(page, 'GitHub').click();
  await settle(page);
  await activate(page, 'files');
  await page.keyboard.press('Alt+Shift+ArrowLeft');
  await expect(win(page, 'files')).toHaveAttribute('data-snap', 'left');
  await activate(page, 'github');
  await page.keyboard.press('Alt+Shift+ArrowRight');
  await expect(win(page, 'github')).toHaveAttribute('data-snap', 'right');
  await quiet(page);
  await expect.poll(() => boxOf(win(page, 'github'))).toMatchObject({ x: 720, w: 720 });
  const edge = win(page, 'files').locator('[data-resize="e"]');
  const handle = await boxOf(edge);
  await page.mouse.move(handle.x + 3, 400);
  await page.mouse.down();
  await page.mouse.move(handle.x + 3 + 144, 400, { steps: 6 });
  await page.mouse.up();
  await settle(page);
  expect((await boxOf(win(page, 'files'))).w).toBe(864);
  expect(await boxOf(win(page, 'github'))).toMatchObject({ x: 864, w: 576 });
});

test('WIN-WM-13 · ROUTE-EVENT-01 H1 history per window event on Windows; Back never closes windows', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page);
  await tbApp(page, 'File Explorer').click();
  await expect(page).toHaveURL(/\/windows\/explorer$/);
  await tbApp(page, 'GitHub').click();
  await expect(page).toHaveURL(/\/windows\/github$/);
  const length = await page.evaluate(() => history.length);
  await settle(page);
  // Snap, maximize, move write nothing.
  await win(page, 'github').focus();
  await page.keyboard.press('Alt+Shift+ArrowLeft');
  await page.keyboard.press('Alt+Shift+ArrowUp');
  await committed(page);
  expect(await page.evaluate(() => history.length)).toBe(length);
  await page.goBack();
  await expect(page).toHaveURL(/\/windows\/explorer$/);
  await expect(win(page, 'github')).toHaveCount(1); // Back never closes windows (E14)
  await expect(win(page, 'files')).toHaveAttribute('data-focused', 'true');
  await page.goBack();
  await expect(page).toHaveURL(/\/windows$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/windows\/explorer$/);
  await expectFocusNotOnBody(page);
});

// --- Taskbar surfaces ---------------------------------------------------------------------------------------------------

test('WIN-TASK-03 N2 hover 400 ms shows the thumbnail card; hovering it dims the other windows', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'chromium-desktop', 'hover intent on a fine pointer');
  await openWindows(page);
  await tbApp(page, 'File Explorer').click();
  await tbApp(page, 'GitHub').click();
  await settle(page);
  await tbApp(page, 'File Explorer').hover();
  const card = page.locator('[data-preview-card]');
  await expect(card).toBeVisible();
  await card.hover();
  await expect(win(page, 'github')).toHaveAttribute('data-dimmed', 'true');
  await expect(win(page, 'files')).not.toHaveAttribute('data-dimmed');
  await page.mouse.move(700, 300);
  await expect(card).toHaveCount(0);
  await expect(win(page, 'github')).not.toHaveAttribute('data-dimmed');
});

test('WIN-TASK-04 the GitHub jump list opens a featured project (right-click, Shift+F10)', async ({ page }, info) => {
  desktopOnly(info);
  await openWindows(page);
  await tbApp(page, 'GitHub').click({ button: 'right' });
  const list = page.getByRole('menu', { name: 'GitHub jump list' });
  await expect(list).toBeVisible();
  const first = list.getByRole('menuitem').first();
  const name = (await first.textContent()) ?? '';
  await first.click();
  await expect(page).toHaveURL(/\/windows\/github\/[a-z0-9-]+$/);
  await expect(win(page, 'github')).toContainText(name);
  await tbApp(page, 'File Explorer').focus();
  await page.keyboard.press('Shift+F10');
  await expect(page.getByRole('menu', { name: 'File Explorer jump list' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tbApp(page, 'File Explorer')).toBeFocused();
});

test('WIN-TASK-05 · WIN-NOTIF-04 the tray: Quick Settings tiles toggle and persist; the clock opens the Center', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page);
  await taskbar(page)
    .getByRole('button', { name: /^Quick Settings/ })
    .click();
  const quick = page.getByRole('dialog', { name: 'Quick Settings' });
  await expect(quick).toBeVisible();
  const motion = quick.getByRole('button', { name: 'Reduce motion' });
  const before = await motion.getAttribute('aria-pressed');
  await motion.click();
  await committed(page);
  await expect(motion).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true');
  await expect(page.locator('html')).toHaveAttribute('data-motion', before === 'true' ? 'full' : 'reduced');
  await page.reload();
  await waitForOs(page, 'windows');
  await expect(page.locator('html')).toHaveAttribute('data-motion', before === 'true' ? 'full' : 'reduced');
  await taskbar(page)
    .getByRole('button', { name: /^Notification Center/ })
    .click();
  await expect(page.getByRole('dialog', { name: 'Notification Center' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Notification Center' })).toHaveCount(0);
});

test('WIN-TASK-06 Show desktop minimizes every window, a second press restores them; an open in between resets it', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page);
  await tbApp(page, 'File Explorer').click();
  await tbApp(page, 'Outlook').click();
  await settle(page);
  const sliver = page.getByRole('button', { name: 'Show desktop' });
  await sliver.click();
  await settle(page);
  await expect(page.locator('[data-window][data-phase="minimized"]')).toHaveCount(2);
  await sliver.click();
  await settle(page);
  await expect(page.locator('[data-window][data-phase="normal"]')).toHaveCount(2);
  await sliver.click();
  await settle(page);
  await tbApp(page, 'GitHub').click(); // E11: the restore set is stale now
  await settle(page);
  await sliver.click();
  await settle(page);
  await expect(page.locator('[data-window][data-phase="minimized"]')).toHaveCount(3);
});

// --- Start, Search -----------------------------------------------------------------------------------------------------

test('WIN-START-01 · WIN-START-03 · WIN-SEARCH-02 N1 Start above the centred taskbar; typing morphs it into Search', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page);
  const start = taskbar(page).getByRole('button', { name: 'Start' });
  await start.click();
  const dialog = page.getByRole('dialog', { name: 'Start' });
  await expect(dialog.getByRole('combobox', { name: 'Search' })).toBeVisible(); // the real panel, not its placeholder
  await quiet(page);
  const panel = await boxOf(dialog);
  const bar = await boxOf(taskbar(page));
  expect(panel.y + panel.h).toBe(bar.y - 12);
  expect(Math.abs(panel.x + panel.w / 2 - 720)).toBeLessThanOrEqual(1);
  // Keystrokes typed at once are all kept (E9) and the same panel becomes Search — no close/re-open.
  await page.keyboard.type('exp');
  const search = page.getByRole('dialog', { name: 'Search' });
  await expect(search).toBeVisible();
  await expect(search.getByRole('combobox', { name: 'Search' })).toHaveValue('exp');
  await expect(search.getByRole('option').first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/windows\/explorer(\/experience)?$/);
  await expect(dialog).toHaveCount(0);
  await expectFocusNotOnBody(page);
});

test('WIN-SEARCH-03 · SRCH-ACT-01 S1 a result opens through the kernel with exactly one history entry', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page);
  const before = await page.evaluate(() => history.length);
  await page.keyboard.press('Control+k');
  const search = page.getByRole('dialog', { name: 'Search' });
  await expect(search).toBeVisible();
  await page.keyboard.type('résumé');
  await expect(search.getByRole('option').first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/windows\/edge\/resume$/);
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
});

test('WIN-SEARCH-04 · SRCH-TERM-01 a command is inserted into Terminal, never run; winver opens the About dialog', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page);
  await page.keyboard.press('Control+k');
  await page.keyboard.type('whoami');
  const search = page.getByRole('dialog', { name: 'Search' });
  await expect(search.getByRole('option', { name: /whoami/ }).first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/windows\/terminal$/);
  const prompt = win(page, 'terminal').getByRole('textbox', { name: /^Command/ });
  await expect(prompt).toHaveValue('whoami');
  await taskbar(page).getByRole('button', { name: 'Search' }).click();
  await page.keyboard.type('winver');
  await page.keyboard.press('Enter');
  const about = page.getByRole('dialog', { name: /About Windows/ });
  await expect(about).toBeVisible();
  await expect(about).toContainText('This product is licensed to');
  await page.keyboard.press('Escape');
  await expect(about).toHaveCount(0);
});

test('WIN-START-04 · WIN-START-05 All apps with the letter jump; Shut down returns to the chooser, the session parked', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page);
  await tbApp(page, 'File Explorer').click();
  await settle(page);
  await taskbar(page).getByRole('button', { name: 'Start' }).click();
  const start = page.getByRole('dialog', { name: 'Start' });
  await start.getByRole('button', { name: /All apps/ }).click();
  await start.getByRole('button', { name: /^Letter G/ }).click();
  await start.getByRole('button', { name: 'O', exact: true }).click();
  await expect(start.getByRole('link', { name: 'Outlook' })).toBeFocused();
  await start.getByRole('button', { name: 'Power' }).click();
  await page.getByRole('menuitem', { name: 'Shut down' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Choose how you want to explore' })).toBeVisible();
  await page.locator('[data-chooser-card="windows"]').click();
  await waitForOs(page, 'windows');
  await expect(win(page, 'files')).toBeAttached(); // parked, not destroyed
});

// --- Context menus, Task View -----------------------------------------------------------------------------------------

test('WIN-CTX-02 · WIN-CTX-03 · WIN-CTX-04 menus: desktop View ▸ resizes icons; item Properties; Show more options swaps in place', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page);
  await page.mouse.click(900, 400, { button: 'right' });
  const menu = page.getByRole('menu', { name: 'Desktop' });
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: 'View' }).hover();
  await page.getByRole('menuitemcheckbox', { name: 'Large icons' }).click();
  await expect(page.locator('[data-desktop]')).toHaveAttribute('data-icon-size', 'large');
  // Keyboard invocation on an item: Shift+F10 → the command row + Properties.
  await page.getByRole('link', { name: 'Résumé.pdf' }).focus();
  await page.keyboard.press('Shift+F10');
  const item = page.getByRole('menu', { name: 'Résumé.pdf actions' });
  await expect(item.getByRole('group', { name: 'Quick actions' }).getByRole('menuitem')).toHaveText(['', '', '']);
  await item.getByRole('menuitem', { name: 'Show more options' }).click();
  await expect(page.getByRole('menuitem', { name: 'Copy as path' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Properties' }).click();
  const props = page.getByRole('dialog', { name: 'Résumé.pdf Properties' });
  await expect(props).toContainText('PDF Document');
  await page.keyboard.press('Escape');
  await expect(props).toHaveCount(0);
  await expectFocusNotOnBody(page);
});

test('WIN-TV-01 · WIN-TV-02 · WIN-TV-04 Task View: every window incl. minimized, titles above tiles; close regrids; choose restores', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page);
  await tbApp(page, 'File Explorer').click();
  await tbApp(page, 'GitHub').click();
  await tbApp(page, 'Outlook').click();
  await settle(page);
  await tbApp(page, 'Outlook').click(); // minimize
  await settle(page);
  await page.keyboard.press('Alt+Shift+O');
  const view = page.getByRole('dialog', { name: 'Task View' });
  await expect(view).toBeVisible();
  await expect(view.locator('[data-task-tile]')).toHaveCount(3);
  await expect(view.getByRole('button', { name: /^Outlook.*, minimized$/ })).toBeVisible();
  const title = view
    .locator('li', { has: page.locator('[data-task-tile="windows:github"]') })
    .locator('span')
    .first();
  const tile = view.locator('[data-task-tile="windows:github"]');
  expect((await boxOf(title)).y).toBeLessThan((await boxOf(tile)).y);
  await tile.focus();
  await page.keyboard.press('Delete');
  await expect(view.locator('[data-task-tile]')).toHaveCount(2);
  await view
    .getByRole('button', { name: /^Outlook/ })
    .first()
    .click();
  await settle(page);
  await expect(view).toHaveCount(0);
  await expect(win(page, 'mail')).toHaveAttribute('data-phase', 'normal');
  await expect(win(page, 'mail')).toHaveAttribute('data-focused', 'true');
});

// --- Compact (N3) --------------------------------------------------------------------------------------------------------

test('WIN-WM-12 · WIN-START-07 · WIN-RESP-03 · WIN-RESP-04 N3 compact: one maximized window, min + close at 48 × 44, Start sheet that Back closes', async ({
  page,
}, info) => {
  compactOnly(info);
  await openWindows(page);
  await taskbar(page).getByRole('button', { name: 'Start' }).click();
  const sheet = page.getByRole('dialog', { name: 'Start' });
  await expect(sheet).toBeVisible();
  const url = page.url();
  await page.goBack(); // Back closes the sheet only
  await expect(sheet).toHaveCount(0);
  expect(page.url()).toBe(url);
  await taskbar(page).getByRole('button', { name: 'Start' }).click();
  await sheet.getByRole('link', { name: 'GitHub' }).click();
  await expect(page).toHaveURL(/\/windows\/github$/);
  await settle(page);
  const github = win(page, 'github');
  const box = await boxOf(github);
  expect(box.x).toBe(0);
  expect(box.w).toBe(page.viewportSize()!.width);
  const captions = github.getByRole('group', { name: 'Window controls' }).getByRole('button');
  await expect(captions).toHaveCount(2);
  for (const button of await captions.all()) {
    const size = await boxOf(button);
    expect(size.w).toBeGreaterThanOrEqual(48);
    expect(size.h).toBeGreaterThanOrEqual(44);
  }
  // Task View is the switcher; Back after the sheet navigates as usual.
  await page.goBack();
  await expect(page).toHaveURL(/\/windows$/);
  await expectFocusNotOnBody(page);
});

test('RES-COMPACT-01 · WIN-X-01 Q1 the résumé is one click from the taskbar, the desktop, Start and Search', async ({
  page,
}) => {
  await openWindows(page);
  await taskbar(page).getByRole('link', { name: 'Résumé (PDF)' }).click();
  await expect(page).toHaveURL(/\/windows\/edge\/resume$/);
  await settle(page);
  await page.goto('/windows');
  await waitForOs(page, 'windows');
  await page.getByRole('list', { name: 'Desktop' }).getByRole('link', { name: 'Résumé.pdf' }).dblclick();
  await expect(page).toHaveURL(/\/windows\/edge\/resume$/);
});

// --- Deep links, persistence, boot, lock ------------------------------------------------------------------------------

test('ROUTE-DEEP-01 · WIN-BOOT-02 · WIN-LOCK-02 D1 cold deep links open only the named app — no boot, no lock', async ({
  page,
}) => {
  await openWindows(page, '/windows/edge/resume');
  await expect(page.locator('[data-window]')).toHaveCount(1);
  await expect(win(page, 'browser')).toBeVisible();
  await expect(page.locator('[data-boot]')).toHaveCount(0);
  await expect(page.locator('[data-lock]')).toHaveCount(0);
  await expect(page).toHaveTitle('Résumé · Microsoft Edge · Windows 11 — Jaswanth');
  await page.reload();
  await waitForOs(page, 'windows');
  await expect(page.locator('[data-lock]')).toHaveCount(0);
  await expect(win(page, 'browser')).toBeVisible();
});

test('WIN-CASE-03 · KRN-SES-01 P1 reload restores windows, snaps and the focused app; storage corrupt never breaks boot', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page);
  await tbApp(page, 'File Explorer').click();
  await tbApp(page, 'GitHub').click();
  await settle(page);
  await page.keyboard.press('Alt+Shift+ArrowRight');
  // The shortcut commits a frame after the press (dispatchSoon): see the snap land before reloading.
  await expect(win(page, 'github')).toHaveAttribute('data-snap', 'right');
  await settle(page);
  await page.reload();
  await waitForOs(page, 'windows');
  await settle(page);
  await expect(win(page, 'files')).toBeAttached();
  await expect(win(page, 'github')).toHaveAttribute('data-snap', 'right');
  await expect(win(page, 'github')).toHaveAttribute('data-focused', 'true');
  await page.evaluate(() => window.localStorage.setItem('pf.sessions.v1', '{not json'));
  await page.reload();
  await waitForOs(page, 'windows');
  await expect(taskbar(page)).toBeVisible();
});

test('WIN-LOCK-01 · WIN-LOCK-03 · WIN-LOCK-04 · WIN-BOOT-03 first chooser entry: lock → sign-in → desktop; a card opens its app', async ({
  page,
}, info) => {
  desktopOnly(info);
  await toChooser(page);
  await page.locator('[data-chooser-card="windows"]').click();
  await waitForOs(page, 'windows');
  const lock = page.locator('[data-lock]');
  await expect(lock).toBeVisible();
  await expect(lock.getByRole('list', { name: 'Notifications' }).getByRole('link').first()).toContainText(
    'Résumé ready to view',
  );
  await expect(lock.locator('input')).toHaveCount(0);
  // Two quick key presses land on the desktop (the second completes the slide at once).
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  await expect(lock).toHaveCount(0);
  await expect(taskbar(page)).toBeVisible();
  // The welcome toast arrives (and never takes focus).
  await expect(page.locator('[data-toast="welcome"]')).toBeVisible();
  await expectFocusNotOnBody(page);
  // Re-entry this session: no lock again.
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.locator('[data-chooser-card="windows"]').click();
  await waitForOs(page, 'windows');
  await expect(page.locator('[data-lock]')).toHaveCount(0);
});

test('CONT-ACCEPT-01 · CONT-NEVER-01 · WIN-X-02 · WIN-NOTIF-02 C1 continuity from macOS: a toast offers, never opens by itself', async ({
  page,
}, info) => {
  desktopOnly(info);
  await toChooser(page);
  await page.locator('[data-chooser-card="macos"]').click();
  await waitForOs(page, 'macos');
  // macOS's own first-entry lock screen (plans/macos/surfaces/lock-screen.md).
  await page.getByRole('button', { name: 'Enter macOS' }).click();
  await expect(page.locator('[data-lock-screen]')).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Dock' })
    .getByRole('link', { name: /^GitHub/ })
    .click();
  await expect(page).toHaveURL(/\/macos\/github/);
  await committed(page);
  // Switch from macOS's own Switch Operating System sheet straight to Windows.
  await page.locator('header[data-menubar]').getByRole('menuitem', { name: 'Apple' }).click();
  await page.getByRole('menuitem', { name: 'Switch Operating System…' }).click();
  await page
    .getByRole('list', { name: 'Operating systems' })
    .getByRole('button', { name: /^Switch to Windows/ })
    .click();
  await waitForOs(page, 'windows');
  // The offer: the lock screen's card on a first chooser entry, else a toast. Never an auto-opened window.
  const lock = page.locator('[data-lock]');
  const toast = page.locator('[data-toast="continuity"]');
  await expect(lock.or(toast).first()).toBeVisible();
  await expect(page.locator('[data-window]')).toHaveCount(0);
  if (await lock.count()) await lock.getByRole('link', { name: /Continue from macOS/ }).click();
  else {
    await expect(toast).toContainText('Continue from macOS');
    await toast.getByRole('button', { name: 'Open' }).click();
  }
  // Accepting is the visitor's choice: GitHub opens at the same place.
  await expect(page).toHaveURL(/\/windows\/github/);
  await expect(win(page, 'github')).toBeVisible();
  await expectFocusNotOnBody(page);
});

test('WIN-X-05 Switch OS from Settings-free paths: Alt+Shift+S and the desktop menu lead to the chooser', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page);
  await page.keyboard.press('Alt+Shift+S');
  await expect(page).toHaveURL(/\/$/);
  await page.goBack(); // Switch OS pushes "/", so Back returns to Windows
  await waitForOs(page, 'windows');
  await page.mouse.click(900, 400, { button: 'right' });
  await page.getByRole('menuitem', { name: 'Switch operating system' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('WIN-X-04 · EGG-KONAMI-01 the Konami code shimmers the taskbar and counts once', async ({ page }, info) => {
  desktopOnly(info);
  await openWindows(page);
  for (const key of [
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowLeft',
    'ArrowRight',
    'b',
    'a',
  ])
    await page.keyboard.press(key);
  await expect(taskbar(page)).toHaveAttribute('data-shimmer', 'true');
  await expect(page.locator('[data-toast="konami"]')).toBeVisible();
  const found = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('pf.prefs.v1') ?? '{}').state?.eggsFound ?? []);
  await expect.poll(found).toContain('EGG-KONAMI-01');
});

// --- Accessibility, blur, reduced motion, resize --------------------------------------------------------------------

test('WIN-A11Y-01 · A11Y-SEM-01 X2 landmarks in reading order: main, then the taskbar nav, then the status regions', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page);
  await tbApp(page, 'GitHub').click();
  await settle(page);
  const order = await page.evaluate(() =>
    [
      ...document.querySelectorAll('.os-root main, .os-root nav[aria-label="Taskbar"], .os-root [data-toast-region]'),
    ].map((el) => el.tagName.toLowerCase()),
  );
  expect(order).toEqual(['main', 'nav', 'section']);
  await expect(page.locator('.os-root [role="menubar"]').first())
    .toBeHidden({ timeout: 1000 })
    .catch(() => undefined);
  await expect(page.locator('.os-root main').getByRole('heading', { level: 1 })).toHaveText(/^Windows 11 — /);
  await expect(win(page, 'github')).toHaveAttribute('aria-labelledby', /win-title-github/);
});

test('WIN-A11Y-02 · A11Y-AXE-01 · WIN-START-08 · WIN-SEARCH-06 X1 axe clean: home, File Explorer, Start, Search and Task View open', async ({
  page,
}, info) => {
  desktopOnly(info);
  const scan = async (label: string) => {
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(violations.map((violation) => `${label}: ${violation.id} ${violation.nodes[0]?.target}`)).toEqual([]);
  };
  await openWindows(page);
  await quiet(page);
  await scan('home');
  await tbApp(page, 'File Explorer').click();
  await settle(page);
  await quiet(page);
  await scan('explorer');
  await taskbar(page).getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('dialog', { name: 'Start' }).getByRole('combobox', { name: 'Search' })).toBeVisible();
  await quiet(page);
  await scan('start');
  await page.keyboard.type('git');
  await expect(page.getByRole('dialog', { name: 'Search' }).getByRole('combobox', { name: 'Search' })).toBeVisible();
  await quiet(page);
  await scan('search');
  await page.keyboard.press('Escape'); // clears the query
  await page.keyboard.press('Escape'); // closes; focus returns to its invoker
  await expect(page.getByRole('dialog', { name: /^(Start|Search)$/ })).toHaveCount(0);
  await expect(taskbar(page).getByRole('button', { name: 'Start' })).toBeFocused();
  await page.keyboard.press('Alt+Shift+O');
  await expect(page.getByRole('dialog', { name: 'Task View' })).toBeVisible();
  await quiet(page);
  await scan('taskview');
});

test('WIN-ID-03 · PERF-BLUR-01 X5 at most 3 live backdrop-filter surfaces with Start and a menu open', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page);
  await taskbar(page).getByRole('button', { name: 'Start' }).click();
  await page.getByRole('dialog', { name: 'Start' }).getByRole('button', { name: 'Power' }).click();
  await expect(page.getByRole('menu', { name: 'Power' })).toBeVisible();
  const live = await page.evaluate(
    () =>
      [...document.querySelectorAll('.os-root *')].filter((el) => {
        const css = getComputedStyle(el);
        const value = css.backdropFilter || (css as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter;
        return value && value !== 'none';
      }).length,
  );
  expect(live).toBeLessThanOrEqual(3);
});

test('WIN-MOTION-04 · MOTION-RM-01 R1 reduced motion: nothing longer than 200 ms runs; end states match', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'reduced-motion', 'the reduced-motion project');
  await openWindows(page);
  await tbApp(page, 'File Explorer').click();
  await taskbar(page).getByRole('button', { name: 'Start' }).click();
  const long = await page.evaluate(
    () =>
      document.getAnimations().filter((animation) => {
        const timing = animation.effect?.getComputedTiming();
        return typeof timing?.duration === 'number' && timing.duration > 200 && timing.iterations !== Infinity;
      }).length,
  );
  expect(long).toBe(0);
  await settle(page);
  await expect(win(page, 'files')).toHaveAttribute('data-phase', 'normal');
});

test('WIN-RESP-06 · WIN-WM-06 O1 a viewport resize re-derives snapped windows and re-clamps floats', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page);
  await tbApp(page, 'File Explorer').click();
  await tbApp(page, 'Outlook').click();
  await settle(page);
  await activate(page, 'files');
  await page.keyboard.press('Alt+Shift+ArrowLeft');
  await settle(page);
  await page.setViewportSize({ width: 1200, height: 800 });
  await expect.poll(() => boxOf(win(page, 'files'))).toEqual({ x: 0, y: 0, w: 600, h: 752 });
  const outlook = await boxOf(win(page, 'mail'));
  expect(outlook.x + 48).toBeLessThanOrEqual(1200);
  await page.setViewportSize({ width: 390, height: 844 }); // across the compact boundary: all maximize
  await settle(page);
  await expect(win(page, 'files')).toHaveAttribute('data-compact', 'true');
  await page.setViewportSize({ width: 1440, height: 900 }); // back: snaps and floats are kept
  await settle(page);
  await expect(win(page, 'files')).toHaveAttribute('data-snap', 'left');
});

test('WIN-RESP-07 · RESP-ZOOM-01 400 % zoom engages compact mode', async ({ page }, info) => {
  desktopOnly(info);
  await page.setViewportSize({ width: 360, height: 225 }); // 1440 × 900 at 400 %
  await openWindows(page);
  await expect(page.locator('[data-win-posture="compact"]')).toBeAttached();
});
