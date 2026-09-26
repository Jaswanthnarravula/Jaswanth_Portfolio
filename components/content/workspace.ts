/**
 * The VS Code workspace — plans/macos/apps/vscode.md "Portfolio mapping" (`MAC-CODE-02`, shared by `WIN-CODE-02`).
 * Skills and engineering depth as read-only files, every line generated from the data passed in (the selectors in the
 * apps, the fixture in tests) — nothing about the career is typed here:
 *   README.md          person summary, current role, selected work (links open the project files)
 *   skills.json        skill groups; skills with a published level / years carry an inlay hint ("4/5 · 6 yrs")
 *   stack.ts           the same groups as typed constants
 *   experience.log     roles as dated log lines, oldest first (unknown dates stay "-------", never guessed)
 *   projects/{slug}.md highlights, stack and source per project
 *   .env.example       contact channels as keys — public links, no secrets
 * Pure, hook-free and OS-agnostic: both editors (macOS, Windows) render the same files.
 */
import type { Contact, Experience, Person, Project, Skill, SkillGroup } from '@/data/schema';
import { formatYears, wrap } from './format';
import type { SyntaxLanguage } from './syntax';

export interface WorkspaceFile {
  /** Path inside the workspace, e.g. `['projects', 'portfolio-os.md']`. */
  readonly path: readonly string[];
  readonly name: string;
  readonly language: SyntaxLanguage;
  readonly text: string;
  /** Inlay hints by 0-based line — only facts the data publishes (a skill's level and years). */
  readonly hints?: Readonly<Record<number, string>>;
}

export interface WorkspaceData {
  readonly person: Person;
  readonly skills: readonly SkillGroup[];
  /** Newest first (as `getExperience` returns them); the log is written oldest first. */
  readonly experience: readonly Experience[];
  readonly projects: readonly Project[];
  readonly contact: Contact;
}

/** Prose is wrapped the way a formatter with `proseWrap: always` would leave it. */
const PROSE = 80;

const slugify = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** "jaswanth-portfolio": the workspace folder (Explorer header, command centre). */
export const workspaceName = (person: Pick<Person, 'givenName'>): string => `${slugify(person.givenName)}-portfolio`;

/** A file's stable key: its workspace path with `/` (breadcrumbs choose their own separator). */
export const fileKey = (file: Pick<WorkspaceFile, 'path'>): string => file.path.join('/');

/** "4/5 · 6 yrs" from what the data publishes, or null — ratings are never inferred (shared/02). */
export function skillHint(skill: Skill): string | null {
  const parts: string[] = [];
  if (skill.level) parts.push(`${skill.level}/5`);
  const years = formatYears(skill);
  if (years) parts.push(years);
  return parts.length ? parts.join(' · ') : null;
}

