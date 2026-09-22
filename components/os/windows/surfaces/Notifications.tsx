'use client';
/**
 * Toasts — plans/windows/surfaces/notification-center.md (`WIN-NOTIF-01…07`); the Notification Center, calendar and
 * Quick Settings are in ./Panels (their own chunk, loaded on first open or in idle time).
 *   · Toast: a 364 px Acrylic card 16 px above the taskbar at the right edge — header row (app glyph · app name · "now"
 *     · ✕), title, body, up to two full-width buttons. One at a time (queue ≤ 3), dwell ≥ 6 s, paused while hovered or
 *     focused, ✕ or a swipe right dismisses, a body click runs the primary action. Every toast lands in the Center
 *     however it ends (WCAG 2.2.1). The region is a `role="status"` present from mount; a toast never takes focus.
 *   · Notification Center (clock): notifications grouped by app with Clear all, and a collapsible month calendar
 *     (a keyboard-navigable `grid`, decorative).
 *   · Quick Settings (network/volume): toggle tiles wired to preferences — Sound · Reduce motion · Reduce transparency
 *     · Dark mode · Night light (a session-only warm tint) · Switch OS — a volume slider, and a gear to Settings.
 *   · compact: the tray's single button opens one combined sheet (Quick Settings, then notifications).
 */
