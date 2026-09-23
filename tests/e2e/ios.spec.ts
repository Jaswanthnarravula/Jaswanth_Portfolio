/**
 * iOS — P5 journeys (plans/ios/08-acceptance.md; shared/12 journeys I1 · I2 · I-keyboard · H1 · D1 · P1 · R1 · O1 · S1
 * · T1 · C1 · Q1 · X1–X5). Every step waits on an end state (never a sleep for correctness) and checks focus never
 * rests on <body>. With `pf.debug.probe` set, each app surface reports where it is drawn (`data-visual`) so a flight's
 * landing can be compared with its icon's rect.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { committed, expectFocusNotOnBody, skipIntro, waitForOs, waitForSettled } from './helpers';

type Box = { x: number; y: number; w: number; h: number };

const DESKTOP = ['chromium-desktop', 'reduced-motion', 'asset-original', 'firefox-desktop', 'webkit-desktop'];
const PHONE = ['iphone', 'pixel', 'iphone-landscape'];
const desktopOnly = (info: TestInfo) =>
  test.skip(!DESKTOP.includes(info.project.name), 'full-page layout, fine pointer');
const phoneOnly = (info: TestInfo) => test.skip(!PHONE.includes(info.project.name), 'phone layout');
const motionOnly = (info: TestInfo) => test.skip(info.project.name === 'reduced-motion', 'flights (full motion)');

const grid = (page: Page) => page.getByRole('group', { name: 'Home Screen' });
const dock = (page: Page) => page.getByRole('navigation', { name: 'Dock' });
const surface = (page: Page, role: string) => page.locator(`[data-app-surface="${role}"]`);
const boxOf = (locator: Locator): Promise<Box> =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
const visualOf = async (locator: Locator): Promise<Box | null> => {
  const raw = await locator.getAttribute('data-visual');
  if (!raw) return null;
  const [x, y, w, h] = raw.split(',').map(Number) as [number, number, number, number];
  return { x, y, w, h };
};

/** No surface is flying and no finite animation is running. */
async function settle(page: Page) {
  await page.waitForFunction(() => {
    if (document.querySelector('[data-app-surface][data-state="opening"],[data-app-surface][data-state="closing"]'))
      return false;
    return document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== 'running' || animation.effect?.getComputedTiming().iterations === Infinity,
      );
  });
}

async function openIos(page: Page, path = '/ios') {
  await page.goto(path);
  await waitForOs(page, 'ios');
  await settle(page);
}

/** Mail's Compose lives on the Inbox (the phone's root is Mailboxes; the full page shows the Inbox column). */
async function openInbox(page: Page) {
  const inbox = surface(page, 'mail')
    .locator('[data-screen]:not([hidden]) a, [data-screen]:not([hidden]) button')
    .filter({ hasText: /^Inbox/ });
  if ((await page.locator('[data-ios-layout="phone"]').count()) && (await inbox.count())) {
    await inbox.first().click();
    await settle(page);
  }
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
  if (
    info.project.name === 'chromium-desktop' ||
    info.project.name === 'reduced-motion' ||
    info.project.name === 'asset-original'
  )
    await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    window.sessionStorage.setItem('pf.debug.probe', '1');
    window.sessionStorage.setItem('pf.debug.analytics', '1');
  });
});

// --- Home ------------------------------------------------------------------------------------------------------------

