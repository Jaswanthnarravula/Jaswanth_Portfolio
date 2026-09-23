/**
 * iOS motion — the numbers of plans/ios/03-motion.md as tokens (`IOS-MOTION-01`) and the techniques of shared/07:
 *   · `surfaceMotion` — the icon ↔ app flight. The app surface is laid out at the full page; what is visible is one
 *     rect (x, y, w, h, corner radius, opacity) drawn with a uniform `translate + scale` and a `clip-path` inset — never a
 *     non-uniform scale. Progress is a closed-form spring on GSAP's ticker (the one clock): `toward()` retargets from the
 *     current rect with the current velocity (tap a second icon mid-open → the first flies back into its icon, no jump —
 *     `IOS-MOTION-03`), `drive()` follows a finger 1:1, `release()` hands the finger's velocity to the spring
 *     (`IOS-MOTION-02`). Only `transform`, `clip-path` and `opacity` are written (`IOS-MOTION-04`).
 *   · the Home Screen and wallpaper follow the most-open surface (Home scales to 0.92 and dims; wallpaper 1.06 → 1.12);
 *   · springs sampled into WAAPI keyframes for small one-shot animations (arrival fly-in, scale dip, bubbles), so they
 *     run on the compositor without a ticker;
 *   · the Switch OS exit beat.
 * Reduced motion (`MOTION-RM-01`, `IOS-MOTION-05`): flights are 150 ms crossfades at the final geometry; gestures still
 * track the finger (direct manipulation) but settle with a fade; no parallax, fly-in or scale dip.
 */
import { gsap } from 'gsap';
import { exposeMotionDebug, probeEnabled, tickerAdded, tickerRemoved } from '@/lib/motion/debug';
import { prefersReducedMotion, REDUCED_CROSSFADE_MS } from '@/lib/motion/dur';
import { flightFrame } from '@/lib/motion/flight';
import { solveSpring, spring, type Spring, type SpringConfig } from '@/lib/motion/spring';

// --- Tokens (plans/ios/03 "Spring table" + "Curve-based timings") -------------------------------------------------------

export const IOS_SPRINGS = {
  open: { response: 0.26, damping: 0.92 },
  close: { response: 0.28, damping: 0.9 },
  homeSettle: { response: 0.28, damping: 0.9 },
  folderOpen: { response: 0.26, damping: 0.92 },
  folderClose: { response: 0.28, damping: 0.9 },
  sheet: { response: 0.32, damping: 1 },
  reveal: { response: 0.38, damping: 0.9 },
  banner: { response: 0.38, damping: 0.78 },
  quickMenu: { response: 0.35, damping: 0.75 },
  press: { response: 0.18, damping: 1 },
  switchThumb: { response: 0.25, damping: 0.9 },
  segment: { response: 0.3, damping: 1 },
  arrival: { response: 0.5, damping: 0.9 },
  unlock: { response: 0.45, damping: 0.9 },
  bubble: { response: 0.35, damping: 0.8 },
  controlModules: { response: 0.32, damping: 0.85 },
} as const satisfies Record<string, SpringConfig>;

export const IOS_EASE = {
  nav: 'cubic-bezier(0.32, 0.72, 0, 1)',
  bannerOut: 'cubic-bezier(0.4, 0, 1, 1)',
  out: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
} as const;

export const IOS_TIMING = {
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
  exitCloseMs: 200,
  exitIconsMs: 300,
  homeScale: 0.92,
  homeDim: 0.28,
  wallpaperRest: 1.06,
  wallpaperOpen: 1.12,
  sheetBackdropScale: 0.94,
  parallaxPx: 6,
} as const;

// Active nested tweens — or 1 while any top-level tween / timeline is unpaused and unfinished (a tween reads inactive
// until its first tick; under load that gap would let a probe call a half-faded page settled).
exposeMotionDebug(() => {
  const root = gsap.globalTimeline;
  const active = root.getChildren(true, true, false).filter((tween) => tween.isActive()).length;
  const pending = root.getChildren(false, true, true).some((child) => !child.paused() && child.progress() < 1);
  return active || (pending ? 1 : 0);
});

function mark(name: string) {
  try {
    performance.mark(name);
  } catch {
    // marks are diagnostics only
  }
}

// --- Geometry ------------------------------------------------------------------------------------------------------------

