'use client';
/**
 * The context menu on screen (plans/macos/surfaces/context-menus.md `MAC-CTX-01…06`). Surfaces ask for one with
 * `openContextMenu(target, x, y, invoker)` — from the `contextmenu` event (right-click, Ctrl+click, Shift+F10, the Menu
 * key, VoiceOver's shortcut), a 500 ms long-press, or a visible "⋯" button — and the arbiter decides. The menu uses the
 * `Menu` primitive (APG keyboard model, focus to the first item, focus back to the invoker), is placed at the pointer
 * and clamped inside the workspace (never under the menu bar or the Dock), sits above the finger on touch, and turns
 * into a bottom sheet in compact mode when it would not fit. It closes on an outside press, Esc, Tab, scroll, window
 * blur, resize or an OS switch.
 */
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { Menu } from '@/components/primitives/Menu';
import { getBinding, macosInsets } from '@/lib/kernel/registry';
import { isFocusable } from '@/lib/kernel/state';
import type { AppRole } from '@/lib/kernel/ids';
import { useKernel, usePrefs } from '@/stores/kernel-context';
import { getKernel } from '@/stores/kernel-store';
import { contextMenuFor, contextMenuLabel, placeMenu, type ContextFacts } from '../context-menus';
import { toMenuEntries } from '../menu-entries';
import { runMacCommand } from '../run-command';
import { appleKeyboard } from '../shortcuts';
import { closeOverlay, overlayInvoker, useMacUi } from '../ui';
import styles from './context-menu.module.css';

function facts(compact: boolean): ContextFacts {
  const session = getKernel().sessions.macos;
  const windows = Object.values(session.windows).filter((window) => window !== undefined);
  const titles: Partial<Record<AppRole, string>> = {};
  for (const role of ['files', 'browser', 'github', 'mail', 'viewer', 'editor', 'terminal', 'settings'] as const)
    titles[role] = getBinding('macos', role)?.title;
  return {
    running: session.running ?? windows.map((window) => window.role),
    visible: windows.filter((window) => isFocusable(window)).map((window) => window.role),
    titles,
    compact,
  };
}

export function ContextMenuHost() {
  const context = useMacUi((state) => (state.overlay === 'context' ? state.context : null));
  const viewport = useKernel((state) => state.viewport);
  const dock = usePrefs((prefs) => prefs.dock);
  const anchor = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLElement | null>(null);
  const compact = viewport.posture === 'compact';
  const coarse = useKernel((state) => state.viewport.posture !== 'pointer');

  // Place before paint: measure the menu, flip / clamp it into the workspace (a layout write, not an animation).
  useLayoutEffect(() => {
    const node = anchor.current;
    if (!context || !node) return;
    const invoker = context.invoker ? document.getElementById(context.invoker) : null;
    back.current = invoker ?? (overlayInvoker('context') as HTMLElement | null);
    const menu = node.firstElementChild as HTMLElement | null;
    const box = menu?.getBoundingClientRect() ?? { width: 220, height: 200 };
    const insets = macosInsets(viewport, { dock });
    const space = {
      left: insets.left,
      top: insets.top,
      right: viewport.w - insets.right,
      bottom: viewport.h - insets.bottom,
    };
    const sheet = compact && box.height > space.bottom - space.top - 16;
    node.toggleAttribute('data-sheet', sheet);
    if (sheet) {
      node.style.removeProperty('left');
      node.style.removeProperty('top');
      return;
    }
    const at = placeMenu({ x: context.x, y: context.y }, { w: box.width, h: box.height }, space, { coarse });
    node.style.left = `${at.x}px`;
    node.style.top = `${at.y}px`;
  }, [context, viewport, dock, compact, coarse]);

  // Scroll, window blur, resize or rotation close the menu (the Menu primitive handles press / Esc / Tab).
  useEffect(() => {
    if (!context) return;
    const close = () => closeOverlay('context');
    const onScroll = (event: Event) => {
      if (anchor.current?.contains(event.target as Node)) return;
      close();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, [context]);

  if (!context) return null;
  const known = facts(compact);
  const items = toMenuEntries(contextMenuFor(context.target, known), runMacCommand, { apple: appleKeyboard() });
  return (
    <Menu
      label={contextMenuLabel(context.target, known)}
      items={items}
      onClose={() => closeOverlay('context')}
      returnFocusTo={back as RefObject<HTMLElement | null>}
      position={{ x: context.x, y: context.y }}
      className={styles.menu}
      anchorRef={anchor}
    />
  );
}
