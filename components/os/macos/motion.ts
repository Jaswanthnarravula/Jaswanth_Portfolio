/**
 * macOS motion — values from plans/macos/03-motion.md (timing table), techniques from shared/07. Every animation is
 * written imperatively to one element on GSAP's ticker; only `transform`, `opacity` and `clip-path` change; each is a
 * single timeline that a second request reverses or retargets (input always wins), and its end state is the kernel's
 * state, so `kill()` + set-final is always safe. Reduced motion: flights become ≤ 150 ms crossfades, zoom is instant.
 */
import { gsap } from 'gsap';
import { cubicBezier } from '@/lib/motion/bezier';
import { exposeMotionDebug } from '@/lib/motion/debug';
import { prefersReducedMotion, REDUCED_CROSSFADE_MS } from '@/lib/motion/dur';

/** The timing table (macos/03). Components read these; no duration or curve is typed anywhere else. */
export const MAC_MOTION = {
  open: { ms: 200, ease: cubicBezier(0.2, 0.9, 0.3, 1), fromScale: 0.92 },
  close: { ms: 140, ease: cubicBezier(0.4, 0, 1, 1), toScale: 0.96 },
  /** The Scale effect: x-scale `power3.in`, y-scale + translate `power2.in`. */
  minimize: { ms: 380 },
  restore: { ms: 340 },
  /** Shift-click plays minimize/restore at ×6 (authentic). */
  slowFactor: 6,
  zoom: { ms: 420, ease: cubicBezier(0.3, 0, 0.1, 1) },
  /** Leaving macOS: windows fade, the Dock drops, the menu bar fades — ≤ 300 ms in all. */
  exit: { windowsMs: 120, dockMs: 180, menuBarMs: 150, menuBarDelayMs: 90 },
  columnPush: { ms: 200, ease: cubicBezier(0.2, 0.9, 0.3, 1) },
  document: { ms: 160 },
} as const;

const s = (ms: number) => ms / 1000;
const reducedS = s(REDUCED_CROSSFADE_MS);

