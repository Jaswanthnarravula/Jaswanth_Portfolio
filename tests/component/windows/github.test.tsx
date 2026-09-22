/**
 * GitHub in jsdom, through the real Windows window frame (plans/windows/apps/github.md, shared/17):
 * WIN-GH-01 NavigationView rail + title-bar search + Overview cards from the data · WIN-GH-02 project page (breadcrumb,
 * pivots, info card, Back; enrichment, archived InfoBar, Links; removed slug) · WIN-GH-03 stats / heatmap only from the
 * snapshot, with the accessible alternative · WIN-GH-04 filter chips, Sort ▾, empty state, rail collapse · WIN-GH-05
 * drill-out keeps the page left behind as an inert copy · WIN-GH-06 compact (hamburger overlay).
 */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GitHub from '@/components/os/windows/apps/GitHub';
import { WinShellProvider, type WinShellServices } from '@/components/os/windows/shell-context';
import { WinWindow } from '@/components/os/windows/window/Window';
import type { GithubSnapshot } from '@/data/github-schema';
import type { ContentRef } from '@/data/schema';
import {
  getFeaturedProjects,
  getGithubSnapshot,
  getProjects,
  getProjectsWithGithub,
  type EnrichedProject,
} from '@/data/selectors';
import { currentLocation, DEFAULT_CAPABILITIES } from '@/lib/kernel/state';
import type { AppLocation, WindowId } from '@/lib/kernel/types';
import { dispatch, flushQueued, getKernel } from '@/stores/kernel-store';

/** Snapshot / enrichment overrides — the real selectors otherwise. */
const data = vi.hoisted(() => ({
  snapshot: null as GithubSnapshot | null,
  projects: null as readonly EnrichedProject[] | null,
}));
vi.mock('@/data/selectors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/selectors')>();
  return {
    ...actual,
    getGithubSnapshot: () => data.snapshot ?? actual.getGithubSnapshot(),
    getProjectsWithGithub: (snapshot?: GithubSnapshot) => data.projects ?? actual.getProjectsWithGithub(snapshot),
  };
});

const ID = 'windows:github' as WindowId;
const EMPTY: GithubSnapshot = { v: 1, fetchedAt: null, user: null, repos: [], pinned: [], contributions: null };

let booted = false;
function boot(w = 1440, h = 900) {
  if (!booted) {
    dispatch({
      type: 'BOOT',
      url: '/windows',
      navType: 'navigate',
      viewport: { w, h, pointer: 'fine' },
      persisted: null,
      capabilities: DEFAULT_CAPABILITIES,
    });
    booted = true;
  } else dispatch({ type: 'VIEWPORT_CHANGED', w, h, pointer: 'fine' });
}

function closeAll() {
  for (const id of Object.keys(getKernel().sessions.windows.windows) as WindowId[]) {
    dispatch({ type: 'CLOSE_WINDOW', id });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
  }
}

const projectAt = (slug: string): AppLocation => ({
  kind: 'content',
  ref: { section: 'projects', slug } as ContentRef,
});

function openGitHub(location?: AppLocation) {
  act(() => {
    dispatch({ type: 'OPEN_APP', os: 'windows', role: 'github', location });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id: ID } });
  });
}

const githubWindow = () => getKernel().sessions.windows.windows[ID]!;

function shellWith(overrides: Partial<WinShellServices> = {}): WinShellServices {
  const base: Record<string, unknown> = {
    peek: null,
    pendingTerminalInsert: () => null,
    snapPreview: { show: () => undefined, hide: () => undefined },
    ...overrides,
  };
  return new Proxy(base, {
    get: (target, key) =>
      typeof key === 'symbol' || key === 'then' ? undefined : key in target ? target[key] : () => undefined,
  }) as unknown as WinShellServices;
}

function renderGitHub({ compact = false, shell = shellWith() }: { compact?: boolean; shell?: WinShellServices } = {}) {
  return render(
    <WinShellProvider value={shell}>
      <WinWindow
        id={ID}
        zIndex={100}
        focused
        compact={compact}
        touch={false}
        shownInCompact
        dimmed={false}
        body={(props) => <GitHub {...props} />}
      />
    </WinShellProvider>,
  );
}

