/**
 * Frame sampling for one-off checks (shared/10 `PERF-GOV-01` budgets, judged by `flightFailed`): the deltas between
 * animation frames for `durationMs`. Resolves early (with what it has) when the signal aborts. Lives in lib/motion,
 * the one place raw requestAnimationFrame is allowed.
 */
export function sampleFrames(durationMs: number, signal?: AbortSignal): Promise<number[]> {
  return new Promise((resolve) => {
    const deltas: number[] = [];
    let last = 0;
    let start = 0;
    let id = 0;
    const finish = () => {
      cancelAnimationFrame(id);
      resolve(deltas);
    };
    signal?.addEventListener('abort', finish, { once: true });
    const tick = (now: number) => {
      if (signal?.aborted) return;
      if (last) deltas.push(now - last);
      else start = now;
      last = now;
      if (now - start >= durationMs) finish();
      else id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
  });
}
