'use client';
/**
 * Banners and Notification Center — plans/ios/surfaces/notifications.md (`IOS-NOTIF-01…05`).
 *   · A banner drops from the top (spring r 0.45 ζ 0.78 from −120 %), one at a time, queue ≤ 3; it dwells ≥ 6 s and
 *     pauses while pressed, hovered or focused. Swipe **up** dismisses (velocity handed on); tap performs the primary
 *     action — the app opens with a flight **from the banner's rect**; pull down or "More" expands it in place
 *     (content revealed through `clip-path`, actions as a stacked list). It never steals focus; it lives in the
 *     `role="status"` region present from mount. While a flight runs, banners wait (E10 — the shell's arbiter).
 *   · However a banner ends, it lands in Notification Center: a full-screen pull-down sheet (the status bar's left
 *     zone or clock) with a large date header, notifications stacked by app, "Clear" per stack; tap opens, swipe
 *     left (or the focus-revealed Clear) removes. Modal `dialog` with a heading and a Close button.
 * The queue is a pure reducer (`bannerReducer`), unit-tested.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { drag } from '@/lib/motion/drag';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { BANNER_DWELL_MS, BANNER_QUEUE_MAX, commits, statusDate, statusTime, type IosLayout } from '../model';
import { IOS_EASE, IOS_SPRINGS, IOS_TIMING, springSamples } from '../motion';
import type { BannerSpec } from '../shell-context';
import { Glyph } from '../ui/glyphs';
import { AppArt } from './Icons';
import styles from '../ios.module.css';

export interface CenterItem extends BannerSpec {
  readonly at: number;
}

export interface BannerState {
  readonly shown: BannerSpec | null;
  readonly queue: readonly BannerSpec[];
  readonly center: readonly CenterItem[];
}

export const INITIAL_BANNERS: BannerState = { shown: null, queue: [], center: [] };

export type BannerEvent =
  | { readonly type: 'push'; readonly banner: BannerSpec; readonly canShow: boolean; readonly now: number }
  /** The shown banner ended (dwell, swipe, action) — it moves to the Center. */
  | { readonly type: 'done'; readonly id: string; readonly canShow: boolean; readonly now: number }
  | { readonly type: 'flush'; readonly canShow: boolean; readonly now: number }
  | { readonly type: 'remove'; readonly id: string }
  | { readonly type: 'clear'; readonly app: string };

const toCenter = (center: readonly CenterItem[], banner: BannerSpec, now: number): readonly CenterItem[] =>
  [{ ...banner, at: now }, ...center.filter((item) => item.id !== banner.id)].slice(0, 30);

/** Queue + Center bookkeeping (`IOS-NOTIF-01`, `IOS-NOTIF-04`). Expired banners are dropped, never shown late. */
export function bannerReducer(state: BannerState, event: BannerEvent): BannerState {
  switch (event.type) {
    case 'push': {
      const { banner } = event;
      if (state.shown?.id === banner.id) return { ...state, shown: banner };
      const queue = [...state.queue.filter((item) => item.id !== banner.id), banner].slice(-BANNER_QUEUE_MAX);
      return bannerReducer({ ...state, queue }, { type: 'flush', canShow: event.canShow, now: event.now });
    }
    case 'done': {
      if (state.shown?.id !== event.id) return state;
      const center = toCenter(state.center, state.shown, event.now);
      return bannerReducer(
        { ...state, shown: null, center },
        { type: 'flush', canShow: event.canShow, now: event.now },
      );
    }
    case 'flush': {
      if (state.shown || !event.canShow) return state;
      const fresh = state.queue.filter((item) => !item.expires || item.expires > event.now);
      const [next, ...rest] = fresh;
      if (!next) return fresh.length === state.queue.length ? state : { ...state, queue: fresh };
      return { ...state, shown: next, queue: rest };
    }
    case 'remove':
      return {
        shown: state.shown?.id === event.id ? null : state.shown,
        queue: state.queue.filter((item) => item.id !== event.id),
        center: state.center.filter((item) => item.id !== event.id),
      };
    case 'clear':
      return { ...state, center: state.center.filter((item) => item.app !== event.app) };
  }
}