const paragraph = (text: string) => wrap(text, PROSE);
const item = (text: string) => {
  const [first = '', ...rest] = wrap(text, PROSE - 2);
  return [`- ${first}`, ...rest.map((line) => `  ${line}`)];
};
const hostOf = (url: string) => url.replace(/^[a-z]+:\/\//i, '').replace(/\/+$/, '');

function readme({ person, experience, projects }: WorkspaceData): string[] {
  const lines = [`# ${person.name}`, '', `**${person.role}** · ${person.location}`, '', `> ${person.headline}`];
  for (const text of person.summary) lines.push('', ...paragraph(text));
  const current = experience.filter((role) => role.end === 'present');
  if (current.length) {
    lines.push('', '## Now', '');
    for (const role of current) lines.push(...item(role.role ? `${role.role} at ${role.company}` : role.company));
  }
  const featured = projects.filter((project) => project.featured);
  const selected = featured.length ? featured : projects;
  if (selected.length) {
    lines.push('', '## Selected work', '');
    for (const project of selected) lines.push(`- [${project.name}](projects/${project.slug}.md) — ${project.tagline}`);
  }
  lines.push('', '## Open to', '', ...paragraph(person.openTo));
  return lines;
}

function skillsJson(groups: readonly SkillGroup[]): { lines: string[]; hints: Record<number, string> } {
  const hints: Record<number, string> = {};
  if (groups.length === 0) return { lines: ['{}'], hints };
  const lines = ['{'];
  groups.forEach((group, groupIndex) => {
    const comma = groupIndex < groups.length - 1 ? ',' : '';
    if (group.items.length === 0) {
      lines.push(`  ${JSON.stringify(group.label)}: []${comma}`);
      return;
    }
    lines.push(`  ${JSON.stringify(group.label)}: [`);
    group.items.forEach((skill, index) => {
      const hint = skillHint(skill);
      if (hint) hints[lines.length] = hint;
      lines.push(`    ${JSON.stringify(skill.name)}${index < group.items.length - 1 ? ',' : ''}`);
    });
    lines.push(`  ]${comma}`);
  });
  lines.push('}');
  return { lines, hints };
}

const RESERVED =
  /^(?:break|case|catch|class|const|continue|default|delete|do|else|enum|export|extends|false|for|function|if|import|in|new|null|return|super|switch|this|throw|true|try|typeof|var|void|while|with|let|static|yield|await|interface|type)$/;

/** A group id as a camelCase identifier (`cloud-tooling` → `cloudTooling`). */
function identifier(id: string, index: number, taken: Set<string>): string {
  const words = id.split(/[^A-Za-z0-9]+/).filter(Boolean);
  let name = words.map((word, i) => (i ? word[0]!.toUpperCase() + word.slice(1) : word.toLowerCase())).join('');
  if (!name || /^\d/.test(name) || RESERVED.test(name)) name = `group${index + 1}`;
  while (taken.has(name)) name += '_';
  taken.add(name);
  return name;
}

const tsString = (text: string) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

function stackTs(groups: readonly SkillGroup[]): string[] {
  const lines = ['// Generated from the skills data — read-only.'];
  const taken = new Set<string>();
  const names = groups.map((group, index) => identifier(group.id, index, taken));
  groups.forEach((group, index) => {
    lines.push('', `/** ${group.label.replace(/\*\//g, '* /')} */`);
    if (group.items.length === 0) lines.push(`export const ${names[index]} = [] as const;`);
    else
      lines.push(
        `export const ${names[index]} = [`,
        ...group.items.map((skill) => `  ${tsString(skill.name)},`),
        '] as const;',
      );
  });
  lines.push('', 'export const stack = {', ...names.map((name) => `  ${name},`), '} as const;');
  lines.push('', 'export type Skill = (typeof stack)[keyof typeof stack][number];');
  return lines;
}

const LEVEL = (level: string) => level.padEnd(5);
const stampOf = (date: string | null) => (date ?? '-------').padEnd(7);

function experienceLog(roles: readonly Experience[]): string[] {
  const lines: string[] = [];
  for (const role of [...roles].reverse()) {
    const start = stampOf(role.start);
    const tag = `[${role.slug}]`;
    const title = [
      role.role ? `${role.role} @ ${role.company}` : role.company,
      role.client ? `client ${role.client}` : null,
      role.location,
    ]
      .filter(Boolean)
      .join(' · ');
    lines.push(`${start} ${LEVEL('START')} ${tag} ${title}`, `${start} ${LEVEL('INFO')} ${tag} ${role.summary}`);
    for (const highlight of role.highlights) lines.push(`${start} ${LEVEL('SHIP')} ${tag} ${highlight}`);
    if (role.stack.length) lines.push(`${start} ${LEVEL('STACK')} ${tag} ${role.stack.join(', ')}`);
    if (role.end === 'present') lines.push(`${stampOf('present')} ${LEVEL('RUN')} ${tag} ongoing`);
    else if (role.end) lines.push(`${stampOf(role.end)} ${LEVEL('END')} ${tag} ${role.company}`);
  }
  return lines;
}

function projectMd(project: Project): string[] {
  const lines = [
    `# ${project.name}`,
    '',
    `> ${project.tagline}`,
    '',
    `**${project.context}**${project.year ? ` · ${project.year}` : ''}`,
  ];
  for (const text of project.description) lines.push('', ...paragraph(text));
  if (project.highlights.length) {
    lines.push('', '## Highlights', '');
    for (const highlight of project.highlights) lines.push(...item(highlight));
  }
  if (project.stack.length) lines.push('', '## Stack', '', ...project.stack.map((tool) => `- ${tool}`));
  const links = [
    project.repo ? `- Source: [${hostOf(project.repo)}](${project.repo})` : null,
    project.live ? `- Live: [${hostOf(project.live)}](${project.live})` : null,
  ].filter((line): line is string => line !== null);
  if (links.length) lines.push('', '## Links', '', ...links);
  else if (project.closedSource) lines.push('', '_Built in production; source is proprietary._');
  return lines;
}

const envValue = (value: string) => (/[\s#"'=]/.test(value) ? JSON.stringify(value) : value);

function envExample(contact: Contact): string[] {
  const lines = ['# Contact channels — public on purpose. There are no secrets in this file.', ''];
  lines.push(`CONTACT_EMAIL=${envValue(contact.email)}`);
  const taken = new Set<string>();
  for (const link of contact.links) {
    let key = `${link.kind.toUpperCase()}_URL`;
    for (let n = 2; taken.has(key); n++) key = `${link.kind.toUpperCase()}_URL_${n}`;
    taken.add(key);
    lines.push(`${key}=${envValue(link.url)}`);
  }
  return lines;
}

const file = (
  path: readonly string[],
  language: SyntaxLanguage,
  lines: readonly string[],
  hints?: Readonly<Record<number, string>>,
): WorkspaceFile => ({
  path,
  name: path[path.length - 1]!,
  language,
  text: lines.join('\n'),
  ...(hints && Object.keys(hints).length ? { hints } : {}),
});

/** The workspace's files, in the order the plan lists them (the Explorer sorts them as VS Code does). */
export function buildWorkspace(data: WorkspaceData): readonly WorkspaceFile[] {
  const skills = skillsJson(data.skills);
  return [
    file(['README.md'], 'markdown', readme(data)),
    file(['skills.json'], 'json', skills.lines, skills.hints),
    file(['stack.ts'], 'typescript', stackTs(data.skills)),
    file(['experience.log'], 'log', experienceLog(data.experience)),
    ...data.projects.map((project) => file(['projects', `${project.slug}.md`], 'markdown', projectMd(project))),
    file(['.env.example'], 'dotenv', envExample(data.contact)),
  ];
}
