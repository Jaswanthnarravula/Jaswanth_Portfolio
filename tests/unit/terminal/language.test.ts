/**
 * The shell language — plans/linux/02-shell-engine.md: LNX-SH-01 (tokenizer) · LNX-SH-02 (expansion) ·
 * LNX-SH-03 (parser, read-only redirects, aliases) · LNX-SH-04 (pure execution, pipes, exit codes, effects).
 */
import { describe, expect, it } from 'vitest';
import { expandWord, type ExpandEnv } from '@/lib/terminal/expand';
import { expandHistory } from '@/lib/terminal/history';
import { parse } from '@/lib/terminal/parser';
import { tokenize, wordText, type WordToken } from '@/lib/terminal/tokenizer';
import { HOME } from '@/lib/terminal/vfs';
import { out, sh, texts, vfs } from './helpers';

const words = (input: string) =>
  tokenize(input).tokens.map((token) => (token.type === 'word' ? wordText(token) : `<${token.op}>`));

describe('LNX-SH-01 tokenizer: quotes, escapes, comments, operators, spans', () => {
  it('splits words and operators', () => {
    expect(words('ls -la  projects|head -2&&echo ok;pwd')).toEqual([
      'ls',
      '-la',
      'projects',
      '<|>',
      'head',
      '-2',
      '<&&>',
      'echo',
      'ok',
      '<;>',
      'pwd',
    ]);
    expect(words('a || b > x >> y < z')).toEqual(['a', '<||>', 'b', '<>>', 'x', '<>>>', 'y', '<<>', 'z']);
  });

  it('single quotes are literal; double quotes keep $ for expansion; backslash escapes one character', () => {
    const [single] = tokenize(`'$HOME and "x"'`).tokens as WordToken[];
    expect(single!.parts).toEqual([{ text: '$HOME and "x"', quote: 'single' }]);
    const [double] = tokenize(`"a \\"b\\" \\\\ c"`).tokens as WordToken[];
    expect(wordText(double!)).toBe('a "b" \\ c');
    expect(words('a\\ b c')).toEqual(['a b', 'c']);
    expect(words(`one"two"'three'`)).toEqual(['onetwothree']);
    expect(words(`""`)).toEqual(['']);
  });

  it('# starts a comment only at a word start', () => {
    expect(words('echo a # b c')).toEqual(['echo', 'a']);
    expect(words('echo a#b')).toEqual(['echo', 'a#b']);
    expect(words('# only a comment')).toEqual([]);
  });

  it('keeps source spans for completion and carets', () => {
    const tokens = tokenize('cat  "a b" |x').tokens;
    expect(tokens.map((token) => [token.start, token.end])).toEqual([
      [0, 3],
      [5, 10],
      [11, 12],
      [12, 13],
    ]);
  });

  it('an unterminated quote is an error result (never an exception), and says which quote is open', () => {
    expect(tokenize('echo "abc').error).toEqual({ kind: 'unterminated', quote: '"', at: 5 });
    expect(tokenize("echo 'abc").open).toBe("'");
    expect(tokenize('echo a & b').error).toEqual({ kind: 'unexpected', token: '&', at: 7 });
    expect(out('echo "abc')).toEqual([`bash: unexpected EOF while looking for matching '"'`]);
    expect(sh('echo "abc').exitCode).toBe(2);
  });
});

