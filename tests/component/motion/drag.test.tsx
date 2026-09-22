/**
 * MOTION-DRAG-01 — `drag()`: the pointer handler only stores coordinates, the ticker applies them, the drag starts
 * past a threshold (clicks stay clicks), and the result is committed exactly once — on release with the final pointer
 * position, or on an interruption (pointercancel, lost capture, blur, resize) with the last position actually drawn.
 */
import { describe, expect, it, vi } from 'vitest';
import { drag, type DragEndReason } from '@/lib/motion/drag';
import { liveTickers } from '@/lib/motion/debug';

function manualTicker() {
  const callbacks = new Set<() => void>();
  return {
    add: (callback: () => void) => void callbacks.add(callback),
    remove: (callback: () => void) => void callbacks.delete(callback),
    tick: () => {
      for (const callback of [...callbacks]) callback();
    },
    get size() {
      return callbacks.size;
    },
  };
}

const pointer = (type: string, x: number, y: number) =>
  new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true, button: 0 });

function setup() {
  const handle = document.createElement('div');
  document.body.append(handle);
  const ticker = manualTicker();
  const moves: [number, number][] = [];
  const ends: { dx: number; dy: number; moved: boolean; reason: DragEndReason }[] = [];
  const onStart = vi.fn();
  const session = drag(handle, pointer('pointerdown', 100, 100), {
    ticker,
    onStart,
    onMove: (dx, dy) => moves.push([dx, dy]),
    onEnd: (result) => ends.push(result),
  });
  return { handle, ticker, moves, ends, onStart, session };
}

describe('MOTION-DRAG-01 drag()', () => {
  it('moves only on the ticker, after the threshold, and commits once on release', () => {
    const { handle, ticker, moves, ends, onStart } = setup();
    handle.dispatchEvent(pointer('pointermove', 101, 101)); // under the 3 px threshold
    ticker.tick();
    expect(onStart).not.toHaveBeenCalled();
    expect(moves).toEqual([]);
    handle.dispatchEvent(pointer('pointermove', 120, 90));
    handle.dispatchEvent(pointer('pointermove', 130, 80)); // two events, one frame: only the latest is applied
    expect(moves).toEqual([]);
    ticker.tick();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(moves).toEqual([[30, -20]]);
    ticker.tick(); // no new pointer data → nothing written
    expect(moves).toHaveLength(1);
    handle.dispatchEvent(pointer('pointerup', 140, 70));
    expect(ends).toEqual([{ dx: 40, dy: -30, moved: true, reason: 'release' }]);
    handle.dispatchEvent(pointer('pointerup', 150, 70)); // nothing after the end
    handle.dispatchEvent(new Event('lostpointercapture'));
    expect(ends).toHaveLength(1);
    expect(ticker.size).toBe(0);
  });

  it('a press without travel is a click: it ends unmoved', () => {
    const { handle, ends, onStart } = setup();
    handle.dispatchEvent(pointer('pointerup', 101, 100));
    expect(onStart).not.toHaveBeenCalled();
    expect(ends).toEqual([{ dx: 0, dy: 0, moved: false, reason: 'release' }]);
  });

  it.each([
    ['pointercancel', 'cancel', (h: HTMLElement) => h.dispatchEvent(pointer('pointercancel', 0, 0))],
    ['lostpointercapture', 'lost-capture', (h: HTMLElement) => h.dispatchEvent(new Event('lostpointercapture'))],
    ['window blur', 'blur', () => window.dispatchEvent(new Event('blur'))],
    ['a resize / rotation', 'resize', () => window.dispatchEvent(new Event('resize'))],
  ] as const)('%s commits the last position that was drawn', (_name, reason, interrupt) => {
    const { handle, ticker, ends } = setup();
    handle.dispatchEvent(pointer('pointermove', 150, 160));
    ticker.tick(); // drawn: (50, 60)
    handle.dispatchEvent(pointer('pointermove', 400, 400)); // not yet drawn
    interrupt(handle);
    expect(ends).toEqual([{ dx: 50, dy: 60, moved: true, reason }]);
  });

  it('end() finishes from code and every ticker callback is released', () => {
    const before = liveTickers();
    const { ends, session } = setup();
    expect(liveTickers()).toBe(before + 1);
    session.end();
    expect(ends).toEqual([{ dx: 0, dy: 0, moved: false, reason: 'abort' }]);
    expect(liveTickers()).toBe(before);
  });
});
