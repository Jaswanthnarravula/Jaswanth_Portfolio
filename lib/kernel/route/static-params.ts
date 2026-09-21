/**
 * Static route enumeration — shared/01 `ARCH-STATIC-01`: OS × app × known slugs + Linux VFS paths, visible OSes only.
 * `generateStaticParams`, the sitemap and the codec round-trip test all read from here.
 */
import type { ContentCatalog } from '@/data/content-index';
import { SECTION_IDS, isCollectionSection, type ContentRef } from '@/data/schema';
import type { OsId } from '../ids';
import type { AppLocation, OsRegistry, RouteState } from '../types';
import { linuxTerminalPaths, linuxViewerPaths, type RouteCodec } from './codec';

export interface EnumerateDeps {
  readonly registry: OsRegistry;
  readonly catalog: ContentCatalog;
  readonly visible: readonly OsId[];
}

/** Every content ref: sections, then every slug of each collection section. */
export function allContentRefs(catalog: ContentCatalog): readonly ContentRef[] {
  const refs: ContentRef[] = [];
  for (const section of SECTION_IDS) {
    refs.push({ section } as ContentRef);
    if (isCollectionSection(section))
      for (const slug of catalog.slugs(section)) refs.push({ section, slug } as ContentRef);
  }
  return refs;
}

/** Every canonical OS route for the visible OSes (duplicates by URL are removed by the caller via the codec). */
export function enumerateOsRoutes({ registry, catalog, visible }: EnumerateDeps): readonly RouteState[] {
  const routes: RouteState[] = [];
  const refs = allContentRefs(catalog);
  for (const os of visible) {
    routes.push({ kind: 'os', os, focus: null });
    for (const binding of registry[os].apps) {
      const at = (location: AppLocation): RouteState => ({ kind: 'os', os, focus: { role: binding.role, location } });
      if (os === 'linux') {
        const paths = binding.role === 'terminal' ? linuxTerminalPaths(catalog) : linuxViewerPaths(catalog);
        if (binding.role === 'terminal') routes.push(at({ kind: 'root' }));
        for (const path of paths) routes.push(at({ kind: 'vfs', path }));
        continue;
      }
      routes.push(at({ kind: 'root' }));
      for (const ref of refs) if (binding.owns.includes(ref.section)) routes.push(at({ kind: 'content', ref }));
    }
  }
  return routes;
}

export function enumerateGoRoutes(catalog: ContentCatalog): readonly RouteState[] {
  return allContentRefs(catalog).map((ref) => ({ kind: 'go', ref }));
}

/** Unique canonical paths, in enumeration order. */
export function canonicalPaths(routes: readonly RouteState[], codec: RouteCodec): readonly string[] {
  return [...new Set(routes.map((route) => codec.encode(route)))];
}

/** `[os]/[[...path]]` params: `{ os, path }` with `path` empty for the OS home. */
export function osStaticParams(deps: EnumerateDeps, codec: RouteCodec): { os: string; path: string[] }[] {
  return canonicalPaths(enumerateOsRoutes(deps), codec).map((url) => {
    const [os = '', ...path] = url.split('/').filter(Boolean).map(decodeURIComponent);
    return { os, path };
  });
}

export function goStaticParams(catalog: ContentCatalog, codec: RouteCodec): { target: string[] }[] {
  return canonicalPaths(enumerateGoRoutes(catalog), codec).map((url) => ({
    target: url.split('/').filter(Boolean).slice(1).map(decodeURIComponent),
  }));
}
