'use client';
/**
 * The taskbar — plans/windows/surfaces/taskbar.md (`WIN-TASK-01…09`), the anchor of the whole OS. Full width, 48 px,
 * Acrylic, a 1 px top stroke; the centred group: Start · Search · Task View ‖ pinned apps ‖ the pinned Résumé.pdf;
 * the tray on the right (overflow chevron · network + volume = Quick Settings · clock + date = Notification Center)
 * and the 12 px Show desktop sliver.
 *   · app buttons are real links (`/windows/{slug}`) whose plain click runs the decision table (`WIN-WM-08`): open ·
 *     restore · focus · minimize when already active; indicator pills (none / 6 px grey / 16 px accent / pulsing)
 *     change by `scaleX` only;
 *   · hover 400 ms (fine pointer) → a thumbnail card per window with ✕; hovering the card peeks the window;
 *   · right-click / long-press / Shift+F10 → the jump list;
 *   · one tab stop, Left/Right/Home/End (`RovingGroup`), Down opens the preview; names carry ", running" /
 *     ", active, press to minimize"; the active app is `aria-current`; the clock is a `<time>`, never live.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { usePress } from '@/components/primitives/Press';
import { RovingGroup } from '@/components/primitives/RovingGroup';
import { hrefFor } from '@/components/shell/KernelLink';
import { AssetIcon } from '@/components/ui/AssetIcon';
import type { AppRole } from '@/lib/kernel/ids';
import { currentLocation } from '@/lib/kernel/state';
import { focusKeys, type OsSession, type WindowId, type WindowInstance } from '@/lib/kernel/types';
import { useKernel, usePrefs } from '@/stores/kernel-context';
import { dispatch, getKernel } from '@/stores/kernel-store';
import { flChevronUp, flDismiss, flSearch, flSpeaker, flSpeakerMute, flTaskView, flWifi } from '../fluent.generated';
import { prefetchApp } from '../apps/AppBody';
import { Fl, PdfFile } from '../icons';
import {
  jumpList,
  pillFor,
  pillSuffix,
  RESUME_BUTTON_ID,
  taskbarActions,
  taskbarApps,
  taskbarButtonId,
  winBinding,
  winId,
  windowLabel,
  type Panel,
} from '../model';
import { pressPulse } from '../motion';
import { useWinShell } from '../shell-context';
import { warmSurface } from './lazy';
import styles from '../windows.module.css';

/** Hover intent before the thumbnail preview (plans/windows/surfaces/taskbar). */
export const PREVIEW_DELAY_MS = 400;

const isPlainClick = (event: MouseEvent) =>
  !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

function useClock(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const date = new Date();
      setNow(date);
      timer = setTimeout(tick, 60_000 - (date.getSeconds() * 1000 + date.getMilliseconds()) + 20);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);
  return now;
}

export const clockTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
export const clockDate = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });

