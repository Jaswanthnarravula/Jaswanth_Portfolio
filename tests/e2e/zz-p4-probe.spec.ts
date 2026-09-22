import { test, type Page } from '@playwright/test';

const BASE = process.env.PROBE_BASE ?? 'http://localhost:3141';

/** pointerdown → URL changed, and → the window's DOM stopped changing and no animation runs (two quiet frames). */
async function timeNav(page: Page, click: () => Promise<void>, sel: string) {
  await page.evaluate((sel) => {
    const w = window as unknown as { __n: Record<string, number> };
    w.__n = {};
    const start = location.pathname;
    let quiet = 0;
    let last = performance.now();
    const target = document.querySelector(sel)!;
    new MutationObserver(() => (last = performance.now())).observe(target, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    const tick = () => {
      const now = performance.now();
      if (!w.__n.url && location.pathname !== start) w.__n.url = now;
      const animating = document.getAnimations().some((a) => a.playState === 'running');
      quiet = now - last > 32 && !animating ? quiet + 1 : 0;
      if (w.__n.url && quiet >= 2) w.__n.done = last;
      else requestAnimationFrame(tick);
    };
    document.addEventListener('pointerdown', () => ((w.__n.down = performance.now()), requestAnimationFrame(tick)), {
      capture: true,
      once: true,
    });
  }, sel);
  await click();
  await page.waitForFunction(() => !!(window as unknown as { __n: Record<string, number> }).__n.done, null, {
    timeout: 20000,
  });
  const n = await page.evaluate(() => (window as unknown as { __n: Record<string, number> }).__n);
  return `url +${Math.round(n.url! - n.down!)}ms · content settled +${Math.round(n.done! - n.down!)}ms`;
}

test('windows explorer navigation', async ({ page }) => {
  await page.goto(`${BASE}/windows/explorer`);
  await page.waitForSelector('[data-window="windows:files"]');
  await page.waitForTimeout(process.env.PROBE_BASE ? 6000 : 1500);
  const win = page.locator('[data-window="windows:files"]');
  for (const place of ['Experience', 'Education', 'Home'])
    console.log(
      `EXPLORER → ${place}`,
      await timeNav(page, () => win.getByRole('navigation').getByRole('link', { name: place, exact: true }).click(), '[data-window="windows:files"]'),
    );
});

test('macos finder navigation', async ({ page }) => {
  await page.goto(`${BASE}/macos/finder`);
  await page.waitForSelector('[data-window="macos:files"]');
  await page.waitForTimeout(process.env.PROBE_BASE ? 6000 : 1500);
  const win = page.locator('[data-window="macos:files"]');
  const links = await win.getByRole('link').allTextContents();
  console.log('FINDER links', JSON.stringify(links.slice(0, 12)));
  for (const place of ['Education', 'Experience'])
    console.log(
      `FINDER → ${place}`,
      await timeNav(page, () => win.getByRole('link', { name: new RegExp(`^${place}`) }).first().click(), '[data-window="macos:files"]'),
    );
});