export interface Visual {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Corner radius on screen (px). */
  readonly r: number;
  readonly o: number;
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export const pageBox = (): Box => ({ x: 0, y: 0, w: window.innerWidth, h: window.innerHeight });
export const fullVisual = (page: Box = pageBox()): Visual => ({ ...page, r: 0, o: 1 });

/** The squircle's corner at a box's width (22.37 %), the start radius of an icon flight. */
export const iconRadius = (width: number) => width * 0.2237;

export function visualOf(element: Element, radius?: number): Visual {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top, w: rect.width, h: rect.height, r: radius ?? iconRadius(rect.width), o: 1 };
}

/** An icon that no longer exists: the app shrinks to 0.85 at the centre and fades (plans/ios/02 "Close" step 3). */
export const absentVisual = (page: Box = pageBox()): Visual => ({
  x: page.w * 0.075,
  y: page.h * 0.075,
  w: page.w * 0.85,
  h: page.h * 0.85,
  r: 38,
  o: 0,
});

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const mixVisual = (a: Visual, b: Visual, t: number): Visual => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  w: Math.max(1, lerp(a.w, b.w, t)),
  h: Math.max(1, lerp(a.h, b.h, t)),
  r: Math.max(0, lerp(a.r, b.r, t)),
  o: Math.min(1, Math.max(0, lerp(a.o, b.o, t))),
});

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** How "open" a visible rect is: 0 at icon size, 1 at the full page — drives Home's scale/dim and the icon crossfade. */
export const openness = (visual: Visual, page: Box): number =>
  Math.min(1, Math.max(0, (visual.w / page.w - 0.08) / 0.92));

/** The launch layer (icon over the launch colour) fades out between 15 % and 50 % of the way (plans/ios/02 step 2). */
export const launchOpacity = (open: number): number => 1 - smoothstep(0.15, 0.5, open);

// --- Home Screen follower ------------------------------------------------------------------------------------------------

interface HomeTargets {
  /** The Home Screen and the Dock (separate landmarks) scale and dim together. */
  home: readonly (HTMLElement | null)[];
  dim: HTMLElement | null;
  wallpaper: HTMLElement | null;
}
const homeTargets: HomeTargets = { home: [], dim: null, wallpaper: null };
const opennessBySurface = new Map<string, number>();
let parallax = { x: 0, y: 0 };

/** The shell registers what follows the flights (the Home layer, its dim veil, the wallpaper). */
export function registerHome(targets: HomeTargets): () => void {
  Object.assign(homeTargets, targets);
  writeHome();
  return () => {
    homeTargets.home = [];
    homeTargets.dim = null;
    homeTargets.wallpaper = null;
    opennessBySurface.clear();
  };
}

function writeHome() {
  let open = 0;
  for (const value of opennessBySurface.values()) open = Math.max(open, value);
  const { home, dim, wallpaper } = homeTargets;
  for (const el of home) if (el) el.style.transform = open > 0 ? `scale(${lerp(1, IOS_TIMING.homeScale, open)})` : '';
  if (dim) dim.style.opacity = open > 0 ? String(IOS_TIMING.homeDim * open) : '0';
  if (wallpaper) {
    const scale = lerp(IOS_TIMING.wallpaperRest, IOS_TIMING.wallpaperOpen, open);
    wallpaper.style.transform = `translate3d(${parallax.x}px, ${parallax.y}px, 0) scale(${scale})`;
  }
}

function setOpenness(id: string, value: number) {
  if (value <= 0.0005) opennessBySurface.delete(id);
  else opennessBySurface.set(id, value);
  writeHome();
}

/** Current Home openness (tests and the arbiter read it: a flight is under way while it is strictly between 0 and 1). */
export const homeOpenness = (): number => Math.max(0, ...opennessBySurface.values());

/** Forget a surface's openness (it unmounted or was hidden at rest). */
export const clearOpenness = (id: string): void => setOpenness(id, 0);

/**
 * Wallpaper depth (plans/ios/01 "Wallpaper and depth"): on a fine pointer, tier ≥ 1, full motion, the wallpaper moves
 * ±6 px against the pointer — written on pointermove through one ticker frame, no loop at rest.
 */
