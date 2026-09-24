/** OS chooser copy — plans/04-os-chooser.md (`CHOOSE-CARD-01`, `CHOOSE-BADGE-01`). */
import type { OsId } from '@/lib/kernel/ids';

export const CHOOSER_HEADING = 'Choose how you want to explore';

/** One line of character per OS, shown under its name. */
export const OS_CHARACTER: Readonly<Record<OsId, string>> = {
  ios: 'Tap through apps',
  macos: 'A desktop of windows',
  windows: 'Start, taskbar, snap',
  android: 'Launcher and Material',
  linux: 'A real terminal',
};
