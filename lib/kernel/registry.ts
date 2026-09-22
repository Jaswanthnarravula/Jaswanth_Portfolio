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
  type RectFraction,
  type Viewport,
  type WindowPolicy,
  type WorkspaceInsets,
  type UserPreferences,
  type DockSize,
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

/**
 * macOS chrome metrics (plans/macos/01-identity, surfaces/menu-bar + dock, 04-responsive). One source: the kernel
 * bounds the window workspace with them and the macOS shell writes the same numbers as CSS custom properties.
 */
export const MACOS_CHROME = {
  /** Menu bar height: 24 px with a fine pointer, 28 px on the touch and compact postures. */
  menuBar: { pointer: 24, touch: 28 },
  /** Dock icon box: 48 px, 64 px on `large` (the Medium Dock size). */
  dockIcon: { base: 48, large: 64 },
  /** Settings → Desktop & Dock → Dock size (plans/macos/apps/system-settings.md): icon box per size, per size class. */
  dockSizes: { small: { base: 40, large: 52 }, medium: { base: 48, large: 64 }, large: { base: 56, large: 76 } },
  /** Dock plate padding and its gap above the bottom edge. */
  dockPadding: 6,
  dockMargin: 8,
} as const;

/** The Dock's icon box for a viewport and the visitor's Dock size. */
export function macDockIcon(viewport: Pick<Viewport, 'sizeClass'>, size: DockSize = 'medium'): number {
  const sizes = MACOS_CHROME.dockSizes[size];
  return viewport.sizeClass === 'large' ? sizes.large : sizes.base;
}

export function macosInsets(viewport: Viewport, prefs?: Pick<UserPreferences, 'dock'>): WorkspaceInsets {
  const icon = macDockIcon(viewport, prefs?.dock.size);
  const dock = icon + MACOS_CHROME.dockPadding * 2 + MACOS_CHROME.dockMargin;
  // Compact landscape: the Dock becomes a left rail; the menu bar stays on top (plans/macos/04 `MAC-RESP-04`).
  const rail = viewport.posture === 'compact' && viewport.orientation === 'landscape';
  return {
    top: viewport.posture === 'pointer' ? MACOS_CHROME.menuBar.pointer : MACOS_CHROME.menuBar.touch,
    right: 0,
    bottom: rail ? 0 : dock,
    left: rail ? dock : 0,
  };
}

/**
 * macOS windows are placed by fractions of the page: Finder and GitHub exactly where the owner's storyboard frame puts
 * them (plans/macos/01-identity "Reference state"); Safari, Mail and VS Code share one document position, so the second
 * of them opens cascaded 24 px from the first (`MAC-WM-01`).
 */
const MAC_PLACEMENT = {
  finder: { x: 0.07, y: 0.24, w: 0.62, h: 0.54 },
  github: { x: 0.3, y: 0.13, w: 0.5, h: 0.52 },
  document: { x: 0.16, y: 0.1, w: 0.58, h: 0.66 },
  preview: { x: 0.34, y: 0.08, w: 0.34, h: 0.78 },
  terminal: { x: 0.26, y: 0.2, w: 0.42, h: 0.44 },
  settings: { x: 0.3, y: 0.14, w: 0.4, h: 0.62 },
} as const satisfies Record<string, RectFraction>;

const macWindow = (fraction: RectFraction, min: Size = MIN): WindowPolicy => ({
  ...floating(SIZES.document, 0, min),
  defaultFraction: fraction,
});

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
  // Released only when plans/macos/08-acceptance.md is 100 % verified (ARCH-REL-01); P2 ships it as a preview.
  released: true,
  apps: [
    app('macos', 'files', 'finder', 'Finder', macWindow(MAC_PLACEMENT.finder, { w: 560, h: 360 }), [
      'experience',
      'education',
    ]),
    app('macos', 'browser', 'safari', 'Safari', macWindow(MAC_PLACEMENT.document), ['about']),
    app('macos', 'github', 'github', 'GitHub', macWindow(MAC_PLACEMENT.github), ['projects']),
    app('macos', 'viewer', 'preview', 'Preview', macWindow(MAC_PLACEMENT.preview), ['resume']),
    app('macos', 'mail', 'mail', 'Mail', macWindow(MAC_PLACEMENT.document), ['contact']),
    app('macos', 'editor', 'vscode', 'Visual Studio Code', macWindow(MAC_PLACEMENT.document), ['skills']),
    app('macos', 'terminal', 'terminal', 'Terminal', macWindow(MAC_PLACEMENT.terminal), []),
    app('macos', 'settings', 'settings', 'System Settings', macWindow(MAC_PLACEMENT.settings), []),
  ],
  insets: macosInsets,
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