export function wallpaperParallax(root: HTMLElement): () => void {
  let pending: { x: number; y: number } | null = null;
  const tick = () => {
    gsap.ticker.remove(tick);
    tickerRemoved();
    if (!pending) return;
    parallax = pending;
    pending = null;
    writeHome();
  };
  const onMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || prefersReducedMotion()) return;
    const tier = Number(document.documentElement.dataset.tier ?? '1');
    if (tier < 1) return;
    const nx = event.clientX / window.innerWidth - 0.5;
    const ny = event.clientY / window.innerHeight - 0.5;
    const next = { x: -nx * 2 * IOS_TIMING.parallaxPx, y: -ny * 2 * IOS_TIMING.parallaxPx };
    // The state first: `ticker.add` wakes a sleeping ticker and can tick synchronously, and a tick with nothing
    // pending removes itself — the parallax would never run again.
    const idle = !pending;
    pending = next;
    if (idle) {
      tickerAdded();
      gsap.ticker.add(tick);
    }
  };
  root.addEventListener('pointermove', onMove, { passive: true });
  return () => {
    root.removeEventListener('pointermove', onMove);
    if (pending) {
      gsap.ticker.remove(tick);
      tickerRemoved();
    }
    pending = null;
    parallax = { x: 0, y: 0 };
  };
}

// --- The surface flight --------------------------------------------------------------------------------------------------

export type MotionEnd = 'rest' | 'interrupted';

export interface SurfaceMotion {
  /** Jump to a visual state at rest (a warm app shown at once, `kill()` + set-final). */
  set(visual: Visual): void;
  /** Spring toward a visual state from where the surface is now, keeping its velocity (progress units per second). */
  toward(target: Visual, config: SpringConfig, options?: { velocity?: number }): Promise<MotionEnd>;
  /** Follow a finger: the visual state is set directly, velocity is remembered for `toward()`. */
  drive(visual: Visual): void;
  /** Where the surface is drawn now. */
  current(): Visual;
  /** True while a spring is running. */
  moving(): boolean;
  dispose(): void;
}

export interface SurfaceMotionOptions {
  /** Key for the Home follower. */
  readonly id: string;
  /** The launch layer (icon + launch colour) crossfaded by openness. */
  readonly launch?: () => HTMLElement | null;
  /** Called with the openness after every drawn frame (the app body mounts past 0.9). */
  readonly onOpenness?: (open: number) => void;
  readonly now?: () => number;
}

/**
 * Motion for one app surface (the element is fixed at the full page). `toward()` rebases the spring on the current
 * rect: a reversal (back to where the last flight started) reuses the same spring so velocity is exact; any other
 * retarget starts from the current rect with the current progress velocity (`IOS-MOTION-03`).
 */
/** Openness at which the app body starts painting (the launch layer has faded by 0.5). */
const REVEAL_AT = 0.72;

