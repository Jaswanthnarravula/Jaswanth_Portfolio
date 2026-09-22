/**
 * Windows 11 view model — pure helpers the shell, taskbar, Start and apps share (unit-tested without a DOM). Geometry
 * comes from the kernel's own functions (the DOM never disagrees with what the kernel clamps and stores); titles,
 * places and shortcuts come from the registry and the selectors — no career fact is typed here (north-star B9).
 */
import { SECTION_TITLES } from '@/data/content-index';
import type { ContentRef } from '@/data/schema';
import {
  getCurrentRole,
  getFeaturedProjects,
  getIndexEntry,
  getPerson,
  getProjects,
  getResume,
} from '@/data/selectors';
import type { KernelAction } from '@/lib/kernel/actions';
import { snapRect, workspaceFor, type Workspace } from '@/lib/kernel/geometry';
import type { AppRole } from '@/lib/kernel/ids';
import { getBinding, OS_REGISTRY, WINDOWS_CHROME, windowsInsets } from '@/lib/kernel/registry';
import { currentRect } from '@/lib/kernel/reducers/windows';
import { refForLocation } from '@/lib/kernel/route/codec';
import { currentLocation } from '@/lib/kernel/state';
import type {
  AppLocation,
  OsAppBinding,
  OsSession,
  PxRect,
  SnapZone,
  Viewport,
  WindowId,
  WindowInstance,
} from '@/lib/kernel/types';
import { formatUpdated } from '@/components/content';
import type { KernelTarget } from '@/components/shell/KernelLink';

// --- Registry ------------------------------------------------------------------------------------------------------

/** Windows file names cannot contain `\ / : * ? " < > |` and never end in a dot or a space. */
export const fileSafe = (name: string): string =>
  name
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/[. ]+$/, '')
    .trim();

/** The profile folder's name (`C:\Users\{name}`), from the person's given name. */
export const userFolder = (): string => fileSafe(getPerson().givenName) || 'User';

export const userRoot = (): string => `C:\\Users\\${userFolder()}`;

/** Pinned taskbar apps, left → right, as the storyboard frame orders them (plans/windows/01-identity "Visual target"). */
export const TASKBAR_ORDER: readonly AppRole[] = [
  'files',
  'browser',
  'github',
  'mail',
  'editor',
  'terminal',
  'settings',
];

export const winBinding = (role: AppRole): OsAppBinding => {
  const binding = getBinding('windows', role);
  if (!binding) throw new Error(`Windows has no ${role} app`);
  return binding;
};

export const winId = (role: AppRole): WindowId => `windows:${role}` as WindowId;

/** The taskbar button element id for an app (the open flight's origin, the minimize flight's target). */
export const taskbarButtonId = (role: AppRole) => `tb-${winBinding(role).slug}`;
export const RESUME_BUTTON_ID = 'tb-resume';

// --- Geometry ------------------------------------------------------------------------------------------------------

export const taskbarHeight = (viewport: Viewport): number => windowsInsets(viewport).bottom;

/** The window workspace: the page above the taskbar. */
export const winWorkspace = (viewport: Viewport): Workspace => workspaceFor(viewport, windowsInsets(viewport));

/** The rect a floating window keeps in its bucket (its pre-snap / restore rect), as the kernel computes and clamps it. */
export function floatingRect(
  window: WindowInstance,
  viewport: Viewport,
  learned?: Partial<Record<Viewport['sizeClass'], PxRect>>,
): PxRect {
  return currentRect(window, winBinding(window.role), viewport.sizeClass, viewport, learned, windowsInsets(viewport));
}

/** The rect a window shows: the workspace when maximized, its zone when snapped, else its floating rect. */
export function shownRect(
  window: WindowInstance,
  viewport: Viewport,
  learned?: Partial<Record<Viewport['sizeClass'], PxRect>>,
): PxRect {
  const { phase } = window;
  const workspace = winWorkspace(viewport);
  if (phase.s === 'maximized' || (phase.s === 'minimized' && phase.wasMaximized)) return { ...workspace };
  if (window.snap) return snapRect(window.snap.zone, workspace, window.snap.split);
  return floatingRect(window, viewport, learned);
}

