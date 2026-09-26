/**
 * macOS — P2 vertical slice (plans/macos/08-acceptance.md P2 rows; shared/12 journeys M1 · M2 · M3 · H1 · D1 · X1–X5).
 *   Desktop + wallpaper, the static menu bar, the Dock, the window manager, Finder, compact mode, the résumé fast path.
 * Every step waits on an end state (never a sleep for correctness) and asserts focus never rests on <body>.
 * The acceptance probes (`pf.debug.probe`) count window renders / kernel actions and expose `__motion.debug()`.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { committed, expectFocusNotOnBody, waitForOs } from './helpers';

type Box = { x: number; y: number; w: number; h: number };

const DESKTOP = ['chromium-desktop', 'reduced-motion', 'asset-original', 'firefox-desktop'];
const COMPACT = ['iphone', 'pixel', 'iphone-landscape'];
const desktopOnly = (info: TestInfo) =>
  test.skip(!DESKTOP.includes(info.project.name), 'fine-pointer desktop posture (expanded / large)');
const compactOnly = (info: TestInfo) => test.skip(!COMPACT.includes(info.project.name), 'compact posture (phones)');

const dock = (page: Page) => page.getByRole('navigation', { name: 'Dock' });
const dockApp = (page: Page, name: string) =>
  dock(page).getByRole('link', { name: new RegExp(`^${name}(, (open|minimized|running))?$`) });
const win = (page: Page, role: string) => page.locator(`[data-window="macos:${role}"]`);
const boxOf = (locator: Locator): Promise<Box> =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
const probe = (page: Page) =>
  page.evaluate(() => ({ ...((window as unknown as { __pfProbe?: Record<string, number> }).__pfProbe ?? {}) }));

/** Settled: no window opening/closing and no motion tween running. */
async function settle(page: Page) {
  await committed(page); // never check the state from before the last press
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

// --- Home: desktop, menu bar, Dock ---------------------------------------------------------------------------------

test('MAC-MENU-01 · MAC-DESK-01 · MAC-DOCK-01 the home: static menu bar, desktop items and Dock as real links @smoke', async ({
  page,
  request,
}) => {
  await openMacos(page);
  const bar = page.getByRole('banner');
  await expect(bar.getByText('Finder', { exact: true })).toBeVisible(); // no window focused → "Finder"
  await expect(
    bar.getByRole('group', { name: 'Status menus' }).getByRole('link', { name: 'Résumé (PDF)' }),
  ).toBeVisible();
  await expect(bar.locator('time')).toHaveText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2}:\d{2} (AM|PM)$/);

  const desktop = page.getByRole('list', { name: 'Desktop' });
  const items = desktop.getByRole('link');
  await expect(items).toHaveText(['Résumé.pdf', 'Projects', 'Experience']);
  expect(await items.evaluateAll((links) => links.map((a) => a.getAttribute('href')))).toEqual([
    '/macos/preview',
    '/macos/github',
    '/macos/finder/experience',
  ]);

  // The Dock: the storyboard frame's order, then the Résumé stack; no running dots yet.
  const names = await dock(page).getByRole('link').allInnerTexts();
  expect(names.map((name) => name.trim())).toEqual([
    'Finder',
    'Safari',
    'GitHub',
    'Mail',
    'Preview',
    'Visual Studio Code',
    'Terminal',
    'System Settings',
    '',
  ]);
  await expect(dock(page).getByRole('link', { name: 'Résumé (PDF)' })).toHaveAttribute('href', '/macos/preview');
  await expect(dock(page).locator('[data-running]')).toHaveCount(0);

  // W2: every Dock and desktop link is a real, statically generated page (works without JavaScript).
  const hrefs = await page
    .locator('[data-dock] a[href], [aria-label="Desktop"] a[href]')
    .evaluateAll((links) => links.map((a) => a.getAttribute('href')!));
  for (const href of new Set(hrefs)) expect((await request.get(href)).status(), href).toBe(200);

  // The app name follows the focused window (and the running dot appears).
  await dockApp(page, 'GitHub').click();
  await expect(bar.getByText('GitHub', { exact: true })).toBeVisible();
  await expect(dockApp(page, 'GitHub')).toHaveAttribute('data-running');
  await expect(dockApp(page, 'GitHub')).toHaveAccessibleName('GitHub, open');
  await expect(dockApp(page, 'GitHub')).toHaveAttribute('aria-current', 'true');
  await expectFocusNotOnBody(page);
});

test('MAC-ID-04 the wallpaper is the storyboard gradient and static at T0/T1; tier 2 adds ±8 px parallax', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page);
  const wallpaper = page.locator('[data-wallpaper]');
  const image = await wallpaper.evaluate((el) => getComputedStyle(el).backgroundImage);
  // plans/macos/01-identity: linear-gradient(150deg, #1f4f7a 0%, #3f78a8 35%, #e3a873 78%, #f3d3a4 100%)
  for (const stop of [
    '150deg',
    'rgb(31, 79, 122)',
    'rgb(63, 120, 168) 35%',
    'rgb(227, 168, 115) 78%',
    'rgb(243, 211, 164)',
  ])
    expect(image).toContain(stop);
  for (const [x, y] of [
    [100, 200],
    [1200, 700],
    [700, 450],
  ] as const)
    await page.mouse.move(x, y, { steps: 4 });
  expect(await wallpaper.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  expect(await wallpaper.evaluate((el) => el.getAnimations().length)).toBe(0);
  test.skip(info.project.name === 'reduced-motion', 'no parallax under reduced motion');
  await page.evaluate(() => (document.documentElement.dataset.tier = '2'));
  await page.mouse.move(40, 40, { steps: 6 });
  await expect.poll(() => wallpaper.evaluate((el) => getComputedStyle(el).transform)).not.toBe('none');
  const shift = await wallpaper.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
  expect(Math.abs(shift)).toBeLessThanOrEqual(8);
});

