/**
 * "After first paint, in idle time" — the one scheduler for everything lazy on the welcome page (shared/10
 * `PERF-LAZY-01`: the kernel runtime, the intro sound, the motion chunk, analytics; the WebGL stage waits on it too).
 * The `load` event is not enough: on a slow phone it can fire long before the first paint, and an idle callback that
 * lands in between would put hundreds of KB on the wire ahead of the LCP. So this waits for both `load` and the first
 * contentful paint (Paint Timing; two frames where that API is missing), then for idle time. A page that never paints
 * (a background tab) proceeds after `fallbackMs` so nothing stays unloaded forever.
 */

interface IdleWindow {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
}

export interface AfterPaintOptions {
  readonly signal?: AbortSignal;
  /** Upper bound on the idle wait once painted (ms). */
  readonly idleTimeout?: number;
  /** Proceed anyway this long after `load` if no paint was observed (ms). */
  readonly fallbackMs?: number;
}

function onLoad(signal?: AbortSignal): Promise<void> {
  if (document.readyState === 'complete') return Promise.resolve();
  return new Promise((resolve) => window.addEventListener('load', () => resolve(), { once: true, signal }));
}

function firstContentfulPaint(fallbackMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      observer?.disconnect();
      resolve();
    };
    const timer = setTimeout(done, fallbackMs);
    signal?.addEventListener('abort', done, { once: true });
    let observer: PerformanceObserver | null = null;
    const supported =
      typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('paint');
    if (!supported) {
      requestAnimationFrame(() => requestAnimationFrame(done));
      return;
    }
    if (performance.getEntriesByType('paint').some((entry) => entry.name === 'first-contentful-paint')) return done();
    observer = new PerformanceObserver((list) => {
      if (list.getEntries().some((entry) => entry.name === 'first-contentful-paint')) done();
    });
    observer.observe({ type: 'paint', buffered: true });
  });
}

/** Runs `run` once, after `load` and the first contentful paint, in idle time. Aborting the signal cancels it. */
export function afterFirstPaint(run: () => void, options: AfterPaintOptions = {}): void {
  const { signal, idleTimeout = 2000, fallbackMs = 4000 } = options;
  void onLoad(signal)
    .then(() => firstContentfulPaint(fallbackMs, signal))
    .then(() => {
      if (signal?.aborted) return;
      const idle = (window as Window & IdleWindow).requestIdleCallback;
      if (idle) idle(() => !signal?.aborted && run(), { timeout: idleTimeout });
      else setTimeout(() => !signal?.aborted && run(), 200);
    });
}
