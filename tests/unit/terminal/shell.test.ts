/**
 * Shell behaviour — plans/linux/02-shell-engine.md: LNX-SH-05 (exact error strings + suggestions) · LNX-SH-06
 * (history) · LNX-SH-07 (completion) · LNX-SH-08 (line editing) · LNX-SH-09 (flavor voices) · LNX-SH-10 (totality).
 */
import { describe, expect, it } from 'vitest';
import { complete } from '@/lib/terminal/completion';
import { aliasesFor, execute, initialShellState, OUTPUT_CAP } from '@/lib/terminal/engine';
import { VOICES } from '@/lib/terminal/flavor';
import { cursorAt, HISTORY_CAP, newer, older, record, reverseSearch } from '@/lib/terminal/history';
import { controlAction, editLine, INPUT_CAP, trimPaste } from '@/lib/terminal/line-editing';
import { parse } from '@/lib/terminal/parser';
import { tokenize } from '@/lib/terminal/tokenizer';
import { createVfs, HOME } from '@/lib/terminal/vfs';
import type { Flavor, VfsDir, VfsFile } from '@/lib/terminal/types';
import { config, data, out, sh, texts, vfs } from './helpers';

describe('LNX-SH-05 exact error strings + suggestions', () => {
  it.each([
    ['projcts', ['bash: projcts: command not found', "Did you mean 'projects'?"], 127],
    ['sl', ['bash: sl: command not found', "Did you mean 'ls'?"], 127],
    ['xyzzy', ['bash: xyzzy: command not found', "Try 'help'."], 127],
    ['cd nope', ['bash: cd: nope: No such file or directory'], 1],
    ['cd about.txt', ['bash: cd: about.txt: Not a directory'], 1],
    ['cd .ssh', ['bash: cd: .ssh: Permission denied'], 1],
    ['cat projects', ['cat: projects: Is a directory'], 1],
    ['cat x', ['cat: x: No such file or directory'], 1],
    ['ls x', ["ls: cannot access 'x': No such file or directory"], 2],
    ['./resume.pdf', ['bash: ./resume.pdf: Permission denied'], 126],
    ['./projects', ['bash: ./projects: Is a directory'], 126],
    ['./nope', ['bash: ./nope: No such file or directory'], 127],
    ['ls |', ["bash: syntax error near unexpected token 'newline'"], 2],
    ['| ls', ["bash: syntax error near unexpected token '|'"], 2],
    ['ls -z', ["ls: invalid option -- 'z'", "Try 'man ls' for more information."], 2],
    ['ls --nope', ["ls: unrecognized option '--nope'", "Try 'man ls' for more information."], 2],
    ['cd a b', ['bash: cd: too many arguments'], 1],
    ['cd -', ['bash: cd: OLDPWD not set'], 1],
  ] as const)('%s', (input, lines, code) => {
    const run = sh(input);
    expect(texts(run.lines)).toEqual(lines);
    expect(run.exitCode).toBe(code);
  });

  it('the suggestion is insertable (tapping it never runs it)', () => {
    expect(sh('projcts').lines[1]).toMatchObject({ insert: 'projects', cls: 'dim' });
  });

  it('a path to a program runs it', () => {
    expect(out('/usr/bin/pwd')).toEqual(['bash: /usr/bin/pwd: No such file or directory']); // pwd is a builtin
    expect(out('/usr/bin/whoami')[0]).toBe('jaswanth');
  });

  it('--help prints the synopsis (exit 0)', () => {
    const run = sh('grep --help');
    expect(texts(run.lines)[0]).toBe('Usage: grep [-i] [-n] [-r] [-v] [-c] <pattern> [path…]');
    expect(run.exitCode).toBe(0);
  });
});

