/**
 * Static Open Graph cards (shared/19 `OG-GEN-01`): `/og/site`, `/og/plain`, `/og/{section}[/{slug}]`. Pre-rendered at
 * build with `next/og`; OS routes point their `og:image` at the card of the content they show (`OG-REUSE-01`).
 */
import { routeCodec, staticGoParams } from '@/lib/kernel/route';
import { cardFor, plainCard } from '@/lib/seo/cards';
import { renderOgCard } from '@/lib/seo/og';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ card: ['site'] }, { card: ['plain'] }, ...staticGoParams().map(({ target }) => ({ card: target }))];
}

export async function GET(_request: Request, { params }: { params: Promise<{ card: string[] }> }) {
  const { card } = await params;
  if (card.length === 1 && card[0] === 'site') return renderOgCard(cardFor(null));
  if (card.length === 1 && card[0] === 'plain') return renderOgCard(plainCard());
  const result = routeCodec.decode(`/go/${card.join('/')}`);
  if (!result.ok || result.route.kind !== 'go') return new Response('Not found', { status: 404 });
  return renderOgCard(cardFor(result.route.ref));
}
