/**
 * iOS interface glyphs — SF Symbols–like line icons drawn inline (original paths plus Lucide geometry, ISC — credit
 * in `GLYPH_CREDIT`), at a 1.9 px stroke to match SF's regular weight at 17 pt. Decorative (`aria-hidden`): every
 * control that shows one also has a text name. App icons never live here — they come from the asset manifest.
 */
import type { SVGProps } from 'react';

export type GlyphName =
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'search'
  | 'share'
  | 'compose'
  | 'ellipsis'
  | 'xmark'
  | 'plus'
  | 'check'
  | 'folder'
  | 'doc'
  | 'tray'
  | 'send'
  | 'paperplane'
  | 'star'
  | 'book'
  | 'person'
  | 'house'
  | 'gear'
  | 'clock'
  | 'trash'
  | 'link'
  | 'copy'
  | 'download'
  | 'tabs'
  | 'text-size'
  | 'refresh'
  | 'lock'
  | 'bell'
  | 'moon'
  | 'sun'
  | 'wifi'
  | 'signal'
  | 'battery'
  | 'speaker'
  | 'speaker-off'
  | 'motion'
  | 'transparency'
  | 'contrast'
  | 'briefcase'
  | 'graduation'
  | 'grid'
  | 'tag'
  | 'sidebar'
  | 'repo'
  | 'globe'
  | 'hand'
  | 'access'
  | 'switch'
  | 'play'
  | 'bubble'
  | 'envelope'
  | 'arrow-up'
  | 'arrow-up-right'
  | 'reply'
  | 'filter'
  | 'pin'
  | 'list'
  | 'icons'
  | 'sort'
  | 'brightness'
  | 'hand-raised'
  | 'map-pin'
  | 'plain'
  | 'shield'
  | 'info'
  | 'textformat'
  | 'find'
  | 'note'
  | 'tour';

type GlyphProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  readonly name: GlyphName;
  readonly size?: number;
  /** Filled variant where one exists (tab bar selection, toggles). */
  readonly filled?: boolean;
};

const P = (d: string, key?: number) => <path key={key ?? d} d={d} />;

