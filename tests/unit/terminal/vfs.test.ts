/** The virtual filesystem — plans/linux/03-filesystem.md, LNX-FS-01 … LNX-FS-07. */
import { describe, expect, it } from 'vitest';
import { fixtureCatalog, fixtureCodec, fixturePortfolio } from '../../fixtures/portfolio';
import { renderText } from '@/components/content/text';
import { terminalDataFrom } from '@/lib/terminal/data';
import { aliasesFor } from '@/lib/terminal/engine';
import { COMMANDS, BASHRC_ALIASES } from '@/lib/terminal/manifest';
import {
  absolutePath,
  bashrcText,
  buildVfs,
  cwdToUrlPath,
  HOME,
  parseAliases,
  urlPathToCwd,
  vfsProblems,
} from '@/lib/terminal/vfs';
import { linuxTerminalPaths } from '@/lib/kernel/route/codec';
import type { VfsNode } from '@/lib/terminal/types';
import { data, out, sh, texts, vfs } from './helpers';

const treeOf = (node: VfsNode, depth = 0): string[] => [
  `${'  '.repeat(depth)}${node.name || '/'}${node.kind === 'dir' ? '/' : ''}`,
  ...(node.kind === 'dir' ? node.children.flatMap((child) => treeOf(child, depth + 1)) : []),
];

describe('LNX-FS-01 tree generated from selectors (no hand-typed content)', () => {
  it('matches the expected tree for the fixture', () => {
    expect(treeOf(vfs.at(HOME)!)).toEqual([
      'jaswanth/',
      '  .bashrc',
      '  .plan',
      '  .ssh/',
      '  README.md',
      '  about.txt',
      '  contact.txt',
      '  education/',
      '    state-u.md',
      '  experience/',
      '    acme.md',
      '    globex.md',
      '  projects/',
      '    README.md',
      '    portfolio-os.md',
      '    rocket.md',
      '  resume.pdf',
      '  skills.txt',
    ]);
    expect(vfs.root.children.map((child) => child.name)).toEqual(['etc', 'home', 'tmp', 'usr']);
    expect(vfs.list(['etc']).map((child) => child.name)).toEqual(['hostname', 'motd', 'os-release']);
  });

  it('every ContentRef in the catalogue has a file (or a directory for a section)', () => {
    for (const entry of fixtureCatalog.entries) {
      const ref = entry.ref;
      const slug = 'slug' in ref ? ref.slug : undefined;
      const hit = [...vfs.walk(HOME)].some(([, node]) => {
        if (!node.ref) return false;
        if (node.ref === 'resume') return ref.section === 'resume';
        return node.ref.section === ref.section && ('slug' in node.ref ? node.ref.slug : undefined) === slug;
      });
      expect(hit, entry.key).toBe(true);
    }
  });

  it('file text is the content views’ text (the same facts the GUI apps show)', () => {
    const role = fixturePortfolio.experience[0]!;
    expect(out('cat experience/acme.md')).toEqual([...renderText('experience-detail', role, 80)]);
    expect(out('cat about.txt')[0]).toBe('Ada Example');
    expect(out('cat /etc/os-release')).toEqual([
      'NAME="PortfolioOS"',
      'VERSION="2026-01-01"',
      `BUILD_ID="${fixtureCatalog.rev}"`,
    ]);
    expect(out('cat .plan')).toEqual(['Open to tests.']);
  });

  it('an empty collection is an empty directory (ls prints nothing)', () => {
    const empty = buildVfs(terminalDataFrom({ ...fixturePortfolio, education: [] }, 'rev'));
    expect(empty.list([...HOME, 'education'])).toEqual([]);
  });
});