/** Maximized and snapped windows square their corners and drop the shadow (plans/windows/01 `WIN-ID-05`). */
export const isSquared = (window: WindowInstance): boolean =>
  window.phase.s === 'maximized' || (window.phase.s !== 'minimized' && !!window.snap);

/** CSS custom properties for the chrome, written from the kernel's numbers (one source of truth). */
export function chromeVars(viewport: Viewport): Record<string, string> {
  return {
    '--tb-h': `${taskbarHeight(viewport)}px`,
    '--tb-h-base': `${WINDOWS_CHROME.taskbar.base}px`,
  };
}

// --- Places --------------------------------------------------------------------------------------------------------

export type ExplorerFolder = 'home' | 'experience' | 'education';

export function explorerPlace(location: AppLocation): { folder: ExplorerFolder; slug: string | null } {
  if (location.kind !== 'content') return { folder: 'home', slug: null };
  const { ref } = location;
  if (ref.section !== 'experience' && ref.section !== 'education') return { folder: 'home', slug: null };
  return { folder: ref.section, slug: 'slug' in ref && ref.slug ? ref.slug : null };
}

export const FOLDER_TITLES: Readonly<Record<ExplorerFolder, string>> = {
  home: 'Home',
  experience: SECTION_TITLES.experience,
  education: SECTION_TITLES.education,
};

export type EdgeTab = 'about' | 'resume';
export const edgeTab = (location: AppLocation): EdgeTab =>
  location.kind === 'content' && location.ref.section === 'resume' ? 'resume' : 'about';

export const EDGE_TAB_TITLES: Readonly<Record<EdgeTab, string>> = {
  about: `About ${getPerson().givenName}`,
  resume: 'Résumé.pdf',
};

/**
 * A window's title: File Explorer names its folder, Edge its tab (as the real apps do), others themselves. `spoken`
 * prefixes the app so a screen reader always knows which window it is in.
 */
export function windowTitle(window: WindowInstance): { visible: string; spoken: string; app: string } {
  const app = winBinding(window.role).title;
  const location = currentLocation(window);
  if (window.role === 'files') {
    const folder = FOLDER_TITLES[explorerPlace(location).folder];
    return { visible: folder, spoken: `${app} — ${folder}`, app };
  }
  if (window.role === 'browser') {
    const tab = EDGE_TAB_TITLES[edgeTab(location)];
    return { visible: tab, spoken: `${app} — ${tab}`, app };
  }
  return { visible: app, spoken: app, app };
}

/** "File Explorer — Experience" style label for a window (taskbar previews, Task View, jump lists). */
export function windowLabel(window: WindowInstance): string {
  const app = winBinding(window.role).title;
  if (window.role === 'files' || window.role === 'browser') return windowTitle(window).spoken;
  const ref = refForLocation('windows', window.role, currentLocation(window), OS_REGISTRY);
  const place = ref ? (getIndexEntry(ref)?.title ?? SECTION_TITLES[ref.section]) : null;
  return place && place !== app ? `${app} — ${place}` : app;
}

// --- Taskbar (plans/windows/surfaces/taskbar + 02 `WIN-WM-08`) -----------------------------------------------------

export type TaskbarDecision = 'open' | 'restore' | 'focus' | 'minimize';

/** The taskbar click decision table: not running → open · minimized → restore · behind → focus · active → minimize. */
export function taskbarDecision(session: OsSession, role: AppRole): TaskbarDecision {
  const window = session.windows[winId(role)];
  if (!window || window.phase.s === 'closing') return 'open';
  if (window.phase.s === 'minimized') return 'restore';
  return session.focused === window.id ? 'minimize' : 'focus';
}

/**
 * The kernel actions for a taskbar click. A click during the open animation settles the open first, so ten rapid
 * clicks alternate deterministically (plans/windows/06 E1).
 */
export function taskbarActions(
  session: OsSession,
  role: AppRole,
  { originId, invoker }: { originId: string; invoker: string },
): readonly KernelAction[] {
  const id = winId(role);
  switch (taskbarDecision(session, role)) {
    case 'open':
      return [{ type: 'OPEN_APP', os: 'windows', role, originId, invoker }];
    case 'restore':
      return [{ type: 'RESTORE', id }];
    case 'focus':
      return [{ type: 'FOCUS_WINDOW', id }];
    case 'minimize':
      return session.windows[id]?.phase.s === 'opening'
        ? [
            { type: 'PHASE_DONE', target: { kind: 'window', id } },
            { type: 'MINIMIZE', id },
          ]
        : [{ type: 'MINIMIZE', id }];
  }
}

