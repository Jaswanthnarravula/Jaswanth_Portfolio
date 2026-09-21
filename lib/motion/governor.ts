/**
 * Runtime performance governor — shared/10 `PERF-GOV-01`. The source of truth for the tier: it samples frame deltas
 * only during tagged flights, **only demotes**, and remembers (14-day TTL, via `prefs.demotion`).
 *   A flight fails if p95 > 22 ms or three frames exceed 50 ms (the first two frames are ignored).
 *   Three failed flights in a rolling window of ten → demote one tier; applied at the next app-open / route boundary.
 */
import type { Tier } from '@/lib/kernel/types';

export const FLIGHT_P95_BUDGET_MS = 22;
export const LONG_FRAME_MS = 50;
export const DEMOTION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export interface FlightSampler {
  frame(deltaMs: number): void;
  /** Ends the flight; returns whether it failed. */
  end(): boolean;
}

export interface GovernorOptions {
  readonly tier: Tier;
  readonly now?: () => number;
  /** Persist + schedule application of a demotion. Called at most once per tier step. */
  readonly onDemote: (demotion: { tier: Tier; exp: number }) => void;
}

export interface Governor {
  readonly tier: Tier;
  startFlight(): FlightSampler;
  /** Outcomes of the last ≤ 10 flights (true = failed). */
  readonly history: readonly boolean[];
}

export function flightFailed(deltas: readonly number[]): boolean {
  const frames = deltas.slice(2);
  if (frames.length === 0) return false;
  if (frames.filter((delta) => delta > LONG_FRAME_MS).length >= 3) return true;
  const sorted = [...frames].sort((a, b) => a - b);
  const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]!;
  return p95 > FLIGHT_P95_BUDGET_MS;
}

export function createGovernor({ tier: initial, now = Date.now, onDemote }: GovernorOptions): Governor {
  let tier = initial;
  const history: boolean[] = [];
  return {
    get tier() {
      return tier;
    },
    get history() {
      return history;
    },
    startFlight() {
      const deltas: number[] = [];
      let ended = false;
      return {
        frame(delta) {
          if (!ended && Number.isFinite(delta) && delta >= 0) deltas.push(delta);
        },
        end() {
          if (ended) return false;
          ended = true;
          const failed = flightFailed(deltas);
          history.push(failed);
          if (history.length > 10) history.shift();
          if (tier > 0 && history.filter(Boolean).length >= 3) {
            tier = (tier - 1) as Tier;
            history.length = 0;
            onDemote({ tier, exp: now() + DEMOTION_TTL_MS });
          }
          return failed;
        },
      };
    },
  };
}
