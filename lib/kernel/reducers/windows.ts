/**
 * Window lifecycle helpers — shared/04 phase guard table (`KRN-WIN-*`) and z-order array (`KRN-Z-01`).
 * Pure functions over one `OsSession`; illegal transitions return the same reference.
 */
import type { SizeClass } from '../ids';
import { clampGeometry, rectFor, sameRect, type Workspace } from '../geometry';
import { isFocusable, sameLocation, topmostFocusable, currentLocation } from '../state';
import type { AppLocation, OsAppBinding, OsSession, PxRect, Viewport, WindowId, WindowInstance } from '../types';

export const workspaceOf = (viewport: Viewport): Workspace => ({ x: 0, y: 0, w: viewport.w, h: viewport.h });

/** Move `id` to the front of the z-order (end of the array). */
export function raise(zOrder: readonly WindowId[], id: WindowId): readonly WindowId[] {
  if (zOrder[zOrder.length - 1] === id) return zOrder;
  return [...zOrder.filter((existing) => existing !== id), id];
}

export function withWindow(session: OsSession, window: WindowInstance): OsSession {
  if (session.windows[window.id] === window) return session;
  return { ...session, windows: { ...session.windows, [window.id]: window } };
}

export function removeWindow(session: OsSession, id: WindowId): OsSession {
  const windows = { ...session.windows };
  delete windows[id];
  const zOrder = session.zOrder.filter((existing) => existing !== id);
  return {
    ...session,
    windows,
    zOrder,
    focused: session.focused === id ? topmostFocusable({ ...session, windows, zOrder }) : session.focused,
  };
}

/** Raise + focus. Returns the same session when it is already the focused, topmost window. */
export function focusWindow(session: OsSession, id: WindowId): OsSession {
  const zOrder = raise(session.zOrder, id);
  if (zOrder === session.zOrder && session.focused === id) return session;
  return { ...session, zOrder, focused: id };
}

/** Push a location onto a window's in-app stack (forward entries are truncated). Same location → same window. */
export function pushLocation(window: WindowInstance, location: AppLocation): WindowInstance {
  if (sameLocation(currentLocation(window), location)) return window;
  const entries = [...window.nav.entries.slice(0, window.nav.index + 1), location].slice(-50);
  return { ...window, nav: { entries, index: entries.length - 1 }, scrollTop: 0 };
}

/**
 * Move to a location the URL names: an adjacent stack entry is reused (Back/Forward), anything else is pushed.
 * This keeps the in-app stack aligned with browser traversal.
 */
export function seekLocation(window: WindowInstance, location: AppLocation): WindowInstance {
  const { entries, index } = window.nav;
  if (sameLocation(entries[index]!, location)) return window;
  if (index > 0 && sameLocation(entries[index - 1]!, location))
    return { ...window, nav: { entries, index: index - 1 } };
  if (index < entries.length - 1 && sameLocation(entries[index + 1]!, location))
    return { ...window, nav: { entries, index: index + 1 } };
  return pushLocation(window, location);
}

export function createWindow(
  binding: OsAppBinding,
  session: OsSession,
  location: AppLocation,
  {
    originId,
    invoker,
    sizeClass,
    viewport,
    learned,
    animate,
  }: {
    originId: string | null;
    invoker: string | null;
    sizeClass: SizeClass;
    viewport: Viewport;
    learned?: Partial<Record<SizeClass, PxRect>>;
    animate: boolean;
  },
): WindowInstance {
  const rect: Partial<Record<SizeClass, PxRect>> = {};
  if (binding.window.mode === 'floating')
    rect[sizeClass] = clampGeometry(
      rectFor({ rect: {} }, sizeClass, binding.window, learned),
      workspaceOf(viewport),
      binding.window.minPx,
    );
  return {
    id: `${session.os}:${binding.role}` as WindowId,
    os: session.os,
    role: binding.role,
    phase: animate ? { s: 'opening', originId } : { s: 'normal' },
    rect,
    nav: { entries: [location], index: 0 },
    scrollTop: 0,
    invoker,
  };
}

/** Current rect for the active size class (bucket → learned → policy default), clamped. */
export function currentRect(
  window: WindowInstance,
  binding: OsAppBinding,
  sizeClass: SizeClass,
  viewport: Viewport,
  learned?: Partial<Record<SizeClass, PxRect>>,
): PxRect {
  return clampGeometry(
    rectFor(window, sizeClass, binding.window, learned),
    workspaceOf(viewport),
    binding.window.minPx,
  );
}

/** Store a committed rect in the size-class bucket. Same rect → same window. */
export function commitRect(window: WindowInstance, sizeClass: SizeClass, rect: PxRect): WindowInstance {
  if (sameRect(window.rect[sizeClass], rect) && window.phase.s === 'normal') return window;
  return {
    ...window,
    rect: { ...window.rect, [sizeClass]: rect },
    phase: window.phase.s === 'maximized' ? { s: 'normal' } : window.phase,
  };
}

/** Next focus after `id` leaves: the topmost other focusable window. */
export const nextFocus = (session: OsSession, id: WindowId): WindowId | null => topmostFocusable(session, id);

export { isFocusable };
