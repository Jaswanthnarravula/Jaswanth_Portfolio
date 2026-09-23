/**
 * iOS — P5 journeys, part 2 (plans/ios/08-acceptance.md): GitHub's tab stacks and split view (`IOS-GH-01/05/06`),
 * phone landscape and tablet layouts (`IOS-RESP-02/03`), the mouse-only journey (`IOS-RESP-05`), keyboard-safe sheets
 * and search behind a `visualViewport` shim (`IOS-RESP-07`), the gesture-alternatives checklist (`IOS-A11Y-04`) and the
 * edge cases of part C (`IOS-CASE-04`: E15, E18–E22). Every step waits on an end state, never a sleep for correctness.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { committed, expectFocusNotOnBody, waitForOs } from './helpers';

type Box = { x: number; y: number; w: number; h: number };

const DESKTOP = ['chromium-desktop', 'reduced-motion', 'asset-original', 'firefox-desktop', 'webkit-desktop'];
const PHONE = ['iphone', 'pixel', 'iphone-landscape'];
const TABLET = ['ipad-portrait', 'ipad-landscape'];
const desktopOnly = (info: TestInfo) =>
  test.skip(!DESKTOP.includes(info.project.name), 'full-page layout, fine pointer');
const phoneOnly = (info: TestInfo) => test.skip(!PHONE.includes(info.project.name), 'phone layout');
const fullPageOnly = (info: TestInfo) => test.skip(PHONE.includes(info.project.name), 'full-page (pad) layout');

const grid = (page: Page) => page.getByRole('group', { name: 'Home Screen' });
const dock = (page: Page) => page.getByRole('navigation', { name: 'Dock' });
const surface = (page: Page, role: string) => page.locator(`[data-app-surface="${role}"]`);
const topScreen = (app: Locator) => app.locator('[data-screen]:not([hidden]):not([inert])').last();
const screenTitle = (app: Locator) => topScreen(app).locator('[data-screen-title]').last();
const boxOf = (locator: Locator): Promise<Box> =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
const isPad = async (page: Page) => (await page.locator('[data-ios-layout="pad"]').count()) > 0;

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

async function goHome(page: Page) {
  await page.keyboard.press('Alt+Shift+H');
  await settle(page);
  await expect(page).toHaveURL(/\/ios$/);
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

async function openCompose(page: Page): Promise<Locator> {
  await openIos(page, '/ios/mail');
  await openInbox(page);
  await surface(page, 'mail')
    .getByRole('button', { name: /Compose|New Message/ })
    .first()
    .click();
  const sheet = page.getByRole('dialog', { name: 'New Message' });
  await expect(sheet).toBeVisible();
  await settle(page);
  return sheet;
}

/** A `--*` custom property written on an element's inline style. */
const styleVar = (locator: Locator, name: string) =>
  locator.evaluate((el, prop) => (el as HTMLElement).style.getPropertyValue(prop).trim(), name);

/** The full-page grid (plans/ios/04): 6 / 7 / 8 columns by size class, less the two widget columns (one more portrait). */
function expectedPadGrid(w: number, h: number) {
  const total = w < 1100 ? 6 : w < 1600 ? 7 : 8;
  const cols = w >= h ? total - 2 : Math.max(3, total - 3);
  const icon = Math.round(Math.min(96, Math.max(64, h * 0.084)));
  return { cols, icon };
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

// --- GitHub ------------------------------------------------------------------------------------------------------------

test('IOS-GH-01 I1 tabs keep independent stacks: Home · Projects · Profile, each root with its own pushed screen', async ({
  page,
}, info) => {
  phoneOnly(info);
  await openIos(page, '/ios/github');
  const gh = surface(page, 'github');
  const tabs = gh.getByRole('navigation', { name: 'GitHub' });
  const tab = (name: string) => tabs.getByRole('link', { name, exact: true });
  await expect(tabs.getByRole('link')).toHaveText(['Home', 'Projects', 'Profile']);
  await expect(tab('Projects')).toHaveAttribute('aria-current', 'page');
  await expect(screenTitle(gh)).toHaveText('Repositories');

  // Projects tab: push a repository.
  const repoRow = topScreen(gh).locator('a[data-push-key^="project:"]').first();
  const projectsSlug = (await repoRow.getAttribute('data-push-key'))!.replace('project:', '');
  await repoRow.click();
  await expect(page).toHaveURL(new RegExp(`/ios/github/${projectsSlug}$`));
  await settle(page);
  await expect(gh.getByRole('button', { name: 'Back to Repositories' })).toBeVisible();

  // Home tab: its own root, no pushed screen, URL back at the app root.
  await tab('Home').click();
  await expect(tab('Home')).toHaveAttribute('aria-current', 'page');
  await expect(page).toHaveURL(/\/ios\/github$/);
  await settle(page);
  await expect(screenTitle(gh)).toHaveText('Home');
  await expect(gh.locator('[data-back]:visible')).toHaveCount(0);

  // Push a different project from the Home tab (Favorites / Recent).
  const homeRows = topScreen(gh).locator('a[data-push-key^="project:"]');
  await expect(homeRows.first()).toBeVisible();
  const keys = await homeRows.evaluateAll((els) => els.map((el) => el.getAttribute('data-push-key')!));
  const homeKey = keys.find((key) => key !== `project:${projectsSlug}`) ?? keys[0]!;
  const homeSlug = homeKey.replace('project:', '');
  await topScreen(gh).locator(`a[data-push-key="${homeKey}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`/ios/github/${homeSlug}$`));
  await settle(page);
  await expect(gh.getByRole('button', { name: 'Back to Home' })).toBeVisible();

  // Back to Projects: its pushed repository is still on top of its stack.
  await tab('Projects').click();
  await expect(page).toHaveURL(new RegExp(`/ios/github/${projectsSlug}$`));
  await settle(page);
  await expect(gh.getByRole('button', { name: 'Back to Repositories' })).toBeVisible();

  // And Home's too.
  await tab('Home').click();
  await expect(page).toHaveURL(new RegExp(`/ios/github/${homeSlug}$`));
  await settle(page);
  await expect(gh.getByRole('button', { name: 'Back to Home' })).toBeVisible();

  // Tapping the active tab pops it to its root.
  await tab('Home').click();
  await expect(page).toHaveURL(/\/ios\/github$/);
  await settle(page);
  await expect(screenTitle(gh)).toHaveText('Home');

  // Profile: a third root with a large title.
  await tab('Profile').click();
  await expect(tab('Profile')).toHaveAttribute('aria-current', 'page');
  await settle(page);
  await expect(screenTitle(gh)).toHaveText('Profile');
  await expectFocusNotOnBody(page);

  // From the keyboard: Enter on a tab switches roots and focus stays in the app.
  await tab('Projects').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/ios/github/${projectsSlug}$`));
  await settle(page);
  await expect(tab('Projects')).toHaveAttribute('aria-current', 'page');
  await expectFocusNotOnBody(page);
});

