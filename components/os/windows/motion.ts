/**
 * Windows motion — values from plans/windows/03-motion.md (the WinUI duration ladder and its curves), techniques from
 * shared/07. Every animation is written imperatively to one element on GSAP's ticker; only `transform`, `opacity` and
 * `clip-path` change; each is a single timeline that a second request reverses or retargets (input always wins), and its
 * end state is the kernel's state, so `kill()` + set-final is always safe. Nothing bounces: no springs at all.
 * Reduced motion (`MOTION-RM-01`): flights become ≤ 150 ms crossfades, maximize is instant, drills lose their rise.
 */
import { gsap } from 'gsap';
import { cubicBezier } from '@/lib/motion/bezier';
import { exposeMotionDebug } from '@/lib/motion/debug';
import { prefersReducedMotion, REDUCED_CROSSFADE_MS } from '@/lib/motion/dur';

/** The duration ladder (ms). */
export const WIN_DURATIONS = [83, 167, 250, 333, 500] as const;

/** The curves, as cubic-bezier control points. */
export const WIN_CURVES = {
  entrance: [0, 0, 0, 1],
  exit: [1, 0, 1, 1],
  pointToPoint: [0.55, 0.55, 0, 1],
  windowManager: [0.1, 0.9, 0.2, 1],
  minimize: [0.8, 0, 0.78, 1],
} as const;

type Curve = keyof typeof WIN_CURVES;
const ease = (curve: Curve) => {
  const [x1, y1, x2, y2] = WIN_CURVES[curve];
  return cubicBezier(x1, y1, x2, y2);
};

/** The timing table (plans/windows/03). Components read these; no duration or curve is typed anywhere else. */
export const WIN_MOTION = {
  open: { ms: 250, curve: 'entrance', fromScale: 0.9 },
  close: { ms: 167, curve: 'exit', toScale: 0.95 },
  minimize: { ms: 250, curve: 'minimize' },
  restore: { ms: 250, curve: 'windowManager' },
  maximize: { ms: 250, curve: 'windowManager' },
  unmaximize: { ms: 200, curve: 'windowManager' },
  snapPreview: { ms: 167, curve: 'entrance', fromScale: 0.98 },
  snapCommit: { ms: 250, curve: 'windowManager' },
  launcherOpen: { ms: 250, curve: 'entrance', rise: 56 },
  launcherClose: { ms: 167, curve: 'exit' },
  flyoutIn: { ms: 167, curve: 'entrance', rise: 24 },
  flyoutOut: { ms: 83, curve: 'exit' },
  toastIn: { ms: 333, curve: 'entrance' },
  toastOut: { ms: 167, curve: 'exit' },
  pill: { ms: 167, curve: 'pointToPoint' },
  press: { downMs: 83, upMs: 167, scale: 0.85 },
  drillIn: { ms: 250, curve: 'entrance', rise: 16 },
  drillOut: { ms: 167, curve: 'exit' },
  hover: { ms: 83 },
  taskViewIn: { ms: 333, curve: 'entrance' },
  taskViewOut: { ms: 250, curve: 'exit' },
  lockSlide: { ms: 333, curve: 'windowManager' },
  signInFade: { ms: 167 },
  taskbarReveal: { ms: 250, curve: 'entrance' },
  iconsFade: { ms: 167 },
  expander: { ms: 167, curve: 'entrance' },
  /** Leaving Windows: windows fade 83 ms, the taskbar slides down 167 ms — ≤ 300 ms (plans/windows/07). */
  exit: { windowsMs: 83, taskbarMs: 167 },
} as const satisfies Record<string, object>;

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

/** Flight marks let the performance test find each flight in a trace (`MOTION-RULE-02`, `WIN-MOTION-03`). */
function mark(name: string) {
  try {
    performance.mark(name);
  } catch {
    // marks are diagnostics only
  }
}

type Kind = 'open' | 'close' | 'minimize' | 'restore' | 'reveal';

/**
 * One window's animations. At most one runs; a new request kills or reverses the current one from its present
 * values, so spam-clicking the taskbar can never queue or leave a half-scaled window.
 */
export class WinWindowMotion {
  private current: { kind: Kind; tl: gsap.core.Timeline } | null = null;
  private revealVisual: { layout: Box; box: Box } | null = null;

