/**
 * Window-menu geometry commands (plans/macos/02-window-manager.md `MAC-WM-09`, 04-responsive "Tile Left / Tile Right /
 * Fill"): the menu bar asks for a mode on a window; the window that is mounted with that id handles it (keyboard move
 * and size modes, centring, tiling). A tiny registry so menus never import window code.
 */
import type { WindowId } from '@/lib/kernel/types';

export type WindowMode = 'move' | 'size' | 'center' | 'tile-left' | 'tile-right' | 'fill';

const handlers = new Map<WindowId, (mode: WindowMode) => void>();

export function onWindowMode(id: WindowId, handler: (mode: WindowMode) => void): () => void {
  handlers.set(id, handler);
  return () => {
    if (handlers.get(id) === handler) handlers.delete(id);
  };
}

/** Returns false when no mounted window has that id. */
export function requestWindowMode(id: WindowId, mode: WindowMode): boolean {
  const handler = handlers.get(id);
  if (!handler) return false;
  handler(mode);
  return true;
}
