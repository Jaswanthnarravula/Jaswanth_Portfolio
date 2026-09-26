/** Android P6 acceptance journeys — launcher, system UI, lifecycle, responsive layout and app routing. */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { expectFocusNotOnBody, waitForOs } from './helpers';

const DESKTOP = ['chromium-desktop', 'reduced-motion', 'asset-original', 'firefox-desktop', 'webkit-desktop'];
const desktopOnly = (info: TestInfo) => test.skip(!DESKTOP.includes(info.project.name), 'large-screen Android');

async function openAndroid(page: Page, path = '/android') {
  await page.goto(path);
  await waitForOs(page, 'android');
  const dismiss = page.getByRole('button', { name: 'Dismiss' });
  if (await dismiss.isVisible()) await dismiss.click();
}

test('AND-HOME-01 · AND-BARS-01 · AND-RESP-02 fills the page with a sparse linked launcher @smoke', async ({
  page,
  request,
}, info) => {
  desktopOnly(info);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openAndroid(page);
  const shell = page.locator('[data-android-layout]');
  await expect(shell).toHaveAttribute('data-android-layout', 'large');
  await expect(shell).toHaveCSS('position', 'fixed');
  expect(await shell.evaluate((node) => node.getBoundingClientRect().toJSON())).toMatchObject({
    x: 0,
    y: 0,
    width: 1440,
    height: 900,
  });
  await expect(page.getByRole('button', { name: 'Search apps and more' })).toBeVisible();
  const home = page.getByRole('region', { name: 'Home screen' });
  await expect(home.getByRole('link', { name: 'Résumé' })).toHaveAttribute('href', '/android/files/resume');
  await expect(home.getByRole('link', { name: 'Keep' })).toBeVisible();
  const favorites = page.getByRole('navigation', { name: 'Favorites' });
  await expect(favorites.getByRole('link', { name: 'Files, Résumé' })).toHaveAttribute('href', '/android/files/resume');
  for (const link of await favorites.getByRole('link').all()) {
    const href = await link.getAttribute('href');
    if (href) expect((await request.get(href)).status(), href).toBe(200);
  }
  const system = page.getByRole('navigation', { name: 'System navigation' });
  await expect(system.getByRole('button', { name: 'Back' })).toBeVisible();
  await expect(system.getByRole('button', { name: 'Home' })).toBeVisible();
  await expect(system.getByRole('button', { name: 'Recent apps' })).toBeVisible();
  expect(await page.locator('[data-cutout], [data-bezel], [data-device-frame]').count()).toBe(0);
});

test('AND-DRAWER-01 · AND-SEARCH-01 search opens portfolio content and Back unwinds it', async ({ page }, info) => {
  desktopOnly(info);
  await openAndroid(page);
  await page.getByRole('button', { name: 'Search apps and more' }).click();
  const drawer = page.getByRole('dialog', { name: 'All apps' });
  const search = drawer.getByRole('combobox');
  await expect(search).toBeFocused();
  await search.fill('experience');
  await expect(drawer.getByRole('option', { name: /Experience/ }).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(search).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Search apps and more' })).toBeFocused();
  await expectFocusNotOnBody(page);
});

test('AND-LIFE-01 · AND-RECENTS-01 Home preserves one instance and Recents closes it', async ({ page }, info) => {
  desktopOnly(info);
  await openAndroid(page);
  await page.getByRole('navigation', { name: 'Favorites' }).getByRole('link', { name: 'GitHub' }).click();
  await expect(page.locator('[data-app="github"]')).toBeVisible();
  await page.getByRole('navigation', { name: 'System navigation' }).getByRole('button', { name: 'Home' }).click();
  await expect(page).toHaveURL(/\/android$/);
  await expect(page.locator('[data-app="github"]')).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'System navigation' })
    .getByRole('button', { name: 'Recent apps' })
    .click();
  const recents = page.getByRole('dialog', { name: 'Recent apps' });
  await expect(recents.getByRole('button', { name: 'Close GitHub' })).toBeVisible();
  await recents.getByRole('button', { name: 'Close GitHub' }).click();
  await expect(recents.getByRole('button', { name: 'Close GitHub' })).toHaveCount(0);
});

