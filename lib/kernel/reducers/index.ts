/**
 * The kernel reducer — shared/04-os-kernel.md. Pure, deterministic, React-free.
 * Every action returns `{ state, focusTarget, routeIntent }` (+ a prefs patch and analytics events).
 * Illegal or redundant actions return the identical state reference. No branch here reads `PersonaId`.
 */
import type { ContentCatalog } from '@/data/content-index';
import { refSlug, type ContentRef } from '@/data/schema';
import type { AnalyticsEvent } from '@/lib/analytics/events';
import type { KernelAction, NavigationType, SwitchVia } from '../actions';
import { clampGeometry, clampSplit, sameRect, viewportFor } from '../geometry';
import type { AppRole, OsId } from '../ids';
import {
  SESSION_TTL_COLD,
  SESSION_TTL_RELOAD,
  isFresh,
  sanitizeSession,
  type LocationRepair,
} from '../persist/sessions';
import { getBinding, workspaceInsets } from '../registry';
import { linuxLocationFor, refForLocation, routeOf, type RouteCodec } from '../route/codec';
import {
  currentLocation,
  deriveRoute,
  emptySession,
  isFocusable,
  sameLocation,
  sameRoute,
  targetOs,
  topmostFocusable,
} from '../state';
import {
  focusKeys,
  toEpoch,
  type AppLocation,
  type Arrival,
  type CapabilityProfile,
  type FocusTarget,
  type KernelState,
  type OsAppBinding,
  type OsRegistry,
  type OsSession,
  type RouteIntent,
  type RouteState,
  type UserPreferences,
  type WindowId,
  type WindowKey,
  type WindowInstance,
  type Onboarding,
} from '../types';
import {
  commitRect,
  createWindow,
  currentRect,
  focusWindow,
  nextFocus,
  pushLocation,
  removeWindow,
  replaceLocation,
  seekLocation,
  unsnap,
  withWindow,
  workspaceOf,
} from './windows';

export interface KernelDeps {
  readonly registry: OsRegistry;
  readonly catalog: ContentCatalog;
  readonly codec: RouteCodec;
  readonly prefs: UserPreferences;
  readonly visible: readonly OsId[];
  readonly now: number;
}

export interface KernelResult {
  readonly state: KernelState;
  readonly focusTarget: FocusTarget | null;
  readonly routeIntent: RouteIntent;
  readonly prefsPatch: Partial<Omit<UserPreferences, 'v'>> | null;
  readonly events: readonly AnalyticsEvent[];
}

type Draft = {
  state: KernelState;
  focusTarget: FocusTarget | null;
  routeIntent: RouteIntent;
  prefsPatch: Partial<Omit<UserPreferences, 'v'>> | null;
  events: AnalyticsEvent[];
};

export const CONTINUITY_TTL = 10 * 60 * 1000;
const ONBOARDING_ORDER: readonly Onboarding[] = ['hello', 'intro', 'profiles', 'chooser', 'done'];

const unchanged = (state: KernelState): KernelResult => ({
  state,
  focusTarget: null,
  routeIntent: null,
  prefsPatch: null,
  events: [],
});

const focus = (...candidates: (string | null | undefined)[]): FocusTarget => ({
  candidates: candidates.filter((candidate): candidate is string => Boolean(candidate)),
});

const setSession = (state: KernelState, session: OsSession): KernelState =>
  state.sessions[session.os] === session ? state : { ...state, sessions: { ...state.sessions, [session.os]: session } };

