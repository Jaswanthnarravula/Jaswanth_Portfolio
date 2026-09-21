/**
 * Epoch director — shared/07 `MOTION-DIR-01`. OS-level timelines are registered under the kernel epoch that started
 * them; a newer switch kills every older timeline, so stale animations can never finish over a new state.
 */
export interface Killable {
  kill(): void;
}

export interface Director {
  register(epoch: number, timeline: Killable): () => void;
  /** Kill every timeline registered under an epoch strictly lower than `epoch`. */
  kill(epoch: number): number;
  killAll(): void;
  /** Count of live timelines (leak checks: 0 when idle). */
  readonly size: number;
}

export function createDirector(): Director {
  const live = new Map<Killable, number>();
  return {
    register(epoch, timeline) {
      live.set(timeline, epoch);
      return () => {
        live.delete(timeline);
      };
    },
    kill(epoch) {
      let killed = 0;
      for (const [timeline, registered] of live) {
        if (registered < epoch) {
          live.delete(timeline);
          timeline.kill();
          killed++;
        }
      }
      return killed;
    },
    killAll() {
      for (const timeline of live.keys()) timeline.kill();
      live.clear();
    },
    get size() {
      return live.size;
    },
  };
}
