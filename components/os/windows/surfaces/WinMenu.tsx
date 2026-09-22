'use client';
/**
 * The Windows menu skin — plans/windows/surfaces/context-menus (`WIN-CTX-01`, `WIN-CTX-03`, `WIN-CTX-05`) on the shared
 * APG `Menu` primitive: rounded Acrylic, a command row of icon buttons across the top, a Fluent glyph beside every item,
 * shortcut hints right-aligned, submenus after a 150 ms hover, and "Show more options", which replaces the menu in place
 * with the legacy list (smaller rows, no command row). Positioned at the pointer, then flipped/clamped inside the
 * workspace above the taskbar. Opens with a 167 ms scale-Y from the pointer edge + fade; closes at once.
 * Also the skin of the system menu, jump lists and Explorer's "⋯" menus.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { Menu, type MenuEntry } from '@/components/primitives/Menu';
import { flMore } from '../fluent.generated';
import { Fl } from '../icons';
import type { ContextMenuSpec } from '../shell-context';
import styles from '../windows.module.css';

const EDGE = 8;

export function WinMenu({
  spec,
  onClose,
  live,
  taskbar,
}: {
  readonly spec: ContextMenuSpec;
  readonly onClose: () => void;
  /** Allowed a live blur by the shell's budget (else the Acrylic tint). */
  readonly live: boolean;
  /** Taskbar height: the workspace the menu must fit in ends above it. */
  readonly taskbar: number;
}) {
  const [legacy, setLegacy] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(spec.returnFocusTo ?? null);
  const keepOpen = useRef(false);

  // Flip / clamp inside the workspace (the menu never hides under the taskbar or past an edge).
  useLayoutEffect(() => {
    const wrapper = anchor.current;
    const menu = wrapper?.firstElementChild as HTMLElement | null;
    if (!wrapper || !menu) return;
    const { width, height } = menu.getBoundingClientRect();
    const maxX = window.innerWidth - EDGE;
    const maxY = window.innerHeight - taskbar - EDGE;
    let x = spec.at.x;
    let y = spec.at.y;
    let origin: 'top' | 'bottom' = 'top';
    if (x + width > maxX) x = Math.max(EDGE, Math.min(x - width, maxX - width));
    if (y + height > maxY) {
      y = Math.max(EDGE, y - height);
      origin = 'bottom';
    }
    wrapper.style.left = `${Math.round(x)}px`;
    wrapper.style.top = `${Math.round(y)}px`;
    wrapper.dataset.origin = origin;
  }, [legacy, spec.at.x, spec.at.y, taskbar]);

  // The primitive closes before it runs the chosen item; "Show more options" cancels that close.
  const close = () =>
    queueMicrotask(() => {
      if (keepOpen.current) {
        keepOpen.current = false;
        return;
      }
      onClose();
    });

  const items: readonly MenuEntry[] = legacy
    ? (spec.legacy ?? [])
    : spec.legacy
      ? [
          ...spec.items,
          { kind: 'separator', id: 'more-sep' },
          {
            kind: 'item',
            id: 'more',
            label: 'Show more options',
            shortcut: 'Shift+F10',
            icon: <Fl icon={flMore} />,
            onSelect: () => {
              keepOpen.current = true;
              setLegacy(true);
            },
          },
        ]
      : spec.items;

  return (
    <div className={styles.menuLayer} data-acrylic={live ? 'live' : 'tint'} data-legacy={legacy || undefined}>
      <Menu
        key={legacy ? 'legacy' : 'modern'}
        label={spec.label}
        items={items}
        commands={legacy ? undefined : spec.commands}
        commandsLabel="Quick actions"
        onClose={close}
        returnFocusTo={returnTo}
        position={spec.at}
        anchorRef={anchor}
        className={styles.menu}
      />
    </div>
  );
}
