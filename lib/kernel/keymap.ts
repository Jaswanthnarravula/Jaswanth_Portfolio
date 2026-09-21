/**
 * Keyboard shortcut registry — shared/09 `A11Y-KEY-01`. One registry: it drives the handlers and renders the `?` help
 * dialog. Accelerators are Alt+Shift+letter (never T, A, B, I); reserved chords are rejected by a unit-tested deny-list.
 */
export type ShortcutId =
  | 'search'
  | 'search-slash'
  | 'help'
  | 'close-window'
  | 'minimize-window'
  | 'maximize-window'
  | 'next-window'
  | 'previous-window'
  | 'overview'
  | 'focus-dock'
  | 'home'
  | 'switch-os'
  | 'dismiss';

export interface Chord {
  readonly key: string;
  readonly ctrlOrMeta?: boolean;
  readonly alt?: boolean;
  readonly shift?: boolean;
}

export interface Shortcut {
  readonly id: ShortcutId;
  readonly chords: readonly Chord[];
  readonly label: string;
  /** Single-key shortcuts can be switched off in Settings (WCAG 2.1.4). */
  readonly singleKey?: boolean;
  /** Ignored while focus is in a text field. */
  readonly outsideTextFields?: boolean;
}

const accel = (key: string): Chord => ({ key, alt: true, shift: true });

export const SHORTCUTS: readonly Shortcut[] = [
  { id: 'search', chords: [{ key: 'k', ctrlOrMeta: true }], label: 'Search' },
  { id: 'search-slash', chords: [{ key: '/' }], label: 'Search', singleKey: true, outsideTextFields: true },
  {
    id: 'help',
    chords: [{ key: '?', shift: true }],
    label: 'Keyboard shortcuts',
    singleKey: true,
    outsideTextFields: true,
  },
  { id: 'close-window', chords: [accel('w')], label: 'Close window', outsideTextFields: true },
  { id: 'minimize-window', chords: [accel('m')], label: 'Minimize window', outsideTextFields: true },
  { id: 'maximize-window', chords: [accel('f')], label: 'Maximize or restore window', outsideTextFields: true },
  { id: 'next-window', chords: [accel('n')], label: 'Next window', outsideTextFields: true },
  { id: 'previous-window', chords: [accel('p')], label: 'Previous window', outsideTextFields: true },
  { id: 'overview', chords: [accel('o')], label: 'Show all windows', outsideTextFields: true },
  { id: 'focus-dock', chords: [accel('d')], label: 'Focus the Dock or taskbar', outsideTextFields: true },
  { id: 'home', chords: [accel('h')], label: 'Go to the Home Screen', outsideTextFields: true },
  { id: 'switch-os', chords: [accel('s')], label: 'Switch operating system', outsideTextFields: true },
  { id: 'dismiss', chords: [{ key: 'Escape' }], label: 'Dismiss or go back one level' },
];

/** Reserved chords (AltGr, VoiceOver, browser and screen-reader keys) — none may appear in the registry. */
export function isReserved(chord: Chord): boolean {
  const key = chord.key.toLowerCase();
  if (chord.ctrlOrMeta && chord.alt) return true; // Ctrl+Alt = AltGr on many layouts; VoiceOver uses Ctrl+Opt.
  if (chord.alt && key === ' ') return true;
  if (key === 'f6' || key === 'f10') return true;
  if (chord.ctrlOrMeta && ['l', 'r', 'w', 'u', 't', 'n', 'q'].includes(key) && !chord.alt && !chord.shift) return true;
  if (chord.alt && chord.shift && ['t', 'a', 'b', 'i'].includes(key)) return true;
  return false;
}

export interface KeyLike {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly code?: string;
}

/** Alt+Shift+letter reports composed characters on macOS (e.g. "Ω"); match on the physical key code instead. */
const keyOf = (event: KeyLike): string => {
  if (event.altKey && event.code?.startsWith('Key')) return event.code.slice(3).toLowerCase();
  return event.key.length === 1 ? event.key.toLowerCase() : event.key;
};

export function matches(chord: Chord, event: KeyLike): boolean {
  const ctrlOrMeta = event.ctrlKey || event.metaKey;
  if (!!chord.ctrlOrMeta !== ctrlOrMeta || !!chord.alt !== event.altKey) return false;
  const key = keyOf(event);
  const expected = chord.key.length === 1 ? chord.key.toLowerCase() : chord.key;
  // '?' needs Shift on most layouts; accept either as long as the character matches.
  if (chord.key === '?') return key === '?';
  if (!!chord.shift !== event.shiftKey) return false;
  return key === expected;
}

export interface MatchOptions {
  readonly inTextField: boolean;
  readonly singleKeyShortcuts: boolean;
}

export function matchShortcut(
  event: KeyLike,
  options: MatchOptions,
  registry: readonly Shortcut[] = SHORTCUTS,
): ShortcutId | null {
  for (const shortcut of registry) {
    if (shortcut.outsideTextFields && options.inTextField) continue;
    if (shortcut.singleKey && !options.singleKeyShortcuts) continue;
    if (shortcut.chords.some((chord) => matches(chord, event))) return shortcut.id;
  }
  return null;
}

export function formatChord(chord: Chord, apple: boolean): string {
  const parts: string[] = [];
  if (chord.ctrlOrMeta) parts.push(apple ? '⌘' : 'Ctrl');
  if (chord.alt) parts.push(apple ? '⌥' : 'Alt');
  if (chord.shift && chord.key !== '?') parts.push(apple ? '⇧' : 'Shift');
  parts.push(chord.key === 'Escape' ? 'Esc' : chord.key.length === 1 ? chord.key.toUpperCase() : chord.key);
  return parts.join(apple ? '' : '+');
}
