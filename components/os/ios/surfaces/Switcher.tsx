'use client';
/**
 * The App Switcher — plans/ios/02 "App Switcher" (`IOS-FLIGHT-04`), 07 (the Handoff card, `IOS-X-02`).
 * A horizontal, scroll-snapping stack of cards, most recent rightmost, each with the app's icon + name above it.
 * Cards are **live**: the shell draws each warm app's real surface into its card's slot (scaled, 38 px corners) and
 * keeps it there while the stack scrolls or a card is dragged; apps no longer warm show their launch screen.
 * Tap a card → that app opens from the card; **swipe a card up** → the app is closed (its instance removed); the ✕ on
 * each card is the alternative; tap outside or Esc → Home. Modal `dialog` + a `ul` of buttons (arrows move, Enter
 * opens, Delete closes). Opened by swipe-up-and-pause, long-pressing the Home indicator, Alt+Shift+O, or the App
 * Switcher module in Control Center.
 */
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { RovingGroup } from '@/components/primitives/RovingGroup';
import { drag } from '@/lib/motion/drag';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { commits, iosBinding, LAUNCH_COLOR, type IosLayout, type IosRole } from '../model';
import type { Visual } from '../motion';
import { Glyph } from '../ui/glyphs';
import { AppArt } from './Icons';
import styles from '../ios.module.css';

export interface SwitcherProps {
  readonly layout: IosLayout;
  /** Oldest → most recent (rightmost). */
  readonly apps: readonly IosRole[];
  /** Apps whose live surface is drawn into their card. */
  readonly live: ReadonlySet<IosRole>;
  readonly current: IosRole | null;
  readonly dark: boolean;
  readonly handoff: { readonly title: string; readonly from: string; readonly role: IosRole } | null;
  readonly closing: boolean;
  /** Where each live card is drawn now (the shell puts the surface there). */
  readonly onFrame: (role: IosRole, visual: Visual) => void;
  readonly onOpen: (role: IosRole, slot: HTMLElement) => void;
  readonly onCloseApp: (role: IosRole) => void;
  readonly onHandoff: (slot: HTMLElement) => void;
  readonly onDismiss: () => void;
  readonly onClosed: () => void;
}

export const CARD_RADIUS = 38;