// --- Finder --------------------------------------------------------------------------------------------------------

test('MAC-FIND-01 · MAC-FIND-02 Finder: sidebar, columns from data, select → URL + preview, open → document', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page);
  await dockApp(page, 'Finder').click();
  const finder = win(page, 'files');
  await expect(finder).toBeFocused();
  await expect(finder.getByRole('navigation', { name: 'Favourites' }).getByRole('link')).toHaveText([
    'Jaswanth',
    'Experience',
    'Education',
    'Projects',
    'Résumé',
  ]);
  await finder.getByRole('navigation', { name: 'Favourites' }).getByRole('link', { name: 'Experience' }).click();
  await expect(page).toHaveURL(/\/macos\/finder\/experience$/);
  await expect(finder.getByRole('heading', { level: 2 })).toHaveText('Finder — Experience');
  const entries = finder.locator('[data-column="entries"] a');
  await expect(entries).toHaveText([
    'Xclusive Trading Inc. — Software Engineer',
    'IBM — Software Engineer',
    'All India Council for Technical Education (AICTE) — Technical Intern',
  ]); // data/portfolio via selectors
  await entries.first().click();
  await expect(page).toHaveURL(/\/macos\/finder\/experience\/xclusive-trading$/);
  const preview = finder.getByRole('region', { name: 'Preview' });
  await expect(preview.getByRole('heading', { level: 3 })).toHaveText('Software Engineer');
  await expect(preview).toContainText('Xclusive Trading Inc. · Jun 2025 – Present');
  await expect(preview.getByRole('list', { name: 'Stack' }).getByRole('listitem').first()).toHaveText('Go');
  await preview.getByRole('button', { name: 'Open' }).click();
  const document = finder.locator('[data-finder-document]');
  await expect(document).toBeVisible();
  await expect(document).toBeFocused();
  await expect(document.getByRole('heading', { level: 3, name: 'Software Engineer' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(document).toBeHidden();
  await expect(entries.first()).toBeFocused();
  // Keyboard: Down selects the next role, Left returns to the folder column.
  await page.keyboard.press('ArrowDown');
  await expect(page).toHaveURL(/\/experience\/ibm$/);
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/\/macos\/finder\/experience$/);
  await expectFocusNotOnBody(page);
});

test('ROUTE-DEEP-01 · MAC-FIND-02 D1 cold deep link: only Finder opens, the selection is restored, no boot screen', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page, '/macos/finder/experience/ibm');
  await expect(page.locator('[data-window]')).toHaveCount(1);
  await expect(win(page, 'files')).toBeVisible();
  await expect(win(page, 'files').locator('[data-column="entries"] [aria-current="true"]')).toHaveText('IBM — Software Engineer');
  await expect(win(page, 'files').getByRole('region', { name: 'Preview' })).toContainText('for DBS Bank');
  await expect(page.locator('[data-boot]')).toHaveCount(0);
  await expect(page).toHaveTitle('Software Engineer · IBM · Finder · macOS — Jaswanth');
});

test('MAC-FIND-03 · ROUTE-EVENT-01 · MAC-WM-11 H1: in-app Back equals browser Back; window events follow the history table', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page);
  const start = await page.evaluate(() => history.length);
  await dockApp(page, 'Finder').click(); // open → go
  const finder = win(page, 'files');
  await finder.getByRole('navigation', { name: 'Favourites' }).getByRole('link', { name: 'Education' }).click();
  await finder.locator('[data-column="entries"] a').first().click(); // in-app navigation → go
  await expect(page).toHaveURL(/\/macos\/finder\/education\/uab$/);
  const deep = await page.evaluate(() => history.length);
  await finder.getByRole('button', { name: 'Back' }).click(); // in-app Back collapses into browser Back
  await expect(page).toHaveURL(/\/macos\/finder\/education$/);
  expect(await page.evaluate(() => history.length)).toBe(deep);
  await page.goBack(); // browser Back walks the same stack
  await expect(page).toHaveURL(/\/macos\/finder$/);
  await expect(finder.getByRole('button', { name: 'Back' })).toBeDisabled();
  await page.goForward();
  await expect(page).toHaveURL(/\/macos\/finder\/education$/);
  await finder.getByRole('button', { name: 'Forward' }).click();
  await expect(page).toHaveURL(/\/education\/uab$/);

  // Zoom and move write nothing.
  const before = page.url();
  const length = await page.evaluate(() => history.length);
  await finder.getByRole('button', { name: 'Zoom Finder' }).click();
  await settle(page);
  await finder.getByRole('button', { name: 'Restore Finder' }).click();
  await settle(page);
  expect(page.url()).toBe(before);
  expect(await page.evaluate(() => history.length)).toBe(length);

  // Minimize hands the URL to the next window, or the OS home.
  await finder.getByRole('button', { name: 'Minimize Finder' }).click();
  await expect(page).toHaveURL(/\/macos$/);
  expect(await page.evaluate(() => history.length)).toBeGreaterThanOrEqual(start);
  await expectFocusNotOnBody(page);
});

