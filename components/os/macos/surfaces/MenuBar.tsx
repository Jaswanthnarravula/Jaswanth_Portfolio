'use client';
/**
 * The menu bar — plans/macos/surfaces/menu-bar.md (`MAC-MENU-01…08`). The global bar at the top:
 *   ·  Apple menu (About This Mac · System Settings… · Switch Operating System… · Take the Tour · Lock Screen ·
 *     Restart…), the focused app's **bold** menu, that app's own menus, Window and Help — "Finder" and its menus when
 *     no window is focused, as on a real Mac (menus are data: ../menus.ts);
 *   · the APG menubar model (`Menubar` primitive): one tab stop, Left/Right between titles, Down/Enter opens, Esc
 *     closes to the title, hover switches menus while one is open; menus open in 0 ms, the chosen item blinks and the
 *     menu fades (../menu-entries.ts); shortcut hints are the registry's real chords only;
 *   · status items, a separate group: Résumé (one click to Preview — its context menu offers Open / Download),
 *     Spotlight, Control Center, and the clock (a `<time>`, never live) which opens the Notification Center;
 *   · compact: `` · AppName ▾`` — the app's menus as submenus of one menu — then Résumé · Spotlight · Control Center;
 *     the clock hides below 360 px.
 * A menu open closes any other popover (the overlay arbiter); another overlay taking over closes the menu.
 */
import { memo, useEffect, useRef, useState, type MouseEvent } from 'react';
import { Menubar, type MenubarMenu } from '@/components/primitives/Menu';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { KernelLink } from '@/components/shell/KernelLink';
import { getProjects } from '@/data/selectors';
import type { AppRole } from '@/lib/kernel/ids';
import { isFocusable } from '@/lib/kernel/state';
import type { KernelState, WindowInstance } from '@/lib/kernel/types';
import { useKernel } from '@/stores/kernel-context';
import { getKernel } from '@/stores/kernel-store';
import { DocumentGlyph, SearchGlyph } from '../icons';
import { SlidersGlyph } from '../glyphs';
import { toMenuEntries } from '../menu-entries';
import { menuBarFor, type MenuContext } from '../menus';
import { menuName, windowLabel } from '../model';
import { runMacCommand } from '../run-command';
import { appleKeyboard } from '../shortcuts';
import { closeOverlay, openContextMenu, requestOverlay, useAppState, useMacUi } from '../ui';
import { vscodeMenuFiles } from '../vscode-files';
import styles from '../macos.module.css';
import menuStyles from './context-menu.module.css';

function useClock(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const date = new Date();
      setNow(date);
      timer = setTimeout(tick, 60_000 - (date.getSeconds() * 1000 + date.getMilliseconds()) + 20);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);
  return now;
}

const formatClock = (date: Date) =>
  `${date.toLocaleDateString('en-US', { weekday: 'short' })} ${date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })}`;

/** What the Window menu lists, as a primitive key (the bar re-renders only when a window's label or state changes). */
const selectWindows = (state: KernelState) =>
  Object.values(state.sessions.macos.windows)
    .filter((window): window is WindowInstance => !!window && window.phase.s !== 'closing')
    .map((window) => `${window.id}|${window.phase.s}|${windowLabel(window)}`)
    .join('\n');
const selectFocused = (state: KernelState) => state.sessions.macos.focused;
const selectCompact = (state: KernelState) => state.viewport.posture === 'compact';
const selectTouch = (state: KernelState) => state.viewport.posture === 'touch';

function menuContext(
  role: AppRole | null,
  compact: boolean,
  touch: boolean,
  appState: MenuContext['appState'],
): MenuContext {
  const session = getKernel().sessions.macos;
  const windows = Object.values(session.windows).filter(
    (window): window is WindowInstance => !!window && window.phase.s !== 'closing',
  );
  const top = session.focused ? session.windows[session.focused] : undefined;
  return {
    role,
    appName: menuName(role),
    windowOpen: isFocusable(top),
    zoomed: top?.phase.s === 'maximized',
    compact,
    touch,
    windows: windows.map((window) => ({
      id: window.id,
      label: windowLabel(window),
      focused: window.id === session.focused,
    })),
    projects: getProjects().map((project) => ({
      slug: project.slug,
      name: project.name,
      repo: project.repo,
      live: project.live,
    })),
    appState,
    vscodeFiles: vscodeMenuFiles(),
  };
}

