/**
 * MAC-CODE-03 / WIN-CODE-02 (shared) — the editor's tiny tokenizers (plans/macos/apps/vscode.md "Syntax highlighting":
 * JSON, a TypeScript subset, Markdown, log, dotenv; no Monaco, no Shiki). Fixtures per language, plus the invariant the
 * editor relies on: a line's tokens concatenate back to exactly that line, for every generated workspace file.
 */
import { describe, expect, it } from 'vitest';
import { inlineMarkdown, tokenize, type TokenLine } from '@/components/content/syntax';
import { buildWorkspace } from '@/components/content/workspace';
import { fixturePortfolio as p } from '../../fixtures/portfolio';

/** `[kind, text]` pairs without the whitespace-only plain tokens (they carry no colour). */
const pairs = (line: TokenLine | undefined) =>
  (line ?? []).filter((token) => token.kind !== 'plain' || token.text.trim()).map((token) => [token.kind, token.text]);

describe('MAC-CODE-03 tokenizer fixtures', () => {
  it('JSON: keys vs strings, numbers, constants, punctuation', () => {
    const [line] = tokenize('json', '  "name": "Go", "years": 6, "rated": true, "gap": null');
    expect(pairs(line)).toEqual([
      ['key', '"name"'],
      ['punct', ':'],
      ['string', '"Go"'],
      ['punct', ','],
      ['key', '"years"'],
      ['punct', ':'],
      ['number', '6'],
      ['punct', ','],
      ['key', '"rated"'],
      ['punct', ':'],
      ['constant', 'true'],
      ['punct', ','],
      ['key', '"gap"'],
      ['punct', ':'],
      ['constant', 'null'],
    ]);
    expect(pairs(tokenize('json', '"a\\"b"')[0])).toEqual([['string', '"a\\"b"']]);
  });

  it('TypeScript: keywords, identifiers, types, strings, comments — block comments span lines', () => {
    const lines = tokenize(
      'typescript',
      [
        '// generated',
        "export const stack = ['Go', 'C++'] as const;",
        '/** Languages',
        '  still a comment */ export type Skill = string;',
      ].join('\n'),
    );
    expect(pairs(lines[0])).toEqual([['comment', '// generated']]);
    expect(pairs(lines[1])).toEqual([
      ['keyword', 'export'],
      ['keyword', 'const'],
      ['variable', 'stack'],
      ['punct', '='],
      ['punct', '['],
      ['string', "'Go'"],
      ['punct', ','],
      ['string', "'C++'"],
      ['punct', ']'],
      ['keyword', 'as'],
      ['keyword', 'const'],
      ['punct', ';'],
    ]);
    expect(pairs(lines[2])).toEqual([['comment', '/** Languages']]);
    expect(pairs(lines[3])).toEqual([
      ['comment', '  still a comment */'],
      ['keyword', 'export'],
      ['keyword', 'type'],
      ['type', 'Skill'],
      ['punct', '='],
      ['variable', 'string'],
      ['punct', ';'],
    ]);
    expect(pairs(tokenize('typescript', "const url = 'http://x/*y*/';")[0])).toContainEqual([
      'string',
      "'http://x/*y*/'",
    ]);
  });

  it('Markdown: headings, quotes, bullets, strong, emphasis, code, links, fenced blocks', () => {
    const lines = tokenize(
      'markdown',
      [
        '# Ada Example',
        '> Engineer of examples',
        '- [Portfolio OS](projects/portfolio-os.md) — **fast** and `typed`, _really_',
        '```',
        '# not a heading',
        '```',
        '12. numbered',
      ].join('\n'),
    );
    expect(pairs(lines[0])).toEqual([['heading', '# Ada Example']]);
    expect(pairs(lines[1])).toEqual([['quote', '> Engineer of examples']]);
    expect(pairs(lines[2])).toEqual([
      ['bullet', '-'],
      ['link', '[Portfolio OS](projects/portfolio-os.md)'],
      ['plain', ' — '],
      ['strong', '**fast**'],
      ['plain', ' and '],
      ['code', '`typed`'],
      ['plain', ', '],
      ['emphasis', '_really_'],
    ]);
    expect(pairs(lines[4])).toEqual([['code', '# not a heading']]);
    expect(pairs(lines[6])).toEqual([
      ['bullet', '12.'],
      ['plain', ' numbered'],
    ]);
    expect(pairs(inlineMarkdown('see **this**'))).toEqual([
      ['plain', 'see '],
      ['strong', '**this**'],
    ]);
  });

  it('log: date stamp, level, [slug] tag, numbers', () => {
    const [first, second, third] = tokenize(
      'log',
      [
        '2022-01 START [acme] Engineer @ Acme',
        'present RUN   [acme] ongoing',
        '------- SHIP  [ibm] 10+ APIs, 30% faster',
      ].join('\n'),
    );
    expect(pairs(first)).toEqual([
      ['date', '2022-01'],
      ['level', 'START'],
      ['type', '[acme]'],
      ['plain', ' Engineer @ Acme'],
    ]);
    expect(pairs(second).slice(0, 3)).toEqual([
      ['date', 'present'],
      ['level', 'RUN'],
      ['type', '[acme]'],
    ]);
    expect(pairs(third)).toContainEqual(['date', '-------']);
    expect(pairs(third)).toContainEqual(['number', '30%']);
  });

  it('dotenv: comments, keys, values (quoted or bare), trailing comments', () => {
    const lines = tokenize(
      'dotenv',
      ['# Contact', 'CONTACT_EMAIL=ada@example.com', 'OPEN_TO="Open to tests" # note', 'not a pair'].join('\n'),
    );
    expect(pairs(lines[0])).toEqual([['comment', '# Contact']]);
    expect(pairs(lines[1])).toEqual([
      ['key', 'CONTACT_EMAIL'],
      ['punct', '='],
      ['string', 'ada@example.com'],
    ]);
    expect(pairs(lines[2])).toEqual([
      ['key', 'OPEN_TO'],
      ['punct', '='],
      ['string', '"Open to tests"'],
      ['comment', ' # note'],
    ]);
    expect(pairs(lines[3])).toEqual([['plain', 'not a pair']]);
  });

  it('every generated file: one token line per text line, and the tokens rebuild each line exactly', () => {
    const files = buildWorkspace({
      person: p.person,
      skills: p.skills,
      experience: p.experience,
      projects: p.projects,
      contact: p.contact,
    });
    for (const file of files) {
      const lines = file.text.split('\n');
      const tokens = tokenize(file.language, file.text);
      expect(tokens).toHaveLength(lines.length);
      tokens.forEach((line, index) => expect(line.map((token) => token.text).join('')).toBe(lines[index]));
    }
  });
});
