'use client';
/**
 * The iOS navigation stack (plans/ios/02 "In-app navigation", `IOS-FLIGHT-06`):
 *   · push slides the new screen in from the right (350 ms `0.32, 0.72, 0, 1`) while the one underneath parallaxes −30 %
 *     and dims 10 %; pop reverses it. Only `transform` / `opacity` animate (WAAPI on the compositor).
 *   · Back: the nav-bar chevron labelled with the **previous screen's title** ("Back to Repositories"); an interactive
 *     **edge swipe** that follows the finger 1:1 and decides by projected position (`IOS-MOTION-02`) — on touch it starts
 *     ≥ 24 px inside the edge (the browser's own Back swipe stays untouched), with a mouse it is a click-drag from the
 *     stack's left edge; browser Back (the app wires its URL stack).
 *   · large titles collapse into the nav bar on scroll (the inline title appears once the large one scrolls under the
 *     bar; transform / opacity only).
 *   · focus: a push focuses the new screen's title; a pop focuses the row that pushed (`data-push-key`), else the title.
 *   · scroll: each screen keeps its scroll position while the app lives; the top screen's is saved to the kernel
 *     (`SET_SCROLL` + `ui.scrollKey`) so an evicted app restores it (`IOS-FLIGHT-05`).
 * The stack itself is data the app owns (URL-derived or `WindowInstance.ui`); this component only draws and animates it.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import type { WindowId } from '@/lib/kernel/types';
import { drag } from '@/lib/motion/drag';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { dispatchSoon, getKernel } from '@/stores/kernel-store';
import { commits, EDGE_GUARD_PX } from '../model';
import { IOS_EASE, IOS_TIMING } from '../motion';
import { Glyph } from './glyphs';
import styles from './ui.module.css';

export interface NavScreen {
  /** Unique within the stack (a pushed place's identity). */
  readonly key: string;
  readonly title: string;
  /** Large title (roots and list screens); detail screens use the inline title only. */
  readonly large?: boolean;
  readonly render: () => ReactNode;
  /** Replaces the back button (a modal root's "Done", Quick Look's Done). */
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
  /** Under the large title (a search field). */
  readonly accessory?: ReactNode;
  /** Bottom toolbar. */
  readonly toolbar?: ReactNode;
  /** Background: grouped (#F2F2F7), plain (white), paper (Notes). */
  readonly tone?: 'grouped' | 'plain' | 'paper' | 'dark';
  /** No nav bar at all (Safari's page, Quick Look draws its own). */
  readonly bare?: boolean;
  /** Short back label override ("Back" when the title is long). */
  readonly backLabel?: string;
}

export interface NavStackProps {
  /** Unique per stack (app id + tab) — keys the scroll memory. */
  readonly id: string;
  readonly screens: readonly NavScreen[];
  /** Pop to the given index (the app updates its stack; for URL stacks this is `APP_BACK` / a replace). */
  readonly onPop: (toIndex: number) => void;
  /** Save the top screen's scroll to this window (restores after eviction/reload). */
  readonly window?: WindowId;
  /** A tab bar under the screens. */
  readonly tabBar?: ReactNode;
  readonly className?: string;
  /** Heading level of screen titles (the app's own title is the `h2`). */
  readonly level?: 3 | 4;
  /** Hide the back button on the root even if `leading` is absent (split-view detail columns). */
  readonly rootBack?: ReactNode;
}

type Transition = { kind: 'push' | 'pop'; from: string; to: string; id: number } | null;

const scrollMemory = new Map<string, number>();
let transitionIds = 0;

