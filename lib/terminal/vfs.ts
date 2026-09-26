/**
 * Virtual filesystem — linux/03. Read-only, generated from the portfolio data (the same selectors Finder, Explorer and
 * the mobile Files apps read): nothing here is hand-typed career content (`LNX-FS-01`). Path resolution handles `.`,
 * `..` (never above `/`), `~`, trailing and repeated slashes, case-sensitively (`LNX-FS-02`); metadata is truthful —
 * sizes are UTF-8 byte lengths at 80 columns, mtimes come from the data, modes are 0444 / 0555 / 0700 (`LNX-FS-03`);
 * files render width-aware through `renderText` (`LNX-FS-04`); `.bashrc` is the alias source and `/usr/bin` mirrors the
 * command table (`LNX-FS-05`).
 */
import { renderText } from '@/components/content/text';
import type { ContentRef, PartialDate } from '@/data/schema';
import { wrap } from '@/components/content/format';
import { currentRole, type TerminalData } from './data';
import { utf8Length } from './format';
import { BASHRC_ALIASES, COMMANDS } from './manifest';
import type { OpenTarget, ResolveResult, Vfs, VfsDir, VfsFile, VfsNode, VfsPath } from './types';

export const HOME: VfsPath = ['home', 'jaswanth'];
export const USER = 'jaswanth';
export const HOSTNAME = 'portfolio';

const FILE_MODE = 0o444;
const DIR_MODE = 0o555;
const PRIVATE_MODE = 0o700;
const TMP_MODE = 0o1777;

/** A directory nobody may enter (`~/.ssh`, mode 700 — "Permission denied" for everyone, by design). */
export const isPrivate = (node: VfsNode): boolean => node.kind === 'dir' && node.mode === PRIVATE_MODE;

const dateOf = (value: PartialDate | 'present' | null, fallback: string): string => {
  if (!value || value === 'present') return fallback;
  const [year, month] = value.split('-');
  return `${year}-${(month ?? '01').padStart(2, '0')}-01`;
};

function textFile(name: string, render: (cols: number) => readonly string[], mtime: string, ref?: OpenTarget): VfsFile {
  const at80 = render(80);
  return {
    kind: 'file',
    name,
    mode: FILE_MODE,
    mtime,
    mime: 'text',
    size: at80.length ? utf8Length(`${at80.join('\n')}\n`) : 0,
    read: render,
    ...(ref ? { ref } : {}),
  };
}

function dir(name: string, children: readonly VfsNode[], mode = DIR_MODE, ref?: ContentRef, mtime?: string): VfsDir {
  const sorted = [...children].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const newest = sorted.reduce((latest, child) => (child.mtime > latest ? child.mtime : latest), '');
  return {
    kind: 'dir',
    name,
    mode,
    mtime: mtime ?? (newest || '1970-01-01'),
    children: sorted,
    ...(ref ? { ref } : {}),
  };
}

/** `~/.bashrc`: the real alias source. */
export function bashrcText(): readonly string[] {
  return [
    '# ~/.bashrc — the aliases this shell loads (read-only, like everything here)',
    '',
    ...BASHRC_ALIASES.map(([name, value]) => `alias ${name}='${value}'`),
  ];
}

/** Parse `alias name='value'` lines (the engine loads its alias table from `.bashrc`, never from code). */
export function parseAliases(lines: readonly string[]): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const text of lines) {
    const match = /^\s*alias\s+([^=\s]+)='([^']*)'\s*$/.exec(text);
    if (match) aliases.set(match[1]!, match[2]!);
  }
  return aliases;
}

function motd(data: TerminalData, cols: number, hasTour: boolean): readonly string[] {
  const rows: [string, string][] = [
    ['résumé ready', 'open resume'],
    [`${data.projects.length} ${data.projects.length === 1 ? 'project' : 'projects'}`, 'cd projects && ls'],
    ...(data.person.now ? [["what I'm working on", 'cat .plan'] as [string, string]] : []),
    [data.person.openTo.replace(/\.$/, ''), 'contact'],
    ['new here?', hasTour ? 'help        (or: tour)' : 'help'],
  ];
  const label = Math.max(...rows.map(([text]) => text.length));
  const lines = [...wrap(`Welcome. This is ${data.person.givenName}'s portfolio — as a shell.`, cols), ''];
  for (const [text, command] of rows)
    lines.push(cols < 50 ? `  * ${text}\n      →  ${command}` : `  * ${text.padEnd(label, ' ')}  →  ${command}`);
  lines.push('', ...wrap('Tip: Tab completes, ↑ recalls, and nothing here can be broken.', cols));
  return lines.flatMap((text) => text.split('\n'));
}

export interface VfsOptions {
  /** Command names that get a `/usr/bin` entry (defaults to every non-builtin in the table). */
  readonly commands?: readonly string[];
}

