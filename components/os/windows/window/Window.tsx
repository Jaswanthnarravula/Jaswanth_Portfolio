'use client';
/**
 * A Windows 11 window — plans/windows/02-window-manager.md on the kernel's window machine (shared/04):
 *   · a labelled `<section>` region with an `h2` (never a dialog — shared/09); DOM order = open order, z-index stacks.
 *   · Mica: a static, desaturated copy of the wallpaper counter-translated inside the window so it reads as fixed to
 *     the desktop — no live filter (`WIN-ID-02`); inactive windows switch it to a flat neutral.
 *   · caption buttons on the **right** (46 × 32; 48 × 44 coarse), red close hover (`WIN-ID-04`); the title-bar icon is
 *     the system-menu button (Restore · Move · Size · Minimize · Maximize · Snap ▸ · Close — `WIN-WM-11`).
 *   · Snap (`WIN-WM-04…07`): drag to an edge/corner shows a translucent preview after 100 ms (Esc cancels it, the drag
 *     continues); release commits; the top edge maximizes; hovering or focusing Maximize for 400 ms shows the snap
 *     layouts flyout; the shared edge of a ½ + ½ pair resizes both windows.
 *   · drag with pointer capture on the ticker; dragging a maximized or snapped window restores it under the pointer
 *     (proportional x) and carries on (`WIN-WM-03`); one `COMMIT_RECT` on release, zero React renders while dragging.
 *   · 8 resize zones (edges 6 px, corners 12 px), a 44 px grip on touch; keyboard Move/Size modes.
 *   · maximize squares the corners and drops the shadow; open/close/minimize/restore/maximize animate per
 *     plans/windows/03 and reverse when interrupted.
 *   · compact: one maximized window, caption buttons = minimize + close at 48 × 44, Snap disabled (`WIN-WM-12`).
 */