import { useEffect, useEffectEvent, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { flDismiss } from '../fluent.generated';
import { Fl } from '../icons';
import { winBinding } from '../model';
import type { ToastSpec } from '../shell-context';
import styles from '../windows.module.css';

/** Dwell before a toast leaves on its own (≥ 6 s, plans/windows/surfaces/notification-center). */
export const TOAST_DWELL_MS = 7000;
/** A horizontal swipe this far to the right dismisses. */
const SWIPE_PX = 80;

export interface CenterItem extends ToastSpec {
  readonly at: number;
}

export interface ToastState {
  readonly shown: ToastSpec | null;
  readonly queue: readonly ToastSpec[];
  readonly center: readonly CenterItem[];
}

export type ToastEvent =
  | { readonly type: 'push'; readonly toast: ToastSpec; readonly canShow: boolean; readonly now: number }
  /** The Center is open: the notification goes straight into its list (no popup). */
  | { readonly type: 'center'; readonly toast: ToastSpec; readonly now: number }
  | { readonly type: 'done'; readonly id: string; readonly canShow: boolean; readonly now: number }
  | { readonly type: 'flush'; readonly canShow: boolean }
  | { readonly type: 'remove'; readonly id: string }
  | { readonly type: 'clear'; readonly app?: string }
  | { readonly type: 'expire'; readonly now: number };

export const INITIAL_TOASTS: ToastState = { shown: null, queue: [], center: [] };

const toCenter = (center: readonly CenterItem[], toast: ToastSpec, now: number): readonly CenterItem[] =>
  [{ ...toast, at: now }, ...center.filter((item) => item.id !== toast.id)].slice(0, 30);

/**
 * The toast machine (pure — unit-tested): one visible, a queue of ≤ 3, everything ends in the Center. When nothing
 * may pop up (the Center is open, a menu, a drag), a toast waits in the queue — or, with the Center open, goes straight
 * into its list.
 */
export function toastReducer(state: ToastState, event: ToastEvent): ToastState {
  switch (event.type) {
    case 'push': {
      const { toast } = event;
      if (state.shown?.id === toast.id || state.queue.some((item) => item.id === toast.id)) return state;
      // A full queue sends the newest straight to the Center (nothing is ever lost).
      if ((state.shown || !event.canShow) && state.queue.length >= 3)
        return { ...state, center: toCenter(state.center, toast, event.now) };
      if (state.shown || !event.canShow) return { ...state, queue: [...state.queue, toast].slice(-3) };
      return { ...state, shown: toast, center: state.center.filter((item) => item.id !== toast.id) };
    }
    case 'center':
      return { ...state, center: toCenter(state.center, event.toast, event.now) };
    case 'done': {
      if (state.shown?.id !== event.id) return state;
      const center = toCenter(state.center, state.shown, event.now);
      const [next, ...queue] = state.queue;
      return event.canShow && next ? { shown: next, queue, center } : { shown: null, queue: state.queue, center };
    }
    case 'flush': {
      if (state.shown || !event.canShow || state.queue.length === 0) return state;
      const [next, ...queue] = state.queue;
      return { ...state, shown: next!, queue };
    }
    case 'remove':
      return {
        shown: state.shown?.id === event.id ? null : state.shown,
        queue: state.queue.filter((item) => item.id !== event.id),
        center: state.center.filter((item) => item.id !== event.id),
      };
    case 'clear':
      return {
        ...state,
        center: event.app ? state.center.filter((item) => item.app !== event.app) : [],
      };
    case 'expire': {
      const center = state.center.filter((item) => !item.expires || item.expires > event.now);
      return center.length === state.center.length ? state : { ...state, center };
    }
  }
}

export function AppGlyph({ app, size = 16 }: { readonly app: ToastSpec['app']; readonly size?: number }) {
  if (app === 'system') return <AssetIcon id="system.windows-logo" size={size} />;
  return <AssetIcon id={winBinding(app).icon} size={size} />;
}

// --- Toast ---------------------------------------------------------------------------------------------------------

export function Toast({
  toast,
  onDone,
  live,
}: {
  readonly toast: ToastSpec;
  /** It left: timed out, dismissed or acted on (it goes to the Center either way). */
  readonly onDone: (id: string, dismissed: boolean) => void;
  readonly live: boolean;
}) {
  const card = useRef<HTMLDivElement>(null);
  const paused = useRef(false);
  const [leaving, setLeaving] = useState(false);

  const leave = (dismissed: boolean) => {
    if (leaving) return;
    setLeaving(true);
    if (dismissed) toast.onDismiss?.();
    // The exit (167 ms) plays in CSS; the Center receives the toast when it has left.
    setTimeout(() => onDone(toast.id, dismissed), 170);
  };

  // The dwell timer ends the toast through the latest `leave` (never a stale "not leaving" closure).
  const expire = useEffectEvent(() => leave(false));

  useEffect(() => {
    let remaining = TOAST_DWELL_MS;
    let started = performance.now();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const arm = () => {
      started = performance.now();
      timer = setTimeout(expire, remaining);
    };
    const pause = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      remaining = Math.max(1500, remaining - (performance.now() - started));
    };
    const el = card.current;
    const onEnter = () => {
      paused.current = true;
      pause();
    };
    const onLeave = () => {
      if (el?.contains(document.activeElement)) return;
      paused.current = false;
      arm();
    };
    el?.addEventListener('pointerenter', onEnter);
    el?.addEventListener('pointerleave', onLeave);
    const onFocusOut = (event: FocusEvent) => {
      if (!el?.contains(event.relatedTarget as Node)) onLeave();
    };
    el?.addEventListener('focusin', onEnter);
    el?.addEventListener('focusout', onFocusOut);
    arm();
    return () => {
      if (timer) clearTimeout(timer);
      el?.removeEventListener('pointerenter', onEnter);
      el?.removeEventListener('pointerleave', onLeave);
      el?.removeEventListener('focusin', onEnter);
      el?.removeEventListener('focusout', onFocusOut);
    };
    // One dwell per toast.
  }, [toast.id]);

  // Swipe right to dismiss (the ✕ is the non-gesture alternative).
  const swipe = useRef<{ x: number; id: number } | null>(null);
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('button')) return;
    swipe.current = { x: event.clientX, id: event.pointerId };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipe.current;
    if (!start || start.id !== event.pointerId || !card.current) return;
    const dx = Math.max(0, event.clientX - start.x);
    card.current.style.transform = dx ? `translateX(${dx}px)` : '';
    card.current.style.opacity = dx ? String(Math.max(0.2, 1 - dx / 240)) : '';
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || !card.current) return;
    const dx = event.clientX - start.x;
    if (dx > SWIPE_PX) leave(true);
    else {
      card.current.style.transform = '';
      card.current.style.opacity = '';
      if (Math.abs(dx) < 4 && !(event.target as Element).closest('button') && toast.primary) {
        toast.primary();
        leave(false);
      }
    }
  };

  return (
    <div
      ref={card}
      className={styles.toast}
      data-toast={toast.id}
      data-state={leaving ? 'leaving' : 'shown'}
      data-acrylic={live ? 'live' : 'tint'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        swipe.current = null;
        if (card.current) card.current.style.transform = '';
      }}
    >
      <div className={styles.toastHead}>
        <AppGlyph app={toast.app} />
        <span className={styles.toastApp}>{toast.appName}</span>
        <span className={styles.toastTime}>now</span>
        <button
          type="button"
          className={styles.toastClose}
          aria-label={`Dismiss notification: ${toast.title}`}
          onClick={() => leave(true)}
        >
          <Fl icon={flDismiss} size={12} />
        </button>
      </div>
      <p className={styles.toastTitle}>{toast.title}</p>
      {toast.body ? <p className={styles.toastBody}>{toast.body}</p> : null}
      {toast.actions?.length ? (
        <div className={styles.toastActions} data-count={toast.actions.length}>
          {toast.actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={styles.toastAction}
              data-primary={action.primary || undefined}
              onClick={() => {
                action.run();
                leave(action.label === 'Dismiss' || action.label === 'Not now');
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
