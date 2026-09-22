/**
 * Tokenizer — linux/02 `LNX-SH-01`. Whitespace-separated words built from parts that remember how they were quoted
 * (single quotes are literal; double quotes allow `$VAR` and `\"` `\\` `\$`; a backslash escapes one character), `#`
 * comments at a word start, and the operators `|` `&&` `||` `;` `>` `>>` `<`. Every token keeps its source span (for
 * completion and error carets). Total: never throws; an unterminated quote is a result, not an exception.
 */

export type Quote = 'none' | 'single' | 'double' | 'escaped';

export interface Part {
  readonly text: string;
  readonly quote: Quote;
}

export type Op = '|' | '&&' | '||' | ';' | '>' | '>>' | '<';

export type Token =
  | { readonly type: 'word'; readonly parts: readonly Part[]; readonly start: number; readonly end: number }
  | { readonly type: 'op'; readonly op: Op; readonly start: number; readonly end: number };

export type WordToken = Extract<Token, { type: 'word' }>;

export type TokenizeError =
  | { readonly kind: 'unterminated'; readonly quote: '"' | "'"; readonly at: number }
  | { readonly kind: 'unexpected'; readonly token: string; readonly at: number };

export interface TokenizeResult {
  readonly tokens: readonly Token[];
  readonly error: TokenizeError | null;
  /** The quote left open at the end of the input (completion continues inside it). */
  readonly open: '"' | "'" | null;
}

const SPACE = /[ \t\r\n\f\v]/;
const DOUBLE_ESCAPES = new Set(['"', '\\', '$', '`']);

/** The plain text of a word (quote removal only — no expansion). */
export const wordText = (word: WordToken): string => word.parts.map((part) => part.text).join('');

export function tokenize(input: string): TokenizeResult {
  const tokens: Token[] = [];
  let parts: Part[] = [];
  let wordStart = -1;
  let buffer = '';
  let bufferQuote: Quote = 'none';
  let error: TokenizeError | null = null;
  let open: '"' | "'" | null = null;

  const flushPart = () => {
    if (buffer) parts.push({ text: buffer, quote: bufferQuote });
    buffer = '';
  };
  const startWord = (at: number) => {
    if (wordStart < 0) wordStart = at;
  };
  const endWord = (at: number) => {
    flushPart();
    if (wordStart >= 0) tokens.push({ type: 'word', parts, start: wordStart, end: at });
    parts = [];
    wordStart = -1;
  };
  const append = (text: string, quote: Quote) => {
    if (quote !== bufferQuote) flushPart();
    bufferQuote = quote;
    buffer += text;
  };

  let i = 0;
  while (i < input.length) {
    const c = input[i]!;
    if (SPACE.test(c)) {
      endWord(i);
      i++;
      continue;
    }
    if (c === '#' && wordStart < 0) break; // comment to end of line
    if (c === '\\') {
      startWord(i);
      const next = input[i + 1];
      if (next === undefined) append('\\', 'none');
      else append(next, 'escaped');
      i += next === undefined ? 1 : 2;
      continue;
    }
    if (c === "'") {
      startWord(i);
      const close = input.indexOf("'", i + 1);
      if (close < 0) {
        append(input.slice(i + 1), 'single');
        error ??= { kind: 'unterminated', quote: "'", at: i };
        open = "'";
        i = input.length;
        break;
      }
      // An empty '' still makes the word exist.
      flushPart();
      parts.push({ text: input.slice(i + 1, close), quote: 'single' });
      i = close + 1;
      continue;
    }
    if (c === '"') {
      startWord(i);
      flushPart();
      let text = '';
      let j = i + 1;
      let closed = false;
      while (j < input.length) {
        const d = input[j]!;
        if (d === '\\' && j + 1 < input.length && DOUBLE_ESCAPES.has(input[j + 1]!)) {
          // Keep `\$` distinguishable from `$` for expansion: an escaped dollar is stored as a literal part.
          if (input[j + 1] === '$') {
            if (text) parts.push({ text, quote: 'double' });
            parts.push({ text: '$', quote: 'escaped' });
            text = '';
          } else text += input[j + 1];
          j += 2;
          continue;
        }
        if (d === '"') {
          closed = true;
          break;
        }
        text += d;
        j++;
      }
      parts.push({ text, quote: 'double' });
      if (!closed) {
        error ??= { kind: 'unterminated', quote: '"', at: i };
        open = '"';
        i = input.length;
        break;
      }
      i = j + 1;
      continue;
    }
    const two = input.slice(i, i + 2);
    const op: Op | null =
      two === '&&' || two === '||' || two === '>>'
        ? (two as Op)
        : c === '|' || c === ';' || c === '>' || c === '<'
          ? (c as Op)
          : null;
    if (op) {
      endWord(i);
      tokens.push({ type: 'op', op, start: i, end: i + op.length });
      i += op.length;
      continue;
    }
    if (c === '&' || c === '(' || c === ')') {
      endWord(i);
      error ??= { kind: 'unexpected', token: c, at: i };
      i++;
      continue;
    }
    startWord(i);
    append(c, 'none');
    i++;
  }
  endWord(Math.min(i, input.length));
  return { tokens, error, open };
}
