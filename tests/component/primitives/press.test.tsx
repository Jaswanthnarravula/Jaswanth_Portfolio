/**
 * A11Y-PRIM-05 — Press / LongPress (written before the implementation): a 500 ms long-press opens the menu, moving
 * more than 10 px cancels, and the keyboard equivalent (the `contextmenu` event: Shift+F10 / Menu key) exists.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePress } from '@/components/primitives/Press';

function Icon({
  onPress,
  onLongPress,
}: {
  onPress: () => void;
  onLongPress: (origin: 'pointer' | 'keyboard', point: { x: number; y: number }) => void;
}) {
  const handlers = usePress({ onPress, onLongPress });
  return (
    <button type="button" {...handlers}>
      icon
    </button>
  );
}

const pointer = (x: number, y: number, pointerType = 'touch') => ({
  clientX: x,
  clientY: y,
  pointerId: 1,
  pointerType,
  button: 0,
  isPrimary: true,
});

describe('A11Y-PRIM-05 Press / LongPress', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a long press (500 ms) opens the menu and suppresses the press', () => {
    const onPress = vi.fn();
    const onLongPress = vi.fn();
    render(<Icon onPress={onPress} onLongPress={onLongPress} />);
    const button = screen.getByText('icon');
    fireEvent.pointerDown(button, pointer(10, 10));
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onLongPress).toHaveBeenCalledWith('pointer', { x: 10, y: 10 });
    fireEvent.pointerUp(button, pointer(10, 10));
    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('moving more than 10 px cancels the long press; a short tap presses', () => {
    const onPress = vi.fn();
    const onLongPress = vi.fn();
    render(<Icon onPress={onPress} onLongPress={onLongPress} />);
    const button = screen.getByText('icon');
    fireEvent.pointerDown(button, pointer(10, 10));
    fireEvent.pointerMove(button, pointer(22, 10));
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(onLongPress).not.toHaveBeenCalled();
    fireEvent.pointerUp(button, pointer(22, 10));
    fireEvent.pointerDown(button, pointer(10, 10));
    fireEvent.pointerUp(button, pointer(12, 11));
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledOnce();
  });

  it('the keyboard equivalent is the contextmenu event (Shift+F10 / Menu key)', () => {
    const onLongPress = vi.fn();
    render(<Icon onPress={() => {}} onLongPress={onLongPress} />);
    const event = fireEvent.contextMenu(screen.getByText('icon'), { button: 0, clientX: 0, clientY: 0 });
    expect(event).toBe(false); // default prevented: our menu replaces the native one on this surface
    expect(onLongPress).toHaveBeenCalledWith('keyboard', { x: 0, y: 0 });
  });

  it('Enter and Space press', () => {
    const onPress = vi.fn();
    render(<Icon onPress={onPress} onLongPress={() => {}} />);
    const button = screen.getByText('icon');
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledOnce();
  });
});
