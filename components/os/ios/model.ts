/**
 * iOS model — pure, React-free decisions the shell and its tests share (plans/ios/). Nothing here touches the DOM.
 *   · the app catalogue (role → binding, launch colour, status-bar style) and the Dock;
 *   · the Home Screen configuration (apps, the Career folder, widgets, page-2 shortcuts) and the deterministic packer
 *     that lays it out for the phone and full-page layouts (`IOS-HOME-01`, `IOS-HOME-06`, `IOS-HOME-07`);
 *   · badges, quick actions, lock-screen notifications, banner triggers, Spotlight's zero state — all from data;
 *   · gesture decisions (velocity projection, Home / cancel / App Switcher) and the overlay arbiter table.
 * Portfolio facts arrive as arguments (from `data/selectors` in the shell), never typed here (north-star B9).
 */
import type { ContentRef, Experience, Project } from '@/data/schema';
import { arbitrate, type ArbiterTable, type Verdict } from '@/components/os/shared/overlay-arbiter';
import type { AppRole, SizeClass } from '@/lib/kernel/ids';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import { windowId, type AppLocation, type OsAppBinding, type Viewport, type WindowId } from '@/lib/kernel/types';

// --- Apps ------------------------------------------------------------------------------------------------------------

export type IosRole = 'browser' | 'github' | 'files' | 'notes' | 'mail' | 'messages' | 'settings';
export const IOS_ROLES: readonly IosRole[] = ['browser', 'github', 'files', 'notes', 'mail', 'messages', 'settings'];

export const iosBinding = (role: AppRole): OsAppBinding => {
  const binding = OS_REGISTRY.ios.apps.find((candidate) => candidate.role === role);
  if (!binding) throw new Error(`iOS has no ${role} app`);
  return binding;
};
export const iosId = (role: AppRole): WindowId => windowId('ios', role);
export const iconAsset = (role: AppRole) => `app.ios.${iosBinding(role).slug}`;

/**
 * Launch placeholders (plans/ios/02 step 1): each app's launch colour — the colour of its first screen — shown at once
 * behind the icon while the app's chunk arrives, so the flight never waits.
 */
export const LAUNCH_COLOR: Readonly<Record<IosRole, { light: string; dark: string }>> = {
  browser: { light: '#ffffff', dark: '#1c1c1e' },
  github: { light: '#f2f2f7', dark: '#000000' },
  files: { light: '#f2f2f7', dark: '#000000' },
  notes: { light: '#f2f2f7', dark: '#000000' },
  mail: { light: '#ffffff', dark: '#000000' },
  messages: { light: '#ffffff', dark: '#000000' },
  settings: { light: '#f2f2f7', dark: '#000000' },
};

/** Status-bar style each app declares (plans/ios/surfaces/status-bar "adapts to the content under it"). */
export type StatusStyle = 'light' | 'dark';
export const APP_STATUS_STYLE: Readonly<Record<IosRole, 'auto'>> = {
  browser: 'auto',
  github: 'auto',
  files: 'auto',
  notes: 'auto',
  mail: 'auto',
  messages: 'auto',
  settings: 'auto',
};
/** Light content (white glyphs) over the wallpaper; over an app: dark glyphs in light mode, light in dark mode. */
export const statusStyleFor = (app: IosRole | null, dark: boolean): StatusStyle =>
  app === null ? 'light' : dark ? 'light' : 'dark';

/** The Dock: four fixed apps (plans/ios/surfaces/dock). Files opens straight to the résumé (`RES-IDIOM-01`). */
export const DOCK: readonly IosRole[] = ['files', 'browser', 'github', 'mail'];
/** Where each Dock icon opens (Files → Quick Look résumé; the rest → their root). */
export const dockLocation = (role: IosRole): AppLocation | undefined =>
  role === 'files' ? { kind: 'content', ref: { section: 'resume' } } : undefined;
/** Up to three recent apps on the full-page Dock (the warm set minus the pinned four). */
export function dockRecents(warmMostRecentFirst: readonly AppRole[]): readonly IosRole[] {
  return warmMostRecentFirst
    .filter(
      (role): role is IosRole => (IOS_ROLES as readonly string[]).includes(role) && !DOCK.includes(role as IosRole),
    )
    .slice(0, 3);
}

