/**
 * VIEW-RESUME-01 · RES-OPEN-01 · RES-DL-01 — the résumé everywhere is the owner's Resume.pdf: every viewer shows the
 * published PDF's pages (images rendered from it at build time — no `<object>`, which the CSP blocks and phones lack),
 * and Download saves that exact file. Runs in every journey project; the phone projects are the ones that matter.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { waitForOs } from './helpers';

const OWNER = readFileSync(new URL('../../Resume.pdf', import.meta.url));

/** The largest résumé page image on screen, once it has loaded: its current source, else null. */
const shownPage = (page: Page) =>
  page.evaluate(() => {
    const [largest] = [...document.querySelectorAll<HTMLImageElement>('[data-resume-pages] img')]
      .map((img) => ({ img, width: img.getBoundingClientRect().width }))
      .sort((a, b) => b.width - a.width);
    if (!largest || largest.width < 200 || !largest.img.complete || !largest.img.naturalWidth) return null;
    return largest.img.currentSrc;
  });

test('the résumé page shows the real pages and downloads the exact file @smoke', async ({ page }) => {
  await page.goto('/plain#resume');
  const section = page.locator('#resume');
  await expect.poll(() => shownPage(page)).toMatch(/\/resume\/pages\/[0-9a-f]{10}-1-\d+\.png$/);
  // The PDF's own words are in the page for screen readers and search.
  await expect(section.getByRole('article', { name: /résumé/i })).toContainText('Xclusive Trading Inc.');
  const download = page.getByRole('link', { name: /Download résumé/ });
  await expect(download).toHaveAttribute('download', 'Jaswanth-Resume.pdf');
  const response = await page.request.get((await download.getAttribute('href'))!);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/pdf');
  expect(Buffer.from(await response.body()).equals(OWNER)).toBe(true);
  const [saved] = await Promise.all([page.waitForEvent('download'), download.click()]);
  expect(saved.suggestedFilename()).toBe('Jaswanth-Resume.pdf');
  expect(readFileSync((await saved.path())!).equals(OWNER)).toBe(true);
});

for (const [os, path] of [
  ['macos', '/macos/preview'],
  ['windows', '/windows/edge/resume'],
  ['ios', '/ios/files/resume'],
  ['android', '/android/files/resume'],
  ['linux', '/linux/viewer/resume'],
] as const) {
  test(`${os}: the résumé viewer shows the published PDF's page (${path})`, async ({ page }) => {
    await page.goto(path);
    await waitForOs(page, os);
    await expect.poll(() => shownPage(page), { timeout: 15_000 }).toMatch(/\/resume\/pages\/[0-9a-f]{10}-1-\d+\.png$/);
    expect(await page.locator('object').count()).toBe(0);
  });
}

test('/go/resume shows the page too', async ({ page }) => {
  await page.goto('/go/resume');
  await expect.poll(() => shownPage(page)).toMatch(/\/resume\/pages\//);
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
