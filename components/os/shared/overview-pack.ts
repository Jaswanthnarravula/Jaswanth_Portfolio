/**
 * Window-overview packing — a pure function shared by macOS Mission Control (plans/macos/surfaces/mission-control.md
 * `MAC-MC-01`) and the Windows Task View: live window rects → non-overlapping tiles that keep each window's aspect
 * ratio, laid out in rows that are centred in the available area. The row count is chosen to make the tiles as large
 * as possible; tiles never grow taller than the tallest window; below `minWidth` the grid stops shrinking and the overview
 * scrolls (`height` then exceeds the area).
 */

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface PackInput {
  readonly id: string;
  readonly rect: Box;
}

export interface PackOptions {
  /** Where tiles may go (page coordinates). */
  readonly area: Box;
  /** Space between tiles, horizontally and vertically. */
  readonly gap?: number;
  /** Room reserved under every tile for its title. */
  readonly label?: number;
  /** Tiles never get narrower than this; past it the overview scrolls. */
  readonly minWidth?: number;
}

export interface PackedTile extends Box {
  readonly id: string;
  /** Tile size ÷ window size (uniform: the aspect ratio is kept). */
  readonly scale: number;
}

export interface Packing {
  readonly tiles: readonly PackedTile[];
  /** Total height the tiles need (> `area.h` when the minimum width forces scrolling). */
  readonly height: number;
}

const aspect = (box: Box) => (box.h > 0 ? box.w / box.h : 1);

/** Split `items` (already in reading order) into `rows` rows of near-equal counts. */
function split<T>(items: readonly T[], rows: number): T[][] {
  const out: T[][] = [];
  const base = Math.floor(items.length / rows);
  let extra = items.length % rows;
  let index = 0;
  for (let row = 0; row < rows; row++) {
    const count = base + (extra > 0 ? 1 : 0);
    extra = Math.max(0, extra - 1);
    out.push(items.slice(index, index + count));
    index += count;
  }
  return out.filter((row) => row.length > 0);
}

export function packOverview(windows: readonly PackInput[], options: PackOptions): Packing {
  const { area } = options;
  const gap = options.gap ?? 24;
  const label = options.label ?? 28;
  const minWidth = options.minWidth ?? 0;
  if (windows.length === 0 || area.w <= 0 || area.h <= 0) return { tiles: [], height: 0 };

  // Reading order: top to bottom by centre, then left to right inside each row.
  const ordered = [...windows].sort(
    (a, b) => a.rect.y + a.rect.h / 2 - (b.rect.y + b.rect.h / 2) || a.rect.x - b.rect.x || a.id.localeCompare(b.id),
  );
  const tallest = Math.max(...windows.map((window) => window.rect.h));

  let best: { rows: PackInput[][]; height: number; score: number } | null = null;
  for (let count = 1; count <= ordered.length; count++) {
    const rows = split(ordered, count).map((row) =>
      [...row].sort((a, b) => a.rect.x - b.rect.x || a.id.localeCompare(b.id)),
    );
    const byWidth = Math.min(
      ...rows.map(
        (row) => (area.w - gap * (row.length - 1)) / row.reduce((sum, window) => sum + aspect(window.rect), 0),
      ),
    );
    const byHeight = (area.h - gap * (rows.length - 1)) / rows.length - label;
    const height = Math.max(1, Math.min(byWidth, byHeight, tallest));
    const score = height * height * ordered.reduce((sum, window) => sum + aspect(window.rect), 0);
    if (!best || score > best.score + 1e-6) best = { rows, height, score };
  }
  let chosen = best!;
  let rowHeight = chosen.height;
  // Never narrower than the minimum: the rows re-flow so each fits the width at that size, and the overview scrolls.
  const narrowest = Math.min(...ordered.map((window) => aspect(window.rect)));
  if (minWidth > 0 && rowHeight * narrowest < minWidth) {
    rowHeight = minWidth / narrowest;
    const widest = Math.max(...ordered.map((window) => aspect(window.rect)));
    const perRow = Math.max(1, Math.floor((area.w + gap) / (rowHeight * widest + gap)));
    const rows = split(ordered, Math.ceil(ordered.length / perRow)).map((row) =>
      [...row].sort((a, b) => a.rect.x - b.rect.x || a.id.localeCompare(b.id)),
    );
    chosen = { rows, height: rowHeight, score: 0 };
  }

  const totalHeight = chosen.rows.length * (rowHeight + label) + gap * (chosen.rows.length - 1);
  let y = area.y + Math.max(0, (area.h - totalHeight) / 2);
  const tiles: PackedTile[] = [];
  for (const row of chosen.rows) {
    const widths = row.map((window) => aspect(window.rect) * rowHeight);
    const rowWidth = widths.reduce((sum, width) => sum + width, 0) + gap * (row.length - 1);
    let x = area.x + (area.w - rowWidth) / 2;
    row.forEach((window, index) => {
      const w = widths[index]!;
      tiles.push({ id: window.id, x, y, w, h: rowHeight, scale: rowHeight / window.rect.h });
      x += w + gap;
    });
    y += rowHeight + label + gap;
  }
  // Tiles in the caller's order, so DOM order can stay the windows' own order.
  const byId = new Map(tiles.map((tile) => [tile.id, tile]));
  return { tiles: windows.map((window) => byId.get(window.id)!), height: totalHeight };
}

/** Two boxes overlap (used by the tests and by callers that assert the invariant in development). */
export const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
