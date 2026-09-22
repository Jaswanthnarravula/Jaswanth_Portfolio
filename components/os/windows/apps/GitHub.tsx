'use client';
/**
 * GitHub — the projects as a Fluent desktop app (plans/windows/apps/github.md, `WIN-GH-01…06`; shared/17).
 *   · Mica title bar: Back (the window's own history — `APP_BACK`) · the GitHub mark (= the system-menu button) · a
 *     labelled search box that filters the repositories (session state);
 *   · NavigationView rail — 48 px collapsed / 240 px expanded by the hamburger (session state; collapsed by default on
 *     `medium`), glyphs with tooltips when collapsed, the selected item marked by a 3 px accent bar: Overview ·
 *     Repositories · Stars (a count, decorative) · each featured project (`WIN-GH-01`, `WIN-GH-04`);
 *   · Overview: the profile card (initials, name, headline; followers and repositories only when the snapshot has
 *     them), "Pinned" stroked cards in a 3-column grid (name, tagline, language dot, ★, year) and the contribution
 *     heatmap card only when the snapshot has contributions — `role="img"` + a summary + a table (`WIN-GH-03`);
 *   · Repositories: stack filter chips and Sort ▾ (session state), a `content-visibility` list, "No repositories
 *     match" + Clear filters, "More on GitHub" (repositories no project references);
 *   · project page (`/windows/github/{slug}`, `WIN-GH-02`): breadcrumb `Repositories › {project}`, Pivot tabs README ·
 *     Stack · Links (APG; Links only with a repository or live site), the info card (year, language, topics, pushed,
 *     stars / forks when the snapshot has them), an InfoBar when archived; a removed slug lands on Repositories with an
 *     InfoBar;
 *   · page changes drill in (the page rises 16 px + fades, 250 ms entrance); going back drills out (the page left
 *     behind sinks and fades, 167 ms exit) while the page returned to is already there, so nothing waits; a new page
 *     mid-flight lands both at once (`WIN-GH-05`). External links open a new tab (`rel="noopener noreferrer"`, ↗,
 *     "opens in new tab").
 * compact (`WIN-GH-06`): the rail is a full-height hamburger overlay, pages are one column, pivots scroll sideways.
 * Résumé data decides which projects exist; GitHub only enriches them (`GH-MERGE-01`, `GH-OFF-01`).
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { formatUpdated } from '@/components/content';
import { RovingGroup } from '@/components/primitives/RovingGroup';
import { hrefFor } from '@/components/shell/KernelLink';
import { AssetIcon } from '@/components/ui/AssetIcon';
import type { GithubSnapshot } from '@/data/github-schema';
import { refSlug, type ContentRef } from '@/data/schema';
import {
  getGithubSnapshot,
  getMoreOnGithub,
  getPerson,
  getProjectsWithGithub,
  type EnrichedProject,
} from '@/data/selectors';
import { currentLocation } from '@/lib/kernel/state';
import type { WindowId } from '@/lib/kernel/types';
import { dur, prefersReducedMotion } from '@/lib/motion/dur';
import { useKernel } from '@/stores/kernel-context';
import { dispatchSoon, getKernel } from '@/stores/kernel-store';
import { flDismiss, flOpen, flSearch, flSort } from '../fluent.generated';
import {
  flArrowLeft,
  flBookOpen,
  flCheckmark,
  flChevronDown,
  flChevronRight,
  flFork,
  flHome,
  flHomeFilled,
  flInfoFilled,
  flLibrary,
  flNavigation,
  flStar,
  flWarning,
} from '../fluent.apps.generated';
import { Fl } from '../icons';
import { initialsOf, winBinding } from '../model';
import { drillIn, WIN_CURVES, WIN_MOTION } from '../motion';
import { useWinShell } from '../shell-context';
import { TitleBar, useWindowChrome, windowStyles, type WindowBodyProps } from '../window/Window';
import styles from './github.module.css';

type Page = 'overview' | 'repos';
type Pivot = 'readme' | 'stack' | 'links';
type Sort = 'featured' | 'newest' | 'name' | 'pushed';

const SORT_LABELS: Readonly<Record<Sort, string>> = {
  featured: 'Featured first',
  newest: 'Newest',
  name: 'Name',
  pushed: 'Recently pushed',
};

/** GitHub's own language colours (the dots are data, not theme). */
const LANGUAGE_COLORS: Readonly<Record<string, string>> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Go: '#00add8',
  Python: '#3572a5',
  Java: '#b07219',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#663399',
};
const languageColor = (language: string) => LANGUAGE_COLORS[language] ?? '#8b949e';

