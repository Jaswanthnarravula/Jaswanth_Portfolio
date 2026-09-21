/**
 * URL codec — shared/05 `ROUTE-CODEC-01/02`. The URL encodes only OS + focused app + its location.
 * Invariant (unit-tested): `encode(decode(p).route) === decode(p).canonical` for every generated static path.
 */
import type { ContentCatalog } from '@/data/content-index';
import { isCollectionSection, isSectionId, refSlug, type ContentRef } from '@/data/schema';
import { isOsId, type AppRole, type OsId, type SectionId } from '../ids';
import { getBinding, getBindingBySlug } from '../registry';
import {
  routePath,
  type AppLocation,
  type DecodeFailure,
  type DecodeResult,
  type OsAppBinding,
  type OsRegistry,
  type RoutePath,
  type RouteState,
} from '../types';

export interface RouteCodec {
  decode(pathname: string): DecodeResult;
  encode(route: RouteState): RoutePath;
}

export interface CodecDeps {
  readonly registry: OsRegistry;
  readonly catalog: ContentCatalog;
  /** OSes whose URLs resolve (released + preview allow-list). */
  readonly visible: readonly OsId[];
}

const WELCOME: RouteState = { kind: 'welcome' };

// --- Linux: the URL carries the terminal cwd / viewer file (linux/03 "URL mapping") -------------------------------

export const LINUX_DIRS = ['projects', 'experience', 'education'] as const;

export function linuxTerminalPaths(_catalog?: ContentCatalog): readonly (readonly string[])[] {
  return [[], ...LINUX_DIRS.map((dir) => [dir])];
}

export function linuxViewerPaths(catalog: ContentCatalog): readonly (readonly string[])[] {
  return [['resume'], ...LINUX_DIRS.flatMap((dir) => catalog.slugs(dir).map((slug) => [dir, slug]))];
}

const samePath = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((part, i) => part === b[i]);

/** Where a `ContentRef` lives in Linux: directory listings in the terminal, detail files in the viewer. */
export function linuxLocationFor(ref: ContentRef): { role: AppRole; location: AppLocation } {
  const slug = refSlug(ref);
  switch (ref.section) {
    case 'projects':
    case 'experience':
    case 'education':
      return slug
        ? { role: 'viewer', location: { kind: 'vfs', path: [ref.section, slug] } }
        : { role: 'terminal', location: { kind: 'vfs', path: [ref.section] } };
    case 'resume':
      return { role: 'viewer', location: { kind: 'vfs', path: ['resume'] } };
    default:
      return { role: 'terminal', location: { kind: 'vfs', path: [] } };
  }
}

/** The `ContentRef` a location shows, if any (continuity capture, search, titles). App roots have none. */
export function refForLocation(
  os: OsId,
  role: AppRole,
  location: AppLocation,
  registry: OsRegistry,
): ContentRef | null {
  if (location.kind === 'content') return location.ref;
  if (location.kind === 'root') {
    const binding = getBinding(os, role, registry);
    const only = binding?.owns.length === 1 ? binding.owns[0] : undefined;
    return only ? ({ section: only } as ContentRef) : null;
  }
  const [first, second] = location.path;
  if (os !== 'linux' || !first) return null;
  if (first === 'resume') return { section: 'resume' };
  if (first === 'projects' || first === 'experience' || first === 'education')
    return second ? { section: first, slug: second } : { section: first };
  return null;
}

/** The location an app should show for a ref (the inverse of `refForLocation`). */
export function locationForRef(os: OsId, ref: ContentRef): { role: AppRole | null; location: AppLocation } {
  if (os === 'linux') return linuxLocationFor(ref);
  return { role: null, location: { kind: 'content', ref } };
}

// --- Codec ------------------------------------------------------------------------------------------------------