import {
  Activity,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import type { MenuEntry } from '@/components/primitives/Menu';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { clampGeometry, snapRect, snapTargetAt, type SnapTarget } from '@/lib/kernel/geometry';
import {
  focusKeys,
  type OsAppBinding,
  type PxRect,
  type SnapZone,
  type WindowId,
  type WindowInstance,
  type WindowPhase,
} from '@/lib/kernel/types';
import { probe } from '@/lib/motion/debug';
import { drag } from '@/lib/motion/drag';
import { useKernel } from '@/stores/kernel-context';
import { dispatch, getKernel } from '@/stores/kernel-store';
import { flClose, flMaximize, flMinimize, flRestore } from '../fluent.generated';
import { Fl, SNAP_LAYOUTS } from '../icons';
import { floatingRect, isSquared, shownRect, taskbarButtonId, winBinding, windowTitle, winWorkspace } from '../model';
import { boxOf, WinWindowMotion, type Box } from '../motion';
import { useWinShell } from '../shell-context';
import styles from './window.module.css';

export interface WindowBodyProps {
  readonly window: WindowInstance;
  readonly titleId: string;
  readonly focused: boolean;
  readonly compact: boolean;
}

const RADIUS = 8;
const INTERACTIVE =
  'button, a, input, textarea, select, summary, [role="button"], [role="menuitem"], [role="tab"], [data-no-drag]';
/** Hover / focus intent before the snap layouts flyout (plans/windows/02). */
export const SNAP_LAYOUTS_DELAY_MS = 400;
/** The pointer rests at an edge this long before the snap preview shows (plans/windows/02 "Snap by drag"). */
export const SNAP_DWELL_MS = 100;
/** Move / Size mode steps (shared/09): arrows 10 px, Shift+arrows 50 px. */
const STEP = 10;
const BIG_STEP = 50;

const SNAP_LABELS: Readonly<Record<SnapTarget, string>> = {
  left: 'Release to snap left',
  right: 'Release to snap right',
  tl: 'Release to snap to the top-left quarter',
  tr: 'Release to snap to the top-right quarter',
  bl: 'Release to snap to the bottom-left quarter',
  br: 'Release to snap to the bottom-right quarter',
  top: 'Release to maximize',
};

const originBox = (originId: string | null): Box | null => {
  if (!originId) return null;
  const element = document.getElementById(originId);
  return element ? boxOf(element) : null;
};

function setGeometry(el: HTMLElement, rect: { x: number; y: number; w: number; h: number }) {
  el.style.setProperty('--x', `${Math.round(rect.x)}px`);
  el.style.setProperty('--y', `${Math.round(rect.y)}px`);
  el.style.setProperty('--w', `${Math.round(rect.w)}px`);
  el.style.setProperty('--h', `${Math.round(rect.h)}px`);
}

const union = (a: Box, b: Box): Box => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

const sameBox = (a: Box, b: Box) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

// --- Window context (the title bar reads it) ---------------------------------------------------------------------

interface WindowChrome {
  readonly id: WindowId;
  readonly binding: OsAppBinding;
  readonly titleId: string;
  readonly spoken: string;
  readonly focused: boolean;
  readonly compact: boolean;
  readonly touch: boolean;
  readonly maximized: boolean;
  readonly snapped: boolean;
  readonly openSystemMenu: (anchor: HTMLElement) => void;
  readonly snap: (zone: SnapZone) => void;
}

const Chrome = createContext<WindowChrome | null>(null);

// --- The window ----------------------------------------------------------------------------------------------------

export function WinWindow({
  id,
  zIndex,
  focused,
  compact,
  touch,
  shownInCompact,
  dimmed,
  overview = false,
  body,
}: {
  readonly id: WindowId;
  readonly zIndex: number;
  readonly focused: boolean;
  readonly compact: boolean;
  /** Tablet posture: 24 px snap zones, a 44 px resize grip, no hover flyouts. */
  readonly touch: boolean;
  /** Compact mode shows one window at a time: this one. */
  readonly shownInCompact: boolean;
  /** Taskbar peek: another window is being previewed, this one dims to 30 %. */
  readonly dimmed: boolean;
  /** Task View is showing: the window is a tile, not a place to type (`WIN-TV-04`). */
  readonly overview?: boolean;
  readonly body: (props: WindowBodyProps) => ReactNode;
}) {
  const window = useKernel((state) => state.sessions.windows.windows[id]);
  const viewport = useKernel((state) => state.viewport);
  const learned = useKernel((state) => state.learnedRects[id]);
  const shell = useWinShell();
  const ref = useRef<HTMLElement>(null);
  const mica = useRef<HTMLDivElement>(null);
  const motion = useRef<WinWindowMotion | null>(null);
  const previous = useRef<{ phase: WindowPhase; box: Box; key: string; squared: boolean } | null>(null);
  /** The next layout change was already animated by a gesture (a snap drop) — skip the phase animation once. */
  const gestureAnimated = useRef(false);
  const [landed, setLanded] = useState<WindowPhase | null>(() =>
    window?.phase.s === 'minimized' ? window.phase : null,
  );
  const [mode, setMode] = useState<'move' | 'size' | null>(null);

  useEffect(() => probe('render:window'));

  const phase = window?.phase;
  const rect = window ? shownRect(window, viewport, learned) : null;
  const layoutKey = window ? `${phase?.s}|${window.snap?.zone ?? ''}|${window.snap?.split ?? ''}` : '';

  // Phase and layout → animation, before paint (the first frame is what the visitor sees).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !window || !phase || !rect) return;
    const m = (motion.current ??= new WinWindowMotion(el));
    const before = previous.current;
    previous.current = { phase, box: rect, key: layoutKey, squared: isSquared(window) };
    const done = () => dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
    const button = () => {
      const target = document.getElementById(taskbarButtonId(window.role));
      return target ? boxOf(target) : null;
    };
    if (before?.phase === phase && before.key === layoutKey) {
      // Same phase and layout: a viewport change re-derived the rect — plain layout, no animation.
      return;
    }
    switch (phase.s) {
      case 'opening':
        if (before?.phase.s !== 'opening') m.open(originBox(phase.originId), done);
        return;
      case 'closing':
        m.close(done);
        return;
      case 'minimized':
        if (!before) return; // mounted minimized (a restored session): already hidden
        m.minimize(compact ? null : button(), () => setLanded(phase));
        return;
      case 'normal':
      case 'maximized': {
        if (before?.phase.s === 'minimized') {
          m.restore(compact ? null : button(), () => undefined);
          return;
        }
        if (!before || before.phase.s === 'opening' || before.phase.s === 'closing' || compact) return;
        if (gestureAnimated.current) {
          gestureAnimated.current = false;
          return;
        }
        if (sameBox(before.box, rect)) return;
        // Maximize / restore / snap by keyboard or flyout: lay out once over both boxes, reveal the new one.
        const layout = union(before.box, rect);
        setGeometry(el, layout);
        const toSquare = isSquared(window);
        const kind =
          phase.s === 'maximized' ? 'maximize' : before.phase.s === 'maximized' ? 'unmaximize' : 'snapCommit';
        m.reveal(layout, before.box, rect, [before.squared ? 0 : RADIUS, toSquare ? 0 : RADIUS], kind, () =>
          setGeometry(el, rect),
        );
        return;
      }
    }
    // Only phase and layout changes drive animation; geometry changes alone are plain layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, layoutKey]);

  // Unmount: land on the kernel's end state and forget the last phase. A remount (React Strict Mode runs every effect
  // twice in development) then replays the phase animation instead of leaving the window at its first frame.
  useEffect(
    () => () => {
      motion.current?.settle();
      previous.current = null;
    },
    [],
  );

  const snap = useCallback((zone: SnapZone) => dispatch({ type: 'SNAP_WINDOW', id, zone }), [id]);

  // --- Direct manipulation: press to focus, title-bar drag + Snap, double-click to maximize, resize --------------
  const latest = useRef<{
    onPress: () => void;
    onDown: (event: PointerEvent) => void;
    onDouble: (event: MouseEvent) => void;
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
    return () => lifecycle.abort();
  }, [mounted]);

  useLayoutEffect(() => {
    if (!window || !phase || !rect) return;
    const binding = winBinding(window.role);
    const leaving = phase.s === 'closing' || phase.s === 'minimized';
    latest.current = {
      onPress: () => {
        if (!focused && !leaving) dispatch({ type: 'FOCUS_WINDOW', id, via: 'pointer' });
      },
      onDown: (event) => {
        if (event.button !== 0 || compact || (phase.s !== 'normal' && phase.s !== 'maximized')) return;
        const target = event.target as Element;
        const handle = target.closest<HTMLElement>('[data-resize]');
        if (handle) {
          resize(event, handle.dataset.resize as Edge);
          return;
        }
        if (!target.closest('[data-drag-region]') || target.closest(INTERACTIVE)) return;
        moveByPointer(event);
      },
      onDouble: (event) => {
        // The drag gesture's pointer capture retargets the dblclick to the window: hit-test where it happened.
        const target = (document.elementFromPoint(event.clientX, event.clientY) ?? event.target) as Element;
        if (compact || !target.closest('[data-drag-region]') || target.closest(INTERACTIVE)) return;
        dispatch({ type: 'TOGGLE_MAXIMIZE', id });
      },
    };

    type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

    function moveByPointer(event: PointerEvent) {
      const el = ref.current;
      if (!el || !window || !rect) return;
      const workspace = winWorkspace(viewport);
      const press = { x: event.clientX, y: event.clientY };
      const restoreUnder = phase!.s === 'maximized' || !!window.snap;
      const floating = floatingRect(window, viewport, learned);
      let start: PxRect = rect;
      let placed: PxRect = rect;
      let target: SnapTarget | null = null;
      /** Resting on a target for the dwell shows its preview — a timer, since a resting pointer sends no moves. */
      let dwell: ReturnType<typeof setTimeout> | null = null;
      let shown: SnapTarget | null = null;
      let cancelled: SnapTarget | null = null;
      const onEscape = (key: KeyboardEvent) => {
        if (key.key !== 'Escape' || !shown) return;
        key.preventDefault();
        key.stopPropagation();
        cancelled = shown;
        shown = null;
        shell.snapPreview.hide();
      };
      drag(el, event, {
        onStart: () => {
          motion.current?.finishOpen(); // drag always wins over an in-flight open
          if (restoreUnder) {
            // Restore under the pointer: keep the pointer's proportional x and its offset into the title bar.
            const ratio = (press.x - rect.x) / Math.max(1, rect.w);
            start = clampGeometry(
              { x: press.x - ratio * floating.w, y: rect.y, w: floating.w, h: floating.h },
              workspace,
              binding.window.minPx,
            );
            setGeometry(el, start);
            el.dataset.squared = 'false';
            gestureAnimated.current = true;
            dispatch({ type: 'COMMIT_RECT', id, rect: start });
          }
          placed = start;
          el.dataset.dragging = '';
          el.style.willChange = 'transform';
          shell.setDragging(true);
          document.addEventListener('keydown', onEscape, true);
        },
        onMove: (dx, dy) => {
          placed = clampGeometry({ ...start, x: start.x + dx, y: start.y + dy }, workspace, binding.window.minPx);
          const tx = placed.x - start.x;
          const ty = placed.y - start.y;
          el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
          if (mica.current) mica.current.style.transform = `translate3d(${-tx}px, ${-ty}px, 0)`;
          if (!binding.window.resizable) return;
          const next = snapTargetAt({ x: press.x + dx, y: press.y + dy }, workspace, { edge: touch ? 24 : 12 });
          if (next === target) return;
          target = next;
          if (dwell) clearTimeout(dwell);
          dwell = null;
          if (shown) {
            shown = null;
            shell.snapPreview.hide();
          }
          if (next !== cancelled) cancelled = null;
          if (!next || next === cancelled) return;
          dwell = setTimeout(() => {
            dwell = null;
            if (target !== next || shown || cancelled === next) return;
            shown = next;
            shell.snapPreview.show(next === 'top' ? { ...workspace } : snapRect(next, workspace), SNAP_LABELS[next]);
          }, SNAP_DWELL_MS);
        },
        onEnd: ({ moved }) => {
          if (dwell) clearTimeout(dwell);
          dwell = null;
          document.removeEventListener('keydown', onEscape, true);
          shell.setDragging(false);
          delete el.dataset.dragging;
          el.style.removeProperty('will-change');
          const commit = shown;
          shown = null;
          shell.snapPreview.hide();
          if (mica.current) mica.current.style.transform = '';
          if (!moved) {
            el.style.transform = '';
            return;
          }
          const dropped: Box = placed;
          if (commit) {
            // Snap commit flight (250 ms): from where the window was dropped into its zone.
            const to: PxRect = commit === 'top' ? { ...workspace } : snapRect(commit, workspace);
            const layout = union(dropped, to);
            el.style.transform = '';
            setGeometry(el, layout);
            gestureAnimated.current = true;
            motion.current?.reveal(layout, dropped, to, [RADIUS, 0], 'snapCommit', () => setGeometry(el, to));
            if (commit === 'top') {
              dispatch({ type: 'COMMIT_RECT', id, rect: start });
              dispatch({ type: 'TOGGLE_MAXIMIZE', id });
            } else dispatch({ type: 'SNAP_WINDOW', id, zone: commit });
            shell.announce(commit === 'top' ? `${binding.title} maximized` : `${binding.title} snapped`);
            return;
          }
          // Land the committed geometry in the same frame the transform goes away: no jump back, no extra render.
          setGeometry(el, placed);
          el.style.transform = '';
          dispatch({ type: 'COMMIT_RECT', id, rect: placed });
        },
      });
    }

    function resize(event: PointerEvent, edge: Edge) {
      const el = ref.current;
      if (!el || !window || !rect || !binding.window.resizable) return;
      const workspace = winWorkspace(viewport);
      const min = binding.window.minPx;
      const zone = window.snap?.zone;
      const paired = zone === 'left' || zone === 'right';
      const partnerRole = paired
        ? (Object.values(getKernel().sessions.windows.windows).find(
            (other) => other && other.id !== id && (other.snap?.zone === 'left' || other.snap?.zone === 'right'),
          )?.role ?? null)
        : null;
      const partnerEl = partnerRole
        ? document.querySelector<HTMLElement>(`[data-window="windows:${partnerRole}"]`)
        : null;
      const start = rect;
      let next: PxRect = rect;
      let split = window.snap?.split ?? 0.5;
      drag(el, event, {
        threshold: 1,
        onStart: () => {
          el.dataset.resizing = '';
          shell.setDragging(true);
        },
        onMove: (dx, dy) => {
          if (paired) {
            // The shared edge of a ½ + ½ pair moves both windows (`WIN-WM-07`).
            const edgeX = (zone === 'left' ? start.x + start.w : start.x) + dx;
            split = Math.min(0.75, Math.max(0.25, (edgeX - workspace.x) / workspace.w));
            next = snapRect(zone, workspace, split);
            setGeometry(el, next);
            if (partnerEl) setGeometry(partnerEl, snapRect(zone === 'left' ? 'right' : 'left', workspace, split));
            return;
          }
          let { x, y, w, h } = start;
          if (edge.includes('e')) w = start.w + dx;
          if (edge.includes('s')) h = start.h + dy;
          if (edge.includes('w')) {
            w = start.w - dx;
            x = start.x + dx;
          }
          if (edge.includes('n')) {
            h = start.h - dy;
            y = start.y + dy;
          }
          if (w < min.w) {
            if (edge.includes('w')) x -= min.w - w;
            w = min.w;
          }
          if (h < min.h) {
            if (edge.includes('n')) y -= min.h - h;
            h = min.h;
          }
          if (y < workspace.y) {
            h -= workspace.y - y;
            y = workspace.y;
          }
          next = clampGeometry({ x, y, w, h }, workspace, min);
          setGeometry(el, next);
        },
        onEnd: ({ moved }) => {
          delete el.dataset.resizing;
          shell.setDragging(false);
          if (!moved) return;
          if (paired) dispatch({ type: 'SET_SNAP_SPLIT', os: 'windows', split });
          else dispatch({ type: 'COMMIT_RECT', id, rect: next });
        },
      });
    }
  });

  // --- Keyboard Move / Size modes (system menu; shared/09 "Move / Size mode") ------------------------------------
  useEffect(() => {
    if (!mode || !window) return;
    const el = ref.current;
    if (!el) return;
    const binding = winBinding(window.role);
    const workspace = winWorkspace(viewport);
    const original = shownRect(window, viewport, learned);
    let current = original;
    shell.announce(
      mode === 'move'
        ? 'Move: arrow keys move the window, Shift for bigger steps. Enter to finish, Esc to cancel.'
        : 'Size: arrow keys resize the window, Shift for bigger steps. Enter to finish, Esc to cancel.',
    );
    const onKey = (event: KeyboardEvent) => {
      const step = event.shiftKey ? BIG_STEP : STEP;
      const deltas: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const delta = deltas[event.key];
      if (delta) {
        event.preventDefault();
        event.stopPropagation();
        current =
          mode === 'move'
            ? clampGeometry(
                { ...current, x: current.x + delta[0], y: current.y + delta[1] },
                workspace,
                binding.window.minPx,
              )
            : clampGeometry(
                { ...current, w: current.w + delta[0], h: current.h + delta[1] },
                workspace,
                binding.window.minPx,
              );
        setGeometry(el, current);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        dispatch({ type: 'COMMIT_RECT', id, rect: current });
        setMode(null);
        shell.announce(`${binding.title} ${mode === 'move' ? 'moved' : 'resized'}`);
        return;
      }
      if (event.key === 'Escape' || event.key === 'Tab') {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
        }
        setGeometry(el, original);
        setMode(null);
        shell.announce('Cancelled');
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
    // The mode owns its session; a new mode starts a new one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (!window || !phase || !rect) return null;
  const binding = winBinding(window.role);
  const titleId = `win-title-${binding.slug}`;
  const title = windowTitle(window);
  const maximized = phase.s === 'maximized';
  const snapped = !!window.snap && phase.s !== 'maximized';
  const leaving = phase.s === 'closing' || phase.s === 'minimized';
  const hiddenInCompact = compact && !shownInCompact && !leaving;
  const squared = isSquared(window);
  const resizable = binding.window.resizable && !compact && phase.s === 'normal';
  const edges: readonly string[] = !resizable
    ? []
    : window.snap
      ? window.snap.zone === 'left'
        ? ['e']
        : window.snap.zone === 'right'
          ? ['w']
          : []
      : ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

  const systemMenu: readonly MenuEntry[] = [
    {
      kind: 'item',
      id: 'restore',
      label: 'Restore',
      icon: <Fl icon={flRestore} />,
      disabled: compact || (!maximized && !snapped),
      onSelect: () =>
        maximized ? dispatch({ type: 'TOGGLE_MAXIMIZE', id }) : dispatch({ type: 'SNAP_WINDOW', id, zone: null }),
    },
    {
      kind: 'item',
      id: 'move',
      label: 'Move',
      disabled: compact || maximized || snapped,
      onSelect: () => setMode('move'),
    },
    {
      kind: 'item',
      id: 'size',
      label: 'Size',
      disabled: compact || maximized || snapped,
      onSelect: () => setMode('size'),
    },
    {
      kind: 'item',
      id: 'minimize',
      label: 'Minimize',
      shortcut: 'Alt+Shift+M',
      icon: <Fl icon={flMinimize} />,
      onSelect: () => dispatch({ type: 'MINIMIZE', id }),
    },
    {
      kind: 'item',
      id: 'maximize',
      label: 'Maximize',
      shortcut: 'Alt+Shift+F',
      icon: <Fl icon={flMaximize} />,
      disabled: compact || maximized,
      onSelect: () => dispatch({ type: 'TOGGLE_MAXIMIZE', id }),
    },
    {
      kind: 'submenu',
      id: 'snap',
      label: 'Snap',
      disabled: compact || !binding.window.resizable,
      items: SNAP_LAYOUTS.flatMap((layout, index) => [
        ...(index > 0 ? [{ kind: 'separator' as const, id: `snap-sep-${layout.id}` }] : []),
        ...layout.zones
          .filter((zone, zoneIndex, all) => all.findIndex((other) => other.zone === zone.zone) === zoneIndex)
          .map((zone) => ({
            kind: 'item' as const,
            id: `snap-${layout.id}-${zone.zone}`,
            label: zone.label.replace(/^Snap /, '').replace(/^./, (c) => c.toUpperCase()),
            onSelect: () => snap(zone.zone),
          })),
      ]),
    },
    { kind: 'separator', id: 'sep' },
    {
      kind: 'item',
      id: 'close',
      label: 'Close',
      shortcut: 'Alt+Shift+W',
      icon: <Fl icon={flClose} />,
      onSelect: () => dispatch({ type: 'CLOSE_WINDOW', id }),
    },
  ];

  /** The system menu opens in the shell's menu layer: above every window and the taskbar, never scrolling this one. */
  const openSystemMenu = (anchorEl: HTMLElement) => {
    const box = anchorEl.getBoundingClientRect();
    shell.openMenu({
      label: `${binding.title} window menu`,
      at: { x: box.left, y: box.bottom + 2 },
      items: systemMenu,
      returnFocusTo: anchorEl,
    });
  };

  const chrome: WindowChrome = {
    id,
    binding,
    titleId,
    spoken: title.spoken,
    focused,
    compact,
    touch,
    maximized,
    snapped,
    openSystemMenu,
    snap,
  };

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
        data-snap={window.snap && phase.s !== 'maximized' ? window.snap.zone : undefined}
        data-squared={squared ? 'true' : 'false'}
        data-compact={compact || undefined}
        data-dimmed={dimmed || undefined}
        data-mode={mode ?? undefined}
        data-opened-from={phase.s === 'opening' ? (phase.originId ?? undefined) : undefined}
        hidden={hiddenInCompact || undefined}
        inert={leaving || hiddenInCompact || overview || undefined}
        style={{
          zIndex,
          ['--x' as string]: `${rect.x}px`,
          ['--y' as string]: `${rect.y}px`,
          ['--w' as string]: `${rect.w}px`,
          ['--h' as string]: `${rect.h}px`,
        }}
      >
        <div ref={mica} className={styles.mica} aria-hidden="true" data-mica="" />
        <Chrome.Provider value={chrome}>{body({ window, titleId, focused, compact })}</Chrome.Provider>
        {edges.map((edge) => (
          <div key={edge} className={styles.resize} data-resize={edge} aria-hidden="true" />
        ))}
        {resizable && touch && !window.snap ? (
          <div className={styles.grip} data-resize="se" aria-hidden="true" />
        ) : null}
      </section>
    </Activity>
  );
}

// --- Title bar -----------------------------------------------------------------------------------------------------

/**
 * The Windows title bar (Mica): the app icon (= the system-menu button), the title or the app's own title-bar content
 * (tabs, a search box, a menu bar), and the caption buttons on the right. `tall` hosts tabs (48 px instead of 32 px).
 */
export function TitleBar({
  title,
  children,
  tall = false,
  hideIcon = false,
}: {
  /** Visible title; when the app shows its own title-bar content instead, the `h2` is visually hidden. */
  readonly title?: ReactNode;
  readonly children?: ReactNode;
  readonly tall?: boolean;
  readonly hideIcon?: boolean;
}) {
  const chrome = useContext(Chrome);
  if (!chrome) return null;
  return (
    <header className={styles.titlebar} data-drag-region="" data-tall={tall || undefined}>
      {hideIcon ? null : (
        <button
          type="button"
          className={styles.sysmenu}
          aria-haspopup="menu"
          aria-label="Window menu"
          onClick={(event) => chrome.openSystemMenu(event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              chrome.openSystemMenu(event.currentTarget);
            }
          }}
        >
          <AssetIcon id={chrome.binding.icon} size={16} priority />
        </button>
      )}
      {title !== undefined ? (
        <h2 id={chrome.titleId} className={styles.title}>
          {title}
        </h2>
      ) : (
        <h2 id={chrome.titleId} className="sr-only">
          {chrome.spoken}
        </h2>
      )}
      {children}
      <span className={styles.titleSpacer} />
      <CaptionButtons />
    </header>
  );
}

/** The window's in-app back affordance and similar controls read the chrome (compact, focus) through this hook. */
export function useWindowChrome(): WindowChrome | null {
  return useContext(Chrome);
}

function CaptionButtons() {
  const chrome = useContext(Chrome)!;
  const { id, binding, compact, maximized, touch } = chrome;
  const [layouts, setLayouts] = useState<'hover' | 'keyboard' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maximizeButton = useRef<HTMLButtonElement>(null);
  const flyout = useRef<HTMLDivElement>(null);
  const canSnap = binding.window.resizable && !compact;

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    timer.current = null;
    leaveTimer.current = null;
  };
  useEffect(() => clear, []);

  const intent = (how: 'hover' | 'keyboard') => {
    if (!canSnap || (how === 'hover' && touch)) return;
    clear();
    timer.current = setTimeout(() => setLayouts(how), SNAP_LAYOUTS_DELAY_MS);
  };
  const leave = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    leaveTimer.current = setTimeout(() => setLayouts(null), 300);
  };
  const choose = (zone: SnapZone) => {
    clear();
    setLayouts(null);
    chrome.snap(zone);
    maximizeButton.current?.focus({ preventScroll: true });
  };
  const zones = () => [...(flyout.current?.querySelectorAll<HTMLButtonElement>('[data-snap-zone]') ?? [])];
  const onFlyoutKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const list = zones();
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    const move = (delta: number) => {
      event.preventDefault();
      list[(index + delta + list.length) % list.length]?.focus({ preventScroll: true });
    };
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') move(1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') move(-1);
    else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setLayouts(null);
      maximizeButton.current?.focus({ preventScroll: true });
    }
  };

  return (
    <div className={styles.captions} role="group" aria-label="Window controls" data-no-drag="">
      <button
        type="button"
        className={styles.caption}
        data-caption="minimize"
        aria-label={`Minimize ${binding.title}`}
        onClick={() => dispatch({ type: 'MINIMIZE', id })}
      >
        <Fl icon={flMinimize} size={16} />
      </button>
      {compact ? null : (
        <span
          className={styles.maximizeSlot}
          onPointerLeave={leave}
          onPointerEnter={() => leaveTimer.current && clearTimeout(leaveTimer.current)}
        >
          <button
            ref={maximizeButton}
            type="button"
            className={styles.caption}
            data-caption="maximize"
            aria-label={`${maximized ? 'Restore' : 'Maximize'} ${binding.title}`}
            aria-describedby={layouts ? `${chrome.titleId}-layouts` : undefined}
            onClick={() => {
              clear();
              setLayouts(null);
              dispatch({ type: 'TOGGLE_MAXIMIZE', id });
            }}
            onPointerEnter={() => intent('hover')}
            onFocus={(event) => {
              if (event.currentTarget.matches(':focus-visible')) intent('keyboard');
            }}
            onBlur={(event) => {
              if (!flyout.current?.contains(event.relatedTarget as Node)) {
                clear();
                if (layouts === 'keyboard') setLayouts(null);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' && canSnap) {
                event.preventDefault();
                clear();
                setLayouts('keyboard');
                requestAnimationFrameSafe(() => zones()[0]?.focus({ preventScroll: true }));
              }
            }}
          >
            <Fl icon={maximized ? flRestore : flMaximize} size={16} />
          </button>
          {layouts ? (
            // Arrow keys move between the zone buttons inside; Esc / blur close the flyout (plans/windows/02).
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
            <div
              ref={flyout}
              id={`${chrome.titleId}-layouts`}
              className={styles.layouts}
              role="dialog"
              aria-label="Snap layouts"
              onKeyDown={onFlyoutKey}
              onBlur={(event) => {
                if (
                  !flyout.current?.contains(event.relatedTarget as Node) &&
                  event.relatedTarget !== maximizeButton.current
                )
                  setLayouts(null);
              }}
            >
              {SNAP_LAYOUTS.map((layout) => (
                <div key={layout.id} role="group" aria-label={layout.label} className={styles.layout}>
                  {layout.zones.map((zone) => (
                    <button
                      key={zone.zone}
                      type="button"
                      className={styles.zone}
                      data-snap-zone={zone.zone}
                      aria-label={zone.label}
                      style={{
                        left: `${zone.box[0] * 100}%`,
                        top: `${zone.box[1] * 100}%`,
                        width: `${zone.box[2] * 100}%`,
                        height: `${zone.box[3] * 100}%`,
                      }}
                      onClick={() => choose(zone.zone)}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </span>
      )}
      <button
        type="button"
        className={styles.caption}
        data-caption="close"
        aria-label={`Close ${binding.title}`}
        onClick={() => dispatch({ type: 'CLOSE_WINDOW', id })}
      >
        <Fl icon={flClose} size={16} />
      </button>
    </div>
  );
}

/** One frame later (the flyout has mounted) — the motion layer's own clock. */
function requestAnimationFrameSafe(callback: () => void) {
  setTimeout(callback, 0);
}

export { styles as windowStyles };