describe('LNX-FS-02 path resolution', () => {
  const resolve = (input: string, cwd = [...HOME, 'projects']) => {
    const result = vfs.resolve(cwd, input);
    return result.ok ? absolutePath(result.path) : result.reason;
  };
  it.each([
    ['.', '/home/jaswanth/projects'],
    ['..', '/home/jaswanth'],
    ['../..', '/home'],
    ['../../../../../..', '/'],
    ['/', '/'],
    ['~', '/home/jaswanth'],
    ['~/about.txt', '/home/jaswanth/about.txt'],
    ['rocket.md', '/home/jaswanth/projects/rocket.md'],
    ['.//rocket.md', '/home/jaswanth/projects/rocket.md'],
    ['../experience/', '/home/jaswanth/experience'],
    ['//etc///motd', '/etc/motd'],
    ['Rocket.md', 'ENOENT'],
    ['nope', 'ENOENT'],
    ['rocket.md/', 'ENOTDIR'],
    ['rocket.md/x', 'ENOTDIR'],
    ['rocket.md/..', 'ENOTDIR'],
    ['~/.ssh', '/home/jaswanth/.ssh'],
    ['~/.ssh/id_rsa', 'EACCES'],
    ['~/.ssh/..', 'EACCES'],
    ['', 'ENOENT'],
  ])('%s → %s', (input, expected) => {
    expect(resolve(input)).toBe(expected);
  });

  it("'..' at '/' stays '/'", () => {
    expect(resolve('..', [])).toBe('/');
  });

  it('cd - returns to the previous directory and prints it', () => {
    const run = sh(['cd projects', 'cd ~/experience', 'cd -']);
    expect(texts(run.lines)).toEqual(['/home/jaswanth/projects']);
    expect(run.state.cwd).toEqual([...HOME, 'projects']);
  });
});

describe('LNX-FS-03 truthful metadata', () => {
  it('ls -l fields derive from data: mode, links, owner, size (UTF-8 bytes at 80 cols), date', () => {
    const lines = out('ls -la');
    expect(lines[0]).toMatch(/^total \d+$/);
    const row = (name: string) => lines.find((line) => line.endsWith(` ${name}`))!;
    const about = renderText(
      'about',
      {
        person: fixturePortfolio.person,
        featured: [fixturePortfolio.projects[0]!],
        current: fixturePortfolio.experience[0],
      },
      80,
    );
    const bytes = new TextEncoder().encode(`${about.join('\n')}\n`).length;
    expect(row('about.txt')).toBe(`-r--r--r-- 1 jaswanth jaswanth ${String(bytes).padStart(5)} Jan  1  2026 about.txt`);
    expect(row('projects')).toMatch(/^dr-xr-xr-x 2 jaswanth jaswanth  4096 Jan  1  2026 projects$/);
    expect(row('.ssh')).toMatch(/^drwx------ 2 jaswanth jaswanth  4096 Jan  1  2026 \.ssh$/);
    expect(row('resume.pdf')).toMatch(/^-r--r--r-- 1 jaswanth jaswanth 12845 Jan  1  2026 resume\.pdf$/);
    expect(lines.some((line) => / \.$/.test(line)) && lines.some((line) => / \.\.$/.test(line))).toBe(true);
  });

  it('mtimes come from the data: a role’s end date, a project’s year, resume.updated', () => {
    expect(out('ls -l experience')).toEqual([
      'total 8',
      expect.stringMatching(/ Jan  1  2026 acme\.md$/), // present → resume.updated
      expect.stringMatching(/ Aug  1  2021 globex\.md$/),
    ]);
    expect(out('ls -l projects').at(-1)).toMatch(/ Jan  1  2023 rocket\.md$/);
  });

  it('-h prints human sizes; /tmp is sticky and world-writable in appearance', () => {
    expect(out('ls -lh ~/resume.pdf')).toEqual([
      'total 16',
      '-r--r--r-- 1 jaswanth jaswanth 13K Jan  1  2026 /home/jaswanth/resume.pdf',
    ]);
    expect(out('ls -ld /tmp')[1]).toMatch(/^drwxrwxrwt /);
  });
});

describe('LNX-FS-04 width-aware file text', () => {
  it('about.txt at 80 and 40 cols', () => {
    const wide = out('cat about.txt', { cols: 80 });
    const narrow = out('cat about.txt', { cols: 40 });
    expect(wide).toMatchSnapshot('about.txt @80');
    expect(narrow).toMatchSnapshot('about.txt @40');
    expect(Math.max(...narrow.map((line) => line.length))).toBeLessThanOrEqual(40);
  });
});

