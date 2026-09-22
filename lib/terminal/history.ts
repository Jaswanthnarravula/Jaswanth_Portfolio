/**
 * History — linux/02 `LNX-SH-06` (+ history expansion from `LNX-SH-02`). Pure functions: the host keeps the list in the
 * kernel session and a cursor while the visitor browses it.
 *   · record: capped at 200, consecutive duplicates collapsed, lines starting with a space never recorded;
 *   · ↑ / ↓ browse with the **current draft preserved** (↓ past the newest entry gives the draft back);
 *   · Ctrl+R reverse-search: the newest entry containing the query, searching older on each repeat;
 *   · `!!`, `!n`, `!prefix` expand before the line is tokenized (never inside single quotes), and are echoed.
 */

export const HISTORY_CAP = 200;

export function record(history: readonly string[], line: string): readonly string[] {
  if (!line.trim() || line.startsWith(' ')) return history;
  if (history[history.length - 1] === line) return history;
  const next = [...history, line];
  return next.length > HISTORY_CAP ? next.slice(next.length - HISTORY_CAP) : next;
}

/** Browsing state: `index === entries.length` means "on the draft". */
export interface HistoryCursor {
  readonly entries: readonly string[];
  readonly index: number;
  readonly draft: string;
}

export const cursorAt = (entries: readonly string[], draft = ''): HistoryCursor => ({
  entries,
  index: entries.length,
  draft,
});

/** ↑ — older. `current` is what the input holds now (saved as the draft when leaving it). */
export function older(cursor: HistoryCursor, current: string): { cursor: HistoryCursor; value: string } {
  if (cursor.index === 0 || cursor.entries.length === 0) return { cursor, value: current };
  const draft = cursor.index === cursor.entries.length ? current : cursor.draft;
  const index = cursor.index - 1;
  return { cursor: { ...cursor, index, draft }, value: cursor.entries[index]! };
}

/** ↓ — newer; past the newest entry the draft comes back. */
export function newer(cursor: HistoryCursor, current: string): { cursor: HistoryCursor; value: string } {
  if (cursor.index >= cursor.entries.length) return { cursor, value: current };
  const index = cursor.index + 1;
  const value = index === cursor.entries.length ? cursor.draft : cursor.entries[index]!;
  return { cursor: { ...cursor, index }, value };
}

/** Ctrl+R: the newest entry at or before `from` (exclusive of `from` itself when repeating) that contains `query`. */
export function reverseSearch(
  entries: readonly string[],
  query: string,
  from = entries.length,
): { index: number; match: string } | null {
  if (!query) return null;
  for (let index = Math.min(from, entries.length) - 1; index >= 0; index--)
    if (entries[index]!.includes(query)) return { index, match: entries[index]! };
  return null;
}

export type Expansion =
  | { readonly ok: true; readonly line: string; readonly changed: boolean }
  | { readonly ok: false; readonly spec: string };

const EVENT_END = /[\s;&|<>()'"`]/;

/** `!!` · `!n` · `!-n` · `!prefix` (bash designators), left alone inside single quotes, after `\`, or before a space. */
export function expandHistory(line: string, history: readonly string[]): Expansion {
  if (!line.includes('!')) return { ok: true, line, changed: false };
  let out = '';
  let changed = false;
  let single = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '\\' && i + 1 < line.length) {
      out += c + line[i + 1];
      i++;
      continue;
    }
    if (c === "'") single = !single;
    if (c !== '!' || single) {
      out += c;
      continue;
    }
    const next = line[i + 1];
    if (next === undefined || /[\s=(]/.test(next)) {
      out += c;
      continue;
    }
    let spec: string;
    let value: string | undefined;
    if (next === '!') {
      spec = '!!';
      value = history[history.length - 1];
    } else {
      let j = i + 1;
      while (j < line.length && !EVENT_END.test(line[j]!) && line[j] !== '!') j++;
      spec = line.slice(i, j);
      const body = spec.slice(1);
      if (/^-?\d+$/.test(body)) {
        const n = Number(body);
        value = n < 0 ? history[history.length + n] : history[n - 1];
      } else {
        for (let k = history.length - 1; k >= 0; k--)
          if (history[k]!.startsWith(body)) {
            value = history[k];
            break;
          }
      }
    }
    if (value === undefined) return { ok: false, spec };
    out += value;
    changed = true;
    i += spec.length - 1;
  }
  return { ok: true, line: out, changed };
}
