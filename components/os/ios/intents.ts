/**
 * Cross-surface intents inside the iOS shell: a system surface (a quick action, Control Center, Spotlight) asks an app
 * to show something that is session state, not a URL — Mail's compose sheet, a pinned note, a Settings screen, the
 * Messages "Say hello" branch. A tiny pub/sub: the latest intent of a kind waits until the app mounts and takes it.
 * Never kernel state, never persisted.
 */
export type SettingsScreen =
  'root' | 'accessibility' | 'display' | 'sounds' | 'privacy' | 'about' | 'legal' | 'switch-os';

export type IosIntent =
  | { readonly kind: 'compose'; readonly subject?: string }
  | { readonly kind: 'note'; readonly note: string }
  | { readonly kind: 'settings'; readonly screen: SettingsScreen }
  | { readonly kind: 'say-hello' };

type Kind = IosIntent['kind'];
const pending = new Map<Kind, IosIntent>();
const listeners = new Set<(intent: IosIntent) => void>();

export function requestIntent(intent: IosIntent): void {
  pending.set(intent.kind, intent);
  for (const listener of listeners) listener(intent);
}

/** Take (and clear) the pending intent of a kind — an app does this when it mounts, and again on each notification. */
export function takeIntent<K extends Kind>(kind: K): Extract<IosIntent, { kind: K }> | null {
  const intent = pending.get(kind) as Extract<IosIntent, { kind: K }> | undefined;
  pending.delete(kind);
  return intent ?? null;
}

export function subscribeIntents(listener: (intent: IosIntent) => void): () => void {
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
