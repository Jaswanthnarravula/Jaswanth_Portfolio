'use client';
/**
 * Status bar and Home indicator — plans/ios/surfaces/status-bar-and-home-indicator.md (`IOS-STAT-01…05`).
 *   · Status bar: phone — the time inside the real safe area (≥ 44 pt), glyphs right; full page — 24 pt across the
 *     whole width with time **and date** ("9:41  Mon 21 Sep"), Wi-Fi + "80%" + battery right. **No notch, cut-out or
 *     bezel is ever drawn.** Colour follows what is under it (`statusStyle`, crossfading 200 ms).
 *     Its zones are real buttons (`group` "Status bar"): the left / centre opens Notification Center, the right third
 *     Control Center; tapping the time inside an app scrolls it to the top (authentic iOS). Pulling down on either zone
 *     reveals its surface with the finger (the shell drives the pull).
 *     Phone landscape: the bar hides; two small grab handles at the top corners keep both entry points.
 *   · Home indicator: a 134 × 5 pt pill (full page `clamp(134px, 12vw, 220px)`), a real `<button>` "Home" with
 *     "Long press for App Switcher": tap = Home, drag up = the interactive Home gesture, long press (500 ms) = App
 *     Switcher. On fine pointers it thickens on hover with a tooltip. The shell owns the gesture; this renders it.
 */
import { useEffect, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { msToNextMinute, statusDate, statusTime, type IosLayout, type StatusStyle } from '../model';
import { Glyph } from '../ui/glyphs';
import styles from '../ios.module.css';

/** The visitor's clock, re-read at each minute boundary (one timer per minute, never a loop). */
export function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(
        () => {
          setNow(new Date());
          schedule();
        },
        msToNextMinute(new Date()) + 50,
      );
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);
  return now;
}

export interface StatusBarProps {
  readonly layout: IosLayout;
  readonly landscape: boolean;
  readonly style: StatusStyle;
  readonly appOpen: boolean;
  readonly centerOpen: boolean;
  readonly controlOpen: boolean;
  readonly onCenter: (from: HTMLElement) => void;
  readonly onControl: (from: HTMLElement) => void;
  readonly onScrollTop: () => void;
  /** A pull-down started on a zone (the shell follows the finger). */
  readonly onPullStart: (zone: 'center' | 'control', event: ReactPointerEvent<HTMLElement>) => void;
}

export function StatusBar({
  layout,
  landscape,
  style,
  appOpen,
  centerOpen,
  controlOpen,
  onCenter,
  onControl,
  onScrollTop,
  onPullStart,
}: StatusBarProps) {
  const now = useClock();
  const handles = layout === 'phone' && landscape;
  const time = statusTime(now);
  const iso = now.toISOString();

  if (handles)
    return (
      <div className={styles.statusHandles} role="group" aria-label="Status bar" data-status-bar="">
        <button
          type="button"
          className={styles.handle}
          data-side="left"
          aria-label="Notification Center"
          aria-expanded={centerOpen}
          aria-haspopup="dialog"
          id="ios-status-center"
          onClick={(event) => onCenter(event.currentTarget)}
          onPointerDown={(event) => onPullStart('center', event)}
        >
          <span aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.handle}
          data-side="right"
          aria-label="Control Center"
          aria-expanded={controlOpen}
          aria-haspopup="dialog"
          id="ios-status-control"
          onClick={(event) => onControl(event.currentTarget)}
          onPointerDown={(event) => onPullStart('control', event)}
        >
          <span aria-hidden="true" />
        </button>
      </div>
    );

  return (
    <div
      className={styles.statusBar}
      role="group"
      aria-label="Status bar"
      data-status-bar=""
      data-style={style}
      data-layout={layout}
    >
      <button
        type="button"
        className={styles.statusCenter}
        aria-label="Notification Center"
        aria-expanded={centerOpen}
        aria-haspopup="dialog"
        id="ios-status-center"
        onClick={(event) => {
          // Inside an app the time scrolls the app to the top (authentic iOS); the rest of the zone opens the Center.
          if (appOpen && (event.target as Element).closest('[data-status-time]')) onScrollTop();
          else onCenter(event.currentTarget);
        }}
        onPointerDown={(event) => onPullStart('center', event)}
      >
        <span className={styles.statusTime} data-status-time="">
          <time dateTime={iso}>{time}</time>
          {layout === 'pad' ? (
            <span className={styles.statusDate}>
              <time dateTime={iso.slice(0, 10)}>{statusDate(now)}</time>
            </span>
          ) : null}
        </span>
      </button>
      <button
        type="button"
        className={styles.statusControl}
        aria-label="Control Center"
        aria-expanded={controlOpen}
        aria-haspopup="dialog"
        id="ios-status-control"
        onClick={(event) => onControl(event.currentTarget)}
        onPointerDown={(event) => onPullStart('control', event)}
      >
        <span className={styles.statusGlyphs} aria-hidden="true">
          {layout === 'phone' ? <Glyph name="signal" size={17} strokeWidth={2.6} /> : null}
          <Glyph name="wifi" size={17} strokeWidth={2.4} />
          {layout === 'pad' ? <span className={styles.battText}>80%</span> : null}
          <span className={styles.battery}>
            <span />
          </span>
        </span>
      </button>
    </div>
  );
}

export interface HomeIndicatorProps {
  readonly style: StatusStyle;
  readonly layout: IosLayout;
  readonly buttonRef: RefObject<HTMLButtonElement | null>;
  readonly onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  readonly onActivate: () => void;
  readonly hidden?: boolean;
}

/** The Home indicator: a real button; the shell handles its press, drag and long press (`IOS-STAT-03`). */
export function HomeIndicator({ style, layout, buttonRef, onPointerDown, onActivate, hidden }: HomeIndicatorProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      id="ios-home-indicator"
      className={styles.homeIndicator}
      data-style={style}
      data-layout={layout}
      data-home-indicator=""
      aria-label="Home"
      aria-describedby="ios-home-hint"
      title="Home · hold for App Switcher"
      hidden={hidden}
      onPointerDown={onPointerDown}
      // Assistive tech activates with a synthetic click (no pointer events): that is a tap on Home.
      onClick={(event) => {
        if (event.detail === 0) onActivate();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onActivate();
        }
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span aria-hidden="true" />
      <span id="ios-home-hint" hidden>
        Long press for App Switcher
      </span>
    </button>
  );
}
