/**
 * VIEW-RESUME-01 — where a PDF cannot render inline (mobile Safari), the résumé view shows the pages as HTML plus a
 * working download. Runs in every journey project; the phone projects are the ones that matter.
 */
import { expect, test } from '@playwright/test';

test('the résumé page shows the pages and a working download @smoke', async ({ page }) => {
  await page.goto('/plain#resume');
  const section = page.locator('#resume');
  await expect(section.getByRole('article', { name: /résumé/ })).toBeVisible();
  await expect(section.getByText('Software Engineer — Xclusive Trading Inc.')).toBeVisible();
  const download = page.getByRole('link', { name: /Download résumé/ });
  await expect(download).toHaveAttribute('download', 'Jaswanth-Resume.pdf');
  const response = await page.request.get((await download.getAttribute('href'))!);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/pdf');
});

test('no horizontal scroll on the reader pages at phone width @smoke', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const path of ['/plain', '/go/projects/enterprise-sso', '/go/resume']) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
