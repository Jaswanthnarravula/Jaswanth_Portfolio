/**
 * OG-FIT-01, OG-META-01, OG-REUSE-01, OG-LD-01, OG-MAP-01 / DEPLOY-SEO-01, OG-MARK-01.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contentIndex } from '@/data/content-index';
import { routeCodec, routeOf } from '@/lib/kernel/route';
import { OS_IDS } from '@/lib/kernel/ids';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import { createRouteCodec } from '@/lib/kernel/route/codec';
import { canonicalPaths, enumerateOsRoutes } from '@/lib/kernel/route/static-params';
import { cardFor } from '@/lib/seo/cards';
import { metadataForRoute, personJsonLd, projectJsonLd } from '@/lib/seo/metadata';
import { fitTitle, truncateWords } from '@/lib/seo/og';
import { sitemapEntries } from '@/app/sitemap';

const allCodec = createRouteCodec({ registry: OS_REGISTRY, catalog: contentIndex, visible: OS_IDS });
const osPaths = canonicalPaths(
  enumerateOsRoutes({ registry: OS_REGISTRY, catalog: contentIndex, visible: OS_IDS }),
  allCodec,
);

describe('OG-FIT-01 title auto-fit and truncation', () => {
  it('fits between 56 and 84 px on at most two lines', () => {
    expect(fitTitle('Projects')).toMatchObject({ fontSize: 84, lines: 1 });
    const long = fitTitle(
      'A remarkably long project name that keeps going well past what fits on a single social card line',
    );
    expect(long.fontSize).toBeGreaterThanOrEqual(56);
    expect(long.lines).toBeLessThanOrEqual(2);
  });
  it('truncates summaries on a word boundary (≤ 110 chars)', () => {
    const text = 'word '.repeat(60);
    const out = truncateWords(text);
    expect(out.length).toBeLessThanOrEqual(110);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toMatch(/\s…$/);
  });
  it('missing summary → tagline → first highlight', () => {
    const card = cardFor({ section: 'projects', slug: 'enterprise-sso' });
    expect(card.summary).toBe('An OAuth 2.1 + OpenID Connect provider written from scratch in Go.');
  });
});

describe('OG-META-01 titles, descriptions, canonical, twitter card', () => {
  it('every OS and /go route gets unique titles, a description and a /go canonical', () => {
    const titles = new Set<string>();
    for (const path of osPaths) {
      const metadata = metadataForRoute(routeOf(allCodec.decode(path)));
      const title = (metadata.title as { absolute: string }).absolute;
      expect(titles.has(title), title).toBe(false);
      titles.add(title);
      expect(metadata.description).toBeTruthy();
      expect(String(metadata.alternates?.canonical)).toMatch(/^\/go\//);
      expect((metadata.twitter as { card?: string }).card).toBe('summary_large_image');
    }
  });
});

describe('OG-REUSE-01 OS routes reuse the content card', () => {
  it('generateMetadata for an OS route points at the /go card', () => {
    const route = routeOf(allCodec.decode('/macos/finder/experience/ibm'));
    const images = metadataForRoute(route).openGraph?.images as { url: string }[];
    expect(images[0]!.url).toBe('/og/experience/ibm');
    const home = metadataForRoute(routeOf(allCodec.decode('/windows'))).openGraph?.images as { url: string }[];
    expect(home[0]!.url).toBe('/og/about');
  });
});

describe('OG-LD-01 JSON-LD Person + project schemas', () => {
  it('Person has the required fields', () => {
    const person = personJsonLd();
    expect(person).toMatchObject({ '@context': 'https://schema.org', '@type': 'Person', name: 'Jaswanth Narravula' });
    expect(Array.isArray(person.sameAs)).toBe(true);
    expect((person.knowsAbout as string[]).length).toBeGreaterThan(5);
  });
  it('projects are CreativeWork (no public repository) with a creator', () => {
    const project = projectJsonLd('enterprise-sso');
    expect(project).toMatchObject({
      '@type': 'CreativeWork',
      name: 'Enterprise SSO Identity Provider',
      creator: { '@type': 'Person' },
    });
    expect(JSON.stringify(project)).not.toContain('undefined');
  });
});

describe('OG-MAP-01 / DEPLOY-SEO-01 sitemap, robots, manifest', () => {
  it('sitemap lists only /, /plain and /go/*, and every canonical resolves', () => {
    const entries = sitemapEntries('https://example.com', new Date(0));
    const paths = entries.map((entry) => new URL(entry.url).pathname);
    expect(paths.slice(0, 2)).toEqual(['/', '/plain']);
    for (const path of paths.slice(2)) {
      expect(path).toMatch(/^\/go\//);
      expect(routeCodec.decode(path).ok).toBe(true);
    }
    expect(paths.length).toBe(2 + contentIndex.entries.length);
  });
  it('robots allows all and points at the sitemap; preview builds disallow', () => {
    const robots = readFileSync('app/robots.ts', 'utf8');
    expect(robots).toContain("allow: '/'");
    expect(robots).toContain('/sitemap.xml');
    expect(robots).toContain("disallow: '/'");
  });
});

describe('OG-MARK-01 the OG template imports only original assets', () => {
  it('no official asset, icon component or third-party wording in the card template', () => {
    const source = readFileSync('lib/seo/og.tsx', 'utf8') + readFileSync('lib/seo/cards.ts', 'utf8');
    expect(source).not.toMatch(/assets\/official|AssetIcon|resolveAsset|<img/);
    expect(source).not.toMatch(/Netflix|macOS|Windows 11|Android|iOS/);
  });
});
