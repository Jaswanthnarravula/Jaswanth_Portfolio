/**
 * Where focus goes when a Windows dialog or panel leaves (shared/09 — focus never rests on `<body>`).
 *   · `focusShell` — the focused window, else the desktop.
 *   · `returnFocus` — a closed dialog's opener while it is still a live control, else `focusShell`. An opener inside
 *     Start/Search does not count: the panel closed as the dialog opened, and while it fades out its controls are
 *     still connected — focus sent there would drop to `<body>` when the panel unmounts a moment later.
 * Both leave focus alone when input already put it somewhere (a press outside that landed on a control).
 */
import { applyFocus, focusIsOnBody } from '@/lib/kernel/focus';
import { focusKeys } from '@/lib/kernel/types';
import { getKernel } from '@/stores/kernel-store';
import { LAUNCHER_ID } from '../model';

export function focusShell(): void {
  const focused = getKernel().sessions.windows.focused;
  applyFocus({ candidates: [...(focused ? [focusKeys.window(focused)] : []), focusKeys.home('windows')] });
}

/** Call once the dialog has left the DOM (a task after unmount, so a press outside has had its default action). */
export function returnFocus(opener: HTMLElement | null): void {
  if (!focusIsOnBody()) return;
  if (opener?.isConnected && !opener.closest(`#${LAUNCHER_ID}`)) {
    opener.focus({ preventScroll: true });
    if (!focusIsOnBody()) return;
  }
  focusShell();
}
