'use client';
/**
 * Banners and the Notification Center (plans/macos/surfaces/notifications.md, `MAC-NOTIF-01…06`).
 *   · one banner at a time, top-right under the menu bar (full width in compact); the queue holds at most 3 (ui.ts);
 *   · dwell ≥ 6 s, paused while hovered or focused; ✕ or a swipe right dismisses; the body runs the primary action;
 *   · in: spring r 0.40 ζ 0.85 from the right; out: 250 ms ease-in; a swipe hands its velocity to the spring;
 *     reduced motion: fades only; banners wait while a window is being dragged;
 *   · banners never take focus — they are announced through the shell's status region (`#system-status`);
 *   · every banner is already in the Notification Center (a non-modal labelled region, opened from the clock): grouped
 *     by app with Clear per group / Clear All, plus a small widget area (date, what Jaswanth is open to, résumé).
 * Transform and opacity only; every animated value is written to the element, never to React state.
 */
import { gsap } from 'gsap';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { getPerson } from '@/data/selectors';
import { drag } from '@/lib/motion/drag';
import { prefersReducedMotion, REDUCED_CROSSFADE_MS } from '@/lib/motion/dur';
import { spring } from '@/lib/motion/spring';
import { useKernel } from '@/stores/kernel-context';
import { announce } from '../announce';
import { XGlyph } from '../glyphs';
import { macBinding } from '../model';
import type { MacNotification } from '../notifications';
import { runMacCommand } from '../run-command';
import { MAC_TIMING } from '../timing';
import { clearCenter, closeOverlay, dismissBanner, returnFocus, useMacUi } from '../ui';
import styles from './notifications.module.css';

/** A swipe past this distance (px) or speed (px/ms) dismisses; otherwise the banner springs back. */
const SWIPE_PX = 80;
const SWIPE_SPEED = 0.5;
const OFFSCREEN = 1.2; // × the banner's width

function AppBadge({ app }: { app: MacNotification['app'] }) {
  if (app === 'system') return <AssetIcon id="system.apple-logo" size={16} />;
  return <AssetIcon id={macBinding(app).icon} size={24} />;
}

