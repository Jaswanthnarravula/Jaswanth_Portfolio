/**
 * OS registry + role bindings — shared/04 `KRN-REG-01`, section ownership from plans/README.md.
 * Each OS *binds* an OS-agnostic `AppRole` to its own slug, title, icon and window policy.
 */
import { SECTION_IDS, type OsId, type SectionId, type SizeClass, type AppRole, OS_IDS } from './ids';
import {
  assetId,
  type OsAppBinding,
  type OsDefinition,
  type OsRegistry,
  type PxRect,
  type WindowPolicy,
} from './types';

type Size = { readonly w: number; readonly h: number };

/** Floating window policy: preferred size per size class, cascaded by `slot` so windows never stack exactly. */
function floating(sizes: Readonly<Record<Exclude<SizeClass, 'compact'>, Size>>, slot: number, min: Size): WindowPolicy {
  const cascade = (base: { x: number; y: number }, size: Size): PxRect => ({
    x: base.x + slot * 28,
    y: base.y + slot * 24,
    w: size.w,
    h: size.h,
  });
  return {
    mode: 'floating',
    defaultRect: {
      compact: { x: 0, y: 0, w: 390, h: 640 },
      medium: cascade({ x: 32, y: 56 }, sizes.medium),
      expanded: cascade({ x: 96, y: 72 }, sizes.expanded),
      large: cascade({ x: 160, y: 96 }, sizes.large),
    },
    minPx: min,
    resizable: true,
  };
}

const FULL: PxRect = { x: 0, y: 0, w: 0, h: 0 };
const fullscreen: WindowPolicy = {
  mode: 'fullscreen',
  defaultRect: { compact: FULL, medium: FULL, expanded: FULL, large: FULL },
  minPx: { w: 0, h: 0 },
  resizable: false,
};
const tiled: WindowPolicy = { ...fullscreen, mode: 'tiled' };

const SIZES = {
  document: {
    medium: { w: 620, h: 480 },
    expanded: { w: 860, h: 560 },
    large: { w: 1040, h: 680 },
  },
  wide: {
    medium: { w: 660, h: 500 },
    expanded: { w: 940, h: 600 },
    large: { w: 1160, h: 740 },
  },
  compactWindow: {
    medium: { w: 560, h: 420 },
    expanded: { w: 680, h: 460 },
    large: { w: 760, h: 520 },
  },
} as const;

const MIN = { w: 360, h: 240 } as const;

function app(
  os: OsId,
  role: AppRole,
  slug: string,
  title: string,
  window: WindowPolicy,
  owns: readonly SectionId[],
  pinned = true,
): OsAppBinding {
  return { role, slug, title, icon: assetId(`app.${os}.${slug}`), window, pinned, owns };
}

const macos: OsDefinition = {
  id: 'macos',
  name: 'macOS',
  chrome: 'desktop',
  released: false,
  apps: [
    app('macos', 'files', 'finder', 'Finder', floating(SIZES.document, 0, MIN), ['experience', 'education']),
    app('macos', 'browser', 'safari', 'Safari', floating(SIZES.wide, 1, MIN), ['about']),
    app('macos', 'github', 'github', 'GitHub', floating(SIZES.wide, 2, MIN), ['projects']),
    app('macos', 'viewer', 'preview', 'Preview', floating(SIZES.document, 3, MIN), ['resume']),
    app('macos', 'mail', 'mail', 'Mail', floating(SIZES.document, 4, MIN), ['contact']),
    app('macos', 'editor', 'vscode', 'Visual Studio Code', floating(SIZES.wide, 5, MIN), ['skills']),
    app('macos', 'terminal', 'terminal', 'Terminal', floating(SIZES.compactWindow, 6, MIN), []),
    app('macos', 'settings', 'settings', 'System Settings', floating(SIZES.document, 7, MIN), []),
  ],
  sectionOwner: {
    about: 'browser',
    projects: 'github',
    experience: 'files',
    education: 'files',
    resume: 'viewer',
    skills: 'editor',
    contact: 'mail',
  },
};

const windows: OsDefinition = {
  id: 'windows',
  name: 'Windows 11',
  chrome: 'desktop',
  released: false,
  apps: [
    app('windows', 'files', 'explorer', 'File Explorer', floating(SIZES.document, 0, MIN), ['experience', 'education']),
    app('windows', 'browser', 'edge', 'Microsoft Edge', floating(SIZES.wide, 1, MIN), ['about', 'resume']),
    app('windows', 'github', 'github', 'GitHub', floating(SIZES.wide, 2, MIN), ['projects']),
    app('windows', 'mail', 'outlook', 'Outlook', floating(SIZES.document, 3, MIN), ['contact']),
    app('windows', 'editor', 'vscode', 'Visual Studio Code', floating(SIZES.wide, 4, MIN), ['skills']),
    app('windows', 'terminal', 'terminal', 'Terminal', floating(SIZES.compactWindow, 5, MIN), []),
    app('windows', 'settings', 'settings', 'Settings', floating(SIZES.document, 6, MIN), [], false),
  ],
  sectionOwner: {
    about: 'browser',
    projects: 'github',
    experience: 'files',
    education: 'files',
    resume: 'browser',
    skills: 'editor',
    contact: 'mail',
  },
};

