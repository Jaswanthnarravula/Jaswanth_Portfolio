/**
 * macOS — P3 journeys, part 2: eggs and their counter (MAC-X-04 · EGG-COUNT-01), Switch OS entry points + parking
 * (MAC-X-05), Preview's print stylesheet (MAC-PREV-06), Safari's scroll effects gate and lifecycle (MAC-SAF-03/06 ·
 * MOTION-SCROLL-01), size-class transitions (MAC-RESP-06) and 400 % zoom (MAC-RESP-07 · RESP-ZOOM-01).
 */
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { committed, expectFocusNotOnBody, waitForOs } from './helpers';

const DESKTOP = ['chromium-desktop', 'reduced-motion', 'asset-original', 'firefox-desktop'];
const desktopOnly = (info: TestInfo) =>
  test.skip(!DESKTOP.includes(info.project.name), 'fine-pointer desktop posture (expanded / large)');
const win = (page: Page, role: string) => page.locator(`[data-window="macos:${role}"]`);
const dock = (page: Page) => page.getByRole('navigation', { name: 'Dock' });
const dockApp = (page: Page, name: string) =>
  dock(page).getByRole('link', { name: new RegExp(`^${name}(, (open|minimized|running))?$`) });

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

test('MAC-X-04 · EGG-COUNT-01 terminal eggs and About This Mac count once each in Settings → General', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page, '/macos/terminal');
  const terminal = win(page, 'terminal');
  await expect(terminal.locator('[data-terminal]')).toHaveAttribute('data-ready');
  const prompt = terminal.getByRole('textbox', { name: /^Command, current directory/ });
  await prompt.fill('sudo hire-me');
  await prompt.press('Enter');
  await prompt.fill('sudo hire-me'); // a second time: still one egg
  await prompt.press('Enter');
  await page.getByRole('menubar', { name: 'Menu bar' }).getByRole('menuitem', { name: 'Apple' }).click();
  await page.getByRole('menuitem', { name: 'About This Mac' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('menubar', { name: 'Menu bar' }).getByRole('menuitem', { name: 'Apple' }).click();
  await page.getByRole('menuitem', { name: 'System Settings…' }).click();
  await win(page, 'settings').getByRole('button', { name: 'General' }).click();
  await expect(win(page, 'settings').getByText(/^2 \/ \d+$/)).toBeVisible();
});

test('MAC-X-05 Alt+Shift+S opens the Switch OS sheet; switching parks the session; coming back restores it', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page);
  await dockApp(page, 'Finder').click();
  await settle(page);
  await page.keyboard.press('Alt+Shift+S');
  const sheet = page.getByRole('dialog', { name: 'Switch Operating System' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Back to chooser' })).toBeVisible();
  await sheet.getByRole('button', { name: /^Switch to Windows/ }).click();
  await expect(page).toHaveURL(/\/windows$/);
  await waitForOs(page, 'windows');
  await page.goBack();
  await waitForOs(page, 'macos');
  await expect(win(page, 'files')).toBeAttached(); // parked, not destroyed
  await expectFocusNotOnBody(page);
});

test('MAC-PREV-06 printing Preview prints only the résumé', async ({ page }, info) => {
  desktopOnly(info);
  await openMacos(page, '/macos/preview');
  await page.emulateMedia({ media: 'print' });
  const visible = await page.evaluate(() => {
    const resume = document.querySelector('[data-print-resume]')!;
    const dock = document.querySelector('[data-dock]')!;
    const menubar = document.querySelector('header[data-menubar]')!;
    return {
      resume: getComputedStyle(resume).visibility,
      dock: getComputedStyle(dock).visibility,
      menubar: getComputedStyle(menubar).visibility,
    };
  });
  expect(visible).toEqual({ resume: 'visible', dock: 'hidden', menubar: 'hidden' });
});

