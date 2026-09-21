/**
 * Privacy-friendly analytics — shared/18. Everything goes through `AnalyticsPort`; tracking is fire-and-forget,
 * idle-loaded and lint-restricted to this folder. No cookies, no PII, no query text; DNT/GPC/Save-Data → `noop`.
 */
import type { OsRegistry, RoutePath, RouteState } from '@/lib/kernel/types';
import { routePath } from '@/lib/kernel/types';
import { refForLocation } from '@/lib/kernel/route/codec';
import { refSlug } from '@/data/schema';
import type { AnalyticsEvent, AnalyticsPort } from './events';

export type { AnalyticsEvent, AnalyticsPort } from './events';
export type AdapterName = 'vercel' | 'noop' | 'beacon';

export interface PrivacySignals {
  readonly doNotTrack: boolean;
  readonly globalPrivacyControl: boolean;
  readonly saveData: boolean;
  readonly production: boolean;
}

/** Automatic adapter selection (`ANL-PORT-01`). */
export function selectAdapter(signals: PrivacySignals): AdapterName {
  if (signals.doNotTrack || signals.globalPrivacyControl || signals.saveData || !signals.production) return 'noop';
  return 'vercel';
}

export function readPrivacySignals(win: Window, production: boolean): PrivacySignals {
  const navigator = win.navigator as Navigator & {
    globalPrivacyControl?: boolean;
    connection?: { saveData?: boolean };
  };
  return {
    doNotTrack: navigator.doNotTrack === '1' || (win as unknown as { doNotTrack?: string }).doNotTrack === '1',
    globalPrivacyControl: navigator.globalPrivacyControl === true,
    saveData: navigator.connection?.saveData === true,
    production,
  };
}

/** Test double: records calls in memory (shared/12 test doubles). */
export function createNoopAdapter(record?: { events: AnalyticsEvent[]; pageviews: RoutePath[] }): AnalyticsPort {
  return {
    track: (event) => void record?.events.push(event),
    pageview: (path) => void record?.pageviews.push(path),
  };
}

/**
 * The page-view path is the canonical `/go/*` form plus the OS, so content popularity is comparable across OSes:
 * `/macos/finder/experience/ibm` → `/macos/go/experience/ibm`.
 */
export function analyticsPath(route: RouteState, registry: OsRegistry): RoutePath {
  switch (route.kind) {
    case 'welcome':
      return routePath('/');
    case 'plain':
      return routePath('/plain');
    case 'go': {
      const slug = refSlug(route.ref);
      return routePath(`/go/${route.ref.section}${slug ? `/${slug}` : ''}`);
    }
    case 'os': {
      if (!route.focus) return routePath(`/${route.os}`);
      const ref = refForLocation(route.os, route.focus.role, route.focus.location, registry);
      if (!ref) return routePath(`/${route.os}/${route.focus.role}`);
      const slug = refSlug(ref);
      return routePath(`/${route.os}/go/${ref.section}${slug ? `/${slug}` : ''}`);
    }
    default: {
      const exhaustive: never = route;
      return exhaustive;
    }
  }
}

/**
 * Debounced page views (`ANL-PV-01`): a route committed and then echoed by a back-collapse within 300 ms counts once;
 * the same path twice in a row never double counts.
 */
export function createPageviewTracker(
  port: () => AnalyticsPort | null,
  {
    delayMs = 300,
    schedule = (callback: () => void, ms: number) => {
      const handle = setTimeout(callback, ms);
      return () => clearTimeout(handle);
    },
  }: { delayMs?: number; schedule?: (callback: () => void, ms: number) => () => void } = {},
) {
  let last: RoutePath | null = null;
  let pendingPath: RoutePath | null = null;
  let cancel: (() => void) | null = null;
  return {
    record(path: RoutePath) {
      pendingPath = path;
      cancel?.();
      cancel = schedule(() => {
        cancel = null;
        if (pendingPath && pendingPath !== last) {
          last = pendingPath;
          port()?.pageview(pendingPath);
        }
        pendingPath = null;
      }, delayMs);
    },
    dispose() {
      cancel?.();
      cancel = null;
    },
  };
}

/**
 * A port that buffers (bounded) until the real adapter is loaded on idle, then forwards. Calls never throw and never
 * block: analytics can never sit on a hot path.
 */
export function createDeferredPort(limit = 50): AnalyticsPort & { attach(port: AnalyticsPort): void } {
  let target: AnalyticsPort | null = null;
  const buffer: ({ kind: 'event'; event: AnalyticsEvent } | { kind: 'pv'; path: RoutePath })[] = [];
  const safe = (run: () => void) => {
    try {
      run();
    } catch {
      /* ad-blockers and offline: dropped silently */
    }
  };
  return {
    track(event) {
      if (target) safe(() => target!.track(event));
      else if (buffer.length < limit) buffer.push({ kind: 'event', event });
    },
    pageview(path) {
      if (target) safe(() => target!.pageview(path));
      else if (buffer.length < limit) buffer.push({ kind: 'pv', path });
    },
    attach(port) {
      target = port;
      for (const item of buffer.splice(0))
        safe(() => (item.kind === 'event' ? port.track(item.event) : port.pageview(item.path)));
    },
  };
}
