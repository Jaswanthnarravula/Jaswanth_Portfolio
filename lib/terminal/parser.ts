/**
 * Parser — linux/02 `LNX-SH-03`.
 *   list     := pipeline (('&&' | '||' | ';') pipeline)* [';']
 *   pipeline := command ('|' command)*
 *   command  := WORD (WORD)* (redirect)*     redirect := ('>' | '>>' | '<') WORD
 * Aliases (loaded from `~/.bashrc`) expand on a command's first word, recursion-safely (an alias never re-expands
 * itself). A syntax error names the unexpected token (`'newline'` at the end), as bash does.
 */
import { tokenize, type Op, type Token, type WordToken } from './tokenizer';

export interface Redirect {
  readonly op: '>' | '>>' | '<';
  readonly target: WordToken;
}

export interface SimpleCommand {
  readonly words: readonly WordToken[];
  readonly redirects: readonly Redirect[];
}

export type Pipeline = readonly SimpleCommand[];

export interface ListItem {
  readonly pipeline: Pipeline;
  /** How the *next* item is joined to this one (`null` for the last). */
  readonly next: '&&' | '||' | ';' | null;
}

export type ParseResult =
  { readonly ok: true; readonly list: readonly ListItem[] } | { readonly ok: false; readonly token: string };

const isWord = (token: Token | undefined): token is WordToken => token?.type === 'word';
const opOf = (token: Token | undefined): Op | null => (token?.type === 'op' ? token.op : null);

/** A word that is exactly one unquoted part (only those are alias candidates). */
const plainWord = (token: WordToken): string | null =>
  token.parts.length === 1 && token.parts[0]!.quote === 'none' ? token.parts[0]!.text : null;

export function parse(input: readonly Token[], aliases: ReadonlyMap<string, string> = new Map()): ParseResult {
  const tokens = [...input];
  const list: ListItem[] = [];
  let i = 0;

  const expandAliases = () => {
    const seen = new Set<string>();
    for (let guard = 0; guard < 32; guard++) {
      const token = tokens[i];
      if (!isWord(token)) return;
      const name = plainWord(token);
      if (name === null || seen.has(name)) return;
      const value = aliases.get(name);
      if (value === undefined) return;
      seen.add(name);
      const replacement = tokenize(value).tokens.map((t) => ({ ...t, start: token.start, end: token.end }));
      tokens.splice(i, 1, ...replacement);
    }
  };

  const command = (): SimpleCommand | { error: string } => {
    expandAliases();
    const words: WordToken[] = [];
    const redirects: Redirect[] = [];
    while (i < tokens.length) {
      const token = tokens[i]!;
      if (token.type === 'word') {
        words.push(token);
        i++;
        continue;
      }
      if (token.op === '>' || token.op === '>>' || token.op === '<') {
        const target = tokens[i + 1];
        if (!isWord(target)) return { error: target ? (target as Extract<Token, { type: 'op' }>).op : 'newline' };
        redirects.push({ op: token.op, target });
        i += 2;
        continue;
      }
      break;
    }
    if (words.length === 0 && redirects.length === 0) {
      const token = tokens[i];
      return { error: token ? (opOf(token) ?? 'newline') : 'newline' };
    }
    return { words, redirects };
  };

  if (tokens.length === 0) return { ok: true, list };
  while (i < tokens.length) {
    const pipeline: SimpleCommand[] = [];
    for (;;) {
      const parsed = command();
      if ('error' in parsed) return { ok: false, token: parsed.error };
      pipeline.push(parsed);
      if (opOf(tokens[i]) !== '|') break;
      i++;
      if (i >= tokens.length) return { ok: false, token: 'newline' };
    }
    const op = opOf(tokens[i]);
    if (op === null) {
      list.push({ pipeline, next: null });
      break;
    }
    if (op !== '&&' && op !== '||' && op !== ';') return { ok: false, token: op };
    i++;
    if (i >= tokens.length) {
      if (op === ';') {
        list.push({ pipeline, next: null });
        break;
      }
      return { ok: false, token: 'newline' };
    }
    list.push({ pipeline, next: op });
  }
  return { ok: true, list };
}