// --- Window manager ---------------------------------------------------------------------------------------------------

test('MAC-WM-01 the storyboard placement, the 24 px cascade and learned rects on reopen', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-desktop', 'placement is asserted at the frame size, 1440 × 900');
  await openMacos(page);
  await dockApp(page, 'GitHub').click();
  await dockApp(page, 'Finder').click();
  await settle(page);
  // plans/macos/01-identity reference state: GitHub at 30 %/13 % 50 × 52 %, Finder at 7 %/24 % 62 × 54 %.
  expect(await boxOf(win(page, 'github'))).toEqual({ x: 432, y: 117, w: 720, h: 468 });
  expect(await boxOf(win(page, 'files'))).toEqual({ x: 101, y: 216, w: 893, h: 486 });

  await dockApp(page, 'Safari').click();
  await dockApp(page, 'Mail').click();
  await settle(page);
  const safari = await boxOf(win(page, 'browser'));
  const mail = await boxOf(win(page, 'mail'));
  expect({ dx: mail.x - safari.x, dy: mail.y - safari.y }).toEqual({ dx: 24, dy: 24 });

  // Drag Safari, close it, reopen: it comes back where the visitor left it. The grab point is an empty stretch of
  // the title bar (P3 toolbars hold real controls, which never start a drag).
  const grab = await win(page, 'browser').evaluate((el) => {
    const bar = el.querySelector('[data-drag-region]')!.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    for (let x = bar.right - 8; x > bar.left + 90; x -= 4) {
      const hit = document.elementFromPoint(x, bar.top + 12);
      if (hit?.closest('[data-drag-region]') && !hit.closest('button, a, input, [data-no-drag]'))
        return { x: Math.round(x - box.left), y: Math.round(bar.top + 12 - box.top) };
    }
    return { x: 300, y: 20 };
  });
  await win(page, 'browser').click({ position: grab });
  const title = await boxOf(win(page, 'browser'));
  await page.mouse.move(title.x + grab.x, title.y + grab.y);
  await page.mouse.down();
  await page.mouse.move(title.x + grab.x + 80, title.y + grab.y + 70, { steps: 8 });
  await page.mouse.up();
  const moved = await boxOf(win(page, 'browser'));
  expect(moved).toMatchObject({ x: title.x + 80, y: title.y + 70 });
  await win(page, 'browser').getByRole('button', { name: 'Close Safari' }).click();
  await expect(win(page, 'browser')).toHaveCount(0);
  await dockApp(page, 'Safari').click();
  await settle(page);
  expect(await boxOf(win(page, 'browser'))).toEqual(moved);
});

test('MAC-WM-02 · MAC-ID-02 z-order follows presses; the inactive window is grey-lit with a lighter shadow; one press acts', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page);
  await dockApp(page, 'Finder').click();
  await dockApp(page, 'GitHub').click();
  await settle(page);
  const finder = win(page, 'files');
  const github = win(page, 'github');
  await expect(github).toHaveAttribute('data-focused');
  const style = (locator: Locator) =>
    locator.evaluate((el) => ({
      z: Number(getComputedStyle(el).zIndex),
      shadow: getComputedStyle(el).boxShadow,
      close: getComputedStyle(el.querySelector('[data-light="close"] span')!).backgroundColor,
    }));
  const inactive = await style(finder);
  const active = await style(github);
  expect(inactive.close).toBe('rgb(201, 201, 204)'); // the frame's grey lights
  expect(active.close).toBe('rgb(255, 95, 87)');
  expect(inactive.shadow).not.toBe(active.shadow);
  expect(active.z).toBeGreaterThan(inactive.z);

  // A press in the inactive window raises it; the menu bar follows.
  await finder.click({ position: { x: 100, y: 300 } }); // a part of Finder that GitHub does not cover
  await expect(finder).toHaveAttribute('data-focused');
  expect((await style(finder)).z).toBeGreaterThan((await style(github)).z);
  await expect(page.getByRole('banner').getByText('Finder', { exact: true })).toBeVisible();

  // A control in an inactive window acts in one press (no click-through swallow).
  await github.getByRole('button', { name: 'Close GitHub' }).click();
  await expect(github).toHaveCount(0);
  await expect(finder).toBeVisible();
  // DOM order = open order; stacking is z-index only.
  await dockApp(page, 'Safari').click();
  await finder.click({ position: { x: 100, y: 300 } });
  expect(
    await page.locator('[data-window]').evaluateAll((els) => els.map((el) => el.getAttribute('data-window'))),
  ).toEqual(['macos:files', 'macos:browser']);
});

test('MAC-WM-03 · MOTION-DRAG-01 drag: clamped under the menu bar, ≥ 48 px reachable, one commit, zero window renders', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page);
  await dockApp(page, 'Finder').click();
  await settle(page);
  const finder = win(page, 'files');
  const start = await boxOf(finder);
  const renders = (await probe(page))['render:window'] ?? 0;
  const commits = (await probe(page))['action:COMMIT_RECT'] ?? 0;
  const grab = { x: start.x + 400, y: start.y + 26 }; // the toolbar, clear of its buttons
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(grab.x + i * 10, grab.y - i * 40); // far up and right
  expect((await probe(page))['render:window'] ?? 0, 'no React render while dragging').toBe(renders);
  const mid = await boxOf(finder);
  expect(mid.y, 'the title bar stops under the menu bar').toBe(24);
  await page.mouse.up();
  expect(await boxOf(finder)).toMatchObject({ x: start.x + 120, y: 24 }); // the DOM lands on release, no jump back
  await committed(page); // the store learns the rect after that frame paints
  expect((await probe(page))['action:COMMIT_RECT'] ?? 0).toBe(commits + 1);

  // Far to the right: at least 48 px of the title bar stays on-screen.
  const now = await boxOf(finder);
  await page.mouse.move(now.x + 400, now.y + 26);
  await page.mouse.down();
  await page.mouse.move(now.x + 5000, now.y + 26, { steps: 5 });
  await page.mouse.up();
  const viewport = page.viewportSize()!;
  expect((await boxOf(finder)).x).toBeLessThanOrEqual(viewport.width - 48);
  await expect(page).toHaveURL(/\/macos\/finder$/); // a move writes no history
});

