/**
 * The search engine for one OS, loaded the first time its search surface opens (shared/15 `SRCH-LAZY-01`: never part
 * of an OS's first load). The surface opens instantly with the zero state while this resolves. One index, one matcher.
 */
import type { OsId } from '@/lib/kernel/ids';
import type { SearchEntry, SearchResult } from './types';

export interface SearchEngine {
  readonly entries: readonly SearchEntry[];
  query(text: string, limit?: number): readonly SearchResult[];
  zero(recent: readonly string[]): readonly SearchEntry[];
}

const engines = new Map<OsId, Promise<SearchEngine>>();

export function loadSearchEngine(os: OsId, extra: readonly SearchEntry[] = []): Promise<SearchEngine> {
  const cached = engines.get(os);
  if (cached) return cached;
  const request = Promise.all([
    import('./index-builder'),
    import('./matcher'),
    import('@/lib/terminal/manifest'),
    import('@/data/content-index'),
    import('@/lib/kernel/route'),
    import('@/lib/kernel/registry'),
    import('@/data/selectors'),
  ]).then(([builder, matcher, manifest, content, route, registry, selectors]) => {
    const entries: readonly SearchEntry[] = [
      ...builder.buildSearchIndex({
        os,
        registry: registry.OS_REGISTRY,
        catalog: content.contentIndex,
        visible: route.VISIBLE_OSES,
        commands: manifest.searchableCommands(),
        featured: selectors.getFeaturedProjects().map((project) => project.slug),
      }),
      ...extra,
    ];
    const prepared = matcher.prepare(entries);
    return {
      entries,
      query: (text: string, limit = 24) => matcher.search(prepared, text, limit),
      zero: (recent: readonly string[]) => matcher.zeroState(entries, recent),
    };
  });
  engines.set(os, request);
  request.catch(() => engines.delete(os));
  return request;
}