test('IOS-GH-05 ipad-landscape list-detail: the sidebar lists repositories, the detail shows beside it', async ({
  page,
}, info) => {
  fullPageOnly(info);
  await openIos(page, '/ios/github');
  await expect(page.locator('[data-ios-layout="pad"]')).toBeAttached();
  const gh = surface(page, 'github');
  const sidebar = gh.getByRole('navigation', { name: 'GitHub' });
  await expect(sidebar).toBeVisible();
  // The tab bar became the sidebar: no bottom tab bar in the split view.
  await expect(gh.locator('[data-tab-bar]')).toHaveCount(0);
  for (const name of ['Home', 'Projects', 'Profile'])
    await expect(sidebar.getByRole('button', { name, exact: true })).toBeVisible();
  await expect(sidebar.getByRole('button', { name: 'Projects', exact: true })).toHaveAttribute('aria-current', 'page');

  const rows = sidebar.locator('a[data-push-key^="project:"]');
  expect(await rows.count()).toBeGreaterThan(1);
  const first = rows.first();
  const slug = (await first.getAttribute('data-push-key'))!.replace('project:', '');
  await first.click();
  await expect(page).toHaveURL(new RegExp(`/ios/github/${slug}$`));
  await settle(page);
  await expect(first).toHaveAttribute('aria-current', 'page');
  const title = gh.locator('[data-screen]:not([hidden]) h3[data-screen-title]').last();
  await expect(title).toBeVisible();

  // List and detail side by side, both on screen at once.
  const side = await boxOf(sidebar);
  const detail = await boxOf(title);
  const viewport = page.viewportSize()!;
  expect(side.x).toBeLessThanOrEqual(1);
  expect(side.w).toBeGreaterThanOrEqual(280);
  expect(side.w).toBeLessThan(viewport.width * 0.5);
  expect(detail.x).toBeGreaterThanOrEqual(side.x + side.w);
  await expect(sidebar).toBeVisible();
  await expect(gh.getByRole('button', { name: 'Back to Repositories' })).toBeVisible();

  // A second row swaps the detail; the list stays.
  const second = rows.nth(1);
  const slug2 = (await second.getAttribute('data-push-key'))!.replace('project:', '');
  await second.click();
  await expect(page).toHaveURL(new RegExp(`/ios/github/${slug2}$`));
  await expect(second).toHaveAttribute('aria-current', 'page');
  await expect(first).not.toHaveAttribute('aria-current', 'page');
  await expect(sidebar).toBeVisible();
});

