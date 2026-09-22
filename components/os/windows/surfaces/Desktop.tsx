'use client';
/**
 * The desktop — plans/windows/surfaces/desktop.md (`WIN-DESK-01…05`). Shortcuts aligned from the **top-left**,
 * column-first, snapped to a 76 × 96 grid: This PC · Résumé.pdf · Projects (shortcut) · Experience · About {name}
 * (Edge shortcut) · Recycle Bin (decorative). Items are real links (no-JS pages; the open flight starts at the icon).
 *   · fine pointer: click selects, double-click / Enter opens; coarse pointer or a keyboard click opens directly;
 *   · marquee on empty desktop (cosmetic selection, drawn on the ticker — no layout), Ctrl+click toggles;
 *   · right-click / long-press / Shift+F10 → the desktop or item context menu (View · Sort by · Refresh · Properties…);
 *   · one tab stop; arrows move spatially (the visual column-first grid), type-ahead, Home/End.
 */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { usePress } from '@/components/primitives/Press';
import { RovingGroup } from '@/components/primitives/RovingGroup';
import { hrefFor, type KernelTarget } from '@/components/shell/KernelLink';
import { AssetIcon } from '@/components/ui/AssetIcon';
import type { ContentRef } from '@/data/schema';
import { getExperience, getPerson, getResume } from '@/data/selectors';
import { formatUpdated } from '@/components/content';
import { drag } from '@/lib/motion/drag';
import { dispatchSoon } from '@/stores/kernel-store';
import {
  flSwap,
  flDesktop,
  flDownload,
  flInfo,
  flLink,
  flOpen,
  flPaint,
  flRefresh,
  flShare,
  flSort,
  flView,
  flWindowNew,
} from '../fluent.generated';
import { Fl, PdfFile, ShortcutArrow } from '../icons';
import { requestIntent } from '../intents';
import { userRoot } from '../model';
import { useWinShell } from '../shell-context';
import styles from '../windows.module.css';

type Kind = 'system' | 'pdf' | 'shortcut' | 'folder' | 'edge' | 'bin';

interface DeskItem {
  readonly id: string;
  readonly label: string;
  readonly kind: Kind;
  readonly to: KernelTarget | null;
  readonly ref: ContentRef | null;
}

/** The desktop's shortcuts (plans/windows/surfaces/desktop "Portfolio mapping"), labels from data. */
export function desktopItems(): readonly DeskItem[] {
  return [
    { id: 'desk-thispc', label: 'This PC', kind: 'system', to: { os: 'windows', role: 'files' }, ref: null },
    {
      id: 'desk-resume',
      label: 'Résumé.pdf',
      kind: 'pdf',
      to: { os: 'windows', ref: { section: 'resume' } },
      ref: { section: 'resume' },
    },
    {
      id: 'desk-projects',
      label: 'Projects',
      kind: 'shortcut',
      to: { os: 'windows', ref: { section: 'projects' } },
      ref: { section: 'projects' },
    },
    {
      id: 'desk-experience',
      label: 'Experience',
      kind: 'folder',
      to: { os: 'windows', ref: { section: 'experience' } },
      ref: { section: 'experience' },
    },
    {
      id: 'desk-about',
      label: `About ${getPerson().givenName}`,
      kind: 'edge',
      to: { os: 'windows', role: 'browser' },
      ref: { section: 'about' },
    },
    { id: 'desk-bin', label: 'Recycle Bin', kind: 'bin', to: null, ref: null },
  ];
}

export type IconSize = 'large' | 'medium' | 'small';
const ICON_PX: Readonly<Record<IconSize, number>> = { large: 64, medium: 48, small: 32 };

const TYPES: Readonly<Record<Kind, string>> = {
  system: 'System folder',
  pdf: 'PDF Document',
  shortcut: 'Shortcut',
  folder: 'File folder',
  edge: 'Internet Shortcut',
  bin: 'Recycle Bin',
};

