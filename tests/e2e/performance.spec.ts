/**
 * `perf` project (PR gate, shared/12). Lighthouse CI covers LCP/CLS/TBT/a11y/budgets; this file holds the
 * browser-side performance assertions Lighthouse cannot make.
 *   DS-FONT-01 — Inter is the only webfont on every route outside the Linux chunk (Roboto Flex and the mono face
 *   arrive with the Android and Linux chunks), and it never blocks text (`font-display: swap`).
 *   P1: PERF-LAZY-01 · NFLX-AUDIO-02 · HELLO-LCP-01 · HELLO-GL-01 · PERF-GL-01 · PERF-GL-02 · CHOOSE-PREF-01 ·
 *   TEST-PERF-01 (INP + session CLS).
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const ROUTES = ['/', '/plain', '/go/projects/enterprise-sso', '/macos', '/windows/edge/resume', '/ios', '/android'];

for (const path of ROUTES) {
  test(`only Inter is declared or fetched on ${path} @perf`, async ({ page }) => {
    const fetched: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'font') fetched.push(new URL(request.url()).pathname);
    });
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    const faces = await page.evaluate(() =>
      [...document.styleSheets].flatMap((sheet) =>
        [...sheet.cssRules]
          .filter((rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule)
          .map((rule) => ({
            family: rule.style.getPropertyValue('font-family').replace(/["']/g, ''),
            remote: rule.style.getPropertyValue('src').includes('url('),
            display: rule.style.getPropertyValue('font-display'),
          })),
      ),
    );
    expect(faces.length).toBeGreaterThan(0);
    for (const face of faces) {
      expect(face.family, JSON.stringify(face)).toMatch(/^inter( Fallback)?$/);
      if (face.remote) expect(face.display, face.family).toBe('swap');
    }
    expect(fetched.length).toBeLessThanOrEqual(1);
    for (const url of fetched) expect(url).toMatch(/\/inter[^/]*\.woff2$/);
  });
}

// --- P1 welcome performance -------------------------------------------------------------------------------------

type Entry = { name: string; startTime: number };
/** Resource entries plus the navigation's paint and load marks, all on the page's own clock. */
const timeline = (page: Page) =>
  page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
    const resources = performance.getEntriesByType('resource').map((e) => ({ name: e.name, startTime: e.startTime }));
    return { load: nav.loadEventStart, fcp, resources };
  });
const SIGNATURES = { gsap: 'GreenSock', three: 'WebGLRenderer' } as const;
async function scriptsWith(request: APIRequestContext, entries: readonly Entry[], signature: string) {
  const hits: Entry[] = [];
  for (const entry of entries.filter((e) => /\.js(\?|$)/.test(e.name))) {
    const text = await (await request.get(entry.name)).text();
    if (text.includes(signature)) hits.push(entry);
  }
  return hits;
}
const chooserHeading = (page: Page) => page.getByRole('heading', { name: 'Choose how you want to explore' });

test('PERF-LAZY-01 three, gsap and audio are absent before the load event @perf', async ({ page, request }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.readyState === 'complete');
  const { load, resources } = await timeline(page);
  const early = resources.filter((r) => r.startTime < load);
  expect(early.filter((r) => /\.(mp3|ogg|wav)(\?|$)/.test(r.name))).toEqual([]);
  expect(await scriptsWith(request, early, SIGNATURES.gsap)).toEqual([]);
  expect(await scriptsWith(request, early, SIGNATURES.three)).toEqual([]);
});

test('NFLX-AUDIO-02 the intro sound is fetched in idle time, never before first paint @perf', async ({ page }) => {
  await page.goto('/');
  await expect
    .poll(async () => (await timeline(page)).resources.some((r) => /\.mp3(\?|$)/.test(r.name)), { timeout: 10_000 })
    .toBe(true);
  const { fcp, load, resources } = await timeline(page);
  const audio = resources.find((r) => /\.mp3(\?|$)/.test(r.name))!;
  expect(fcp).toBeGreaterThan(0);
  expect(audio.startTime).toBeGreaterThan(fcp);
  expect(audio.startTime).toBeGreaterThanOrEqual(load);
});

test('HELLO-LCP-01 the server-rendered h1 is the LCP element @perf', async ({ page }) => {
  await page.goto('/');
  const lcp = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries() as (PerformanceEntry & { element?: Element | null })[];
          const element = entries[entries.length - 1]?.element;
          resolve(element?.closest('h1') ? 'h1' : (element?.tagName ?? 'none'));
        }).observe({ type: 'largest-contentful-paint', buffered: true });
      }),
  );
  expect(lcp).toBe('h1');
});