const curve = (name: keyof typeof WIN_CURVES) => `cubic-bezier(${WIN_CURVES[name].join(', ')})`;

const isPlainClick = (event: MouseEvent) =>
  !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

const projectsRef = (slug?: string): ContentRef => (slug ? { section: 'projects', slug } : { section: 'projects' });

/** 1 on a project page, 0 on the lists; `null` once the window is going away (no page motion then). */
function depthOf(id: WindowId): number | null {
  const window = getKernel().sessions.windows.windows[id];
  if (!window || window.phase.s === 'closing') return null;
  const location = currentLocation(window);
  return location.kind === 'content' && refSlug(location.ref) ? 1 : 0;
}

/** Fade the page returned to in (167 ms) — or any page under reduced motion (a crossfade, no rise). */
function fadeIn(el: HTMLElement) {
  if (typeof el.animate !== 'function') return;
  el.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: dur(WIN_MOTION.drillOut.ms, { crossfade: true }),
    easing: curve('entrance'),
  });
}

/**
 * Drill-out: a copy of the page being left (inert, hidden from assistive tech, ids removed) sinks 16 px and fades in
 * 167 ms on the exit curve above the page returned to, which is already live underneath — Back never waits.
 */
function drillOut(el: HTMLElement, host: HTMLElement | null, scroller: HTMLElement | null) {
  if (!host?.isConnected || prefersReducedMotion() || typeof el.animate !== 'function') return;
  const ghost = el.cloneNode(true) as HTMLElement;
  for (const node of [ghost, ...ghost.querySelectorAll<HTMLElement>('[id]')]) node.removeAttribute('id');
  ghost.setAttribute('inert', '');
  ghost.style.top = `${-(scroller?.scrollTop ?? 0)}px`;
  if (scroller) ghost.style.width = `${scroller.clientWidth}px`;
  host.replaceChildren(ghost);
  const flight = ghost.animate(
    [
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: `translateY(${WIN_MOTION.drillIn.rise}px)` },
    ],
    { duration: WIN_MOTION.drillOut.ms, easing: curve('exit'), fill: 'forwards' },
  );
  flight.onfinish = () => ghost.remove();
  flight.oncancel = () => ghost.remove();
}

interface Flow {
  depth: number;
  key: string | null;
}

interface PageMount {
  readonly pageKey: string;
  readonly depth: number;
  readonly flow: RefObject<Flow>;
  readonly ghosts: RefObject<HTMLDivElement | null>;
  readonly scroller: RefObject<HTMLDivElement | null>;
  readonly windowId: WindowId;
}

/**
 * A page arrives: forward drills in, back fades in under the drill-out; focus that was on the page left behind (a
 * card, a crumb) moves to the new heading, never to <body>. The cleanup runs while the leaving page is still in the
 * document (React removes its DOM after its layout cleanups), so going back can copy it for the drill-out.
 */
function mountPage(el: HTMLElement | null, { pageKey, depth, flow, ghosts, scroller, windowId }: PageMount) {
  if (!el) return undefined;
  const previous = flow.current;
  flow.current = { depth, key: pageKey };
  let stop: () => void = () => undefined;
  if (previous.key !== null && previous.key !== pageKey) {
    if (scroller.current) scroller.current.scrollTop = 0;
    if (depth >= previous.depth && !prefersReducedMotion()) {
      ghosts.current?.replaceChildren();
      stop = drillIn(el);
    } else fadeIn(el);
    if (!document.activeElement || document.activeElement === document.body)
      el.querySelector<HTMLElement>('[data-page-heading]')?.focus({ preventScroll: true });
  }
  return () => {
    stop();
    const next = depthOf(windowId);
    if (next !== null && next < depth) drillOut(el, ghosts.current, scroller.current);
  };
}

/** One page of the app. Its key is the page, so a page change is one unmount + one mount. */
function DrillPage({ children, ...mount }: PageMount & { readonly children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // A page is one mount: its key changes when the page does.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => mountPage(ref.current, mount), []);
  return (
    <div ref={ref} className={styles.page}>
      {children}
    </div>
  );
}

type AnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'>;

/** A real link (`/windows/github/{slug}`) whose plain click navigates inside this window's own history. */
function RepoLink({
  windowId,
  slug,
  onNavigate,
  children,
  ...rest
}: AnchorProps & {
  readonly windowId: WindowId;
  readonly slug?: string;
  readonly onNavigate?: () => void;
  readonly children: ReactNode;
}) {
  const ref = projectsRef(slug);
  return (
    <a
      {...rest}
      href={hrefFor({ os: 'windows', ref })}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        onNavigate?.();
        dispatchSoon({ type: 'NAVIGATE_IN_APP', id: windowId, location: { kind: 'content', ref } });
      }}
    >
      {children}
    </a>
  );
}

