/**
 * The Windows Terminal adapter over the shared engine (plans/windows/apps/windows-terminal.md):
 * WIN-TERM-02 (the backslash display adapter round-trips; input accepts `/` and `\`; PowerShell and CMD prompts),
 * WIN-TERM-03 (the Windows alias table resolves to engine commands — also run through the real engine),
 * WIN-TERM-04 (PowerShell-voiced errors with the engine's "Did you mean" suggestion — snapshot).
 */
import { describe, expect, it } from 'vitest';
import { createTerminal } from '@/lib/terminal';
import { COMMAND_TABLE } from '@/lib/terminal/commands';
import { VOICES } from '@/lib/terminal/flavor';
import {
  commandPromptFor,
  fromWindowsPath,
  powershellPromptFor,
  SUDO_NOTE,
  toEngineInput,
  toWindowsPath,
  WINDOWS_ALIASES,
} from '@/lib/terminal/powershell';
import type { Execution, VfsPath } from '@/lib/terminal/types';
import { HOME } from '@/lib/terminal/vfs';
import { data, texts } from './helpers';

const terminal = createTerminal({ data, flavor: 'powershell', os: 'windows' });

/** Type lines into the Windows Terminal: each goes through the adapter, then the real engine (state carries over). */
function ps(lines: string | readonly string[]): Execution {
  let state = terminal.initial();
  let last: Execution | null = null;
  for (const typed of typeof lines === 'string' ? [lines] : lines) {
    last = terminal.run(toEngineInput(typed).line, state, { cols: 80, rows: 24 });
    state = last.state;
  }
  return last!;
}
const out = (lines: string | readonly string[]) => texts(ps(lines).lines);
const engineLine = (typed: string) => toEngineInput(typed).line;

const PATHS: readonly VfsPath[] = [
  [],
  ['home'],
  HOME,
  [...HOME, 'projects'],
  [...HOME, 'projects', 'README.md'],
  [...HOME, 'experience'],
  ['etc', 'motd'],
  ['usr', 'bin'],
];

