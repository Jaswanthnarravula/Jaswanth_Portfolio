'use client';
/**
 * The Lock Screen — plans/ios/surfaces/lock-screen.md (`IOS-LOCK-01…05`). A one-time welcome on the first chooser
 * entry of a session (never on a deep link, refresh, `/go` or re-entry — the shell decides), identical for every
 * visitor (no profile input). The sharp wallpaper, the date line over a **large clock** (`<time>`, not live), an
 * "Open to work" pill, the notification stack **anchored to the bottom** (each a shortcut straight into its app — it
 * unlocks and the app flies out from the notification's rect) above two round quick buttons — Résumé (left) and
 * Contact (right) — and the Home indicator with "Swipe up to open".
 * Unlock: swipe up (interactive 1:1, decided by projected position — drag up then back down stays locked) · tap the
 * Home indicator · any key · the explicit "Open iOS" button (focus starts there). A notification swiped left reveals
 * "Clear" (also revealed on focus); it stays in Notification Center. No passcode (it is not a gate).
 */
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { hrefFor } from '@/components/shell/KernelLink';
import type { ContentRef } from '@/data/schema';
import { drag } from '@/lib/motion/drag';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { commits, statusTime, type IosLayout, type LockNotification } from '../model';
import { IOS_SPRINGS, springSamples } from '../motion';
import { Glyph } from '../ui/glyphs';
import { AppArt } from './Icons';
import styles from '../ios.module.css';

const isPlainClick = (event: MouseEvent) =>
  !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

export interface LockScreenProps {
  readonly layout: IosLayout;
  readonly landscape: boolean;
  readonly heading: string;
  readonly openTo: string;
  readonly notifications: readonly LockNotification[];
  readonly onUnlock: () => void;
  readonly onNotification: (notification: LockNotification, origin: HTMLElement) => void;
  readonly onQuick: (ref: ContentRef, origin: HTMLElement) => void;
  readonly onClear: (id: string) => void;
}

const LONG_DATE = (date: Date) => date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

