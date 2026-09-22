/** Structural validators for persisted payloads. Anything invalid is dropped, never thrown (`KRN-PERSIST-01`). */
import { isSectionId } from '@/data/schema';
import { clampSplit } from '../geometry';
import { isAppRole, isOsId, isSizeClass, SIZE_CLASSES, type SizeClass } from '../ids';
import {
  SNAP_ZONES,
  windowId,
  type AppLocation,
  type SnapState,
  type SnapZone,
  type NavStack,
  type PxRect,
  type TerminalSession,
  type WindowId,
  type WindowInstance,
  type WindowPhase,
} from '../types';

export type Json = unknown;

export const isRecord = (value: Json): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: Json): value is number => typeof value === 'number' && Number.isFinite(value);

export function parseRect(value: Json): PxRect | null {
  if (!isRecord(value)) return null;
  const { x, y, w, h } = value;
  if (![x, y, w, h].every(isFiniteNumber)) return null;
  if ((w as number) <= 0 || (h as number) <= 0) return null;
  return { x: x as number, y: y as number, w: w as number, h: h as number };
}

export function parseRectBuckets(value: Json): Partial<Record<SizeClass, PxRect>> {
  const buckets: Partial<Record<SizeClass, PxRect>> = {};
  if (!isRecord(value)) return buckets;
  for (const size of SIZE_CLASSES) {
    const rect = parseRect(value[size]);
    if (rect) buckets[size] = rect;
  }
  return buckets;
}

export function parseLocation(value: Json): AppLocation | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'root') return { kind: 'root' };
  if (value.kind === 'vfs' && Array.isArray(value.path) && value.path.every((part) => typeof part === 'string'))
    return { kind: 'vfs', path: value.path as string[] };
  if (value.kind === 'content' && isRecord(value.ref) && isSectionId(value.ref.section)) {
    const slug = value.ref.slug;
    if (slug !== undefined && typeof slug !== 'string') return null;
    return {
      kind: 'content',
      ref: (slug ? { section: value.ref.section, slug } : { section: value.ref.section }) as never,
    };
  }
  return null;
}

function parsePhase(value: Json): WindowPhase | null {
  if (!isRecord(value)) return null;
  switch (value.s) {
    case 'opening':
      return { s: 'opening', originId: typeof value.originId === 'string' ? value.originId : null };
    case 'normal':
    case 'closing':
      return { s: value.s };
    case 'maximized': {
      const restore = parseRect(value.restore);
      return restore ? { s: 'maximized', restore } : null;
    }
    case 'minimized': {
      const restore = parseRect(value.restore);
      return restore ? { s: 'minimized', restore, wasMaximized: value.wasMaximized === true } : null;
    }
    default:
      return null;
  }
}

function parseNav(value: Json): NavStack | null {
  if (!isRecord(value) || !Array.isArray(value.entries)) return null;
  const entries = value.entries.map(parseLocation).filter((entry): entry is AppLocation => entry !== null);
  if (entries.length === 0) return null;
  const index = isFiniteNumber(value.index)
    ? Math.min(Math.max(0, Math.trunc(value.index)), entries.length - 1)
    : entries.length - 1;
  return { entries, index };
}

export function parseWindow(value: Json): WindowInstance | null {
  if (!isRecord(value) || !isOsId(value.os) || !isAppRole(value.role)) return null;
  const id = windowId(value.os, value.role);
  if (value.id !== id) return null;
  const phase = parsePhase(value.phase);
  const nav = parseNav(value.nav);
  if (!phase || !nav) return null;
  return {
    id,
    os: value.os,
    role: value.role,
    phase,
    rect: parseRectBuckets(value.rect),
    nav,
    scrollTop: isFiniteNumber(value.scrollTop) ? Math.max(0, value.scrollTop) : 0,
    ...(typeof value.draft === 'string' ? { draft: value.draft.slice(0, 10_000) } : {}),
    invoker: typeof value.invoker === 'string' ? value.invoker : null,
    ...parseSnap(value.snap),
    ...parseUi(value.ui),
  };
}

/** Persisted app session state (addition, plans/ios/02): string values under short keys; anything else is dropped. */
function parseUi(value: Json): { ui?: Readonly<Record<string, string>> } {
  if (!isRecord(value)) return {};
  const ui: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value).slice(0, 24))
    if (key.length > 0 && key.length <= 40 && typeof entry === 'string') ui[key] = entry.slice(0, 4000);
  return Object.keys(ui).length > 0 ? { ui } : {};
}

/** A persisted Snap tag (Windows): a known zone, and a finite split for ½ + ½ pairs. Anything else floats. */
function parseSnap(value: Json): { snap?: SnapState } {
  if (!isRecord(value) || typeof value.zone !== 'string' || !(SNAP_ZONES as readonly string[]).includes(value.zone))
    return {};
  const zone = value.zone as SnapZone;
  return isFiniteNumber(value.split) ? { snap: { zone, split: clampSplit(value.split) } } : { snap: { zone } };
}

export function parseTerminal(value: Json): TerminalSession | null {
  if (!isRecord(value)) return null;
  const strings = (input: Json, cap: number) =>
    Array.isArray(input) ? input.filter((item): item is string => typeof item === 'string').slice(-cap) : [];
  return {
    cwd: strings(value.cwd, 64),
    history: strings(value.history, 200),
    scrollback: strings(value.scrollback, 500),
  };
}

export const parseWindowIdKey = (key: string): WindowId | null => {
  const [os, role, ...rest] = key.split(':');
  return rest.length === 0 && isOsId(os) && isAppRole(role) ? windowId(os, role) : null;
};

export const parseSizeClass = (value: Json, fallback: SizeClass): SizeClass => (isSizeClass(value) ? value : fallback);
