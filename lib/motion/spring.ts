/**
 * Closed-form damped spring — shared/07 `MOTION-SPRING-01`. Exact and frame-rate independent; `retarget` keeps the
 * current velocity so an interrupted animation never jumps (input always wins).
 *   k = (2π / response)²,  c = 2 · damping · √k,  m = 1
 */
export interface SpringConfig {
  /** Seconds for one undamped period. */
  readonly response: number;
  /** Damping ratio ζ: < 1 overshoots, 1 is critical. */
  readonly damping: number;
}

export interface SpringSample {
  readonly value: number;
  readonly velocity: number;
}

/** Displacement/velocity of `x(t)` for a spring released at `x0` (relative to the target) with velocity `v0`. */
export function solveSpring(x0: number, v0: number, { response, damping }: SpringConfig, t: number): SpringSample {
  const omega = (2 * Math.PI) / Math.max(response, 1e-4);
  const zeta = Math.max(damping, 0);
  if (t <= 0) return { value: x0, velocity: v0 };
  if (Math.abs(zeta - 1) < 1e-6) {
    const e = Math.exp(-omega * t);
    const b = v0 + omega * x0;
    return { value: e * (x0 + b * t), velocity: e * (b - omega * (x0 + b * t)) };
  }
  if (zeta < 1) {
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    const e = Math.exp(-zeta * omega * t);
    const b = (v0 + zeta * omega * x0) / wd;
    const cos = Math.cos(wd * t);
    const sin = Math.sin(wd * t);
    const value = e * (x0 * cos + b * sin);
    const velocity = e * ((-x0 * wd + b * -zeta * omega) * sin + (b * wd - zeta * omega * x0) * cos);
    return { value, velocity };
  }
  const root = Math.sqrt(zeta * zeta - 1);
  const r1 = -omega * (zeta - root);
  const r2 = -omega * (zeta + root);
  const c2 = (v0 - r1 * x0) / (r2 - r1);
  const c1 = x0 - c2;
  const e1 = Math.exp(r1 * t);
  const e2 = Math.exp(r2 * t);
  return { value: c1 * e1 + c2 * e2, velocity: c1 * r1 * e1 + c2 * r2 * e2 };
}

export interface Spring {
  /** Current target. */
  readonly target: number;
  sample(nowMs: number): SpringSample;
  /** Aim at a new target from the current position *and velocity*. */
  retarget(target: number, nowMs: number): void;
  /** Jump to a value at rest (reduced motion, `kill()` + set-final). */
  snap(value: number, nowMs: number): void;
  atRest(nowMs: number, epsilon?: number): boolean;
}

export function spring(initial: number, config: SpringConfig, nowMs = 0, velocity = 0): Spring {
  let origin = initial;
  let target = initial;
  let startVelocity = velocity;
  let startTime = nowMs;
  const at = (nowMs: number): SpringSample => {
    const t = (nowMs - startTime) / 1000;
    const { value, velocity: v } = solveSpring(origin - target, startVelocity, config, t);
    return { value: target + value, velocity: v };
  };
  return {
    get target() {
      return target;
    },
    sample: at,
    retarget(next, nowMs) {
      const current = at(nowMs);
      origin = current.value;
      startVelocity = current.velocity;
      startTime = nowMs;
      target = next;
    },
    snap(value, nowMs) {
      origin = value;
      target = value;
      startVelocity = 0;
      startTime = nowMs;
    },
    atRest(nowMs, epsilon = 0.001) {
      const { value, velocity: v } = at(nowMs);
      return Math.abs(value - target) < epsilon && Math.abs(v) < epsilon * 10;
    },
  };
}

/** Named springs from the motion tables (shared/07 + per-OS 03-motion files reference these by name). */
export const SPRINGS = {
  press: { response: 0.18, damping: 1 },
  card: { response: 0.3, damping: 1 },
  chooserFlight: { response: 0.55, damping: 0.9 },
  /** plans/04 exit: the snapshot shrinks back into its card (settles in ~420 ms, no overshoot). */
  chooserReturn: { response: 0.42, damping: 1 },
  iosOpen: { response: 0.22, damping: 0.92 },
  iosClose: { response: 0.24, damping: 0.9 },
  dockMagnify: { response: 0.18, damping: 1 },
} as const satisfies Record<string, SpringConfig>;
