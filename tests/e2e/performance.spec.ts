/**
 * `perf` project (PR gate, shared/12). Lighthouse CI covers LCP/CLS/TBT/a11y/budgets; this file holds the
 * browser-side performance assertions Lighthouse cannot make.
 *   DS-FONT-01 — Inter is the only webfont on every route outside the Android and Linux chunks (Google Sans Flex
 *   arrives with Android — AND-ID-06 — and the mono face with Linux), and it never blocks text (`font-display: swap`).
 *   The other addition is `/`, whose welcome screens are the storyboard frames: it also declares and preloads the
 *   frame's IBM Plex Sans.
 *   P1: PERF-LAZY-01 · NFLX-AUDIO-02 · HELLO-LCP-01 · HELLO-GL-01 · PERF-GL-01 · PERF-GL-02 · CHOOSE-PREF-01 ·
 *   TEST-PERF-01 (INP + session CLS).
 */
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { skipIntro } from './helpers';

const ROUTES = ['/', '/plain', '/go/projects/enterprise-sso', '/macos', '/windows/edge/resume', '/ios', '/android'];

for (const path of ROUTES) {
  const welcome = path === '/';
  const android = path === '/android';
  const extra = welcome ? ' and the storyboard text face are' : android ? ' and Google Sans Flex are' : ' is';
  test(`only Inter${extra} declared or fetched on ${path} @perf`, async ({ page }) => {
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
      expect(face.family, JSON.stringify(face)).toMatch(
        welcome
          ? /^(inter( Fallback)?|IBM Plex Sans)$/
          : android
            ? /^(inter( Fallback)?|Google Sans Flex)$/
            : /^inter( Fallback)?$/,
      );
      if (face.remote) expect(face.display, face.family).toBe('swap');
    }
    expect(fetched.length).toBeLessThanOrEqual(welcome || android ? 2 : 1);
    for (const url of fetched)
      expect(url).toMatch(
        welcome
          ? /\/(inter[^/]*|ibm-plex-sans-latin-var\.[0-9a-f]{10})\.woff2$/
          : android
            ? /\/(inter[^/]*|google-sans-flex-latin-var\.[0-9a-f]{10})\.woff2$/
            : /\/inter[^/]*\.woff2$/,
      );
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

/** shared/10 first load on `/`: the measured framework (Next 16.3 + React 19.2, ~131 KB gzip) + ≤ 20 KB welcome app JS. */
const FIRST_LOAD_BUDGET = 151 * 1024;
const LAZY_SIGNATURES = {
  kernel: 'shellInstance',
  chooser: 'Choose how you want to explore',
  gsap: SIGNATURES.gsap,
  three: SIGNATURES.three,
} as const;

test('PERF-LAZY-01 / PERF-BUDGET-01 before the first paint `/` fetches only its first load, within budget @perf', async ({
  page,
  request,
}) => {
  // A slow phone: at 4× CPU the load event can come before the first paint, which is when idle work used to leak in.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto('/');
  await page.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0);
  await page.waitForTimeout(1500); // let the idle loaders run, so "after" is observable too
  const entries = await page.evaluate(() => {
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]!.startTime;
    return performance.getEntriesByType('resource').map((e) => {
      const r = e as PerformanceResourceTiming;
      return { name: r.name, startTime: r.startTime, bytes: r.encodedBodySize, beforePaint: r.startTime < fcp };
    });
  });
  const early = entries.filter((e) => e.beforePaint);
  expect(early.filter((e) => /\.(mp3|ogg|wav)(\?|$)|\/avatar\./.test(e.name)).map((e) => e.name)).toEqual([]);
  for (const [name, signature] of Object.entries(LAZY_SIGNATURES))
    expect(await scriptsWith(request, early, signature), `${name} before the first paint`).toEqual([]);
  const firstLoad = early.filter((e) => /\.js(\?|$)/.test(e.name)).reduce((sum, e) => sum + e.bytes, 0);
  expect(firstLoad, `first-load JS ${(firstLoad / 1024).toFixed(1)} KB`).toBeLessThanOrEqual(FIRST_LOAD_BUDGET);
  expect(await scriptsWith(request, entries, LAZY_SIGNATURES.kernel), 'the kernel still arrives').not.toEqual([]);
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
  await skipIntro(page);
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
  await skipIntro(page);
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

// --- P2 macOS vertical slice ---------------------------------------------------------------------------------------

/** Each OS chunk entry carries a marker string (`pf-os-chunk:{os}`), so a fetched script can be attributed to its OS. */
async function osChunksFetched(request: APIRequestContext, page: Page): Promise<string[]> {
  const urls = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => /\.js(\?|$)/.test(name)),
  );
  const found = new Set<string>();
  for (const url of urls) {
    const text = await (await request.get(url)).text();
    for (const match of text.matchAll(/pf-os-chunk:(ios|macos|windows|android|linux)/g)) found.add(match[1]!);
  }
  return [...found].sort();
}