test('IOS-GH-06 X1 axe clean on GitHub: nav + aria-current, radiogroup segments', async ({ page }) => {
  const scan = async (label: string) => {
    await settle(page);
    const { violations } = await new AxeBuilder({ page })
      .include('[data-app-surface="github"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(violations.map((violation) => `${label}: ${violation.id} ${violation.nodes[0]?.target}`)).toEqual([]);
  };
  await openIos(page, '/ios/github');
  const gh = surface(page, 'github');
  const nav = gh.getByRole('navigation', { name: 'GitHub' });
  await expect(nav).toBeVisible();
  // Exactly one current navigation root.
  await expect(nav.locator('[aria-current="page"]').filter({ hasText: /^(Home|Projects|Profile)$/ })).toHaveCount(1);
  await scan('repositories');

  await gh
    .locator('[data-screen]:not([hidden]) a[data-push-key^="project:"], nav a[data-push-key^="project:"]')
    .first()
    .click();
  await expect(page).toHaveURL(/\/ios\/github\/[a-z0-9-]+$/);
  await settle(page);
  const segments = gh.getByRole('radiogroup', { name: 'Project sections' });
  await expect(segments.getByRole('radio')).toHaveText(['README', 'Stack', 'About']);
  await expect(segments.getByRole('radio', { name: 'README' })).toHaveAttribute('aria-checked', 'true');
  await segments.getByRole('radio', { name: 'README' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(segments.getByRole('radio', { name: 'Stack' })).toHaveAttribute('aria-checked', 'true');
  await expect(segments.getByRole('radio', { name: 'Stack' })).toBeFocused();
  await expect(segments.getByRole('radio', { name: 'README' })).toHaveAttribute('tabindex', '-1');
  await scan('project detail');

  if (!(await isPad(page))) {
    for (const name of ['Home', 'Profile']) {
      await nav.getByRole('link', { name, exact: true }).click();
      await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page');
      await scan(name.toLowerCase());
    }
  } else {
    await nav.getByRole('button', { name: 'Profile', exact: true }).click();
    await expect(nav.getByRole('button', { name: 'Profile', exact: true })).toHaveAttribute('aria-current', 'page');
    await scan('profile');
  }
});

// --- Responsive ----------------------------------------------------------------------------------------------------------

test('IOS-RESP-02 iphone-landscape: 6 × 3 grid, Dock on the trailing edge, status bar as corner handles', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'iphone-landscape', 'the iphone-landscape project');
  await openIos(page);
  const viewport = page.viewportSize()!;
  expect(viewport.width).toBeGreaterThan(viewport.height);
  await expect(page.locator('[data-ios-layout="phone"][data-landscape]')).toBeAttached();
  expect(await boxOf(page.locator('[data-os-chunk="pf-os-chunk:ios"]'))).toEqual({
    x: 0,
    y: 0,
    w: viewport.width,
    h: viewport.height,
  });

  // Grid 6 × 3.
  const firstPage = page.locator('[data-page="0"]');
  expect(await styleVar(firstPage, '--cols')).toBe('6');
  expect(await styleVar(firstPage, '--rows')).toBe('3');

  // Dock on the trailing edge, laid out vertically.
  const dockNav = page.locator('[data-dock]');
  await expect(dockNav).toHaveAttribute('data-edge', 'trailing');
  const dockBox = await boxOf(dockNav);
  expect(dockBox.x + dockBox.w / 2).toBeGreaterThan(viewport.width * 0.75);
  expect(dockBox.h).toBeGreaterThan(dockBox.w);

  // The status bar is hidden: two top-corner handles keep both entry points.
  const bar = page.getByRole('group', { name: 'Status bar' });
  await expect(bar.locator('[data-status-time]')).toHaveCount(0);
  const center = bar.getByRole('button', { name: 'Notification Center' });
  const control = bar.getByRole('button', { name: 'Control Center' });
  const left = await boxOf(center);
  const right = await boxOf(control);
  expect(left.x + left.w / 2).toBeLessThan(viewport.width / 2);
  expect(right.x + right.w / 2).toBeGreaterThan(viewport.width / 2);
  expect(Math.max(left.y, right.y)).toBeLessThan(40);
  await control.click();
  await expect(page.getByRole('dialog', { name: 'Control Center' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Control Center' })).toHaveCount(0);
  await center.click();
  await expect(page.getByRole('dialog', { name: 'Notification Center' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Notification Center' })).toHaveCount(0);

  // An app opens full-bleed; GitHub's tab bar stays in landscape; the Home indicator is there.
  await dock(page)
    .getByRole('link', { name: /^GitHub/ })
    .click();
  await settle(page);
  await expect(surface(page, 'github')).toHaveAttribute('data-state', 'foreground');
  expect(await boxOf(surface(page, 'github'))).toEqual({ x: 0, y: 0, w: viewport.width, h: viewport.height });
  await expect(surface(page, 'github').getByRole('navigation', { name: 'GitHub' })).toBeVisible();
  await expect(page.locator('[data-home-indicator]')).toBeVisible();
  await page.locator('[data-home-indicator]').click();
  await settle(page);
  await expect(page).toHaveURL(/\/ios$/);
});

test('IOS-RESP-03 ipad-portrait + ipad-landscape: full-page grid from the viewport, widgets block, floating Dock with recents, split view, panels', async ({
  page,
}, info) => {
  test.skip(!TABLET.includes(info.project.name), 'the iPad projects');
  await openIos(page);
  const viewport = page.viewportSize()!;
  await expect(page.locator('[data-ios-layout="pad"]')).toBeAttached();
  expect(await boxOf(page.locator('[data-os-chunk="pf-os-chunk:ios"]'))).toEqual({
    x: 0,
    y: 0,
    w: viewport.width,
    h: viewport.height,
  });
  // Status bar across the full width with time and date.
  expect((await boxOf(page.locator('[data-status-bar]'))).w).toBe(viewport.width);
  await expect(page.locator('[data-status-bar]')).toContainText(/\d{1,2}:\d{2}\s*\w{3} \d{1,2} \w{3}/);

  // Grid derived from the viewport.
  const { cols, icon } = expectedPadGrid(viewport.width, viewport.height);
  const firstPage = page.locator('[data-page="0"]');
  expect(await styleVar(firstPage, '--cols')).toBe(String(cols));
  expect(await styleVar(firstPage, '--icon')).toBe(`${icon}px`);
  const rows = Number(await styleVar(firstPage, '--rows'));
  expect(rows).toBeGreaterThanOrEqual(3);
  expect(await firstPage.locator('ul > li[data-cell]').count()).toBeLessThanOrEqual(cols * rows);
  const art = await boxOf(grid(page).getByRole('link', { name: 'Safari' }).locator('[data-art]'));
  expect(Math.abs(art.w - icon)).toBeLessThanOrEqual(1);

  // The widgets block leads the first page: Résumé on top, the small widgets below.
  const block = firstPage.locator('[data-widgets-block]');
  await expect(block).toBeVisible();
  await expect(block.getByRole('article', { name: 'Résumé' })).toBeVisible();
  await expect(block.locator('[data-widget="open-to-work"]')).toBeVisible();
  const blockBox = await boxOf(block);
  const gridBox = await boxOf(firstPage.locator('ul[role="list"]').first());
  if (viewport.width >= viewport.height) expect(blockBox.x + blockBox.w).toBeLessThanOrEqual(gridBox.x + 1);
  else expect(blockBox.y).toBeLessThan(gridBox.y + gridBox.h);

  // A floating Dock, centred at the bottom; icons at the grid size.
  const dockBox = await boxOf(page.locator('[data-dock]'));
  expect(Math.abs(dockBox.x + dockBox.w / 2 - viewport.width / 2)).toBeLessThanOrEqual(2);
  expect(dockBox.y + dockBox.h).toBeLessThan(viewport.height);
  expect(dockBox.y).toBeGreaterThan(viewport.height * 0.7);

  // Recents: an app outside the pinned four appears after the divider once used, and switches in one press.
  await grid(page).getByRole('link', { name: 'Notes' }).click();
  await settle(page);
  await goHome(page);
  const recent = page.locator('[id="ios-icon-recent:notes"]');
  await expect(recent).toBeVisible();
  await recent.click();
  await settle(page);
  await expect(page).toHaveURL(/\/ios\/notes$/);
  await expect(surface(page, 'notes')).toHaveAttribute('data-state', 'foreground');
  await goHome(page);

  // Apps open to the full page and use their split views.
  await dock(page)
    .getByRole('link', { name: /^GitHub/ })
    .click();
  await settle(page);
  expect(await boxOf(surface(page, 'github'))).toEqual({ x: 0, y: 0, w: viewport.width, h: viewport.height });
  const sidebar = surface(page, 'github').getByRole('navigation', { name: 'GitHub' });
  await expect(sidebar).toBeVisible();
  expect((await boxOf(sidebar)).w).toBeLessThan(viewport.width * 0.6);
  await goHome(page);

  // Control Center is a top-right panel, not a full-screen sheet.
  await page.getByRole('button', { name: 'Control Center' }).click();
  const cc = page.getByRole('dialog', { name: 'Control Center' });
  await expect(cc).toBeVisible();
  await settle(page);
  const panel = await boxOf(cc);
  expect(panel.x + panel.w).toBeGreaterThan(viewport.width - 48);
  expect(panel.w).toBeLessThan(viewport.width * 0.75);
  expect(panel.y).toBeLessThan(viewport.height * 0.2);
  await page.keyboard.press('Escape');
  await expect(cc).toHaveCount(0);
});

test('IOS-RESP-05 mouse-only journey reaches Home, App Switcher, recents and Switch OS with no gestures', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openIos(page);
  // Hover lifts the icon's "⋯"; right-click = long-press (quick actions).
  const safari = grid(page).getByRole('link', { name: 'Safari' });
  await safari.hover();
  await expect(grid(page).getByRole('button', { name: 'Safari actions' })).toBeVisible();
  await safari.click({ button: 'right' });
  const menu = page.getByRole('menu', { name: 'Safari actions' });
  await expect(menu).toBeVisible();
  await page.mouse.click(4, page.viewportSize()!.height / 2);
  await expect(menu).toHaveCount(0);

  // The wheel pages the Home Screen; a dot click pages back.
  const track = page.locator('[data-pager]');
  const trackBox = await boxOf(track);
  await page.mouse.move(trackBox.x + trackBox.w / 2, trackBox.y + trackBox.h / 2);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => track.evaluate((el) => Math.round(el.scrollLeft / el.clientWidth))).toBe(1);
  await page.getByRole('group', { name: 'Pages' }).getByRole('button').first().click();
  await expect.poll(() => track.evaluate((el) => Math.round(el.scrollLeft / el.clientWidth))).toBe(0);

  // Open Notes and go Home with a click on the Home indicator.
  await grid(page).getByRole('link', { name: 'Notes' }).click();
  await settle(page);
  await expect(page).toHaveURL(/\/ios\/notes$/);
  await page.locator('[data-home-indicator]').click();
  await settle(page);
  await expect(page).toHaveURL(/\/ios$/);

  // App Switcher from Control Center's module; a card click returns to the app.
  await page.getByRole('button', { name: 'Control Center' }).click();
  await page.getByRole('dialog', { name: 'Control Center' }).getByRole('button', { name: 'App Switcher' }).click();
  const switcher = page.getByRole('dialog', { name: 'App Switcher' });
  await expect(switcher).toBeVisible();
  await switcher.getByRole('button', { name: 'Notes', exact: true }).click();
  await settle(page);
  await expect(page).toHaveURL(/\/ios\/notes$/);
  await page.locator('[data-home-indicator]').click();
  await settle(page);

  // The Dock's recents switch in one click.
  const recent = page.locator('[id="ios-icon-recent:notes"]');
  await expect(recent).toBeVisible();
  await recent.click();
  await settle(page);
  await expect(page).toHaveURL(/\/ios\/notes$/);
  await page.locator('[data-home-indicator]').click();
  await settle(page);

  // Switch OS from Control Center.
  await page.getByRole('button', { name: 'Control Center' }).click();
  await page
    .getByRole('dialog', { name: 'Control Center' })
    .getByRole('button', { name: /Switch OS/ })
    .click();
  const sheet = page.getByRole('dialog', { name: 'Switch Operating System' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Back to chooser' }).click();
  await expect(page).toHaveURL(/\/$/);
});

// --- Keyboard-safe sheets and search (visualViewport shim) -------------------------------------------------------------

/**
 * The L3-style shim: `window.visualViewport` is replaced by a controllable stand-in whose height is the layout height
 * less a simulated on-screen keyboard (`__keyboard(px)`), firing `resize` like the real one.
 */
async function installKeyboardShim(page: Page) {
  await page.addInitScript(() => {
    const target = new EventTarget();
    let keyboard = 0;
    Object.defineProperties(target, {
      width: { get: () => window.innerWidth },
      height: { get: () => window.innerHeight - keyboard },
      offsetTop: { get: () => 0 },
      offsetLeft: { get: () => 0 },
      pageTop: { get: () => window.scrollY },
      pageLeft: { get: () => window.scrollX },
      scale: { get: () => 1 },
    });
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => target });
    window.addEventListener('resize', () => target.dispatchEvent(new Event('resize')));
    (window as unknown as { __keyboard: (px: number) => void }).__keyboard = (px: number) => {
      keyboard = px;
      target.dispatchEvent(new Event('resize'));
    };
  });
}

/** Raise the simulated keyboard and wait for the shell to write the new `--vvh`. Returns the visible height. */
async function raiseKeyboard(page: Page, fraction = 0.4): Promise<number> {
  const visible = await page.evaluate((share) => {
    const px = Math.round(window.innerHeight * share);
    (window as unknown as { __keyboard: (px: number) => void }).__keyboard(px);
    return window.innerHeight - px;
  }, fraction);
  await expect.poll(() => styleVar(page.locator('[data-os-chunk="pf-os-chunk:ios"]'), '--vvh')).toBe(`${visible}px`);
  await settle(page);
  return visible;
}

async function expectAboveKeyboard(locator: Locator, visible: number, label: string) {
  const box = await boxOf(locator);
  expect(box.y, `${label} top`).toBeGreaterThanOrEqual(0);
  expect(box.y + box.h, `${label} bottom (visible height ${visible})`).toBeLessThanOrEqual(visible + 1);
}

test('IOS-RESP-07 L3-style visualViewport shim on Mail compose + Spotlight: primary actions stay above the keyboard', async ({
  page,
}) => {
  await installKeyboardShim(page);
  const sheet = await openCompose(page);
  const body = sheet.getByRole('textbox').last();
  await body.focus();
  // Every input is ≥ 16 px (no iOS focus zoom).
  const sizes = await sheet
    .locator('input, textarea')
    .evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)));
  expect(sizes.length).toBeGreaterThan(0);
  for (const size of sizes) expect(size).toBeGreaterThanOrEqual(16);

  const visible = await raiseKeyboard(page);
  await expectAboveKeyboard(sheet.getByRole('button', { name: 'Cancel' }), visible, 'Cancel');
  await expectAboveKeyboard(sheet.getByRole('button', { name: 'Send' }), visible, 'Send');
  expect((await boxOf(sheet)).h).toBeLessThanOrEqual(visible);
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(sheet).toHaveCount(0);

  // Spotlight: the field and its first results sit above the keyboard.
  await goHome(page);
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Search' });
  const field = dialog.getByRole('combobox', { name: 'Search' });
  await expect(field).toBeFocused();
  await page.keyboard.type('resume');
  await expect(dialog.getByRole('option').first()).toBeVisible();
  await settle(page);
  await expectAboveKeyboard(field, visible, 'Search field');
  await expectAboveKeyboard(dialog.getByRole('option').first(), visible, 'first result');
  await page.keyboard.press('Escape'); // clears the query
  await page.keyboard.press('Escape'); // closes
  await expect(dialog).toHaveCount(0);
});

// --- Gesture alternatives ------------------------------------------------------------------------------------------------

test('IOS-A11Y-04 alternatives checklist script: every gesture has a working non-gesture alternative', async ({
  page,
}) => {
  test.slow(); // one script walks the whole inventory of alternatives
  await openIos(page);
  const home = page.locator('[data-home-indicator]');

  // 1 · Swipe pages → the page-dot buttons (the pill turns into the dots while they have focus).
  const track = page.locator('[data-pager]');
  const dots = page.getByRole('group', { name: 'Pages' }).getByRole('button');
  await dots.nth(1).focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => track.evaluate((el) => Math.round(el.scrollLeft / el.clientWidth))).toBe(1);
  await dots.first().focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => track.evaluate((el) => Math.round(el.scrollLeft / el.clientWidth))).toBe(0);

  // 2 · The Home gesture → the Home button (a tap), Alt+Shift+H, Esc at an app's root.
  const openNotes = async () => {
    await grid(page).getByRole('link', { name: 'Notes' }).click();
    await settle(page);
    await expect(page).toHaveURL(/\/ios\/notes$/);
  };
  await openNotes();
  await home.click();
  await settle(page);
  await expect(page).toHaveURL(/\/ios$/);
  await openNotes();
  await page.keyboard.press('Alt+Shift+H');
  await settle(page);
  await expect(page).toHaveURL(/\/ios$/);
  await openNotes();
  await page.keyboard.press('Escape');
  await settle(page);
  await expect(page).toHaveURL(/\/ios$/);
  await expectFocusNotOnBody(page);

  // 3 · Swipe-and-pause for the App Switcher → long-press the Home button, Alt+Shift+O (+ Control Center on the full page).
  const switcher = page.getByRole('dialog', { name: 'App Switcher' });
  await openNotes();
  const indicator = await boxOf(home);
  await page.mouse.move(indicator.x + indicator.w / 2, indicator.y + indicator.h / 2);
  await page.mouse.down();
  await expect(switcher).toBeVisible();
  await page.mouse.up();
  await page.keyboard.press('Escape');
  await expect(switcher).toHaveCount(0);
  await settle(page);
  await page.keyboard.press('Alt+Shift+O');
  await expect(switcher).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(switcher).toHaveCount(0);
  await settle(page);
  if (await isPad(page)) {
    await page.getByRole('button', { name: 'Control Center' }).click();
    await page.getByRole('dialog', { name: 'Control Center' }).getByRole('button', { name: 'App Switcher' }).click();
    await expect(switcher).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(switcher).toHaveCount(0);
    await settle(page);
  }
  if (!/\/ios$/.test(page.url())) await goHome(page);

  // 4 · Edge-swipe back → the back button named after the previous screen, and Esc (back one level).
  await openIos(page, '/ios/github');
  const gh = surface(page, 'github');
  const pushProject = async () => {
    await gh.locator('a[data-push-key^="project:"]:visible').first().click();
    await expect(page).toHaveURL(/\/ios\/github\/[a-z0-9-]+$/);
    await settle(page);
  };
  await pushProject();
  await gh.getByRole('button', { name: 'Back to Repositories' }).click();
  await expect(page).toHaveURL(/\/ios\/github$/);
  await settle(page);
  await pushProject();
  await page.keyboard.press('Escape');
  await expect(page, 'Esc pops the pushed project (back one level), it does not go Home').toHaveURL(/\/ios\/github$/);
  await settle(page);
  await goHome(page);

  // 5 · Drag a sheet down → Cancel (and Esc = Cancel).
  const sheet = await openCompose(page);
  await sheet.getByRole('button', { name: 'Cancel' }).click();
  await expect(sheet).toHaveCount(0);
  await surface(page, 'mail')
    .getByRole('button', { name: /Compose|New Message/ })
    .first()
    .click();
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Cancel' })).toBeFocused(); // the sheet owns the keys
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await goHome(page);

  // 6 · Pull down for Spotlight → the Search pill and Ctrl+K.
  const search = page.getByRole('dialog', { name: 'Search' });
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(search).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(search).toHaveCount(0);
  await page.keyboard.press('Control+k');
  await expect(search).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(search).toHaveCount(0);

  // 7 · Pull down Notification / Control Center → the status-bar buttons.
  for (const name of ['Notification Center', 'Control Center']) {
    await page.getByRole('group', { name: 'Status bar' }).getByRole('button', { name }).click();
    await expect(page.getByRole('dialog', { name })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name })).toHaveCount(0);
    await settle(page);
  }

  // 8 · Long-press for quick actions → the visible "⋯" and Shift+F10 on the focused icon.
  const safari = grid(page).getByRole('link', { name: 'Safari' });
  const menu = page.getByRole('menu', { name: 'Safari actions' });
  await safari.focus();
  await page.keyboard.press('Shift+F10');
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(safari).toBeFocused();
  await safari.focus();
  await grid(page).getByRole('button', { name: 'Safari actions' }).click();
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expectFocusNotOnBody(page);
});

