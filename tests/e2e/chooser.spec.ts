/**
 * OS chooser journeys (plans/04-os-chooser.md, shared/12 W1 · R1 · X1):
 *   CHOOSE-CARD-01 (link cards with viewport-shaped snapshots, no device frame) · CHOOSE-ENTER-01 (shared-element enter,
 *   Esc reverses into the card) · CHOOSE-FAIL-01 (offline → inline Retry, recovers online) · CHOOSE-RM-01 (reduced
 *   motion: no flight, same end state) · CHOOSE-A11Y-01 (names, status announcement, keyboard-only entry into each OS).
 */
import { expect, test, type Page } from '@playwright/test';

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

async function toChooser(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tap to begin' }).click();
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await expect(page.getByRole('heading', { name: 'Who’s watching?' })).toBeFocused();
  await page.getByRole('button', { name: /^Guest/ }).click();
  await expect(chooserHeading(page)).toBeFocused();
  await page.waitForTimeout(700); // entrance settles
}

test('W1 the cards are real links with viewport-shaped snapshots and no device frame @smoke', async ({ page }) => {
  await toChooser(page);
  const viewport = page.viewportSize()!;
  const orientationAspect = viewport.width >= viewport.height ? 'landscape' : 'portrait';
  for (const [os, name] of OSES) {
    const link = card(page, os);
    await expect(link).toHaveAttribute('href', `/${os}`);
    await expect(link).toHaveAccessibleName(new RegExp(`^${name} — `));
    const shot = await link.locator('[data-shot]').evaluate((el) => {
      const img = el.querySelector('img')!;
      return {
        children: el.children.length,
        alt: img.getAttribute('alt'),
        natural: img.naturalWidth / img.naturalHeight,
        box: el.getBoundingClientRect().width / el.getBoundingClientRect().height,
      };
    });
    expect(shot.children, 'only the snapshot — no device outline').toBe(1);
    expect(shot.alt).toBe('');
    // The snapshot file is the whole page in the visitor's viewport shape.
    expect(shot.natural).toBeCloseTo(viewport.width / viewport.height, 1);
    if (orientationAspect === 'landscape' && viewport.width >= 600)
      expect(shot.box).toBeCloseTo(viewport.width / viewport.height, 1);
  }
  await expect(page.getByText('Suits your device')).toHaveCount(1);
});

test('W1 a card flies into its OS; Back returns to the chooser with focus on that card', async ({ page }) => {
  await toChooser(page);
  await card(page, 'windows').click();
  await expect(page.locator('#system-status')).toHaveText('Entering Windows 11');
  await expect(page).toHaveURL(/\/windows$/);
  await expect(page.locator('[data-os-shell="windows"]')).toBeAttached();
  await expect(page.getByRole('heading', { level: 1, name: /^Windows 11 — / })).toBeFocused();
  await expect(page.locator('body > [aria-hidden="true"]:not(#page-layer)')).toHaveCount(0); // overlay removed
  await page.goBack();
  await expect(chooserHeading(page)).toBeVisible();
  await expect(card(page, 'windows')).toBeFocused();
});

test('Esc mid-flight returns to the chooser with focus on the card', async ({ page }) => {
  await toChooser(page);
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
  await toChooser(page);
  await context.setOffline(true);
  await card(page, 'android').click();
  const alert = page.getByRole('alert').filter({ hasText: 'Couldn’t load Android' });
  await expect(alert).toBeVisible({ timeout: 10_000 });
  await expect(alert.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(alert.getByRole('link', { name: 'Plain portfolio' })).toHaveAttribute('href', '/plain');
  await expect(page.locator('.os-failure')).toHaveCount(0); // the chooser owns this failure, not the generic screen
  await context.setOffline(false);
  await expect(page.locator('[data-os-shell="android"]')).toBeAttached({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/android$/);
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
    await expect(page.getByRole('heading', { level: 1, name: new RegExp(`^${name} — `) })).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`/${os}$`));
    await page.goBack();
    await expect(card(page, os)).toBeFocused();
  }
});
