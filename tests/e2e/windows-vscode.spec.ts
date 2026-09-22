/**
 * Visual Studio Code on Windows 11 — the e2e acceptance tests named in plans/windows/apps/vscode.md:
 *   WIN-CODE-01 N2  the menu bar lives inside the window's title bar; caption buttons on the right (also once snapped)
 *   WIN-CODE-03 S1  from VS Code: the command centre opens Windows Search scoped to files; a result opens through the
 *                   kernel with exactly one history entry; "Skills" brings skills.json forward
 *   WIN-CODE-06 N3  phones: ☰ menu, bottom activity bar, Explorer first, files push in, Back
 * Same conventions as windows.spec.ts: every step waits on an end state (never a sleep) and focus never rests on <body>.
 */
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { committed, expectFocusNotOnBody, waitForOs } from './helpers';

type Box = { x: number; y: number; w: number; h: number };

const DESKTOP = ['chromium-desktop', 'reduced-motion', 'asset-original', 'firefox-desktop'];
const COMPACT = ['iphone', 'pixel', 'iphone-landscape'];
const desktopOnly = (info: TestInfo) =>
  test.skip(!DESKTOP.includes(info.project.name), 'fine-pointer desktop posture (expanded / large)');
const compactOnly = (info: TestInfo) => test.skip(!COMPACT.includes(info.project.name), 'compact posture (phones)');

const taskbar = (page: Page) => page.getByRole('navigation', { name: 'Taskbar' });
const tbApp = (page: Page, name: string) => taskbar(page).getByRole('link', { name: new RegExp(`^${name}(, .*)?$`) });
const code = (page: Page) => page.locator('[data-window="windows:editor"]');
const titlebar = (page: Page) => code(page).locator('header[data-drag-region]');
const tree = (page: Page) => code(page).getByRole('tree', { name: 'Files Explorer' });
const row = (page: Page, name: string) => tree(page).getByRole('treeitem', { name, exact: true });
const tab = (page: Page, name: string) => code(page).getByRole('tab', { name, exact: true });
const boxOf = (locator: Locator): Promise<Box> =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h;

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

/** VS Code's lazy chunk has rendered its body (the title bar shows at once over a skeleton). */
async function editorReady(page: Page) {
  await expect(code(page).locator('[data-editor]')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('pf.debug.probe', '1');
    window.sessionStorage.setItem('pf.debug.analytics', '1');
  });
});

test('WIN-CODE-01 N2 menubar inside the window; caption buttons right — also snapped, where the menus collapse into ☰', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page);
  await tbApp(page, 'Visual Studio Code').click();
  await settle(page);
  await expect(page).toHaveURL(/\/windows\/vscode$/);
  await editorReady(page);
  const frame = await boxOf(code(page));
  const bar = titlebar(page);
  const barBox = await boxOf(bar);
  expect(inside(barBox, frame)).toBe(true);

  // The in-window menu bar (there is no global menu bar on Windows) sits inside the title bar, left of the command
  // centre; the caption buttons end the title bar at the window's right edge.
  const menubar = bar.getByRole('menubar', { name: 'Application Menu' });
  await expect(menubar.getByRole('menuitem')).toHaveText([
    'File',
    'Edit',
    'Selection',
    'View',
    'Go',
    'Run',
    'Terminal',
    'Help',
  ]);
  expect(await page.getByRole('menubar').count()).toBe(1);
  const menubarBox = await boxOf(menubar);
  expect(inside(menubarBox, barBox)).toBe(true);
  const centre = bar.getByRole('button', { name: /^Search files in jaswanth-portfolio/ });
  const centreBox = await boxOf(centre);
  expect(menubarBox.x + menubarBox.w).toBeLessThanOrEqual(centreBox.x);
  const captions = bar.getByRole('group', { name: 'Window controls' });
  await expect(captions.getByRole('button').first()).toHaveAccessibleName('Minimize Visual Studio Code');
  await expect(captions.getByRole('button').last()).toHaveAccessibleName('Close Visual Studio Code');
  const captionsBox = await boxOf(captions);
  expect(centreBox.x + centreBox.w).toBeLessThanOrEqual(captionsBox.x);
  expect(Math.abs(captionsBox.x + captionsBox.w - (frame.x + frame.w))).toBeLessThanOrEqual(1);

  // A menu opens inside the window, under its title, and acts on this window (View › Search).
  await menubar.getByRole('menuitem', { name: 'View' }).click();
  const view = page.getByRole('menu', { name: 'View' });
  await expect(view).toBeVisible();
  expect(inside(await boxOf(view), frame)).toBe(true);
  await view.getByRole('menuitem', { name: 'Search', exact: true }).click();
  await expect(code(page).getByRole('searchbox', { name: 'Search skills and projects' })).toBeFocused();

  // Snapped to the left half (720 px < the menu bar's width): the menus collapse into ☰; captions stay on the right.
  await code(page).focus();
  await page.keyboard.press('Alt+Shift+ArrowLeft');
  await settle(page);
  await expect(code(page)).toHaveAttribute('data-snap', 'left');
  await expect(bar.getByRole('menubar')).toHaveCount(0);
  const hamburger = bar.getByRole('button', { name: 'Application Menu' });
  await expect(hamburger).toBeVisible();
  const snapped = await boxOf(code(page));
  const snappedCaptions = await boxOf(captions);
  expect(Math.abs(snappedCaptions.x + snappedCaptions.w - (snapped.x + snapped.w))).toBeLessThanOrEqual(1);
  expect((await boxOf(hamburger)).x).toBeLessThan(snappedCaptions.x);
  // A quarter snap collapses the side bar (plans/windows/apps/vscode.md "Edge cases").
  await page.keyboard.press('Alt+Shift+ArrowUp');
  await settle(page);
  await expect(code(page)).toHaveAttribute('data-snap', 'tl');
  await expect(bar.getByRole('button', { name: 'Primary Side Bar' })).toHaveAttribute('aria-pressed', 'false');
  await expectFocusNotOnBody(page);
});