function External({ href, children }: { readonly href: string; readonly children: ReactNode }) {
  return (
    <a className={styles.external} href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <Fl icon={flOpen} size={12} className={styles.externalGlyph} />
      <span className="sr-only"> (opens in new tab)</span>
    </a>
  );
}

function InfoBar({
  severity,
  title,
  children,
  onClose,
}: {
  readonly severity: 'informational' | 'warning';
  readonly title: string;
  readonly children: ReactNode;
  readonly onClose?: () => void;
}) {
  return (
    <div className={styles.infobar} data-severity={severity} role="status">
      <Fl icon={severity === 'warning' ? flWarning : flInfoFilled} size={16} className={styles.infoIcon} />
      <p>
        <strong>{title}</strong> {children}
      </p>
      {onClose ? (
        <button type="button" className={styles.infoClose} aria-label="Close" onClick={onClose}>
          <Fl icon={flDismiss} size={16} />
        </button>
      ) : null}
    </div>
  );
}

/** 53 × 7 cells, five levels (quartiles of the non-zero days), a spoken summary and a table alternative (shared/17). */
function Heatmap({ contributions }: { readonly contributions: NonNullable<GithubSnapshot['contributions']> }) {
  const busy = contributions.weeks
    .flat()
    .filter((count) => count > 0)
    .sort((a, b) => a - b);
  const q = (p: number) => busy[Math.min(busy.length - 1, Math.floor(p * busy.length))] ?? 0;
  const cuts = [q(0.25), q(0.5), q(0.75)] as const;
  const level = (count: number) =>
    count === 0 ? 0 : count <= cuts[0] ? 1 : count <= cuts[1] ? 2 : count <= cuts[2] ? 3 : 4;
  const summary = `${contributions.total} contributions in the last year`;
  const quarters = [0, 1, 2, 3].map((index) =>
    contributions.weeks
      .slice(index * 13, index === 3 ? undefined : index * 13 + 13)
      .flat()
      .reduce((sum, count) => sum + count, 0),
  );
  return (
    <section className={`${styles.card} ${styles.contrib}`} aria-labelledby="gh-contrib">
      <h4 id="gh-contrib" className={styles.cardTitle}>
        Contributions
      </h4>
      <p className={styles.summary}>{summary}</p>
      <div className={styles.heatmap} role="img" aria-label={summary}>
        {contributions.weeks.map((week, w) => (
          <span key={w} className={styles.week}>
            {week.map((count, d) => (
              <i key={d} data-level={level(count)} />
            ))}
          </span>
        ))}
      </div>
      <p className={styles.legend} aria-hidden="true">
        Less <i data-level="0" />
        <i data-level="1" />
        <i data-level="2" />
        <i data-level="3" />
        <i data-level="4" /> More
      </p>
      <table className="sr-only">
        <caption>Contributions by quarter, oldest first</caption>
        <thead>
          <tr>
            <th scope="col">Quarter</th>
            <th scope="col">Contributions</th>
          </tr>
        </thead>
        <tbody>
          {quarters.map((total, index) => (
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

const cardLabel = ({ project, github }: EnrichedProject) =>
  [
    project.name,
    project.tagline,
    github?.language,
    github ? `${github.stars} ${github.stars === 1 ? 'star' : 'stars'}` : null,
    project.year ? String(project.year) : null,
  ]
    .filter(Boolean)
    .join(', ');

function Meta({ entry, context = false }: { readonly entry: EnrichedProject; readonly context?: boolean }) {
  const { project, github } = entry;
  return (
    <span className={styles.meta}>
      {context ? <span>{project.context}</span> : null}
      {github?.language ? (
        <span>
          <i className={styles.dot} style={{ background: languageColor(github.language) }} />
          {github.language}
        </span>
      ) : null}
      {github ? (
        <span>
          <Fl icon={flStar} size={12} /> {github.stars}
        </span>
      ) : null}
      {project.year ? <span>{project.year}</span> : null}
    </span>
  );
}

/** The eight most used stack entries (the filter chips), most used first. */
function topStacks(projects: readonly EnrichedProject[]): readonly string[] {
  const counts = new Map<string, number>();
  for (const { project } of projects) for (const item of project.stack) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([name]) => name);
}

function sortProjects(list: readonly EnrichedProject[], sort: Sort): readonly EnrichedProject[] {
  const copy = [...list];
  if (sort === 'name') copy.sort((a, b) => a.project.name.localeCompare(b.project.name));
  else if (sort === 'newest') copy.sort((a, b) => (b.project.year ?? 0) - (a.project.year ?? 0));
  else if (sort === 'pushed') copy.sort((a, b) => (b.github?.pushedAt ?? '').localeCompare(a.github?.pushedAt ?? ''));
  return copy;
}

export default function GitHub({ window: win, compact }: WindowBodyProps) {
  const shell = useWinShell();
  const chrome = useWindowChrome();
  const sizeClass = useKernel((state) => state.viewport.sizeClass);
  const snapshot = getGithubSnapshot();
  const person = getPerson();
  const projects = getProjectsWithGithub(snapshot);
  const more = getMoreOnGithub(snapshot);
  const location = currentLocation(win);
  const slug = location.kind === 'content' ? (refSlug(location.ref) ?? null) : null;
  const entry = slug ? projects.find(({ project }) => project.slug === slug) : undefined;
  const missing = slug && !entry ? slug : null;

  const [page, setPage] = useState<Page>('overview');
  const [pivot, setPivot] = useState<Pivot>('readme');
  const [pivotFor, setPivotFor] = useState(slug);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<readonly string[]>([]);
  const [sort, setSort] = useState<Sort>('featured');
  const [expanded, setExpanded] = useState(() => sizeClass !== 'medium');
  const [overlay, setOverlay] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const ghosts = useRef<HTMLDivElement>(null);
  const flow = useRef<Flow>({ depth: 0, key: null });
  const hamburger = useRef<HTMLButtonElement>(null);
  const headingFocus = useRef(false);

  // A new project opens on README (adjusted during render, never in an effect).
  if (slug !== pivotFor) {
    setPivotFor(slug);
    setPivot('readme');
  }

  const view: 'overview' | 'repos' | 'project' = entry ? 'project' : missing ? 'repos' : page;
  const pageKey = entry ? `project:${entry.project.slug}` : view;
  const featured = projects.filter(({ project }) => project.featured);
  const pinned = featured.length ? featured : projects.slice(0, 6);
  const stars = snapshot.repos.reduce((sum, repo) => sum + repo.stars, 0);

  const stacks = topStacks(projects);
  const needle = query.trim().toLowerCase();
  const listed = sortProjects(
    projects.filter(
      ({ project }) =>
        filters.every((filter) => project.stack.includes(filter)) &&
        (!needle ||
          [project.name, project.tagline, project.context, ...project.stack].some((text) =>
            text.toLowerCase().includes(needle),
          )),
    ),
    sort,
  );
  const filtering = needle.length > 0 || filters.length > 0;

  // Focus follows a cleared filter or a dismissed InfoBar to the page heading (the control that had it is gone).
  useLayoutEffect(() => {
    if (!headingFocus.current) return;
    headingFocus.current = false;
    scroller.current?.querySelector<HTMLElement>('[data-page-heading]')?.focus({ preventScroll: true });
  });

  // Compact: the rail is an overlay — focus goes into it, Esc / a press outside closes it.
  useLayoutEffect(() => {
    if (compact && overlay)
      document.getElementById('gh-rail')?.querySelector<HTMLElement>('[data-roving-item][tabindex="0"]')?.focus();
  }, [compact, overlay]);
  useEffect(() => {
    if (!compact || !overlay) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (document.getElementById('gh-rail')?.contains(target) || hamburger.current?.contains(target)) return;
      setOverlay(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [compact, overlay]);

  const closeOverlay = (returnFocus: boolean) => {
    if (!overlay) return;
    setOverlay(false);
    if (returnFocus) hamburger.current?.focus();
  };
  const toList = () =>
    dispatchSoon({ type: 'NAVIGATE_IN_APP', id: win.id, location: { kind: 'content', ref: projectsRef() } });
  const canBack = win.nav.index > 0 || view === 'project' || !!missing;
  const back = () => {
    if (win.nav.index > 0) dispatchSoon({ type: 'APP_BACK', id: win.id });
    else if (slug) toList();
  };
  const choosePage = (next: Page) => {
    setPage(next);
    if (slug) toList();
    if (compact) closeOverlay(next === view);
  };
  const search = (value: string) => {
    setQuery(value);
    if (!value.trim()) return;
    setPage('repos');
    if (slug) toList();
  };
  const toggleFilter = (name: string) =>
    setFilters((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));
  const clearFilters = () => {
    setFilters([]);
    setQuery('');
    headingFocus.current = true;
  };
  const sortMenu = (anchor: HTMLElement) => {
    const box = anchor.getBoundingClientRect();
    const options: readonly Sort[] = [
      'featured',
      'newest',
      'name',
      ...(projects.some(({ github }) => github) ? (['pushed'] as const) : []),
    ];
    shell.openMenu({
      label: 'Sort by',
      at: { x: box.left, y: box.bottom + 4 },
      returnFocusTo: anchor,
      items: options.map((id) => ({
        kind: 'checkbox' as const,
        id: `sort-${id}`,
        label: SORT_LABELS[id],
        checked: sort === id,
        onSelect: () => setSort(id),
      })),
    });
  };

  const hamburgerButton = (
    <button
      ref={hamburger}
      type="button"
      className={styles.hamburger}
      aria-label={
        compact
          ? overlay
            ? 'Close navigation'
            : 'Open navigation'
          : expanded
            ? 'Collapse navigation'
            : 'Expand navigation'
      }
      aria-expanded={compact ? overlay : expanded}
      aria-controls={!compact || overlay ? 'gh-rail' : undefined}
      onClick={() => (compact ? setOverlay((open) => !open) : setExpanded((open) => !open))}
    >
      <Fl icon={flNavigation} size={16} />
    </button>
  );

  const railItem = (id: Page, label: string, icon: ReactNode, current: boolean) => (
    <li>
      <button
        type="button"
        data-roving-item=""
        className={styles.railItem}
        aria-current={current ? 'page' : undefined}
        onClick={() => choosePage(id)}
      >
        {icon}
        <span className={styles.railLabel}>{label}</span>
        <span className={styles.tip} aria-hidden="true">
          {label}
        </span>
      </button>
    </li>
  );

  const rail = (
    <nav
      id="gh-rail"
      className={styles.rail}
      aria-label="Navigation"
      data-state={compact ? 'overlay' : expanded ? 'expanded' : 'collapsed'}
    >
      {compact ? null : hamburgerButton}
      <RovingGroup
        as="ul"
        orientation="vertical"
        role="list"
        className={styles.railList}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || !compact) return;
          event.preventDefault();
          closeOverlay(true);
        }}
      >
        {railItem(
          'overview',
          'Overview',
          <Fl icon={view === 'overview' ? flHomeFilled : flHome} size={16} />,
          view === 'overview',
        )}
        {railItem(
          'repos',
          'Repositories',
          <Fl icon={flLibrary} size={16} />,
          view === 'repos' || (view === 'project' && !entry?.project.featured),
        )}
        {snapshot.user ? (
          <li className={styles.railInfo}>
            <Fl icon={flStar} size={16} />
            <span className={styles.railLabel}>Stars</span>
            <span className={styles.badge}>{stars}</span>
          </li>
        ) : null}
        <li className={styles.railRule} aria-hidden="true" />
        {featured.map(({ project }) => (
          <li key={project.slug}>
            <RepoLink
              windowId={win.id}
              slug={project.slug}
              data-roving-item=""
              className={styles.railItem}
              aria-current={entry?.project.slug === project.slug ? 'page' : undefined}
              onNavigate={() => compact && setOverlay(false)}
            >
              <Fl icon={flBookOpen} size={16} />
              <span className={styles.railLabel}>{project.name}</span>
              <span className={styles.tip} aria-hidden="true">
                {project.name}
              </span>
            </RepoLink>
          </li>
        ))}
      </RovingGroup>
    </nav>
  );

  const card = (item: EnrichedProject) => (
    <li key={item.project.slug}>
      <RepoLink windowId={win.id} slug={item.project.slug} className={styles.repoCard} aria-label={cardLabel(item)}>
        <span className={styles.repoName}>
          <Fl icon={flBookOpen} size={16} />
          <span>{item.project.name}</span>
        </span>
        <span className={styles.repoBody}>{item.project.tagline}</span>
        <Meta entry={item} />
      </RepoLink>
    </li>
  );

  const row = (item: EnrichedProject) => (
    <li key={item.project.slug} className={styles.row}>
      <RepoLink windowId={win.id} slug={item.project.slug} className={styles.rowLink} aria-label={cardLabel(item)}>
        <Fl icon={flBookOpen} size={16} className={styles.rowGlyph} />
        <span className={styles.rowMain}>
          <span className={styles.rowName}>{item.project.name}</span>
          <span className={styles.rowBody}>{item.project.tagline}</span>
        </span>
        <Meta entry={item} context />
        <Fl icon={flChevronRight} size={12} className={styles.rowChevron} />
      </RepoLink>
    </li>
  );

  let body: ReactNode;
  if (view === 'project' && entry) {
    body = (
      <ProjectPage
        entry={entry}
        pivot={pivot}
        onPivot={setPivot}
        windowId={win.id}
        onRepositories={() => setPage('repos')}
      />
    );
  } else if (view === 'repos') {
    body = (
      <>
        {missing && dismissed !== missing ? (
          <InfoBar
            severity="informational"
            title="Repository not found."
            onClose={() => {
              setDismissed(missing);
              headingFocus.current = true;
            }}
          >
            &ldquo;{missing}&rdquo; isn&rsquo;t one of these repositories any more — here is the full list.
          </InfoBar>
        ) : null}
        <div className={styles.pageHead}>
          <h3 className={styles.pageTitle} tabIndex={-1} data-page-heading="">
            Repositories
          </h3>
          <span className={styles.count}>
            {listed.length === projects.length ? projects.length : `${listed.length} of ${projects.length}`}
          </span>
        </div>
        <div className={styles.commands}>
          <div className={styles.chips} role="group" aria-label="Filter by stack">
            {stacks.map((name) => (
              <button
                key={name}
                type="button"
                className={styles.chip}
                aria-pressed={filters.includes(name)}
                onClick={() => toggleFilter(name)}
              >
                {filters.includes(name) ? <Fl icon={flCheckmark} size={12} /> : null}
                {name}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.command}
            aria-haspopup="menu"
            onClick={(e) => sortMenu(e.currentTarget)}
          >
            <Fl icon={flSort} size={16} />
            Sort<span className="sr-only">: {SORT_LABELS[sort]}</span>
            <Fl icon={flChevronDown} size={12} />
          </button>
        </div>
        {listed.length ? (
          <ul className={styles.rows} role="list" aria-label="Repositories">
            {listed.map(row)}
          </ul>
        ) : (
          <div className={styles.empty} role="status">
            <p>No repositories match{needle ? ` “${query.trim()}”` : ''}.</p>
            <button type="button" className={styles.button} onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}
        {more.length > 0 && !filtering ? (
          <section className={styles.block} aria-labelledby="gh-more">
            <h4 id="gh-more" className={styles.blockTitle}>
              More on GitHub
            </h4>
            <ul className={styles.moreList} role="list">
              {more.map((repo) => (
                <li key={repo.url}>
                  <External href={repo.url}>{repo.name}</External>
                  {repo.language ? <span className={styles.muted}> · {repo.language}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </>
    );
  } else {
    const user = snapshot.user;
    body = (
      <>
        <h3 className={styles.pageTitle} tabIndex={-1} data-page-heading="">
          Overview
        </h3>
        <section className={`${styles.card} ${styles.profile}`} aria-label="Profile">
          <span className={styles.avatar} aria-hidden="true">
            {initialsOf(person.name)}
          </span>
          <div className={styles.profileText}>
            <p className={styles.profileName}>{person.name}</p>
            {user ? (
              <p className={styles.handle}>
                <External href={user.url}>@{user.login}</External>
              </p>
            ) : null}
            <p className={styles.headline}>{person.headline}</p>
          </div>
          {user ? (
            <dl className={styles.stats}>
              <div>
                <dt>Followers</dt>
                <dd>{user.followers}</dd>
              </div>
              <div>
                <dt>Repositories</dt>
                <dd>{user.publicRepos}</dd>
              </div>
            </dl>
          ) : null}
        </section>
        <section className={styles.block} aria-labelledby="gh-pinned">
          <h4 id="gh-pinned" className={styles.blockTitle}>
            Pinned
          </h4>
          <ul className={styles.grid} role="list">
            {pinned.map(card)}
          </ul>
        </section>
        {snapshot.contributions ? <Heatmap contributions={snapshot.contributions} /> : null}
        {user && snapshot.fetchedAt ? (
          <p className={styles.fresh}>
            GitHub data updated{' '}
            <time dateTime={snapshot.fetchedAt}>{formatUpdated(snapshot.fetchedAt.slice(0, 10))}</time>
          </p>
        ) : null}
      </>
    );
  }

  return (
    <>
      <TitleBar tall={!compact} hideIcon>
        <div className={styles.lead}>
          <button
            type="button"
            className={styles.back}
            aria-label="Back"
            aria-disabled={!canBack || undefined}
            onClick={() => canBack && back()}
          >
            <Fl icon={flArrowLeft} size={16} />
          </button>
          {compact ? hamburgerButton : null}
          <button
            type="button"
            className={windowStyles.sysmenu}
            aria-haspopup="menu"
            aria-label="Window menu"
            onClick={(event) => chrome?.openSystemMenu(event.currentTarget)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowDown') return;
              event.preventDefault();
              chrome?.openSystemMenu(event.currentTarget);
            }}
          >
            <AssetIcon id={winBinding('github').icon} size={16} priority />
          </button>
          <span className={styles.appTitle} aria-hidden="true">
            GitHub
          </span>
        </div>
        <div className={styles.search} role="search">
          <input
            type="search"
            className={styles.searchField}
            aria-label="Search repositories"
            placeholder="Search repositories"
            value={query}
            spellCheck={false}
            onChange={(event) => search(event.target.value)}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Escape' && query) {
                event.preventDefault();
                setQuery('');
              } else if (event.key === 'Enter') {
                setPage('repos');
                if (slug) toList();
                shell.announce(`${listed.length} ${listed.length === 1 ? 'repository' : 'repositories'}`);
              }
            }}
          />
          <Fl icon={flSearch} size={16} className={styles.searchGlyph} />
        </div>
      </TitleBar>
      <div
        className={styles.github}
        data-rail={compact ? 'overlay' : expanded ? 'expanded' : 'collapsed'}
        data-compact={compact || undefined}
      >
        {compact ? (overlay ? rail : null) : rail}
        <div className={styles.content}>
          <div ref={scroller} className={styles.scroller}>
            <DrillPage
              key={pageKey}
              pageKey={pageKey}
              depth={view === 'project' ? 1 : 0}
              flow={flow}
              ghosts={ghosts}
              scroller={scroller}
              windowId={win.id}
            >
              {body}
            </DrillPage>
          </div>
          <div ref={ghosts} className={styles.ghosts} aria-hidden="true" />
        </div>
      </div>
    </>
  );
}

/** The project page: breadcrumb header, Pivot (README · Stack · Links) and the info card. */
function ProjectPage({
  entry,
  pivot,
  onPivot,
  windowId,
  onRepositories,
}: {
  readonly entry: EnrichedProject;
  readonly pivot: Pivot;
  readonly onPivot: (pivot: Pivot) => void;
  readonly windowId: WindowId;
  readonly onRepositories: () => void;
}) {
  const { project, github } = entry;
  const list = useRef<HTMLDivElement>(null);
  const lastCenter = useRef<number | null>(null);
  const pivots: readonly { id: Pivot; label: string }[] = [
    { id: 'readme', label: 'README' },
    { id: 'stack', label: 'Stack' },
    ...(project.repo || project.live ? [{ id: 'links' as const, label: 'Links' }] : []),
  ];
  const current = pivots.some((item) => item.id === pivot) ? pivot : 'readme';

  // The pivot underline slides to the selected header (167 ms, point-to-point).
  useLayoutEffect(() => {
    const tab = list.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!tab) return;
    const center = tab.offsetLeft + tab.offsetWidth / 2;
    const from = lastCenter.current;
    lastCenter.current = center;
    if (from === null || from === center || prefersReducedMotion() || typeof tab.animate !== 'function') return;
    try {
      tab.animate([{ transform: `translateX(${from - center}px)` }, { transform: 'none' }], {
        duration: WIN_MOTION.pill.ms,
        easing: curve('pointToPoint'),
        pseudoElement: '::after',
      });
    } catch {
      // No pseudo-element animation in this engine: the underline simply moves.
    }
  }, [current]);

  const onKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = pivots.length - 1;
    const keys: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onPivot(pivots[next]!.id);
    list.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  };

  const languages = github?.languages ? Object.entries(github.languages).sort((a, b) => b[1] - a[1]) : [];
  const bytes = languages.reduce((sum, [, count]) => sum + count, 0);

  return (
    <>
      {github?.archived ? (
        <InfoBar severity="warning" title="Archived.">
          The owner archived this repository; it is read-only.
        </InfoBar>
      ) : null}
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <ol>
          <li>
            <RepoLink windowId={windowId} className={styles.crumb} onNavigate={onRepositories}>
              Repositories
            </RepoLink>
            <Fl icon={flChevronRight} size={16} className={styles.crumbSep} />
          </li>
          <li aria-current="page">
            <h3 className={styles.pageTitle} tabIndex={-1} data-page-heading="">
              {project.name}
            </h3>
          </li>
        </ol>
      </nav>
      <p className={styles.tagline}>{project.tagline}</p>
      <div className={styles.projectGrid}>
        <div className={styles.projectMain}>
          <div ref={list} role="tablist" aria-label="Project" className={styles.pivots}>
            {pivots.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`gh-pivot-${item.id}`}
                className={styles.pivot}
                aria-selected={current === item.id}
                aria-controls={current === item.id ? `gh-panel-${item.id}` : undefined}
                tabIndex={current === item.id ? 0 : -1}
                onClick={() => onPivot(item.id)}
                onKeyDown={(event) => onKey(event, index)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div
            id={`gh-panel-${current}`}
            role="tabpanel"
            aria-labelledby={`gh-pivot-${current}`}
            className={styles.panel}
            // The panel is reachable from the pivots with Tab even when it holds no link (APG tabs).
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
          >
            {current === 'readme' ? (
              <>
                <p className={styles.context}>{project.context}</p>
                {project.description.map((paragraph) => (
                  <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                ))}
                <h4 className={styles.readmeTitle}>Highlights</h4>
                <ul className={styles.bullets}>
                  {project.highlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {project.closedSource && !project.repo ? (
                  <p className={styles.muted}>Built in production; the source is proprietary.</p>
                ) : null}
              </>
            ) : null}
            {current === 'stack' ? (
              <ul className={styles.tags} role="list" aria-label="Stack">
                {project.stack.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            {current === 'links' ? (
              <ul className={styles.linkList} role="list">
                {project.repo ? (
                  <li>
                    <External href={project.repo}>Repository</External>
                  </li>
                ) : null}
                {project.live ? (
                  <li>
                    <External href={project.live}>Live site</External>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        </div>
        <aside className={`${styles.card} ${styles.info}`} aria-labelledby="gh-about">
          <h4 id="gh-about" className={styles.cardTitle}>
            About
          </h4>
          <p className={styles.infoLede}>{project.context}</p>
          <dl className={styles.facts}>
            {project.year ? (
              <div>
                <dt>Year</dt>
                <dd>{project.year}</dd>
              </div>
            ) : null}
            {languages.length ? (
              <div className={styles.wideFact}>
                <dt>Languages</dt>
                <dd>
                  <span className={styles.langBar} aria-hidden="true">
                    {languages.map(([name, count]) => (
                      <i key={name} style={{ width: `${(count / bytes) * 100}%`, background: languageColor(name) }} />
                    ))}
                  </span>
                  <span className={styles.langList}>
                    {languages.map(([name, count]) => (
                      <span key={name}>
                        <i className={styles.dot} style={{ background: languageColor(name) }} />
                        {name} {((count / bytes) * 100).toFixed(1)}%
                      </span>
                    ))}
                  </span>
                </dd>
              </div>
            ) : github?.language ? (
              <div>
                <dt>Language</dt>
                <dd>
                  <i className={styles.dot} style={{ background: languageColor(github.language) }} />
                  {github.language}
                </dd>
              </div>
            ) : null}
            {github ? (
              <>
                <div>
                  <dt>Pushed</dt>
                  <dd>
                    <time dateTime={github.pushedAt}>{formatUpdated(github.pushedAt.slice(0, 10))}</time>
                  </dd>
                </div>
                <div>
                  <dt>Stars</dt>
                  <dd>
                    <Fl icon={flStar} size={12} /> {github.stars}
                  </dd>
                </div>
                <div>
                  <dt>Forks</dt>
                  <dd>
                    <Fl icon={flFork} size={12} /> {github.forks}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
          {github?.topics.length ? (
            <ul className={styles.tags} role="list" aria-label="Topics">
              {github.topics.map((topic) => (
                <li key={topic}>{topic}</li>
              ))}
            </ul>
          ) : null}
        </aside>
      </div>
    </>
  );
}
