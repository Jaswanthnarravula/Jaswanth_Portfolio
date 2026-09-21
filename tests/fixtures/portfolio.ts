/** Deterministic portfolio fixture (shared/12 test doubles): tests never depend on the real content. */
import { buildContentIndex } from '@/data/content-index';
import type { Portfolio } from '@/data/schema';
import { DEFAULT_PREFS, initialKernelState } from '@/lib/kernel/state';
import { OS_IDS } from '@/lib/kernel/ids';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import { createRouteCodec } from '@/lib/kernel/route/codec';
import { reduce, type KernelDeps, type KernelResult } from '@/lib/kernel/reducers';
import type { KernelAction } from '@/lib/kernel/actions';
import type { KernelState, UserPreferences } from '@/lib/kernel/types';
import { DEFAULT_CAPABILITIES } from '@/lib/kernel/state';

export const fixturePortfolio: Portfolio = {
  person: {
    name: 'Ada Example',
    givenName: 'Ada',
    headline: 'Engineer of examples',
    role: 'Engineer',
    location: 'Testville',
    summary: ['Builds fixtures.', 'Second paragraph.'],
    openTo: 'Open to tests.',
  },
  contact: {
    email: 'ada@example.com',
    links: [{ kind: 'github', label: 'GitHub', url: 'https://github.com/ada', handle: '@ada' }],
  },
  experience: [
    {
      slug: 'acme',
      company: 'Acme',
      role: 'Engineer',
      start: '2022-01',
      end: 'present',
      location: 'Remote',
      summary: 'Builds rockets.',
      highlights: ['Launched things'],
      stack: ['Go'],
    },
    {
      slug: 'globex',
      company: 'Globex',
      role: 'Intern',
      start: '2020-06',
      end: '2021-08',
      location: 'Springfield',
      summary: 'Learned things.',
      highlights: ['Learned'],
      stack: ['Java'],
    },
  ],
  projects: [
    {
      slug: 'portfolio-os',
      name: 'Portfolio OS',
      tagline: 'Five operating systems.',
      context: 'Personal',
      description: ['A site.'],
      highlights: ['Kernel'],
      stack: ['TypeScript'],
      repo: 'https://github.com/ada/portfolio-os',
      year: 2026,
      featured: true,
    },
    {
      slug: 'rocket',
      name: 'Rocket',
      tagline: 'Goes up.',
      context: 'Acme',
      description: ['It flies.'],
      highlights: ['Up'],
      stack: ['Go'],
      year: 2023,
      featured: false,
    },
  ],
  education: [
    {
      slug: 'state-u',
      school: 'State University',
      shortName: 'SU',
      degree: 'B.S. Examples',
      start: '2016-09',
      end: '2020-05',
      notes: ['Algorithms'],
    },
  ],
  credentials: [],
  skills: [{ id: 'langs', label: 'Languages', items: [{ name: 'Go' }, { name: 'TypeScript' }] }],
  resume: { file: '/resume/ada.pdf', downloadName: 'Ada-Resume.pdf', updated: '2026-01-01' },
  provenance: { sources: [], retrieved: '2026-01-01', metricsReported: true },
};

export const fixtureCatalog = buildContentIndex(fixturePortfolio);
export const allVisible = OS_IDS;
export const fixtureCodec = createRouteCodec({ registry: OS_REGISTRY, catalog: fixtureCatalog, visible: allVisible });

export function makeDeps(overrides: Partial<KernelDeps> = {}): KernelDeps {
  return {
    registry: OS_REGISTRY,
    catalog: fixtureCatalog,
    codec: fixtureCodec,
    prefs: DEFAULT_PREFS,
    visible: allVisible,
    now: 1_000_000,
    ...overrides,
  };
}

/** Boot a kernel at `url` (cold navigation by default) and return the state. */
export function booted(
  url: string,
  options: {
    navType?: 'navigate' | 'reload' | 'back_forward';
    w?: number;
    h?: number;
    prefs?: UserPreferences;
    deps?: Partial<KernelDeps>;
  } = {},
): KernelState {
  const deps = makeDeps({ prefs: options.prefs ?? DEFAULT_PREFS, ...options.deps });
  return reduce(
    initialKernelState(fixtureCatalog.rev),
    {
      type: 'BOOT',
      url,
      navType: options.navType ?? 'navigate',
      viewport: { w: options.w ?? 1440, h: options.h ?? 900, pointer: 'fine' },
      persisted: null,
      capabilities: DEFAULT_CAPABILITIES,
    },
    deps,
  ).state;
}

/** Apply actions in order; returns every result. */
export function run(
  state: KernelState,
  actions: readonly KernelAction[],
  deps: KernelDeps = makeDeps(),
): KernelResult[] {
  const results: KernelResult[] = [];
  let current = state;
  for (const action of actions) {
    const result = reduce(current, action, deps);
    results.push(result);
    current = result.state;
  }
  return results;
}

export const last = <T>(items: readonly T[]): T => items[items.length - 1]!;
