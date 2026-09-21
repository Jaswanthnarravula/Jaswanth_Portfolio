/**
 * Production-build assertions (`perf` project, against `.next-production` on :3002 — no preview allow-list):
 *   ANL-CWV-01  Speed Insights is present on the production build only (absent on the preview build)
 *   ANL-LAZY-01 no analytics request before first paint (idle-loaded after it)
 *   ANL-PRIV-01 Do Not Track / Global Privacy Control → zero analytics requests
 *   DEPLOY-PREV-01 (converse) production is indexable: no X-Robots-Tag; previews carry noindex
 *   ARCH-REL-01 only released OSes exist: none yet, so every OS URL is a 404 and the chooser says so
 */
import { expect, test, type Page } from '@playwright/test';
import { PRODUCTION } from '../../playwright.config';

const ANALYTICS = /\/_vercel\/(insights|speed-insights)\//;

/** Analytics requests and first-contentful-paint, both on the page's clock. */
const analyticsTimeline = (page: Page) =>
  page.evaluate((pattern) => {
    const re = new RegExp(pattern);
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
    const hits = performance
      .getEntriesByType('resource')
      .filter((e) => re.test(e.name))
      .map((e) => ({ name: new URL(e.name).pathname, startTime: e.startTime }));
    return { fcp, hits };
  }, ANALYTICS.source);

test.describe('production build', () => {
  test.use({ baseURL: PRODUCTION });

  test('ANL-CWV-01 / ANL-LAZY-01 Speed Insights and analytics load in idle time, after first paint @perf', async ({
    page,
  }) => {
    await page.goto('/plain');
    await expect
      .poll(async () => (await analyticsTimeline(page)).hits.map((h) => h.name), { timeout: 10_000 })
      .toEqual(expect.arrayContaining([expect.stringMatching(/speed-insights\/script\.js$/)]));
    const { fcp, hits } = await analyticsTimeline(page);
    expect(fcp).toBeGreaterThan(0);
    for (const hit of hits) expect(hit.startTime, hit.name).toBeGreaterThan(fcp);
  });

  test('ANL-PRIV-01 Do Not Track and Global Privacy Control mean zero analytics requests @perf', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'doNotTrack', { get: () => '1' });
      Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true });
    });
    const requests: string[] = [];
    page.on('request', (r) => ANALYTICS.test(r.url()) && requests.push(r.url()));
    await page.goto('/plain');
    await page.waitForFunction(() => document.readyState === 'complete');
    await page.waitForTimeout(5000); // well past the idle loader (4 s timeout)
    expect(requests).toEqual([]);
  });

  test('DEPLOY-PREV-01 production is indexable; ARCH-REL-01 unreleased OSes do not exist @perf', async ({
    page,
    request,
  }) => {
    const home = await request.get('/');
    expect(home.headers()['x-robots-tag']).toBeUndefined();
    for (const os of ['ios', 'macos', 'windows', 'android', 'linux'])
      expect((await request.get(`/${os}`)).status(), os).toBe(404);
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).not.toMatch(/\/(ios|macos|windows|android|linux)(\/|<)/);
    await page.goto('/');
    await page.getByRole('button', { name: 'Tap to begin' }).click();
    await page.getByRole('button', { name: 'Skip intro' }).click();
    await page.getByRole('button', { name: /^Guest/ }).click();
    await expect(page.getByRole('heading', { name: 'Choose how you want to explore' })).toBeVisible();
    await expect(page.locator('[data-chooser-card]')).toHaveCount(0);
    await expect(page.getByText('The operating systems open here as each one is finished.')).toBeVisible();
  });
});

test('ANL-CWV-01 the preview build never loads Speed Insights @perf', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => ANALYTICS.test(r.url()) && requests.push(r.url()));
  await page.goto('/plain');
  await page.waitForFunction(() => document.readyState === 'complete');
  await page.waitForTimeout(5000);
  expect(requests).toEqual([]);
});
