/**
 * Measures how an app open *feels*: press → first painted frame, frame intervals during the flight, long tasks, and
 * when the animation settles. Runs the same measurement for iOS, macOS and Windows so they can be compared.
 */
import { chromium } from 'playwright';

const B = process.env.PERF_BASE || 'http://localhost:3510';
const browser = await chromium.launch();

const instrument = async (page) => {
  await page.evaluate(() => {
    const w = window;
    w.__perf = { frames: [], long: [], marks: {} };
    let last = 0;
    const tick = (t) => {
      if (last) w.__perf.frames.push(Math.round((t - last) * 10) / 10);
      last = t;
      w.__perf.raf = requestAnimationFrame(tick);
    };
    w.__perf.raf = requestAnimationFrame(tick);
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) w.__perf.long.push(Math.round(entry.duration));
      }).observe({ entryTypes: ['longtask'] });
    } catch {
      /* not supported */
    }
  });
};

const summary = async (page) =>
  page.evaluate(() => {
    const f = window.__perf.frames.filter((d) => d > 0);
    const long = window.__perf.long;
    const over = f.filter((d) => d > 20).length;
    return {
      frames: f.length,
      medianMs: f.sort((a, b) => a - b)[Math.floor(f.length / 2)] ?? 0,
      worstMs: f.length ? f[f.length - 1] : 0,
      framesOver20ms: over,
      longTasks: long,
    };
  });

const run = async (label, url, open, settled) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => window.sessionStorage.setItem('pf.debug.probe', '1'));
  await page.goto(B + url, { waitUntil: 'load' });
  await page.waitForTimeout(3500); // chunks warm, idle work done
  await instrument(page);
  const t0 = Date.now();
  await open(page);
  const firstFrame = await page
    .waitForFunction(settled.firstFrame, null, { timeout: 15000 })
    .then(() => Date.now() - t0)
    .catch(() => -1);
  const done = await page
    .waitForFunction(settled.done, null, { timeout: 15000 })
    .then(() => Date.now() - t0)
    .catch(() => -1);
  const s = await summary(page);
  console.log(
    `${label.padEnd(18)} firstFrame ${String(firstFrame).padStart(4)}ms  settled ${String(done).padStart(4)}ms  ` +
      `median ${s.medianMs}ms  worst ${s.worstMs}ms  frames>20ms ${s.framesOver20ms}  longTasks ${JSON.stringify(s.longTasks)}`,
  );
  await ctx.close();
};

await run(
  'iOS open app',
  '/ios',
  async (page) => page.getByRole('link', { name: /^GitHub/ }).first().click(),
  {
    firstFrame: () => !!document.querySelector('[data-app-surface="github"][data-state="opening"]'),
    done: () => !!document.querySelector('[data-app-surface="github"][data-state="foreground"]'),
  },
);
await run(
  'iOS go home',
  '/ios/github',
  async (page) => {
    await page.waitForTimeout(400);
    await page.keyboard.press('Alt+Shift+H');
  },
  {
    firstFrame: () => !!document.querySelector('[data-app-surface="github"][data-state="closing"]'),
    done: () => !!document.querySelector('[data-app-surface="github"][data-state="background"]'),
  },
);
await run(
  'macOS open window',
  '/macos',
  async (page) => page.getByRole('navigation', { name: 'Dock' }).getByRole('link', { name: /^Finder/ }).click(),
  {
    firstFrame: () => !!document.querySelector('[data-window="macos:files"]'),
    done: () => !!document.querySelector('[data-window="macos:files"][data-phase="normal"]'),
  },
);

await browser.close();