/**
 * Windows 11 chrome metrics (plans/windows/01-identity, surfaces/taskbar, 04-responsive): one source for the kernel's
 * workspace and the shell's CSS custom properties.
 */
export const WINDOWS_CHROME = {
  /** Taskbar: 48 px, 40 px in compact landscape. */
  taskbar: { base: 48, compactLandscape: 40 },
  /** New windows that would open on top of another cascade by 32 px (plans/windows/02 "Open"). */
  cascade: 32,
} as const;

export function windowsInsets(viewport: Viewport): WorkspaceInsets {
  const compactLandscape = viewport.sizeClass === 'compact' && viewport.orientation === 'landscape';
  return {
    top: 0,
    right: 0,
    bottom: compactLandscape ? WINDOWS_CHROME.taskbar.compactLandscape : WINDOWS_CHROME.taskbar.base,
    left: 0,
  };
}

/**
 * Windows windows open centred in the workspace at their app's size (plans/windows/apps/*), 12 % larger on `large`
 * (plans/windows/04), clamped to the workspace. File Explorer opens exactly where the storyboard frame puts it
 * (plans/windows/01-identity "Visual target": x 2 %, y 3 %, 48 % × 83 %).
 */
const winWindow = (size: Size, min: Size, fraction?: RectFraction): WindowPolicy => ({
  ...floating(SIZES.document, 0, min),
  centered: {
    compact: size,
    medium: size,
    expanded: size,
    large: { w: Math.round(size.w * 1.12), h: Math.round(size.h * 1.12) },
  },
  cascadePx: WINDOWS_CHROME.cascade,
  ...(fraction ? { defaultFraction: fraction } : {}),
});

const WIN_EXPLORER_FRAME: RectFraction = { x: 0.02, y: 0.03, w: 0.48, h: 0.83 };

const windows: OsDefinition = {
  id: 'windows',
  name: 'Windows 11',
  chrome: 'desktop',
  released: true,
  apps: [
    app(
      'windows',
      'files',
      'explorer',
      'File Explorer',
      winWindow({ w: 960, h: 600 }, { w: 560, h: 360 }, WIN_EXPLORER_FRAME),
      ['experience', 'education'],
    ),
    {
      ...app('windows', 'browser', 'edge', 'Microsoft Edge', winWindow({ w: 1100, h: 700 }, { w: 640, h: 420 }), [
        'about',
        'resume',
      ]),
      home: 'about',
    },
    app('windows', 'github', 'github', 'GitHub', winWindow({ w: 1040, h: 680 }, { w: 600, h: 420 }), ['projects']),
    app('windows', 'mail', 'outlook', 'Outlook', winWindow({ w: 1020, h: 640 }, { w: 600, h: 400 }), ['contact']),
    app('windows', 'editor', 'vscode', 'Visual Studio Code', winWindow({ w: 1100, h: 700 }, { w: 640, h: 420 }), [
      'skills',
    ]),
    app('windows', 'terminal', 'terminal', 'Terminal', winWindow({ w: 760, h: 480 }, { w: 420, h: 260 }), []),
    // Pinned: the storyboard's taskbar shows Settings between Terminal and the Résumé (plans/windows/08 Deviations).
    app('windows', 'settings', 'settings', 'Settings', winWindow({ w: 900, h: 640 }, { w: 560, h: 420 }), []),
  ],
  insets: windowsInsets,
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
  released: true,
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
  released: true,
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
  released: true,
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

const NO_INSETS: WorkspaceInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/** The OS chrome's insets for a viewport (none for OSes without floating windows). */
export function workspaceInsets(
  os: OsId,
  viewport: Viewport,
  registry: OsRegistry = OS_REGISTRY,
  prefs?: Pick<UserPreferences, 'dock'>,
): WorkspaceInsets {
  return registry[os].insets?.(viewport, prefs) ?? NO_INSETS;
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
      if (binding.home && (!binding.owns.includes(binding.home) || binding.owns.length < 2))
        problems.push(`${os}: ${binding.slug} home ${binding.home} must be one of several owned sections`);
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
