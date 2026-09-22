/** Pure output formatting for the terminal: column fitting, `ls -l` fields, sizes, dates, stacked tables. */
import type { Line, LineClass, Span } from './types';

export const line = (t: string, cls?: LineClass): Line => (cls ? { t, cls } : { t });
export const dim = (t: string): Line => ({ t, cls: 'dim' });
export const err = (t: string): Line => ({ t, cls: 'err' });

/** A line made of styled spans; `t` is their concatenation. */
export const spansLine = (spans: readonly Span[]): Line => ({ t: spans.map((span) => span.t).join(''), spans });

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** `ls -l` date: `Sep 21  2026` (the year form, deterministic — no wall clock in the engine). */
export function lsDate(iso: string): string {
  const [year = '1970', month = '01', day = '01'] = iso.split('-');
  const name = MONTHS[Math.max(0, Math.min(11, Number(month) - 1))]!;
  return `${name} ${String(Number(day)).padStart(2, ' ')}  ${year}`;
}

/** `-h`: 1.2K · 34K · 1.5M (GNU style, powers of 1024). */
export function humanSize(bytes: number): string {
  if (bytes < 1024) return String(bytes);
  const units = ['K', 'M', 'G'] as const;
  let value = bytes;
  let unit = -1;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return value < 10 ? `${Math.ceil(value * 10) / 10}${units[unit]}` : `${Math.ceil(value)}${units[unit]}`;
}

/** `drwxr-xr-x` from a node kind and mode (sticky bit shown as `t`). */
export function modeString(kind: 'dir' | 'file', mode: number): string {
  const bits = ['r', 'w', 'x'];
  let out = kind === 'dir' ? 'd' : '-';
  for (let shift = 6; shift >= 0; shift -= 3)
    for (let bit = 0; bit < 3; bit++) out += mode & (1 << (shift + 2 - bit)) ? bits[bit] : '-';
  if (mode & 0o1000) out = `${out.slice(0, 9)}${out.endsWith('x') ? 't' : 'T'}`;
  return out;
}

/** UTF-8 byte length (truthful `ls -l` sizes). */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** Display width (code points; good enough for the portfolio's text). */
export const width = (text: string): number => [...text].length;
export const padEnd = (text: string, size: number): string => text + ' '.repeat(Math.max(0, size - width(text)));
export const padStart = (text: string, size: number): string => ' '.repeat(Math.max(0, size - width(text))) + text;

export interface Cell {
  readonly text: string;
  readonly cls?: LineClass;
  readonly insert?: string;
}

/**
 * GNU `ls -C` column layout: entries fill columns top-to-bottom, as many columns as fit in `cols` with two spaces
 * between them. Each entry keeps its colour and its insert text.
 */
export function columns(cells: readonly Cell[], cols: number): Line[] {
  if (cells.length === 0) return [];
  const widths = cells.map((cell) => width(cell.text));
  const gap = 2;
  let rows = cells.length;
  for (let count = cells.length; count >= 1; count--) {
    const tryRows = Math.ceil(cells.length / count);
    let total = 0;
    for (let col = 0; col < count; col++) {
      let widest = 0;
      for (let row = 0; row < tryRows; row++) widest = Math.max(widest, widths[col * tryRows + row] ?? 0);
      total += widest + (col < count - 1 ? gap : 0);
    }
    if (total <= cols) {
      rows = tryRows;
      break;
    }
  }
  const count = Math.ceil(cells.length / rows);
  const colWidths = Array.from({ length: count }, (_, col) => {
    let widest = 0;
    for (let row = 0; row < rows; row++) widest = Math.max(widest, widths[col * rows + row] ?? 0);
    return widest;
  });
  const out: Line[] = [];
  for (let row = 0; row < rows; row++) {
    const spans: Span[] = [];
    for (let col = 0; col < count; col++) {
      const cell = cells[col * rows + row];
      if (!cell) continue;
      const last = col === count - 1 || !cells[(col + 1) * rows + row];
      spans.push({
        t: cell.text,
        ...(cell.cls ? { cls: cell.cls } : {}),
        ...(cell.insert ? { insert: cell.insert } : {}),
      });
      if (!last) spans.push({ t: ' '.repeat(colWidths[col]! - width(cell.text) + gap) });
    }
    out.push(spansLine(spans));
  }
  return out;
}

/**
 * A table: aligned columns when it fits, else (under 50 columns) a stacked format — one field per line, keys dimmed
 * (linux/10 "Output on narrow screens").
 */
export function table(
  headers: readonly string[],
  rows: readonly (readonly Cell[])[],
  cols: number,
  maxWidths: readonly (number | null)[] = [],
): Line[] {
  if (cols < 50) {
    const out: Line[] = [];
    rows.forEach((row, index) => {
      if (index) out.push({ t: '' });
      row.forEach((cell, col) => {
        const key = headers[col] ?? '';
        out.push(
          spansLine([
            { t: padEnd(key.toLowerCase(), 8), cls: 'dim' },
            { t: cell.text, ...(cell.cls ? { cls: cell.cls } : {}), ...(cell.insert ? { insert: cell.insert } : {}) },
          ]),
        );
      });
    });
    return out;
  }
  const clip = (text: string, max: number | null | undefined) =>
    max && width(text) > max ? `${[...text].slice(0, Math.max(1, max - 1)).join('')}…` : text;
  const clipped = rows.map((row) => row.map((cell, col) => ({ ...cell, text: clip(cell.text, maxWidths[col]) })));
  const colWidths = headers.map((header, col) =>
    Math.max(width(header), ...clipped.map((row) => width(row[col]?.text ?? ''))),
  );
  const render = (cells: readonly Cell[], headerRow: boolean): Line =>
    spansLine(
      cells.flatMap((cell, col) => {
        const text = col === cells.length - 1 ? cell.text : padEnd(cell.text, colWidths[col]! + 2);
        return [
          {
            t: text,
            ...(headerRow ? { cls: 'head' as const } : cell.cls ? { cls: cell.cls } : {}),
            ...(cell.insert ? { insert: cell.insert } : {}),
          },
        ];
      }),
    );
  return [
    render(
      headers.map((text) => ({ text })),
      true,
    ),
    ...clipped.map((row) => render(row, false)),
  ];
}

/** Optimal-string-alignment (Damerau-Levenshtein) distance, for "Did you mean …?". */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i ? (j ? 0 : i) : j)),
  );
  for (let i = 1; i < rows; i++)
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        value = Math.min(value, d[i - 2]![j - 2]! + 1);
      d[i]![j] = value;
    }
  return d[a.length]![b.length]!;
}

/** Longest common prefix of the candidates. */
export function commonPrefix(values: readonly string[]): string {
  if (values.length === 0) return '';
  let prefix = values[0]!;
  for (const value of values.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < value.length && prefix[i] === value[i]) i++;
    prefix = prefix.slice(0, i);
  }
  return prefix;
}
