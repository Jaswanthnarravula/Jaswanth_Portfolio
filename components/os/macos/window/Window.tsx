'use client';
/**
 * A macOS window — plans/macos/02-window-manager.md on top of the kernel's window machine (shared/04).
 *   · a labelled `<section>` region with an `h2` title, never a dialog (shared/09); DOM order = open order, stacking by
 *     `z-index` only (the Shell renders windows in open order).
 *   · a press anywhere inside focuses and raises it *and* the press still acts (no click-through swallow) — `MAC-WM-02`.
 *   · title-bar drag with pointer capture on the ticker, clamped so the title bar never hides under the menu bar and
 *     ≥ 48 px of it stays reachable; one `COMMIT_RECT` on release; zero React renders while dragging — `MAC-WM-03`.
 *   · traffic lights on the left: 12 px dots on a 20 px pitch, 24 px hit areas; grey when inactive — `MAC-ID-02/03`.
 *   · minimize = the Scale effect into its Dock tile, reversible mid-flight; the minimized window is kept alive but
 *     hidden with `<Activity>` — `MAC-WM-05`. Zoom = layout once + clip-path reveal — `MAC-WM-06`. Close — `MAC-WM-07`.
 *   · compact mode: CSS ignores the geometry; one 44 px "Window controls" menu replaces the lights — `MAC-WM-10`.
 *   · eight resize zones (4 edges 6 px, 4 corners 12 px; a 44 px corner on touch) that respect `minPx` and the
 *     workspace; tier 0 resizes a ghost outline and commits on release — `MAC-WM-04`.
 *   · Window menu → Move / Size (arrows 10 px, Shift 50 px, Enter commits, Esc reverts), Center, and on touch Tile
 *     Left / Tile Right / Fill — `MAC-WM-09`, `MAC-RESP-02`; a ⋯ window menu (visible on focus and touch) and the
 *     title bar's context menu offer the same (`MAC-CTX-02`).
 * Geometry is committed kernel state rendered as CSS custom properties; every animated value is written imperatively.
 */
import { Activity, memo, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Menu } from '@/components/primitives/Menu';
import { clampGeometry, workspaceFor } from '@/lib/kernel/geometry';
import { macosInsets } from '@/lib/kernel/registry';
import { focusKeys, type WindowId, type WindowInstance, type WindowPhase } from '@/lib/kernel/types';
import { probe } from '@/lib/motion/debug';
import { drag } from '@/lib/motion/drag';
import { useKernel, usePrefs } from '@/stores/kernel-context';
import { dispatch, dispatchSoon } from '@/stores/kernel-store';
import { getPrefs } from '@/stores/prefs-store';
import { announce } from '../announce';
import { MoreGlyph } from '../glyphs';
import { openContextMenu } from '../ui';
import { onWindowMode, type WindowMode } from './modes';
import { CloseMark, ControlsGlyph, MinimizeMark, ZoomMark } from '../icons';
import { effectiveRect, macBinding, windowTitle, zoomedRect } from '../model';
import { boxOf, WindowMotion, type Box } from '../motion';
import styles from './window.module.css';

export interface WindowBodyProps {
  readonly window: WindowInstance;
  readonly titleId: string;
  readonly focused: boolean;
  readonly compact: boolean;
}

const RADIUS = 12;
/** Keyboard move / size steps (plans/macos/02 "Keyboard"). */
const STEP = 10;
const BIG_STEP = 50;
const ZONES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;
type Zone = (typeof ZONES)[number];

/** A resize: the start rect grown from the dragged edges, never under `min`, never outside the workspace (pure). */
export function resizeRect(
  start: { x: number; y: number; w: number; h: number },
  zone: Zone,
  dx: number,
  dy: number,
  min: { w: number; h: number },
  space: { x: number; y: number; w: number; h: number },
): { x: number; y: number; w: number; h: number } {
  let { x, y, w, h } = start;
  const right = start.x + start.w;
  const bottom = start.y + start.h;
  if (zone.includes('e')) w = Math.min(space.x + space.w - start.x, Math.max(min.w, start.w + dx));
  if (zone.includes('s')) h = Math.min(space.y + space.h - start.y, Math.max(min.h, start.h + dy));
  if (zone.includes('w')) {
    x = Math.min(right - min.w, Math.max(space.x, start.x + dx));
    w = right - x;
  }
  if (zone.includes('n')) {
    y = Math.min(bottom - min.h, Math.max(space.y, start.y + dy));
    h = bottom - y;
  }
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}
const INTERACTIVE = 'button, a, input, textarea, select, summary, [role="button"], [role="menuitem"], [data-no-drag]';

