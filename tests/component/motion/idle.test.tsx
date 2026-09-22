/**
 * PERF-LAZY-01 / NFLX-AUDIO-02 / ANL-LAZY-01 — `afterFirstPaint`: lazy work on the welcome page waits for `load` AND
 * the first contentful paint (on a slow phone `load` can come first), then idle time; aborting cancels it; a page
 * that never paints (background tab) proceeds after the fallback.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { afterFirstPaint } from '@/lib/motion/idle';

type PaintCallback = (list: { getEntries: () => { name: string }[] }) => void;

let observers: PaintCallback[] = [];
let painted = false;

class FakePaintObserver {
  static supportedEntryTypes = ['paint'];
  constructor(private readonly callback: PaintCallback) {}
  observe() {
    observers.push(this.callback);
  }
  disconnect() {
    observers = observers.filter((callback) => callback !== this.callback);
  }
}

const paint = () => {
  painted = true;
  for (const callback of [...observers]) callback({ getEntries: () => [{ name: 'first-contentful-paint' }] });
};

beforeEach(() => {
  vi.useFakeTimers();
  observers = [];
  painted = false;
  vi.stubGlobal('PerformanceObserver', FakePaintObserver);
  vi.spyOn(performance, 'getEntriesByType').mockImplementation(((type: string) =>
    type === 'paint' && painted ? [{ name: 'first-contentful-paint' }] : []) as typeof performance.getEntriesByType);
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'complete' });
  vi.stubGlobal('requestIdleCallback', (callback: () => void) => setTimeout(callback, 1));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete (document as unknown as { readyState?: unknown }).readyState;
});

const flush = async (ms = 0) => {
  await vi.advanceTimersByTimeAsync(ms);
};

describe('afterFirstPaint', () => {
  it('waits for the first contentful paint, then idle time', async () => {
    const run = vi.fn();
    afterFirstPaint(run);
    await flush(500);
    expect(run).not.toHaveBeenCalled(); // loaded, but nothing painted yet
    paint();
    await flush(5);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs at once (in idle time) when the page has already painted', async () => {
    painted = true;
    const run = vi.fn();
    afterFirstPaint(run);
    await flush(5);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('aborting cancels it', async () => {
    const run = vi.fn();
    const lifetime = new AbortController();
    afterFirstPaint(run, { signal: lifetime.signal });
    lifetime.abort();
    paint();
    await flush(5000);
    expect(run).not.toHaveBeenCalled();
  });

  it('a page that never paints proceeds after the fallback', async () => {
    const run = vi.fn();
    afterFirstPaint(run, { fallbackMs: 3000 });
    await flush(2990);
    expect(run).not.toHaveBeenCalled();
    await flush(20);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