/** Build the filesystem once per session (`buildVfs(data)`, memoised by the host on `contentRev`). */
export function buildVfs(data: TerminalData, options: VfsOptions = {}): Vfs {
  const updated = data.resume.updated;
  // Builtins (cd, echo, history…) live in the shell itself; every other command has its program in /usr/bin.
  const names = options.commands ?? COMMANDS.filter((meta) => !meta.builtin).map((meta) => meta.name);
  const about = { person: data.person, featured: data.projects.filter((p) => p.featured), current: currentRole(data) };

  const projects = data.projects.map((project) =>
    textFile(
      `${project.slug}.md`,
      (cols) => renderText('project-detail', { project, github: data.githubFor(project) }, cols),
      project.year ? `${project.year}-01-01` : updated,
      { section: 'projects', slug: project.slug },
    ),
  );
  const projectIndex = textFile(
    'README.md',
    (cols) => [
      '# Projects',
      '',
      ...data.projects.flatMap((project) => wrap(`${project.name} — ${project.tagline}`, cols)),
    ],
    updated,
  );
  const roles = data.experience.map((role) =>
    textFile(`${role.slug}.md`, (cols) => renderText('experience-detail', role, cols), dateOf(role.end, updated), {
      section: 'experience',
      slug: role.slug,
    }),
  );
  // shared/23: deep dives live in ~/notes (LNX-FS-08); no ContentRef, so `open` pages them in `less`.
  const dives = data.projects.flatMap((project) => (project.deepDives ?? []).map((dive) => ({ dive, project })));
  const notes = dives.map(({ dive }) =>
    textFile(`${dive.slug}.md`, (cols) => renderText('deep-dive', dive, cols), updated),
  );
  const notesIndex = textFile(
    'README.md',
    (cols) => [
      '# Notes — deep dives',
      '',
      ...dives.flatMap(({ dive, project }) => wrap(`${dive.slug}.md — ${dive.title} (${project.name})`, cols)),
    ],
    updated,
  );
  const schools = data.education.map((school) =>
    textFile(`${school.slug}.md`, (cols) => renderText('education-detail', school, cols), dateOf(school.end, updated), {
      section: 'education',
      slug: school.slug,
    }),
  );
  const resume: VfsFile = {
    kind: 'file',
    name: 'resume.pdf',
    mode: FILE_MODE,
    mtime: updated,
    mime: 'pdf',
    size: data.resumeFile?.bytes ?? 0,
    read: () => [],
    ref: 'resume',
  };
  const readme = textFile(
    'README.md',
    (cols) => [
      ...wrap(
        `~ — ${data.person.givenName}'s portfolio, as a filesystem. Everything here is generated from the same data as the rest of the site.`,
        cols,
      ),
      '',
      '  ls              see what is here',
      '  cat about.txt   who I am',
      '  cd projects     the work (then: ls, open <name>)',
      '  open resume     the résumé',
      '  help            every command',
    ],
    updated,
  );

  const home = dir(USER, [
    readme,
    textFile('about.txt', (cols) => renderText('about', about, cols), updated, { section: 'about' }),
    textFile('skills.txt', (cols) => renderText('skills', data.skills, cols), updated, { section: 'skills' }),
    textFile(
      'contact.txt',
      (cols) => renderText('contact', { contact: data.contact, person: data.person }, cols),
      updated,
      {
        section: 'contact',
      },
    ),
    resume,
    dir('projects', [projectIndex, ...projects], DIR_MODE, { section: 'projects' }, updated),
    dir('experience', roles, DIR_MODE, { section: 'experience' }, updated),
    dir('education', schools, DIR_MODE, { section: 'education' }, updated),
    ...(notes.length ? [dir('notes', [notesIndex, ...notes], DIR_MODE, undefined, updated)] : []),
    textFile('.bashrc', () => bashrcText(), updated),
    textFile(
      '.plan',
      (cols) => [
        ...(data.person.now ? [...wrap(data.person.now.text, cols), ''] : []),
        ...wrap(data.person.openTo, cols),
      ],
      updated,
    ),
    dir('.ssh', [], PRIVATE_MODE, undefined, updated),
  ]);

  const usrBin = dir(
    'bin',
    names.map((name): VfsFile => ({
      kind: 'file',
      name,
      mode: DIR_MODE,
      mtime: updated,
      mime: 'exe',
      size: utf8Length(`#!/usr/bin/portfolio-shell ${name}\n`),
      read: () => [],
    })),
  );
  const hasTour = names.includes('tour');
  const etc = dir('etc', [
    textFile('motd', (cols) => motd(data, cols, hasTour), updated),
    textFile(
      'os-release',
      () => [`NAME="PortfolioOS"`, `VERSION="${updated}"`, `BUILD_ID="${data.contentRev}"`],
      updated,
    ),
    textFile('hostname', () => [HOSTNAME], updated),
  ]);
  const root = dir('', [dir('home', [home]), etc, dir('usr', [usrBin]), dir('tmp', [], TMP_MODE, undefined, updated)]);
  return createVfs(root);
}

