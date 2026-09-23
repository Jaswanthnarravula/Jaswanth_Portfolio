/**
 * User preferences — `pf.prefs.v1`, long-lived and independent of the sessions key so a sessions schema bump never
 * loses them (`KRN-PERSIST-02`). Parsing is a validating merge: each invalid field falls back to its default.
 */
import { isOsId, isPersonaId } from '../ids';
import { DEFAULT_PREFS } from '../state';
import { ACCENT_IDS, type Tier, type UserPreferences } from '../types';
import { isRecord, type Json } from './validate';

export const PREFS_KEY = 'pf.prefs.v1';
export const DEMOTION_TTL = 14 * 24 * 60 * 60 * 1000;

const oneOf = <T extends string>(value: Json, options: readonly T[], fallback: T): T =>
  typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : fallback;

const bool = (value: Json, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

export function parsePrefs(value: Json, now = Date.now()): UserPreferences {
  // Zustand's persist wrapper stores `{ state, version }`; accept the bare shape too.
  const input = isRecord(value) && isRecord(value.state) ? value.state : value;
  if (!isRecord(input)) return DEFAULT_PREFS;
  const sound = isRecord(input.sound) ? input.sound : {};
  const volume =
    typeof sound.volume === 'number' && Number.isFinite(sound.volume)
      ? Math.min(1, Math.max(0, sound.volume))
      : DEFAULT_PREFS.sound.volume;
  const demotion = parseDemotion(input.demotion, now);
  return {
    v: 1,
    persona: isPersonaId(input.persona) ? input.persona : null,
    lastOs: isOsId(input.lastOs) ? input.lastOs : null,
    introSeen: bool(input.introSeen, DEFAULT_PREFS.introSeen),
    sound: {
      enabled: bool(sound.enabled, DEFAULT_PREFS.sound.enabled),
      volume,
      ui: bool(sound.ui, DEFAULT_PREFS.sound.ui),
    },
    motion: oneOf(input.motion, ['system', 'reduced', 'full'], DEFAULT_PREFS.motion),
    glass: oneOf(input.glass, ['system', 'solid', 'full'], DEFAULT_PREFS.glass),
    theme: oneOf(input.theme, ['system', 'light', 'dark'], DEFAULT_PREFS.theme),
    singleKeyShortcuts: bool(input.singleKeyShortcuts, DEFAULT_PREFS.singleKeyShortcuts),
    tourOffered: bool(input.tourOffered, DEFAULT_PREFS.tourOffered),
    eggsFound: Array.isArray(input.eggsFound)
      ? [...new Set(input.eggsFound.filter((id): id is string => typeof id === 'string' && id.length <= 40))].slice(
          0,
          32,
        )
      : [],
    demotion,
    taskbarAlign: oneOf(input.taskbarAlign, ['center', 'left'], DEFAULT_PREFS.taskbarAlign),
    accent:
      typeof input.accent === 'string' && (ACCENT_IDS as readonly string[]).includes(input.accent)
        ? (input.accent as UserPreferences['accent'])
        : null,
    textScale: parseTextScale(input.textScale),
    contrast: oneOf(input.contrast, ['system', 'more'], DEFAULT_PREFS.contrast),
    notifications: bool(input.notifications, DEFAULT_PREFS.notifications),
    wallpaper: oneOf(input.wallpaper, ['auto', 'light', 'dark'], DEFAULT_PREFS.wallpaper),
    dock: parseDock(input.dock),
    androidPalette: oneOf(input.androidPalette, ['sage', 'blue', 'violet', 'coral'], DEFAULT_PREFS.androidPalette),
    androidThemedIcons: bool(input.androidThemedIcons, DEFAULT_PREFS.androidThemedIcons),
    androidNavigation: oneOf(input.androidNavigation, ['auto', 'gesture', 'buttons'], DEFAULT_PREFS.androidNavigation),
  };
}

function parseDock(value: Json): UserPreferences['dock'] {
  const input = isRecord(value) ? value : {};
  return {
    magnification: bool(input.magnification, DEFAULT_PREFS.dock.magnification),
    size: oneOf(input.size, ['small', 'medium', 'large'], DEFAULT_PREFS.dock.size),
  };
}

/** Text size: 100 – 130 % in 5 % steps (plans/windows/apps/settings "Text size"). */
export const TEXT_SCALE_RANGE = [1, 1.3] as const;
export function parseTextScale(value: Json): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_PREFS.textScale;
  const clamped = Math.min(TEXT_SCALE_RANGE[1], Math.max(TEXT_SCALE_RANGE[0], value));
  return Math.round(clamped * 20) / 20;
}

function parseDemotion(value: Json, now: number): UserPreferences['demotion'] {
  if (!isRecord(value)) return null;
  const { tier, exp } = value;
  if ((tier !== 0 && tier !== 1) || typeof exp !== 'number' || exp <= now) return null;
  return { tier: tier as Tier, exp };
}

/** Versioned migration entry point (zustand `migrate`). Unknown versions are re-validated field by field. */
export function migratePrefs(persisted: Json, _version: number): UserPreferences {
  return parsePrefs(persisted);
}
