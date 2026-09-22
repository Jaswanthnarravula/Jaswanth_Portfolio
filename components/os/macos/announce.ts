/**
 * Polite announcements through the shell's own status region (`#system-status`, present from shell mount — shared/09;
 * plans/macos/surfaces/notifications.md `MAC-NOTIF-05`). Announcing never moves focus. The region is emptied first so
 * the same words announced twice are still spoken.
 */
let timer: ReturnType<typeof setTimeout> | null = null;

export function announce(text: string, doc: Document | undefined = globalThis.document): void {
  const region = doc?.getElementById('system-status');
  if (!region) return;
  if (timer) clearTimeout(timer);
  region.textContent = '';
  timer = setTimeout(() => {
    region.textContent = text;
    timer = null;
  }, 30);
}
