/** Regression: mobile app links must mount their app immediately; changing only the URL is never a valid state. */
import { expect, test, type Page } from '@playwright/test';
import { plantSentinel, sentinel, waitForOs } from './helpers';

async function assertDocumentStayedMounted(page: Page) {
  expect(await sentinel(page)).toBe('alive');
  expect(await page.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(1);
}

async function expectForeground(page: Page, role: string) {
  const surface = page.locator(`[data-app-surface="${role}"]`);
  await expect.poll(() => surface.getAttribute('data-state')).toBe('foreground');
  await expect(surface).toBeVisible();
}

test('Android app links atomically update the URL and foreground surface without reload @smoke', async ({ page }) => {
  await page.goto('/android');
  await waitForOs(page, 'android');
  await plantSentinel(page);

  await page.getByRole('region', { name: 'Home screen' }).getByRole('link', { name: 'GitHub' }).click();
  await expect(page).toHaveURL(/\/android\/github$/);
  await expect(page.locator('[data-app-surface="github"] [data-app="github"]')).toBeVisible();
  await assertDocumentStayedMounted(page);

  await page.getByRole('navigation', { name: 'System navigation' }).getByRole('button', { name: 'Home' }).click();
  await expect(page).toHaveURL(/\/android$/);
  await page.getByRole('navigation', { name: 'Favorites' }).getByRole('link', { name: 'Gmail' }).click();
  await expect(page).toHaveURL(/\/android\/gmail$/);
  await expect(page.locator('[data-app-surface="mail"] [data-app="gmail"]')).toBeVisible();
  await assertDocumentStayedMounted(page);
});

test('iOS app links atomically update the URL and foreground surface without reload @smoke', async ({ page }) => {
  await page.goto('/ios');
  await waitForOs(page, 'ios');
  await plantSentinel(page);

  const home = page.getByRole('group', { name: 'Home Screen' });
  await home.getByRole('link', { name: /^GitHub/ }).click();
  await expect(page).toHaveURL(/\/ios\/github$/);
  await expectForeground(page, 'github');
  await assertDocumentStayedMounted(page);

  await page.locator('[data-home-indicator]').click();
  await expect(page).toHaveURL(/\/ios$/);
  await page.getByRole('navigation', { name: 'Dock' }).getByRole('link', { name: /^Mail/ }).click();
  await expect(page).toHaveURL(/\/ios\/mail$/);
  await expectForeground(page, 'mail');
  await assertDocumentStayedMounted(page);
});
