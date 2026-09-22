'use client';
/**
 * The macOS guided tour host (shared/20, plans/macos/07 "Guided tour", `MAC-X-03`). The director (`lib/tour`, a lazy
 * chunk) runs the macOS script: real kernel actions (Safari, GitHub opened for real), a coach-mark card anchored to
 * the element each step points at (a soft highlight ring — never a dimming overlay), "2 / 5", Next and End tour.
 * It never starts itself; any press or key outside the card, Esc, Back or an OS switch ends it and leaves what it
 * opened open and focused; under reduced motion nothing auto-advances (Next only) and the ring does not pulse.
 * Captions are announced through the status region; the card is a labelled group reachable by Tab.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TourDirector, TourEnd, TourStep } from '@/lib/tour';
import { analytics } from '@/lib/analytics/loader';
import { windowId } from '@/lib/kernel/types';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { dispatchSoon, getKernel, subscribeEffects } from '@/stores/kernel-store';
import { announce } from '../announce';
import { onAppFailed } from '../apps/registry';
import { setTour, useMacUi } from '../ui';
import styles from './tour.module.css';

interface Shown {
  readonly step: TourStep;
  readonly index: number;
  readonly total: number;
}

const CARD_W = 300;
const GAP = 12;

/** Where the card goes: above the target when it sits low (the Dock), else below it; clamped to the viewport. */
export function placeCoach(
  target: { left: number; top: number; width: number; height: number } | null,
  card: { w: number; h: number },
  viewport: { w: number; h: number },
): { x: number; y: number } {
  if (!target) return { x: Math.round((viewport.w - card.w) / 2), y: Math.round(viewport.h * 0.3) };
  const below = target.top + target.height + GAP;
  const above = target.top - GAP - card.h;
  const y = target.top > viewport.h / 2 && above > 8 ? above : Math.min(below, viewport.h - card.h - 8);
  const x = target.left + target.width / 2 - card.w / 2;
  return {
    x: Math.round(Math.min(viewport.w - card.w - 8, Math.max(8, x))),
    y: Math.round(Math.max(8, y)),
  };
}

export function TourHost() {
  const running = useMacUi((state) => state.tour === 'running');
  const [shown, setShown] = useState<Shown | null>(null);
  const director = useRef<TourDirector | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  // Start: load the director chunk, run the macOS script against the real kernel.
  useEffect(() => {
    if (!running) return;
    let alive = true;
    let stopEffects: (() => void) | null = null;
    let stopFailures: (() => void) | null = null;
    void Promise.all([import('@/lib/tour'), import('@/lib/tour/scripts')]).then(([tour, scripts]) => {
      if (!alive) return;
      const run = tour.createTourDirector(scripts.MACOS_TOUR, {
        dispatch: (action) => {
          dispatchSoon(action);
          // A window that is already open is focused, not reopened: it has already settled.
          if (action.type === 'OPEN_APP') {
            const id = windowId('macos', action.role);
            const existing = getKernel().sessions.macos.windows[id];
            if (existing && existing.phase.s === 'normal') setTimeout(() => director.current?.settled(), 0);
          }
        },
        show: (step, index, total) => setShown({ step, index, total }),
        announce,
        end: (reason: TourEnd) => {
          setShown(null);
          setTour('idle');
          // Done: focus returns to the home surface; a cancel leaves focus where the visitor's input put it.
          if (reason === 'completed')
            document
              .querySelector<HTMLElement>(`[data-focus-key="${scripts.MACOS_TOUR.home}"]`)
              ?.focus({ preventScroll: true });
          analytics.track({ name: reason === 'completed' ? 'tour_completed' : 'tour_cancelled', os: 'macos' });
        },
        reducedMotion: () => prefersReducedMotion(),
        setTimeout: (callback, ms) => window.setTimeout(callback, ms),
        clearTimeout: (handle) => window.clearTimeout(handle),
      });
      director.current = run;
      // An app opened by a step settles when its window's opening phase lands.
      stopEffects = subscribeEffects(({ action, state, previous }) => {
        if (action.type === 'PHASE_DONE' && action.target.kind === 'window') {
          const window = state.sessions.macos.windows[action.target.id];
          if (window && window.phase.s === 'normal') run.settled();
        }
        // Back / Forward or leaving macOS ends the tour silently.
        if (action.type === 'ROUTE_CHANGED' || state.activeOs !== previous.activeOs) run.cancel();
      });
      stopFailures = onAppFailed(() => run.failed());
      analytics.track({ name: 'tour_started', os: 'macos' });
      dispatchSoon({ type: 'SET_PREF', patch: { tourOffered: true } });
      run.start();
    });
    return () => {
      alive = false;
      stopEffects?.();
      stopFailures?.();
      director.current?.cancel();
      director.current = null;
    };
    // The director lives exactly as long as the tour runs.
  }, [running]);

  // Any input outside the card cancels (input always wins); Esc ends it too.
  useEffect(() => {
    if (!running) return;
    const outside = (event: Event) => {
      if (card.current?.contains(event.target as Node)) return;
      director.current?.cancel();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        director.current?.cancel();
        return;
      }
      outside(event);
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [running]);

  // Place the ring around the target and the card beside it (layout writes before paint; no React state).
  useLayoutEffect(() => {
    const el = card.current;
    const halo = ring.current;
    if (!shown || !el || !halo) return;
    const place = () => {
      const target = shown.step.pointAt ? document.getElementById(shown.step.pointAt) : null;
      const rect = target?.getBoundingClientRect() ?? null;
      const box = el.getBoundingClientRect();
      const at = placeCoach(rect, { w: box.width || CARD_W, h: box.height }, { w: innerWidth, h: innerHeight });
      el.style.transform = `translate3d(${at.x}px, ${at.y}px, 0)`;
      if (rect) {
        halo.hidden = false;
        halo.style.transform = `translate3d(${rect.left - 6}px, ${rect.top - 6}px, 0)`;
        halo.style.width = `${rect.width + 12}px`;
        halo.style.height = `${rect.height + 12}px`;
      } else halo.hidden = true;
    };
    place();
    // The target may move (an opening window): follow it for the step's first second, then on resize.
    const timer = window.setTimeout(place, 260);
    window.addEventListener('resize', place);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', place);
    };
  }, [shown]);

  if (!running || !shown) return null;
  const last = shown.index === shown.total - 1;
  return (
    <div className={styles.layer} data-tour="">
      <div ref={ring} className={styles.ring} aria-hidden="true" hidden />
      <div ref={card} className={styles.card} role="group" aria-labelledby="mac-tour-caption">
        <p className={styles.counter}>
          {shown.index + 1} / {shown.total}
        </p>
        <p id="mac-tour-caption" className={styles.caption}>
          {shown.step.say}
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.end} onClick={() => director.current?.cancel()}>
            End tour
          </button>
          <button type="button" className={styles.next} onClick={() => director.current?.next()}>
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
