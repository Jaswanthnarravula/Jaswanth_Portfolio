/**
 * Glyphs for the original (parametric) icon set — shared/11 `ASSET-ORIG-01`.
 * Source: Lucide (lucide-static 0.469.0), ISC License — Copyright (c) Lucide Contributors 2022; portions (c) Cole
 * Bemis 2013-2022 as part of Feather (MIT). 24×24 viewBox, drawn as 2 px round strokes.
 */
export type GlyphElement =
  | { readonly t: 'path'; readonly d: string }
  | { readonly t: 'circle'; readonly cx: number; readonly cy: number; readonly r: number }
  | {
      readonly t: 'rect';
      readonly x: number;
      readonly y: number;
      readonly w: number;
      readonly h: number;
      readonly rx: number;
    };

const path = (d: string): GlyphElement => ({ t: 'path', d });
const circle = (cx: number, cy: number, r: number): GlyphElement => ({ t: 'circle', cx, cy, r });
const rect = (x: number, y: number, w: number, h: number, rx: number): GlyphElement => ({ t: 'rect', x, y, w, h, rx });

export const GLYPHS = {
  compass: [
    path('m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z'),
    circle(12, 12, 10),
  ],
  globe: [circle(12, 12, 10), path('M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20'), path('M2 12h20')],
  folder: [
    path(
      'm6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2',
    ),
  ],
  document: [
    path('M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z'),
    path('M14 2v4a2 2 0 0 0 2 2h4'),
    path('M10 9H8'),
    path('M16 13H8'),
    path('M16 17H8'),
  ],
  image: [rect(3, 3, 18, 18, 2), circle(9, 9, 2), path('m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21')],
  mail: [rect(2, 4, 20, 16, 2), path('m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7')],
  message: [path('M7.9 20A9 9 0 1 0 4 16.1L2 22Z')],
  terminal: [path('m7 11 2-2-2-2'), path('M11 13h4'), rect(3, 3, 18, 18, 2)],
  settings: [
    path(
      'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
    ),
    circle(12, 12, 3),
  ],
  notebook: [
    path('M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4'),
    path('M2 6h4'),
    path('M2 10h4'),
    path('M2 14h4'),
    path('M2 18h4'),
    path(
      'M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z',
    ),
  ],
  code: [path('m18 16 4-4-4-4'), path('m6 8-4 4 4 4'), path('m14.5 4-5 16')],
  branch: [path('M6 3v12'), circle(18, 6, 3), circle(6, 18, 3), path('M18 9a9 9 0 0 1-9 9')],
  note: [path('M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z'), path('M15 3v4a2 2 0 0 0 2 2h4')],
  window: [rect(2, 4, 20, 16, 2), path('M10 4v4'), path('M2 8h20'), path('M6 4v4')],
  search: [circle(11, 11, 8), path('m21 21-4.3-4.3')],
} as const satisfies Record<string, readonly GlyphElement[]>;

export type GlyphId = keyof typeof GLYPHS;
export const GLYPH_CREDIT = 'Lucide (ISC License, © Lucide Contributors; portions © Cole Bemis, Feather, MIT)';