describe('LNX-FS-05 .bashrc is the alias source; /usr/bin mirrors the command table', () => {
  it('the alias table is parsed from .bashrc', () => {
    const fromFile = parseAliases(out('cat ~/.bashrc'));
    expect([...fromFile]).toEqual(BASHRC_ALIASES.map(([name, value]) => [name, value]));
    expect([...aliasesFor(vfs, 'bash')]).toEqual([...fromFile]);
    expect(parseAliases(bashrcText())).toEqual(fromFile);
    expect(out('alias')).toEqual(bashrcText().filter((line) => line.startsWith('alias ')));
  });

  it('which and ls /usr/bin agree with the registry', () => {
    const programs = COMMANDS.filter((meta) => !meta.builtin)
      .map((meta) => meta.name)
      .sort();
    expect(out('ls -1 /usr/bin')).toEqual(programs);
    for (const name of programs) expect(out(`which ${name}`)).toEqual([`/usr/bin/${name}`]);
    for (const meta of COMMANDS.filter((m) => m.builtin))
      expect(out(`which ${meta.name}`)).toEqual([`${meta.name}: shell built-in command`]);
  });
});

describe('LNX-FS-06 cwd ↔ URL mapping; unique extension-less sibling names', () => {
  it('round-trips through the route codec', () => {
    for (const path of linuxTerminalPaths(fixtureCatalog)) {
      const cwd = urlPathToCwd(path);
      expect(cwdToUrlPath(cwd)).toEqual(path);
      const url = fixtureCodec.encode({
        kind: 'os',
        os: 'linux',
        focus: { role: 'terminal', location: { kind: 'vfs', path } },
      });
      const decoded = fixtureCodec.decode(url);
      expect(decoded.ok && decoded.route.kind === 'os' && decoded.route.focus?.location).toEqual({ kind: 'vfs', path });
    }
    expect(cwdToUrlPath(['etc'])).toBeNull(); // outside ~: session only
    expect(cwdToUrlPath([...HOME, 'projects', 'rocket.md'])).toEqual(['projects', 'rocket']);
  });

  it('the build check fails on a collision once extensions are dropped (a slug named README)', () => {
    expect(vfsProblems(vfs)).toEqual([]);
    const clash = buildVfs(
      terminalDataFrom(
        {
          ...fixturePortfolio,
          projects: [...fixturePortfolio.projects, { ...fixturePortfolio.projects[1]!, slug: 'README' }],
        },
        'rev',
      ),
    );
    expect(vfsProblems(clash)).toEqual([
      '/home/jaswanth/projects/README.md collides with README.md once extensions are dropped',
    ]);
  });
});

describe('LNX-FS-07 permission-denied and read-only behaviours', () => {
  it('cd .ssh → EACCES; ls .ssh → Permission denied; cat inside → Permission denied', () => {
    expect(out('cd .ssh')).toEqual(['bash: cd: .ssh: Permission denied']);
    expect(out('ls .ssh')).toEqual(["ls: cannot open directory '.ssh': Permission denied"]);
    expect(out('cat .ssh/id_rsa')).toEqual(['cat: .ssh/id_rsa: Permission denied']);
  });

  it('touch x → Read-only file system (and every other write)', () => {
    expect(out('touch x')).toEqual(["touch: cannot touch 'x': Read-only file system"]);
    expect(out('mkdir y')).toEqual(["mkdir: cannot create directory 'y': Read-only file system"]);
    expect(out('rm about.txt')).toEqual(["rm: cannot remove 'about.txt': Read-only file system"]);
    expect(out('cp a b')).toEqual([
      "cp: cannot create regular file 'a': Read-only file system",
      "cp: cannot create regular file 'b': Read-only file system",
    ]);
    expect(out('echo x > /tmp/y')).toEqual(['bash: /tmp/y: Read-only file system']);
    expect(sh('touch x').exitCode).toBe(1);
    expect(out('touch')).toEqual(['touch: missing operand', "Try 'man touch' for more information."]);
    expect(data.contentRev).toBe(fixtureCatalog.rev);
  });
});
