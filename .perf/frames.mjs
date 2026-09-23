/** Frame intervals *inside* the flight only (press → the surface reaching its end state). */
import { chromium } from 'playwright';
const B = 'http://localhost:3510';
const browser = await chromium.launch({ headless: false });

const run = async (label, url, act, endState, css) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => window.sessionStorage.setItem('pf.debug.probe', '1'));
  await page.goto(B + url, { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  if (css) await page.addStyleTag({ content: css });
  await page.evaluate((end) => {
    const w = window;
    w.__r = { press: 0, stop: 0, times: [] };
    const start = () => (w.__r.press = performance.now());
    addEventListener('pointerdown', start, true);
    addEventListener('keydown', start, true);
    const tick = (t) => {
      if (w.__r.press && !w.__r.stop) w.__r.times.push(t);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    new MutationObserver(() => {
      if (document.querySelector(end) && w.__r.press && !w.__r.stop) w.__r.stop = performance.now();
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-state','data-phase'] });
  }, endState);
  await act(page);
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const t = window.__r.times;
    const deltas = [];
    for (let i = 1; i < t.length; i++) if (t[i] <= window.__r.stop) deltas.push(Math.round((t[i] - t[i - 1]) * 10) / 10);
    const sorted = [...deltas].sort((a, b) => a - b);
    return {
      n: deltas.length,
      median: sorted[Math.floor(sorted.length / 2)],
      worst: sorted[sorted.length - 1],
      over20: deltas.filter((d) => d > 20).length,
      flightMs: Math.round(window.__r.stop - window.__r.press),
    };
  });
  console.log(
    `${label.padEnd(16)} flight ${String(r.flightMs).padStart(4)}ms  frames ${String(r.n).padStart(3)}  median ${r.median}ms  worst ${r.worst}ms  >20ms ${r.over20}`,
  );
  await ctx.close();
};

await run(
  'iOS open',
  '/ios',
  (page) => page.getByRole('link', { name: /^GitHub/ }).first().click(),
  '[data-app-surface="github"][data-state="foreground"]',
);
await run('macOS open', '/macos', (p)=>p.getByRole('navigation',{name:'Dock'}).getByRole('link',{name:/^Finder/}).click(), '[data-window="macos:files"][data-phase="normal"]');
await browser.close();
