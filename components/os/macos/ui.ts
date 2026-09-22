/**
 * macOS transient UI state — overlays, banners, the Notification Center, the lock screen, which app chunks are loading
 * (the Dock bounce), the tour, and pending Terminal inserts. Transient by design: overlays are never persisted
 * (shared/04 restore rules), and nothing animated lives here (animated values are written to the DOM). A tiny vanilla
 * Zustand store (the stack's state container), so surfaces subscribe to exactly the slice they draw.
 */
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { ContentRef } from '@/data/schema';
import type { AppRole } from '@/lib/kernel/ids';
import { focusKeys } from '@/lib/kernel/types';
import { arbitrateMac, type MacOverlay } from './arbiter';
import { enqueue, notificationFor, type MacNotification, type Trigger } from './notifications';

export type ContextTarget =
  | { readonly kind: 'desktop' }
  | { readonly kind: 'item'; readonly ref: ContentRef; readonly label: string; readonly download?: boolean }
  | { readonly kind: 'dock'; readonly role: AppRole }
  | { readonly kind: 'dock-resume' }
  | { readonly kind: 'handoff' }
  | { readonly kind: 'titlebar'; readonly role: AppRole };

export type MacDialog =
  | { readonly kind: 'switch-os' }
  | { readonly kind: 'shortcuts' }
  | { readonly kind: 'about-this-mac' }
  | { readonly kind: 'restart' }
  | { readonly kind: 'get-info'; readonly ref: ContentRef }
  /** Quick Look (Finder's Space): `origin` is the element the sheet scales from and focus returns to. */
  | { readonly kind: 'quick-look'; readonly ref: ContentRef; readonly origin?: string | null }
  | { readonly kind: 'about-app'; readonly role: AppRole };

export interface MacUiState {
  /** The one transient surface on screen (banners are separate and never compete). */
  readonly overlay: MacOverlay | null;
  /** Where a context menu was invoked, and for what (null when closed). */
  readonly context: {
    readonly target: ContextTarget;
    readonly x: number;
    readonly y: number;
    readonly invoker: string | null;
  } | null;
  readonly dialog: MacDialog | null;
  readonly spotlightQuery: string;
  /** Banner queue: the first is on screen. */
  readonly banners: readonly MacNotification[];
  /** Every notification of the session, newest first. */
  readonly center: readonly MacNotification[];
  readonly shownOnce: readonly string[];
  readonly locked: boolean;
  /** App chunks still loading (their Dock icons bounce). */
  readonly loading: readonly AppRole[];
  /** A command waiting for the Terminal to mount (Spotlight "Run in Terminal" — inserted, never executed). */
  readonly terminalInsert: string | null;
  readonly tour: 'idle' | 'running';
  /** A window drag is in progress: banners wait for its commit (surfaces/notifications.md edge cases). */
  readonly dragging: boolean;
}

const initial: MacUiState = {
  overlay: null,
  context: null,
  dialog: null,
  spotlightQuery: '',
  banners: [],
  center: [],
  shownOnce: [],
  locked: false,
  loading: [],
  terminalInsert: null,
  tour: 'idle',
  dragging: false,
};

export const macUi = createStore<MacUiState>()(() => initial);

export const useMacUi = <T>(selector: (state: MacUiState) => T): T => useStore(macUi, selector);

const set = (patch: Partial<MacUiState>) => macUi.setState(patch);

let sequence = 0;

/** What had focus when each overlay was asked for: focus returns there when it closes without opening anything. */
const invokers = new Map<MacOverlay, Element | null>();
export const overlayInvoker = (kind: MacOverlay): Element | null => invokers.get(kind) ?? null;

/**
 * Focus back where an overlay was invoked from — or, when that element is gone, was <body> or is now inert, onto the
 * desktop's heading: focus never rests on <body> (shared/09).
 */