describe('LNX-SH-06 history: draft preserved, Ctrl+R, history -c', () => {
  it('records with a cap of 200, collapses consecutive duplicates, skips leading-space lines', () => {
    let history: readonly string[] = [];
    for (const line of ['ls', 'ls', ' secret', 'pwd', '', 'ls']) history = record(history, line);
    expect(history).toEqual(['ls', 'pwd', 'ls']);
    for (let i = 0; i < 250; i++) history = record(history, `echo ${i}`);
    expect(history).toHaveLength(HISTORY_CAP);
    expect(history[HISTORY_CAP - 1]).toBe('echo 249');
  });

  it('↑/↓ browse and give the draft back', () => {
    let cursor = cursorAt(['ls', 'cd projects', 'cat about.txt']);
    let step = older(cursor, 'half-typed');
    expect(step.value).toBe('cat about.txt');
    step = older(step.cursor, step.value);
    expect(step.value).toBe('cd projects');
    step = newer(step.cursor, step.value);
    expect(step.value).toBe('cat about.txt');
    step = newer(step.cursor, step.value);
    expect(step.value).toBe('half-typed'); // the draft survives
    expect(newer(step.cursor, 'half-typed').value).toBe('half-typed');
    cursor = cursorAt([]);
    expect(older(cursor, 'x').value).toBe('x');
    const top = older(older(older(cursorAt(['a', 'b']), 'd').cursor, 'b').cursor, 'a');
    expect(top.value).toBe('a');
  });

  it('Ctrl+R finds the newest match, then older ones', () => {
    const entries = ['cat about.txt', 'ls', 'cat skills.txt'];
    expect(reverseSearch(entries, 'cat')).toEqual({ index: 2, match: 'cat skills.txt' });
    expect(reverseSearch(entries, 'cat', 2)).toEqual({ index: 0, match: 'cat about.txt' });
    expect(reverseSearch(entries, 'zzz')).toBeNull();
    expect(reverseSearch(entries, '')).toBeNull();
  });

  it('history lists numbered entries (including itself); history -c clears', () => {
    const listed = sh(['ls', 'pwd', 'history']);
    expect(texts(listed.lines)).toEqual(['    1  ls', '    2  pwd', '    3  history']);
    expect(texts(sh(['ls', 'pwd', 'history 1']).lines)).toEqual(['    3  history 1']);
    const cleared = sh(['ls', 'history -c']);
    expect(cleared.effects).toEqual([{ k: 'history-clear' }]);
    expect(cleared.state.history).toEqual([]);
    expect(out('history x')).toEqual([
      'history: x: numeric argument required',
      "Try 'man history' for more information.",
    ]);
  });
});

describe('LNX-SH-07 completion', () => {
  const ctx = (cwd = HOME) => ({ vfs, cwd, aliases: aliasesFor(vfs, 'bash'), cols: 80, skillGroups: ['langs'] });
  const tab = (input: string, listing = false, cwd = HOME) => complete(input, input.length, ctx(cwd), listing);

  it('empty input returns PASS_THROUGH (Tab moves focus)', () => {
    expect(tab('')).toEqual({ kind: 'pass' });
    expect(tab('   ')).toEqual({ kind: 'pass' });
  });

  it('commands and aliases on the first word; hidden commands only after two letters', () => {
    expect(tab('whoa')).toEqual({ kind: 'insert', value: 'whoami ', cursor: 7 });
    expect(tab('hist')).toEqual({ kind: 'insert', value: 'history ', cursor: 8 });
    expect(tab('neo')).toEqual({ kind: 'insert', value: 'neofetch ', cursor: 9 });
    expect(tab('n')).toEqual({ kind: 'bell' }); // `neofetch`/`nano` stay hidden after one letter
    expect(tab('ll')).toEqual({ kind: 'insert', value: 'll ', cursor: 3 });
  });

  it('paths relative to the cwd; directories get /', () => {
    expect(tab('cat ab')).toEqual({ kind: 'insert', value: 'cat about.txt ', cursor: 14 });
    expect(tab('cd pro')).toEqual({ kind: 'insert', value: 'cd projects/', cursor: 12 });
    expect(tab('cat projects/ro')).toEqual({ kind: 'insert', value: 'cat projects/rocket.md ', cursor: 23 });
    expect(tab('cat ~/.pl')).toEqual({ kind: 'insert', value: 'cat ~/.plan ', cursor: 12 });
    expect(tab('cat ~')).toEqual({ kind: 'insert', value: 'cat ~/', cursor: 6 });
    expect(tab('ls .ssh/')).toEqual({ kind: 'bell' });
    expect(tab('cat ../jaswanth/ab')).toEqual({ kind: 'insert', value: 'cat ../jaswanth/about.txt ', cursor: 26 });
  });

  it('cd completes directories only; open offers the résumé; man offers commands; skills offers groups', () => {
    expect(tab('cd e')).toEqual({ kind: 'bell' }); // education/ + experience/: no progress on the first Tab
    expect(tab('cd ed')).toEqual({ kind: 'insert', value: 'cd education/', cursor: 13 });
    expect(tab('open res')).toEqual({ kind: 'insert', value: 'open resume', cursor: 11 });
    expect(tab('man gr')).toEqual({ kind: 'insert', value: 'man grep ', cursor: 9 });
    expect(tab('skills la')).toEqual({ kind: 'insert', value: 'skills langs ', cursor: 13 });
  });

  it('flags after -', () => {
    expect(tab('projects --a')).toEqual({ kind: 'insert', value: 'projects --all ', cursor: 15 });
    expect(tab('ls -')).toEqual({ kind: 'bell' });
    const listed = tab('ls -', true);
    expect(listed.kind).toBe('list');
  });

  it('several candidates: common prefix first, the second Tab lists them in columns; none → bell', () => {
    expect(tab('cat a')).toEqual({ kind: 'insert', value: 'cat about.txt ', cursor: 14 });
    expect(tab('cat s')).toEqual({ kind: 'insert', value: 'cat skills.txt ', cursor: 15 });
    expect(tab('cat c')).toEqual({ kind: 'insert', value: 'cat contact.txt ', cursor: 16 });
  });

  it('completes inside a pipeline and mid-line', () => {
    expect(tab('ls | hea')).toEqual({ kind: 'insert', value: 'ls | head ', cursor: 10 });
    expect(tab('ls | he')).toEqual({ kind: 'bell' }); // head · help · hello
    const mid = complete('cat ab | wc', 6, ctx(), false);
    expect(mid).toEqual({ kind: 'insert', value: 'cat about.txt  | wc', cursor: 14 });
  });

  it('the second Tab lists candidates', () => {
    const listed = tab('cd e', true);
    expect(listed.kind).toBe('list');
    if (listed.kind === 'list') expect(texts(listed.lines)).toEqual(['education/  experience/']);
    expect(tab('xyz')).toEqual({ kind: 'bell' });
  });
});

