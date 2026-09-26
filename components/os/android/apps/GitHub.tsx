'use client';
/**
 * GitHub — the projects as the Material GitHub app (plans/android/apps/github.md). The repository page's Case study tab
 * (`AND-GH-07`, shared/23): outlined decision cards, tonal result cards and a Deep dives list whose items open a
 * full-screen reader with a container transform from the item; system Back or ✕ closes it back into the item.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ContentFor, DeepDiveArticle } from '@/components/content';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { ANDROID_DURATION, ANDROID_EASING } from '../motion';
import { getContact, getPerson, getProjectsWithGithub } from '@/data/selectors';
import { currentLocation } from '@/lib/kernel/state';
import type { ContentRef } from '@/data/schema';
import { useKernel } from '@/stores/kernel-context';
import { dispatchSoon } from '@/stores/kernel-store';
import { AdaptiveIcon, BottomNav, IconButton, Symbol, TopBar } from '../ui';
import { useAndroid, useAppUi } from '../shell-context';
import type { AndroidAppProps } from './types';
import styles from '../android.module.css';

const NAV = [
  { id: 'home', label: 'Home', glyph: 'home' },
  { id: 'projects', label: 'Projects', glyph: 'book_2' },
  { id: 'profile', label: 'Profile', glyph: 'account_circle' },
] as const;

/** GitHub's language colours (linguist) for the repository cards' language dot. */
const LANGUAGE_COLOUR: Readonly<Record<string, string>> = {
  Go: '#00add8',
  Python: '#3572a5',
  Java: '#b07219',
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  React: '#61dafb',
  'Next.js': '#3178c6',
  FastAPI: '#3572a5',
};
/** A project's primary language: GitHub's own when enriched, else its first stack item without a version. */
const languageOf = (stack: readonly string[], github: { language: string | null } | null | undefined) =>
  github?.language ?? stack[0]?.replace(/\s+[\d.]+$/, '') ?? 'Code';