const timeLabel = (at: number) => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function Banner({ notification, onGone }: { notification: MacNotification; onGone: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const remaining = useRef<number>(MAC_TIMING.banner.dwellMs);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef(0);
  const holds = useRef(0);
  const motion = useRef<{ stop(): void } | null>(null);
  const leaving = useRef(false);

  // Slide (or fade) in; the spring runs on GSAP's ticker, writing the transform only.
  const springTo = (target: number, velocity: number, done?: () => void) => {
    const el = ref.current;
    if (!el) return;
    motion.current?.stop();
    const width = el.offsetWidth || 344;
    const current = gsap.getProperty(el, 'x') as number;
    const now = performance.now();
    const s = spring(current / width, MAC_TIMING.banner.in, now, velocity / width);
    s.retarget(target, now);
    const tick = () => {
      const t = performance.now();
      gsap.set(el, { x: s.sample(t).value * width });
      if (s.atRest(t)) {
        stop();
        gsap.set(el, { x: target * width });
        done?.();
      }
    };
    const stop = () => gsap.ticker.remove(tick);
    gsap.ticker.add(tick);
    motion.current = { stop };
  };

  const leave = (swipeVelocity?: number) => {
    const el = ref.current;
    if (!el || leaving.current) return;
    leaving.current = true;
    if (timer.current) clearTimeout(timer.current);
    const done = () => onGone(notification.id);
    if (prefersReducedMotion()) {
      motion.current?.stop();
      gsap.to(el, { opacity: 0, duration: REDUCED_CROSSFADE_MS / 1000, ease: 'none', onComplete: done });
      return;
    }
    if (swipeVelocity !== undefined) {
      springTo(OFFSCREEN, swipeVelocity, done);
      return;
    }
    motion.current?.stop();
    gsap.to(el, {
      x: (el.offsetWidth || 344) * OFFSCREEN,
      duration: MAC_TIMING.banner.outMs / 1000,
      ease: 'power2.in',
      onComplete: done,
    });
  };

  const schedule = () => {
    if (timer.current) clearTimeout(timer.current);
    startedAt.current = performance.now();
    timer.current = setTimeout(() => leave(), remaining.current);
  };
  const hold = () => {
    holds.current += 1;
    if (holds.current !== 1 || !timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    remaining.current = Math.max(1000, remaining.current - (performance.now() - startedAt.current));
  };
  const release = () => {
    holds.current = Math.max(0, holds.current - 1);
    if (holds.current === 0 && !leaving.current) schedule();
  };

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    announce(`${notification.appName}: ${notification.title}. ${notification.body}`);
    if (prefersReducedMotion()) {
      gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: REDUCED_CROSSFADE_MS / 1000, ease: 'none' });
    } else {
      gsap.set(el, { x: (el.offsetWidth || 344) * OFFSCREEN });
      springTo(0, 0);
    }
    schedule();
    return () => {
      motion.current?.stop();
      gsap.killTweensOf(el);
      if (timer.current) clearTimeout(timer.current);
    };
    // One banner element per notification.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swipe right to dismiss (pointer + touch); buttons keep their clicks.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || (event.target as Element).closest('button')) return;
      const samples: { x: number; t: number }[] = [];
      let lastDx = 0;
      drag(el, event, {
        threshold: 6,
        onStart: () => {
          motion.current?.stop();
          hold();
        },
        onMove: (dx) => {
          lastDx = Math.max(0, dx);
          samples.push({ x: lastDx, t: performance.now() });
          if (samples.length > 5) samples.shift();
          gsap.set(el, { x: lastDx });
        },
        onEnd: ({ moved }) => {
          if (!moved) return;
          const first = samples[0];
          const last = samples[samples.length - 1];
          const velocity = first && last && last.t > first.t ? (last.x - first.x) / (last.t - first.t) : 0;
          if (lastDx > SWIPE_PX || velocity > SWIPE_SPEED) leave(velocity * 1000);
          else {
            springTo(0, velocity * 1000);
            release();
          }
        },
      });
    };
    // Hovering or focusing the banner pauses its dwell (WCAG 2.2.1); leaving resumes it.
    const lifetime = new AbortController();
    const { signal } = lifetime;
    el.addEventListener('pointerdown', onDown, { signal });
    el.addEventListener('pointerenter', hold, { signal });
    el.addEventListener('pointerleave', release, { signal });
    el.addEventListener('focusin', hold, { signal });
    el.addEventListener('focusout', release, { signal });
    return () => lifetime.abort();
    // Handlers read refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { action, secondary } = notification;
  return (
    // A group of related controls; it never takes focus on its own (MAC-NOTIF-05).
    <div
      ref={ref}
      className={styles.banner}
      role="group"
      aria-label={`${notification.appName} notification`}
      data-banner={notification.id}
    >
      {action ? (
        <button
          type="button"
          className={styles.body}
          onClick={() => {
            runMacCommand(action.command);
            leave();
          }}
        >
          <BannerText notification={notification} />
          <span className="sr-only">. {action.label}</span>
        </button>
      ) : (
        <div className={styles.body}>
          <BannerText notification={notification} />
        </div>
      )}
      <div className={styles.controls}>
        {secondary ? (
          <button
            type="button"
            className={styles.action}
            onClick={() => {
              runMacCommand(secondary.command);
              leave();
            }}
          >
            {secondary.label}
          </button>
        ) : null}
        {action ? (
          <button
            type="button"
            className={styles.action}
            onClick={() => {
              runMacCommand(action.command);
              leave();
            }}
          >
            {action.label}
          </button>
        ) : null}
      </div>
      <button type="button" className={styles.close} aria-label="Dismiss notification" onClick={() => leave()}>
        <XGlyph size={10} />
      </button>
    </div>
  );
}

function BannerText({ notification }: { notification: MacNotification }) {
  return (
    <>
      <span className={styles.icon} aria-hidden="true">
        <AppBadge app={notification.app} />
      </span>
      <span className={styles.text}>
        <span className={styles.appName}>{notification.appName}</span>
        <span className={styles.title}>{notification.title}</span>
        <span className={styles.message}>{notification.body}</span>
      </span>
    </>
  );
}

