/**
 * The Hello lens's edge refraction (components/welcome/refraction.ts; owner decision 2026-09-21, plans/06 Deviations
 * log; `HELLO-GLASS-01`). Chromium on a desktop screen bends the page behind the lens through `#hello-refract`; a slow
 * first flight falls back to the blur; every other engine, T0 and solid glass never start it. Headless Chromium renders
 * in software and always fails the frame check, so the refracting path is asserted behind `pf.debug.refract=on`.
 */
import { expect, test, type Page } from '@playwright/test';

const html = (page: Page, key: string) => page.evaluate((k) => document.documentElement.dataset[k] ?? null, key);
const backdrop = (page: Page) =>
  page
    .locator('[data-lens] > span[aria-hidden]')
    .first()
    .evaluate((el) => getComputedStyle(el).backdropFilter);

test.describe('lens refraction', () => {
  test('Chromium desktop: the lens refracts through its own map, one backdrop surface', async ({ page }, info) => {
    test.skip(info.project.name !== 'chromium-desktop', 'Chromium at 1440 × 900');
    await page.addInitScript(() => window.sessionStorage.setItem('pf.debug.refract', 'on'));
    await page.goto('/');
    await expect.poll(() => html(page, 'refract')).toBe('on');
    expect(await backdrop(page)).toContain('url("#hello-refract")');
    const map = await page.locator('[data-refract-map]').getAttribute('href');
    expect(map).toMatch(/^data:image\/png;base64,/);
    // The layer reaches past the lens and is clipped back to it: what shows is exactly the lens.
    const [lens, layer] = await page.evaluate(() => {
      const el = document.querySelector('[data-lens]')!;
      const r = (e: Element) => e.getBoundingClientRect();
      return [r(el), r(el.querySelector(':scope > span[aria-hidden]')!)].map((b) => [b.x, b.y, b.width, b.height]);
    });
    expect(layer![0]).toBeLessThan(lens![0]!);
    expect(layer![2]).toBeGreaterThan(lens![2]!);
  });

  test('Chromium desktop: a slow first flight falls back to the blur', async ({ page }, info) => {
    test.skip(info.project.name !== 'chromium-desktop', 'Chromium at 1440 × 900');
    await page.goto('/');
    // Headless renders in software, so the frame check fails and the page settles on the blur.
    await expect.poll(() => html(page, 'refract'), { timeout: 10_000 }).toBe('slow');
    expect(await backdrop(page)).toMatch(/^blur\(6px\)/);
  });

  test('only Chromium on a desktop screen starts it; T0 and solid glass turn the backdrop off', async ({
    page,
    browserName,
  }) => {
    await page.addInitScript(() => window.sessionStorage.setItem('pf.debug.refract', 'on'));
    await page.goto('/');
    await page.waitForTimeout(1500); // past the idle start
    const desktop = await page.evaluate(() => matchMedia('(pointer: fine)').matches && innerWidth >= 1024);
    if (browserName !== 'chromium' || !desktop) {
      expect(await html(page, 'refract')).toBeNull();
      return;
    }
    expect(await html(page, 'refract')).toBe('on');
    for (const [key, value] of [
      ['tier', '0'],
      ['glass', 'solid'],
    ] as const) {
      await page.evaluate(([k, v]) => (document.documentElement.dataset[k] = v), [key, value] as const);
      expect(await backdrop(page), `${key}=${value}`).toBe('none');
      await page.evaluate((k) => (document.documentElement.dataset[k] = k === 'tier' ? '1' : 'full'), key);
    }
  });
});
