/**
 * The chooser ↔ macOS round trip — plans/04-os-chooser.md, P2 rows (they need the first real OS shell):
 *   CHOOSE-HIST-01 (push on pick; Back returns to the chooser, never Hello) · CHOOSE-EXIT-01 (macOS's exit beat, then
 *   its snapshot shrinks back into the re-measured card; the session is parked) · CHOOSE-CONT-01 ("Continue in macOS"
 *   for returning visitors only) · CHOOSE-ENTER-02 (boot frame only when the chunk is slow; cached → none; any key
 *   skips) · KRN-SWITCH-02 (an offline switch shows Retry + /plain and recovers online).
 */
import { expect, test, type Page } from '@playwright/test';
import { expectFocusNotOnBody, skipIntro, waitForOs, waitForSettled } from './helpers';

const heading = (page: Page) => page.getByRole('heading', { name: 'Choose how you want to explore' });
const card = (page: Page) => page.locator('[data-chooser-card="macos"]');
const overlay = (page: Page) => page.locator('body > [aria-hidden="true"]:not(#page-layer)');
const webkitTouch = (project: string) => ['iphone', 'ipad-portrait', 'ipad-landscape'].includes(project);

/** The first chooser entry of a session shows the lock screen (plans/macos/surfaces/lock-screen.md); enter macOS. */
async function unlock(page: Page) {
  const enter = page.getByRole('button', { name: 'Enter macOS' });
  await expect(enter).toBeFocused();
  await enter.click();
  await expect(page.locator('[data-lock-screen]')).toHaveCount(0);
}

async function toChooser(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tap to begin' }).click();
  await skipIntro(page);
  await page.getByRole('button', { name: /^Guest/ }).click();
  await expect(heading(page)).toBeFocused();
  await waitForSettled(page, '[data-chooser-card]');
}

