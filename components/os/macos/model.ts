/**
 * macOS view model: pure helpers the surfaces share. Geometry comes from the kernel's own functions (the DOM never
 * disagrees with what the kernel clamps and stores); titles and places come from the registry and the content index.
 */
import { SECTION_TITLES } from '@/data/content-index';
import { getIndexEntry } from '@/data/selectors';
import type { AppRole } from '@/lib/kernel/ids';
import { getBinding, macDockIcon, macosInsets, MACOS_CHROME } from '@/lib/kernel/registry';
import { currentRect } from '@/lib/kernel/reducers/windows';
import { refForLocation } from '@/lib/kernel/route/codec';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import { currentLocation } from '@/lib/kernel/state';
import type { AppLocation, DockSize, OsAppBinding, PxRect, Viewport, WindowInstance } from '@/lib/kernel/types';
import { getPrefs } from '@/stores/prefs-store';

/** The Dock, left → right, exactly as the owner's storyboard frame orders it (plans/macos/01-identity). */
export const DOCK_ORDER: readonly AppRole[] = [
  'files',
  'browser',
  'github',
  'mail',
  'viewer',
  'editor',
  'terminal',
  'settings',
];

/** What the bold app menu says (the real apps' own names: VS Code's menu is "Code"). */
const MENU_NAMES: Partial<Record<AppRole, string>> = { editor: 'Code' };

export const macBinding = (role: AppRole): OsAppBinding => {
  const binding = getBinding('macos', role);
  if (!binding) throw new Error(`macOS has no ${role} app`);
  return binding;
};

export const menuName = (role: AppRole | null): string =>
  role ? (MENU_NAMES[role] ?? macBinding(role).title) : macBinding('files').title;

/** The window's rect for the viewport's size class, exactly as the kernel computes and clamps it. */
export function effectiveRect(
  window: WindowInstance,
  viewport: Viewport,
  learned?: Partial<Record<Viewport['sizeClass'], PxRect>>,
): PxRect {
  return currentRect(
    window,
    macBinding(window.role),
    viewport.sizeClass,
    viewport,
    learned,
    macosInsets(viewport, getPrefs()),
  );
}

/** The zoomed rect: the whole workspace between the menu bar and the Dock. */
export function zoomedRect(viewport: Viewport): PxRect {
  const insets = macosInsets(viewport, getPrefs());
  return {
    x: insets.left,
    y: insets.top,
    w: viewport.w - insets.left - insets.right,
    h: viewport.h - insets.top - insets.bottom,
  };
}

/** CSS custom properties for the chrome, written from the kernel's numbers (one source of truth). */
export function chromeVars(viewport: Viewport, dockSize: DockSize = 'medium'): Record<string, string> {
  const insets = macosInsets(viewport, { dock: { magnification: true, size: dockSize } });
  const icon = macDockIcon(viewport, dockSize);
  return {
    '--mb-h': `${insets.top}px`,
    '--dock-reserve': `${insets.bottom}px`,
    '--dock-rail': `${insets.left}px`,
    '--dock-icon': `${icon}px`,
    '--dock-pad': `${MACOS_CHROME.dockPadding}px`,
    '--dock-margin': `${MACOS_CHROME.dockMargin}px`,
  };
}

/** Finder's folder for a location: the home folder, or the section folder. */
export type FinderFolder = 'home' | 'experience' | 'education';

export function finderPlace(location: AppLocation): { folder: FinderFolder; slug: string | null } {
  if (location.kind !== 'content') return { folder: 'home', slug: null };
  const { ref } = location;
  if (ref.section !== 'experience' && ref.section !== 'education') return { folder: 'home', slug: null };
  return { folder: ref.section, slug: 'slug' in ref && ref.slug ? ref.slug : null };
}

export const FOLDER_TITLES: Readonly<Record<FinderFolder, string>> = {
  home: 'Jaswanth',
  experience: SECTION_TITLES.experience,
  education: SECTION_TITLES.education,
};

/**
 * A window's title: Finder names its folder (as the real Finder does); other apps name themselves. `spoken` prefixes
 * the app so a screen reader always knows which window it is in.
 */
export function windowTitle(window: WindowInstance): { visible: string; spoken: string; app: string } {
  const app = macBinding(window.role).title;
  if (window.role === 'files') {
    const folder = FOLDER_TITLES[finderPlace(currentLocation(window)).folder];
    return { visible: folder, spoken: `Finder — ${folder}`, app };
  }
  return { visible: app, spoken: app, app };
}

/** "Finder — Experience" style label for a window (Dock tiles, the compact window switcher). */
export function windowLabel(window: WindowInstance): string {
  const ref = refForLocation('macos', window.role, currentLocation(window), OS_REGISTRY);
  const app = macBinding(window.role).title;
  if (window.role === 'files') return `${app} — ${windowTitle(window).visible}`;
  const place = ref ? (getIndexEntry(ref)?.title ?? SECTION_TITLES[ref.section]) : null;
  return place && place !== app ? `${app} — ${place}` : app;
}