test('MAC-WM-05 · MAC-DOCK-04 minimize (Scale) into a Dock tile; the tile restores; clicking mid-flight reverses', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page);
  await dockApp(page, 'Finder').click();
  await settle(page);
  const finder = win(page, 'files');
  await finder.getByRole('button', { name: 'Minimize Finder' }).click();
  const tile = dock(page).locator('[data-dock-tile="macos:files"]');
  await expect(tile).toBeVisible();
  await expect(tile).toBeFocused(); // minimize → focus the window's Dock tile
  await expect(tile).toHaveAccessibleName('Finder — Jaswanth, minimized window');
  await expect(finder).toBeHidden();
  await expect(dockApp(page, 'Finder')).toHaveAccessibleName('Finder, minimized');
  await tile.click();
  await expect(finder).toBeVisible();
  await expect(finder).toBeFocused();
  await expect(tile).toHaveCount(0);
  await settle(page);

  // Mid-flight: the window never gets hidden; the same timeline plays back.
  test.skip(info.project.name === 'reduced-motion', 'the reduced flight is a 150 ms fade');
  await page.evaluate(() => {
    const w = window as unknown as { __hidden: boolean };
    w.__hidden = false;
    const el = document.querySelector('[data-window="macos:files"]')!;
    const watch = () => {
      if (getComputedStyle(el).display === 'none') w.__hidden = true;
      if (!(window as unknown as { __stop?: boolean }).__stop) requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });
  // Shift plays the flight at ×6 (≈ 2.3 s), so a loaded CI machine still reaches the tile while it is in the air.
  await finder.getByRole('button', { name: 'Minimize Finder' }).click({ modifiers: ['Shift'] });
  await tile.click({ timeout: 2000 });
  await settle(page);
  await page.evaluate(() => ((window as unknown as { __stop: boolean }).__stop = true));
  expect(await page.evaluate(() => (window as unknown as { __hidden: boolean }).__hidden)).toBe(false);
  await expect(finder).toHaveAttribute('data-phase', 'normal');
  expect(await finder.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
});

test('MAC-WM-06 zoom fills the workspace without distorting text; the title bar double-click restores', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page);
  await dockApp(page, 'Finder').click();
  await settle(page);
  const finder = win(page, 'files');
  const before = await boxOf(finder);
  await page.evaluate(() => {
    const samples: number[][] = [];
    (window as unknown as { __samples: number[][] }).__samples = samples;
    const el = document.querySelector('[data-window="macos:files"]')!;
    const sample = () => {
      const m = new DOMMatrixReadOnly(
        getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform,
      );
      samples.push([m.a, m.d, m.b, m.c]);
      if (samples.length < 40) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await finder.getByRole('button', { name: 'Zoom Finder' }).click();
  await expect(finder.getByRole('button', { name: 'Restore Finder' })).toBeFocused(); // focus stays on the control
  await settle(page);
  const viewport = page.viewportSize()!;
  expect(await boxOf(finder)).toEqual({ x: 0, y: 24, w: viewport.width, h: viewport.height - 24 - 68 });
  const samples = await page.evaluate(() => (window as unknown as { __samples: number[][] }).__samples);
  for (const [a, d, b, c] of samples) expect({ a, d, b, c }).toEqual({ a: 1, d: 1, b: 0, c: 0 }); // translate only
  await finder.locator('header[data-drag-region]').dblclick({ position: { x: 400, y: 20 } });
  await settle(page);
  await expect.poll(() => boxOf(finder)).toEqual(before); // the un-zoom lands exactly on the old rect
});

test('MAC-WM-08 Dock clicks: open, then no-op when focused, focus when behind, restore when minimized', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page);
  await dockApp(page, 'Finder').click();
  await settle(page);
  const url = page.url();
  const length = await page.evaluate(() => history.length);
  await dockApp(page, 'Finder').click(); // focused → no-op (not a minimize: that is Windows)
  await settle(page);
  expect(page.url()).toBe(url);
  expect(await page.evaluate(() => history.length)).toBe(length);
  await expect(win(page, 'files')).toHaveAttribute('data-phase', 'normal');
  await dockApp(page, 'Safari').click();
  await dockApp(page, 'Finder').click(); // behind → focus
  await expect(win(page, 'files')).toHaveAttribute('data-focused');
  await win(page, 'files').getByRole('button', { name: 'Minimize Finder' }).click();
  await expect(win(page, 'files')).toBeHidden();
  await dockApp(page, 'Finder').click(); // minimized → restore
  await expect(win(page, 'files')).toBeVisible();
  await expect(win(page, 'files')).toBeFocused();
});

