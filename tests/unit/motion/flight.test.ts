/**
 * flight() — shared/07 primitive used by the chooser enter transition (CHOOSE-ENTER-01); its own ID
 * (MOTION-FLIGHT-01, e2e O1) is verified with the OSes that fly icons. Geometry is pure; the spring runs on a fake
 * ticker and clock so every frame is deterministic.
 */
import { describe, expect, it } from 'vitest';
import { flight, flightFrame, type Rect, type Ticker } from '@/lib/motion/flight';
import { SPRINGS } from '@/lib/motion/spring';

const card: Rect = { x: 100, y: 120, width: 320, height: 200 };
const screen: Rect = { x: 0, y: 0, width: 1280, height: 800 };

function harness() {
  let clock = 0;
  const callbacks = new Set<() => void>();
  const ticker: Ticker = { add: (cb) => callbacks.add(cb), remove: (cb) => callbacks.delete(cb) };
  const el = { style: {} as Record<string, string> } as unknown as HTMLElement;
  const run = (ms: number) => {
    for (let t = 0; t < ms && callbacks.size; t += 16) {
      clock += 16;
      for (const cb of [...callbacks]) cb();
    }
  };
  return { el, ticker, now: () => clock, run, live: () => callbacks.size };
}
const scaleOf = (transform: string) => Number(/scale\(([\d.]+)\)/.exec(transform)![1]);

describe('flight() geometry', () => {
  it('starts exactly on the origin and ends exactly on the target with a uniform scale', () => {
    const start = flightFrame(card, screen, 0, [14, 0]);
    expect(start.transform).toBe('translate3d(100px, 120px, 0) scale(0.25)');
    expect(start.clipPath).toBe('inset(0px 0px round 56px)'); // 14 px on screen ÷ 0.25
    const end = flightFrame(card, screen, 1, [14, 0]);
    expect(end.transform).toBe('translate3d(0px, 0px, 0) scale(1)');
    expect(end.clipPath).toBe('inset(0px 0px round 0px)');
  });
  it('clips instead of stretching when the aspect ratio changes', () => {
    const square: Rect = { x: 0, y: 0, width: 100, height: 100 };
    const wide: Rect = { x: 0, y: 0, width: 200, height: 100 };
    const frame = flightFrame(square, wide, 0);
    expect(frame.scale).toBe(1);
    expect(frame.transform).toBe('translate3d(-50px, 0px, 0) scale(1)');
    expect(frame.clipPath).toBe('inset(0px 50px round 0px)');
  });
});

describe('flight() motion', () => {
  it('lands on the target, then clears will-change', async () => {
    const h = harness();
    const f = flight(h.el, card, screen, {
      spring: SPRINGS.chooserFlight,
      radius: [14, 0],
      ticker: h.ticker,
      now: h.now,
    });
    expect(h.el.style.willChange).toBe('transform, clip-path');
    h.run(3000);
    await expect(f.done).resolves.toBe('landed');
    expect(scaleOf(h.el.style.transform)).toBe(1);
    expect(h.el.style.willChange).toBe('');
    expect(h.live()).toBe(0);
  });
  it('reverse mid-flight flies back to the origin', async () => {
    const h = harness();
    const f = flight(h.el, card, screen, { spring: SPRINGS.chooserFlight, ticker: h.ticker, now: h.now });
    h.run(160);
    const mid = scaleOf(h.el.style.transform);
    expect(mid).toBeGreaterThan(0.25);
    expect(mid).toBeLessThan(1);
    f.reverse();
    h.run(4000);
    await expect(f.done).resolves.toBe('reversed');
    expect(h.el.style.transform).toBe(flightFrame(card, screen, 0).transform);
  });
  it('a retarget (rotation) lands on the re-measured rect', async () => {
    const h = harness();
    const f = flight(h.el, card, screen, { spring: SPRINGS.chooserFlight, ticker: h.ticker, now: h.now });
    h.run(100);
    const rotated: Rect = { x: 0, y: 0, width: 800, height: 1280 };
    f.retarget(rotated);
    h.run(3000);
    await expect(f.done).resolves.toBe('landed');
    expect(h.el.style.width).toBe('800px');
    expect(h.el.style.transform).toBe('translate3d(0px, 0px, 0) scale(1)');
  });
  it('finish() jumps to rest; kill() stops without landing', async () => {
    const h = harness();
    const finished = flight(h.el, card, screen, { spring: SPRINGS.chooserFlight, ticker: h.ticker, now: h.now });
    finished.finish();
    await expect(finished.done).resolves.toBe('landed');
    const killed = flight(h.el, card, screen, { spring: SPRINGS.chooserFlight, ticker: h.ticker, now: h.now });
    killed.kill();
    await expect(killed.done).resolves.toBe('killed');
    expect(h.live()).toBe(0);
  });
});
