import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { buildContentIndex, contentIndex, hashContent } from '@/data/content-index';
import { portfolio } from '@/data/portfolio';
import { SECTION_IDS, type Portfolio } from '@/data/schema';
import * as selectors from '@/data/selectors';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import { OS_IDS } from '@/lib/kernel/ids';
import { buildSearchIndex } from '@/lib/search/index-builder';
import { prepare, search, tokenScore, withinOneEdit, zeroState } from '@/lib/search/matcher';
import { fixtureCatalog, fixturePortfolio } from '../../fixtures/portfolio';

const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const partial = /^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/;

describe('DATA-INV-01 data invariants', () => {
  const data: Portfolio = portfolio;
  it('slugs are unique per collection, kebab-case and URL-safe', () => {
    for (const collection of [data.projects, data.experience, data.education]) {
      const slugs = collection.map((item) => item.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const slug of slugs) expect(slug).toMatch(kebab);
      for (const slug of slugs) expect(SECTION_IDS as readonly string[]).not.toContain(slug);
      for (const slug of slugs) expect(slug).not.toBe('readme');
    }
  });
  it('dates are ISO partial dates and end ≥ start', () => {
    const periods = [
      ...data.experience.map((item) => [item.start, item.end] as const),
      ...data.education.map((item) => [item.start, item.end] as const),
    ];
    for (const [start, end] of periods) {
      if (start) expect(start).toMatch(partial);
      if (end && end !== 'present') expect(end).toMatch(partial);
      if (start && end && end !== 'present') expect(end >= start).toBe(true);
    }
  });
  it('every unpublished fact (null) is flagged placeholder — never guessed', () => {
    for (const role of data.experience)
      if (role.start === null || role.end === null || role.role === null || role.location === null)
        expect(role.placeholder, role.slug).toBe(true);
    for (const school of data.education)
      if (school.start === null || school.end === null) expect(school.placeholder, school.slug).toBe(true);
  });
  it('no skill carries an invented proficiency rating', () => {
    for (const group of data.skills) for (const item of group.items) expect(item.level).toBeUndefined();
  });
  it('lists are sorted newest first by selector', () => {
    const roles = selectors.getExperience();
    expect(roles[0]?.end).toBe('present');
    const schools = selectors.getEducation();
    expect(schools.map((school) => school.slug)).toEqual(['uab', 'jntuh']);
  });
  it('every ContentRef in the index resolves; every entry is indexed', () => {
    for (const entry of contentIndex.entries) expect(selectors.resolveContent(entry.ref)).toBeDefined();
    for (const project of data.projects)
      expect(contentIndex.has({ section: 'projects', slug: project.slug })).toBe(true);
    for (const role of data.experience) expect(contentIndex.has({ section: 'experience', slug: role.slug })).toBe(true);
    for (const school of data.education)
      expect(contentIndex.has({ section: 'education', slug: school.slug })).toBe(true);
  });
});

describe('DATA-INDEX-01 content index + contentRev', () => {
  it('indexes every section and item', () => {
    expect(fixtureCatalog.entries.map((entry) => entry.key)).toEqual([
      'about',
      'projects',
      'experience',
      'skills',
      'education',
      'resume',
      'contact',
      'projects/portfolio-os',
      'projects/rocket',
      'experience/acme',
      'experience/globex',
      'education/state-u',
    ]);
  });
  it('contentRev changes when data changes', () => {
    const changed = buildContentIndex({
      ...fixturePortfolio,
      person: { ...fixturePortfolio.person, headline: 'Changed' },
    });
    expect(changed.rev).not.toBe(fixtureCatalog.rev);
    expect(buildContentIndex(fixturePortfolio).rev).toBe(fixtureCatalog.rev);
    expect(hashContent({ a: 1 })).toMatch(/^[0-9a-f]{8}$/);
  });
  it('a removed slug repairs to its section', () => {
    expect(fixtureCatalog.repair({ section: 'projects', slug: 'gone' })).toEqual({ section: 'projects' });
    expect(selectors.resolveContent({ section: 'projects', slug: 'gone' }).section).toBe('projects');
  });
});

describe('DATA-EMPTY-01 (selectors) empty collections', () => {
  it('an empty collection yields [] and the section stays indexed', () => {
    const empty = buildContentIndex({ ...fixturePortfolio, education: [] });
    expect(empty.slugs('education')).toEqual([]);
    expect(empty.has({ section: 'education' })).toBe(true);
    expect(empty.get({ section: 'education' })?.summary).toMatch(/No education/);
  });
});

