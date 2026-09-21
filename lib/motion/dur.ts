/**
 * `dur(ms)` — shared/07 `MOTION-RM-01`: reduced motion is handled once, here. Under `data-motion="reduced"` every
 * duration collapses to 0, or to the 150 ms crossfade token for spatial transitions that become fades.
 */
export const REDUCED_CROSSFADE_MS = 150;

export function prefersReducedMotion(
  root: { dataset: DOMStringMap } | null = typeof document === 'undefined' ? null : document.documentElement,
): boolean {
  return root?.dataset.motion === 'reduced';
}

export function dur(
  ms: number,
  { crossfade = false, reduced = prefersReducedMotion() }: { crossfade?: boolean; reduced?: boolean } = {},
): number {
  if (!reduced) return ms;
  return crossfade ? Math.min(ms, REDUCED_CROSSFADE_MS) : 0;
}

/** Seconds variant for GSAP. */
export const durS = (ms: number, options?: { crossfade?: boolean; reduced?: boolean }) => dur(ms, options) / 1000;

/** Easing tokens shared by every OS file (per-OS values reference these names). */
export const EASE = {
  macOpen: 'cubic-bezier(0.2, 0.9, 0.3, 1)',
  macClose: 'cubic-bezier(0.4, 0, 1, 1)',
  winEntrance: 'cubic-bezier(0, 0, 0, 1)',
  winExit: 'cubic-bezier(1, 0, 1, 1)',
  iosNav: 'cubic-bezier(0.32, 0.72, 0, 1)',
  m3Emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  m3EmphasizedDecelerate: 'cubic-bezier(0.05, 0.7, 0.1, 1)',
  m3EmphasizedAccelerate: 'cubic-bezier(0.3, 0, 0.8, 0.15)',
  helloDraw: 'cubic-bezier(0.65, 0, 0.35, 1)',
  introZoom: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;
