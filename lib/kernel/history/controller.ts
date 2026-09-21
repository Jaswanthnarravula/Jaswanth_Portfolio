/**
 * The history writer — shared/05. Exactly two primitives write history, both here:
 *   go(url)          same → no-op · equals `osk.prev` → `history.back()` (back-collapse) · else → push
 *   canonicalize(url) always replace
 * Traversal serialization (`ROUTE-SER-01`): `back()` is asynchronous, so writes queue until the echoed popstate
 * arrives, with a 500 ms failsafe that falls back to push. Push-rate degrade (`ROUTE-TERM-01`): more than 20 pushes in
 * 10 s become replaces (Safari throttles `pushState`).
 */
import { routePath, type RouteIntent, type RoutePath } from '../types';
import { readOsk, type HistoryPort } from './port';

export interface HistoryControllerOptions {
  readonly port: HistoryPort;
  /** A traversal the controller did not start (browser Back/Forward). Never called for our own echoes. */
  readonly onPop: (url: string) => void;
  readonly now?: () => number;
  readonly schedule?: (callback: () => void, ms: number) => () => void;
  readonly failsafeMs?: number;
  readonly rateLimit?: { readonly max: number; readonly windowMs: number };
}

export type HistoryOp = 'noop' | 'push' | 'back' | 'replace' | 'queued';

export interface HistoryController {
  go(url: RoutePath): HistoryOp;
  canonicalize(url: RoutePath): HistoryOp;
  write(intent: RouteIntent, url: RoutePath): HistoryOp;
  /** True while a `back()` we issued has not been echoed yet. */
  traversing(): boolean;
  dispose(): void;
}

const defaultSchedule = (callback: () => void, ms: number) => {
  const handle = setTimeout(callback, ms);
  return () => clearTimeout(handle);
};

export function createHistoryController({
  port,
  onPop,
  now = Date.now,
  schedule = defaultSchedule,
  failsafeMs = 500,
  rateLimit = { max: 20, windowMs: 10_000 },
}: HistoryControllerOptions): HistoryController {
  let pending: { target: string; cancel: () => void } | null = null;
  const queue: { op: 'go' | 'canonicalize'; url: RoutePath }[] = [];
  const pushTimes: number[] = [];

  const push = (url: RoutePath): HistoryOp => {
    const current = routePath(port.url());
    const osk = readOsk(port.state());
    const t = now();
    while (pushTimes.length && t - pushTimes[0]! > rateLimit.windowMs) pushTimes.shift();
    if (pushTimes.length >= rateLimit.max) {
      // Degrade: keep the URL correct without growing history.
      port.replace({ osk: { idx: osk?.idx ?? 0, prev: osk?.prev ?? null } }, url);
      return 'replace';
    }
    pushTimes.push(t);
    port.push({ osk: { idx: (osk?.idx ?? 0) + 1, prev: current } }, url);
    return 'push';
  };

  const drain = () => {
    while (!pending && queue.length) {
      const next = queue.shift()!;
      if (next.op === 'go') go(next.url);
      else canonicalize(next.url);
    }
  };

  function go(url: RoutePath): HistoryOp {
    if (pending) {
      queue.push({ op: 'go', url });
      return 'queued';
    }
    const current = port.url();
    if (url === current) return 'noop';
    const osk = readOsk(port.state());
    if (osk?.prev === url && osk.idx > 0) {
      const cancel = schedule(() => {
        // The echo never came (blocked traversal, Safari quirk): fall back to a push so the URL is still right.
        if (!pending) return;
        pending = null;
        if (port.url() !== url) push(url);
        drain();
      }, failsafeMs);
      pending = { target: url, cancel };
      port.back();
      return 'back';
    }
    return push(url);
  }

  function canonicalize(url: RoutePath): HistoryOp {
    if (pending) {
      queue.push({ op: 'canonicalize', url });
      return 'queued';
    }
    const osk = readOsk(port.state());
    port.replace({ osk: { idx: osk?.idx ?? 0, prev: osk?.prev ?? null } }, url);
    return 'replace';
  }

  const unlisten = port.listen(({ url }) => {
    if (pending) {
      const echo = pending;
      pending = null;
      echo.cancel();
      // A different URL means the visitor traversed at the same moment: that traversal wins.
      if (url !== echo.target) onPop(url);
      drain();
      return;
    }
    onPop(url);
  });

  return {
    go,
    canonicalize,
    write(intent, url) {
      if (intent === 'go') return go(url);
      if (intent === 'canonicalize') return canonicalize(url);
      return 'noop';
    },
    traversing: () => pending !== null,
    dispose() {
      pending?.cancel();
      pending = null;
      queue.length = 0;
      unlisten();
    },
  };
}