export const MenuBar = memo(function MenuBar({
  app,
  inert = false,
}: {
  readonly app: AppRole | null;
  readonly inert?: boolean;
}) {
  const now = useClock();
  const compact = useKernel(selectCompact);
  const touch = useKernel(selectTouch);
  // Subscribed so the Window menu's list follows the windows; the context is read fresh below.
  useKernel(selectWindows);
  useKernel(selectFocused);
  const appState = useAppState();
  const overlay = useMacUi((state) => state.overlay);
  const bar = useRef<HTMLDivElement>(null);
  const apple = appleKeyboard();

  // Another overlay taking over closes an open menu (a remount of the bar); derived during render.
  const [epoch, setEpoch] = useState(0);
  const [lastOverlay, setLastOverlay] = useState(overlay);
  if (overlay !== lastOverlay) {
    setLastOverlay(overlay);
    if (overlay !== null && overlay !== 'menu' && overlay !== 'banner') setEpoch((value) => value + 1);
  }

  // Tell the arbiter whether a menu is open (it closes popovers such as the Control Center, and they close menus).
  useEffect(() => {
    const node = bar.current;
    if (!node) return;
    const sync = () =>
      queueMicrotask(() => {
        const open = node.querySelector('[data-menubar-item][aria-expanded="true"]') !== null;
        if (open) requestOverlay('menu');
        else closeOverlay('menu');
      });
    node.addEventListener('click', sync);
    node.addEventListener('keydown', sync);
    node.addEventListener('pointerover', sync);
    document.addEventListener('pointerdown', sync, true);
    return () => {
      node.removeEventListener('click', sync);
      node.removeEventListener('keydown', sync);
      node.removeEventListener('pointerover', sync);
      document.removeEventListener('pointerdown', sync, true);
    };
  }, []);

  const menus: MenubarMenu[] = menuBarFor(menuContext(app, compact, touch, appState)).map((menu) => ({
    id: menu.id,
    label: menu.label,
    trigger: menu.id === 'apple' ? <AssetIcon id="system.apple-logo" size={14} priority /> : undefined,
    items: toMenuEntries(menu.items, runMacCommand, { apple }),
  }));

  const onResumeMenu = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    openContextMenu({ kind: 'dock-resume' }, event.clientX, event.clientY, 'menubar-resume');
  };

  return (
    <header className={styles.menubar} data-menubar="" inert={inert || undefined}>
      <div ref={bar} className={styles.menuLeft}>
        <Menubar
          key={`${epoch}-${app ?? 'finder'}-${compact}`}
          label="Menu bar"
          menus={menus}
          className={styles.menuTitles}
          menuClassName={menuStyles.menu}
        />
      </div>
      <div className={styles.status} role="group" aria-label="Status menus">
        <KernelLink
          to={{ os: 'macos', ref: { section: 'resume' } }}
          id="menubar-resume"
          originId="menubar-resume"
          className={styles.statusItem}
          aria-label="Résumé (PDF)"
          onContextMenu={onResumeMenu}
        >
          <DocumentGlyph width={14} height={14} />
          <span className={styles.statusLabel}>Résumé</span>
        </KernelLink>
        <button
          type="button"
          id="menubar-spotlight"
          className={styles.statusItem}
          aria-label="Spotlight"
          aria-expanded={overlay === 'spotlight'}
          onClick={() => runMacCommand({ kind: 'spotlight' })}
        >
          <SearchGlyph size={15} />
        </button>
        <button
          type="button"
          id="menubar-control-center"
          className={styles.statusItem}
          aria-label="Control Center"
          aria-expanded={overlay === 'control-center'}
          data-control-center-button=""
          onClick={() => runMacCommand({ kind: 'control-center' })}
        >
          <SlidersGlyph size={15} />
        </button>
        {now ? (
          <button
            type="button"
            className={`${styles.statusItem} ${styles.clock}`}
            aria-label={`Notification Center, ${formatClock(now)}`}
            aria-expanded={overlay === 'notification-center'}
            data-clock=""
            onClick={() => runMacCommand({ kind: 'notification-center' })}
          >
            <time dateTime={now.toISOString()} aria-hidden="true">
              {formatClock(now)}
            </time>
          </button>
        ) : null}
      </div>
    </header>
  );
});
