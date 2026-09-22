/**
 * Cross-OS command hand-off (plans/ios/surfaces/spotlight "Command results → Try this in Linux", shared/15): an OS
 * without a terminal offers a command to Linux. The command is only **inserted** at the Linux prompt — never run —
 * and only after the visitor explicitly chose to switch (`IOS-SPOT-04`, north-star B14). In memory for this page
 * session (an OS switch never reloads the document); the Linux prompt takes it once when it mounts.
 */
let offered: { readonly command: string; readonly from: string; readonly at: number } | null = null;

/** Offer a command for the Linux prompt to insert (the caller has already asked the visitor). */
export function offerCommand(command: string, from: string, now = Date.now()): void {
  offered = command.trim() ? { command: command.trim(), from, at: now } : null;
}

/** Take (and clear) the offered command if it is fresh (≤ 2 min); the prompt inserts it, the visitor presses Enter. */
export function takeOfferedCommand(now = Date.now()): string | null {
  const current = offered;
  offered = null;
  if (!current || now - current.at > 2 * 60 * 1000) return null;
  return current.command;
}

/** Peek without taking (tests, the Linux hint chip). */
export const offeredCommand = (): string | null => offered?.command ?? null;
