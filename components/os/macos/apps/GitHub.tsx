'use client';
/**
 * GitHub — the projects, as a desktop client in a window (plans/macos/apps/github.md, `MAC-GH-01…07`; shared/17).
 *   · sidebar: profile block (initials, name, headline, followers / repos when the snapshot has them), stack filter
 *     chips, the repository list (featured first);
 *   · list: pinned cards (name, tagline, language dot, ★, year), the contribution heatmap (53 × 7, 5 levels, a summary
 *     + a table alternative — absent when the snapshot has none), "More on GitHub";
 *   · detail (/macos/github/{slug}): breadcrumb `jaswanth / {project}`, tabs README · Stack · Links, the About rail;
 *   · list → detail: the card flies into the header (a shared-element flight); Back reverses it, mid-flight too;
 *   · external links open a new tab with `rel="noopener noreferrer"`, marked ↗ and announced.
 * Résumé data decides which projects exist; GitHub only enriches them (`GH-MERGE-01`, `GH-OFF-01`).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { KernelLink } from '@/components/shell/KernelLink';
import type { GithubSnapshot } from '@/data/github-schema';
import { refSlug } from '@/data/schema';
import { getGithubSnapshot, getMoreOnGithub, getPerson, getProjectsWithGithub } from '@/data/selectors';
import { currentLocation } from '@/lib/kernel/state';
import { flight, type Flight } from '@/lib/motion/flight';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { dispatch } from '@/stores/kernel-store';
import { useAppCommands } from '../commands';
import { ChevronLeft } from '../icons';
import { BookGlyph, ExternalGlyph, ForkGlyph, LayersGlyph, LinkGlyph, StarGlyph } from '../glyphs';
import { setAppState } from '../ui';
import type { WindowBodyProps } from '../window/Window';
import app from './app.module.css';
import styles from './github.module.css';

const LANGUAGE_COLORS: Readonly<Record<string, string>> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Go: '#00add8',
  Python: '#3572a5',
  Java: '#b07219',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
};
const languageColor = (language: string | null | undefined) =>
  language ? (LANGUAGE_COLORS[language] ?? '#8b949e') : null;

type Tab = 'readme' | 'stack' | 'links';
/** Where the card was when it was clicked (the flight's origin), by project slug. */
const origins = new Map<string, DOMRect>();

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