export function Taskbar({
  panel,
  compact,
  touch,
  align,
  attention,
  failed,
  acrylic,
  shimmer = false,
  onPanel,
  onShowDesktop,
  onPeek,
}: {
  readonly panel: Panel | null;
  readonly compact: boolean;
  readonly touch: boolean;
  readonly align: 'center' | 'left';
  /** Apps whose pill pulses (a toast from them is showing). */
  readonly attention: ReadonlySet<AppRole>;
  /** Apps whose chunk failed to load (tooltip "Couldn't open — try again"). */
  readonly failed: ReadonlySet<AppRole>;
  readonly acrylic: 'live' | 'tint';
  /** The Konami egg's accent shimmer across the taskbar (shared/21 `EGG-KONAMI-01`). */
  readonly shimmer?: boolean;
  readonly onPanel: (panel: Panel, invoker: HTMLElement) => void;
  readonly onShowDesktop: () => void;
  readonly onPeek: (id: WindowId | null) => void;
}) {
  const session = useKernel((state) => state.sessions.windows);
  const sound = usePrefs((prefs) => prefs.sound);
  const now = useClock();
  const apps = taskbarApps(session);

  const toggle = (which: Panel) => (event: MouseEvent<HTMLButtonElement>) => onPanel(which, event.currentTarget);

  return (
    <nav
      className={styles.taskbar}
      aria-label="Taskbar"
      data-taskbar=""
      data-align={align}
      data-acrylic={acrylic}
      data-shimmer={shimmer || undefined}
    >
      <RovingGroup as="ul" orientation="horizontal" role="list" className={styles.taskbarList} data-taskbar-list="">
        <li className={styles.tbItem}>
          <button
            type="button"
            id="tb-start"
            className={styles.tbButton}
            data-roving-item=""
            data-pressed={panel === 'start' || undefined}
            aria-label="Start"
            aria-haspopup="dialog"
            aria-expanded={panel === 'start'}
            onPointerEnter={() => warmSurface('launcher')}
            onFocus={() => warmSurface('launcher')}
            onClick={toggle('start')}
          >
            <AssetIcon id="system.windows-logo" size={24} priority className={styles.tbGlyph} />
          </button>
        </li>
        <li className={styles.tbItem}>
          <button
            type="button"
            id="tb-search"
            className={styles.tbButton}
            data-roving-item=""
            data-pressed={panel === 'search' || undefined}
            aria-label="Search"
            aria-haspopup="dialog"
            aria-expanded={panel === 'search'}
            onPointerEnter={() => warmSurface('launcher')}
            onFocus={() => warmSurface('launcher')}
            onClick={toggle('search')}
          >
            <Fl icon={flSearch} size={22} className={styles.tbGlyph} />
          </button>
        </li>
        <li className={styles.tbItem}>
          <button
            type="button"
            id="tb-taskview"
            className={styles.tbButton}
            data-roving-item=""
            data-pressed={panel === 'taskview' || undefined}
            aria-label="Task View"
            aria-haspopup="dialog"
            aria-expanded={panel === 'taskview'}
            onPointerEnter={() => warmSurface('taskView')}
            onFocus={() => warmSurface('taskView')}
            onClick={toggle('taskview')}
          >
            <Fl icon={flTaskView} size={22} className={styles.tbGlyph} />
          </button>
        </li>
        {compact ? <ResumeButton compact /> : null}
        {apps.map((role) => (
          <TaskbarApp
            key={role}
            role={role}
            session={session}
            touch={touch}
            compact={compact}
            attention={attention.has(role)}
            failed={failed.has(role)}
            onPeek={onPeek}
          />
        ))}
        {compact ? null : <ResumeButton compact={false} />}
      </RovingGroup>

      <div className={styles.tray} role="group" aria-label="System tray">
        {compact ? (
          <button
            type="button"
            id="tb-tray"
            className={styles.trayButton}
            aria-label="Quick Settings and notifications"
            aria-haspopup="dialog"
            aria-expanded={panel === 'combined'}
            data-pressed={panel === 'combined' || undefined}
            onClick={toggle('combined')}
          >
            <Fl icon={flWifi} size={16} />
            <Fl icon={sound.enabled ? flSpeaker : flSpeakerMute} size={16} />
          </button>
        ) : (
          <>
            <OverflowChevron />
            <button
              type="button"
              id="tb-quick"
              className={styles.trayButton}
              aria-label={`Quick Settings, sound ${sound.enabled ? 'on' : 'off'}`}
              aria-haspopup="dialog"
              aria-expanded={panel === 'quick'}
              data-pressed={panel === 'quick' || undefined}
              onClick={toggle('quick')}
            >
              <Fl icon={flWifi} size={16} />
              <Fl icon={sound.enabled ? flSpeaker : flSpeakerMute} size={16} />
            </button>
            <button
              type="button"
              id="tb-clock"
              className={`${styles.trayButton} ${styles.clock}`}
              aria-label={now ? `Notification Center, ${clockTime(now)}, ${clockDate(now)}` : 'Notification Center'}
              aria-haspopup="dialog"
              aria-expanded={panel === 'center'}
              data-pressed={panel === 'center' || undefined}
              onClick={toggle('center')}
            >
              {now ? (
                <>
                  <time dateTime={now.toISOString()}>{clockTime(now)}</time>
                  <time dateTime={now.toISOString().slice(0, 10)}>{clockDate(now)}</time>
                </>
              ) : null}
            </button>
            <button
              type="button"
              className={styles.showDesktop}
              aria-label="Show desktop"
              title="Show desktop"
              data-show-desktop=""
              onClick={onShowDesktop}
            />
          </>
        )}
      </div>
    </nav>
  );
}

