/**
 * Transition stage claims — the seam between the kernel's OS switch machine (shared/04 `KRN-SWITCH-*`) and the
 * visuals that play it. A stage (the chooser's enter flight, later each OS's exit beat) claims the phases it animates
 * for one epoch and dispatches their `PHASE_DONE` itself; the TransitionDriver completes every unclaimed phase on
 * the next frame and shows the generic failure UI only when no stage owns the failure. Claims are made synchronously
 * right after the dispatch that bumps the epoch, so the driver never races them.
 */
import type { OsId } from '@/lib/kernel/ids';

export type StagedPhase = 'exiting' | 'entering' | 'failed';

const claims = new Map<number, Set<StagedPhase>>();

export function claimPhases(epoch: number, phases: readonly StagedPhase[]): () => void {
  const set = claims.get(epoch) ?? new Set<StagedPhase>();
  for (const phase of phases) set.add(phase);
  claims.set(epoch, set);
  // Old epochs can never complete again (the kernel ignores stale PHASE_DONE); keep the map small.
  for (const key of claims.keys()) if (key < epoch - 8) claims.delete(key);
  return () => {
    for (const phase of phases) set.delete(phase);
    if (set.size === 0) claims.delete(epoch);
  };
}

export const isClaimed = (epoch: number, phase: StagedPhase): boolean => claims.get(epoch)?.has(phase) ?? false;

/**
 * The exit hand-off (plans/04 "The exit transition", `CHOOSE-EXIT-01`): a leaving OS claims its `exiting` phase, plays
 * its shutdown beat (≤ 300 ms, in its own idiom), then offers the rest of the phase to the return stage — the chooser's
 * "snapshot shrinks back into its card" flight. The return stage takes over (and dispatches `PHASE_DONE` itself) or
 * declines, in which case the OS completes the phase. One return stage at a time: the mounted chooser.
 */
export interface ExitHandOff {
  readonly epoch: number;
  readonly from: OsId;
  readonly to: OsId | null;
}
export type ReturnStage = (handOff: ExitHandOff) => boolean;

let returnStage: ReturnStage | null = null;

export function registerReturnStage(stage: ReturnStage): () => void {
  returnStage = stage;
  return () => {
    if (returnStage === stage) returnStage = null;
  };
}

/** Returns true when a return stage took over the rest of the exit (it will complete the phase). */
export const handOffExit = (handOff: ExitHandOff): boolean => returnStage?.(handOff) ?? false;

/** Test seam. */
export function resetStageClaims(): void {
  claims.clear();
  returnStage = null;
}
