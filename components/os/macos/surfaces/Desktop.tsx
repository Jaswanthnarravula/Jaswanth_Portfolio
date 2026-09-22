'use client';
/**
 * The desktop — plans/macos/surfaces/desktop.md (`MAC-DESK-01…06`). The storyboard frame's items, in its order, in a
 * top-right column under the menu bar: Résumé.pdf (document), Projects (folder alias → GitHub), Experience (folder →
 * Finder). Items are real links (`KernelLink`): without JavaScript they are ordinary pages; opening one plays the
 * window's open animation from the item's own rect. Labels sit on the text-shadow scrim (`DS-SCRIM-01`).
 *   · fine pointer: a click selects (accent label pill, icon darkened), a double-click opens; touch, pen and the
 *     keyboard (a click with `detail === 0`) open at once (`MAC-DESK-02`);
 *   · a drag on the empty desktop draws the marquee — a fixed full-size layer revealed by `clip-path`, written on the
 *     ticker (no layout writes) — and selects the items it touches (`MAC-DESK-03`); coarse pointers have none;
 *   · one tab stop, 2-D arrows by visual columns, Home/End, type-ahead; Ctrl/Cmd+A selects all, announced (`MAC-DESK-04`);
 *   · a press on the empty desktop clears the selection and gives the menu bar back to Finder (`MAC-DESK-05`);
 *   · right-click, Shift+F10 / the Menu key, a 500 ms long-press, or the ⋯ on the selected item open its context menu;
 *     the empty desktop has its own (`MAC-CTX-02/03`).
 */
import { memo, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { usePress } from '@/components/primitives/Press';
import { RovingGroup } from '@/components/primitives/RovingGroup';
import { KernelLink, type KernelTarget } from '@/components/shell/KernelLink';
import type { ContentRef } from '@/data/schema';
import { drag } from '@/lib/motion/drag';
import { dispatchSoon, getKernel } from '@/stores/kernel-store';
import { announce } from '../announce';
import { MoreGlyph } from '../glyphs';
import { DocumentIcon, FolderIcon } from '../icons';
import { openContextMenu } from '../ui';
import styles from '../macos.module.css';

interface DeskItem {
  readonly id: string;
  readonly label: string;
  readonly kind: 'document' | 'folder';
  readonly ref: ContentRef;
}

const ITEMS: readonly DeskItem[] = [
  { id: 'desk-resume', label: 'Résumé.pdf', kind: 'document', ref: { section: 'resume' } },
  { id: 'desk-projects', label: 'Projects', kind: 'folder', ref: { section: 'projects' } },
  { id: 'desk-experience', label: 'Experience', kind: 'folder', ref: { section: 'experience' } },
];

const targetOf = (item: DeskItem): KernelTarget => ({ os: 'macos', ref: item.ref });

/** Ctrl/Cmd+A and Finder's Edit → Select All reach the mounted desktop through this. */
let selectAll: (() => void) | null = null;
export const selectAllDesktop = () => selectAll?.();

const intersects = (a: DOMRect, b: { left: number; top: number; right: number; bottom: number }) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

function Item({
  item,
  selected,
  onSelect,
}: {
  item: DeskItem;
  selected: boolean;
  onSelect: (id: string, additive: boolean) => void;
}) {
  const pointer = useRef<string>('mouse');
  const menu = (x: number, y: number) =>
    openContextMenu(
      { kind: 'item', ref: item.ref, label: item.label, download: item.ref.section === 'resume' },
      x,
      y,
      item.id,
    );
  const press = usePress({
    onLongPress: (_origin, point) => {
      onSelect(item.id, false);
      menu(point.x, point.y);
    },
  });
  return (
    <li className={styles.deskCell}>
      <KernelLink
        to={targetOf(item)}
        id={item.id}
        originId={item.id}
        invoker={item.id}
        className={styles.deskItem}
        data-roving-item=""
        data-selected={selected || undefined}
        data-label={item.label}
        onPointerDown={(event: PointerEvent<HTMLAnchorElement>) => {
          pointer.current = event.pointerType;
          press.onPointerDown(event);
        }}
        onPointerMove={press.onPointerMove}
        onPointerUp={press.onPointerUp}
        onPointerCancel={press.onPointerCancel}
        onClickCapture={(event: MouseEvent<HTMLAnchorElement>) => {
          // A fine pointer's single click only selects; the double-click (detail 2), touch, pen and the keyboard
          // (detail 0) fall through to the link, which opens the app.
          const fine = getKernel().viewport.posture === 'pointer';
          if (event.detail === 1 && fine && pointer.current === 'mouse' && !event.metaKey && !event.ctrlKey) {
            event.preventDefault();
            onSelect(item.id, event.shiftKey);
          }
        }}
        onContextMenu={(event: MouseEvent<HTMLAnchorElement>) => {
          event.preventDefault();
          onSelect(item.id, false);
          const box = event.currentTarget.getBoundingClientRect();
          // Shift+F10 / the Menu key report no pointer position: open at the item.
          const keyboard = event.clientX === 0 && event.clientY === 0;
          menu(keyboard ? box.left + box.width / 2 : event.clientX, keyboard ? box.bottom : event.clientY);
        }}
      >
        <span className={styles.deskIcon} aria-hidden="true">
          {item.kind === 'folder' ? <FolderIcon size={64} /> : <DocumentIcon size={60} />}
        </span>
        <span className={styles.deskLabel}>{item.label}</span>
        {selected ? <span className="sr-only">, selected</span> : null}
      </KernelLink>
      {selected ? (
        <button
          type="button"
          className={styles.deskMore}
          tabIndex={-1}
          aria-label={`More actions for ${item.label}`}
          onClick={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            menu(box.left, box.bottom);
          }}
        >
          <MoreGlyph size={14} />
        </button>
      ) : null}
    </li>
  );
}