test('A11Y-FOCUS-01 focus after every window action; never on <body>', async ({ page }, info) => {
  desktopOnly(info);
  await openMacos(page);
  await dockApp(page, 'Finder').click();
  await expect(win(page, 'files')).toBeFocused(); // open → the window
  await dockApp(page, 'Safari').click();
  await expect(win(page, 'browser')).toBeFocused();
  await win(page, 'browser').getByRole('button', { name: 'Close Safari' }).click();
  await expect(win(page, 'files')).toBeFocused(); // close → the next window
  await page.keyboard.press('Alt+Shift+M'); // minimize → its Dock tile
  await expect(dock(page).locator('[data-dock-tile="macos:files"]')).toBeFocused();
  await page.keyboard.press('Enter'); // restore → the window
  await expect(win(page, 'files')).toBeFocused();
  await page.keyboard.press('Alt+Shift+W'); // close the last window → the app's Dock icon
  await expect(dockApp(page, 'Finder')).toBeFocused();
  await expectFocusNotOnBody(page);
});

test('MAC-ID-03 traffic lights: 24 px hit areas on a 20 px pitch; glyphs on focus and under increased contrast', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page);
  await dockApp(page, 'Finder').click();
  await settle(page);
  const lights = win(page, 'files').getByRole('group', { name: 'Window controls' }).getByRole('button');
  await expect(lights).toHaveCount(3);
  const boxes = await lights.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      const dot = el.querySelector('span')!.getBoundingClientRect();
      return { w: r.width, h: r.height, dot: dot.left + dot.width / 2, size: dot.width };
    }),
  );
  for (const box of boxes) expect(box.w >= 24 && box.h >= 24 && box.size === 12).toBe(true);
  expect(Math.round(boxes[1]!.dot - boxes[0]!.dot)).toBe(20);
  expect(Math.round(boxes[2]!.dot - boxes[1]!.dot)).toBe(20);
  const glyph = (index: number) =>
    lights.nth(index).evaluate((el) => getComputedStyle(el.querySelector('span')!).color);
  await page.mouse.move(700, 850);
  expect(await glyph(0)).toBe('rgba(0, 0, 0, 0)'); // hidden at rest
  await lights.first().focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab'); // keyboard focus → :focus-visible
  expect(await glyph(0)).not.toBe('rgba(0, 0, 0, 0)');
  test.skip(info.project.name === 'firefox-desktop', 'contrast emulation is Chromium/WebKit');
  await page.emulateMedia({ contrast: 'more' });
  await page
    .locator('body')
    .focus()
    .catch(() => undefined);
  expect(await glyph(1)).not.toBe('rgba(0, 0, 0, 0)');
});

// --- Semantics, structure, targets, blur --------------------------------------------------------------------------

test('MAC-A11Y-01 · A11Y-SEM-01 X2 landmarks in reading order, windows as labelled regions in open order', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page);
  await dockApp(page, 'GitHub').click();
  await dockApp(page, 'Finder').click();
  await win(page, 'files')
    .getByRole('navigation', { name: 'Favourites' })
    .getByRole('link', { name: 'Experience' })
    .click();
  await settle(page);
  await expect(page.locator('.os-root[data-os="macos"]')).toMatchAriaSnapshot(`
    - banner:
      - group "Status menus":
        - link "Résumé (PDF)"
    - main:
      - heading /^macOS — / [level=1]
      - list "Desktop":
        - listitem:
          - link "Résumé.pdf"
        - listitem:
          - link "Projects"
        - listitem:
          - link "Experience"
      - region "GitHub — Repositories":
        - group "Window controls":
          - button "Close GitHub"
          - button "Minimize GitHub"
          - button "Zoom GitHub"
        - button "GitHub window menu"
        - heading "GitHub — Repositories" [level=2]
      - region "Finder — Experience":
        - group "Window controls":
          - button "Close Finder"
          - button "Minimize Finder"
          - button "Zoom Finder"
        - navigation "Favourites"
        - heading "Finder — Experience" [level=2]
        - list "Jaswanth"
        - list "Experience"
        - region "Preview"
    - navigation "Dock":
      - list:
        - listitem:
          - link "Finder, open"
        - listitem:
          - link "Safari"
        - listitem:
          - link "GitHub, open"
  `);
  // Reading order: menu bar → main → Dock.
  const order = await page
    .locator('.os-root header[data-menubar], .os-root main, .os-root nav[aria-label="Dock"]')
    .evaluateAll((els) => els.map((el) => el.tagName.toLowerCase()));
  expect(order).toEqual(['header', 'main', 'nav']);
});

test('RESP-DOM-01 the same DOM at 390 and 1440 px (CSS decides the posture)', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-desktop', 'one resize comparison');
  await openMacos(page, '/macos/finder/experience');
  const shape = () =>
    page.locator('.os-root [data-os-shell] *').evaluateAll((els) =>
      els
        // The compact menu bar collapses the app's menus into one (MAC-MENU-07): the one intended difference.
        .filter((el) => !el.closest('time') && !el.closest('[role="menubar"]'))
        .map((el) => `${el.tagName}${el.getAttribute('role') ? `[${el.getAttribute('role')}]` : ''}`)
        .join(' '),
    );
  const wide = await shape();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-mac-posture="compact"]')).toBeAttached();
  await settle(page);
  const narrow = await shape();
  // The compact-only "Windows" Dock button and the controls menu exist in both (hidden by CSS / the hidden attribute).
  expect(narrow).toBe(wide);
});

