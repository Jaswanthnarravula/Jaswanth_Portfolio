/**
 * Tiny syntax tokenizers — plans/macos/apps/vscode.md `MAC-CODE-03` (shared by `WIN-CODE-02`): one sticky-regex scanner
 * per file type of the generated workspace (JSON, a TypeScript subset, Markdown, log, dotenv). No Monaco, no Shiki, no
 * dependency — the editor chunk stays inside its 15 KB budget (shared/10). Pure and hook-free; the editor maps each
 * `kind` to its Dark Modern / Light Modern colour.
 */

export type SyntaxLanguage = 'markdown' | 'json' | 'typescript' | 'log' | 'dotenv';

export type TokenKind =
  | 'plain'
  | 'key'
  | 'string'
  | 'number'
  | 'keyword'
  | 'constant'
  | 'variable'
  | 'type'
  | 'comment'
  | 'punct'
  | 'heading'
  | 'quote'
  | 'bullet'
  | 'strong'
  | 'emphasis'
  | 'code'
  | 'link'
  | 'date'
  | 'level';

export interface Token {
  readonly text: string;
  readonly kind: TokenKind;
}

export type TokenLine = readonly Token[];

type Rule = readonly [pattern: RegExp, kind: TokenKind];

/** One token at `at` by the first matching rule (an unmatched character is plain); returns the next position. */
function step(line: string, rules: readonly Rule[], at: number, out: Token[]): number {
  for (const [pattern, kind] of rules) {
    pattern.lastIndex = at;
    const hit = pattern.exec(line);
    if (hit && hit[0].length > 0) {
      push(out, hit[0], kind);
      return at + hit[0].length;
    }
  }
  push(out, line[at]!, 'plain');
  return at + 1;
}

/** Scan `line` from `from` to its end. Adjacent tokens of one kind merge. */
function scan(line: string, rules: readonly Rule[], from = 0, out: Token[] = []): Token[] {
  let at = from;
  while (at < line.length) at = step(line, rules, at, out);
  return out;
}

function push(out: Token[], text: string, kind: TokenKind) {
  const last = out[out.length - 1];
  if (last && last.kind === kind) out[out.length - 1] = { text: last.text + text, kind };
  else out.push({ text, kind });
}

const SPACE: Rule = [/\s+/y, 'plain'];

const JSON_RULES: readonly Rule[] = [
  SPACE,
  [/"(?:[^"\\]|\\.)*"(?=\s*:)/y, 'key'],
  [/"(?:[^"\\]|\\.)*"?/y, 'string'],
  [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y, 'number'],
  [/\b(?:true|false|null)\b/y, 'constant'],
  [/[{}[\],:]/y, 'punct'],
];

const TS_KEYWORDS =
  'export|import|from|const|let|var|type|interface|as|satisfies|readonly|typeof|keyof|function|return|default|extends|in|of|new|enum|declare';

