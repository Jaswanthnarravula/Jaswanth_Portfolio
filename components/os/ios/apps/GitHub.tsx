'use client';
/**
 * GitHub — the projects as the GitHub mobile app (plans/ios/apps/github.md, `IOS-GH-01…06`; shared/17).
 *   · phone: a bottom **tab bar** — Home · Projects · Profile — each tab a navigation root with its own stack (session
 *     state, `WindowInstance.ui`); tapping the active tab pops to its root / scrolls to top;
 *   · Home: large title, "My Work" (Projects → the tab · Résumé → Files · Contact → Mail), "Favorites" (featured
 *     projects), "Recent" (latest 3);
 *   · Projects: large title "Repositories", a search field and stack filter chips (session state), rows with name,
 *     tagline and a meta line (language dot · ★ · year); "No repositories" + Clear when nothing matches;
 *   · project detail (pushed, `/ios/github/{slug}`): back chevron "Repositories", Share; name, tagline · year; a
 *     segmented control README · Stack · About (`radiogroup`); topic chips; Repository ↗ / Live site ↗ (new tab);
 *   · Profile: initials avatar, name, headline, stats and the contribution heatmap only when the snapshot has them
 *     (`role="img"` + summary + a table — `IOS-GH-03`), "Pinned" 2-up;
 *   · full page (`IOS-GH-05`): the owner's frame `ios-github.png` — sidebar (large title "GitHub", search, Home ·
 *     Projects · Profile, "REPOSITORIES") + detail;
 *   · long-press / right-click / Shift+F10 / ⋯ on a repository row → a preview card with Open · Copy link · Share.
 * A deep link to a project synthesizes [Repositories, project] so the chevron works; a removed slug lands on the list
 * with a notice. Résumé projects are the source of truth; GitHub only enriches them (`GH-MERGE-01`).
 */
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { refSlug, type Project } from '@/data/schema';
import { getGithubSnapshot, getPerson, getProjectsWithGithub, type EnrichedProject } from '@/data/selectors';
import { currentLocation } from '@/lib/kernel/state';
import type { AppLocation, WindowId, WindowInstance } from '@/lib/kernel/types';
import { useKernel } from '@/stores/kernel-context';
import { dispatchSoon, getKernel } from '@/stores/kernel-store';
import { initialsOf } from '../model';
import { useAppUi, useAppUiJson, useIos } from '../shell-context';
import { Glyph } from '../ui/glyphs';
import {
  appHref,
  BarButton,
  Chip,
  Group,
  PillButton,
  PushLink,
  Row,
  SearchField,
  Segmented,
  TabBar,
  uiStyles,
} from '../ui/kit';
import { NavStack, type NavScreen } from '../ui/NavStack';
import type { IosAppProps } from './registry';
import styles from './github.module.css';

type Tab = 'home' | 'projects' | 'profile';
type Segment = 'readme' | 'stack' | 'about';

const TABS: readonly { id: Tab; label: string; glyph: 'house' | 'repo' | 'person' }[] = [
  { id: 'home', label: 'Home', glyph: 'house' },
  { id: 'projects', label: 'Projects', glyph: 'repo' },
  { id: 'profile', label: 'Profile', glyph: 'person' },
];
const ROOT_TITLE: Readonly<Record<Tab, string>> = { home: 'Home', projects: 'Repositories', profile: 'Profile' };

/** GitHub's own language colours (the dots are data, not theme). */
const LANGUAGE_COLORS: Readonly<Record<string, string>> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Go: '#00add8',
  Python: '#3572a5',
  Java: '#b07219',
  Shell: '#89e051',
  Rust: '#dea584',
  HTML: '#e34c26',
  CSS: '#663399',
};

/** GitHub owns one section, so its list *is* the app root (`/ios/github`) — the kernel's canonical form. */
const projectsRoot: AppLocation = { kind: 'root' };
const projectAt = (slug: string): AppLocation => ({ kind: 'content', ref: { section: 'projects', slug } });