test('ARCH-SPLIT-01 visiting /macos requests the macOS chunk and no other OS chunk @perf', async ({
  page,
  request,
}) => {
  await page.goto('/macos/finder/experience');
  await expect(page.locator('[data-os-shell="macos"]')).toBeAttached({ timeout: 15_000 });
  await page
    .getByRole('navigation', { name: 'Dock' })
    .getByRole('link', { name: /^GitHub/ })
    .click();
  await expect(page.locator('[data-window="macos:github"]')).toBeVisible();
  expect(await osChunksFetched(request, page)).toEqual(['macos']);
  // Nor the chooser: its idle warm-up belongs to `/` only.
  await page.waitForTimeout(1500); // let the idle loaders run, so a stray warm-up would be observable
  const { resources } = await timeline(page);
  expect(await scriptsWith(request, resources, LAZY_SIGNATURES.chooser), 'the chooser chunk').toEqual([]);
});

test('PERF-INP-01 INP ≤ 200 ms on macOS at 4× CPU: open, select, drag, minimize, restore, zoom @perf', async ({
  page,
}) => {
  // INP read straight from Event Timing: with fewer than 50 interactions it is the slowest one (web-vitals only
  // reports INP on page hide, so its live value stays 0 here). Every interaction is kept with its target, so a
  // failure names the slow press. CLS still comes from web-vitals.
  await page.addInitScript({ path: 'node_modules/web-vitals/dist/web-vitals.iife.js' });
  await page.addInitScript(() => {
    type Metric = { value: number };
    type Report = (callback: (metric: Metric) => void, options: { reportAllChanges: boolean }) => void;
    const w = window as unknown as {
      webVitals: { onCLS: Report };
      __interactions: { name: string; target: string; duration: number }[];
      __cls: number;
    };
    w.__interactions = [];
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceEventTiming[]) {
        if (!entry.interactionId) continue;
        const target = entry.target as Element | null;
        const label = target?.getAttribute('aria-label') ?? target?.getAttribute('data-window') ?? target?.tagName;
        w.__interactions.push({ name: entry.name, target: label ?? '?', duration: entry.duration });
      }
    }).observe({ type: 'event', durationThreshold: 16, buffered: true } as PerformanceObserverInit);
    w.webVitals.onCLS((m) => (w.__cls = m.value), { reportAllChanges: true });
  });
  await page.goto('/macos');
  await expect(page.locator('[data-os-shell="macos"]')).toBeAttached({ timeout: 15_000 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const dock = page.getByRole('navigation', { name: 'Dock' });
  await dock.getByRole('link', { name: /^Finder/ }).click();
  const finder = page.locator('[data-window="macos:files"]');
  await expect(finder).toHaveAttribute('data-phase', 'normal');
  await finder.getByRole('navigation', { name: 'Favourites' }).getByRole('link', { name: 'Experience' }).click();
  await finder.locator('[data-column="entries"] a').first().click();
  await finder.locator('[data-column="entries"] a').nth(1).click();
  const box = (await finder.boundingBox())!;
  await page.mouse.move(box.x + 420, box.y + 26);
  await page.mouse.down();
  await page.mouse.move(box.x + 520, box.y + 80, { steps: 10 });
  await page.mouse.up();
  await finder.getByRole('button', { name: 'Minimize Finder' }).click();
  await dock.locator('[data-dock-tile="macos:files"]').click();
  await expect(finder).toHaveAttribute('data-phase', 'normal');
  await finder.getByRole('button', { name: 'Zoom Finder' }).click();
  await dock.getByRole('link', { name: /^Safari/ }).click();
  await expect(page.locator('[data-window="macos:browser"]')).toHaveAttribute('data-phase', 'normal');
  const { interactions, cls } = await page.evaluate(() => {
    const w = window as unknown as {
      __interactions: { name: string; target: string; duration: number }[];
      __cls: number;
    };
    return { interactions: w.__interactions, cls: w.__cls };
  });
  // The observer really saw the presses, so a vacuous 0 cannot pass. Nine clicks are made; entries under the
  // 16 ms observer floor are not reported, so at least five must be.
  expect(interactions.filter((entry) => entry.name === 'click').length, 'clicks observed').toBeGreaterThanOrEqual(5);
  const worst = interactions.reduce((max, entry) => (entry.duration > max.duration ? entry : max), interactions[0]!);
  expect(worst.duration, `INP (ms) — slowest: ${worst.name} on ${worst.target}`).toBeLessThanOrEqual(200);
  expect(cls, 'session CLS').toBeLessThanOrEqual(0.1);
});