/** The banner slot: the first queued notification, once no window drag is in progress. */
export function Banners() {
  const first = useMacUi((state) => state.banners[0] ?? null);
  const dragging = useMacUi((state) => state.dragging);
  return (
    <div className={styles.stack} data-banners="">
      {first && !dragging ? <Banner key={first.id} notification={first} onGone={dismissBanner} /> : null}
    </div>
  );
}

// --- Notification Center -------------------------------------------------------------------------------------------

export function NotificationCenter() {
  const open = useMacUi((state) => state.overlay === 'notification-center');
  const center = useMacUi((state) => state.center);
  const compact = useKernel((state) => state.viewport.posture === 'compact');
  const panel = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [now] = useState(() => new Date());
  const person = getPerson();

  // Opening moves focus to the heading (it was the visitor's click); Esc or an outside press closes, focus returns.
  useEffect(() => {
    if (!open) return;
    heading.current?.focus({ preventScroll: true });
    const node = panel.current;
    const close = () => {
      closeOverlay('notification-center');
      returnFocus('notification-center');
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      close();
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (node?.contains(target) || target.closest('[data-clock]')) return;
      closeOverlay('notification-center');
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [open]);

  if (!open) return null;
  const groups = new Map<string, MacNotification[]>();
  for (const item of center) groups.set(item.appName, [...(groups.get(item.appName) ?? []), item]);

  return (
    <section
      ref={panel}
      className={styles.center}
      data-compact={compact || undefined}
      aria-labelledby="mac-nc-title"
      data-notification-center=""
    >
      <div className={styles.centerHead}>
        <h2 id="mac-nc-title" ref={heading} tabIndex={-1} className={styles.centerTitle}>
          Notification Center
        </h2>
        <button
          type="button"
          className={styles.centerClose}
          aria-label="Close Notification Center"
          onClick={() => closeOverlay('notification-center')}
        >
          <XGlyph size={12} />
        </button>
      </div>
      <div className={styles.widgets}>
        <div className={styles.widget}>
          <p className={styles.widgetLabel}>Today</p>
          <p className={styles.widgetValue}>
            <time dateTime={now.toISOString().slice(0, 10)}>
              {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </time>
          </p>
        </div>
        <div className={styles.widget}>
          <p className={styles.widgetLabel}>Status</p>
          <p className={styles.widgetText}>{person.openTo}</p>
        </div>
        <div className={styles.widget}>
          <p className={styles.widgetLabel}>Résumé</p>
          <button
            type="button"
            className={styles.action}
            onClick={() => {
              closeOverlay('notification-center');
              runMacCommand({ kind: 'resume-open' });
            }}
          >
            Open résumé
          </button>
        </div>
      </div>
      <div className={styles.listHead}>
        <h3 className={styles.listTitle}>Notifications</h3>
        {center.length ? (
          <button type="button" className={styles.clear} onClick={() => clearCenter()}>
            Clear All
          </button>
        ) : null}
      </div>
      {center.length === 0 ? (
        <p className={styles.none}>No notifications</p>
      ) : (
        [...groups.entries()].map(([appName, items]) => (
          <div key={appName} className={styles.group}>
            <div className={styles.groupHead}>
              <h4 className={styles.groupTitle}>{appName}</h4>
              <button
                type="button"
                className={styles.clear}
                aria-label={`Clear ${appName} notifications`}
                onClick={() => clearCenter(items[0]!.app)}
              >
                Clear
              </button>
            </div>
            <ul className={styles.items}>
              {items.map((item) => (
                <li key={item.id} className={styles.item}>
                  <span className={styles.icon} aria-hidden="true">
                    <AppBadge app={item.app} />
                  </span>
                  <span className={styles.text}>
                    <span className={styles.title}>{item.title}</span>
                    <span className={styles.message}>{item.body}</span>
                    <time className={styles.time} dateTime={new Date(item.at).toISOString()}>
                      {timeLabel(item.at)}
                    </time>
                  </span>
                  {item.action ? (
                    <button
                      type="button"
                      className={styles.action}
                      onClick={() => {
                        closeOverlay('notification-center');
                        runMacCommand(item.action!.command);
                      }}
                    >
                      {item.action.label}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
