/**
 * Shared-element hand-off between two layers — plans/03-netflix-page.md `NFLX-HAND-01`.
 * The profiles screen (page layer) starts the avatar flight and registers a promise of where the avatar ends up;
 * the chooser (shell layer) takes it on mount and continues the flight from exactly that rect, so the two screens
 * read as one sequence with no blank frame. One pending hand-off at a time; taking it clears it.
 */
import type { PersonaId } from '@/lib/kernel/ids';

export interface HandoffRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Handoff {
  readonly persona: PersonaId;
  readonly rect: HandoffRect;
}

let pending: Promise<Handoff | null> | null = null;

export function beginHandoff(handoff: Promise<Handoff | null>): void {
  pending = handoff.catch(() => null);
}

/** The in-flight hand-off (resolves when the first half of the flight lands), or null when there is none. */
export function takeHandoff(): Promise<Handoff | null> | null {
  const current = pending;
  pending = null;
  return current;
}
