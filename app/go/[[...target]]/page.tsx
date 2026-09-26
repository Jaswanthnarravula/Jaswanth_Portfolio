/**
 * `/go/{section}[/{slug}]` — the canonical OS-agnostic link (shared/05 `ROUTE-GO-01`). Statically rendered as the
 * semantic page; on the client it resolves into the visitor's OS with `replaceState`, so Back never bounces here.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SemanticFallback } from '@/components/shell/SemanticFallback';
import { refSlug } from '@/data/schema';
import { routeCodec, staticGoParams } from '@/lib/kernel/route';
import type { RouteState } from '@/lib/kernel/types';
import { metadataForRoute, personJsonLd, projectJsonLd } from '@/lib/seo/metadata';
import type { ProjectSlug } from '@/data/content-index';

export const dynamicParams = false;

export function generateStaticParams() {
  return staticGoParams();
}

type Params = Promise<{ target?: string[] }>;

function decode(target: readonly string[] = []): Extract<RouteState, { kind: 'go' }> | null {
  const result = routeCodec.decode(`/go/${target.join('/')}`);
  return result.ok && result.route.kind === 'go' ? result.route : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const route = decode((await params).target);
  return route ? metadataForRoute(route) : {};
}

export default async function GoPage({ params }: { params: Params }) {
  const route = decode((await params).target);
  if (!route) notFound();
  const slug = refSlug(route.ref);
  const jsonLd =
    route.ref.section === 'about'
      ? personJsonLd()
      : route.ref.section === 'projects' && slug
        ? projectJsonLd(slug as ProjectSlug)
        : null;
  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
        />
      )}
      <SemanticFallback route={route} />
    </>
  );
}