export function Banner({
  banner,
  layout,
  onDone,
}: {
  readonly banner: BannerSpec;
  readonly layout: IosLayout;
  /** `primary`: the banner itself was tapped (its element is the flight origin). */
  readonly onDone: (id: string, reason: 'timeout' | 'swipe' | 'primary' | 'action', origin?: HTMLElement) => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const paused = useRef(0);
  const remaining = useRef(BANNER_DWELL_MS);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaving = useRef(false);

  const leave = (reason: 'timeout' | 'swipe' | 'primary' | 'action', origin?: HTMLElement) => {
    if (leaving.current) return;
    leaving.current = true;
    if (timer.current) clearTimeout(timer.current);
    const el = card.current;
    const finish = () => onDone(banner.id, reason, origin);
    if (!el || typeof el.animate !== 'function' || reason === 'primary') {
      finish();
      return;
    }
    const from = getComputedStyle(el).transform;
    const out = el.animate(
      prefersReducedMotion()
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [{ transform: from === 'none' ? 'translateY(0)' : from }, { transform: 'translateY(-130%)' }],
      { duration: prefersReducedMotion() ? 150 : IOS_TIMING.bannerOutMs, easing: IOS_EASE.bannerOut, fill: 'forwards' },
    );
    out.onfinish = finish;
    out.oncancel = finish;
  };

  const arm = () => {
    if (timer.current) clearTimeout(timer.current);
    if (paused.current > 0 || leaving.current) return;
    started.current = performance.now();
    timer.current = setTimeout(() => leave('timeout'), remaining.current);
  };
  const pause = () => {
    paused.current++;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      remaining.current = Math.max(1500, remaining.current - (performance.now() - started.current));
    }
  };
  const resume = () => {
    paused.current = Math.max(0, paused.current - 1);
    arm();
  };

  // Drop in with the banner spring; dwell ≥ 6 s from arrival.
  useLayoutEffect(() => {
    const el = card.current;
    if (el && typeof el.animate === 'function') {
      if (prefersReducedMotion()) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
      else {
        const { values, durationMs } = springSamples(IOS_SPRINGS.banner, 18);
        el.animate(
          values.map((v) => ({ transform: `translateY(${(1 - v) * -120}%)` })),
          { duration: durationMs },
        );
      }
    }
    arm();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // Once per banner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('button')) return;
    const el = card.current;
    if (!el) return;
    pause();
    let velocity = 0;
    let last = { t: performance.now(), y: 0 };
    drag(el, event.nativeEvent, {
      threshold: 6,
      onMove: (_dx, dy) => {
        const t = performance.now();
        if (t > last.t) velocity = ((dy - last.y) / (t - last.t)) * 1000;
        last = { t, y: dy };
        el.style.transform = `translateY(${dy < 0 ? dy : dy / 4}px)`;
      },
      onEnd: ({ dy, moved }) => {
        resume();
        if (!moved) {
          el.style.transform = '';
          // A tap: the primary action (the app opens from the banner's rect).
          if (banner.primary) {
            banner.primary(el);
            leave('primary', el);
          } else setExpanded(true);
          return;
        }
        const height = el.getBoundingClientRect().height;
        if (commits(Math.max(0, -dy) / height, -velocity / height)) {
          leave('swipe');
          return;
        }
        el.style.transform = '';
        if (dy > 30) setExpanded(true); // pull down expands in place
      },
    });
  };

  return (
    // A gesture surface (swipe / drag); every action it offers is also a button inside.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      ref={card}
      className={styles.banner}
      data-layout={layout}
      data-banner={banner.id}
      data-expanded={expanded || undefined}
      onPointerDown={onPointerDown}
      onPointerEnter={pause}
      onPointerLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      <div className={styles.bannerHead}>
        <span className={styles.bannerIcon} aria-hidden="true">
          {banner.role ? <AppArt role={banner.role} size={38} /> : <Glyph name="bell" size={20} filled />}
        </span>
        <div className={styles.bannerText}>
          <p className={styles.bannerApp}>
            <span>{banner.app}</span>
            <span>now</span>
          </p>
          <p className={styles.bannerTitle}>{banner.title}</p>
          {banner.body ? <p className={styles.bannerBody}>{banner.body}</p> : null}
        </div>
      </div>
      {banner.actions?.length ? (
        expanded ? (
          <div className={styles.bannerActions}>
            {banner.actions.map((action) => (
              <button
                key={action.label}
                type="button"
                data-primary={action.primary || undefined}
                onClick={() => {
                  action.run();
                  leave('action');
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : (
          <button type="button" className={styles.bannerMore} aria-expanded={false} onClick={() => setExpanded(true)}>
            More<span className="sr-only">: {banner.title}</span>
          </button>
        )
      ) : null}
      <button
        type="button"
        className={styles.bannerClose}
        aria-label={`Dismiss: ${banner.title}`}
        onClick={() => leave('swipe')}
      >
        <Glyph name="xmark" size={12} strokeWidth={3} />
      </button>
    </div>
  );
}

export function NotificationCenter({
  items,
  layout,
  closing,
  interactive,
  onRun,
  onRemove,
  onClear,
  onClose,
  onClosed,
}: {
  readonly items: readonly CenterItem[];
  readonly layout: IosLayout;
  readonly closing: boolean;
  readonly interactive?: boolean;
  readonly onRun: (item: CenterItem, origin: HTMLElement) => void;
  readonly onRemove: (id: string) => void;
  readonly onClear: (app: string) => void;
  readonly onClose: () => void;
  readonly onClosed: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const now = new Date();

  /** Clearing unmounts the pressed button: focus moves on to the next Clear, else to Close — never to `<body>`. */
  const keepFocus = (run: () => void) => {
    run();
    setTimeout(() => {
      const el = sheet.current;
      if (!el || (document.activeElement !== document.body && el.contains(document.activeElement))) return;
      (el.querySelector<HTMLElement>('[data-nc-clear]') ?? el.querySelector<HTMLElement>('[data-nc-first]'))?.focus({
        preventScroll: true,
      });
    }, 0);
  };
  const clearStack = (app: string) => keepFocus(() => onClear(app));
  const removeItem = (id: string) => keepFocus(() => onRemove(id));

  useLayoutEffect(() => {
    sheet.current?.querySelector<HTMLElement>('[data-nc-first]')?.focus({ preventScroll: true });
    if (interactive) return;
    const el = sheet.current;
    if (!el || typeof el.animate !== 'function') return;
    if (prefersReducedMotion()) root.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
    else {
      const { values, durationMs } = springSamples(IOS_SPRINGS.sheet, 14);
      el.animate(
        values.map((v) => ({ transform: `translateY(${(v - 1) * 100}%)` })),
        { duration: durationMs },
      );
    }
    // Entrance only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!closing) return;
    const el = sheet.current;
    if (!el || typeof el.animate !== 'function') {
      onClosed();
      return;
    }
    el.style.transform = '';
    const out = prefersReducedMotion()
      ? el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' })
      : el.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }], {
          duration: 260,
          easing: IOS_EASE.bannerOut,
          fill: 'forwards',
        });
    out.onfinish = onClosed;
    out.oncancel = onClosed;
    // An interrupted exit (a reopen, or the surface replaced) is not a close: detach before cancelling.
    return () => {
      out.onfinish = null;
      out.oncancel = null;
      out.cancel();
    };
  }, [closing, onClosed]);

  const stacks = new Map<string, CenterItem[]>();
  for (const item of items) stacks.set(item.app, [...(stacks.get(item.app) ?? []), item]);

  // Swipe up on the sheet closes it.
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('button, a')) return;
    const el = sheet.current;
    if (!el) return;
    let velocity = 0;
    let last = { t: performance.now(), y: 0 };
    drag(el, event.nativeEvent, {
      threshold: 8,
      onMove: (_dx, dy) => {
        const t = performance.now();
        if (t > last.t) velocity = ((dy - last.y) / (t - last.t)) * 1000;
        last = { t, y: dy };
        el.style.transform = `translateY(${Math.min(0, dy)}px)`;
      },
      onEnd: ({ dy, moved }) => {
        const h = el.getBoundingClientRect().height;
        if (moved && commits(Math.max(0, -dy) / h, -velocity / h)) onClose();
        else el.style.transform = '';
      },
    });
  };

  return (
    <div
      ref={root}
      className={styles.nc}
      data-layout={layout}
      data-notification-center=""
      data-closing={closing || undefined}
    >
      {/* A modal surface owns Esc / Tab and its drag (keys reach it from the control inside). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-nc-title"
        className={styles.ncSheet}
        onPointerDown={onPointerDown}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <header className={styles.ncHeader}>
          <h2 id="ios-nc-title" className="sr-only">
            Notification Center
          </h2>
          <p className={styles.ncDate}>
            <time dateTime={now.toISOString().slice(0, 10)}>{statusDate(now)}</time>
          </p>
          <p className={styles.ncClock} aria-hidden="true">
            {statusTime(now)}
          </p>
          <button type="button" className={styles.ncClose} onClick={onClose} data-nc-first="">
            Close
          </button>
        </header>
        {items.length === 0 ? (
          <p className={styles.ncEmpty}>No Older Notifications</p>
        ) : (
          <div className={styles.ncStacks}>
            {[...stacks.entries()].map(([app, list]) => (
              <section key={app} className={styles.ncStack} aria-labelledby={`nc-${app}`}>
                <div className={styles.ncStackHead}>
                  <h3 id={`nc-${app}`}>{app}</h3>
                  <button type="button" data-nc-clear="" onClick={() => clearStack(app)}>
                    Clear<span className="sr-only"> {app} notifications</span>
                  </button>
                </div>
                <ul role="list">
                  {list.map((item) => (
                    <CenterRow key={item.id} item={item} onRun={onRun} onRemove={removeItem} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CenterRow({
  item,
  onRun,
  onRemove,
}: {
  readonly item: CenterItem;
  readonly onRun: (item: CenterItem, origin: HTMLElement) => void;
  readonly onRemove: (id: string) => void;
}) {
  const row = useRef<HTMLButtonElement>(null);
  const [revealed, setRevealed] = useState(false);
  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    const el = row.current;
    if (!el) return;
    drag(el, event.nativeEvent, {
      threshold: 8,
      onMove: (dx, dy) => {
        if (Math.abs(dy) > Math.abs(dx)) return;
        el.style.transform = `translateX(${Math.min(0, dx)}px)`;
      },
      onEnd: ({ dx, moved }) => {
        el.style.transform = '';
        if (moved && dx < -60) setRevealed(true);
      },
    });
  };
  const time = new Date(item.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return (
    // Focus inside the row reveals its Clear button (the swipe alternative).
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <li className={styles.ncItem} data-revealed={revealed || undefined} onFocus={() => setRevealed(true)}>
      <button
        ref={row}
        type="button"
        className={styles.ncCard}
        onPointerDown={onPointerDown}
        onClick={(event) => onRun(item, event.currentTarget)}
      >
        <span className={styles.bannerIcon} aria-hidden="true">
          {item.role ? <AppArt role={item.role} size={38} /> : <Glyph name="bell" size={20} filled />}
        </span>
        <span className={styles.bannerText}>
          <span className={styles.bannerApp}>
            <span>{item.app}</span>
            <span>{time}</span>
          </span>
          <span className={styles.bannerTitle}>{item.title}</span>
          {item.body ? <span className={styles.bannerBody}>{item.body}</span> : null}
        </span>
      </button>
      <button type="button" className={styles.ncClear} onClick={() => onRemove(item.id)}>
        Clear<span className="sr-only">: {item.title}</span>
      </button>
    </li>
  );
}
