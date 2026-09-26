/**
 * The engine as hosts use it — the public API (`createTerminal`), the live selectors adapter, every voice's phrasing
 * (LNX-SH-09) and the about-me commands with the optional facts a portfolio may publish (levels, years, credentials,
 * "More on GitHub" repositories). Nothing here reads the real portfolio except the adapter smoke test.
 */
import { describe, expect, it } from 'vitest';
import { fixtureCatalog, fixturePortfolio } from '../../fixtures/portfolio';
import { createTerminal } from '@/lib/terminal';
import { terminalDataFrom } from '@/lib/terminal/data';
import { execute, initialShellState } from '@/lib/terminal/engine';
import { VOICES, type CdFailure } from '@/lib/terminal/flavor';
import { selectorsTerminalData } from '@/lib/terminal/from-selectors';
import { buildVfs, HOME, tildePath } from '@/lib/terminal/vfs';
import type { Flavor } from '@/lib/terminal/types';
import { getPerson, getProjects } from '@/data/selectors';
import { texts } from './helpers';

const rich = terminalDataFrom(
  {
    ...fixturePortfolio,
    skills: [
      {
        id: 'langs',
        label: 'Languages',
        items: [
          { name: 'Go', level: 4, years: 6 },
          { name: 'TypeScript', years: 3 },
        ],
      },
      { id: 'cloud', label: 'Cloud', items: [{ name: 'AWS' }] },
    ],
    credentials: [{ name: 'Cert One', issuer: 'Issuer', kind: 'certification', status: 'earned' }],
    education: [
      { ...fixturePortfolio.education[0]!, school: 'A Very Long University Name That Needs Wrapping At Forty Columns' },
    ],
  },
  fixtureCatalog.rev,
  {
    moreOnGithub: [
      {
        name: 'dotfiles',
        url: 'https://github.com/ada/dotfiles',
        description: null,
        stars: 3,
        forks: 0,
        language: 'Shell',
        topics: [],
        pushedAt: '2026-01-01',
        archived: false,
      },
    ],
    githubFor: (project) =>
      project.slug === 'portfolio-os'
        ? {
            name: 'portfolio-os',
            url: 'https://github.com/ada/portfolio-os',
            description: null,
            stars: 12,
            forks: 1,
            language: 'TypeScript',
            topics: [],
            pushedAt: '2026-01-01',
            archived: false,
          }
        : undefined,
  },
);
const richVfs = buildVfs(rich);
const run = (input: string, cols = 80) =>
  texts(
    execute(input, initialShellState(), {
      vfs: richVfs,
      data: rich,
      flavor: 'bash',
      os: 'linux',
      cols,
      rows: 24,
      strict: true,
    }).lines,
  );

describe('createTerminal — the host API', () => {
  const terminal = createTerminal({ data: rich, flavor: 'zsh', os: 'macos' });

  it('runs lines, completes, prompts, and starts at ~', () => {
    const state = terminal.initial();
    expect(state.cwd).toEqual(HOME);
    expect(terminal.prompt(state.cwd)).toBe('jaswanth@MacBook-Pro ~ % ');
    const result = terminal.run('cd projects && pwd', state, { cols: 80, rows: 24 });
    expect(texts(result.lines)).toEqual(['/home/jaswanth/projects']);
    expect(terminal.complete('cat ab', 6, state, 80, false)).toEqual({
      kind: 'insert',
      value: 'cat about.txt ',
      cursor: 14,
    });
    expect(terminal.complete('skills cl', 9, state, 80, false)).toEqual({
      kind: 'insert',
      value: 'skills cloud ',
      cursor: 13,
    });
    expect(terminal.initial([...HOME, 'projects'], ['ls']).history).toEqual(['ls']);
    expect(terminal.flavor).toBe('zsh');
    expect(tildePath(['etc'])).toBe('/etc');
    expect(tildePath([...HOME, 'projects'])).toBe('~/projects');
  });

  it('the live adapter reads the real portfolio through the selectors (and is memoised)', () => {
    const live = selectorsTerminalData();
    expect(live.person).toBe(getPerson());
    expect(live.projects.map((project) => project.slug)).toEqual(getProjects().map((project) => project.slug));
    expect(selectorsTerminalData()).toBe(live);
    expect(live.githubFor(live.projects[0]!)).toBeUndefined();
    expect(buildVfs(live).at([...HOME, 'projects'])?.kind).toBe('dir');
  });
});

