'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { preload } from 'react-dom';
import { hrefFor } from '@/components/shell/KernelLink';
import { contentIndex } from '@/data/content-index';
import type { ContentRef } from '@/data/schema';
import { getFeaturedProjects, getPerson, getProjects, getResume } from '@/data/selectors';
import { resolveAsset } from '@/lib/assets/manifest';
import { createKonami, recordEgg } from '@/lib/eggs';
import type { AppRole } from '@/lib/kernel/ids';
import { matchShortcut } from '@/lib/kernel/keymap';
import { continuityOffer } from '@/lib/kernel/reducers';
import { OS_NAMES, OS_IDS } from '@/lib/kernel/ids';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import { currentLocation } from '@/lib/kernel/state';
import { focusKeys, type AppLocation, type WindowId } from '@/lib/kernel/types';
import type { OsShellProps } from '@/lib/os-loaders';
import { useKernel, usePrefs } from '@/stores/kernel-context';
import { dispatch, dispatchSoon, getKernel } from '@/stores/kernel-store';
import { AppSurface } from './AppSurface';
import { prefetchApp } from './apps/registry';
import { AndroidProvider, type AndroidServices } from './shell-context';
import { AdaptiveIcon, IconButton, Symbol, type SymbolName } from './ui';
import { ANDROID_DURATION } from './motion';
import {
  ANDROID_ROLES,
  DRAWER_APPS,
  FAVORITES,
  HOME_APPS,
  ROLE_LABEL,
  appShortcutLabels,
  baseNotifications,
  navMode,
  type AndroidNotification,
  type AndroidOverlay,
  type AndroidRole,
} from './model';
import styles from './android.module.css';

export const OS_CHUNK_MARKER = 'pf-os-chunk:android';

/** Google Sans Flex (OFL), loaded only by this chunk (plans/android/01-identity AND-ID-06). */
const FACE_SRC = '/assets/fonts/google-sans-flex-latin-var.c59d5c0ad9.woff2';
const FACE_CSS = `@font-face{font-family:'Google Sans Flex';src:url(${FACE_SRC}) format('woff2');font-weight:400 700;font-style:normal;font-display:swap}`;

/** One genuine Pixel wallpaper per palette in official mode; `null` keeps the palette's CSS gradient (original mode). */
const WALLPAPERS = (() => {
  const src = (id: string) => {
    const asset = resolveAsset(id);
    return asset.render === 'image' ? asset.src : null;
  };
  return {
    sage: src('wallpaper.android'),
    blue: src('wallpaper.android-blue'),
    violet: src('wallpaper.android-violet'),
    coral: src('wallpaper.android-coral'),
  } as const;
})();

const isRole = (role: AppRole): role is AndroidRole => (ANDROID_ROLES as readonly string[]).includes(role);
const roleOf = (id: WindowId | null): AndroidRole | null => {
  if (!id) return null;
  const role = id.split(':')[1] as AppRole;
  return isRole(role) ? role : null;
};
const inText = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
/** Pixel's status-bar clock: 12-hour, no AM/PM. */
const clock = (date: Date) =>
  date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '');

type OpenApp = (role: AndroidRole, location?: AppLocation, origin?: HTMLElement | null) => void;

