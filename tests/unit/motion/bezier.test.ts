/** MAC-MOTION token support: `cubicBezier` reproduces CSS easing curves (the macOS timing table's exact curves). */
import { describe, expect, it } from 'vitest';
import { cubicBezier, easingFrom } from '@/lib/motion/bezier';

describe('cubicBezier', () => {
  it('pins the endpoints and is monotonic for the macOS curves', () => {
    for (const curve of [cubicBezier(0.2, 0.9, 0.3, 1), cubicBezier(0.4, 0, 1, 1), cubicBezier(0.3, 0, 0.1, 1)]) {
      expect(curve(0)).toBe(0);
      expect(curve(1)).toBe(1);
      let previous = 0;
      for (let t = 0.05; t < 1; t += 0.05) {
        const value = curve(t);
        expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
        previous = value;
      }
    }
  });

  it('matches known CSS values (ease, linear) to 1e-3', () => {
    const ease = cubicBezier(0.25, 0.1, 0.25, 1);
    expect(ease(0.5)).toBeCloseTo(0.8024, 3);
    expect(ease(0.25)).toBeCloseTo(0.4085, 3);
    const linear = cubicBezier(0, 0, 1, 1);
    for (const t of [0.1, 0.33, 0.7]) expect(linear(t)).toBeCloseTo(t, 5);
  });

  it('the macOS open curve front-loads the motion (quick, confident ease-out)', () => {
    const open = cubicBezier(0.2, 0.9, 0.3, 1);
    expect(open(0.3)).toBeGreaterThan(0.7);
  });

  it('parses CSS strings', () => {
    expect(easingFrom('cubic-bezier(0.2, 0.9, 0.3, 1)')(0.5)).toBeCloseTo(cubicBezier(0.2, 0.9, 0.3, 1)(0.5), 9);
    expect(() => easingFrom('ease-in')).toThrow();
  });
});