const ios: OsDefinition = {
  id: 'ios',
  name: 'iOS',
  chrome: 'mobile',
  released: false,
  apps: [
    app('ios', 'browser', 'safari', 'Safari', fullscreen, ['about']),
    app('ios', 'github', 'github', 'GitHub', fullscreen, ['projects']),
    app('ios', 'files', 'files', 'Files', fullscreen, ['experience', 'education', 'resume']),
    app('ios', 'notes', 'notes', 'Notes', fullscreen, ['skills']),
    app('ios', 'mail', 'mail', 'Mail', fullscreen, ['contact']),
    app('ios', 'messages', 'messages', 'Messages', fullscreen, []),
    app('ios', 'settings', 'settings', 'Settings', fullscreen, []),
  ],
  sectionOwner: {
    about: 'browser',
    projects: 'github',
    experience: 'files',
    education: 'files',
    resume: 'files',
    skills: 'notes',
    contact: 'mail',
  },
};

const android: OsDefinition = {
  id: 'android',
  name: 'Android',
  chrome: 'mobile',
  released: false,
  apps: [
    app('android', 'browser', 'chrome', 'Chrome', fullscreen, ['about']),
    app('android', 'github', 'github', 'GitHub', fullscreen, ['projects']),
    app('android', 'files', 'files', 'Files', fullscreen, ['experience', 'education', 'resume']),
    app('android', 'notes', 'keep', 'Keep Notes', fullscreen, ['skills']),
    app('android', 'mail', 'gmail', 'Gmail', fullscreen, ['contact']),
    app('android', 'settings', 'settings', 'Settings', fullscreen, []),
  ],
  sectionOwner: {
    about: 'browser',
    projects: 'github',
    experience: 'files',
    education: 'files',
    resume: 'files',
    skills: 'notes',
    contact: 'mail',
  },
};

const linux: OsDefinition = {
  id: 'linux',
  name: 'Linux',
  chrome: 'terminal',
  released: false,
  apps: [
    app('linux', 'terminal', 'terminal', 'Terminal', tiled, [
      'about',
      'projects',
      'experience',
      'education',
      'skills',
      'contact',
    ]),
    app('linux', 'viewer', 'viewer', 'Viewer', tiled, ['resume']),
  ],
  sectionOwner: {
    about: 'terminal',
    projects: 'terminal',
    experience: 'terminal',
    education: 'terminal',
    resume: 'viewer',
    skills: 'terminal',
    contact: 'terminal',
  },
};

export const OS_REGISTRY: OsRegistry = { ios, macos, windows, android, linux };

export function getBinding(os: OsId, role: AppRole, registry: OsRegistry = OS_REGISTRY): OsAppBinding | undefined {
  return registry[os].apps.find((binding) => binding.role === role);
}

export function getBindingBySlug(os: OsId, slug: string, registry: OsRegistry = OS_REGISTRY): OsAppBinding | undefined {
  return registry[os].apps.find((binding) => binding.slug === slug);
}

export function ownerOf(os: OsId, section: SectionId, registry: OsRegistry = OS_REGISTRY): OsAppBinding {
  const binding = getBinding(os, registry[os].sectionOwner[section], registry);
  if (!binding) throw new Error(`Registry invariant: ${os} has no binding for ${registry[os].sectionOwner[section]}`);
  return binding;
}

/**
 * Visible = released, plus an explicit preview allow-list for preview/test builds (never production; the release
 * checklist asserts `NEXT_PUBLIC_OS_PREVIEW` is unset there). `ARCH-REL-01`.
 */
export function visibleOses(preview: readonly OsId[] = [], registry: OsRegistry = OS_REGISTRY): readonly OsId[] {
  return OS_IDS.filter((os) => registry[os].released || preview.includes(os));
}

/** Registry self-check used by tests and at module load in development. */
export function registryProblems(registry: OsRegistry = OS_REGISTRY): string[] {
  const problems: string[] = [];
  for (const os of OS_IDS) {
    const definition = registry[os];
    const slugs = new Set<string>();
    const roles = new Set<AppRole>();
    for (const binding of definition.apps) {
      if (slugs.has(binding.slug)) problems.push(`${os}: duplicate slug ${binding.slug}`);
      if (roles.has(binding.role)) problems.push(`${os}: duplicate role ${binding.role}`);
      if (!/^[a-z][a-z0-9-]*$/.test(binding.slug)) problems.push(`${os}: slug ${binding.slug} not kebab-case`);
      slugs.add(binding.slug);
      roles.add(binding.role);
    }
    for (const section of SECTION_IDS) {
      const role = definition.sectionOwner[section];
      const binding = definition.apps.find((candidate) => candidate.role === role);
      if (!binding) problems.push(`${os}: section ${section} owned by unbound role ${role}`);
      else if (!binding.owns.includes(section))
        problems.push(`${os}: ${binding.slug} does not list ${section} in owns`);
    }
    for (const binding of definition.apps)
      for (const section of binding.owns)
        if (definition.sectionOwner[section] !== binding.role)
          problems.push(`${os}: ${binding.slug} claims ${section} owned by ${definition.sectionOwner[section]}`);
  }
  return problems;
}