test('RESP-TAP-01 X3 tap targets on the macOS home: 24 px (fine pointer), 44 px (coarse)', async ({ page }) => {
  await openMacos(page);
  const coarse = await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches);
  const min = coarse ? 44 : 24;
  const small = await page.locator('.os-root a[href], .os-root button').evaluateAll(
    (els, limit) =>
      els
        .filter((el) => {
          const style = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return style.visibility !== 'hidden' && r.width > 0 && r.height > 0 && !el.closest('[hidden]');
        })
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { name: el.getAttribute('aria-label') ?? el.textContent?.trim(), w: r.width, h: r.height };
        })
        .filter((box) => box.w < limit - 0.5 || box.h < limit - 0.5),
    min,
  );
  expect(small).toEqual([]);
});

test('PERF-BLUR-01 · DS-GLASS-01 X5 at most 3 live backdrop-filter surfaces (menu bar + Dock)', async ({ page }) => {
  await openMacos(page);
  await dockApp(page, 'Finder').click();
  await settle(page);
  const blurred = await page.evaluate(
    () =>
      [...document.querySelectorAll('*')].filter((el) => {
        const style = getComputedStyle(el);
        const value =
          style.backdropFilter ||
          (style as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter;
        return value && value !== 'none';
      }).length,
  );
  expect(blurred).toBeLessThanOrEqual(3);
});

test('A11Y-AXE-01 · VIEW-HEAD-01 X1 axe WCAG 2.2 AA: macOS home and Finder, no heading-order issue in a window', async ({
  page,
}) => {
  await openMacos(page);
  const scan = async () =>
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze())
      .violations;
  expect(await scan()).toEqual([]);
  await dockApp(page, 'Finder').click();
  await settle(page);
  const finder = win(page, 'files');
  const sidebar = finder.getByRole('navigation', { name: 'Favourites' });
  if (await sidebar.isVisible()) await sidebar.getByRole('link', { name: 'Experience' }).click();
  else await finder.getByRole('link', { name: 'Experience' }).first().click();
  await finder.locator('[data-column="entries"] a').first().click();
  await settle(page);
  expect(await scan()).toEqual([]);
});

// --- Résumé fast path -------------------------------------------------------------------------------------------------

test('RES-OPEN-01 the résumé opens in Preview through the kernel from the desktop, the menu bar and the Dock stack', async ({
  page,
}, info) => {
  await openMacos(page);
  const desktopItem = page.getByRole('list', { name: 'Desktop' }).getByRole('link', { name: 'Résumé.pdf' });
  for (const entry of [
    desktopItem,
    page.getByRole('banner').getByRole('link', { name: 'Résumé (PDF)' }),
    dock(page).getByRole('link', { name: 'Résumé (PDF)' }),
  ]) {
    // A desktop item opens on double-click with a mouse and on a tap (MAC-DESK-02); links elsewhere on one click.
    if (entry === desktopItem && DESKTOP.includes(info.project.name)) await entry.dblclick();
    else await entry.click();
    await expect(page).toHaveURL(/\/macos\/preview$/);
    await expect(page.getByRole('region', { name: 'Preview' })).toBeFocused();
    await expect(page.getByRole('region', { name: 'Preview' }).getByRole('heading', { name: 'Résumé' })).toBeVisible();
    await page
      .getByRole('region', { name: 'Preview' })
      .getByRole('button', { name: /Close Preview|Window controls/ })
      .first()
      .click();
    if (await page.getByRole('menuitem', { name: 'Close' }).isVisible())
      await page.getByRole('menuitem', { name: 'Close' }).click();
    await expect(win(page, 'viewer')).toHaveCount(0);
  }
  // A cold deep link lands in the same window; Back leaves Preview.
  await openMacos(page, '/macos/preview');
  await expect(page.getByRole('region', { name: 'Preview' })).toBeVisible();
});

test('RES-DL-01 Download saves Jaswanth-Resume.pdf and records resume_downloaded', async ({ page }) => {
  await openMacos(page, '/macos/preview');
  const preview = page.getByRole('region', { name: 'Preview' });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    preview
      .getByRole('toolbar', { name: 'Preview' })
      .getByRole('link', { name: /^Download/ })
      .click(),
  ]);
  expect(download.suggestedFilename()).toBe('Jaswanth-Resume.pdf');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __pfAnalytics?: { events: { name: string; os?: string }[] } }).__pfAnalytics
            ?.events ?? [],
      ),
    )
    .toContainEqual({ name: 'resume_downloaded', os: 'macos' });
});

// --- Motion rules, impatience, rotation, leaks -------------------------------------------------------------------------

test('MOTION-RULE-01 input wins: a press during an open or close acts at once', async ({ page }, info) => {
  desktopOnly(info);
  await openMacos(page);
  await dockApp(page, 'Safari').click();
  // Still opening: its close button already works. The click goes to the button itself — the window is still flying
  // out of the Dock, so coordinates read one frame would miss it the next.
  await win(page, 'browser').getByRole('button', { name: 'Close Safari' }).dispatchEvent('click');
  await expect(win(page, 'browser')).toHaveCount(0);
  await dockApp(page, 'Finder').click();
  await settle(page);
  // E2: red, then straight away the Dock icon → the close is cancelled.
  await win(page, 'files').getByRole('button', { name: 'Close Finder' }).click();
  await dockApp(page, 'Finder').click();
  await settle(page);
  await expect(win(page, 'files')).toHaveAttribute('data-phase', 'normal');
  await expect(win(page, 'files')).toBeVisible();
});

