'use client';
/**
 * Task View — plans/windows/surfaces/task-view.md (`WIN-TV-01…05`): the window overview and the compact switcher.
 *   · An Acrylic full-workspace backdrop (one live blur surface; the wallpaper dims) behind the windows; the live
 *     windows themselves fly into a centred, non-overlapping grid (the packing function shared with macOS Mission
 *     Control — `components/os/shared/overview-pack.ts`); minimized windows are **included** (as cards at their restore
 *     size's aspect); the title + app icon sit **above** each tile with a ✕; the taskbar stays visible.
 *   · Choose a tile (click / Enter) → focus (restoring a minimized window) and everything flies back; ✕ or Delete
 *     closes that window and the grid re-packs (167 ms); Esc or the empty backdrop exits with the previous focus. Two
 *     windows snapped ½ + ½ are one grouped pair: choosing either restores both.
 *   · A desktops strip shows "Desktop 1" and a disabled "New desktop" that explains itself.
 *   · compact: a vertical list of large cards with ✕ buttons — the window switcher.
 * A modal `dialog` "Task View"; the windows are `inert` while it shows. Enter 333 ms, exit 250 ms, reversible.
 */
import { gsap } from 'gsap';
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { packOverview, type PackedTile } from '@/components/os/shared/overview-pack';
import { FocusScope } from '@/components/primitives/FocusScope';
import { RovingGroup } from '@/components/primitives/RovingGroup';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { cubicBezier } from '@/lib/motion/bezier';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { isFocusable } from '@/lib/kernel/state';
import type { WindowId, WindowInstance } from '@/lib/kernel/types';
import { useKernel } from '@/stores/kernel-context';
import { dispatchSoon, flushQueued, getKernel } from '@/stores/kernel-store';
import { flAdd, flDismiss } from '../fluent.generated';
import { Fl, PdfFile } from '../icons';
import { shownRect, winBinding, windowLabel, winWorkspace } from '../model';
import { WIN_CURVES, WIN_MOTION } from '../motion';
import styles from '../windows.module.css';

const LABEL = 32;
const GAP = 32;
const STRIP = 112;

const ease = (curve: keyof typeof WIN_CURVES) => {
  const [a, b, c, d] = WIN_CURVES[curve];
  return cubicBezier(a, b, c, d);
};

/** The windows Task View shows, in open order (minimized included, closing excluded). */
export function overviewWindows(
  windows: Readonly<Partial<Record<WindowId, WindowInstance>>>,
): readonly WindowInstance[] {
  return Object.values(windows).filter((window): window is WindowInstance => !!window && window.phase.s !== 'closing');
}

/** A ½ + ½ snapped pair: choosing either restores both. */
export function snapPartner(window: WindowInstance, all: readonly WindowInstance[]): WindowInstance | null {
  const zone = window.snap?.zone;
  if (zone !== 'left' && zone !== 'right') return null;
  return (
    all.find((other) => other.id !== window.id && other.snap?.zone === (zone === 'left' ? 'right' : 'left')) ?? null
  );
}