describe('LNX-SH-08 line editing: Ctrl+A/E/U/K/W, Ctrl+C respects selection, paste trimming', () => {
  const at = (value: string, caret: number) => ({ value, start: caret, end: caret });

  it('Ctrl+A / Ctrl+E move to the start / end', () => {
    expect(editLine(at('cat about', 4), 'a')).toEqual(at('cat about', 0));
    expect(editLine(at('cat about', 4), 'e')).toEqual(at('cat about', 9));
  });

  it('Ctrl+U kills to the start, Ctrl+K to the end, Ctrl+W the word before the caret', () => {
    expect(editLine(at('cat about.txt', 4), 'u')).toEqual(at('about.txt', 0));
    expect(editLine(at('cat about.txt', 4), 'k')).toEqual(at('cat ', 4));
    expect(editLine(at('cat about.txt  ', 15), 'w')).toEqual(at('cat ', 4));
    expect(editLine(at('ls', 2), 'w')).toEqual(at('', 0));
  });

  it('Ctrl+C cancels only without a selection (otherwise the browser copies); Ctrl+D exits on an empty line', () => {
    expect(controlAction('c', { selection: true, empty: false })).toBe('copy');
    expect(controlAction('c', { selection: false, empty: false })).toBe('cancel');
    expect(controlAction('d', { selection: false, empty: true })).toBe('exit');
    expect(controlAction('d', { selection: false, empty: false })).toBeNull();
    expect(controlAction('l', { selection: false, empty: false })).toBe('clear');
    expect(controlAction('r', { selection: false, empty: false })).toBe('search');
    expect(controlAction('W', { selection: false, empty: false })).toBe('edit');
    expect(controlAction('z', { selection: false, empty: false })).toBeNull();
  });

  it('multi-line paste keeps the first line; long input is cut at the cap', () => {
    expect(trimPaste('ls\ncd projects\n')).toEqual({ text: 'ls', trimmed: 'lines' });
    expect(trimPaste('ls\n')).toEqual({ text: 'ls', trimmed: null });
    expect(trimPaste('x'.repeat(INPUT_CAP + 5))).toEqual({ text: 'x'.repeat(INPUT_CAP), trimmed: 'length' });
  });
});

