/**
 * Authoritative model catalogue — shared/04-os-kernel.md. Pure types; no React, no DOM.
 * Typed additions beyond the spec's compact catalogue are marked "addition" and logged in shared/22.
 */
import type { ContentRef } from '@/data/schema';
import type { AppRole, OsId, PersonaId, Posture, SectionId, SizeClass } from './ids';

export type Brand<T, B extends string> = T & { readonly __b: B };
export type RoutePath = Brand<`/${string}`, 'RoutePath'>;
/**
 * A window id is the template-literal union of valid `(os, role)` pairs — stricter than a brand (only real pairs
 * type-check) and, unlike a brand, usable as a record key.
 */
export type WindowId = `${OsId}:${AppRole}`;
export type WindowKey = WindowId;
export type Epoch = Brand<number, 'Epoch'>;
export type AssetId = Brand<string, 'AssetId'>;

export const windowId = (os: OsId, role: AppRole): WindowId => `${os}:${role}` as WindowId;
export const routePath = (path: string): RoutePath => (path.startsWith('/') ? path : `/${path}`) as RoutePath;
export const toEpoch = (value: number): Epoch => value as Epoch;
export const assetId = (id: string): AssetId => id as AssetId;

export function parseWindowId(id: WindowId): { os: OsId; role: AppRole } {
  const [os, role] = id.split(':') as [OsId, AppRole];
  return { os, role };
}

export type AppLocation =
  | { readonly kind: 'root' }
  | { readonly kind: 'content'; readonly ref: ContentRef }
  | { readonly kind: 'vfs'; readonly path: readonly string[] };

