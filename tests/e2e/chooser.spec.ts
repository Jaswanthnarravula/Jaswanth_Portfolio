/**
 * OS chooser journeys (plans/04-os-chooser.md, shared/12 W1 · R1 · X1):
 *   CHOOSE-CARD-01 (link cards with viewport-shaped snapshots, no device frame) · CHOOSE-ENTER-01 (shared-element enter,
 *   Esc reverses into the card) · CHOOSE-FAIL-01 (offline → inline Retry, recovers online) · CHOOSE-RM-01 (reduced
 *   motion: no flight, same end state) · CHOOSE-A11Y-01 (names, status announcement, keyboard-only entry into each OS).
 */
import { expect, test, type Page } from '@playwright/test';
import { expectedBadges, skipIntro, waitForSettled } from './helpers';

const OSES = [
  ['ios', 'iOS'],
  ['macos', 'macOS'],
  ['windows', 'Windows 11'],
  ['android', 'Android'],
  ['linux', 'Linux'],
] as const;
const webkitTouch = (project: string) => ['iphone', 'ipad-portrait', 'ipad-landscape'].includes(project);
const chooserHeading = (page: Page) => page.getByRole('heading', { name: 'Choose how you want to explore' });
const card = (page: Page, os: string) => page.locator(`[data-chooser-card="${os}"]`);

/**
 * Hello → profiles → Guest → the chooser. `withoutHover` parks the mouse in a corner and picks by keyboard, so no card
 * ever sits under the pointer (a hovered card prefetches its OS chunk).
 */
async function toChooser(page: Page, { withoutHover = false } = {}) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tap to begin' }).click();
  await skipIntro(page);
  await expect(page.getByRole('heading', { name: 'Who’s watching?' })).toBeFocused();
  const guest = page.getByRole('button', { name: /^Guest/ });
  if (withoutHover) {
    await page.mouse.move(1, 1);
    await guest.focus();
    await page.keyboard.press('Enter');
  } else await guest.click();
  await expect(chooserHeading(page)).toBeFocused();
  await waitForSettled(page, '[data-chooser-card]');
}

/**
 * macOS shows its lock screen on the first chooser entry of a session (plans/macos/surfaces/lock-screen.md,
 * `MAC-LOCK-02`); "Enter macOS" takes focus and Enter unlocks, landing on the OS heading.
 */
async function passMacLock(page: Page) {
  const enter = page.getByRole('button', { name: 'Enter macOS' });
  await expect(enter).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-lock-screen]')).toHaveCount(0);
}

/** iOS shows its Lock Screen on the first chooser entry (plans/ios/surfaces/lock-screen.md, `IOS-LOCK-02`): Open iOS. */
async function passIosLock(page: Page) {
  const open = page.getByRole('button', { name: 'Open iOS' });
  await expect(open).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-lock]')).toHaveCount(0);
}

/**
 * Windows shows its lock screen on the first chooser entry too (plans/windows/surfaces/lock-screen.md, `WIN-LOCK-02`):
 * Continue takes focus, Enter reveals the sign-in, whose button takes focus; Enter signs in and lands on the OS heading.
 */
async function passWinLock(page: Page) {
  const proceed = page.getByRole('button', { name: /\(Continue\)$/ });
  await expect(proceed).toBeFocused();
  await page.keyboard.press('Enter');
  const signIn = page.getByRole('button', { name: 'Sign in', exact: true });
  await expect(signIn).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-lock]')).toHaveCount(0);
}

test('W1 the cards are real links with viewport-shaped snapshots and no device frame @smoke', async ({ page }) => {
  await toChooser(page);
  const viewport = page.viewportSize()!;
  const orientationAspect = viewport.width >= viewport.height ? 'landscape' : 'portrait';
  for (const [os, name] of OSES) {
    const link = card(page, os);
    await expect(link).toHaveAttribute('href', `/${os}`);
    await expect(link).toHaveAccessibleName(new RegExp(`^${name} — `));
    const shot = await link.locator('[data-shot]').evaluate(async (el) => {
      const img = el.querySelector('img')!;
      await img.decode().catch(() => undefined);
      return {
        children: el.children.length,
        alt: img.getAttribute('alt'),
        loaded: img.naturalWidth > 0,
        fit: getComputedStyle(img).objectFit,
        box: el.getBoundingClientRect().width / el.getBoundingClientRect().height,
        shape: img.naturalWidth >= img.naturalHeight ? 'landscape' : 'portrait',
      };
    });
    expect(shot.children, 'only the snapshot — no device outline').toBe(1);
    expect(shot.alt).toBe('');
    expect(shot.loaded, 'the snapshot decodes').toBe(true);
    expect(shot.shape, 'the snapshot matches the viewport orientation').toBe(orientationAspect);
    expect(shot.fit).toBe('cover');
    // The card is the page in the visitor's viewport shape (phones crop to the card: plans/04 "Responsive").
    if (viewport.width >= 600) expect(shot.box).toBeCloseTo(viewport.width / viewport.height, 1);
  }
  // Exactly one badge where the rule names a device; none on a tablet or a medium-width window.
  await expect(page.getByText('Suits your device')).toHaveCount(await expectedBadges(page));
});