describe('LNX-SH-02 expansion: tilde, variables, $?, globs, history expansion', () => {
  const env: ExpandEnv = {
    vars: { HOME: '/home/jaswanth', USER: 'jaswanth', PWD: '/home/jaswanth' },
    lastExit: 3,
    vfs,
    cwd: HOME,
    home: '/home/jaswanth',
  };
  const expand = (input: string) => expandWord(tokenize(input).tokens[0] as WordToken, env);

  it.each([
    ['~', ['/home/jaswanth']],
    ['~/projects', ['/home/jaswanth/projects']],
    ['"~"', ['~']],
    ['$USER', ['jaswanth']],
    ['${USER}!', ['jaswanth!']],
    ['"$USER home"', ['jaswanth home']],
    ["'$USER'", ['$USER']],
    ['\\$USER', ['$USER']],
    ['$NOPE', ['']],
    ['$?', ['3']],
    ['*.txt', ['about.txt', 'contact.txt', 'skills.txt']],
    ['projects/*.md', ['projects/README.md', 'projects/portfolio-os.md', 'projects/rocket.md']],
    ['?bout.txt', ['about.txt']],
    ['[a-c]*.txt', ['about.txt', 'contact.txt']],
    ['*.nothing', ['*.nothing']],
    ['"*.txt"', ['*.txt']],
    ['/usr/bin/w*', ['/usr/bin/wc', '/usr/bin/which', '/usr/bin/whoami']],
    ['.*', ['.bashrc', '.plan', '.ssh']],
    ['*/', ['education/', 'experience/', 'projects/']],
  ] as const)('%s → %j', (input, expected) => {
    expect(expand(input)).toEqual(expected);
  });

  it('never globs inside a private directory', () => {
    expect(expand('.ssh/*')).toEqual(['.ssh/*']);
  });

  it('history expansion: !!, !n, !-n, !prefix — echoed, never inside single quotes', () => {
    const history = ['ls', 'cd projects', 'cat about.txt'];
    expect(expandHistory('!!', history)).toEqual({ ok: true, line: 'cat about.txt', changed: true });
    expect(expandHistory('!2', history)).toEqual({ ok: true, line: 'cd projects', changed: true });
    expect(expandHistory('!-3', history)).toEqual({ ok: true, line: 'ls', changed: true });
    expect(expandHistory('!cd && ls', history)).toEqual({ ok: true, line: 'cd projects && ls', changed: true });
    expect(expandHistory("echo '!!'", history)).toEqual({ ok: true, line: "echo '!!'", changed: false });
    expect(expandHistory('echo hi!', history)).toEqual({ ok: true, line: 'echo hi!', changed: false });
    expect(expandHistory('echo \\!!', history)).toEqual({ ok: true, line: 'echo \\!!', changed: false });
    expect(expandHistory('!nope', history)).toEqual({ ok: false, spec: '!nope' });
    const run = sh(['echo one', '!!']);
    expect(run.echo).toBe('echo one');
    expect(texts(run.lines)).toEqual(['one']);
    expect(out(['!zzz'])).toEqual(['bash: !zzz: event not found']);
  });
});

describe('LNX-SH-03 parser: lists, pipelines, redirects (read-only FS), aliases', () => {
  const shape = (input: string, aliases = new Map<string, string>()) => {
    const result = parse(tokenize(input).tokens, aliases);
    if (!result.ok) return `error:${result.token}`;
    return result.list.map((item) => ({
      pipeline: item.pipeline.map((command) => ({
        words: command.words.map(wordText),
        redirects: command.redirects.map((redirect) => `${redirect.op}${wordText(redirect.target)}`),
      })),
      next: item.next,
    }));
  };

  it('AST fixtures', () => {
    expect(shape('ls | head -2 && echo ok; pwd')).toEqual([
      {
        pipeline: [
          { words: ['ls'], redirects: [] },
          { words: ['head', '-2'], redirects: [] },
        ],
        next: '&&',
      },
      { pipeline: [{ words: ['echo', 'ok'], redirects: [] }], next: ';' },
      { pipeline: [{ words: ['pwd'], redirects: [] }], next: null },
    ]);
    expect(shape('sort < skills.txt > out')).toEqual([
      { pipeline: [{ words: ['sort'], redirects: ['<skills.txt', '>out'] }], next: null },
    ]);
    expect(shape('ls;')).toEqual([{ pipeline: [{ words: ['ls'], redirects: [] }], next: null }]);
    expect(shape('')).toEqual([]);
  });

  it.each([
    ['| ls', '|'],
    ['ls |', 'newline'],
    ['ls | | wc', '|'],
    ['ls &&', 'newline'],
    ['&& ls', '&&'],
    ['ls ;; ls', ';'],
    ['echo >', 'newline'],
    ['echo > | x', '|'],
  ])('syntax error in %j names %j', (input, token) => {
    expect(shape(input)).toBe(`error:${token}`);
  });

  it('prints the exact syntax error, exit 2', () => {
    const run = sh('ls | | wc');
    expect(texts(run.lines)).toEqual([`bash: syntax error near unexpected token '|'`]);
    expect(run.exitCode).toBe(2);
  });

  it("'>' and '>>' yield Read-only file system; '<' reads a VFS file", () => {
    expect(out('echo hi > x')).toEqual(['bash: x: Read-only file system']);
    expect(sh('echo hi >> ~/about.txt').exitCode).toBe(1);
    expect(out('wc -l < projects/README.md')).toEqual(['4']);
    expect(out('cat < nope')).toEqual(['bash: nope: No such file or directory']);
  });

  it('aliases expand on the first word only, recursion-safely', () => {
    const aliases = new Map([
      ['ll', 'ls -l'],
      ['a', 'b'],
      ['b', 'a x'],
    ]);
    expect(shape('ll projects', aliases)).toEqual([
      { pipeline: [{ words: ['ls', '-l', 'projects'], redirects: [] }], next: null },
    ]);
    expect(shape('echo ll', aliases)).toEqual([{ pipeline: [{ words: ['echo', 'll'], redirects: [] }], next: null }]);
    expect(shape('a', aliases)).toEqual([{ pipeline: [{ words: ['a', 'x'], redirects: [] }], next: null }]);
    expect(shape("'ll'", aliases)).toEqual([{ pipeline: [{ words: ['ll'], redirects: [] }], next: null }]);
  });
});