// --- Home Screen configuration ---------------------------------------------------------------------------------------

export type WidgetId = 'resume' | 'open-to-work' | 'now' | 'projects';
export type ShortcutId = 'about' | 'projects' | 'contact';

export type HomeItem =
  | { readonly kind: 'app'; readonly id: `app:${IosRole}`; readonly role: IosRole }
  | { readonly kind: 'folder'; readonly id: 'folder:career' }
  | { readonly kind: 'widget'; readonly id: `widget:${WidgetId}`; readonly widget: WidgetId }
  | { readonly kind: 'shortcut'; readonly id: `shortcut:${ShortcutId}`; readonly shortcut: ShortcutId };

const appItem = (role: IosRole): HomeItem => ({ kind: 'app', id: `app:${role}`, role });
const widget = (id: WidgetId): HomeItem => ({ kind: 'widget', id: `widget:${id}`, widget: id });
const shortcut = (id: ShortcutId): HomeItem => ({ kind: 'shortcut', id: `shortcut:${id}`, shortcut: id });

/**
 * The configured Home Screen (plans/ios/README "Home Screen page 1/2"; icon order from the owner's frame
 * `ios-home.png`: Safari · GitHub · Notes · Messages · Settings · Career). Page 2 proves paging without hiding anything
 * essential: the two small widgets (phone) and shortcuts to About, Projects and Contact.
 */
export const HOME_APPS: readonly HomeItem[] = [
  appItem('browser'),
  appItem('github'),
  appItem('notes'),
  appItem('messages'),
  appItem('settings'),
  { kind: 'folder', id: 'folder:career' },
];
export const HOME_SHORTCUTS: readonly HomeItem[] = [shortcut('about'), shortcut('projects'), shortcut('contact')];

export const SHORTCUT_TARGET: Readonly<Record<ShortcutId, { readonly label: string; readonly ref: ContentRef }>> = {
  about: { label: 'About', ref: { section: 'about' } },
  projects: { label: 'Projects', ref: { section: 'projects' } },
  contact: { label: 'Contact', ref: { section: 'contact' } },
};

// --- Layout ------------------------------------------------------------------------------------------------------------

export type IosLayout = 'phone' | 'pad';

/** Phone = the compact size class (the visitor's phone *is* the iPhone); everything larger is the full-page iPadOS
 * layout (plans/ios/04 "Two layouts, one DOM, both full page"). Never a frame. */
export const layoutFor = (sizeClass: SizeClass): IosLayout => (sizeClass === 'compact' ? 'phone' : 'pad');

/** Full-page grid columns by size class (plans/ios/04): 6 / 7 / 8; the widgets block spans the leading two. */
export const PAD_COLUMNS: Readonly<Record<Exclude<SizeClass, 'compact'>, number>> = {
  medium: 6,
  expanded: 7,
  large: 8,
};
export const PAD_WIDGET_COLUMNS = 2;

/** Full-page icon size: `clamp(64px, 8.4vh, 96px)` (plans/ios/01 "Icon grid"). Phone: 60 pt. */
export function iconSize(viewport: Pick<Viewport, 'w' | 'h' | 'sizeClass'>): number {
  if (viewport.sizeClass === 'compact') return 60;
  return Math.round(Math.min(96, Math.max(64, viewport.h * 0.084)));
}

export interface Placed {
  readonly item: HomeItem;
  /** Cell coordinates within its page. */
  readonly col: number;
  readonly row: number;
  readonly w: number;
  readonly h: number;
}

export interface HomePage {
  readonly index: number;
  readonly items: readonly Placed[];
  /** The full-page widgets block lives on page 1 beside the grid. */
  readonly widgetsBlock: boolean;
}

export interface HomeLayout {
  readonly layout: IosLayout;
  readonly landscape: boolean;
  readonly columns: number;
  readonly rows: number;
  readonly icon: number;
  readonly pages: readonly HomePage[];
  /** Where the Dock sits: along the bottom, or on the trailing edge (phone landscape). */
  readonly dock: 'bottom' | 'trailing';
}

