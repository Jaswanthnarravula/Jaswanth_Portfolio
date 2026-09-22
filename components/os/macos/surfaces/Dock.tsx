'use client';
/**
 * The Dock — plans/macos/surfaces/dock.md (`MAC-DOCK-01…10`). A floating pill of pinned apps as real links, in the
 * storyboard's order (Finder · Safari · GitHub · Mail · Preview · VS Code · Terminal · System Settings ‖ Résumé stack,
 * minimized windows), with:
 *   · running dots from the session's running apps — closing a window keeps its app running; only Quit removes the
 *     dot (`MAC-WM-07`); names say ", open" / ", minimized" / ", running";
 *   · magnification on a fine pointer when enabled in Settings (../dock-magnify.ts — transforms on the ticker, zero
 *     React state, off while the Dock overflows, on touch, in compact and under reduced motion) (`MAC-DOCK-02`);
 *   · the launch bounce only while the app's chunk is loading (520 ms, 18 px; a pulsing dot under reduced motion)
 *     (`MAC-DOCK-03`); hovering or focusing an icon preloads its chunk, so cached launches never bounce;
 *   · labels on hover and on focus-visible (the focused icon grows to 1.25, no neighbour effect) (`MAC-DOCK-05`);
 *   · the context menu — right-click, Shift+F10, long-press, or the ⋯ on the focused icon (`MAC-DOCK-06`); the
 *     Résumé stack opens Preview in one click and offers Open / Download in its menu (`MAC-DOCK-07`);
 *   · compact: 48 px icons in a horizontally scrolling Dock with a "Windows" button; landscape turns it into a left
 *     rail (arrow keys go Up/Down) (`MAC-DOCK-10`); it hides while an on-screen keyboard is up in portrait.
 * Clicking an icon is the kernel's Dock decision table (`MAC-WM-08`: open / restore / focus / no-op).
 */
import { gsap } from 'gsap';
import { memo, useEffect, useRef, type MouseEvent } from 'react';
import { usePress } from '@/components/primitives/Press';
import { RovingGroup } from '@/components/primitives/RovingGroup';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { KernelLink, hrefFor } from '@/components/shell/KernelLink';
import type { AppRole } from '@/lib/kernel/ids';
import { macDockIcon } from '@/lib/kernel/registry';
import { currentLocation } from '@/lib/kernel/state';
import { focusKeys, type KernelState, type WindowId, type WindowInstance } from '@/lib/kernel/types';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { useKernel, usePrefs } from '@/stores/kernel-context';
import { dispatchSoon } from '@/stores/kernel-store';
import { preloadApp } from '../apps/registry';
import { createMagnifier } from '../dock-magnify';
import { MoreGlyph } from '../glyphs';
import { DocumentIcon, WindowTile, WindowsGlyph } from '../icons';
import { DOCK_ORDER, macBinding, windowLabel } from '../model';
import { MAC_TIMING } from '../timing';
import { openContextMenu, useMacUi } from '../ui';
import styles from '../macos.module.css';

// Narrow selectors return strings, so the Dock re-renders only when a dot, a label or the tile list changes.
/** Per pinned app: '' not running · 'o' open · 'm' minimized · 'r' running without a window. */
const selectStatus = (state: KernelState) =>
  DOCK_ORDER.map((role) => {
    const session = state.sessions.macos;
    const phase = session.windows[`macos:${role}` as WindowId]?.phase.s;
    if (phase === 'minimized') return 'm';
    if (phase && phase !== 'closing') return 'o';
    return session.running.includes(role) ? 'r' : '';
  }).join(',');
const selectMinimized = (state: KernelState) =>
  Object.values(state.sessions.macos.windows)
    .filter((window): window is WindowInstance => !!window && window.phase.s === 'minimized')
    .map((window) => window.id)
    .join(' ');
const selectFocusedRole = (state: KernelState) => state.sessions.macos.focused?.split(':')[1] ?? null;
const STATE_SUFFIX: Readonly<Record<string, string>> = { o: ', open', m: ', minimized', r: ', running', '': '' };

/** Where a context menu opens for a Dock item: the pointer, or above the item for Shift+F10 / the Menu key. */
function menuPoint(event: MouseEvent<HTMLElement>): { x: number; y: number } {
  if (event.clientX !== 0 || event.clientY !== 0) return { x: event.clientX, y: event.clientY };
  const box = event.currentTarget.getBoundingClientRect();
  return { x: box.left, y: box.top };
}

