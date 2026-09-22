/**
 * Windows 11 Settings + winver — the e2e acceptance tests of plans/windows/apps/settings.md (`WIN-SET-01…07`), with
 * shared/09 `A11Y-PREF-01`, shared/11 `ASSET-LEGAL-01`, shared/18 `ANL-NOTICE-01` and shared/21 `EGG-WINVER-01`.
 * Settings is reached the way a visitor reaches it (the pinned taskbar button; Start on phones). Every step waits on an
 * end state, never a sleep, and focus never rests on <body>. Same helpers and patterns as windows.spec.ts.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { committed, expectFocusNotOnBody, isOriginalMode, waitForOs, waitForSettled } from './helpers';

type Box = { x: number; y: number; w: number; h: number };

const COMPACT = ['iphone', 'pixel', 'iphone-landscape'];
const isCompact = (info: TestInfo) => COMPACT.includes(info.project.name);

const taskbar = (page: Page) => page.getByRole('navigation', { name: 'Taskbar' });
const tbApp = (page: Page, name: string) => taskbar(page).getByRole('link', { name: new RegExp(`^${name}(, .*)?$`) });
const win = (page: Page, role: string) => page.locator(`[data-window="windows:${role}"]`);
const settings = (page: Page) => win(page, 'settings');
const pageList = (page: Page) => settings(page).getByRole('navigation', { name: 'Settings' });
const pageHeading = (page: Page) =>
  settings(page).getByRole('navigation', { name: 'Breadcrumb' }).getByRole('heading', { level: 3 });
const card = (page: Page, id: string) => settings(page).locator(`[data-card="${id}"]`);
const boxOf = (locator: Locator): Promise<Box> =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
/** The persisted preferences (`pf.prefs.v1`, zustand's `{ state, version }` envelope). */
const storedPrefs = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('pf.prefs.v1') ?? '{}').state ?? {});

/** Settled: no window opening/closing and no motion tween running. */
async function settle(page: Page) {
  await page.waitForFunction(() => {
    if (document.querySelector('[data-window][data-phase="opening"],[data-window][data-phase="closing"]')) return false;
    const motion = (window as unknown as { __motion?: { debug(): { tweens: number } } }).__motion;
    return !motion || motion.debug().tweens === 0;
  });
}

async function openWindows(page: Page, path = '/windows') {
  await page.goto(path);
  await waitForOs(page, 'windows');
  await settle(page);
}

/**
 * Open an app the way a visitor does (its pinned taskbar button, or on phones the Start sheet), then wait for the end
 * state: the window is in the DOM and its open flight has finished (the press commits a task later, so wait for the
 * window first; the flight is timed by the shell, so wait on it rather than on a fixed expect timeout).
 */
async function launch(page: Page, info: TestInfo, name: string, role: string) {
  if (isCompact(info)) {
    await taskbar(page).getByRole('button', { name: 'Start' }).click();
    await page.getByRole('dialog', { name: 'Start' }).getByRole('link', { name, exact: true }).click();
  } else await tbApp(page, name).click();
  await expect(win(page, role)).toBeAttached();
  await settle(page);
}

async function openSettings(page: Page, info: TestInfo) {
  await openWindows(page);
  await launch(page, info, 'Settings', 'settings');
  await expect(page).toHaveURL(/\/windows\/settings$/);
  await expect(settings(page)).toHaveAttribute('data-phase', 'normal');
}

/** Go to a Settings page from the NavigationView (on phones: back to the page list first, as the visitor would). */
async function goTo(page: Page, name: string) {
  for (let i = 0; i < 2 && !(await pageList(page).isVisible()); i++)
    await settings(page).getByRole('button', { name: 'Back', exact: true }).click();
  await pageList(page).getByRole('button', { name, exact: true }).click();
  await expect(pageHeading(page)).toHaveText(name);
}

