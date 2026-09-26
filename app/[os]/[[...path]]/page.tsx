/**
 * Every OS URL is a static page (shared/01 `ARCH-STATIC-01`): the server renders the semantic fallback of the
 * addressed section; the OS layer fades in above it on the client. Only visible OSes are generated.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SemanticFallback } from '@/components/shell/SemanticFallback';
import { routeCodec, staticOsParams } from '@/lib/kernel/route';
import type { RouteState } from '@/lib/kernel/types';
import { metadataForRoute } from '@/lib/seo/metadata';

export const dynamicParams = false;

export function generateStaticParams() {
  return staticOsParams();
}

type Params = Promise<{ os: string; path?: string[] }>;

function decode(os: string, path: readonly string[] = []): Extract<RouteState, { kind: 'os' }> | null {
  const result = routeCodec.decode(`/${[os, ...path].join('/')}`);
  return result.ok && result.route.kind === 'os' ? result.route : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { os, path } = await params;
  const route = decode(os, path);
  return route ? metadataForRoute(route) : {};
}

export default async function OsPage({ params }: { params: Params }) {
  const { os, path } = await params;
  const route = decode(os, path);
  if (!route) notFound();
  return <SemanticFallback route={route} />;
}
