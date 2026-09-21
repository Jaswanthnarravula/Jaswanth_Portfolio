/**
 * `flight()` — shared/07 "Primitives": shared-element rect interpolation. The element is laid out at the *target*
 * rect and moved with a uniform `translate + scale` (never a non-uniform scale, so text and images never distort),
 * plus `clip-path: inset(… round r)` for aspect and corner changes. Progress is a closed-form spring on GSAP's ticker
 * (the one clock), so a retarget keeps velocity and a reverse (Esc / Back mid-flight) is continuous.
 * Reduced motion: a 150 ms opacity crossfade at the final geometry. `will-change` exists only while flying.
 */
import { gsap } from 'gsap';
import { REDUCED_CROSSFADE_MS } from './dur';
import { spring, type SpringConfig } from './spring';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Ticker {
  add(callback: () => void): void;
  remove(callback: () => void): void;
}

export type FlightEnd = 'landed' | 'reversed' | 'killed';

export interface Flight {
  /** Resolves when the flight comes to rest at the target (landed), back at the origin (reversed), or is killed. */
  readonly done: Promise<FlightEnd>;
  /** Re-measured target (resize, rotation): continue from the current position and velocity. */
  retarget(to: Rect): void;
  /** Fly back to the origin, keeping velocity. */
  reverse(): void;
  /** Jump to rest at the current target. */
  finish(): void;
  kill(): void;
}

export interface FlightOptions {
  readonly spring: SpringConfig;
  /** Corner radius on screen at the origin and at the target, in px. */
  readonly radius?: readonly [number, number];
  readonly reduced?: boolean;
  readonly ticker?: Ticker;
  readonly now?: () => number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const px = (n: number) => `${Math.round(n * 100) / 100}px`;

/**
 * The visual state at progress `p` (0 = origin, 1 = target; springs may overshoot slightly). The element's own box is
 * `to`; it is scaled uniformly to cover the visible box, centred on it, and clipped to it.
 */
export function flightFrame(from: Rect, to: Rect, p: number, radius: readonly [number, number] = [0, 0]) {
  const w = Math.max(1, lerp(from.width, to.width, p));
  const h = Math.max(1, lerp(from.height, to.height, p));
  const cx = lerp(from.x + from.width / 2, to.x + to.width / 2, p);
  const cy = lerp(from.y + from.height / 2, to.y + to.height / 2, p);
  const scale = Math.max(w / to.width, h / to.height);
  const tx = cx - (to.width * scale) / 2 - to.x;
  const ty = cy - (to.height * scale) / 2 - to.y;
  const insetX = Math.max(0, (to.width * scale - w) / 2 / scale);
  const insetY = Math.max(0, (to.height * scale - h) / 2 / scale);
  const r = Math.max(0, lerp(radius[0], radius[1], p)) / scale;
  return {
    scale,
    transform: `translate3d(${px(tx)}, ${px(ty)}, 0) scale(${Math.round(scale * 10000) / 10000})`,
    clipPath: `inset(${px(insetY)} ${px(insetX)} round ${px(r)})`,
  };
}

function place(el: HTMLElement, to: Rect) {
  el.style.position = 'fixed';
  el.style.left = px(to.x);
  el.style.top = px(to.y);
  el.style.width = px(to.width);
  el.style.height = px(to.height);
  el.style.transformOrigin = '0 0';
}

export function flight(el: HTMLElement, from: Rect, to: Rect, options: FlightOptions): Flight {
  const { radius = [0, 0], reduced = false, ticker = gsap.ticker, now = () => performance.now() } = options;
  let target = to;
  let settle: (end: FlightEnd) => void = () => undefined;
  const done = new Promise<FlightEnd>((resolve) => (settle = resolve));
  let finished = false;

  const apply = (p: number) => {
    const frame = flightFrame(from, target, p, radius);
    el.style.transform = frame.transform;
    el.style.clipPath = frame.clipPath;
  };
  const end = (result: FlightEnd) => {
    if (finished) return;
    finished = true;
    ticker.remove(tick);
    el.style.willChange = '';
    settle(result);
  };

  place(el, target);

  if (reduced) {
    // Reduced motion: no travel; the target fades in over the crossfade token.
    apply(1);
    el.style.opacity = '0';
    const fade = gsap.to(el, {
      opacity: 1,
      duration: REDUCED_CROSSFADE_MS / 1000,
      ease: 'none',
      onComplete: () => end('landed'),
    });
    return {
      done,
      retarget(next) {
        target = next;
        place(el, target);
        apply(1);
      },
      reverse() {
        fade.kill();
        gsap.to(el, {
          opacity: 0,
          duration: REDUCED_CROSSFADE_MS / 1000,
          ease: 'none',
          onComplete: () => end('reversed'),
        });
      },
      finish() {
        fade.progress(1);
      },
      kill() {
        fade.kill();
        end('killed');
      },
    };
  }

  const progress = spring(0, options.spring, now());
  progress.retarget(1, now());
  el.style.willChange = 'transform, clip-path';
  apply(0);

  function tick() {
    const t = now();
    const { value } = progress.sample(t);
    if (progress.atRest(t)) {
      apply(progress.target);
      end(progress.target === 1 ? 'landed' : 'reversed');
      return;
    }
    apply(value);
  }
  ticker.add(tick);

  return {
    done,
    retarget(next) {
      target = next;
      place(el, target);
    },
    reverse() {
      if (!finished) progress.retarget(0, now());
    },
    finish() {
      if (finished) return;
      progress.snap(progress.target, now());
      apply(progress.target);
      end(progress.target === 1 ? 'landed' : 'reversed');
    },
    kill() {
      end('killed');
    },
  };
}