/** A press commits one frame + one task later; read the result without retrying ("applies at once"). */
async function htmlAfterPress(page: Page) {
  await committed(page);
  return page.evaluate(() => ({
    motion: document.documentElement.dataset.motion ?? null,
    glass: document.documentElement.dataset.glass ?? null,
    contrast: document.documentElement.dataset.contrast ?? null,
    scale: document.documentElement.style.getPropertyValue('--text-scale') || null,
  }));
}

async function openWinverFromSearch(page: Page) {
  await taskbar(page).getByRole('button', { name: 'Search' }).click();
  const search = page.getByRole('dialog', { name: 'Search' });
  await expect(search).toBeVisible();
  await page.keyboard.type('winver');
  await expect(search.getByRole('option', { name: /winver/ }).first()).toBeVisible();
  await page.keyboard.press('Enter');
  const about = page.getByRole('dialog', { name: 'About Windows' });
  await expect(about).toBeVisible();
  return about;
}

const eggCount = async (page: Page) => {
  const text = (await card(page, 'eggs').textContent()) ?? '';
  const match = /(\d+) \/ (\d+)/.exec(text);
  if (!match) throw new Error(`no "n / N" in ${text}`);
  return { found: Number(match[1]), total: Number(match[2]) };
};

// Phone journeys run on WebKit and walk many pages; on a shared machine they need more than the default 45 s.
test.slow(({ isMobile }) => isMobile, 'phone-posture journeys (WebKit) walk many pages');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('pf.debug.probe', '1');
    window.sessionStorage.setItem('pf.debug.analytics', '1');
  });
});

// --- WIN-SET-01 ---------------------------------------------------------------------------------------------------------