/** Wrap a tree in the resolver. Exported for fixtures (collision checks, empty collections). */
export function createVfs(root: VfsDir): Vfs {
  const at = (path: VfsPath): VfsNode | undefined => {
    let node: VfsNode = root;
    for (const segment of path) {
      if (node.kind !== 'dir') return undefined;
      const child: VfsNode | undefined = node.children.find((candidate) => candidate.name === segment);
      if (!child) return undefined;
      node = child;
    }
    return node;
  };

  const resolve = (cwd: VfsPath, input: string): ResolveResult => {
    if (input === '') return { ok: false, reason: 'ENOENT', at: input };
    let path: string[];
    let rest = input;
    if (input.startsWith('/')) path = [];
    else if (input === '~' || input.startsWith('~/')) {
      path = [...HOME];
      rest = input.slice(1);
    } else path = [...cwd];
    let node: VfsNode | undefined = at(path);
    if (!node) return { ok: false, reason: 'ENOENT', at: input };
    const segments = rest.split('/').filter(Boolean);
    for (const segment of segments) {
      if (node.kind !== 'dir') return { ok: false, reason: 'ENOTDIR', at: input };
      // No search permission: nothing may pass through a private directory, not even `.ssh/..`.
      if (isPrivate(node)) return { ok: false, reason: 'EACCES', at: input };
      if (segment === '.') continue;
      if (segment === '..') {
        path.pop();
        node = at(path)!;
        continue;
      }
      const child: VfsNode | undefined = node.children.find((candidate) => candidate.name === segment);
      if (!child) return { ok: false, reason: 'ENOENT', at: input };
      path.push(segment);
      node = child;
    }
    if (input.endsWith('/') && node.kind !== 'dir') return { ok: false, reason: 'ENOTDIR', at: input };
    return { ok: true, path, node };
  };

  const list = (path: VfsPath): readonly VfsNode[] => {
    const node = at(path);
    return node?.kind === 'dir' ? node.children : [];
  };

  function* walk(from: VfsPath = []): Iterable<readonly [VfsPath, VfsNode]> {
    const start = at(from);
    if (!start) return;
    const stack: [VfsPath, VfsNode][] = [[from, start]];
    while (stack.length) {
      const [path, node] = stack.pop()!;
      yield [path, node];
      if (node.kind === 'dir' && !isPrivate(node))
        for (let i = node.children.length - 1; i >= 0; i--) {
          const child = node.children[i]!;
          stack.push([[...path, child.name], child]);
        }
    }
  }

  return { root, home: HOME, resolve, list, walk, at };
}

/** `/home/jaswanth/projects` → `~/projects` (bash / zsh path display). */
export function tildePath(path: VfsPath): string {
  const underHome = HOME.every((part, i) => path[i] === part);
  if (underHome) return path.length === HOME.length ? '~' : `~/${path.slice(HOME.length).join('/')}`;
  return `/${path.join('/')}`;
}

export const absolutePath = (path: VfsPath): string => `/${path.join('/')}`;

/** Extension-less stem (`enterprise-sso.md` → `enterprise-sso`; dotfiles such as `.bashrc` keep their name). */
export const stem = (name: string): string => name.replace(/^(.+?)\.[^./]+$/, '$1');

/**
 * `LNX-FS-06`: sibling names under `~` must stay unique without extensions (the URL drops them), and a slug may not
 * collide with a reserved name (`README`). Returns the problems; the build check fails on any.
 */
export function vfsProblems(vfs: Vfs): readonly string[] {
  const problems: string[] = [];
  for (const [path, node] of vfs.walk(HOME)) {
    if (node.kind !== 'dir') continue;
    const seen = new Map<string, string>();
    for (const child of node.children) {
      const key = stem(child.name);
      const other = seen.get(key);
      if (other)
        problems.push(`${absolutePath([...path, child.name])} collides with ${other} once extensions are dropped`);
      else seen.set(key, child.name);
    }
  }
  return problems;
}

/** cwd ↔ URL (linux/03 "URL mapping"): a path under `~` → its segments relative to `~`; elsewhere → `null` (session only). */
export function cwdToUrlPath(cwd: VfsPath): readonly string[] | null {
  if (!HOME.every((part, i) => cwd[i] === part)) return null;
  return cwd.slice(HOME.length).map(stem);
}

export const urlPathToCwd = (path: readonly string[]): VfsPath => [...HOME, ...path];
