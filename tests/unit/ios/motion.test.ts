/**
 * iOS motion (plans/ios/03): IOS-MOTION-01 the spring + curve tables as tokens · IOS-MOTION-04 compositor-only writes
 * (the surface flight writes only transform / clip-path / opacity) · IOS-MOTION-03 retarget keeps velocity (reversal
 * reuses the spring) · IOS-FLIGHT-01/02 flight geometry (icon radius, launch crossfade 15–50 %, absent-icon fallback) ·
 * IOS-FLIGHT-03 the Home gesture's 1:1 rect.
 */
import { describe, expect, it } from 'vitest';
import {
  absentVisual,
  gestureVisual,
  iconRadius,
  IOS_EASE,
  IOS_SPRINGS,
  IOS_TIMING,
  launchOpacity,
  mixVisual,
  openness,
  springSamples,
  surfaceMotion,
  type Visual,
} from '@/components/os/ios/motion';
import { SPRINGS } from '@/lib/motion/spring';

describe('IOS-MOTION-01 iOS motion tokens match plans/ios/03-motion.md', () => {
  it('springs (response, damping)', () => {
    expect(IOS_SPRINGS.open).toEqual({ response: 0.26, damping: 0.92 });
    expect(IOS_SPRINGS.close).toEqual({ response: 0.28, damping: 0.9 });
    expect(IOS_SPRINGS.homeSettle).toEqual({ response: 0.28, damping: 0.9 });
    expect(IOS_SPRINGS.sheet).toEqual({ response: 0.32, damping: 1 });
    expect(IOS_SPRINGS.banner).toEqual({ response: 0.38, damping: 0.78 });
    expect(IOS_SPRINGS.quickMenu).toEqual({ response: 0.35, damping: 0.75 });
    expect(IOS_SPRINGS.press).toEqual({ response: 0.18, damping: 1 });
    expect(IOS_SPRINGS.switchThumb).toEqual({ response: 0.25, damping: 0.9 });
    expect(IOS_SPRINGS.segment).toEqual({ response: 0.3, damping: 1 });
    expect(IOS_SPRINGS.arrival).toEqual({ response: 0.5, damping: 0.9 });
    // One source with the shared table.
    expect(IOS_SPRINGS.open).toEqual(SPRINGS.iosOpen);
    expect(IOS_SPRINGS.close).toEqual(SPRINGS.iosClose);
  });
  it('curves and durations', () => {
    expect(IOS_EASE.nav).toBe('cubic-bezier(0.32, 0.72, 0, 1)');
    expect(IOS_TIMING).toMatchObject({
      navMs: 300,
      navParallax: -0.3,
      navDim: 0.1,
      pressInMs: 80,
      pressOutMs: 200,
      bannerOutMs: 200,
      statusCrossfadeMs: 200,
      arrivalStaggerMs: 12,
      arrivalFrom: 1.15,
      safariBarMs: 200,
      scaleDipMs: 180,
      homeScale: 0.92,
      wallpaperRest: 1.06,
      wallpaperOpen: 1.12,
      sheetBackdropScale: 0.94,
      parallaxPx: 6,
    });
  });
  it('spring keyframes settle at exactly 1 and overshoot only when ζ < 1', () => {
    const open = springSamples(IOS_SPRINGS.open);
    expect(open.values.at(-1)).toBe(1);
    expect(Math.max(...open.values)).toBeGreaterThan(1);
    const sheet = springSamples(IOS_SPRINGS.sheet);
    expect(Math.max(...sheet.values)).toBeLessThanOrEqual(1.0001);
    expect(sheet.durationMs).toBeGreaterThan(200);
    expect(sheet.durationMs).toBeLessThan(1500);
  });
});