export interface PxRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** A rect as fractions of the page (0..1 of the viewport's width and height). */
export interface RectFraction {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface WindowPolicy {
  readonly mode: 'floating' | 'fullscreen' | 'tiled';
  readonly defaultRect: Readonly<Record<SizeClass, PxRect>>;
  /**
   * addition: default placement as fractions of the page (an OS's visual target places windows by fraction). Wins
   * over `defaultRect` when present; a stored bucket or a learned rect still wins over both.
   */
  readonly defaultFraction?: RectFraction;
  /**
   * addition (plans/windows/02 "Open"): a preferred px size per size class, placed centred in the workspace (the page
   * minus the OS chrome). Wins over `defaultRect`; `defaultFraction` still wins over it.
   */
  readonly centered?: Readonly<Record<SizeClass, { readonly w: number; readonly h: number }>>;
  /** addition: the cascade step for windows that would open on top of another (default 24 px; Windows 32 px). */
  readonly cascadePx?: number;
  readonly minPx: { readonly w: number; readonly h: number };
  readonly resizable: boolean;
}

/**
 * addition (plans/windows/02 "Snapped state"): Windows Snap zones — halves, quarters, and the thirds of the
 * snap-layouts flyout (⅔ + ⅓, ⅓ + ⅓ + ⅓). The top edge maximizes instead (a phase, not a zone).
 */
export const SNAP_ZONES = [
  'left',
  'right',
  'tl',
  'tr',
  'bl',
  'br',
  'left-two-thirds',
  'third-l',
  'third-c',
  'third-r',
] as const;
export type SnapZone = (typeof SNAP_ZONES)[number];

/**
 * addition: a snapped window keeps `phase: normal` and its pre-snap rect in its bucket; the rect on screen is derived
 * from the zone and the workspace, so a viewport change re-derives it. `split` is the shared edge of a ½ + ½ pair as a
 * fraction of the workspace width (paired resize moves it for both windows).
 */
export interface SnapState {
  readonly zone: SnapZone;
  readonly split?: number;
}

/** Space the OS chrome takes from the page edges (menu bar, Dock, taskbar); windows live in what remains. */
export interface WorkspaceInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface OsAppBinding {
  readonly role: AppRole;
  readonly slug: string;
  readonly title: string;
  readonly icon: AssetId;
  readonly window: WindowPolicy;
  readonly pinned: boolean;
  readonly owns: readonly SectionId[];
  /**
   * addition: the section an app that owns several shows at its root (Windows Edge: `/windows/edge` *is* the About
   * tab, `/windows/edge/resume` the PDF tab). The long form `/{os}/{app}/{home}` canonicalizes to the root.
   */
  readonly home?: SectionId;
}

export interface OsDefinition {
  readonly id: OsId;
  readonly name: string;
  readonly chrome: 'desktop' | 'mobile' | 'terminal';
  readonly released: boolean;
  readonly apps: readonly OsAppBinding[];
  readonly sectionOwner: Readonly<Record<SectionId, AppRole>>;
  /** addition: chrome insets that bound the window workspace (clamping, zoom, cascade); none = the whole page. */
  readonly insets?: (viewport: Viewport, prefs?: Pick<UserPreferences, 'dock'>) => WorkspaceInsets;
}

export type OsRegistry = Readonly<Record<OsId, OsDefinition>>;

export type WindowPhase =
  | { readonly s: 'opening'; readonly originId: string | null }
  | { readonly s: 'normal' }
  | { readonly s: 'maximized'; readonly restore: PxRect }
  | { readonly s: 'minimized'; readonly restore: PxRect; readonly wasMaximized: boolean }
  | { readonly s: 'closing' };

export interface NavStack {
  readonly entries: readonly AppLocation[];
  readonly index: number;
}

export interface WindowInstance {
  readonly id: WindowId;
  readonly os: OsId;
  readonly role: AppRole;
  readonly phase: WindowPhase;
  readonly rect: Readonly<Partial<Record<SizeClass, PxRect>>>;
  readonly nav: NavStack;
  readonly scrollTop: number;
  readonly draft?: string;
  /** addition: focus key of the element that opened the window (focus returns to it on close). */
  readonly invoker?: string | null;
  /** addition: Windows Snap (see `SnapState`); absent = floating. */
  readonly snap?: SnapState;
}

export interface TerminalSession {
  /** Absolute path segments, e.g. `['home', 'jaswanth', 'projects']`. */
  readonly cwd: readonly string[];
  readonly history: readonly string[];
  /** Capped at 500 lines. */
  readonly scrollback: readonly string[];
}

export interface OsSession {
  readonly os: OsId;
  readonly windows: Readonly<Partial<Record<WindowKey, WindowInstance>>>;
  /** Back → front; CSS `z-index` = index. */
  readonly zOrder: readonly WindowId[];
  readonly focused: WindowId | null;
  readonly terminal: TerminalSession | null;
  readonly sizeClass: SizeClass;
  readonly parkedAt: number | null;
  readonly contentRev: string;
  readonly bootSeen: boolean;
  readonly lockSeen: boolean;
  /**
   * addition (plans/macos/02 `MAC-WM-07`): apps that are running on a desktop OS. Opening an app starts it; closing its
   * window keeps it running (the Dock dot stays); only Quit stops it.
   */
  readonly running: readonly AppRole[];
}

export type TransitionFailure = 'chunk' | 'offline' | 'timeout';

export type OsTransition =
  | { readonly phase: 'idle' }
  | { readonly phase: 'exiting'; readonly epoch: Epoch; readonly from: OsId | null; readonly to: OsId | null }
  | {
      readonly phase: 'loading';
      readonly epoch: Epoch;
      readonly from: OsId | null;
      readonly to: OsId;
      readonly since: number;
    }
  | {
      readonly phase: 'entering';
      readonly epoch: Epoch;
      readonly from: OsId | null;
      readonly to: OsId;
      /** addition: the running exit timeline reverses back into `to` (return-to-origin). */
      readonly reverse?: boolean;
    }
  | {
      readonly phase: 'failed';
      readonly epoch: Epoch;
      readonly to: OsId;
      readonly reason: TransitionFailure;
      readonly attempts: number;
    };

export type Onboarding = 'hello' | 'intro' | 'profiles' | 'chooser' | 'done';

export interface Continuity {
  readonly ref: ContentRef;
  readonly fromOs: OsId;
  readonly at: number;
}

export type DeviceClass = 'phone' | 'tablet' | 'desktop';
export type Tier = 0 | 1 | 2;

export interface CapabilityProfile {
  readonly tier: Tier;
  readonly deviceClass: DeviceClass;
  readonly pointer: 'fine' | 'coarse' | 'none';
  readonly hover: boolean;
  readonly webgl2: boolean | null;
  readonly reducedMotion: boolean;
  readonly reducedTransparency: boolean;
  readonly saveData: boolean;
  /** addition: iOS-family touch device (`-webkit-touch-callout` probe — never the user agent), for /go defaults. */
  readonly appleTouch: boolean;
}

export interface Viewport {
  readonly w: number;
  readonly h: number;
  readonly sizeClass: SizeClass;
  readonly posture: Posture;
  readonly orientation: 'portrait' | 'landscape';
}

export type RouteState =
  | { readonly kind: 'welcome' }
  | { readonly kind: 'go'; readonly ref: ContentRef }
  | { readonly kind: 'plain' }
  | {
      readonly kind: 'os';
      readonly os: OsId;
      readonly focus: { readonly role: AppRole; readonly location: AppLocation } | null;
    };

export type DecodeFailure = 'unknown-os' | 'unreleased-os' | 'unknown-app' | 'unknown-slug' | 'bad-vfs-path';
export type DecodeResult =
  | { readonly ok: true; readonly route: RouteState; readonly canonical: RoutePath }
  | { readonly ok: false; readonly nearest: RouteState; readonly reason: DecodeFailure };

/** How the visitor arrived in the active OS — gates boot/lock screens and tour offers (addition). */
export type Arrival = 'chooser' | 'switch' | 'deep-link' | 'go' | 'history' | 'restore';

export interface KernelState {
  readonly boot: 'ssr' | 'hydrating' | 'ready';
  readonly route: RouteState;
  readonly activeOs: OsId | null;
  readonly sessions: Readonly<Record<OsId, OsSession>>;
  readonly transition: OsTransition;
  readonly onboarding: Onboarding;
  readonly viewport: Viewport;
  readonly capabilities: CapabilityProfile;
  readonly continuity: Continuity | null;
  /** addition: last epoch issued (monotonic). */
  readonly epoch: Epoch;
  /** addition: see `Arrival`. */
  readonly arrival: Arrival | null;
  /** addition: geometry the visitor chose, reused for cold deep links (persisted). */
  readonly learnedRects: Readonly<Partial<Record<WindowKey, Readonly<Partial<Record<SizeClass, PxRect>>>>>>;
}

export type ThemePref = 'system' | 'light' | 'dark';

export interface UserPreferences {
  readonly v: 1;
  readonly persona: PersonaId | null;
  readonly lastOs: OsId | null;
  readonly introSeen: boolean;
  /** `enabled` is the master switch (the mute toggle); `ui` opts into UI sounds, which default off (addition). */
  readonly sound: { readonly enabled: boolean; readonly volume: number; readonly ui: boolean };
  readonly motion: 'system' | 'reduced' | 'full';
  readonly glass: 'system' | 'solid' | 'full';
  readonly theme: ThemePref;
  readonly singleKeyShortcuts: boolean;
  readonly tourOffered: boolean;
  readonly eggsFound: readonly string[];
  /** addition: governor demotion cap `{tier, exp}` read by the pre-paint tier script (14-day TTL). */
  readonly demotion: { readonly tier: Tier; readonly exp: number } | null;
  /** addition (plans/windows/apps/settings "Personalization"): Windows-only taskbar alignment. */
  readonly taskbarAlign: 'center' | 'left';
  /** addition: the accent colour chosen in an OS's Personalization settings; `null` = that OS's own default. */
  readonly accent: AccentId | null;
  /** addition (shared/09 "larger text"): text size multiplier, 1 – 1.3 in steps of 0.05. */
  readonly textScale: number;
  /** addition (Windows "Contrast themes" = increase contrast): `more` forces solid surfaces and 2 px borders. */
  readonly contrast: 'system' | 'more';
  /** addition: OS notifications (toasts / banners) on or off; the notification centre keeps them either way. */
  readonly notifications: boolean;
  /** addition (plans/macos/apps/system-settings "Appearance"): wallpaper variant — follow the theme, or fixed. */
  readonly wallpaper: 'auto' | 'light' | 'dark';
  /** addition (plans/macos/apps/system-settings "Desktop & Dock"): Dock magnification and size. */
  readonly dock: { readonly magnification: boolean; readonly size: DockSize };
}

export type DockSize = 'small' | 'medium' | 'large';

/** addition: the accent palette offered by Personalization settings (plans/windows/apps/settings). */
export const ACCENT_IDS = ['blue', 'navy', 'teal', 'green', 'purple', 'plum', 'red', 'orange', 'graphite'] as const;
export type AccentId = (typeof ACCENT_IDS)[number];

export interface PersistedSessionsV1 {
  readonly v: 1;
  readonly savedAt: number;
  readonly contentRev: string;
  readonly sessions: Readonly<Partial<Record<OsId, OsSession>>>;
  readonly learnedRects: KernelState['learnedRects'];
}

/**
 * Focus is a kernel output (shared/04 `KRN-FOCUS-*`): an ordered list of focus keys. The FocusManager focuses the
 * first key present in the DOM (`[data-focus-key]`), falling back to the shell heading — never `<body>`.
 */
export interface FocusTarget {
  readonly candidates: readonly string[];
}

/** Which history primitive RouteSync uses for the state's URL (shared/05 event → history table). */
export type RouteIntent = 'go' | 'canonicalize' | null;

export const focusKeys = {
  window: (id: WindowId) => `window:${id}`,
  launcher: (os: OsId, role: AppRole) => `launcher:${os}:${role}`,
  /** A minimized window's own Dock tile (macOS): the minimize focus target, ahead of the app's launcher. */
  dockTile: (id: WindowId) => `dock-tile:${id}`,
  osHeading: 'os-heading',
  home: (os: OsId) => `home:${os}`,
  chooserHeading: 'chooser-heading',
  chooserCard: (os: OsId) => `chooser-card:${os}`,
  profilesHeading: 'profiles-heading',
} as const;
