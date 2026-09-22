/**
 * Window lifecycle helpers — shared/04 phase guard table (`KRN-WIN-*`) and z-order array (`KRN-Z-01`).
 * Pure functions over one `OsSession`; illegal transitions return the same reference.
 */
import type { SizeClass } from '../ids';
import { clampGeometry, rectFor, sameRect, workspaceFor, type Workspace } from '../geometry';
import { isFocusable, sameLocation, topmostFocusable, currentLocation } from '../state';
import type {
  AppLocation,
  OsAppBinding,
  OsSession,
  PxRect,
  Viewport,
  WindowId,
  WindowInstance,
  WorkspaceInsets,
} from '../types';

/** The window workspace for a viewport: the page minus the OS chrome's insets (menu bar, Dock, taskbar). */
export const workspaceOf = (viewport: Viewport, insets?: WorkspaceInsets): Workspace => workspaceFor(viewport, insets);

/** New windows that would open exactly on top of another step down-right by this much (a real desktop's cascade). */
export const CASCADE_PX = 24;
const SAME_ORIGIN_PX = 8;

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

/**
 * Cascade: while another open window (not minimized, not closing) already sits at the candidate's origin, step
 * +24 px right and down — so two windows that share a default position never stack exactly.
 */
export function cascadeRect(
  rect: PxRect,
  session: OsSession,
  sizeClass: SizeClass,
  workspace: Workspace,
  minPx: { w: number; h: number },
  step = CASCADE_PX,
): PxRect {
  const origins = Object.values(session.windows)
    .filter((window): window is WindowInstance => isFocusable(window))
    .map((window) => window.rect[sizeClass])
    .filter((other): other is PxRect => !!other);
  let candidate = rect;
  for (let attempt = 0; attempt < 12; attempt++) {
    const taken = origins.some(
      (other) => Math.abs(other.x - candidate.x) < SAME_ORIGIN_PX && Math.abs(other.y - candidate.y) < SAME_ORIGIN_PX,
    );
    if (!taken) return candidate;
    const next = clampGeometry({ ...candidate, x: candidate.x + step, y: candidate.y + step }, workspace, minPx);
    if (next.x === candidate.x && next.y === candidate.y) return candidate;
    candidate = next;
  }
  return candidate;
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
    insets,
    learned,
    animate,
  }: {
    originId: string | null;
    invoker: string | null;
    sizeClass: SizeClass;
    viewport: Viewport;
    insets?: WorkspaceInsets;
    learned?: Partial<Record<SizeClass, PxRect>>;
    animate: boolean;
  },
): WindowInstance {
  const rect: Partial<Record<SizeClass, PxRect>> = {};
  if (binding.window.mode === 'floating') {
    const workspace = workspaceOf(viewport, insets);
    const placed = clampGeometry(
      rectFor({ rect: {} }, sizeClass, binding.window, learned, viewport, insets),
      workspace,
      binding.window.minPx,
    );
    // A learned rect is where the visitor put this window: honour it exactly. Defaults cascade.
    rect[sizeClass] = learned?.[sizeClass]
      ? placed
      : cascadeRect(placed, session, sizeClass, workspace, binding.window.minPx, binding.window.cascadePx);
  }
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
  insets?: WorkspaceInsets,
): PxRect {
  return clampGeometry(
    rectFor(window, sizeClass, binding.window, learned, viewport, insets),
    workspaceOf(viewport, insets),
    binding.window.minPx,
  );
}

/**
 * Store a committed rect in the size-class bucket. Same rect → same window. A committed move or resize is where the
 * visitor put the window, so it also leaves Snap (dragging a snapped window away floats it — plans/windows/02).
 */
export function commitRect(window: WindowInstance, sizeClass: SizeClass, rect: PxRect): WindowInstance {
  if (sameRect(window.rect[sizeClass], rect) && window.phase.s === 'normal' && !window.snap) return window;
  const { snap: _snap, ...floating } = window;
  return {
    ...floating,
    rect: { ...window.rect, [sizeClass]: rect },
    phase: window.phase.s === 'maximized' ? { s: 'normal' } : window.phase,
  };
}

/** Leave Snap without moving: the pre-snap rect in the bucket shows again. Unsnapped → same window. */
export function unsnap(window: WindowInstance): WindowInstance {
  if (!window.snap) return window;
  const { snap: _snap, ...floating } = window;
  return floating;
}

/** Next focus after `id` leaves: the topmost other focusable window. */
export const nextFocus = (session: OsSession, id: WindowId): WindowId | null => topmostFocusable(session, id);

export { isFocusable };