test('WIN-CODE-03 S1 from VS Code on Windows: the command centre opens Search scoped to files; a result opens with one history entry', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page, '/windows/vscode');
  await editorReady(page);
  // The editor's section is the skills: it opens on skills.json.
  await expect(tab(page, 'skills.json')).toHaveAttribute('aria-selected', 'true');
  await row(page, 'stack.ts').click();
  await expect(tab(page, 'stack.ts')).toHaveAttribute('aria-selected', 'true');

  // The command centre → Windows Search (one search system), scoped to files: skills and projects only.
  const centre = titlebar(page).getByRole('button', { name: /^Search files in jaswanth-portfolio/ });
  await centre.click();
  const search = page.getByRole('dialog', { name: 'Search' });
  await expect(search).toBeVisible();
  const field = search.getByRole('combobox', { name: 'Search' });
  await expect(field).toBeFocused();
  await field.fill('sso');
  await expect(search.getByRole('option', { name: /Enterprise SSO Identity Provider/ }).first()).toBeVisible();
  await field.fill('settings');
  await expect(search.getByRole('option')).toHaveCount(0); // an app — outside the files scope
  await field.fill('résumé');
  await expect(search.getByRole('option')).toHaveCount(0); // a document outside skills / projects

  // "Skills" while VS Code is in front: the same window, skills.json brought forward.
  await field.fill('skills');
  await expect(search.getByRole('option', { name: /Skills/ }).first()).toBeVisible();
  await search
    .getByRole('option', { name: /Skills/ })
    .first()
    .click();
  await expect(search).toHaveCount(0);
  await expect(page).toHaveURL(/\/windows\/vscode$/);
  await expect(tab(page, 'skills.json')).toHaveAttribute('aria-selected', 'true');
  await expectFocusNotOnBody(page);

  // Ctrl+K inside the window is the same flyout, scoped the same way; a project result opens through the kernel in its
  // app (GitHub owns projects: /windows/github/{slug}) with exactly one history entry.
  await code(page).getByRole('tabpanel').focus();
  await page.keyboard.press('Control+k');
  await expect(search).toBeVisible();
  await page.keyboard.type('Enterprise SSO');
  await expect(search.getByRole('option').first()).toBeVisible();
  await expect(search.getByRole('option', { name: /Visual Studio Code/ })).toHaveCount(0);
  const before = await page.evaluate(() => history.length);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/windows\/github\/enterprise-sso$/);
  await committed(page);
  expect(await page.evaluate(() => history.length)).toBe(before + 1);
  await expect(code(page)).toBeAttached(); // VS Code stays open behind
  await expectFocusNotOnBody(page);
});