/** Indicator pill: none (not running) · running (6 × 3 grey) · active (16 × 3 accent). Minimized apps stay running. */
export type Pill = 'none' | 'running' | 'active';

export function pillFor(session: OsSession, role: AppRole): Pill {
  const window = session.windows[winId(role)];
  if (!window || window.phase.s === 'closing') return 'none';
  return session.focused === window.id && window.phase.s !== 'minimized' ? 'active' : 'running';
}

/** Accessible name suffix: ", running" / ", active, press to minimize" (plans/windows/surfaces/taskbar). */
export function pillSuffix(pill: Pill, minimized: boolean): string {
  if (pill === 'active') return ', active, press to minimize';
  if (pill === 'running') return minimized ? ', running, minimized' : ', running';
  return '';
}

/** Taskbar apps: pinned in order, then running-but-unpinned ones (none today: every Windows app is pinned). */
export function taskbarApps(session: OsSession): readonly AppRole[] {
  const pinned = TASKBAR_ORDER.filter((role) => winBinding(role).pinned);
  const running = OS_REGISTRY.windows.apps
    .map((binding) => binding.role)
    .filter((role) => !pinned.includes(role) && pillFor(session, role) !== 'none');
  return [...pinned, ...running];
}

// --- Jump lists (`WIN-TASK-04`) --------------------------------------------------------------------------------------

export interface JumpItem {
  readonly id: string;
  readonly label: string;
  readonly to: KernelTarget;
}

/** App-specific tasks, from data (GitHub → the featured projects; Explorer → Experience, Education; …). */
export function jumpList(role: AppRole): { readonly heading: string; readonly items: readonly JumpItem[] } {
  switch (role) {
    case 'files':
      return {
        heading: 'Pinned',
        items: (['experience', 'education'] as const).map((section) => ({
          id: section,
          label: SECTION_TITLES[section],
          to: { os: 'windows', ref: { section } },
        })),
      };
    case 'browser':
      return {
        heading: 'Tabs',
        items: [
          { id: 'about', label: EDGE_TAB_TITLES.about, to: { os: 'windows', role: 'browser' } },
          { id: 'resume', label: EDGE_TAB_TITLES.resume, to: { os: 'windows', ref: { section: 'resume' } } },
        ],
      };
    case 'github':
      return {
        heading: 'Pinned repositories',
        items: getFeaturedProjects().map((project) => ({
          id: project.slug,
          label: project.name,
          to: { os: 'windows', ref: { section: 'projects', slug: project.slug } },
        })),
      };
    case 'mail':
      return { heading: 'Tasks', items: [{ id: 'inbox', label: 'Inbox', to: { os: 'windows', role: 'mail' } }] };
    case 'editor':
      return {
        heading: 'Recent',
        items: [{ id: 'workspace', label: 'jaswanth-portfolio', to: { os: 'windows', role: 'editor' } }],
      };
    case 'terminal':
      return {
        heading: 'Profiles',
        items: [{ id: 'powershell', label: 'Windows PowerShell', to: { os: 'windows', role: 'terminal' } }],
      };
    default:
      return {
        heading: 'Tasks',
        items: [{ id: 'open', label: winBinding(role).title, to: { os: 'windows', role } }],
      };
  }
}

// --- Start (plans/windows/surfaces/start-menu `WIN-START-02`) ------------------------------------------------------

export interface StartTile {
  readonly id: string;
  readonly label: string;
  readonly to: KernelTarget;
  /** App tiles show the app icon; shortcut tiles show a document or folder. */
  readonly kind: 'app' | 'pdf' | 'folder' | 'shortcut';
  readonly role?: AppRole;
}

/** Pinned: every Windows app, then the shortcuts Résumé, Projects, Experience, Contact. */
export function startPinned(): readonly StartTile[] {
  const apps: StartTile[] = OS_REGISTRY.windows.apps.map((binding) => ({
    id: `app-${binding.slug}`,
    label: binding.title,
    to: { os: 'windows', role: binding.role },
    kind: 'app',
    role: binding.role,
  }));
  const shortcut = (section: ContentRef['section'], kind: StartTile['kind'], label?: string): StartTile => ({
    id: `pin-${section}`,
    label: label ?? SECTION_TITLES[section],
    to: { os: 'windows', ref: { section } as ContentRef },
    kind,
  });
  return [
    ...apps,
    shortcut('resume', 'pdf', 'Résumé'),
    shortcut('projects', 'shortcut'),
    shortcut('experience', 'folder'),
    shortcut('contact', 'shortcut'),
  ];
}