  constructor(private readonly el: HTMLElement) {}

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
    this.revealVisual = null;
    gsap.set(this.el, { clearProps: 'transform,opacity,clipPath,transformOrigin,visibility' });
    this.el.style.removeProperty('will-change');
  }

  /** Open: scale 0.9 → 1 + fade from the launcher's rect, 250 ms entrance curve (causality: it came from there). */
  open(origin: Box | null, onDone: () => void): void {
    const wasClosing = this.current?.kind === 'close';
    this.stop();
    const box = boxOf(this.el);
    const reduced = prefersReducedMotion();
    const ox = origin ? origin.x + origin.w / 2 - box.x : box.w / 2;
    const oy = origin ? origin.y + origin.h / 2 - box.y : box.h / 2;
    const tl = gsap.timeline({ data: { onDone } });
    gsap.set(this.el, { transformOrigin: `${ox}px ${oy}px`, willChange: 'transform, opacity' });
    const from = wasClosing ? {} : { scale: reduced ? 1 : WIN_MOTION.open.fromScale, opacity: 0 };
    tl.fromTo(this.el, from, {
      scale: 1,
      opacity: 1,
      duration: reduced ? reducedS : s(WIN_MOTION.open.ms),
      ease: reduced ? 'none' : ease('entrance'),
      clearProps: 'transform,opacity,transformOrigin,willChange',
    });
    this.start('open', tl);
  }

  /** Drag always wins over an in-flight open: jump to the end state. */
  finishOpen(): void {
    if (this.current?.kind === 'open') this.current.tl.progress(1);
  }

  /** Close (✕): scale → 0.95 + fade, 167 ms exit curve. */
  close(onDone: () => void): void {
    this.stop();
    const reduced = prefersReducedMotion();
    const tl = gsap.timeline({ data: { onDone } });
    gsap.set(this.el, { transformOrigin: '50% 50%', willChange: 'transform, opacity' });
    tl.to(this.el, {
      scale: reduced ? 1 : WIN_MOTION.close.toScale,
      opacity: 0,
      duration: reduced ? reducedS : s(WIN_MOTION.close.ms),
      ease: reduced ? 'none' : ease('exit'),
    });
    this.start('close', tl);
  }

  /** Minimize: scale + fade toward the taskbar button, 250 ms. Restoring mid-flight reverses this same timeline. */
  minimize(button: Box | null, onDone: () => void): void {
    if (this.current?.kind === 'restore') {
      this.reverseTo('minimize', onDone);
      return;
    }
    this.stop();
    const box = boxOf(this.el);
    const reduced = prefersReducedMotion();
    const tl = gsap.timeline({ data: { onDone } });
    gsap.set(this.el, { transformOrigin: '50% 100%', willChange: 'transform, opacity' });
    if (reduced || !button) tl.to(this.el, { opacity: 0, duration: reducedS, ease: 'none' });
    else {
      const scale = Math.max(0.12, Math.min(0.3, (button.w * 4) / box.w));
      tl.to(this.el, {
        x: button.x + button.w / 2 - (box.x + box.w / 2),
        y: button.y - (box.y + box.h),
        scale,
        opacity: 0,
        duration: s(WIN_MOTION.minimize.ms),
        ease: ease('minimize'),
      });
    }
    this.start('minimize', tl);
  }

  /** Restore from the taskbar (250 ms window-manager curve); mid-minimize, the running timeline reverses instead. */
  restore(button: Box | null, onDone: () => void): void {
    if (this.current?.kind === 'minimize') {
      this.reverseTo('restore', onDone);
      return;
    }
    this.stop();
    const box = boxOf(this.el);
    const reduced = prefersReducedMotion();
    const tl = gsap.timeline({ data: { onDone } });
    gsap.set(this.el, { transformOrigin: '50% 100%', willChange: 'transform, opacity' });
    if (reduced || !button)
      tl.fromTo(
        this.el,
        { opacity: 0 },
        { opacity: 1, duration: reducedS, ease: 'none', clearProps: 'opacity,transformOrigin,willChange' },
      );
    else {
      const scale = Math.max(0.12, Math.min(0.3, (button.w * 4) / box.w));
      tl.fromTo(
        this.el,
        { x: button.x + button.w / 2 - (box.x + box.w / 2), y: button.y - (box.y + box.h), scale, opacity: 0 },
        {
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          duration: s(WIN_MOTION.restore.ms),
          ease: ease('windowManager'),
          clearProps: 'transform,opacity,transformOrigin,willChange',
        },
      );
    }
    this.start('restore', tl);
  }

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
   * Maximize / restore / Snap commit (shared/07 "Maximize/restore"): the target layout is applied once, then revealed
   * by `translate` + `clip-path: inset()` — never a non-uniform scale, so text is never distorted. `layout` is the box
   * the element is laid out at during the animation; the visible box travels `from` → `to`, the corner radius
   * `radius[0]` → `radius[1]` (8 → 0 maximizing). A second request mid-flight starts from the box on screen now.
   */
  reveal(
    layout: Box,
    from: Box,
    to: Box,
    radius: readonly [number, number],
    kind: 'maximize' | 'unmaximize' | 'snapCommit',
    onDone: () => void,
  ): void {
    const start = this.current?.kind === 'reveal' && this.revealVisual ? this.revealVisual.box : from;
    this.stop();
    if (prefersReducedMotion()) {
      this.revealVisual = null;
      gsap.set(this.el, { clearProps: 'transform,clipPath' });
      onDone();
      return;
    }
    const state = { p: 0 };
    const apply = () => {
      const box = lerpBox(start, to, state.p);
      this.revealVisual = { layout, box };
      const right = Math.max(0, layout.w - box.w - (box.x - layout.x));
      const bottom = Math.max(0, layout.h - box.h - (box.y - layout.y));
      const left = Math.max(0, box.x - layout.x);
      const top = Math.max(0, box.y - layout.y);
      const r = radius[0] + (radius[1] - radius[0]) * state.p;
      this.el.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px round ${r}px)`;
    };
    apply();
    this.el.style.willChange = 'clip-path';
    const spec = WIN_MOTION[kind];
    const tl = gsap.timeline({ data: { onDone } });
    tl.to(state, {
      p: 1,
      duration: s(spec.ms),
      ease: ease(spec.curve),
      onUpdate: apply,
      onComplete: () => {
        this.revealVisual = null;
        gsap.set(this.el, { clearProps: 'transform,clipPath,willChange' });
      },
    });
    this.start('reveal', tl);
  }

  kill(): void {
    this.stop();
  }
}

/**
 * The exit beat (plans/windows/07 "Switch OS"): windows fade 83 ms, the taskbar slides down 167 ms (≤ 300 ms).
 * Returns a handle whose `reverse()` plays it back (the visitor went Forward again mid-beat).
 */
export function exitBeat(
  parts: { windows: readonly Element[]; taskbar: Element | null; overlays: readonly Element[] },
  onDone: () => void,
): { reverse(onBack: () => void): void; kill(): void } {
  const reduced = prefersReducedMotion();
  const tl = gsap.timeline({ onComplete: onDone });
  if (reduced) tl.set({}, {}, 0);
  else {
    const { exit } = WIN_MOTION;
    const fading = [...parts.windows, ...parts.overlays];
    if (fading.length) tl.to(fading, { opacity: 0, duration: s(exit.windowsMs), ease: ease('exit') }, 0);
    if (parts.taskbar) tl.to(parts.taskbar, { yPercent: 100, duration: s(exit.taskbarMs), ease: ease('exit') }, 0);
  }
  return {
    reverse(onBack) {
      tl.eventCallback('onComplete', null);
      tl.eventCallback('onReverseComplete', () => {
        gsap.set([...parts.windows, ...parts.overlays, parts.taskbar].filter(Boolean), {
          clearProps: 'opacity,transform',
        });
        onBack();
      });
      tl.reverse();
    },
    kill() {
      tl.kill();
    },
  };
}

/**
 * Fluent drill-in / drill-out for page changes (Settings, GitHub, Explorer folders): content rises 16 px (8 px for
 * Explorer folders) and fades in, 250 ms entrance; a new call mid-flight starts from where the content is.
 */
export function drillIn(el: HTMLElement, rise: number = WIN_MOTION.drillIn.rise): () => void {
  if (prefersReducedMotion()) return () => undefined;
  gsap.killTweensOf(el);
  const tween = gsap.fromTo(
    el,
    { y: rise, opacity: 0 },
    {
      y: 0,
      opacity: 1,
      duration: s(WIN_MOTION.drillIn.ms),
      ease: ease('entrance'),
      clearProps: 'transform,opacity',
    },
  );
  return () => {
    tween.progress(1);
    tween.kill();
  };
}

/** Drill-out (Back): the previous page returns in 167 ms — a fade with no rise. Returns a finisher, like `drillIn`. */
export function drillOut(el: HTMLElement): () => void {
  if (prefersReducedMotion()) return () => undefined;
  gsap.killTweensOf(el);
  const tween = gsap.fromTo(
    el,
    { opacity: 0 },
    { opacity: 1, duration: s(WIN_MOTION.drillOut.ms), ease: ease(WIN_MOTION.drillOut.curve), clearProps: 'opacity' },
  );
  return () => {
    tween.progress(1);
    tween.kill();
  };
}

/** Taskbar icon press: scale 0.85 (83 ms) → 1 (167 ms); nothing under reduced motion. */
export function pressPulse(el: Element): void {
  if (prefersReducedMotion()) return;
  gsap.killTweensOf(el);
  gsap
    .timeline()
    .to(el, { scale: WIN_MOTION.press.scale, duration: s(WIN_MOTION.press.downMs), ease: ease('pointToPoint') })
    .to(el, { scale: 1, duration: s(WIN_MOTION.press.upMs), ease: ease('pointToPoint'), clearProps: 'transform' });
}