/** The pinned Résumé.pdf (shared/14 `RES-IDIOM-01`): opens the PDF tab in Edge; its jump list offers Open · Download. */
function ResumeButton({ compact }: { readonly compact: boolean }) {
  const shell = useWinShell();
  const link = useRef<HTMLAnchorElement>(null);
  const openJumpList = (point: { x: number; y: number }) =>
    shell.openMenu({
      label: 'Résumé.pdf jump list',
      at: { x: point.x, y: point.y },
      returnFocusTo: link.current,
      items: [
        { kind: 'heading', id: 'h', label: 'Résumé.pdf' },
        {
          kind: 'item',
          id: 'open',
          label: 'Open',
          onSelect: () =>
            dispatch({
              type: 'OPEN_APP',
              os: 'windows',
              role: 'browser',
              location: { kind: 'content', ref: { section: 'resume' } },
              originId: RESUME_BUTTON_ID,
            }),
        },
        {
          kind: 'item',
          id: 'download',
          label: 'Download',
          onSelect: () => document.querySelector<HTMLAnchorElement>('[data-resume-download]')?.click(),
        },
        { kind: 'separator', id: 's' },
        { kind: 'item', id: 'unpin', label: 'Unpin from taskbar', disabled: true, onSelect: () => undefined },
      ],
    });
  const press = usePress({
    onLongPress: (origin, point) => {
      const box = link.current?.getBoundingClientRect();
      openJumpList(origin === 'keyboard' || !box ? { x: box?.left ?? point.x, y: box?.top ?? point.y } : point);
    },
  });
  return (
    <li className={styles.tbItem} data-running="true" data-pinned-resume="">
      <a
        ref={link}
        id={RESUME_BUTTON_ID}
        href={hrefFor({ os: 'windows', ref: { section: 'resume' } })}
        className={styles.tbButton}
        data-roving-item=""
        aria-label="Résumé (PDF)"
        title="Résumé.pdf"
        onPointerDown={press.onPointerDown}
        onPointerMove={press.onPointerMove}
        onPointerUp={press.onPointerUp}
        onPointerCancel={press.onPointerCancel}
        onContextMenu={press.onContextMenu}
        onClick={(event) => {
          press.onClick(event);
          if (!isPlainClick(event)) return;
          event.preventDefault();
          pressPulse(event.currentTarget.firstElementChild ?? event.currentTarget);
          dispatch({
            type: 'OPEN_APP',
            os: 'windows',
            role: 'browser',
            location: { kind: 'content', ref: { section: 'resume' } },
            originId: RESUME_BUTTON_ID,
            invoker: RESUME_BUTTON_ID,
          });
        }}
      >
        <span className={styles.tbIcon} aria-hidden="true">
          <PdfFile size={24} />
        </span>
        {compact ? null : <span className={styles.srOnlyHint} aria-hidden="true" />}
      </a>
    </li>
  );
}

