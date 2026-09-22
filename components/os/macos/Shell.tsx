'use client';
/**
 * The macOS shell (lazy `macos` chunk) — plans/macos/. A calm spatial desktop filling the whole page (no device frame):
 * the storyboard's wallpaper, a global menu bar that follows the focused app, desktop items, free-floating layered
 * windows with traffic lights on the left, and a floating Dock — plus the P3 system surfaces: Spotlight, banners and
 * the Notification Center, the Control Center, context menus, dialogs and sheets, Mission Control, the lock screen, the
 * guided tour and the Restart replay.
 * Landmarks in reading order (plans/macos/05 `MAC-A11Y-01`): header (menu bar) → main (the hidden `h1`, the desktop,
 * then windows in *open* order — stacking is `z-index` only, the DOM never reorders on focus) → nav "Dock"; the status
 * region is the shell's own `#system-status`, present from mount. A modal surface (a dialog, Spotlight, Mission Control)
 * makes everything behind it inert. While the lock screen shows, it *is* the page's `main`.
 * Postures (plans/macos/04): `pointer` full fidelity · `touch` (28 px menu bar, 44 px targets, resize corner, Tile
 * menu) · `compact` — one maximized window between the menu bar and the Dock, a single "Window controls" menu, a
 * "Windows" switcher; landscape moves the Dock to a left rail; the Dock hides while an on-screen keyboard is up.
 */
import { gsap } from 'gsap';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { OS_CHUNK_MARKER } from './marker';
import { createKonami } from '@/lib/eggs';
import type { AppRole } from '@/lib/kernel/ids';
import { matchShortcut } from '@/lib/kernel/keymap';
import { isFocusable } from '@/lib/kernel/state';
import { focusKeys, type KernelState, type WindowId } from '@/lib/kernel/types';
import type { OsShellProps } from '@/lib/os-loaders';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { trackVisualViewport } from '@/lib/motion/visual-viewport';
import { useKernel, usePrefs } from '@/stores/kernel-context';
import { dispatch, dispatchSoon, flushQueued, getKernel, subscribeEffects } from '@/stores/kernel-store';
import { getPrefs } from '@/stores/prefs-store';
import { claimPhases, handOffExit } from '@/stores/transition-stage';
import { macAppBody } from './apps/registry';
import { chromeVars } from './model';
import { exitBeat } from './motion';
import { foundEgg, registerMacShellHooks, runMacCommand } from './run-command';
import { BootReplay } from './surfaces/BootReplay';
import { ContextMenuHost } from './surfaces/ContextMenuHost';
import { ControlCenter } from './surfaces/ControlCenter';
import { Desktop, selectAllDesktop } from './surfaces/Desktop';
import { Dialogs } from './surfaces/Dialogs';
import { Dock } from './surfaces/Dock';
import { LockScreen } from './surfaces/LockScreen';
import { MenuBar } from './surfaces/MenuBar';
import { MissionControl } from './surfaces/MissionControl';
import { Banners, NotificationCenter } from './surfaces/Notifications';
import { Overview } from './surfaces/Overview';
import { Spotlight } from './surfaces/Spotlight';
import { TourHost } from './surfaces/Tour';
import { timingVars } from './timing';
import { closeOverlay, macUi, notify, requestOverlay, resetMacUi, setLocked, setTour, useMacUi } from './ui';
import { requestWindowMode } from './window/modes';
import { MacWindow } from './window/Window';
import styles from './macos.module.css';

/** The focused, focusable macOS window (null while none is). */
const topWindow = (state: KernelState) => {
  const { focused, windows } = state.sessions.macos;
  const window = focused ? windows[focused] : undefined;
  return isFocusable(window) ? window : null;
};
// Narrow selectors return primitives, so the shell re-renders only when what it draws changes (shared/10 INP).
const selectOpenOrder = (state: KernelState) => Object.keys(state.sessions.macos.windows).join(' ');
const selectApp = (state: KernelState): AppRole | null => topWindow(state)?.role ?? null;
const selectShown = (state: KernelState): WindowId | null => topWindow(state)?.id ?? null;