export default function GitHub({ id, headingId }: AndroidAppProps) {
  const android = useAndroid();
  const windowState = useKernel((state) => state.sessions.android.windows[id]);
  const location = windowState ? currentLocation(windowState) : { kind: 'root' as const };
  const detail =
    location.kind === 'content' && location.ref.section === 'projects' && 'slug' in location.ref && !!location.ref.slug;
  const [tab, setTab] = useAppUi(id, 'tab', location.kind === 'content' ? 'projects' : 'home');
  const [readmeTab, setReadmeTab] = useAppUi(id, 'detail-tab', 'readme');
  /** The open deep dive as `{project}:{dive}` — session state (shared/23); stale once another project shows. */
  const [docRaw, setDoc] = useAppUi(id, 'doc', '');
  const reader = useRef<HTMLElement>(null);
  const closing = useRef<Animation | null>(null);
  const returnTo = useRef<string | null>(null);
  const [filters, setFilters] = useState<readonly string[]>([]);
  const [menu, setMenu] = useState<string | null>(null);
  const repos = useMemo(() => getProjectsWithGithub(), []);
  const owner =
    getContact()
      .links.find((link) => link.kind === 'github')
      ?.handle.replace(/^@/, '') ?? getPerson().name;
  const languages = useMemo(
    () => [...new Set(repos.map(({ project, github }) => languageOf(project.stack, github)))].slice(0, 5),
    [repos],
  );
  const detailSlug =
    location.kind === 'content' && location.ref.section === 'projects' && 'slug' in location.ref
      ? (location.ref.slug ?? null)
      : null;
  const openDive =
    (detailSlug &&
      docRaw.startsWith(`${detailSlug}:`) &&
      repos
        .find(({ project }) => project.slug === detailSlug)
        ?.project.deepDives?.find((dive) => `${detailSlug}:${dive.slug}` === docRaw)) ||
    null;
  /** The list item the reader grows from (and returns focus to). */
  const originOf = (slug: string) => document.querySelector<HTMLElement>(`[data-and-doc="${slug}"]`);
  const insetOf = (item: HTMLElement | null, box: DOMRect) => {
    const from = item?.getBoundingClientRect();
    if (!from) return 'inset(0)';
    return `inset(${Math.max(0, from.top - box.top)}px ${Math.max(0, box.right - from.right)}px ${Math.max(0, box.bottom - from.bottom)}px ${Math.max(0, from.left - box.left)}px round 16px)`;
  };
  // Open: the reader grows out of its list item (container transform); reduced motion fades through.
  useLayoutEffect(() => {
    const el = reader.current;
    if (!openDive || !el) return;
    el.querySelector<HTMLElement>('[data-reader-title]')?.focus({ preventScroll: true });
    if (typeof el.animate !== 'function') return;
    const box = el.getBoundingClientRect();
    const frames = prefersReducedMotion()
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ clipPath: insetOf(originOf(openDive.slug), box) }, { clipPath: 'inset(0 round 0px)' }];
    el.animate(frames, { duration: ANDROID_DURATION.open, easing: ANDROID_EASING.emphasized });
  }, [openDive]);
  // Closed: focus returns to the list item the reader grew from.
  useLayoutEffect(() => {
    if (openDive || !returnTo.current) return;
    originOf(returnTo.current)?.focus({ preventScroll: true });
    returnTo.current = null;
  }, [openDive]);
  /** Close back into the item; any second Back finishes at once (input always wins). */
  const closeDoc = () => {
    const el = reader.current;
    const slug = openDive?.slug;
    const done = () => {
      closing.current = null;
      returnTo.current = slug ?? null;
      setDoc(null);
    };
    if (closing.current) {
      closing.current.finish();
      return;
    }
    if (!el || !slug || typeof el.animate !== 'function') return done();
    const box = el.getBoundingClientRect();
    const frames = prefersReducedMotion()
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [{ clipPath: 'inset(0 round 0px)' }, { clipPath: insetOf(originOf(slug), box) }];
    closing.current = el.animate(frames, {
      duration: ANDROID_DURATION.close,
      easing: ANDROID_EASING.accelerate,
      fill: 'forwards',
    });
    closing.current.onfinish = done;
  };
  useEffect(
    () =>
      android.registerBack(id, () => {
        if (openDive) {
          closeDoc();
          return true;
        }
        if (menu) {
          setMenu(null);
          return true;
        }
        return false;
      }),
    // closeDoc reads the refs and openDive at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [android, id, menu, openDive],
  );
  const open = (ref: ContentRef, origin?: HTMLElement) =>
    dispatchSoon({ type: 'NAVIGATE_IN_APP', id, location: { kind: 'content', ref }, ...(origin ? {} : {}) });
  if (detail) {
    const ref = location.ref;
    const entry = repos.find(({ project }) => project.slug === ref.slug);
    return (
      <div className={styles.app} aria-labelledby={headingId} data-app="github">
        <TopBar
          title="Repository"
          back={android.back}
          actions={
            <IconButton label="Share">
              <Symbol>share</Symbol>
            </IconButton>
          }
        />
        <main className={styles.appScroller}>
          {entry ? (
            // The GitHub app's repository header: owner, name, description, then language and stars.
            <header className={styles.repoHeader}>
              <span className={styles.repoOwner}>
                <AdaptiveIcon app="github" />
                {owner}
              </span>
              <h3>{entry.project.name}</h3>
              <p>{entry.project.tagline}</p>
              <small className={styles.repoMeta}>
                <span>
                  <i
                    className={styles.langDot}
                    style={{
                      ['--lang' as string]: LANGUAGE_COLOUR[languageOf(entry.project.stack, entry.github)],
                    }}
                  />
                  {languageOf(entry.project.stack, entry.github)}
                </span>
                <span>
                  <Symbol>star</Symbol>
                  {entry.github?.stars ?? 0} stars
                </span>
                {entry.project.year ? <span>{entry.project.year}</span> : null}
              </small>
            </header>
          ) : null}
          <div className={styles.detailTabs} role="tablist" aria-label="Repository">
            <button role="tab" aria-selected={readmeTab === 'readme'} onClick={() => setReadmeTab('readme')}>
              README
            </button>
            {entry?.project.caseStudy ? (
              <button role="tab" aria-selected={readmeTab === 'case'} onClick={() => setReadmeTab('case')}>
                Case study
              </button>
            ) : null}
            <button role="tab" aria-selected={readmeTab === 'stack'} onClick={() => setReadmeTab('stack')}>
              Stack
            </button>
            <button role="tab" aria-selected={readmeTab === 'about'} onClick={() => setReadmeTab('about')}>
              About
            </button>
          </div>
          {readmeTab === 'case' && entry?.project.caseStudy ? (
            <section className={`${styles.proseCard} ${styles.caseStudy}`}>
              <h4>The problem</h4>
              {entry.project.caseStudy.problem.map((paragraph) => (
                <p key={paragraph.slice(0, 40)}>{paragraph}</p>
              ))}
              <h4>My role</h4>
              <p>{entry.project.caseStudy.role}</p>
              <h4>Key decisions</h4>
              <ul className={styles.decisionCards}>
                {entry.project.caseStudy.decisions.map((decision) => (
                  <li key={decision.title}>
                    <strong>{decision.title}</strong>
                    <p>{decision.detail}</p>
                    {decision.rejected ? <p className={styles.rejected}>Rejected: {decision.rejected}</p> : null}
                  </li>
                ))}
              </ul>
              <h4>Results</h4>
              <dl className={styles.resultCards}>
                {entry.project.caseStudy.results.map((metric) => (
                  <div key={metric.label}>
                    <dt>{metric.label}</dt>
                    <dd>{metric.value}</dd>
                  </div>
                ))}
              </dl>
              {entry.project.deepDives?.length ? (
                <>
                  <h4>Deep dives</h4>
                  <ul className={styles.diveList}>
                    {entry.project.deepDives.map((dive) => (
                      <li key={dive.slug}>
                        <button
                          type="button"
                          data-and-doc={dive.slug}
                          onClick={() => setDoc(`${entry.project.slug}:${dive.slug}`)}
                        >
                          <Symbol>description</Symbol>
                          <span>
                            <strong>{dive.title}</strong>
                            <small>{dive.summary}</small>
                          </span>
                          <Symbol>chevron_right</Symbol>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          ) : readmeTab === 'readme' || readmeTab === 'case' ? (
            <article className={styles.reader}>
              <ContentFor target={ref} headingLevel={3} />
            </article>
          ) : (
            <section className={styles.proseCard}>
              <h4>{readmeTab === 'stack' ? 'Technology stack' : 'About this repository'}</h4>
              <ContentFor target={ref} density="compact" headingLevel={4} />
            </section>
          )}
        </main>
        {openDive ? (
          // AND-GH-07: the M3 full-screen reader over the repository page (session state, closed by Back or ✕).
          <section ref={reader} className={styles.diveReader} aria-labelledby="and-dive-title">
            <header className={styles.topBar}>
              <IconButton label="Close" onClick={closeDoc}>
                <Symbol>close</Symbol>
              </IconButton>
              <h3 id="and-dive-title" tabIndex={-1} data-reader-title="">
                {openDive.title}
              </h3>
            </header>
            <div className={styles.diveBody}>
              <DeepDiveArticle data={openDive} headingLevel={4} />
            </div>
          </section>
        ) : null}
      </div>
    );
  }
  const shown = filters.length
    ? repos.filter(({ project, github }) => filters.includes(languageOf(project.stack, github)))
    : repos;
  return (
    <div className={styles.app} aria-labelledby={headingId} data-app="github">
      <TopBar
        title={tab === 'projects' ? 'Repositories' : tab === 'profile' ? 'Profile' : 'Home'}
        actions={
          <IconButton label="Search">
            <Symbol>search</Symbol>
          </IconButton>
        }
      />
      <main className={styles.appScroller}>
        {tab === 'home' ? (
          <div className={styles.materialPage}>
            <h4>My work</h4>
            <button className={styles.listRow} onClick={() => setTab('projects')}>
              <span className={styles.tonalIcon}>
                <Symbol>book_2</Symbol>
              </span>
              <span>
                <strong>Projects</strong>
                <small>Repositories and case studies</small>
              </span>
            </button>
            <button
              className={styles.listRow}
              onClick={(event) => android.openContent({ section: 'resume' }, event.currentTarget)}
            >
              <span className={styles.tonalIcon}>
                <Symbol>description</Symbol>
              </span>
              <span>
                <strong>Résumé</strong>
                <small>Experience and skills</small>
              </span>
            </button>
            <button
              className={styles.listRow}
              onClick={(event) => android.openApp('mail', undefined, event.currentTarget)}
            >
              <span className={styles.tonalIcon}>
                <Symbol>mail</Symbol>
              </span>
              <span>
                <strong>Contact</strong>
                <small>Start a conversation</small>
              </span>
            </button>
            <h4>Favorites</h4>
            <div className={styles.cardRail}>
              {repos
                .filter(({ project }) => project.featured)
                .map(({ project }) => (
                  <button
                    key={project.slug}
                    className={styles.projectCard}
                    onClick={(event) => open({ section: 'projects', slug: project.slug }, event.currentTarget)}
                  >
                    <strong>{project.name}</strong>
                    <span>{project.tagline}</span>
                  </button>
                ))}
            </div>
          </div>
        ) : null}
        {tab === 'projects' ? (
          <div className={styles.materialPage}>
            <div className={styles.chips} role="group" aria-label="Filter repositories">
              <button aria-pressed={filters.length === 0} onClick={() => setFilters([])}>
                {filters.length === 0 ? <Symbol>check</Symbol> : null}
                All
              </button>
              {languages.map((filter) => (
                <button
                  key={filter}
                  aria-pressed={filters.includes(filter)}
                  onClick={() =>
                    setFilters((all) =>
                      all.includes(filter) ? all.filter((item) => item !== filter) : [...all, filter],
                    )
                  }
                >
                  {filters.includes(filter) ? <Symbol>check</Symbol> : null}
                  {filter}
                </button>
              ))}
            </div>
            <ul className={styles.projectList}>
              {shown.map(({ project, github }) => (
                <li key={project.slug}>
                  <button
                    className={styles.projectCard}
                    onClick={(event) => open({ section: 'projects', slug: project.slug }, event.currentTarget)}
                  >
                    <span className={styles.repoOwner}>
                      <AdaptiveIcon app="github" />
                      {owner}
                    </span>
                    <strong>{project.name}</strong>
                    <span>{project.tagline}</span>
                    <small className={styles.repoMeta}>
                      <span>
                        <i
                          className={styles.langDot}
                          style={{ ['--lang' as string]: LANGUAGE_COLOUR[languageOf(project.stack, github)] }}
                        />
                        {languageOf(project.stack, github)}
                      </span>
                      <span>
                        <Symbol>star</Symbol>
                        {github?.stars ?? 0}
                      </span>
                      {project.year ? <span>{project.year}</span> : null}
                    </small>
                  </button>
                  <IconButton label={`${project.name} menu`} onClick={() => setMenu(project.slug)}>
                    <Symbol>more_vert</Symbol>
                  </IconButton>
                </li>
              ))}
            </ul>
            {shown.length === 0 ? (
              <p>
                No repositories match.{' '}
                <button className={styles.settingLink} onClick={() => setFilters([])}>
                  Clear filters
                </button>
              </p>
            ) : null}
          </div>
        ) : null}
        {tab === 'profile' ? (
          <div className={styles.profilePage}>
            <span className={styles.bigAvatar}>{getPerson().givenName[0]}</span>
            <h4>{getPerson().name}</h4>
            <p>{getPerson().headline}</p>
            <h4>Pinned</h4>
            <div className={styles.cardGrid}>
              {repos.slice(0, 4).map(({ project }) => (
                <button
                  key={project.slug}
                  className={styles.projectCard}
                  onClick={() => open({ section: 'projects', slug: project.slug })}
                >
                  {project.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </main>
      <BottomNav items={NAV} current={tab} onChange={setTab} />
      {menu ? (
        <div className={styles.popupMenu} role="menu" aria-label="Repository menu">
          <button
            role="menuitem"
            onClick={() => {
              const project = repos.find(({ project }) => project.slug === menu)?.project;
              if (project) open({ section: 'projects', slug: project.slug });
              setMenu(null);
            }}
          >
            Open
          </button>
          <button
            role="menuitem"
            onClick={() => {
              android.notify('Link copied');
              setMenu(null);
            }}
          >
            Copy link
          </button>
          <button role="menuitem" onClick={() => setMenu(null)}>
            Share
          </button>
        </div>
      ) : null}
    </div>
  );
}