export interface HomeData {
  /** A featured project exists (else the Projects widget is omitted and its cells return to icons). */
  readonly hasProject: boolean;
  /** A Now note exists (`IOS-WIDG-05`, shared/23) — else no Now widget. */
  readonly hasNow?: boolean;
}

/** Cell size of a widget: medium 4 × 2 (3 × 2 in phone landscape), small 2 × 2 (plans/ios/surfaces/widgets). */
function cellsOf(item: HomeItem, landscape: boolean): { w: number; h: number } {
  if (item.kind !== 'widget') return { w: 1, h: 1 };
  if (item.widget === 'resume') return landscape ? { w: 3, h: 2 } : { w: 4, h: 2 };
  return { w: 2, h: 2 };
}

/**
 * Deterministic first-fit packing, row-major, page after page (plans/ios/surfaces/home-screen "overflow moves to page
 * 2 deterministically"). Each `sequence` starts a new page; items that do not fit flow onto the next.
 */
export function pack(
  sequences: readonly (readonly HomeItem[])[],
  columns: number,
  rows: number,
  landscape: boolean,
  widgetsBlockOnFirst = false,
): HomePage[] {
  const pages: { items: Placed[]; used: boolean[][] }[] = [];
  const newPage = () => {
    const page = {
      items: [] as Placed[],
      used: Array.from({ length: rows }, () => Array<boolean>(columns).fill(false)),
    };
    pages.push(page);
    return page;
  };
  const fits = (used: boolean[][], col: number, row: number, w: number, h: number) => {
    if (col + w > columns || row + h > rows) return false;
    for (let y = row; y < row + h; y++) for (let x = col; x < col + w; x++) if (used[y]![x]) return false;
    return true;
  };
  const place = (page: { items: Placed[]; used: boolean[][] }, item: HomeItem): boolean => {
    const { w, h } = cellsOf(item, landscape);
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < columns; col++)
        if (fits(page.used, col, row, w, h)) {
          for (let y = row; y < row + h; y++) for (let x = col; x < col + w; x++) page.used[y]![x] = true;
          page.items.push({ item, col, row, w, h });
          return true;
        }
    return false;
  };
  for (const sequence of sequences) {
    if (sequence.length === 0) continue;
    let page = newPage();
    for (const item of sequence) {
      if (place(page, item)) continue;
      page = newPage();
      if (!place(page, item)) throw new Error(`Home item ${item.id} cannot fit a ${columns} × ${rows} page`);
    }
  }
  return pages.map((page, index) => ({ index, items: page.items, widgetsBlock: widgetsBlockOnFirst && index === 0 }));
}

/** Label + gap under a full-page icon (13 px label, row gap) — the height one grid row needs besides the icon. */
const PAD_ROW_EXTRA = 44;
/** Status bar (24) + top inset, the Dock, the search pill and the home indicator the grid leaves free. */
const PAD_CHROME = { top: 64, bottom: 196 } as const;

/** Rows that fit the full page's height: 4–5 (plans/ios/04 "rows fit the height"). */
export function padRows(viewport: Pick<Viewport, 'h' | 'sizeClass' | 'w'>): number {
  const icon = iconSize(viewport);
  const free = viewport.h - PAD_CHROME.top - PAD_CHROME.bottom;
  return Math.max(4, Math.min(5, Math.floor(free / (icon + PAD_ROW_EXTRA))));
}

export function homeLayout(viewport: Viewport, data: HomeData): HomeLayout {
  const layout = layoutFor(viewport.sizeClass);
  const landscape = viewport.orientation === 'landscape';
  const icon = iconSize(viewport);
  const smallWidgets = [
    widget('open-to-work'),
    ...(data.hasNow ? [widget('now')] : []),
    ...(data.hasProject ? [widget('projects')] : []),
  ];
  if (layout === 'phone') {
    // Portrait 4 × 6 (5 on very short screens); landscape 6 × 3 with the Dock on the trailing edge.
    const columns = landscape ? 6 : 4;
    const rows = landscape ? 3 : viewport.h < 640 ? 5 : 6;
    const pages = pack(
      [
        [widget('resume'), ...HOME_APPS],
        [...smallWidgets, ...HOME_SHORTCUTS],
      ],
      columns,
      rows,
      landscape,
    );
    return { layout, landscape, columns, rows, icon, pages, dock: landscape ? 'trailing' : 'bottom' };
  }
  const total = PAD_COLUMNS[viewport.sizeClass as Exclude<SizeClass, 'compact'>];
  // Portrait tablets: the same layout re-flowed — fewer columns, more rows.
  const columns = landscape ? total - PAD_WIDGET_COLUMNS : Math.max(3, total - PAD_WIDGET_COLUMNS - 1);
  const rows = landscape ? padRows(viewport) : padRows(viewport) + 1;
  const pages = pack([HOME_APPS, HOME_SHORTCUTS], columns, rows, true, true);
  return { layout, landscape, columns, rows, icon, pages, dock: 'bottom' };
}

