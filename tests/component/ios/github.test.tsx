/**
 * iOS GitHub (plans/ios/apps/github.md) in jsdom through the iOS harness:
 * IOS-GH-01 tab bar Home · Projects · Profile with large titles; each tab keeps its own stack · IOS-GH-02 the pushed
 * project detail with README | Stack | About, and a deep link synthesizes [Repositories, project] · IOS-GH-03 the
 * enrichment (stats) and the sideways-scrolling heatmap with its accessible alternative — absent when the snapshot is
 * empty, axe clean either way · IOS-GH-04 the search field and the stack filter chips narrow the list; Clear restores
 * it · IOS-GH-06 navigation semantics (a `nav` of links with `aria-current`, a `radiogroup` segmented control).
 * The pad split view (IOS-GH-05) and the push/pop motion are e2e (jsdom has no layout or WAAPI).
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GitHub from '@/components/os/ios/apps/GitHub';
import { refSlug } from '@/data/schema';
import * as selectors from '@/data/selectors';
import type { GithubSnapshot } from '@/data/github-schema';
import { currentLocation } from '@/lib/kernel/state';
import type { AppLocation, WindowId } from '@/lib/kernel/types';
import { getKernel } from '@/stores/kernel-store';
import { closeAllIos, renderIosApp, settle } from './harness';

const GH = 'ios:github' as WindowId;

/** The snapshot the app sees (`null` = the committed build-time snapshot). */
const current: { snapshot: GithubSnapshot | null } = { snapshot: null };

vi.mock('@/data/selectors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/selectors')>();
  const snapshot = () => current.snapshot ?? actual.getGithubSnapshot();
  return {
    ...actual,
    getGithubSnapshot: () => snapshot(),
    getProjectsWithGithub: (given?: GithubSnapshot) => actual.getProjectsWithGithub(given ?? snapshot()),
  };
});

const EMPTY: GithubSnapshot = { v: 1, fetchedAt: null, user: null, repos: [], pinned: [], contributions: null };

/** 52 weeks × 7 days, deterministic, newest week last. */
const WEEKS = Array.from({ length: 52 }, (_, w) => Array.from({ length: 7 }, (_, d) => (w * 7 + d) % 5));
const TOTAL = WEEKS.flat().reduce((sum, value) => sum + value, 0);
const FULL: GithubSnapshot = {
  v: 1,
  fetchedAt: '2026-09-21T00:00:00.000Z',
  user: { login: 'octo-jas', name: 'Jaswanth', followers: 42, publicRepos: 17, url: 'https://github.com/octo-jas' },
  repos: [],
  pinned: [],
  contributions: { total: TOTAL, weeks: WEEKS },
};

const projects = () => selectors.getProjects();
const win = () => getKernel().sessions.ios.windows[GH]!;
const here = () => currentLocation(win());
const projectAt = (slug: string): AppLocation => ({ kind: 'content', ref: { section: 'projects', slug } });
/** The Repositories root: the app root, or the section itself (the kernel canonicalizes one to the other). */
const atRoot = () => {
  const location = here();
  return (
    location.kind === 'root' ||
    (location.kind === 'content' && location.ref.section === 'projects' && !refSlug(location.ref))
  );
};

/** The top screen of the stack (neither hidden nor inert). */
const top = () => {
  const screens = [...document.querySelectorAll<HTMLElement>('[data-screen]')].filter(
    (el) => !el.hidden && !el.hasAttribute('inert'),
  );
  return screens[screens.length - 1]!;
};
/** Repository rows on the top screen, by project name. */
const rows = () =>
  [...top().querySelectorAll<HTMLElement>('[data-push-key^="project:"]')].map((row) =>
    row.getAttribute('data-push-key')!.slice('project:'.length),
  );
const tabBar = () => screen.getByRole('navigation', { name: 'GitHub' });
const tab = (name: 'Home' | 'Projects' | 'Profile') => within(tabBar()).getByRole('link', { name });

