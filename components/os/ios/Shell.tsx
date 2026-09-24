'use client';
/**
 * The iOS shell (lazy `ios` chunk) — plans/ios/. A polished Home Screen that **is the page** at every size (never a
 * device frame — north-star B17): the phone layout on phones, the iPadOS layout on tablets, laptops and desktops.
 * One app fills the screen at a time; tapping an icon makes the app **grow out of that icon**, and going Home makes it
 * **shrink back into it**, on springs that follow the finger (plans/ios/02, 03).
 *
 * Landmarks in reading order (plans/ios/05 `IOS-A11Y-01`): the status bar `group` → `<main>` (the hidden `h1`, the Home
 * Screen, the foreground app as a labelled `section`) → `nav` "Dock" → the Home `button` → the status regions. While an
 * app is in front, the Home Screen and the Dock are `inert`; the status bar, Home button and the app stay operable.
 *
 * What this file owns: the orchestration of app surfaces (which are mounted, which flies where — `surfaceMotion`),
 * the Home gesture and the App Switcher, the pull-downs, one transient surface at a time (`IOS_ARBITER`), banners and
 * Notification Center, the Lock Screen, the tour, the eggs, continuity, the keyboard model and the Switch OS exit beat.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { preload } from 'react-dom';
import { copyText, formatUpdated, goHref } from '@/components/content';
import { contentIndex } from '@/data/content-index';
import type { ContentRef } from '@/data/schema';
import {
  getContact,
  getCurrentRole,
  getExperience,
  getFeaturedProjects,
  getPerson,
  getProjectsWithGithub,
  getResume,
  getResumeFileMeta,
} from '@/data/selectors';
import { analytics } from '@/lib/analytics/loader';
import { resolveAsset } from '@/lib/assets/manifest';
import { createKonami, recordEgg } from '@/lib/eggs';
import type { AppRole, OsId } from '@/lib/kernel/ids';
import { OS_NAMES } from '@/lib/kernel/ids';
import { matchShortcut } from '@/lib/kernel/keymap';
import { continuityOffer } from '@/lib/kernel/reducers';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import { isFocusable } from '@/lib/kernel/state';
import { focusKeys, parseWindowId, type AppLocation, type WindowId } from '@/lib/kernel/types';
import { drag } from '@/lib/motion/drag';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { trackVisualViewport } from '@/lib/motion/visual-viewport';
import type { OsShellProps } from '@/lib/os-loaders';
import { squircleSvg } from '@/lib/assets/squircle';
import { offerCommand } from '@/lib/terminal/handoff';
import type { TourDirector, TourScript, TourStep } from '@/lib/tour';
import { useKernel, usePrefs } from '@/stores/kernel-context';
import { dispatch, dispatchSoon, flushQueued, getKernel, subscribeEffects } from '@/stores/kernel-store';
import { getPrefs } from '@/stores/prefs-store';
import { claimPhases, handOffExit } from '@/stores/transition-stage';
import { AppSurface, type SurfaceHandle, type SurfaceState } from './AppSurface';
import { prefetchApp, warmApps } from './apps/registry';
import { requestIntent } from './intents';
import { OS_CHUNK_MARKER } from './marker';
import {
  arbitrateIos,
  bannerFor,
  bannerMayShow,
  careerShortcuts,
  dockRecents,
  homeItemFor,
  homeLayout,
  homeOutcome,
  releaseKinematics,
  type PointerSample,
  iosBinding,
  IOS_ROLES,
  layoutFor,
  lockNotifications,
  mountedApps,
  pageOf,
  quickActionsFor,
  statusStyleFor,
  widgetActions,
  type BannerTrigger,
  type IosOverlay,
  type IosRole,
  type LockNotification,
  type QuickAction,
  type QuickCommand,
  type WidgetId,
} from './model';
import {
  absentVisual,
  arrivalFlyIn,
  exitBeat,
  fullVisual,
  gestureVisual,
  IOS_SPRINGS,
  registerHome,
  visualOf,
  wallpaperParallax,
  type MotionEnd,
  type Visual,
} from './motion';
import { IosShellProvider, type BannerSpec, type IosServices, type PreviewSpec } from './shell-context';
import { ControlCenter } from './surfaces/ControlCenter';
import { CoachMark, ShortcutsSheet, SwitchOsSheet } from './surfaces/Dialogs';
import { FolderPanel } from './surfaces/Folder';
import { Dock, Home, type HomeHandle, type WidgetData } from './surfaces/Home';
import type { LaunchOrigin } from './surfaces/Icons';
import { LockScreen } from './surfaces/LockScreen';
import { Banner, bannerReducer, INITIAL_BANNERS, NotificationCenter, type CenterItem } from './surfaces/Notifications';
import { QuickActions, type QuickSpec } from './surfaces/QuickActions';
import { Spotlight, type SpotlightChoice, type SpotlightHandle } from './surfaces/Spotlight';
import { HomeIndicator, StatusBar } from './surfaces/StatusBar';
import { Switcher } from './surfaces/Switcher';
import { SheetHostContext, type SheetHost } from './ui/Sheet';
import { scrollStackToTop } from './ui/NavStack';
import styles from './ios.module.css';

export { OS_CHUNK_MARKER };

const inTextField = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

const roleOf = (id: WindowId | null): IosRole | null => (id ? (parseWindowId(id).role as IosRole) : null);
const isIosRole = (role: AppRole): role is IosRole => (IOS_ROLES as readonly string[]).includes(role);

/** The continuous-corner icon mask (the same path in both asset modes — IOS-ID-02). */
const SQUIRCLE_MASK = `url("data:image/svg+xml,${encodeURIComponent(squircleSvg(100))}")`;

/** The iPhone 16 wallpaper in official mode; `null` keeps the original gradient (plans/ios/01 "Wallpaper and depth"). */
const WALLPAPER = (() => {
  const asset = resolveAsset('wallpaper.ios');
  return asset.render === 'image' ? asset.src : null;
})();

/** Page memory survives leaving iOS and coming back (session state, in memory for the page's life). */
let rememberedPage = 0;
/** "Cycles only on re-entry": the Projects widget shows the next featured project each time iOS is entered. */
let entries = 0;

type Overlay =
  | {
      readonly kind: 'spotlight';
      readonly closing: boolean;
      readonly query: string;
      readonly interactive: boolean;
      /** Each open mounts a fresh Spotlight (a reopen during the fade-out never inherits its state). */
      readonly seq: number;
    }
  | { readonly kind: 'control'; readonly closing: boolean; readonly interactive: boolean }
  | { readonly kind: 'center'; readonly closing: boolean; readonly interactive: boolean }
  | { readonly kind: 'switcher'; readonly closing: boolean }
  | { readonly kind: 'quick-actions'; readonly spec: QuickSpec }
  | { readonly kind: 'switch-os'; readonly open: boolean; readonly from: HTMLElement | null }
  | { readonly kind: 'shortcuts'; readonly open: boolean };

interface Launch {
  readonly role: IosRole;
  readonly origin: Visual | null;
  readonly seq: number;
}

function useDark(): boolean {
  const theme = usePrefs((prefs) => prefs.theme);
  const [system, setSystem] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true,
  );
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return;
    const onChange = () => setSystem(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return theme === 'dark' || (theme === 'system' && system);
}

const monthYear = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