test('AND-SHADE-01 · AND-QS-01 combined shade expands and changes navigation mode', async ({ page }, info) => {
  desktopOnly(info);
  await openAndroid(page);
  await page.getByRole('button', { name: 'Notifications and quick settings' }).click();
  const shade = page.getByRole('dialog', { name: 'Notifications and quick settings' });
  await shade.getByRole('button', { name: 'Expand quick settings' }).click();
  await expect(shade.getByRole('button', { name: /3-button navigation/ })).toBeVisible();
  await shade.getByRole('button', { name: /Dark theme/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.keyboard.press('Escape');
  await expect(shade.getByRole('button', { name: 'Expand quick settings' })).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Escape');
  await expect(shade).toHaveCount(0);
});

test('AND-APP-01 · AND-MAP-01 all six app routes load the canonical Material app', async ({ page }, info) => {
  desktopOnly(info);
  for (const [path, app] of [
    ['/android/chrome', 'chrome'],
    ['/android/github', 'github'],
    ['/android/files/resume', 'files'],
    ['/android/keep', 'keep'],
    ['/android/gmail', 'gmail'],
    ['/android/settings', 'settings'],
  ] as const) {
    await openAndroid(page, path);
    await expect(page.locator(`[data-app="${app}"]`), path).toBeVisible();
  }
});

test('AND-GMAIL-05 the pinned conversation attachment opens the résumé in Files', async ({ page }, info) => {
  desktopOnly(info);
  await openAndroid(page, '/android/gmail');
  const attachment = page.getByRole('button', { name: /PDF .*\.pdf/ });
  await expect(attachment).toBeVisible();
  await attachment.click();
  await expect(page).toHaveURL(/\/android\/files\/resume$/);
  await expect(page.locator('[data-app="files"]')).toBeVisible();
});

test('AND-RESP-01 · AND-BARS-05 phone layout keeps 48px gesture targets and reveals keyboard controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAndroid(page);
  await expect(page.locator('[data-android-layout]')).toHaveAttribute('data-android-layout', 'phone');
  const system = page.getByRole('navigation', { name: 'System navigation' });
  const home = system.getByRole('button', { name: 'Home' });
  expect((await home.boundingBox())?.width).toBeGreaterThanOrEqual(48);
  expect((await home.boundingBox())?.height).toBeGreaterThanOrEqual(48);
  for (const name of ['Back', 'Recent apps']) {
    const button = system.getByRole('button', { name });
    await button.focus();
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(48);
    expect(box?.height).toBeGreaterThanOrEqual(48);
  }
  await page.getByRole('region', { name: 'Home screen' }).getByRole('link', { name: 'Keep' }).click();
  await expect(page.locator('[data-app="keep"]')).toBeVisible();
});

test('AND-FAV-01 · AND-LIFE-01 on a phone an open app owns the whole screen — the favourites row never covers it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await openAndroid(page);
  const favorites = page.getByRole('navigation', { name: 'Favorites' });
  await expect(favorites.getByRole('link', { name: 'Gmail' })).toBeVisible();
  const box = (await favorites.boundingBox())!;
  await page.getByRole('region', { name: 'Home screen' }).getByRole('link', { name: 'Keep' }).click();
  await expect(page.locator('[data-app="keep"]')).toBeVisible();
  await expect(page.locator('[data-app-surface][data-opening]')).toHaveCount(0);
  // Whatever sits where the favourites row was is the app, not a launcher icon.
  const topmost = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-app-surface]')?.getAttribute('data-app-surface'),
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
  expect(topmost).toBe('notes');
});

test('AND-ID-02 · AND-ID-06 the Pixel wallpaper, its palette and Google Sans Flex load with Android', async ({
  page,
}, info) => {
  desktopOnly(info);
  test.skip(info.project.name === 'asset-original', 'official wallpaper overlay');
  await openAndroid(page);
  const shell = page.locator('[data-android-layout]');
  await expect(shell).toHaveAttribute('data-wallpaper-official', '');
  // The generated Material You palette is applied (Chrome reports the computed colour in lab()).
  expect(await shell.evaluate((node) => getComputedStyle(node).getPropertyValue('--md-primary').trim())).not.toBe('');
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('16px "Google Sans Flex"'))).toBe(true);
  // Status-bar glyphs are the official Material Symbols (SVG), not text stand-ins.
  const status = page.getByRole('button', { name: 'Notifications and quick settings' });
  expect(await status.locator('svg[data-symbol]').count()).toBeGreaterThanOrEqual(2);
});

test('AND-A11Y-01 home has no serious axe violations', async ({ page }) => {
  await openAndroid(page);
  const report = await new AxeBuilder({ page }).include('[data-android-layout]').analyze();
  expect(report.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
});

test('AND-GH-07 the Case study tab; a deep dive opens full screen and system Back closes it into its item', async ({
  page,
}) => {
  await openAndroid(page, '/android/github/enterprise-sso');
  const gh = page.locator('[data-app="github"]');
  await gh.getByRole('tablist', { name: 'Repository' }).getByRole('tab', { name: 'Case study' }).click();
  await expect(gh.getByRole('heading', { name: 'Key decisions' })).toBeVisible();
  await gh.getByRole('button', { name: /Rotating signing keys without logging anyone out/ }).click();
  const reader = gh.getByRole('region', { name: 'Rotating signing keys without logging anyone out' });
  await expect(reader).toBeVisible();
  await expect(reader.getByRole('heading', { level: 3 })).toBeFocused();
  // System Back: in gesture navigation its button is the keyboard alternative (shown on focus), so press it.
  await page.getByRole('navigation', { name: 'System navigation' }).getByRole('button', { name: 'Back' }).press('Enter');
  await expect(reader).toHaveCount(0);
  await expect(page).toHaveURL(/\/android\/github\/enterprise-sso$/);
  await expect(gh.locator('[data-and-doc="rotating-signing-keys"]')).toBeFocused();
});
