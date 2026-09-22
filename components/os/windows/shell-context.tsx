'use client';
/**
 * The Windows shell's services for its windows, surfaces and apps: the snap preview, the polite status line, toasts,
 * context menus, the transient panels, the search hand-off. Provided once by the Shell; nothing here is kernel state
 * (the kernel owns windows and URLs; these are the shell's own transient surfaces).
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { ContentRef } from '@/data/schema';
import type { AppRole } from '@/lib/kernel/ids';
import type { PxRect, WindowId } from '@/lib/kernel/types';
import type { MenuCommand, MenuEntry } from '@/components/primitives/Menu';
import type { Panel } from './model';

export interface ToastAction {
  readonly label: string;
  readonly primary?: boolean;
  readonly run: () => void;
}

/** A notification (plans/windows/surfaces/notification-center "Trigger table"). */
export interface ToastSpec {
  /** Stable id: the same trigger never stacks twice. */
  readonly id: string;
  readonly app: AppRole | 'system';
  readonly appName: string;
  readonly title: string;
  readonly body?: string;
  readonly actions?: readonly ToastAction[];
  /** Clicking the body runs the primary action. */
  readonly primary?: () => void;
  /** Continuity offers expire from the Center after 10 minutes. */
  readonly expires?: number;
  /** A taskbar app whose pill pulses while this toast shows (needs attention). */
  readonly attention?: AppRole;
  /** Dismissing it (✕ or Dismiss) runs this as well. */
  readonly onDismiss?: () => void;
}

export interface ContextMenuSpec {
  readonly label: string;
  readonly at: { readonly x: number; readonly y: number };
  readonly items: readonly MenuEntry[];
  readonly commands?: readonly MenuCommand[];
  /** "Show more options": the legacy list that replaces the menu in place. */
  readonly legacy?: readonly MenuEntry[];
  readonly returnFocusTo?: HTMLElement | null;
}

/** The Properties dialog (desktop items, File Explorer rows — plans/windows/surfaces/context-menus). */
export interface PropertiesSpec {
  readonly title: string;
  readonly rows: readonly (readonly [label: string, value: string])[];
  /** The item's canonical link (Copy link inside the dialog; shown selected when the clipboard is blocked). */
  readonly ref: ContentRef | null;
}

export interface SearchRequest {
  readonly query?: string;
  /** Opened from VS Code's command centre: results scoped to files (skills and projects). */
  readonly scope?: 'files';
  readonly invoker?: HTMLElement | null;
}

export interface WinShellServices {
  readonly announce: (message: string) => void;
  readonly snapPreview: { show(rect: PxRect, label: string): void; hide(): void };
  readonly notify: (toast: ToastSpec) => void;
  readonly openMenu: (spec: ContextMenuSpec) => void;
  readonly openPanel: (panel: Panel, invoker?: HTMLElement | null) => void;
  readonly closePanel: () => void;
  readonly openSearch: (request: SearchRequest) => void;
  /** Open Windows Terminal with a command inserted at the prompt — never executed (shared/15 `SRCH-TERM-01`). */
  readonly runInTerminal: (command: string) => void;
  readonly openWinver: () => void;
  /** Start the guided tour (shared/20; restart points: Settings, Search, the ? dialog, Start's user menu). */
  readonly startTour: () => void;
  /** The keyboard shortcuts dialog (the `?` key; shared/09 registry). */
  readonly showShortcuts: () => void;
  /** Copy the item's canonical `/go/*` link; resolves false when the clipboard is blocked (show the link selected). */
  readonly copyLink: (ref: ContentRef | null, label?: string) => Promise<boolean>;
  /** Clipboard with a toast ("Copied to clipboard"); resolves false when blocked (the caller shows the text selected). */
  readonly copyText: (text: string, message?: string) => Promise<boolean>;
  readonly openProperties: (spec: PropertiesSpec) => void;
  readonly setDragging: (dragging: boolean) => void;
  readonly peek: WindowId | null;
}

const Services = createContext<WinShellServices | null>(null);

export function WinShellProvider({
  value,
  children,
}: {
  readonly value: WinShellServices;
  readonly children: ReactNode;
}) {
  return <Services.Provider value={value}>{children}</Services.Provider>;
}

/** The shell's services; a no-op set outside the shell (isolated component tests). */
export function useWinShell(): WinShellServices {
  return useContext(Services) ?? FALLBACK;
}

const FALLBACK: WinShellServices = {
  announce: () => undefined,
  snapPreview: { show: () => undefined, hide: () => undefined },
  notify: () => undefined,
  openMenu: () => undefined,
  openPanel: () => undefined,
  closePanel: () => undefined,
  openSearch: () => undefined,
  runInTerminal: () => undefined,
  openWinver: () => undefined,
  startTour: () => undefined,
  showShortcuts: () => undefined,
  copyLink: () => Promise.resolve(false),
  copyText: () => Promise.resolve(false),
  openProperties: () => undefined,
  setDragging: () => undefined,
  peek: null,
};