describe('WIN-TERM-02 PowerShell/CMD prompts + the backslash display adapter over the shared VFS', () => {
  it('writes paths exactly as the PowerShell voice does (C:\\Users\\jaswanth\\projects)', () => {
    for (const path of PATHS) expect(toWindowsPath(path)).toBe(VOICES.powershell.path(path));
    expect(toWindowsPath([...HOME, 'projects'])).toBe('C:\\Users\\jaswanth\\projects');
    expect(toWindowsPath([])).toBe('C:\\');
  });

  it('path display adapter round-trips (Windows spelling → VFS path → Windows spelling)', () => {
    for (const path of PATHS) {
      expect(fromWindowsPath(toWindowsPath(path))).toEqual(path);
      expect(toWindowsPath(fromWindowsPath(toWindowsPath(path))!)).toBe(toWindowsPath(path));
    }
  });

  it('reads either separator, any case, ~ / $HOME, and resolves . and ..; relative paths and other drives are null', () => {
    expect(fromWindowsPath('c:/users/Jaswanth/projects')).toEqual([...HOME, 'projects']);
    expect(fromWindowsPath('C:\\Users\\JASWANTH\\projects\\')).toEqual([...HOME, 'projects']);
    expect(fromWindowsPath('~\\projects')).toEqual([...HOME, 'projects']);
    expect(fromWindowsPath('$HOME/experience')).toEqual([...HOME, 'experience']);
    expect(fromWindowsPath('C:')).toEqual([]);
    expect(fromWindowsPath('C:\\Users')).toEqual(['home']);
    expect(fromWindowsPath('C:\\Users\\jaswanth\\projects\\..\\.\\education')).toEqual([...HOME, 'education']);
    expect(fromWindowsPath('C:\\..\\..')).toEqual([]);
    expect(fromWindowsPath('projects')).toBeNull();
    expect(fromWindowsPath('D:\\data')).toBeNull();
  });

  it('the PowerShell prompt matches the engine voice; the Command Prompt profile writes C:\\Users\\jaswanth>', () => {
    for (const path of PATHS) expect(powershellPromptFor(path)).toBe(VOICES.powershell.prompt(path));
    expect(powershellPromptFor(HOME)).toBe('PS C:\\Users\\jaswanth> ');
    expect(commandPromptFor(HOME)).toBe('C:\\Users\\jaswanth>');
    expect(commandPromptFor([...HOME, 'projects'])).toBe('C:\\Users\\jaswanth\\projects>');
    expect(commandPromptFor([])).toBe('C:\\>');
  });

  it('input accepts / and \\ separators (outside quotes), drive and home spellings, cd.. and cd\\', () => {
    const table: readonly (readonly [string, string])[] = [
      ['cd C:\\Users\\Jaswanth\\projects', 'cd ~/projects'],
      ['cd c:/users/jaswanth/projects', 'cd ~/projects'],
      ['cd ~\\projects', 'cd ~/projects'],
      ['cd $HOME\\projects', 'cd ~/projects'],
      ['cd $env:USERPROFILE', 'cd ~'],
      ['cd C:\\', 'cd /'],
      ['cd C:\\etc', 'cd /etc'],
      ['cd \\', 'cd /'],
      ['cd..', 'cd ..'],
      ['cd\\', 'cd /'],
      ['CD..\\projects', 'cd ../projects'],
      ['cd ..\\..', 'cd ../..'],
      ['type .\\about.txt', 'cat ./about.txt'],
      ['cat projects/README.md', 'cat projects/README.md'],
      ['ls -la projects\\', 'ls -la projects/'],
      ['  dir', '  ls'],
    ];
    for (const [typed, engine] of table) expect(engineLine(typed), typed).toBe(engine);
  });

  it('never mangles quoted strings or flags; echo keeps its backslashes', () => {
    expect(engineLine('echo "C:\\a b"')).toBe('echo "C:\\a b"');
    expect(engineLine("grep 'a\\b' about.txt")).toBe("grep 'a\\b' about.txt");
    expect(engineLine('dir -la -1')).toBe('ls -la -1');
    expect(engineLine('cat "my file.txt" ~\\about.txt')).toBe('cat "my file.txt" ~/about.txt');
    expect(out('echo C:\\Users\\jaswanth')).toEqual(['C:\\Users\\jaswanth']);
    expect(out('Write-Output "C:\\x y"')).toEqual(['C:\\x y']);
  });

  it('through the engine: cd with Windows paths, then pwd / Get-Location print the Windows spelling', () => {
    expect(out(['cd C:\\Users\\Jaswanth\\projects', 'pwd'])).toEqual(['C:\\Users\\jaswanth\\projects']);
    expect(out(['cd projects', 'cd ..\\experience', 'Get-Location'])).toEqual(['C:\\Users\\jaswanth\\experience']);
    expect(out(['cd \\', 'pwd'])).toEqual(['C:\\']);
    expect(out(['cd C:\\Users', 'gl'])).toEqual(['C:\\home']);
    expect(out(['cd projects', 'cd..', 'pwd'])).toEqual(['C:\\Users\\jaswanth']);
    expect(ps(['cd C:\\Users\\jaswanth\\projects']).effects).toEqual([{ k: 'cd', to: [...HOME, 'projects'] }]);
  });

  it('winver runs nothing: the host opens the About dialog', () => {
    expect(toEngineInput('winver')).toEqual({ line: '', winver: true });
    expect(toEngineInput('  WinVer.exe')).toEqual({ line: '', winver: true });
    expect(toEngineInput('dir')).toEqual({ line: 'ls', winver: false });
    expect(toEngineInput('echo winver').winver).toBe(false);
  });
});