test('MOTION-RULE-02 no Layout > 1 ms inside a tagged macOS flight (open, minimize, restore, zoom, close) @perf', async ({
  page,
  browser,
}) => {
  await page.goto('/macos');
  await expect(page.locator('[data-os-shell="macos"]')).toBeAttached({ timeout: 15_000 });
  const dock = page.getByRole('navigation', { name: 'Dock' });
  const finder = page.locator('[data-window="macos:files"]');
  const idle = () =>
    page.waitForFunction(() => {
      const motion = (window as unknown as { __motion?: { debug(): { tweens: number } } }).__motion;
      return (
        !document.querySelector('[data-window][data-phase="opening"],[data-window][data-phase="closing"]') &&
        (!motion || motion.debug().tweens === 0)
      );
    });
  await browser.startTracing(page, { categories: ['devtools.timeline', 'blink.user_timing'] });
  await dock.getByRole('link', { name: /^Finder/ }).click();
  await expect(finder).toHaveAttribute('data-phase', 'normal');
  await finder.getByRole('button', { name: 'Minimize Finder' }).click();
  await expect(finder).toBeHidden();
  await dock.locator('[data-dock-tile="macos:files"]').click();
  await expect(finder).toBeVisible();
  await idle();
  await finder.getByRole('button', { name: 'Zoom Finder' }).click();
  await idle();
  await finder.getByRole('button', { name: 'Restore Finder' }).click();
  await idle();
  await finder.getByRole('button', { name: 'Close Finder' }).click();
  await expect(finder).toHaveCount(0);
  const trace = JSON.parse((await browser.stopTracing()).toString('utf8')) as {
    traceEvents: { name: string; ph: string; ts: number; dur?: number; cat: string }[];
  };
  const events = trace.traceEvents;
  const marks = events.filter((event) => /^pf-flight-(start|end):/.test(event.name)).sort((a, b) => a.ts - b.ts);
  const flights: { kind: string; from: number; to: number }[] = [];
  for (const mark of marks) {
    const [, edge, kind] = mark.name.match(/^pf-flight-(start|end):(.+)$/)!;
    if (edge === 'start') flights.push({ kind: kind!, from: mark.ts, to: Number.POSITIVE_INFINITY });
    else {
      const open = [...flights].reverse().find((f) => f.kind === kind && f.to === Number.POSITIVE_INFINITY);
      if (open) open.to = mark.ts;
    }
  }
  const kinds = new Set(flights.map((flight) => flight.kind));
  for (const kind of ['open', 'minimize', 'restore', 'zoom', 'close']) expect(kinds.has(kind), kind).toBe(true);
  const layouts = events.filter((event) => event.name === 'Layout' && event.ph === 'X' && event.dur !== undefined);
  const slow = layouts.filter(
    (layout) =>
      layout.dur! > 1000 &&
      flights.some((flight) => Number.isFinite(flight.to) && layout.ts > flight.from && layout.ts < flight.to),
  );
  expect(
    slow.map((layout) => `${(layout.dur! / 1000).toFixed(2)} ms`),
    'layouts > 1 ms during a flight',
  ).toEqual([]);
});

