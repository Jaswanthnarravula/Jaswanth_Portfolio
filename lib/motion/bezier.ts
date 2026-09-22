/**
 * CSS `cubic-bezier(x1, y1, x2, y2)` as an easing function (0..1 → 0..1), so GSAP timelines can use the exact curves
 * the OS motion tables specify (e.g. macOS open `0.2, 0.9, 0.3, 1`) without shipping CustomEase. Newton–Raphson with a
 * bisection fallback, the same approach browsers use; accurate to ~1e-6.
 */
export type Easing = (t: number) => number;

export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  const solveX = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < 1e-7) return t;
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const value = sampleX(t);
      if (Math.abs(value - x) < 1e-7) return t;
      if (value < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };

  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return sampleY(solveX(t));
  };
}

/** Parse `"0.2, 0.9, 0.3, 1"` or `"cubic-bezier(0.2, 0.9, 0.3, 1)"`. */
export function easingFrom(css: string): Easing {
  const numbers = css.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
  if (numbers.length !== 4) throw new Error(`Not a cubic-bezier: ${css}`);
  const [x1, y1, x2, y2] = numbers as [number, number, number, number];
  return cubicBezier(x1, y1, x2, y2);
}
