'use client';
/**
 * Press / LongPress — shared/09 `A11Y-PRIM-05`. A 500 ms long-press (cancelled by moving more than 10 px) opens the
 * item's menu; the keyboard / assistive-tech equivalent is the `contextmenu` event (Shift+F10, Menu key, VoiceOver's
 * Ctrl+Opt+Shift+M). Plain presses stay native clicks, so Enter and Space work. No React state: refs only.
 */
import { useLayoutEffect, useMemo, useRef, type MouseEvent, type PointerEvent } from 'react';

export interface PressOptions {
  readonly onPress?: () => void;
  readonly onLongPress?: (origin: 'pointer' | 'keyboard', point: { x: number; y: number }) => void;
  readonly delay?: number;
  readonly tolerance?: number;
}

export interface PressHandlers {
  onPointerDown(event: PointerEvent<HTMLElement>): void;
  onPointerMove(event: PointerEvent<HTMLElement>): void;
  onPointerUp(event: PointerEvent<HTMLElement>): void;
  onPointerCancel(event: PointerEvent<HTMLElement>): void;
  onClick(event: MouseEvent<HTMLElement>): void;
  onContextMenu(event: MouseEvent<HTMLElement>): void;
}

export const LONG_PRESS_MS = 500;
export const LONG_PRESS_TOLERANCE_PX = 10;

export function usePress({
  onPress,
  onLongPress,
  delay = LONG_PRESS_MS,
  tolerance = LONG_PRESS_TOLERANCE_PX,
}: PressOptions): PressHandlers {
  const callbacks = useRef({ onPress, onLongPress });
  useLayoutEffect(() => {
    callbacks.current = { onPress, onLongPress };
  });
  const state = useRef<{
    timer: ReturnType<typeof setTimeout> | null;
    x: number;
    y: number;
    fired: boolean;
    firedAt: number;
  }>({
    timer: null,
    x: 0,
    y: 0,
    fired: false,
    firedAt: 0,
  });

  return useMemo<PressHandlers>(() => {
    const cancel = () => {
      if (state.current.timer) clearTimeout(state.current.timer);
      state.current.timer = null;
    };
    return {
      onPointerDown(event) {
        // Primary button only (some environments omit `button` / `isPrimary`; treat missing as primary).
        if (event.isPrimary === false || event.button > 0) return;
        cancel();
        const { clientX: x, clientY: y } = event;
        state.current = { ...state.current, x, y, fired: false };
        if (!callbacks.current.onLongPress) return;
        state.current.timer = setTimeout(() => {
          state.current.timer = null;
          state.current.fired = true;
          state.current.firedAt = Date.now();
          callbacks.current.onLongPress?.('pointer', { x, y });
        }, delay);
      },
      onPointerMove(event) {
        if (!state.current.timer) return;
        if (Math.hypot(event.clientX - state.current.x, event.clientY - state.current.y) > tolerance) cancel();
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onClick(event) {
        if (state.current.fired) {
          // The long press already acted; swallow the click that follows the release.
          event.preventDefault();
          state.current.fired = false;
          return;
        }
        callbacks.current.onPress?.();
      },
      onContextMenu(event) {
        if (!callbacks.current.onLongPress) return;
        event.preventDefault();
        // Touch browsers fire contextmenu after their own long-press: one menu, not two.
        if (Date.now() - state.current.firedAt < 700) return;
        cancel();
        const origin = event.button === 2 ? 'pointer' : 'keyboard';
        callbacks.current.onLongPress(origin, { x: event.clientX, y: event.clientY });
      },
    };
  }, [delay, tolerance]);
}