/** The page holding an item (page memory is by icon, not by number — plans/ios/surfaces/home-screen "Edge cases"). */
export function pageOf(layout: HomeLayout, itemId: string): number | null {
  for (const page of layout.pages) if (page.items.some((placed) => placed.item.id === itemId)) return page.index;
  if (layout.layout === 'pad' && itemId.startsWith('widget:')) return 0;
  return null;
}

/** Where each role lives on the Home Screen (the grid icon, else the Career folder, else the Dock only). */
export function homeItemFor(role: AppRole): string | null {
  if (HOME_APPS.some((item) => item.kind === 'app' && item.role === role)) return `app:${role}`;
  return null;
}

// --- Career folder -----------------------------------------------------------------------------------------------------

export interface FolderShortcut {
  readonly id: string;
  readonly label: string;
  readonly ref: ContentRef;
  /** Symbol drawn on the generated shortcut icon. */
  readonly symbol: 'briefcase' | 'graduation' | 'document' | 'person';
  readonly tint: readonly [string, string];
}

/**
 * The Career folder's shortcuts (plans/ios/surfaces/folders): Experience · Education · Résumé · one per current /
 * most-recent role (max 2). A role whose data is gone is simply absent.
 */
export function careerShortcuts(roles: readonly Experience[]): readonly FolderShortcut[] {
  const roleShortcuts = roles.slice(0, 2).map<FolderShortcut>((role) => ({
    id: `role:${role.slug}`,
    label: role.company,
    ref: { section: 'experience', slug: role.slug },
    symbol: 'person',
    tint: ['#5ac8fa', '#0a84ff'],
  }));
  return [
    {
      id: 'experience',
      label: 'Experience',
      ref: { section: 'experience' },
      symbol: 'briefcase',
      tint: ['#6fb6ff', '#1f6fe5'],
    },
    {
      id: 'education',
      label: 'Education',
      ref: { section: 'education' },
      symbol: 'graduation',
      tint: ['#b28cff', '#6a3fe0'],
    },
    { id: 'resume', label: 'Résumé', ref: { section: 'resume' }, symbol: 'document', tint: ['#ff9f6b', '#ff5e3a'] },
    ...roleShortcuts,
  ];
}

export const folderName = (shortcuts: readonly FolderShortcut[]) =>
  `Career folder, ${shortcuts.length} ${shortcuts.length === 1 ? 'shortcut' : 'shortcuts'}`;

// --- Badges -------------------------------------------------------------------------------------------------------------

/** Mail "1" (the unread "Let's talk", cleared once read this session); GitHub = the number of featured projects. */
export function badgeFor(role: AppRole, input: { mailRead: boolean; featured: number }): number {
  if (role === 'mail') return input.mailRead ? 0 : 1;
  if (role === 'github') return input.featured;
  return 0;
}

/** Accessible name with the badge (plans/ios/05: "Mail, 1 unread"). */
export function iconName(title: string, role: AppRole, badge: number): string {
  if (badge <= 0) return title;
  if (role === 'mail') return `${title}, ${badge} unread`;
  return `${title}, ${badge} featured`;
}

// --- Quick actions (plans/ios/surfaces/quick-actions "Portfolio mapping") ---------------------------------------------

