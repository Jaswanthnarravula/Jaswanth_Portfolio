/**
 * OS chooser copy and the "suits your device" rule — plans/04-os-chooser.md (`CHOOSE-CARD-01`, `CHOOSE-BADGE-01`).
 * The badge comes from size class + input modality only: never the user agent, never the profile.
 */
import type { OsId, SizeClass } from '@/lib/kernel/ids';

export const CHOOSER_HEADING = 'Choose how you want to explore';

/** One line of character per OS, shown under its name. */
export const OS_CHARACTER: Readonly<Record<OsId, string>> = {
  ios: 'Tap through apps',
  macos: 'A desktop of windows',
  windows: 'Start, taskbar, snap',
  android: 'Launcher and Material',
  linux: 'A real terminal',
};

export interface BadgeInput {
  readonly pointer: 'fine' | 'coarse' | 'none';
  /** The kernel's window size class (lib/kernel/geometry): a phone in either orientation is `compact`. */
  readonly sizeClass: SizeClass;
  /** A stable per-visitor number (e.g. from the persisted session seed); alternates iOS / Android fairly. */
  readonly seed: number;
  readonly visible: readonly OsId[];
}

/**
 * Exactly one badge, or none: coarse + compact → iOS or Android (alternating by `seed`, so neither is favoured);
 * fine + expanded (or wider) → macOS; nothing else — a tablet or a medium-width window gets none. Only a visible
 * (released) OS can carry it.
 */
export function suitedOs({ pointer, sizeClass, seed, visible }: BadgeInput): OsId | null {
  let pick: OsId | null = null;
  if (pointer === 'coarse' && sizeClass === 'compact') {
    const phones = (['ios', 'android'] as const).filter((os) => visible.includes(os));
    pick = phones.length ? phones[Math.abs(Math.trunc(seed)) % phones.length]! : null;
  } else if (pointer === 'fine' && (sizeClass === 'expanded' || sizeClass === 'large')) pick = 'macos';
  return pick && visible.includes(pick) ? pick : null;
}