function DeskIcon({ item, size }: { readonly item: DeskItem; readonly size: number }) {
  switch (item.kind) {
    case 'system':
      return <AssetIcon id="system.windows-this-pc" size={size} priority />;
    case 'folder':
      return <AssetIcon id="system.windows-folder" size={size} priority />;
    case 'bin':
      return <AssetIcon id="system.windows-recycle-bin" size={size} priority />;
    case 'pdf':
      return <PdfFile size={size} />;
    case 'shortcut':
      return (
        <span className={styles.deskComposite}>
          <AssetIcon id="app.windows.github" size={Math.round(size * 0.86)} priority />
          <span className={styles.deskArrow}>
            <ShortcutArrow size={Math.max(12, Math.round(size / 3.2))} />
          </span>
        </span>
      );
    case 'edge':
      return (
        <span className={styles.deskComposite}>
          <AssetIcon id="app.windows.edge" size={Math.round(size * 0.86)} priority />
          <span className={styles.deskArrow}>
            <ShortcutArrow size={Math.max(12, Math.round(size / 3.2))} />
          </span>
        </span>
      );
  }
}

const open = (item: DeskItem) => {
  if (!item.to) return;
  const to = item.to;
  if ('ref' in to)
    dispatchSoon({
      type: 'OPEN_APP',
      os: 'windows',
      role: 'files',
      location: { kind: 'content', ref: to.ref },
      originId: item.id,
      invoker: item.id,
    });
  else
    dispatchSoon({
      type: 'OPEN_APP',
      os: 'windows',
      role: to.role,
      location: to.location,
      originId: item.id,
      invoker: item.id,
    });
};