const TS_RULES: readonly Rule[] = [
  SPACE,
  [/\/\/.*/y, 'comment'],
  [/'(?:[^'\\]|\\.)*'?/y, 'string'],
  [/"(?:[^"\\]|\\.)*"?/y, 'string'],
  [/`(?:[^`\\]|\\.)*`?/y, 'string'],
  [/\d[\d_]*(?:\.\d+)?/y, 'number'],
  [new RegExp(`\\b(?:${TS_KEYWORDS})\\b`, 'y'), 'keyword'],
  [/\b(?:true|false|null|undefined)\b/y, 'constant'],
  [/[A-Z][\w$]*/y, 'type'],
  [/[a-z_$][\w$]*/y, 'variable'],
  [/[{}()[\];,.:=<>|&?!+\-*/%]/y, 'punct'],
];

const MD_INLINE: readonly Rule[] = [
  [/\*\*[^*]+\*\*/y, 'strong'],
  [/_[^_\s][^_]*_/y, 'emphasis'],
  [/`[^`]+`/y, 'code'],
  [/\[[^\]]*\]\([^)\s]*\)/y, 'link'],
  [/[^*_`[]+/y, 'plain'],
];

const LOG_RULES: readonly Rule[] = [
  SPACE,
  [/\b(?:START|INFO|SHIP|STACK|RUN|END|WARN|ERROR|DEBUG)\b/y, 'level'],
  [/\[[^\]\s]*\]/y, 'type'],
  [/"[^"]*"?/y, 'string'],
  [/[A-Za-z_][\w.\-/+#]*/y, 'plain'],
  [/\d+(?:[.,]\d+)*%?/y, 'number'],
];

const LOG_STAMP = /^(?:\d{4}(?:-\d{2})?|present|-+)(?=\s|$)/;

/** A block comment may span lines: the state carries from one line to the next. */
function typescript(lines: readonly string[]): TokenLine[] {
  let inComment = false;
  return lines.map((line) => {
    const out: Token[] = [];
    let at = 0;
    while (at < line.length) {
      if (inComment || line.startsWith('/*', at)) {
        const end = line.indexOf('*/', inComment ? at : at + 2);
        const stop = end < 0 ? line.length : end + 2;
        push(out, line.slice(at, stop), 'comment');
        inComment = end < 0;
        at = stop;
      } else at = step(line, TS_RULES, at, out);
    }
    return out;
  });
}

function markdown(lines: readonly string[]): TokenLine[] {
  let fenced = false;
  return lines.map((line) => {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      return [{ text: line, kind: 'code' }];
    }
    if (fenced) return line ? [{ text: line, kind: 'code' }] : [];
    if (/^#{1,6}\s/.test(line)) return [{ text: line, kind: 'heading' }];
    if (/^>/.test(line)) return [{ text: line, kind: 'quote' }];
    const bullet = /^(\s*)([-*+]|\d+\.)(\s+)/.exec(line);
    const out: Token[] = [];
    let at = 0;
    if (bullet) {
      if (bullet[1]) push(out, bullet[1], 'plain');
      push(out, bullet[2]!, 'bullet');
      push(out, bullet[3]!, 'plain');
      at = bullet[0].length;
    }
    return scan(line, MD_INLINE, at, out);
  });
}

function log(lines: readonly string[]): TokenLine[] {
  return lines.map((line) => {
    const stamp = LOG_STAMP.exec(line);
    const out: Token[] = stamp ? [{ text: stamp[0], kind: 'date' }] : [];
    return scan(line, LOG_RULES, stamp ? stamp[0].length : 0, out);
  });
}

function dotenv(lines: readonly string[]): TokenLine[] {
  return lines.map((line) => {
    if (/^\s*#/.test(line)) return [{ text: line, kind: 'comment' }];
    const pair = /^(\s*)([A-Za-z_][\w.]*)(\s*=\s*)(.*)$/.exec(line);
    if (!pair) return line ? [{ text: line, kind: 'plain' }] : [];
    const out: Token[] = [];
    if (pair[1]) push(out, pair[1], 'plain');
    push(out, pair[2]!, 'key');
    push(out, pair[3]!, 'punct');
    const value = pair[4]!;
    const quoted = /^(["'])(?:\\.|(?!\1).)*\1?/.exec(value);
    const end = quoted ? quoted[0].length : value.search(/\s+#|$/);
    if (end > 0) push(out, value.slice(0, end), 'string');
    const rest = value.slice(end);
    if (rest) push(out, rest, /^\s*#/.test(rest) ? 'comment' : 'plain');
    return out;
  });
}

const TOKENIZERS: Readonly<Record<SyntaxLanguage, (lines: readonly string[]) => TokenLine[]>> = {
  json: (lines) => lines.map((line) => scan(line, JSON_RULES)),
  typescript,
  markdown,
  log,
  dotenv,
};

/** One token list per line of `text` (split on `\n`); the concatenated token texts of a line equal the line. */
export function tokenize(language: SyntaxLanguage, text: string): readonly TokenLine[] {
  return TOKENIZERS[language](text.split('\n'));
}

/** Markdown inline tokens of one fragment (the editor's preview renders them as strong / em / code / links). */
export const inlineMarkdown = (text: string): TokenLine => scan(text, MD_INLINE);
