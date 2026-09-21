/** Canonical vocabulary (plans/README.md). Every identifier here is used verbatim across the codebase. */
export { SECTION_IDS, isSectionId, type SectionId } from '@/data/schema';

export const OS_IDS = ['ios', 'macos', 'windows', 'android', 'linux'] as const;
export type OsId = (typeof OS_IDS)[number];

export const APP_ROLES = [
  'browser',
  'github',
  'mail',
  'messages',
  'files',
  'viewer',
  'editor',
  'terminal',
  'notes',
  'settings',
] as const;
export type AppRole = (typeof APP_ROLES)[number];

/** All five behave identically (north-star B16); they exist only as a stored preference. */
export const PERSONA_IDS = ['recruiter', 'developer', 'adventurer', 'designer', 'guest'] as const;
export type PersonaId = (typeof PERSONA_IDS)[number];

export const SIZE_CLASSES = ['compact', 'medium', 'expanded', 'large'] as const;
export type SizeClass = (typeof SIZE_CLASSES)[number];

export const POSTURES = ['compact', 'touch', 'pointer'] as const;
export type Posture = (typeof POSTURES)[number];

const includes = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value);

export const isOsId = (value: unknown): value is OsId => includes(OS_IDS, value);
export const isAppRole = (value: unknown): value is AppRole => includes(APP_ROLES, value);
export const isPersonaId = (value: unknown): value is PersonaId => includes(PERSONA_IDS, value);
export const isSizeClass = (value: unknown): value is SizeClass => includes(SIZE_CLASSES, value);

export const OS_NAMES: Readonly<Record<OsId, string>> = {
  ios: 'iOS',
  macos: 'macOS',
  windows: 'Windows 11',
  android: 'Android',
  linux: 'Linux',
};
