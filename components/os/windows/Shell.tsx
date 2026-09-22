'use client';
/**
 * The Windows 11 shell (lazy `windows` chunk) — plans/windows/. A taskbar-anchored desktop filling the page: the
 * storyboard's blue bloom wallpaper, desktop shortcuts top-left, free-floating windows with caption buttons on the right
 * that Snap, and the centred taskbar with Start, Search, Task View, the pinned apps, the pinned Résumé and the tray.
 * Landmarks in reading order (plans/windows/05 `WIN-A11Y-01`): main (the hidden `h1`, the desktop, then windows in
 * *open* order — z-index stacks, the DOM never reorders) → nav "Taskbar" last → the pre-existing status regions
 * (`#system-status` and the toast region). There is no menubar landmark: menus live inside windows.
 * Transient surfaces obey one arbiter (plans/windows/06 E20: dialog › menu › Start/Search › Task View › flyout › toast)
 * and one live-blur budget (≤ 3 `backdrop-filter` surfaces: the taskbar, then transient surfaces in arbiter order).
 * Postures (plans/windows/04): `pointer` full fidelity · `touch` tablet posture · `compact` — one maximized window above
 * the taskbar, Start/Search as full-height sheets that Back closes, Task View as the window switcher.
 */
import { Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { copyText, goHref } from '@/components/content';
import { contentIndex } from '@/data/content-index';
import type { ContentRef } from '@/data/schema';
import { analytics } from '@/lib/analytics/loader';
import { createKonami, recordEgg } from '@/lib/eggs';
import type { AppRole } from '@/lib/kernel/ids';
import { OS_NAMES } from '@/lib/kernel/ids';
import { matchShortcut } from '@/lib/kernel/keymap';
import { continuityOffer } from '@/lib/kernel/reducers';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import { pushTransientHistory } from '@/lib/kernel/route-sync';
import { isFocusable } from '@/lib/kernel/state';
import { focusKeys, type WindowId } from '@/lib/kernel/types';
import type { OsShellProps } from '@/lib/os-loaders';
import { prefersReducedMotion } from '@/lib/motion/dur';
import type { TourDirector, TourScript, TourStep } from '@/lib/tour';
import { useKernel, usePrefs } from '@/stores/kernel-context';
import { dispatch, dispatchSoon, flushQueued, getKernel, subscribeEffects } from '@/stores/kernel-store';
import { getPrefs } from '@/stores/prefs-store';
import { claimPhases, handOffExit } from '@/stores/transition-stage';
import { AppBody, subscribeAppFailures, warmApps } from './apps/AppBody';
import { requestIntent } from './intents';
import { OS_CHUNK_MARKER } from './marker';
import {
  chromeVars,
  keyboardSnap,
  LAUNCHER_ID,
  launcherPlaceholder,
  liveAcrylic,
  lockCards,
  TASKBAR_ORDER,
  toastMayShow,
  winBinding,
  winId,
  type Panel,
} from './model';
import { exitBeat } from './motion';
import {
  WinShellProvider,
  type ContextMenuSpec,
  type PropertiesSpec,
  type SearchRequest,
  type ToastSpec,
  type WinShellServices,
} from './shell-context';
import { WindowsBoot } from './surfaces/Boot';
import { Desktop } from './surfaces/Desktop';
import {
  CoachMark,
  Launcher,
  NotificationCenter,
  PropertiesDialog,
  QuickSettings,
  ShortcutsDialog,
  TaskView,
  warmSurfaces,
  Winver,
} from './surfaces/lazy';
import type { LauncherMode } from './surfaces/Launcher';
import { LockScreen } from './surfaces/LockScreen';
import { INITIAL_TOASTS, Toast, toastReducer, type CenterItem } from './surfaces/Notifications';
import { Taskbar } from './surfaces/Taskbar';
import { WinMenu } from './surfaces/WinMenu';
import { WinWindow, type WindowBodyProps } from './window/Window';
import styles from './windows.module.css';

export { OS_CHUNK_MARKER };

const bodyFor = (props: WindowBodyProps) => <AppBody {...props} />;

const inTextField = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/** Exit animations of panels (plans/windows/03): Start/Search 167 ms, flyouts 83 ms, Task View 250 ms. */
const PANEL_EXIT_MS: Readonly<Record<Panel, number>> = {
  start: 167,
  search: 167,
  taskview: 250,
  quick: 83,
  center: 83,
  combined: 167,
};

/** Surfaces that are sheets in compact mode: Back closes them first (plans/windows/04 `WIN-RESP-04`). */
const SHEETS: readonly Panel[] = ['start', 'search', 'taskview', 'combined'];

const TOUR_OFFER_DELAY_MS = 1200;

export default function WindowsShell({ heading }: OsShellProps) {
  const root = useRef<HTMLDivElement>(null);
  const viewport = useKernel((state) => state.viewport);
  const pointer = useKernel((state) => state.capabilities.pointer);
  const windows = useKernel((state) => state.sessions.windows.windows);
  const zOrder = useKernel((state) => state.sessions.windows.zOrder);
  const focused = useKernel((state) => state.sessions.windows.focused);
  const singleKeys = usePrefs((prefs) => prefs.singleKeyShortcuts);
  const align = usePrefs((prefs) => prefs.taskbarAlign);
  const notificationsOn = usePrefs((prefs) => prefs.notifications);
  const compact = viewport.posture === 'compact';
  const touch = viewport.posture === 'touch';
  const coarse = pointer === 'coarse';

  // --- Transient surfaces -------------------------------------------------------------------------------------------
  const [panel, setPanel] = useState<{
    which: Panel;
    closing: boolean;
    mode: LauncherMode;
    query: string;
    scope?: 'files';
  } | null>(null);
  const [menu, setMenu] = useState<ContextMenuSpec | null>(null);
  const [dialog, setDialog] = useState<
    { kind: 'winver' } | { kind: 'properties'; spec: PropertiesSpec } | { kind: 'shortcuts' } | null
  >(null);
  const [peek, setPeek] = useState<WindowId | null>(null);
  const [nightLight, setNightLight] = useState(false);
  const [failed, setFailed] = useState<ReadonlySet<AppRole>>(new Set());
  const [recent, setRecent] = useState<readonly string[]>([]);
  const [shimmer, setShimmer] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [toasts, toastEvent] = useReducer(toastReducer, INITIAL_TOASTS);
  const invoker = useRef<HTMLElement | null>(null);
  const release = useRef<(() => void) | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragging = useRef(false);

  // The lock screen: first chooser entry of the session only — never on a deep link, refresh, `/go` or re-entry
  // (`WIN-LOCK-02`). Decided once, before the first paint.
  const [lock, setLock] = useState<'shown' | null>(() => {
    const state = getKernel();
    return state.arrival === 'chooser' && !state.sessions.windows.lockSeen ? 'shown' : null;
  });
  const [lockOffer, setLockOffer] = useState<{ ref: ContentRef; title: string; from: string } | null>(null);
  const [booting, setBooting] = useState(false);

  const panelOpen = panel && !panel.closing ? panel.which : null;
  const centerOpen = panelOpen === 'center' || panelOpen === 'combined';

  const canShowToast = useCallback(
    () =>
      notificationsOn &&
      !lock &&
      !booting &&
      toastMayShow({ panel: panelOpen, menu: menu !== null, dialog: dialog !== null, dragging: dragging.current }),
    [notificationsOn, lock, booting, panelOpen, menu, dialog],
  );

  const announce = useCallback((message: string) => {
    const region = document.getElementById('system-status');
    if (!region) return;
    region.textContent = '';
    setTimeout(() => {
      region.textContent = message;
    }, 30);
  }, []);

  const notify = useCallback(
    (toast: ToastSpec) =>
      // With the Center open the notification appears directly in its list (no popup); otherwise it pops up when the
      // arbiter allows, or waits in the queue.
      toastEvent(
        centerOpen
          ? { type: 'center', toast, now: Date.now() }
          : { type: 'push', toast, canShow: canShowToast(), now: Date.now() },
      ),
    [canShowToast, centerOpen],
  );

  // Start / Search, Task View, the flyouts and dialogs load in idle time after the desktop paints (shell budget).
  useEffect(() => {
    const controller = new AbortController();
    warmSurfaces(controller.signal);
    return () => controller.abort();
  }, []);

  // The pinned apps' code loads one by one in idle time after the desktop paints, so a first open never waits (the
  // owner's "super smooth"); Data Saver keeps the hover / focus prefetch only.
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;
    const controller = new AbortController();
    warmApps(
      TASKBAR_ORDER.filter((role) => winBinding(role).pinned),
      controller.signal,
    );
    return () => controller.abort();
  }, []);

  // Whenever the arbiter frees up (a panel, menu or dialog closes; a drag ends), a queued toast may show.
  useEffect(() => {
    toastEvent({ type: 'flush', canShow: canShowToast() });
  }, [canShowToast]);

  const closePanel = useCallback((restoreFocus = true) => {
    release.current?.();
    release.current = null;
    setPanel((current) => {
      if (!current || current.closing) return current;
      if (exitTimer.current) clearTimeout(exitTimer.current);
      exitTimer.current = setTimeout(
        () => setPanel((now) => (now?.closing ? null : now)),
        PANEL_EXIT_MS[current.which],
      );
      return { ...current, closing: true };
    });
    if (restoreFocus) {
      const target = invoker.current;
      setTimeout(() => target?.isConnected && target.focus({ preventScroll: true }), 0);
    }
  }, []);

  const openPanel = useCallback(
    (which: Panel, from?: HTMLElement | null, extra: { query?: string; scope?: 'files' } = {}) => {
      setMenu(null);
      setPanel((current) => {
        if (current && !current.closing && current.which === which && !extra.query && !extra.scope) {
          // A second press of the same button closes it (focus returns to it).
          queueMicrotask(() => closePanel(true));
          return current;
        }
        if (exitTimer.current) clearTimeout(exitTimer.current);
        const mode: LauncherMode = which === 'search' ? 'search' : 'start';
        // Start and Search share one panel: switching between them morphs in place (no close/re-open).
        const morph =
          current &&
          !current.closing &&
          (current.which === 'start' || current.which === 'search') &&
          (which === 'start' || which === 'search');
        if (!morph) {
          release.current?.();
          release.current = null;
        }
        invoker.current = from ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
        return { which, closing: false, mode, query: extra.query ?? '', scope: extra.scope };
      });
    },
    [closePanel],
  );

  // Compact sheets take one transient Back entry: the browser / system Back closes the sheet first.
  useEffect(() => {
    if (!panelOpen || !compact || !SHEETS.includes(panelOpen) || release.current) return;
    release.current = pushTransientHistory(() => {
      release.current = null;
      closePanel(true);
    });
  }, [panelOpen, compact, closePanel]);

  // Outside presses close the open panel (not the taskbar button that toggles it; not a menu opened from it).
  useEffect(() => {
    if (!panelOpen) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (target.closest('[data-panel], [data-menu-anchor], [data-dialog-layer], [data-coach]')) return;
      if (target.closest('#tb-start, #tb-search, #tb-taskview, #tb-quick, #tb-clock, #tb-tray')) return;
      if (panelOpen === 'taskview') return; // Task View handles its own backdrop
      closePanel(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [panelOpen, closePanel]);

  // Any route change or OS switch closes transient surfaces (the epoch bump — plans/windows/surfaces/start-menu).
  useEffect(
    () =>
      subscribeEffects(({ action, state }) => {
        if (action.type === 'ROUTE_CHANGED' || action.type === 'SWITCH_OS') {
          setMenu(null);
          if (state.transition.phase !== 'idle' || action.type === 'SWITCH_OS') closePanel(false);
        }
      }),
    [closePanel],
  );

  // --- Services ------------------------------------------------------------------------------------------------------
  const snapPreviewEl = useRef<HTMLDivElement>(null);
  const copy = useCallback(
    async (text: string, message = 'Copied to clipboard') => {
      const outcome = await copyText(text, typeof navigator === 'undefined' ? undefined : navigator.clipboard);
      notify(
        outcome === 'copied'
          ? { id: `copied-${Date.now()}`, app: 'system', appName: 'Windows', title: message }
          : { id: `copy-blocked-${Date.now()}`, app: 'system', appName: 'Windows', title: "Couldn't copy", body: text },
      );
      if (outcome === 'copied') analytics.track({ name: 'contact_initiated', channel: 'copy' });
      return outcome === 'copied';
    },
    [notify],
  );

  // --- The guided tour (shared/20, plans/windows/07) ------------------------------------------------------------
  const [coach, setCoach] = useState<{ step: TourStep; index: number; total: number } | null>(null);
  const director = useRef<TourDirector | null>(null);
  /** The Windows script, loaded with the director when a tour first starts (shared/10: the tour is lazy). */
  const tourScript = useRef<TourScript | null>(null);
  const startTour = useCallback(() => {
    closePanel(false);
    setMenu(null);
    director.current?.cancel();
    const host = {
      dispatch: (action: Parameters<typeof dispatch>[0]) => dispatchSoon(action),
      show: (step: TourStep, index: number, total: number) => {
        setCoach({ step, index, total });
        if (step.id === 'start') openPanel('start', document.getElementById('tb-start'));
        else closePanel(false);
      },
      announce,
      end: (reason: 'completed' | 'cancelled') => {
        setCoach(null);
        closePanel(false);
        analytics.track({ name: reason === 'completed' ? 'tour_completed' : 'tour_cancelled', os: 'windows' });
        if (reason === 'completed')
          document.querySelector<HTMLElement>(`[data-focus-key="${focusKeys.home('windows')}"]`)?.focus();
        director.current = null;
      },
      reducedMotion: () => prefersReducedMotion(),
      setTimeout: (callback: () => void, ms: number) => window.setTimeout(callback, ms),
      clearTimeout: (handle: number) => window.clearTimeout(handle),
    };
    dispatchSoon({ type: 'SET_PREF', patch: { tourOffered: true } });
    analytics.track({ name: 'tour_started', os: 'windows' });
    void Promise.all([import('@/lib/tour'), import('@/lib/tour/scripts')]).then(
      ([{ createTourDirector }, { WINDOWS_TOUR }]) => {
        tourScript.current = WINDOWS_TOUR;
        director.current?.cancel();
        director.current = createTourDirector(WINDOWS_TOUR, host);
        director.current.start();
      },
      () =>
        notify({
          id: 'tour-failed',
          app: 'system',
          appName: 'Windows',
          title: "The tour couldn't load",
          body: 'Check your connection and try again.',
        }),
    );
  }, [announce, closePanel, openPanel, notify]);

  // Tour: an opened app settled → the director may advance; the snap step snaps Edge and GitHub side by side.
  useEffect(
    () =>
      subscribeEffects(({ action, state }) => {
        const tour = director.current;
        if (!tour?.running) return;
        if (action.type === 'PHASE_DONE' && action.target.kind === 'window') {
          const step = tourScript.current?.steps[tour.index];
          const opened = step?.action?.type === 'OPEN_APP' ? winId(step.action.role) : null;
          if (opened !== action.target.id) return;
          if (step?.id === 'snap') {
            dispatchSoon({ type: 'SNAP_WINDOW', id: winId('browser'), zone: 'left' });
            dispatchSoon({ type: 'SNAP_WINDOW', id: winId('github'), zone: 'right' });
          }
          tour.settled();
        }
        if (action.type === 'ROUTE_CHANGED' || state.transition.phase !== 'idle') tour.cancel();
      }),
    [],
  );
  // Any input outside the coach mark cancels the tour; its own buttons advance it.
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

  const services: WinShellServices = useMemo(
    () => ({
      announce,
      snapPreview: {
        show(rect, label) {
          const el = snapPreviewEl.current;
          if (!el) return;
          el.style.setProperty('--px', `${rect.x}px`);
          el.style.setProperty('--py', `${rect.y}px`);
          el.style.setProperty('--pw', `${rect.w}px`);
          el.style.setProperty('--ph', `${rect.h}px`);
          el.style.zIndex = String(99 + getKernel().sessions.windows.zOrder.length);
          el.hidden = false;
          el.dataset.visible = '';
          announce(label);
        },
        hide() {
          const el = snapPreviewEl.current;
          if (!el) return;
          delete el.dataset.visible;
          el.hidden = true;
        },
      },
      notify,
      openMenu: (spec) => setMenu(spec),
      openPanel: (which, from) => openPanel(which, from),
      closePanel: () => closePanel(false),
      openSearch: (request: SearchRequest) =>
        openPanel('search', request.invoker, { query: request.query, scope: request.scope }),
      runInTerminal: (command) => {
        closePanel(false);
        requestIntent({ kind: 'terminal-insert', command });
        dispatchSoon({ type: 'OPEN_APP', os: 'windows', role: 'terminal', originId: LAUNCHER_ID });
      },
      openWinver: () => setDialog({ kind: 'winver' }),
      startTour,
      showShortcuts: () => setDialog({ kind: 'shortcuts' }),
      copyLink: (ref, label) =>
        ref
          ? copy(new URL(goHref(ref), window.location.origin).href, label ? `Link to ${label} copied` : 'Link copied')
          : Promise.resolve(false),
      copyText: (text, message) => copy(text, message),
      openProperties: (spec) => setDialog({ kind: 'properties', spec }),
      setDragging: (value) => {
        dragging.current = value;
        if (!value) toastEvent({ type: 'flush', canShow: canShowToast() });
      },
      peek,
    }),
    [announce, notify, openPanel, closePanel, startTour, copy, peek, canShowToast],
  );

  // --- Toast triggers (plans/windows/surfaces/notification-center "Trigger table") -----------------------------------
  // Continuity (shared/16): offered when Windows settles after a switch, never auto-opened; the lock shows it as a card.
  useEffect(() => {
    const offer = (state = getKernel()) => {
      const ref = continuityOffer(state, contentIndex, OS_REGISTRY, Date.now());
      if (!ref || !state.continuity) return;
      const title = contentIndex.get(ref)?.title ?? '';
      const owner = winBinding(OS_REGISTRY.windows.sectionOwner[ref.section]);
      const from = OS_NAMES[state.continuity.fromOs];
      analytics.track({
        name: 'continuity_offered',
        from: state.continuity.fromOs,
        to: 'windows',
        section: ref.section,
      });
      const accept = () => {
        analytics.track({
          name: 'continuity_accepted',
          from: state.continuity!.fromOs,
          to: 'windows',
          section: ref.section,
        });
        dispatchSoon({ type: 'OPEN_APP', os: 'windows', role: owner.role, location: { kind: 'content', ref } });
        dispatchSoon({ type: 'CONTINUITY_DISMISS' });
        toastEvent({ type: 'remove', id: 'continuity' });
      };
      if (lock) {
        setLockOffer({ ref, title, from });
        return;
      }
      notify({
        id: 'continuity',
        app: owner.role,
        appName: owner.title,
        title: `Continue from ${from}`,
        body: `${title} — ${owner.title}`,
        primary: accept,
        expires: Date.now() + 10 * 60 * 1000,
        actions: [
          { label: 'Open', primary: true, run: accept },
          { label: 'Dismiss', run: () => dispatchSoon({ type: 'CONTINUITY_DISMISS' }) },
        ],
      });
    };
    if (getKernel().transition.phase === 'idle') offer();
    return subscribeEffects(({ state, previous }) => {
      if (state.activeOs === 'windows' && state.transition.phase === 'idle' && previous.transition.phase !== 'idle')
        offer(state);
    });
    // Offered once per arrival; the lock flag only picks the surface.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Offline / online (the content still works).
  useEffect(() => {
    const offline = () =>
      notify({
        id: 'offline',
        app: 'system',
        appName: 'Network',
        title: "You're offline",
        body: 'Content still works.',
      });
    const online = () => {
      toastEvent({ type: 'remove', id: 'offline' });
      notify({ id: 'online', app: 'system', appName: 'Network', title: "You're back online" });
    };
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
    };
  }, [notify]);

  // An app's chunk that cannot load: the taskbar says so, and a toast offers Retry (plans/windows/06 E17).
  useEffect(
    () =>
      subscribeAppFailures((set) => {
        setFailed(set);
        for (const role of set)
          notify({
            id: `failed-${role}`,
            app: role,
            appName: winBinding(role).title,
            title: `Couldn't open ${winBinding(role).title}`,
            body: 'Check your connection and try again.',
            actions: [
              { label: 'Retry', primary: true, run: () => dispatchSoon({ type: 'OPEN_APP', os: 'windows', role }) },
            ],
          });
      }),
    [notify],
  );

  // Recent items for Search's zero state: content the visitor opened in Windows this session.
  useEffect(
    () =>
      subscribeEffects(({ state, previous }) => {
        if (state.route === previous.route || state.route.kind !== 'os' || state.route.os !== 'windows') return;
        const location = state.route.focus?.location;
        if (location?.kind !== 'content') return;
        const key = contentIndex.get(location.ref)?.key;
        if (!key) return;
        setRecent((list) => [`content:${key}`, ...list.filter((id) => id !== `content:${key}`)].slice(0, 5));
      }),
    [],
  );

  // Show desktop: minimize all (30 ms stagger); a second press restores that set — unless anything opened since (E11).
  const shownSet = useRef<readonly WindowId[] | null>(null);
  useEffect(
    () =>
      subscribeEffects(({ action }) => {
        if (action.type === 'OPEN_APP' || action.type === 'FOCUS_WINDOW') shownSet.current = null;
      }),
    [],
  );
  const showDesktop = useCallback(() => {
    flushQueued();
    const session = getKernel().sessions.windows;
    const visible = session.zOrder.filter((id) => isFocusable(session.windows[id]));
    if (visible.length === 0 && shownSet.current) {
      const set = shownSet.current;
      shownSet.current = null;
      set.forEach((id, index) => setTimeout(() => dispatch({ type: 'RESTORE', id }), index * 30));
      return;
    }
    if (visible.length === 0) return;
    shownSet.current = visible;
    [...visible].reverse().forEach((id, index) => setTimeout(() => dispatch({ type: 'MINIMIZE', id }), index * 30));
  }, []);

  // --- Keyboard (shared/09 registry; plans/windows/02 "Keyboard") ---------------------------------------------------
  const konami = useRef(createKonami());
  const findEgg = useCallback((id: string) => {
    const found = recordEgg(getPrefs().eggsFound, id);
    if (!found) return;
    dispatchSoon({ type: 'SET_PREF', patch: { eggsFound: found } });
    analytics.track({ name: 'egg_found', id });
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const typing = inTextField(event.target);
      if (!typing && konami.current.push(event.key)) {
        findEgg('EGG-KONAMI-01');
        setShimmer(true);
        setTimeout(() => setShimmer(false), 1400);
        notify({
          id: 'konami',
          app: 'system',
          appName: 'Windows',
          title: 'Cheat code accepted',
          body: 'Nothing unlocked — you already have full access.',
        });
      }
      const shortcut = matchShortcut(event, { inTextField: typing, singleKeyShortcuts: singleKeys });
      if (!shortcut) return;
      flushQueued();
      const session = getKernel().sessions.windows;
      const live = session.zOrder.filter((id) => isFocusable(session.windows[id]));
      const top =
        session.focused && isFocusable(session.windows[session.focused]) ? session.windows[session.focused]! : null;
      switch (shortcut) {
        case 'search':
        case 'search-slash':
          openPanel('search', document.activeElement as HTMLElement | null);
          break;
        case 'help':
          setDialog({ kind: 'shortcuts' });
          break;
        case 'close-window':
          if (!top) return;
          dispatchSoon({ type: 'CLOSE_WINDOW', id: top.id });
          break;
        case 'minimize-window':
          if (!top) return;
          dispatchSoon({ type: 'MINIMIZE', id: top.id });
          break;
        case 'maximize-window':
          if (!top || compact) return;
          dispatchSoon({ type: 'TOGGLE_MAXIMIZE', id: top.id });
          break;
        case 'snap-left':
        case 'snap-right':
        case 'snap-up':
        case 'snap-down':
          if (!top || compact) return;
          for (const action of keyboardSnap(top, shortcut.slice(5) as 'left' | 'right' | 'up' | 'down'))
            dispatchSoon(action);
          announce(
            shortcut === 'snap-down' && top.phase.s === 'normal' && !top.snap
              ? `${winBinding(top.role).title} minimized`
              : `${winBinding(top.role).title} arranged`,
          );
          break;
        case 'next-window':
          if (live.length < 2) return;
          dispatchSoon({ type: 'FOCUS_WINDOW', id: live[0]! });
          break;
        case 'previous-window':
          if (live.length < 2) return;
          dispatchSoon({ type: 'FOCUS_WINDOW', id: live[live.length - 2]! });
          break;
        case 'overview':
          openPanel('taskview', document.getElementById('tb-taskview'));
          break;
        case 'focus-dock':
          root.current?.querySelector<HTMLElement>('[data-taskbar-list] [data-roving-item][tabindex="0"]')?.focus();
          break;
        case 'switch-os':
          dispatchSoon({ type: 'SWITCH_OS', to: null, via: 'switch' });
          break;
        case 'dismiss':
          if (coach) director.current?.cancel();
          else if (panelOpen) closePanel(true);
          else return;
          break;
        default:
          return;
      }
      event.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [singleKeys, compact, panelOpen, coach, openPanel, closePanel, announce, notify, findEgg]);

  // --- The exit beat (plans/04 "The exit transition", plans/windows/07 "Switch OS") --------------------------------
  useEffect(() => {
    let beat: ReturnType<typeof exitBeat> | null = null;
    let releaseClaim: (() => void) | null = null;
    const unsubscribe = subscribeEffects(({ state, previous }) => {
      const t = state.transition;
      if (
        t.phase === 'exiting' &&
        t.from === 'windows' &&
        previous.activeOs === 'windows' &&
        previous.transition.phase === 'idle' &&
        root.current
      ) {
        const { epoch, to } = t;
        releaseClaim = claimPhases(epoch, ['exiting']);
        director.current?.cancel();
        beat = exitBeat(
          {
            windows: [...root.current.querySelectorAll('[data-window]')],
            taskbar: root.current.querySelector('[data-taskbar]'),
            overlays: [...root.current.querySelectorAll('[data-panel], [data-toast]')],
          },
          () => {
            beat = null;
            if (!(to === null && handOffExit({ epoch, from: 'windows', to })))
              dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch } });
          },
        );
        return;
      }
      if (t.phase === 'entering' && t.reverse && t.to === 'windows' && beat) {
        const { epoch } = t;
        const back = claimPhases(epoch, ['entering']);
        beat.reverse(() => {
          back();
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
  }, []);

  // --- Lock → sign-in → desktop (plans/windows/surfaces/lock-screen) ------------------------------------------------
  useEffect(() => {
    if (lock) dispatch({ type: 'MARK_LOCK_SEEN', os: 'windows' });
  }, [lock]);

  const offerTour = useCallback(() => {
    setTimeout(() => {
      const state = getKernel();
      if (getPrefs().tourOffered || state.activeOs !== 'windows' || state.viewport.posture === 'compact') return;
      notify({
        id: 'tour-offer',
        app: 'system',
        appName: 'Tips',
        title: 'New here? Take a 20-second tour.',
        actions: [
          { label: 'Start tour', primary: true, run: () => startTour() },
          { label: 'Not now', run: () => dispatchSoon({ type: 'SET_PREF', patch: { tourOffered: true } }) },
        ],
        onDismiss: () => dispatchSoon({ type: 'SET_PREF', patch: { tourOffered: true } }),
      });
    }, TOUR_OFFER_DELAY_MS);
  }, [notify, startTour]);

  const signIn = useCallback(() => {
    setLock(null);
    setLockOffer(null);
    setReveal(true);
    setTimeout(() => setReveal(false), 400);
    notify({
      id: 'welcome',
      app: 'system',
      appName: 'Windows',
      title: 'Welcome',
      body: 'Press Start or Ctrl+K to find anything.',
      actions: [
        { label: 'Open Start', primary: true, run: () => openPanel('start', document.getElementById('tb-start')) },
      ],
    });
    offerTour();
    // Arrival focus (shared/09): the OS heading, as after any chooser entry — else the desktop; never <body>.
    setTimeout(() => {
      const target =
        document.querySelector<HTMLElement>(`[data-focus-key="${focusKeys.osHeading}"]`) ??
        document.querySelector<HTMLElement>(`[data-focus-key="${focusKeys.home('windows')}"]`);
      target?.focus({ preventScroll: true });
    }, 0);
  }, [notify, offerTour, openPanel]);

  // The tour offer on a chooser arrival without a lock screen (the lock offers it after sign-in instead).
  useEffect(() => {
    const state = getKernel();
    if (!lock && (state.arrival === 'chooser' || state.arrival === 'switch')) offerTour();
    // Once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restart = useCallback(() => {
    setBooting(true);
    announce('Restarting Windows');
    const done = () => {
      setBooting(false);
      setLock('shown');
      announce('Windows ready');
    };
    const timer = setTimeout(done, prefersReducedMotion() ? 150 : 1400);
    const skip = () => {
      clearTimeout(timer);
      done();
    };
    setTimeout(() => {
      document.addEventListener('keydown', skip, { once: true, capture: true });
      document.addEventListener('pointerdown', skip, { once: true, capture: true });
    }, 50);
  }, [announce]);

  // --- Render --------------------------------------------------------------------------------------------------------
  const focusedWindow = focused ? windows[focused] : undefined;
  const shownInCompact = isFocusable(focusedWindow) ? focusedWindow.id : null;
  const windowShown = compact && shownInCompact !== null;
  const openOrder = Object.keys(windows) as WindowId[];
  const terminalVisible = isFocusable(windows[winId('terminal')]);
  const blur = liveAcrylic({
    menu: menu !== null,
    panel: panelOpen,
    toast: toasts.shown !== null,
    terminal: terminalVisible,
    lock: lock !== null,
  });
  const validPeek = peek && isFocusable(windows[peek]) ? peek : null;
  const attention = new Set<AppRole>(toasts.shown?.attention ? [toasts.shown.attention] : []);
  const overviewing = panel?.which === 'taskview';

  const runCenter = (item: CenterItem) => {
    const primary = item.primary ?? item.actions?.find((action) => action.primary)?.run;
    primary?.();
    toastEvent({ type: 'remove', id: item.id });
  };

  return (
    <WinShellProvider value={services}>
      <div
        ref={root}
        className={styles.win}
        data-win-posture={viewport.posture}
        data-os-chunk={OS_CHUNK_MARKER}
        data-terminal-acrylic={blur.has('terminal') ? 'live' : 'tint'}
        data-reveal={reveal || undefined}
        data-locked={lock ? '' : undefined}
        style={chromeVars(viewport)}
      >
        <div className={styles.wallpaper} aria-hidden="true" data-wallpaper="" />
        <main
          className={styles.main}
          data-focus-key={focusKeys.home('windows')}
          tabIndex={-1}
          inert={lock !== null || booting || undefined}
          aria-hidden={lock !== null || undefined}
        >
          {heading}
          <Desktop inert={windowShown || overviewing} compact={compact} coarse={coarse} />
          <div ref={snapPreviewEl} className={styles.snapPreview} data-snap-preview="" hidden aria-hidden="true" />
          {openOrder.map((id) => (
            <WinWindow
              key={id}
              id={id}
              zIndex={100 + Math.max(0, zOrder.indexOf(id))}
              focused={focused === id}
              compact={compact}
              touch={touch}
              shownInCompact={shownInCompact === id}
              dimmed={validPeek !== null && validPeek !== id}
              overview={overviewing}
              body={bodyFor}
            />
          ))}
        </main>

        {panel?.which === 'taskview' ? (
          <Suspense fallback={null}>
            <TaskView
              compact={compact}
              closing={panel.closing}
              live={blur.has('panel')}
              onDone={() => closePanel(false)}
            />
          </Suspense>
        ) : null}

        {lock ? null : (
          <Taskbar
            panel={panelOpen}
            compact={compact}
            touch={touch}
            align={align}
            attention={attention}
            failed={failed}
            acrylic={blur.has('taskbar') ? 'live' : 'tint'}
            shimmer={shimmer}
            onPanel={(which, from) => openPanel(which, from)}
            onShowDesktop={showDesktop}
            onPeek={setPeek}
          />
        )}

        {panel && (panel.which === 'start' || panel.which === 'search') ? (
          <div data-panel="launcher" className={styles.panelSlot}>
            <Suspense
              fallback={
                <LauncherPlaceholder
                  mode={panel.mode}
                  query={panel.query}
                  compact={compact}
                  onQuery={(query) =>
                    setPanel((current) =>
                      current
                        ? { ...current, query, ...(query ? { mode: 'search' as const, which: 'search' as const } : {}) }
                        : current,
                    )
                  }
                />
              }
            >
              <Launcher
                key="launcher"
                mode={panel.mode}
                initialQuery={panel.query}
                scope={panel.scope}
                compact={compact}
                coarse={coarse}
                closing={panel.closing}
                live={blur.has('panel')}
                recent={recent}
                onMode={(mode) =>
                  setPanel((current) =>
                    current ? { ...current, mode, which: mode === 'search' ? 'search' : 'start' } : current,
                  )
                }
                onClose={() => closePanel(false)}
                onDismiss={() => closePanel(true)}
                onLock={() => setLock('shown')}
                onRestart={restart}
              />
            </Suspense>
          </div>
        ) : null}

        {panel && (panel.which === 'quick' || panel.which === 'center' || panel.which === 'combined') ? (
          <div
            data-panel={panel.which}
            className={styles.flyout}
            data-kind={panel.which}
            data-state={panel.closing ? 'closing' : 'open'}
            data-acrylic={blur.has('panel') ? 'live' : 'tint'}
            role="dialog"
            aria-modal={panel.which === 'combined' ? 'true' : undefined}
            aria-label={
              panel.which === 'quick'
                ? 'Quick Settings'
                : panel.which === 'center'
                  ? 'Notification Center'
                  : 'Quick Settings and notifications'
            }
          >
            {panel.which !== 'center' ? (
              <Suspense fallback={null}>
                <QuickSettings
                  nightLight={nightLight}
                  onNightLight={setNightLight}
                  onSettings={() => {
                    closePanel(false);
                    dispatchSoon({ type: 'OPEN_APP', os: 'windows', role: 'settings' });
                  }}
                  onSwitchOs={() => {
                    closePanel(false);
                    dispatchSoon({ type: 'SWITCH_OS', to: null, via: 'switch' });
                  }}
                />
              </Suspense>
            ) : null}
            {panel.which !== 'quick' ? (
              <Suspense fallback={null}>
                <NotificationCenter
                  items={toasts.center}
                  sheet={panel.which === 'combined'}
                  onClear={(app) => toastEvent({ type: 'clear', app })}
                  onRemove={(id) => toastEvent({ type: 'remove', id })}
                  onRun={(item) => {
                    closePanel(false);
                    runCenter(item);
                  }}
                />
              </Suspense>
            ) : null}
          </div>
        ) : null}

        {menu ? (
          <WinMenu spec={menu} live={blur.has('menu')} taskbar={chromeHeight(viewport)} onClose={() => setMenu(null)} />
        ) : null}

        <section
          className={styles.toastRegion}
          aria-label="Notifications"
          role="status"
          aria-live="polite"
          data-toast-region=""
        >
          {toasts.shown ? (
            <Toast
              key={toasts.shown.id}
              toast={toasts.shown}
              live={blur.has('toast')}
              onDone={(id) => toastEvent({ type: 'done', id, canShow: canShowToast(), now: Date.now() })}
            />
          ) : null}
        </section>

        {dialog?.kind === 'winver' ? (
          <Suspense fallback={null}>
            <Winver onClose={() => setDialog(null)} />
          </Suspense>
        ) : null}
        {dialog?.kind === 'properties' ? (
          <Suspense fallback={null}>
            <PropertiesDialog
              spec={dialog.spec}
              onClose={() => setDialog(null)}
              onCopy={() =>
                dialog.spec.ref ? services.copyLink(dialog.spec.ref, dialog.spec.title) : Promise.resolve(false)
              }
            />
          </Suspense>
        ) : null}
        {dialog?.kind === 'shortcuts' ? (
          <Suspense fallback={null}>
            <ShortcutsDialog onClose={() => setDialog(null)} onTour={startTour} />
          </Suspense>
        ) : null}

        {coach ? (
          <Suspense fallback={null}>
            <CoachMark
              step={coach.step}
              index={coach.index}
              total={coach.total}
              onNext={() => director.current?.next()}
              onEnd={() => director.current?.cancel()}
            />
          </Suspense>
        ) : null}

        {lock ? (
          <LockScreen
            compact={compact}
            cards={lockCards(lockOffer)}
            onSignIn={signIn}
            onCard={(card, originId) => {
              signIn();
              if (card.id === 'continuity') dispatchSoon({ type: 'CONTINUITY_DISMISS' });
              const to = card.to;
              if ('ref' in to)
                dispatchSoon({
                  type: 'OPEN_APP',
                  os: 'windows',
                  role: 'files',
                  location: { kind: 'content', ref: to.ref },
                  originId,
                });
              else dispatchSoon({ type: 'OPEN_APP', os: 'windows', role: to.role, location: to.location, originId });
            }}
          />
        ) : null}

        {booting ? <WindowsBoot className={styles.restartBoot} slowLink={false} /> : null}
        <div className={styles.nightLight} hidden={!nightLight} aria-hidden="true" data-night-light="" />
      </div>
    </WinShellProvider>
  );
}

/**
 * Start / Search while its chunk loads (a first open before the idle warm-up): the same panel frame with a real, focused
 * search field, so every keystroke typed at once is kept (plans/windows/06 E9) — the launcher mounts with the query.
 */
function LauncherPlaceholder({
  mode,
  query,
  compact,
  onQuery,
}: {
  readonly mode: LauncherMode;
  readonly query: string;
  readonly compact: boolean;
  readonly onQuery: (query: string) => void;
}) {
  useEffect(() => {
    launcherPlaceholder.shownAt = performance.now();
  }, []);
  return (
    <div
      className={styles.launcher}
      role="dialog"
      aria-label={mode === 'start' ? 'Start' : 'Search'}
      aria-busy="true"
      data-launcher={mode}
      data-state="open"
      data-acrylic="tint"
      data-compact={compact || undefined}
    >
      <div className={styles.searchBox}>
        <input
          type="search"
          className={styles.searchInput}
          aria-label="Search"
          placeholder={mode === 'start' ? 'Search for apps, settings, and documents' : 'Type here to search'}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          // Opened by the visitor's own request; the field takes their keystrokes (as the launcher's own does).
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        />
      </div>
    </div>
  );
}

const chromeHeight = (viewport: Parameters<typeof chromeVars>[0]) =>
  Number.parseInt(chromeVars(viewport)['--tb-h']!, 10);