export const Desktop = memo(function Desktop({ inert }: { readonly inert: boolean }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const marquee = useRef<HTMLDivElement>(null);

  const onSelect = (id: string, additive: boolean) =>
    setSelected((current) => {
      if (!additive) return new Set([id]);
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  useEffect(() => {
    selectAll = () => {
      setSelected(new Set(ITEMS.map((item) => item.id)));
      announce(`${ITEMS.length} items selected`);
    };
    return () => {
      selectAll = null;
    };
  }, []);

  // The empty desktop (the page's main area itself): clear, give the bar back to Finder, draw the marquee, or its menu.
  useEffect(() => {
    const layer = marquee.current;
    const main = layer?.closest('main');
    if (!main || !layer) return;
    const onDown = (event: globalThis.PointerEvent) => {
      if (event.target !== main || event.button !== 0) return;
      setSelected(new Set());
      if (getKernel().sessions.macos.focused) dispatchSoon({ type: 'GO_HOME' });
      if (event.pointerType !== 'mouse') return; // no marquee on coarse pointers
      const x0 = event.clientX;
      const y0 = event.clientY;
      const items = ITEMS.map((item) => ({
        id: item.id,
        box: document.getElementById(item.id)?.getBoundingClientRect(),
      }));
      let hit = '';
      drag(main, event, {
        onStart: () => {
          layer.hidden = false;
        },
        onMove: (dx, dy) => {
          const left = Math.min(x0, x0 + dx);
          const top = Math.min(y0, y0 + dy);
          const right = Math.max(x0, x0 + dx);
          const bottom = Math.max(y0, y0 + dy);
          // A full-size fixed layer, revealed by clip-path: no layout writes while dragging.
          layer.style.clipPath = `inset(${top}px ${innerWidth - right}px ${innerHeight - bottom}px ${left}px)`;
          const ids = items
            .filter((item) => item.box && intersects(item.box, { left, top, right, bottom }))
            .map((item) => item.id)
            .join(' ');
          if (ids !== hit) {
            hit = ids;
            setSelected(new Set(ids ? ids.split(' ') : []));
          }
        },
        onEnd: () => {
          layer.hidden = true;
          layer.style.removeProperty('clip-path');
        },
      });
    };
    const onMenu = (event: globalThis.MouseEvent) => {
      if (event.target !== main) return;
      event.preventDefault();
      openContextMenu({ kind: 'desktop' }, event.clientX, event.clientY, null);
    };
    main.addEventListener('pointerdown', onDown);
    main.addEventListener('contextmenu', onMenu);
    return () => {
      main.removeEventListener('pointerdown', onDown);
      main.removeEventListener('contextmenu', onMenu);
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      selectAllDesktop();
    }
  };

  return (
    <>
      <RovingGroup
        as="ul"
        orientation="grid"
        role="list"
        aria-label="Desktop"
        className={styles.desktop}
        inert={inert || undefined}
        onKeyDown={onKeyDown}
        data-desktop=""
      >
        {ITEMS.map((item) => (
          <Item key={item.id} item={item} selected={selected.has(item.id)} onSelect={onSelect} />
        ))}
      </RovingGroup>
      <div ref={marquee} className={styles.marquee} aria-hidden="true" hidden />
    </>
  );
});
