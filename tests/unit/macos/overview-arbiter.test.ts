/**
 * Pure macOS mechanics: MAC-MC-01 (the Mission Control packing function never overlaps, keeps aspect ratios, fits the
 * area, and scrolls past the 180 px minimum) · MAC-EDGE-04 (the overlay arbiter's priority table, E15 / E22).
 */
import { describe, expect, it } from 'vitest';
import { overlaps, packOverview, type PackInput } from '@/components/os/shared/overview-pack';
import { arbitrateMac, MAC_OVERLAYS, pickMac, type MacOverlay } from '@/components/os/macos/arbiter';

const area = { x: 40, y: 64, w: 1360, h: 700 };
const win = (id: string, x: number, y: number, w: number, h: number): PackInput => ({ id, rect: { x, y, w, h } });

describe('MAC-MC-01 packing', () => {
  const sets: readonly (readonly PackInput[])[] = [
    [win('a', 100, 200, 900, 500)],
    [win('a', 100, 200, 900, 500), win('b', 400, 120, 700, 460)],
    [
      win('a', 100, 200, 900, 500),
      win('b', 400, 120, 700, 460),
      win('c', 200, 90, 1080, 680),
      win('d', 300, 150, 460, 520),
    ],
    Array.from({ length: 8 }, (_, i) =>
      win(`w${i}`, 60 + i * 40, 80 + i * 20, 600 + (i % 3) * 120, 400 + (i % 2) * 120),
    ),
  ];

  it.each(sets.map((set) => [set.length, set] as const))(
    '%i windows: no overlap, aspect kept, inside the area',
    (_n, set) => {
      const { tiles, height } = packOverview(set, { area, gap: 24, label: 28 });
      expect(tiles).toHaveLength(set.length);
      for (const [i, a] of tiles.entries()) {
        for (const b of tiles.slice(i + 1)) expect(overlaps(a, b), `${a.id}/${b.id}`).toBe(false);
        const source = set.find((w) => w.id === a.id)!.rect;
        expect(a.w / a.h).toBeCloseTo(source.w / source.h, 5);
        expect(a.x).toBeGreaterThanOrEqual(area.x - 0.01);
        expect(a.x + a.w).toBeLessThanOrEqual(area.x + area.w + 0.01);
      }
      expect(height).toBeLessThanOrEqual(area.h + 0.01);
      expect(tiles.map((tile) => tile.id)).toEqual(set.map((w) => w.id)); // caller's order
    },
  );

  it('eight windows on a small laptop: tiles stop at 180 px wide and the grid scrolls', () => {
    const small = { x: 16, y: 40, w: 760, h: 420 };
    const eight = Array.from({ length: 8 }, (_, i) => win(`w${i}`, i * 30, i * 20, 640, 480));
    const { tiles, height } = packOverview(eight, { area: small, gap: 24, label: 28, minWidth: 180 });
    for (const tile of tiles) expect(tile.w).toBeGreaterThanOrEqual(180 - 0.01);
    for (const [i, a] of tiles.entries()) for (const b of tiles.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
    expect(height).toBeGreaterThan(small.h);
  });

  it('never enlarges past the tallest window; empty input is empty', () => {
    const { tiles } = packOverview([win('tiny', 0, 0, 200, 120)], { area });
    expect(tiles[0]!.h).toBe(120);
    expect(packOverview([], { area })).toEqual({ tiles: [], height: 0 });
    expect(packOverview([win('a', 0, 0, 10, 10)], { area: { x: 0, y: 0, w: 0, h: 0 } }).tiles).toEqual([]);
  });
});

describe('MAC-EDGE-04 overlay arbiter (modal dialog › menu › Spotlight › Mission Control › banner)', () => {
  it.each<[MacOverlay | null, MacOverlay, string]>([
    [null, 'spotlight', 'open'],
    ['spotlight', 'spotlight', 'keep'],
    ['menu', 'spotlight', 'replace'], // a menu closes first (surfaces/spotlight.md)
    ['context', 'mission', 'replace'],
    ['notification-center', 'control-center', 'replace'],
    ['mission', 'spotlight', 'drop'], // E15
    ['spotlight', 'mission', 'drop'],
    ['dialog', 'menu', 'drop'],
    ['dialog', 'spotlight', 'drop'],
    ['mission', 'dialog', 'replace'],
    ['spotlight', 'dialog', 'replace'],
    ['spotlight', 'banner', 'coexist'],
    ['banner', 'menu', 'open'],
  ])('%s + %s → %s', (open, requested, verdict) => {
    expect(arbitrateMac(open, requested)).toBe(verdict);
  });

  it('simultaneous requests: the highest priority wins; banners pass', () => {
    expect(pickMac(['banner', 'menu'])).toBe('menu');
    expect(pickMac(['mission', 'spotlight', 'dialog'])).toBe('dialog');
    expect(pickMac(['banner'])).toBeNull();
    expect(MAC_OVERLAYS.priority[0]).toBe('dialog');
  });
});