describe('LNX-SH-09 every voice phrases every shell-level message', () => {
  const failures: readonly CdFailure[] = ['ENOENT', 'ENOTDIR', 'EACCES', 'OLDPWD', 'ARGS'];
  it.each(['bash', 'zsh', 'powershell'] as const)('%s', (flavor: Flavor) => {
    const voice = VOICES[flavor];
    const messages = [
      voice.notFound('x'),
      ...failures.map((failure) => voice.cd('x', failure)),
      voice.syntax('|'),
      voice.syntax(';'),
      voice.unterminated('"'),
      voice.permission('./x'),
      voice.isDirectory('./x'),
      voice.noSuchPath('./x'),
      voice.readOnly('x'),
      voice.eventNotFound('!x'),
      voice.tooDeep(),
      voice.typeNotFound('x'),
      voice.aliasNotFound('x'),
      voice.path([...HOME, 'a']),
      voice.path(['etc']),
      voice.prompt(['etc']),
    ];
    for (const message of messages) expect(message.length).toBeGreaterThan(0);
    expect(new Set(messages).size).toBeGreaterThan(messages.length - 3);
  });

  it('each voice runs the same commands end to end', () => {
    for (const flavor of ['zsh', 'powershell'] as const) {
      const vfs = buildVfs(rich);
      const exec = (input: string) =>
        execute(input, initialShellState(), { vfs, data: rich, flavor, os: 'macos', cols: 80, rows: 24, strict: true });
      expect(exec('cd .ssh').exitCode).toBe(1);
      expect(exec('cd a b').exitCode).toBe(1);
      expect(exec('cd -').exitCode).toBe(1);
      expect(exec('./resume.pdf').exitCode).toBe(126);
      expect(exec('./projects').exitCode).toBe(126);
      expect(exec('./nope').exitCode).toBe(127);
      expect(exec('!nope').exitCode).toBe(1);
      expect(exec('type nope').exitCode).toBe(1);
      expect(exec('alias nope').exitCode).toBe(1);
      expect(exec('echo "x').exitCode).toBe(2);
      expect(exec('echo x > y').exitCode).toBe(1);
      expect(exec(Array.from({ length: 9 }, () => 'ls').join('|')).exitCode).toBe(2);
    }
  });
});

describe('about-me commands with optional published facts', () => {
  it('skills: bars and years only where published; plain lists otherwise', () => {
    const lines = run('skills');
    expect(lines).toContain('  Go          ████░ 6 yrs');
    expect(lines).toContain('  TypeScript   3 yrs');
    expect(lines).toContain('  AWS');
    expect(run('skills Cl')[0]).toBe('Cloud  (skills cloud)');
  });

  it('education wraps long rows and lists credentials', () => {
    const narrow = run('education', 40);
    expect(narrow.every((line) => line.length <= 40)).toBe(true);
    expect(narrow).toContain('Credentials');
    expect(narrow.at(-1)).toBe('  Cert One — Issuer');
  });

  it('projects --all adds "More on GitHub"; live stats are noted', () => {
    const lines = run('projects --all');
    expect(lines).toContain('More on GitHub');
    expect(lines.some((line) => line.startsWith('dotfiles'))).toBe(true);
    expect(lines).toContain('1 with live GitHub stats — open one to see them');
    expect(run('cat projects/portfolio-os.md')).toContain('GitHub: 12 ★ · TypeScript');
  });

  it('neofetch falls back gracefully (first skill group; no education)', () => {
    const bare = terminalDataFrom({ ...fixturePortfolio, education: [], experience: [] }, 'rev');
    const lines = texts(
      execute('neofetch', initialShellState(), {
        vfs: buildVfs(bare),
        data: bare,
        flavor: 'bash',
        os: 'linux',
        cols: 80,
        rows: 24,
        strict: true,
      }).lines,
    );
    expect(lines.join('\n')).toContain('Role: Engineer');
    expect(lines.join('\n')).not.toContain('Education:');
  });

  it('empty collections say so', () => {
    const empty = terminalDataFrom({ ...fixturePortfolio, projects: [], experience: [], education: [] }, 'rev');
    const exec = (input: string) =>
      texts(
        execute(input, initialShellState(), {
          vfs: buildVfs(empty),
          data: empty,
          flavor: 'bash',
          os: 'linux',
          cols: 80,
          rows: 24,
          strict: true,
        }).lines,
      );
    expect(exec('projects')).toEqual(['No projects are listed yet.']);
    expect(exec('experience')).toEqual(['No roles are listed yet.']);
    expect(exec('education')).toEqual(['No education is listed yet.']);
  });
});
