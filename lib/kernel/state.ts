/**
 * Initial state and pure read helpers. The initial state is constant and URL-independent so the first client render
 * matches the server exactly (shared/01 `ARCH-HYDR-01`).
 */
import { OS_IDS, type OsId, type SizeClass } from './ids';
import { viewportFor } from './geometry';
import {
  toEpoch,
  type AppLocation,
  type CapabilityProfile,
  type KernelState,
  type OsSession,
  type RouteState,
  type UserPreferences,
  type WindowId,
  type WindowInstance,
} from './types';

export const DEFAULT_CAPABILITIES: CapabilityProfile = {
  tier: 1,
  deviceClass: 'desktop',
  pointer: 'fine',
  hover: true,
  webgl2: null,
  reducedMotion: false,
  reducedTransparency: false,
  saveData: false,
  appleTouch: false,
};

export const DEFAULT_PREFS: UserPreferences = {
  v: 1,
  persona: null,
  lastOs: null,
  introSeen: false,
  // Intro sound defaults on (it answers a tap); every other UI sound is off (`KRN-SOUND-01`, see lib/audio).
  sound: { enabled: true, volume: 0.8, ui: false },
  motion: 'system',
  glass: 'system',
  theme: 'system',
  singleKeyShortcuts: true,
  tourOffered: false,
  eggsFound: [],
  demotion: null,
};

export function emptySession(os: OsId, sizeClass: SizeClass, contentRev: string): OsSession {
  return {
    os,
    windows: {},
    zOrder: [],
    focused: null,
    terminal: null,
    sizeClass,
    parkedAt: null,
    contentRev,
    bootSeen: false,
    lockSeen: false,
  };
}

export function initialKernelState(contentRev = ''): KernelState {
  const viewport = viewportFor(1280, 800, 'fine');
  return {
    boot: 'ssr',
    route: { kind: 'welcome' },
    activeOs: null,
    sessions: Object.fromEntries(OS_IDS.map((os) => [os, emptySession(os, viewport.sizeClass, contentRev)])) as Record<
      OsId,
      OsSession
    >,
    transition: { phase: 'idle' },
    onboarding: 'hello',
    viewport,
    capabilities: DEFAULT_CAPABILITIES,
    continuity: null,
    epoch: toEpoch(0),
    arrival: null,
    learnedRects: {},
  };
}

// --- Read helpers ------------------------------------------------------------------------------------------------

export const currentLocation = (window: WindowInstance): AppLocation =>
  window.nav.entries[window.nav.index] ?? { kind: 'root' };

/** Windows that can hold focus: not minimized, not closing. */
export const isFocusable = (window: WindowInstance | undefined): window is WindowInstance =>
  !!window && window.phase.s !== 'minimized' && window.phase.s !== 'closing';

export function topmostFocusable(session: OsSession, exclude?: WindowId): WindowId | null {
  for (let index = session.zOrder.length - 1; index >= 0; index--) {
    const id = session.zOrder[index]!;
    if (id !== exclude && isFocusable(session.windows[id])) return id;
  }
  return null;
}

/** The OS whose URL the state represents: an in-flight transition's target wins. */
export function targetOs(state: KernelState): OsId | null {
  switch (state.transition.phase) {
    case 'idle':
      return state.activeOs;
    case 'failed':
      return state.transition.to;
    default:
      return state.transition.to;
  }
}

/** The URL is a pure function of kernel state (shared/05 invariant 1). */
export function deriveRoute(state: KernelState): RouteState {
  const os = targetOs(state);
  if (os === null) {
    if (state.transition.phase === 'idle' && (state.route.kind === 'plain' || state.route.kind === 'go'))
      return state.route;
    return { kind: 'welcome' };
  }
  const session = state.sessions[os];
  const focused = session.focused ? session.windows[session.focused] : undefined;
  if (isFocusable(focused))
    return { kind: 'os', os, focus: { role: focused.role, location: currentLocation(focused) } };
  if (os === 'linux') return { kind: 'os', os, focus: { role: 'terminal', location: { kind: 'vfs', path: [] } } };
  return { kind: 'os', os, focus: null };
}

export const sameLocation = (a: AppLocation, b: AppLocation): boolean => {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'root') return true;
  if (a.kind === 'vfs' && b.kind === 'vfs')
    return a.path.length === b.path.length && a.path.every((part, index) => part === b.path[index]);
  if (a.kind === 'content' && b.kind === 'content')
    return (
      a.ref.section === b.ref.section &&
      ('slug' in a.ref ? a.ref.slug : undefined) === ('slug' in b.ref ? b.ref.slug : undefined)
    );
  return false;
};

export const sameRoute = (a: RouteState, b: RouteState): boolean => {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'os' && b.kind === 'os') {
    if (a.os !== b.os) return false;
    if (!a.focus || !b.focus) return a.focus === b.focus;
    return a.focus.role === b.focus.role && sameLocation(a.focus.location, b.focus.location);
  }
  if (a.kind === 'go' && b.kind === 'go')
    return sameLocation({ kind: 'content', ref: a.ref }, { kind: 'content', ref: b.ref });
  return true;
};

/**
 * The OS chooser is on screen (plans/04): on the welcome route in the chooser state, or while a transition that
 * started from it is still running (its enter flight covers the OS mounting underneath).
 */
export function chooserShown(state: KernelState): boolean {
  if (state.boot !== 'ready') return false;
  if (state.route.kind === 'welcome' && state.onboarding === 'chooser') return true;
  return state.arrival === 'chooser' && state.transition.phase !== 'idle';
}