export function Switcher(props: SwitcherProps) {
  const { layout, apps, live, current, dark, handoff, closing, onFrame, onOpen, onCloseApp, onDismiss, onClosed } =
    props;
  const wrap = useRef<HTMLDivElement>(null);
  /** The scrolling list (the roving group renders it). */
  const list = useCallback(() => wrap.current?.querySelector<HTMLUListElement>('ul') ?? null, []);
  const root = useRef<HTMLDivElement>(null);
  const offsets = useRef(new Map<IosRole, number>());
  const scale = layout === 'phone' ? 0.72 : 0.42;

  /** Report every live card's rect (after layout, on scroll, while dragging). */
  const report = useCallback(() => {
    for (const role of apps) {
      if (!live.has(role)) continue;
      const slot = list()?.querySelector<HTMLElement>(`[data-card-slot="${role}"]`);
      if (!slot) continue;
      const r = slot.getBoundingClientRect();
      const dy = offsets.current.get(role) ?? 0;
      onFrame(role, {
        x: r.left,
        y: r.top + dy,
        w: r.width,
        h: r.height,
        r: CARD_RADIUS,
        o: dy < 0 ? Math.max(0, 1 + dy / 400) : 1,
      });
    }
  }, [apps, live, onFrame, list]);

  // Start at the current app (else the most recent); focus its card.
  useLayoutEffect(() => {
    const el = list();
    if (!el) return;
    const focusRole = current ?? apps[apps.length - 1];
    const card = focusRole ? el.querySelector<HTMLElement>(`[data-card="${focusRole}"]`) : null;
    if (card) {
      el.scrollLeft = Math.max(0, card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2);
      card.focus({ preventScroll: true });
    } else root.current?.querySelector<HTMLElement>('[data-switcher-empty]')?.focus();
    report();
    // Mount only; later changes report through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    report();
  }, [report, apps]);

  useEffect(() => {
    const onResize = () => report();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [report]);

  useEffect(() => {
    if (!closing) return;
    const el = root.current;
    if (!el || typeof el.animate !== 'function') {
      onClosed();
      return;
    }
    const out = el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: prefersReducedMotion() ? 120 : 200,
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

  const swipe = (role: IosRole, event: React.PointerEvent<HTMLElement>) => {
    if (event.button > 0) return;
    const card = event.currentTarget.closest<HTMLElement>('[data-card-item]');
    if (!card) return;
    let velocity = 0;
    let last = { t: performance.now(), y: 0 };
    drag(event.currentTarget, event.nativeEvent, {
      threshold: 10,
      onMove: (dx, dy) => {
        if (Math.abs(dx) > Math.abs(dy)) return;
        const t = performance.now();
        if (t > last.t) velocity = ((dy - last.y) / (t - last.t)) * 1000;
        last = { t, y: dy };
        const y = Math.min(0, dy);
        offsets.current.set(role, y);
        card.style.transform = `translateY(${y}px)`;
        report();
      },
      onEnd: ({ dy, moved }) => {
        const height = card.getBoundingClientRect().height;
        if (moved && commits(Math.max(0, -dy) / height, -velocity / height, 0.35)) {
          card.style.transform = `translateY(${-window.innerHeight}px)`;
          offsets.current.set(role, -window.innerHeight);
          report();
          onCloseApp(role);
          offsets.current.delete(role);
          return;
        }
        offsets.current.delete(role);
        card.style.transform = '';
        report();
      },
    });
  };

  return (
    <div
      ref={root}
      className={styles.switcher}
      data-switcher=""
      data-layout={layout}
      data-closing={closing || undefined}
    >
      <div className={styles.switcherBackdrop} aria-hidden="true" />
      {/* A modal surface owns Esc / Tab and its drag (keys reach it from the control inside). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="App Switcher"
        className={styles.switcherChrome}
        onClick={(event) => {
          // Anywhere but a card (or its ✕) goes Home.
          if (!(event.target as Element).closest('button')) onDismiss();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onDismiss();
          }
          if (event.key === 'Tab') event.preventDefault();
        }}
      >
        {apps.length === 0 && !handoff ? (
          <button type="button" className={styles.switcherEmpty} onClick={onDismiss} data-switcher-empty="">
            No Recent Apps — Home
          </button>
        ) : null}
        <div ref={wrap} className={styles.switcherWrap}>
          <RovingGroup
            as="ul"
            orientation="horizontal"
            role="list"
            className={styles.switcherTrack}
            onScroll={report}
            style={{ ['--card-scale' as string]: scale }}
          >
            {handoff ? (
              <li className={styles.switcherItem} data-card-item="">
                <p className={styles.cardLabel}>
                  <Glyph name="switch" size={18} /> Handoff
                </p>
                <button
                  type="button"
                  className={styles.card}
                  data-roving-item=""
                  data-card="handoff"
                  aria-label={`Handoff: ${handoff.title}, from ${handoff.from}`}
                  onClick={(event) => props.onHandoff(event.currentTarget)}
                  style={{ background: LAUNCH_COLOR[handoff.role][dark ? 'dark' : 'light'] }}
                >
                  <span className={styles.cardPlaceholder}>
                    <AppArt role={handoff.role} size={72} />
                    <span className={styles.cardHandoff}>{handoff.title}</span>
                    <span className={styles.cardHandoffFrom}>From {handoff.from}</span>
                  </span>
                </button>
              </li>
            ) : null}
            {apps.map((role) => {
              const binding = iosBinding(role);
              return (
                <li key={role} className={styles.switcherItem} data-card-item="">
                  <p className={styles.cardLabel} aria-hidden="true">
                    <AppArt role={role} size={26} />
                    {binding.title}
                  </p>
                  <button
                    type="button"
                    className={styles.card}
                    data-roving-item=""
                    data-card={role}
                    data-card-slot={role}
                    data-live={live.has(role) || undefined}
                    aria-label={binding.title}
                    aria-keyshortcuts="Delete"
                    onPointerDown={(event) => swipe(role, event)}
                    onClick={(event) => onOpen(role, event.currentTarget)}
                    onKeyDown={(event) => {
                      if (event.key === 'Delete' || event.key === 'Backspace') {
                        event.preventDefault();
                        onCloseApp(role);
                      }
                    }}
                    style={live.has(role) ? undefined : { background: LAUNCH_COLOR[role][dark ? 'dark' : 'light'] }}
                  >
                    {live.has(role) ? null : (
                      <span className={styles.cardPlaceholder}>
                        <AppArt role={role} size={72} />
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    className={styles.cardClose}
                    aria-label={`Close ${binding.title}`}
                    tabIndex={-1}
                    onClick={() => onCloseApp(role)}
                  >
                    <Glyph name="xmark" size={14} strokeWidth={3} />
                  </button>
                </li>
              );
            })}
          </RovingGroup>
        </div>
      </div>
    </div>
  );
}