// --- Edge cases, part C ----------------------------------------------------------------------------------------------------

test('IOS-CASE-04 E15 part C: five apps in sequence — three stay warm; the evicted oldest restores its scroll position', async ({
  page,
}) => {
  await openIos(page, '/ios/safari');
  // The page's own scroller: the most scrollable one (the full page also has a sidebar).
  const scrollers = surface(page, 'browser').locator('[data-scroller]');
  const longest = await scrollers.evaluateAll((els) =>
    els.reduce(
      (best, el, index, all) =>
        el.scrollHeight - el.clientHeight > all[best]!.scrollHeight - all[best]!.clientHeight ? index : best,
      0,
    ),
  );
  const scroller = scrollers.nth(longest);
  await scroller.evaluate((el) => el.scrollTo({ top: 600 }));
  // (600 px, or as far as the page goes — the portrait iPad shows nearly all of it.)
  await expect
    .poll(() =>
      scroller.evaluate((el) => Math.round(el.scrollTop) >= Math.min(600, el.scrollHeight - el.clientHeight - 1)),
    )
    .toBe(true);
  expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(10);
  const kept = await scroller.evaluate((el) => Math.round(el.scrollTop));
  await committed(page);
  await page.waitForTimeout(400); // the scroll write is debounced into the session
  await goHome(page);
  for (const name of ['Notes', 'Messages', 'Settings']) {
    await grid(page).getByRole('link', { name }).click();
    await settle(page);
    await goHome(page);
  }
  await dock(page)
    .getByRole('link', { name: /^GitHub/ })
    .click();
  await settle(page);
  await goHome(page);
  // LRU(3): GitHub, Settings, Messages warm; Notes and Safari evicted.
  await expect(page.locator('[data-app-surface]')).toHaveCount(3);
  await expect(page.locator('[data-app-surface="browser"]')).toHaveCount(0);
  await expect(page.locator('[data-app-surface="notes"]')).toHaveCount(0);
  await grid(page).getByRole('link', { name: 'Safari' }).click();
  await settle(page);
  await expect(surface(page, 'browser')).toHaveAttribute('data-state', 'foreground');
  await expect
    .poll(() =>
      surface(page, 'browser')
        .locator('[data-scroller]')
        .nth(longest)
        .evaluate((el) => Math.round(el.scrollTop)),
    )
    .toBeGreaterThanOrEqual(kept - 2);
});

