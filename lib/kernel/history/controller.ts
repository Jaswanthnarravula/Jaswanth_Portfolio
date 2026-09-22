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
  /**
   * addition (plans/windows/04 `WIN-RESP-04`, shared/05 "Mobile rule"): a transient sheet (Start, Search in compact
   * mode) pushes one same-URL entry, so the browser/system Back closes the sheet (`onBack`) instead of navigating.
   * The returned `release` drops the entry when the sheet closes any other way — call it *before* the action that
   * follows (opening an app), so that app's `go()` queues behind the step back and history never keeps the entry.
   */
  transient(onBack: () => void): () => void;
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
    if (sheet && current === sheet.url && osk?.idx === sheet.idx) {
      // Navigating while a sheet's entry is on top: the new place takes that entry (history never keeps it).
      sheet = null;
      port.replace({ osk: { idx: osk.idx, prev: routePath(current) } }, url);
      return 'replace';
    }
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

  /** The transient entry on top of history, if any (one sheet at a time). */
  let sheet: { idx: number; url: string; onBack: () => void } | null = null;

  function transient(onBack: () => void): () => void {
    // Mid-traversal there is no stable entry to stack on: the sheet simply has no Back entry.
    if (pending || sheet) return () => undefined;
    const url = port.url();
    const idx = (readOsk(port.state())?.idx ?? 0) + 1;
    port.push({ osk: { idx, prev: routePath(url) } }, url);
    const entry = { idx, url, onBack };
    sheet = entry;
    return () => {
      if (sheet !== entry) return; // Back already consumed it
      sheet = null;
      if (port.url() !== url || readOsk(port.state())?.idx !== idx) return;
      // Step back over our entry; writes that follow queue until the echo, which is swallowed.
      const cancel = schedule(() => {
        if (!pending) return;
        pending = null;
        drain();
      }, failsafeMs);
      pending = { target: url, cancel };
      port.back();
    };
  }

  const unlisten = port.listen(({ url, state }) => {
    if (pending) {
      const echo = pending;
      pending = null;
      echo.cancel();
      // A different URL means the visitor traversed at the same moment: that traversal wins.
      if (url !== echo.target) onPop(url);
      drain();
      return;
    }
    if (sheet) {
      const entry = sheet;
      sheet = null;
      // Back from the sheet's entry lands on the same URL one step down: close the sheet, navigate nowhere.
      if (url === entry.url && (readOsk(state)?.idx ?? 0) === entry.idx - 1) {
        entry.onBack();
        return;
      }
    }
    onPop(url);
  });

  return {
    go,
    canonicalize,
    transient,
    write(intent, url) {
      if (intent === 'go') return go(url);
      if (intent === 'canonicalize') return canonicalize(url);
      return 'noop';
    },
    traversing: () => pending !== null,
    dispose() {
      pending?.cancel();
      pending = null;
      sheet = null;
      queue.length = 0;
      unlisten();
    },
  };
}
