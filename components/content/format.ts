/** Pure formatting helpers shared by the content views and their text renderers. */
import type { PartialDate } from '@/data/schema';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function formatPartialDate(value: PartialDate | 'present' | null): string | null {
  if (value === null) return null;
  if (value === 'present') return 'Present';
  const [year, month] = value.split('-');
  const name = month ? MONTHS[Number(month) - 1] : undefined;
  return name ? `${name} ${year}` : (year ?? null);
}

/** "Jan 2024 – Dec 2025" · "2019 – 2023" · "Present" · `null` when nothing is published. */
export function formatPeriod(start: PartialDate | null, end: PartialDate | 'present' | null): string | null {
  const from = formatPartialDate(start);
  const to = formatPartialDate(end);
  if (from && to) return `${from} – ${to}`;
  if (to === 'Present') return 'Present';
  return from ?? to;
}

/** Machine-readable `<time dateTime>` value for a partial date. */
export const isoDate = (value: PartialDate | null): string | undefined => value ?? undefined;

export function wrap(text: string, width: number, indent = ''): string[] {
  const max = Math.max(8, width - indent.length);
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (!line) line = word;
      else if (line.length + 1 + word.length <= max) line += ` ${word}`;
      else {
        lines.push(indent + line);
        line = word;
      }
      while (line.length > max) {
        lines.push(indent + line.slice(0, max));
        line = line.slice(max);
      }
    }
    lines.push(indent + line);
  }
  return lines;
}

/** Bullet with hanging indent: "• first line" / "  continuation". */
export function bullet(text: string, width: number, marker = '•'): string[] {
  const [first = '', ...rest] = wrap(text, width - 2);
  return [`${marker} ${first}`, ...rest.map((line) => `  ${line}`)];
}

export const rule = (width: number, char = '─') => char.repeat(Math.max(4, Math.min(width, 80)));

export const byteSize = (bytes: number): string =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