export function surfaceMotion(element: HTMLElement, options: SurfaceMotionOptions): SurfaceMotion {
  const now = options.now ?? (() => performance.now());
  let from: Visual = fullVisual();
  let to: Visual = from;
  let progress: Spring | null = null;
  let config: SpringConfig = IOS_SPRINGS.open;
  let shown: Visual = from;
  let resolve: ((end: MotionEnd) => void) | null = null;
  let ticking = false;
  let fade: Animation | null = null;
  /** The width the current flight rests at (an icon, a widget, a banner): 0 openness is there, not at icon size. */
  let restWidth = 0;

  /** The app body, found once: it stays unpainted while the surface is small (see `REVEAL_AT`). */
  let body: HTMLElement | null = null;
  let revealed: boolean | null = null;
  const reveal = (show: boolean) => {
    if (revealed === show) return;
    revealed = show;
    body ??= element.querySelector?.<HTMLElement>('[data-app-content]') ?? null;
    if (body) body.style.visibility = show ? '' : 'hidden';
  };

  const draw = (visual: Visual) => {
    shown = visual;
    const page = pageBox();
    const full =
      Math.abs(visual.w - page.w) < 0.5 && Math.abs(visual.h - page.h) < 0.5 && visual.x === 0 && visual.y === 0;
    if (full && visual.r < 0.5) {
      element.style.transform = '';
      element.style.clipPath = '';
    } else {
      const frame = flightFrame(
        { x: visual.x, y: visual.y, width: visual.w, height: visual.h },
        { x: 0, y: 0, width: page.w, height: page.h },
        0,
        [visual.r, visual.r],
      );
      element.style.transform = frame.transform;
      element.style.clipPath = frame.clipPath;
    }
    element.style.opacity = visual.o >= 0.999 ? '' : String(visual.o);
    const openNow =
      restWidth > 0 && restWidth < page.w
        ? Math.min(1, Math.max(0, (visual.w - restWidth) / (page.w - restWidth)))
        : openness(visual, page);
    const open = openNow;
    // Painting a full page of live app content through a clip that moves every frame costs ~33 ms a frame; behind the
    // launch layer there is nothing to see anyway, so during a spring flight the body paints only near the landing.
    // A parked card (the App Switcher) and a finger-driven surface are not flights: they keep the real app on screen.
    reveal(progress === null || open >= REVEAL_AT);
    const launch = options.launch?.();
    if (launch) launch.style.opacity = String(launchOpacity(open));
    setOpenness(options.id, visual.o < 0.01 ? 0 : open);
    options.onOpenness?.(open);
    // Acceptance probes only (pf.debug.probe): where the surface is drawn, so e2e can check where a flight lands.
    if (probeEnabled()) element.dataset.visual = [visual.x, visual.y, visual.w, visual.h].map(Math.round).join(',');
  };

  const stopTicker = () => {
    if (!ticking) return;
    ticking = false;
    gsap.ticker.remove(tick);
    tickerRemoved();
    element.style.willChange = '';
  };
  // A superseded crossfade is not an interruption of the new motion: WAAPI queues `cancel` events, so a handler left
  // attached would settle the promise that replaced it.
  const stopFade = () => {
    if (!fade) return;
    fade.onfinish = null;
    fade.oncancel = null;
    fade.cancel();
    fade = null;
  };
  // Flight marks let the performance test find each flight in a trace (`IOS-MOTION-04`, as MOTION-RULE-02).
  let flight: 'open' | 'close' | null = null;
  const settle = (end: MotionEnd) => {
    if (flight) mark(`pf-flight-end:${flight}`);
    flight = null;
    const done = resolve;
    resolve = null;
    done?.(end);
  };

  function tick() {
    if (!progress) return;
    const t = now();
    const { value } = progress.sample(t);
    // Sub-pixel is at rest: chasing the last thousandth only adds an invisible tail.
    if (progress.atRest(t, 0.004)) {
      progress = null;
      stopTicker();
      draw(to);
      settle('rest');
      return;
    }
    draw(mixVisual(from, to, value));
  }

  const startTicker = () => {
    if (ticking) return;
    ticking = true;
    element.style.willChange = 'transform, clip-path, opacity';
    tickerAdded();
    gsap.ticker.add(tick);
  };

  const velocityNow = (): number => (progress ? progress.sample(now()).velocity : 0);
  let fingerVelocity = 0;
  let lastDrive: { t: number; visual: Visual } | null = null;

  return {
    set(visual) {
      stopFade();
      progress = null;
      stopTicker();
      from = visual;
      to = visual;
      draw(visual);
      settle('interrupted');
    },
    toward(target, springConfig, opts = {}) {
      stopFade();
      settle('interrupted');
      const pageWidth = pageBox().w;
      // A surface that rests as a widget or a banner is far wider than an icon: openness must reach 0 there too.
      restWidth = target.w >= pageWidth - 1 ? (shown.w < pageWidth - 1 ? shown.w : 0) : target.w;
      flight = target.w >= pageWidth - 1 ? 'open' : 'close';
      mark(`pf-flight-start:${flight}`);
      const t = now();
      const reduced = prefersReducedMotion();
      if (reduced) {
        // A crossfade instead of travel: opening fades the app in at the full page; closing fades it out where it is.
        progress = null;
        stopTicker();
        lastDrive = null;
        const opening = target.w >= pageBox().w - 1;
        const startOpacity = opening ? (shown.w >= pageBox().w - 1 ? Math.min(shown.o, target.o) : 0) : shown.o;
        const end: Visual = opening ? target : { ...target, o: 0 };
        draw({ ...(opening ? target : shown), o: startOpacity });
        from = end;
        to = end;
        return new Promise<MotionEnd>((done) => {
          resolve = done;
          if (typeof element.animate !== 'function') {
            draw(end);
            settle('rest');
            return;
          }
          fade = element.animate([{ opacity: startOpacity }, { opacity: end.o }], {
            duration: REDUCED_CROSSFADE_MS,
            easing: 'linear',
          });
          fade.onfinish = () => {
            fade = null;
            draw(end);
            settle('rest');
          };
          fade.oncancel = () => settle('interrupted');
        });
      }
      // Reversal onto the last origin keeps the exact spring (and its velocity); anything else rebases.
      const reversing = progress !== null && sameVisual(target, from);
      if (reversing && progress) {
        config = springConfig;
        progress.retarget(0, t);
      } else {
        const velocity = opts.velocity ?? (lastDrive ? fingerVelocity : velocityNow());
        from = shown;
        to = target;
        config = springConfig;
        progress = spring(0, config, t, velocity);
        progress.retarget(1, t);
      }
      lastDrive = null;
      startTicker();
      return new Promise<MotionEnd>((done) => {
        resolve = done;
      });
    },
    drive(visual) {
      stopFade();
      progress = null;
      stopTicker();
      const t = now();
      if (lastDrive && t > lastDrive.t) {
        const page = pageBox();
        const dt = (t - lastDrive.t) / 1000;
        // Progress velocity toward "closed": the page-relative size change per second.
        fingerVelocity = (lastDrive.visual.w - visual.w) / page.w / dt;
      }
      lastDrive = { t, visual };
      from = visual;
      to = visual;
      draw(visual);
      settle('interrupted');
    },
    current: () => shown,
    moving: () => progress !== null || fade !== null,
    dispose() {
      reveal(true);
      stopFade();
      progress = null;
      stopTicker();
      setOpenness(options.id, 0);
      settle('interrupted');
    },
  };
}

