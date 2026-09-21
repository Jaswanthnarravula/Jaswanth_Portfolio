/**
 * Metadata per route — shared/19 `OG-META-01`, `OG-REUSE-01`, `OG-LD-01`. Titles come from the one shared title
 * function (RouteSync uses it for `document.title`). Canonical URL of every OS route is its `/go/*` page, whose card
 * the OS route reuses. No third-party marks in site-level titles, cards or the manifest.
 */
import type { Metadata } from 'next';
import { SECTION_TITLES } from '@/data/content-index';
import { refSlug, type ContentRef } from '@/data/schema';
import { getContactChannels, getIndexEntry, getPerson, getProject, getSkills } from '@/data/selectors';
import type { ProjectSlug } from '@/data/content-index';
import { publicEnv } from '@/lib/config/environment';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import { refForLocation, routeTitle, SITE_TITLE } from '@/lib/kernel/route';
import type { RouteState } from '@/lib/kernel/types';

export const SITE_DESCRIPTION = (() => {
  const person = getPerson();
  return `${person.name} — ${person.headline}. Explore the portfolio as five small operating systems, or read it plainly.`;
})();

export const goPath = (ref: ContentRef): string => {
  const slug = refSlug(ref);
  return `/go/${ref.section}${slug ? `/${slug}` : ''}`;
};

/** The content ref a route shows (OS homes and app roots without content resolve to About). */
export function canonicalRef(route: RouteState): ContentRef | null {
  switch (route.kind) {
    case 'go':
      return route.ref;
    case 'os':
      if (!route.focus) return { section: 'about' };
      return refForLocation(route.os, route.focus.role, route.focus.location, OS_REGISTRY) ?? { section: 'about' };
    default:
      return null;
  }
}

/** Card URL for a ref (`/og/{section}[/{slug}]`), the reader page (`/og/plain`) or the site (`/og/site`). */
export const ogImagePath = (ref: ContentRef | null, page: 'site' | 'plain' = 'site'): string =>
  ref ? `/og${goPath(ref).slice(3)}` : `/og/${page}`;

export function metadataForRoute(route: RouteState): Metadata {
  const ref = canonicalRef(route);
  const entry = ref ? getIndexEntry(ref) : undefined;
  const title = routeTitle(route);
  const description = entry?.summary ?? SITE_DESCRIPTION;
  const canonical = ref ? goPath(ref) : route.kind === 'plain' ? '/plain' : '/';
  const image = {
    url: ogImagePath(ref, route.kind === 'plain' ? 'plain' : 'site'),
    width: 1200,
    height: 630,
    alt: entry?.title ?? getPerson().name,
  };
  const type = ref?.section === 'about' ? 'profile' : ref && refSlug(ref) ? 'article' : 'website';
  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type, images: [image], siteName: SITE_TITLE },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
    robots: { index: true, follow: true },
  };
}

export const absoluteUrl = (path: string): string => new URL(path, publicEnv.siteUrl).toString();

/** JSON-LD `Person` (on `/` and `/go/about`). */
export function personJsonLd(): Record<string, unknown> {
  const person = getPerson();
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: person.name,
    jobTitle: person.role,
    description: person.headline,
    url: absoluteUrl('/'),
    address: { '@type': 'PostalAddress', addressLocality: person.location },
    sameAs: getContactChannels().map((link) => link.url),
    knowsAbout: getSkills()
      .flatMap((group) => group.items.map((item) => item.name))
      .slice(0, 24),
  };
}

/** JSON-LD for a project page (`SoftwareSourceCode` when a repository exists, else `CreativeWork`). */
export function projectJsonLd(slug: ProjectSlug): Record<string, unknown> | null {
  const project = getProject(slug);
  if (!project) return null;
  return {
    '@context': 'https://schema.org',
    '@type': project.repo ? 'SoftwareSourceCode' : 'CreativeWork',
    name: project.name,
    description: project.tagline,
    url: absoluteUrl(goPath({ section: 'projects', slug })),
    ...(project.repo ? { codeRepository: project.repo } : {}),
    ...(project.year ? { dateCreated: String(project.year) } : {}),
    programmingLanguage: project.stack.slice(0, 4),
    creator: { '@type': 'Person', name: getPerson().name },
  };
}

export const sectionTitle = (ref: ContentRef) => getIndexEntry(ref)?.title ?? SECTION_TITLES[ref.section];