/** 53 × 7 heatmap with five levels (quartiles of the non-zero days) and an accessible summary + table. */
export function Heatmap({ contributions }: { contributions: NonNullable<GithubSnapshot['contributions']> }) {
  const days = contributions.weeks.flat();
  const nonZero = days.filter((count) => count > 0).sort((a, b) => a - b);
  const q = (p: number) => nonZero[Math.min(nonZero.length - 1, Math.floor(p * nonZero.length))] ?? 0;
  const cut = [q(0.25), q(0.5), q(0.75)];
  const level = (count: number) =>
    count === 0 ? 0 : count <= cut[0]! ? 1 : count <= cut[1]! ? 2 : count <= cut[2]! ? 3 : 4;
  const summary = `${contributions.total} contributions in the last year`;
  const byQuarter = [0, 1, 2, 3].map((quarter) =>
    contributions.weeks
      .slice(quarter * 13, quarter * 13 + 13)
      .flat()
      .reduce((sum, count) => sum + count, 0),
  );
  return (
    <section className={styles.heatmap} aria-labelledby="gh-contrib">
      <h4 id="gh-contrib" className={styles.sectionTitle}>
        {summary}
      </h4>
      <div className={styles.grid} role="img" aria-label={summary}>
        {contributions.weeks.map((week, w) => (
          <span key={w} className={styles.week}>
            {week.map((count, d) => (
              <i key={d} data-level={level(count)} />
            ))}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Contributions by quarter, oldest first</caption>
        <thead>
          <tr>
            <th scope="col">Quarter</th>
            <th scope="col">Contributions</th>
          </tr>
        </thead>
        <tbody>
          {byQuarter.map((total, index) => (
            <tr key={index}>
              <th scope="row">Quarter {index + 1}</th>
              <td>{total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function External({ href, children }: { href: string; children: string }) {
  return (
    <a className={styles.external} href={href} target="_blank" rel="noopener noreferrer">
      {children} <ExternalGlyph size={12} />
      <span className="sr-only"> (opens in new tab)</span>
    </a>
  );
}

export default function GitHub({ window: win, titleId, compact }: WindowBodyProps) {
  const location = currentLocation(win);
  const slug = location.kind === 'content' ? (refSlug(location.ref) ?? null) : null;
  const projects = getProjectsWithGithub();
  const snapshot = getGithubSnapshot();
  const person = getPerson();
  const [filters, setFilters] = useState<readonly string[]>([]);
  const [tab, setTab] = useState<Tab>('readme');
  const [shown, setShown] = useState<string | null>(slug);
  /** The project whose detail is flying back into its card (it stays on screen until the reverse lands). */
  const [leaving, setLeaving] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const header = useRef<HTMLElement>(null);
  const running = useRef<{ flight: Flight; slug: string } | null>(null);

  // The shown project follows the URL (adjusted during render, never in an effect); a reversing detail stays put.
  if (slug && slug !== shown) {
    setShown(slug);
    setTab('readme');
    setLeaving(null);
  } else if (!slug && shown && leaving !== shown) setShown(null);

  const stacks = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { project } of projects) for (const item of project.stack) counts.set(item, (counts.get(item) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([name]) => name);
  }, [projects]);
  const visible = projects.filter(({ project }) => filters.every((filter) => project.stack.includes(filter)));
  const detail = shown ? projects.find(({ project }) => project.slug === shown) : undefined;

  useEffect(() => setAppState('github:project', shown ?? undefined), [shown]);

  // List → detail: the card flies into the header (the in-app back chevron reverses it, mid-flight too).
  useLayoutEffect(() => {
    const el = header.current;
    if (!shown || !el) return;
    const origin = origins.get(shown);
    origins.delete(shown);
    if (!origin || compact) return;
    const to = el.getBoundingClientRect();
    const trip = flight(
      el,
      { x: origin.x, y: origin.y, width: origin.width, height: origin.height },
      { x: to.x, y: to.y, width: to.width, height: to.height },
      { spring: { response: 0.3, damping: 1 }, radius: [12, 0], reduced: prefersReducedMotion() },
    );
    running.current = { flight: trip, slug: shown };
    void trip.done.then(() => {
      if (running.current?.flight === trip) running.current = null;
      el.style.removeProperty('transform');
      el.style.removeProperty('clip-path');
    });
  }, [shown, compact]);

  useEffect(() => () => running.current?.flight.kill(), []);

  const back = () => {
    const active = running.current;
    if (active && active.slug === shown) {
      // Mid-flight: the same flight plays back into the card; the list returns when it lands.
      setLeaving(active.slug);
      active.flight.reverse();
      void active.flight.done.then(() => {
        if (running.current === active) running.current = null;
        setLeaving(null);
      });
    }
    const previous = win.nav.entries[win.nav.index - 1];
    if (previous && previous.kind === 'content' && !refSlug(previous.ref)) dispatch({ type: 'APP_BACK', id: win.id });
    else dispatch({ type: 'NAVIGATE_IN_APP', id: win.id, location: { kind: 'content', ref: { section: 'projects' } } });
  };

  useAppCommands('github', (command) => {
    if (command === 'list' || command === 'all') {
      setAll(command === 'all');
      if (shown) back();
    } else if (command === 'reload') setFilters([]);
    else if (command === 'open-repo' && detail?.project.repo)
      window.open(detail.project.repo, '_blank', 'noopener,noreferrer');
    else if (command === 'open-live' && detail?.project.live)
      window.open(detail.project.live, '_blank', 'noopener,noreferrer');
  });

  const toggle = (name: string) =>
    setFilters((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));

  const tabs: readonly { id: Tab; label: string }[] = detail
    ? [
        { id: 'readme', label: 'README' },
        { id: 'stack', label: 'Stack' },
        ...(detail.project.repo || detail.project.live ? [{ id: 'links' as const, label: 'Links' }] : []),
      ]
    : [];
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    setTab(tabs[next]!.id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  };

  const card = (entry: (typeof projects)[number]) => {
    const { project, github } = entry;
    const language = github?.language ?? null;
    const name = [
      project.name,
      project.tagline,
      language,
      github ? `${github.stars} ${github.stars === 1 ? 'star' : 'stars'}` : null,
      project.year ? String(project.year) : null,
    ]
      .filter(Boolean)
      .join(', ');
    return (
      <li key={project.slug}>
        <KernelLink
          to={{ os: 'macos', ref: { section: 'projects', slug: project.slug } }}
          className={styles.card}
          aria-label={name}
          onClickCapture={(event) => origins.set(project.slug, event.currentTarget.getBoundingClientRect())}
        >
          <span className={styles.cardName}>
            <BookGlyph size={14} /> {project.name}
          </span>
          <span className={styles.cardBody}>{project.tagline}</span>
          <span className={styles.cardMeta}>
            {language ? (
              <span>
                <i className={styles.dot} style={{ background: languageColor(language) ?? undefined }} />
                {language}
              </span>
            ) : null}
            {github ? (
              <span>
                <StarGlyph size={12} /> {github.stars}
              </span>
            ) : null}
            {project.year ? <span>{project.year}</span> : null}
            {project.featured ? <span className={styles.pill}>Featured</span> : null}
          </span>
        </KernelLink>
      </li>
    );
  };

  const sidebar = (
    <aside className={`${app.sidebar} ${styles.sidebar}`} aria-label="Profile and filters">
      <div className={styles.profile}>
        <span className={styles.avatar} aria-hidden="true">
          {initials(person.name)}
        </span>
        <p className={styles.name}>{person.name}</p>
        <p className={styles.handle}>{snapshot.user ? `@${snapshot.user.login}` : person.role}</p>
        <p className={styles.headline}>{person.headline}</p>
        {snapshot.user ? (
          <p className={styles.handle}>
            {snapshot.user.followers} followers · {snapshot.user.publicRepos} repositories
          </p>
        ) : null}
      </div>
      <div className={styles.chips} role="group" aria-label="Filter by stack">
        {stacks.map((name) => (
          <button
            key={name}
            type="button"
            className={styles.chip}
            aria-pressed={filters.includes(name)}
            onClick={() => toggle(name)}
          >
            {name}
          </button>
        ))}
        {filters.length ? (
          <button type="button" className={`${styles.chip} ${styles.clear}`} onClick={() => setFilters([])}>
            Clear
          </button>
        ) : null}
      </div>
      <p className={app.sidebarHeading}>Repositories</p>
      <ul className={app.sourceList}>
        {visible.map(({ project }) => (
          <li key={project.slug}>
            <KernelLink
              to={{ os: 'macos', ref: { section: 'projects', slug: project.slug } }}
              className={app.sourceItem}
              aria-current={shown === project.slug ? 'true' : undefined}
            >
              {project.name}
            </KernelLink>
          </li>
        ))}
      </ul>
    </aside>
  );

  return (
    <div className={`${app.app} ${styles.github}`} data-body="" data-view={detail ? 'detail' : 'list'}>
      <header className={`${app.toolbar} ${styles.toolbar}`} data-drag-region="">
        {detail ? (
          <button type="button" className={app.tool} aria-label="Back to repositories" onClick={back}>
            <ChevronLeft size={16} />
          </button>
        ) : null}
        <div className={app.titleBlock}>
          <h2 id={titleId} className={app.title}>
            <span className="sr-only">GitHub — </span>
            {detail ? detail.project.name : all ? 'All repositories' : 'Repositories'}
          </h2>
        </div>
      </header>
      <div className={`${app.split} ${styles.split}`}>
        {compact && detail ? null : sidebar}
        <div className={`${app.main} ${styles.main}`}>
          {detail ? (
            <article className={styles.detail} aria-labelledby="gh-detail-title">
              <header ref={header} className={styles.detailHeader}>
                <p className={styles.crumbs}>
                  <span>{snapshot.user?.login ?? 'jaswanth'}</span> / <strong>{detail.project.slug}</strong>
                </p>
                <h3 id="gh-detail-title" className={styles.detailTitle}>
                  {detail.project.name}
                </h3>
                <p className={styles.detailTagline}>{detail.project.tagline}</p>
              </header>
              <div className={styles.detailGrid}>
                <div>
                  <div role="tablist" aria-label="Project" className={compact ? styles.segmented : styles.tabs}>
                    {tabs.map((entry, index) => (
                      <button
                        key={entry.id}
                        type="button"
                        role="tab"
                        id={`gh-tab-${entry.id}`}
                        aria-selected={tab === entry.id}
                        aria-controls={`gh-panel-${entry.id}`}
                        tabIndex={tab === entry.id ? 0 : -1}
                        onClick={() => setTab(entry.id)}
                        onKeyDown={(event) => onTabKey(event, index)}
                      >
                        {entry.id === 'readme' ? (
                          <BookGlyph size={14} />
                        ) : entry.id === 'stack' ? (
                          <LayersGlyph size={14} />
                        ) : (
                          <LinkGlyph size={14} />
                        )}{' '}
                        {entry.label}
                      </button>
                    ))}
                  </div>
                  {tab === 'readme' ? (
                    <section
                      id="gh-panel-readme"
                      role="tabpanel"
                      aria-labelledby="gh-tab-readme"
                      className={styles.readme}
                    >
                      <p className={styles.context}>{detail.project.context}</p>
                      {detail.project.description.map((paragraph) => (
                        <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                      ))}
                      <h4>Highlights</h4>
                      <ul>
                        {detail.project.highlights.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                      {detail.project.closedSource && !detail.project.repo ? (
                        <p className={styles.note}>Built in production; the source is proprietary.</p>
                      ) : null}
                    </section>
                  ) : null}
                  {tab === 'stack' ? (
                    <section
                      id="gh-panel-stack"
                      role="tabpanel"
                      aria-labelledby="gh-tab-stack"
                      className={styles.readme}
                    >
                      <ul className={styles.topics} aria-label="Stack">
                        {detail.project.stack.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                  {tab === 'links' ? (
                    <section
                      id="gh-panel-links"
                      role="tabpanel"
                      aria-labelledby="gh-tab-links"
                      className={styles.readme}
                    >
                      <ul className={styles.links}>
                        {detail.project.repo ? (
                          <li>
                            <External href={detail.project.repo}>Repository</External>
                          </li>
                        ) : null}
                        {detail.project.live ? (
                          <li>
                            <External href={detail.project.live}>Live site</External>
                          </li>
                        ) : null}
                      </ul>
                    </section>
                  ) : null}
                </div>
                <aside className={styles.about} aria-label="About">
                  <h4 className={styles.sectionTitle}>About</h4>
                  <p>{detail.project.tagline}</p>
                  <dl>
                    {detail.project.year ? (
                      <>
                        <dt>Year</dt>
                        <dd>{detail.project.year}</dd>
                      </>
                    ) : null}
                    {detail.github?.language ? (
                      <>
                        <dt>Language</dt>
                        <dd>
                          <i
                            className={styles.dot}
                            style={{ background: languageColor(detail.github.language) ?? undefined }}
                          />
                          {detail.github.language}
                        </dd>
                      </>
                    ) : null}
                    {detail.github ? (
                      <>
                        <dt>Stars</dt>
                        <dd>
                          <StarGlyph size={12} /> {detail.github.stars}
                        </dd>
                        <dt>Forks</dt>
                        <dd>
                          <ForkGlyph size={12} /> {detail.github.forks}
                        </dd>
                        <dt>Last pushed</dt>
                        <dd>
                          <time dateTime={detail.github.pushedAt}>{detail.github.pushedAt.slice(0, 10)}</time>
                        </dd>
                      </>
                    ) : null}
                  </dl>
                  {detail.github?.topics.length ? (
                    <ul className={styles.topics} aria-label="Topics">
                      {detail.github.topics.map((topic) => (
                        <li key={topic}>{topic}</li>
                      ))}
                    </ul>
                  ) : null}
                </aside>
              </div>
            </article>
          ) : (
            <div className={styles.list}>
              <section aria-labelledby="gh-pinned">
                <h3 id="gh-pinned" className={styles.sectionTitle}>
                  {all ? 'All repositories' : 'Pinned'}
                </h3>
                {visible.length ? (
                  <ul className={styles.cards} data-long={visible.length > 20 || undefined}>
                    {(all ? visible : visible.slice(0, 6)).map(card)}
                  </ul>
                ) : (
                  <p className={styles.empty}>
                    No projects match these filters.{' '}
                    <button type="button" className={styles.chip} onClick={() => setFilters([])}>
                      Clear
                    </button>
                  </p>
                )}
                {!all && visible.length > 6 ? (
                  <ul className={styles.rows}>
                    {visible.slice(6).map(({ project }) => (
                      <li key={project.slug}>
                        <KernelLink to={{ os: 'macos', ref: { section: 'projects', slug: project.slug } }}>
                          {project.name}
                        </KernelLink>
                        <span> — {project.tagline}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
              {snapshot.contributions ? <Heatmap contributions={snapshot.contributions} /> : null}
              {getMoreOnGithub().length ? (
                <section aria-labelledby="gh-more">
                  <h3 id="gh-more" className={styles.sectionTitle}>
                    More on GitHub
                  </h3>
                  <ul className={styles.rows}>
                    {getMoreOnGithub().map((repo) => (
                      <li key={repo.url}>
                        <External href={repo.url}>{repo.name}</External>
                        {repo.language ? <span className={styles.muted}> · {repo.language}</span> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
