/**
 * HELLO-PATHS-01 (generated, normalized, deterministic single-stroke paths) · HELLO-MORPH-01 (every greeting pair
 * morphs or explicitly crossfades). The pipeline runs on synthetic rasters so CI needs no font files; the committed
 * output is validated as data.
 */
import { describe, expect, it } from 'vitest';
import {
  GREETINGS,
  CURSIVE_HELLO,
  MORPH_LIMITS,
  VIEW,
  greetingFromPath,
  greetingFromRaster,
  pairModes,
  simplify,
} from '../../../scripts/build-hello-paths.mjs';
import generated from '@/lib/welcome/hello-paths.generated.json';

/** A w×h grey raster with thick ink strokes drawn by `paint`. */
function raster(w: number, h: number, paint: (x: number, y: number) => boolean) {
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (paint(x, y)) data[y * w + x] = 255;
  return { data, width: w, height: h };
}
// An "L" (one pen stroke round a corner) and a ring (one closed stroke), both 12 px thick.
const L = (x: number, y: number) =>
  (x >= 20 && x < 32 && y >= 20 && y < 140) || (x >= 20 && x < 110 && y >= 128 && y < 140);
const ring = (x: number, y: number) => {
  const d = Math.hypot(x - 200, y - 80);
  return d >= 44 && d < 56;
};
const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
/** On-curve points (M/L targets and each C's end point) vs Bézier control points. */
function points(d: string) {
  const onCurve: number[][] = [];
  const control: number[][] = [];
  for (const [, command, args] of d.matchAll(/([MLC])([^MLC]*)/g)) {
    const values = numbers(args!);
    const pairs = values.flatMap((_, i) => (i % 2 === 0 ? [[values[i]!, values[i + 1]!]] : []));
    if (command === 'C') control.push(...pairs.slice(0, 2));
    onCurve.push(pairs[pairs.length - 1]!);
  }
  return { onCurve, control };
}
const within = (pts: number[][], margin: number) =>
  pts.every(([x, y]) => x! >= -margin && x! <= VIEW.width + margin && y! >= -margin && y! <= VIEW.height + margin);

describe('HELLO-PATHS-01 build-hello-paths output normalized + deterministic', () => {
  const input = raster(280, 170, (x, y) => L(x, y) || ring(x, y));

  it('thins ink to single pen strokes: an L is one stroke, a ring is one closed stroke', () => {
    const shape = greetingFromRaster(input);
    expect(shape.strokes).toBe(2);
    expect(shape.d.match(/M/g)).toHaveLength(2);
  });
  it('is deterministic: the same raster always gives the same bytes', () => {
    expect(greetingFromRaster(input)).toEqual(greetingFromRaster(raster(280, 170, (x, y) => L(x, y) || ring(x, y))));
  });
  it('normalizes into the shared view box, centred, at one-decimal precision', () => {
    const { d } = greetingFromRaster(input);
    const { onCurve, control } = points(d);
    expect(within(onCurve, 0)).toBe(true); // the drawn line stays inside the box
    expect(within(control, VIEW.padY)).toBe(true); // handles may reach into the padding, never past it
    const xs = onCurve.map(([x]) => x!);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(VIEW.width / 2, 0); // centred
    for (const v of numbers(d)) expect(Math.round(v * 10) / 10).toBe(v);
  });
  it('the authored cursive "hello" stays one pen stroke, normalized into the box, deterministically', () => {
    const shape = greetingFromPath(CURSIVE_HELLO);
    expect(shape.strokes).toBe(1);
    expect(shape).toEqual(greetingFromPath(CURSIVE_HELLO));
    const { onCurve, control } = points(shape.d);
    expect(within(onCurve, 0)).toBe(true);
    expect(within(control, VIEW.padY)).toBe(true);
    expect(generated.greetings[0]!.d).toBe(shape.d); // the committed opening greeting is this stroke
  });
  it('simplification keeps the endpoints and drops collinear points', () => {
    expect(
      simplify(
        [
          [0, 0],
          [1, 0.01],
          [2, 0],
          [3, 5],
        ],
        0.5,
      ),
    ).toEqual([
      [0, 0],
      [2, 0],
      [3, 5],
    ]);
  });
  it('the committed paths cover the five greetings inside the view box', () => {
    expect(generated.viewBox).toEqual([0, 0, VIEW.width, VIEW.height]);
    expect(generated.greetings.map((g) => g.id)).toEqual(GREETINGS.map((g) => g.id));
    for (const greeting of generated.greetings) {
      expect(greeting.strokes, greeting.id).toBeGreaterThan(0);
      expect(greeting.d.match(/M/g)?.length, greeting.id).toBe(greeting.strokes);
      const { onCurve, control } = points(greeting.d);
      expect(within(onCurve, 0), greeting.id).toBe(true);
      expect(within(control, VIEW.padY), greeting.id).toBe(true);
    }
    for (const source of generated.sources) expect(source.licence).toBe('SIL OFL 1.1');
  });
});

describe('HELLO-MORPH-01 every greeting pair has morph data or an explicit crossfade', () => {
  it('each consecutive pair in loop order, including the closing pair, has a mode', () => {
    const ids = generated.greetings.map((g) => g.id);
    expect(generated.pairs.map((p) => [p.from, p.to])).toEqual(ids.map((id, i) => [id, ids[(i + 1) % ids.length]]));
    for (const pair of generated.pairs) expect(['morph', 'crossfade']).toContain(pair.mode);
  });
  it('a pair morphs only within the stroke and segment limits; the committed table matches the rule', () => {
    expect(pairModes(generated.greetings)).toEqual(generated.pairs);
    const byId = new Map(generated.greetings.map((g) => [g.id, g]));
    for (const pair of generated.pairs.filter((p) => p.mode === 'morph')) {
      const a = byId.get(pair.from)!;
      const b = byId.get(pair.to)!;
      expect(Math.max(a.strokes, b.strokes) / Math.min(a.strokes, b.strokes)).toBeLessThanOrEqual(
        MORPH_LIMITS.strokeRatio,
      );
      expect(Math.max(a.segments, b.segments) / Math.min(a.segments, b.segments)).toBeLessThanOrEqual(
        MORPH_LIMITS.segmentRatio,
      );
    }
  });
  it('mismatched shapes crossfade instead of morphing', () => {
    const tiny = { id: 'a', strokes: 1, segments: 4 };
    const huge = { id: 'b', strokes: 10, segments: 90 };
    expect(pairModes([tiny, huge]).map((p) => p.mode)).toEqual(['crossfade', 'crossfade']);
  });
});
