'use client';
/**
 * The Notification Center (+ calendar) and Quick Settings — plans/windows/surfaces/notification-center.md
 * (`WIN-NOTIF-03…07`), split from the toasts so the shell's first load stays within budget (shared/10): this chunk
 * loads when a flyout first opens, or earlier in idle time.
 *   · Notification Center (clock): notifications grouped by app with Clear all, and a collapsible month calendar
 *     (a keyboard-navigable `grid`, decorative).
 *   · Quick Settings (network/volume): toggle tiles wired to preferences, a volume slider and a gear to Settings.
 */
import { useRef, useState, type KeyboardEvent } from 'react';
import type { UserPreferences } from '@/lib/kernel/types';
import { dispatchSoon } from '@/stores/kernel-store';
import { usePrefs } from '@/stores/kernel-context';
import { flChevronUp, flDismiss, flSpeaker, flSpeakerMute, flSwap } from '../fluent.generated';
import {
  flAccessibility,
  flChevronDown,
  flDarkTheme,
  flDrop,
  flMoon,
  flPlug,
  flSettings,
} from '../fluent.apps.generated';
import { Fl } from '../icons';
import styles from '../windows.module.css';
import { AppGlyph, type CenterItem } from './Notifications';

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
