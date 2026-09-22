/**
 * The output reveal (plans/linux/07 "The reveal"): the visitor's own command line is instant; output lines arrive in
 * one GSAP timeline — opacity + a 4 px rise, 90 ms per line, staggered, ≤ 240 ms in total (only the first 24 lines
 * animate; the stagger shrinks so the cap holds — IMPLEMENTATION.md issue 4), > 200 lines skip it entirely, reduced
 * motion shows everything at once. Any input completes it (`finish()`); on completion the inline styles are cleared.
 */
import { gsap } from 'gsap';

export const REVEAL = { lineS: 0.09, staggerS: 0.012, capS: 0.24, animated: 24, skipAbove: 200 } as const;

/** The stagger that keeps `count` animated lines within the cap. */
export const staggerFor = (count: number): number =>
  count <= 1 ? 0 : Math.min(REVEAL.staggerS, (REVEAL.capS - REVEAL.lineS) / (count - 1));

export interface Reveal {
  finish(): void;
  readonly done: boolean;
}

export function revealLines(nodes: readonly HTMLElement[], reduced: boolean): Reveal | null {
  if (reduced || nodes.length === 0 || nodes.length > REVEAL.skipAbove) return null;
  const animated = nodes.slice(0, REVEAL.animated);
  const rest = nodes.slice(REVEAL.animated);
  const stagger = staggerFor(animated.length);
  let done = false;
  const tl = gsap.timeline({
    onComplete: () => {
      done = true;
      gsap.set(nodes, { clearProps: 'opacity,transform' });
      tl.kill();
    },
  });
  tl.fromTo(
    animated,
    { opacity: 0, y: 4 },
    { opacity: 1, y: 0, duration: REVEAL.lineS, ease: 'power1.out', stagger },
    0,
  );
  if (rest.length)
    tl.fromTo(
      rest,
      { opacity: 0, y: 4 },
      { opacity: 1, y: 0, duration: REVEAL.lineS, ease: 'power1.out' },
      stagger * (animated.length - 1),
    );
  return {
    finish() {
      if (!done) tl.progress(1);
    },
    get done() {
      return done;
    },
  };
}
