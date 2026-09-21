/**
 * User preferences — `pf.prefs.v1`, long-lived and independent of the sessions key so a sessions schema bump never
 * loses them (`KRN-PERSIST-02`). Parsing is a validating merge: each invalid field falls back to its default.
 */
import { isOsId, isPersonaId } from '../ids';
import { DEFAULT_PREFS } from '../state';
import type { Tier, UserPreferences } from '../types';
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
  };
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
