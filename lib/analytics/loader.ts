/**
 * Idle loader — shared/18 `ANL-LAZY-01`: nothing loads before first paint; the adapter is chosen automatically and
 * imported on `requestIdleCallback`. Only this folder may call a tracking SDK (lint-enforced).
 */
import { publicEnv } from '@/lib/config/environment';
import type { RoutePath } from '@/lib/kernel/types';
import { createDeferredPort, createNoopAdapter, readPrivacySignals, selectAdapter } from './index';

export const analytics = createDeferredPort();

let started = false;

export function startAnalytics(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const load = async () => {
    const adapter = selectAdapter(readPrivacySignals(window, publicEnv.production));
    if (adapter === 'noop') {
      analytics.attach(createNoopAdapter());
      return;
    }
    try {
      const { createVercelAdapter } = await import('./vercel');
      analytics.attach(createVercelAdapter());
    } catch {
      analytics.attach(createNoopAdapter());
    }
  };
  const idle = (
    window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }
  ).requestIdleCallback;
  if (idle) idle(() => void load(), { timeout: 4000 });
  else setTimeout(() => void load(), 2000);
}

/**
 * `/plain` never loads the kernel runtime, so it starts analytics itself and records its one page view (the kernel's
 * RouteSync records page views everywhere else).
 */
export function startReaderAnalytics(path: RoutePath): void {
  startAnalytics();
  analytics.pageview(path);
}