test('KRN-EDGE-01 · MAC-EDGE-01 impatience (E1–E7): spam, cancel, reverse, cycle, resize — state stays valid', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page);
  const start = await page.evaluate(() => history.length);
  // E1: ten rapid Dock clicks → one window, one history entry.
  for (let i = 0; i < 10; i++) await dockApp(page, 'Finder').click({ delay: 0 });
  await settle(page);
  await expect(page.locator('[data-window]')).toHaveCount(1);
  expect(await page.evaluate(() => history.length)).toBe(start + 1);
  // E3: minimize, then the tile mid-flight → reverses.
  await win(page, 'files').getByRole('button', { name: 'Minimize Finder' }).click();
  await dock(page).locator('[data-dock-tile="macos:files"]').click();
  await settle(page);
  await expect(win(page, 'files')).toHaveAttribute('data-phase', 'normal');
  // E4: open every app, then press windows in quick succession — z-order follows the last press.
  for (const name of ['Safari', 'GitHub', 'Mail', 'Preview', 'Visual Studio Code', 'Terminal', 'System Settings'])
    await dockApp(page, name).click();
  await settle(page);
  await expect(page.locator('[data-window]')).toHaveCount(8);
  // A press anywhere in a window raises it (the frame's own pointerdown), even under other windows.
  for (const role of ['files', 'github', 'browser']) await win(page, role).dispatchEvent('pointerdown', { button: 0 });
  await expect(win(page, 'browser')).toHaveAttribute('data-focused');
  const top = await page.evaluate(() => {
    const all = [...document.querySelectorAll<HTMLElement>('[data-window]')];
    return all.sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex))[0]!.dataset.window;
  });
  expect(top).toBe('macos:browser');
  // E5/E6: drag toward the top while the viewport shrinks → the last valid rect is committed and clamped.
  const box = await boxOf(win(page, 'browser'));
  await page.mouse.move(box.x + 250, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 250, box.y - 400, { steps: 6 });
  await page.setViewportSize({ width: 1200, height: 760 });
  await page.mouse.up();
  await settle(page);
  const after = await boxOf(win(page, 'browser'));
  expect(after.y).toBeGreaterThanOrEqual(24);
  expect(after.x).toBeLessThanOrEqual(1200 - 48);
  // E7: into compact → one maximized window; back out → the floating rects return.
  const floating = await boxOf(win(page, 'browser'));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-mac-posture="compact"]')).toBeAttached();
  await expect(page.locator('[data-window]:visible')).toHaveCount(1);
  await page.setViewportSize({ width: 1200, height: 760 });
  await expect(page.locator('[data-mac-posture="pointer"]')).toBeAttached();
  await settle(page);
  expect(await boxOf(win(page, 'browser'))).toEqual(floating);
  // Valid end state: the URL names the focused window; focus is somewhere real.
  await expect(page).toHaveURL(/\/macos\/safari$/);
  await expectFocusNotOnBody(page);
});

test('RESP-ROT-01 O1 a resize mid-drag commits the last valid rect and re-clamps', async ({ page }, info) => {
  desktopOnly(info);
  await openMacos(page);
  await dockApp(page, 'GitHub').click();
  await settle(page);
  const box = await boxOf(win(page, 'github'));
  const commits = (await probe(page))['action:COMMIT_RECT'] ?? 0;
  await page.mouse.move(box.x + 300, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 900, box.y + 20, { steps: 6 });
  await page.setViewportSize({ width: 900, height: 700 }); // the drag ends here (resize), committing what was drawn
  await expect.poll(async () => (await probe(page))['action:COMMIT_RECT'] ?? 0).toBe(commits + 1);
  await page.mouse.up();
  await settle(page);
  const after = await boxOf(win(page, 'github'));
  expect(after.x).toBeLessThanOrEqual(900 - 48);
  expect(after.y).toBeGreaterThanOrEqual(28); // medium posture: the 28 px menu bar

  // The return flight after the resize lands on the Dock tile where it is now: the last frame the window is visible,
  // its centre is on the tile's centre.
  test.skip(info.project.name === 'reduced-motion', 'the reduced flight is a fade in place');
  await page.evaluate(() => {
    const w = window as unknown as { __last: { x: number; y: number } | null };
    w.__last = null;
    const el = document.querySelector<HTMLElement>('[data-window="macos:github"]')!;
    const sample = () => {
      if (getComputedStyle(el).display === 'none' || el.closest('[hidden]')) return;
      const r = el.getBoundingClientRect();
      if (r.width > 0) w.__last = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  // Shift plays it at ×6, so the last visible frame is close to where the flight ends.
  await win(page, 'github')
    .getByRole('button', { name: 'Minimize GitHub' })
    .click({ modifiers: ['Shift'] });
  const tile = dock(page).locator('[data-dock-tile="macos:github"]');
  await expect(tile).toBeVisible();
  await settle(page);
  const t = await boxOf(tile);
  const last = await page.evaluate(() => (window as unknown as { __last: { x: number; y: number } }).__last);
  expect(Math.abs(last.x - (t.x + t.w / 2)), 'flight ends on the tile (x)').toBeLessThanOrEqual(12);
  expect(Math.abs(last.y - (t.y + t.h / 2)), 'flight ends on the tile (y)').toBeLessThanOrEqual(12);
});

test('MOTION-LEAK-01 leak loop: nothing ticking at idle, listener count stable', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-desktop', 'CDP listener counts (Chromium)');
  await openMacos(page);
  const cdp = await page.context().newCDPSession(page);
  const listeners = async () => {
    let total = 0;
    for (const target of ['window', 'document']) {
      const { result } = await cdp.send('Runtime.evaluate', { expression: target });
      const { listeners: list } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId! });
      total += list.length;
    }
    return total;
  };
  const cycle = async () => {
    for (const name of ['Finder', 'Safari']) {
      await dockApp(page, name).click();
      await settle(page);
    }
    await win(page, 'browser').getByRole('button', { name: 'Minimize Safari' }).click();
    await settle(page);
    await dock(page).locator('[data-dock-tile="macos:browser"]').click();
    await settle(page);
    for (const role of ['browser', 'files']) {
      await win(page, role)
        .getByRole('button', { name: /^Close / })
        .click();
      await expect(win(page, role)).toHaveCount(0);
    }
  };
  await cycle();
  const baseline = await listeners();
  for (let i = 0; i < 5; i++) await cycle();
  await settle(page);
  expect(await page.evaluate(() => (window as unknown as { __motion: { debug(): unknown } }).__motion.debug())).toEqual(
    {
      tickers: 0,
      tweens: 0,
    },
  );
  expect(await listeners()).toBe(baseline);
});