const sameVisual = (a: Visual, b: Visual) =>
  Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.w - b.w) < 1 && Math.abs(a.h - b.h) < 1;

/** The rect the Home gesture draws for a finger that moved (dx, dy) from the bottom edge (plans/ios/02 step "1:1"). */
export function gestureVisual(page: Box, dx: number, dy: number): { visual: Visual; travel: number } {
  const travel = Math.max(0, -dy) / (page.h * 0.62);
  const scale = Math.max(0.28, 1 - 0.62 * Math.min(1.15, travel));
  const w = page.w * scale;
  const h = page.h * scale;
  const cx = page.w / 2 + dx * 0.9;
  const bottom = page.h + Math.min(0, dy);
  return {
    visual: { x: cx - w / 2, y: bottom - h, w, h, r: Math.min(38, travel * 140), o: 1 },
    travel,
  };
}

// --- Spring keyframes (WAAPI) -------------------------------------------------------------------------------------------

/** A spring from 0 to 1 sampled into offsets/values plus its settle time — for WAAPI one-shots. */
export function springSamples(config: SpringConfig, samples = 24): { values: number[]; durationMs: number } {
  let settleT = 0.2;
  for (let t = 0.05; t < 3; t += 0.01) {
    const { value, velocity } = solveSpring(-1, 0, config, t);
    if (Math.abs(value) < 0.002 && Math.abs(velocity) < 0.02) {
      settleT = t;
      break;
    }
    settleT = t;
  }
  const values: number[] = [];
  for (let index = 0; index <= samples; index++) {
    const t = (settleT * index) / samples;
    values.push(1 + solveSpring(-1, 0, config, t).value);
  }
  values[samples] = 1;
  return { values, durationMs: Math.round(settleT * 1000) };
}

/**
 * The Home Screen arrival fly-in (plans/ios/surfaces/boot "Motion"): icons scale 1.15 → 1 and fade in, 12 ms stagger
 * per column, spring r 0.5 ζ 0.9; the Dock rises 24 pt. Reduced motion: nothing (the Home Screen is simply there).
 */
export function arrivalFlyIn(
  items: readonly { el: HTMLElement; column: number }[],
  dock: HTMLElement | null,
): Animation[] {
  if (prefersReducedMotion()) return [];
  const { values, durationMs } = springSamples(IOS_SPRINGS.arrival);
  const animations: Animation[] = [];
  for (const { el, column } of items) {
    if (typeof el.animate !== 'function') continue;
    const frames = values.map((v, index) => ({
      transform: `scale(${lerp(IOS_TIMING.arrivalFrom, 1, v)})`,
      opacity: Math.min(1, index / (values.length * 0.35)),
    }));
    animations.push(
      el.animate(frames, { duration: durationMs, delay: column * IOS_TIMING.arrivalStaggerMs, fill: 'backwards' }),
    );
  }
  if (dock && typeof dock.animate === 'function') {
    const frames = values.map((v) => ({ transform: `translateY(${lerp(24, 0, v)}px)` }));
    animations.push(dock.animate(frames, { duration: durationMs, fill: 'backwards' }));
  }
  return animations;
}