// --- P5 iOS ---------------------------------------------------------------------------------------------------------------

type IosProbe = {
  __motion?: { debug(): { tickers: number; tweens: number } };
  __raf: number;
  __timers: { kind: 'timeout' | 'interval'; delay: number; at: number; wall: number }[];
  __liveIntervals: Map<number, number>;
};

/** Counts rAF requests and timers from the first script on (probe flag on, so `__motion.debug()` exists). */
async function instrumentIos(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('pf.debug.probe', '1');
    const w = window as unknown as IosProbe;
    w.__raf = 0;
    w.__timers = [];
    w.__liveIntervals = new Map();
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      w.__raf++;
      return raf(callback);
    };
    const timeout = window.setTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      w.__timers.push({ kind: 'timeout', delay: Number(delay) || 0, at: performance.now(), wall: Date.now() });
      return timeout(handler, delay, ...args);
    }) as typeof window.setTimeout;
    const interval = window.setInterval.bind(window);
    const clear = window.clearInterval.bind(window);
    window.setInterval = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      w.__timers.push({ kind: 'interval', delay: Number(delay) || 0, at: performance.now(), wall: Date.now() });
      const id = interval(handler, delay, ...args);
      w.__liveIntervals.set(id, Number(delay) || 0);
      return id;
    }) as typeof window.setInterval;
    window.clearInterval = ((id?: unknown) => {
      if (typeof id === 'number') w.__liveIntervals.delete(id);
      (clear as (value?: unknown) => void)(id);
    }) as typeof window.clearInterval;
  });
}

/**
 * iOS at rest: the shell is up, nothing flies, no animation runs, the motion layer is idle. `tickers: false` leaves the
 * live-ticker count out (for tests that are not about the idle loop).
 */
async function iosAtRest(page: Page, { tickers = true }: { tickers?: boolean } = {}) {
  await expect(page.locator('[data-os-shell="ios"]')).toBeAttached({ timeout: 15_000 });
  const state = () =>
    page.evaluate(() => {
      const flying = document.querySelectorAll(
        '[data-app-surface][data-state="opening"],[data-app-surface][data-state="closing"]',
      ).length;
      const running = document
        .getAnimations()
        .filter((animation) => animation.playState === 'running')
        .map((animation) => {
          const target = (animation.effect as KeyframeEffect | null)?.target;
          return `${animation.constructor.name}:${(animation as CSSAnimation).animationName ?? ''} on ${target?.tagName ?? '?'}.${target?.className ?? ''}`;
        });
      const motion = (window as unknown as IosProbe).__motion?.debug() ?? { tickers: 0, tweens: 0 };
      return { flying, running, ...motion };
    });
  await expect
    .poll(
      async () => {
        const now = await state();
        return tickers ? now : { ...now, tickers: 0 };
      },
      { timeout: 15_000 },
    )
    .toEqual({ flying: 0, running: [], tickers: 0, tweens: 0 });
}

const rafCount = (page: Page) => page.evaluate(() => (window as unknown as IosProbe).__raf);

