/** Click → first drawn frame of the flight → last frame, measured inside the page from the pointer event itself. */
import { chromium } from 'playwright';
const B = 'http://localhost:3510';
const browser = await chromium.launch();

const arm = (page) =>
  page.evaluate(() => {
    const w = window;
    w.__t = { press: 0, first: 0, last: 0, states: [] };
    addEventListener('pointerdown', () => (w.__t.press = performance.now()), true);
    addEventListener('keydown', () => (w.__t.press = performance.now()), true);
    new MutationObserver((records) => {
      const now = performance.now();
      for (const record of records) {
        const el = record.target;
        if (record.attributeName === 'data-visual') {
          if (!w.__t.first) w.__t.first = now;
          w.__t.last = now;
        }
        if (record.attributeName === 'data-state')
          w.__t.states.push(`${el.dataset.appSurface}:${el.dataset.state}@${Math.round(now - w.__t.press)}`);
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-visual', 'data-state'] });
  });

const read = (page) =>
  page.evaluate(() => ({
    first: Math.round(window.__t.first - window.__t.press),
    last: Math.round(window.__t.last - window.__t.press),
    states: window.__t.states,
  }));

const run = async (label, url, act) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => window.sessionStorage.setItem('pf.debug.probe', '1'));
  await page.goto(B + url, { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  await arm(page);
  await act(page);
  await page.waitForTimeout(2000);
  const t = await read(page);
  console.log(`${label.padEnd(16)} first frame ${String(t.first).padStart(4)}ms   last ${String(t.last).padStart(4)}ms   ${t.states.join(' ')}`);
  await ctx.close();
};

await run('open (click)', '/ios', (page) => page.getByRole('link', { name: /^GitHub/ }).first().click());
await run('home (key)', '/ios/github', async (page) => {
  await page.waitForTimeout(300);
  await page.keyboard.press('Alt+Shift+H');
});
await run('home (indicator)', '/ios/github', async (page) => {
  await page.waitForTimeout(300);
  await page.locator('[data-home-indicator]').click();
});
await browser.close();
