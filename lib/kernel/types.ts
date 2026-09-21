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

export interface WindowPolicy {
  readonly mode: 'floating' | 'fullscreen' | 'tiled';
  readonly defaultRect: Readonly<Record<SizeClass, PxRect>>;
  readonly minPx: { readonly w: number; readonly h: number };
  readonly resizable: boolean;
}

export interface OsAppBinding {
  readonly role: AppRole;
  readonly slug: string;
  readonly title: string;
  readonly icon: AssetId;
  readonly window: WindowPolicy;
  readonly pinned: boolean;
  readonly owns: readonly SectionId[];
}

export interface OsDefinition {
  readonly id: OsId;
  readonly name: string;
  readonly chrome: 'desktop' | 'mobile' | 'terminal';
  readonly released: boolean;
  readonly apps: readonly OsAppBinding[];
  readonly sectionOwner: Readonly<Record<SectionId, AppRole>>;
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
}

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
  osHeading: 'os-heading',
  home: (os: OsId) => `home:${os}`,
  chooserHeading: 'chooser-heading',
  chooserCard: (os: OsId) => `chooser-card:${os}`,
  profilesHeading: 'profiles-heading',
} as const;
