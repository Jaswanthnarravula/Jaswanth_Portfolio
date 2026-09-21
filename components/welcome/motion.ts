/**
 * `welcome-motion` chunk (shared/10: idle after first paint, ≤ 45 KB) — the authored sequences of the welcome layer,
 * all on GSAP's ticker (shared/07): greeting morphs (plans/02), the intro timeline, the profiles entrance and the
 * avatar hand-off (plans/03). Values are written imperatively to elements; only transform and opacity animate
 * (plus MorphSVG path data on one small SVG). Every function returns a way to finish or kill it: input always wins.
 */
import { gsap } from 'gsap';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import paths from '@/lib/welcome/hello-paths.generated.json';

gsap.registerPlugin(MorphSVGPlugin);

const HOLD_S = 1.5; // greeting visible; with the 0.9 s morph → a new greeting every 2.4 s
const MORPH_S = 0.9;
const byId = new Map(paths.greetings.map((greeting) => [greeting.id, greeting]));

/**
 * The greeting loop, started once the CSS stroke draw has finished. Morph pairs use MorphSVG; pairs whose shapes are
 * too different crossfade through the second path. Pauses while the tab is hidden. Returns stop().
 */
export function greetingLoop(glyph: SVGPathElement, alt: SVGPathElement): () => void {
  const first = paths.greetings[0]!;
  glyph.style.strokeDasharray = 'none'; // the draw is over; dashes would fight the morph
  const tl = gsap.timeline({ repeat: -1 });
  for (const pair of paths.pairs) {
    const to = byId.get(pair.to)!;
    if (pair.mode === 'morph') {
      tl.to(glyph, { morphSVG: to.d, duration: MORPH_S, ease: 'power2.inOut' }, `+=${HOLD_S}`);
    } else {
      tl.set(alt, { attr: { d: to.d }, opacity: 0 }, `+=${HOLD_S}`)
        .to(glyph, { opacity: 0, duration: MORPH_S / 2, ease: 'power2.inOut' }, '<')
        .to(alt, { opacity: 1, duration: MORPH_S / 2, ease: 'power2.inOut' }, '<')
        .set(glyph, { attr: { d: to.d }, opacity: 1 })
        .set(alt, { opacity: 0 });
    }
  }
  const onVisibility = () => (document.hidden ? tl.pause() : tl.resume());
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    tl.kill();
    gsap.set(glyph, { attr: { d: first.d }, opacity: 1 });
    gsap.set(alt, { opacity: 0 });
  };
}

export interface Playback {
  /** Jump to the end state (fires onDone). */
  finish(): void;
  kill(): void;
}

/**
 * The intro (plans/03 timeline): wordmark in over 400 ms (0.8 → 1), zoom 1 → 3 with a fade from 900 ms over 2600 ms,
 * profiles by 3.5 s. Muted: 1.2 s. Reduced motion: fade in and out, no zoom, ≤ 200 ms segments, 800 ms in all.
 */
export function playIntro(
  wordmark: Element,
  { muted, reduced, onDone }: { muted: boolean; reduced: boolean; onDone: () => void },
): Playback {
  const tl = gsap.timeline({ onComplete: onDone });
  gsap.set(wordmark, { opacity: 0, scale: reduced ? 1 : 0.8, transformOrigin: '50% 50%' });
  if (reduced) {
    tl.to(wordmark, { opacity: 1, duration: 0.2, ease: 'none' })
      .to(wordmark, { opacity: 0, duration: 0.2, ease: 'none' }, '+=0.4')
      .set({}, {}, 0.8);
  } else if (muted) {
    tl.to(wordmark, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(1.6)' }).to(
      wordmark,
      { scale: 2.2, opacity: 0, duration: 0.7, ease: 'expo.in' },
      0.5,
    );
  } else {
    tl.to(wordmark, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.6)' }).to(
      wordmark,
      { scale: 3, opacity: 0, duration: 2.6, ease: 'expo.out' },
      0.9,
    );
  }
  return { finish: () => tl.progress(1), kill: () => tl.kill() };
}

/** Profiles entrance: heading fades up 16 px / 500 ms; cards stagger in from 200 ms, 120 ms apart, rising 24 px. */
export function profilesEntrance(heading: Element, cards: readonly Element[]): Playback {
  const tl = gsap.timeline();
  tl.fromTo(heading, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' }).fromTo(
    cards,
    { y: 24, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out', stagger: 0.12, clearProps: 'transform,opacity' },
    0.2,
  );
  return { finish: () => tl.progress(1), kill: () => tl.kill() };
}

/**
 * Select: the chosen avatar scales toward the centre of the screen while everything else fades (420 ms).
 * Resolves with the avatar's final rect, which the chooser continues from.
 */
export function handOff(
  avatar: HTMLElement,
  fading: readonly Element[],
  { reduced }: { reduced: boolean },
): Promise<DOMRect> {
  const from = avatar.getBoundingClientRect();
  const size = Math.min(window.innerWidth, window.innerHeight) * 0.26;
  const scale = reduced ? 1 : Math.min(1.6, Math.max(1, size / from.width));
  const dx = window.innerWidth / 2 - (from.left + from.width / 2);
  const dy = window.innerHeight / 2 - (from.top + from.height / 2);
  return new Promise((resolve) => {
    const tl = gsap.timeline({ onComplete: () => resolve(avatar.getBoundingClientRect()) });
    tl.to(fading, { opacity: 0, duration: reduced ? 0.15 : 0.42, ease: 'power2.out' }, 0);
    if (!reduced) tl.to(avatar, { x: dx, y: dy, scale, duration: 0.42, ease: 'power3.inOut' }, 0);
  });
}