test('W1 a card flies into its OS; Back returns to the chooser with focus on that card', async ({ page }) => {
  await toChooser(page);
  await card(page, 'windows').click();
  await expect(page.locator('#system-status')).toHaveText('Entering Windows 11');
  await expect(page).toHaveURL(/\/windows$/);
  await expect(page.locator('[data-os-shell="windows"]')).toBeAttached();
  await passWinLock(page);
  await expect(page.getByRole('heading', { level: 1, name: /^Windows 11 — / })).toBeFocused();
  await expect(page.locator('body > [aria-hidden="true"]:not(#page-layer)')).toHaveCount(0); // overlay removed
  await page.goBack();
  await expect(chooserHeading(page)).toBeVisible();
  await expect(card(page, 'windows')).toBeFocused();
});

test('Esc mid-flight returns to the chooser with focus on the card', async ({ page }) => {
  await toChooser(page, { withoutHover: true }); // Linux is never badged or remembered: nothing prefetched it
  // Hold new chunk responses so the transition is still in flight when Esc lands, even with a 150 ms reduced flight.
  await page.route('**/_next/static/chunks/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue().catch(() => undefined);
  });
  await card(page, 'linux').click();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/$/);
  await expect(chooserHeading(page)).toBeVisible();
  await expect(card(page, 'linux')).toBeFocused();
  await expect(page.locator('[data-os-shell]')).toHaveCount(0);
  await expect(page.locator('body > [aria-hidden="true"]:not(#page-layer)')).toHaveCount(0);
});

test('offline click shows Retry on the card; it recovers when back online', async ({ page, context }, info) => {
  test.skip(info.project.name === 'firefox-desktop', 'Firefox emulation does not fire the online event');
  // The chooser (and the kernel) are loaded; then the network drops before Linux's chunk was ever requested.
  // (A chooser chunk that cannot load is covered by the ChooserSlot component test.)
  await toChooser(page, { withoutHover: true }); // Linux is never badged or remembered: nothing prefetched it
  await context.setOffline(true);
  await card(page, 'linux').click();
  const alert = page.getByRole('alert').filter({ hasText: 'Couldn’t load Linux' });
  await expect(alert).toBeVisible({ timeout: 10_000 });
  await expect(alert.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(alert.getByRole('link', { name: 'Plain portfolio' })).toHaveAttribute('href', '/plain');
  await expect(page.locator('.os-failure')).toHaveCount(0); // the chooser owns this failure, not the generic screen
  await context.setOffline(false);
  await expect(page.locator('[data-os-shell="linux"]')).toBeAttached({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/linux$/);
});

test('R1 reduced motion: no flight, the same end state', async ({ page }, info) => {
  test.skip(info.project.name !== 'reduced-motion', 'reduced-motion project');
  await toChooser(page);
  await page.evaluate(() => {
    const scales: number[] = [];
    (window as unknown as { __scales: number[] }).__scales = scales;
    const sample = () => {
      const overlay = [...document.body.children].find(
        (el) => el !== document.getElementById('page-layer') && el.getAttribute('aria-hidden') === 'true',
      ) as HTMLElement | undefined;
      if (overlay) {
        const transform = getComputedStyle(overlay).transform;
        scales.push(transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).a);
      }
      if (scales.length < 40) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await card(page, 'macos').click();
  await expect(page.locator('[data-os-shell="macos"]')).toBeAttached();
  await passMacLock(page);
  await expect(page.getByRole('heading', { level: 1, name: /^macOS — / })).toBeFocused();
  const scales = await page.evaluate(() => (window as unknown as { __scales: number[] }).__scales);
  expect(scales.length).toBeGreaterThan(0);
  expect(
    scales.every((scale) => Math.abs(scale - 1) < 0.001),
    JSON.stringify(scales),
  ).toBe(true);
  const long = await page.evaluate(
    () => document.getAnimations().filter((a) => Number(a.effect?.getComputedTiming().duration ?? 0) > 200).length,
  );
  expect(long).toBe(0);
});

test('X1 keyboard only: every card enters its OS, and Back lands on that card', async ({ page }, info) => {
  test.skip(webkitTouch(info.project.name), 'WebKit Tab skips links unless Option is held');
  await toChooser(page);
  for (const [os, name] of OSES) {
    await card(page, os).focus();
    await page.keyboard.press('Enter');
    if (os === 'macos') await passMacLock(page);
    else if (os === 'windows') await passWinLock(page);
    else if (os === 'ios') await passIosLock(page);
    await expect(page.getByRole('heading', { level: 1, name: new RegExp(`^${name} — `) })).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`/${os}$`));
    await page.goBack();
    await expect(card(page, os)).toBeFocused();
  }
});