export function LockScreen(props: LockScreenProps) {
  const { layout, landscape, heading, openTo, notifications, onUnlock } = props;
  const root = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [now] = useState(() => new Date());
  const leaving = useRef(false);

  // Focus starts on the explicit Open button.
  useLayoutEffect(() => {
    root.current?.querySelector<HTMLElement>('[data-lock-open]')?.focus({ preventScroll: true });
  }, []);

  /** Slide the lock up and fade it (spring r 0.45 ζ 0.9, inheriting the finger's velocity), then unlock. */
  const unlock = (fromY = 0, velocity = 0, then?: () => void) => {
    if (leaving.current) return;
    leaving.current = true;
    const el = content.current;
    const done = () => {
      onUnlock();
      then?.();
    };
    if (!el || typeof el.animate !== 'function') {
      done();
      return;
    }
    if (prefersReducedMotion()) {
      const fade = root.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' });
      if (fade) fade.onfinish = done;
      else done();
      return;
    }
    const height = window.innerHeight;
    const { values, durationMs } = springSamples(IOS_SPRINGS.unlock, 14);
    void velocity;
    const slide = el.animate(
      values.map((v) => ({ transform: `translateY(${fromY + (-height - fromY) * v}px)`, opacity: 1 - v })),
      { duration: Math.min(durationMs, 520), fill: 'forwards' },
    );
    root.current?.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: Math.min(durationMs, 520),
      fill: 'forwards',
      easing: 'ease-in',
    });
    slide.onfinish = done;
    slide.oncancel = done;
  };

  // Any key unlocks (Tab and modifiers move / do nothing; Enter on a focused control does its own thing).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (['Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
      const target = event.target as Element | null;
      if (target?.closest('[data-lock] a, [data-lock] button') && (event.key === 'Enter' || event.key === ' ')) return;
      if (
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight' ||
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown'
      )
        return;
      event.preventDefault();
      unlock();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // Bound once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swipe up anywhere on the lock (not on a notification being swiped sideways): 1:1, projected.
  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button > 0 || (event.target as Element).closest('a, button:not([data-lock-indicator])')) return;
    const el = content.current;
    if (!el) return;
    let velocity = 0;
    let last = { t: performance.now(), y: 0 };
    drag(root.current!, event.nativeEvent, {
      threshold: 6,
      onMove: (_dx, dy) => {
        const t = performance.now();
        if (t > last.t) velocity = ((dy - last.y) / (t - last.t)) * 1000;
        last = { t, y: dy };
        el.style.transform = `translateY(${Math.min(0, dy)}px)`;
        el.style.opacity = String(Math.max(0.2, 1 + Math.min(0, dy) / 500));
      },
      onEnd: ({ dy, moved }) => {
        const height = window.innerHeight;
        if (moved && commits(Math.max(0, -dy) / height, -velocity / height, 0.3)) {
          el.style.opacity = '';
          const y = Math.min(0, dy);
          el.style.transform = '';
          unlock(y, velocity);
          return;
        }
        // Not far enough (or dragged back down): stays locked.
        el.style.opacity = '';
        const from = el.style.transform;
        el.style.transform = '';
        if (from)
          el.animate?.([{ transform: from }, { transform: 'translateY(0)' }], { duration: 260, easing: 'ease-out' });
        if (!moved && (event.target as Element).closest('[data-lock-indicator]')) unlock();
      },
    });
  };

  return (
    <main
      ref={root}
      className={styles.lock}
      data-lock=""
      data-layout={layout}
      data-landscape={landscape || undefined}
      aria-labelledby="ios-lock-heading"
      onPointerDown={onPointerDown}
    >
      <div className={styles.lockWallpaper} aria-hidden="true" />
      <div ref={content} className={styles.lockContent}>
        <h1 id="ios-lock-heading" className="sr-only">
          {heading}
        </h1>
        <div className={styles.lockClockBlock}>
          <p className={styles.lockDate}>
            <time dateTime={now.toISOString().slice(0, 10)}>{LONG_DATE(now)}</time>
          </p>
          <p className={styles.lockClock}>
            <time dateTime={now.toISOString()}>{statusTime(now)}</time>
          </p>
          <p className={styles.lockPill}>
            <span className={styles.lockDot} aria-hidden="true" /> {openTo}
          </p>
        </div>
        <div className={styles.lockBottom}>
          <ul className={styles.lockNotifications} role="list" aria-label="Notifications">
            {notifications.map((notification) => (
              <LockRow
                key={notification.id}
                notification={notification}
                onClear={props.onClear}
                onOpen={(origin) => unlock(0, 0, () => props.onNotification(notification, origin))}
              />
            ))}
          </ul>
          <div className={styles.lockQuick}>
            <a
              href={hrefFor({ os: 'ios', ref: { section: 'resume' } })}
              className={styles.lockRound}
              aria-label="Résumé"
              onClick={(event) => {
                if (!isPlainClick(event)) return;
                event.preventDefault();
                const origin = event.currentTarget;
                unlock(0, 0, () => props.onQuick({ section: 'resume' }, origin));
              }}
            >
              <Glyph name="doc" size={24} />
            </a>
            <button type="button" className={styles.lockOpen} data-lock-open="" onClick={() => unlock()}>
              Open iOS
            </button>
            <a
              href={hrefFor({ os: 'ios', ref: { section: 'contact' } })}
              className={styles.lockRound}
              aria-label="Contact"
              onClick={(event) => {
                if (!isPlainClick(event)) return;
                event.preventDefault();
                const origin = event.currentTarget;
                unlock(0, 0, () => props.onQuick({ section: 'contact' }, origin));
              }}
            >
              <Glyph name="envelope" size={24} />
            </a>
          </div>
          <button
            type="button"
            className={styles.lockIndicator}
            data-lock-indicator=""
            onClick={() => unlock()}
            tabIndex={-1}
          >
            <span className={styles.lockHint}>Swipe up to open</span>
            <span className={styles.lockBar} aria-hidden="true" />
          </button>
        </div>
      </div>
    </main>
  );
}

function LockRow({
  notification,
  onOpen,
  onClear,
}: {
  readonly notification: LockNotification;
  readonly onOpen: (origin: HTMLElement) => void;
  readonly onClear: (id: string) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const target = notification.location?.kind === 'content' ? notification.location.ref : null;
  const href = target ? hrefFor({ os: 'ios', ref: target }) : hrefFor({ os: 'ios', role: notification.role });
  const onRowDown = (event: React.PointerEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    const el = event.currentTarget;
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
  return (
    // Focus inside the row reveals its Clear button (the swipe alternative).
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <li className={styles.lockItem} data-revealed={revealed || undefined} onFocus={() => setRevealed(true)}>
      <a
        href={href}
        className={styles.lockCard}
        data-lock-notification={notification.id}
        aria-label={`${notification.app}: ${notification.title}. ${notification.body}`}
        onPointerDown={onRowDown}
        onClick={(event) => {
          if (!isPlainClick(event)) return;
          event.preventDefault();
          onOpen(event.currentTarget);
        }}
      >
        <span className={styles.bannerIcon} aria-hidden="true">
          <AppArt role={notification.role} size={38} />
        </span>
        <span className={styles.bannerText}>
          <span className={styles.bannerApp}>
            <span>{notification.app}</span>
            <span>now</span>
          </span>
          <span className={styles.bannerTitle}>{notification.title}</span>
          <span className={styles.bannerBody}>{notification.body}</span>
        </span>
      </a>
      <button type="button" className={styles.lockClear} onClick={() => onClear(notification.id)}>
        Clear<span className="sr-only">: {notification.title}</span>
      </button>
    </li>
  );
}