const inTextField = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/** Overlays that hold the third live-blur slot (banners drop their blur meanwhile — shared/06 cap). */
const BLUR_SLOT = new Set(['spotlight', 'notification-center', 'control-center', 'mission']);
/** Overlays that are modal: the page behind them is inert. */
const MODAL = new Set(['dialog', 'spotlight', 'mission']);
/** The tour offer waits this long after the desktop settles (shared/20 "Offer rules"). */
const TOUR_OFFER_MS = 1200;

export default function MacShell({ heading }: OsShellProps) {
  const root = useRef<HTMLDivElement>(null);
  const wallpaper = useRef<HTMLDivElement>(null);
  const viewport = useKernel((state) => state.viewport);
  const openKey = useKernel(selectOpenOrder);
  const zOrder = useKernel((state) => state.sessions.macos.zOrder);
  const focused = useKernel((state) => state.sessions.macos.focused);
  const app = useKernel(selectApp);
  const shownInCompact = useKernel(selectShown);
  const singleKeys = usePrefs((prefs) => prefs.singleKeyShortcuts);
  const dockSize = usePrefs((prefs) => prefs.dock.size);
  const wallpaperPref = usePrefs((prefs) => prefs.wallpaper);
  const overlay = useMacUi((state) => state.overlay);
  const locked = useMacUi((state) => state.locked);
  const [switcher, setSwitcher] = useState(false);
  const [booting, setBooting] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  // The lock screen stays on screen as an inert ghost for its unlock beat.
  const [lockShown, setLockShown] = useState(locked);
  if (locked && !lockShown) setLockShown(true);
  const compact = viewport.posture === 'compact';
  const openOrder = (openKey ? openKey.split(' ') : []) as WindowId[];
  const mission = overlay === 'mission';

  const showWindows = useCallback(() => setSwitcher(true), []);
  const hideWindows = useCallback(() => setSwitcher(false), []);
  const closeOverview = useCallback(() => closeOverlay('mission'), []);
  const lockGone = useCallback(() => setLockShown(false), []);
  const bootDone = useCallback(() => setBooting(false), []);
  // Leaving compact closes the switcher; entering it ends a desktop overview (derived during render).
  const [wasCompact, setWasCompact] = useState(compact);
  if (wasCompact !== compact) {
    setWasCompact(compact);
    if (!compact) setSwitcher(false);
  }

  // A new macOS mount starts with clean transient UI; the lock screen appears on the first chooser entry of a session
  // only (never after a deep link, a refresh, `/go` or a re-entry — `MAC-LOCK-02`).
  useEffect(() => {
    resetMacUi();
    const state = getKernel();
    const first = state.arrival === 'chooser' && !state.sessions.macos.lockSeen;
    if (first) setLocked(true);
    return () => resetMacUi();
  }, []);

  // Arrival after the lock screen: the welcome banner, then (1.2 s later, once) the tour offer — never while another
  // transient surface shows or a compact app is open (shared/20 "Offer rules").
  const wasLocked = useRef(false);
  useEffect(() => {
    if (locked) {
      wasLocked.current = true;
      return;
    }
    if (!wasLocked.current) return;
    wasLocked.current = false;
    notify({ kind: 'welcome' });
    const timer = setTimeout(() => {
      const ui = macUi.getState();
      const busy = ui.overlay !== null || ui.locked || ui.tour === 'running';
      const compactApp = getKernel().viewport.posture === 'compact' && getKernel().sessions.macos.focused !== null;
      if (!getPrefs().tourOffered && !busy && !compactApp) notify({ kind: 'tour-offer' });
    }, TOUR_OFFER_MS);
    return () => clearTimeout(timer);
  }, [locked]);

  // Shell-owned behaviour the command runner reaches (Mission Control, window modes, the tour, Restart).
  useEffect(
    () =>
      registerMacShellHooks({
        overview: () => {
          if (getKernel().viewport.posture === 'compact') setSwitcher(true);
          else requestOverlay('mission');
        },
        windowMode: (id, mode) => requestWindowMode(id, mode),
        startTour: () => {
          // Starting twice restarts from step 1.
          setTour('idle');
          queueMicrotask(() => setTour('running'));
        },
        selectAllDesktop,
        restart: () => setBooting(true),
      }),
    [],
  );

  // Keyboard shortcuts from the one registry (shared/09): windows, the Dock, Spotlight, help, Switch OS, overview.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || macUi.getState().locked) return;
      const shortcut = matchShortcut(event, { inTextField: inTextField(event.target), singleKeyShortcuts: singleKeys });
      if (!shortcut) return;
      flushQueued(); // an earlier press this frame must land before this one reads the state
      const state = getKernel();
      const { windows } = state.sessions.macos;
      const live = state.sessions.macos.zOrder.filter((id) => isFocusable(windows[id]));
      const top = topWindow(state)?.id ?? null;
      switch (shortcut) {
        case 'close-window':
          if (top) dispatchSoon({ type: 'CLOSE_WINDOW', id: top });
          break;
        case 'minimize-window':
          if (top) dispatchSoon({ type: 'MINIMIZE', id: top });
          break;
        case 'maximize-window':
          if (top && !compact) dispatchSoon({ type: 'TOGGLE_MAXIMIZE', id: top });
          break;
        case 'next-window':
          if (live.length > 1) dispatchSoon({ type: 'FOCUS_WINDOW', id: live[0]! });
          break;
        case 'previous-window':
          if (live.length > 1) dispatchSoon({ type: 'FOCUS_WINDOW', id: live[live.length - 2]! });
          break;
        case 'focus-dock':
          root.current?.querySelector<HTMLElement>('[data-dock] [data-roving-item][tabindex="0"]')?.focus();
          break;
        case 'overview':
          if (compact) setSwitcher(true);
          else if (macUi.getState().overlay === 'mission') closeOverlay('mission');
          else requestOverlay('mission');
          break;
        case 'search':
        case 'search-slash':
          if (macUi.getState().overlay === 'spotlight') closeOverlay('spotlight');
          else runMacCommand({ kind: 'spotlight' });
          break;
        case 'help':
          runMacCommand({ kind: 'shortcuts' });
          break;
        case 'switch-os':
          runMacCommand({ kind: 'switch-os' });
          break;
        default:
          return;
      }
      event.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [compact, singleKeys]);

  // ↑↑↓↓←→←→BA on the desktop (never inside a text field): a single wallpaper shimmer + a banner (`EGG-KONAMI-01`).
  useEffect(() => {
    const konami = createKonami();
    const onKey = (event: KeyboardEvent) => {
      if (inTextField(event.target)) {
        konami.reset();
        return;
      }
      if (!konami.push(event.key)) return;
      foundEgg('EGG-KONAMI-01');
      notify({ kind: 'konami' });
      const layer = root.current?.querySelector<HTMLElement>('[data-shimmer]');
      if (layer && !prefersReducedMotion() && typeof layer.animate === 'function')
        layer.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], { duration: 600, easing: 'ease-in-out' });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Compact: the prompt and sheets sit above an on-screen keyboard (`--vvh`); the Dock hides while it is up.
  useEffect(() => {
    const node = root.current;
    if (!node || !compact) return;
    return trackVisualViewport(node, setKeyboard);
  }, [compact]);

  // The exit beat (plans/04 "The exit transition", `CHOOSE-EXIT-01`): when the visitor leaves macOS, macOS owns the
  // `exiting` phase — windows fade, the Dock drops, the menu bar fades (≤ 300 ms) — then hands the rest to the
  // chooser's return flight, or completes the phase itself. Forward mid-beat plays it back.
  useEffect(() => {
    let beat: ReturnType<typeof exitBeat> | null = null;
    let release: (() => void) | null = null;
    const unsubscribe = subscribeEffects(({ state, previous }) => {
      const t = state.transition;
      if (
        t.phase === 'exiting' &&
        t.from === 'macos' &&
        previous.activeOs === 'macos' &&
        previous.transition.phase === 'idle' &&
        root.current
      ) {
        // Leaving closes every transient surface (an OS switch bumps the epoch — menus, sheets and the tour end).
        resetMacUi();
        const { epoch, to } = t;
        release = claimPhases(epoch, ['exiting']);
        beat = exitBeat(
          {
            windows: [...root.current.querySelectorAll('[data-window]')],
            dock: root.current.querySelector('[data-dock]'),
            menuBar: root.current.querySelector('[data-menubar]'),
          },
          () => {
            beat = null;
            if (!(to === null && handOffExit({ epoch, from: 'macos', to })))
              dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch } });
          },
        );
        return;
      }
      if (t.phase === 'entering' && t.reverse && t.to === 'macos' && beat) {
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
      release?.();
    };
  }, []);

  // Tier 2 only: ±8 px pointer parallax on the wallpaper layer (transform only). Static on T0/T1 (`MAC-ID-04`).
  const parallax = useRef<{ x: (value: number) => void; y: (value: number) => void } | null>(null);
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const html = document.documentElement;
    if (event.pointerType !== 'mouse' || html.dataset.tier !== '2' || prefersReducedMotion() || !wallpaper.current)
      return;
    parallax.current ??= {
      x: gsap.quickTo(wallpaper.current, 'x', { duration: 0.6, ease: 'power3.out' }),
      y: gsap.quickTo(wallpaper.current, 'y', { duration: 0.6, ease: 'power3.out' }),
    };
    parallax.current.x(((event.clientX / viewport.w) * 2 - 1) * -8);
    parallax.current.y(((event.clientY / viewport.h) * 2 - 1) * -8);
  };

  const windowShown = compact && shownInCompact !== null;
  // The lock screen's fading ghost is inert: the page behind is interactive the moment it unlocks (input wins).
  const modal = (overlay !== null && MODAL.has(overlay)) || locked || booting;

  return (
    <div
      ref={root}
      className={styles.mac}
      data-mac-root=""
      data-mac-posture={viewport.posture}
      data-mac-orientation={viewport.orientation}
      data-mac-overlay={overlay !== null && BLUR_SLOT.has(overlay) ? overlay : undefined}
      data-keyboard={keyboard || undefined}
      data-wallpaper-variant={wallpaperPref}
      data-os-chunk={OS_CHUNK_MARKER}
      style={{ ...chromeVars(viewport, dockSize), ...timingVars() }}
      onPointerMove={onPointerMove}
    >
      <div ref={wallpaper} className={styles.wallpaper} aria-hidden="true" data-wallpaper="" />
      <div className={styles.shimmer} aria-hidden="true" data-shimmer="" />
      <MenuBar app={app} inert={modal} />
      <main
        className={styles.main}
        data-focus-key={focusKeys.home('macos')}
        tabIndex={-1}
        inert={modal || undefined}
        hidden={lockShown && locked ? true : undefined}
      >
        {heading}
        <Desktop inert={windowShown} />
        {openOrder.map((id) => (
          <MacWindow
            key={id}
            id={id}
            zIndex={100 + Math.max(0, zOrder.indexOf(id))}
            focused={focused === id}
            compact={compact}
            shownInCompact={shownInCompact === id}
            onShowWindows={showWindows}
            body={macAppBody}
          />
        ))}
      </main>
      <Dock compact={compact} onShowWindows={showWindows} inert={modal} />
      <Banners />
      <NotificationCenter />
      <ControlCenter />
      <ContextMenuHost />
      <Spotlight />
      <Dialogs />
      <TourHost />
      {mission && !compact ? <Overview onClose={closeOverview} /> : null}
      {switcher && compact ? <MissionControl onClose={hideWindows} /> : null}
      {lockShown ? <LockScreen leaving={!locked} onGone={lockGone} /> : null}
      {booting ? <BootReplay onDone={bootDone} /> : null}
      {/* Detached, inert copies of closing menus play their blink + fade here (React never renders into it). */}
      <div className={styles.ghosts} aria-hidden="true" data-mac-ghosts="" />
    </div>
  );
}
