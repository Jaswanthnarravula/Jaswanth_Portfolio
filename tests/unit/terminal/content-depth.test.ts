/**
 * shared/23 content depth in the Linux terminal — LNX-FS-08 (case study, scope, ~/notes deep dives, `.plan` = Now)
 * and LNX-BOOT-08 (the MOTD "what I'm working on" entry). Runs on the real data, like the visitor's shell.
 */
import { describe, expect, it } from 'vitest';
import { portfolio } from '@/data/portfolio';
import { motdLines } from '@/components/os/linux/model';
import { terminalDataFrom } from '@/lib/terminal/data';
import { execute, initialShellState } from '@/lib/terminal/engine';
import { buildVfs, HOME, vfsProblems } from '@/lib/terminal/vfs';
import type { VfsFile } from '@/lib/terminal/types';

const data = terminalDataFrom(portfolio, 'rev');
const vfs = buildVfs(data);
const read = (path: string[], cols = 80) => (vfs.at([...HOME, ...path]) as VfsFile).read(cols);
const run = (input: string) =>
  execute(input, initialShellState(HOME), { vfs, data, flavor: 'bash', os: 'linux', cols: 80, rows: 24, strict: true });

describe('LNX-FS-08 content depth in the tree', () => {
  it('~/notes holds a README and one file per deep dive; the tree stays collision-free', () => {
    expect(vfs.list([...HOME, 'notes']).map((node) => node.name)).toEqual([
      'README.md',
      'race-conditions-in-loan-approvals.md',
      'rotating-signing-keys.md',
      'why-we-built-our-own-idp.md',
    ]);
    expect(read(['notes', 'README.md']).join(' ')).toContain(
      'rotating-signing-keys.md — Rotating signing keys without logging anyone out (Enterprise SSO Identity Provider)',
    );
    expect(vfsProblems(vfs)).toEqual([]);
  });
  it('a deep dive reads as numbered text within the width; `open` pages it in less', () => {
    for (const cols of [80, 40]) {
      const lines = read(['notes', 'rotating-signing-keys.md'], cols);
      expect(lines.some((line) => line.startsWith('1. Publish the new public key'))).toBe(true);
      expect(Math.max(...lines.map((line) => line.length))).toBeLessThanOrEqual(cols);
    }
    expect(run('open notes/rotating-signing-keys.md').effects).toEqual([
      { k: 'pager', lines: expect.any(Array), title: '/home/jaswanth/notes/rotating-signing-keys.md' },
    ]);
  });
  it('a project file prints THE PROBLEM … RESULTS; a role file prints its scope', () => {
    const project = read(['projects', 'enterprise-sso.md']);
    for (const title of ['THE PROBLEM', 'MY ROLE', 'KEY DECISIONS', 'RESULTS', 'DEEP DIVES'])
      expect(project).toContain(title);
    expect(read(['experience', 'ibm.md']).join(' ')).toContain('Scope: Seven-person IBM squad');
  });
  it('.plan starts with the Now note, then what I am open to', () => {
    const plan = read(['.plan']);
    expect(plan[0]).toMatch(/^Building a clean-room OAuth\/OIDC provider in Go/);
    expect(plan.at(-1)).toBe(portfolio.person.openTo);
  });
});

describe('LNX-BOOT-08 MOTD "what I\'m working on" entry', () => {
  it('both builders carry the insertable entry, aligned, within 10 lines with a continuity line', () => {
    const login = motdLines(7, portfolio.person.openTo, true);
    const entry = login.find((line) => line.insert === 'cat .plan');
    expect(entry?.t).toMatch(/^ {2}\* what I'm working on +→ {2}cat \.plan$/);
    const arrows = new Set(login.filter((line) => line.insert).map((line) => line.t.indexOf('→')));
    expect(arrows.size).toBe(1);
    expect(login.length + 1).toBeLessThanOrEqual(10);
    expect(motdLines(7, portfolio.person.openTo).some((line) => line.insert === 'cat .plan')).toBe(false);
    // Only a trailing period is dropped from the openTo label, never another character.
    expect(motdLines(1, 'Open to work').find((line) => line.insert === 'contact')?.t).toContain('Open to work ');
    const etc = (vfs.at(['etc', 'motd']) as VfsFile).read(80);
    expect(etc.some((line) => /what I'm working on +→ {2}cat \.plan/.test(line))).toBe(true);
  });
});
