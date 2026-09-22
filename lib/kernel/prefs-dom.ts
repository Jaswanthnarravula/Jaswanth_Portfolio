/**
 * Preferences → `<html>` at runtime (shared/09 `A11Y-PREF-01`; plans/windows/apps/settings "Instant apply"). The pre-paint
 * tier script applies `data-motion` / `data-glass` / `data-theme` on load; this applies the same rules the moment a
 * setting changes (Quick Settings, Settings), plus the attributes the tier script has no room for (it is capped at
 * 600 B): `data-contrast`, `data-accent` and `--text-scale`. The OS layer mounts after prefs rehydrate, so an OS's first
 * frame already carries them. Same inputs → same attributes as the tier script (unit-tested).
 */
import type { UserPreferences } from './types';

export interface PrefsDomEnv {
  readonly root: {
    readonly dataset: DOMStringMap;
    readonly style: Pick<CSSStyleDeclaration, 'setProperty' | 'removeProperty'>;
  };
  readonly matches: (query: string) => boolean;
}

type Applied = Pick<UserPreferences, 'motion' | 'glass' | 'theme' | 'contrast' | 'accent' | 'textScale'>;

/** The attribute values the preferences resolve to (system preferences decide `system`). */
export function resolvePrefAttributes(prefs: Applied, matches: (query: string) => boolean) {
  const motion =
    prefs.motion === 'reduced' || (prefs.motion !== 'full' && matches('(prefers-reduced-motion: reduce)'))
      ? 'reduced'
      : 'full';
  const glass =
    prefs.glass === 'solid' ||
    prefs.contrast === 'more' ||
    (prefs.glass !== 'full' && matches('(prefers-reduced-transparency: reduce), (prefers-contrast: more)'))
      ? 'solid'
      : 'full';
  return {
    motion,
    glass,
    theme: prefs.theme === 'system' ? null : prefs.theme,
    contrast: prefs.contrast === 'more' ? 'more' : null,
    accent: prefs.accent,
    textScale: prefs.textScale,
  } as const;
}

export function applyPrefsToDocument(prefs: Applied, env: PrefsDomEnv): void {
  const { dataset, style } = env.root;
  const next = resolvePrefAttributes(prefs, env.matches);
  if (dataset.motion !== next.motion) dataset.motion = next.motion;
  if (dataset.glass !== next.glass) dataset.glass = next.glass;
  const optional = { theme: next.theme, contrast: next.contrast, accent: next.accent } as const;
  for (const [key, value] of Object.entries(optional)) {
    if (value === null) delete dataset[key];
    else if (dataset[key] !== value) dataset[key] = value;
  }
  if (next.textScale === 1) style.removeProperty('--text-scale');
  else style.setProperty('--text-scale', String(next.textScale));
}

/** The browser environment (the shell runtime calls this on every preference change). */
export function browserPrefsEnv(): PrefsDomEnv {
  return {
    root: document.documentElement,
    matches: (query) => {
      try {
        return window.matchMedia(query).matches;
      } catch {
        return false;
      }
    },
  };
}
