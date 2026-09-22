/**
 * One title function for `generateMetadata` (server) and RouteSync's `document.title` (client) — `ROUTE-TITLE-01`.
 * Site-level branding never carries third-party marks (`ASSET-MARK-01`); OS routes name the OS nominatively.
 */
import { SECTION_TITLES, type ContentCatalog } from '@/data/content-index';
import type { ContentRef } from '@/data/schema';
import { getBinding, OS_REGISTRY } from '../registry';
import type { OsRegistry, RouteState } from '../types';
import { refForLocation } from './codec';

export const SITE_TITLE = 'Jaswanth Narravula — Portfolio';
const SUFFIX = ' — Jaswanth';

export interface TitleDeps {
  readonly catalog: ContentCatalog;
  readonly registry?: OsRegistry;
}

export function titleFor(route: RouteState, { catalog, registry = OS_REGISTRY }: TitleDeps): string {
  switch (route.kind) {
    case 'welcome':
      return SITE_TITLE;
    case 'plain':
      return `Plain portfolio${SUFFIX}`;
    case 'go':
      return `${catalog.get(route.ref)?.title ?? SECTION_TITLES[route.ref.section]}${SUFFIX}`;
    case 'os': {
      const os = registry[route.os];
      if (!route.focus) return `${os.name}${SUFFIX}`;
      const binding = getBinding(route.os, route.focus.role, registry);
      const app = binding?.title ?? os.name;
      const { location } = route.focus;
      let place: string | null = null;
      if (route.os === 'linux' && location.kind === 'vfs') {
        if (route.focus.role === 'terminal') place = location.path.length ? `~/${location.path.join('/')}` : '~';
        else
          place =
            catalog.get(refForLocation(route.os, route.focus.role, location, registry) ?? { section: 'about' })
              ?.title ?? null;
      } else if (location.kind === 'content') {
        place = catalog.get(location.ref)?.title ?? SECTION_TITLES[location.ref.section];
      } else if (location.kind === 'root' && binding?.home) {
        place = catalog.get({ section: binding.home } as ContentRef)?.title ?? SECTION_TITLES[binding.home];
      }
      return place ? `${place} · ${app} · ${os.name}${SUFFIX}` : `${app} · ${os.name}${SUFFIX}`;
    }
    default: {
      const exhaustive: never = route;
      return exhaustive;
    }
  }
}
