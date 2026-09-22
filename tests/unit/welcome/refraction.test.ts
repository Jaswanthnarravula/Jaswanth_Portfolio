/**
 * The Hello lens's edge refraction (components/welcome/refraction.ts; owner decision 2026-09-21, plans/06 Deviations
 * log): the displacement map is neutral inside and in the margin, bends outward along the edge normal within the band
 * (strongest at the rim), bends the corners diagonally, and is deterministic; only Chromium on a desktop-class screen
 * with full glass is eligible.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LENS_REFRACTION, refractionEligible, refractionMap } from '@/components/welcome/refraction';

describe('one set of refraction numbers', () => {
  it('the CSS layer, the WebGL shader and refraction.ts agree', () => {
    const css = readFileSync('components/welcome/welcome.module.css', 'utf8');
    const frag = readFileSync('shaders/hello.frag', 'utf8');
    const { margin, scale, band, power } = LENS_REFRACTION;
    expect(margin, 'margin must hold the largest bend').toBeGreaterThanOrEqual(scale / 2);
    expect(css).toContain(`inset: -${margin}px;`);
    expect(css).toContain(`clip-path: inset(${margin}px round 2.4em);`);
    expect(frag).toContain(`const float BAND = ${band.toFixed(1)};`);
    expect(frag).toContain(`const float BEND = ${(scale / 2).toFixed(1)};`);
    expect(frag).toContain(`const float POWER = ${power.toFixed(1)};`);
  });
});

const W = 806;
const H = 630;
const R = 49;
const map = refractionMap(W, H, R);
const { margin, band, resolution: k } = LENS_REFRACTION;
/** The map's R/G at a point given in lens CSS px (0,0 = the lens's top-left corner). */
const at = (x: number, y: number) => {
  const mx = Math.min(map.width - 1, Math.floor((x + margin) * k));
  const my = Math.min(map.height - 1, Math.floor((y + margin) * k));
  const i = (my * map.width + mx) * 4;
  return { r: map.data[i]!, g: map.data[i + 1]!, b: map.data[i + 2]!, a: map.data[i + 3]! };
};

describe('lens refraction map', () => {
  it('covers the lens plus the margin on every side', () => {
    expect(map.width).toBe(Math.round((W + 2 * margin) * k));
    expect(map.height).toBe(Math.round((H + 2 * margin) * k));
    expect(map.data).toHaveLength(map.width * map.height * 4);
  });

  it('is neutral in the middle of the glass and outside it', () => {
    for (const [x, y] of [
      [W / 2, H / 2],
      [W / 2, band + 20],
      [band + 20, H / 2],
      [-margin / 2, H / 2],
      [W + margin / 2, H / 2],
      [W / 2, -margin / 2],
    ] as const)
      expect(at(x, y), `(${x}, ${y})`).toEqual({ r: 128, g: 128, b: 128, a: 255 });
  });

  it('bends outward along each edge, strongest at the rim', () => {
    const right = [W - 4, W - 30, W - 60].map((x) => at(x, H / 2).r);
    expect(right[0]).toBeGreaterThan(right[1]!);
    expect(right[1]).toBeGreaterThan(right[2]!);
    expect(right[2]).toBeGreaterThan(128);
    expect(at(W - 4, H / 2).g).toBe(128); // straight edge: no sideways bend
    expect(at(4, H / 2).r).toBeLessThan(40); // left edge bends left
    expect(at(W / 2, 4).g).toBeLessThan(40); // top edge bends up
    expect(at(W / 2, H - 4).g).toBeGreaterThan(215); // bottom edge bends down
  });

  it('bends the corners diagonally and smoothly (rounded normals, no mitre)', () => {
    const corner = at(W - 16, H - 16);
    expect(corner.r).toBeGreaterThan(140);
    expect(corner.g).toBeGreaterThan(140);
    expect(Math.abs(corner.r - corner.g)).toBeLessThan(6);
    // Along the diagonal band the direction turns gradually: neighbours never jump.
    for (let s = 20; s < band; s += 4) {
      const a = at(W - s, H - band + 10);
      const b = at(W - s - 4, H - band + 10);
      expect(Math.abs(a.r - b.r) + Math.abs(a.g - b.g), `step at ${s}`).toBeLessThan(24);
    }
  });

  it('is deterministic', () => {
    // A small lens keeps this cheap; the full-size map above is built once for the other checks.
    expect(refractionMap(240, 160, 24).data).toEqual(refractionMap(240, 160, 24).data);
  });
});

describe('lens refraction eligibility', () => {
  const desktop = (query: string) => ['(pointer: fine)', '(min-width: 1024px)'].includes(query);
  const full = { glass: 'full', tier: '1' };

  it('runs in Chromium on a desktop-class screen with full glass', () => {
    expect(refractionEligible({ chromium: true, dataset: full, matches: desktop })).toBe(true);
    expect(refractionEligible({ chromium: true, dataset: { glass: 'full', tier: '2' }, matches: desktop })).toBe(true);
  });

  it('never in Safari or Firefox, on T0, with solid glass, on touch, small or forced-colour screens', () => {
    expect(refractionEligible({ chromium: false, dataset: full, matches: desktop })).toBe(false);
    expect(refractionEligible({ chromium: true, dataset: { glass: 'full', tier: '0' }, matches: desktop })).toBe(false);
    expect(refractionEligible({ chromium: true, dataset: { glass: 'solid', tier: '1' }, matches: desktop })).toBe(
      false,
    );
    expect(refractionEligible({ chromium: true, dataset: full, matches: (q) => q === '(min-width: 1024px)' })).toBe(
      false,
    );
    expect(refractionEligible({ chromium: true, dataset: full, matches: (q) => q === '(pointer: fine)' })).toBe(false);
    expect(
      refractionEligible({
        chromium: true,
        dataset: full,
        matches: (q) => desktop(q) || q === '(forced-colors: active)',
      }),
    ).toBe(false);
  });
});