export function NavStack({
  id,
  screens,
  onPop,
  window: windowId,
  tabBar,
  className,
  level = 3,
  rootBack,
}: NavStackProps) {
  const top = screens[screens.length - 1];
  const below = screens.length > 1 ? screens[screens.length - 2] : undefined;
  const container = useRef<HTMLDivElement>(null);
  const previous = useRef<readonly NavScreen[]>(screens);
  const [transition, setTransition] = useState<Transition>(null);
  /** Screens leaving on a pop stay drawn until their slide ends. */
  const [leaving, setLeaving] = useState<NavScreen | null>(null);
  const skipNext = useRef(false);
  const focusNext = useRef<{ kind: 'push' | 'pop'; popped?: string } | null>(null);

  // Diff the stack: a push or a pop animates; anything else (a replace, a tab switch) simply shows the new top.
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = screens;
    const oldTop = before[before.length - 1];
    if (!top || !oldTop || oldTop.key === top.key) return;
    const pushed = screens.length > before.length && screens[screens.length - 2]?.key === oldTop.key;
    const popped = before.length > screens.length && before[screens.length - 1]?.key === top.key;
    if (skipNext.current) {
      skipNext.current = false;
      if (popped) focusNext.current = { kind: 'pop', popped: oldTop.key };
      return;
    }
    if (pushed) {
      focusNext.current = { kind: 'push' };
      setTransition({ kind: 'push', from: oldTop.key, to: top.key, id: ++transitionIds });
    } else if (popped) {
      focusNext.current = { kind: 'pop', popped: oldTop.key };
      setLeaving(oldTop);
      setTransition({ kind: 'pop', from: oldTop.key, to: top.key, id: ++transitionIds });
    } else focusNext.current = { kind: 'push' };
  }, [screens, top]);

  // Run the slide (WAAPI) whenever a transition starts; input during it simply lands on the new screen.
  useLayoutEffect(() => {
    if (!transition || !container.current) return;
    const root = container.current;
    const incoming = root.querySelector<HTMLElement>(`[data-screen="${cssKey(transition.to)}"]`);
    const outgoing = root.querySelector<HTMLElement>(`[data-screen="${cssKey(transition.from)}"]`);
    const reduced = prefersReducedMotion();
    const options: KeyframeAnimationOptions = {
      duration: reduced ? 150 : IOS_TIMING.navMs,
      easing: reduced ? 'linear' : IOS_EASE.nav,
    };
    const parallax = `${IOS_TIMING.navParallax * 100}%`;
    const animations: Animation[] = [];
    const run = (el: HTMLElement | null, frames: Keyframe[]) => {
      if (el && typeof el.animate === 'function') animations.push(el.animate(frames, options));
    };
    /** The underlay dims 10 % through its own veil (opacity only — never a filter). */
    const veil = (el: HTMLElement | null) => el?.querySelector<HTMLElement>(':scope > [data-dim]') ?? null;
    if (reduced) {
      run(transition.kind === 'push' ? incoming : outgoing, [
        { opacity: transition.kind === 'push' ? 0 : 1 },
        { opacity: transition.kind === 'push' ? 1 : 0 },
      ]);
    } else if (transition.kind === 'push') {
      run(incoming, [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }]);
      run(outgoing, [{ transform: 'translateX(0)' }, { transform: `translateX(${parallax})` }]);
      run(veil(outgoing), [{ opacity: 0 }, { opacity: IOS_TIMING.navDim }]);
    } else {
      run(outgoing, [{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }]);
      run(incoming, [{ transform: `translateX(${parallax})` }, { transform: 'translateX(0)' }]);
      run(veil(incoming), [{ opacity: IOS_TIMING.navDim }, { opacity: 0 }]);
    }
    let alive = true;
    const end = () => {
      if (!alive) return;
      alive = false;
      setTransition((current) => (current?.id === transition.id ? null : current));
      setLeaving(null);
    };
    if (animations.length === 0) end();
    else void Promise.all(animations.map((animation) => animation.finished.catch(() => undefined))).then(end);
    return () => {
      alive = false;
      for (const animation of animations) animation.cancel();
    };
  }, [transition]);

  // Focus after a push / pop (the heading, or the row that pushed).
  useEffect(() => {
    const request = focusNext.current;
    if (!request || !container.current || !top) return;
    focusNext.current = null;
    const screen = container.current.querySelector<HTMLElement>(`[data-screen="${cssKey(top.key)}"]`);
    if (!screen) return;
    const origin =
      request.kind === 'pop' && request.popped
        ? screen.querySelector<HTMLElement>(`[data-push-key="${cssKey(request.popped)}"]`)
        : null;
    const target = origin ?? screen.querySelector<HTMLElement>('[data-screen-title]');
    target?.focus({ preventScroll: true });
  });

  // --- Scroll memory ---------------------------------------------------------------------------------------------------
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScroll = useCallback(
    (key: string, el: HTMLElement) => {
      scrollMemory.set(`${id}:${key}`, el.scrollTop);
      if (!windowId || key !== previous.current[previous.current.length - 1]?.key) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        dispatchSoon({ type: 'SET_SCROLL', id: windowId, top: el.scrollTop });
        dispatchSoon({ type: 'SET_APP_UI', id: windowId, key: `scroll:${id}`, value: key });
      }, 200);
    },
    [id, windowId],
  );
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );
  const initialScroll = useCallback(
    (key: string): number => {
      const remembered = scrollMemory.get(`${id}:${key}`);
      if (remembered !== undefined) return remembered;
      if (!windowId) return 0;
      const window = getKernel().sessions.ios.windows[windowId];
      return window?.ui?.[`scroll:${id}`] === key ? window.scrollTop : 0;
    },
    [id, windowId],
  );

  // --- Interactive edge swipe ------------------------------------------------------------------------------------------
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!below || transition || event.button > 0 || !container.current) return;
    const bounds = container.current.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const touch = event.pointerType !== 'mouse';
    // Touch: start ≥ 24 px inside the page edge (the browser keeps its own Back swipe); mouse: the stack's left edge.
    const pageX = event.clientX;
    const inZone = touch ? pageX >= EDGE_GUARD_PX && x < EDGE_GUARD_PX + 28 : x < 18;
    if (!inZone) return;
    if ((event.target as Element).closest('input, textarea, [contenteditable="true"]')) return;
    const root = container.current;
    const topEl = root.querySelector<HTMLElement>(`[data-screen="${cssKey(top!.key)}"]`);
    const belowEl = root.querySelector<HTMLElement>(`[data-screen="${cssKey(below.key)}"]`);
    if (!topEl || !belowEl) return;
    const width = bounds.width;
    const belowVeil = belowEl.querySelector<HTMLElement>(':scope > [data-dim]');
    let last = { t: performance.now(), dx: 0 };
    let velocity = 0;
    belowEl.hidden = false;
    belowEl.removeAttribute('inert');
    drag(root, event.nativeEvent, {
      threshold: 6,
      lazyCapture: true,
      onStart: () => root.setAttribute('data-swiping', ''),
      onMove: (dx) => {
        const clamped = Math.max(0, Math.min(width, dx));
        const t = performance.now();
        if (t > last.t) velocity = ((clamped - last.dx) / (t - last.t)) * 1000;
        last = { t, dx: clamped };
        const p = clamped / width;
        topEl.style.transform = `translateX(${clamped}px)`;
        belowEl.style.transform = `translateX(${IOS_TIMING.navParallax * 100 * (1 - p)}%)`;
        if (belowVeil) belowVeil.style.opacity = String(IOS_TIMING.navDim * (1 - p));
      },
      onEnd: ({ dx, moved }) => {
        root.removeAttribute('data-swiping');
        if (!moved) {
          belowEl.hidden = true;
          return;
        }
        const travel = Math.max(0, dx) / width;
        const commit = commits(travel, velocity / width);
        const options: KeyframeAnimationOptions = {
          duration: prefersReducedMotion() ? 120 : 260,
          easing: IOS_EASE.nav,
        };
        const from = topEl.style.transform || 'translateX(0)';
        const belowFrom = belowEl.style.transform || `translateX(${IOS_TIMING.navParallax * 100}%)`;
        const veilFrom = Number(belowVeil?.style.opacity || IOS_TIMING.navDim);
        topEl.style.transform = '';
        belowEl.style.transform = '';
        if (belowVeil) belowVeil.style.opacity = '';
        if (commit) {
          const a = topEl.animate?.([{ transform: from }, { transform: 'translateX(100%)' }], {
            ...options,
            fill: 'forwards',
          });
          belowEl.animate?.([{ transform: belowFrom }, { transform: 'translateX(0)' }], options);
          belowVeil?.animate?.([{ opacity: veilFrom }, { opacity: 0 }], options);
          const finish = () => {
            skipNext.current = true;
            onPop(screens.length - 2);
          };
          if (a) void a.finished.then(finish, finish);
          else finish();
        } else {
          topEl.animate?.([{ transform: from }, { transform: 'translateX(0)' }], options);
          const b = belowEl.animate?.(
            [{ transform: belowFrom }, { transform: `translateX(${IOS_TIMING.navParallax * 100}%)` }],
            options,
          );
          belowVeil?.animate?.([{ opacity: veilFrom }, { opacity: IOS_TIMING.navDim }], options);
          const hide = () => {
            belowEl.hidden = true;
            belowEl.setAttribute('inert', '');
          };
          if (b) void b.finished.then(hide, hide);
          else hide();
        }
      },
    });
  };

  if (!top) return null;
  const drawn: { screen: NavScreen; role: 'top' | 'below' | 'leaving' }[] = [];
  if (below && (transition || true)) drawn.push({ screen: below, role: 'below' });
  drawn.push({ screen: top, role: 'top' });
  if (leaving && leaving.key !== top.key) drawn.push({ screen: leaving, role: 'leaving' });

  return (
    <div
      ref={container}
      className={`${styles.stack} ${className ?? ''}`}
      data-nav-stack={id}
      data-has-tabs={tabBar ? '' : undefined}
      onPointerDown={onPointerDown}
    >
      {drawn.map(({ screen, role }) => {
        const index = screens.findIndex((candidate) => candidate.key === screen.key);
        const previousScreen = role === 'leaving' ? top : index > 0 ? screens[index - 1] : undefined;
        const visible = role !== 'below' || transition !== null;
        return (
          <ScreenView
            key={screen.key}
            screen={screen}
            back={
              role === 'leaving' || index > 0
                ? {
                    title: previousScreen?.backLabel ?? previousScreen?.title ?? 'Back',
                    onBack: () => onPop(Math.max(0, (role === 'leaving' ? screens.length : index) - 1)),
                  }
                : null
            }
            rootBack={index === 0 ? rootBack : undefined}
            hidden={!visible}
            inert={role !== 'top'}
            level={level}
            initialScroll={initialScroll}
            onScroll={onScroll}
          />
        );
      })}
      {tabBar}
    </div>
  );
}