export function createRouteCodec({ registry, catalog, visible }: CodecDeps): RouteCodec {
  const osHome = (os: OsId): RouteState =>
    os === 'linux'
      ? { kind: 'os', os, focus: { role: 'terminal', location: { kind: 'vfs', path: [] } } }
      : { kind: 'os', os, focus: null };

  const fail = (nearest: RouteState, reason: DecodeFailure): DecodeResult => ({ ok: false, nearest, reason });

  const ok = (route: RouteState): DecodeResult => ({ ok: true, route, canonical: encode(route) });

  const sectionRef = (section: SectionId, slug?: string): ContentRef =>
    (slug ? { section, slug } : { section }) as ContentRef;

  /** Decode `[section?, slug?]` relative to what a binding owns. */
  function decodeContent(os: OsId, binding: OsAppBinding, rest: readonly string[]): DecodeResult {
    const at = (location: AppLocation): RouteState => ({ kind: 'os', os, focus: { role: binding.role, location } });
    const root = at({ kind: 'root' });
    const only = binding.owns.length === 1 ? binding.owns[0] : undefined;

    if (binding.owns.length === 0) return rest.length === 0 ? ok(root) : fail(root, 'unknown-slug');

    let section: SectionId | undefined;
    let tail: readonly string[];
    if (only) {
      section = only;
      // Long form (`/ios/github/projects/x`) is accepted and canonicalized to the elided form.
      tail = rest[0] === only ? rest.slice(1) : rest;
    } else {
      if (rest.length === 0) return ok(root);
      const candidate = rest[0];
      if (!isSectionId(candidate) || !binding.owns.includes(candidate)) return fail(root, 'unknown-slug');
      section = candidate;
      tail = rest.slice(1);
    }

    const sectionRoute = at({ kind: 'content', ref: sectionRef(section) });
    if (tail.length === 0) return ok(sectionRoute);
    const [slug, ...extra] = tail;
    if (!slug || extra.length > 0 || !isCollectionSection(section) || !catalog.slugs(section).includes(slug))
      return fail(sectionRoute, 'unknown-slug');
    return ok(at({ kind: 'content', ref: sectionRef(section, slug) }));
  }

  function decodeLinux(binding: OsAppBinding, rest: readonly string[]): DecodeResult {
    const home = osHome('linux');
    const at = (location: AppLocation): RouteState => ({
      kind: 'os',
      os: 'linux',
      focus: { role: binding.role, location },
    });
    if (binding.role === 'terminal') {
      if (rest.length === 0) return ok(at({ kind: 'root' }));
      return linuxTerminalPaths(catalog).some((path) => samePath(path, rest))
        ? ok(at({ kind: 'vfs', path: [...rest] }))
        : fail(home, 'bad-vfs-path');
    }
    if (binding.role === 'viewer') {
      return linuxViewerPaths(catalog).some((path) => samePath(path, rest))
        ? ok(at({ kind: 'vfs', path: [...rest] }))
        : fail(home, 'bad-vfs-path');
    }
    return rest.length === 0 ? ok(at({ kind: 'root' })) : fail(home, 'bad-vfs-path');
  }

  function decode(pathname: string): DecodeResult {
    let segments: string[];
    try {
      segments = pathname
        .split(/[?#]/)[0]!
        .split('/')
        .filter(Boolean)
        .map((segment) => decodeURIComponent(segment));
    } catch {
      return fail(WELCOME, 'unknown-os');
    }
    const [head, ...rest] = segments;
    if (!head) return ok(WELCOME);

    if (head === 'plain') return rest.length === 0 ? ok({ kind: 'plain' }) : fail({ kind: 'plain' }, 'unknown-slug');

    if (head === 'go') {
      const [section, slug, ...extra] = rest;
      if (!section || !isSectionId(section)) return fail(WELCOME, 'unknown-slug');
      const sectionRoute: RouteState = { kind: 'go', ref: sectionRef(section) };
      if (!slug) return ok(sectionRoute);
      if (extra.length > 0 || !isCollectionSection(section) || !catalog.slugs(section).includes(slug))
        return fail(sectionRoute, 'unknown-slug');
      return ok({ kind: 'go', ref: sectionRef(section, slug) });
    }

    if (!isOsId(head)) return fail(WELCOME, 'unknown-os');
    if (!visible.includes(head)) return fail(WELCOME, 'unreleased-os');
    const [appSlug, ...tail] = rest;
    if (!appSlug) return ok(osHome(head));
    const binding = getBindingBySlug(head, appSlug, registry);
    if (!binding) return fail(osHome(head), 'unknown-app');
    return head === 'linux' ? decodeLinux(binding, tail) : decodeContent(head, binding, tail);
  }

  function encodeContent(os: OsId, binding: OsAppBinding, location: AppLocation): string {
    const base = `/${os}/${binding.slug}`;
    if (location.kind !== 'content') return base;
    const { ref } = location;
    if (!binding.owns.includes(ref.section)) return base;
    const slug = refSlug(ref);
    const sectionPart = binding.owns.length === 1 ? '' : `/${ref.section}`;
    return `${base}${sectionPart}${slug ? `/${encodeURIComponent(slug)}` : ''}`;
  }

  function encodeLinux(role: AppRole, location: AppLocation): string {
    const resolved = location.kind === 'content' ? linuxLocationFor(location.ref) : { role, location };
    const target = resolved.location;
    if (resolved.role === 'terminal') {
      if (target.kind === 'root') return '/linux/terminal';
      if (target.kind === 'vfs' && target.path.length > 0)
        return `/linux/terminal/${target.path.map(encodeURIComponent).join('/')}`;
      return '/linux';
    }
    if (resolved.role === 'viewer' && target.kind === 'vfs' && target.path.length > 0)
      return `/linux/viewer/${target.path.map(encodeURIComponent).join('/')}`;
    return '/linux';
  }

  function encode(route: RouteState): RoutePath {
    switch (route.kind) {
      case 'welcome':
        return routePath('/');
      case 'plain':
        return routePath('/plain');
      case 'go': {
        const slug = refSlug(route.ref);
        return routePath(`/go/${route.ref.section}${slug ? `/${encodeURIComponent(slug)}` : ''}`);
      }
      case 'os': {
        if (!route.focus) return routePath(`/${route.os}`);
        if (route.os === 'linux') return routePath(encodeLinux(route.focus.role, route.focus.location));
        const binding = getBinding(route.os, route.focus.role, registry);
        if (!binding) return routePath(`/${route.os}`);
        return routePath(encodeContent(route.os, binding, route.focus.location));
      }
      default: {
        const exhaustive: never = route;
        return exhaustive;
      }
    }
  }

  return { decode, encode };
}

/** Result of decoding a URL, collapsed to the route to show (repairs use `nearest`). */
export const routeOf = (result: DecodeResult): RouteState => (result.ok ? result.route : result.nearest);