test('MAC-SAF-03/06 · MOTION-SCROLL-01 smooth scroll runs on the Overview scroller only where allowed, and is torn down on close', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openMacos(page, '/macos/safari');
  const safari = win(page, 'browser');
  const allowed = await page.evaluate(
    () =>
      document.documentElement.dataset.motion !== 'reduced' &&
      document.documentElement.dataset.tier !== '0' &&
      matchMedia('(pointer: fine) and (hover: hover)').matches,
  );
  if (allowed) await expect(safari.locator('[role="tabpanel"].lenis')).toHaveCount(1);
  else await expect(page.locator('.lenis')).toHaveCount(0);
  // Never on the page itself.
  await expect(page.locator('html.lenis, body.lenis')).toHaveCount(0);
  await safari.getByRole('button', { name: 'Close Safari' }).click();
  await settle(page);
  await expect(page.locator('.lenis')).toHaveCount(0);
});

test('MAC-RESP-06 crossing into compact maximizes without a storm; crossing back restores the floating rect', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'chromium-desktop', 'one resize comparison');
  await openMacos(page);
  await dockApp(page, 'Finder').click();
  await settle(page);
  const floating = await win(page, 'files').boundingBox();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-mac-posture="compact"]')).toBeAttached();
  const compact = (await win(page, 'files').boundingBox())!;
  expect(Math.round(compact.width)).toBe(390);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('[data-mac-posture="pointer"]')).toBeAttached();
  await settle(page);
  expect(await win(page, 'files').boundingBox()).toEqual(floating);
});

test('MAC-RESP-07 · RESP-ZOOM-01 400 % zoom (a 360 × 225 CSS viewport) engages compact mode', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'chromium-desktop', 'one zoom emulation');
  await page.setViewportSize({ width: 360, height: 225 });
  await openMacos(page);
  await expect(page.locator('[data-mac-posture="compact"]')).toBeAttached();
  await expect(page.getByRole('menubar', { name: 'Menu bar' })).toBeVisible();
});

test('MAC-WM-12 Hide Others and Show All act at once, without an animation storm', async ({ page }, info) => {
  desktopOnly(info);
  await openMacos(page);
  await dockApp(page, 'Finder').click();
  await dockApp(page, 'GitHub').click();
  await dockApp(page, 'Mail').click();
  await settle(page);
  const bar = page.getByRole('menubar', { name: 'Menu bar' });
  await bar.getByRole('menuitem', { name: 'Mail', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Hide Others' }).click();
  await expect(win(page, 'files')).toHaveAttribute('data-phase', 'minimized');
  await expect(win(page, 'github')).toHaveAttribute('data-phase', 'minimized');
  await expect(win(page, 'mail')).toHaveAttribute('data-focused');
  await bar.getByRole('menuitem', { name: 'Mail', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Show All' }).click();
  await settle(page);
  await expect(win(page, 'files')).not.toHaveAttribute('data-phase', 'minimized');
  await expect(win(page, 'github')).not.toHaveAttribute('data-phase', 'minimized');
  await expect(win(page, 'mail')).toHaveAttribute('data-focused');
});

test('MAC-DOCK-05 the focused Dock icon shows its label (keyboard)', async ({ page }, info) => {
  desktopOnly(info);
  await openMacos(page);
  await page.keyboard.press('Alt+Shift+D');
  const focused = dock(page).locator('a:focus');
  await expect(focused).toHaveCount(1);
  await page.keyboard.press('ArrowRight');
  const label = dock(page).locator('li:has(a:focus) [data-dock-label]');
  await expect(label).toHaveCSS('opacity', '1');
});

test('MAC-WM-04 tier 0 resizes a ghost outline and commits once on release', async ({ page }, info) => {
  desktopOnly(info);
  await openMacos(page);
  await dockApp(page, 'Finder').click();
  await settle(page);
  await page.evaluate(() => (document.documentElement.dataset.tier = '0'));
  const finder = win(page, 'files');
  const start = (await finder.boundingBox())!;
  const handle = (await finder.locator('[data-resize="se"]').boundingBox())!;
  await page.mouse.move(handle.x + 6, handle.y + 6);
  await page.mouse.down();
  await page.mouse.move(handle.x + 66, handle.y + 36, { steps: 5 });
  // Mid-drag: the outline moves, the window does not.
  expect(await page.locator('main > div[aria-hidden="true"][style*="translate3d"]').count()).toBe(1);
  expect(Math.round((await finder.boundingBox())!.width)).toBe(Math.round(start.width));
  await page.mouse.up();
  await settle(page);
  expect(Math.round((await finder.boundingBox())!.width - start.width)).toBe(60);
});