describe('LNX-SH-04 pure execution: pipes, exit codes, returned effects', () => {
  it("'ls | head -2 && echo ok' → lines + exit 0", () => {
    const run = sh('ls | head -2 && echo ok');
    expect(texts(run.lines)).toEqual(['README.md', 'about.txt', 'ok']);
    expect(run.exitCode).toBe(0);
  });

  it('&& / || / ; follow exit codes; $? is the last exit code', () => {
    expect(out('false_cmd || echo fallback')).toEqual([
      'bash: false_cmd: command not found',
      "Try 'help'.",
      'fallback',
    ]);
    expect(out('cat nope && echo never; echo $?')).toEqual(['cat: nope: No such file or directory', '1']);
    expect(out(['cd nope', 'echo $?'])).toEqual(['1']);
    expect(sh('grep zzz about.txt').exitCode).toBe(1);
  });

  it('effects are returned, never performed: cd moves only the returned state', () => {
    const run = sh('cd projects && pwd');
    expect(texts(run.lines)).toEqual(['/home/jaswanth/projects']);
    expect(run.effects).toEqual([{ k: 'cd', to: ['home', 'jaswanth', 'projects'] }]);
    expect(run.state.cwd).toEqual(['home', 'jaswanth', 'projects']);
    expect(run.state.oldpwd).toEqual(HOME);
    // A cd that ends where it started reports no cd effect.
    expect(sh('cd projects && cd ..').effects).toEqual([]);
    // cd inside a pipeline runs in a subshell.
    expect(sh('cd projects | cat').state.cwd).toEqual(HOME);
  });

  it('stderr lines skip the pipe; stdout feeds the next stdin', () => {
    expect(out('cat nope about.txt | head -1')).toEqual(['cat: nope: No such file or directory', 'Ada Example']);
  });

  it('clear drops earlier output; exit stops the list', () => {
    const cleared = sh('echo a; clear; echo b');
    expect(texts(cleared.lines)).toEqual(['b']);
    expect(cleared.effects).toEqual([{ k: 'clear' }]);
    const exited = sh('echo a; exit; echo b');
    expect(texts(exited.lines)).toEqual(['a']);
    expect(exited.effects).toEqual([{ k: 'exit' }]);
  });

  it('an empty or blank line is a no-op and is not recorded', () => {
    const run = sh(['ls', '   ']);
    expect(run.lines).toEqual([]);
    expect(run.state.history).toEqual(['ls']);
  });
});