test('WIN-CODE-06 N3 compact: ☰ menu, bottom activity bar, Explorer first, files push in; Back leaves', async ({
  page,
}, info) => {
  compactOnly(info);
  await openWindows(page);
  await taskbar(page).getByRole('button', { name: 'Start' }).click();
  const sheet = page.getByRole('dialog', { name: 'Start' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('link', { name: 'Visual Studio Code' }).click();
  await expect(page).toHaveURL(/\/windows\/vscode$/);
  await settle(page);
  await editorReady(page);

  // One maximized window; min + close at ≥ 48 × 44; the menus are a ☰ button (≥ 44 px), no menu bar.
  const viewport = page.viewportSize()!;
  const frame = await boxOf(code(page));
  expect(frame.x).toBe(0);
  expect(frame.w).toBe(viewport.width);
  const captions = titlebar(page).getByRole('group', { name: 'Window controls' }).getByRole('button');
  await expect(captions).toHaveCount(2);
  for (const button of await captions.all()) {
    const size = await boxOf(button);
    expect(size.w).toBeGreaterThanOrEqual(48);
    expect(size.h).toBeGreaterThanOrEqual(44);
  }
  await expect(page.getByRole('menubar')).toHaveCount(0);
  const hamburger = titlebar(page).getByRole('button', { name: 'Application Menu' });
  const hamburgerBox = await boxOf(hamburger);
  expect(hamburgerBox.w).toBeGreaterThanOrEqual(44);
  expect(hamburgerBox.h).toBeGreaterThanOrEqual(44);
  await expect(titlebar(page).getByRole('group', { name: 'Layout controls' })).toHaveCount(0);

  // The activity bar is a bottom bar; the Explorer is the first screen (44 px rows).
  const activity = code(page).getByRole('toolbar', { name: 'Activity Bar' });
  await expect(activity).toHaveAttribute('aria-orientation', 'horizontal');
  const activityBox = await boxOf(activity);
  expect(Math.abs(activityBox.y + activityBox.h - (frame.y + frame.h))).toBeLessThanOrEqual(1);
  expect(activityBox.w).toBe(frame.w);
  await expect(tree(page)).toBeVisible();
  expect((await boxOf(row(page, 'stack.ts'))).h).toBeGreaterThanOrEqual(44);
  expect((await boxOf(tree(page))).y + 44).toBeLessThanOrEqual(activityBox.y);
  await expect(code(page).getByRole('tabpanel')).toBeHidden();
  await expect(code(page).locator('[data-minimap]')).toHaveCount(0);

  // A folder drills in; a file pushes the editor in and takes focus; Back to Explorer returns to its row.
  await row(page, 'projects').click();
  await expect(code(page).getByRole('button', { name: 'projects', exact: true })).toBeVisible();
  await code(page).getByRole('button', { name: 'projects', exact: true }).click();
  await row(page, 'stack.ts').click();
  const panel = code(page).getByRole('tabpanel', { name: 'stack.ts' });
  await expect(panel).toBeVisible();
  await expect(panel).toBeFocused();
  await expect(tree(page)).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await code(page).getByRole('button', { name: 'Back to Explorer' }).click();
  await expect(row(page, 'stack.ts')).toBeFocused();

  // ☰ opens the menus as submenus.
  await hamburger.click();
  const menu = page.getByRole('menu', { name: 'Application Menu' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveText([
    'File',
    'Edit',
    'Selection',
    'View',
    'Go',
    'Run',
    'Terminal',
    'Help',
  ]);
  await menu.getByRole('menuitem', { name: 'Go' }).click();
  await page.getByRole('menu', { name: 'Go' }).getByRole('menuitem', { name: 'experience.log' }).click();
  await expect(menu).toHaveCount(0);
  await expect(code(page).getByRole('tabpanel', { name: 'experience.log' })).toBeVisible();

  // Browser Back leaves the app for the desktop, as N3 expects.
  await page.goBack();
  await expect(page).toHaveURL(/\/windows$/);
  await expectFocusNotOnBody(page);
});
