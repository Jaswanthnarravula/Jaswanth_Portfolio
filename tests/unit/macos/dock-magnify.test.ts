/**
 * MAC-DOCK-02 magnification maths (plans/macos/surfaces/dock.md): `scale = 1 + 0.6·cos²(πd / 2R)`, R = 3 icon pitches;
 * neighbours part so scaled icons never overlap and the row stays centred; the spring envelope scales the effect.
 */
import { describe, expect, it } from 'vitest';
import { MAGNIFY_GAIN, magnifyOffsets, magnifyScales } from '@/components/os/macos/dock-magnify';

const centres = [0, 52, 104, 156, 208, 260, 312];

describe('MAC-DOCK-02 magnification maths', () => {
  it('the peak is under the pointer; icons one reach away are unscaled', () => {
    const scales = magnifyScales(centres, 156, 52);
    expect(scales[3]).toBeCloseTo(1 + MAGNIFY_GAIN, 5);
    expect(scales[0]).toBe(1); // d = 156 = R: outside the reach
    expect(scales[2]).toBeCloseTo(1 + 0.6 * Math.cos(Math.PI / 6) ** 2, 5);
    expect(scales[2]).toBeCloseTo(scales[4]!, 5);
  });

  it('the envelope scales the whole effect (0: none, 0.5: half)', () => {
    expect(magnifyScales(centres, 156, 52, 0).every((scale) => scale === 1)).toBe(true);
    expect(magnifyScales(centres, 156, 52, 0.5)[3]).toBeCloseTo(1.3, 5);
  });

  it('neighbours part symmetrically, never overlap, and the row stays centred', () => {
    const size = 48;
    const scales = magnifyScales(centres, 156, 52);
    const offsets = magnifyOffsets(scales, size);
    expect(offsets[3]).toBeCloseTo(0, 5);
    expect(offsets[2]).toBeCloseTo(-offsets[4]!, 5);
    const left = (i: number) => centres[i]! + offsets[i]! - (size * scales[i]!) / 2;
    const right = (i: number) => centres[i]! + offsets[i]! + (size * scales[i]!) / 2;
    // The resting gap is 52 − 48 = 4 px; parting keeps every pair at least that far apart.
    for (let i = 1; i < centres.length; i++) expect(left(i)).toBeGreaterThanOrEqual(right(i - 1) + 3.999);
    expect(offsets.reduce((sum, value) => sum + value, 0)).toBeCloseTo(0, 5);
  });
});