const toBox = (rect: { x: number; y: number; w: number; h: number }): Box => rect;
const originBox = (originId: string | null): Box | null => {
  if (!originId) return null;
  const element = document.getElementById(originId);
  return element ? boxOf(element) : null;
};

export const MacWindow = memo(function MacWindow({
  id,
  zIndex,
  focused,
  compact,
  shownInCompact,
  onShowWindows,
  body,
}: {
  readonly id: WindowId;
  readonly zIndex: number;
  readonly focused: boolean;
  readonly compact: boolean;
  /** Compact mode shows one window at a time: this one. */
  readonly shownInCompact: boolean;
  readonly onShowWindows: () => void;
  readonly body: (props: WindowBodyProps) => ReactNode;
}) {
  const window = useKernel((state) => state.sessions.macos.windows[id]);
  const viewport = useKernel((state) => state.viewport);
  const learned = useKernel((state) => state.learnedRects[id]);
  // The Dock's size changes the workspace: the window re-clamps with it.
  usePrefs((prefs) => prefs.dock.size);
  const ref = useRef<HTMLElement>(null);
  const motion = useRef<WindowMotion | null>(null);
  const previous = useRef<WindowPhase | null>(null);
  const tile = useRef<Box | null>(null);
  // The minimized phase whose Scale effect has landed: only then is the window hidden (a new minimize is a new phase
  // object, so it stays visible until its own flight lands).
  const [landed, setLanded] = useState<WindowPhase | null>(() =>
    window?.phase.s === 'minimized' ? window.phase : null,
  );
  const [controlsOpen, setControlsOpen] = useState(false);
  const controlsButton = useRef<HTMLButtonElement>(null);

  // Acceptance probe: counts this window's commits (a drag must add none — MOTION-DRAG-01).
  useEffect(() => probe('render:window'));

  const phase = window?.phase;
  const rect = window
    ? phase?.s === 'maximized' || (phase?.s === 'minimized' && phase.wasMaximized)
      ? zoomedRect(viewport)
      : effectiveRect(window, viewport, learned)
    : null;

  // Phase → animation. Runs before paint, so an animation's first frame is what the visitor sees.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !window || !phase) return;
    const m = (motion.current ??= new WindowMotion(el));
    const before = previous.current;
    previous.current = phase;
    if (before?.s === phase.s && before === phase) return;
    const done = () => dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
    switch (phase.s) {
      case 'opening':
        m.open(originBox(phase.originId), done);
        return;
      case 'closing':
        m.close(done);
        return;
      case 'minimized': {
        if (!before) return; // mounted minimized (restored session): already hidden
        const target = document.querySelector(`[data-dock-tile="${id}"]`);
        tile.current = target ? boxOf(target) : null;
        m.minimize(compact ? null : tile.current, () => setLanded(phase));
        return;
      }
      case 'normal':
      case 'maximized': {
        if (before?.s === 'minimized') {
          // Mid-flight this reverses the running Scale effect; otherwise the window (visible again since this commit)
          // grows back out of its tile, or out of the app's Dock icon after a reload.
          const icon = document.getElementById(`dock-${macBinding(window.role).slug}`);
          m.restore(tile.current ?? (icon ? boxOf(icon) : null), () => undefined);
          return;
        }
        const zooming = before && before.s !== phase.s && (before.s === 'normal' || before.s === 'maximized');
        if (!zooming || compact) return;
        const full = zoomedRect(viewport);
        const restoreRect = phase.s === 'maximized' ? phase.restore : effectiveRect(window, viewport, learned);
        if (phase.s === 'maximized') m.zoom(toBox(full), toBox(restoreRect), toBox(full), RADIUS, () => undefined);
        else {
          // Un-zoom keeps the zoomed layout while the visible box shrinks, then applies the normal layout once.
          setGeometry(el, full);
          m.zoom(toBox(full), toBox(full), toBox(restoreRect), RADIUS, () => setGeometry(el, restoreRect));
        }
        return;
      }
    }
    // Only phase changes drive animation; geometry changes are plain layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Unmount: land on the kernel's end state and forget the last phase. A remount (React Strict Mode runs every effect
  // twice in development) then replays the phase animation instead of leaving the window invisible at its first frame.
  useEffect(
    () => () => {
      motion.current?.settle();
      previous.current = null;
    },
    [],
  );

  // The frame is a direct-manipulation surface (press to focus, drag, double-click to zoom). Its listeners are native
  // and read the latest render through a ref; every gesture has a keyboard/button alternative (shared/08).
  const latest = useRef<{
    onPress: () => void;
    onDown: (event: PointerEvent) => void;
    onDouble: (event: MouseEvent) => void;
    onMenu: (event: MouseEvent) => void;
    onMode: (mode: WindowMode) => void;
  } | null>(null);
  const mounted = window !== undefined;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const lifecycle = new AbortController();
    const { signal } = lifecycle;
    el.addEventListener('pointerdown', () => latest.current?.onPress(), { capture: true, signal });
    el.addEventListener('pointerdown', (event) => latest.current?.onDown(event), { signal });
    el.addEventListener('dblclick', (event) => latest.current?.onDouble(event), { signal });
    el.addEventListener('contextmenu', (event) => latest.current?.onMenu(event), { signal });
    return () => lifecycle.abort();
  }, [mounted]);

  // Window-menu geometry commands for this window (Move / Size / Center / Tile) arrive through the mode bus.
  useEffect(() => onWindowMode(id, (mode) => latest.current?.onMode(mode)), [id]);

  /** Commit a rect: the DOM shows it at once, the kernel learns it after that frame (no jump, one render). */
  const commit = (rect: { x: number; y: number; w: number; h: number }) => {
    const el = ref.current;
    if (!el || !window) return;
    setGeometry(el, rect);
    dispatchSoon({ type: 'COMMIT_RECT', id, rect });
  };

  const workspace = () => workspaceFor(viewport, macosInsets(viewport, getPrefs()));

  /** Pointer resize from one of the eight zones (a ghost outline on tier 0, the real size otherwise). */
  const resize = (handle: HTMLElement, event: PointerEvent, zone: Zone) => {
    const el = ref.current;
    if (!el || !window) return;
    const binding = macBinding(window.role);
    const start = effectiveRect(window, viewport, learned);
    const space = workspace();
    const ghost = document.documentElement.dataset.tier === '0';
    let placed = start;
    const outline: { el: HTMLDivElement | null } = { el: null };
    drag(handle, event, {
      onStart: () => {
        motion.current?.finishOpen();
        el.dataset.resizing = '';
        if (ghost) {
          const node = document.createElement('div');
          node.className = styles.ghost ?? '';
          node.setAttribute('aria-hidden', 'true');
          el.parentElement?.append(node);
          outline.el = node;
        }
      },
      onMove: (dx, dy) => {
        placed = resizeRect(start, zone, dx, dy, binding.window.minPx, space);
        if (outline.el) {
          outline.el.style.transform = `translate3d(${placed.x}px, ${placed.y}px, 0)`;
          outline.el.style.width = `${placed.w}px`;
          outline.el.style.height = `${placed.h}px`;
        } else setGeometry(el, placed);
      },
      onEnd: ({ moved }) => {
        delete el.dataset.resizing;
        outline.el?.remove();
        if (moved) commit(placed);
        else setGeometry(el, start);
      },
    });
  };

  /** Window menu → Move / Size (keyboard modes), Center, Tile Left / Right, Fill. */
  const runMode = (mode: WindowMode) => {
    const el = ref.current;
    if (!el || !window || compact) return;
    if (window.phase.s !== 'normal') {
      announce('Restore the window first (Window, then Restore).');
      return;
    }
    const binding = macBinding(window.role);
    const space = workspace();
    const start = effectiveRect(window, viewport, learned);
    if (mode === 'center') {
      commit(
        clampGeometry(
          {
            ...start,
            x: space.x + Math.round((space.w - start.w) / 2),
            y: space.y + Math.round((space.h - start.h) / 2),
          },
          space,
          binding.window.minPx,
        ),
      );
      return;
    }
    if (mode === 'tile-left' || mode === 'tile-right' || mode === 'fill') {
      const half = Math.round(space.w / 2);
      commit(
        mode === 'fill'
          ? space
          : { x: mode === 'tile-left' ? space.x : space.x + half, y: space.y, w: space.w - half, h: space.h },
      );
      return;
    }
    // Move / Size mode: arrows 10 px, Shift 50 px, Enter commits, Esc reverts; any press elsewhere commits.
    let rect = start;
    el.dataset.mode = mode;
    el.focus({ preventScroll: true });
    announce(
      `${mode === 'move' ? 'Move' : 'Size'} mode. Arrow keys ${mode === 'move' ? 'move' : 'resize'} the window, Shift for bigger steps. Enter to finish, Escape to cancel.`,
    );
    const finish = (keep: boolean) => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPress, true);
      delete el.dataset.mode;
      if (keep && rect !== start) commit(rect);
      else setGeometry(el, start);
    };
    const onPress = () => finish(true);
    const onKey = (event: KeyboardEvent) => {
      const step = event.shiftKey ? BIG_STEP : STEP;
      const deltas: Readonly<Record<string, readonly [number, number]>> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const move = deltas[event.key];
      if (move) {
        event.preventDefault();
        event.stopPropagation();
        rect =
          mode === 'move'
            ? clampGeometry({ ...rect, x: rect.x + move[0], y: rect.y + move[1] }, space, binding.window.minPx)
            : resizeRect(rect, 'se', move[0], move[1], binding.window.minPx, space);
        setGeometry(el, rect);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        finish(event.key === 'Enter');
        announce(event.key === 'Enter' ? 'Done.' : 'Cancelled.');
        return;
      }
      if (event.key === 'Tab') finish(true);
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPress, true);
  };

  useLayoutEffect(() => {
    if (!window || !phase) return;
    const binding = macBinding(window.role);
    const leaving = phase.s === 'closing' || phase.s === 'minimized';
    latest.current = {
      onPress: () => {
        if (!focused && !leaving) dispatchSoon({ type: 'FOCUS_WINDOW', id, via: 'pointer' });
      },
      onDown: (event) => {
        if (event.button !== 0 || compact || phase.s !== 'normal') return;
        const target = event.target as Element;
        const zone = target.closest<HTMLElement>('[data-resize]');
        if (zone) {
          resize(zone, event, zone.dataset.resize as Zone);
          return;
        }
        if (!target.closest('[data-drag-region]') || target.closest(INTERACTIVE)) return;
        const el = ref.current;
        if (!el) return;
        const start = effectiveRect(window, viewport, learned);
        const workspace = workspaceFor(viewport, macosInsets(viewport));
        let placed = start;
        drag(el, event, {
          onStart: () => {
            motion.current?.finishOpen(); // drag always wins over an in-flight open
            el.dataset.dragging = '';
            el.style.willChange = 'transform';
          },
          onMove: (dx, dy) => {
            placed = clampGeometry({ ...start, x: start.x + dx, y: start.y + dy }, workspace, binding.window.minPx);
            el.style.transform = `translate3d(${placed.x - start.x}px, ${placed.y - start.y}px, 0)`;
          },
          onEnd: ({ moved }) => {
            delete el.dataset.dragging;
            el.style.removeProperty('will-change');
            if (!moved) return;
            // Land the committed geometry in the same frame the transform goes away: no jump back, no extra render.
            // The store learns the rect after that frame paints (the DOM already shows it).
            setGeometry(el, placed);
            el.style.transform = '';
            dispatchSoon({ type: 'COMMIT_RECT', id, rect: placed });
          },
        });
      },
      onDouble: (event) => {
        // A drag's pointer capture retargets the following dblclick to the window itself: hit-test the point.
        // (jsdom has no `elementFromPoint`; there the event's own target is already the right one.)
        const hit =
          typeof document.elementFromPoint === 'function'
            ? document.elementFromPoint(event.clientX, event.clientY)
            : null;
        const target = (hit ?? event.target) as Element;
        if (compact || !target.closest('[data-drag-region]') || target.closest(INTERACTIVE)) return;
        dispatchSoon({ type: 'TOGGLE_MAXIMIZE', id });
      },
      // The title bar's context menu (the native menu stays everywhere else — text, inputs, the Terminal).
      onMenu: (event) => {
        const target = event.target as Element;
        if (!target.closest('[data-drag-region]') || target.closest('input, textarea, [contenteditable]')) return;
        event.preventDefault();
        const keyboard = event.clientX === 0 && event.clientY === 0;
        const box = ref.current?.getBoundingClientRect();
        openContextMenu(
          { kind: 'titlebar', role: window.role },
          keyboard ? (box?.left ?? 0) + 80 : event.clientX,
          keyboard ? (box?.top ?? 0) + 40 : event.clientY,
          null,
        );
      },
      onMode: (mode) => runMode(mode),
    };
  });

  if (!window || !phase || !rect) return null;
  const binding = macBinding(window.role);
  const titleId = `mac-title-${window.role}`;
  const title = windowTitle(window);
  const maximized = phase.s === 'maximized';
  const leaving = phase.s === 'closing' || phase.s === 'minimized';
  const hiddenInCompact = compact && !shownInCompact && !leaving;

  return (
    <Activity mode={phase.s === 'minimized' && landed === phase ? 'hidden' : 'visible'}>
      <section
        ref={ref}
        className={styles.window}
        aria-labelledby={titleId}
        tabIndex={-1}
        data-focus-key={focusKeys.window(id)}
        data-window={id}
        data-app={binding.slug}
        data-app-title={binding.title}
        data-focused={focused || undefined}
        data-phase={phase.s}
        data-opened-from={phase.s === 'opening' ? (phase.originId ?? undefined) : undefined}
        hidden={hiddenInCompact || undefined}
        inert={leaving || hiddenInCompact || undefined}
        style={{
          zIndex,
          ['--x' as string]: `${rect.x}px`,
          ['--y' as string]: `${rect.y}px`,
          ['--w' as string]: `${rect.w}px`,
          ['--h' as string]: `${rect.h}px`,
        }}
      >
        <div
          className={styles.lights}
          id={`mac-lights-${binding.slug}`}
          role="group"
          aria-label="Window controls"
          data-no-drag=""
        >
          <button
            type="button"
            className={styles.light}
            data-light="close"
            aria-label={`Close ${binding.title}`}
            onClick={() => dispatchSoon({ type: 'CLOSE_WINDOW', id })}
          >
            <span className={styles.dot}>
              <CloseMark />
            </span>
          </button>
          <button
            type="button"
            className={styles.light}
            data-light="minimize"
            aria-label={`Minimize ${binding.title}`}
            onClick={(event) => {
              if (event.shiftKey) motion.current?.slowDown();
              dispatchSoon({ type: 'MINIMIZE', id });
            }}
          >
            <span className={styles.dot}>
              <MinimizeMark />
            </span>
          </button>
          <button
            type="button"
            className={styles.light}
            data-light="zoom"
            aria-label={`${maximized ? 'Restore' : 'Zoom'} ${binding.title}`}
            onClick={() => dispatchSoon({ type: 'TOGGLE_MAXIMIZE', id })}
          >
            <span className={styles.dot}>
              <ZoomMark />
            </span>
          </button>
        </div>
        <button
          type="button"
          id={`mac-window-menu-${binding.slug}`}
          className={styles.windowMenu}
          aria-haspopup="menu"
          aria-label={`${title.app} window menu`}
          data-no-drag=""
          onClick={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            openContextMenu({ kind: 'titlebar', role: window.role }, box.left, box.bottom + 4, event.currentTarget.id);
          }}
        >
          <MoreGlyph size={12} />
        </button>
        {phase.s === 'normal' ? (
          <div className={styles.resizers} aria-hidden="true" data-no-drag="">
            {ZONES.map((zone) => (
              <span key={zone} className={styles.resizer} data-resize={zone} />
            ))}
          </div>
        ) : null}
        <div className={styles.compactControls} data-no-drag="">
          <button
            ref={controlsButton}
            type="button"
            className={styles.controlsButton}
            aria-haspopup="menu"
            aria-expanded={controlsOpen}
            aria-label="Window controls"
            onClick={() => setControlsOpen((open) => !open)}
          >
            <ControlsGlyph size={24} />
          </button>
          {controlsOpen ? (
            <Menu
              label={`${title.app} window`}
              className={styles.menu}
              returnFocusTo={controlsButton}
              onClose={() => setControlsOpen(false)}
              items={[
                {
                  kind: 'item',
                  id: 'close',
                  label: 'Close',
                  onSelect: () => dispatchSoon({ type: 'CLOSE_WINDOW', id }),
                },
                {
                  kind: 'item',
                  id: 'minimize',
                  label: 'Minimize',
                  onSelect: () => dispatchSoon({ type: 'MINIMIZE', id }),
                },
                { kind: 'separator', id: 'sep' },
                { kind: 'item', id: 'windows', label: 'Windows…', onSelect: onShowWindows },
              ]}
            />
          ) : null}
        </div>
        {body({ window, titleId, focused, compact })}
      </section>
    </Activity>
  );
});

function setGeometry(el: HTMLElement, rect: { x: number; y: number; w: number; h: number }) {
  el.style.setProperty('--x', `${rect.x}px`);
  el.style.setProperty('--y', `${rect.y}px`);
  el.style.setProperty('--w', `${rect.w}px`);
  el.style.setProperty('--h', `${rect.h}px`);
}

/** The standard unified title bar for apps without a sidebar: lights, then the title (the frame's GitHub window). */
export function TitleBar({ titleId, children }: { readonly titleId: string; readonly children: ReactNode }) {
  return (
    <header className={styles.titlebar} data-drag-region="">
      <h2 id={titleId} className={styles.title}>
        {children}
      </h2>
    </header>
  );
}

export { styles as windowStyles };