export default function AndroidShell({ heading }: OsShellProps) {
  const root = useRef<HTMLDivElement>(null);
  const statusButton = useRef<HTMLButtonElement>(null);
  const launchSearchButton = useRef<HTMLButtonElement>(null);
  const viewport = useKernel((state) => state.viewport);
  const pointer = useKernel((state) => state.capabilities.pointer);
  const arrival = useKernel((state) => state.arrival);
  const session = useKernel((state) => state.sessions.android);
  const continuity = useKernel((state) => continuityOffer(state, contentIndex, OS_REGISTRY, Date.now()));
  const prefs = usePrefs((value) => value);
  const layout: 'phone' | 'large' = viewport.sizeClass === 'compact' ? 'phone' : 'large';
  const navigation = navMode(prefs.androidNavigation, pointer);
  const foreground = roleOf(session.focused);
  const activeWindow = foreground ? session.windows[`android:${foreground}` as WindowId] : undefined;
  const wallpaper = WALLPAPERS[prefs.androidPalette];
  if (wallpaper) preload(wallpaper, { as: 'image', type: 'image/avif', fetchPriority: 'low' });
  preload(FACE_SRC, { as: 'font', type: 'font/woff2', crossOrigin: '' });
  const [overlay, setOverlay] = useState<AndroidOverlay | null>(null);
  const [shadeExpanded, setShadeExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState(false);
  const [shortcuts, setShortcuts] = useState<{ role: AndroidRole; anchor: HTMLElement } | null>(null);
  const [lock, setLock] = useState(() => {
    const state = getKernel();
    return state.arrival === 'chooser' && !state.sessions.android.lockSeen && !state.sessions.android.focused;
  });
  const [dismissed, setDismissed] = useState<readonly string[]>([]);
  const [brightness, setBrightness] = useState(0);
  const [snackbar, setSnackbar] = useState<{ text: string; action?: { label: string; run: () => void } } | null>(null);
  const [headsUp, setHeadsUp] = useState(false);
  const [appOpening, setAppOpening] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const backHandler = useRef<(() => boolean) | null>(null);
  const longPress = useRef<number | null>(null);
  const person = getPerson();
  const resume = getResume();
  const projects = useMemo(() => getProjects(), []);
  const featured = getFeaturedProjects()[0];
  const notifications = useMemo(
    () =>
      baseNotifications({
        updated: resume.updated,
        projectCount: projects.length,
        featured: featured?.name ?? 'Projects',
        openTo: person.openTo,
      }),
    [resume.updated, projects.length, featured?.name, person.openTo],
  );
  const visibleNotifications = notifications.filter((item) => !dismissed.includes(item.id));
  const time = clock(now);
  const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const homePointer = useRef<{ x: number; y: number } | null>(null);

  const closeOverlay = useCallback(() => {
    setOverlay(null);
    setShadeExpanded(false);
    setQuery('');
    setShortcuts(null);
    setFolder(false);
  }, []);
  const home = useCallback(() => {
    closeOverlay();
    dispatchSoon({ type: 'GO_HOME' });
  }, [closeOverlay]);
  const back = useCallback(() => {
    if (backHandler.current?.()) return;
    if (shortcuts) {
      setShortcuts(null);
      shortcuts.anchor.focus();
      return;
    }
    if (folder) {
      setFolder(false);
      document.querySelector<HTMLElement>('[data-folder-button]')?.focus();
      return;
    }
    if (query && overlay === 'drawer') {
      setQuery('');
      return;
    }
    if (overlay === 'shade' && shadeExpanded) {
      setShadeExpanded(false);
      return;
    }
    if (overlay) {
      const returnFocus = overlay === 'drawer' ? launchSearchButton.current : statusButton.current;
      closeOverlay();
      window.setTimeout(() => returnFocus?.focus(), 0);
      return;
    }
    if (activeWindow && activeWindow.nav.index > 0) {
      dispatchSoon({ type: 'APP_BACK', id: activeWindow.id });
      return;
    }
    if (foreground) {
      home();
      return;
    }
    root.current?.animate(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }],
      { duration: 200 },
    );
  }, [activeWindow, closeOverlay, folder, foreground, home, overlay, query, shadeExpanded, shortcuts]);

  const openApp = useCallback<OpenApp>(
    (role, location, origin) => {
      closeOverlay();
      setAppOpening(true);
      prefetchApp(role);
      // Mobile launch state and its URL must commit atomically. Deferring OPEN_APP until a later paint can leave the
      // shallow URL write visible without a foreground surface if that queued frame is interrupted under load.
      dispatch({
        type: 'OPEN_APP',
        os: 'android',
        role,
        location,
        originId: origin?.id ?? null,
        invoker: origin?.dataset.focusKey ?? null,
      });
    },
    [closeOverlay],
  );
  const openContent = useCallback(
    (ref: ContentRef, origin?: HTMLElement | null) => {
      const role = OS_REGISTRY.android.sectionOwner[ref.section];
      if (isRole(role)) openApp(role, { kind: 'content', ref }, origin);
    },
    [openApp],
  );
  const notify = useCallback((text: string, action?: { label: string; run: () => void }) => {
    setSnackbar({ text, action });
    window.setTimeout(() => setSnackbar((current) => (current?.text === text ? null : current)), action ? 6000 : 4000);
  }, []);
  const openSettings = useCallback(
    (screen: string) => {
      openApp('settings');
      window.setTimeout(
        () => dispatch({ type: 'SET_APP_UI', id: 'android:settings', key: 'screen', value: screen }),
        0,
      );
    },
    [openApp],
  );
  const downloadResume = useCallback(() => {
    const anchor = document.createElement('a');
    anchor.href = resume.file;
    anchor.download = resume.downloadName;
    anchor.click();
    notify('Résumé.pdf · Download complete');
  }, [notify, resume]);
  const switchOs = useCallback(() => setOverlay('switch-os'), []);
  const openDrawer = useCallback((focusSearch = false) => {
    setOverlay('drawer');
    if (focusSearch) setTimeout(() => document.querySelector<HTMLInputElement>('[data-drawer-search]')?.focus(), 0);
  }, []);
  const services = useMemo<AndroidServices>(
    () => ({
      layout,
      openApp,
      openContent,
      back,
      home,
      notify,
      openSettings,
      openSwitchOs: switchOs,
      downloadResume,
      registerBack: (_id, handler) => {
        backHandler.current = handler;
      },
    }),
    [layout, openApp, openContent, back, home, notify, openSettings, switchOs, downloadResume],
  );

  useEffect(() => {
    // The status-bar clock follows the real minute.
    const tick = window.setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    if (!appOpening) return;
    const timer = setTimeout(() => {
      setAppOpening(false);
      const focused = getKernel().sessions.android.focused;
      if (focused && getKernel().sessions.android.windows[focused]?.phase.s === 'opening')
        dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id: focused } });
    }, ANDROID_DURATION.open);
    return () => clearTimeout(timer);
  }, [appOpening, session.focused]);
  useEffect(() => {
    if (!foreground) backHandler.current = null;
  }, [foreground]);
  useEffect(() => {
    for (const role of FAVORITES) prefetchApp(role);
  }, []);
  useEffect(() => {
    if (lock || arrival !== 'chooser' || !prefs.notifications) return;
    const show = window.setTimeout(() => setHeadsUp(true), 500);
    const hide = window.setTimeout(() => setHeadsUp(false), 7000);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [lock, arrival, prefs.notifications]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const shortcut = matchShortcut(event, {
        inTextField: inText(event.target),
        singleKeyShortcuts: prefs.singleKeyShortcuts,
      });
      if (shortcut === 'dismiss') {
        event.preventDefault();
        back();
      } else if (shortcut === 'search' || shortcut === 'search-slash') {
        event.preventDefault();
        openDrawer(true);
      } else if (shortcut === 'home') {
        event.preventDefault();
        home();
      } else if (shortcut === 'overview') {
        event.preventDefault();
        setOverlay('recents');
      } else if (shortcut === 'switch-os') {
        event.preventDefault();
        switchOs();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [back, home, openDrawer, prefs.singleKeyShortcuts, switchOs]);
  useEffect(() => {
    const konami = createKonami();
    const onKey = (event: KeyboardEvent) => {
      if (!konami.push(event.key)) return;
      const next = recordEgg(prefs.eggsFound, 'EGG-KONAMI-01');
      if (next) dispatch({ type: 'SET_PREF', patch: { eggsFound: next } });
      const palettes = ['sage', 'blue', 'violet', 'coral'] as const;
      palettes.forEach((value, index) =>
        setTimeout(() => dispatch({ type: 'SET_PREF', patch: { androidPalette: value } }), index * 300),
      );
      setTimeout(() => dispatch({ type: 'SET_PREF', patch: { androidPalette: prefs.androidPalette } }), 1200);
      notify('Material You palette tour complete');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [notify, prefs.androidPalette, prefs.eggsFound]);

  const unlock = useCallback(() => {
    setLock(false);
    dispatch({ type: 'MARK_LOCK_SEEN', os: 'android' });
    setHeadsUp(prefs.notifications);
  }, [prefs.notifications]);
  const openFromLock = (item: AndroidNotification) => {
    unlock();
    openApp(item.role, item.ref ? { kind: 'content', ref: item.ref } : undefined);
  };
  const drawerResults = query.trim()
    ? contentIndex.entries
        .filter((entry) =>
          `${entry.title} ${entry.summary} ${entry.keywords.join(' ')}`.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 12)
    : [];
  const startLongPress = () => {
    longPress.current = window.setTimeout(() => {
      const next = recordEgg(prefs.eggsFound, 'EGG-SHAKE-01');
      if (next) dispatch({ type: 'SET_PREF', patch: { eggsFound: next } });
      notify('No jiggle mode — this is Android. Try long-pressing an app instead.');
    }, 2000);
  };
  const cancelLongPress = () => {
    if (longPress.current !== null) clearTimeout(longPress.current);
    longPress.current = null;
  };
  const chooseShortcut = (label: string) => {
    const role = shortcuts?.role;
    setShortcuts(null);
    if (!role) return;
    if (label === 'Open résumé' || label === 'Download résumé') {
      if (label.startsWith('Download')) downloadResume();
      else openContent({ section: 'resume' });
    } else if (label === 'Experience') openContent({ section: 'experience' });
    else if (label === 'Education') openContent({ section: 'education' });
    else if (label === 'Compose') {
      openApp('mail');
      setTimeout(() => dispatch({ type: 'SET_APP_UI', id: 'android:mail', key: 'screen', value: 'compose' }), 0);
    } else if (label === 'Accessibility') openSettings('accessibility');
    else if (label === 'Switch OS') switchOs();
    else openApp(role);
  };
  const onShortcuts = (role: AndroidRole, target: HTMLElement) => setShortcuts({ role, anchor: target });
  const favorites = (
    <Favorites
      layout={layout}
      navigation={navigation}
      session={session}
      onOpen={openApp}
      onDrawer={() => openDrawer()}
      onBack={back}
      onHome={home}
      onRecents={() => setOverlay('recents')}
      onShortcuts={onShortcuts}
    />
  );
  // What the status bar and gesture handle sit on: the wallpaper (Home), an app's surface, or the dark shade.
  const statusTone = overlay === 'shade' || overlay === 'recents' ? 'shade' : foreground ? 'app' : 'wallpaper';

  return (
    <AndroidProvider value={services}>
      <style href="android-face" precedence="default">
        {FACE_CSS}
      </style>
      <div
        ref={root}
        className={styles.android}
        data-os="android"
        data-android-layout={layout}
        data-landscape={viewport.orientation === 'landscape' || undefined}
        data-palette={prefs.androidPalette}
        data-themed-icons={prefs.androidThemedIcons || undefined}
        data-nav-mode={navigation}
        data-status-tone={statusTone}
        data-wallpaper-official={wallpaper ? '' : undefined}
        data-os-chunk={OS_CHUNK_MARKER}
        style={wallpaper ? { ['--android-wallpaper-official' as string]: `url("${wallpaper}")` } : undefined}
      >
        <div className={styles.wallpaper} data-wallpaper="" aria-hidden="true" />
        <button
          ref={statusButton}
          className={styles.statusBar}
          aria-label="Notifications and quick settings"
          onClick={() => setOverlay('shade')}
        >
          <span className={styles.statusStart}>
            <time>{time}</time>
            {layout === 'large' ? <span className={styles.statusDate}>{date}</span> : null}
          </span>
          <span className={styles.statusIcons} aria-hidden="true">
            <Symbol filled>signal_wifi_4_bar</Symbol>
            {layout === 'phone' ? <Symbol filled>signal_cellular_4_bar</Symbol> : null}
            <Symbol filled>battery_full</Symbol>
          </span>
        </button>
        <main className={styles.main}>
          {heading}
          <section
            className={styles.launcher}
            aria-label="Home screen"
            inert={!!foreground || !!overlay || lock || undefined}
            data-focus-key={focusKeys.home('android')}
            onPointerDown={(event) => {
              homePointer.current = { x: event.clientX, y: event.clientY };
              startLongPress();
            }}
            onPointerMove={(event) => {
              if (
                homePointer.current &&
                Math.hypot(event.clientX - homePointer.current.x, event.clientY - homePointer.current.y) > 10
              )
                cancelLongPress();
            }}
            onPointerUp={(event) => {
              cancelLongPress();
              const start = homePointer.current;
              homePointer.current = null;
              if (!start) return;
              const dy = event.clientY - start.y;
              if (dy < -60) openDrawer();
              else if (dy > 60) setOverlay('shade');
            }}
          >
            <section className={styles.atAGlance} aria-label="At a glance">
              <time dateTime={now.toISOString()}>{date}</time>
              <button
                className={styles.smartspace}
                onClick={(event) =>
                  continuity
                    ? openContent(continuity, event.currentTarget)
                    : openContent({ section: 'resume' }, event.currentTarget)
                }
              >
                <Symbol>{continuity ? 'history' : 'description'}</Symbol>
                <span>
                  {continuity
                    ? `Continue: ${contentIndex.get(continuity)?.title ?? 'Your work'}`
                    : 'Résumé ready · Open'}
                </span>
              </button>
            </section>
            <ul className={styles.homeGrid}>
              <li>
                <ResumeShortcut onOpen={openContent} />
              </li>
              {HOME_APPS.map((role) => (
                <li key={role}>
                  <AppIcon role={role} onOpen={openApp} onShortcuts={(target) => onShortcuts(role, target)} />
                </li>
              ))}
              <li>
                <button
                  className={styles.appIcon}
                  data-folder-button=""
                  aria-haspopup="dialog"
                  onClick={() => setFolder(true)}
                >
                  <span className={styles.folderArt} aria-hidden="true">
                    {(['files', 'notes', 'mail', 'github'] as const).map((role) => (
                      <AdaptiveIcon key={role} app={role} />
                    ))}
                  </span>
                  <span className={styles.iconLabel}>Career</span>
                </button>
              </li>
            </ul>
            {layout === 'phone' ? (
              <>
                <button className={styles.drawerHint} onClick={() => openDrawer()} aria-label="All apps">
                  <Symbol>keyboard_arrow_up</Symbol>
                </button>
                {favorites}
              </>
            ) : null}
            <button
              ref={launchSearchButton}
              className={styles.launchSearch}
              aria-label="Search apps and more"
              onClick={() => openDrawer(true)}
            >
              <GoogleG />
              <span className={styles.searchPlaceholder}>Search apps and more</span>
              <span className={styles.searchTools} aria-hidden="true">
                <Symbol filled>mic</Symbol>
                <LensMark />
              </span>
            </button>
          </section>
          {foreground && activeWindow ? (
            <AppSurface
              key={activeWindow.id}
              id={activeWindow.id}
              role={foreground}
              layout={layout}
              opening={appOpening}
              originId={activeWindow.phase.s === 'opening' ? activeWindow.phase.originId : null}
              onHome={home}
            />
          ) : null}
        </main>
        {layout === 'large' ? favorites : null}
        {navigation === 'gesture' ? (
          <nav className={styles.gestureNav} aria-label="System navigation">
            <button className={styles.keyboardOnly} onClick={back}>
              Back
            </button>
            <button
              aria-label="Home"
              aria-describedby="android-home-description"
              onClick={home}
              onDoubleClick={() => setOverlay('recents')}
            >
              <span />
            </button>
            <span id="android-home-description" className="sr-only">
              Hold for recent apps
            </span>
            <button className={styles.keyboardOnly} onClick={() => setOverlay('recents')}>
              Recent apps
            </button>
          </nav>
        ) : layout === 'phone' ? (
          <SystemButtons back={back} home={home} recents={() => setOverlay('recents')} />
        ) : null}
        {folder ? (
          <div
            className={styles.overlayScrim}
            role="presentation"
            onMouseDown={(event) => event.target === event.currentTarget && setFolder(false)}
          >
            <section className={styles.folder} role="dialog" aria-modal="true" aria-labelledby="android-folder-title">
              <h3 id="android-folder-title">Career</h3>
              <ul>
                {(
                  [
                    ['experience', 'work', 'Experience'],
                    ['education', 'school', 'Education'],
                    ['resume', 'description', 'Résumé'],
                  ] as const
                ).map(([section, glyph, label]) => (
                  <li key={section}>
                    <button onClick={(event) => openContent({ section }, event.currentTarget)}>
                      <span className={styles.shortcutGlyph}>
                        <Symbol filled>{glyph}</Symbol>
                      </span>
                      <span className={styles.iconLabel}>{label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
        {overlay === 'drawer' ? (
          <Drawer
            layout={layout}
            query={query}
            setQuery={setQuery}
            results={drawerResults}
            onClose={closeOverlay}
            onOpen={openApp}
            onContent={openContent}
            onShortcuts={onShortcuts}
          />
        ) : null}
        {overlay === 'shade' ? (
          <Shade
            time={time}
            date={date}
            expanded={shadeExpanded}
            setExpanded={setShadeExpanded}
            brightness={brightness}
            setBrightness={setBrightness}
            notifications={visibleNotifications}
            dismissed={dismissed}
            setDismissed={setDismissed}
            onClose={closeOverlay}
            openContent={openContent}
            openSettings={openSettings}
            switchOs={switchOs}
          />
        ) : null}
        {overlay === 'recents' ? <Recents session={session} onClose={closeOverlay} /> : null}
        {overlay === 'switch-os' ? <SwitchOs onClose={closeOverlay} /> : null}
        {shortcuts ? (
          <Shortcuts
            role={shortcuts.role}
            anchor={shortcuts.anchor}
            labels={appShortcutLabels(
              shortcuts.role,
              projects.map((project) => project.name),
            )}
            onChoose={chooseShortcut}
            onInfo={() => openSettings(`app:${shortcuts.role}`)}
            onClose={() => {
              setShortcuts(null);
              shortcuts.anchor.focus();
            }}
          />
        ) : null}
        {headsUp && !lock && prefs.notifications ? (
          <aside className={styles.headsUp} role="status">
            <span className={styles.headsUpIcon}>
              <Symbol filled>android</Symbol>
            </span>
            <span>
              <small>System · now</small>
              <strong>Welcome to Android</strong>
              <span>Swipe up for all apps. Back always takes you back.</span>
            </span>
            <button
              className={styles.tonalButton}
              onClick={() => {
                setHeadsUp(false);
                openDrawer();
              }}
            >
              All apps
            </button>
            <IconButton label="Dismiss" onClick={() => setHeadsUp(false)}>
              <Symbol>close</Symbol>
            </IconButton>
          </aside>
        ) : null}
        <div className={styles.statusRegion} role="status" aria-live="polite">
          {snackbar ? (
            <div className={styles.snackbar}>
              {snackbar.text}
              {snackbar.action ? (
                <button
                  onClick={() => {
                    snackbar.action!.run();
                    setSnackbar(null);
                  }}
                >
                  {snackbar.action.label}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {brightness > 0 ? <div className={styles.brightness} style={{ opacity: (brightness / 100) * 0.3 }} /> : null}
        {lock ? (
          <LockScreen
            person={person}
            notifications={notifications.filter((item) => !dismissed.includes(item.id))}
            date={date}
            time={time}
            onUnlock={unlock}
            onOpen={openFromLock}
            onDismiss={(id) => setDismissed((all) => [...all, id])}
          />
        ) : null}
      </div>
    </AndroidProvider>
  );
}

/** The Google "G" (official four-colour mark) that leads Pixel's search bar. */
function GoogleG() {
  return (
    <svg className={styles.googleG} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

/** The Lens entry point at the end of Pixel's search bar (camera frame + lens). */
function LensMark() {
  return (
    <svg className={styles.lensMark} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M7 3.5H6A2.5 2.5 0 0 0 3.5 6v1M17 3.5h1A2.5 2.5 0 0 1 20.5 6v1M3.5 17v1A2.5 2.5 0 0 0 6 20.5h1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="18.2" cy="18.2" r="1.9" fill="currentColor" />
    </svg>
  );
}

/** Pixel's pinned shortcut: the résumé PDF, badged with the Files icon (a deep link, not an app). */
function ResumeShortcut({ onOpen }: { onOpen: (ref: ContentRef, origin?: HTMLElement | null) => void }) {
  const location: AppLocation = { kind: 'content', ref: { section: 'resume' } };
  return (
    <div className={styles.iconWrap}>
      <a
        className={styles.appIcon}
        id="android-icon-resume"
        data-focus-key={focusKeys.launcher('android', 'files')}
        href={hrefFor({ os: 'android', role: 'files', location })}
        onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          onOpen({ section: 'resume' }, event.currentTarget);
        }}
        onPointerEnter={() => prefetchApp('files')}
        onFocus={() => prefetchApp('files')}
      >
        <span className={styles.pinned} aria-hidden="true">
          <span className={styles.shortcutGlyph}>
            <Symbol filled>picture_as_pdf</Symbol>
          </span>
          <span className={styles.pinnedBadge}>
            <AdaptiveIcon app="files" />
          </span>
        </span>
        <span className={styles.iconLabel}>Résumé</span>
      </a>
    </div>
  );
}

function AppIcon({
  role,
  onOpen,
  onShortcuts,
  compact = false,
}: {
  role: AndroidRole;
  onOpen: OpenApp;
  onShortcuts: (target: HTMLElement) => void;
  compact?: boolean;
}) {
  const timer = useRef<number | null>(null);
  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  const location: AppLocation | undefined =
    compact && role === 'files' ? { kind: 'content', ref: { section: 'resume' } } : undefined;
  return (
    <div className={styles.iconWrap}>
      <a
        className={styles.appIcon}
        aria-label={compact ? (role === 'files' ? 'Files, Résumé' : ROLE_LABEL[role]) : undefined}
        data-focus-key={focusKeys.launcher('android', role)}
        id={`android-icon-${role}${compact ? '-favorite' : ''}`}
        href={hrefFor({ os: 'android', role, location })}
        onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          onOpen(role, location, event.currentTarget);
        }}
        onPointerEnter={() => prefetchApp(role)}
        onFocus={() => prefetchApp(role)}
        onContextMenu={(event) => {
          event.preventDefault();
          onShortcuts(event.currentTarget);
        }}
        onPointerDown={(event) => {
          const target = event.currentTarget;
          timer.current = window.setTimeout(() => onShortcuts(target), 500);
        }}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        data-compact={compact || undefined}
      >
        <AdaptiveIcon app={role} />
        {compact ? null : <span className={styles.iconLabel}>{ROLE_LABEL[role]}</span>}
      </a>
      <button
        className={styles.iconMore}
        aria-label={`${ROLE_LABEL[role]} shortcuts`}
        onClick={(event) =>
          onShortcuts(
            (event.currentTarget.closest(`.${styles.iconWrap}`)?.querySelector('a') as HTMLElement) ??
              event.currentTarget,
          )
        }
      >
        <Symbol>more_vert</Symbol>
      </button>
    </div>
  );
}

function Favorites({
  layout,
  navigation,
  session,
  onOpen,
  onDrawer,
  onBack,
  onHome,
  onRecents,
  onShortcuts,
}: {
  layout: 'phone' | 'large';
  navigation: string;
  session: ReturnType<typeof getKernel>['sessions']['android'];
  onOpen: OpenApp;
  onDrawer: () => void;
  onBack: () => void;
  onHome: () => void;
  onRecents: () => void;
  onShortcuts: (role: AndroidRole, target: HTMLElement) => void;
}) {
  const recent =
    layout === 'large'
      ? session.zOrder
          .slice(-2)
          .map((id) => ({ id, role: roleOf(id) }))
          .filter((item): item is { id: WindowId; role: AndroidRole } => !!item.role && !FAVORITES.includes(item.role))
      : [];
  return (
    <nav className={styles.favorites} aria-label="Favorites">
      {layout === 'large' ? (
        <button className={styles.allAppsTaskbar} aria-label="All apps" onClick={onDrawer}>
          <Symbol>apps</Symbol>
        </button>
      ) : null}
      <ul>
        {FAVORITES.map((role) => (
          <li key={role} data-running={(layout === 'large' && session.focused === `android:${role}`) || undefined}>
            <AppIcon
              role={role}
              compact
              onOpen={(selected, _location, origin) =>
                selected === 'files'
                  ? onOpen('files', { kind: 'content', ref: { section: 'resume' } }, origin)
                  : onOpen(selected, undefined, origin)
              }
              onShortcuts={(target) => onShortcuts(role, target)}
            />
          </li>
        ))}
      </ul>
      {recent.length ? (
        <>
          <span className={styles.taskbarDivider} />
          {recent.map(({ id, role }) => (
            <button
              key={id}
              className={styles.recentTask}
              aria-label={ROLE_LABEL[role]}
              data-running={session.focused === id || undefined}
              onClick={() => dispatchSoon({ type: 'FOCUS_WINDOW', id })}
            >
              <AdaptiveIcon app={role} />
            </button>
          ))}
        </>
      ) : null}
      {layout === 'large' && navigation === 'buttons' ? (
        <SystemButtons back={onBack} home={onHome} recents={onRecents} />
      ) : null}
    </nav>
  );
}

/** Android's three-button navigation: the outline triangle, circle and rounded square. */
function SystemButtons({ back, home, recents }: { back: () => void; home: () => void; recents: () => void }) {
  return (
    <nav className={styles.systemButtons} aria-label="System navigation">
      <button aria-label="Back" onClick={back}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M17 5.3v13.4a1 1 0 0 1-1.5.87L4.8 13.3a1.5 1.5 0 0 1 0-2.6l10.7-6.27A1 1 0 0 1 17 5.3z" />
        </svg>
      </button>
      <button aria-label="Home" onClick={home}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="7.2" />
        </svg>
      </button>
      <button aria-label="Recent apps" onClick={recents}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <rect x="5.5" y="5.5" width="13" height="13" rx="2.2" />
        </svg>
      </button>
    </nav>
  );
}

function Drawer({
  layout,
  query,
  setQuery,
  results,
  onClose,
  onOpen,
  onContent,
  onShortcuts,
}: {
  layout: 'phone' | 'large';
  query: string;
  setQuery: (value: string) => void;
  results: readonly (typeof contentIndex.entries)[number][];
  onClose: () => void;
  onOpen: OpenApp;
  onContent: (ref: ContentRef, origin?: HTMLElement | null) => void;
  onShortcuts: (role: AndroidRole, target: HTMLElement) => void;
}) {
  const sectionGlyph = (section: ContentRef['section']): SymbolName =>
    section === 'projects'
      ? 'code'
      : section === 'experience'
        ? 'work'
        : section === 'skills'
          ? 'lightbulb'
          : section === 'education'
            ? 'school'
            : section === 'contact'
              ? 'mail'
              : 'description';
  return (
    <div
      className={styles.drawerScrim}
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className={styles.drawer} role="dialog" aria-modal="true" aria-label="All apps" data-layout={layout}>
        <span className={styles.dragHandle} />
        <label className={styles.drawerSearch}>
          <GoogleG />
          <input
            data-drawer-search=""
            role="combobox"
            aria-controls="android-drawer-results"
            aria-expanded={!!query}
            placeholder="Search apps and more"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && results[0]) onContent(results[0].ref, event.currentTarget);
            }}
          />
          {query ? (
            <IconButton label="Clear search" onClick={() => setQuery('')}>
              <Symbol>close</Symbol>
            </IconButton>
          ) : null}
        </label>
        {query ? (
          <div id="android-drawer-results" className={styles.searchResults} role="listbox">
            {results.map((entry) => (
              <button
                key={entry.key}
                role="option"
                aria-selected="false"
                onClick={(event) => onContent(entry.ref, event.currentTarget)}
              >
                <span className={styles.resultGlyph}>
                  <Symbol>{sectionGlyph(entry.ref.section)}</Symbol>
                </span>
                <span>
                  <strong>{entry.title}</strong>
                  <small>{entry.summary}</small>
                </span>
                <Symbol>north_east</Symbol>
              </button>
            ))}
            <a href="/plain" className={styles.plainLink}>
              Search the plain portfolio
            </a>
            {results.length === 0 ? <p role="status">No results. Try projects, experience, skills or résumé.</p> : null}
          </div>
        ) : (
          <>
            <h3>Suggested</h3>
            <ul className={styles.suggestionRow}>
              <li>
                <button onClick={(event) => onContent({ section: 'resume' }, event.currentTarget)}>
                  <span className={styles.pinned} aria-hidden="true">
                    <span className={styles.shortcutGlyph}>
                      <Symbol filled>picture_as_pdf</Symbol>
                    </span>
                    <span className={styles.pinnedBadge}>
                      <AdaptiveIcon app="files" />
                    </span>
                  </span>
                  <span className={styles.iconLabel}>Résumé</span>
                </button>
              </li>
              {(['github', 'mail', 'notes'] as const).map((role) => (
                <li key={role}>
                  <button onClick={(event) => onOpen(role, undefined, event.currentTarget)}>
                    <AdaptiveIcon app={role} />
                    <span className={styles.iconLabel}>{ROLE_LABEL[role]}</span>
                  </button>
                </li>
              ))}
            </ul>
            <h3>All apps</h3>
            <ul className={styles.drawerGrid}>
              {DRAWER_APPS.map((role) => (
                <li key={role}>
                  <button
                    onClick={(event) => onOpen(role, undefined, event.currentTarget)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      onShortcuts(role, event.currentTarget);
                    }}
                  >
                    <AdaptiveIcon app={role} />
                    <span className={styles.iconLabel}>{ROLE_LABEL[role]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function Shade({
  time,
  date,
  expanded,
  setExpanded,
  brightness,
  setBrightness,
  notifications,
  dismissed,
  setDismissed,
  onClose,
  openContent,
  openSettings,
  switchOs,
}: {
  time: string;
  date: string;
  expanded: boolean;
  setExpanded: (value: boolean) => void;
  brightness: number;
  setBrightness: (value: number) => void;
  notifications: readonly AndroidNotification[];
  dismissed: readonly string[];
  setDismissed: (value: readonly string[]) => void;
  onClose: () => void;
  openContent: (ref: ContentRef, origin?: HTMLElement | null) => void;
  openSettings: (screen: string) => void;
  switchOs: () => void;
}) {
  const prefs = usePrefs((value) => value);
  const caps = useKernel((state) => state.capabilities);
  const toggle = (key: string) => {
    if (key === 'sound')
      dispatch({ type: 'SET_PREF', patch: { sound: { ...prefs.sound, enabled: !prefs.sound.enabled } } });
    if (key === 'motion')
      dispatch({
        type: 'SET_PREF',
        patch: { motion: prefs.motion === 'reduced' ? (caps.reducedMotion ? 'full' : 'system') : 'reduced' },
      });
    if (key === 'solid') dispatch({ type: 'SET_PREF', patch: { glass: prefs.glass === 'solid' ? 'system' : 'solid' } });
    if (key === 'dark') dispatch({ type: 'SET_PREF', patch: { theme: prefs.theme === 'dark' ? 'light' : 'dark' } });
    if (key === 'icons') dispatch({ type: 'SET_PREF', patch: { androidThemedIcons: !prefs.androidThemedIcons } });
    if (key === 'nav')
      dispatch({
        type: 'SET_PREF',
        patch: { androidNavigation: prefs.androidNavigation === 'buttons' ? 'gesture' : 'buttons' },
      });
  };
  const tiles: readonly { id: string; label: string; on: boolean; glyph: SymbolName }[] = [
    { id: 'sound', label: 'Sound', on: prefs.sound.enabled, glyph: prefs.sound.enabled ? 'volume_up' : 'volume_off' },
    { id: 'motion', label: 'Reduce motion', on: prefs.motion === 'reduced', glyph: 'animation' },
    { id: 'solid', label: 'Solid surfaces', on: prefs.glass === 'solid', glyph: 'contrast' },
    { id: 'dark', label: 'Dark theme', on: prefs.theme === 'dark', glyph: 'dark_mode' },
    { id: 'icons', label: 'Themed icons', on: prefs.androidThemedIcons, glyph: 'palette' },
    { id: 'nav', label: '3-button navigation', on: prefs.androidNavigation === 'buttons', glyph: 'navigation' },
  ];
  const groups = [
    { title: 'Notifications', items: notifications.filter((item) => !item.silent) },
    { title: 'Silent', items: notifications.filter((item) => item.silent) },
  ].filter((group) => group.items.length);
  return (
    <div
      className={styles.shadeScrim}
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className={styles.shade} role="dialog" aria-modal="true" aria-label="Notifications and quick settings">
        <header className={styles.shadeHeader}>
          <time className={styles.shadeClock}>{time}</time>
          <span className={styles.shadeDate}>{date}</span>
          <span className={styles.shadeTools}>
            <IconButton label="Settings" onClick={() => openSettings('root')}>
              <Symbol>settings</Symbol>
            </IconButton>
            <IconButton label="Switch operating system" onClick={switchOs}>
              <Symbol>power_settings_new</Symbol>
            </IconButton>
            <IconButton label="Expand quick settings" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
              <Symbol>{expanded ? 'expand_less' : 'expand_more'}</Symbol>
            </IconButton>
          </span>
        </header>
        <div className={styles.shadeColumns}>
          <section className={styles.quickSettings} aria-label="Quick settings">
            <div className={styles.quickGrid} data-expanded={expanded || undefined}>
              {tiles.slice(0, expanded ? 6 : 4).map((tile) => (
                <button key={tile.id} aria-pressed={tile.on} onClick={() => toggle(tile.id)}>
                  <span className={styles.tileGlyph}>
                    <Symbol filled={tile.on}>{tile.glyph}</Symbol>
                  </span>
                  <span>
                    <strong>{tile.label}</strong>
                    <small>{tile.on ? 'On' : 'Off'}</small>
                  </span>
                </button>
              ))}
              {expanded ? (
                <>
                  <button onClick={(event) => openContent({ section: 'resume' }, event.currentTarget)}>
                    <span className={styles.tileGlyph}>
                      <Symbol>description</Symbol>
                    </span>
                    <span>
                      <strong>Résumé</strong>
                      <small>Open</small>
                    </span>
                  </button>
                  <button onClick={switchOs}>
                    <span className={styles.tileGlyph}>
                      <Symbol>power_settings_new</Symbol>
                    </span>
                    <span>
                      <strong>Switch OS</strong>
                      <small>Choose</small>
                    </span>
                  </button>
                </>
              ) : null}
            </div>
            <label className={styles.brightnessSlider}>
              <input
                aria-label="Brightness"
                type="range"
                min="0"
                max="30"
                value={30 - brightness}
                onChange={(event) => setBrightness(30 - Number(event.target.value))}
              />
              <Symbol filled>brightness_medium</Symbol>
            </label>
          </section>
          <section className={styles.notificationColumn} aria-label="Notifications">
            {groups.map((group) => (
              <div key={group.title}>
                <h3>{group.title}</h3>
                <ul>
                  {group.items.map((item) => (
                    <NotificationCard
                      key={item.id}
                      item={item}
                      onOpen={openContent}
                      onDismiss={() => setDismissed([...dismissed, item.id])}
                    />
                  ))}
                </ul>
              </div>
            ))}
            {groups.length === 0 ? <p className={styles.noNotifications}>No notifications</p> : null}
            <footer>
              <button onClick={() => openSettings('notifications')}>Manage</button>
              {groups.length ? (
                <button onClick={() => setDismissed(notifications.map((item) => item.id))}>Clear all</button>
              ) : null}
            </footer>
          </section>
        </div>
        <span className={styles.shadeHandle} aria-hidden="true" />
      </section>
    </div>
  );
}

function NotificationCard({
  item,
  onOpen,
  onDismiss,
}: {
  item: AndroidNotification;
  onOpen: (ref: ContentRef, origin?: HTMLElement | null) => void;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className={styles.notificationCard}>
      <button
        className={styles.notificationMain}
        onClick={(event) => item.ref && onOpen(item.ref, event.currentTarget)}
      >
        <AdaptiveIcon app={item.role} />
        <span>
          <small>{item.app} · now</small>
          <strong>{item.title}</strong>
          <span>
            {item.body}
            {expanded ? ' · Everything remains available in the portfolio.' : ''}
          </span>
        </span>
      </button>
      <span className={styles.notificationActions}>
        <IconButton
          label={expanded ? 'Collapse notification' : 'Expand notification'}
          onClick={() => setExpanded((value) => !value)}
        >
          <Symbol>{expanded ? 'expand_less' : 'expand_more'}</Symbol>
        </IconButton>
        <IconButton label={`Dismiss ${item.title}`} onClick={onDismiss}>
          <Symbol>close</Symbol>
        </IconButton>
      </span>
    </li>
  );
}

function Recents({
  session,
  onClose,
}: {
  session: ReturnType<typeof getKernel>['sessions']['android'];
  onClose: () => void;
}) {
  const ids = session.zOrder.filter((id) => session.windows[id]);
  const remove = (id: WindowId) => {
    dispatch({ type: 'CLOSE_WINDOW', id });
    setTimeout(() => dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } }), ANDROID_DURATION.short);
  };
  const clear = () => {
    for (const id of ids) remove(id);
    onClose();
  };
  return (
    <div
      className={styles.recentsBackdrop}
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className={styles.recents} role="dialog" aria-modal="true" aria-label="Recent apps" tabIndex={-1}>
        <ul>
          {ids.length ? (
            ids
              .slice()
              .reverse()
              .map((id) => {
                const role = roleOf(id);
                if (!role) return null;
                const place = currentLocation(session.windows[id]!);
                return (
                  <li key={id}>
                    <div className={styles.recentChip}>
                      <AdaptiveIcon app={role} />
                      <strong>{ROLE_LABEL[role]}</strong>
                      <IconButton label={`Close ${ROLE_LABEL[role]}`} onClick={() => remove(id)}>
                        <Symbol>close</Symbol>
                      </IconButton>
                    </div>
                    <button
                      className={styles.recentCard}
                      onClick={() => {
                        dispatchSoon({ type: 'FOCUS_WINDOW', id });
                        onClose();
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Delete') remove(id);
                      }}
                    >
                      <span className={styles.recentPreview} aria-hidden="true">
                        <span className={styles.recentBar} />
                        <AdaptiveIcon app={role} />
                        <span className={styles.recentLines}>
                          <i />
                          <i />
                          <i />
                        </span>
                      </span>
                      <span className={styles.recentCaption}>
                        {place.kind === 'root'
                          ? `${ROLE_LABEL[role]} · App home`
                          : place.kind === 'content'
                            ? `${ROLE_LABEL[role]} · ${contentIndex.get(place.ref)?.title ?? 'Portfolio content'}`
                            : `${ROLE_LABEL[role]} · Portfolio content`}
                      </span>
                    </button>
                  </li>
                );
              })
          ) : (
            <li className={styles.emptyRecents}>No recent items</li>
          )}
        </ul>
        {ids.length ? (
          <button className={styles.clearAll} onClick={clear}>
            Clear all
          </button>
        ) : (
          <button className={styles.clearAll} onClick={onClose}>
            Home
          </button>
        )}
      </section>
    </div>
  );
}

function Shortcuts({
  role,
  anchor,
  labels,
  onChoose,
  onInfo,
  onClose,
}: {
  role: AndroidRole;
  anchor: HTMLElement;
  labels: readonly string[];
  onChoose: (label: string) => void;
  onInfo: () => void;
  onClose: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // Pixel opens the shortcut popup beside the icon that was long-pressed: above it when there is room, else below.
    const node = menu.current;
    const host = node?.offsetParent as HTMLElement | null;
    if (!node || !host) return;
    const icon = anchor.getBoundingClientRect();
    const box = host.getBoundingClientRect();
    const width = node.offsetWidth;
    const height = node.offsetHeight;
    const left = Math.min(Math.max(12, icon.left + icon.width / 2 - width / 2 - box.left), box.width - width - 12);
    const above = icon.top - box.top - height - 8;
    const top = above >= 12 ? above : Math.min(icon.bottom - box.top + 8, box.height - height - 12);
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
    node.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [anchor]);
  const glyphFor = (label: string): SymbolName =>
    /résumé/i.test(label)
      ? label.startsWith('Download')
        ? 'download'
        : 'description'
      : label === 'Experience'
        ? 'work'
        : label === 'Education'
          ? 'school'
          : label === 'Compose'
            ? 'edit'
            : label === 'Copy address'
              ? 'content_copy'
              : label === 'Accessibility'
                ? 'accessibility_new'
                : label === 'Switch OS'
                  ? 'power_settings_new'
                  : role === 'github'
                    ? 'code'
                    : 'arrow_outward';
  return (
    <div
      className={styles.shortcutLayer}
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div ref={menu} className={styles.shortcutMenu} role="menu" aria-label={`${ROLE_LABEL[role]} shortcuts`}>
        {labels.map((label) => (
          <button key={label} role="menuitem" onClick={() => onChoose(label)}>
            <span className={styles.shortcutMenuGlyph}>
              <Symbol>{glyphFor(label)}</Symbol>
            </span>
            {label}
          </button>
        ))}
        <button role="menuitem" onClick={onInfo}>
          <span className={styles.shortcutMenuGlyph}>
            <Symbol>info</Symbol>
          </span>
          App info
        </button>
      </div>
    </div>
  );
}

function SwitchOs({ onClose }: { onClose: () => void }) {
  return (
    <div
      className={styles.modalScrim}
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className={styles.basicDialog} role="dialog" aria-modal="true" aria-labelledby="android-switch-title">
        <span className={styles.dialogIcon}>
          <Symbol>power_settings_new</Symbol>
        </span>
        <h3 id="android-switch-title">Switch operating system</h3>
        <ul className={styles.osList}>
          {OS_IDS.filter((os) => os !== 'android' && OS_REGISTRY[os].released).map((os) => (
            <li key={os}>
              <button onClick={() => dispatchSoon({ type: 'SWITCH_OS', to: os, via: 'switch' })}>
                <span className={styles.osRadio} aria-hidden="true" />
                {OS_NAMES[os]}
              </button>
            </li>
          ))}
        </ul>
        <div>
          <button onClick={onClose}>Cancel</button>
          <button onClick={() => dispatchSoon({ type: 'SWITCH_OS', to: null, via: 'switch' })}>Back to chooser</button>
        </div>
      </section>
    </div>
  );
}

function LockScreen({
  person,
  notifications,
  date,
  time,
  onUnlock,
  onOpen,
  onDismiss,
}: {
  person: ReturnType<typeof getPerson>;
  notifications: readonly AndroidNotification[];
  date: string;
  time: string;
  onUnlock: () => void;
  onOpen: (item: AndroidNotification) => void;
  onDismiss: (id: string) => void;
}) {
  const start = useRef<number | null>(null);
  const [hours, minutes] = time.split(':');
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === 'Escape' || event.key.length === 1) onUnlock();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onUnlock]);
  return (
    <section
      className={styles.lock}
      data-lock=""
      aria-labelledby="android-lock-title"
      onPointerDown={(event) => {
        start.current = event.clientY;
      }}
      onPointerUp={(event) => {
        if (start.current !== null && start.current - event.clientY > 60) onUnlock();
        start.current = null;
      }}
    >
      <div className={styles.lockScrim} />
      <button className="sr-only" onClick={onUnlock}>
        Unlock
      </button>
      <header>
        <h1 id="android-lock-title" className="sr-only">
          {person.name} — {person.headline}
        </h1>
        <p className={styles.lockDate}>{date}</p>
        <time className={styles.lockClock} dateTime={new Date().toISOString()}>
          <span>{hours?.padStart(2, '0')}</span>
          <span>{minutes}</span>
        </time>
        <p className={styles.lockOpenTo}>{person.openTo}</p>
      </header>
      <ul className={styles.lockCards}>
        {notifications.map((item) => (
          <li key={item.id}>
            <button className={styles.lockCard} onClick={() => onOpen(item)}>
              <AdaptiveIcon app={item.role} />
              <span>
                <small>{item.app}</small>
                <strong>{item.title}</strong>
                <span>{item.body}</span>
              </span>
            </button>
            <IconButton label={`Dismiss ${item.title}`} onClick={() => onDismiss(item.id)}>
              <Symbol>close</Symbol>
            </IconButton>
          </li>
        ))}
      </ul>
      <footer>
        <button aria-label="Résumé" onClick={() => onOpen(notifications[0]!)}>
          <Symbol>description</Symbol>
        </button>
        <button className={styles.unlock} onClick={onUnlock}>
          <Symbol filled>lock_open</Symbol>
          <span>Swipe up to unlock</span>
        </button>
        <button
          aria-label="Contact"
          onClick={() => {
            const item = notifications.find((entry) => entry.role === 'mail');
            if (item) onOpen(item);
          }}
        >
          <Symbol>mail</Symbol>
        </button>
      </footer>
    </section>
  );
}