export type QuickCommand =
  | { readonly kind: 'open'; readonly role: IosRole; readonly location?: AppLocation }
  | { readonly kind: 'download-resume' }
  | { readonly kind: 'copy-address' }
  | { readonly kind: 'copy-link'; readonly ref: ContentRef }
  | { readonly kind: 'plain' }
  | { readonly kind: 'switch-os' }
  | { readonly kind: 'compose' }
  | { readonly kind: 'say-hello' };

export interface QuickAction {
  readonly id: string;
  readonly label: string;
  readonly glyph:
    | 'doc'
    | 'download'
    | 'briefcase'
    | 'graduation'
    | 'repo'
    | 'grid'
    | 'compose'
    | 'copy'
    | 'hello'
    | 'safari'
    | 'plain'
    | 'note'
    | 'access'
    | 'switch'
    | 'link'
    | 'open';
  readonly command: QuickCommand;
}

const content = (ref: ContentRef): AppLocation => ({ kind: 'content', ref });

export interface QuickData {
  readonly featured: readonly Pick<Project, 'slug' | 'name'>[];
  readonly pinnedNotes: readonly { readonly id: string; readonly title: string }[];
  readonly hasPdf: boolean;
}

export function quickActionsFor(role: IosRole, data: QuickData): readonly QuickAction[] {
  switch (role) {
    case 'files':
      return [
        {
          id: 'open-resume',
          label: 'Open Résumé',
          glyph: 'doc',
          command: { kind: 'open', role: 'files', location: content({ section: 'resume' }) },
        },
        ...(data.hasPdf
          ? [
              {
                id: 'download-resume',
                label: 'Download Résumé',
                glyph: 'download' as const,
                command: { kind: 'download-resume' as const },
              },
            ]
          : []),
        {
          id: 'experience',
          label: 'Experience',
          glyph: 'briefcase',
          command: { kind: 'open', role: 'files', location: content({ section: 'experience' }) },
        },
        {
          id: 'education',
          label: 'Education',
          glyph: 'graduation',
          command: { kind: 'open', role: 'files', location: content({ section: 'education' }) },
        },
      ];
    case 'github':
      return [
        ...data.featured.slice(0, 4).map<QuickAction>((project) => ({
          id: `project:${project.slug}`,
          label: project.name,
          glyph: 'repo',
          command: { kind: 'open', role: 'github', location: content({ section: 'projects', slug: project.slug }) },
        })),
        { id: 'all-projects', label: 'All Projects', glyph: 'grid', command: { kind: 'open', role: 'github' } },
      ];
    case 'mail':
      return [
        { id: 'new-message', label: 'New Message', glyph: 'compose', command: { kind: 'compose' } },
        { id: 'copy-address', label: 'Copy Address', glyph: 'copy', command: { kind: 'copy-address' } },
      ];
    case 'messages':
      return [{ id: 'say-hello', label: 'Say hello', glyph: 'hello', command: { kind: 'say-hello' } }];
    case 'browser':
      return [
        { id: 'about', label: 'About Jaswanth', glyph: 'safari', command: { kind: 'open', role: 'browser' } },
        { id: 'plain', label: 'Open plain version', glyph: 'plain', command: { kind: 'plain' } },
      ];
    case 'notes':
      return [
        { id: 'skills', label: 'Skills', glyph: 'note', command: { kind: 'open', role: 'notes' } },
        ...data.pinnedNotes
          .filter((note) => note.id !== 'skills')
          .map<QuickAction>((note) => ({
            id: `note:${note.id}`,
            label: note.title,
            glyph: 'note',
            command: { kind: 'open', role: 'notes' },
          })),
      ];
    case 'settings':
      return [
        { id: 'accessibility', label: 'Accessibility', glyph: 'access', command: { kind: 'open', role: 'settings' } },
        { id: 'switch-os', label: 'Switch OS', glyph: 'switch', command: { kind: 'switch-os' } },
      ];
  }
}

/** Widgets' quick actions: Open · Download PDF · Copy link. */
export function widgetActions(target: ContentRef, open: QuickCommand, hasPdf: boolean): readonly QuickAction[] {
  return [
    { id: 'open', label: 'Open', glyph: 'open', command: open },
    ...(hasPdf && target.section === 'resume'
      ? [
          {
            id: 'download',
            label: 'Download PDF',
            glyph: 'download' as const,
            command: { kind: 'download-resume' as const },
          },
        ]
      : []),
    { id: 'copy-link', label: 'Copy link', glyph: 'link', command: { kind: 'copy-link', ref: target } },
  ];
}

