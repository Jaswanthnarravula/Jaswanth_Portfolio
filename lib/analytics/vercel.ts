/** Vercel Web Analytics + Speed Insights adapter (cookieless). Custom events silently no-op on plans without them. */
import { inject, pageview, track } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import type { AnalyticsPort } from './events';

export function createVercelAdapter(): AnalyticsPort {
  inject({ mode: 'production', disableAutoTrack: true });
  injectSpeedInsights();
  return {
    track(event) {
      const { name, ...properties } = event;
      track(name, properties as Record<string, string | number | boolean | null>);
    },
    pageview(path) {
      pageview({ route: path, path });
    },
  };
}