test('IOS-ID-03 no animation loop at rest; transform-only writes on the wallpaper and Home layers @perf', async ({
  page,
}) => {
  await instrumentIos(page);
  await page.goto('/ios');
  await iosAtRest(page);
  await page.waitForTimeout(2500); // the idle app warm-up and GSAP's auto-sleep (120 ticks) are behind us
  await iosAtRest(page);
  expect(await page.evaluate(() => (window as unknown as IosProbe).__motion?.debug())).toEqual({
    tickers: 0,
    tweens: 0,
  });
  const rafBefore = await rafCount(page);
  await page.waitForTimeout(2000);
  expect((await rafCount(page)) - rafBefore, 'animation frames requested at rest').toBe(0);
  expect(
    await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === 'running').length),
  ).toBe(0);

  // What follows the pointer and the flights (wallpaper, Home layer, dim veil, Dock layer) writes only
  // transform / opacity.
  await page.evaluate(() => {
    const home = document.querySelector('[data-home-layer]')!;
    const targets = [
      document.querySelector('[data-wallpaper]'),
      home,
      home.nextElementSibling, // the dim veil
      document.querySelector('[data-dock]')?.parentElement ?? null,
    ].filter((el): el is HTMLElement => el instanceof HTMLElement);
    const seen = new Set<string>();
    new MutationObserver(() => {
      for (const el of targets) for (let index = 0; index < el.style.length; index++) seen.add(el.style.item(index));
    }).observe(document.body, { attributes: true, attributeFilter: ['style'], subtree: true });
    (window as unknown as { __written: Set<string> }).__written = seen;
  });
  const viewport = page.viewportSize()!;
  for (let step = 0; step <= 8; step++)
    await page.mouse.move((viewport.width * step) / 8, (viewport.height * (8 - step)) / 8, { steps: 2 });
  // The wallpaper follows the pointer (±6 px), written on one ticker frame per move.
  await expect
    .poll(() => page.evaluate(() => (document.querySelector('[data-wallpaper]') as HTMLElement).style.transform))
    .toMatch(/^translate3d\((?!0px, 0px)/);
  await page.getByRole('group', { name: 'Home Screen' }).getByRole('link', { name: 'Safari' }).click();
  await expect(page.locator('[data-app-surface="browser"]')).toHaveAttribute('data-state', 'foreground');
  await page.keyboard.press('Alt+Shift+H');
  await expect(page.locator('[data-app-surface="browser"]')).toHaveAttribute('data-state', 'background');
  await iosAtRest(page);
  const written = await page.evaluate(() => [...(window as unknown as { __written: Set<string> }).__written]);
  expect(written.length, 'the layers were written').toBeGreaterThan(0);
  // `will-change` is not animated: it makes them layers while they move (shared/07 rule 5) and is cleared at rest.
  expect(
    written.filter((property) => property !== 'transform' && property !== 'opacity' && property !== 'will-change'),
  ).toEqual([]);
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          [
            document.querySelector('[data-wallpaper]'),
            document.querySelector('[data-home-layer]'),
            document.querySelector('[data-home-layer]')?.nextElementSibling,
            document.querySelector('[data-dock]')?.parentElement,
          ].map((el) => (el as HTMLElement | null)?.style.willChange ?? ''),
        ),
      { message: 'no layer is kept at rest' },
    )
    .toEqual(['', '', '', '']);

  // Input stopped: the parallax frame and the flights' ticker stop with it.
  await page.waitForTimeout(2500);
  const settled = await rafCount(page);
  await page.waitForTimeout(2000);
  expect((await rafCount(page)) - settled, 'frames requested after input stopped').toBe(0);
});

test('IOS-WIDG-04 no intervals/animations at rest: widgets are static per session @perf', async ({ page }) => {
  await instrumentIos(page);
  await page.goto('/ios');
  await iosAtRest(page);
  await expect(page.locator('[data-widgets-block]')).toBeVisible();
  await page.waitForTimeout(2500); // the idle app warm-up is behind us
  await iosAtRest(page);
  const start = await page.evaluate(() => ({
    at: performance.now(),
    text: (document.querySelector('[data-widgets-block]') as HTMLElement).innerText,
  }));
  await page.waitForTimeout(5000);
  const { timers, intervals, running, text } = await page.evaluate((from) => {
    const w = window as unknown as IosProbe;
    return {
      timers: w.__timers.filter((timer) => timer.at > from),
      intervals: [...w.__liveIntervals.values()],
      running: document.getAnimations().filter((animation) => animation.playState === 'running').length,
      text: (document.querySelector('[data-widgets-block]') as HTMLElement).innerText,
    };
  }, start.at);
  expect(intervals, 'live setInterval timers (delays)').toEqual([]);
  expect(running, 'running animations at rest').toBe(0);
  // The status-bar clock re-reads the time once a minute: one timeout to the next minute boundary (+ 50 ms).
  const minuteClock = (timer: { delay: number; wall: number }) =>
    Math.abs(timer.delay - (60_000 - (timer.wall % 60_000) + 50)) < 250;
  expect(
    timers.filter((timer) => !minuteClock(timer)).map((timer) => `${timer.kind} ${timer.delay} ms`),
    'timers scheduled at rest',
  ).toEqual([]);
  expect(text, 'widget content is static').toBe(start.text);
});