export interface Recommended {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly to: KernelTarget;
  readonly kind: 'pdf' | 'project' | 'role' | 'mail';
}

/** Recommended (2 × 3): Résumé.pdf, the featured projects ("Recently added"), the current role, "Say hello". */
export function startRecommended(): readonly Recommended[] {
  const resume = getResume();
  const items: Recommended[] = [
    {
      id: 'resume',
      title: 'Résumé.pdf',
      detail: `Updated ${formatUpdated(resume.updated)}`,
      to: { os: 'windows', ref: { section: 'resume' } },
      kind: 'pdf',
    },
  ];
  for (const project of getFeaturedProjects().slice(0, 3))
    items.push({
      id: `project-${project.slug}`,
      title: project.name,
      detail: 'Recently added',
      to: { os: 'windows', ref: { section: 'projects', slug: project.slug } },
      kind: 'project',
    });
  const role = getCurrentRole();
  if (role)
    items.push({
      id: `role-${role.slug}`,
      title: role.role ? `${role.role} — ${role.company}` : role.company,
      detail: 'Most used',
      to: { os: 'windows', ref: { section: 'experience', slug: role.slug } },
      kind: 'role',
    });
  items.push({
    id: 'hello',
    title: 'Say hello',
    detail: getPerson().openTo,
    to: { os: 'windows', ref: { section: 'contact' } },
    kind: 'mail',
  });
  return items.slice(0, 6);
}

/** All apps, alphabetical, grouped by first letter (the All apps view). */
export function allApps(): readonly { readonly letter: string; readonly apps: readonly OsAppBinding[] }[] {
  const sorted = [...OS_REGISTRY.windows.apps].sort((a, b) => a.title.localeCompare(b.title));
  const groups = new Map<string, OsAppBinding[]>();
  for (const binding of sorted) {
    const letter = binding.title[0]!.toUpperCase();
    groups.set(letter, [...(groups.get(letter) ?? []), binding]);
  }
  return [...groups].map(([letter, apps]) => ({ letter, apps }));
}

export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase())
    .slice(0, 2)
    .join('');

// --- Lock screen (`WIN-LOCK-01`) ----------------------------------------------------------------------------------

export interface LockCard {
  readonly id: string;
  readonly app: AppRole;
  readonly title: string;
  readonly body: string;
  readonly to: KernelTarget;
}

/** Up to three status cards from data; a continuity offer replaces the third (plans/windows/07). */
export function lockCards(
  offer: { readonly ref: ContentRef; readonly title: string; readonly from: string } | null,
): readonly LockCard[] {
  const resume = getResume();
  const projects = getProjects();
  const featured = getFeaturedProjects()[0] ?? projects[0];
  const cards: LockCard[] = [
    {
      id: 'resume',
      app: 'browser',
      title: 'Résumé ready to view',
      body: `Updated ${formatUpdated(resume.updated)}`,
      to: { os: 'windows', ref: { section: 'resume' } },
    },
  ];
  if (projects.length)
    cards.push({
      id: 'projects',
      app: 'github',
      title: `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`,
      body: featured?.name ?? '',
      to: { os: 'windows', role: 'github' },
    });
  cards.push(
    offer
      ? {
          id: 'continuity',
          app: OS_REGISTRY.windows.sectionOwner[offer.ref.section],
          title: `Continue from ${offer.from}`,
          body: offer.title,
          to: { os: 'windows', ref: offer.ref },
        }
      : {
          id: 'contact',
          app: 'mail',
          title: getPerson().openTo,
          body: 'Say hello',
          to: { os: 'windows', role: 'mail' },
        },
  );
  return cards;
}

// --- Transient surfaces (plans/windows/06 E20; 01 `WIN-ID-03`) ------------------------------------------------------

