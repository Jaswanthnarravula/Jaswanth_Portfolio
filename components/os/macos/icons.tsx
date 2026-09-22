/**
 * macOS artwork drawn inline (both asset modes): the desktop folder and document icons, Finder's sidebar and toolbar
 * glyphs, the traffic-light glyphs and the Dock's minimized-window tile. App icons never live here — they come from
 * the asset manifest (`AssetIcon`). Sidebar/toolbar glyphs are Lucide paths (ISC; credit in `GLYPH_CREDIT`) at a
 * 1.5 px stroke, tuned to SF-like weight (plans/macos/01-identity "Iconography"). All decorative (`aria-hidden`).
 */
import type { SVGProps } from 'react';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { readonly size?: number };

const svg = ({ size = 16, ...rest }: IconProps) =>
  ({ width: size, height: size, 'aria-hidden': true, focusable: false, ...rest }) as const;

/** The Big Sur–style folder: a darker back panel with its tab, a lighter front flap, a highlight line. */
export function FolderIcon({ size = 64, className }: { size?: number; className?: string }) {
  const id = `mac-folder-${size}`;
  return (
    <svg viewBox="0 0 64 52" width={size} height={Math.round(size * 0.8125)} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-back`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4d9fe8" />
          <stop offset="1" stopColor="#3587dc" />
        </linearGradient>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9ed5fc" />
          <stop offset="1" stopColor="#6ab8f5" />
        </linearGradient>
      </defs>
      <path
        d="M3 7.5A4.5 4.5 0 0 1 7.5 3h13.3a4.5 4.5 0 0 1 3.4 1.6l2.3 2.7a2 2 0 0 0 1.5.7H56.5A4.5 4.5 0 0 1 61 12.5v31A4.5 4.5 0 0 1 56.5 48h-49A4.5 4.5 0 0 1 3 43.5z"
        fill={`url(#${id}-back)`}
      />
      <rect x="3" y="13" width="58" height="35" rx="4.5" fill={`url(#${id}-front)`} />
      <path d="M7.5 13.6h49" stroke="#ffffff" strokeOpacity=".6" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * A PDF's Quick Look thumbnail: the first page, drawn as a white sheet with the résumé's heading and text lines (the
 * desktop item and the Dock stack show the document, as macOS does).
 */
export function DocumentIcon({ size = 64, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 48 62" width={Math.round(size * 0.774)} height={size} className={className} aria-hidden="true">
      <rect x="1" y="1" width="46" height="60" rx="3" fill="#ffffff" stroke="rgb(0 0 0 / .12)" />
      <rect x="7" y="8" width="22" height="3.2" rx="1.6" fill="#4d5563" />
      <rect x="7" y="14" width="30" height="1.8" rx=".9" fill="#b9c0cc" />
      {[21, 25, 29, 33, 40, 44, 48, 52].map((y, index) => (
        <rect key={y} x="7" y={y} width={index % 4 === 3 ? 22 : 34} height="1.6" rx=".8" fill="#c9ced8" />
      ))}
      <rect x="7" y="37" width="14" height="1.8" rx=".9" fill="#7a8392" />
    </svg>
  );
}

const lucide = (props: IconProps) => ({
  ...svg(props),
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const HomeGlyph = (props: IconProps) => (
  <svg {...lucide(props)}>
    <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
    <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

export const FolderGlyph = (props: IconProps) => (
  <svg {...lucide(props)}>
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </svg>
);

export const DocumentGlyph = (props: IconProps) => (
  <svg {...lucide(props)}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M16 13H8" />
    <path d="M16 17H8" />
  </svg>
);

export const ChevronLeft = (props: IconProps) => (
  <svg {...lucide({ strokeWidth: 2, ...props })}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export const ChevronRight = (props: IconProps) => (
  <svg {...lucide({ strokeWidth: 2, ...props })}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export const SearchGlyph = (props: IconProps) => (
  <svg {...lucide({ strokeWidth: 2, ...props })}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.8-3.8" />
  </svg>
);

export const WindowsGlyph = (props: IconProps) => (
  <svg {...lucide(props)}>
    <rect x="3" y="4" width="13" height="10" rx="2" />
    <path d="M8 18h11a2 2 0 0 0 2-2V9" />
  </svg>
);

export const ControlsGlyph = (props: IconProps) => (
  <svg {...svg(props)} viewBox="0 0 24 24">
    <circle cx="5" cy="12" r="3.2" fill="#ff5f57" />
    <circle cx="12" cy="12" r="3.2" fill="#febc2e" />
    <circle cx="19" cy="12" r="3.2" fill="#28c840" />
  </svg>
);

/** Traffic-light glyphs, drawn at the dot's 12 px size (shown on hover, focus and in high contrast). */
export const CloseMark = () => (
  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
    <path d="M3.8 3.8l4.4 4.4M8.2 3.8l-4.4 4.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);
export const MinimizeMark = () => (
  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
    <path d="M3.2 6h5.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);
export const ZoomMark = () => (
  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
    <path d="M3.3 7.4V3.3h4.1z M8.7 4.6v4.1H4.6z" fill="currentColor" />
  </svg>
);

/** The Dock's minimized-window tile: a small window (title bar + body lines). */
export function WindowTile({ size = 48 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 36" width={size} height={Math.round(size * 0.75)} aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="46" height="34" rx="4" fill="#f6f6f7" stroke="rgb(0 0 0 / .18)" />
      <path d="M1 5a4 4 0 0 1 4-4h38a4 4 0 0 1 4 4v4H1z" fill="#e3e3e6" />
      <circle cx="6" cy="5" r="1.4" fill="#ff5f57" />
      <circle cx="10.5" cy="5" r="1.4" fill="#febc2e" />
      <circle cx="15" cy="5" r="1.4" fill="#28c840" />
      <rect x="1.5" y="9" width="12" height="25.5" fill="#e1e5ec" />
      <rect x="17" y="14" width="18" height="2" rx="1" fill="#2f6fe4" />
      <rect x="17" y="19" width="24" height="1.6" rx=".8" fill="#c9ced8" />
      <rect x="17" y="23" width="20" height="1.6" rx=".8" fill="#c9ced8" />
    </svg>
  );
}