/** Stroke paths per glyph on a 24 × 24 grid. */
const PATHS: Readonly<Record<GlyphName, readonly string[]>> = {
  'chevron-left': ['M15 5l-7 7 7 7'],
  'chevron-right': ['M9 5l7 7-7 7'],
  'chevron-down': ['M5 9l7 7 7-7'],
  search: ['M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z', 'M15.3 15.3L20 20'],
  share: [
    'M12 3v12',
    'M8 7l4-4 4 4',
    'M8.5 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5h-2',
  ],
  compose: [
    'M12 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V12',
    'M18.4 3.6a1.9 1.9 0 0 1 2.7 2.7L12.5 15 9 16l1-3.5z',
  ],
  ellipsis: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M7.6 12h.01', 'M12 12h.01', 'M16.4 12h.01'],
  xmark: ['M6 6l12 12', 'M18 6L6 18'],
  plus: ['M12 5v14', 'M5 12h14'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  folder: ['M3.5 7A2 2 0 0 1 5.5 5h4l2 2h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z'],
  doc: ['M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z', 'M14 3v5h5', 'M8.5 13h7', 'M8.5 16.5h7'],
  tray: [
    'M3.5 13.5l2.4-7.2A2 2 0 0 1 7.8 5h8.4a2 2 0 0 1 1.9 1.3l2.4 7.2',
    'M3.5 13.5V18a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-4.5h-5a3 3 0 0 1-6 0z',
  ],
  send: ['M12 19V5', 'M6 11l6-6 6 6'],
  paperplane: ['M21 3L10 14', 'M21 3l-6.5 18-4.5-7-7-4.5z'],
  star: ['M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z'],
  book: ['M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z', 'M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5'],
  person: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4.5 20.5a7.5 7.5 0 0 1 15 0'],
  house: ['M3.5 11L12 4l8.5 7', 'M5.5 9.5V20h5v-5.5h3V20h5V9.5'],
  gear: [
    'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z',
    'M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.6-2-3.4-2.4.9a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.4A7.6 7.6 0 0 0 7 6.4l-2.4-.9-2 3.4 2 1.6a7.7 7.7 0 0 0 0 3l-2 1.6 2 3.4 2.4-.9a7.6 7.6 0 0 0 2.6 1.5l.4 2.4h4l.4-2.4a7.6 7.6 0 0 0 2.6-1.5l2.4.9 2-3.4z',
  ],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5l3.2 2'],
  trash: [
    'M4 6.5h16',
    'M9 6.5V4.5h6v2',
    'M6.5 6.5l1 13a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5l1-13',
    'M10 11v6',
    'M14 11v6',
  ],
  link: [
    'M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1',
    'M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1',
  ],
  copy: [
    'M9 9h10a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 21H9a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 9 9z',
    'M16.5 9V5A1.5 1.5 0 0 0 15 3.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h2.5',
  ],
  download: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7.5v8.5', 'M8.5 12.5L12 16l3.5-3.5'],
  tabs: [
    'M8 8h10.5A1.5 1.5 0 0 1 20 9.5V19a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19V9.5A1.5 1.5 0 0 1 8 8z',
    'M16 8V5a1.5 1.5 0 0 0-1.5-1.5h-9A1.5 1.5 0 0 0 4 5v9.5A1.5 1.5 0 0 0 5.5 16h1',
  ],
  'text-size': ['M3 18l4-11 4 11', 'M4.3 14.5h5.4', 'M13 18l3.2-8.5 3.3 8.5', 'M14 15.7h4.5'],
  refresh: ['M19.5 12a7.5 7.5 0 1 1-2.2-5.3', 'M19.5 4v4h-4'],
  lock: [
    'M6.5 11h11a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-7A1.5 1.5 0 0 1 6.5 11z',
    'M8 11V7.5a4 4 0 0 1 8 0V11',
  ],
  bell: ['M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z', 'M10 21h4'],
  moon: ['M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z'],
  sun: [
    'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z',
    'M12 2v2',
    'M12 20v2',
    'M4.9 4.9l1.4 1.4',
    'M17.7 17.7l1.4 1.4',
    'M2 12h2',
    'M20 12h2',
    'M4.9 19.1l1.4-1.4',
    'M17.7 6.3l1.4-1.4',
  ],
  wifi: ['M2.5 9a14 14 0 0 1 19 0', 'M5.5 12.5a9.5 9.5 0 0 1 13 0', 'M8.5 16a5 5 0 0 1 7 0', 'M12 19.5h.01'],
  signal: ['M4 18v-2', 'M9 18v-5', 'M14 18v-8', 'M19 18V7'],
  battery: [
    'M3.5 8h14A1.5 1.5 0 0 1 19 9.5v5a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 2 14.5v-5A1.5 1.5 0 0 1 3.5 8z',
    'M21.5 11v2',
  ],
  speaker: ['M4 9.5h3.5L12 5.5v13L7.5 14.5H4z', 'M15.5 9a4 4 0 0 1 0 6', 'M18 6.5a7.5 7.5 0 0 1 0 11'],
  'speaker-off': ['M4 9.5h3.5L12 5.5v13L7.5 14.5H4z', 'M16 9.5l5 5', 'M21 9.5l-5 5'],
  motion: ['M4 12h3l2-5 3 10 2-5h6'],
  transparency: ['M12 21a9 9 0 1 0 0-18z', 'M12 3a9 9 0 0 0 0 18'],
  contrast: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 3v18'],
  briefcase: [
    'M4.5 8h15A1.5 1.5 0 0 1 21 9.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-9A1.5 1.5 0 0 1 4.5 8z',
    'M9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8',
    'M3 13h18',
  ],
  graduation: ['M2.5 9L12 4.5 21.5 9 12 13.5z', 'M6.5 11v4.5c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3V11', 'M21.5 9v5.5'],
  grid: ['M4 4h6.5v6.5H4z', 'M13.5 4H20v6.5h-6.5z', 'M4 13.5h6.5V20H4z', 'M13.5 13.5H20V20h-6.5z'],
  tag: ['M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8a1.4 1.4 0 0 1 0 2l-7 7a1.4 1.4 0 0 1-2 0z', 'M8 8h.01'],
  sidebar: [
    'M4.5 4.5h15A1.5 1.5 0 0 1 21 6v12a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V6a1.5 1.5 0 0 1 1.5-1.5z',
    'M9 4.5v15',
    'M5.5 8h1.5',
    'M5.5 11h1.5',
  ],
  repo: [
    'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z',
    'M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3',
    'M9 3v8l2-1.5 2 1.5V3',
  ],
  globe: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M3 12h18', 'M12 3a14 14 0 0 1 0 18', 'M12 3a14 14 0 0 0 0 18'],
  hand: [
    'M8 12V6.5a1.5 1.5 0 0 1 3 0V11',
    'M11 10V5a1.5 1.5 0 0 1 3 0v5',
    'M14 10V6.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5a6 6 0 0 1-4.9-2.6L3.2 15a1.5 1.5 0 0 1 2.4-1.8L8 15',
  ],
  access: [
    'M12 6a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 12 6z',
    'M5 8.5l7 1.5 7-1.5',
    'M12 10v4.5l-3 6.5',
    'M12 14.5l3 6.5',
  ],
  switch: ['M4 9h13l-3.5-3.5', 'M20 15H7l3.5 3.5'],
  play: ['M8 5.5v13l10-6.5z'],
  bubble: [
    'M12 4c4.7 0 8.5 3.1 8.5 7s-3.8 7-8.5 7c-.9 0-1.8-.1-2.6-.3L5 20l1.1-3.6C4.5 15 3.5 13.1 3.5 11c0-3.9 3.8-7 8.5-7z',
  ],
  envelope: [
    'M4.5 5.5h15A1.5 1.5 0 0 1 21 7v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17V7a1.5 1.5 0 0 1 1.5-1.5z',
    'M3.5 7l8.5 6 8.5-6',
  ],
  'arrow-up': ['M12 19V5', 'M6 11l6-6 6 6'],
  'arrow-up-right': ['M7 17L17 7', 'M8.5 7H17v8.5'],
  reply: ['M9.5 6L4 11.5 9.5 17', 'M4 11.5h9.5a6.5 6.5 0 0 1 6.5 6.5v1'],
  filter: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M7.5 9h9', 'M9 12.5h6', 'M10.5 16h3'],
  pin: ['M9 3.5h6l-1 5 3.5 3.5h-11L10 8.5z', 'M12 12v8.5'],
  list: ['M8.5 6.5H20', 'M8.5 12H20', 'M8.5 17.5H20', 'M4.5 6.5h.01', 'M4.5 12h.01', 'M4.5 17.5h.01'],
  icons: ['M4 4h6.5v6.5H4z', 'M13.5 4H20v6.5h-6.5z', 'M4 13.5h6.5V20H4z', 'M13.5 13.5H20V20h-6.5z'],
  sort: ['M7 4v16', 'M3.5 16.5L7 20l3.5-3.5', 'M17 20V4', 'M13.5 7.5L17 4l3.5 3.5'],
  brightness: ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M12 2.5v2', 'M12 19.5v2', 'M2.5 12h2', 'M19.5 12h2'],
  'hand-raised': [
    'M8 13V5.5a1.5 1.5 0 0 1 3 0V12',
    'M11 11.5V4a1.5 1.5 0 0 1 3 0v8',
    'M14 11.5V5.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7c-3 0-4.5-1.7-6-4l-1.6-2.7a1.5 1.5 0 0 1 2.6-1.5L8 15',
  ],
  'map-pin': [
    'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z',
    'M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  ],
  plain: ['M5 4h14v16H5z', 'M8.5 8h7', 'M8.5 12h7', 'M8.5 16h4'],
  shield: ['M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5.5', 'M12 7.5h.01'],
  textformat: ['M4 7V5h16v2', 'M12 5v14', 'M9 19h6'],
  find: ['M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z', 'M15.3 15.3L20 20', 'M8 10.5h5'],
  note: [
    'M6 3.5h9l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1-1.5z',
    'M8.5 11h7',
    'M8.5 14.5h7',
    'M8.5 18h4',
  ],
  tour: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M15.5 8.5l-2 5-5 2 2-5z'],
};

/** Glyphs drawn filled rather than stroked (their "fill" variant, used for selection states). */
const FILLABLE: ReadonlySet<GlyphName> = new Set([
  'star',
  'house',
  'person',
  'folder',
  'bubble',
  'bell',
  'moon',
  'clock',
  'tray',
  'envelope',
  'paperplane',
  'play',
]);

export function Glyph({ name, size = 22, filled = false, strokeWidth = 1.9, ...rest }: GlyphProps) {
  const fill = filled && FILLABLE.has(name);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name].map((d, index) => P(d, index))}
    </svg>
  );
}

export const GLYPH_CREDIT = 'Interface glyphs: original drawings; some geometry after Lucide (ISC License).';