/** The long-press "haptic": a quick scale dip 1 → 0.96 → 1.08 over 180 ms (plans/ios/surfaces/quick-actions). */
export function scaleDip(el: HTMLElement | null): void {
  if (!el || prefersReducedMotion() || typeof el.animate !== 'function') return;
  el.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.96)', offset: 0.35 }, { transform: 'scale(1.08)' }], {
    duration: IOS_TIMING.scaleDipMs,
    easing: IOS_EASE.out,
    fill: 'forwards',
  });
}

/** One spring one-shot on a single element (menus from their corner, bubbles, modules): `from` keyframe → rest. */
export function springIn(
  el: HTMLElement | null,
  config: SpringConfig,
  fromFrame: Keyframe,
  toFrame: Keyframe = { transform: 'none', opacity: 1 },
  delay = 0,
): Animation | null {
  if (!el || prefersReducedMotion() || typeof el.animate !== 'function') return null;
  const { values, durationMs } = springSamples(config, 16);
  const fromT = String(fromFrame.transform ?? 'none');
  const frames: Keyframe[] = values.map((v, index) => ({
    offset: index / (values.length - 1),
    transform: interpolateTransform(fromT, String(toFrame.transform ?? 'none'), v),
    opacity:
      fromFrame.opacity === undefined
        ? undefined
        : lerp(Number(fromFrame.opacity), Number(toFrame.opacity ?? 1), Math.min(1, v * 1.6)),
  }));
  return el.animate(frames, { duration: durationMs, delay, fill: 'backwards' });
}

/** Linear blend of two simple transforms of the same shape (`scale(a) translateY(b)`); non-matching → the target. */
function interpolateTransform(from: string, to: string, t: number): string {
  const numbers = /-?\d*\.?\d+/g;
  const a = from.match(numbers);
  const b = to === 'none' ? null : to.match(numbers);
  if (!a) return to;
  const template = from;
  if (to === 'none') {
    // Identity values: scale → 1, translate/rotate → 0.
    let index = 0;
    return template.replace(numbers, (match, offset: number) => {
      const before = template.slice(0, offset);
      const identity = /scale[XY]?\([^)]*$/.test(before) ? 1 : 0;
      return String(lerp(Number(a[index++] ?? match), identity, t));
    });
  }
  if (!b || a.length !== b.length) return to;
  let index = 0;
  return template.replace(numbers, () => {
    const value = lerp(Number(a[index]), Number(b[index]), t);
    index++;
    return String(value);
  });
}

// --- Exit beat (plans/ios/07 "Switch OS") --------------------------------------------------------------------------------

/**
 * Leaving iOS: the foreground app closes into its icon fast (the shell runs that flight), then the icons scale away
 * 1 → 1.15 and fade — the reverse of the arrival — ≤ 300 ms in all. Reversible (return-to-origin) and killable.
 */
export function exitBeat(
  targets: { icons: readonly HTMLElement[]; chrome: readonly HTMLElement[] },
  done: () => void,
): { reverse(back: () => void): void; kill(): void } {
  const reduced = prefersReducedMotion();
  const duration = reduced ? REDUCED_CROSSFADE_MS : IOS_TIMING.exitIconsMs;
  const all = [...targets.icons, ...targets.chrome];
  const animations = all
    .filter((el) => typeof el.animate === 'function')
    .map((el, index) =>
      el.animate(
        reduced
          ? [{ opacity: 1 }, { opacity: 0 }]
          : [
              { transform: 'scale(1)', opacity: 1 },
              { transform: `scale(${index < targets.icons.length ? IOS_TIMING.arrivalFrom : 1})`, opacity: 0 },
            ],
        { duration, easing: IOS_EASE.bannerOut, fill: 'forwards' },
      ),
    );
  let finished = false;
  const timer = setTimeout(() => {
    finished = true;
    done();
  }, duration);
  return {
    reverse(back) {
      clearTimeout(timer);
      if (finished) {
        for (const animation of animations) animation.cancel();
        back();
        return;
      }
      for (const animation of animations) animation.reverse();
      setTimeout(() => {
        for (const animation of animations) animation.cancel();
        back();
      }, duration / 2);
    },
    kill() {
      clearTimeout(timer);
      for (const animation of animations) animation.cancel();
    },
  };
}