test('IOS-MOTION-04 no Layout > 1 ms inside a tagged iOS flight (open from an icon, go Home) @perf', async ({
  page,
  browser,
}) => {
  await page.addInitScript(() => window.sessionStorage.setItem('pf.debug.probe', '1'));
  await page.goto('/ios');
  await iosAtRest(page, { tickers: false });
  await page.waitForTimeout(2500); // the apps' chunks are warm: the flight measures motion, not the network
  const safari = page.getByRole('group', { name: 'Home Screen' }).getByRole('link', { name: 'Safari' });
  const app = page.locator('[data-app-surface="browser"]');
  await browser.startTracing(page, { categories: ['devtools.timeline', 'blink.user_timing'] });
  await safari.click();
  await expect(app).toHaveAttribute('data-state', 'foreground');
  await iosAtRest(page, { tickers: false });
  await page.locator('[data-home-indicator]').click();
  await expect(app).toHaveAttribute('data-state', 'background');
  await iosAtRest(page, { tickers: false });
  const trace = JSON.parse((await browser.stopTracing()).toString('utf8')) as {
    traceEvents: { name: string; ph: string; ts: number; dur?: number; cat: string }[];
  };
  const events = trace.traceEvents;
  const marks = events.filter((event) => /^pf-flight-(start|end):/.test(event.name)).sort((a, b) => a.ts - b.ts);
  const flights: { kind: string; from: number; to: number }[] = [];
  for (const mark of marks) {
    const [, edge, kind] = mark.name.match(/^pf-flight-(start|end):(.+)$/)!;
    if (edge === 'start') flights.push({ kind: kind!, from: mark.ts, to: Number.POSITIVE_INFINITY });
    else {
      const open = [...flights].reverse().find((f) => f.kind === kind && f.to === Number.POSITIVE_INFINITY);
      if (open) open.to = mark.ts;
    }
  }
  const finished = flights.filter((flight) => Number.isFinite(flight.to));
  const kinds = new Set(finished.map((flight) => flight.kind));
  const seen = marks.map((mark) => `${mark.name} (${mark.ph})`).join(', ') || 'no pf-flight marks';
  for (const kind of ['open', 'close'])
    expect(kinds.has(kind), `a finished ${kind} flight was traced — ${seen}`).toBe(true);
  const layouts = events.filter((event) => event.name === 'Layout' && event.ph === 'X' && event.dur !== undefined);
  // The app body is mounted deliberately at 90 % of the open flight (plans/ios/02 step 4) and lays itself out once.
  // That first layout is the mount's, not the animation's; everything else inside a flight must stay under 1 ms.
  const mounts = events.filter((event) => /^pf-app-mount:/.test(event.name)).map((event) => event.ts);
  const slow = layouts.filter(
    (layout) =>
      layout.dur! > 1000 &&
      finished.some((flight) => layout.ts > flight.from && layout.ts < flight.to) &&
      !mounts.some((mount) => layout.ts >= mount && layout.ts - mount < 120_000),
  );
  expect(mounts.length, 'the app body mount is marked (so its layout is attributable)').toBeGreaterThan(0);
  expect(
    slow.map((layout) => `${(layout.dur! / 1000).toFixed(2)} ms`),
    'layouts > 1 ms during a flight',
  ).toEqual([]);
});
