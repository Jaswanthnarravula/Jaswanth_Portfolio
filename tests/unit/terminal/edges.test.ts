/**
 * Less common paths through the commands (flags, odd operands, narrow widths, binary files) — each asserted, so the
 * engine's behaviour at the edges is specified, not just executed (LNX-CMD-* goldens, LNX-SH-10 totality).
 */
import { describe, expect, it } from 'vitest';
import { controlAction, editLine, trimPaste } from '@/lib/terminal/line-editing';
import { commonPrefix, humanSize, lsDate, modeString, table } from '@/lib/terminal/format';
import { HOME } from '@/lib/terminal/vfs';
import { out, sh, texts } from './helpers';

describe('ls edges', () => {
  it('-A shows dotfiles without . and ..; -F marks directories and programs; -d lists the directory itself', () => {
    expect(out('ls -A -1')).toEqual([
      '.bashrc',
      '.plan',
      '.ssh',
      'README.md',
      'about.txt',
      'contact.txt',
      'education',
      'experience',
      'projects',
      'resume.pdf',
      'skills.txt',
    ]);
    expect(out('ls -1F')).toContain('projects/');
    expect(out('ls -F /usr/bin').join(' ')).toContain('ls*');
    expect(out('ls -d projects')).toEqual(['projects']);
    expect(out('ls -ldF projects')).toEqual(['total 4', expect.stringMatching(/projects\/$/)]);
    expect(out('ls -lF /usr/bin/ls')[1]).toMatch(/\/usr\/bin\/ls\*$/);
  });

  it('piped output is one entry per line; narrow -lh stacks human sizes', () => {
    expect(out('ls projects | cat')).toEqual(['README.md', 'portfolio-os.md', 'rocket.md']);
    expect(out('ls -lh', { cols: 40 })).toContain('  -r--r--r-- · 13K · Jan  1  2026');
    expect(out('ls ~/.ssh/key')).toEqual(["ls: cannot access '/home/jaswanth/.ssh/key': Permission denied"]);
    expect(out('ls about.txt/x')).toEqual(["ls: cannot access 'about.txt/x': Not a directory"]);
  });
});

describe('tree, cat, head, tail edges', () => {
  it('tree -a shows dotfiles and marks the private directory; tree on a file errors', () => {
    const lines = out('tree -a');
    expect(lines).toContain('├── .ssh  [error opening dir]');
    expect(out('tree about.txt')[0]).toBe('about.txt [error opening dir]');
    expect(out('tree projects').at(-1)).toBe('0 directories, 3 files');
    expect(out('tree -L 1 /').at(-1)).toBe('4 directories, 0 files');
  });

  it('cat of a file inside the private directory, of nothing, and of several files with errors', () => {
    expect(sh('cat').lines).toEqual([]);
    const mixed = sh('cat .plan nope .plan');
    expect(texts(mixed.lines)).toEqual(['Open to tests.', 'cat: nope: No such file or directory', 'Open to tests.']);
    expect(mixed.exitCode).toBe(1);
    expect(out('cat about.txt/x')).toEqual(['cat: about.txt/x: Not a directory']);
  });

  it('head/tail on binary files and directories report instead of printing', () => {
    expect(out('head resume.pdf')).toEqual(['head: resume.pdf: binary file']);
    expect(out('tail projects')).toEqual(['tail: projects: Is a directory']);
    expect(out('head -3 .bashrc')).toEqual([
      '# ~/.bashrc — the aliases this shell loads (read-only, like everything here)',
      '',
      "alias ll='ls -l'",
    ]);
  });
});

