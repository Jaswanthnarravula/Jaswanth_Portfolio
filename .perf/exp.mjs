import { chromium } from 'playwright';
const B = 'http://localhost:3510';
const browser = await chromium.launch();
const measure = async (label, css) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => window.sessionStorage.setItem('pf.debug.probe', '1'));
  await page.goto(B + '/ios', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  if (css) await page.addStyleTag({ content: css });
  await page.evaluate(() => {
    const w = window;
    w.__f = [];
    let last = 0;
    const tick = (t) => {
      if (last) w.__f.push(Math.round((t - last) * 10) / 10);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const t0 = Date.now();
  await page.getByRole('link', { name: /^GitHub/ }).first().click();
  await page.waitForFunction(() => !!document.querySelector('[data-app-surface="github"][data-state="foreground"]'));
  const settled = Date.now() - t0;
  const f = await page.evaluate(() => window.__f.filter((d) => d > 0).sort((a, b) => a - b));
  console.log(
    `${label.padEnd(34)} settled ${String(settled).padStart(4)}ms  median ${f[Math.floor(f.length / 2)]}ms  worst ${f[f.length - 1]}ms  n=${f.length}`,
  );
  await ctx.close();
};
await measure('as built');
await measure('app content hidden in flight', '[data-app-surface][data-state="opening"] [data-app-content]{visibility:hidden}');
await measure('no clip-path (transform only)', '[data-app-surface]{clip-path:none !important}');
await measure('both', '[data-app-surface][data-state="opening"] [data-app-content]{visibility:hidden}[data-app-surface]{clip-path:none !important}');
await browser.close();