describe('WIN-TERM-03 Windows aliases (dir, type, cls, start, ii, Get-Help) resolve to engine commands', () => {
  it('alias table resolves to engine commands (every target is a real command)', () => {
    for (const [alias, command] of WINDOWS_ALIASES) {
      expect(Object.hasOwn(COMMAND_TABLE, command), `${alias} → ${command}`).toBe(true);
      expect(engineLine(alias)).toBe(command);
    }
    const spec: Readonly<Record<string, string>> = {
      dir: 'ls',
      type: 'cat',
      cls: 'clear',
      start: 'open',
      ii: 'open',
      'Get-Help': 'help',
      'Get-ChildItem': 'ls',
      gci: 'ls',
      'Get-Content': 'cat',
      gc: 'cat',
      'Clear-Host': 'clear',
      'Invoke-Item': 'open',
      'Start-Process': 'open',
      'Set-Location': 'cd',
      sl: 'cd',
      chdir: 'cd',
      'Get-Location': 'pwd',
      gl: 'pwd',
      'Write-Output': 'echo',
    };
    for (const [alias, command] of Object.entries(spec)) {
      expect(engineLine(alias)).toBe(command);
      expect(engineLine(alias.toUpperCase())).toBe(command);
    }
  });

  it('resolves the first word of every command in a list or pipeline (and help topics); other arguments never', () => {
    expect(engineLine('gci projects | sort -r')).toBe('ls projects | sort -r');
    expect(engineLine('cls; Get-Location')).toBe('clear; pwd');
    expect(engineLine('dir && type about.txt || Get-Help')).toBe('ls && cat about.txt || help');
    expect(engineLine('help dir')).toBe('help ls');
    expect(engineLine('Get-Help Get-ChildItem')).toBe('help ls');
    expect(engineLine('sort dir')).toBe('sort dir');
    expect(engineLine('Get-Content -Path about.txt')).toBe('cat about.txt');
    expect(engineLine('LS -l')).toBe('ls -l');
    expect(engineLine('Get-Process')).toBe('Get-Process');
  });

  it('runs through the real engine: dir lists, type prints, start/ii open, cls clears, Get-Help helps', () => {
    const listing = out('dir').join('\n');
    expect(listing).toContain('projects');
    expect(listing).toContain('resume.pdf');
    expect(out('dir')).toEqual(out('ls'));
    expect(out('type about.txt')[0]).toBe('Ada Example');
    expect(out('Get-Content .\\about.txt')).toEqual(out('cat about.txt'));
    expect(out('Get-ChildItem C:\\Users\\jaswanth\\projects')).toEqual(out('ls ~/projects'));
    expect(ps('start resume').effects).toEqual([{ k: 'open', ref: 'resume' }]);
    expect(ps('ii resume.pdf').effects).toEqual([{ k: 'open', ref: 'resume' }]);
    expect(ps('Invoke-Item .').effects).toEqual([{ k: 'reveal', path: HOME, ref: null }]);
    expect(ps('start experience').effects).toEqual([
      { k: 'reveal', path: [...HOME, 'experience'], ref: { section: 'experience' } },
    ]);
    expect(ps('cls').effects).toEqual([{ k: 'clear' }]);
    expect(ps('Clear-Host').effects).toEqual([{ k: 'clear' }]);
    expect(out('Get-Help')[0]).toBe('Explore');
    expect(out('Get-Help dir')).toEqual(out('help ls'));
    expect(out(['Set-Location projects', 'Get-Location'])).toEqual(['C:\\Users\\jaswanth\\projects']);
    expect(out('Write-Output hello')).toEqual(['hello']);
  });

  it('sudo hire-me: the Windows line first, then the shared EGG-SUDO-01 block (the egg still counts)', () => {
    const run = ps('sudo hire-me');
    expect(texts(run.lines)[0]).toBe(SUDO_NOTE);
    expect(run.effects).toContainEqual({ k: 'egg', id: 'EGG-SUDO-01' });
    expect(texts(run.lines).slice(1)).toEqual(
      texts(terminal.run('sudo hire-me', terminal.initial(), { cols: 80, rows: 24 }).lines),
    );
    // Any other sudo keeps the engine's answer; the word elsewhere is never rewritten.
    expect(out('sudo dir')).toEqual(out('sudo ls'));
    expect(out('sudo dir')[0]).not.toBe(SUDO_NOTE);
    expect(engineLine('echo sudo')).toBe('echo sudo');
  });
});

describe('WIN-TERM-04 PowerShell-voiced errors with suggestions', () => {
  it('error formatter snapshot: not-recognized + "Did you mean" / "Try help"', () => {
    const unknown = ps('foo');
    const typo = ps('lss projects');
    const cd = ps('cd nope');
    expect(unknown.exitCode).toBe(127);
    expect(typo.exitCode).toBe(127);
    expect(typo.lines[1]).toMatchObject({ cls: 'dim', insert: 'ls' });
    expect({
      unknown: unknown.lines.map((line) => [line.cls, line.t]),
      typo: typo.lines.map((line) => [line.cls, line.t]),
      cd: cd.lines.map((line) => [line.cls, line.t]),
      cmdlet: out('Get-Process'),
    }).toMatchInlineSnapshot(`
      {
        "cd": [
          [
            "err",
            "Set-Location: Cannot find path 'nope' because it does not exist.",
          ],
        ],
        "cmdlet": [
          "Get-Process: The term 'Get-Process' is not recognized as a name of a cmdlet, function, script file, or executable program.",
          "Try 'help'.",
        ],
        "typo": [
          [
            "err",
            "lss: The term 'lss' is not recognized as a name of a cmdlet, function, script file, or executable program.",
          ],
          [
            "dim",
            "Did you mean 'ls'?",
          ],
        ],
        "unknown": [
          [
            "err",
            "foo: The term 'foo' is not recognized as a name of a cmdlet, function, script file, or executable program.",
          ],
          [
            "dim",
            "Try 'help'.",
          ],
        ],
      }
    `);
  });
});
