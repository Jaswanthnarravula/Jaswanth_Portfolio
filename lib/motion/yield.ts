/**
 * Yield to paint — shared/10 "INP": input handlers do O(1) work and defer store commits, so the frame that answers the
 * press is painted before any heavy render starts. `afterNextPaint` runs `run` in the task right after the next frame
 * is painted (a rAF callback, then a macrotask). Raw `requestAnimationFrame` is allowed here (lib/motion owns timing).
 */
export function afterNextPaint(run: () => void): void {
  if (typeof requestAnimationFrame !== 'function') {
    setTimeout(run, 0);
    return;
  }
  requestAnimationFrame(() => setTimeout(run, 0));
}