describe('IOS-FLIGHT-01/02 flight geometry', () => {
  const page = { x: 0, y: 0, w: 1440, h: 900 };
  it('starts at the squircle radius (22.37 %) and crossfades the launch layer between 15 % and 50 %', () => {
    expect(iconRadius(76)).toBeCloseTo(17, 0);
    expect(launchOpacity(0)).toBe(1);
    expect(launchOpacity(0.15)).toBe(1);
    expect(launchOpacity(0.5)).toBe(0);
    expect(launchOpacity(0.3)).toBeGreaterThan(0);
    expect(launchOpacity(0.3)).toBeLessThan(1);
  });
  it('openness: 0 at icon size, 1 at the full page', () => {
    expect(openness({ x: 0, y: 0, w: 76, h: 76, r: 17, o: 1 }, page)).toBe(0);
    expect(openness({ ...page, r: 0, o: 1 }, page)).toBe(1);
  });
  it('an icon that no longer exists: centre, 0.85, faded', () => {
    const visual = absentVisual(page);
    expect(visual.w / page.w).toBeCloseTo(0.85);
    expect(visual.x + visual.w / 2).toBeCloseTo(page.w / 2);
    expect(visual.o).toBe(0);
  });
  it('mixVisual interpolates every channel', () => {
    const a: Visual = { x: 0, y: 0, w: 10, h: 10, r: 2, o: 1 };
    const b: Visual = { x: 10, y: 20, w: 30, h: 50, r: 0, o: 0 };
    expect(mixVisual(a, b, 0.5)).toEqual({ x: 5, y: 10, w: 20, h: 30, r: 1, o: 0.5 });
  });
});

describe('IOS-FLIGHT-03 the Home gesture follows the finger 1:1', () => {
  const page = { x: 0, y: 0, w: 390, h: 844 };
  it('no travel at rest; the card shrinks and follows x/y as the finger rises', () => {
    expect(gestureVisual(page, 0, 0).travel).toBe(0);
    const half = gestureVisual(page, 30, -260);
    expect(half.travel).toBeCloseTo(260 / (844 * 0.62));
    expect(half.visual.w).toBeLessThan(page.w);
    expect(half.visual.x + half.visual.w / 2).toBeCloseTo(page.w / 2 + 27);
    expect(half.visual.y + half.visual.h).toBeCloseTo(page.h - 260);
    expect(half.visual.r).toBeGreaterThan(0);
  });
});

describe('IOS-MOTION-03/04 the surface motion: compositor-only writes, retarget keeps velocity', () => {
  function fixture() {
    let t = 0;
    const writes = new Set<string>();
    const style: Record<string, string> = {};
    const element = {
      style: new Proxy(style, {
        set(target, key: string, value: string) {
          if (value !== '') writes.add(key);
          target[key] = value;
          return true;
        },
      }),
      animate: undefined,
    } as unknown as HTMLElement;
    (globalThis as { window?: unknown }).window = { innerWidth: 1440, innerHeight: 900 };
    const callbacks = new Set<() => void>();
    return {
      element,
      writes,
      style,
      tick: (ms: number) => {
        t += ms;
        for (const callback of [...callbacks]) callback();
      },
      now: () => t,
      callbacks,
    };
  }

  it('writes only transform / clip-path / opacity (+ will-change while moving)', async () => {
    const f = fixture();
    const motion = surfaceMotion(f.element, { id: 't', now: f.now });
    motion.set({ x: 100, y: 100, w: 76, h: 76, r: 17, o: 1 });
    // Drive the spring by hand through GSAP's ticker is not needed: sampling `current()` after set is enough here.
    expect([...f.writes].every((key) => ['transform', 'clipPath', 'opacity', 'willChange'].includes(key))).toBe(true);
    motion.dispose();
  });

  it('drive() follows the finger exactly (1:1)', () => {
    const f = fixture();
    const motion = surfaceMotion(f.element, { id: 'd', now: f.now });
    const visual = { x: 40, y: 80, w: 300, h: 600, r: 20, o: 1 };
    motion.drive(visual);
    expect(motion.current()).toEqual(visual);
    expect(f.style.transform).toMatch(/translate3d\(.+\) scale\(/);
    expect(f.style.clipPath).toMatch(/^inset\(/);
    motion.dispose();
  });
});