test.describe('Tier 2 GlassStage (forced in CI, where only software GL exists)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.sessionStorage.setItem('pf.debug.tier', '2'));
  });
  type Stage = { memory(): { geometries: number; textures: number } };
  const memory = (page: Page) =>
    page.evaluate(() => (window as unknown as { __glassStage: Stage }).__glassStage.memory());
  const webglOn = (page: Page) =>
    page.waitForFunction(() => document.documentElement.dataset.webgl === 'on', null, { timeout: 15_000 });

  test('HELLO-GL-01 three.js is requested only after load, and only for Tier 2 @perf', async ({ page, request }) => {
    await page.goto('/');
    await webglOn(page);
    const { load, resources } = await timeline(page);
    const three = await scriptsWith(request, resources, SIGNATURES.three);
    expect(three.length).toBeGreaterThan(0);
    for (const entry of three) expect(entry.startTime).toBeGreaterThan(load);
  });

  test('PERF-GL-01 leaving Hello disposes the stage: GPU memory back to zero, canvas gone @perf', async ({ page }) => {
    await page.goto('/');
    await webglOn(page);
    expect(await memory(page)).toEqual({ geometries: 1, textures: 0 });
    await page.getByRole('button', { name: 'Tap to begin' }).click();
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await memory(page)).toEqual({ geometries: 0, textures: 0 });
    expect(await page.evaluate(() => document.documentElement.dataset.webgl ?? 'off')).toBe('off');
  });

  test('PERF-GL-02 a lost context drops to CSS glass for the session and Hello keeps working @perf', async ({
    page,
  }) => {
    await page.goto('/');
    await webglOn(page);
    await page.evaluate(() =>
      document.querySelector('canvas')!.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext(),
    );
    await expect(page.locator('canvas')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.dataset.webgl ?? 'off')).toBe('off');
    await page.getByRole('button', { name: 'Tap to begin' }).click();
    await expect(page.getByRole('button', { name: 'Skip intro' })).toBeFocused();
  });
});

test('PERF-GL-02 a touch phone never requests WebGL @perf', async ({ browser, request }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/');
  await page.waitForFunction(() => document.readyState === 'complete');
  await page.waitForTimeout(3000); // idle and the quiet window are long past
  const { resources } = await timeline(page);
  expect(await scriptsWith(request, resources, SIGNATURES.three)).toEqual([]);
  await expect(page.locator('canvas')).toHaveCount(0);
  await context.close();
});

test('CHOOSE-PREF-01 a card chunk is requested when the card gets focus, not before @perf', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tap to begin' }).click();
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await page.getByRole('button', { name: /^Guest/ }).click();
  await expect(chooserHeading(page)).toBeFocused();
  await page.waitForTimeout(2500); // the idle prefetch of the badged OS (macOS on desktop) is over
  const scripts = new Set<string>();
  page.on('request', (r) => r.resourceType() === 'script' && scripts.add(r.url()));
  await page.waitForTimeout(1000);
  expect([...scripts], 'nothing is fetched while the visitor only looks').toEqual([]);
  await page.locator('[data-chooser-card="linux"]').focus();
  await expect.poll(() => scripts.size, { timeout: 5000 }).toBeGreaterThan(0);
});

test('TEST-PERF-01 INP ≤ 200 ms through the welcome at 4× CPU throttling; session CLS ≤ 0.1 @perf', async ({
  page,
}) => {
  await page.addInitScript({ path: 'node_modules/web-vitals/dist/web-vitals.iife.js' });
  await page.addInitScript(() => {
    type Metric = { value: number };
    type Report = (callback: (metric: Metric) => void, options: { reportAllChanges: boolean }) => void;
    const w = window as unknown as { webVitals: { onINP: Report; onCLS: Report }; __inp: number; __cls: number };
    w.__inp = 0;
    w.__cls = 0;
    w.webVitals.onINP((m) => (w.__inp = m.value), { reportAllChanges: true });
    w.webVitals.onCLS((m) => (w.__cls = m.value), { reportAllChanges: true });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto('/');
  await page.waitForFunction(() => document.readyState === 'complete');
  await page.getByRole('button', { name: 'Tap to begin' }).click();
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await page.getByRole('button', { name: /^Recruiter/ }).click();
  await expect(chooserHeading(page)).toBeFocused({ timeout: 15_000 });
  await page.waitForTimeout(800);
  await page.locator('[data-chooser-card="macos"]').click();
  await expect(page.locator('[data-os-shell="macos"]')).toBeAttached({ timeout: 15_000 });
  await page.waitForTimeout(500);
  const { inp, cls } = await page.evaluate(() => {
    const w = window as unknown as { __inp: number; __cls: number };
    return { inp: w.__inp, cls: w.__cls };
  });
  expect(inp, 'INP (ms)').toBeLessThanOrEqual(200);
  expect(cls, 'session CLS').toBeLessThanOrEqual(0.1);
});
