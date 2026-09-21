/**
 * Transition stage claims — the seam between the kernel's OS switch machine (shared/04 `KRN-SWITCH-*`) and the
 * visuals that play it. A stage (the chooser's enter flight, later each OS's exit beat) claims the phases it animates
 * for one epoch and dispatches their `PHASE_DONE` itself; the TransitionDriver completes every unclaimed phase on
 * the next frame and shows the generic failure UI only when no stage owns the failure. Claims are made synchronously
 * right after the dispatch that bumps the epoch, so the driver never races them.
 */
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

/** Test seam. */
export function resetStageClaims(): void {
  claims.clear();
}