test('IOS-CASE-04 E18 part C: an app chunk that cannot load shows "Couldn\'t open GitHub" with Retry and Home', async ({
  page,
}) => {
  let failing = true;
  let aborted = 0;
  await page.route(/\/_next\/static\/chunks\/.+\.js(\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    // The iOS GitHub app's own chunk (its heatmap label is unique to it).
    if (failing && body.includes('Contribution calendar, scrolls sideways')) {
      aborted++;
      await route.abort('internetdisconnected');
      return;
    }
    await route.fulfill({ response, body });
  });
  await openIos(page);
  await dock(page)
    .getByRole('link', { name: /^GitHub/ })
    .click();
  await settle(page);
  const gh = surface(page, 'github');
  // The flight still completes; the placeholder carries the failure.
  await expect(gh).toHaveAttribute('data-state', 'foreground');
  const alert = gh.getByRole('alert');
  await expect(alert).toContainText('Couldn’t open GitHub');
  expect(aborted).toBeGreaterThan(0);
  await expect(alert.getByRole('button', { name: 'Home' })).toBeVisible();
  await expect(alert.getByRole('button', { name: 'Retry' })).toBeVisible();

  // Home leaves it.
  await alert.getByRole('button', { name: 'Home' }).click();
  await settle(page);
  await expect(page).toHaveURL(/\/ios$/);
  await expectFocusNotOnBody(page);

  // Back online: Retry loads the app.
  failing = false;
  await dock(page)
    .getByRole('link', { name: /^GitHub/ })
    .click();
  await settle(page);
  const retry = gh.getByRole('alert').getByRole('button', { name: 'Retry' });
  if (await retry.count()) await retry.click();
  await expect(gh.getByRole('alert')).toHaveCount(0);
  await expect(gh.locator('a[data-push-key^="project:"]').first()).toBeVisible();
});