describe('GH-MERGE-01 merge by repo URL; résumé stays source of truth', () => {
  const snapshot = {
    v: 1 as const,
    fetchedAt: '2026-09-21T00:00:00Z',
    user: null,
    pinned: [],
    contributions: null,
    repos: [
      {
        name: 'unrelated',
        url: 'https://github.com/x/unrelated',
        description: null,
        stars: 9,
        forks: 0,
        language: 'Go',
        topics: [],
        pushedAt: '2026-01-01',
        archived: false,
      },
      {
        name: 'old',
        url: 'https://github.com/x/old',
        description: null,
        stars: 50,
        forks: 0,
        language: 'Go',
        topics: [],
        pushedAt: '2020-01-01',
        archived: true,
      },
    ],
  };
  it('unmatched repos are excluded from the project list and only appear under "More on GitHub"', () => {
    const projects = selectors.getProjectsWithGithub(snapshot);
    expect(projects.map((item) => item.project.slug)).toEqual(selectors.getProjects().map((project) => project.slug));
    expect(projects.every((item) => item.github === undefined)).toBe(true);
    expect(selectors.getMoreOnGithub(snapshot).map((repo) => repo.name)).toEqual(['unrelated']);
  });
  it('matches a project by normalized repo URL', () => {
    const project = { ...fixturePortfolio.projects[0]!, repo: 'https://github.com/X/Unrelated.git' };
    expect(selectors.githubRepoFor(project, snapshot)?.name).toBe('unrelated');
  });
});

describe('SRCH-INDEX-01 build-time index', () => {
  it('indexes every ContentRef and app binding, and stays ≤ 10 KB gzipped', () => {
    for (const os of OS_IDS) {
      const index = buildSearchIndex({ os, registry: OS_REGISTRY, catalog: contentIndex, visible: OS_IDS });
      for (const binding of OS_REGISTRY[os].apps)
        expect(index.some((entry) => entry.role === binding.role && entry.kind === 'app')).toBe(true);
      for (const entry of contentIndex.entries)
        expect(index.some((item) => item.id === `content:${entry.key}`)).toBe(true);
      expect(gzipSync(JSON.stringify(index)).length).toBeLessThanOrEqual(10 * 1024);
    }
  });
  it('never indexes an unreleased OS', () => {
    expect(
      buildSearchIndex({ os: 'android', registry: OS_REGISTRY, catalog: contentIndex, visible: ['macos'] }),
    ).toEqual([]);
  });
});

describe('SRCH-MATCH-01 matcher scoring + typo tolerance', () => {
  const index = prepare(
    buildSearchIndex({
      os: 'macos',
      registry: OS_REGISTRY,
      catalog: fixtureCatalog,
      visible: OS_IDS,
      featured: ['portfolio-os'],
    }),
  );
  it('ranks exact > prefix > word-prefix > substring > typo', () => {
    expect(tokenScore('rocket', 'rocket')).toBe(1);
    expect(tokenScore('rock', 'rocket')).toBe(0.8);
    expect(tokenScore('os', 'portfolio-os')).toBe(0.7);
    expect(tokenScore('ck', 'rocket')).toBe(0.5);
    expect(tokenScore('rokcet', 'rocket')).toBe(0.4);
    expect(tokenScore('rkt', 'rocket')).toBe(0);
  });
  it('Damerau-Levenshtein ≤ 1', () => {
    expect(withinOneEdit('finder', 'fnider')).toBe(true);
    expect(withinOneEdit('finder', 'finer')).toBe(true);
    expect(withinOneEdit('finder', 'finderr')).toBe(true);
    expect(withinOneEdit('finder', 'fonder')).toBe(true);
    expect(withinOneEdit('finder', 'fonderr')).toBe(false);
  });
  it.each([
    ['finder', 'app:files'],
    ['rocket', 'content:projects/rocket'],
    ['fidner', 'app:files'],
    ['resume', 'content:resume'],
    ['acme', 'content:experience/acme'],
    ['sound', 'action:toggle-sound'],
  ])('"%s" → %s first', (query, id) => {
    expect(search(index, query)[0]?.id).toBe(id);
  });
  it('every query token must match; diacritics are ignored', () => {
    expect(search(index, 'rocket zebra')).toEqual([]);
    expect(search(index, 'résumé')[0]?.id).toBe('content:resume');
    expect(search(index, 'portfolio')[0]?.matched).toEqual([[0, 9]]);
  });
  it('zero state lists Résumé, Projects, Contact first', () => {
    const entries = buildSearchIndex({ os: 'macos', registry: OS_REGISTRY, catalog: fixtureCatalog, visible: OS_IDS });
    expect(zeroState(entries, ['content:projects/rocket']).map((entry) => entry.id)).toEqual([
      'content:resume',
      'content:projects',
      'content:contact',
      'content:projects/rocket',
    ]);
  });
});
