/**
 * `drag()` — shared/07 "Primitives" (`MOTION-DRAG-01`): pointer capture; the pointer handler only stores coordinates;
 * the ticker (GSAP's, the one clock) applies them; the result is committed once, on `pointerup` — or, when the drag is
 * interrupted (`pointercancel`, `lostpointercapture`, window blur, resize / rotation), with the last delta that was
 * actually applied, i.e. the last valid position (shared/04 edge cases). Nothing here touches React state.
 * A drag only starts after the pointer travels `threshold` px, so clicks and double-clicks on a handle stay clicks.
 */
import { gsap } from 'gsap';
import type { Ticker } from './flight';
import { tickerAdded, tickerRemoved } from './debug';

export type DragEndReason = 'release' | 'cancel' | 'lost-capture' | 'blur' | 'resize' | 'abort';

export interface DragOptions {
  /** The drag crossed the threshold (kill competing animations, mark the element as dragging). */
  readonly onStart?: () => void;
  /** On the ticker, with the latest pointer delta since the press. Write transforms here — nothing else. */
  readonly onMove: (dx: number, dy: number) => void;
  /** Once. `moved` is false when the pointer never crossed the threshold (it was a click). */
  readonly onEnd: (result: { dx: number; dy: number; moved: boolean; reason: DragEndReason }) => void;
  readonly threshold?: number;
  readonly ticker?: Ticker;
}

export interface DragSession {
  /** End now (e.g. a keyboard shortcut or an OS switch) with the last applied delta. */
  end(reason?: DragEndReason): void;
}

export const DRAG_THRESHOLD_PX = 3;

export function drag(handle: HTMLElement, press: PointerEvent, options: DragOptions): DragSession {
  const { onStart, onMove, onEnd, threshold = DRAG_THRESHOLD_PX, ticker = gsap.ticker } = options;
  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  const startX = press.clientX;
  const startY = press.clientY;
  const pointerId = press.pointerId;
  let latest = { dx: 0, dy: 0 };
  let applied = { dx: 0, dy: 0 };
  let moved = false;
  let ended = false;

  try {
    handle.setPointerCapture(pointerId);
  } catch {
    // A synthetic or already-released pointer: the window-level listeners below still end the drag.
  }

  const tick = () => {
    if (!moved) {
      if (Math.hypot(latest.dx, latest.dy) < threshold) return;
      moved = true;
      onStart?.();
    }
    if (latest.dx === applied.dx && latest.dy === applied.dy) return;
    applied = latest;
    onMove(applied.dx, applied.dy);
  };
  ticker.add(tick);
  tickerAdded();

  const finish = (reason: DragEndReason, final?: { dx: number; dy: number }) => {
    if (ended) return;
    ended = true;
    // A release lands where the pointer is; an interruption keeps the last position that was drawn.
    if (reason === 'release' && final) {
      latest = final;
      if (!moved && Math.hypot(final.dx, final.dy) >= threshold) {
        moved = true;
        onStart?.();
      }
      if (moved) {
        applied = final;
        onMove(applied.dx, applied.dy);
      }
    }
    ticker.remove(tick);
    tickerRemoved();
    lifecycle.abort();
    try {
      if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
    } catch {
      // already released
    }
    onEnd({ dx: applied.dx, dy: applied.dy, moved, reason });
  };

  const delta = (event: PointerEvent) => ({ dx: event.clientX - startX, dy: event.clientY - startY });
  handle.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerId === pointerId) latest = delta(event);
    },
    { signal, passive: true },
  );
  handle.addEventListener(
    'pointerup',
    (event) => {
      if (event.pointerId === pointerId) finish('release', delta(event));
    },
    { signal },
  );
  handle.addEventListener('pointercancel', () => finish('cancel'), { signal });
  handle.addEventListener('lostpointercapture', () => finish('lost-capture'), { signal });
  window.addEventListener('blur', () => finish('blur'), { signal });
  window.addEventListener('resize', () => finish('resize'), { signal });

  return { end: (reason = 'abort') => finish(reason) };
}