test('WIN-SET-01 N2 pages render; search flashes a card', async ({ page }, info) => {
  await openSettings(page, info);
  const compact = isCompact(info);
  const app = settings(page);
  await expect(app.getByRole('heading', { level: 2 })).toHaveText('Settings');
  // The NavigationView: user tile, "Find a setting", the page list.
  await expect(app.getByText('Local account')).toBeVisible();
  await expect(app.getByRole('combobox', { name: 'Find a setting' })).toBeVisible();
  const items = pageList(page).getByRole('button');
  await expect(items).toHaveText([
    'System',
    'Personalization',
    'Accessibility',
    'Privacy & security',
    'Apps',
    'Switch operating system',
    'Tour',
  ]);
  await expect(items.first()).toHaveAttribute('aria-current', 'page');

  if (compact) {
    // Compact: the page list is the first screen; rows are ≥ 48 px.
    await expect(app.getByRole('navigation', { name: 'Breadcrumb' })).toBeHidden();
    for (const item of await items.all()) expect((await boxOf(item)).h).toBeGreaterThanOrEqual(48);
  } else {
    // Real Windows 11 metrics: 280 px NavigationView, 28 px Title, 8 px cards with a 1 px stroke, 68 px rows.
    expect((await boxOf(app.locator('[data-settings-pane]'))).w).toBe(280);
    await expect(pageHeading(page)).toHaveText('System');
    await expect(pageHeading(page)).toHaveCSS('font-size', '28px');
    await expect(card(page, 'notifications')).toHaveCSS('border-top-left-radius', '8px');
    await expect(card(page, 'notifications')).toHaveCSS('border-top-width', '1px');
    expect((await boxOf(card(page, 'notifications'))).h).toBeGreaterThanOrEqual(68);
  }

  // Every page renders its breadcrumb header and its cards; the page is session state (the URL never changes).
  const history = await page.evaluate(() => window.history.length);
  const pages: [string, string][] = [
    ['Personalization', 'taskbar-alignment'],
    ['Accessibility', 'text-size'],
    ['Privacy & security', 'cookies'],
    ['Apps', 'app-explorer'],
    ['Switch operating system', 'chooser'],
    ['Tour', 'tour'],
    ['System', 'notifications'],
  ];
  for (const [name, id] of pages) {
    await goTo(page, name);
    await expect(card(page, id)).toBeVisible();
    await expect(pageHeading(page)).toHaveAttribute('aria-current', 'page');
    if (compact) await expect(app.getByRole('button', { name: 'Back', exact: true })).toBeVisible();
    else
      await expect(pageList(page).getByRole('button', { name, exact: true })).toHaveAttribute('aria-current', 'page');
  }
  await expect(page).toHaveURL(/\/windows\/settings$/);
  expect(await page.evaluate(() => window.history.length)).toBe(history);

  // System › About: the breadcrumb, and back through it.
  await app.getByRole('button', { name: 'About', exact: true }).click();
  const crumbs = app.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumbs.getByRole('button', { name: 'System' })).toBeVisible();
  await expect(pageHeading(page)).toHaveText('About');
  await crumbs.getByRole('button', { name: 'System' }).click();
  await expect(pageHeading(page)).toHaveText('System');
  await expect(app.getByRole('button', { name: 'About', exact: true })).toBeFocused();

  // Search: the suggestions and the page list narrow; choosing opens the page, focuses and flashes the card.
  if (compact) await app.getByRole('button', { name: 'Back', exact: true }).click();
  const input = app.getByRole('combobox', { name: 'Find a setting' });
  await input.click();
  await page.keyboard.type('taskbar');
  const first = app.getByRole('listbox').getByRole('option').first();
  await expect(first).toContainText('Taskbar alignment');
  await expect(first).toContainText('Personalization');
  await expect(pageList(page).getByRole('button')).toHaveText(['Personalization']);
  // The flash marks the card for 1.2 s, so on a slow frame it can be over before an assertion lands: record it as it
  // happens, with the animation its overlay carries while it is on (the flash is a real animation, not an attribute).
  await page.evaluate(() => {
    const seen: { on: boolean; anim: string } = { on: false, anim: '' };
    (window as unknown as { __flash?: { on: boolean; anim: string } }).__flash = seen;
    new MutationObserver(() => {
      const el = document.querySelector('[data-card="taskbar-alignment"]');
      if (!el?.hasAttribute('data-flash')) return;
      seen.on = true;
      seen.anim = getComputedStyle(el, '::after').animationName;
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-flash'] });
  });
  await page.keyboard.press('Enter');
  await expect(pageHeading(page)).toHaveText('Personalization');
  const flashed = card(page, 'taskbar-alignment');
  const flash = () => page.evaluate(() => (window as unknown as { __flash: { on: boolean; anim: string } }).__flash);
  await expect.poll(async () => (await flash()).on).toBe(true);
  await expect(flashed).toBeFocused();
  await expect(flashed).toBeInViewport();
  if (info.project.name !== 'reduced-motion') expect((await flash()).anim).toContain('settings-flash');
  await expect(flashed).not.toHaveAttribute('data-flash', { timeout: 4000 });
  await expectFocusNotOnBody(page);
});

// --- WIN-SET-02 ---------------------------------------------------------------------------------------------------------

test('WIN-SET-02 A11Y-PREF-01 on Windows: Accessibility controls apply to <html> at once and persist across reload', async ({
  page,
}, info) => {
  await openSettings(page, info);
  await goTo(page, 'Accessibility');
  const app = settings(page);

  // Animation effects (= reduce motion): whichever way it starts, one press flips <html data-motion> at once.
  const animation = app.getByRole('switch', { name: 'Animation effects' });
  const animationsOn = (await animation.getAttribute('aria-checked')) === 'true';
  await animation.click();
  expect((await htmlAfterPress(page)).motion).toBe(animationsOn ? 'reduced' : 'full');
  await expect(animation).toHaveAttribute('aria-checked', String(!animationsOn));

  // Transparency effects → solid glass.
  const transparency = app.getByRole('switch', { name: 'Transparency effects' });
  if ((await transparency.getAttribute('aria-checked')) === 'false') {
    await transparency.click();
    await committed(page);
  }
  await transparency.click();
  expect((await htmlAfterPress(page)).glass).toBe('solid');

  // Contrast themes (= increase contrast).
  await app.getByRole('switch', { name: 'Contrast themes' }).click();
  expect((await htmlAfterPress(page)).contrast).toBe('more');
  await expect(app.getByText('Contrast themes keep every surface solid while they’re on')).toBeVisible();

  // Text size: a native range, 100–130 % in 5 % steps, driven by the keyboard; the preview follows.
  const size = app.getByRole('slider', { name: 'Text size' });
  await expect(size).toHaveAttribute('min', '100');
  await expect(size).toHaveAttribute('max', '130');
  await expect(size).toHaveAttribute('step', '5');
  const preview = app.getByText('Drag the slider until this text is the size you want.');
  const before = Number.parseFloat(await preview.evaluate((el) => getComputedStyle(el).fontSize));
  await size.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect(size).toHaveAttribute('aria-valuetext', '120%');
  expect((await htmlAfterPress(page)).scale).toBe('1.2');
  const after = Number.parseFloat(await preview.evaluate((el) => getComputedStyle(el).fontSize));
  expect(after).toBeCloseTo(before * 1.2, 0);

  // Single-key shortcuts (WCAG 2.1.4) — a preference, no attribute.
  const singleKey = app.getByRole('switch', { name: 'Single-key shortcuts' });
  await singleKey.click();
  await expect(singleKey).toHaveAttribute('aria-checked', 'false');
  await expect(app.getByRole('link', { name: /Open plain portfolio/ })).toHaveAttribute('href', '/plain');

  // Persisted in pf.prefs.v1 (debounced write) …
  await expect
    .poll(() => storedPrefs(page))
    .toMatchObject({
      motion: animationsOn ? 'reduced' : 'full',
      glass: 'solid',
      contrast: 'more',
      textScale: 1.2,
      singleKeyShortcuts: false,
    });

  // … and applied before the OS paints its first frame after a reload: the attributes are already on <html> when the
  // Windows shell first enters the DOM (recorded by a MutationObserver, which runs before rendering).
  await page.addInitScript(() => {
    new MutationObserver((_, observer) => {
      if (!document.querySelector('[data-os-shell="windows"]')) return;
      observer.disconnect();
      const root = document.documentElement;
      (window as unknown as { __firstFrame?: Record<string, string | null> }).__firstFrame = {
        motion: root.dataset.motion ?? null,
        glass: root.dataset.glass ?? null,
        contrast: root.dataset.contrast ?? null,
        scale: root.style.getPropertyValue('--text-scale') || null,
      };
    }).observe(document, { childList: true, subtree: true });
  });
  await page.reload();
  await waitForOs(page, 'windows');
  const firstFrame = await page.evaluate(
    () => (window as unknown as { __firstFrame?: Record<string, string | null> }).__firstFrame ?? null,
  );
  expect(firstFrame).toEqual({
    motion: animationsOn ? 'reduced' : 'full',
    glass: 'solid',
    contrast: 'more',
    scale: '1.2',
  });
  // The Settings window was restored; its controls read the persisted values.
  await settle(page);
  await goTo(page, 'Accessibility');
  await expect(app.getByRole('switch', { name: 'Animation effects' })).toHaveAttribute(
    'aria-checked',
    String(!animationsOn),
  );
  await expect(app.getByRole('switch', { name: 'Contrast themes' })).toHaveAttribute('aria-checked', 'true');
  await expect(app.getByRole('switch', { name: 'Single-key shortcuts' })).toHaveAttribute('aria-checked', 'false');
  await expect(app.getByRole('slider', { name: 'Text size' })).toHaveValue('120');
  await expectFocusNotOnBody(page);
});

// --- WIN-SET-03 ---------------------------------------------------------------------------------------------------------

test('WIN-SET-03 the alignment toggle moves the taskbar group; persists', async ({ page }, info) => {
  await openSettings(page, info);
  await goTo(page, 'Personalization');
  const compact = isCompact(info);
  const alignment = settings(page).getByRole('radiogroup', { name: 'Taskbar alignment' });
  const start = taskbar(page).getByRole('button', { name: 'Start' });
  await expect(alignment.getByRole('radio', { name: 'Center' })).toBeChecked();
  await expect(taskbar(page)).toHaveAttribute('data-align', 'center');
  const centred = await boxOf(start);
  const width = page.viewportSize()!.width;
  if (!compact) expect(centred.x).toBeGreaterThan(width / 4);

  await alignment.getByRole('radio', { name: 'Left' }).click();
  await committed(page);
  await expect(taskbar(page)).toHaveAttribute('data-align', 'left');
  await expect(settings(page).locator('[data-align="left"]')).toHaveCount(1); // the Personalization preview follows
  // The group really moves to the left edge (compact keeps its own left-anchored scrolling group either way).
  await expect.poll(async () => (await boxOf(start)).x).toBeLessThanOrEqual(compact ? centred.x : 16);

  await expect.poll(async () => (await storedPrefs(page)).taskbarAlign).toBe('left');
  await page.reload();
  await waitForOs(page, 'windows');
  await settle(page);
  await expect(taskbar(page)).toHaveAttribute('data-align', 'left');
  if (!compact) expect((await boxOf(start)).x).toBeLessThanOrEqual(16);
  await goTo(page, 'Personalization');
  await expect(alignment.getByRole('radio', { name: 'Left' })).toBeChecked();

  // Back to Center restores the centred group.
  await alignment.getByRole('radio', { name: 'Center' }).click();
  await expect(taskbar(page)).toHaveAttribute('data-align', 'center');
  await expect.poll(async () => (await boxOf(start)).x).toBe(centred.x);
  await expect.poll(async () => (await storedPrefs(page)).taskbarAlign).toBe('center');
});

// --- WIN-SET-04 ---------------------------------------------------------------------------------------------------------

test('WIN-SET-04 Privacy and Legal notices: reachable; content from the manifest', async ({ page }, info) => {
  await openSettings(page, info);
  const app = settings(page);

  // Privacy & security → the privacy statement (ANL-NOTICE-01), the browser's DNT/GPC signals, no cookies.
  await goTo(page, 'Privacy & security');
  await expect(app.getByRole('button', { name: 'Diagnostics & feedback' })).toHaveAttribute('aria-expanded', 'true');
  await expect(app.getByRole('heading', { level: 4, name: 'Privacy' })).toBeVisible();
  await expect(app.getByText('Anonymous loading-speed measurements')).toBeVisible();
  const signals = await page.evaluate(() => ({
    dnt: navigator.doNotTrack === '1',
    gpc: (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true,
  }));
  await expect(card(page, 'signals')).toContainText(
    `Do Not Track: ${signals.dnt ? 'on' : 'off'} · Global Privacy Control: ${signals.gpc ? 'on' : 'off'}`,
  );
  await expect(card(page, 'cookies')).toContainText('No cookies');
  expect(await page.context().cookies()).toEqual([]);

  // System › About → Legal notices (ASSET-LEGAL-01): the shared LegalNotice with the manifest's credits.
  await goTo(page, 'System');
  await app.getByRole('button', { name: 'About', exact: true }).click();
  await expect(pageHeading(page)).toHaveText('About');
  const legal = app.getByRole('button', { name: 'Legal notices' });
  await expect(legal).toHaveAttribute('aria-expanded', 'false');
  await legal.click();
  await expect(legal).toHaveAttribute('aria-expanded', 'true');
  const notice = card(page, 'legal');
  await expect(notice.getByRole('heading', { level: 4, name: 'Legal & credits' })).toBeVisible();
  await expect(notice).toContainText('Original icon glyphs: Lucide (ISC License');
  await expect(notice).toContainText(
    'Windows system glyphs: Fluent UI System Icons (© Microsoft Corporation, MIT License).',
  );
  await expect(notice.getByRole('link', { name: /@/ })).toHaveAttribute(
    'href',
    /^mailto:.+\?subject=Rights%20request$/,
  );

  const official = JSON.parse(readFileSync(join(process.cwd(), 'lib/assets/official.generated.json'), 'utf8')) as {
    entries: Record<string, { label: string; owner: string; sourceUrl: string }>;
  };
  const credits = Object.values(official.entries);
  if (isOriginalMode(info)) {
    // Original artwork only: no third-party credits to show.
    await expect(notice.getByText(/^Asset credits/)).toHaveCount(0);
  } else {
    for (const owner of new Set(credits.map((credit) => credit.owner))) await expect(notice).toContainText(owner);
    const summary = notice.getByText(`Asset credits (${credits.length})`);
    await summary.click();
    const list = notice.locator('details ul li');
    await expect(list).toHaveCount(credits.length);
    const edge = official.entries['app.windows.edge']!;
    const row = list.filter({ hasText: `${edge.label} — ${edge.owner}` }).first();
    await expect(row.getByRole('link', { name: 'source' })).toHaveAttribute('href', edge.sourceUrl);
  }
  await expectFocusNotOnBody(page);
});

// --- WIN-SET-05 ---------------------------------------------------------------------------------------------------------

test('WIN-SET-05 switch parks the session: to macOS and back, then Back to chooser and in again — the windows stay', async ({
  page,
}, info) => {
  await openWindows(page);
  await launch(page, info, 'File Explorer', 'files');
  await launch(page, info, 'Settings', 'settings');
  await expect(page.locator('[data-window]')).toHaveCount(2);
  await goTo(page, 'Switch operating system');
  const app = settings(page);
  await expect(app.getByRole('link', { name: 'Switch to Windows 11' })).toHaveCount(0);
  const others: readonly (readonly [string, string])[] = [
    ['macOS', '/macos'],
    ['iOS', '/ios'],
    ['Android', '/android'],
    ['Linux', '/linux'],
  ];
  for (const [name, href] of others)
    await expect(app.getByRole('link', { name: `Switch to ${name}` })).toHaveAttribute('href', href);

  await app.getByRole('link', { name: 'Switch to macOS' }).click();
  await expect(page).toHaveURL(/\/macos$/);
  await waitForOs(page, 'macos');
  await expect(page.locator('[data-window^="windows:"]')).toHaveCount(0);

  // Come back (browser Back = the previous OS): the parked session returns — both windows, Settings in front.
  await page.goBack();
  await expect(page).toHaveURL(/\/windows\/settings$/);
  await waitForOs(page, 'windows');
  await expect(win(page, 'files')).toBeAttached();
  await expect(settings(page)).toBeAttached();
  await expect(settings(page)).toHaveAttribute('data-focused');

  // Back to chooser, then Windows again: still parked, not destroyed.
  await goTo(page, 'Switch operating system');
  const chooser = settings(page).getByRole('link', { name: 'Back to chooser' });
  await expect(chooser).toHaveAttribute('href', '/');
  await chooser.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Choose how you want to explore' })).toBeVisible();
  await page.locator('[data-chooser-card="windows"]').click();
  await waitForOs(page, 'windows');
  await expect(win(page, 'files')).toBeAttached();
  await expect(settings(page)).toBeAttached();
});

// --- WIN-SET-06 ---------------------------------------------------------------------------------------------------------

test('WIN-SET-06 EGG-WINVER-01 winver: data-driven About dialog; the found counter increments once', async ({
  page,
}, info) => {
  await openSettings(page, info);
  if (isCompact(info)) await goTo(page, 'System'); // phones start on the page list
  await settings(page).getByRole('button', { name: 'About', exact: true }).click();
  await expect(pageHeading(page)).toHaveText('About');
  const initial = await eggCount(page);
  expect(initial.found).toBe(0);
  expect(initial.total).toBeGreaterThan(1);

  // winver from Search: the dialog, OK focused, the facts from the data, Esc = OK.
  let about = await openWinverFromSearch(page);
  await expect(about).toHaveAttribute('aria-modal', 'true');
  await expect(about.getByRole('button', { name: 'OK' })).toBeFocused();
  await expect(about).toContainText(/’s Portfolio/);
  await expect(about).toContainText(/Version \d{4}-\d{2}-\d{2} \(OS Build [0-9a-z]+\)/);
  await expect(about).toContainText('This product is licensed to: you, the visitor');
  await page.keyboard.press('Tab'); // focus is trapped
  await page.keyboard.press('Tab');
  await expect(about.getByRole('button', { name: 'OK' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(about).toHaveCount(0);
  await expectFocusNotOnBody(page);
  await expect.poll(() => eggCount(page)).toEqual({ found: 1, total: initial.total });

  // A second winver never counts twice (prefs and analytics).
  about = await openWinverFromSearch(page);
  await about.getByRole('button', { name: 'OK' }).click();
  await expect(about).toHaveCount(0);
  await expectFocusNotOnBody(page);
  expect(await eggCount(page)).toEqual({ found: 1, total: initial.total });
  await expect
    .poll(async () => ((await storedPrefs(page)).eggsFound ?? []).filter((id: string) => id === 'EGG-WINVER-01'))
    .toEqual(['EGG-WINVER-01']);
  const tracked = await page.evaluate(
    () =>
      (
        (window as unknown as { __pfAnalytics?: { events: { name: string; id?: string }[] } }).__pfAnalytics?.events ??
        []
      ).filter((event) => event.name === 'egg_found' && event.id === 'EGG-WINVER-01').length,
  );
  expect(tracked).toBe(1);

  // It survives a reload.
  await page.reload();
  await waitForOs(page, 'windows');
  await settle(page);
  if (isCompact(info)) await goTo(page, 'System'); // phones start on the page list
  await settings(page).getByRole('button', { name: 'About', exact: true }).click();
  expect(await eggCount(page)).toEqual({ found: 1, total: initial.total });
});

// --- WIN-SET-07 ---------------------------------------------------------------------------------------------------------

test('WIN-SET-07 X1 axe clean (WCAG 2.2 AA): every Settings page, open expanders and the winver dialog', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await openSettings(page, info);
  const app = settings(page);
  const scan = async (label: string, selector = '[data-window="windows:settings"]') => {
    // Scan the settled page: a drill-in fades the page in, and a half-faded page is not what a visitor reads.
    await settle(page);
    await waitForSettled(page, selector);
    // … and nothing inside it is still animating in (the page drill, an expander reveal, the dialog's entrance).
    await page.waitForFunction(
      (sel) =>
        (document.querySelector(sel)?.getAnimations({ subtree: true }) ?? []).every(
          (animation) => animation.playState !== 'running',
        ),
      selector,
    );
    const { violations } = await new AxeBuilder({ page })
      .include(selector)
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    // The first node's check message (for contrast: the measured colours and ratio) makes a failure self-explaining.
    expect(
      violations.map(
        (violation) =>
          `${label}: ${violation.id} ${violation.nodes[0]?.target} — ${violation.nodes[0]?.any[0]?.message ?? ''}`,
      ),
    ).toEqual([]);
  };

  // Semantics the scan cannot judge alone: real switches, labelled native ranges, expanders, the breadcrumb nav.
  if (isCompact(info)) await goTo(page, 'System');
  const sound = app.getByRole('button', { name: 'Sound' });
  await sound.click();
  await expect(sound).toHaveAttribute('aria-expanded', 'true');
  await expect(app.locator(`#${(await sound.getAttribute('aria-controls'))!.replace(/:/g, '\\:')}`)).toBeVisible();
  await expect(app.getByRole('slider', { name: 'Volume' })).toHaveAttribute('type', 'range');
  for (const control of await app.getByRole('switch').all()) {
    expect(await control.evaluate((el) => el.tagName)).toBe('BUTTON');
    await expect(control).toHaveAttribute('aria-checked', /^(true|false)$/);
  }
  await expect(app.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('heading', { level: 3 })).toHaveText(
    'System',
  );
  await scan('system');

  await app.getByRole('button', { name: 'About', exact: true }).click();
  await app.getByRole('button', { name: 'Legal notices' }).click();
  await scan('about + legal');

  for (const name of [
    'Personalization',
    'Accessibility',
    'Privacy & security',
    'Apps',
    'Switch operating system',
    'Tour',
  ]) {
    await goTo(page, name);
    await scan(name);
  }

  await openWinverFromSearch(page);
  await scan('winver', '[data-winver]');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'About Windows' })).toHaveCount(0);
});
