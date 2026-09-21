/**
 * `HistoryPort` — shared/05 `ROUTE-PORT-01`. The kernel only ever talks to this interface; adapters are swappable
 * without touching the kernel (native `history`, Next's router, or an in-memory double for tests).
 */
import type { RoutePath } from '../types';

export interface OskState {
  readonly idx: number;
  readonly prev: RoutePath | null;
}

/** Our slice of `history.state`. We never spread `history.state` into our own object (Next owns the rest). */
export interface HistoryEntryState {
  readonly osk: OskState;
}

export interface PopEvent {
  readonly url: string;
  readonly state: unknown;
}

export interface HistoryPort {
  readonly name: 'native' | 'next-router' | 'memory';
  /** Current pathname. */
  url(): string;
  state(): unknown;
  push(state: HistoryEntryState, url: string): void;
  replace(state: HistoryEntryState, url: string): void;
  back(): void;
  listen(onPop: (event: PopEvent) => void): () => void;
}

export function readOsk(state: unknown): OskState | null {
  if (typeof state !== 'object' || state === null || !('osk' in state)) return null;
  const osk = (state as { osk: unknown }).osk;
  if (typeof osk !== 'object' || osk === null) return null;
  const { idx, prev } = osk as { idx?: unknown; prev?: unknown };
  if (typeof idx !== 'number' || !Number.isFinite(idx)) return null;
  return { idx, prev: typeof prev === 'string' && prev.startsWith('/') ? (prev as RoutePath) : null };
}