const flush = () =>
  act(() => {
    flushQueued();
  });

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const matches = (text: string, needle: string) => text.toLowerCase().includes(needle.toLowerCase());

beforeEach(() => {
  data.snapshot = null;
  data.projects = null;
  boot();
  act(() => closeAll());
});

describe('WIN-GH-01 NavigationView rail, title-bar search, Overview cards', () => {
  it('lists Overview · Repositories · the featured projects, and pins the featured projects as cards', async () => {
    openGitHub();
    const { container } = renderGitHub();
    const rail = screen.getByRole('navigation', { name: 'Navigation' });
    expect(within(rail).getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(within(rail).getByRole('button', { name: 'Repositories' })).not.toHaveAttribute('aria-current');
    const featured = getFeaturedProjects();
    const railLinks = within(rail).getAllByRole('link');
    expect(railLinks).toHaveLength(featured.length);
    featured.forEach((project, index) => {
      expect(railLinks[index]).toHaveAccessibleName(project.name);
      expect(railLinks[index]).toHaveAttribute('href', expect.stringContaining(project.slug));
    });

    expect(screen.getByRole('heading', { level: 3, name: 'Overview' })).toBeInTheDocument();
    const pinned = within(screen.getByRole('region', { name: 'Pinned' })).getAllByRole('link');
    const expected = featured.length ? featured : getProjects().slice(0, 6);
    expect(pinned).toHaveLength(expected.length);
    expected.forEach((project, index) =>
      expect(pinned[index]).toHaveAccessibleName(new RegExp(`^${escape(project.name)}, ${escape(project.tagline)}`)),
    );

    const results = await axe.run(container, {
      runOnly: {
        type: 'rule',
        values: [
          'heading-order',
          'list',
          'listitem',
          'aria-allowed-attr',
          'aria-valid-attr-value',
          'link-name',
          'button-name',
          'duplicate-id-aria',
        ],
      },
    });
    expect(results.violations).toEqual([]);
  });

  it('the title-bar search filters the repositories (and moves to the Repositories page)', async () => {
    const user = userEvent.setup();
    openGitHub();
    renderGitHub();
    const search = screen.getByRole('searchbox', { name: 'Search repositories' });
    expect(search.closest('header')).toHaveAttribute('data-drag-region');
    const needle = getProjects()[getProjects().length - 1]!.stack[0]!;
    await user.type(search, needle);
    const hits = getProjects().filter((project) =>
      [project.name, project.tagline, project.context, ...project.stack].some((text) => matches(text, needle)),
    );
    const list = screen.getByRole('list', { name: 'Repositories' });
    expect(
      within(list)
        .getAllByRole('link')
        .map((link) => link.querySelector('span span')?.textContent),
    ).toEqual(hits.map((project) => project.name));
    expect(
      within(screen.getByRole('navigation', { name: 'Navigation' })).getByRole('button', { name: 'Repositories' }),
    ).toHaveAttribute('aria-current', 'page');
    await user.keyboard('{Escape}');
    expect(search).toHaveValue('');
  });
});

describe('WIN-GH-02 project page: breadcrumb, pivots, info card', () => {
  it('opens a real project, shows its breadcrumb, pivots and info card; Back returns to the list', async () => {
    const user = userEvent.setup();
    const project = getProjects().find((item) => item.year) ?? getProjects()[0]!;
    openGitHub();
    renderGitHub();
    await user.click(
      within(screen.getByRole('navigation', { name: 'Navigation' })).getByRole('button', { name: 'Repositories' }),
    );
    const row = within(screen.getByRole('list', { name: 'Repositories' })).getByRole('link', {
      name: new RegExp(`^${escape(project.name)},`),
    });
    await user.click(row);
    flush();
    expect(currentLocation(githubWindow())).toEqual(projectAt(project.slug));

    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('link', { name: 'Repositories' })).toBeInTheDocument();
    const heading = within(crumbs).getByRole('heading', { level: 3, name: project.name });
    expect(document.activeElement).toBe(heading); // focus followed the page, never <body>

    const pivots = screen.getByRole('tablist', { name: 'Project' });
    const tabs = within(pivots).getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(
      project.repo || project.live ? ['README', 'Stack', 'Links'] : ['README', 'Stack'],
    );
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    const readme = screen.getByRole('tabpanel', { name: 'README' });
    for (const highlight of project.highlights) expect(within(readme).getByText(highlight)).toBeInTheDocument();
    tabs[0]!.focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(tabs[1]);
    const stack = screen.getByRole('tabpanel', { name: 'Stack' });
    expect(
      within(stack)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([...project.stack]);

    const info = screen.getByRole('complementary', { name: 'About' });
    if (project.year) expect(within(info).getByText(String(project.year))).toBeInTheDocument();
    expect(within(info).queryByText('Stars')).toBeNull(); // no GitHub match → no stats

    await user.click(screen.getByRole('button', { name: 'Back' }));
    flush();
    expect(githubWindow().nav.index).toBe(0);
    expect(currentLocation(githubWindow())).toEqual(githubWindow().nav.entries[0]);
    expect(screen.getByRole('heading', { level: 3, name: 'Repositories' })).toBeInTheDocument();
  });

  it('enriched: Links pivot with new-tab links, the archived InfoBar and GitHub facts in the info card', async () => {
    const user = userEvent.setup();
    const base = getProjectsWithGithub();
    const target = base[0]!.project;
    data.projects = base.map((entry, index) =>
      index === 0
        ? {
            project: { ...entry.project, repo: 'https://github.com/example/repository', live: undefined },
            github: {
              name: 'repository',
              url: 'https://github.com/example/repository',
              description: null,
              stars: 7,
              forks: 2,
              language: 'Go',
              languages: { Go: 900, Shell: 100 },
              topics: ['identity', 'oauth'],
              pushedAt: '2026-08-10T02:44:49Z',
              archived: true,
            },
          }
        : entry,
    );
    openGitHub(projectAt(target.slug));
    const { container } = renderGitHub();
    expect(screen.getByRole('status')).toHaveTextContent(/Archived\./);
    const info = screen.getByRole('complementary', { name: 'About' });
    expect(within(info).getByText('Stars').nextElementSibling).toHaveTextContent('7');
    expect(within(info).getByText('Forks').nextElementSibling).toHaveTextContent('2');
    expect(within(info).getByText('Pushed').nextElementSibling).toHaveTextContent('August 10, 2026');
    expect(within(info).getByText(/Go 90\.0%/)).toBeInTheDocument();
    expect(within(within(info).getByRole('list', { name: 'Topics' })).getAllByRole('listitem')).toHaveLength(2);

    await user.click(screen.getByRole('tab', { name: 'Links' }));
    const link = within(screen.getByRole('tabpanel', { name: 'Links' })).getByRole('link', { name: /Repository/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAccessibleName('Repository (opens in new tab)');

    const results = await axe.run(container, {
      runOnly: {
        type: 'rule',
        values: [
          'heading-order',
          'aria-required-children',
          'aria-required-parent',
          'aria-valid-attr-value',
          'list',
          'listitem',
          'definition-list',
          'dlitem',
        ],
      },
    });
    expect(results.violations).toEqual([]);
  });

  it('a removed slug lands on Repositories with an InfoBar', () => {
    openGitHub();
    const win = { ...githubWindow(), nav: { entries: [projectAt('no-longer-here')], index: 0 } };
    render(<GitHub window={win} titleId="t" focused compact={false} />);
    expect(screen.getByRole('status')).toHaveTextContent(/Repository not found\..*no-longer-here/);
    expect(screen.getByRole('heading', { level: 3, name: 'Repositories' })).toBeInTheDocument();
  });
});

describe('WIN-GH-03 enrichment and the contribution heatmap', () => {
  it('without GitHub data there are no stats, no Stars count and no heatmap card (never an empty frame)', () => {
    data.snapshot = EMPTY;
    openGitHub();
    renderGitHub();
    const profile = screen.getByRole('region', { name: 'Profile' });
    expect(within(profile).queryByText('Followers')).toBeNull();
    expect(screen.queryByText('Stars')).toBeNull();
    expect(screen.queryByRole('img', { name: /contributions/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Contributions' })).toBeNull();
  });

  it('with a snapshot: stats from the snapshot, and the heatmap as role=img + summary + a table alternative', () => {
    const weeks = Array.from({ length: 53 }, (_, week) => Array.from({ length: 7 }, (_, day) => (week + day) % 4));
    const total = weeks.flat().reduce((sum, count) => sum + count, 0);
    data.snapshot = {
      ...EMPTY,
      fetchedAt: '2026-09-21T07:37:16.851Z',
      user: { login: 'someone', name: null, followers: 12, publicRepos: 3, url: 'https://github.com/someone' },
      contributions: { total, weeks },
    };
    openGitHub();
    renderGitHub();
    const profile = screen.getByRole('region', { name: 'Profile' });
    expect(within(profile).getByText('Followers').nextElementSibling).toHaveTextContent('12');
    expect(within(profile).getByText('Repositories').nextElementSibling).toHaveTextContent('3');
    const map = screen.getByRole('img', { name: `${total} contributions in the last year` });
    expect(map.querySelectorAll('i')).toHaveLength(53 * 7);
    const table = screen.getByRole('table', { name: 'Contributions by quarter, oldest first' });
    const cells = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => Number(within(row).getByRole('cell').textContent));
    expect(cells.reduce((sum, count) => sum + count, 0)).toBe(total);
    expect(screen.getByText(/GitHub data updated/)).toHaveTextContent('September 21, 2026');
  });

  it('uses the committed snapshot as-is (stats and heatmap follow what it holds)', () => {
    const snapshot = getGithubSnapshot();
    openGitHub();
    renderGitHub();
    expect(screen.queryByText('Followers') !== null).toBe(snapshot.user !== null);
    expect(screen.queryByRole('img', { name: /contributions in the last year/ }) !== null).toBe(
      snapshot.contributions !== null,
    );
  });
});

describe('WIN-GH-04 filters, sort and rail expand / collapse (session state)', () => {
  it('chips filter, the empty state clears, Sort ▾ reorders and the hamburger collapses the rail', async () => {
    const user = userEvent.setup();
    const openMenu = vi.fn();
    openGitHub();
    renderGitHub({ shell: shellWith({ openMenu }) });
    const rail = screen.getByRole('navigation', { name: 'Navigation' });
    await user.click(within(rail).getByRole('button', { name: 'Repositories' }));
    const names = () =>
      within(screen.getByRole('list', { name: 'Repositories' }))
        .getAllByRole('link')
        .map((link) => link.querySelector('span span')?.textContent);

    const chips = screen.getByRole('group', { name: 'Filter by stack' });
    const labels = within(chips)
      .getAllByRole('button')
      .map((chip) => chip.textContent!);
    const first = labels[0]!;
    await user.click(within(chips).getByRole('button', { name: first }));
    expect(within(chips).getByRole('button', { name: first })).toHaveAttribute('aria-pressed', 'true');
    expect(names()).toEqual(
      getProjects()
        .filter((p) => p.stack.includes(first))
        .map((p) => p.name),
    );

    // A second chip no project shares with the first → the empty state, then Clear filters.
    const apart = labels.find(
      (label) => label !== first && !getProjects().some((p) => p.stack.includes(first) && p.stack.includes(label)),
    );
    if (apart) {
      await user.click(within(chips).getByRole('button', { name: apart }));
      expect(screen.getByRole('status')).toHaveTextContent('No repositories match');
      await user.click(screen.getByRole('button', { name: 'Clear filters' }));
      expect(names()).toHaveLength(getProjects().length);
      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 3, name: 'Repositories' }));
    } else await user.click(within(chips).getByRole('button', { name: first }));
    expect(names()).toHaveLength(getProjects().length);

    await user.click(screen.getByRole('button', { name: /^Sort/ }));
    const spec = openMenu.mock.calls[0]![0] as { items: { label: string; checked: boolean; onSelect: () => void }[] };
    expect(spec.items.map((item) => item.label)).toEqual(expect.arrayContaining(['Featured first', 'Newest', 'Name']));
    expect(spec.items.find((item) => item.label === 'Featured first')!.checked).toBe(true);
    act(() => spec.items.find((item) => item.label === 'Name')!.onSelect());
    expect(names()).toEqual(
      [...getProjects()].sort((a, b) => a.name.localeCompare(b.name)).map((project) => project.name),
    );

    const toggle = within(rail).getByRole('button', { name: 'Collapse navigation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(rail).toHaveAttribute('data-state', 'expanded');
    await user.click(toggle);
    expect(within(rail).getByRole('button', { name: 'Expand navigation' })).toHaveAttribute('aria-expanded', 'false');
    expect(rail).toHaveAttribute('data-state', 'collapsed');
    // Collapsed items keep their names (glyph + tooltip visually).
    expect(within(rail).getByRole('button', { name: 'Overview' })).toBeInTheDocument();
  });

  it('the rail starts collapsed on medium', () => {
    boot(1000, 800);
    openGitHub();
    renderGitHub();
    expect(screen.getByRole('navigation', { name: 'Navigation' })).toHaveAttribute('data-state', 'collapsed');
  });
});

describe('WIN-GH-05 drill-in / drill-out page motion', () => {
  it('going back leaves an inert, id-free copy of the page to drill out while the list is already live', async () => {
    const user = userEvent.setup();
    const animate = vi.fn(() => ({ onfinish: null, oncancel: null }));
    Object.defineProperty(HTMLElement.prototype, 'animate', { value: animate, configurable: true, writable: true });
    try {
      const project = getFeaturedProjects()[0] ?? getProjects()[0]!;
      openGitHub();
      renderGitHub();
      await user.click(screen.getByRole('link', { name: new RegExp(`^${escape(project.name)},`) }));
      flush();
      expect(screen.getByRole('heading', { level: 3, name: project.name })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Back' }));
      flush();
      expect(screen.getByRole('heading', { level: 3, name: 'Overview' })).toBeInTheDocument();
      const ghost = document.querySelector<HTMLElement>('[aria-hidden="true"] > [inert]');
      expect(ghost).not.toBeNull();
      expect(ghost!.textContent).toContain(project.name);
      expect(ghost!.querySelector('[id]')).toBeNull();
      expect(animate).toHaveBeenCalled();
    } finally {
      delete (HTMLElement.prototype as { animate?: unknown }).animate;
    }
  });
});

describe('WIN-GH-06 compact layout', () => {
  it('the rail is a hamburger overlay (Esc closes it and focus returns), pages are one column', async () => {
    const user = userEvent.setup();
    boot(390, 844);
    openGitHub();
    const { container } = renderGitHub({ compact: true });
    expect(screen.queryByRole('navigation', { name: 'Navigation' })).toBeNull();
    expect(container.querySelector('[data-rail="overlay"][data-compact]')).not.toBeNull();
    const burger = screen.getByRole('button', { name: 'Open navigation' });
    expect(burger).toHaveAttribute('aria-expanded', 'false');
    await user.click(burger);
    const rail = screen.getByRole('navigation', { name: 'Navigation' });
    expect(rail).toHaveAttribute('data-state', 'overlay');
    expect(rail.contains(document.activeElement)).toBe(true);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('navigation', { name: 'Navigation' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open navigation' }));

    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    await user.click(
      within(screen.getByRole('navigation', { name: 'Navigation' })).getByRole('button', { name: 'Repositories' }),
    );
    expect(screen.queryByRole('navigation', { name: 'Navigation' })).toBeNull();
    expect(screen.getByRole('heading', { level: 3, name: 'Repositories' })).toBeInTheDocument();
  });
});