export function TaskView({
  compact,
  closing,
  live,
  onDone,
}: {
  readonly compact: boolean;
  /** The exit is playing (the shell unmounts after it). */
  readonly closing: boolean;
  readonly live: boolean;
  /** Leave Task View (Esc, backdrop, a choice). */
  readonly onDone: () => void;
}) {
  const windowsMap = useKernel((state) => state.sessions.windows.windows);
  const focused = useKernel((state) => state.sessions.windows.focused);
  const viewport = useKernel((state) => state.viewport);
  const learned = useKernel((state) => state.learnedRects);
  const windows = overviewWindows(windowsMap);
  const workspace = winWorkspace(viewport);
  const area = {
    x: workspace.x + 48,
    y: workspace.y + 48 + LABEL,
    w: workspace.w - 96,
    h: workspace.h - 96 - LABEL - STRIP,
  };
  const packing = packOverview(
    windows.map((window) => ({ id: window.id, rect: shownRect(window, viewport, learned[window.id]) })),
    { area, gap: GAP, label: LABEL, minWidth: 160 },
  );
  const tiles = new Map<string, PackedTile>(packing.tiles.map((tile) => [tile.id, tile]));
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const first = useRef(true);

  // Fly the live windows into their tiles (enter 333 ms) and back out on exit (250 ms); re-pack on close (167 ms).
  // The tiles as one comparable key: the effect re-runs when a tile moves or rescales, not on every render.
  const tileLayout = packing.tiles
    .map((tile) => `${tile.id}:${Math.round(tile.x)}:${Math.round(tile.y)}:${tile.scale.toFixed(3)}`)
    .join('|');
  useLayoutEffect(() => {
    if (compact) return;
    const reduced = prefersReducedMotion();
    const entering = first.current;
    first.current = false;
    timeline.current?.kill();
    const tl = gsap.timeline();
    for (const window of windows) {
      if (window.phase.s === 'minimized') continue;
      const el = document.querySelector<HTMLElement>(`[data-window="${window.id}"]`);
      const tile = tiles.get(window.id);
      if (!el || !tile) continue;
      const rect = shownRect(window, viewport, learned[window.id]);
      const target = closing ? { x: 0, y: 0, scale: 1 } : { x: tile.x - rect.x, y: tile.y - rect.y, scale: tile.scale };
      gsap.set(el, { transformOrigin: '0 0' });
      tl.to(
        el,
        {
          ...target,
          duration: reduced
            ? 0
            : (closing ? WIN_MOTION.taskViewOut.ms : entering ? WIN_MOTION.taskViewIn.ms : 167) / 1000,
          ease: ease(closing ? 'exit' : 'entrance'),
          clearProps: closing ? 'transform,transformOrigin' : undefined,
          overwrite: true,
        },
        0,
      );
    }
    timeline.current = tl;
    // Tiles follow the window set and the viewport; the exit follows `closing`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileLayout, closing, compact]);

  // Unmounting (after the exit, or an OS switch): every window lands exactly where the kernel says.
  useEffect(
    () => () => {
      timeline.current?.kill();
      for (const el of document.querySelectorAll<HTMLElement>('[data-window]'))
        gsap.set(el, { clearProps: 'transform,transformOrigin' });
    },
    [],
  );

  const choose = (window: WindowInstance) => {
    flushQueued();
    const all = overviewWindows(getKernel().sessions.windows.windows);
    const partner = snapPartner(window, all);
    if (partner)
      dispatchSoon(
        partner.phase.s === 'minimized'
          ? { type: 'RESTORE', id: partner.id }
          : { type: 'FOCUS_WINDOW', id: partner.id },
      );
    dispatchSoon(
      window.phase.s === 'minimized' ? { type: 'RESTORE', id: window.id } : { type: 'FOCUS_WINDOW', id: window.id },
    );
    onDone();
  };
  const close = (window: WindowInstance) => dispatchSoon({ type: 'CLOSE_WINDOW', id: window.id });
  const onTileKey = (event: KeyboardEvent<HTMLButtonElement>, window: WindowInstance) => {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    event.preventDefault();
    close(window);
  };

  const empty = windows.length === 0;
  const open = (role: 'files' | 'github' | 'resume') => {
    onDone();
    if (role === 'resume')
      dispatchSoon({
        type: 'OPEN_APP',
        os: 'windows',
        role: 'browser',
        location: { kind: 'content', ref: { section: 'resume' } },
      });
    else dispatchSoon({ type: 'OPEN_APP', os: 'windows', role });
  };

  return (
    <>
      {compact ? null : (
        <div
          className={styles.taskViewBackdrop}
          data-state={closing ? 'closing' : 'open'}
          data-acrylic={live ? 'live' : 'tint'}
          aria-hidden="true"
        />
      )}
      <div
        className={styles.taskView}
        role="dialog"
        aria-modal="true"
        aria-label="Task View"
        data-task-view=""
        data-state={closing ? 'closing' : 'open'}
        data-compact={compact || undefined}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) onDone();
        }}
      >
        <FocusScope trapped initialFocus restoreFocus={false} className={styles.taskViewScope}>
          {empty ? (
            <div className={styles.taskViewEmpty}>
              <p>No open windows</p>
              <div className={styles.taskViewEmptyActions}>
                <button type="button" className={styles.buttonSubtle} onClick={() => open('files')}>
                  <AssetIcon id={winBinding('files').icon} size={20} /> File Explorer
                </button>
                <button type="button" className={styles.buttonSubtle} onClick={() => open('github')}>
                  <AssetIcon id={winBinding('github').icon} size={20} /> GitHub
                </button>
                <button type="button" className={styles.buttonSubtle} onClick={() => open('resume')}>
                  <PdfFile size={20} /> Résumé
                </button>
              </div>
            </div>
          ) : (
            <RovingGroup
              as="ul"
              orientation={compact ? 'vertical' : 'grid'}
              role="list"
              aria-label="Open windows"
              className={compact ? styles.taskCards : styles.taskTiles}
            >
              {windows.map((window) => {
                const tile = tiles.get(window.id);
                const label = windowLabel(window);
                const binding = winBinding(window.role);
                const minimized = window.phase.s === 'minimized';
                const style =
                  compact || !tile
                    ? undefined
                    : {
                        left: tile.x,
                        top: tile.y - LABEL,
                        width: tile.w,
                        height: tile.h + LABEL,
                      };
                return (
                  <li key={window.id} className={compact ? styles.taskCardItem : styles.taskTileItem} style={style}>
                    <span className={styles.taskTileTitle} aria-hidden="true">
                      <AssetIcon id={binding.icon} size={16} />
                      <span>{label}</span>
                    </span>
                    <button
                      type="button"
                      className={styles.taskTile}
                      data-roving-item=""
                      data-task-tile={window.id}
                      data-minimized={minimized || undefined}
                      data-snapped={
                        window.snap?.zone === 'left' || window.snap?.zone === 'right' ? window.snap.zone : undefined
                      }
                      aria-current={focused === window.id && isFocusable(window) ? 'true' : undefined}
                      onClick={() => choose(window)}
                      onKeyDown={(event) => onTileKey(event, window)}
                    >
                      <span className="sr-only">
                        {label}
                        {minimized ? ', minimized' : ''}
                      </span>
                      {minimized || compact ? (
                        <span className={styles.taskTileCard} aria-hidden="true">
                          <AssetIcon id={binding.icon} size={compact ? 48 : 40} />
                          {minimized ? <span className={styles.taskTileState}>Minimized</span> : null}
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className={styles.taskTileClose}
                      aria-label={`Close ${label}`}
                      onClick={() => close(window)}
                    >
                      <Fl icon={flDismiss} size={12} />
                    </button>
                  </li>
                );
              })}
            </RovingGroup>
          )}
          {compact ? null : (
            <div className={styles.desktops} role="group" aria-label="Desktops">
              <span className={styles.desktopThumb} data-current="">
                <span className={styles.desktopThumbArt} aria-hidden="true" />
                Desktop 1<span className="sr-only">, current desktop</span>
              </span>
              <button
                type="button"
                className={styles.newDesktop}
                aria-disabled="true"
                aria-describedby="win-new-desktop-why"
                title="One desktop is plenty here"
                onClick={(event) => event.preventDefault()}
              >
                <Fl icon={flAdd} size={16} />
                New desktop
              </button>
              <span id="win-new-desktop-why" className="sr-only">
                One desktop is plenty here
              </span>
            </div>
          )}
        </FocusScope>
      </div>
    </>
  );
}