const pathnameOf = (url: string) => url.split(/[?#]/)[0] || '/';

// --- Locations ---------------------------------------------------------------------------------------------------

function defaultLocation(os: OsId, binding: OsAppBinding): AppLocation {
  if (os === 'linux') return binding.role === 'viewer' ? { kind: 'vfs', path: ['resume'] } : { kind: 'vfs', path: [] };
  const only = binding.owns.length === 1 ? binding.owns[0] : undefined;
  return only ? { kind: 'content', ref: { section: only } as ContentRef } : { kind: 'root' };
}

/**
 * Resolve an (os, role, location) request to a valid (role, location): Linux content refs move to the terminal or
 * viewer; stale refs are repaired; anything the codec cannot address falls back to the app's default location.
 */
function resolveTarget(
  os: OsId,
  role: AppRole,
  location: AppLocation | undefined,
  deps: KernelDeps,
): { binding: OsAppBinding; location: AppLocation } | null {
  let targetRole = role;
  let target = location;
  if (target?.kind === 'content') target = { kind: 'content', ref: deps.catalog.repair(target.ref) };
  if (os === 'linux' && target?.kind === 'content') {
    const mapped = linuxLocationFor(target.ref);
    targetRole = mapped.role;
    target = mapped.location;
  } else if (target?.kind === 'content') {
    // Content always opens in its section owner (Finder → Résumé opens Preview).
    targetRole = deps.registry[os].sectionOwner[target.ref.section];
  }
  const binding = getBinding(os, targetRole, deps.registry);
  if (!binding) return null;
  if (!target) return { binding, location: defaultLocation(os, binding) };
  const route: RouteState = { kind: 'os', os, focus: { role: binding.role, location: target } };
  const decoded = deps.codec.decode(deps.codec.encode(route));
  const valid = decoded.ok && sameRoute(decoded.route, route);
  // Terminals outside Linux keep their cwd in the session only; their location is always the app root.
  if (!valid && decoded.ok && decoded.route.kind === 'os' && decoded.route.focus?.role === binding.role)
    return { binding, location: decoded.route.focus.location };
  return { binding, location: valid ? target : defaultLocation(os, binding) };
}

function repairFor(deps: KernelDeps): LocationRepair {
  return (os, window, location) => {
    const resolved = resolveTarget(os, window.role, location, deps);
    return resolved && resolved.binding.role === window.role ? resolved.location : null;
  };
}

// --- Continuity (shared/16) --------------------------------------------------------------------------------------

function captureContinuity(
  state: KernelState,
  os: OsId,
  role: AppRole,
  location: AppLocation,
  deps: KernelDeps,
): KernelState {
  // App roots don't count — except an app whose root *is* a section (Windows Edge's About tab).
  if (location.kind === 'root' && !getBinding(os, role, deps.registry)?.home) return state;
  const ref = refForLocation(os, role, location, deps.registry);
  if (!ref || !deps.catalog.has(ref)) return state;
  // Linux cwd at `~` maps to no content.
  if (os === 'linux' && location.kind === 'vfs' && location.path.length === 0) return state;
  return { ...state, continuity: { ref, fromOs: os, at: deps.now } };
}

// --- Opening and focusing ----------------------------------------------------------------------------------------

function openApp(
  draft: Draft,
  os: OsId,
  role: AppRole,
  requested: AppLocation | undefined,
  deps: KernelDeps,
  options: { originId?: string | null; invoker?: string | null; animate?: boolean; emit?: boolean } = {},
): void {
  const resolved = resolveTarget(os, role, requested, deps);
  if (!resolved) return;
  const { binding, location } = resolved;
  const state = draft.state;
  const session = state.sessions[os];
  const id = `${os}:${binding.role}` as WindowId;
  const existing = session.windows[id];
  let window: WindowInstance;

  if (!existing) {
    window = createWindow(binding, session, location, {
      originId: options.originId ?? null,
      invoker: options.invoker ?? null,
      sizeClass: state.viewport.sizeClass,
      viewport: state.viewport,
      insets: workspaceInsets(os, state.viewport, deps.registry, deps.prefs),
      learned: state.learnedRects[id],
      animate: options.animate ?? true,
    });
  } else {
    let phase = existing.phase;
    let rect = existing.rect;
    if (phase.s === 'closing') phase = { s: 'opening', originId: options.originId ?? null };
    else if (phase.s === 'minimized') {
      rect = { ...rect, [state.viewport.sizeClass]: phase.restore };
      phase = phase.wasMaximized ? { s: 'maximized', restore: phase.restore } : { s: 'normal' };
    }
    const moved = seekOrPush(existing, location, requested !== undefined);
    window = phase === existing.phase && rect === existing.rect ? moved : { ...moved, phase, rect };
  }

  const nextSession = startApp(focusWindow(withWindow(session, window), id), binding.role);
  if (nextSession === session && window === existing) {
    // Already in front at that place: nothing changes, but focus returns to the window (a search result or a link
    // chosen from a closing panel must not leave focus behind), and the request is still published to the app.
    draft.focusTarget = focus(focusKeys.window(id));
    return;
  }
  draft.state = captureContinuity(setSession(state, nextSession), os, binding.role, currentLocation(window), deps);
  draft.focusTarget = focus(focusKeys.window(id));
  draft.routeIntent = 'go';
  if (options.emit !== false) {
    const ref = refForLocation(os, binding.role, currentLocation(window), deps.registry);
    draft.events.push({ name: 'app_opened', os, role: binding.role, ...(ref ? { section: ref.section } : {}) });
  }
}

/** Opening an app starts it (desktop OSes keep it running after its window closes, until Quit — `MAC-WM-07`). */
const startApp = (session: OsSession, role: AppRole): OsSession =>
  session.running.includes(role) ? session : { ...session, running: [...session.running, role] };

/** A requested location is pushed; re-opening without one keeps where the app was. */
const seekOrPush = (window: WindowInstance, location: AppLocation, explicit: boolean): WindowInstance =>
  explicit ? pushLocation(window, location) : window;

function applyFocusRoute(draft: Draft, os: OsId, route: Extract<RouteState, { kind: 'os' }>, deps: KernelDeps): void {
  const session = draft.state.sessions[os];
  if (!route.focus) {
    if (session.focused === null) return;
    const leaving = session.focused;
    draft.state = setSession(draft.state, { ...session, focused: null });
    draft.focusTarget = focus(
      focusKeys.launcher(os, leaving.split(':')[1] as AppRole),
      focusKeys.home(os),
      focusKeys.osHeading,
    );
    return;
  }
  const resolved = resolveTarget(os, route.focus.role, route.focus.location, deps);
  if (!resolved) return;
  const id = `${os}:${resolved.binding.role}` as WindowId;
  const existing = session.windows[id];
  if (!existing || existing.phase.s === 'closing') {
    openApp(draft, os, resolved.binding.role, resolved.location, deps, { animate: true, emit: false });
    return;
  }
  let window = seekLocation(existing, resolved.location);
  if (window.phase.s === 'minimized') {
    const { restore, wasMaximized } = window.phase;
    window = {
      ...window,
      rect: { ...window.rect, [draft.state.viewport.sizeClass]: restore },
      phase: wasMaximized ? { s: 'maximized', restore } : { s: 'normal' },
    };
  }
  const next = focusWindow(withWindow(session, window), id);
  if (next === session && window === existing) return;
  draft.state = captureContinuity(setSession(draft.state, next), os, window.role, currentLocation(window), deps);
  draft.focusTarget = focus(focusKeys.window(id));
}

// --- OS switching (KRN-SWITCH-*) ---------------------------------------------------------------------------------

function park(state: KernelState, os: OsId | null, now: number): KernelState {
  if (!os) return state;
  const session = state.sessions[os];
  return session.parkedAt === null ? setSession(state, { ...session, parkedAt: now }) : state;
}

function unpark(state: KernelState, os: OsId): KernelState {
  const session = state.sessions[os];
  return session.parkedAt === null ? state : setSession(state, { ...session, parkedAt: null });
}

const arrivalFor = (via: SwitchVia): Arrival =>
  via === 'chooser' ? 'chooser' : via === 'history' ? 'history' : 'switch';

function switchOs(draft: Draft, to: OsId | null, via: SwitchVia, deps: KernelDeps): void {
  const state = draft.state;
  if (to !== null && !deps.visible.includes(to)) return;
  const current = targetOs(state);
  const { transition } = state;
  if (to === current && transition.phase === 'idle') return;
  const epoch = toEpoch(state.epoch + 1);
  let next: KernelState = { ...state, epoch, arrival: to === null ? null : arrivalFor(via) };

  switch (transition.phase) {
    case 'idle': {
      next = park(next, state.activeOs, deps.now);
      next = { ...next, transition: { phase: 'exiting', epoch, from: state.activeOs, to } };
      break;
    }
    case 'exiting': {
      if (to !== null && to === transition.from) {
        // Return to origin: the running exit reverses into the OS that never left.
        next = unpark(next, to);
        next = {
          ...next,
          activeOs: to,
          transition: { phase: 'entering', epoch, from: transition.to, to, reverse: true },
        };
      } else if (to === null && transition.from === null && transition.to !== null) {
        // Esc / Back during the chooser's enter flight: the flight reverses into the card it came from, so the
        // exit runs "from" that OS and focus lands back on its card (plans/04 `CHOOSE-ENTER-01`).
        next = { ...next, transition: { phase: 'exiting', epoch, from: transition.to, to: null } };
      } else next = { ...next, transition: { phase: 'exiting', epoch, from: transition.from, to } };
      break;
    }
    case 'loading':
    case 'failed': {
      if (to === null) {
        next = { ...next, transition: { phase: 'idle' }, activeOs: null };
        draft.focusTarget = focus(focusKeys.chooserCard(transition.to), focusKeys.chooserHeading);
      } else next = { ...next, transition: { phase: 'loading', epoch, from: null, to, since: deps.now } };
      break;
    }
    case 'entering': {
      if (to === transition.to) return;
      next = park({ ...next, activeOs: transition.to }, transition.to, deps.now);
      next = { ...next, transition: { phase: 'exiting', epoch, from: transition.to, to } };
      break;
    }
    default: {
      const exhaustive: never = transition;
      return exhaustive;
    }
  }

  next = { ...next, onboarding: to === null ? 'chooser' : 'done' };
  draft.state = next;
  draft.routeIntent = via === 'history' ? null : 'go';
  if (to !== null) {
    draft.prefsPatch = { ...draft.prefsPatch, lastOs: to };
    draft.events.push({ name: 'os_entered', os: to, via: via === 'history' ? 'switch' : via });
  }
}

function phaseDoneOs(draft: Draft, epoch: number, deps: KernelDeps): void {
  const state = draft.state;
  const { transition } = state;
  if (transition.phase === 'idle' || transition.phase === 'failed' || transition.epoch !== epoch) return;
  switch (transition.phase) {
    case 'exiting':
      draft.state =
        transition.to === null
          ? { ...state, activeOs: null, transition: { phase: 'idle' } }
          : {
              ...state,
              activeOs: null,
              transition: {
                phase: 'loading',
                epoch: transition.epoch,
                from: transition.from,
                to: transition.to,
                since: deps.now,
              },
            };
      if (transition.to === null)
        draft.focusTarget = focus(focusKeys.chooserCard(transition.from ?? 'macos'), focusKeys.chooserHeading);
      return;
    case 'loading':
      draft.state = unpark(
        {
          ...state,
          activeOs: transition.to,
          transition: { phase: 'entering', epoch: transition.epoch, from: transition.from, to: transition.to },
        },
        transition.to,
      );
      // shared/09: focus moves at animation start — the OS heading exists from `loading` on, so the reveal (however
      // long on a slow device) never leaves focus on the chooser card it is covering.
      draft.focusTarget = focus(focusKeys.osHeading);
      return;
    case 'entering': {
      draft.state = { ...state, activeOs: transition.to, transition: { phase: 'idle' } };
      draft.focusTarget = focus(focusKeys.osHeading);
      return;
    }
  }
}

// --- Boot and routes ---------------------------------------------------------------------------------------------

/** Default OS for `/go` links: last OS, else by device class (no UA sniffing), always a visible OS. */
export function defaultOsFor(
  capabilities: CapabilityProfile,
  prefs: UserPreferences,
  visible: readonly OsId[],
  appleTouch = false,
): OsId | null {
  if (prefs.lastOs && visible.includes(prefs.lastOs)) return prefs.lastOs;
  const preferred: readonly OsId[] =
    capabilities.deviceClass === 'phone'
      ? appleTouch
        ? ['ios', 'android']
        : ['android', 'ios']
      : capabilities.deviceClass === 'tablet'
        ? appleTouch
          ? ['ios', 'android', 'macos']
          : ['android', 'ios', 'windows']
        : ['macos', 'windows', 'linux'];
  return preferred.find((os) => visible.includes(os)) ?? visible[0] ?? null;
}

function resolveGo(draft: Draft, ref: ContentRef, deps: KernelDeps): boolean {
  const os = defaultOsFor(draft.state.capabilities, deps.prefs, deps.visible, draft.state.capabilities.appleTouch);
  if (!os) return false;
  const role = deps.registry[os].sectionOwner[ref.section];
  draft.state = { ...draft.state, activeOs: os, transition: { phase: 'idle' }, onboarding: 'done', arrival: 'go' };
  openApp(draft, os, role, { kind: 'content', ref }, deps, { animate: false });
  draft.events.push({ name: 'os_entered', os, via: 'go' });
  draft.prefsPatch = { ...draft.prefsPatch, lastOs: os };
  return true;
}

function boot(draft: Draft, action: Extract<KernelAction, { type: 'BOOT' }>, deps: KernelDeps): void {
  const viewport = viewportFor(action.viewport.w, action.viewport.h, action.viewport.pointer);
  const reloadLike = action.navType === 'reload' || action.navType === 'back_forward';
  const persisted = action.persisted;
  const fresh = persisted && isFresh(persisted.savedAt, deps.now, reloadLike ? SESSION_TTL_RELOAD : SESSION_TTL_COLD);
  const repair = repairFor(deps);
  const sessions = { ...draft.state.sessions };
  for (const os of Object.keys(sessions) as OsId[]) {
    const stored = fresh ? persisted.sessions[os] : undefined;
    sessions[os] = stored
      ? sanitizeSession(stored, { sizeClass: viewport.sizeClass, contentRev: deps.catalog.rev, repair })
      : emptySession(os, viewport.sizeClass, deps.catalog.rev);
  }
  draft.state = {
    ...draft.state,
    boot: 'ready',
    viewport,
    capabilities: action.capabilities,
    sessions,
    learnedRects: persisted?.learnedRects ?? {},
  };

  const decoded = deps.codec.decode(action.url);
  const route = routeOf(decoded);
  draft.routeIntent = 'canonicalize';

  switch (route.kind) {
    case 'welcome': {
      const onboarding: Onboarding = 'hello';
      draft.state = { ...draft.state, route, onboarding, activeOs: null };
      return;
    }
    case 'plain':
      draft.state = { ...draft.state, route, activeOs: null };
      return;
    case 'go':
      draft.state = { ...draft.state, route };
      resolveGo(draft, route.ref, deps);
      draft.routeIntent = 'canonicalize';
      return;
    case 'os': {
      const { os } = route;
      if (route.focus && !reloadLike)
        draft.state = setSession(draft.state, emptySession(os, viewport.sizeClass, deps.catalog.rev));
      draft.state = {
        ...draft.state,
        route,
        activeOs: os,
        onboarding: 'done',
        transition: { phase: 'idle' },
        arrival:
          route.focus && !(os === 'linux' && isLinuxHome(route)) ? 'deep-link' : reloadLike ? 'restore' : 'deep-link',
      };
      draft.state = unpark(draft.state, os);
      const events = draft.events.length;
      if (route.focus) openFromUrl(draft, os, route, deps);
      else draft.state = setSession(draft.state, { ...draft.state.sessions[os], focused: null });
      draft.events.length = events;
      draft.events.push({ name: 'os_entered', os, via: 'deep-link' });
      draft.prefsPatch = { ...draft.prefsPatch, lastOs: os };
      // Boot never moves focus (the skip link stays the first Tab stop) and always canonicalizes.
      draft.focusTarget = null;
      draft.routeIntent = 'canonicalize';
      return;
    }
  }
}

const isLinuxHome = (route: Extract<RouteState, { kind: 'os' }>) =>
  route.focus?.role === 'terminal' && route.focus.location.kind === 'vfs' && route.focus.location.path.length === 0;

/** Boot-time open: no animation (the page already shows this content). */
function openFromUrl(draft: Draft, os: OsId, route: Extract<RouteState, { kind: 'os' }>, deps: KernelDeps): void {
  if (!route.focus) return;
  const session = draft.state.sessions[os];
  const resolved = resolveTarget(os, route.focus.role, route.focus.location, deps);
  if (!resolved) return;
  const id = `${os}:${resolved.binding.role}` as WindowId;
  const existing = session.windows[id];
  if (existing) {
    applyFocusRoute(draft, os, route, deps);
    return;
  }
  openApp(draft, os, resolved.binding.role, resolved.location, deps, { animate: false, emit: false });
}

function routeChanged(draft: Draft, url: string, deps: KernelDeps): void {
  const decoded = deps.codec.decode(url);
  const route = routeOf(decoded);
  const repair = !decoded.ok || decoded.canonical !== pathnameOf(url);
  const current = targetOs(draft.state);

  switch (route.kind) {
    case 'welcome':
      if (current !== null) switchOs(draft, null, 'history', deps);
      else if (draft.state.onboarding === 'done') draft.state = { ...draft.state, onboarding: 'chooser' };
      break;
    case 'plain':
      draft.state = {
        ...park(draft.state, draft.state.activeOs, deps.now),
        activeOs: null,
        transition: { phase: 'idle' },
        route,
      };
      break;
    case 'go':
      draft.state = { ...draft.state, route };
      if (!resolveGo(draft, route.ref, deps)) break;
      draft.routeIntent = 'canonicalize';
      return;
    case 'os': {
      if (route.os !== current) switchOs(draft, route.os, 'history', deps);
      if (targetOs(draft.state) !== route.os) break;
      applyFocusRoute(draft, route.os, route, deps);
      break;
    }
  }
  // Popstate handlers never write history, except a repair (shared/05 invariant 3).
  draft.routeIntent = repair ? 'canonicalize' : null;
}

// --- Root reducer ------------------------------------------------------------------------------------------------

export function reduce(state: KernelState, action: KernelAction, deps: KernelDeps): KernelResult {
  const draft: Draft = { state, focusTarget: null, routeIntent: null, prefsPatch: null, events: [] };
  step(draft, action, deps);
  if (
    draft.state === state &&
    !draft.prefsPatch &&
    draft.events.length === 0 &&
    !draft.routeIntent &&
    !draft.focusTarget
  )
    return unchanged(state);
  const route = deriveRoute(draft.state);
  if (!sameRoute(route, draft.state.route)) draft.state = { ...draft.state, route };
  return draft;
}

function windowAction(draft: Draft, id: WindowId, mutate: (window: WindowInstance, session: OsSession) => void): void {
  const os = id.split(':')[0] as OsId;
  const session = draft.state.sessions[os];
  const window = session?.windows[id];
  if (!window) return;
  mutate(window, session);
}

function step(draft: Draft, action: KernelAction, deps: KernelDeps): void {
  const { state } = draft;
  switch (action.type) {
    case 'BOOT':
      if (state.boot === 'ready') return;
      boot(draft, action, deps);
      return;

    case 'ROUTE_CHANGED':
      if (state.boot !== 'ready') return;
      routeChanged(draft, action.url, deps);
      return;

    case 'VIEWPORT_CHANGED': {
      const viewport = viewportFor(action.w, action.h, action.pointer);
      const old = state.viewport;
      if (old.w === viewport.w && old.h === viewport.h && old.posture === viewport.posture) return;
      let next: KernelState = { ...state, viewport };
      for (const os of Object.keys(state.sessions) as OsId[]) {
        const session = next.sessions[os];
        const windows: Partial<Record<WindowKey, WindowInstance>> = {};
        let changed = session.sizeClass !== viewport.sizeClass;
        for (const window of Object.values(session.windows)) {
          if (!window) continue;
          const binding = getBinding(os, window.role, deps.registry);
          const rect = window.rect[viewport.sizeClass];
          if (binding?.window.mode === 'floating' && rect) {
            const clamped = clampGeometry(
              rect,
              workspaceOf(viewport, workspaceInsets(os, viewport, deps.registry, deps.prefs)),
              binding.window.minPx,
            );
            if (clamped.x !== rect.x || clamped.y !== rect.y || clamped.w !== rect.w || clamped.h !== rect.h) {
              windows[window.id] = { ...window, rect: { ...window.rect, [viewport.sizeClass]: clamped } };
              changed = true;
              continue;
            }
          }
          windows[window.id] = window;
        }
        if (changed) next = setSession(next, { ...session, windows, sizeClass: viewport.sizeClass });
      }
      draft.state = next;
      return;
    }

    case 'OPEN_APP': {
      const os = action.os ?? state.activeOs;
      if (!os || (os !== state.activeOs && !deps.visible.includes(os))) return;
      openApp(draft, os, action.role, action.location, deps, { originId: action.originId, invoker: action.invoker });
      return;
    }

    case 'CLOSE_WINDOW':
      windowAction(draft, action.id, (window, session) => {
        if (window.phase.s === 'closing') return;
        const closing = withWindow(session, { ...window, phase: { s: 'closing' } });
        const next = session.focused === window.id ? { ...closing, focused: nextFocus(closing, window.id) } : closing;
        draft.state = setSession(state, next);
        draft.focusTarget = focus(
          next.focused && focusKeys.window(next.focused),
          window.invoker,
          focusKeys.launcher(window.os, window.role),
          focusKeys.home(window.os),
          focusKeys.osHeading,
        );
        draft.routeIntent = 'go';
      });
      return;

    case 'QUIT_APP': {
      const os = action.os ?? state.activeOs;
      if (!os) return;
      const session = state.sessions[os];
      const id = `${os}:${action.role}` as WindowId;
      const window = session.windows[id];
      const stopped: OsSession = session.running.includes(action.role)
        ? { ...session, running: session.running.filter((role) => role !== action.role) }
        : session;
      if (window && window.phase.s !== 'closing') {
        // Quit = close the window (same focus and history rules as the red button) + stop the app.
        draft.state = setSession(state, stopped);
        step(draft, { type: 'CLOSE_WINDOW', id }, deps);
        return;
      }
      if (stopped !== session) draft.state = setSession(state, stopped);
      return;
    }

    case 'HIDE_OTHERS':
      windowAction(draft, action.id, (window, session) => {
        if (!isFocusable(window)) return;
        let next = session;
        for (const other of Object.values(session.windows)) {
          if (!other || other.id === window.id || !isFocusable(other)) continue;
          const binding = getBinding(other.os, other.role, deps.registry);
          if (!binding || binding.window.mode !== 'floating') continue;
          const phase =
            other.phase.s === 'maximized'
              ? ({ s: 'minimized', restore: other.phase.restore, wasMaximized: true } as const)
              : ({
                  s: 'minimized',
                  restore: currentRect(
                    other,
                    binding,
                    state.viewport.sizeClass,
                    state.viewport,
                    state.learnedRects[other.id],
                    workspaceInsets(other.os, state.viewport, deps.registry, deps.prefs),
                  ),
                  wasMaximized: false,
                } as const);
          next = withWindow(next, { ...other, phase });
        }
        const focused = focusWindow(next, window.id);
        if (focused === session) return;
        draft.state = setSession(state, focused);
        if (session.focused !== window.id) {
          draft.focusTarget = focus(focusKeys.window(window.id));
          draft.routeIntent = 'go';
        }
      });
      return;

    case 'SHOW_ALL': {
      const os = action.os ?? state.activeOs;
      if (!os) return;
      const session = state.sessions[os];
      let next = session;
      for (const window of Object.values(session.windows)) {
        if (!window || window.phase.s !== 'minimized') continue;
        const { restore, wasMaximized } = window.phase;
        next = withWindow(next, {
          ...window,
          rect: { ...window.rect, [state.viewport.sizeClass]: restore },
          phase: wasMaximized ? { s: 'maximized', restore } : { s: 'normal' },
        });
      }
      if (next === session) return;
      // Nothing was focused (every window was in the Dock): the frontmost restored window takes focus.
      if (session.focused === null) {
        const top = topmostFocusable(next);
        if (top) {
          next = focusWindow(next, top);
          draft.focusTarget = focus(focusKeys.window(top));
          draft.routeIntent = 'go';
        }
      }
      draft.state = setSession(state, next);
      return;
    }

    case 'FOCUS_WINDOW':
      windowAction(draft, action.id, (window, session) => {
        if (window.phase.s === 'closing') return;
        if (window.phase.s === 'minimized') {
          step(draft, { type: 'RESTORE', id: action.id }, deps);
          return;
        }
        const next = focusWindow(session, window.id);
        if (next === session) return;
        draft.state = captureContinuity(setSession(state, next), window.os, window.role, currentLocation(window), deps);
        // A pointer press already moved focus to what it hit (or to the window section itself): never pull it away.
        draft.focusTarget = action.via === 'pointer' ? null : focus(focusKeys.window(window.id));
        draft.routeIntent = 'go';
      });
      return;

    case 'MINIMIZE':
      windowAction(draft, action.id, (window, session) => {
        const binding = getBinding(window.os, window.role, deps.registry);
        if (!binding || binding.window.mode !== 'floating') return;
        let restore;
        let wasMaximized = false;
        if (window.phase.s === 'normal')
          restore = currentRect(
            window,
            binding,
            state.viewport.sizeClass,
            state.viewport,
            state.learnedRects[window.id],
            workspaceInsets(window.os, state.viewport, deps.registry, deps.prefs),
          );
        else if (window.phase.s === 'maximized') {
          restore = window.phase.restore;
          wasMaximized = true;
        } else return;
        const minimized = withWindow(session, { ...window, phase: { s: 'minimized', restore, wasMaximized } });
        const next =
          session.focused === window.id ? { ...minimized, focused: nextFocus(minimized, window.id) } : minimized;
        draft.state = setSession(state, next);
        // Minimize: focus → the window's own Dock tile, else the app's launcher (shared/09, macos/05).
        draft.focusTarget = focus(
          focusKeys.dockTile(window.id),
          focusKeys.launcher(window.os, window.role),
          next.focused && focusKeys.window(next.focused),
          focusKeys.osHeading,
        );
        draft.routeIntent = 'go';
      });
      return;

    case 'RESTORE':
      windowAction(draft, action.id, (window, session) => {
        if (window.phase.s !== 'minimized') return;
        const { restore, wasMaximized } = window.phase;
        const restored: WindowInstance = {
          ...window,
          rect: { ...window.rect, [state.viewport.sizeClass]: restore },
          phase: wasMaximized ? { s: 'maximized', restore } : { s: 'normal' },
        };
        draft.state = captureContinuity(
          setSession(state, focusWindow(withWindow(session, restored), window.id)),
          window.os,
          window.role,
          currentLocation(window),
          deps,
        );
        draft.focusTarget = focus(focusKeys.window(window.id));
        draft.routeIntent = 'go';
      });
      return;

    case 'TOGGLE_MAXIMIZE':
      windowAction(draft, action.id, (window, session) => {
        const binding = getBinding(window.os, window.role, deps.registry);
        if (!binding || binding.window.mode !== 'floating') return;
        let next: WindowInstance;
        if (window.phase.s === 'normal') {
          const restore = currentRect(
            window,
            binding,
            state.viewport.sizeClass,
            state.viewport,
            state.learnedRects[window.id],
            workspaceInsets(window.os, state.viewport, deps.registry, deps.prefs),
          );
          next = { ...window, phase: { s: 'maximized', restore } };
        } else if (window.phase.s === 'maximized') {
          next = {
            ...window,
            phase: { s: 'normal' },
            rect: { ...window.rect, [state.viewport.sizeClass]: window.phase.restore },
          };
        } else return;
        draft.state = setSession(state, withWindow(session, next));
        // Maximize: focus stays on the control that was pressed (shared/09).
      });
      return;

    case 'COMMIT_RECT':
      windowAction(draft, action.id, (window, session) => {
        const binding = getBinding(window.os, window.role, deps.registry);
        if (!binding || binding.window.mode !== 'floating') return;
        if (window.phase.s === 'minimized' || window.phase.s === 'closing') return;
        const sizeClass = state.viewport.sizeClass;
        const rect = clampGeometry(
          action.rect,
          workspaceOf(state.viewport, workspaceInsets(window.os, state.viewport, deps.registry, deps.prefs)),
          binding.window.minPx,
        );
        const next = commitRect(window, sizeClass, rect);
        if (next === window) return;
        draft.state = {
          ...setSession(state, withWindow(session, next)),
          learnedRects: { ...state.learnedRects, [window.id]: { ...state.learnedRects[window.id], [sizeClass]: rect } },
        };
      });
      return;

    case 'SNAP_WINDOW':
      windowAction(draft, action.id, (window, session) => {
        const binding = getBinding(window.os, window.role, deps.registry);
        if (!binding || binding.window.mode !== 'floating' || !binding.window.resizable) return;
        if (window.phase.s === 'minimized' || window.phase.s === 'closing') return;
        if (action.zone === null) {
          const next = unsnap(window);
          if (next !== window) draft.state = setSession(state, withWindow(session, next));
          return;
        }
        const zone = action.zone;
        const sizeClass = state.viewport.sizeClass;
        // The pre-snap rect stays in the bucket (dragging away restores it): a maximized window's restore rect, else
        // the rect it shows now, materialized so it never drifts with the defaults.
        const restore =
          window.phase.s === 'maximized'
            ? window.phase.restore
            : currentRect(
                window,
                binding,
                sizeClass,
                state.viewport,
                state.learnedRects[window.id],
                workspaceInsets(window.os, state.viewport, deps.registry, deps.prefs),
              );
        const halves = zone === 'left' || zone === 'right';
        // A new half lines up with its partner's shared edge (½ + ½ pair), else starts at the middle.
        const partner = Object.values(session.windows).find(
          (other) => other && other.id !== window.id && (other.snap?.zone === 'left' || other.snap?.zone === 'right'),
        );
        const split = halves ? (partner?.snap?.split ?? 0.5) : undefined;
        const next: WindowInstance = {
          ...window,
          phase: window.phase.s === 'maximized' ? { s: 'normal' } : window.phase,
          rect: { ...window.rect, [sizeClass]: restore },
          snap: split === undefined ? { zone } : { zone, split },
        };
        if (
          window.snap?.zone === zone &&
          window.snap.split === next.snap?.split &&
          window.phase.s !== 'maximized' &&
          sameRect(window.rect[sizeClass], restore)
        )
          return;
        draft.state = setSession(state, withWindow(session, next));
      });
      return;

    case 'SET_SNAP_SPLIT': {
      const session = state.sessions[action.os];
      const split = clampSplit(action.split);
      let windows = session.windows;
      for (const window of Object.values(session.windows)) {
        if (!window?.snap || (window.snap.zone !== 'left' && window.snap.zone !== 'right')) continue;
        if (window.snap.split === split) continue;
        windows = { ...windows, [window.id]: { ...window, snap: { ...window.snap, split } } };
      }
      if (windows === session.windows) return;
      draft.state = setSession(state, { ...session, windows });
      return;
    }

    case 'NAVIGATE_IN_APP':
      windowAction(draft, action.id, (window, session) => {
        if (!isFocusable(window)) return;
        const resolved = resolveTarget(window.os, window.role, action.location, deps);
        if (!resolved || resolved.binding.role !== window.role) {
          // A location owned by another app opens that app instead (e.g. Finder → Résumé → Preview).
          if (resolved) openApp(draft, window.os, resolved.binding.role, resolved.location, deps);
          return;
        }
        const next = action.replace
          ? replaceLocation(window, resolved.location)
          : pushLocation(window, resolved.location);
        const focused = focusWindow(withWindow(session, next), window.id);
        if (next === window && focused === session) return;
        draft.state = captureContinuity(setSession(state, focused), window.os, window.role, resolved.location, deps);
        draft.routeIntent = action.replace ? 'canonicalize' : 'go';
      });
      return;

    case 'APP_BACK':
    case 'APP_FORWARD':
      windowAction(draft, action.id, (window, session) => {
        const delta = action.type === 'APP_BACK' ? -1 : 1;
        const index = window.nav.index + delta;
        if (index < 0 || index >= window.nav.entries.length || !isFocusable(window)) return;
        const next: WindowInstance = { ...window, nav: { ...window.nav, index }, scrollTop: 0 };
        draft.state = captureContinuity(
          setSession(state, focusWindow(withWindow(session, next), window.id)),
          window.os,
          window.role,
          currentLocation(next),
          deps,
        );
        draft.routeIntent = 'go';
      });
      return;

    case 'SET_SCROLL':
      windowAction(draft, action.id, (window, session) => {
        const top = Math.max(0, Math.round(action.top));
        if (window.scrollTop === top) return;
        draft.state = setSession(state, withWindow(session, { ...window, scrollTop: top }));
      });
      return;

    case 'SET_DRAFT':
      windowAction(draft, action.id, (window, session) => {
        const text = action.draft.slice(0, 10_000);
        if (window.draft === text) return;
        draft.state = setSession(state, withWindow(session, { ...window, draft: text }));
      });
      return;

    case 'SET_APP_UI':
      windowAction(draft, action.id, (window, session) => {
        const next = withAppUi(window, action.key, action.value);
        if (next !== window) draft.state = setSession(state, withWindow(session, next));
      });
      return;

    case 'GO_HOME': {
      const os = state.activeOs;
      if (!os || state.transition.phase !== 'idle') return;
      const session = state.sessions[os];
      if (!session.focused) return;
      const leaving = session.windows[session.focused];
      draft.state = setSession(state, { ...session, focused: null });
      draft.focusTarget = focus(
        leaving && focusKeys.launcher(os, leaving.role),
        focusKeys.home(os),
        focusKeys.osHeading,
      );
      draft.routeIntent = 'go';
      return;
    }

    case 'SWITCH_OS':
      switchOs(draft, action.to, action.via, deps);
      return;

    case 'PHASE_DONE': {
      if (action.target.kind === 'os') {
        phaseDoneOs(draft, action.target.epoch, deps);
        return;
      }
      windowAction(draft, action.target.id, (window, session) => {
        if (window.phase.s === 'opening')
          draft.state = setSession(state, withWindow(session, { ...window, phase: { s: 'normal' } }));
        else if (window.phase.s === 'closing') draft.state = setSession(state, removeWindow(session, window.id));
      });
      return;
    }

    case 'TRANSITION_FAILED': {
      const { transition } = state;
      if (transition.phase !== 'loading' || transition.epoch !== action.epoch) return;
      draft.state = {
        ...state,
        transition: { phase: 'failed', epoch: transition.epoch, to: transition.to, reason: action.reason, attempts: 1 },
      };
      return;
    }

    case 'RETRY_TRANSITION': {
      const { transition } = state;
      if (transition.phase !== 'failed') return;
      const epoch = toEpoch(state.epoch + 1);
      draft.state = {
        ...state,
        epoch,
        transition: { phase: 'loading', epoch, from: null, to: transition.to, since: deps.now },
      };
      return;
    }

    case 'ONBOARDING_ADVANCE': {
      const target =
        action.to ??
        ONBOARDING_ORDER[Math.min(ONBOARDING_ORDER.indexOf(state.onboarding) + 1, ONBOARDING_ORDER.length - 1)]!;
      if (target === state.onboarding) return;
      draft.state = { ...state, onboarding: target };
      if (target === 'profiles') draft.focusTarget = focus(focusKeys.profilesHeading);
      if (target === 'chooser') draft.focusTarget = focus(focusKeys.chooserHeading);
      return;
    }

    case 'SELECT_PERSONA': {
      // One handler, one transition, one destination for every profile (KRN-PERSONA-01).
      if (state.onboarding !== 'profiles') return;
      draft.state = { ...state, onboarding: 'chooser' };
      draft.prefsPatch = { persona: action.id, introSeen: true };
      draft.focusTarget = focus(focusKeys.chooserHeading);
      draft.events.push({ name: 'persona_selected', persona: action.id });
      return;
    }

    case 'SET_PREF':
      draft.prefsPatch = action.patch;
      return;

    case 'TERMINAL_SET_CWD': {
      const session = state.sessions[action.os];
      const terminal = session.terminal ?? { cwd: [], history: [], scrollback: [] };
      if (terminal.cwd.length === action.cwd.length && terminal.cwd.every((part, i) => part === action.cwd[i])) return;
      let next = setSession(state, { ...session, terminal: { ...terminal, cwd: action.cwd } });
      draft.state = next;
      if (action.os !== 'linux') return;
      const home = ['home', 'jaswanth'];
      const underHome = home.every((part, i) => action.cwd[i] === part);
      const location: AppLocation = underHome ? { kind: 'vfs', path: action.cwd.slice(home.length) } : { kind: 'root' };
      const id = 'linux:terminal' as WindowId;
      const window = next.sessions.linux.windows[id];
      if (!window) return;
      const resolved = resolveTarget('linux', 'terminal', location, deps);
      const target =
        resolved && resolved.binding.role === 'terminal' && sameLocation(resolved.location, location)
          ? location
          : { kind: 'root' as const };
      const moved = pushLocation(window, target);
      if (moved === window) return;
      next = setSession(next, withWindow(next.sessions.linux, moved));
      draft.state = captureContinuity(next, 'linux', 'terminal', target, deps);
      draft.routeIntent = 'go';
      return;
    }

    case 'TERMINAL_RECORD': {
      const session = state.sessions[action.os];
      const terminal = session.terminal ?? { cwd: ['home', 'jaswanth'], history: [], scrollback: [] };
      const history = action.command.trim() ? [...terminal.history, action.command].slice(-200) : terminal.history;
      const scrollback = [...terminal.scrollback, ...action.output].slice(-500);
      draft.state = setSession(state, { ...session, terminal: { ...terminal, history, scrollback } });
      return;
    }

    case 'TERMINAL_CLEAR': {
      const session = state.sessions[action.os];
      if (action.history) {
        if (!session.terminal || session.terminal.history.length === 0) return;
        draft.state = setSession(state, { ...session, terminal: { ...session.terminal, history: [] } });
        return;
      }
      if (!session.terminal || session.terminal.scrollback.length === 0) return;
      draft.state = setSession(state, { ...session, terminal: { ...session.terminal, scrollback: [] } });
      return;
    }

    case 'CONTINUITY_CAPTURE': {
      if (!deps.catalog.has(action.ref)) return;
      draft.state = { ...state, continuity: { ref: action.ref, fromOs: action.os, at: deps.now } };
      return;
    }

    case 'CONTINUITY_DISMISS':
      if (!state.continuity) return;
      draft.state = { ...state, continuity: null };
      return;

    case 'MARK_BOOT_SEEN':
    case 'MARK_LOCK_SEEN': {
      const session = state.sessions[action.os];
      const key = action.type === 'MARK_BOOT_SEEN' ? 'bootSeen' : 'lockSeen';
      if (session[key]) return;
      draft.state = setSession(state, { ...session, [key]: true });
      return;
    }

    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

// --- App session state (addition, plans/ios/02) ------------------------------------------------------------------

/** Caps for `WindowInstance.ui`: a handful of short keys per app (it persists with the session). */
export const APP_UI_LIMITS = { keys: 24, key: 40, value: 4000 } as const;

function withAppUi(window: WindowInstance, key: string, value: string | null): WindowInstance {
  if (!key || key.length > APP_UI_LIMITS.key) return window;
  const current = window.ui ?? {};
  if (value === null) {
    if (!(key in current)) return window;
    const rest = { ...current };
    delete rest[key];
    return { ...window, ui: rest };
  }
  const text = value.slice(0, APP_UI_LIMITS.value);
  if (current[key] === text) return window;
  if (!(key in current) && Object.keys(current).length >= APP_UI_LIMITS.keys) return window;
  return { ...window, ui: { ...current, [key]: text } };
}

// --- Derived decisions --------------------------------------------------------------------------------------------

/**
 * Continuity offer decision table (shared/16 `CONT-OFFER-01`): fresh (< 10 min), from another OS, still resolves,
 * not after a deep link / `/go`, and not already focused here. Evaluated when an OS settles.
 */
export function continuityOffer(
  state: KernelState,
  catalog: ContentCatalog,
  registry: OsRegistry,
  now: number,
): ContentRef | null {
  const { continuity, activeOs } = state;
  if (!continuity || !activeOs || state.transition.phase !== 'idle') return null;
  if (now - continuity.at >= CONTINUITY_TTL || now < continuity.at) return null;
  if (continuity.fromOs === activeOs) return null;
  if (state.arrival === 'deep-link' || state.arrival === 'go') return null;
  if (!catalog.has(continuity.ref)) return null;
  const route = deriveRoute(state);
  if (route.kind === 'os' && route.focus) {
    const shown = refForLocation(activeOs, route.focus.role, route.focus.location, registry);
    if (shown && shown.section === continuity.ref.section && refSlug(shown) === refSlug(continuity.ref)) return null;
  }
  return continuity.ref;
}

export { topmostFocusable, pathnameOf };
export type { NavigationType };
