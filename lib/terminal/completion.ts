/**
 * Completion — linux/02 `LNX-SH-07`. Tab on the first word completes commands and aliases (hidden commands only after
 * the second letter); later words complete VFS paths relative to the cwd (directories get `/`), command-specific
 * argument sets (`open` → the résumé and paths, `man`/`help`/`which`/`type` → commands, `cd` → directories, `skills` →
 * groups) and flags after `-`. One candidate completes (+ space, or `/`); several complete their common prefix, and a
 * second Tab lists them in columns; none rings the bell. **Empty input → `pass`**, so Tab moves focus (the terminal is
 * never a keyboard trap).
 */
import { columns, commonPrefix } from './format';
import { COMMANDS, commandMeta } from './manifest';
import { tokenize, wordText, type Token } from './tokenizer';
import type { Line, Vfs, VfsPath } from './types';
import { isPrivate } from './vfs';

export type Completion =
  | { readonly kind: 'pass' }
  | { readonly kind: 'insert'; readonly value: string; readonly cursor: number }
  | { readonly kind: 'list'; readonly lines: readonly Line[]; readonly value: string; readonly cursor: number }
  | { readonly kind: 'bell' };

export interface CompletionContext {
  readonly vfs: Vfs;
  readonly cwd: VfsPath;
  readonly aliases: ReadonlyMap<string, string>;
  readonly cols: number;
  readonly skillGroups: readonly string[];
}

const COMMAND_ARGS = new Set(['man', 'help', 'which', 'type']);

function commandCandidates(prefix: string, aliases: ReadonlyMap<string, string>): string[] {
  const names = COMMANDS.filter((meta) => !meta.hidden || prefix.length >= 2).map((meta) => meta.name);
  return [...new Set([...names, ...aliases.keys()])].filter((name) => name.startsWith(prefix)).sort();
}

function pathCandidates(word: string, ctx: CompletionContext, dirsOnly: boolean): string[] {
  const slash = word.lastIndexOf('/');
  const dirPart = slash >= 0 ? word.slice(0, slash + 1) : '';
  const base = slash >= 0 ? word.slice(slash + 1) : word;
  let dir: VfsPath | null;
  if (dirPart === '') dir = ctx.cwd;
  else {
    const resolved = ctx.vfs.resolve(ctx.cwd, dirPart === '~/' ? '~' : dirPart);
    dir = resolved.ok && resolved.node.kind === 'dir' ? resolved.path : null;
  }
  if (word === '~') return ['~/'];
  if (!dir) return [];
  const node = ctx.vfs.at(dir);
  if (!node || node.kind !== 'dir' || isPrivate(node)) return [];
  return node.children
    .filter((child) => child.name.startsWith(base) && (base.startsWith('.') || !child.name.startsWith('.')))
    .filter((child) => !dirsOnly || child.kind === 'dir')
    .map((child) => `${dirPart}${child.name}${child.kind === 'dir' ? '/' : ''}`)
    .sort();
}

const separators = new Set(['|', '&&', '||', ';']);

export function complete(input: string, cursor: number, ctx: CompletionContext, listing: boolean): Completion {
  if (!input.trim()) return { kind: 'pass' };
  const before = input.slice(0, cursor);
  const after = input.slice(cursor);
  const { tokens, open } = tokenize(before);
  const endsInSpace = !open && /\s$/.test(before);
  const lastToken: Token | undefined = tokens[tokens.length - 1];
  const current = !endsInSpace && lastToken?.type === 'word' && lastToken.end === before.length ? lastToken : null;
  const wordStart = current ? current.start : before.length;
  const word = current ? wordText(current) : '';

  // Words of the command the cursor is in (since the last operator), excluding the current word.
  const previous: string[] = [];
  for (const token of current ? tokens.slice(0, -1) : tokens) {
    if (token.type === 'op' && separators.has(token.op)) previous.length = 0;
    else if (token.type === 'word') previous.push(wordText(token));
    else previous.push(token.op);
  }
  let candidates: string[];
  if (previous.length === 0) candidates = commandCandidates(word, ctx.aliases);
  else {
    const command = ctx.aliases.get(previous[0]!)?.split(' ')[0] ?? previous[0]!;
    const redirectTarget = ['<', '>', '>>'].includes(previous[previous.length - 1]!);
    if (word.startsWith('-') && !redirectTarget) {
      const meta = commandMeta(command);
      const flags = [...(meta?.flags ?? '')].map((flag) => `-${flag}`);
      candidates = [...flags, ...(meta?.long ?? [])].filter((flag) => flag.startsWith(word)).sort();
    } else if (COMMAND_ARGS.has(command)) candidates = commandCandidates(word, new Map());
    else if (command === 'cd') candidates = pathCandidates(word, ctx, true);
    else if (command === 'skills') candidates = ctx.skillGroups.filter((group) => group.startsWith(word));
    else if (command === 'open' || command === 'xdg-open')
      candidates = [...(word && 'resume'.startsWith(word) ? ['resume'] : []), ...pathCandidates(word, ctx, false)];
    else candidates = pathCandidates(word, ctx, false);
  }
  candidates = [...new Set(candidates)];

  if (candidates.length === 0) return { kind: 'bell' };
  const replaceWith = (replacement: string): Completion => ({
    kind: 'insert',
    value: before.slice(0, wordStart) + replacement + after,
    cursor: wordStart + replacement.length,
  });
  if (candidates.length === 1) {
    const only = candidates[0]!;
    return replaceWith(only.endsWith('/') ? only : `${only} `);
  }
  const prefix = commonPrefix(candidates);
  if (prefix.length > word.length) return replaceWith(prefix);
  if (!listing) return { kind: 'bell' };
  const shown = candidates.map((candidate) => {
    const slash = candidate.replace(/\/$/, '').lastIndexOf('/');
    const text = slash >= 0 ? candidate.slice(slash + 1) : candidate;
    return candidate.endsWith('/') ? { text, cls: 'dir' as const } : { text };
  });
  return { kind: 'list', lines: columns(shown, ctx.cols), value: input, cursor };
}
