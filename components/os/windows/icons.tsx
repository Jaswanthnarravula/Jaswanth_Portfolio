/**
 * Windows glyphs (both asset modes). System glyphs are Fluent UI System Icons (MIT — plans/windows/01-identity
 * "Iconography"), drawn from `fluent.generated.ts` at 16/20 px in `currentColor`, filled variants for selected
 * states. App icons and the folder / This PC artwork never live here: they come from the asset manifest (`AssetIcon`).
 * Drawn here: the snap-layout miniatures (Windows draws them as outlined zones) and the Explorer file badges. All
 * decorative (`aria-hidden`); the surrounding control carries the name.
 */
import type { CSSProperties } from 'react';
import type { SnapZone } from '@/lib/kernel/types';
import type { Glyph } from './fluent.generated';

export function Fl({
  icon,
  size = 16,
  className,
  style,
}: {
  readonly icon: Glyph;
  readonly size?: number;
  readonly className?: string;
  readonly style?: CSSProperties;
}) {
  return (
    <svg
      viewBox={`0 0 ${icon.box} ${icon.box}`}
      width={size}
      height={size}
      className={className}
      style={style}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      data-glyph=""
    >
      <path d={icon.d} />
    </svg>
  );
}

/**
 * A Word-style document page (the `.docx` files in File Explorer): a white page with a folded corner and a coloured
 * band, never the Word mark itself (third-party mark — `ASSET-MARK-01` keeps marks to app icons).
 */
export function DocFile({ size = 20, tone = '#2b7cd3' }: { readonly size?: number; readonly tone?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true" focusable="false">
      <path
        d="M5 2h7l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"
        fill="#fff"
        stroke="#8a8f98"
        strokeWidth=".8"
      />
      <path d="M12 2v3.2c0 .44.36.8.8.8H16" fill="#e8eaee" stroke="#8a8f98" strokeWidth=".8" />
      <rect x="2.5" y="9" width="8.5" height="7" rx="1" fill={tone} />
      <path d="M4.3 10.6l.9 3.8.9-3 .9 3 .9-3.8" fill="none" stroke="#fff" strokeWidth=".9" strokeLinejoin="round" />
      <path d="M12.5 10.5h2M12.5 12.5h2M12.5 14.5h2" stroke="#b6bbc4" strokeWidth=".8" />
    </svg>
  );
}

/** The PDF document page (Résumé.pdf) — Edge opens PDFs on Windows, so the badge is Edge's own red PDF page. */
export function PdfFile({ size = 20 }: { readonly size?: number }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true" focusable="false">
      <path
        d="M5 2h7l4 4v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"
        fill="#fff"
        stroke="#8a8f98"
        strokeWidth=".8"
      />
      <path d="M12 2v3.2c0 .44.36.8.8.8H16" fill="#e8eaee" stroke="#8a8f98" strokeWidth=".8" />
      <rect x="2.5" y="9.5" width="11" height="6" rx="1" fill="#c8252c" />
      <text
        x="8"
        y="14.1"
        textAnchor="middle"
        fontSize="4.4"
        fontWeight="700"
        fill="#fff"
        fontFamily="Segoe UI, sans-serif"
      >
        PDF
      </text>
    </svg>
  );
}

/** The shortcut arrow overlay on desktop shortcuts (plans/windows/surfaces/desktop "Anatomy"). */
export function ShortcutArrow({ size = 16 }: { readonly size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true" focusable="false">
      <rect x=".5" y=".5" width="15" height="15" rx="2" fill="#fff" stroke="#9aa0a8" />
      <path d="M5 11.5c0-3.3 1.8-5 5-5V4.5l3 3-3 3V8.5c-2 0-3.6.9-5 3z" fill="#1e6fd9" />
    </svg>
  );
}

/** Zones of each snap layout (plans/windows/02 "Snap layouts flyout"), as fractions of the miniature. */
export const SNAP_LAYOUTS: readonly {
  readonly id: string;
  readonly label: string;
  readonly zones: readonly {
    readonly zone: SnapZone;
    readonly label: string;
    readonly box: readonly [number, number, number, number];
  }[];
}[] = [
  {
    id: 'halves',
    label: 'Two halves',
    zones: [
      { zone: 'left', label: 'Snap left half', box: [0, 0, 0.5, 1] },
      { zone: 'right', label: 'Snap right half', box: [0.5, 0, 0.5, 1] },
    ],
  },
  {
    id: 'two-thirds',
    label: 'Two thirds and one third',
    zones: [
      { zone: 'left-two-thirds', label: 'Snap left two thirds', box: [0, 0, 2 / 3, 1] },
      { zone: 'third-r', label: 'Snap right third', box: [2 / 3, 0, 1 / 3, 1] },
    ],
  },
  {
    id: 'thirds',
    label: 'Three thirds',
    zones: [
      { zone: 'third-l', label: 'Snap left third', box: [0, 0, 1 / 3, 1] },
      { zone: 'third-c', label: 'Snap centre third', box: [1 / 3, 0, 1 / 3, 1] },
      { zone: 'third-r', label: 'Snap right third', box: [2 / 3, 0, 1 / 3, 1] },
    ],
  },
  {
    id: 'quarters',
    label: 'Four quarters',
    zones: [
      { zone: 'tl', label: 'Snap top-left quarter', box: [0, 0, 0.5, 0.5] },
      { zone: 'tr', label: 'Snap top-right quarter', box: [0.5, 0, 0.5, 0.5] },
      { zone: 'bl', label: 'Snap bottom-left quarter', box: [0, 0.5, 0.5, 0.5] },
      { zone: 'br', label: 'Snap bottom-right quarter', box: [0.5, 0.5, 0.5, 0.5] },
    ],
  },
];