// --- Lock Screen notifications (plans/ios/surfaces/lock-screen) -------------------------------------------------------

export interface LockNotification {
  readonly id: 'resume' | 'github' | 'mail' | 'continuity';
  readonly role: IosRole;
  readonly app: string;
  readonly title: string;
  readonly body: string;
  readonly location?: AppLocation;
}

export interface LockData {
  readonly updatedLabel: string;
  readonly projects: number;
  readonly featuredName: string | null;
  readonly openTo: string;
  readonly continuity: {
    readonly title: string;
    readonly from: string;
    readonly role: IosRole;
    readonly ref: ContentRef;
  } | null;
}

/** The notifications are identical for every visitor (`IOS-LOCK-05`); a continuity offer replaces #3. */
export function lockNotifications(data: LockData): readonly LockNotification[] {
  const list: LockNotification[] = [
    {
      id: 'resume',
      role: 'files',
      app: 'Files',
      title: 'Résumé ready to view',
      body: `Updated ${data.updatedLabel}`,
      location: content({ section: 'resume' }),
    },
  ];
  if (data.projects > 0)
    list.push({
      id: 'github',
      role: 'github',
      app: 'GitHub',
      title: `${data.projects} ${data.projects === 1 ? 'project' : 'projects'}`,
      body: data.featuredName ? `${data.featuredName} and more` : 'Open to browse',
    });
  if (data.continuity)
    list.push({
      id: 'continuity',
      role: data.continuity.role,
      app: 'Handoff',
      title: data.continuity.title,
      body: `From ${data.continuity.from}`,
      location: content(data.continuity.ref),
    });
  else list.push({ id: 'mail', role: 'mail', app: 'Mail', title: data.openTo, body: 'Say hello' });
  return list;
}

// --- Banners (plans/ios/surfaces/notifications "Trigger table") -------------------------------------------------------

export type BannerTrigger =
  | { readonly kind: 'welcome' }
  | { readonly kind: 'tour-offer' }
  | { readonly kind: 'handoff'; readonly title: string; readonly from: string; readonly role: IosRole }
  | { readonly kind: 'resume-saved' }
  | { readonly kind: 'copied'; readonly what?: string }
  | { readonly kind: 'offline' }
  | { readonly kind: 'online' };

export interface BannerCopy {
  readonly id: string;
  readonly app: string;
  readonly role: IosRole | null;
  readonly title: string;
  readonly body?: string;
}

/** Trigger → banner copy (`IOS-NOTIF-02`). The shell attaches the actions. */
export function bannerFor(trigger: BannerTrigger): BannerCopy {
  switch (trigger.kind) {
    case 'welcome':
      return { id: 'welcome', app: 'Tips', role: null, title: 'Welcome — tap any app.', body: 'Pull down to search.' };
    case 'tour-offer':
      return { id: 'tour-offer', app: 'Tips', role: null, title: 'New here? Take a 20-second tour.' };
    case 'handoff':
      return {
        id: 'handoff',
        app: 'Handoff',
        role: trigger.role,
        title: `Handoff · ${trigger.title}`,
        body: `From ${trigger.from}`,
      };
    case 'resume-saved':
      return { id: 'resume-saved', app: 'Files', role: 'files', title: 'Résumé.pdf saved' };
    case 'copied':
      return { id: `copied`, app: 'Clipboard', role: null, title: 'Copied', body: trigger.what };
    case 'offline':
      return { id: 'offline', app: 'Network', role: null, title: 'No connection — content still works' };
    case 'online':
      return { id: 'online', app: 'Network', role: null, title: 'Back online' };
  }
}

/** Banners dwell at least 6 s (plans/ios/surfaces/notifications), paused while pressed, hovered or focused. */
export const BANNER_DWELL_MS = 6000;
export const BANNER_QUEUE_MAX = 3;

// --- Gestures (plans/ios/03 "Spring table", 02 "Interactive Home gesture") --------------------------------------------