export default function IosShell({ heading }: OsShellProps) {
  // Fetched with the shell (shared/11: wallpapers load at low priority; their mean colour shows meanwhile).
  if (WALLPAPER) preload(WALLPAPER, { as: 'image', type: 'image/avif', fetchPriority: 'low' });
  const root = useRef<HTMLDivElement>(null);
  const homeLayer = useRef<HTMLDivElement>(null);
  const dockLayer = useRef<HTMLDivElement>(null);
  const dimVeil = useRef<HTMLDivElement>(null);
  const wallpaper = useRef<HTMLDivElement>(null);
  const homeRef = useRef<HomeHandle>(null);
  const indicator = useRef<HTMLButtonElement>(null);
  const spotlightRef = useRef<SpotlightHandle>(null);
  const [systemLayer, setSystemLayer] = useState<HTMLDivElement | null>(null);

  const viewport = useKernel((state) => state.viewport);
  const pointer = useKernel((state) => state.capabilities.pointer);
  const windows = useKernel((state) => state.sessions.ios.windows);
  const zOrder = useKernel((state) => state.sessions.ios.zOrder);
  const focused = useKernel((state) => state.sessions.ios.focused);
  const singleKeys = usePrefs((prefs) => prefs.singleKeyShortcuts);
  const notificationsOn = usePrefs((prefs) => prefs.notifications);
  const dark = useDark();
  const layout = layoutFor(viewport.sizeClass);
  const landscape = viewport.orientation === 'landscape';

  // --- Data (selectors only — never a fact typed here) ---------------------------------------------------------------
  const person = getPerson();
  const resume = getResume();
  const hasPdf = getResumeFileMeta() !== null;
  const featured = useMemo(() => getFeaturedProjects(), []);
  const enriched = useMemo(() => getProjectsWithGithub(), []);
  const shortcuts = useMemo(
    () =>
      careerShortcuts(
        getExperience()
          .filter((role) => role.end === 'present')
          .slice(0, 2),
      ),
    [],
  );
  const [entry] = useState(() => entries++);
  const widgetData: WidgetData = useMemo(() => {
    const current = getCurrentRole();
    const pick = featured.length ? featured[entry % featured.length]! : null;
    const repo = pick ? enriched.find((item) => item.project.slug === pick.slug) : undefined;
    return {
      name: person.givenName,
      roleLine: current?.role ? `${current.role} · ${current.company}` : person.role,
      updated: monthYear(resume.updated),
      openTo: person.openTo,
      location: person.location,
      hasPdf,
      project: pick
        ? {
            slug: pick.slug,
            name: pick.name,
            meta: [repo?.github?.language ?? pick.stack[0], repo?.github ? `★ ${repo.github.stars}` : pick.year]
              .filter(Boolean)
              .join(' · '),
          }
        : null,
    };
  }, [person, resume.updated, hasPdf, featured, enriched, entry]);
  const home = useMemo(
    () => homeLayout(viewport, { hasProject: widgetData.project !== null }),
    [viewport, widgetData.project],
  );
  const mailRead = (() => {
    try {
      return (JSON.parse(windows['ios:mail']?.ui?.read ?? '[]') as string[]).includes('lets-talk');
    } catch {
      return false;
    }
  })();
  const badges = { mailRead, featured: featured.length };

  // --- Transient surfaces ----------------------------------------------------------------------------------------------
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [folder, setFolder] = useState<'open' | 'closing' | null>(null);
  const [lock, setLock] = useState<boolean>(() => {
    const state = getKernel();
    return state.arrival === 'chooser' && !state.sessions.ios.lockSeen && state.sessions.ios.focused === null;
  });
  const [lockCleared, setLockCleared] = useState<readonly string[]>([]);
  const [brightness, setBrightness] = useState(0);
  const [banners, bannerEvent] = useReducer(bannerReducer, INITIAL_BANNERS);
  const [shimmer, setShimmer] = useState(false);
  const invoker = useRef<HTMLElement | null>(null);
  const folderButton = useRef<HTMLElement | null>(null);
  const overlayKind = overlay?.kind ?? null;
  const overlayOpen: IosOverlay | null =
    overlay && !('closing' in overlay && overlay.closing) && !('open' in overlay && !overlay.open)
      ? (overlay.kind as IosOverlay)
      : folder === 'open'
        ? 'folder'
        : null;

  // --- Surfaces, launches and origins ------------------------------------------------------------------------------------
  const handles = useRef(new Map<IosRole, SurfaceHandle>());
  const [registeredSurfaces, surfaceRegistered] = useReducer((revision: number) => revision + 1, 0);
  const dismissSwitcher = useRef<() => void>(() => undefined);
  /** Cards drive their live surfaces only while the switcher is up (a closing switcher never retargets a flight). */
  const switcherLive = useRef(false);
  const register = useCallback((role: IosRole, handle: SurfaceHandle | null) => {
    if (handle) {
      handles.current.set(role, handle);
      // A newly mounted surface can register after the shell's layout effect. Wake the launch orchestrator so an
      // immediate icon click cannot update the route while leaving its not-yet-registered surface at `opening`.
      surfaceRegistered();
    } else handles.current.delete(role);
  }, []);
  const [launch, setLaunch] = useState<Launch | null>(null);
  const launchSeq = useRef(0);
  /** The item each app last opened from (its return target and its launcher focus key). */
  const [origins, setOrigins] = useState<Partial<Record<IosRole, string>>>({});
  const originsRef = useRef(origins);
  const kernelRole = roleOf(focused && isFocusable(windows[focused]) ? focused : null);
  const foreground: IosRole | null = launch ? launch.role : kernelRole;
  const foregroundRef = useRef(foreground);
  // Callbacks that run later (flight ends, gestures) read the latest values through refs, synced before any effect.
  useLayoutEffect(() => {
    originsRef.current = origins;
    foregroundRef.current = foreground;
  });
  const [phases, setPhases] = useState<Partial<Record<IosRole, SurfaceState>>>(() =>
    kernelRole ? { [kernelRole]: 'foreground' } : {},
  );
  const setPhase = useCallback(
    (role: IosRole, phase: SurfaceState) => setPhases((all) => (all[role] === phase ? all : { ...all, [role]: phase })),
    [],
  );
  const [flyingItem, setFlyingItem] = useState<string | null>(null);

  const settleOpen = useCallback(
    (role: IosRole, end: MotionEnd) => {
      if (end !== 'rest' || foregroundRef.current !== role) return;
      setPhase(role, 'foreground');
      const id = `ios:${role}` as WindowId;
      if (getKernel().sessions.ios.windows[id]?.phase.s === 'opening')
        dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
    },
    [setPhase],
  );

  const mountedRoles = useMemo(() => {
    const ids = mountedApps(zOrder, focused);
    const roles = new Set<IosRole>();
    for (const id of ids) {
      const role = roleOf(id);
      if (role && windows[id]) roles.add(role);
    }
    if (launch) roles.add(launch.role);
    for (const [role, phase] of Object.entries(phases) as [IosRole, SurfaceState][])
      if (phase !== 'background' && (windows[`ios:${role}` as WindowId] || launch?.role === role)) roles.add(role);
    return [...roles];
  }, [zOrder, focused, windows, launch, phases]);

  const flying = Object.values(phases).some((phase) => phase === 'opening' || phase === 'closing');
  const covered = foreground !== null && phases[foreground] === 'foreground' && !flying && overlayKind !== 'switcher';

  // The kernel took the launch: the pending launch hands over (same foreground → no second flight).
  useEffect(
    () =>
      subscribeEffects(({ state }) => {
        const id = state.sessions.ios.focused;
        setLaunch((current) => (current && id === `ios:${current.role}` ? null : current));
      }),
    [],
  );

  /** The element an app returns into (fallback order: its origin → the closed folder → its icon → the Dock). */
  const targetElement = useCallback((role: IosRole): { element: HTMLElement; radius?: number; key: string } | null => {
    const usable = (el: HTMLElement | null) => {
      if (!el || !el.isConnected) return null;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 ? el : null;
    };
    const art = (el: HTMLElement) => el.querySelector<HTMLElement>('[data-art]') ?? el;
    const key = originsRef.current[role];
    if (key) {
      if (key.startsWith('widget:')) {
        const widget = usable(document.getElementById(`ios-widget-${key.slice(7)}`));
        if (widget) return { element: widget, radius: 22, key };
      } else if (key.startsWith('folder:career/')) {
        const inside = usable(document.getElementById(`ios-icon-${key}`));
        if (inside) return { element: art(inside), key };
        const folderIcon = usable(document.getElementById('ios-icon-folder:career'));
        if (folderIcon) return { element: art(folderIcon), key: 'folder:career' };
      } else {
        const own = usable(document.getElementById(`ios-icon-${key}`));
        if (own && !own.closest('[data-spotlight], [data-lock]')) return { element: art(own), key };
      }
    }
    for (const candidate of [homeItemFor(role), `dock:${role}`, `recent:${role}`]) {
      if (!candidate) continue;
      const el = usable(document.getElementById(`ios-icon-${candidate}`));
      if (el) return { element: art(el), key: candidate };
    }
    if (role === 'files') {
      const folderIcon = usable(document.getElementById('ios-icon-folder:career'));
      if (folderIcon) return { element: art(folderIcon), key: 'folder:career' };
    }
    return null;
  }, []);

  /** The page holding an item (the close flight jumps there first — no animation). */
  const pageForKey = useCallback(
    (key: string): number | null => {
      if (key.startsWith('dock:') || key.startsWith('recent:')) return null;
      const item = key.startsWith('folder:career/') ? 'folder:career' : key;
      return pageOf(home, item);
    },
    [home],
  );

  const openSurface = useCallback(
    (role: IosRole, origin: Visual | null, cold: boolean) => {
      const handle = handles.current.get(role);
      if (!handle) return;
      // Focus: the app's heading first, then Home turns inert (in this commit), then the flight — unless the app already
      // placed focus inside itself (Quick Look's Done mounts first under reduced motion).
      if (!handle.element.contains(document.activeElement))
        handle.element.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
      const id = `ios:${role}` as WindowId;
      if (cold) {
        handle.motion.set(fullVisual());
        setPhase(role, 'foreground');
        if (getKernel().sessions.ios.windows[id]?.phase.s === 'opening')
          dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
        return;
      }
      const phase = phases[role];
      // Development Strict Mode deliberately disposes and recreates a newly mounted surface. If that interrupts the
      // first flight, the replacement handle is at rest and must be seeded from the same origin before it is retried.
      if (!handle.motion.moving() || (phase !== 'closing' && phase !== 'opening' && phase !== 'switcher')) {
        const from =
          origin ??
          (() => {
            const target = targetElement(role);
            return target ? restingVisual(target.element, target.radius) : absentVisual();
          })();
        handle.motion.set(from);
      }
      setPhase(role, 'opening');
      void handle.motion.toward(fullVisual(), IOS_SPRINGS.open).then((end) => settleOpen(role, end));
    },
    [phases, setPhase, settleOpen, targetElement],
  );

  const closeSurface = useCallback(
    (role: IosRole, options: { fast?: boolean } = {}) => {
      const handle = handles.current.get(role);
      if (!handle) {
        setPhase(role, 'background');
        return Promise.resolve();
      }
      // 1. The pager jumps (no animation) to the page holding the originating icon (or its folder).
      const key = originsRef.current[role] ?? homeItemFor(role) ?? `dock:${role}`;
      const page = pageForKey(key);
      if (page !== null && homeRef.current && homeRef.current.page() !== page) homeRef.current.jumpTo(page);
      // 2. Re-measure the icon now (the grid may have reflowed or rotated).
      const target = targetElement(role);
      const visual = target ? restingVisual(target.element, target.radius) : absentVisual();
      setFlyingItem(target?.key ?? null);
      setPhase(role, 'closing');
      const spring = options.fast ? { response: 0.28, damping: 1 } : IOS_SPRINGS.close;
      return handle.motion.toward(visual, spring).then((end) => {
        if (end !== 'rest' || foregroundRef.current === role) return;
        setPhase(role, 'background');
        setFlyingItem((current) => (current === target?.key ? null : current));
      });
    },
    [pageForKey, setPhase, targetElement],
  );

  // The orchestrator: whenever the foreground app changes (a launch, the URL, Home, Back, the switcher), the old app
  // returns into its icon and the new one grows out of its origin — both at once, velocities kept (plans/ios/06 E2).
  const previousForeground = useRef<IosRole | null>(kernelRole);
  const handledLaunch = useRef(0);
  /** The origin a launch flies from, held until a flight consumes it: the kernel's effect can clear `launch` before a
   *  cold surface has registered its motion handle, and the rect would fall back to the app's icon. */
  const pendingLaunch = useRef<Launch | null>(null);
  const firstRun = useRef(true);
  useLayoutEffect(() => {
    const previous = previousForeground.current;
    const pending = launch ?? (pendingLaunch.current?.role === foreground ? pendingLaunch.current : null);
    const seq = pending?.seq ?? handledLaunch.current;
    const cold = firstRun.current;
    firstRun.current = false;
    // AppSurface registers its motion handle in a layout effect. Depending on mount order, this shell effect can run
    // first; wait for the registration revision instead of recording a launch that no motion instance received.
    if (foreground && !handles.current.has(foreground)) return;
    if (cold && foreground) {
      // A cold deep link / restore: the app is simply there — no flight on first paint (E12).
      openSurface(foreground, null, true);
      previousForeground.current = foreground;
      return;
    }
    if (previous === foreground && seq === handledLaunch.current) {
      const handle = foreground ? handles.current.get(foreground) : null;
      // The same launch is already handled only while its current motion instance is moving or has landed. A freshly
      // registered replacement handle (Strict Mode remount) needs the flight replayed from the captured origin.
      if (!foreground || phases[foreground] !== 'opening' || handle?.motion.moving()) return;
    }
    previousForeground.current = foreground;
    handledLaunch.current = seq;
    if (overlayKind === 'switcher') return; // the switcher runs its own flights
    // Measure-then-commit: the flights read the DOM (icon rects, the pager) and record their phase before paint.
    if (previous && previous !== foreground) void closeSurface(previous);
    if (foreground) {
      const origin = pending?.role === foreground ? pending.origin : null;
      if (pendingLaunch.current === pending) pendingLaunch.current = null;
      openSurface(foreground, origin, false);
    }
  }, [foreground, launch, openSurface, closeSurface, overlayKind, phases, registeredSurfaces]);

  // Rotation / resize mid-flight: flights retarget to re-measured rects (plans/ios/06 E4).
  useEffect(() => {
    for (const [role, phase] of Object.entries(phases) as [IosRole, SurfaceState][]) {
      const handle = handles.current.get(role);
      if (!handle) continue;
      if (phase === 'foreground') handle.motion.set(fullVisual());
      else if (phase === 'opening')
        void handle.motion.toward(fullVisual(), IOS_SPRINGS.open).then((end) => settleOpen(role, end));
    }
    // Viewport changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport.w, viewport.h, settleOpen]);

  // --- Home follower, parallax, keyboard-aware viewport ------------------------------------------------------------------
  useLayoutEffect(
    () =>
      registerHome({
        home: [homeLayer.current, dockLayer.current],
        dim: dimVeil.current,
        wallpaper: wallpaper.current,
      }),
    [],
  );
  useEffect(() => {
    const el = root.current;
    if (!el || pointer !== 'fine') return;
    return wallpaperParallax(el);
  }, [pointer]);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    return trackVisualViewport(el);
  }, []);

  // Layout swap phone ↔ full page: one 150 ms crossfade; the foreground app and its stack stay (IOS-RESP-06).
  const lastLayout = useRef(layout);
  useEffect(() => {
    if (lastLayout.current === layout) return;
    lastLayout.current = layout;
    root.current?.animate?.([{ opacity: 0.4 }, { opacity: 1 }], { duration: 150 });
  }, [layout]);

  // Apps' code loads one by one in idle time after Home paints, so a first open never waits.
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;
    const controller = new AbortController();
    warmApps(['files', 'github', 'browser', 'mail', 'notes', 'messages', 'settings'], controller.signal);
    return () => controller.abort();
  }, []);

  // --- Banners -----------------------------------------------------------------------------------------------------------
  const canShowBanner = useCallback(
    () => bannerMayShow({ flying, locked: lock, booting: false, notificationsOn }),
    [flying, lock, notificationsOn],
  );
  const notify = useCallback(
    (banner: BannerSpec) => {
      if (overlayKind === 'center' || !notificationsOn)
        bannerEvent({ type: 'push', banner, canShow: false, now: Date.now() });
      else bannerEvent({ type: 'push', banner, canShow: canShowBanner(), now: Date.now() });
    },
    [canShowBanner, overlayKind, notificationsOn],
  );
  useEffect(() => {
    bannerEvent({ type: 'flush', canShow: canShowBanner() && overlayKind !== 'center', now: Date.now() });
  }, [canShowBanner, overlayKind]);
  const trigger = useCallback(
    (what: BannerTrigger, extra: Partial<BannerSpec> = {}) => notify({ ...bannerFor(what), ...extra }),
    [notify],
  );

  const announce = useCallback((message: string) => {
    const region = document.getElementById('system-status');
    if (!region) return;
    region.textContent = '';
    setTimeout(() => {
      region.textContent = message;
    }, 30);
  }, []);

  // --- Launching and going Home -------------------------------------------------------------------------------------------
  const closeTransients = useCallback(() => {
    setOverlay((current) => {
      if (!current) return current;
      if (current.kind === 'spotlight' || current.kind === 'control' || current.kind === 'center')
        return { ...current, closing: true };
      if (current.kind === 'switch-os' || current.kind === 'shortcuts') return { ...current, open: false };
      return null;
    });
  }, []);

  const launchApp = useCallback(
    (role: IosRole, location: AppLocation | undefined, origin: { key?: string; element?: HTMLElement | null } = {}) => {
      // A banner and a widget fly from their own box; everything else flies from the icon art inside it.
      const banner = origin.element?.closest<HTMLElement>('[data-banner]') ?? null;
      const whole = banner ?? (origin.key?.startsWith('widget:') ? (origin.element ?? null) : null);
      const art = whole ?? origin.element?.querySelector<HTMLElement>('[data-art]') ?? origin.element ?? null;
      const radius = banner
        ? 24
        : origin.key?.startsWith('widget:')
          ? 22
          : art && art !== origin.element
            ? undefined
            : 14;
      const visual = art ? visualOf(art, radius) : null;
      closeTransients();
      if (role === foregroundRef.current && !launch) {
        // Already in front: it navigates in place (one history entry for a new place).
        dispatch({ type: 'OPEN_APP', os: 'ios', role, location, originId: origin.element?.id ?? null });
        return;
      }
      if (origin.key) setOrigins((all) => ({ ...all, [role]: origin.key! }));
      const seq = ++launchSeq.current;
      pendingLaunch.current = { role, origin: visual, seq };
      setLaunch({ role, origin: visual, seq });
      // A launch the kernel never takes (an OS switch meanwhile) is dropped.
      setTimeout(() => setLaunch((current) => (current?.seq === seq ? null : current)), 1500);
      // Commit the foreground app and route together in this click task. The flight remains compositor-driven, but
      // the UI can no longer get stranded at a changed URL while a deferred OPEN_APP waits for another paint.
      dispatch({ type: 'OPEN_APP', os: 'ios', role, location, originId: origin.element?.id ?? null });
    },
    [closeTransients, launch],
  );

  const openContent = useCallback(
    (ref: ContentRef, origin: { key?: string; element?: HTMLElement | null } = {}) => {
      const role = OS_REGISTRY.ios.sectionOwner[ref.section];
      if (!isIosRole(role)) return;
      launchApp(role, { kind: 'content', ref }, origin);
    },
    [launchApp],
  );

  const goHome = useCallback(() => {
    flushQueued();
    setLaunch(null);
    closeTransients();
    const state = getKernel();
    if (state.sessions.ios.focused) dispatch({ type: 'GO_HOME' });
    else {
      // Already Home: the Home indicator returns to page 1.
      homeRef.current?.jumpTo(0);
      if (folder === 'open') setFolder('closing');
    }
  }, [closeTransients, folder]);

  // --- Overlays ------------------------------------------------------------------------------------------------------------
  /** Ask the arbiter; `true` when the request may open now (the open surface closed first if it had to). */
  const request = useCallback(
    (kind: IosOverlay): boolean => {
      const verdict = arbitrateIos(overlayOpen, kind);
      if (verdict === 'drop') return false;
      if (verdict === 'keep') return false;
      if (verdict === 'replace') {
        if (overlayOpen === 'folder') setFolder('closing');
        else closeTransients();
      }
      return true;
    },
    [overlayOpen, closeTransients],
  );

  const openSpotlight = useCallback(
    (from?: HTMLElement | null, query = '', interactive = false) => {
      if (!request('spotlight')) return;
      invoker.current = from ?? (document.getElementById('ios-search-pill') as HTMLElement | null);
      setOverlay((current) => ({
        kind: 'spotlight',
        closing: false,
        query,
        interactive,
        seq: current?.kind === 'spotlight' ? current.seq + 1 : 0,
      }));
    },
    [request],
  );
  const openControl = useCallback(
    (from?: HTMLElement | null, interactive = false) => {
      if (overlayOpen === 'control') {
        setOverlay((current) => (current?.kind === 'control' ? { ...current, closing: true } : current));
        return;
      }
      if (!request('control')) return;
      invoker.current = from ?? document.getElementById('ios-status-control');
      setOverlay({ kind: 'control', closing: false, interactive });
    },
    [request, overlayOpen],
  );
  const openCenter = useCallback(
    (from?: HTMLElement | null, interactive = false) => {
      if (overlayOpen === 'center') {
        setOverlay((current) => (current?.kind === 'center' ? { ...current, closing: true } : current));
        return;
      }
      if (!request('center')) return;
      invoker.current = from ?? document.getElementById('ios-status-center');
      setOverlay({ kind: 'center', closing: false, interactive });
    },
    [request, overlayOpen],
  );
  const openSwitcher = useCallback(() => {
    if (!request('switcher')) return;
    invoker.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    flushQueued();
    // Every warm app becomes a live card.
    setPhases((all) => {
      const next = { ...all };
      for (const role of mountedRoles) next[role] = 'switcher';
      return next;
    });
    switcherLive.current = true;
    setOverlay({ kind: 'switcher', closing: false });
  }, [request, mountedRoles]);
  const openSwitchOs = useCallback(
    (from?: HTMLElement | null) => {
      if (!request('switch-os')) return;
      const origin = from ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      invoker.current = origin;
      setOverlay({ kind: 'switch-os', open: true, from: origin });
    },
    [request],
  );
  /** Focus goes back in the commit that removes the overlay — while it is up, the invoker is still inside `inert`. */
  const restoring = useRef<HTMLElement | null>(null);
  const restoreFocus = useCallback(() => {
    restoring.current = invoker.current;
    invoker.current = null;
  }, []);
  useLayoutEffect(() => {
    const target = restoring.current;
    if (!target || overlay) return;
    restoring.current = null;
    if (target.isConnected && !target.closest('[inert]')) target.focus({ preventScroll: true });
    else if (document.activeElement === document.body || document.activeElement === null)
      document.querySelector<HTMLElement>(`[data-focus-key="${focusKeys.osHeading}"]`)?.focus({ preventScroll: true });
  }, [overlay]);
  const closedOverlay = useCallback(() => {
    setOverlay(null);
    restoreFocus();
  }, [restoreFocus]);

  const copy = useCallback(
    async (text: string, what?: string) => {
      const outcome = await copyText(text, typeof navigator === 'undefined' ? undefined : navigator.clipboard);
      if (outcome === 'copied') trigger({ kind: 'copied', what });
      return outcome === 'copied';
    },
    [trigger],
  );
  const downloadResume = useCallback(() => {
    const link = document.createElement('a');
    link.href = resume.file;
    link.download = resume.downloadName;
    link.rel = 'noopener';
    document.body.append(link);
    link.click();
    link.remove();
    analytics.track({ name: 'resume_downloaded', os: 'ios' });
    trigger(
      { kind: 'resume-saved' },
      {
        primary: (origin) => openContent({ section: 'resume' }, { element: origin ?? null }),
        actions: [{ label: 'Open in Files', primary: true, run: () => openContent({ section: 'resume' }) }],
      },
    );
  }, [resume.file, resume.downloadName, trigger, openContent]);

  // --- Quick actions ---------------------------------------------------------------------------------------------------
  const runCommand = useCallback(
    (command: QuickCommand, anchor: HTMLElement | null) => {
      switch (command.kind) {
        case 'open':
          launchApp(command.role, command.location, { key: anchor?.dataset.item, element: anchor });
          return;
        case 'download-resume':
          downloadResume();
          return;
        case 'copy-address':
          void copy(getContactEmail(), 'Email address');
          return;
        case 'copy-link':
          void copy(new URL(goHref(command.ref), window.location.origin).href, 'Link');
          return;
        case 'plain':
          window.open('/plain', '_self');
          return;
        case 'switch-os':
          openSwitchOs(anchor);
          return;
        case 'compose':
          requestIntent({ kind: 'compose' });
          launchApp('mail', undefined, { key: anchor?.dataset.item, element: anchor });
          return;
        case 'say-hello':
          requestIntent({ kind: 'say-hello' });
          launchApp('messages', undefined, { key: anchor?.dataset.item, element: anchor });
          return;
      }
    },
    [launchApp, openSwitchOs, downloadResume, copy],
  );

  const pinnedNotes = useMemo(
    () => [
      { id: 'skills', title: 'Skills' },
      { id: 'how-i-work', title: 'How I work' },
    ],
    [],
  );
  const showQuickActions = useCallback(
    (role: IosRole, anchor: HTMLElement, actions?: readonly QuickAction[]) => {
      if (!request('quick-actions')) return;
      const list = actions ?? quickActionsFor(role, { featured, pinnedNotes, hasPdf });
      setOverlay({
        kind: 'quick-actions',
        spec: {
          kind: 'icon',
          role,
          label: iosBinding(role).title,
          anchor,
          actions: list,
          onAction: (action) => {
            if (action.command.kind === 'open' && role === 'notes' && action.id.startsWith('note:'))
              requestIntent({ kind: 'note', note: action.id.slice(5) });
            if (action.id === 'accessibility') requestIntent({ kind: 'settings', screen: 'accessibility' });
            runCommand(action.command, anchor);
          },
        },
      });
    },
    [request, featured, pinnedNotes, hasPdf, runCommand],
  );
  const showWidgetActions = useCallback(
    (widget: WidgetId, anchor: HTMLElement) => {
      const target: ContentRef =
        widget === 'resume'
          ? { section: 'resume' }
          : widget === 'open-to-work'
            ? { section: 'contact' }
            : { section: 'projects', slug: widgetData.project?.slug ?? '' };
      const role = OS_REGISTRY.ios.sectionOwner[target.section] as IosRole;
      const actions = widgetActions(target, { kind: 'open', role, location: { kind: 'content', ref: target } }, hasPdf);
      if (!request('quick-actions')) return;
      setOverlay({
        kind: 'quick-actions',
        spec: {
          kind: 'icon',
          role: null,
          label: widget === 'resume' ? 'Résumé' : widget === 'open-to-work' ? 'Open to work' : 'Projects',
          anchor,
          actions,
          onAction: (action) => runCommand(action.command, anchor),
        },
      });
    },
    [request, runCommand, hasPdf, widgetData.project],
  );

  // --- Services ------------------------------------------------------------------------------------------------------------

  // --- The tour (shared/20, plans/ios/07) -------------------------------------------------------------------------------
  const [coach, setCoach] = useState<{ step: TourStep; index: number; total: number } | null>(null);
  const director = useRef<TourDirector | null>(null);
  const tourScript = useRef<TourScript | null>(null);
  const startTour = useCallback(() => {
    closeTransients();
    director.current?.cancel();
    const host = {
      dispatch: (action: Parameters<typeof dispatch>[0]) => {
        if (action.type === 'OPEN_APP' && action.role && isIosRole(action.role)) {
          const element = action.originId ? document.getElementById(action.originId) : null;
          launchApp(action.role, action.location, { key: element?.dataset.item, element });
        } else if (action.type === 'GO_HOME') goHome();
        else dispatchSoon(action);
      },
      show: (step: TourStep, index: number, total: number) => setCoach({ step, index, total }),
      announce,
      end: (reason: 'completed' | 'cancelled') => {
        setCoach(null);
        analytics.track({ name: reason === 'completed' ? 'tour_completed' : 'tour_cancelled', os: 'ios' });
        director.current = null;
      },
      reducedMotion: () => prefersReducedMotion(),
      setTimeout: (callback: () => void, ms: number) => window.setTimeout(callback, ms),
      clearTimeout: (handle: number) => window.clearTimeout(handle),
    };
    dispatchSoon({ type: 'SET_PREF', patch: { tourOffered: true } });
    analytics.track({ name: 'tour_started', os: 'ios' });
    void Promise.all([import('@/lib/tour'), import('@/lib/tour/scripts')]).then(
      ([{ createTourDirector }, { IOS_TOUR }]) => {
        tourScript.current = IOS_TOUR;
        director.current?.cancel();
        director.current = createTourDirector(IOS_TOUR, host);
        director.current.start();
      },
      () => trigger({ kind: 'offline' }),
    );
  }, [announce, closeTransients, goHome, launchApp, trigger]);

  // The tour advances when the app a step opened has landed; any route change or OS switch ends it.
  useEffect(
    () =>
      subscribeEffects(({ action, state }) => {
        const tour = director.current;
        if (!tour?.running) return;
        if (action.type === 'PHASE_DONE' && action.target.kind === 'window') {
          const step = tourScript.current?.steps[tour.index];
          if (step?.action?.type === 'OPEN_APP' && action.target.id === `ios:${step.action.role}`) tour.settled();
        }
        if (action.type === 'ROUTE_CHANGED' || state.transition.phase !== 'idle') tour.cancel();
      }),
    [],
  );
  useEffect(() => {
    if (!coach) return;
    const cancel = (event: Event) => {
      if ((event.target as Element).closest?.('[data-coach]')) return;
      if (event instanceof KeyboardEvent && ['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(event.key)) return;
      director.current?.cancel();
    };
    document.addEventListener('pointerdown', cancel, true);
    document.addEventListener('keydown', cancel, true);
    return () => {
      document.removeEventListener('pointerdown', cancel, true);
      document.removeEventListener('keydown', cancel, true);
    };
  }, [coach]);

  const services = useMemo<IosServices>(
    () => ({
      layout,
      landscape,
      notify,
      copy,
      copyLink: (ref, label) =>
        copy(new URL(goHref(ref), window.location.origin).href, label ? `Link to ${label}` : 'Link'),
      openApp: (role, location, origin) => {
        if (isIosRole(role)) launchApp(role, location, { element: origin ?? null });
      },
      openContent: (ref, origin) => openContent(ref, { element: origin ?? null }),
      goHome,
      preview: (spec: PreviewSpec) => {
        if (!request('quick-actions')) return;
        setOverlay({ kind: 'quick-actions', spec: { kind: 'preview', spec } });
      },
      quickActions: showQuickActions,
      openSwitchOs,
      switchOs: () => dispatchSoon({ type: 'SWITCH_OS', to: null, via: 'switch' }),
      startTour,
      openSpotlight: (from, query) => openSpotlight(from, query ?? ''),
      downloadResume,
      onScrollToTop: () => undefined,
      announce,
    }),
    [
      layout,
      landscape,
      notify,
      copy,
      launchApp,
      openContent,
      goHome,
      request,
      showQuickActions,
      openSwitchOs,
      startTour,
      openSpotlight,
      downloadResume,
      announce,
    ],
  );

  // --- Arrival: lock, welcome, tour offer, fly-in -------------------------------------------------------------------------
  useEffect(() => {
    if (lock) dispatch({ type: 'MARK_LOCK_SEEN', os: 'ios' });
  }, [lock]);

  const flyIn = useCallback(() => {
    const items = [
      ...(homeLayer.current?.querySelectorAll<HTMLElement>(
        '[data-page="0"] [data-cell], [data-widgets-block] [data-widget]',
      ) ?? []),
    ];
    const withColumns = items.map((el) => {
      const rect = el.getBoundingClientRect();
      return { el, column: Math.round(rect.left / Math.max(1, home.icon * 1.6)) };
    });
    arrivalFlyIn(withColumns, dockLayer.current);
  }, [home.icon]);

  const offerTour = useCallback(() => {
    setTimeout(() => {
      if (getPrefs().tourOffered || getKernel().activeOs !== 'ios') return;
      notify({
        ...bannerFor({ kind: 'tour-offer' }),
        primary: () => startTour(),
        actions: [
          { label: 'Start', primary: true, run: () => startTour() },
          { label: 'Not now', run: () => dispatchSoon({ type: 'SET_PREF', patch: { tourOffered: true } }) },
        ],
        onDismiss: () => dispatchSoon({ type: 'SET_PREF', patch: { tourOffered: true } }),
      });
    }, 1200);
  }, [notify, startTour]);

  // Mount: a chooser / switch arrival without a lock screen gets the fly-in and the tour offer.
  useEffect(() => {
    const state = getKernel();
    if (!lock && (state.arrival === 'chooser' || state.arrival === 'switch') && !state.sessions.ios.focused) flyIn();
    if (!lock && (state.arrival === 'chooser' || state.arrival === 'switch')) offerTour();
    // Once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unlocked = useRef(false);
  const unlock = useCallback(() => {
    setLock(false);
    flyIn();
    trigger(
      { kind: 'welcome' },
      {
        primary: (origin) => openSpotlight(origin ?? null),
        actions: [{ label: 'Search', primary: true, run: () => openSpotlight(null) }],
      },
    );
    offerTour();
    unlocked.current = true;
  }, [flyIn, trigger, offerTour, openSpotlight]);
  // Arrival focus (shared/09): the OS heading, as after any chooser entry — never <body>. In the commit that lifts the
  // lock (the unlock runs from an animation callback, so a timer could fire while <main> is still inert).
  useLayoutEffect(() => {
    if (lock || !unlocked.current) return;
    unlocked.current = false;
    document.querySelector<HTMLElement>(`[data-focus-key="${focusKeys.osHeading}"]`)?.focus({ preventScroll: true });
  }, [lock]);

  // --- Continuity (shared/16): the Handoff banner, the switcher card, the lock variant -----------------------------------
  const [handoff, setHandoff] = useState<{ title: string; from: string; role: IosRole; ref: ContentRef } | null>(null);
  useEffect(() => {
    const offer = (state = getKernel()) => {
      const ref = continuityOffer(state, contentIndex, OS_REGISTRY, Date.now());
      if (!ref || !state.continuity) return;
      const title = contentIndex.get(ref)?.title ?? '';
      const role = OS_REGISTRY.ios.sectionOwner[ref.section] as IosRole;
      const from = OS_NAMES[state.continuity.fromOs];
      const fromOs = state.continuity.fromOs;
      analytics.track({ name: 'continuity_offered', from: fromOs, to: 'ios', section: ref.section });
      setHandoff({ title, from, role, ref });
      const accept = (origin?: HTMLElement | null) => {
        analytics.track({ name: 'continuity_accepted', from: fromOs, to: 'ios', section: ref.section });
        openContent(ref, { element: origin ?? null });
        dispatchSoon({ type: 'CONTINUITY_DISMISS' });
        setHandoff(null);
        bannerEvent({ type: 'remove', id: 'handoff' });
      };
      acceptHandoff.current = accept;
      if (lock) return; // the lock screen shows it as its third notification
      notify({
        ...bannerFor({ kind: 'handoff', title, from, role }),
        primary: (origin) => accept(origin),
        expires: Date.now() + 10 * 60 * 1000,
        actions: [
          { label: 'Open', primary: true, run: () => accept(null) },
          {
            label: 'Dismiss',
            run: () => {
              dispatchSoon({ type: 'CONTINUITY_DISMISS' });
              setHandoff(null);
            },
          },
        ],
      });
    };
    if (getKernel().transition.phase === 'idle') offer();
    return subscribeEffects(({ state, previous }) => {
      if (state.activeOs === 'ios' && state.transition.phase === 'idle' && previous.transition.phase !== 'idle')
        offer(state);
    });
    // Offered once per arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const acceptHandoff = useRef<((origin?: HTMLElement | null) => void) | null>(null);

  // Offline / online: the content still works.
  useEffect(() => {
    const offline = () => trigger({ kind: 'offline' });
    const online = () => {
      bannerEvent({ type: 'remove', id: 'offline' });
      trigger({ kind: 'online' });
    };
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
    };
  }, [trigger]);

  // --- Eggs -----------------------------------------------------------------------------------------------------------------
  const findEgg = useCallback((id: string) => {
    const found = recordEgg(getPrefs().eggsFound, id);
    if (!found) return;
    dispatchSoon({ type: 'SET_PREF', patch: { eggsFound: found } });
    analytics.track({ name: 'egg_found', id });
  }, []);
  const noJiggle = useCallback(() => {
    findEgg('EGG-SHAKE-01');
    notify({
      id: 'no-jiggle',
      role: null,
      app: 'Home Screen',
      title: 'No jiggle mode here — everything is already where it should be.',
    });
  }, [findEgg, notify]);

  // --- Keyboard (shared/09 registry; plans/ios/05) ------------------------------------------------------------------------
  const konami = useRef(createKonami());
  const back = useCallback(() => {
    // Esc = back one level: overlay → pushed screen → Home; never closes the OS (IOS-A11Y-05).
    if (overlay && overlay.kind !== 'quick-actions') {
      if (overlay.kind === 'switcher') {
        dismissSwitcher.current();
        return true;
      }
      closeTransients();
      return true;
    }
    if (folder === 'open') {
      setFolder('closing');
      return true;
    }
    if (!foregroundRef.current) return false;
    const surface = handles.current.get(foregroundRef.current)?.element;
    const modal = surface?.querySelector<HTMLElement>('[aria-modal="true"] [data-modal-dismiss]');
    if (modal) {
      modal.click();
      return true;
    }
    const backButton = surface?.querySelector<HTMLElement>('[data-screen]:not([hidden]):not([inert]) [data-back]');
    if (backButton) {
      backButton.click();
      return true;
    }
    goHome();
    return true;
  }, [overlay, folder, closeTransients, goHome]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || lock) return;
      const typing = inTextField(event.target);
      if (!typing && konami.current.push(event.key)) {
        findEgg('EGG-KONAMI-01');
        setShimmer(true);
        setTimeout(() => setShimmer(false), 1400);
        notify({
          id: 'konami',
          role: null,
          app: 'iOS',
          title: 'Cheat code accepted',
          body: 'Nothing unlocked — you already have full access.',
        });
      }
      const shortcut = matchShortcut(event, { inTextField: typing, singleKeyShortcuts: singleKeys });
      if (!shortcut) return;
      switch (shortcut) {
        case 'search':
        case 'search-slash':
          openSpotlight(document.activeElement as HTMLElement | null);
          break;
        case 'help':
          invoker.current = document.activeElement as HTMLElement | null;
          setOverlay({ kind: 'shortcuts', open: true });
          break;
        case 'home':
          goHome();
          break;
        case 'overview':
          openSwitcher();
          break;
        case 'switch-os':
          dispatchSoon({ type: 'SWITCH_OS', to: null, via: 'switch' });
          break;
        case 'focus-dock':
          root.current?.querySelector<HTMLElement>('[data-dock] [data-roving-item][tabindex="0"]')?.focus();
          break;
        case 'dismiss':
          if (coach) director.current?.cancel();
          else if (!back()) return;
          break;
        default:
          return;
      }
      event.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lock, singleKeys, coach, back, findEgg, notify, openSpotlight, goHome, openSwitcher]);

  // --- The Home gesture (plans/ios/02 `IOS-FLIGHT-03`) --------------------------------------------------------------------
  const onIndicatorDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button > 0) return;
    const role = foregroundRef.current;
    let longPressed = false;
    const longTimer = setTimeout(() => {
      longPressed = true;
      openSwitcher();
    }, 500);
    const page = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
    let lastTravel = 0;
    // Release kinematics come from the pointer events (timestamps), not from rendered frames (releaseKinematics).
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const samples: PointerSample[] = [{ t: event.timeStamp, y: event.clientY }];
    let release: PointerSample | null = null;
    const sampling = new AbortController();
    const record = (next: Event) => {
      const pointer = next as PointerEvent;
      if (pointer.pointerId !== pointerId) return;
      const sample = { t: pointer.timeStamp, y: pointer.clientY };
      // A finger that moved is not a long press, whatever the frame clock is doing.
      if (Math.hypot(pointer.clientX - startX, pointer.clientY - samples[0]!.y) >= 4) clearTimeout(longTimer);
      if (pointer.type === 'pointerup') release = sample;
      else if (samples.push(sample) > 48) samples.shift();
    };
    window.addEventListener('pointermove', record, { capture: true, passive: true, signal: sampling.signal });
    window.addEventListener('pointerup', record, { capture: true, passive: true, signal: sampling.signal });
    drag(event.currentTarget, event.nativeEvent, {
      threshold: 4,
      onStart: () => clearTimeout(longTimer),
      onMove: (dx, dy) => {
        if (!role) return;
        const handle = handles.current.get(role);
        if (!handle) return;
        const { visual, travel } = gestureVisual(page, dx, dy);
        lastTravel = travel;
        handle.motion.drive(visual);
      },
      onEnd: ({ moved }) => {
        clearTimeout(longTimer);
        sampling.abort();
        if (!moved) {
          if (!longPressed) goHome();
          return;
        }
        if (!role) return;
        // A finger held still before release has paused (no move events arrive while it rests).
        const end = release ?? samples[samples.length - 1]!;
        const kinematics = releaseKinematics(release ? samples : samples.slice(0, -1), end);
        const outcome = homeOutcome({
          travel: lastTravel,
          velocity: kinematics.velocity / (page.h * 0.62),
          pausedMs: kinematics.stillMs,
          speedPx: Math.abs(kinematics.velocity),
        });
        const handle = handles.current.get(role);
        if (outcome === 'home') goHome();
        else if (outcome === 'switcher') openSwitcher();
        else void handle?.motion.toward(fullVisual(), IOS_SPRINGS.homeSettle);
      },
    });
  };

  // --- Pull-downs: Spotlight on Home; Notification / Control Center from the status bar ----------------------------------
  const pulled = useRef(0);
  const onPull = (dy: number) => {
    if (dy < 12) return;
    if (overlay?.kind !== 'spotlight') {
      if (overlayOpen || folder) return;
      openSpotlight(document.getElementById('ios-search-pill'), '', true);
    }
    spotlightRef.current?.setProgress(dy / 60);
  };
  const onPullEnd = (dy: number, velocity: number) => {
    if (overlay?.kind !== 'spotlight' && dy < 12) return;
    if (dy + velocity * 0.499 >= 60) {
      spotlightRef.current?.setProgress(1);
      setOverlay((current) => (current?.kind === 'spotlight' ? { ...current, interactive: false } : current));
    } else setOverlay((current) => (current?.kind === 'spotlight' ? { ...current, closing: true } : current));
  };
  const onStatusPull = (zone: 'center' | 'control', event: React.PointerEvent<HTMLElement>) => {
    if (event.button > 0) return;
    let opened = false;
    let velocity = 0;
    let last = { t: performance.now(), y: 0 };
    const selector = zone === 'center' ? '[data-notification-center]' : '[data-control-center]';
    drag(event.currentTarget, event.nativeEvent, {
      threshold: 10,
      onMove: (_dx, dy) => {
        if (dy <= 0) return;
        if (!opened) {
          opened = true;
          pulled.current = Date.now();
          if (zone === 'center') openCenter(event.currentTarget as HTMLElement, true);
          else openControl(event.currentTarget as HTMLElement, true);
        }
        const t = performance.now();
        if (t > last.t) velocity = ((dy - last.y) / (t - last.t)) * 1000;
        last = { t, y: dy };
        const el = document.querySelector<HTMLElement>(selector);
        if (el) {
          const p = Math.min(1, dy / 220);
          el.style.opacity = String(p);
          el.style.transform = `translateY(${(p - 1) * 40}px)`;
        }
      },
      onEnd: ({ dy, moved }) => {
        if (!moved || !opened) return;
        pulled.current = Date.now();
        const el = document.querySelector<HTMLElement>(selector);
        if (el) {
          el.style.opacity = '';
          el.style.transform = '';
        }
        if (dy + velocity * 0.499 < 110) closeTransients();
      },
    });
  };

  // --- The App Switcher's flights -----------------------------------------------------------------------------------------
  const switcherPlaced = useRef(new Set<IosRole>());
  const onSwitcherFrame = useCallback((role: IosRole, visual: Visual) => {
    const handle = handles.current.get(role);
    if (!handle || !switcherLive.current) return;
    if (!switcherPlaced.current.has(role)) {
      switcherPlaced.current.add(role);
      void handle.motion.toward(visual, IOS_SPRINGS.homeSettle);
    } else if (!handle.motion.moving()) handle.motion.set(visual);
    else void handle.motion.toward(visual, IOS_SPRINGS.homeSettle);
  }, []);
  const endSwitcher = useCallback((keep: IosRole | null) => {
    switcherLive.current = false;
    switcherPlaced.current.clear();
    setOverlay((current) => (current?.kind === 'switcher' ? { ...current, closing: true } : current));
    setPhases((all) => {
      const next = { ...all };
      for (const [role, phase] of Object.entries(all) as [IosRole, SurfaceState][])
        if (phase === 'switcher' && role !== keep) next[role] = 'background';
      return next;
    });
  }, []);
  const dismissSwitcherNow = useCallback(() => {
    const role = kernelRole;
    endSwitcher(role);
    if (role) {
      // The app in front flies from its card back into its icon.
      previousForeground.current = null;
      void closeSurface(role);
      flushQueued();
      dispatch({ type: 'GO_HOME' });
    }
  }, [kernelRole, endSwitcher, closeSurface]);
  useLayoutEffect(() => {
    dismissSwitcher.current = dismissSwitcherNow;
  }, [dismissSwitcherNow]);
  const switcherOpen = (role: IosRole, slot: HTMLElement) => {
    endSwitcher(role);
    const handle = handles.current.get(role);
    if (handle && role === kernelRole) {
      setPhase(role, 'opening');
      void handle.motion.toward(fullVisual(), IOS_SPRINGS.open).then((end) => settleOpen(role, end));
      handle.element.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
      return;
    }
    if (kernelRole) {
      previousForeground.current = null;
      void closeSurface(kernelRole);
    }
    if (handle) {
      setPhase(role, 'opening');
      setLaunch({ role, origin: null, seq: ++launchSeq.current });
      previousForeground.current = role;
      handledLaunch.current = launchSeq.current;
      void handle.motion.toward(fullVisual(), IOS_SPRINGS.open).then((end) => settleOpen(role, end));
      handle.element.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
      dispatch({ type: 'OPEN_APP', os: 'ios', role, originId: null });
    } else launchApp(role, undefined, { element: slot });
  };
  const switcherClose = (role: IosRole) => {
    flushQueued();
    const id = `ios:${role}` as WindowId;
    if (getKernel().sessions.ios.focused === id) {
      previousForeground.current = null;
      dispatch({ type: 'GO_HOME' });
    }
    dispatch({ type: 'CLOSE_WINDOW', id });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
    switcherPlaced.current.delete(role);
    setPhases((all) => {
      const next = { ...all };
      delete next[role];
      return next;
    });
    setOrigins((all) => {
      const next = { ...all };
      delete next[role];
      return next;
    });
    announce(`${iosBinding(role).title} closed`);
  };

  // --- The Switch OS exit beat (plans/04 "The exit transition", plans/ios/07) ----------------------------------------------
  useEffect(() => {
    let beat: ReturnType<typeof exitBeat> | null = null;
    let releaseClaim: (() => void) | null = null;
    const unsubscribe = subscribeEffects(({ state, previous }) => {
      const t = state.transition;
      if (
        t.phase === 'exiting' &&
        t.from === 'ios' &&
        previous.activeOs === 'ios' &&
        previous.transition.phase === 'idle' &&
        root.current
      ) {
        const { epoch, to } = t;
        releaseClaim = claimPhases(epoch, ['exiting']);
        director.current?.cancel();
        const role = foregroundRef.current;
        const run = () => {
          beat = exitBeat(
            {
              icons: [...(root.current?.querySelectorAll<HTMLElement>('[data-page] [data-cell], [data-widget]') ?? [])],
              chrome: [dockLayer.current, root.current?.querySelector<HTMLElement>('[data-status-bar]')].filter(
                (el): el is HTMLElement => el !== null && el !== undefined,
              ),
            },
            () => {
              beat = null;
              if (!(to === null && handOffExit({ epoch, from: 'ios', to })))
                dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch } });
            },
          );
        };
        // The foreground app closes into its icon (fast), then the icons scale away.
        if (role) void closeSurface(role, { fast: true }).then(run);
        else run();
        return;
      }
      if (t.phase === 'entering' && t.reverse && t.to === 'ios' && beat) {
        const { epoch } = t;
        const release = claimPhases(epoch, ['entering']);
        beat.reverse(() => {
          release();
          dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch } });
        });
        beat = null;
      }
    });
    return () => {
      unsubscribe();
      beat?.kill();
      releaseClaim?.();
    };
    // Bound once; reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Any route change or OS switch closes transient surfaces.
  useEffect(
    () =>
      subscribeEffects(({ action, state }) => {
        if (action.type === 'SWITCH_OS' || (action.type === 'ROUTE_CHANGED' && state.transition.phase !== 'idle'))
          closeTransients();
      }),
    [closeTransients],
  );

  // --- Launch handlers for Home items --------------------------------------------------------------------------------------
  const onLaunch = useCallback(
    (role: IosRole, location: AppLocation | undefined, origin: LaunchOrigin) =>
      launchApp(role, location, { key: origin.key, element: origin.element }),
    [launchApp],
  );
  const onOpenContent = useCallback(
    (ref: ContentRef, origin: LaunchOrigin) => openContent(ref, { key: origin.key, element: origin.element }),
    [openContent],
  );
  /** The launcher focus key sits on the item the app last opened from (so closing focuses *that* icon). */
  const focusKeyFor = useCallback(
    (role: IosRole, itemKey: string) => {
      const origin = origins[role];
      const primary = homeItemFor(role) ?? `dock:${role}`;
      const holder = origin && !origin.startsWith('folder:') && !origin.startsWith('widget:') ? origin : primary;
      return holder === itemKey ? focusKeys.launcher('ios', role) : undefined;
    },
    [origins],
  );
  const folderFocusKey = origins.files?.startsWith('folder:') ? focusKeys.launcher('ios', 'files') : undefined;

  const lockList: readonly LockNotification[] = useMemo(() => {
    const featuredName = featured[0]?.name ?? null;
    return lockNotifications({
      updatedLabel: formatUpdated(resume.updated),
      projects: enriched.length,
      featuredName,
      openTo: person.openTo,
      continuity: handoff ? { title: handoff.title, from: handoff.from, role: handoff.role, ref: handoff.ref } : null,
    }).filter((item) => !lockCleared.includes(item.id));
  }, [featured, resume.updated, enriched.length, person.openTo, handoff, lockCleared]);

  // --- Render ------------------------------------------------------------------------------------------------------------
  const statusStyle = statusStyleFor(covered || flying ? foreground : null, dark);
  const recents = dockRecents(
    [...zOrder]
      .reverse()
      .map((id) => parseWindowId(id).role)
      .filter((role) => windows[`ios:${role}` as WindowId]),
  );
  // A quick-actions menu is modal: everything behind it is inert (plans/ios/surfaces/quick-actions "Accessibility").
  const menuOpen = overlayKind === 'quick-actions';
  const homeInert = foreground !== null || lock || overlayKind === 'switcher' || menuOpen;
  const switcherApps = zOrder
    .map((id) => roleOf(id))
    .filter((role): role is IosRole => role !== null && isIosRole(role) && !!windows[`ios:${role}` as WindowId]);
  const liveCards = new Set(mountedRoles);
  const systemSheets: SheetHost = { layer: systemLayer, setOpen: () => undefined };

  const surfaceState = (role: IosRole): SurfaceState =>
    phases[role] ?? (role === foreground ? 'opening' : 'background');

  return (
    <IosShellProvider value={services}>
      <SheetHostContext.Provider value={systemSheets}>
        <div
          ref={root}
          className={styles.ios}
          data-os-chunk={OS_CHUNK_MARKER}
          data-ios-layout={layout}
          data-landscape={landscape || undefined}
          data-ios-dark={dark || undefined}
          data-covered={covered || undefined}
          data-locked={lock || undefined}
          data-shimmer={shimmer || undefined}
          data-transient={(overlayOpen !== null && overlayOpen !== 'quick-actions') || undefined}
          data-wallpaper-official={WALLPAPER ? '' : undefined}
          style={{
            ['--icon' as string]: `${home.icon}px`,
            ['--squircle-mask' as string]: SQUIRCLE_MASK,
            ...(WALLPAPER ? { ['--wallpaper-ios-official' as string]: `url("${WALLPAPER}")` } : {}),
          }}
        >
          <div ref={wallpaper} className={styles.wallpaper} aria-hidden="true" data-wallpaper="" />

          <StatusBar
            layout={layout}
            landscape={landscape}
            style={statusStyle}
            appOpen={foreground !== null}
            centerOpen={overlayKind === 'center'}
            controlOpen={overlayKind === 'control'}
            onCenter={(from) => {
              if (Date.now() - pulled.current < 400) return;
              openCenter(from);
            }}
            onControl={(from) => {
              if (Date.now() - pulled.current < 400) return;
              openControl(from);
            }}
            onScrollTop={() => {
              const role = foregroundRef.current;
              if (role) scrollStackToTop(handles.current.get(role)?.element ?? null);
            }}
            onPullStart={onStatusPull}
          />

          <main
            className={styles.main}
            data-focus-key={focusKeys.home('ios')}
            tabIndex={-1}
            aria-hidden={lock || undefined}
            inert={lock || undefined}
          >
            {heading}
            <div
              ref={homeLayer}
              className={styles.homeLayer}
              data-home-layer=""
              inert={homeInert || undefined}
              aria-hidden={homeInert || undefined}
            >
              <Home
                ref={homeRef}
                layout={home}
                shortcuts={shortcuts}
                widgets={widgetData}
                badges={badges}
                folderOpen={folder === 'open'}
                flying={flyingItem}
                initialPage={rememberedPage}
                onPage={(page) => {
                  rememberedPage = page;
                }}
                onFolder={(button) => {
                  if (!request('folder')) return;
                  folderButton.current = button;
                  setFolder('open');
                }}
                onSearch={(from) => openSpotlight(from)}
                onOpenContent={onOpenContent}
                onWidgetActions={showWidgetActions}
                onDownload={downloadResume}
                onPull={onPull}
                onPullEnd={onPullEnd}
                onEmptyLongPress={noJiggle}
                onLaunch={onLaunch}
                onQuickActions={showQuickActions}
                onPrefetch={prefetchApp}
                focusKeyFor={focusKeyFor}
                folderFocusKey={folderFocusKey}
              />
            </div>
            <div ref={dimVeil} className={styles.dimVeil} aria-hidden="true" />
            {folder ? (
              <FolderPanel
                shortcuts={shortcuts}
                closing={folder === 'closing'}
                origin={() =>
                  document.getElementById('ios-icon-folder:career')?.querySelector<HTMLElement>('[data-art]') ?? null
                }
                onClose={() => setFolder('closing')}
                onClosed={() => {
                  setFolder(null);
                  setTimeout(() => folderButton.current?.focus({ preventScroll: true }), 0);
                }}
                onOpenItem={onOpenContent}
              />
            ) : null}
            {overlay?.kind === 'switcher' ? <div className={styles.switcherUnder} aria-hidden="true" /> : null}
            <div className={styles.apps} data-apps="">
              {mountedRoles.map((role) => (
                <AppSurface
                  key={role}
                  id={`ios:${role}` as WindowId}
                  role={role}
                  state={surfaceState(role)}
                  layout={layout}
                  landscape={landscape}
                  dark={dark}
                  register={register}
                  onHome={goHome}
                  covered={menuOpen}
                />
              ))}
            </div>
          </main>

          <div
            ref={dockLayer}
            className={styles.dockLayer}
            inert={homeInert || undefined}
            aria-hidden={homeInert || undefined}
          >
            <Dock
              layout={home}
              recents={recents}
              badges={badges}
              flying={flyingItem}
              onLaunch={onLaunch}
              onQuickActions={showQuickActions}
              onPrefetch={prefetchApp}
              focusKeyFor={focusKeyFor}
            />
          </div>

          <HomeIndicator
            style={statusStyle}
            layout={layout}
            buttonRef={indicator}
            onPointerDown={onIndicatorDown}
            onActivate={goHome}
            hidden={lock}
          />

          {overlay?.kind === 'switcher' ? (
            <Switcher
              layout={layout}
              apps={switcherApps}
              live={liveCards}
              current={kernelRole}
              dark={dark}
              handoff={handoff}
              closing={overlay.closing}
              onFrame={onSwitcherFrame}
              onOpen={switcherOpen}
              onCloseApp={switcherClose}
              onHandoff={(slot) => {
                endSwitcher(null);
                acceptHandoff.current?.(slot);
              }}
              onDismiss={() => dismissSwitcher.current()}
              onClosed={closedOverlay}
            />
          ) : null}

          {overlay?.kind === 'spotlight' ? (
            <Spotlight
              key={overlay.seq}
              ref={spotlightRef}
              layout={layout}
              initialQuery={overlay.query}
              closing={overlay.closing}
              interactive={overlay.interactive}
              onClose={() =>
                setOverlay((current) => (current?.kind === 'spotlight' ? { ...current, closing: true } : current))
              }
              onClosed={closedOverlay}
              onChoose={(choice: SpotlightChoice) => {
                switch (choice.kind) {
                  case 'app':
                    launchApp(choice.role, undefined, { element: choice.origin });
                    break;
                  case 'content':
                    openContent(choice.ref, { element: choice.origin });
                    break;
                  case 'plain':
                    window.open(`/plain${choice.query ? `#${encodeURIComponent(choice.query)}` : ''}`, '_self');
                    break;
                  case 'linux':
                    // Insert-only, and only after the visitor chose to switch (IOS-SPOT-04).
                    offerCommand(choice.command, 'ios');
                    closeTransients();
                    dispatchSoon({ type: 'SWITCH_OS', to: 'linux' as OsId, via: 'switch' });
                    break;
                  case 'action':
                    closeTransients();
                    switch (choice.action) {
                      case 'switch-os':
                        openSwitchOs(null);
                        break;
                      case 'toggle-sound': {
                        const sound = getPrefs().sound;
                        dispatchSoon({ type: 'SET_PREF', patch: { sound: { ...sound, enabled: !sound.enabled } } });
                        break;
                      }
                      case 'reduce-motion':
                        dispatchSoon({
                          type: 'SET_PREF',
                          patch: { motion: getPrefs().motion === 'reduced' ? 'system' : 'reduced' },
                        });
                        break;
                      case 'open-resume':
                        openContent({ section: 'resume' });
                        break;
                      case 'start-tour':
                        startTour();
                        break;
                      case 'show-shortcuts':
                        setOverlay({ kind: 'shortcuts', open: true });
                        break;
                    }
                    break;
                }
              }}
            />
          ) : null}

          {overlay?.kind === 'control' ? (
            <ControlCenter
              layout={layout}
              closing={overlay.closing}
              interactive={overlay.interactive}
              dark={dark}
              brightness={brightness}
              openTo={person.openTo}
              onBrightness={setBrightness}
              onClose={closeTransients}
              onClosed={closedOverlay}
              onNow={(from) => openContent({ section: 'contact' }, { element: from })}
              onSwitchOs={(from) => {
                void from;
                const control = document.getElementById('ios-status-control');
                invoker.current = control;
                setOverlay({ kind: 'switch-os', open: true, from: control });
              }}
              onResume={(from) => openContent({ section: 'resume' }, { element: from })}
              onTour={startTour}
              onSwitcher={() => {
                setOverlay(null);
                setTimeout(openSwitcher, 0);
              }}
            />
          ) : null}

          {overlay?.kind === 'center' ? (
            <NotificationCenter
              items={banners.center}
              layout={layout}
              closing={overlay.closing}
              interactive={overlay.interactive}
              onRun={(item: CenterItem, origin) => {
                closeTransients();
                bannerEvent({ type: 'remove', id: item.id });
                if (item.primary) item.primary(origin);
                else item.actions?.find((action) => action.primary)?.run();
              }}
              onRemove={(id) => bannerEvent({ type: 'remove', id })}
              onClear={(app) => bannerEvent({ type: 'clear', app })}
              onClose={closeTransients}
              onClosed={closedOverlay}
            />
          ) : null}

          {overlay?.kind === 'quick-actions' ? (
            <QuickActions
              spec={overlay.spec}
              layout={layout}
              onClose={() => {
                // The menu returns focus to its anchor while the app behind it is still inert: do it again in the
                // commit that lifts `inert`, or focus would land on nothing (IOS-QA-02).
                restoring.current = overlay.spec.kind === 'icon' ? overlay.spec.anchor : overlay.spec.spec.anchor;
                setOverlay(null);
              }}
            />
          ) : null}

          <div ref={setSystemLayer} className={styles.systemSheets} data-system-sheets="" />
          <SwitchOsSheet
            open={overlay?.kind === 'switch-os' && overlay.open}
            onCancel={() =>
              setOverlay((current) => (current?.kind === 'switch-os' ? { ...current, open: false } : current))
            }
            onChoose={(os) => {
              setOverlay(null);
              dispatchSoon({ type: 'SWITCH_OS', to: os, via: 'switch' });
            }}
            returnFocus={overlay?.kind === 'switch-os' ? overlay.from : null}
          />
          <ShortcutsSheet
            open={overlay?.kind === 'shortcuts' && overlay.open}
            onCancel={() =>
              setOverlay((current) => (current?.kind === 'shortcuts' ? { ...current, open: false } : current))
            }
            onTour={() => {
              setOverlay(null);
              startTour();
            }}
          />

          <section
            className={styles.bannerRegion}
            aria-label="Notifications"
            role="status"
            aria-live="polite"
            data-banner-region=""
          >
            {banners.shown ? (
              <Banner
                key={banners.shown.id}
                banner={banners.shown}
                layout={layout}
                onDone={(id, reason) => {
                  if (reason === 'swipe') banners.shown?.onDismiss?.();
                  bannerEvent({ type: 'done', id, canShow: canShowBanner(), now: Date.now() });
                }}
              />
            ) : null}
          </section>

          {coach ? (
            <CoachMark
              step={coach.step}
              index={coach.index}
              total={coach.total}
              onNext={() => director.current?.next()}
              onEnd={() => director.current?.cancel()}
            />
          ) : null}

          {lock ? (
            <LockScreen
              layout={layout}
              landscape={landscape}
              heading={`${person.name} — ${person.headline}`}
              openTo={person.openTo}
              notifications={lockList}
              onUnlock={unlock}
              onClear={(id) => setLockCleared((all) => [...all, id])}
              onNotification={(notification, origin) => {
                if (notification.id === 'continuity') {
                  acceptHandoff.current?.(origin);
                  return;
                }
                if (notification.location?.kind === 'content')
                  openContent(notification.location.ref, { element: origin });
                else launchApp(notification.role, notification.location, { element: origin });
              }}
              onQuick={(ref, origin) => openContent(ref, { element: origin })}
            />
          ) : null}

          <div className={styles.brightness} aria-hidden="true" style={{ opacity: brightness }} data-brightness="" />
        </div>
      </SheetHostContext.Provider>
    </IosShellProvider>
  );
}

/**
 * An icon's rect as it will be at rest: Home and the Dock are scaled (0.92) while an app is in front, so the return
 * target is read with that scale lifted for the one measurement (same frame — nothing paints in between).
 */
function restingVisual(element: HTMLElement, radius?: number): Visual {
  const layers = [
    element.closest<HTMLElement>('[data-home-layer]'),
    element.closest('[data-dock]')?.parentElement ?? null,
  ].filter((el): el is HTMLElement => el !== null);
  const saved = layers.map((el) => el.style.transform);
  for (const el of layers) el.style.transform = '';
  const visual = visualOf(element, radius);
  layers.forEach((el, index) => (el.style.transform = saved[index]!));
  return visual;
}

/** The contact address (for the Mail quick action "Copy Address") — via the selectors, never typed. */
const getContactEmail = (): string => getContact().email;
