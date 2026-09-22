'use client';
/**
 * Quick actions and context previews — plans/ios/surfaces/quick-actions.md (`IOS-QA-01…05`).
 *   · Icons: the pressed icon **lifts** (scale 1.08 + shadow) while everything else blurs and dims (one blur surface); a
 *     menu (material `thick`, radius 14 pt, 44 pt rows, label left + glyph right, hairlines) grows from the icon-side
 *     corner (spring r 0.35 ζ 0.75), placed above or below the icon, aligned to its nearest edge and clamped inside
 *     the safe area (`menuPlacement`, unit-tested).
 *   · Content rows: the row's content lifts into a rounded preview card (radius 20 pt, `aria-hidden` — its facts are in
 *     the row already) centred above the menu.
 *   · The menu is the `Menu` primitive (APG: arrows, Home/End, type-ahead, Enter; Esc / outside press close; focus
 *     returns to the icon or row). Actions run after the menu closes; apps open with a flight from the **icon**.
 */
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Menu, type MenuEntry } from '@/components/primitives/Menu';
import type { IosLayout, IosRole, QuickAction } from '../model';
import { IOS_SPRINGS, springIn } from '../motion';
import type { PreviewSpec } from '../shell-context';
import { Glyph, type GlyphName } from '../ui/glyphs';
import { AppArt } from './Icons';
import styles from '../ios.module.css';

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * Where the menu goes: below the anchor when it fits (else above), its left edge aligned to the anchor's nearest
 * screen edge, clamped inside the safe area (plans/ios/surfaces/quick-actions "Responsive").
 */
export function menuPlacement(
  anchor: Rect,
  menu: { readonly w: number; readonly h: number },
  viewport: { readonly w: number; readonly h: number },
  safe: { readonly top: number; readonly bottom: number; readonly side: number } = { top: 48, bottom: 34, side: 12 },
  gap = 10,
): { x: number; y: number; placement: 'below' | 'above'; origin: string } {
  const below = anchor.y + anchor.h + gap;
  const fitsBelow = below + menu.h <= viewport.h - safe.bottom;
  const above = anchor.y - gap - menu.h;
  const placement = fitsBelow || above < safe.top ? 'below' : 'above';
  const rawY = placement === 'below' ? below : above;
  const leftAligned = anchor.x + anchor.w / 2 < viewport.w / 2;
  const rawX = leftAligned ? anchor.x : anchor.x + anchor.w - menu.w;
  // Clamp inside the safe area; a menu larger than the room keeps its leading / top edge on screen.
  const x = Math.max(safe.side, Math.min(rawX, viewport.w - safe.side - menu.w));
  const y = Math.max(safe.top, Math.min(rawY, viewport.h - safe.bottom - menu.h));
  const origin = `${leftAligned ? 'left' : 'right'} ${placement === 'below' ? 'top' : 'bottom'}`;
  return { x: Math.round(x), y: Math.round(y), placement, origin };
}

const GLYPH_FOR: Readonly<Record<QuickAction['glyph'], GlyphName>> = {
  doc: 'doc',
  download: 'download',
  briefcase: 'briefcase',
  graduation: 'graduation',
  repo: 'repo',
  grid: 'grid',
  compose: 'compose',
  copy: 'copy',
  hello: 'hand',
  safari: 'globe',
  plain: 'plain',
  note: 'note',
  access: 'access',
  switch: 'switch',
  link: 'link',
  open: 'arrow-up-right',
};

export type QuickSpec =
  | {
      readonly kind: 'icon';
      readonly role: IosRole | null;
      readonly label: string;
      readonly anchor: HTMLElement;
      readonly actions: readonly QuickAction[];
      readonly onAction: (action: QuickAction) => void;
    }
  | { readonly kind: 'preview'; readonly spec: PreviewSpec };

export function QuickActions({
  spec,
  layout,
  onClose,
}: {
  readonly spec: QuickSpec;
  readonly layout: IosLayout;
  readonly onClose: () => void;
}) {
  const anchorEl = spec.kind === 'icon' ? spec.anchor : spec.spec.anchor;
  const returnFocus = useRef<HTMLElement | null>(anchorEl) as RefObject<HTMLElement | null>;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [rect] = useState(() => {
    const r = anchorEl.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  });
  const width = layout === 'pad' ? 250 : 254;
  const rows = spec.kind === 'icon' ? spec.actions.length : spec.spec.actions.length;
  const previewHeight = spec.kind === 'preview' ? 150 : 0;
  const [place, setPlace] = useState(() =>
    menuPlacement(
      { ...rect, y: rect.y, h: rect.h },
      { w: width, h: rows * 44 + 8 + previewHeight },
      { w: window.innerWidth, h: window.innerHeight },
    ),
  );

  // Re-measure once rendered (real row heights), then grow from the icon-side corner.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const next = menuPlacement(
      rect,
      { w: box.width, h: box.height + previewHeight },
      { w: window.innerWidth, h: window.innerHeight },
    );
    if (next.x !== place.x || next.y !== place.y) setPlace(next);
    const list = el.querySelector<HTMLElement>('[role="menu"]');
    if (list) {
      list.style.transformOrigin = next.origin;
      springIn(
        list,
        IOS_SPRINGS.quickMenu,
        { transform: 'scale(0.2)', opacity: 0 },
        { transform: 'scale(1)', opacity: 1 },
      );
    }
    // Once per menu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items: MenuEntry[] =
    spec.kind === 'icon'
      ? spec.actions.map((action, index) => ({
          kind: 'item',
          id: action.id || String(index),
          label: action.label,
          icon: <Glyph name={GLYPH_FOR[action.glyph]} size={18} />,
          onSelect: () => {
            onClose();
            spec.onAction(action);
          },
        }))
      : spec.spec.actions.map((action) => ({
          kind: 'item',
          id: action.id,
          label: action.label,
          icon: (
            <Glyph
              name={action.id === 'open' ? 'arrow-up-right' : action.id === 'share' ? 'share' : 'link'}
              size={18}
            />
          ),
          onSelect: () => {
            onClose();
            action.run();
          },
        }));

  const label = spec.kind === 'icon' ? `${spec.label} actions` : `${spec.spec.title} actions`;

  return (
    <div className={styles.qa} data-quick-actions="" data-layout={layout}>
      <div className={styles.qaBackdrop} aria-hidden="true" />
      {spec.kind === 'icon' && spec.role ? (
        <span
          className={styles.qaLift}
          aria-hidden="true"
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.w }}
        >
          <AppArt role={spec.role} size={Math.round(rect.w)} />
        </span>
      ) : null}
      {spec.kind === 'preview' ? (
        <div
          className={styles.qaPreview}
          aria-hidden="true"
          style={{
            left: place.x,
            top: place.placement === 'below' ? place.y : place.y,
            width: Math.max(width, Math.min(360, window.innerWidth - 24)),
          }}
        >
          <p className={styles.qaPreviewTitle}>{spec.spec.title}</p>
          {spec.spec.summary ? <p className={styles.qaPreviewSummary}>{spec.spec.summary}</p> : null}
          {spec.spec.meta?.length ? <p className={styles.qaPreviewMeta}>{spec.spec.meta.join(' · ')}</p> : null}
        </div>
      ) : null}
      <Menu
        label={label}
        items={items}
        onClose={onClose}
        returnFocusTo={returnFocus}
        position={{ x: place.x, y: place.y + previewHeight }}
        className={styles.qaMenu}
        anchorRef={menuRef}
      />
    </div>
  );
}