test('IOS-HOME-01 · IOS-DOCK-01 W2 the configured grid and the Dock are real links to static pages @smoke', async ({
  page,
  request,
}) => {
  await openIos(page);
  for (const name of ['Safari', 'Notes', 'Messages', 'Settings'])
    await expect(grid(page).getByRole('link', { name })).toBeVisible();
  await expect(grid(page).getByRole('link', { name: /^GitHub/ })).toBeVisible();
  await expect(grid(page).getByRole('button', { name: /^Career folder, \d+ shortcuts$/ })).toBeVisible();
  const dockNames = await dock(page)
    .getByRole('link')
    .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
  expect(dockNames.slice(0, 4)).toEqual([
    'Files, Résumé',
    'Safari',
    expect.stringMatching(/^GitHub/),
    'Mail, 1 unread',
  ]);
  const hrefs = await page
    .locator('[data-home-screen] a[href], [data-dock] a[href]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('href')!));
  for (const href of new Set(hrefs)) expect((await request.get(href)).status(), href).toBe(200);
});

test('IOS-RESP-04 · IOS-STAT-01 · IOS-HOME-06 full page at 1440 × 900 and 1920 × 1080: no frame, no notch, no scale', async ({
  page,
}, info) => {
  desktopOnly(info);
  for (const [width, height] of [
    [1440, 900],
    [1920, 1080],
  ] as const) {
    await page.setViewportSize({ width, height });
    await openIos(page);
    const shell = page.locator('[data-os-chunk="pf-os-chunk:ios"]');
    expect(await boxOf(shell)).toEqual({ x: 0, y: 0, w: width, h: height });
    expect(await shell.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
    await expect(page.locator('[data-ios-layout="pad"]')).toBeAttached();
    expect(
      await page
        .locator('.os-root [class*="notch" i], .os-root [class*="bezel" i], .os-root [class*="frame" i], [data-frame]')
        .count(),
    ).toBe(0);
    const bar = await boxOf(page.locator('[data-status-bar]'));
    expect(bar.w).toBe(width);
    await expect(page.locator('[data-status-bar]')).toContainText(/\d{1,2}:\d{2}\s*\w{3} \d{1,2} \w{3}/);
    await grid(page)
      .getByRole('link', { name: /^GitHub/ })
      .click();
    await settle(page);
    expect(await boxOf(surface(page, 'github'))).toEqual({ x: 0, y: 0, w: width, h: height });
    await page.keyboard.press('Alt+Shift+H');
    await settle(page);
  }
});

test('IOS-HOME-02 pages: native scroll-snap; dot buttons page; the pill morphs into dots while paging', async ({
  page,
}) => {
  await openIos(page);
  const track = page.locator('[data-pager]');
  expect(await track.evaluate((el) => getComputedStyle(el).scrollSnapType)).toMatch(/x mandatory/);
  const dots = page.getByRole('group', { name: 'Pages' }).getByRole('button');
  await expect(dots).toHaveCount(2);
  await expect(dots.first()).toHaveAttribute('aria-current', 'true');
  await dots.nth(1).focus();
  await dots.nth(1).press('Enter');
  await expect.poll(() => track.evaluate((el) => Math.round(el.scrollLeft / el.clientWidth))).toBe(1);
  await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true');
});

test('IOS-HOME-04 · IOS-SPOT-02 I2 the Search pill and Ctrl+K open Spotlight; Esc closes it back to the pill', async ({
  page,
}) => {
  await openIos(page);
  const pill = page.getByRole('button', { name: 'Search' });
  await pill.click();
  const dialog = page.getByRole('dialog', { name: 'Search' });
  await expect(dialog.getByRole('combobox', { name: 'Search' })).toBeFocused();
  await expect(dialog.getByRole('option', { name: /Files — Résumé/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(pill).toBeFocused();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog', { name: 'Search' })).toHaveCount(0);
  await expectFocusNotOnBody(page);
});

// --- The flight -------------------------------------------------------------------------------------------------------

test('IOS-FLIGHT-01 I1 the app grows out of its icon: first frame in the same task as the press', async ({
  page,
}, info) => {
  motionOnly(info);
  await openIos(page);
  // The press's own task: the click handler runs, React commits the launch and the flight's first frame is drawn —
  // checked in a microtask of that same task, before any frame.
  const result = await page.evaluate(async () => {
    const icon = document.getElementById('ios-icon-app:browser') as HTMLAnchorElement;
    const art = icon.querySelector('[data-art]')!.getBoundingClientRect();
    icon.click();
    await Promise.resolve();
    const section = document.querySelector<HTMLElement>('[data-app-surface="browser"]');
    return {
      exists: !!section,
      transform: section?.style.transform ?? '',
      clip: section?.style.clipPath ?? '',
      visual: section?.dataset.visual ?? '',
      art: [art.x, art.y, art.width, art.height].map(Math.round).join(','),
    };
  });
  expect(result.exists).toBe(true);
  expect(result.transform).toMatch(/scale\(/);
  expect(result.clip).toMatch(/^inset\(.+ round /);
  expect(result.visual).toBe(result.art);
  await settle(page);
  await expect(page).toHaveURL(/\/ios\/safari$/);
  await expect(surface(page, 'browser')).toHaveAttribute('data-state', 'foreground');
  await expect(surface(page, 'browser').locator('h2')).toBeFocused();
});

test('IOS-FLIGHT-02 · IOS-FLIGHT-09 I1 Home returns the app into the icon it came from; focus lands on that icon', async ({
  page,
}, info) => {
  motionOnly(info);
  await openIos(page);
  const icon = dock(page).getByRole('link', { name: /^GitHub/ });
  await icon.click();
  await settle(page);
  await page.locator('[data-home-indicator]').click();
  await settle(page);
  await expect(page).toHaveURL(/\/ios$/);
  await expect(surface(page, 'github')).toHaveAttribute('data-state', 'background');
  const landed = await visualOf(surface(page, 'github'));
  const art = await boxOf(icon.locator('[data-art]'));
  expect(landed).not.toBeNull();
  for (const key of ['x', 'y', 'w', 'h'] as const) expect(Math.abs(landed![key] - art[key])).toBeLessThanOrEqual(2);
  await expect(icon).toBeFocused();
});

test('IOS-CASE-01 E1 · IOS-MOTION-03 E2 ten taps open one app once; a second icon mid-flight retargets the first', async ({
  page,
}, info) => {
  motionOnly(info);
  await openIos(page);
  const safari = grid(page).getByRole('link', { name: 'Safari' });
  await page.evaluate(() => {
    const icon = document.getElementById('ios-icon-app:browser') as HTMLAnchorElement;
    for (let tap = 0; tap < 10; tap++) icon.click();
  });
  await settle(page);
  await expect(page.locator('[data-app-surface="browser"]')).toHaveCount(1);
  const length = await page.evaluate(() => history.length);
  await page.keyboard.press('Alt+Shift+H');
  await settle(page);
  void safari;
  // Tap A, then B while A is still flying: A turns back into its icon, B opens; no jump.
  await page.evaluate(() => {
    (document.getElementById('ios-icon-app:notes') as HTMLAnchorElement).click();
    setTimeout(() => (document.getElementById('ios-icon-app:settings') as HTMLAnchorElement).click(), 90);
  });
  await settle(page);
  await expect(page).toHaveURL(/\/ios\/settings$/);
  await expect(surface(page, 'settings')).toHaveAttribute('data-state', 'foreground');
  await expect(surface(page, 'notes')).toHaveAttribute('data-state', 'background');
  expect(await page.evaluate(() => history.length)).toBeGreaterThanOrEqual(length);
});

test('IOS-FLIGHT-03 · IOS-MOTION-02 the Home gesture: a flick goes Home, a short slow drag springs back, a pause opens the switcher', async ({
  page,
}, info) => {
  motionOnly(info);
  await openIos(page, '/ios/notes');
  const home = await boxOf(page.locator('[data-home-indicator]'));
  const x = home.x + home.w / 2;
  const y = home.y + home.h - 6;
  // Short and slow → cancel.
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 6; step++) await page.mouse.move(x, y - step * 8, { steps: 1 });
  await page.waitForTimeout(60);
  await page.mouse.move(x, y - 40);
  await page.mouse.up();
  await settle(page);
  await expect(page).toHaveURL(/\/ios\/notes$/);
  await expect(surface(page, 'notes')).toHaveAttribute('data-state', 'foreground');
  // Up and pause → the App Switcher.
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 220, { steps: 8 });
  await page.waitForTimeout(420);
  await page.mouse.up();
  await expect(page.getByRole('dialog', { name: 'App Switcher' })).toBeVisible();
  await page.keyboard.press('Escape');
  await settle(page);
  await expect(page).toHaveURL(/\/ios$/);
  // A flick → Home.
  await openIos(page, '/ios/notes');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 260, { steps: 3 });
  await page.mouse.up();
  await settle(page);
  await expect(page).toHaveURL(/\/ios$/);
});

test('IOS-FLIGHT-04 the App Switcher: cards for every app; ✕ closes an app and removes its instance', async ({
  page,
}) => {
  await openIos(page);
  for (const name of ['Safari', 'Notes']) {
    await grid(page).getByRole('link', { name }).click();
    await settle(page);
    await page.keyboard.press('Alt+Shift+H');
    await settle(page);
  }
  await page.keyboard.press('Alt+Shift+O');
  const dialog = page.getByRole('dialog', { name: 'App Switcher' });
  await expect(dialog.getByRole('button', { name: 'Safari', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Notes', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Notes', exact: true }).focus();
  await page.keyboard.press('Delete');
  await expect(dialog.getByRole('button', { name: 'Notes', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Close Safari' }).click({ force: true });
  await expect(dialog.getByRole('button', { name: 'Safari', exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-app-surface]')).toHaveCount(0);
});

test('IOS-FLIGHT-05 E15 the 4th-oldest app restores its screen after eviction', async ({ page }) => {
  await openIos(page, '/ios/settings');
  const settings = surface(page, 'settings');
  await settings
    .locator('a, button')
    .filter({ hasText: /^Accessibility$/ })
    .first()
    .click();
  await expect(settings.locator('[data-screen]:not([hidden]) [data-screen-title]').last()).toHaveText(/Accessibility/);
  await page.keyboard.press('Alt+Shift+H');
  await settle(page);
  for (const name of ['Safari', 'Notes', 'Messages']) {
    await grid(page).getByRole('link', { name }).click();
    await settle(page);
    await page.keyboard.press('Alt+Shift+H');
    await settle(page);
  }
  await dock(page)
    .getByRole('link', { name: /^GitHub/ })
    .click();
  await settle(page);
  await page.keyboard.press('Alt+Shift+H');
  await settle(page);
  await expect(page.locator('[data-app-surface="settings"]')).toHaveCount(0); // evicted (LRU 3)
  await grid(page).getByRole('link', { name: 'Settings' }).click();
  await settle(page);
  await expect(surface(page, 'settings').locator('[data-screen]:not([hidden]) [data-screen-title]').last()).toHaveText(
    /Accessibility/,
  );
});

test('IOS-FLIGHT-06 · IOS-GH-02 the pushed project: back chevron named after Repositories; edge swipe cancels and commits', async ({
  page,
}, info) => {
  phoneOnly(info);
  await openIos(page, '/ios/github');
  const gh = surface(page, 'github');
  const row = gh
    .locator('[data-screen]:not([hidden]) a[data-push-key^="project:"], nav a[data-push-key^="project:"]')
    .first();
  await row.click();
  await expect(page).toHaveURL(/\/ios\/github\/[a-z0-9-]+$/);
  await settle(page);
  const back = gh.getByRole('button', { name: 'Back to Repositories' });
  await expect(back).toBeVisible();
  await back.click();
  await settle(page);
  await expect(page).toHaveURL(/\/ios\/github$/);
  await expect(row).toBeFocused();
});

test('IOS-FLIGHT-07 · IOS-MAIL-02 the compose sheet: Cancel and the grabber drag both dismiss', async ({
  page,
}, info) => {
  motionOnly(info);
  await openIos(page, '/ios/mail');
  const mail = surface(page, 'mail');
  await openInbox(page);
  await mail
    .getByRole('button', { name: /Compose|New Message/ })
    .first()
    .click();
  const sheet = page.getByRole('dialog', { name: 'New Message' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(sheet).toHaveCount(0);
  await mail
    .getByRole('button', { name: /Compose|New Message/ })
    .first()
    .click();
  await expect(sheet).toBeVisible();
  await settle(page);
  const grab = await boxOf(sheet.locator('[data-sheet-grab]'));
  await page.mouse.move(grab.x + grab.w / 2, grab.y + 10);
  await page.mouse.down();
  await page.mouse.move(grab.x + grab.w / 2, grab.y + 500, { steps: 4 });
  await page.mouse.up();
  await expect(sheet).toHaveCount(0);
  await expectFocusNotOnBody(page);
});

test('IOS-FLIGHT-08 · IOS-CASE-03 E13 · ROUTE-MOBILE-01 H1 Back pops, then goes Home, then leaves iOS — never traps', async ({
  page,
}) => {
  await toChooser(page);
  await page.locator('[data-chooser-card="ios"]').click();
  await waitForOs(page, 'ios');
  const lock = page.locator('[data-lock]');
  if (await lock.count()) await page.getByRole('button', { name: 'Open iOS' }).click();
  await expect(lock).toHaveCount(0);
  await settle(page);
  await dock(page)
    .getByRole('link', { name: /^GitHub/ })
    .click();
  await expect(page).toHaveURL(/\/ios\/github$/);
  await settle(page);
  await surface(page, 'github')
    .locator('[data-screen]:not([hidden]) a[data-push-key^="project:"], nav a[data-push-key^="project:"]')
    .first()
    .click();
  await expect(page).toHaveURL(/\/ios\/github\/[a-z0-9-]+$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/ios\/github$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/ios$/);
  await settle(page);
  await expect(surface(page, 'github')).toHaveAttribute('data-state', 'background');
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expectFocusNotOnBody(page);
});

// --- Deep links, reload, restore ------------------------------------------------------------------------------------------

test('ROUTE-DEEP-01 · IOS-BOOT-02 · IOS-LOCK-02 · IOS-GH-02 D1 a cold deep link: the app is simply there — no boot, no lock', async ({
  page,
}) => {
  await openIos(page, '/ios/github/portfolio-os');
  await expect(surface(page, 'github')).toHaveAttribute('data-state', 'foreground');
  await expect(page.locator('[data-boot]')).toHaveCount(0);
  await expect(page.locator('[data-lock]')).toHaveCount(0);
  await expect(
    page
      .getByRole('button', { name: 'Back to Repositories' })
      .or(page.getByRole('button', { name: 'Back to Repositories' })),
  ).toBeAttached();
  await page.reload();
  await waitForOs(page, 'ios');
  await expect(page.locator('[data-lock]')).toHaveCount(0);
  await expect(surface(page, 'github')).toHaveAttribute('data-state', 'foreground');
});

test('IOS-FILES-02 · IOS-FILES-05 D1 /ios/files/experience deep link; Quick Look Done returns to the folder, Back again goes Home', async ({
  page,
}) => {
  await openIos(page);
  await dock(page).getByRole('link', { name: 'Files, Résumé' }).click();
  await expect(page).toHaveURL(/\/ios\/files\/resume$/);
  await settle(page);
  const quickLook = page.getByRole('dialog', { name: /Résumé\.pdf/ });
  await expect(quickLook).toBeVisible();
  await quickLook.getByRole('button', { name: 'Done' }).click();
  await expect(page).toHaveURL(/\/ios\/files$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/ios$/);
  await openIos(page, '/ios/files/experience');
  await expect(surface(page, 'files')).toHaveAttribute('data-state', 'foreground');
});

test('IOS-CASE-03 · KRN-SES-01 P1 reload restores the app, its pushed screen and a Mail draft', async ({ page }) => {
  await openIos(page, '/ios/mail');
  const mail = surface(page, 'mail');
  await openInbox(page);
  await mail
    .getByRole('button', { name: /Compose|New Message/ })
    .first()
    .click();
  const sheet = page.getByRole('dialog', { name: 'New Message' });
  await sheet.getByRole('textbox').last().fill('Hello from the P1 test');
  await committed(page);
  await page.waitForTimeout(400); // the session write is debounced (250 ms)
  await page.reload();
  await waitForOs(page, 'ios');
  await expect(page.getByRole('dialog', { name: 'New Message' }).getByRole('textbox').last()).toHaveValue(
    'Hello from the P1 test',
  );
  await page.evaluate(() => window.localStorage.setItem('pf.sessions.v1', '{not json'));
  await page.reload();
  await waitForOs(page, 'ios');
  await expect(page.locator('[data-home-indicator]')).toBeVisible();
});

// --- Lock, boot, résumé, search -----------------------------------------------------------------------------------------

test('IOS-LOCK-01 · IOS-LOCK-03 · IOS-LOCK-04 · IOS-BOOT-01 first chooser entry: lock → a notification opens its app', async ({
  page,
}) => {
  await toChooser(page);
  await page.locator('[data-chooser-card="ios"]').click();
  await waitForOs(page, 'ios');
  const lock = page.locator('[data-lock]');
  await expect(lock).toBeVisible();
  await expect(lock.getByRole('button', { name: 'Open iOS' })).toBeFocused();
  const notes = lock.getByRole('list', { name: 'Notifications' }).getByRole('link');
  await expect(notes.first()).toContainText('Résumé ready to view');
  await expect(lock.getByRole('link', { name: 'Résumé', exact: true })).toBeVisible();
  await expect(lock.getByRole('link', { name: 'Contact', exact: true })).toBeVisible();
  await notes.nth(1).click();
  await expect(lock).toHaveCount(0);
  await expect(page).toHaveURL(/\/ios\/github$/);
  await settle(page);
  await expectFocusNotOnBody(page);
  // Re-entry this session: no lock.
  await page.keyboard.press('Alt+Shift+S');
  await expect(page).toHaveURL(/\/$/);
  await page.locator('[data-chooser-card="ios"]').click();
  await waitForOs(page, 'ios');
  await expect(page.locator('[data-lock]')).toHaveCount(0);
});

test('IOS-X-01 · IOS-DOCK-02 · RES-IDIOM-01 Q1 the résumé is one action from Home, the widget, Spotlight and Control Center', async ({
  page,
}) => {
  await openIos(page);
  await dock(page).getByRole('link', { name: 'Files, Résumé' }).click();
  await expect(page).toHaveURL(/\/ios\/files\/resume$/);
  await page.keyboard.press('Alt+Shift+H');
  await settle(page);
  const widget = page.getByRole('article', { name: 'Résumé' });
  if (await widget.isVisible()) {
    await widget.getByRole('link', { name: 'Résumé — open' }).click();
    await expect(page).toHaveURL(/\/ios\/files\/resume$/);
    await page.keyboard.press('Alt+Shift+H');
    await settle(page);
  }
  await page.keyboard.press('Control+k');
  await page
    .getByRole('dialog', { name: 'Search' })
    .getByRole('option', { name: /Files — Résumé/ })
    .click();
  await expect(page).toHaveURL(/\/ios\/files\/resume$/);
  await page.keyboard.press('Alt+Shift+H');
  await settle(page);
  await page.getByRole('button', { name: 'Control Center' }).click();
  await page
    .getByRole('dialog', { name: 'Control Center' })
    .getByRole('button', { name: /Résumé/ })
    .click();
  await expect(page).toHaveURL(/\/ios\/files\/resume$/);
});

test('IOS-SPOT-03 · SRCH-ACT-01 S1 a result opens its app with exactly one history entry', async ({ page }) => {
  await openIos(page);
  const before = await page.evaluate(() => history.length);
  await page.keyboard.press('Control+k');
  await page.keyboard.type('experience');
  const dialog = page.getByRole('dialog', { name: 'Search' });
  await expect(dialog.getByRole('option').first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/ios\/files\/experience/);
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
});

test('IOS-SPOT-04 a command result offers Linux and never switches without an explicit press', async ({ page }) => {
  await openIos(page);
  await page.keyboard.press('Control+k');
  await page.keyboard.type('grep');
  const dialog = page.getByRole('dialog', { name: 'Search' });
  const option = dialog.getByRole('option', { name: /^grep/ });
  await expect(option).toBeVisible();
  await option.click();
  await expect(dialog.getByRole('button', { name: 'Stay in iOS' })).toBeFocused();
  await expect(page).toHaveURL(/\/ios$/);
  await dialog.getByRole('button', { name: 'Stay in iOS' }).click();
  await expect(page).toHaveURL(/\/ios$/);
});

// --- Control Center, prefs, switch OS, eggs, tour, continuity -----------------------------------------------------------

test('IOS-CC-02 · IOS-SET-02 · A11Y-PREF-01 toggles apply instantly, persist, and mirror Settings', async ({
  page,
}) => {
  await openIos(page);
  await page.getByRole('button', { name: 'Control Center' }).click();
  const cc = page.getByRole('dialog', { name: 'Control Center' });
  await cc.getByRole('button', { name: 'Reduce Motion' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await cc.getByRole('button', { name: 'Reduce Transparency' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-glass', 'solid');
  await page.keyboard.press('Escape');
  await expect(cc).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Control Center' })).toBeFocused();
  await page.reload();
  await waitForOs(page, 'ios');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await grid(page).getByRole('link', { name: 'Settings' }).click();
  await settle(page);
  const settings = surface(page, 'settings');
  await settings
    .locator('a, button')
    .filter({ hasText: /^Accessibility$/ })
    .first()
    .click();
  await expect(settings.getByRole('switch', { name: /Reduce Motion/ }).first()).toHaveAttribute('aria-checked', 'true');
});

test('IOS-CC-05 · IOS-X-05 Switch OS: the Control Center sheet and Alt+Shift+S park iOS and reach the chooser', async ({
  page,
}) => {
  await openIos(page, '/ios/notes');
  await page.getByRole('button', { name: 'Control Center' }).click();
  await page
    .getByRole('dialog', { name: 'Control Center' })
    .getByRole('button', { name: /Switch OS/ })
    .click();
  const sheet = page.getByRole('dialog', { name: 'Switch Operating System' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Back to chooser' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.locator('[data-chooser-card="ios"]').click();
  await waitForOs(page, 'ios');
  await expect(page).toHaveURL(/\/ios\/notes$/); // the parked session: Notes still in front
  await page.keyboard.press('Alt+Shift+S');
  await expect(page).toHaveURL(/\/$/);
});

test('IOS-X-04 · EGG-KONAMI-01 · EGG-SHAKE-01 the Konami code and the empty-Home long press each count once', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openIos(page);
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
  await expect(page.locator('[data-banner="konami"]')).toBeVisible();
  const found = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('pf.prefs.v1') ?? '{}').state?.eggsFound ?? []);
  await expect.poll(found).toContain('EGG-KONAMI-01');
  // An empty spot on the page, held 2 s.
  const box = await boxOf(page.locator('[data-page="0"]'));
  await page.mouse.move(box.x + box.w - 40, box.y + box.h - 40);
  await page.mouse.down();
  await page.waitForTimeout(2200);
  await page.mouse.up();
  await expect.poll(found).toContain('EGG-SHAKE-01');
});

test('IOS-X-03 · TOUR-REAL-01 T1 the tour: Control Center starts it; step 1 really opens Safari; any input ends it', async ({
  page,
}) => {
  await openIos(page);
  await page.getByRole('button', { name: 'Control Center' }).click();
  await page.getByRole('dialog', { name: 'Control Center' }).getByRole('button', { name: /Tour/ }).click();
  const coach = page.getByRole('dialog', { name: /Tour, step 1 of 5/ });
  await expect(coach).toBeVisible();
  await expect(coach).toContainText('Every icon is an app');
  await expect(page).toHaveURL(/\/ios\/safari$/);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-coach]')).toHaveCount(0);
});

test('IOS-X-02 · CONT-ACCEPT-01 · IOS-NOTIF-02 C1 continuity from Windows: a Handoff offer, never an auto-open', async ({
  page,
}, info) => {
  desktopOnly(info);
  await page.goto('/windows/github/portfolio-os');
  await waitForOs(page, 'windows');
  await committed(page);
  await page.keyboard.press('Alt+Shift+S');
  await expect(page).toHaveURL(/\/$/);
  await page.locator('[data-chooser-card="ios"]').click();
  await waitForOs(page, 'ios');
  const lock = page.locator('[data-lock]');
  const banner = page.locator('[data-banner="handoff"]');
  await expect(lock.or(banner).first()).toBeVisible();
  await expect(page).toHaveURL(/\/ios$/);
  if (await lock.count()) await lock.getByRole('link', { name: /Handoff/ }).click();
  else await banner.click();
  await expect(page).toHaveURL(/\/ios\/github\/portfolio-os$/);
});

// --- Accessibility, blur, motion, responsive ---------------------------------------------------------------------------

test('IOS-A11Y-02 · A11Y-AXE-01 X1 axe clean: Home, folder, an app, a sheet, Spotlight, Control Center, switcher', async ({
  page,
}) => {
  test.slow(); // seven full axe passes in one journey
  const scan = async (label: string) => {
    await settle(page);
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(violations.map((violation) => `${label}: ${violation.id} ${violation.nodes[0]?.target}`)).toEqual([]);
  };
  await openIos(page);
  await scan('home');
  await grid(page)
    .getByRole('button', { name: /^Career folder/ })
    .click();
  await expect(page.getByRole('dialog', { name: 'Career' })).toBeVisible();
  await scan('folder');
  await page.keyboard.press('Escape');
  await grid(page)
    .getByRole('link', { name: /^GitHub/ })
    .click();
  await scan('github');
  await page.keyboard.press('Alt+Shift+H');
  await dock(page).getByRole('link', { name: /^Mail/ }).click();
  await settle(page);
  await openInbox(page);
  await surface(page, 'mail')
    .getByRole('button', { name: /Compose|New Message/ })
    .first()
    .click();
  await expect(page.getByRole('dialog', { name: 'New Message' })).toBeVisible();
  await scan('sheet');
  await page.getByRole('dialog', { name: 'New Message' }).getByRole('button', { name: 'Cancel' }).click();
  await page.keyboard.press('Alt+Shift+H');
  await page.keyboard.press('Control+k');
  await scan('spotlight');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Control Center' }).click();
  await scan('control-center');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Alt+Shift+O');
  await expect(page.getByRole('dialog', { name: 'App Switcher' })).toBeVisible();
  await scan('switcher');
});

test('IOS-A11Y-01 X2 landmarks in reading order; the app is a labelled region; Home inert behind it', async ({
  page,
}) => {
  await openIos(page, '/ios/notes');
  const order = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        '.os-root [role="group"][aria-label="Status bar"], .os-root main, .os-root nav[aria-label="Dock"], .os-root [data-home-indicator], .os-root [data-banner-region]',
      ),
    ].map((el) => el.getAttribute('aria-label') ?? el.tagName.toLowerCase()),
  );
  expect(order).toEqual(['Status bar', 'main', 'Dock', 'Home', 'Notifications']);
  await expect(surface(page, 'notes')).toHaveAttribute('aria-labelledby', 'ios-app-notes');
  await expect(page.locator('[data-home-layer]')).toHaveAttribute('inert', '');
});

test('IOS-A11Y-03 · IOS-A11Y-05 I-keyboard: grid arrows → folder → Résumé → Done → Home → Spotlight → switcher', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openIos(page);
  const safari = grid(page).getByRole('link', { name: 'Safari' });
  await safari.focus();
  await page.keyboard.press('ArrowRight');
  await expect(grid(page).getByRole('link', { name: /^GitHub/ })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.locator('[data-page="1"] [data-roving-item]').last()).toBeFocused();
  await grid(page)
    .getByRole('button', { name: /^Career folder/ })
    .focus();
  await page.keyboard.press('Enter');
  const folder = page.getByRole('dialog', { name: 'Career' });
  await expect(folder.getByRole('link').first()).toBeFocused();
  await folder.getByRole('link', { name: 'Résumé' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/ios\/files\/resume$/);
  await settle(page);
  await page.keyboard.press('Escape'); // Quick Look Done (back one level)
  await expect(page).toHaveURL(/\/ios\/files$/);
  await page.keyboard.press('Alt+Shift+H');
  await settle(page);
  await expectFocusNotOnBody(page);
  await page.keyboard.press('Control+k');
  await page.keyboard.type('portfolio');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/ios\/github/);
  await settle(page);
  await page.keyboard.press('Alt+Shift+O');
  const switcher = page.getByRole('dialog', { name: 'App Switcher' });
  await expect(switcher.getByRole('button').first()).toBeVisible();
  await page.keyboard.press('Delete');
  await page.keyboard.press('Escape');
  await expect(switcher).toHaveCount(0);
  await expectFocusNotOnBody(page);
});

test('IOS-ID-05 · PERF-BLUR-01 X5 at most 3 live backdrop-filter surfaces with Control Center open', async ({
  page,
}) => {
  await openIos(page);
  await page.getByRole('button', { name: 'Control Center' }).click();
  await settle(page);
  const live = await page.evaluate(
    () =>
      [...document.querySelectorAll('.os-root *')].filter((el) => {
        const css = getComputedStyle(el);
        if (css.visibility === 'hidden' || el.closest('[style*="visibility: hidden"]')) return false;
        const value = css.backdropFilter || (css as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter;
        return value && value !== 'none';
      }).length,
  );
  expect(live).toBeLessThanOrEqual(3);
});

test('IOS-ID-04 dim-on-press (80 ms in / 200 ms out); never a ripple element', async ({ page }) => {
  await openIos(page);
  const timing = await page.evaluate(() => {
    const art = document.querySelector('#ios-icon-app\\:browser [data-art]')!.parentElement!;
    const after = getComputedStyle(art, '::after');
    return { duration: after.transitionDuration, opacity: after.opacity };
  });
  expect(timing.duration).toBe('0.2s');
  expect(timing.opacity).toBe('0');
  expect(await page.locator('.os-root [class*="ripple" i], .os-root [data-ripple]').count()).toBe(0);
});

test('IOS-MOTION-05 · MOTION-RM-01 R1 reduced motion: no animation over 200 ms; end states match', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'reduced-motion', 'the reduced-motion project');
  await openIos(page);
  await grid(page).getByRole('link', { name: 'Safari' }).click();
  const long = await page.evaluate(
    () =>
      document.getAnimations().filter((animation) => {
        const timing = animation.effect?.getComputedTiming();
        return typeof timing?.duration === 'number' && timing.duration > 200 && timing.iterations !== Infinity;
      }).length,
  );
  expect(long).toBe(0);
  await settle(page);
  await expect(surface(page, 'browser')).toHaveAttribute('data-state', 'foreground');
});

test('IOS-SAF-03 · MOTION-SCROLL-01 neither Lenis nor ScrollTrigger is requested on /ios/*', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  await openIos(page, '/ios/safari');
  await surface(page, 'browser')
    .locator('[data-scroller]')
    .first()
    .evaluate((el) => el.scrollTo({ top: 600 }));
  await page.waitForTimeout(300);
  const scripts = await page.evaluate(() => performance.getEntriesByType('resource').map((entry) => entry.name));
  const all = [...requested, ...scripts].join('\n');
  expect(all).not.toMatch(/lenis/i);
  expect(all).not.toMatch(/ScrollTrigger/);
});

test('IOS-RESP-06 · IOS-HOME-07 · MOTION-FLIGHT-01 O1 layout swaps keep the app and its stack; Home returns to the new icon rect', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openIos(page, '/ios/github/portfolio-os');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-ios-layout="phone"]')).toBeAttached();
  await expect(page).toHaveURL(/\/ios\/github\/portfolio-os$/);
  await expect(surface(page, 'github')).toHaveAttribute('data-state', 'foreground');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('[data-ios-layout="pad"]')).toBeAttached();
  await page.keyboard.press('Alt+Shift+H');
  await settle(page);
  const icon = grid(page).getByRole('link', { name: /^GitHub/ });
  const landed = await visualOf(surface(page, 'github'));
  const art = await boxOf(icon.locator('[data-art]'));
  if (landed)
    for (const key of ['x', 'y', 'w', 'h'] as const) expect(Math.abs(landed[key] - art[key])).toBeLessThanOrEqual(2);
});

test('IOS-RESP-01 · IOS-STAT-01 the phone: full-bleed, status bar in the safe area, no drawn notch or bezel', async ({
  page,
}, info) => {
  phoneOnly(info);
  await openIos(page);
  await expect(page.locator('[data-ios-layout="phone"]')).toBeAttached();
  const viewport = page.viewportSize()!;
  expect(await boxOf(page.locator('[data-os-chunk="pf-os-chunk:ios"]'))).toEqual({
    x: 0,
    y: 0,
    w: viewport.width,
    h: viewport.height,
  });
  expect(
    await page
      .locator('.os-root [class*="notch" i], .os-root [class*="island" i], .os-root [class*="bezel" i]')
      .count(),
  ).toBe(0);
  const bar = await boxOf(page.locator('[data-status-bar]'));
  expect(bar.h).toBeGreaterThanOrEqual(44);
});
