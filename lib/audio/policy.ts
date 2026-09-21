/**
 * Sound policy — shared/04 `KRN-SOUND-01`. The intro sound answers a tap and defaults on; every other UI sound is
 * opt-in (`prefs.sound.ui`, default off). The mute toggle (`prefs.sound.enabled`) silences everything.
 */
import type { UserPreferences } from '@/lib/kernel/types';

export type SoundKind = 'intro' | 'ui';

export function canPlay(kind: SoundKind, sound: UserPreferences['sound']): boolean {
  if (!sound.enabled || sound.volume <= 0) return false;
  return kind === 'intro' ? true : sound.ui;
}
