/**
 * Dependency-free matcher — shared/15 `SRCH-MATCH-01` (≤ 4 KB).
 * Per query token, the best of: exact 1.0 · prefix 0.8 · word-prefix 0.7 · substring 0.5 · Damerau-Levenshtein ≤ 1
 * (tokens ≥ 4 chars) 0.4. Score = Σ token score × field weight (title 1.0, keywords 0.7, subtitle 0.4) × entry weight.
 * Every query token must match. Ties: kind order app › content › action › command, then alphabetical.
 */
import type { SearchEntry, SearchKind, SearchResult } from './types';

export const normalize = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();

export const tokenize = (text: string): string[] =>
  normalize(text)
    .split(/[^\p{L}\p{N}+#]+/u)
    .filter(Boolean);

/** Optimal-string-alignment distance, early exit above 1. */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const restA = a.slice(i + 1);
  const restB = b.slice(i + 1);
  if (a.length === b.length) {
    // substitution, or transposition of adjacent characters
    if (restA === restB) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

export function tokenScore(query: string, candidate: string): number {
  if (candidate === query) return 1;
  if (candidate.startsWith(query)) return 0.8;
  const parts = candidate.split(/[-_.]/);
  if (parts.length > 1 && parts.some((part) => part.startsWith(query))) return 0.7;
  if (query.length >= 2 && candidate.includes(query)) return 0.5;
  if (query.length >= 4 && candidate.length >= 3 && withinOneEdit(query, candidate)) return 0.4;
  return 0;
}

const FIELD_WEIGHTS = { title: 1, keywords: 0.7, subtitle: 0.4 } as const;
const KIND_ORDER: Readonly<Record<SearchKind, number>> = { app: 0, content: 1, action: 2, command: 3 };

interface Prepared {
  readonly entry: SearchEntry;
  readonly title: readonly string[];
  readonly keywords: readonly string[];
  readonly subtitle: readonly string[];
}

export function prepare(entries: readonly SearchEntry[]): readonly Prepared[] {
  return entries.map((entry) => ({
    entry,
    title: tokenize(entry.title),
    keywords: entry.keywords.flatMap(tokenize),
    subtitle: entry.subtitle ? tokenize(entry.subtitle) : [],
  }));
}

function best(query: string, tokens: readonly string[]): number {
  let score = 0;
  for (const token of tokens) {
    const value = tokenScore(query, token);
    if (value > score) score = value;
    if (score === 1) break;
  }
  return score;
}

function titleRanges(title: string, queries: readonly string[]): [number, number][] {
  const lower = normalize(title);
  const ranges: [number, number][] = [];
  for (const query of queries) {
    const at = lower.search(new RegExp(`(^|[^\\p{L}\\p{N}])${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u'));
    if (at >= 0) {
      const start = lower.indexOf(query, at);
      ranges.push([start, start + query.length]);
    }
  }
  return ranges.sort((a, b) => a[0] - b[0]);
}

export function search(prepared: readonly Prepared[], query: string, limit = 20): readonly SearchResult[] {
  const queries = tokenize(query);
  if (queries.length === 0) return [];
  const results: SearchResult[] = [];
  for (const item of prepared) {
    let total = 0;
    let all = true;
    for (const token of queries) {
      const value = Math.max(
        best(token, item.title) * FIELD_WEIGHTS.title,
        best(token, item.keywords) * FIELD_WEIGHTS.keywords,
        best(token, item.subtitle) * FIELD_WEIGHTS.subtitle,
      );
      if (value === 0) {
        all = false;
        break;
      }
      total += value;
    }
    if (!all) continue;
    results.push({ ...item.entry, score: total * item.entry.weight, matched: titleRanges(item.entry.title, queries) });
  }
  return results
    .sort((a, b) => b.score - a.score || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.title.localeCompare(b.title))
    .slice(0, limit);
}

/** Empty query → Résumé, Projects, Contact, then recent items (`SRCH-ZERO-01`). */
export function zeroState(entries: readonly SearchEntry[], recent: readonly string[] = []): readonly SearchEntry[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const pinned = ['content:resume', 'content:projects', 'content:contact'];
  const ids = [...pinned, ...recent.filter((id) => !pinned.includes(id))];
  return ids.map((id) => byId.get(id)).filter((entry): entry is SearchEntry => entry !== undefined);
}
