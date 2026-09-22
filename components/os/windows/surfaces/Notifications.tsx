'use client';
/**
 * Toasts, the Notification Center (+ calendar) and Quick Settings — plans/windows/surfaces/notification-center.md
 * (`WIN-NOTIF-01…07`).
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
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { AssetIcon } from '@/components/ui/AssetIcon';
import type { UserPreferences } from '@/lib/kernel/types';
import { dispatchSoon } from '@/stores/kernel-store';
import { usePrefs } from '@/stores/kernel-context';
import {
  flAccessibility,
  flChevronDown,
  flChevronUp,
  flDarkTheme,
  flDismiss,
  flDrop,
  flMoon,
  flPlug,
  flSettings,
  flSpeaker,
  flSpeakerMute,
  flSwap,
} from '../fluent.generated';
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

function AppGlyph({ app, size = 16 }: { readonly app: ToastSpec['app']; readonly size?: number }) {
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

// --- Notification Center + calendar ----------------------------------------------------------------------------------

export function NotificationCenter({
  items,
  onClear,
  onRemove,
  onRun,
  sheet = false,
}: {
  readonly items: readonly CenterItem[];
  readonly onClear: (app?: string) => void;
  readonly onRemove: (id: string) => void;
  readonly onRun: (item: CenterItem) => void;
  readonly sheet?: boolean;
}) {
  const groups = new Map<string, CenterItem[]>();
  for (const item of items) groups.set(item.appName, [...(groups.get(item.appName) ?? []), item]);
  return (
    <section className={styles.center} aria-labelledby="win-center-title" data-center="">
      <header className={styles.centerHeader}>
        <h2 id="win-center-title" className={styles.flyoutTitle}>
          Notifications
        </h2>
        {items.length ? (
          <button type="button" className={styles.linkButton} onClick={() => onClear()}>
            Clear all
          </button>
        ) : null}
      </header>
      {items.length === 0 ? (
        <p className={styles.centerEmpty}>No new notifications</p>
      ) : (
        [...groups].map(([app, list]) => (
          <section key={app} className={styles.centerGroup} aria-label={app}>
            <h3 className={styles.centerApp}>
              <AppGlyph app={list[0]!.app} />
              {app}
            </h3>
            <ul role="list" className={styles.centerList}>
              {list.map((item) => (
                <li key={item.id} className={styles.centerItem} data-center-item={item.id}>
                  <button
                    type="button"
                    className={styles.centerItemBody}
                    onClick={() => onRun(item)}
                    disabled={!item.primary && !item.actions?.length}
                  >
                    <span className={styles.toastTitle}>{item.title}</span>
                    {item.body ? <span className={styles.toastBody}>{item.body}</span> : null}
                  </button>
                  <button
                    type="button"
                    className={styles.toastClose}
                    aria-label={`Clear notification: ${item.title}`}
                    onClick={() => onRemove(item.id)}
                  >
                    <Fl icon={flDismiss} size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {sheet ? null : <Calendar />}
    </section>
  );
}

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** The month calendar (decorative, but a real keyboard-navigable `grid` — plans/windows/05). */
export function Calendar() {
  const [today] = useState(() => new Date());
  const [open, setOpen] = useState(true);
  const [focused, setFocused] = useState(today.getDate());
  const grid = useRef<HTMLTableElement>(null);
  const year = today.getFullYear();
  const month = today.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const offset = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const heading = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const monthName = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const onKey = (event: KeyboardEvent<HTMLTableElement>) => {
    const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next = focused;
    if (event.key in delta) next = focused + delta[event.key]!;
    else if (event.key === 'Home') next = 1;
    else if (event.key === 'End') next = days;
    else return;
    event.preventDefault();
    next = Math.min(days, Math.max(1, next));
    setFocused(next);
    grid.current?.querySelector<HTMLElement>(`[data-day="${next}"]`)?.focus();
  };

  return (
    <section className={styles.calendar} aria-label="Calendar">
      <header className={styles.calendarHeader}>
        <span className={styles.calendarDate}>{heading}</span>
        <button
          type="button"
          className={styles.iconButton}
          aria-expanded={open}
          aria-label={open ? 'Collapse calendar' : 'Expand calendar'}
          onClick={() => setOpen((value) => !value)}
        >
          <Fl icon={open ? flChevronDown : flChevronUp} size={12} />
        </button>
      </header>
      {open ? (
        // The APG date-picker grid: a table whose cells arrow keys move between (one tab stop).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
        <table ref={grid} role="grid" className={styles.calendarGrid} aria-label={monthName} onKeyDown={onKey}>
          <thead>
            <tr>
              {DAY_NAMES.map((day) => (
                <th key={day} scope="col" abbr={day}>
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, row) => (
              <tr key={row}>
                {week.map((day, column) => (
                  <td
                    key={column}
                    role="gridcell"
                    data-day={day ?? undefined}
                    tabIndex={day === focused ? 0 : day ? -1 : undefined}
                    aria-current={day === today.getDate() ? 'date' : undefined}
                    aria-label={
                      day
                        ? new Date(year, month, day).toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                          })
                        : undefined
                    }
                    className={day === today.getDate() ? styles.today : undefined}
                  >
                    {day ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

// --- Quick Settings --------------------------------------------------------------------------------------------------

export function QuickSettings({
  nightLight,
  onNightLight,
  onSettings,
  onSwitchOs,
}: {
  readonly nightLight: boolean;
  readonly onNightLight: (on: boolean) => void;
  readonly onSettings: () => void;
  readonly onSwitchOs: () => void;
}) {
  const prefs = usePrefs((value) => value);
  const systemDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && !!systemDark);
  const set = (patch: Partial<Omit<UserPreferences, 'v'>>) => dispatchSoon({ type: 'SET_PREF', patch });
  const tiles = [
    {
      id: 'sound',
      label: 'Sound',
      on: prefs.sound.enabled,
      icon: prefs.sound.enabled ? flSpeaker : flSpeakerMute,
      toggle: () => set({ sound: { ...prefs.sound, enabled: !prefs.sound.enabled } }),
    },
    {
      id: 'motion',
      label: 'Reduce motion',
      on: prefs.motion === 'reduced',
      icon: flAccessibility,
      toggle: () => set({ motion: prefs.motion === 'reduced' ? 'full' : 'reduced' }),
    },
    {
      id: 'transparency',
      label: 'Reduce transparency',
      on: prefs.glass === 'solid',
      icon: flDrop,
      toggle: () => set({ glass: prefs.glass === 'solid' ? 'full' : 'solid' }),
    },
    {
      id: 'dark',
      label: 'Dark mode',
      on: dark,
      icon: flDarkTheme,
      toggle: () => set({ theme: dark ? 'light' : 'dark' }),
    },
    { id: 'night', label: 'Night light', on: nightLight, icon: flMoon, toggle: () => onNightLight(!nightLight) },
    { id: 'switch', label: 'Switch OS', on: false, icon: flSwap, toggle: onSwitchOs, action: true },
  ] as const;
  return (
    <section className={styles.quick} aria-label="Quick Settings" data-quick="">
      <ul className={styles.quickTiles} role="list">
        {tiles.map((tile) => (
          <li key={tile.id} className={styles.quickTile}>
            <button
              type="button"
              className={styles.quickButton}
              aria-label={tile.label}
              aria-pressed={'action' in tile ? undefined : tile.on}
              data-on={tile.on || undefined}
              data-quick-tile={tile.id}
              onClick={tile.toggle}
            >
              <Fl icon={tile.icon} size={16} />
            </button>
            <span className={styles.quickLabel} aria-hidden="true">
              {tile.label}
            </span>
          </li>
        ))}
      </ul>
      <label className={styles.volume}>
        <Fl icon={prefs.sound.enabled ? flSpeaker : flSpeakerMute} size={16} />
        <span className="sr-only">Volume</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(prefs.sound.volume * 100)}
          onChange={(event) => set({ sound: { ...prefs.sound, volume: Number(event.target.value) / 100 } })}
        />
      </label>
      <footer className={styles.quickFooter}>
        <span className={styles.quickStatus}>
          <Fl icon={flPlug} size={14} /> Plugged in
        </span>
        <button type="button" className={styles.iconButton} aria-label="Settings" onClick={onSettings}>
          <Fl icon={flSettings} size={16} />
        </button>
      </footer>
    </section>
  );
}
