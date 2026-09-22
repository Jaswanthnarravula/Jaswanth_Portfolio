/**
 * The commands macOS surfaces trigger — menu-bar items, context menus, notification actions, Spotlight actions, the
 * Control Center, keyboard shortcuts. Typed data (menus and notifications stay serialisable and testable); the shell
 * runs them (`runMacCommand` in Shell). App-specific commands ("View → as List", "Terminal → New Tab") travel over a
 * tiny per-app bus to the app that owns them, so menus never import app code.
 */
import { useEffect, useRef } from 'react';
import type { ContentRef } from '@/data/schema';
import type { AppRole } from '@/lib/kernel/ids';
import type { AppLocation, WindowId } from '@/lib/kernel/types';

export type SettingsPane = 'appearance' | 'accessibility' | 'sound' | 'desktop' | 'keyboard' | 'privacy' | 'general';

export type MacCommand =
  | { readonly kind: 'open'; readonly role: AppRole; readonly location?: AppLocation; readonly origin?: string }
  | { readonly kind: 'open-ref'; readonly ref: ContentRef; readonly origin?: string }
  | { readonly kind: 'resume-open'; readonly origin?: string }
  | { readonly kind: 'resume-download' }
  | { readonly kind: 'settings'; readonly pane?: SettingsPane }
  | { readonly kind: 'about-this-mac' }
  | { readonly kind: 'switch-os' }
  | { readonly kind: 'tour' }
  | { readonly kind: 'tour-dismiss' }
  | { readonly kind: 'lock' }
  | { readonly kind: 'restart' }
  /** The confirm sheet said yes: replay the startup beat. */
  | { readonly kind: 'restart-now' }
  | { readonly kind: 'about-app'; readonly role: AppRole }
  | { readonly kind: 'hide-app'; readonly role: AppRole }
  | { readonly kind: 'hide-others' }
  | { readonly kind: 'show-all' }
  | { readonly kind: 'quit'; readonly role: AppRole }
  | { readonly kind: 'close-window' }
  | { readonly kind: 'minimize' }
  | { readonly kind: 'zoom' }
  | { readonly kind: 'move' }
  | { readonly kind: 'size' }
  | { readonly kind: 'center' }
  | { readonly kind: 'tile'; readonly side: 'left' | 'right' | 'fill' }
  | { readonly kind: 'focus-window'; readonly id: WindowId }
  | { readonly kind: 'mission-control' }
  | { readonly kind: 'shortcuts' }
  | { readonly kind: 'plain' }
  | { readonly kind: 'spotlight'; readonly query?: string }
  | { readonly kind: 'notification-center' }
  | { readonly kind: 'control-center' }
  | { readonly kind: 'copy-link'; readonly ref: ContentRef }
  | { readonly kind: 'get-info'; readonly ref: ContentRef }
  | { readonly kind: 'quick-look'; readonly ref: ContentRef; readonly origin?: string | null }
  | { readonly kind: 'terminal-insert'; readonly command: string }
  | { readonly kind: 'select-all-desktop' }
  | { readonly kind: 'app'; readonly role: AppRole; readonly command: string; readonly arg?: string };

// --- The per-app bus ------------------------------------------------------------------------------------------------

export type AppCommandHandler = (command: string, arg?: string) => void;

const handlers = new Map<AppRole, Set<AppCommandHandler>>();

/** Deliver an app command to the (mounted) app; returns false when the app is not listening. */
export function emitAppCommand(role: AppRole, command: string, arg?: string): boolean {
  const set = handlers.get(role);
  if (!set?.size) return false;
  for (const handler of set) handler(command, arg);
  return true;
}

/** An app listens for its own commands while it is mounted (the latest handler is always used). */
export function useAppCommands(role: AppRole, handler: AppCommandHandler): void {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    const listener: AppCommandHandler = (command, arg) => latest.current(command, arg);
    const set = handlers.get(role) ?? new Set();
    set.add(listener);
    handlers.set(role, set);
    return () => {
      set.delete(listener);
    };
  }, [role]);
}