// --- Compact (phones) -------------------------------------------------------------------------------------------------

test('MAC-WM-10 · MAC-RESP-03 · MAC-MC-03 M3 compact: one maximized window, a 44 px controls menu, the Windows switcher', async ({
  page,
}, info) => {
  compactOnly(info);
  await openMacos(page);
  await expect(page.locator('[data-mac-posture="compact"]')).toBeAttached();
  await dockApp(page, 'Finder').click();
  const finder = win(page, 'files');
  await expect(finder).toBeVisible();
  await settle(page); // measure after the open animation (scale 0.92 → 1)
  const viewport = page.viewportSize()!;
  const bar = await boxOf(page.locator('header[data-menubar]'));
  const box = await boxOf(finder);
  expect(box.w).toBe(viewport.width);
  expect(box.y).toBe(bar.y + bar.h);
  await expect(finder.getByRole('group', { name: 'Window controls' })).toBeHidden();
  const controls = finder.getByRole('button', { name: 'Window controls' });
  expect(await boxOf(controls)).toMatchObject({ w: 44, h: 44 });

  // One window at a time.
  await dockApp(page, 'GitHub').click();
  await expect(win(page, 'github')).toBeVisible();
  await expect(finder).toBeHidden();

  // The Windows switcher: choose Finder, then close GitHub from its card.
  await dock(page).getByRole('button', { name: 'Windows' }).click();
  const mission = page.getByRole('dialog', { name: 'Mission Control' });
  await expect(mission).toBeVisible();
  await expect(mission.getByRole('button', { name: /^(Finder|GitHub) — / })).toHaveCount(2);
  await mission.getByRole('button', { name: /^Finder — / }).click();
  await expect(mission).toBeHidden();
  await expect(finder).toBeVisible();
  await expect(win(page, 'github')).toBeHidden();
  await dock(page).getByRole('button', { name: 'Windows' }).click();
  await mission.getByRole('button', { name: /^Close GitHub/ }).click();
  await expect(mission.getByRole('button', { name: /^GitHub — / })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(mission).toBeHidden();
  await expect(win(page, 'github')).toHaveCount(0);

  // The controls menu: Minimize puts Finder in the Dock.
  await controls.click();
  await page.getByRole('menuitem', { name: 'Minimize' }).click();
  await expect(finder).toBeHidden();
  await expect(dock(page).locator('[data-dock-tile="macos:files"]')).toBeAttached();
  await expectFocusNotOnBody(page);
});

test('MAC-FIND-07 M3 compact Finder drill-down: favourites → folder → document, back chevron up each level', async ({
  page,
}, info) => {
  compactOnly(info);
  await openMacos(page);
  await dockApp(page, 'Finder').click();
  const finder = win(page, 'files');
  await finder.getByRole('link', { name: 'Experience' }).first().click();
  await expect(page).toHaveURL(/\/macos\/finder\/experience$/);
  const rows = finder.locator('[data-column="entries"] a');
  await expect(rows.first()).toBeVisible();
  expect((await boxOf(rows.first())).h).toBeGreaterThanOrEqual(44);
  await rows.first().click();
  await expect(page).toHaveURL(/\/experience\/xclusive-trading$/);
  await expect(finder.locator('[data-finder-document]')).toBeVisible();
  await expect(finder.getByRole('heading', { level: 3, name: 'Software Engineer' })).toBeVisible();
  await finder.getByRole('button', { name: 'Back to Experience' }).click();
  await expect(page).toHaveURL(/\/macos\/finder\/experience$/);
  await expect(rows.first()).toBeVisible();
  await finder.getByRole('button', { name: 'Back to Jaswanth' }).click();
  await expect(page).toHaveURL(/\/macos\/finder$/);
  await expect(finder.getByRole('navigation', { name: 'Favourites' })).toBeVisible();
  await expectFocusNotOnBody(page);
});

test('A11Y-AXE-01 X1 axe on the compact window switcher (an open overlay)', async ({ page }, info) => {
  compactOnly(info);
  await openMacos(page);
  await dockApp(page, 'Finder').click();
  await dock(page).getByRole('button', { name: 'Windows' }).click();
  await expect(page.getByRole('dialog', { name: 'Mission Control' })).toBeVisible();
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(violations).toEqual([]);
});