function OverflowChevron() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent | globalThis.KeyboardEvent) => {
      if ('key' in event && event.key !== 'Escape') return;
      if ('key' in event) button.current?.focus({ preventScroll: true });
      else if (button.current?.parentElement?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  return (
    <span className={styles.overflow}>
      <button
        ref={button}
        type="button"
        className={styles.trayButton}
        aria-label="Show hidden icons"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Fl icon={flChevronUp} size={14} />
      </button>
      {open ? (
        <span className={styles.overflowFlyout} role="status">
          No hidden icons
        </span>
      ) : null}
    </span>
  );
}

function TaskbarApp({
  role,
  session,
  touch,
  compact,
  attention,
  failed,
  onPeek,
}: {
  readonly role: AppRole;
  readonly session: OsSession;
  readonly touch: boolean;
  readonly compact: boolean;
  readonly attention: boolean;
  readonly failed: boolean;
  readonly onPeek: (id: WindowId | null) => void;
}) {
  const shell = useWinShell();
  const binding = winBinding(role);
  const windowInstance: WindowInstance | undefined = session.windows[winId(role)];
  const pill = pillFor(session, role);
  const minimized = windowInstance?.phase.s === 'minimized';
  const id = taskbarButtonId(role);
  const link = useRef<HTMLAnchorElement>(null);
  const [preview, setPreview] = useState<'hover' | 'keyboard' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = pill !== 'none';

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);
  // The window closed while its card showed: the card goes, and the flyout with it (plans/windows/06 E10); the shell
  // drops a peek whose window is gone.
  const showPreview = preview !== null && running && !compact;

  const openJumpList = (point: { x: number; y: number }) => {
    const list = jumpList(role);
    shell.openMenu({
      label: `${binding.title} jump list`,
      at: point,
      returnFocusTo: link.current,
      items: [
        { kind: 'heading', id: 'heading', label: list.heading },
        ...list.items.map((item) => ({
          kind: 'item' as const,
          id: item.id,
          label: item.label,
          onSelect: () => {
            const to = item.to;
            if ('ref' in to)
              dispatch({
                type: 'OPEN_APP',
                os: 'windows',
                role,
                location: { kind: 'content', ref: to.ref },
                originId: id,
              });
            else dispatch({ type: 'OPEN_APP', os: 'windows', role: to.role, location: to.location, originId: id });
          },
        })),
        { kind: 'separator', id: 'sep' },
        { kind: 'item', id: 'app', label: binding.title, onSelect: () => link.current?.click() },
        { kind: 'item', id: 'pin', label: 'Unpin from taskbar', disabled: true, onSelect: () => undefined },
        ...(running
          ? [
              {
                kind: 'item' as const,
                id: 'close',
                label: 'Close window',
                onSelect: () => dispatch({ type: 'CLOSE_WINDOW', id: winId(role) }),
              },
            ]
          : []),
      ],
    });
  };
  const press = usePress({
    onLongPress: (origin, point) => {
      clear();
      setPreview(null);
      const box = link.current?.getBoundingClientRect();
      openJumpList(origin === 'keyboard' || !box ? { x: box?.left ?? point.x, y: (box?.top ?? point.y) - 8 } : point);
    },
  });

  const onKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key === 'ArrowDown' && running && !compact) {
      event.preventDefault();
      setPreview('keyboard');
      setTimeout(() => link.current?.parentElement?.querySelector<HTMLElement>('[data-preview-card]')?.focus(), 0);
    }
  };

  const label = `${binding.title}${pillSuffix(pill, minimized)}`;

  return (
    <li
      className={styles.tbItem}
      data-running={running ? 'true' : 'false'}
      onPointerEnter={(event) => {
        prefetchApp(role);
        if (event.pointerType !== 'mouse' || touch || !running || compact) return;
        clear();
        timer.current = setTimeout(() => setPreview('hover'), PREVIEW_DELAY_MS);
      }}
      onPointerLeave={() => {
        clear();
        if (preview === 'hover') {
          setPreview(null);
          onPeek(null);
        }
      }}
    >
      <a
        ref={link}
        id={id}
        href={hrefFor(
          windowInstance ? { os: 'windows', role, location: currentLocation(windowInstance) } : { os: 'windows', role },
        )}
        className={styles.tbButton}
        data-roving-item=""
        data-focus-key={focusKeys.launcher('windows', role)}
        data-pill={pill}
        data-launching={windowInstance?.phase.s === 'opening' || undefined}
        aria-current={pill === 'active' ? 'true' : undefined}
        aria-label={label}
        title={failed ? "Couldn't open — try again" : undefined}
        onPointerDown={press.onPointerDown}
        onPointerMove={press.onPointerMove}
        onPointerUp={press.onPointerUp}
        onPointerCancel={press.onPointerCancel}
        onContextMenu={press.onContextMenu}
        onKeyDown={onKeyDown}
        onFocus={() => prefetchApp(role)}
        onClick={(event) => {
          press.onClick(event);
          if (!isPlainClick(event)) return;
          event.preventDefault();
          clear();
          setPreview(null);
          onPeek(null);
          pressPulse(event.currentTarget.firstElementChild ?? event.currentTarget);
          for (const action of taskbarActions(getKernel().sessions.windows, role, {
            originId: id,
            invoker: focusKeys.launcher('windows', role),
          }))
            dispatch(action);
        }}
      >
        <span className={styles.tbIcon} aria-hidden="true">
          <AssetIcon id={binding.icon} size={24} priority />
        </span>
        <span className={styles.pill} data-pill={pill} data-attention={attention || undefined} aria-hidden="true" />
      </a>
      {showPreview && windowInstance ? (
        <div className={styles.preview} role="list" aria-label={`${binding.title} windows`} data-acrylic="tint">
          <div role="listitem" className={styles.previewItem}>
            <button
              type="button"
              className={styles.previewCard}
              data-preview-card=""
              onPointerEnter={() => onPeek(windowInstance.id)}
              onPointerLeave={() => onPeek(null)}
              onFocus={() => onPeek(windowInstance.id)}
              onBlur={() => onPeek(null)}
              onClick={() => {
                setPreview(null);
                onPeek(null);
                dispatch(
                  windowInstance.phase.s === 'minimized'
                    ? { type: 'RESTORE', id: windowInstance.id }
                    : { type: 'FOCUS_WINDOW', id: windowInstance.id },
                );
              }}
              onKeyDown={(event) => {
                if (event.key === 'Delete') {
                  event.preventDefault();
                  dispatch({ type: 'CLOSE_WINDOW', id: windowInstance.id });
                } else if (event.key === 'Escape' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  setPreview(null);
                  onPeek(null);
                  link.current?.focus();
                }
              }}
            >
              <span className={styles.previewHead}>
                <AssetIcon id={binding.icon} size={16} />
                <span className={styles.previewTitle}>{windowLabel(windowInstance)}</span>
              </span>
              <span className={styles.previewThumb} aria-hidden="true">
                <AssetIcon id={binding.icon} size={40} />
                <span>{windowLabel(windowInstance).split(' — ')[1] ?? binding.title}</span>
              </span>
            </button>
            <button
              type="button"
              className={styles.previewClose}
              aria-label={`Close ${windowLabel(windowInstance)}`}
              onClick={() => {
                onPeek(null);
                dispatch({ type: 'CLOSE_WINDOW', id: windowInstance.id });
              }}
            >
              <Fl icon={flDismiss} size={14} />
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