describe('LNX-SH-09 flavor voices: same AST and effects, only strings differ', () => {
  const inputs = [
    'cd projects && ls',
    'cat nope',
    'projcts',
    'cd about.txt',
    'open resume',
    'echo hi > x',
    'ls |',
    'echo "x',
  ];
  const flavors: readonly Flavor[] = ['bash', 'zsh', 'powershell'];

  it('the parse is identical for every flavor', () => {
    for (const input of inputs) {
      const trees = flavors.map((flavor) => JSON.stringify(parse(tokenize(input).tokens, aliasesFor(vfs, flavor))));
      expect(new Set(trees).size).toBe(1);
    }
  });

  it('effects and exit codes are identical; shell-level messages speak each voice', () => {
    for (const input of inputs) {
      const runs = flavors.map((flavor) => sh(input, { flavor }));
      expect(new Set(runs.map((run) => JSON.stringify(run.effects))).size).toBe(1);
      expect(new Set(runs.map((run) => run.exitCode)).size).toBe(1);
    }
    expect(out('projcts', { flavor: 'zsh' })[0]).toBe('zsh: command not found: projcts');
    expect(out('cd nope', { flavor: 'zsh' })).toEqual(['cd: no such file or directory: nope']);
    expect(out('projcts', { flavor: 'powershell' })[0]).toMatch(/^projcts: The term 'projcts' is not recognized/);
    expect(out('pwd', { flavor: 'powershell', cwd: [...HOME, 'projects'] })).toEqual(['C:\\Users\\jaswanth\\projects']);
  });

  it('prompts', () => {
    expect(VOICES.bash.prompt([...HOME, 'projects'])).toBe('jaswanth@portfolio:~/projects$ ');
    expect(VOICES.zsh.prompt(HOME)).toBe('jaswanth@MacBook-Pro ~ % ');
    expect(VOICES.powershell.prompt(HOME)).toBe('PS C:\\Users\\jaswanth> ');
    expect(VOICES.bash.prompt(['etc'])).toBe('jaswanth@portfolio:/etc$ ');
  });

  it("PowerShell adds its own `type` alias (cat) without shadowing bash's `type`", () => {
    expect(out('type about.txt', { flavor: 'powershell' })[0]).toBe('Ada Example');
    expect(out('type ll')).toEqual(["ll is aliased to 'ls -l'"]);
  });
});

describe('LNX-SH-10 totality and caps', () => {
  it('fuzz: 5 000 random inputs never throw (strict mode — the safety net is never reached)', () => {
    let seed = 42;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const alphabet = [
      'ls',
      'cd',
      'cat',
      '|',
      '&&',
      '||',
      ';',
      '>',
      '<',
      '"',
      "'",
      '\\',
      '$',
      '*',
      '?',
      '[',
      ']',
      '~',
      '/',
      '..',
      '-',
      '-l',
      '!',
      '!!',
      '#',
      ' ',
      'projects',
      'x',
      'é',
      '🙂',
      'ا',
      '\t',
      'grep',
      'head',
      '-n',
      '{',
      '}',
      'open',
      'man',
      '&',
      '(',
      ')',
      '\n',
      'sudo',
      'rm -rf /',
    ];
    let state = initialShellState();
    for (let i = 0; i < 5000; i++) {
      let input = '';
      const length = Math.floor(random() * 12);
      for (let j = 0; j < length; j++) input += alphabet[Math.floor(random() * alphabet.length)];
      const run = execute(input, state, config());
      expect(Array.isArray(run.lines)).toBe(true);
      state = run.state.history.length > 50 ? { ...run.state, history: [] } : run.state;
    }
  });

  it('the safety net reports instead of throwing when not strict', () => {
    const broken = {
      ...vfs,
      resolve: () => {
        throw new Error('boom');
      },
    };
    const run = execute('ls', initialShellState(), { ...config({ vfs: broken }), strict: false });
    expect(texts(run.lines)).toEqual(['bash: that could not run — nothing was changed']);
    expect(run.exitCode).toBe(1);
    expect(() => execute('ls', initialShellState(), config({ vfs: broken }))).toThrow('boom');
  });

  it('pipelines hold at most 8 commands', () => {
    const run = sh(Array.from({ length: 9 }, () => 'cat about.txt').join(' | '));
    expect(texts(run.lines)).toEqual(['bash: pipeline too long: at most 8 commands']);
    expect(run.exitCode).toBe(2);
  });

  it('output is capped at 2000 lines per command with a notice', () => {
    const big: VfsFile = {
      kind: 'file',
      name: 'big.txt',
      mode: 0o444,
      mtime: '2026-01-01',
      mime: 'text',
      size: 1,
      read: () => Array.from({ length: 2500 }, (_, i) => `line ${i}`),
    };
    const root = { ...vfs.root, children: [...vfs.root.children, big] } as VfsDir;
    const run = execute('cat /big.txt', initialShellState(), config({ vfs: createVfs(root) }));
    expect(run.lines).toHaveLength(OUTPUT_CAP + 1);
    expect(run.lines[OUTPUT_CAP]!.t).toBe("… output truncated — pipe to 'less'");
    expect(data.person.name).toBe('Ada Example');
  });
});