async function audit(container: HTMLElement) {
  // jsdom cannot measure colour contrast (no canvas); the e2e axe pass (X1) covers it.
  const results = await axe.run(container, {
    rules: { region: { enabled: false }, 'color-contrast': { enabled: false } },
  });
  return results.violations.map(
    (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
  );
}

beforeEach(() => {
  act(() => closeAllIos());
  current.snapshot = null;
});
afterEach(() => {
  act(() => closeAllIos());
  current.snapshot = null;
});

describe('IOS-GH-01 / IOS-GH-06 tab bar: Home · Projects · Profile, large titles, independent stacks', () => {
  it('IOS-GH-01 IOS-GH-06 the tab bar is a nav of links with aria-current (no APG tablist); Projects is the root', () => {
    renderIosApp(GitHub, 'github');
    const nav = tabBar();
    expect(nav.tagName).toBe('NAV');
    expect(within(nav).queryByRole('tablist')).toBeNull();
    expect(within(nav).queryByRole('tab')).toBeNull();
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Home', 'Projects', 'Profile']);
    for (const link of links) expect(link).toHaveAttribute('href');
    expect(tab('Projects')).toHaveAttribute('aria-current', 'page');
    expect(tab('Home')).not.toHaveAttribute('aria-current');
    expect(within(top()).getByRole('heading', { level: 3, name: 'Repositories' })).toBeInTheDocument();
    expect(rows()).toEqual(projects().map((project) => project.slug));
  });

  it('IOS-GH-01 each tab shows its large title; aria-current follows the tab', async () => {
    renderIosApp(GitHub, 'github');
    fireEvent.click(tab('Home'));
    await settle();
    expect(tab('Home')).toHaveAttribute('aria-current', 'page');
    expect(tab('Projects')).not.toHaveAttribute('aria-current');
    expect(within(top()).getByRole('heading', { level: 3, name: 'Home' })).toBeInTheDocument();
    expect(within(top()).getByText('My Work')).toBeInTheDocument();
    fireEvent.click(tab('Profile'));
    await settle();
    expect(tab('Profile')).toHaveAttribute('aria-current', 'page');
    expect(within(top()).getByRole('heading', { level: 3, name: 'Profile' })).toBeInTheDocument();
    expect(within(top()).getByText(selectors.getPerson().name)).toBeInTheDocument();
  });

  it('IOS-GH-01 tabs keep independent stacks: a pushed project survives a trip to Home and back', async () => {
    const [first] = projects();
    renderIosApp(GitHub, 'github');
    fireEvent.click(top().querySelector<HTMLElement>(`[data-push-key="project:${first!.slug}"]`)!);
    await settle();
    expect(here()).toEqual(projectAt(first!.slug));
    expect(within(top()).getAllByRole('heading', { level: 3, name: first!.name }).length).toBeGreaterThan(0);

    fireEvent.click(tab('Home'));
    await settle();
    // Home is its own root: no project on top, the URL is the app root.
    expect(atRoot()).toBe(true);
    expect(within(top()).getByRole('heading', { level: 3, name: 'Home' })).toBeInTheDocument();
    expect(within(top()).queryByRole('radiogroup')).toBeNull();

    fireEvent.click(tab('Projects'));
    await settle();
    // Projects comes back where it was left: the project on top of Repositories.
    expect(here()).toEqual(projectAt(first!.slug));
    expect(within(top()).getAllByRole('heading', { level: 3, name: first!.name }).length).toBeGreaterThan(0);
    expect(within(top()).getByRole('button', { name: 'Back to Repositories' })).toBeInTheDocument();

    // Tapping the active tab pops it to its root.
    fireEvent.click(tab('Projects'));
    await settle();
    expect(atRoot()).toBe(true);
    expect(within(top()).getByRole('heading', { level: 3, name: 'Repositories' })).toBeInTheDocument();
  });
});

describe('IOS-GH-02 / IOS-GH-06 project detail: segmented README · Stack · About', () => {
  it('IOS-GH-02 a deep link synthesizes [Repositories, project]; the back chevron names Repositories', async () => {
    const [first] = projects();
    renderIosApp(GitHub, 'github', { location: projectAt(first!.slug) });
    const detail = top();
    expect(within(detail).getAllByRole('heading', { level: 3, name: first!.name }).length).toBeGreaterThan(0);
    const back = within(detail).getByRole('button', { name: 'Back to Repositories' });
    fireEvent.click(back);
    await settle();
    expect(atRoot()).toBe(true);
    expect(within(top()).getByRole('heading', { level: 3, name: 'Repositories' })).toBeInTheDocument();
  });

  it('IOS-GH-02 IOS-GH-06 the segmented control is a radiogroup; arrows move the checked segment', async () => {
    const project = projects().find((item) => item.stack.length > 0)!;
    renderIosApp(GitHub, 'github', { location: projectAt(project.slug) });
    const group = within(top()).getByRole('radiogroup', { name: 'Project sections' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((radio) => radio.textContent)).toEqual(['README', 'Stack', 'About']);
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    expect(radios.filter((radio) => radio.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(within(top()).getByText(project.description[0]!)).toBeInTheDocument();

    act(() => radios[0]!.focus());
    fireEvent.keyDown(radios[0]!, { key: 'ArrowRight' });
    await settle();
    const stack = within(top()).getAllByRole('radio');
    expect(stack[1]).toHaveAttribute('aria-checked', 'true');
    expect(stack[1]).toHaveFocus();
    for (const tech of project.stack) expect(within(top()).getAllByText(tech).length).toBeGreaterThan(0);

    fireEvent.click(within(top()).getByRole('radio', { name: 'About' }));
    await settle();
    expect(within(top()).getByRole('radio', { name: 'About' })).toHaveAttribute('aria-checked', 'true');
    expect(within(top()).getByText('Context')).toBeInTheDocument();
    expect(within(top()).getByText(project.context)).toBeInTheDocument();
  });
});

describe('IOS-GH-03 enrichment + scrollable heatmap with an accessible alternative', () => {
  async function openProfile() {
    const view = renderIosApp(GitHub, 'github');
    fireEvent.click(tab('Profile'));
    await settle();
    return view;
  }

  it('IOS-GH-03 with a snapshot: stats, a focusable labelled scroll region, role=img + summary, a quarter table', async () => {
    current.snapshot = FULL;
    await openProfile();
    const profile = top();
    expect(within(profile).getByText('@octo-jas')).toBeInTheDocument();
    const followers = within(profile).getByText('Followers');
    expect(followers.tagName).toBe('DT');
    expect(followers.nextElementSibling).toHaveTextContent('42');
    expect(within(profile).getByText('Public repositories').nextElementSibling).toHaveTextContent('17');

    const scroll = within(profile).getByRole('region', { name: 'Contribution calendar, scrolls sideways' });
    expect(scroll).toHaveAttribute('tabindex', '0');
    const summary = `${TOTAL} contributions in the last year`;
    const image = within(scroll).getByRole('img', { name: summary });
    // One column per week, newest at the right (the last column is the last week).
    expect(image.children).toHaveLength(52);
    expect(image.lastElementChild!.children).toHaveLength(7);
    expect(within(profile).getByText(summary, { selector: 'p' })).toBeInTheDocument();

    const table = within(profile).getByRole('table', { name: 'Contributions by quarter, oldest first' });
    const cells = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((row) => Number(within(row).getByRole('cell').textContent));
    expect(cells).toHaveLength(4);
    expect(cells.reduce((sum, value) => sum + value, 0)).toBe(TOTAL);
    expect(within(profile).getByRole('link', { name: /Open on GitHub/ })).toHaveAttribute(
      'href',
      'https://github.com/octo-jas',
    );
  });

  it('IOS-GH-03 absent when the snapshot is empty: no stats, no heatmap, no GitHub link — the profile still reads', async () => {
    current.snapshot = EMPTY;
    await openProfile();
    const profile = top();
    expect(within(profile).getByText(selectors.getPerson().name)).toBeInTheDocument();
    expect(within(profile).getByText(selectors.getPerson().headline)).toBeInTheDocument();
    expect(within(profile).queryByText('Followers')).toBeNull();
    expect(within(profile).queryByText(/^@/)).toBeNull();
    expect(within(profile).queryByRole('region', { name: /Contribution calendar/ })).toBeNull();
    expect(within(profile).queryByRole('img', { name: /contributions/ })).toBeNull();
    expect(within(profile).queryByRole('table')).toBeNull();
    expect(within(profile).queryByText('Contributions')).toBeNull();
    expect(within(profile).queryByRole('link', { name: /Open on GitHub/ })).toBeNull();
    // Rows carry no star counts without GitHub data.
    fireEvent.click(tab('Projects'));
    await settle();
    expect(top().textContent).not.toMatch(/★/);
  });

  it('IOS-GH-03 axe clean with the heatmap', async () => {
    current.snapshot = FULL;
    const { container } = await openProfile();
    expect(await audit(container)).toEqual([]);
  });

  it('IOS-GH-03 axe clean without GitHub data', async () => {
    current.snapshot = EMPTY;
    const { container } = await openProfile();
    expect(await audit(container)).toEqual([]);
  });
});

describe('IOS-GH-04 search field + stack filter chips', () => {
  /** A stack that some — not all — projects use (so filtering visibly narrows the list). */
  const narrowingStack = () => {
    const all = projects();
    const counts = new Map<string, number>();
    for (const project of all) for (const tech of project.stack) counts.set(tech, (counts.get(tech) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).find(([, count]) => count < all.length)?.[0];
  };

  it('IOS-GH-04 a chip filters the list to that stack (aria-pressed); pressing it again clears the filter', async () => {
    const tech = narrowingStack();
    if (!tech) throw new Error('the data has no stack that narrows the list');
    renderIosApp(GitHub, 'github');
    const all = rows();
    const chips = within(top()).getByRole('group', { name: 'Filter by stack' });
    const chip = within(chips).getByRole('button', { name: tech });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chip);
    await settle();
    const expected = projects()
      .filter((project) => project.stack.includes(tech))
      .map((project) => project.slug);
    expect(rows()).toEqual(expected);
    expect(rows().length).toBeLessThan(all.length);
    expect(within(top()).getByRole('button', { name: tech })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(within(top()).getByRole('button', { name: tech }));
    await settle();
    expect(rows()).toEqual(all);
    expect(within(top()).getByRole('button', { name: tech })).toHaveAttribute('aria-pressed', 'false');
  });

  it('IOS-GH-04 the search field narrows by name; the field’s clear button restores the list', async () => {
    const [first] = projects();
    renderIosApp(GitHub, 'github');
    const all = rows();
    const search = within(top()).getByRole('searchbox', { name: 'Search repositories' });
    fireEvent.change(search, { target: { value: first!.name } });
    await settle();
    expect(rows()).toContain(first!.slug);
    expect(rows().length).toBeLessThanOrEqual(all.length);
    for (const slug of rows()) {
      const project = projects().find((item) => item.slug === slug)!;
      const haystack = [project.name, project.tagline, project.context, ...project.stack].join(' ').toLowerCase();
      expect(haystack).toContain(first!.name.toLowerCase());
    }
    fireEvent.click(within(top()).getByRole('button', { name: 'Clear text' }));
    await settle();
    expect(rows()).toEqual(all);
    expect(within(top()).getByRole('searchbox', { name: 'Search repositories' })).toHaveValue('');
  });

  it('IOS-GH-04 nothing matches → "No repositories" + Clear, which resets both the search and the filter', async () => {
    const tech = narrowingStack();
    renderIosApp(GitHub, 'github');
    const all = rows();
    if (tech) {
      fireEvent.click(within(top()).getByRole('button', { name: tech }));
      await settle();
    }
    fireEvent.change(within(top()).getByRole('searchbox', { name: 'Search repositories' }), {
      target: { value: 'zzqx-no-such-repository' },
    });
    await settle();
    expect(rows()).toEqual([]);
    const empty = within(top()).getByText('No repositories').closest('[role="status"]') as HTMLElement;
    expect(empty).not.toBeNull();
    fireEvent.click(within(empty).getByRole('button', { name: 'Clear' }));
    await settle();
    expect(rows()).toEqual(all);
    expect(within(top()).getByRole('searchbox', { name: 'Search repositories' })).toHaveValue('');
    for (const chip of within(within(top()).getByRole('group', { name: 'Filter by stack' })).getAllByRole('button'))
      expect(chip).toHaveAttribute('aria-pressed', 'false');
  });

  it('IOS-GH-04 search and filter are session state (kept on the window, not in the URL)', async () => {
    const tech = narrowingStack();
    if (!tech) throw new Error('the data has no stack that narrows the list');
    renderIosApp(GitHub, 'github');
    fireEvent.click(within(top()).getByRole('button', { name: tech }));
    fireEvent.change(within(top()).getByRole('searchbox', { name: 'Search repositories' }), {
      target: { value: 'a' },
    });
    await settle();
    expect(win().ui).toMatchObject({ filter: tech, q: 'a' });
    expect(atRoot()).toBe(true);
  });
});