function Bounce({ role, children }: { role: AppRole; children: React.ReactNode }) {
  const loading = useMacUi((state) => state.loading.includes(role));
  const node = useRef<HTMLSpanElement>(null);
  // The launch bounce: GSAP `y` yoyo while the chunk loads, landing softly when it resolves (`MAC-DOCK-03`).
  useEffect(() => {
    const el = node.current;
    if (!el || !loading || prefersReducedMotion()) return;
    const half = MAC_TIMING.dock.bounceMs / 2000;
    const tween = gsap.to(el, {
      y: -MAC_TIMING.dock.bouncePx,
      duration: half,
      ease: 'power2.out',
      yoyo: true,
      repeat: -1,
    });
    return () => {
      tween.kill();
      gsap.to(el, { y: 0, duration: half, ease: 'power2.in' });
    };
  }, [loading]);
  return (
    <span ref={node} className={styles.bounce} data-loading={loading || undefined}>
      {children}
    </span>
  );
}

function AppItem({
  role,
  status,
  focused,
  iconSize,
}: {
  role: AppRole;
  status: string;
  focused: boolean;
  iconSize: number;
}) {
  const binding = macBinding(role);
  const id = `dock-${binding.slug}`;
  const running = status !== '';
  const menu = (x: number, y: number) => openContextMenu({ kind: 'dock', role }, x, y, id);
  const press = usePress({ onLongPress: (_origin, point) => menu(point.x, point.y) });
  return (
    <li className={styles.dockItem} data-magnify="">
      <KernelLink
        to={{ os: 'macos', role }}
        id={id}
        originId={id}
        invoker={focusKeys.launcher('macos', role)}
        data-focus-key={focusKeys.launcher('macos', role)}
        data-roving-item=""
        data-running={running || undefined}
        aria-current={focused ? 'true' : undefined}
        className={styles.dockLink}
        onPointerEnter={() => preloadApp(role)}
        onFocus={() => preloadApp(role)}
        onPointerDown={press.onPointerDown}
        onPointerMove={press.onPointerMove}
        onPointerUp={press.onPointerUp}
        onPointerCancel={press.onPointerCancel}
        onContextMenu={(event: MouseEvent<HTMLAnchorElement>) => {
          event.preventDefault();
          const point = menuPoint(event);
          menu(point.x, point.y);
        }}
      >
        <Bounce role={role}>
          <span className={styles.magnifyIcon} data-magnify-icon="">
            <AssetIcon id={binding.icon} size={iconSize} priority className={styles.dockIcon} />
          </span>
        </Bounce>
        <span className="sr-only">
          {binding.title}
          {STATE_SUFFIX[status]}
        </span>
        {running ? <span className={styles.runningDot} aria-hidden="true" /> : null}
      </KernelLink>
      <span className={styles.dockLabel} data-dock-label="" aria-hidden="true">
        {binding.title}
      </span>
      <button
        type="button"
        className={styles.dockMore}
        tabIndex={-1}
        aria-label={`${binding.title} options`}
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          menu(box.left, box.top);
        }}
      >
        <MoreGlyph size={12} />
      </button>
    </li>
  );
}

/** A minimized window's tile: a real link to the window's location; a click restores it (`MAC-DOCK-04`). */
function MinimizedTile({ id, iconSize }: { readonly id: WindowId; readonly iconSize: number }) {
  const window = useKernel((state) => state.sessions.macos.windows[id]);
  if (!window) return null;
  return (
    <li className={styles.dockItem} data-magnify="">
      <a
        href={hrefFor({ os: 'macos', role: window.role, location: currentLocation(window) })}
        className={styles.dockLink}
        data-dock-tile={window.id}
        data-focus-key={focusKeys.dockTile(window.id)}
        data-roving-item=""
        onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          dispatchSoon({ type: 'RESTORE', id: window.id });
        }}
      >
        <span
          className={`${styles.tile} ${styles.magnifyIcon}`}
          data-magnify-icon=""
          style={{ width: iconSize, height: iconSize }}
        >
          <WindowTile size={iconSize} />
          <span className={styles.tileBadge}>
            <AssetIcon id={macBinding(window.role).icon} size={Math.round(iconSize * 0.42)} />
          </span>
        </span>
        <span className="sr-only">{windowLabel(window)}, minimized window</span>
      </a>
      <span className={styles.dockLabel} data-dock-label="" aria-hidden="true">
        {windowLabel(window)}
      </span>
    </li>
  );
}

