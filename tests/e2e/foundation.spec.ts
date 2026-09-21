/**
 * P0 foundation checks — PERF-TIER-01 (attributes before first paint) · A11Y-SKIP-01 (skip link first) ·
 * ARCH-HYDR-01 (zero hydration warnings with populated storage) · ARCH-FIX-01 (viewport meta, safe-area tokens) ·
 * DATA-RESUME-01 (PDF served) · P1 persistence smoke · KRN-PERSIST-01 (corrupt storage never breaks boot) ·
 * OG-GEN-01 (every /go route has its card).
 */
import { expect, test } from '@playwright/test';
import { waitForOs } from './helpers';

test('tier / motion / glass attributes are set before first paint', async ({ page }) => {
  await page.addInitScript(() => {
    // Record the attributes as soon as <body> exists — before any paint.
    const observer = new MutationObserver(() => {
      if (document.body && !(window as unknown as { __attrs?: unknown }).__attrs) {
        const root = document.documentElement;
        (window as unknown as { __attrs: unknown }).__attrs = {
          tier: root.dataset.tier,
          motion: root.dataset.motion,
          glass: root.dataset.glass,
        };
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  await page.goto('/plain');
  const attrs = await page.evaluate(() => (window as unknown as { __attrs: Record<string, string> }).__attrs);
  expect(['0', '1']).toContain(attrs.tier);
  expect(['full', 'reduced']).toContain(attrs.motion);
  expect(['full', 'solid']).toContain(attrs.glass);
});

test('in-app motion preference applies before paint on reload', async ({ page }) => {
  await page.goto('/plain');
  await page.evaluate(() =>
    localStorage.setItem(
      'pf.prefs.v1',
      JSON.stringify({ state: { motion: 'reduced', glass: 'solid', theme: 'light' }, version: 1 }),
    ),
  );
  await page.reload();
  expect(await page.evaluate(() => ({ ...document.documentElement.dataset }))).toMatchObject({
    motion: 'reduced',
    glass: 'solid',
    theme: 'light',
  });
});

for (const path of ['/', '/plain', '/go/projects', '/macos', '/linux/terminal/projects']) {
  test(`first Tab focuses "Skip the OS" on ${path}`, async ({ page }, info) => {
    test.skip(
      info.project.name === 'iphone' || info.project.name === 'ipad-portrait' || info.project.name === 'ipad-landscape',
      'WebKit Tab skips links unless Option is held (platform behaviour)',
    );
    await page.goto(path);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip the OS: plain portfolio' })).toBeFocused();
    await expect(page.getByRole('link', { name: 'Skip the OS: plain portfolio' })).toHaveAttribute('href', '/plain');
  });
}

test('reload with populated storage logs zero hydration warnings', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/hydrat|did not match|server rendered/i.test(text)) problems.push(text);
  });
  page.on('pageerror', (error) => problems.push(error.message));
  await page.goto('/macos/github');
  await waitForOs(page, 'macos');
  await page.getByRole('link', { name: 'Mail' }).click();
  await expect(page).toHaveURL(/\/macos\/mail$/);
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 400))); // debounced write lands
  await page.reload();
  await waitForOs(page, 'macos');
  await expect(page.getByRole('region', { name: 'Mail' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'GitHub' })).toBeVisible(); // restored from the session
  expect(problems).toEqual([]);
});

test('corrupt storage never breaks boot (defaults are used)', async ({ page }) => {
  await page.goto('/plain');
  await page.evaluate(() => {
    localStorage.setItem('pf.prefs.v1', '{not json');
    localStorage.setItem('pf.sessions.v1', '[1,2,');
  });
  await page.goto('/macos/finder');
  await waitForOs(page, 'macos');
  await expect(page.getByRole('region', { name: 'Finder' })).toBeVisible();
});

test('viewport meta keeps zoom enabled, covers the safe areas and resizes for the keyboard', async ({ page }) => {
  await page.goto('/');
  const content = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(content).toContain('viewport-fit=cover');
  expect(content).toContain('interactive-widget=resizes-content');
  expect(content).not.toMatch(/maximum-scale|user-scalable=no/);
  // Safe-area tokens resolve through env() (the emulator reports 0 px; real notches report their inset).
  const token = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sa-t').trim());
  expect(token).toMatch(/^(env\(safe-area-inset-top, 0px\)|\d+(\.\d+)?px)$/);
});

test('the résumé PDF is served with the right type and caching', async ({ request }) => {
  const response = await request.get('/resume/jaswanth-narravula-resume.pdf');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/pdf');
  const body = await response.body();
  expect(body.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');
});

test('every /go route in the sitemap points at its own Open Graph PNG', async ({ request }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text();
  const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => new URL(match[1]!).pathname)
    .filter((path) => path.startsWith('/go'));
  expect(paths.length).toBeGreaterThan(10);
  const cards = new Set<string>();
  for (const path of paths) {
    const html = await (await request.get(path)).text();
    const image = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
    expect(image, path).toBeTruthy();
    const card = new URL(image!).pathname;
    cards.add(card);
    const response = await request.get(card);
    expect(response.status(), card).toBe(200);
    expect(response.headers()['content-type'], card).toBe('image/png');
  }
  expect(cards.size, 'each content route has its own card').toBe(paths.length);
});

test('safe-area tokens are non-zero on a notched phone and pad the reader header', async ({
  page,
  browserName,
}, info) => {
  test.skip(
    browserName !== 'chromium' || !info.project.use.isMobile,
    'Only Chromium can emulate a notch (CDP); WebKit emulation always reports 0 px — the token wiring is checked above',
  );
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34, left: 0, right: 0 } });
  await page.goto('/plain');
  const measured = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;padding:var(--sa-t) var(--sa-r) var(--sa-b) var(--sa-l)';
    document.body.append(probe);
    const style = getComputedStyle(probe);
    const header = document.querySelector('.doc-top');
    return {
      top: style.paddingTop,
      bottom: style.paddingBottom,
      header: header ? getComputedStyle(header).paddingTop : null,
    };
  });
  expect(measured).toEqual({ top: '47px', bottom: '34px', header: '59px' });
});

test('DEPLOY-HDR-01 cache and security headers on the production build', async ({ request, page }) => {
  const home = await request.get('/');
  const headers = home.headers();
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toMatch(/camera=\(\).*microphone=\(\).*geolocation=\(\)/);
  expect(headers['x-frame-options']).toBe('DENY');
  const csp = headers['content-security-policy'] ?? '';
  for (const directive of ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'"])
    expect(csp).toContain(directive);
  const pdf = await request.get('/resume/jaswanth-narravula-resume.pdf');
  expect(pdf.headers()['cache-control']).toBe('public, max-age=3600');
  expect(pdf.headers()['content-disposition']).toBe('inline');
  await page.goto('/');
  const assets = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((e) => new URL(e.name).pathname)
      .filter((path) => path.startsWith('/assets/') || path.startsWith('/_next/static/')),
  );
  expect(assets.length).toBeGreaterThan(0);
  for (const path of [assets.find((p) => p.startsWith('/assets/')), assets.find((p) => p.startsWith('/_next/static/'))])
    if (path)
      expect((await request.get(path)).headers()['cache-control'], path).toBe('public, max-age=31536000, immutable');
});

test('DEPLOY-PREV-01 preview deployments carry noindex', async ({ request }) => {
  // The e2e builds are previews (VERCEL_ENV=preview); production.spec checks the converse.
  expect((await request.get('/')).headers()['x-robots-tag']).toBe('noindex, nofollow');
});
