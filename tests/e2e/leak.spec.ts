/**
 * `leak` project (nightly, shared/12) — PERF-LEAK-01 (shared/10 "Profiling procedure" step 4) on macOS: open and close
 * every app ×20, and enter/exit macOS ×5 (through history, same document); after a forced GC the JS heap grows < 2 MB,
 * the DOM node count and the window/document listener count are back where they started. Production build only.
 */
import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { committed } from './helpers';

const APPS = ['Finder', 'Safari', 'GitHub', 'Mail', 'Preview', 'Visual Studio Code', 'Terminal', 'System Settings'];

async function measure(cdp: CDPSession) {
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  let listeners = 0;
  for (const target of ['window', 'document']) {
    const { result } = await cdp.send('Runtime.evaluate', { expression: target });
    listeners += (await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId! })).listeners.length;
  }
  const { result } = await cdp.send('Runtime.evaluate', {
    expression: 'document.getElementsByTagName("*").length',
    returnByValue: true,
  });
  return { heap: usedSize, listeners, nodes: result.value as number };
}

async function cycleApps(page: Page) {
  const dock = page.getByRole('navigation', { name: 'Dock' });
  for (const name of APPS) {
    await dock.getByRole('link', { name: new RegExp(`^${name}(, open)?$`) }).click();
    await committed(page);
    await expect(page.locator('[data-window][data-phase="opening"]')).toHaveCount(0);
  }
  while ((await page.locator('[data-window]').count()) > 0) {
    await page.keyboard.press('Alt+Shift+W'); // close the focused window
    await committed(page);
    await expect(page.locator('[data-window][data-phase="closing"]')).toHaveCount(0);
  }
}

test('PERF-LEAK-01 macOS leak loop: heap < 2 MB growth; DOM and listeners stable', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/windows');
  await expect(page.locator('[data-os-shell="windows"]')).toBeAttached({ timeout: 15_000 });
  await page
    .getByRole('navigation', { name: 'Switch operating system' })
    .getByRole('button', { name: 'macOS' })
    .click();
  await expect(page.locator('[data-os-shell="macos"]')).toBeAttached({ timeout: 15_000 });
  const cdp = await page.context().newCDPSession(page);
  // Leave macOS for the Windows stub through history (the macOS tree unmounts; its session is parked), then enter again.
  const exitAndEnter = async () => {
    await page.goBack();
    await expect(page.locator('[data-os-shell="windows"]')).toBeAttached();
    await page.goForward();
    await expect(page.locator('[data-os-shell="macos"]')).toBeAttached();
  };
  await cycleApps(page); // warm every chunk and code path once
  await exitAndEnter();
  const before = await measure(cdp);

  // The history round trips come first: every close collapses back to the entry after /windows, but past 20 pushes in
  // 10 s the router degrades push to replace (shared/05, Safari's limit), and the app loop below opens 160 windows.
  for (let i = 0; i < 5; i++) await exitAndEnter();
  for (let i = 0; i < 20; i++) await cycleApps(page);
  const after = await measure(cdp);
  const grownMb = (after.heap - before.heap) / 1024 / 1024;
  expect(grownMb, `heap growth ${grownMb.toFixed(2)} MB`).toBeLessThan(2);
  expect(after.listeners).toBe(before.listeners);
  expect(Math.abs(after.nodes - before.nodes)).toBeLessThanOrEqual(10);
});