/** UIKit's projection with a 0.998 deceleration rate: `position + velocity (per second) × 0.499`. */
export const PROJECTION = 0.499;
export const project = (position: number, velocityPerSecond: number): number =>
  position + velocityPerSecond * PROJECTION;

/** Home gesture: past 35 % of the way (projected) → Home; a pause ≥ 250 ms under 50 pt/s → App Switcher. */
export const HOME_THRESHOLD = 0.35;
export const SWITCHER_PAUSE_MS = 250;
export const SWITCHER_PAUSE_SPEED = 50;
/** Bottom zone the Home gesture starts in (34 pt). */
export const HOME_ZONE_PT = 34;

export type HomeOutcome = 'home' | 'cancel' | 'switcher';

/**
 * @param travel   how far up the finger is, as a fraction of the distance that fully shrinks the app (0..1+)
 * @param velocity upward speed in that same unit per second
 * @param pausedMs how long the finger has rested (speed under the pause threshold) before release
 */
export function homeOutcome({
  travel,
  velocity,
  pausedMs,
  speedPx,
}: {
  travel: number;
  velocity: number;
  pausedMs: number;
  speedPx: number;
}): HomeOutcome {
  if (pausedMs >= SWITCHER_PAUSE_MS && speedPx < SWITCHER_PAUSE_SPEED && travel > 0.08) return 'switcher';
  return project(travel, velocity) >= HOME_THRESHOLD ? 'home' : 'cancel';
}

/** A pointer position with its event timestamp (`event.timeStamp`, the same clock as `performance.now()`). */
export interface PointerSample {
  readonly t: number;
  readonly y: number;
}
/** Release velocity is measured over the last 50 ms of real pointer events — never over rendered frames. */
export const VELOCITY_WINDOW_MS = 50;

/**
 * The release of a vertical drag, from the pointer events themselves: a slow drag stays slow even when frames were
 * dropped (a frame-sampled speed turns a starved ticker into a flick). `velocity` is px/s, upward positive;
 * `stillMs` is how long the pointer rested (moved < 1 px) before `end`.
 */
export function releaseKinematics(
  samples: readonly PointerSample[],
  end: PointerSample,
): { velocity: number; stillMs: number } {
  const all = [...samples, end];
  let lastMove = all[0]!.t;
  for (let index = 1; index < all.length; index++)
    if (Math.abs(all[index]!.y - all[index - 1]!.y) >= 1) lastMove = all[index]!.t;
  const stillMs = Math.max(0, end.t - lastMove);
  // The oldest sample inside the window; with none but the release, the last one before it.
  let base = all.find((sample) => sample.t >= end.t - VELOCITY_WINDOW_MS) ?? end;
  if (base === end && all.length > 1) base = all[all.length - 2]!;
  const dt = Math.max(8, end.t - base.t);
  return { velocity: base === end ? 0 : ((base.y - end.y) / dt) * 1000, stillMs };
}

/** Edge-swipe back / sheet drag / pull-downs: commit when the projected travel passes half the distance. */
export const commits = (travel: number, velocity: number, threshold = 0.5): boolean =>
  project(travel, velocity) >= threshold;

/** Horizontal gestures start ≥ 24 px inside the screen edge on touch, leaving the browser's own Back swipe alone. */
export const EDGE_GUARD_PX = 24;
/** Pull-down zones: the left 60 % opens Notification Center, the right 40 % Control Center. */
export const CENTER_SPLIT = 0.6;
export const pullTarget = (x: number, width: number): 'center' | 'control' =>
  x < width * CENTER_SPLIT ? 'center' : 'control';

// --- Overlay arbiter (plans/ios/06 E9, E10, E14) -------------------------------------------------------------------------

export type IosOverlay =
  'quick-actions' | 'folder' | 'spotlight' | 'control' | 'center' | 'switcher' | 'switch-os' | 'banner';

/**
 * One transient system surface at a time. Quick-action menus close on any other request; the App Switcher and the
 * Switch OS sheet outrank the pull-down centres; a banner never competes (it coexists — and waits while a flight or a
 * transient is animating, see `bannerMayShow`).
 */
