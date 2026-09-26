/**
 * MAC-CODE-02 / WIN-CODE-02 (shared) — the VS Code workspace is generated from data (plans/macos/apps/vscode.md
 * "Portfolio mapping"): text snapshots of every file from the deterministic fixture, the facts each file must carry,
 * `.env.example` holding contact channels and nothing secret, inlay hints only for published levels / years, and
 * empty data producing honest, valid files.
 */
import { describe, expect, it } from 'vitest';
import { buildWorkspace, fileKey, skillHint, workspaceName, type WorkspaceData } from '@/components/content/workspace';
import { fixturePortfolio as p } from '../../fixtures/portfolio';

const data: WorkspaceData = {
  person: p.person,
  skills: p.skills,
  experience: p.experience,
  projects: p.projects,
  contact: p.contact,
};
const files = buildWorkspace(data);
const text = (key: string) => {
  const file = files.find((candidate) => fileKey(candidate) === key);
  if (!file) throw new Error(`no ${key}`);
  return file.text;
};

describe('MAC-CODE-02 / WIN-CODE-02 generated files', () => {
  it('lists every planned file, with its language', () => {
    expect(files.map((file) => [fileKey(file), file.language])).toEqual([
      ['README.md', 'markdown'],
      ['skills.json', 'json'],
      ['stack.ts', 'typescript'],
      ['experience.log', 'log'],
      ['projects/portfolio-os.md', 'markdown'],
      ['projects/rocket.md', 'markdown'],
      ['.env.example', 'dotenv'],
    ]);
    expect(files.every((file) => file.name === file.path[file.path.length - 1])).toBe(true);
    expect(workspaceName(p.person)).toBe('ada-portfolio');
  });

  it('README.md: the person, current role, selected work linking to the project files', () => {
    expect(text('README.md')).toMatchInlineSnapshot(`
      "# Ada Example

      **Engineer** · Testville

      > Engineer of examples

      Builds fixtures.

      Second paragraph.

      ## Now

      - Engineer at Acme

      ## Selected work

      - [Portfolio OS](projects/portfolio-os.md) — Five operating systems.

      ## Open to

      Open to tests."
    `);
    expect(text('README.md')).toContain(p.person.headline);
    for (const paragraph of p.person.summary) expect(text('README.md')).toContain(paragraph);
  });

  it('skills.json: valid JSON equal to the skill groups', () => {
    expect(text('skills.json')).toMatchInlineSnapshot(`
      "{
        "Languages": [
          "Go",
          "TypeScript"
        ]
      }"
    `);
    expect(JSON.parse(text('skills.json'))).toEqual(
      Object.fromEntries(p.skills.map((group) => [group.label, group.items.map((item) => item.name)])),
    );
  });

  it('stack.ts: the groups as typed constants', () => {
    expect(text('stack.ts')).toMatchInlineSnapshot(`
      "// Generated from the skills data — read-only.

      /** Languages */
      export const langs = [
        'Go',
        'TypeScript',
      ] as const;

      export const stack = {
        langs,
      } as const;

      export type Skill = (typeof stack)[keyof typeof stack][number];"
    `);
  });

  it('experience.log: roles as dated lines, oldest first; the current role runs', () => {
    expect(text('experience.log')).toMatchInlineSnapshot(`
      "2020-06 START [globex] Intern @ Globex · Springfield
      2020-06 INFO  [globex] Learned things.
      2020-06 SHIP  [globex] Learned
      2020-06 STACK [globex] Java
      2021-08 END   [globex] Globex
      2022-01 START [acme] Engineer @ Acme · Remote
      2022-01 INFO  [acme] Builds rockets.
      2022-01 SHIP  [acme] Launched things
      2022-01 STACK [acme] Go
      present RUN   [acme] ongoing"
    `);
    const lines = text('experience.log').split('\n');
    expect(lines.findIndex((line) => line.includes('[globex]'))).toBeLessThan(
      lines.findIndex((line) => line.includes('[acme]')),
    );
    expect(lines).toContain('present RUN   [acme] ongoing');
    expect(lines).toContain('2021-08 END   [globex] Globex');
  });

  it('projects/{slug}.md: context, description, highlights, stack and source', () => {
    expect(text('projects/portfolio-os.md')).toMatchInlineSnapshot(`
      "# Portfolio OS

      > Five operating systems.

      **Personal** · 2026

      A site.

      ## Highlights

      - Kernel

      ## Stack

      - TypeScript

      ## Links

      - Source: [github.com/ada/portfolio-os](https://github.com/ada/portfolio-os)"
    `);
    expect(text('projects/rocket.md')).not.toContain('## Links');
  });

  it('.env.example: contact channels as keys, public values, no secrets', () => {
    expect(text('.env.example')).toMatchInlineSnapshot(`
      "# Contact channels — public on purpose. There are no secrets in this file.

      CONTACT_EMAIL=ada@example.com
      GITHUB_URL=https://github.com/ada"
    `);
    const pairs = text('.env.example')
      .split('\n')
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split('=') as [string, string]);
    expect(pairs.map(([key]) => key)).toEqual(['CONTACT_EMAIL', 'GITHUB_URL']);
    expect(pairs.map(([, value]) => value)).toEqual([p.contact.email, p.contact.links[0]!.url]);
    for (const [key] of pairs) expect(key).not.toMatch(/SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|API_?KEY|CREDENTIAL/i);
  });

  it('nothing is invented: no skill hints unless the data publishes a level or years', () => {
    expect(files.some((file) => file.hints)).toBe(false);
    const rated = buildWorkspace({
      ...data,
      skills: [
        {
          id: 'langs',
          label: 'Languages',
          items: [{ name: 'Go', level: 4, years: 6 }, { name: 'TypeScript' }, { name: 'SQL', years: 1 }],
        },
      ],
    });
    const skills = rated.find((file) => fileKey(file) === 'skills.json')!;
    const lines = skills.text.split('\n');
    expect(skills.hints).toEqual({ 2: '4/5 · 6+ yrs', 4: '1+ yr' });
    expect(lines[2]).toContain('"Go"');
    expect(lines[4]).toContain('"SQL"');
    expect(skillHint({ name: 'Bash' })).toBeNull();
    expect(skillHint({ name: 'Go', level: 3 })).toBe('3/5');
  });

  it('empty data: valid, honest files and no project files', () => {
    const empty = buildWorkspace({
      ...data,
      skills: [],
      experience: [],
      projects: [],
      contact: { email: p.contact.email, links: [] },
    });
    expect(empty.map(fileKey)).toEqual(['README.md', 'skills.json', 'stack.ts', 'experience.log', '.env.example']);
    expect(JSON.parse(empty.find((file) => fileKey(file) === 'skills.json')!.text)).toEqual({});
    expect(empty.find((file) => fileKey(file) === 'experience.log')!.text).toBe('');
  });

  it('unknown dates stay unknown in the log (never guessed)', () => {
    const log = buildWorkspace({
      ...data,
      experience: [{ ...p.experience[0]!, start: null, end: null, role: null, location: null }],
    }).find((file) => fileKey(file) === 'experience.log')!.text;
    expect(log.split('\n')[0]).toBe('------- START [acme] Acme');
    expect(log).not.toMatch(/\bEND\b|\bRUN\b/);
  });
});