test('CHOOSE-HIST-01 · CHOOSE-EXIT-01 Back from macOS: exit beat, the snapshot flies home into its card, session parked', async ({
  page,
}) => {
  await toChooser(page);
  await card(page).click();
  await expect(page).toHaveURL(/\/macos$/);
  await waitForOs(page, 'macos');
  await unlock(page);
  await expect(page.getByRole('heading', { level: 1, name: /^macOS — / })).toBeFocused();
  await page
    .getByRole('navigation', { name: 'Dock' })
    .getByRole('link', { name: /^Finder/ })
    .click();
  await expect(page).toHaveURL(/\/macos\/finder$/);

  // Record what the visitor sees on the way out: the leaving shell, then the snapshot overlay over the chooser.
  await page.evaluate(() => {
    const seen = { overlay: false, shellDuringOverlay: false };
    (window as unknown as { __seen: typeof seen }).__seen = seen;
    const tick = () => {
      const flying = [...document.body.children].some(
        (el) => el.id !== 'page-layer' && el.getAttribute('aria-hidden') === 'true' && el.querySelector('img'),
      );
      if (flying) seen.overlay = true;
      if (!(window as unknown as { __stop?: boolean }).__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goBack(); // → /macos
  await expect(page).toHaveURL(/\/macos$/);
  await page.goBack(); // → the chooser (never Hello)
  await expect(page).toHaveURL(/\/$/);
  await expect(heading(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tap to begin' })).toBeHidden();
  await expect(card(page)).toBeFocused();
  await expect(page.locator('[data-os-shell]')).toHaveCount(0);
  await expect(overlay(page)).toHaveCount(0); // the flight landed and cleaned up
  await page.evaluate(() => ((window as unknown as { __stop: boolean }).__stop = true));
  const seen = await page.evaluate(() => (window as unknown as { __seen: { overlay: boolean } }).__seen);
  const reduced = await page.evaluate(() => document.documentElement.dataset.motion === 'reduced');
  expect(seen.overlay, 'the snapshot flew back into its card').toBe(!reduced);

  // Parked, not destroyed: entering again brings back the same windows (in compact mode the unfocused Finder is
  // kept but hidden — one window at a time, MAC-WM-10).
  await card(page).click();
  await waitForOs(page, 'macos');
  await expect(page.locator('[data-window="macos:files"]')).toBeAttached();
  await expectFocusNotOnBody(page);
});

test('CHOOSE-CONT-01 a returning visitor gets "Continue in macOS" above the grid; a first visit does not', async ({
  page,
}, info) => {
  test.skip(webkitTouch(info.project.name), 'focus assertions after Back on WebKit touch');
  await toChooser(page);
  await expect(page.getByRole('link', { name: /^Continue in/ })).toHaveCount(0); // first visit: the frame exactly
  await card(page).click();
  await waitForOs(page, 'macos');
  await page.goBack();
  await expect(heading(page)).toBeVisible();
  const resume = page.getByRole('link', { name: 'Continue in macOS' });
  await expect(resume).toBeVisible();
  await expect(resume).toHaveAttribute('href', '/macos');
  // Above the grid.
  const [top, grid] = await Promise.all([
    resume.evaluate((el) => el.getBoundingClientRect().bottom),
    card(page).evaluate((el) => el.getBoundingClientRect().top),
  ]);
  expect(top).toBeLessThan(grid);
  await resume.click();
  await expect(page).toHaveURL(/\/macos$/);
  await waitForOs(page, 'macos');
  // It survives a reload (prefs.lastOs): the next visit to the chooser offers it again.
  await toChooser(page);
  await expect(page.getByRole('link', { name: 'Continue in macOS' })).toBeVisible();
});

/** The macOS chunk (its entry carries the `pf-os-chunk:macos` marker). */
const isMacosChunk = async (response: { url(): string; text(): Promise<string> }) =>
  response.url().includes('/_next/static/chunks/') && (await response.text()).includes('pf-os-chunk:macos');

test('CHOOSE-ENTER-02 a cached chunk shows no boot frame', async ({ page }) => {
  const macosChunk = page.waitForResponse(isMacosChunk); // idle prefetch (desktop badge) or the focus prefetch below
  await toChooser(page);
  await card(page).focus();
  await macosChunk;
  await page.evaluate(() => {
    const w = window as unknown as { __boot: boolean };
    w.__boot = false;
    new MutationObserver(() => {
      if (document.querySelector('[data-boot]')) w.__boot = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
  await card(page).click();
  await waitForOs(page, 'macos');
  await unlock(page);
  await expect(page.getByRole('heading', { level: 1, name: /^macOS — / })).toBeFocused();
  expect(await page.evaluate(() => (window as unknown as { __boot: boolean }).__boot)).toBe(false);
});

test('CHOOSE-ENTER-02 a slow chunk shows the boot frame; any key skips its extra beats; once per session', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'reduced-motion', 'reduced motion has no boot frame (a plain crossfade)');
  test.skip(webkitTouch(info.project.name), 'WebKit touch projects cannot Tab to links');
  // Hold the macOS chunk for 2.5 s whenever it is requested (the idle prefetch too): it is still loading well past the
  // 150 ms threshold when the card is chosen.
  await page.route('**/_next/static/chunks/**', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    if (body.includes('pf-os-chunk:macos')) await new Promise((resolve) => setTimeout(resolve, 2500));
    await route.fulfill({ response, body });
  });
  await toChooser(page);
  await card(page).click();
  const boot = page.locator('[data-boot="macos"]');
  await expect(boot).toBeAttached({ timeout: 5000 });
  await expect(boot.locator('[data-boot-bar]')).toBeAttached();
  await page.keyboard.press('Shift'); // any input skips the hold and the extra beats
  await waitForOs(page, 'macos');
  await expect(boot).toHaveCount(0, { timeout: 3000 });
  await unlock(page);
  await expect(page.getByRole('heading', { level: 1, name: /^macOS — / })).toBeFocused();
  // Once per session: back to the chooser and in again → no boot frame (the chunk is cached now too).
  await page.unroute('**/_next/static/chunks/**');
  await page.goBack();
  await expect(heading(page)).toBeVisible();
  await card(page).click();
  await waitForOs(page, 'macos');
  await expect(page.locator('[data-boot]')).toHaveCount(0);
});

test('KRN-SWITCH-02 an OS switch while offline shows Retry and the plain portfolio, and recovers online', async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name === 'firefox-desktop', 'Firefox emulation does not fire the online event');
  // Start in the Windows preview stub (it has an OS switcher); macOS's chunk has never been requested.
  await page.goto('/windows');
  await waitForOs(page, 'windows');
  await context.setOffline(true);
  await page
    .getByRole('navigation', { name: 'Switch operating system' })
    .getByRole('button', { name: 'macOS' })
    .click();
  const alert = page.getByRole('alert').filter({ hasText: 'Couldn’t load this operating system' });
  await expect(alert).toBeVisible({ timeout: 10_000 });
  await expect(alert.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(alert.getByRole('link', { name: 'Read the plain portfolio' })).toHaveAttribute('href', '/plain');
  await context.setOffline(false);
  await waitForOs(page, 'macos');
  await expect(page).toHaveURL(/\/macos$/);
  await expect(alert).toHaveCount(0);
});