export function returnFocus(kind: MacOverlay, doc: Document | undefined = globalThis.document): void {
  if (!doc) return;
  const target = invokers.get(kind);
  const usable =
    target instanceof HTMLElement && target.isConnected && target !== doc.body && !target.closest('[inert]');
  const fallback = doc.querySelector<HTMLElement>(`[data-focus-key="${focusKeys.osHeading}"]`);
  (usable ? target : fallback)?.focus({ preventScroll: true });
}

/**
 * Ask for a transient surface. The arbiter decides (modal dialog › menu › Spotlight › Mission Control › banner):
 * returns false when it is dropped. Menus and popovers close themselves when replaced.
 */
export function requestOverlay(kind: MacOverlay): boolean {
  const state = macUi.getState();
  if (state.dragging && kind === 'spotlight') return false; // Spotlight during a drag is ignored (E15)
  const verdict = arbitrateMac(state.overlay, kind);
  if (verdict === 'drop') return false;
  if (verdict === 'coexist') return true;
  if (typeof document !== 'undefined' && state.overlay !== kind) invokers.set(kind, document.activeElement);
  set({ overlay: kind, ...(kind !== 'context' ? { context: null } : {}) });
  return true;
}

export function closeOverlay(kind: MacOverlay): void {
  const state = macUi.getState();
  if (state.overlay !== kind) return;
  set({
    overlay: null,
    ...(kind === 'context' ? { context: null } : {}),
    ...(kind === 'dialog' ? { dialog: null } : {}),
  });
}

export function openContextMenu(target: ContextTarget, x: number, y: number, invoker: string | null): void {
  if (!requestOverlay('context')) return;
  set({ context: { target, x, y, invoker } });
}

export function openDialog(dialog: MacDialog): void {
  if (!requestOverlay('dialog')) return;
  set({ dialog });
}

export function closeDialog(): void {
  closeOverlay('dialog');
}

/** Post a notification: it always lands in the Center; its banner queues (coalesced in arrival order). */
export function notify(trigger: Trigger, now = Date.now()): MacNotification | null {
  const spec = notificationFor(trigger);
  const state = macUi.getState();
  if (spec.once && state.shownOnce.includes(spec.once)) return null;
  const notification: MacNotification = { ...spec, id: `n${++sequence}`, at: now };
  set({
    banners: enqueue(state.banners, notification),
    center: [notification, ...state.center].slice(0, 50),
    shownOnce: spec.once ? [...state.shownOnce, spec.once] : state.shownOnce,
  });
  return notification;
}

export function dismissBanner(id: string): void {
  set({ banners: macUi.getState().banners.filter((banner) => banner.id !== id) });
}

export function clearCenter(app?: MacNotification['app']): void {
  const state = macUi.getState();
  set({ center: app ? state.center.filter((item) => item.app !== app) : [] });
}

export function setLoading(role: AppRole, loading: boolean): void {
  const current = macUi.getState().loading;
  const has = current.includes(role);
  if (loading === has) return;
  set({ loading: loading ? [...current, role] : current.filter((item) => item !== role) });
}

export const setLocked = (locked: boolean) => set({ locked });
export const setDragging = (dragging: boolean) => set({ dragging });
export const setSpotlightQuery = (spotlightQuery: string) => set({ spotlightQuery });
export const setTerminalInsert = (terminalInsert: string | null) => set({ terminalInsert });
export const setTour = (tour: MacUiState['tour']) => set({ tour });

/** Test seam: forget everything (a new macOS mount starts clean too). */
export function resetMacUi(): void {
  sequence = 0;
  macUi.setState(initial, true);
  // The remembered invokers are elements of this mount: an element keeps its ancestors alive, so they go with it
  // (`PERF-LEAK-01`: nothing detached is kept alive; the shell resets this on mount and on unmount).
  invokers.clear();
}

// --- App state the menu bar reflects (checkmarks such as "as List", "Text Version") -------------------------------

export const appStateStore = createStore<Readonly<Record<string, string | boolean | undefined>>>()(() => ({}));

export const setAppState = (key: string, value: string | boolean | undefined) => {
  if (appStateStore.getState()[key] === value) return;
  appStateStore.setState({ [key]: value });
};

export const useAppState = () => useStore(appStateStore);
