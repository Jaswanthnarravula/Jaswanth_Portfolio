'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hrefFor } from '@/components/shell/KernelLink';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { contentIndex } from '@/data/content-index';
import type { ContentRef } from '@/data/schema';
import { getFeaturedProjects, getPerson, getProjects, getResume } from '@/data/selectors';
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
import { IconButton, Symbol } from './ui';
import { ANDROID_DURATION } from './motion';
import {
  ANDROID_ROLES,
  DRAWER_APPS,
  FAVORITES,
  HOME_APPS,
  ROLE_LABEL,
  androidIcon,
  appShortcutLabels,
  baseNotifications,
  navMode,
  type AndroidNotification,
  type AndroidOverlay,
  type AndroidRole,
} from './model';
import styles from './android.module.css';

export const OS_CHUNK_MARKER = 'pf-os-chunk:android';
const isRole = (role: AppRole): role is AndroidRole => (ANDROID_ROLES as readonly string[]).includes(role);
const roleOf = (id: WindowId | null): AndroidRole | null => {
  if (!id) return null;
  const role = id.split(':')[1] as AppRole;
  return isRole(role) ? role : null;
};
const inText = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export default function AndroidShell({ heading }: OsShellProps) {
  const root = useRef<HTMLDivElement>(null);
  const statusButton = useRef<HTMLButtonElement>(null);
  const allAppsButton = useRef<HTMLButtonElement>(null);
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
  const now = useMemo(() => new Date(), []);
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false });
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

  const openApp = useCallback(
    (role: AndroidRole, location?: AppLocation, origin?: HTMLElement | null) => {
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
    const controller = new AbortController();
    for (const role of FAVORITES) prefetchApp(role);
    return () => controller.abort();
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
        setOverlay('drawer');
        setTimeout(() => document.querySelector<HTMLInputElement>('[data-drawer-search]')?.focus(), 0);
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
  }, [back, home, prefs.singleKeyShortcuts, switchOs]);
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

  return (
    <AndroidProvider value={services}>
      <div
        ref={root}
        className={styles.android}
        data-os="android"
        data-android-layout={layout}
        data-landscape={viewport.orientation === 'landscape' || undefined}
        data-palette={prefs.androidPalette}
        data-themed-icons={prefs.androidThemedIcons || undefined}
        data-nav-mode={navigation}
        data-os-chunk={OS_CHUNK_MARKER}
      >
        <div className={styles.wallpaper} data-wallpaper="" aria-hidden="true" />
        <button
          ref={statusButton}
          className={styles.statusBar}
          aria-label="Notifications and quick settings"
          onClick={() => setOverlay('shade')}
        >
          <time>{time}</time>
          <span aria-hidden="true">▾ ◢ █</span>
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
              if (dy < -60) setOverlay('drawer');
              else if (dy > 60) setOverlay('shade');
            }}
          >
            <section className={styles.atAGlance} aria-label="At a glance">
              <time dateTime={now.toISOString()}>{date}</time>
              <button
                onClick={(event) =>
                  continuity
                    ? openContent(continuity, event.currentTarget)
                    : openContent({ section: 'resume' }, event.currentTarget)
                }
              >
                {continuity ? `Continue: ${contentIndex.get(continuity)?.title ?? 'Your work'}` : 'Résumé ready · Open'}
              </button>
            </section>
            <button
              ref={launchSearchButton}
              className={styles.launchSearch}
              aria-label="Search apps and more"
              onClick={() => {
                setOverlay('drawer');
                setTimeout(() => document.querySelector<HTMLInputElement>('[data-drawer-search]')?.focus(), 0);
              }}
            >
              <b>G</b>
              <span>Search apps and more</span>
            </button>
            <ul className={styles.homeGrid}>
              {HOME_APPS.map((role) => (
                <li key={role}>
                  <AppIcon
                    role={role}
                    onOpen={openApp}
                    onShortcuts={(target) => setShortcuts({ role, anchor: target })}
                  />
                </li>
              ))}
              <li>
                <button
                  className={styles.appIcon}
                  data-folder-button=""
                  aria-haspopup="dialog"
                  onClick={() => setFolder(true)}
                >
                  <span className={styles.folderArt}>
                    <AssetIcon id={androidIcon('files')} size={22} />
                    <AssetIcon id={androidIcon('notes')} size={22} />
                    <AssetIcon id={androidIcon('mail')} size={22} />
                  </span>
                  <span>Career</span>
                </button>
              </li>
            </ul>
            <button
              ref={allAppsButton}
              className={styles.drawerHint}
              onClick={() => setOverlay('drawer')}
              aria-label="All apps"
            >
              <Symbol>keyboard_arrow_up</Symbol>
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
        <Favorites
          layout={layout}
          navigation={navigation}
          session={session}
          onOpen={openApp}
          onDrawer={() => setOverlay('drawer')}
          onBack={back}
          onHome={home}
          onRecents={() => setOverlay('recents')}
          onShortcuts={(role, target) => setShortcuts({ role, anchor: target })}
        />
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
            <section className={styles.folder} role="dialog" aria-modal="true" aria-label="Career">
              <h3>Career</h3>
              <ul>
                <li>
                  <button onClick={(event) => openContent({ section: 'experience' }, event.currentTarget)}>
                    <Symbol>work</Symbol>Experience
                  </button>
                </li>
                <li>
                  <button onClick={(event) => openContent({ section: 'education' }, event.currentTarget)}>
                    <Symbol>school</Symbol>Education
                  </button>
                </li>
                <li>
                  <button onClick={(event) => openContent({ section: 'resume' }, event.currentTarget)}>
                    <Symbol>description</Symbol>Résumé
                  </button>
                </li>
              </ul>
            </section>
          </div>
        ) : null}
        {overlay === 'drawer' ? (
          <Drawer
            query={query}
            setQuery={setQuery}
            results={drawerResults}
            onClose={closeOverlay}
            onOpen={openApp}
            onContent={openContent}
            onShortcuts={(role, target) => setShortcuts({ role, anchor: target })}
          />
        ) : null}
        {overlay === 'shade' ? (
          <Shade
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
            <span className={styles.tonalIcon}>
              <Symbol>android</Symbol>
            </span>
            <span>
              <strong>Welcome</strong>
              <small>Swipe up for all apps. Back always takes you back.</small>
            </span>
            <button
              onClick={() => {
                setHeadsUp(false);
                setOverlay('drawer');
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

function AppIcon({
  role,
  onOpen,
  onShortcuts,
  compact = false,
}: {
  role: AndroidRole;
  onOpen: (role: AndroidRole, location?: AppLocation, origin?: HTMLElement | null) => void;
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
        id={`android-icon-${role}`}
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
          timer.current = window.setTimeout(() => onShortcuts(event.currentTarget), 500);
        }}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        data-compact={compact || undefined}
      >
        <span className={styles.iconArt}>
          <AssetIcon id={androidIcon(role)} size={compact ? 44 : 58} fluid />
        </span>
        {compact ? null : <span>{ROLE_LABEL[role]}</span>}
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
        ⋮
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
  onOpen: (role: AndroidRole, location?: AppLocation, origin?: HTMLElement | null) => void;
  onDrawer: () => void;
  onBack: () => void;
  onHome: () => void;
  onRecents: () => void;
  onShortcuts: (role: AndroidRole, target: HTMLElement) => void;
}) {
  return (
    <nav className={styles.favorites} aria-label="Favorites">
      <button className={styles.allAppsTaskbar} aria-label="All apps" onClick={onDrawer}>
        <Symbol>apps</Symbol>
      </button>
      <ul>
        {FAVORITES.map((role) => (
          <li key={role}>
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
      {layout === 'large' && session.zOrder.length ? (
        <>
          <span className={styles.taskbarDivider} />
          {session.zOrder.slice(-2).map((id) => {
            const role = roleOf(id);
            return role && !FAVORITES.includes(role) ? (
              <button key={id} className={styles.recentTask} onClick={() => dispatchSoon({ type: 'FOCUS_WINDOW', id })}>
                <AssetIcon id={androidIcon(role)} size={38} />
              </button>
            ) : null;
          })}
        </>
      ) : null}
      {layout === 'large' && navigation === 'buttons' ? (
        <SystemButtons back={onBack} home={onHome} recents={onRecents} />
      ) : null}
    </nav>
  );
}

function SystemButtons({ back, home, recents }: { back: () => void; home: () => void; recents: () => void }) {
  return (
    <nav className={styles.systemButtons} aria-label="System navigation">
      <button aria-label="Back" onClick={back}>
        ◀
      </button>
      <button aria-label="Home" onClick={home}>
        ●
      </button>
      <button aria-label="Recent apps" onClick={recents}>
        ■
      </button>
    </nav>
  );
}

function Drawer({
  query,
  setQuery,
  results,
  onClose,
  onOpen,
  onContent,
  onShortcuts,
}: {
  query: string;
  setQuery: (value: string) => void;
  results: readonly (typeof contentIndex.entries)[number][];
  onClose: () => void;
  onOpen: (role: AndroidRole, location?: AppLocation, origin?: HTMLElement | null) => void;
  onContent: (ref: ContentRef, origin?: HTMLElement | null) => void;
  onShortcuts: (role: AndroidRole, target: HTMLElement) => void;
}) {
  return (
    <div
      className={styles.overlayScrim}
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className={styles.drawer} role="dialog" aria-modal="true" aria-label="All apps">
        <span className={styles.dragHandle} />
        <label className={styles.drawerSearch}>
          <Symbol>search</Symbol>
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
                <span className={styles.tonalIcon}>
                  <Symbol>
                    {entry.ref.section === 'projects'
                      ? 'source'
                      : entry.ref.section === 'experience'
                        ? 'work'
                        : entry.ref.section === 'skills'
                          ? 'lightbulb'
                          : 'description'}
                  </Symbol>
                </span>
                <span>
                  <strong>{entry.title}</strong>
                  <small>{entry.summary}</small>
                </span>
                <Symbol>chevron_right</Symbol>
              </button>
            ))}
            <a href="/plain">Search the plain portfolio</a>
            {results.length === 0 ? <p role="status">No results. Try projects, experience, skills or résumé.</p> : null}
          </div>
        ) : (
          <>
            <h3>Suggestions</h3>
            <ul className={styles.suggestionRow}>
              <li>
                <button onClick={(event) => onContent({ section: 'resume' }, event.currentTarget)}>
                  <AssetIcon id={androidIcon('files')} size={54} />
                  <span>Résumé</span>
                </button>
              </li>
              {DRAWER_APPS.slice(0, 3).map((role) => (
                <li key={role}>
                  <button onClick={(event) => onOpen(role, undefined, event.currentTarget)}>
                    <AssetIcon id={androidIcon(role)} size={54} />
                    <span>{ROLE_LABEL[role]}</span>
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
                    <AssetIcon id={androidIcon(role)} size={58} />
                    <span>{ROLE_LABEL[role]}</span>
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
  const tiles = [
    { id: 'sound', label: 'Sound', on: prefs.sound.enabled, glyph: 'volume_up' },
    { id: 'motion', label: 'Reduce motion', on: prefs.motion === 'reduced', glyph: 'motion_photos_off' },
    { id: 'solid', label: 'Solid surfaces', on: prefs.glass === 'solid', glyph: 'opacity' },
    { id: 'dark', label: 'Dark theme', on: prefs.theme === 'dark', glyph: 'dark_mode' },
    { id: 'icons', label: 'Themed icons', on: prefs.androidThemedIcons, glyph: 'palette' },
    { id: 'nav', label: '3-button navigation', on: prefs.androidNavigation === 'buttons', glyph: 'navigation' },
  ] as const;
  return (
    <div
      className={styles.overlayScrim}
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className={styles.shade} role="dialog" aria-modal="true" aria-label="Notifications and quick settings">
        <header>
          <time>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</time>
          <span aria-hidden="true">▾ ◢ █</span>
          <IconButton label="Expand quick settings" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
            <Symbol>{expanded ? 'expand_less' : 'expand_more'}</Symbol>
          </IconButton>
        </header>
        <div className={styles.shadeColumns}>
          <section>
            <div className={styles.quickGrid} data-expanded={expanded || undefined}>
              {tiles.slice(0, expanded ? 6 : 4).map((tile) => (
                <button key={tile.id} aria-pressed={tile.on} onClick={() => toggle(tile.id)}>
                  <Symbol filled={tile.on}>{tile.glyph}</Symbol>
                  <span>
                    <strong>{tile.label}</strong>
                    <small>{tile.on ? 'On' : 'Off'}</small>
                  </span>
                </button>
              ))}
              {expanded ? (
                <>
                  <button onClick={(event) => openContent({ section: 'resume' }, event.currentTarget)}>
                    <Symbol>description</Symbol>
                    <span>
                      <strong>Résumé</strong>
                      <small>Open</small>
                    </span>
                  </button>
                  <button onClick={switchOs}>
                    <Symbol>power_settings_new</Symbol>
                    <span>
                      <strong>Switch OS</strong>
                      <small>Choose</small>
                    </span>
                  </button>
                </>
              ) : null}
            </div>
            <label className={styles.brightnessSlider}>
              <Symbol>brightness_low</Symbol>
              <input
                aria-label="Brightness"
                type="range"
                min="0"
                max="30"
                value={brightness}
                onChange={(event) => setBrightness(Number(event.target.value))}
              />
              <Symbol>brightness_high</Symbol>
            </label>
            {expanded ? (
              <div className={styles.shadeTools}>
                <span className={styles.avatar}>J</span>
                <IconButton label="Settings" onClick={() => openSettings('root')}>
                  <Symbol>settings</Symbol>
                </IconButton>
                <IconButton label="Switch operating system" onClick={switchOs}>
                  <Symbol>power_settings_new</Symbol>
                </IconButton>
              </div>
            ) : null}
          </section>
          <section className={styles.notificationColumn}>
            <h3>Notifications</h3>
            <ul>
              {notifications
                .filter((item) => !item.silent)
                .map((item) => (
                  <NotificationCard
                    key={item.id}
                    item={item}
                    onOpen={openContent}
                    onDismiss={() => setDismissed([...dismissed, item.id])}
                  />
                ))}
            </ul>
            <h3>Silent</h3>
            <ul>
              {notifications
                .filter((item) => item.silent)
                .map((item) => (
                  <NotificationCard
                    key={item.id}
                    item={item}
                    onOpen={openContent}
                    onDismiss={() => setDismissed([...dismissed, item.id])}
                  />
                ))}
            </ul>
            <footer>
              <button onClick={() => openSettings('notifications')}>Manage</button>
              <button onClick={() => setDismissed(notifications.map((item) => item.id))}>Clear all</button>
            </footer>
          </section>
        </div>
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
        <span className={styles.tonalIcon}>
          <AssetIcon id={androidIcon(item.role)} size={34} />
        </span>
        <span>
          <small>{item.app} · now</small>
          <strong>{item.title}</strong>
          <span>
            {item.body}
            {expanded ? ' · Everything remains available in the portfolio.' : ''}
          </span>
        </span>
      </button>
      <IconButton
        label={expanded ? 'Collapse notification' : 'Expand notification'}
        onClick={() => setExpanded((value) => !value)}
      >
        <Symbol>{expanded ? 'expand_less' : 'expand_more'}</Symbol>
      </IconButton>
      <IconButton label={`Dismiss ${item.title}`} onClick={onDismiss}>
        <Symbol>close</Symbol>
      </IconButton>
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
                return (
                  <li key={id}>
                    <div className={styles.recentChip}>
                      <AssetIcon id={androidIcon(role)} size={28} />
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
                      <div>
                        <AssetIcon id={androidIcon(role)} size={76} />
                        <h3>{ROLE_LABEL[role]}</h3>
                        <p>
                          {currentLocation(session.windows[id]!).kind === 'root' ? 'App home' : 'Portfolio content'}
                        </p>
                      </div>
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
  labels,
  onChoose,
  onInfo,
  onClose,
}: {
  role: AndroidRole;
  labels: readonly string[];
  onChoose: (label: string) => void;
  onInfo: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className={styles.shortcutLayer}
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className={styles.shortcutMenu} role="menu" aria-label={`${ROLE_LABEL[role]} shortcuts`}>
        {labels.map((label) => (
          <button key={label} role="menuitem" onClick={() => onChoose(label)}>
            <span className={styles.tonalIcon}>
              <Symbol>arrow_outward</Symbol>
            </span>
            {label}
          </button>
        ))}
        <button role="menuitem" onClick={onInfo}>
          <span className={styles.tonalIcon}>
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
        <h3 id="android-switch-title">Switch operating system</h3>
        <ul className={styles.osList}>
          {OS_IDS.filter((os) => os !== 'android' && OS_REGISTRY[os].released).map((os) => (
            <li key={os}>
              <button onClick={() => dispatchSoon({ type: 'SWITCH_OS', to: os, via: 'switch' })}>{OS_NAMES[os]}</button>
            </li>
          ))}
        </ul>
        <button onClick={() => dispatchSoon({ type: 'SWITCH_OS', to: null, via: 'switch' })}>Back to chooser</button>
        <button onClick={onClose}>Cancel</button>
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
  const parts = time.split(':');
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
        <time className={styles.lockClock} dateTime={new Date().toISOString()}>
          <span>{parts[0]}</span>
          <span>{parts[1]}</span>
        </time>
        <p>
          {date} · {person.openTo}
        </p>
      </header>
      <ul className={styles.lockCards}>
        {notifications.map((item) => (
          <li key={item.id}>
            <button className={styles.lockCard} onClick={() => onOpen(item)}>
              <AssetIcon id={androidIcon(item.role)} size={40} />
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
          <Symbol>lock_open</Symbol>
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