export const Dock = memo(function Dock({
  compact,
  onShowWindows,
  inert = false,
}: {
  readonly compact: boolean;
  readonly onShowWindows: () => void;
  readonly inert?: boolean;
}) {
  const status = useKernel(selectStatus).split(',');
  const minimizedKey = useKernel(selectMinimized);
  const focusedRole = useKernel(selectFocusedRole);
  const viewport = useKernel((state) => state.viewport);
  // Magnification belongs to the fine-pointer posture only (plans/macos/04: none on touch or compact).
  const coarse = useKernel((state) => state.viewport.posture !== 'pointer');
  const dock = usePrefs((prefs) => prefs.dock);
  const minimized = (minimizedKey ? minimizedKey.split(' ') : []) as WindowId[];
  const rail = compact && viewport.orientation === 'landscape';
  const iconSize = compact ? 48 : macDockIcon(viewport, dock.size);
  const nav = useRef<HTMLElement>(null);
  const magnifies = dock.magnification && !compact && !coarse;

  // Magnification: pointer events drive a ticker-side effect; nothing here re-renders on pointermove.
  useEffect(() => {
    const el = nav.current;
    const list = el?.querySelector<HTMLElement>('[data-dock-list]');
    if (!el || !list || !magnifies) return;
    const magnifier = createMagnifier(list, () => iconSize);
    // Off while the Dock does not fit the page (it would scroll) and under reduced motion.
    const enabled = () => {
      if (prefersReducedMotion()) return false;
      const box = list.getBoundingClientRect();
      return box.left >= 0 && box.right <= window.innerWidth;
    };
    const onEnter = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && enabled()) magnifier.enter(event.clientX);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') magnifier.move(event.clientX);
    };
    const onLeave = () => magnifier.leave();
    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      magnifier.kill();
    };
  }, [magnifies, iconSize]);

  const onResumeMenu = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const point = menuPoint(event);
    openContextMenu({ kind: 'dock-resume' }, point.x, point.y, 'dock-resume');
  };

  return (
    <nav
      ref={nav}
      id="mac-dock"
      className={styles.dock}
      aria-label="Dock"
      data-dock=""
      data-rail={rail || undefined}
      inert={inert || undefined}
      style={{ ['--dock-icon' as string]: `${iconSize}px` }}
    >
      <RovingGroup
        as="ul"
        orientation={rail ? 'vertical' : 'horizontal'}
        role="list"
        className={styles.dockList}
        data-dock-list=""
      >
        {DOCK_ORDER.map((role, index) => (
          <AppItem
            key={role}
            role={role}
            status={status[index] ?? ''}
            focused={focusedRole === role}
            iconSize={iconSize}
          />
        ))}
        <li className={styles.dockSeparator} aria-hidden="true" />
        <li className={styles.dockItem} data-magnify="">
          <KernelLink
            to={{ os: 'macos', ref: { section: 'resume' } }}
            id="dock-resume"
            originId="dock-resume"
            data-roving-item=""
            className={styles.dockLink}
            aria-label="Résumé (PDF)"
            onContextMenu={onResumeMenu}
          >
            <span
              className={`${styles.stack} ${styles.magnifyIcon}`}
              data-magnify-icon=""
              style={{ width: iconSize, height: iconSize }}
            >
              <DocumentIcon size={Math.round(iconSize * 0.92)} />
            </span>
          </KernelLink>
          <span className={styles.dockLabel} data-dock-label="" aria-hidden="true">
            Résumé.pdf
          </span>
        </li>
        {minimized.map((id) => (
          <MinimizedTile key={id} id={id} iconSize={iconSize} />
        ))}
        <li className={styles.dockItem} hidden={!compact || undefined}>
          <button
            type="button"
            className={styles.dockLink}
            data-roving-item={compact ? '' : undefined}
            aria-haspopup="dialog"
            onClick={onShowWindows}
          >
            <span className={styles.windowsButton} style={{ width: iconSize, height: iconSize }}>
              <WindowsGlyph size={26} />
            </span>
            <span className="sr-only">Windows</span>
          </button>
        </li>
      </RovingGroup>
    </nav>
  );
});
