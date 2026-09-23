import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.addInitScript(() => window.sessionStorage.setItem('pf.debug.probe', '1'));
await page.goto('http://localhost:3510/ios', { waitUntil: 'load' });
await page.waitForTimeout(3000);
const files = page.getByRole('navigation', { name: 'Dock' }).getByRole('link', { name: 'Files, Résumé' });
await files.focus();
await page.keyboard.press('Shift+F10');
await page.getByRole('menuitem', { name: /Download Résumé/ }).click();
const banner = page.locator('[data-banner="resume-saved"]');
await banner.waitFor();
await page.waitForTimeout(1200);
console.log('surface before:', await page.evaluate(() => {
  const el = document.querySelector('[data-app-surface="files"]');
  return el ? `${el.dataset.state} visual=${el.dataset.visual}` : 'not mounted';
}));
console.log('banner rect:', JSON.stringify(await banner.boundingBox()));
await page.evaluate(() => {
  window.__v = [];
  new MutationObserver((rs) => {
    for (const r of rs)
      if (r.attributeName === 'data-visual' && r.target.dataset.appSurface === 'files')
        window.__v.push(r.target.dataset.visual);
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-visual'] });
});
await banner.getByText('Résumé.pdf saved', { exact: true }).click();
await page.waitForTimeout(1500);
console.log('first visuals:', (await page.evaluate(() => window.__v)).slice(0, 3));
await browser.close();
