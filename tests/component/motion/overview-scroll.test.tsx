/**
 * `attachOverviewScroll` leaves nothing behind — PERF-LEAK-01 (shared/10 "Leak rules") for the one place the product
 * uses Lenis + ScrollTrigger (`MOTION-SCROLL-01`, `MAC-SAF-03/06`). ScrollTrigger caches every scroller it is given in
 * one module-level array and never drops an entry, so a browser window opened and closed 160 times in the leak loop
 * held 160 detached Overview pages (~107 KB each). The cleanup must remove its own entry.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachOverviewScroll, scrollerCache } from '@/lib/motion/overview-scroll';

/** Lenis measures with a ResizeObserver, which jsdom does not implement. */
function resizeObserver() {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
}

function finePointer() {
  resizeObserver();
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query.includes('pointer: fine'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

/** One open/close of a browser window: a fresh scroller, effects attached, then the window's cleanup. */
async function openAndClose() {
  const scroller = document.createElement('div');
  const content = document.createElement('div');
  scroller.append(content);
  document.body.append(scroller);
  const cleanup = await attachOverviewScroll(scroller, ({ gsap, ScrollTrigger }) => {
    ScrollTrigger.create({ trigger: content, scroller, animation: gsap.to(content, { opacity: 1 }) });
  });
  const cache = await scrollerCache();
  const attachedAt = cache.indexOf(scroller);
  cleanup();
  scroller.remove();
  return { scroller, attachedAt, cache };
}

afterEach(() => vi.unstubAllGlobals());

describe('PERF-LEAK-01 the Overview scroll effects release their scroller', () => {
  it('caches the scroller while attached, on the three-slot layout the cleanup assumes', async () => {
    finePointer();
    const { attachedAt } = await openAndClose();
    expect(attachedAt, 'ScrollTrigger cached this scroller').toBeGreaterThanOrEqual(0);
    expect(attachedAt % 3, '[element, verticalFn, horizontalFn] triples').toBe(0);
  });

  it('drops that entry on cleanup, so repeated opens never grow the cache', async () => {
    finePointer();
    const first = await openAndClose();
    expect(first.cache).not.toContain(first.scroller);
    const length = first.cache.length;
    for (let i = 0; i < 5; i++) {
      const { scroller, cache } = await openAndClose();
      expect(cache).not.toContain(scroller);
      expect(cache.length).toBe(length);
    }
  });

  it('downloads nothing and caches nothing when the gate says no (coarse pointer)', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query }) as MediaQueryList);
    const cache = await scrollerCache();
    const before = cache.length;
    const scroller = document.createElement('div');
    document.body.append(scroller);
    (await attachOverviewScroll(scroller, () => expect.unreachable('setup must not run')))();
    expect(cache.length).toBe(before);
    scroller.remove();
  });
});
