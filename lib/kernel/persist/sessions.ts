/**
 * Session persistence rules — shared/04 `KRN-SES-01/02`, `KRN-PERSIST-*`.
 * URL always wins for OS + focused role + location; the snapshot wins for everything else.
 */
import { OS_IDS, type OsId, type SizeClass } from '../ids';
import { topmostFocusable } from '../state';
import type {
  AppLocation,
  KernelState,
  OsSession,
  PersistedSessionsV1,
  WindowId,
  WindowInstance,
  WindowKey,
} from '../types';
import { isRecord, parseRectBuckets, parseTerminal, parseWindow, parseWindowIdKey, type Json } from './validate';

export const SESSIONS_KEY = 'pf.sessions.v1';
export const SESSION_TTL_RELOAD = 24 * 60 * 60 * 1000;
export const SESSION_TTL_COLD = 30 * 60 * 1000;

export type LocationRepair = (os: OsId, window: WindowInstance, location: AppLocation) => AppLocation | null;

/** Validate a raw persisted payload. Wrong version, wrong shape or corrupt → `null` (sessions discarded). */
export function parsePersistedSessions(value: Json): PersistedSessionsV1 | null {
  if (!isRecord(value) || value.v !== 1 || typeof value.savedAt !== 'number' || typeof value.contentRev !== 'string')
    return null;
  const sessions: Partial<Record<OsId, OsSession>> = {};
  if (isRecord(value.sessions)) {
    for (const os of OS_IDS) {
      const raw = value.sessions[os];
      if (!isRecord(raw) || raw.os !== os) continue;
      const windows: Partial<Record<WindowKey, WindowInstance>> = {};
      if (isRecord(raw.windows))
        for (const [key, candidate] of Object.entries(raw.windows)) {
          const parsed = parseWindow(candidate);
          if (parsed && parsed.id === key && parsed.os === os) windows[parsed.id] = parsed;
        }
      const zOrder = Array.isArray(raw.zOrder)
        ? raw.zOrder.filter((id): id is WindowId => typeof id === 'string' && id in windows)
        : [];
      sessions[os] = {
        os,
        windows,
        zOrder: [...new Set(zOrder)],
        focused: typeof raw.focused === 'string' && raw.focused in windows ? (raw.focused as WindowId) : null,
        terminal: raw.terminal ? parseTerminal(raw.terminal) : null,
        sizeClass: 'expanded',
        parkedAt: typeof raw.parkedAt === 'number' ? raw.parkedAt : null,
        contentRev: typeof raw.contentRev === 'string' ? raw.contentRev : '',
        bootSeen: raw.bootSeen === true,
        lockSeen: raw.lockSeen === true,
      };
    }
  }
  const learnedRects: Partial<
    Record<WindowKey, Partial<Record<SizeClass, ReturnType<typeof parseRectBuckets>[SizeClass]>>>
  > = {};
  if (isRecord(value.learnedRects))
    for (const [key, buckets] of Object.entries(value.learnedRects)) {
      const id = parseWindowIdKey(key);
      if (id) learnedRects[id] = parseRectBuckets(buckets);
    }
  return {
    v: 1,
    savedAt: value.savedAt,
    contentRev: value.contentRev,
    sessions,
    learnedRects: learnedRects as PersistedSessionsV1['learnedRects'],
  };
}

/**
 * Normalize a restored session: transient phases settle (`opening` → `normal`, `closing` removed), references that no
 * longer resolve are repaired or dropped, z-order and focus are made consistent.
 */
export function sanitizeSession(
  session: OsSession,
  { sizeClass, contentRev, repair }: { sizeClass: SizeClass; contentRev: string; repair: LocationRepair },
): OsSession {
  const windows: Partial<Record<WindowKey, WindowInstance>> = {};
  for (const window of Object.values(session.windows)) {
    if (!window || window.phase.s === 'closing') continue;
    const entries = window.nav.entries
      .map((location) => repair(session.os, window, location))
      .filter((location): location is AppLocation => location !== null);
    if (entries.length === 0) continue;
    const collapsed = entries.filter(
      (location, index) => index === 0 || JSON.stringify(location) !== JSON.stringify(entries[index - 1]),
    );
    windows[window.id] = {
      ...window,
      phase: window.phase.s === 'opening' ? { s: 'normal' } : window.phase,
      nav: { entries: collapsed, index: Math.min(window.nav.index, collapsed.length - 1) },
    };
  }
  const zOrder = [...new Set(session.zOrder.filter((id) => id in windows))];
  for (const id of Object.keys(windows) as WindowId[]) if (!zOrder.includes(id)) zOrder.push(id);
  const next: OsSession = { ...session, windows, zOrder, sizeClass, contentRev };
  const focused =
    session.focused && next.windows[session.focused] && next.windows[session.focused]!.phase.s !== 'minimized'
      ? session.focused
      : null;
  return { ...next, focused: focused ?? (session.focused ? topmostFocusable(next) : null) };
}

/** What is written to `pf.sessions.v1`: sessions + learned geometry. Continuity and overlays never persist. */
export function toPersisted(state: KernelState, now: number, contentRev: string): PersistedSessionsV1 {
  const sessions: Partial<Record<OsId, OsSession>> = {};
  for (const os of OS_IDS) {
    const session = state.sessions[os];
    if (Object.keys(session.windows).length || session.terminal || session.bootSeen || session.lockSeen)
      sessions[os] = session;
  }
  return { v: 1, savedAt: now, contentRev, sessions, learnedRects: state.learnedRects };
}

export const isFresh = (savedAt: number, now: number, ttl: number) => now - savedAt >= 0 && now - savedAt < ttl;