const slugOf = (window: WindowInstance | undefined): string | null => {
  if (!window) return null;
  const location = currentLocation(window);
  return location.kind === 'content' && location.ref.section === 'projects' ? (refSlug(location.ref) ?? null) : null;
};

/** The language shown for a project: GitHub's when the repository is known, else the first of its stack. */
const languageOf = ({ project, github }: EnrichedProject) => github?.language ?? project.stack[0] ?? null;

function Meta({ item }: { readonly item: EnrichedProject }) {
  const language = languageOf(item);
  const parts: ReactNode[] = [];
  if (language)
    parts.push(
      <span key="lang" className={styles.lang}>
        <i style={{ background: LANGUAGE_COLORS[language] ?? '#8b949e' }} aria-hidden="true" />
        {language}
      </span>,
    );
  if (item.github) parts.push(<span key="stars">★ {item.github.stars}</span>);
  if (item.project.year) parts.push(<span key="year">{item.project.year}</span>);
  return (
    <span className={styles.meta}>
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 ? <span aria-hidden="true"> · </span> : null}
          {part}
        </span>
      ))}
    </span>
  );
}

export default function GitHub({ id, layout, headingId }: IosAppProps) {
  const ios = useIos();
  const window = useKernel((state) => state.sessions.ios.windows[id]);
  const [tabRaw, setTab] = useAppUi(id, 'tab', '');
  const [query, setQuery] = useAppUi(id, 'q', '');
  const [filter, setFilter] = useAppUi(id, 'filter', '');
  const [segment, setSegment] = useAppUi(id, 'segment', 'readme');
  const [tops, setTopsRaw] = useAppUiJson<Partial<Record<Tab, string>>>(id, 'tops', {});
  const setTops = (update: (all: Partial<Record<Tab, string>>) => Partial<Record<Tab, string>>) =>
    setTopsRaw(update(tops));
  const items = useMemo(() => getProjectsWithGithub(), []);
  const snapshot = useMemo(() => getGithubSnapshot(), []);
  const person = getPerson();

  const slug = slugOf(window);
  const requested = window ? currentLocation(window) : null;
  const current = slug ? items.find((item) => item.project.slug === slug) : undefined;
  // A deep link lands on Projects; the tab remembered in the session wins otherwise.
  const tab: Tab = tabRaw === 'home' || tabRaw === 'profile' || tabRaw === 'projects' ? tabRaw : 'projects';
  const removed =
    requested?.kind === 'content' && requested.ref.section === 'projects' && refSlug(requested.ref) && !current;

  const allStacks = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { project } of items) for (const tech of project.stack) counts.set(tech, (counts.get(tech) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([tech]) => tech);
  }, [items]);

  const visible = items.filter(({ project, github }) => {
    if (filter && !project.stack.includes(filter)) return false;
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    return [project.name, project.tagline, project.context, github?.language ?? '', ...project.stack]
      .join(' ')
      .toLowerCase()
      .includes(needle);
  });

  /** Pop the active tab to its root: `APP_BACK` when the root is the previous entry, else a replace (synthesized). */
  const popToRoot = () => {
    const win = getKernel().sessions.ios.windows[id];
    const previous: AppLocation | null = (win && win.nav.index > 0 ? win.nav.entries[win.nav.index - 1] : null) ?? null;
    const rootLocation = projectsRoot;
    const previousIsRoot =
      previous !== null &&
      (previous.kind === 'root' ||
        (previous.kind === 'content' && previous.ref.section === 'projects' && !refSlug(previous.ref)));
    if (previousIsRoot) dispatchSoon({ type: 'APP_BACK', id });
    else dispatchSoon({ type: 'NAVIGATE_IN_APP', id, location: rootLocation, replace: true });
    setTops((all) => ({ ...all, [tab]: '' }));
  };

  /** Tabs switch roots without pushing history: the URL takes the tab's own top (a replace). */
  // Each tab is its own stack, so the tab bar remounts with it: focus follows to the tab the visitor chose, in the
  // commit that mounts it (a timer would run before the new stack exists).
  const followFocus = useRef(false);
  useLayoutEffect(() => {
    if (!followFocus.current) return;
    followFocus.current = false;
    document.querySelector<HTMLElement>('[data-tab-bar] [aria-current="page"]')?.focus({ preventScroll: true });
  }, [tab]);

  const selectTab = (next: Tab, again: boolean) => {
    if (again) {
      if (slug) popToRoot();
      else {
        const scroller = document.querySelector<HTMLElement>(
          `[data-nav-stack="gh-${next}"] [data-screen]:not([hidden]) [data-scroller]`,
        );
        scroller?.scrollTo({ top: 0 });
      }
      return;
    }
    setTops((all) => ({ ...all, [tab]: slug ?? '' }));
    setTab(next);
    followFocus.current = true;
    const top = tops[next];
    dispatchSoon({ type: 'NAVIGATE_IN_APP', id, location: top ? projectAt(top) : projectsRoot, replace: true });
  };

  const previewFor = (item: EnrichedProject) => ({
    label: `${item.project.name} actions`,
    open: (anchor: HTMLElement) =>
      ios.preview({
        title: item.project.name,
        summary: item.project.tagline,
        meta: [languageOf(item) ?? '', item.project.year ? String(item.project.year) : ''].filter(Boolean),
        ref: { section: 'projects', slug: item.project.slug },
        anchor,
        actions: [
          {
            id: 'open',
            label: 'Open',
            run: () => dispatchSoon({ type: 'NAVIGATE_IN_APP', id, location: projectAt(item.project.slug) }),
          },
          {
            id: 'copy',
            label: 'Copy link',
            run: () => void ios.copyLink({ section: 'projects', slug: item.project.slug }, item.project.name),
          },
          {
            id: 'share',
            label: 'Share',
            run: () => void ios.copyLink({ section: 'projects', slug: item.project.slug }, item.project.name),
          },
        ],
      }),
  });

  const repoRow = (item: EnrichedProject, selected = false) => (
    <Row
      key={item.project.slug}
      kind="push"
      app={id}
      location={projectAt(item.project.slug)}
      pushKey={`project:${item.project.slug}`}
      title={<span className={styles.repoName}>{item.project.name}</span>}
      detail={item.project.tagline}
      subtitle={<Meta item={item} />}
      selected={selected}
      aria-current={selected ? 'page' : undefined}
      preview={previewFor(item)}
      accessory={layout === 'pad' ? 'none' : 'chevron'}
    />
  );

  // --- Screens -----------------------------------------------------------------------------------------------------
  const filters = (
    <div className={styles.filters} role="group" aria-label="Filter by stack">
      {allStacks.map((tech) => (
        <Chip key={tech} selected={filter === tech} onPress={() => setFilter(filter === tech ? null : tech)}>
          {tech}
        </Chip>
      ))}
    </div>
  );

  const reposScreen = (): ReactNode => (
    <>
      {removed ? (
        <p className={styles.notice} role="status">
          That project isn&rsquo;t listed any more — here are the others.
        </p>
      ) : null}
      {filters}
      {visible.length === 0 ? (
        <div className={styles.empty} role="status">
          <p>No repositories</p>
          <button
            type="button"
            className={uiStyles.textButton}
            onClick={() => {
              setQuery(null);
              setFilter(null);
            }}
          >
            Clear
          </button>
        </div>
      ) : (
        <Group>{visible.map((item) => repoRow(item))}</Group>
      )}
    </>
  );

  const homeScreen = (): ReactNode => {
    const featured = items.filter(({ project }) => project.featured);
    const recent = [...items]
      .filter(({ project }) => project.year)
      .sort((a, b) => (b.project.year ?? 0) - (a.project.year ?? 0))
      .slice(0, 3);
    return (
      <>
        <Group header="My Work">
          <Row
            kind="button"
            title="Projects"
            icon={{ glyph: 'repo', tint: '#5e5ce6' }}
            accessory="chevron"
            value={String(items.length)}
            onPress={() => selectTab('projects', false)}
          />
          <Row
            kind="href"
            href={appHref('ios:files' as WindowId, { kind: 'content', ref: { section: 'resume' } })}
            title="Résumé"
            icon={{ glyph: 'doc', tint: '#ff9500' }}
            onClick={(event) => {
              event.preventDefault();
              ios.openContent({ section: 'resume' }, event.currentTarget);
            }}
          />
          <Row
            kind="href"
            href={appHref('ios:mail' as WindowId, { kind: 'root' })}
            title="Contact"
            icon={{ glyph: 'envelope', tint: '#0a84ff' }}
            onClick={(event) => {
              event.preventDefault();
              ios.openContent({ section: 'contact' }, event.currentTarget);
            }}
          />
        </Group>
        {featured.length > 0 ? <Group header="Favorites">{featured.map((item) => repoRow(item))}</Group> : null}
        {recent.length > 0 ? <Group header="Recent">{recent.map((item) => repoRow(item))}</Group> : null}
      </>
    );
  };

  const profileScreen = (): ReactNode => {
    const pinned = items.filter(({ project }) => project.featured).slice(0, 6);
    return (
      <>
        <div className={styles.profile}>
          <span className={styles.avatar} aria-hidden="true">
            {initialsOf(person.name)}
          </span>
          <p className={styles.profileName}>{person.name}</p>
          {snapshot.user ? <p className={styles.profileLogin}>@{snapshot.user.login}</p> : null}
          <p className={styles.profileHeadline}>{person.headline}</p>
          {snapshot.user ? (
            <dl className={styles.stats}>
              <div>
                <dt>Followers</dt>
                <dd>{snapshot.user.followers}</dd>
              </div>
              <div>
                <dt>Public repositories</dt>
                <dd>{snapshot.user.publicRepos}</dd>
              </div>
              <div>
                <dt>Projects</dt>
                <dd>{items.length}</dd>
              </div>
            </dl>
          ) : null}
        </div>
        {snapshot.contributions ? <Heatmap contributions={snapshot.contributions} /> : null}
        {pinned.length > 0 ? (
          <section className={styles.pinnedSection} aria-labelledby="gh-pinned">
            <h4 id="gh-pinned" className={styles.sectionCaption}>
              Pinned
            </h4>
            <ul className={styles.pinned} role="list">
              {pinned.map((item) => (
                <li key={item.project.slug}>
                  <PushLink
                    app={id}
                    location={projectAt(item.project.slug)}
                    className={`${styles.pinCard} ${uiStyles.press}`}
                    data-push-key={`project:${item.project.slug}`}
                  >
                    <span className={styles.pinName}>
                      <Glyph name="repo" size={16} /> {item.project.name}
                    </span>
                    <span className={styles.pinTagline}>{item.project.tagline}</span>
                    <Meta item={item} />
                  </PushLink>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {snapshot.user ? (
          <Group>
            <Row
              kind="href"
              href={snapshot.user.url}
              external
              title="Open on GitHub"
              icon={{ glyph: 'globe', tint: '#24292f' }}
            />
          </Group>
        ) : null}
      </>
    );
  };

  const detail = (item: EnrichedProject): NavScreen => ({
    key: `project:${item.project.slug}`,
    title: item.project.name,
    tone: 'plain',
    trailing: (
      <BarButton
        label="Share"
        onPress={() => void ios.copyLink({ section: 'projects', slug: item.project.slug }, item.project.name)}
      />
    ),
    render: () => (
      <ProjectDetailView
        item={item}
        segment={segment === 'stack' || segment === 'about' ? segment : 'readme'}
        onSegment={(next) => setSegment(next)}
      />
    ),
  });

  const rootScreen = (which: Tab): NavScreen => ({
    key: `root:${which}`,
    title: ROOT_TITLE[which],
    large: true,
    tone: which === 'profile' ? 'grouped' : 'grouped',
    accessory:
      which === 'projects' ? (
        <SearchField
          value={query}
          onChange={(value) => setQuery(value || null)}
          label="Search repositories"
          onCancel={() => setQuery(null)}
        />
      ) : undefined,
    render: which === 'home' ? homeScreen : which === 'projects' ? reposScreen : profileScreen,
  });

  // --- Full page: the frame's split view ----------------------------------------------------------------------------
  if (layout === 'pad') {
    // The sidebar is the list, so the detail never repeats it: it previews the first repository until one is chosen
    // (iPadOS split views open on an item, they do not show the same list twice).
    const preview = tab === 'projects' && !current ? visible[0] : undefined;
    const emptyDetail: NavScreen = {
      key: 'pad:none',
      title: 'Repositories',
      large: true,
      tone: 'grouped',
      render: () => <Row kind="static" title="No repositories" subtitle="Clear the search to see all." />,
    };
    const detailScreens: NavScreen[] =
      tab === 'projects'
        ? current
          ? [detail(current)]
          : preview
            ? [detail(preview)]
            : [emptyDetail]
        : [rootScreen(tab)];
    if (tab !== 'projects' && current) detailScreens.push(detail(current));
    return (
      <div className={styles.split} aria-labelledby={headingId}>
        <nav className={styles.sidebar} aria-label="GitHub">
          <p className={styles.sidebarTitle} aria-hidden="true">
            GitHub
          </p>
          <div className={styles.sidebarSearch}>
            <SearchField value={query} onChange={(value) => setQuery(value || null)} label="Search repositories" />
          </div>
          <Group className={styles.sidebarGroup}>
            {TABS.map((spec) => (
              <Row
                key={spec.id}
                kind="button"
                title={spec.label}
                aria-current={tab === spec.id ? 'page' : undefined}
                className={tab === spec.id ? styles.sidebarOn : undefined}
                onPress={() => selectTab(spec.id, tab === spec.id && !current)}
              />
            ))}
          </Group>
          <Group header="Repositories" className={styles.sidebarGroup}>
            {visible.length === 0 ? (
              <Row kind="static" title="No repositories" subtitle="Clear the search to see all." />
            ) : (
              visible.map((item) =>
                repoRow(item, item.project.slug === current?.project.slug && (tab === 'projects' || !!current)),
              )
            )}
          </Group>
        </nav>
        <div className={styles.detail}>
          <NavStack
            id={`gh-pad-${tab}`}
            window={id}
            screens={detailScreens}
            onPop={() => popToRoot()}
            rootBack={
              current && tab === 'projects' ? (
                <button
                  type="button"
                  className={styles.padBack}
                  onClick={popToRoot}
                  data-back=""
                  aria-label="Back to Repositories"
                >
                  <Glyph name="chevron-left" size={22} strokeWidth={2.6} />
                  Repositories
                </button>
              ) : undefined
            }
          />
        </div>
      </div>
    );
  }

  // --- Phone: tab bar + one stack per tab ---------------------------------------------------------------------------
  const screens: NavScreen[] = [rootScreen(tab)];
  if (current) screens.push(detail(current));
  const tabBar = (
    <TabBar
      label="GitHub"
      tabs={TABS.map((spec) => ({ ...spec, href: appHref(id, projectsRoot) }))}
      active={tab}
      onSelect={selectTab}
    />
  );
  return (
    <NavStack key={tab} id={`gh-${tab}`} window={id} screens={screens} onPop={() => popToRoot()} tabBar={tabBar} />
  );
}

function ProjectDetailView({
  item,
  segment,
  onSegment,
}: {
  readonly item: EnrichedProject;
  readonly segment: Segment;
  readonly onSegment: (next: Segment) => void;
}) {
  const { project, github } = item;
  const [expanded, setExpanded] = useState(false);
  const long = project.description.join(' ').length > 900;
  const paragraphs = long && !expanded ? project.description.slice(0, 2) : project.description;
  return (
    <article className={styles.project}>
      {/* The screen's heading is the nav bar title (one h3 per screen); this is its large visual echo. */}
      <p className={styles.projectTitle} aria-hidden="true">
        {project.name}
      </p>
      <p className={styles.tagline}>
        {project.tagline}
        {project.year ? ` · ${project.year}` : ''}
      </p>
      <Segmented<Segment>
        label="Project sections"
        value={segment}
        onChange={onSegment}
        options={[
          { id: 'readme', label: 'README' },
          { id: 'stack', label: 'Stack' },
          { id: 'about', label: 'About' },
        ]}
        className={styles.segmented}
      />
      <div className={styles.segmentBody} aria-live="polite">
        {segment === 'readme' ? (
          <>
            {paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
            {long ? (
              <button type="button" className={uiStyles.textButton} onClick={() => setExpanded((value) => !value)}>
                {expanded ? 'Show less' : 'Show more'}
              </button>
            ) : null}
            {project.highlights.length > 0 ? (
              <>
                <h4 className={styles.subhead}>Highlights</h4>
                <ul className={styles.bullets}>
                  {project.highlights.map((highlight) => (
                    <li key={highlight.slice(0, 40)}>{highlight}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        ) : null}
        {segment === 'stack' ? (
          <>
            <h4 className="sr-only">Stack</h4>
            <ul className={styles.stackList} role="list">
              {project.stack.map((tech) => (
                <li key={tech}>{tech}</li>
              ))}
            </ul>
          </>
        ) : null}
        {segment === 'about' ? <About project={project} github={github} /> : null}
      </div>
      <ul className={styles.chips} role="list" aria-label="Topics">
        {(github?.topics.length ? github.topics : project.stack.slice(0, 4)).map((topic) => (
          <li key={topic}>
            <Chip>{topic}</Chip>
          </li>
        ))}
      </ul>
      <p className={styles.actions}>
        {project.repo ? (
          <PillButton href={project.repo} external>
            Repository <Glyph name="arrow-up-right" size={15} strokeWidth={2.4} />
          </PillButton>
        ) : null}
        {project.live ? (
          <PillButton href={project.live} external tone="tinted">
            Live site <Glyph name="arrow-up-right" size={15} strokeWidth={2.4} />
          </PillButton>
        ) : null}
        {project.closedSource && !project.repo ? (
          <span className={styles.closed}>Built in production; the source is proprietary.</span>
        ) : null}
      </p>
    </article>
  );
}

function About({ project, github }: { readonly project: Project; readonly github?: EnrichedProject['github'] }) {
  const rows: [string, string][] = [['Context', project.context]];
  if (project.year) rows.push(['Year', String(project.year)]);
  if (github?.language) rows.push(['Language', github.language]);
  if (github) rows.push(['Stars', String(github.stars)], ['Forks', String(github.forks)]);
  if (github?.pushedAt)
    rows.push([
      'Last pushed',
      new Date(github.pushedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    ]);
  if (project.closedSource) rows.push(['Source', 'Proprietary']);
  return (
    <dl className={styles.about}>
      {rows.map(([term, value]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Heatmap({
  contributions,
}: {
  readonly contributions: NonNullable<ReturnType<typeof getGithubSnapshot>['contributions']>;
}) {
  const max = Math.max(1, ...contributions.weeks.flat());
  const summary = `${contributions.total} contributions in the last year`;
  const quarters = [0, 1, 2, 3].map((quarter) =>
    contributions.weeks
      .slice(quarter * 13, quarter * 13 + 13)
      .flat()
      .reduce((sum, value) => sum + value, 0),
  );
  return (
    <section className={styles.heatmapSection} aria-labelledby="gh-heatmap">
      <h4 id="gh-heatmap" className={styles.sectionCaption}>
        Contributions
      </h4>
      {/* A sideways-scrolling region must take focus so the keyboard can scroll it (WCAG 2.1.1). */}
      <div
        className={styles.heatmapScroll}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        role="region"
        aria-label="Contribution calendar, scrolls sideways"
      >
        <div className={styles.heatmap} role="img" aria-label={summary}>
          {contributions.weeks.map((week, w) => (
            <span key={w} className={styles.week}>
              {week.map((count, d) => (
                <i key={d} data-level={count === 0 ? 0 : Math.min(4, Math.ceil((count / max) * 4))} />
              ))}
            </span>
          ))}
        </div>
      </div>
      <p className={styles.heatmapSummary}>{summary}</p>
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