describe('grep, find, wc, sort, uniq edges', () => {
  it('grep -H labels a single file; -v -n numbers the kept lines; binary files are skipped', () => {
    expect(out('grep -H Go skills.txt')).toEqual(['skills.txt:Go, TypeScript']);
    expect(out('grep -vn Go skills.txt')).toEqual(['1:LANGUAGES', '2:─────────────']);
    expect(sh('grep x resume.pdf').exitCode).toBe(1);
    expect(out('grep -c Go skills.txt .plan')).toEqual(['skills.txt:1', '.plan:0']);
    expect(out('grep -r Go nope')).toEqual(['grep: nope: No such file or directory']);
    expect(out('grep -i "o." .plan')).toEqual(['Open to tests.']);
    expect(sh('grep "" .plan').exitCode).toBe(0);
  });

  it('find -iname, find on a file, find with a missing -name value', () => {
    expect(out('find . -iname "README*"')).toEqual([
      "find: './.ssh': Permission denied",
      './README.md',
      './projects/README.md',
    ]);
    expect(out('find about.txt')).toEqual(['about.txt']);
    expect(out('find . -name')).toEqual(["find: missing argument to '-name'", "Try 'man find' for more information."]);
    expect(out('find -mtime 1')).toEqual(["find: unknown predicate '-mtime'", "Try 'man find' for more information."]);
    expect(out('find --help')).toEqual(['Usage: find [path] [-name glob] [-type f|d]']);
  });

  it('wc -w / -c and a missing file; sort -n / -f; uniq on a file', () => {
    expect(out('wc -w .plan')).toEqual(['3 .plan']);
    expect(out('wc -c .plan')).toEqual(['15 .plan']);
    expect(out('echo x | wc -l')).toEqual(['1']);
    expect(out('wc nope')).toEqual(['wc: nope: No such file or directory']);
    expect(out('history | sort -n')).toEqual(['    1  history | sort -n']);
    expect(out('ls | sort -f | head -1')).toEqual(['about.txt']);
    expect(out('uniq .plan')).toEqual(['Open to tests.']);
    expect(out('sort nope')).toEqual(['sort: nope: No such file or directory']);
  });
});

describe('open and the about commands at the edges', () => {
  it('open a directory by path from elsewhere, and the home folder on Linux', () => {
    const run = sh('open ~', { cwd: [...HOME, 'projects'] });
    expect(run.effects).toEqual([{ k: 'cd', to: HOME }]);
    expect(texts(run.lines)[0]).toContain('README.md');
    expect(sh('open /etc', { os: 'macos' }).effects).toEqual([{ k: 'reveal', path: ['etc'], ref: null }]);
    expect(sh('open .plan').effects[0]).toMatchObject({ k: 'pager' });
    expect(out('open --help')).toEqual([
      'Usage: open <resume | path>',
      'open the résumé, a project, a role or a folder',
    ]);
  });

  it('projects rejects unknown options; resume and mail parse their own', () => {
    expect(sh('projects --nope').exitCode).toBe(2);
    expect(sh('resume --nope').exitCode).toBe(2);
    expect(sh('mail -x').exitCode).toBe(2);
    expect(out('mail -sHi').length).toBe(2);
    expect(sh('mail -sHi').effects).toEqual([{ k: 'mailto', subject: 'Hi' }]);
  });

  it('eggs: sudo with no command, vim with no file, cowsay with no text', () => {
    expect(out('sudo')).toEqual(['usage: sudo <command>']);
    expect(sh('vim').effects[1]).toMatchObject({ title: 'vim' });
    expect(out('cowsay')[1]).toBe('< Moo. >');
    expect(out('rm -f about.txt')).toEqual(["rm: cannot remove 'about.txt': Read-only file system"]);
  });
});

describe('pure helpers', () => {
  it('format helpers', () => {
    expect(humanSize(512)).toBe('512');
    expect(humanSize(12_845)).toBe('13K');
    expect(humanSize(1536)).toBe('1.5K');
    expect(humanSize(5 * 1024 * 1024)).toBe('5M');
    expect(humanSize(12 * 1024 * 1024)).toBe('12M');
    expect(modeString('dir', 0o1777)).toBe('drwxrwxrwt');
    expect(modeString('file', 0o1666)).toBe('-rw-rw-rwT');
    expect(lsDate('2021-08-01')).toBe('Aug  1  2021');
    expect(commonPrefix([])).toBe('');
    expect(table(['A', 'B'], [[{ text: 'a very long value' }, { text: 'b' }]], 80, [6, null])[1]!.t).toBe('a ver…  b');
  });

  it('line editing with a selection and paste of a single line', () => {
    expect(editLine({ value: 'abc def', start: 4, end: 7 }, 'k')).toEqual({ value: 'abc ', start: 4, end: 4 });
    expect(trimPaste('single')).toEqual({ text: 'single', trimmed: null });
    expect(controlAction('A', { selection: false, empty: true })).toBe('edit');
  });
});