exposeMotionDebug(() => gsap.globalTimeline.getChildren(true, true, false).filter((tween) => tween.isActive()).length);

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export const boxOf = (element: Element): Box => {
  const r = element.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

const lerpBox = (a: Box, b: Box, p: number): Box => ({
  x: a.x + (b.x - a.x) * p,
  y: a.y + (b.y - a.y) * p,
  w: a.w + (b.w - a.w) * p,
  h: a.h + (b.h - a.h) * p,
});

/** Flight marks let the performance test find each flight in a trace (`MOTION-RULE-02`). */
function mark(name: string) {
  try {
    performance.mark(name);
  } catch {
    // marks are diagnostics only
  }
}

type Kind = 'open' | 'close' | 'minimize' | 'restore' | 'zoom';

/**
 * One window's animations. At most one runs; a new request kills or reverses the current one from its present
 * values, so spam-clicking can never queue or leave a half-scaled window.
 */
export class WindowMotion {
  private current: { kind: Kind; tl: gsap.core.Timeline } | null = null;
  private zoomVisual: { layout: Box; box: Box } | null = null;
  private slowNext = false;

  constructor(private readonly el: HTMLElement) {}

  /** The next minimize/restore plays at ×6 (Shift held on the button). */
  slowDown(): void {
    this.slowNext = true;
  }

  get busy(): Kind | null {
    return this.current?.kind ?? null;
  }

  private start(kind: Kind, tl: gsap.core.Timeline) {
    this.current = { kind, tl };
    mark(`pf-flight-start:${kind}`);
    tl.eventCallback('onComplete', () => this.finish(kind, tl, tl.data?.onDone));
  }

  private finish(kind: Kind, tl: gsap.core.Timeline, done?: () => void) {
    if (this.current?.tl !== tl) return;
    this.current = null;
    mark(`pf-flight-end:${kind}`);
    done?.();
  }

  private stop() {
    this.current?.tl.kill();
    this.current = null;
  }

  /** Clear every animated property: the element shows exactly what the kernel state says. */
  settle(): void {
    this.stop();
    this.zoomVisual = null;
    gsap.set(this.el, { clearProps: 'transform,opacity,clipPath,transformOrigin,visibility' });
    this.el.style.removeProperty('will-change');
  }

  /** Window open: scale 0.92 → 1 + fade, origin = the launcher's rect (causality: it came from that icon). */
  open(origin: Box | null, onDone: () => void): void {
    const wasClosing = this.current?.kind === 'close';
    this.stop();
    const box = boxOf(this.el);
    const reduced = prefersReducedMotion();
    const ox = origin ? origin.x + origin.w / 2 - box.x : box.w / 2;
    const oy = origin ? origin.y + origin.h / 2 - box.y : box.h / 2;
    const tl = gsap.timeline({ data: { onDone } });
    gsap.set(this.el, { transformOrigin: `${ox}px ${oy}px`, willChange: 'transform, opacity' });
    const from = wasClosing
      ? {} // re-opened mid-close: continue from the present scale and opacity
      : { scale: reduced ? 1 : MAC_MOTION.open.fromScale, opacity: 0 };
    tl.fromTo(this.el, from, {
      scale: 1,
      opacity: 1,
      duration: reduced ? reducedS : s(MAC_MOTION.open.ms),
      ease: reduced ? 'none' : MAC_MOTION.open.ease,
      clearProps: 'transform,opacity,transformOrigin,willChange',
    });
    this.start('open', tl);
  }

  /** Drag always wins over an in-flight open: jump to the end state. */
  finishOpen(): void {
    if (this.current?.kind === 'open') this.current.tl.progress(1);
  }

  /** Close (red): scale → 0.96 + fade, 140 ms. */
  close(onDone: () => void): void {
    this.stop();
    const reduced = prefersReducedMotion();
    const tl = gsap.timeline({ data: { onDone } });
    gsap.set(this.el, { transformOrigin: '50% 50%', willChange: 'transform, opacity' });
    tl.to(this.el, {
      scale: reduced ? 1 : MAC_MOTION.close.toScale,
      opacity: 0,
      duration: reduced ? reducedS : s(MAC_MOTION.close.ms),
      ease: reduced ? 'none' : MAC_MOTION.close.ease,
    });
    this.start('close', tl);
  }

  /**
   * Minimize — the authentic Scale effect into the window's Dock tile (380 ms). Clicking the tile mid-flight reverses
   * this same timeline. Without a tile (it vanished) the window fades in place.
   */
  minimize(tile: Box | null, onDone: () => void): void {
    if (this.current?.kind === 'restore') {
      this.reverseTo('minimize', onDone);
      return;
    }
    this.stop();
    const box = boxOf(this.el);
    const reduced = prefersReducedMotion();
    const factor = this.slowNext ? MAC_MOTION.slowFactor : 1;
    this.slowNext = false;
    const tl = gsap.timeline({ data: { onDone } });
    gsap.set(this.el, { transformOrigin: '0 0', willChange: 'transform, opacity' });
    if (reduced || !tile) {
      tl.to(this.el, { opacity: 0, duration: reducedS, ease: 'none' });
    } else {
      const duration = s(MAC_MOTION.minimize.ms) * factor;
      tl.to(this.el, { scaleX: tile.w / box.w, duration, ease: 'power3.in' }, 0)
        .to(this.el, { scaleY: tile.h / box.h, x: tile.x - box.x, y: tile.y - box.y, duration, ease: 'power2.in' }, 0)
        .to(this.el, { opacity: 0, duration: duration * 0.25, ease: 'power1.in' }, duration * 0.75);
    }
    this.start('minimize', tl);
  }

  /** Restore from the Dock tile (340 ms `power3.out`); mid-minimize, the running timeline reverses instead. */
  restore(tile: Box | null, onDone: () => void): void {
    if (this.current?.kind === 'minimize') {
      this.reverseTo('restore', onDone);
      return;
    }
    this.stop();
    const box = boxOf(this.el);
    const reduced = prefersReducedMotion();
    const factor = this.slowNext ? MAC_MOTION.slowFactor : 1;
    this.slowNext = false;
    const tl = gsap.timeline({ data: { onDone } });
    gsap.set(this.el, { transformOrigin: '0 0', willChange: 'transform, opacity' });
    if (reduced || !tile) {
      tl.fromTo(
        this.el,
        { opacity: 0 },
        { opacity: 1, duration: reducedS, ease: 'none', clearProps: 'opacity,transformOrigin,willChange' },
      );
    } else {
      tl.fromTo(
        this.el,
        { scaleX: tile.w / box.w, scaleY: tile.h / box.h, x: tile.x - box.x, y: tile.y - box.y, opacity: 0 },
        {
          scaleX: 1,
          scaleY: 1,
          x: 0,
          y: 0,
          opacity: 1,
          duration: s(MAC_MOTION.restore.ms) * factor,
          ease: 'power3.out',
          clearProps: 'transform,opacity,transformOrigin,willChange',
        },
      );
    }
    this.start('restore', tl);
  }

  /** Reverse the running minimize/restore timeline from where it is; it now completes as `kind`. */
  private reverseTo(kind: 'minimize' | 'restore', onDone: () => void) {
    const current = this.current!;
    const tl = current.tl;
    tl.data = { onDone };
    this.current = { kind, tl };
    tl.eventCallback('onComplete', null);
    tl.eventCallback('onReverseComplete', () => {
      if (this.current?.tl !== tl) return;
      this.current = null;
      tl.kill();
      if (kind === 'restore') gsap.set(this.el, { clearProps: 'transform,opacity,transformOrigin,willChange' });
      onDone();
    });
    tl.reverse();
  }

  /**
   * Zoom / un-zoom (shared/07 "Maximize/restore"): the larger layout is applied once, then revealed by `translate` +
   * `clip-path: inset()` — never a non-uniform scale, so text is never distorted. `layout` is the box the element is
   * laid out at during the animation (the zoomed workspace); the visible box travels `from` → `to`. A second request
   * mid-flight starts from the box on screen now.
   */
  zoom(layout: Box, from: Box, to: Box, radius: number, onDone: () => void): void {
    const start = this.current?.kind === 'zoom' && this.zoomVisual ? this.zoomVisual.box : from;
    this.stop();
    if (prefersReducedMotion()) {
      this.zoomVisual = null;
      gsap.set(this.el, { clearProps: 'transform,clipPath' });
      onDone();
      return;
    }
    const state = { p: 0 };
    const apply = () => {
      const box = lerpBox(start, to, state.p);
      this.zoomVisual = { layout, box };
      const right = Math.max(0, layout.w - box.w);
      const bottom = Math.max(0, layout.h - box.h);
      this.el.style.transform = `translate3d(${box.x - layout.x}px, ${box.y - layout.y}px, 0)`;
      this.el.style.clipPath = `inset(0px ${right}px ${bottom}px 0px round ${radius}px)`;
    };
    apply();
    this.el.style.willChange = 'transform, clip-path';
    const tl = gsap.timeline({ data: { onDone } });
    tl.to(state, {
      p: 1,
      duration: s(MAC_MOTION.zoom.ms),
      ease: MAC_MOTION.zoom.ease,
      onUpdate: apply,
      onComplete: () => {
        this.zoomVisual = null;
        gsap.set(this.el, { clearProps: 'transform,clipPath,willChange' });
      },
    });
    this.start('zoom', tl);
  }

  kill(): void {
    this.stop();
  }
}

/**
 * The exit beat (macos/07 "Switch OS"): windows fade 120 ms, the Dock drops, the menu bar fades — ≤ 300 ms. Returns
 * a handle whose `reverse()` plays it back (the visitor went Forward again mid-beat).
 */
export function exitBeat(
  parts: { windows: readonly Element[]; dock: Element | null; menuBar: Element | null },
  onDone: () => void,
): { reverse(onBack: () => void): void; kill(): void } {
  const reduced = prefersReducedMotion();
  const tl = gsap.timeline({ onComplete: onDone });
  if (reduced) tl.set({}, {}, 0);
  else {
    const { exit } = MAC_MOTION;
    if (parts.windows.length) tl.to(parts.windows, { opacity: 0, duration: s(exit.windowsMs), ease: 'power1.in' }, 0);
    if (parts.dock) tl.to(parts.dock, { yPercent: 130, opacity: 0, duration: s(exit.dockMs), ease: 'power2.in' }, 0);
    if (parts.menuBar)
      tl.to(parts.menuBar, { opacity: 0, duration: s(exit.menuBarMs), ease: 'power1.in' }, s(exit.menuBarDelayMs));
  }
  return {
    reverse(onBack) {
      tl.eventCallback('onComplete', null);
      tl.eventCallback('onReverseComplete', () => {
        gsap.set([...parts.windows, parts.dock, parts.menuBar].filter(Boolean), { clearProps: 'opacity,transform' });
        onBack();
      });
      tl.reverse();
    },
    kill() {
      tl.kill();
    },
  };
}