export const IOS_ARBITER: ArbiterTable<IosOverlay> = {
  priority: ['switch-os', 'switcher', 'control', 'center', 'spotlight', 'folder', 'quick-actions'],
  dismissable: ['quick-actions', 'folder', 'spotlight', 'control', 'center'],
  coexisting: ['banner'],
  blocks: [['switcher', 'spotlight']],
};

export const arbitrateIos = (open: IosOverlay | null, requested: IosOverlay): Verdict =>
  arbitrate(IOS_ARBITER, open, requested);

/**
 * E9: a second pull-down (or button) while the first surface is still animating waits for it to rest — the request is
 * held and replayed once the running one settles. At rest the arbiter decides normally.
 */
export function pullRequest(
  state: { readonly open: IosOverlay | null; readonly animating: boolean },
  requested: IosOverlay,
): 'defer' | Verdict {
  if (state.animating && state.open !== null && state.open !== requested) return 'defer';
  return arbitrateIos(state.open, requested);
}

/** E10: a banner arriving mid-flight (or while a transient animates) is queued until rest. */
export const bannerMayShow = (state: {
  readonly flying: boolean;
  readonly locked: boolean;
  readonly booting: boolean;
  readonly notificationsOn: boolean;
}): boolean => state.notificationsOn && !state.flying && !state.locked && !state.booting;

/**
 * E14 / Esc: what one "back" does — the topmost transient closes first (sheet, then system overlay), then the app's
 * pushed screen pops, then the app goes Home. Never closes the OS (`IOS-A11Y-05`).
 */
export type BackStep = 'sheet' | 'overlay' | 'pop' | 'home' | 'none';
export function backStep(state: {
  readonly sheet: boolean;
  readonly overlay: IosOverlay | null;
  readonly canPop: boolean;
  readonly appOpen: boolean;
}): BackStep {
  if (state.sheet) return 'sheet';
  if (state.overlay && state.overlay !== 'banner') return 'overlay';
  if (state.appOpen && state.canPop) return 'pop';
  if (state.appOpen) return 'home';
  return 'none';
}

// --- Warm apps (plans/ios/02 "Warm apps") -----------------------------------------------------------------------------

/** The three most recent backgrounded apps stay mounted; older ones unmount and restore from their instance. */
export const WARM_LIMIT = 3;

/**
 * Which app surfaces stay mounted: the foreground app plus the `WARM_LIMIT` most recent others (z-order is recency:
 * the kernel raises an app each time it comes forward). Everything else restores from its `WindowInstance`.
 */
export function mountedApps(zOrder: readonly WindowId[], focused: WindowId | null): readonly WindowId[] {
  const recent = [...zOrder].reverse().filter((id) => id !== focused);
  return [...(focused ? [focused] : []), ...recent.slice(0, WARM_LIMIT)];
}

// --- Spotlight zero state (plans/ios/surfaces/spotlight) -------------------------------------------------------------

export const SPOTLIGHT_SUGGESTED_APPS: readonly IosRole[] = ['files', 'github', 'mail', 'browser'];
export const SPOTLIGHT_SUGGESTIONS: readonly {
  readonly id: string;
  readonly label: string;
  readonly ref: ContentRef;
}[] = [
  { id: 'resume', label: 'Résumé', ref: { section: 'resume' } },
  { id: 'projects', label: 'Projects', ref: { section: 'projects' } },
  { id: 'contact', label: 'Contact', ref: { section: 'contact' } },
];

// --- Status bar ---------------------------------------------------------------------------------------------------------

/** iPadOS date line: "Mon 21 Sep" (en-GB order, as the frame shows). */
export const statusDate = (date: Date): string =>
  `${date.toLocaleDateString('en-US', { weekday: 'short' })} ${date.getDate()} ${date.toLocaleDateString('en-US', { month: 'short' })}`;
/** iOS shows the time without AM/PM: "9:41". */
export const statusTime = (date: Date): string =>
  date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '');

/** Minutes until the next minute boundary (one timer per minute keeps the clock right without polling). */
export const msToNextMinute = (date: Date): number => 60_000 - (date.getSeconds() * 1000 + date.getMilliseconds());

/** Initials for avatars ("JN"). */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return `${words[0]?.[0] ?? ''}${words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : ''}`.toUpperCase();
}