const cssKey = (key: string) =>
  typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(key) : key.replace(/["\\]/g, '\\$&');

function ScreenView({
  screen,
  back,
  rootBack,
  hidden,
  inert,
  level,
  initialScroll,
  onScroll,
}: {
  readonly screen: NavScreen;
  readonly back: { title: string; onBack: () => void } | null;
  readonly rootBack?: ReactNode;
  readonly hidden: boolean;
  readonly inert: boolean;
  readonly level: 3 | 4;
  readonly initialScroll: (key: string) => number;
  readonly onScroll: (key: string, el: HTMLElement) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const large = useRef<HTMLHeadingElement>(null);
  const Title = `h${level}` as 'h3';

  // Restore the remembered scroll once, before paint.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const top = initialScroll(screen.key);
    if (top > 0) el.scrollTop = top;
    // Once per screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen.key]);

  // Large-title collapse: the inline title shows once the large title has scrolled under the bar.
  useEffect(() => {
    const el = scroller.current;
    const barEl = bar.current;
    if (!el || !barEl) return;
    const update = () => {
      const y = el.scrollTop;
      const threshold = screen.large ? (large.current?.offsetHeight ?? 40) : 1;
      barEl.toggleAttribute('data-collapsed', !screen.large || y > threshold - 4);
      barEl.toggleAttribute('data-scrolled', y > 1);
      if (large.current) large.current.style.transform = y < 0 ? `scale(${Math.min(1.12, 1 - y / 600)})` : '';
    };
    update();
    const handler = () => {
      update();
      onScroll(screen.key, el);
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [screen.key, screen.large, onScroll]);

  const titleId = `nav-title-${screen.key.replace(/[^a-z0-9-]/gi, '-')}`;
  return (
    <div
      className={styles.screen}
      data-screen={screen.key}
      data-tone={screen.tone ?? 'grouped'}
      hidden={hidden}
      inert={inert || undefined}
    >
      {screen.bare ? null : (
        <div ref={bar} className={styles.navBar} data-nav-bar="">
          <div className={styles.navLeading}>
            {screen.leading ??
              (back ? (
                <button
                  type="button"
                  className={styles.backButton}
                  aria-label={`Back to ${back.title}`}
                  onClick={back.onBack}
                  data-back=""
                >
                  <Glyph name="chevron-left" size={24} strokeWidth={2.6} />
                  <span className={styles.backLabel}>{back.title}</span>
                </button>
              ) : (
                (rootBack ?? null)
              ))}
          </div>
          <div className={styles.navTitle} aria-hidden={screen.large ? 'true' : undefined}>
            {screen.large ? (
              <span>{screen.title}</span>
            ) : (
              <Title id={titleId} data-screen-title="" tabIndex={-1}>
                {screen.title}
              </Title>
            )}
          </div>
          <div className={styles.navTrailing}>{screen.trailing}</div>
        </div>
      )}
      <div ref={scroller} className={styles.scroller} data-scroller="" data-bare={screen.bare || undefined}>
        {screen.large && !screen.bare ? (
          <Title ref={large} id={titleId} className={styles.largeTitle} data-screen-title="" tabIndex={-1}>
            {screen.title}
          </Title>
        ) : null}
        {screen.bare ? (
          <Title id={titleId} className="sr-only" data-screen-title="" tabIndex={-1}>
            {screen.title}
          </Title>
        ) : null}
        {screen.accessory ? <div className={styles.accessory}>{screen.accessory}</div> : null}
        <div className={styles.content}>{screen.render()}</div>
      </div>
      <div className={styles.dimVeil} data-dim="" aria-hidden="true" />
      {screen.toolbar ? (
        <div className={styles.toolbar} role="toolbar" aria-label={`${screen.title} actions`}>
          {screen.toolbar}
        </div>
      ) : null}
    </div>
  );
}

/** Scroll the top screen of a stack to the top (the status-bar time tap). */
export function scrollStackToTop(root: HTMLElement | null): void {
  const screens = root?.querySelectorAll<HTMLElement>('[data-screen]:not([hidden]):not([inert]) [data-scroller]');
  const scroller = screens?.[screens.length - 1];
  if (!scroller) return;
  if (typeof scroller.scrollTo === 'function')
    scroller.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  else scroller.scrollTop = 0;
}