test('IOS-CASE-04 E19 part C: keyboard up, then rotate — --vvh re-measured; Send and Cancel stay visible', async ({
  page,
}) => {
  await installKeyboardShim(page);
  const sheet = await openCompose(page);
  await sheet.getByRole('textbox').last().focus();
  const before = await raiseKeyboard(page);
  await expectAboveKeyboard(sheet.getByRole('button', { name: 'Send' }), before, 'Send');
  const { width, height } = page.viewportSize()!;
  await page.setViewportSize({ width: height, height: width });
  await settle(page);
  // The rotated keyboard takes the same share of the new height.
  const after = await raiseKeyboard(page);
  expect(after).not.toBe(before);
  await expect(page.getByRole('dialog', { name: 'New Message' })).toBeVisible();
  const rotated = page.getByRole('dialog', { name: 'New Message' });
  await expectAboveKeyboard(rotated.getByRole('button', { name: 'Cancel' }), after, 'Cancel');
  await expectAboveKeyboard(rotated.getByRole('button', { name: 'Send' }), after, 'Send');
});

test('IOS-CASE-04 E20 part C: resizing the desktop browser re-derives icon size, columns and rows live, then swaps to the phone layout', async ({
  page,
}, info) => {
  desktopOnly(info);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openIos(page, '/ios/github/portfolio-os');
  await page.keyboard.press('Alt+Shift+H');
  await settle(page);
  const firstPage = page.locator('[data-page="0"]');
  const read = async () => ({
    cols: Number(await styleVar(firstPage, '--cols')),
    rows: Number(await styleVar(firstPage, '--rows')),
    icon: await styleVar(firstPage, '--icon'),
    cells: await firstPage.locator('ul > li[data-cell]').count(),
  });
  const large = await read();
  expect(large.cols).toBe(expectedPadGrid(1920, 1080).cols);
  expect(large.icon).toBe(`${expectedPadGrid(1920, 1080).icon}px`);
  const before = await page.evaluate(() => performance.getEntriesByType('navigation').length);

  await page.setViewportSize({ width: 1366, height: 650 });
  await expect.poll(async () => (await read()).cols).toBe(expectedPadGrid(1366, 650).cols);
  const small = await read();
  expect(small.icon).toBe(`${expectedPadGrid(1366, 650).icon}px`);
  expect(small.rows).toBeLessThanOrEqual(large.rows);
  expect(small.cells).toBeLessThanOrEqual(small.cols * small.rows);
  // Overflow moves to page 2 deterministically: every Home app still has a place.
  for (const name of ['Safari', 'Notes', 'Messages', 'Settings'])
    await expect(grid(page).getByRole('link', { name })).toBeAttached();

  // Below phone width: the phone layout, the foreground app and its stack preserved (no reload).
  await dock(page)
    .getByRole('link', { name: /^GitHub/ })
    .click();
  await settle(page);
  await surface(page, 'github').locator('a[data-push-key^="project:"]:visible').first().click();
  await expect(page).toHaveURL(/\/ios\/github\/[a-z0-9-]+$/);
  const url = page.url();
  await page.setViewportSize({ width: 600, height: 650 });
  await expect(page.locator('[data-ios-layout="phone"]')).toBeAttached();
  expect(page.url()).toBe(url);
  await expect(surface(page, 'github')).toHaveAttribute('data-state', 'foreground');
  await expect(surface(page, 'github').getByRole('button', { name: 'Back to Repositories' })).toBeVisible();
  expect(await page.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(before);
});

test('IOS-CASE-04 E21 part C: a long press that moves more than 10 pt (paging) is cancelled', async ({ page }) => {
  await openIos(page);
  const icon = grid(page).getByRole('link', { name: 'Safari' });
  const art = await boxOf(icon.locator('[data-art]'));
  const x = art.x + art.w / 2;
  const y = art.y + art.h / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 40, y, { steps: 4 });
  await page.waitForTimeout(900); // well past the long-press delay: nothing may fire
  await expect(page.getByRole('menu', { name: 'Safari actions' })).toHaveCount(0);
  await page.mouse.up();
  await settle(page);
  await expect(page.getByRole('menu', { name: 'Safari actions' })).toHaveCount(0);
  await expect(page.locator('[data-app-surface="browser"]')).toHaveCount(0);
  await expect(page).toHaveURL(/\/ios$/);
  // A still press of the same length does open the menu (the test is not vacuous).
  await page.mouse.move(x, y);
  await page.mouse.down();
  await expect(page.getByRole('menu', { name: 'Safari actions' })).toBeVisible();
  await page.mouse.up();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu', { name: 'Safari actions' })).toHaveCount(0);
});

