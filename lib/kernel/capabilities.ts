/**
 * Capability profile — shared/04 `KRN-CAP-01`. Detection happens here; the tier itself is decided before paint by the
 * inline tier script (lib/kernel/tier-script.ts) and demoted by the governor. The kernel only stores the result.
 */
import type { CapabilityProfile, DeviceClass, Tier } from './types';

interface Env {
  readonly matchMedia: (query: string) => { matches: boolean };
  readonly navigator: Partial<Navigator> & { connection?: { saveData?: boolean } };
  readonly screen: { width: number; height: number };
  readonly documentElement: { dataset: DOMStringMap };
  readonly supports?: (property: string, value: string) => boolean;
}

export function readTier(dataset: DOMStringMap): Tier {
  const value = Number(dataset.tier);
  return value === 0 || value === 2 ? value : 1;
}

export function deviceClassFor(pointer: CapabilityProfile['pointer'], shortSide: number): DeviceClass {
  if (pointer !== 'coarse') return 'desktop';
  return shortSide < 600 ? 'phone' : 'tablet';
}

export function detectCapabilities(env: Env): CapabilityProfile {
  const media = (query: string) => {
    try {
      return env.matchMedia(query).matches;
    } catch {
      return false;
    }
  };
  const pointer: CapabilityProfile['pointer'] = media('(pointer: coarse)')
    ? 'coarse'
    : media('(pointer: fine)')
      ? 'fine'
      : 'none';
  const shortSide = Math.min(env.screen.width, env.screen.height);
  const dataset = env.documentElement.dataset;
  return {
    tier: readTier(dataset),
    deviceClass: deviceClassFor(pointer, shortSide),
    pointer,
    hover: media('(hover: hover)'),
    webgl2: null,
    reducedMotion: dataset.motion === 'reduced',
    reducedTransparency: dataset.glass === 'solid',
    saveData: env.navigator.connection?.saveData === true || media('(prefers-reduced-data: reduce)'),
    appleTouch: pointer === 'coarse' && isAppleTouch(env),
  };
}

/** iOS-family touch devices expose `-webkit-touch-callout` — a feature probe, not UA sniffing (shared/05 `/go`). */
export function isAppleTouch(env: Pick<Env, 'supports'>): boolean {
  try {
    return env.supports?.('-webkit-touch-callout', 'none') ?? false;
  } catch {
    return false;
  }
}

export function browserCapabilities(): CapabilityProfile {
  return detectCapabilities({
    matchMedia: (query) => window.matchMedia(query),
    navigator: window.navigator as Env['navigator'],
    screen: window.screen,
    documentElement: document.documentElement,
    supports: (property, value) => CSS.supports(property, value),
  });
}
