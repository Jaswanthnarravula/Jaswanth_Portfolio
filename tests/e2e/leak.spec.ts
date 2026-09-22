/**
 * `leak` project (nightly, shared/12) — PERF-LEAK-01 (shared/10 "Profiling procedure" step 4) on macOS: open and close
 * every app ×20, and enter/exit macOS ×5 (through history, same document); after a forced GC the JS heap grows < 2 MB,
 * the DOM node count and the window/document listener count are back where they started. Production build only.
 */
import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { committed } from './helpers';

const APPS = ['Finder', 'Safari', 'GitHub', 'Mail', 'Preview', 'Visual Studio Code', 'Terminal', 'System Settings'];

/**
 * Elements still reachable after a GC that are no longer in the document — the plan's "zero detached elements growth".
 * A total node count cannot see these: a window that is closed but still referenced keeps its whole subtree alive.
 */
async function detachedElements(cdp: CDPSession) {
  await cdp.send('Runtime.enable');
  const { result: proto } = await cdp.send('Runtime.evaluate', { expression: 'HTMLElement.prototype' });
  const { objects } = await cdp.send('Runtime.queryObjects', { prototypeObjectId: proto.objectId! });
  const { result, exceptionDetails } = await cdp.send('Runtime.callFunctionOn', {
    objectId: objects.objectId!,
    returnByValue: true,
    functionDeclaration: `function () {
      let detached = 0;
      const all = Array.prototype.slice.call(this);
      for (let i = 0; i < all.length; i++) {
        try {
          if (all[i] && all[i].isConnected === false) detached++;
        } catch {
          /* an element whose frame is gone: not ours to count */
        }
      }
      return detached;
    }`,
  });
  // Release both handles: the inspector keeps whatever `queryObjects` returned alive, so a kept handle would pin every
  // element that was live at the first measurement and report them as "detached" at the second.
  await cdp.send('Runtime.releaseObject', { objectId: objects.objectId! });
  await cdp.send('Runtime.releaseObject', { objectId: proto.objectId! });
  if (exceptionDetails || typeof result.value !== 'number')
    throw new Error(`counting detached elements failed: ${exceptionDetails?.exception?.description ?? 'no value'}`);
  return result.value;
}

async function measure(cdp: CDPSession, page: Page) {
  // Let any queued animation frame run first: a callback still in flight holds whatever it captured, which would read
  // as a leak (one pending focus frame keeps the tree it was about to focus into).
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  const detached = await detachedElements(cdp);
  let listeners = 0;
  for (const target of ['window', 'document']) {
    const { result } = await cdp.send('Runtime.evaluate', { expression: target });
    listeners += (await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId! })).listeners.length;
  }
  const { result } = await cdp.send('Runtime.evaluate', {
    expression: 'document.getElementsByTagName("*").length',
    returnByValue: true,
  });
  return { heap: usedSize, listeners, detached, nodes: result.value as number };
}

async function cycleApps(page: Page) {
  const dock = page.getByRole('navigation', { name: 'Dock' });
  for (const name of APPS) {
    await dock.getByRole('link', { name: new RegExp(`^${name}(, (open|running|minimized))?$`) }).click();
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
  test.setTimeout(420_000);
  // Enter macOS from Windows in the same document: Settings › Switch operating system (WIN-SET-05).
  await page.goto('/windows/settings');
  const settings = page.locator('[data-window="windows:settings"]');
  await settings
    .getByRole('navigation', { name: 'Settings' })
    .getByRole('button', { name: 'Switch operating system', exact: true })
    .click({ timeout: 15_000 });
  await settings.getByRole('link', { name: 'Switch to macOS' }).click();
  await expect(page.locator('[data-os-shell="macos"]')).toBeAttached({ timeout: 15_000 });
  const cdp = await page.context().newCDPSession(page);
  // Leave macOS for Windows through history (the macOS tree unmounts; its session is parked), then enter again.
  const exitAndEnter = async () => {
    await page.goBack();
    await expect(page.locator('[data-os-shell="windows"]')).toBeAttached();
    await page.goForward();
    await expect(page.locator('[data-os-shell="macos"]')).toBeAttached();
  };
  // Warm until V8 has compiled and optimised these paths: the first pass over eight app chunks adds ~1.2 MB of
  // compiled code (`code:system / InstructionStream` in a snapshot diff), which tapers to ~0.05 MB by the fourth
  // pass. Measuring from a cold baseline would report that warm-up as a leak.
  for (let i = 0; i < 3; i++) await cycleApps(page);
  await exitAndEnter();
  const before = await measure(cdp, page);

  // The history round trips come first: every close collapses back to the entry after /windows, but past 20 pushes in
  // 10 s the router degrades push to replace (shared/05, Safari's limit), and the app loop below opens 160 windows.
  for (let i = 0; i < 5; i++) await exitAndEnter();
  for (let i = 0; i < 20; i++) await cycleApps(page);
  const after = await measure(cdp, page);
  const grownMb = (after.heap - before.heap) / 1024 / 1024;
  console.log(
    `PERF-LEAK-01: heap +${grownMb.toFixed(2)} MB of 2 · listeners ${after.listeners - before.listeners} · ` +
      `DOM ${after.nodes - before.nodes} · detached ${after.detached - before.detached}`,
  );
  expect(grownMb, `heap growth ${grownMb.toFixed(2)} MB`).toBeLessThan(2);
  expect(after.listeners).toBe(before.listeners);
  expect(Math.abs(after.nodes - before.nodes)).toBeLessThanOrEqual(10);
  expect(after.detached - before.detached, 'detached elements kept alive').toBeLessThanOrEqual(0);
});