/** One panel at a time: Start/Search share a footprint; Task View; the tray flyouts; the compact combined sheet. */
export type Panel = 'start' | 'search' | 'taskview' | 'quick' | 'center' | 'combined';

/** Arbiter priority, highest first: modal dialog › menu › Start/Search › Task View › flyout › toast. */
export const SURFACE_PRIORITY = ['dialog', 'menu', 'launcher', 'taskview', 'flyout', 'toast'] as const;
export type SurfaceKind = (typeof SURFACE_PRIORITY)[number];

export const panelKind = (panel: Panel): SurfaceKind =>
  panel === 'start' || panel === 'search' ? 'launcher' : panel === 'taskview' ? 'taskview' : 'flyout';

/**
 * A toast pops up only when nothing above it in the arbiter is open (it is queued otherwise) and never over the
 * Notification Center, which receives it directly in its list (plans/windows/surfaces/notification-center).
 */
export function toastMayShow(open: {
  panel: Panel | null;
  menu: boolean;
  dialog: boolean;
  dragging: boolean;
}): boolean {
  if (open.dialog || open.menu || open.dragging) return false;
  return open.panel === null || open.panel === 'quick';
}

/**
 * The live blur budget (≤ 3 `backdrop-filter` surfaces — shared/06): the taskbar always, then transient surfaces in
 * arbiter order; the rest fall back to their Acrylic tint. Returns the surfaces allowed a live blur.
 */
export function liveAcrylic(open: {
  readonly menu: boolean;
  readonly panel: Panel | null;
  readonly toast: boolean;
  readonly terminal: boolean;
  readonly lock: boolean;
}): ReadonlySet<'taskbar' | 'menu' | 'panel' | 'toast' | 'terminal' | 'lock'> {
  const order: ('taskbar' | 'menu' | 'panel' | 'toast' | 'terminal' | 'lock')[] = [];
  if (open.lock) order.push('lock');
  else order.push('taskbar');
  if (open.menu) order.push('menu');
  if (open.panel) order.push('panel');
  if (open.toast) order.push('toast');
  if (open.terminal) order.push('terminal');
  return new Set(order.slice(0, 3));
}

// --- Keyboard Snap (plans/windows/02 "Keyboard": Alt+Shift+Arrow mirrors Win+Arrow) --------------------------------

export type SnapDirection = 'left' | 'right' | 'up' | 'down';

/**
 * What Alt+Shift+Arrow does to a window — Windows' own Win+Arrow table: Left/Right snap to that half (from the
 * opposite half they restore first; quarters move sideways), Up turns a half into its top quarter and a float into a
 * maximized window, Down restores a maximized window, turns a half into its bottom quarter, a top quarter back into its
 * half, and minimizes a floating window ("restore, then minimize").
 */
export function keyboardSnap(window: WindowInstance, direction: SnapDirection): readonly KernelAction[] {
  const id = window.id;
  const zone = window.phase.s === 'maximized' ? 'max' : (window.snap?.zone ?? null);
  const snap = (to: SnapZone | null): KernelAction => ({ type: 'SNAP_WINDOW', id, zone: to });
  switch (direction) {
    case 'left':
      if (zone === 'right') return [snap(null)];
      if (zone === 'tr') return [snap('tl')];
      if (zone === 'br') return [snap('bl')];
      if (zone === 'left' || zone === 'tl' || zone === 'bl') return [];
      return [snap('left')];
    case 'right':
      if (zone === 'left') return [snap(null)];
      if (zone === 'tl') return [snap('tr')];
      if (zone === 'bl') return [snap('br')];
      if (zone === 'right' || zone === 'tr' || zone === 'br') return [];
      return [snap('right')];
    case 'up':
      if (zone === 'left') return [snap('tl')];
      if (zone === 'right') return [snap('tr')];
      if (zone === 'bl') return [snap('left')];
      if (zone === 'br') return [snap('right')];
      if (zone === 'max') return [];
      return [{ type: 'TOGGLE_MAXIMIZE', id }];
    case 'down':
      if (zone === 'max') return [{ type: 'TOGGLE_MAXIMIZE', id }];
      if (zone === 'left') return [snap('bl')];
      if (zone === 'right') return [snap('br')];
      if (zone === 'tl') return [snap('left')];
      if (zone === 'tr') return [snap('right')];
      return [{ type: 'MINIMIZE', id }];
  }
}
