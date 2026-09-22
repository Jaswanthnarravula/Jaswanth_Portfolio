/**
 * Cross-surface intents inside the Windows shell: one surface asks an app to show something that is session state,
 * not a URL (Settings page, Outlook compose, a command inserted in Terminal, Explorer's Properties). A tiny pub/sub —
 * the latest intent waits until the app mounts and takes it. Never kernel state, never persisted.
 */
export type SettingsPage = 'system' | 'personalization' | 'accessibility' | 'privacy' | 'apps' | 'switch' | 'tour';

export type WinIntent =
  | { readonly kind: 'settings'; readonly page: SettingsPage; readonly card?: string }
  | { readonly kind: 'compose' }
  | { readonly kind: 'terminal-insert'; readonly command: string };

type Kind = WinIntent['kind'];
const pending = new Map<Kind, WinIntent>();
const listeners = new Set<(intent: WinIntent) => void>();

export function requestIntent(intent: WinIntent): void {
  pending.set(intent.kind, intent);
  for (const listener of listeners) listener(intent);
}

/** Take (and clear) the pending intent of a kind — an app does this when it mounts or becomes visible. */
export function takeIntent<K extends Kind>(kind: K): Extract<WinIntent, { kind: K }> | null {
  const intent = pending.get(kind) as Extract<WinIntent, { kind: K }> | undefined;
  pending.delete(kind);
  return intent ?? null;
}

export function subscribeIntents(listener: (intent: WinIntent) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test seam. */
export function resetIntents(): void {
  pending.clear();
  listeners.clear();
}