test('IOS-CASE-04 E22 part C: storage disabled — iOS runs session-only; a hidden tab mid-flight snaps to the end state', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
  });
  await openIos(page);
  await expect(grid(page).getByRole('link', { name: 'Safari' })).toBeVisible();
  // Preferences still apply for the session.
  await page.getByRole('button', { name: 'Control Center' }).click();
  await page.getByRole('dialog', { name: 'Control Center' }).getByRole('button', { name: 'Reduce Motion' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Control Center' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Control Center' }).click();
  await page.getByRole('dialog', { name: 'Control Center' }).getByRole('button', { name: 'Reduce Motion' }).click();
  await page.keyboard.press('Escape');
  await settle(page);
  // Apps open and close.
  await grid(page).getByRole('link', { name: 'Notes' }).click();
  await settle(page);
  await expect(surface(page, 'notes')).toHaveAttribute('data-state', 'foreground');
  await goHome(page);

  // A tab hidden mid-flight: the flight still ends in the kernel's state.
  await page.evaluate(() => {
    (document.getElementById('ios-icon-app:settings') as HTMLAnchorElement).click();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.evaluate(() => {
    delete (document as unknown as { visibilityState?: string }).visibilityState;
    delete (document as unknown as { hidden?: boolean }).hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await settle(page);
  await expect(page).toHaveURL(/\/ios\/settings$/);
  await expect(surface(page, 'settings')).toHaveAttribute('data-state', 'foreground');
  await goHome(page);
  expect(errors, 'no uncaught errors without storage').toEqual([]);
});