export function Desktop({
  inert,
  compact,
  coarse,
}: {
  readonly inert: boolean;
  readonly compact: boolean;
  readonly coarse: boolean;
}) {
  const shell = useWinShell();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [size, setSize] = useState<IconSize>('medium');
  const [sort, setSort] = useState<'default' | 'name' | 'type'>('default');
  const [blink, setBlink] = useState(false);
  const surface = useRef<HTMLDivElement>(null);
  const marquee = useRef<SVGRectElement>(null);

  const base = desktopItems();
  const items =
    sort === 'default'
      ? base
      : [...base].sort((a, b) =>
          sort === 'name' ? a.label.localeCompare(b.label) : TYPES[a.kind].localeCompare(TYPES[b.kind]),
        );

  // "Refresh" replays a one-frame icon blink — authentic, and harmless.
  useLayoutEffect(() => {
    if (!blink) return;
    const handle = setTimeout(() => setBlink(false), 80);
    return () => clearTimeout(handle);
  }, [blink]);

  const properties = (item: DeskItem) => {
    const rows: [string, string][] = [
      ['Type', TYPES[item.kind]],
      ['Location', `${userRoot()}\\Desktop`],
    ];
    if (item.kind === 'pdf') rows.push(['Modified', formatUpdated(getResume().updated)]);
    if (item.kind === 'folder') rows.push(['Contains', `${getExperience().length} files`]);
    if (item.kind === 'shortcut') rows.push(['Target', 'GitHub — Projects']);
    if (item.kind === 'edge') rows.push(['Target', 'Microsoft Edge — About']);
    shell.openProperties({ title: item.label, rows, ref: item.ref });
  };

  const itemMenu = (item: DeskItem, at: { x: number; y: number }, invoker: HTMLElement | null) => {
    if (!item.to) return;
    shell.openMenu({
      label: `${item.label} actions`,
      at,
      returnFocusTo: invoker,
      commands: [
        {
          id: 'copy-link',
          label: 'Copy link',
          icon: <Fl icon={flLink} />,
          disabled: !item.ref,
          onSelect: () => shell.copyLink(item.ref, item.label),
        },
        {
          id: 'share',
          label: 'Share',
          icon: <Fl icon={flShare} />,
          disabled: !item.ref,
          onSelect: () => shell.copyLink(item.ref, item.label),
        },
        ...(item.kind === 'pdf'
          ? [
              {
                id: 'download',
                label: 'Download',
                icon: <Fl icon={flDownload} />,
                onSelect: () => document.querySelector<HTMLAnchorElement>('[data-resume-download]')?.click(),
              },
            ]
          : []),
      ],
      items: [
        {
          kind: 'item',
          id: 'open',
          label: 'Open',
          shortcut: 'Enter',
          icon: <Fl icon={flOpen} />,
          onSelect: () => open(item),
        },
        {
          kind: 'item',
          id: 'new-window',
          label: 'Open in new window',
          icon: <Fl icon={flWindowNew} />,
          disabled: true,
          onSelect: () => undefined,
        },
        { kind: 'separator', id: 's1' },
        {
          kind: 'item',
          id: 'properties',
          label: 'Properties',
          icon: <Fl icon={flInfo} />,
          onSelect: () => properties(item),
        },
      ],
      legacy: [
        { kind: 'item', id: 'l-open', label: 'Open', onSelect: () => open(item) },
        {
          kind: 'item',
          id: 'l-path',
          label: 'Copy as path',
          onSelect: () => shell.copyText(`"${userRoot()}\\Desktop\\${item.label}"`, 'Path copied'),
        },
        { kind: 'separator', id: 'l-s' },
        { kind: 'item', id: 'l-properties', label: 'Properties', onSelect: () => properties(item) },
      ],
    });
  };

  const desktopMenu = (at: { x: number; y: number }) =>
    shell.openMenu({
      label: 'Desktop',
      at,
      returnFocusTo: surface.current,
      items: [
        {
          kind: 'submenu',
          id: 'view',
          label: 'View',
          icon: <Fl icon={flView} />,
          items: (['large', 'medium', 'small'] as const).map((value) => ({
            kind: 'checkbox' as const,
            id: `view-${value}`,
            label: `${value[0]!.toUpperCase()}${value.slice(1)} icons`,
            checked: size === value,
            onSelect: () => setSize(value),
          })),
        },
        {
          kind: 'submenu',
          id: 'sort',
          label: 'Sort by',
          icon: <Fl icon={flSort} />,
          items: [
            {
              kind: 'checkbox',
              id: 'sort-name',
              label: 'Name',
              checked: sort === 'name',
              onSelect: () => setSort('name'),
            },
            {
              kind: 'checkbox',
              id: 'sort-type',
              label: 'Item type',
              checked: sort === 'type',
              onSelect: () => setSort('type'),
            },
          ],
        },
        {
          kind: 'item',
          id: 'refresh',
          label: 'Refresh',
          icon: <Fl icon={flRefresh} />,
          onSelect: () => setBlink(true),
        },
        { kind: 'separator', id: 's1' },
        {
          kind: 'item',
          id: 'display',
          label: 'Display settings',
          icon: <Fl icon={flDesktop} />,
          onSelect: () => openSettings('system'),
        },
        {
          kind: 'item',
          id: 'personalize',
          label: 'Personalize',
          icon: <Fl icon={flPaint} />,
          onSelect: () => openSettings('personalization'),
        },
        { kind: 'separator', id: 's2' },
        {
          kind: 'item',
          id: 'switch',
          label: 'Switch operating system',
          icon: <Fl icon={flSwap} />,
          onSelect: () => dispatchSoon({ type: 'SWITCH_OS', to: null, via: 'switch' }),
        },
      ],
      legacy: [
        { kind: 'item', id: 'l-refresh', label: 'Refresh', onSelect: () => setBlink(true) },
        { kind: 'item', id: 'l-copy', label: 'Paste', disabled: true, onSelect: () => undefined },
        { kind: 'separator', id: 'l-s' },
        { kind: 'item', id: 'l-personalize', label: 'Personalize', onSelect: () => openSettings('personalization') },
      ],
    });

  const openSettings = (page: 'system' | 'personalization') => {
    requestIntent({ kind: 'settings', page });
    dispatchSoon({ type: 'OPEN_APP', os: 'windows', role: 'settings', originId: null });
  };

  // Empty-desktop press: marquee (fine pointers) and the desktop menu.
  const surfacePress = usePress({
    onLongPress: (_origin, point) => desktopMenu(point),
  });
  useEffect(() => {
    const el = surface.current;
    if (!el || compact) return;
    const onDown = (event: PointerEvent) => {
      if (event.target !== el || event.button !== 0 || event.pointerType !== 'mouse') return;
      if (!event.ctrlKey) setSelected(new Set());
      const rect = marquee.current;
      const host = el.getBoundingClientRect();
      const boxes = [...(surface.current?.querySelectorAll<HTMLElement>('[data-desk-item]') ?? [])].map((node) => ({
        id: node.dataset.deskItem!,
        box: node.getBoundingClientRect(),
      }));
      const x0 = event.clientX - host.left;
      const y0 = event.clientY - host.top;
      drag(el, event, {
        onStart: () => rect?.setAttribute('visibility', 'visible'),
        onMove: (dx, dy) => {
          const x = Math.min(x0, x0 + dx);
          const y = Math.min(y0, y0 + dy);
          const w = Math.abs(dx);
          const h = Math.abs(dy);
          rect?.setAttribute('x', String(x));
          rect?.setAttribute('y', String(y));
          rect?.setAttribute('width', String(w));
          rect?.setAttribute('height', String(h));
          const hit = new Set(
            boxes
              .filter(
                ({ box }) =>
                  box.left - host.left < x + w &&
                  box.right - host.left > x &&
                  box.top - host.top < y + h &&
                  box.bottom - host.top > y,
              )
              .map(({ id }) => id),
          );
          setSelectedIfChanged(hit);
        },
        onEnd: () => {
          rect?.setAttribute('visibility', 'hidden');
          rect?.setAttribute('width', '0');
        },
      });
    };
    let last = '';
    const setSelectedIfChanged = (next: Set<string>) => {
      const key = [...next].sort().join('|');
      if (key === last) return;
      last = key;
      setSelected(next);
    };
    el.addEventListener('pointerdown', onDown);
    return () => el.removeEventListener('pointerdown', onDown);
  }, [compact]);

  /** Spatial arrows: the visual grid is column-first, so Right is the next column, Down the next row. */
  const onGridKey = (event: KeyboardEvent<HTMLElement>) => {
    const deltas: Record<string, [number, number]> = {
      ArrowRight: [1, 0],
      ArrowLeft: [-1, 0],
      ArrowDown: [0, 1],
      ArrowUp: [0, -1],
    };
    const delta = deltas[event.key];
    if (!delta) return;
    const current = (event.target as HTMLElement).closest<HTMLElement>('[data-roving-item]');
    const nodes = [...(surface.current?.querySelectorAll<HTMLElement>('[data-roving-item]') ?? [])];
    if (!current) return;
    event.preventDefault();
    const from = current.getBoundingClientRect();
    const cx = from.left + from.width / 2;
    const cy = from.top + from.height / 2;
    let best: HTMLElement | null = null;
    let bestScore = Infinity;
    for (const node of nodes) {
      if (node === current) continue;
      const box = node.getBoundingClientRect();
      const dx = box.left + box.width / 2 - cx;
      const dy = box.top + box.height / 2 - cy;
      const along = dx * delta[0] + dy * delta[1];
      if (along <= 4) continue;
      const across = Math.abs(delta[0] ? dy : dx);
      const score = along + across * 3;
      if (score < bestScore) {
        bestScore = score;
        best = node;
      }
    }
    if (!best) return;
    for (const node of nodes) node.tabIndex = node === best ? 0 : -1;
    best.focus();
  };

  const px = compact ? 48 : coarse ? Math.max(ICON_PX[size], 56) : ICON_PX[size];

  return (
    // The bare desktop's menu (right-click / long-press); Shift+F10 and the ContextMenu key reach the same menu from
    // the icon grid, so this pointer path is never the only way (plans/windows/surfaces/context-menus).
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      ref={surface}
      className={styles.desktop}
      data-desktop=""
      data-icon-size={size}
      data-blink={blink || undefined}
      inert={inert || undefined}
      onContextMenu={(event) => {
        if (event.target !== event.currentTarget) return;
        surfacePress.onContextMenu(event);
      }}
    >
      <RovingGroup
        as="ul"
        orientation="grid"
        role="list"
        aria-label="Desktop"
        className={styles.deskGrid}
        onKeyDown={onGridKey}
      >
        {items.map((item) => (
          <DesktopItem
            key={item.id}
            item={item}
            size={px}
            selected={selected.has(item.id)}
            coarse={coarse || compact}
            onSelect={(id, toggle) =>
              setSelected((current) => {
                if (!toggle) return new Set([id]);
                const next = new Set(current);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onMenu={itemMenu}
          />
        ))}
      </RovingGroup>
      <svg className={styles.marquee} aria-hidden="true" data-marquee="">
        <rect ref={marquee} visibility="hidden" rx="1" />
      </svg>
    </div>
  );
}

function DesktopItem({
  item,
  size,
  selected,
  coarse,
  onSelect,
  onMenu,
}: {
  readonly item: DeskItem;
  readonly size: number;
  readonly selected: boolean;
  readonly coarse: boolean;
  readonly onSelect: (id: string, toggle: boolean) => void;
  readonly onMenu: (item: DeskItem, at: { x: number; y: number }, invoker: HTMLElement | null) => void;
}) {
  const link = useRef<HTMLAnchorElement>(null);
  const press = usePress({
    onLongPress: (origin, point) => {
      onSelect(item.id, false);
      const box = link.current?.getBoundingClientRect();
      onMenu(
        item,
        origin === 'keyboard' && box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : point,
        link.current,
      );
    },
  });

  const icon = (
    <span className={styles.deskIcon} aria-hidden="true" style={{ width: size, height: size }}>
      <DeskIcon item={item} size={size} />
    </span>
  );

  if (!item.to)
    return (
      // Decorative: named for sighted visitors only, never focusable (plans/windows/surfaces/desktop).
      <li className={styles.deskCell} aria-hidden="true" data-decorative="">
        <span className={styles.deskItem}>
          {icon}
          <span className={styles.deskLabel}>{item.label}</span>
        </span>
      </li>
    );

  return (
    <li className={styles.deskCell}>
      <a
        ref={link}
        id={item.id}
        href={hrefFor(item.to)}
        className={styles.deskItem}
        data-desk-item={item.id}
        data-roving-item=""
        data-label={item.label}
        aria-current={selected ? 'true' : undefined}
        data-selected={selected || undefined}
        onPointerDown={press.onPointerDown}
        onPointerMove={press.onPointerMove}
        onPointerUp={press.onPointerUp}
        onPointerCancel={press.onPointerCancel}
        onContextMenu={press.onContextMenu}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          press.onClick(event);
          if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.shiftKey || event.altKey) return;
          if (event.ctrlKey) {
            event.preventDefault();
            onSelect(item.id, true);
            return;
          }
          event.preventDefault();
          // A keyboard click (detail 0) or a coarse pointer opens; a fine-pointer click selects.
          if (event.detail === 0 || coarse) open(item);
          else onSelect(item.id, false);
        }}
        onDoubleClick={(event) => {
          event.preventDefault();
          open(item);
        }}
      >
        {icon}
        <span className={styles.deskLabel}>{item.label}</span>
      </a>
    </li>
  );
}
