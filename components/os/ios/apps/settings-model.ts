/**
 * iOS Settings — the screens and the search index (plans/ios/apps/settings.md "Anatomy", `IOS-SET-01`). Pure data: the
 * app draws it. Search covers every row on every screen; choosing a result pushes that screen's path and briefly
 * highlights the row.
 */
import type { SettingsScreen } from '../intents';

export type Screen = 'about' | 'legal' | 'display' | 'accessibility' | 'sounds' | 'privacy';

export const SCREEN_TITLES: Readonly<Record<Screen, string>> = {
  about: 'About',
  legal: 'Legal Notices',
  display: 'Display & Brightness',
  accessibility: 'Accessibility',
  sounds: 'Sounds',
  privacy: 'Privacy & Security',
};

/** Where each screen sits in the stack (Legal is under About). */
export const SCREEN_PATH: Readonly<Record<Screen, readonly Screen[]>> = {
  about: ['about'],
  legal: ['about', 'legal'],
  display: ['display'],
  accessibility: ['accessibility'],
  sounds: ['sounds'],
  privacy: ['privacy'],
};

export const isScreen = (value: string): value is Screen => value in SCREEN_TITLES;

/** A stored stack, cleaned (unknown keys dropped, Legal always under About). */
export function cleanStack(stack: readonly string[]): readonly Screen[] {
  const last = [...stack].reverse().find(isScreen);
  return last ? SCREEN_PATH[last] : [];
}

/** The stack an intent asks for; `switch-os` opens the shell's Switch OS surface instead (`null`). */
export function stackForIntent(screen: SettingsScreen): readonly Screen[] | null {
  if (screen === 'switch-os') return null;
  if (screen === 'root') return [];
  return SCREEN_PATH[screen];
}

export interface SettingEntry {
  /** The row's id (its highlight key). */
  readonly id: string;
  readonly label: string;
  /** The stack that shows it ([] = the root list). */
  readonly path: readonly Screen[];
  readonly words: string;
}

export const SETTINGS_INDEX: readonly SettingEntry[] = [
  { id: 'profile', label: 'About This Portfolio', path: [], words: 'profile name headline apple id account' },
  {
    id: 'switch-os',
    label: 'Switch Operating System',
    path: [],
    words: 'os chooser macos windows android linux change',
  },
  { id: 'tour', label: 'Take the Tour', path: [], words: 'help tips guide get started' },
  { id: 'display', label: 'Display & Brightness', path: ['display'], words: 'screen' },
  { id: 'appearance', label: 'Appearance', path: ['display'], words: 'dark light mode theme automatic' },
  { id: 'text-size', label: 'Text Size', path: ['display'], words: 'larger font zoom bigger' },
  { id: 'accessibility', label: 'Accessibility', path: ['accessibility'], words: 'a11y' },
  { id: 'reduce-motion', label: 'Reduce Motion', path: ['accessibility'], words: 'animation movement vestibular' },
  { id: 'reduce-transparency', label: 'Reduce Transparency', path: ['accessibility'], words: 'blur glass solid' },
  { id: 'increase-contrast', label: 'Increase Contrast', path: ['accessibility'], words: 'borders readability' },
  { id: 'single-key', label: 'Single-key Shortcuts', path: ['accessibility'], words: 'keyboard keys spotlight' },
  { id: 'plain', label: 'Open Plain Portfolio', path: ['accessibility'], words: 'text only readable simple page' },
  { id: 'sounds', label: 'Sounds', path: ['sounds'], words: 'audio' },
  { id: 'ui-sounds', label: 'UI Sounds', path: ['sounds'], words: 'audio effects clicks' },
  { id: 'volume', label: 'Volume', path: ['sounds'], words: 'loudness audio' },
  { id: 'intro', label: 'Play Intro Sound', path: ['sounds'], words: 'chime audio again' },
  { id: 'privacy', label: 'Privacy & Security', path: ['privacy'], words: 'tracking' },
  { id: 'analytics', label: 'Analytics', path: ['privacy'], words: 'counted tracking statistics' },
  { id: 'dnt', label: 'Do Not Track', path: ['privacy'], words: 'global privacy control gpc signals' },
  { id: 'cookies', label: 'Cookies', path: ['privacy'], words: 'storage identifiers' },
  { id: 'about', label: 'About', path: ['about'], words: 'general name role location résumé resume updated' },
  { id: 'version', label: 'Version', path: ['about'], words: 'build content revision' },
  { id: 'eggs', label: 'Easter Eggs Found', path: ['about'], words: 'secrets hidden' },
  { id: 'legal', label: 'Legal Notices', path: ['about', 'legal'], words: 'credits trademarks license licence rights' },
];

/** Search rows across every screen: label first, then keywords. */
export function searchSettings(query: string): readonly SettingEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const byLabel = SETTINGS_INDEX.filter((entry) => entry.label.toLowerCase().includes(needle));
  const byWords = SETTINGS_INDEX.filter(
    (entry) => !byLabel.includes(entry) && entry.words.toLowerCase().includes(needle),
  );
  return [...byLabel, ...byWords];
}

/** A result's breadcrumb ("Accessibility", "About › Legal Notices", or "Settings" for the root). */
export const whereOf = (entry: SettingEntry): string =>
  entry.path.length ? entry.path.map((screen) => SCREEN_TITLES[screen]).join(' › ') : 'Settings';

/** The row highlight lasts 600 ms (plans/ios/apps/settings "Motion"). */
export const FLASH_MS = 600;
