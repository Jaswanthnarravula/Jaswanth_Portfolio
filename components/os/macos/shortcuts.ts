/**
 * The shortcuts macOS actually handles, read from the one keymap registry (shared/09 `A11Y-KEY-01`) — Settings →
 * Keyboard and the `?` help sheet list exactly these (`MAC-MENU-08`: real bindings only). Home-screen and Snap chords
 * belong to other OSes and are never shown here.
 */
import { formatChord, SHORTCUTS, type Shortcut, type ShortcutId } from '@/lib/kernel/keymap';

const MAC_IDS: readonly ShortcutId[] = [
  'search',
  'search-slash',
  'help',
  'close-window',
  'minimize-window',
  'maximize-window',
  'next-window',
  'previous-window',
  'overview',
  'focus-dock',
  'switch-os',
  'dismiss',
];

/** macOS-local labels where the shared label names another OS's surface. */
const LABELS: Partial<Record<ShortcutId, string>> = {
  search: 'Spotlight',
  'search-slash': 'Spotlight',
  overview: 'Mission Control',
  'focus-dock': 'Focus the Dock',
  'maximize-window': 'Zoom or restore window',
};

export interface MacShortcut {
  readonly id: ShortcutId;
  readonly label: string;
  readonly keys: string;
  readonly singleKey: boolean;
}

/** Apple keyboards label modifiers ⌘ ⌥ ⇧ (a labelling choice only — the chords are the same everywhere). */
export function appleKeyboard(
  nav: Pick<Navigator, 'platform' | 'userAgent'> | undefined = globalThis.navigator,
): boolean {
  if (!nav) return false;
  const platform =
    (nav as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? nav.platform;
  return /mac|iphone|ipad/i.test(platform || nav.userAgent);
}

export function macShortcuts(
  { apple = appleKeyboard(), singleKeys = true }: { apple?: boolean; singleKeys?: boolean } = {},
  registry: readonly Shortcut[] = SHORTCUTS,
): readonly MacShortcut[] {
  return MAC_IDS.flatMap((id) => {
    const shortcut = registry.find((candidate) => candidate.id === id);
    if (!shortcut || (shortcut.singleKey && !singleKeys)) return [];
    return [
      {
        id,
        label: LABELS[id] ?? shortcut.label,
        keys: shortcut.chords.map((chord) => formatChord(chord, apple)).join(' or '),
        singleKey: shortcut.singleKey ?? false,
      },
    ];
  });
}
