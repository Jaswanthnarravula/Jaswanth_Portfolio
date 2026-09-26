/**
 * Semantic fallback — shared/01: the server-rendered HTML version of the addressed section. It is the LCP element,
 * the SEO body, the no-JavaScript experience and the screen-reader fallback in one; the OS layer fades in above it.
 * Server component (no hooks); links are plain anchors so everything works without JavaScript.
 */
import { ContentFor } from '@/components/content';
import type { LinkSlotProps } from '@/components/content/slots';
import { goHref } from '@/components/content/slots';
import { SECTION_TITLES } from '@/data/content-index';
import type { ContentRef, SectionId } from '@/data/schema';
import { SECTION_IDS, refSlug } from '@/data/schema';
import { getIndexEntry, getPerson, getResume } from '@/data/selectors';
import { OS_NAMES, type OsId } from '@/lib/kernel/ids';
import { getBinding, OS_REGISTRY } from '@/lib/kernel/registry';
import { refForLocation, routeCodec, VISIBLE_OSES } from '@/lib/kernel/route';
import type { RouteState } from '@/lib/kernel/types';

type FallbackRoute = Extract<RouteState, { kind: 'go' } | { kind: 'os' }>;

function osLink(os: OsId) {
  return function OsFallbackLink({ to, children, ...rest }: LinkSlotProps) {
    const role = OS_REGISTRY[os].sectionOwner[to.section];
    const href = routeCodec.encode({ kind: 'os', os, focus: { role, location: { kind: 'content', ref: to } } });
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  };
}

function GoLink({ to, children, ...rest }: LinkSlotProps) {
  return (
    <a href={goHref(to)} {...rest}>
      {children}
    </a>
  );
}

/** The content a route shows: its focused content ref, or About for an OS home. */
export function refForRoute(route: FallbackRoute): ContentRef | null {
  if (route.kind === 'go') return route.ref;
  if (!route.focus) return { section: 'about' };
  return refForLocation(route.os, route.focus.role, route.focus.location, OS_REGISTRY);
}

export function SemanticFallback({ route }: { route: FallbackRoute }) {
  const person = getPerson();
  const resume = getResume();
  const ref = refForRoute(route);
  const entry = ref ? getIndexEntry(ref) : undefined;
  const current: SectionId | null = ref?.section ?? null;
  const os = route.kind === 'os' ? route.os : null;
  const app = os && route.kind === 'os' && route.focus ? getBinding(os, route.focus.role) : undefined;
  const Link = os ? osLink(os) : GoLink;
  const sectionHref = (section: SectionId) => {
    const target = { section } as ContentRef;
    if (!os) return goHref(target);
    return routeCodec.encode({
      kind: 'os',
      os,
      focus: { role: OS_REGISTRY[os].sectionOwner[section], location: { kind: 'content', ref: target } },
    });
  };
  const slug = ref ? refSlug(ref) : undefined;
  // List views have no title of their own; every other view's title becomes the page's single <h1>.
  const needsTitle =
    !ref ||
    (!slug &&
      (ref.section === 'projects' ||
        ref.section === 'experience' ||
        ref.section === 'education' ||
        ref.section === 'skills'));
  const title = entry?.title ?? (app ? app.title : SECTION_TITLES.about);

  return (
    <div className="doc">
      <header className="doc-top">
        <a className="doc-brand" href="/">
          {person.name}
          <span>{person.role}</span>
        </a>
        <nav className="doc-nav" aria-label="Sections">
          <ul>
            {SECTION_IDS.map((section) => (
              <li key={section}>
                <a
                  href={section === 'resume' ? resume.file : sectionHref(section)}
                  aria-current={section === current ? 'page' : undefined}
                  className={section === 'resume' ? 'doc-nav-resume' : undefined}
                  aria-label={section === 'resume' ? 'Résumé (PDF)' : undefined}
                >
                  {SECTION_TITLES[section]}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="doc-main" id="main">
        {os && (
          <p className="doc-notice">
            {app ? `${app.title} in ${OS_NAMES[os]}` : OS_NAMES[os]} — this page opens as an interactive {OS_NAMES[os]}{' '}
            when JavaScript is available.
          </p>
        )}
        {ref && slug && (
          <p className="doc-crumb">
            <a href={sectionHref(ref.section)}>← {SECTION_TITLES[ref.section]}</a>
          </p>
        )}
        {needsTitle && <h1 className="doc-title">{title}</h1>}
        {ref ? (
          <ContentFor target={ref} headingLevel={needsTitle ? 2 : 1} slots={{ Link }} depth />
        ) : (
          <p className="doc-lede">
            {app?.title} is part of the interactive {os ? OS_NAMES[os] : ''} experience.
          </p>
        )}
      </main>
      <FallbackFooter />
    </div>
  );
}

export function FallbackFooter() {
  const resume = getResume();
  return (
    <footer className="doc-footer">
      <ul>
        <li>
          <a href="/plain">Plain portfolio (reader mode)</a>
        </li>
        <li>
          <a href={resume.file}>Résumé (PDF)</a>
        </li>
        {VISIBLE_OSES.map((os) => (
          <li key={os}>
            <a href={`/${os}`}>Explore in {OS_NAMES[os]}</a>
          </li>
        ))}
      </ul>
    </footer>
  );
}
