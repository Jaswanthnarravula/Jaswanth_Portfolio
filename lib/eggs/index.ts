/**
 * Easter-egg bookkeeping — shared/21 (`EGG-COUNT-01`, `EGG-KONAMI-01`). Pure helpers: the found set lives in
 * `prefs.eggsFound` (identical rules for every visitor — no persona anywhere), an egg counts once, and the Konami
 * matcher recognises ↑↑↓↓←→←→BA. The eggs' own surfaces are lazy chunks loaded on trigger (`EGG-LAZY-01`).
 */
import type { OsId } from '@/lib/kernel/ids';

/** Every egg of the catalogue, and which OSes can reach it ("Easter eggs found: n / N" counts the OS's own set). */
export const EGG_CATALOGUE: Readonly<Record<string, readonly OsId[]>> = {
  'EGG-SUDO-01': ['linux', 'macos', 'windows'],
  'EGG-NEO-01': ['linux', 'macos', 'windows'],
  'EGG-VIM-01': ['linux', 'macos', 'windows'],
  'EGG-RMRF-01': ['linux', 'macos', 'windows'],
  'EGG-COW-01': ['linux', 'macos', 'windows'],
  'EGG-ABOUT-01': ['macos'],
  'EGG-WINVER-01': ['windows'],
  'EGG-KONAMI-01': ['ios', 'macos', 'windows', 'android'],
  'EGG-SHAKE-01': ['ios', 'android'],
  'EGG-MATRIX-01': ['linux', 'macos', 'windows'],
};

export const eggsFor = (os: OsId): readonly string[] =>
  Object.entries(EGG_CATALOGUE)
    .filter(([, oses]) => oses.includes(os))
    .map(([id]) => id);

/** The found set with `id` added, or `null` when it was already found (the `egg_found` event fires once per id). */
export function recordEgg(found: readonly string[], id: string): readonly string[] | null {
  if (found.includes(id) || !(id in EGG_CATALOGUE)) return null;
  return [...found, id];
}

/** "n / N" for an OS: how many of that OS's eggs this visitor has found. */
export function eggProgress(found: readonly string[], os: OsId): { found: number; total: number } {
  const reachable = eggsFor(os);
  return { found: reachable.filter((id) => found.includes(id)).length, total: reachable.length };
}

export const KONAMI: readonly string[] = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
];

/** Feed keys (`KeyboardEvent.key`); returns true on the key that completes ↑↑↓↓←→←→BA. Case-insensitive for B/A. */
export function createKonami(): { push(key: string): boolean; reset(): void } {
  let index = 0;
  const normal = (key: string) => (key.length === 1 ? key.toLowerCase() : key);
  return {
    push(key) {
      const value = normal(key);
      if (value === KONAMI[index]) index++;
      else index = value === KONAMI[0] ? (index === 2 ? 2 : 1) : 0;
      if (index === KONAMI.length) {
        index = 0;
        return true;
      }
      return false;
    },
    reset() {
      index = 0;
    },
  };
}
