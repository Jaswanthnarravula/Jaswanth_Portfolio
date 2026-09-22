/**
 * Expansion — linux/02 `LNX-SH-02`, in bash's order: tilde (`~`, `~/x`) → variables (`$HOME`, `${VAR}`, `$?`; unknown →
 * empty) → globs (`*`, `?`, `[a-z]` against the VFS; no match stays literal, like bash) → quote removal. Quoted text is
 * never globbed; single-quoted text is never expanded at all.
 */
import type { Part, WordToken } from './tokenizer';
import type { Vfs, VfsPath } from './types';
import { isPrivate } from './vfs';

export interface ExpandEnv {
  readonly vars: Readonly<Record<string, string>>;
  readonly lastExit: number;
  readonly vfs: Vfs;
  readonly cwd: VfsPath;
  readonly home: string;
}

/** One expanded character: `glob` marks an unquoted `*`, `?` or `[` that may match filenames. */
interface GlobChar {
  readonly c: string;
  readonly glob: boolean;
}

const NAME = /^[A-Za-z_][A-Za-z0-9_]*/;

function substitute(text: string, env: ExpandEnv, out: GlobChar[], globbable: boolean): void {
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '$') {
      const rest = text.slice(i + 1);
      let name: string | null = null;
      let length = 0;
      if (rest.startsWith('?')) {
        name = '?';
        length = 1;
      } else if (rest.startsWith('{')) {
        const close = rest.indexOf('}');
        if (close > 1) {
          name = rest.slice(1, close);
          length = close + 1;
        }
      } else {
        const match = NAME.exec(rest);
        if (match) {
          name = match[0];
          length = match[0].length;
        }
      }
      if (name !== null) {
        const value = name === '?' ? String(env.lastExit) : (env.vars[name] ?? '');
        for (const v of value) out.push({ c: v, glob: false });
        i += length;
        continue;
      }
    }
    out.push({ c, glob: globbable && (c === '*' || c === '?' || c === '[') });
  }
}

function charsOf(parts: readonly Part[], env: ExpandEnv): GlobChar[] {
  const out: GlobChar[] = [];
  parts.forEach((part, index) => {
    let text = part.text;
    if (index === 0 && part.quote === 'none' && (text === '~' || text.startsWith('~/'))) {
      for (const c of env.home) out.push({ c, glob: false });
      text = text.slice(1);
    }
    if (part.quote === 'none') substitute(text, env, out, true);
    else if (part.quote === 'double') substitute(text, env, out, false);
    else for (const c of text) out.push({ c, glob: false });
  });
  return out;
}

/** One path segment of a glob → RegExp (anchored). */
function segmentRegex(chars: readonly GlobChar[]): RegExp {
  let source = '';
  for (let i = 0; i < chars.length; i++) {
    const { c, glob } = chars[i]!;
    if (glob && c === '*') source += '.*';
    else if (glob && c === '?') source += '.';
    else if (glob && c === '[') {
      let j = i + 1;
      let body = '';
      if (chars[j]?.c === '!' || chars[j]?.c === '^') {
        body = '^';
        j++;
      }
      const start = j;
      while (j < chars.length && (chars[j]!.c !== ']' || j === start)) {
        const d = chars[j]!.c;
        body += d === '\\' || d === '^' ? `\\${d}` : d;
        j++;
      }
      if (j >= chars.length) source += '\\[';
      else {
        source += `[${body}]`;
        i = j;
      }
    } else source += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`, 'u');
}

function glob(chars: readonly GlobChar[], env: ExpandEnv): string[] {
  const text = chars.map((ch) => ch.c).join('');
  const absolute = text.startsWith('/');
  const segments: GlobChar[][] = [[]];
  for (const ch of chars) {
    if (ch.c === '/' && !ch.glob) segments.push([]);
    else segments[segments.length - 1]!.push(ch);
  }
  // Leading `/` produces an empty first segment; trailing `/` an empty last one.
  const parts = segments.filter((segment, index) => segment.length > 0 || index === segments.length - 1);
  const trailingSlash = parts.length > 0 && parts[parts.length - 1]!.length === 0;
  const walk = trailingSlash ? parts.slice(0, -1) : parts;

  let frontier: { path: VfsPath; shown: string }[] = [{ path: absolute ? [] : env.cwd, shown: absolute ? '/' : '' }];
  for (const segment of walk) {
    const literal = segment.map((ch) => ch.c).join('');
    const active = segment.some((ch) => ch.glob);
    const next: { path: VfsPath; shown: string }[] = [];
    for (const { path, shown } of frontier) {
      const node = env.vfs.at(path);
      if (!node || node.kind !== 'dir' || isPrivate(node)) continue;
      const join = (name: string) =>
        shown === '' ? name : shown.endsWith('/') ? `${shown}${name}` : `${shown}/${name}`;
      if (!active) {
        if (literal === '.' || literal === '..') {
          const target = literal === '..' ? path.slice(0, -1) : path;
          next.push({ path: target, shown: join(literal) });
          continue;
        }
        if (node.children.some((child) => child.name === literal))
          next.push({ path: [...path, literal], shown: join(literal) });
        continue;
      }
      const pattern = segmentRegex(segment);
      const dotOk = literal.startsWith('.');
      for (const child of node.children) {
        if (child.name.startsWith('.') && !dotOk) continue;
        if (pattern.test(child.name)) next.push({ path: [...path, child.name], shown: join(child.name) });
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  const matches = frontier
    .filter(({ path }) => !trailingSlash || env.vfs.at(path)?.kind === 'dir')
    .map(({ shown }) => (trailingSlash ? `${shown}/` : shown));
  return matches.sort();
}

/** Expand one word to zero or more arguments. */
export function expandWord(word: WordToken, env: ExpandEnv): string[] {
  const chars = charsOf(word.parts, env);
  const text = chars.map((ch) => ch.c).join('');
  if (!chars.some((ch) => ch.glob)) return [text];
  const matches = glob(chars, env);
  return matches.length ? matches : [text];
}

export const expandWords = (words: readonly WordToken[], env: ExpandEnv): string[] =>
  words.flatMap((word) => expandWord(word, env));
