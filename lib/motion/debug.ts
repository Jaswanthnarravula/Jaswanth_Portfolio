/**
 * Motion and render probes for the leak and drag acceptance tests (shared/07 "Leak rules": `__motion.debug()` reports
 * an empty set when idle; `MOTION-DRAG-01`: zero React renders during a drag). Off unless the session flag
 * `pf.debug.probe` is set (tests set it through an init script), so production pays one boolean check.
 *   window.__motion.debug() → { tickers, tweens }   live ticker callbacks and active GSAP tweens
 *   window.__pfProbe         → { [name]: count }     counters (window renders, kernel actions, commits …)
 */

let enabled: boolean | null = null;
let tickers = 0;

/** True when the probe session flag is on (read once). */
export function probeEnabled(): boolean {
  if (enabled !== null) return enabled;
  try {
    enabled = typeof window !== 'undefined' && window.sessionStorage.getItem('pf.debug.probe') === '1';
  } catch {
    enabled = false;
  }
  return enabled;
}

type ProbeWindow = Window & {
  __pfProbe?: Record<string, number>;
  __motion?: { debug(): { tickers: number; tweens: number } };
};

/** Count an event (a window render, a kernel action). No-op unless probing. */
export function probe(name: string, amount = 1): void {
  if (!probeEnabled()) return;
  const w = window as ProbeWindow;
  const counts = (w.__pfProbe ??= {});
  counts[name] = (counts[name] ?? 0) + amount;
}

/** Bookkeeping for every ticker callback the motion layer adds, so a leak check can see what is still running. */
export function tickerAdded(): void {
  tickers++;
}
export function tickerRemoved(): void {
  tickers = Math.max(0, tickers - 1);
}
export const liveTickers = (): number => tickers;

/** Install `window.__motion.debug()` (probing only). `activeTweens` reads GSAP's global timeline. */
export function exposeMotionDebug(activeTweens: () => number): void {
  if (!probeEnabled()) return;
  (window as ProbeWindow).__motion = { debug: () => ({ tickers, tweens: activeTweens() }) };
}
