/**
 * `renderText` — shared/03 `VIEW-TEXT-01`. Every view has a width-aware text form: the Linux filesystem, terminal
 * output and screen-reader summaries all come from here, so they state exactly the facts the GUI apps show.
 */
import type { Contact, Experience, Education, Project, SkillGroup } from '@/data/schema';
import type { AboutData } from './about';
import type { ContactData } from './contact';
import type { EducationData } from './experience';
import type { LegalData } from './legal';
import type { ProjectDetailData } from './projects';
import type { ResumeData } from './resume';
import { bullet, formatPeriod, resumeFileLabel, rule, wrap } from './format';

export type ViewId =
  | 'about'
  | 'project-list'
  | 'project-detail'
  | 'experience-list'
  | 'experience-detail'
  | 'education-list'
  | 'education-detail'
  | 'skills'
  | 'resume'
  | 'contact'
  | 'legal';

export interface TextViewData {
  readonly about: AboutData;
  readonly 'project-list': readonly Project[];
  readonly 'project-detail': ProjectDetailData;
  readonly 'experience-list': readonly Experience[];
  readonly 'experience-detail': Experience;
  readonly 'education-list': EducationData;
  readonly 'education-detail': Education;
  readonly skills: readonly SkillGroup[];
  readonly resume: ResumeData;
  readonly contact: ContactData;
  readonly legal: LegalData;
}

const blank = '';
const heading = (text: string, width: number) => [text.toUpperCase(), rule(Math.min(width, text.length + 4))];

function about({ person, featured, current }: AboutData, width: number): string[] {
  const lines = [
    person.name,
    ...wrap(person.headline, width),
    wrap(`${current?.role ? `${current.role} at ${current.company}` : person.role} · ${person.location}`, width).join(
      ' ',
    ),
    blank,
  ];
  for (const paragraph of person.summary) lines.push(...wrap(paragraph, width), blank);
  lines.push(...wrap(person.openTo, width));
  if (featured.length) {
    lines.push(blank, ...heading('Selected work', width));
    for (const project of featured) lines.push(...bullet(`${project.name} — ${project.tagline}`, width));
  }
  return lines;
}

function projectList(projects: readonly Project[], width: number): string[] {
  if (projects.length === 0) return ['No projects are listed yet.'];
  return projects.flatMap((project, index) => [
    ...(index ? [blank] : []),
    ...wrap(`${project.name} — ${project.tagline}`, width),
    ...wrap(`${project.context} · ${project.stack.slice(0, 6).join(', ')}`, width, '  '),
  ]);
}

function projectDetail({ project, github }: ProjectDetailData, width: number): string[] {
  const lines = [project.name, ...wrap(project.context, width), blank, ...wrap(project.tagline, width), blank];
  for (const paragraph of project.description) lines.push(...wrap(paragraph, width), blank);
  lines.push(...heading('Highlights', width));
  for (const item of project.highlights) lines.push(...bullet(item, width));
  lines.push(blank, ...heading('Stack', width), ...wrap(project.stack.join(', '), width));
  if (github)
    lines.push(blank, ...wrap(`GitHub: ${github.stars} ★${github.language ? ` · ${github.language}` : ''}`, width));
  if (project.repo) lines.push(blank, ...wrap(`Source: ${project.repo}`, width));
  if (project.live) lines.push(...wrap(`Live: ${project.live}`, width));
  if (project.closedSource && !project.repo)
    lines.push(blank, ...wrap('Built in production; source is proprietary.', width));
  return lines;
}

const roleTitle = (role: Experience) => [role.role, role.company].filter(Boolean).join(' — ');

function experienceList(roles: readonly Experience[], width: number): string[] {
  if (roles.length === 0) return ['No roles are listed yet.'];
  return roles.flatMap((role, index) => {
    const period = formatPeriod(role.start, role.end);
    return [
      ...(index ? [blank] : []),
      ...wrap(roleTitle(role) + (role.client ? ` (client: ${role.client})` : ''), width),
      ...(period ? [`  ${period}`] : []),
      ...wrap(role.summary, width, '  '),
    ];
  });
}

function experienceDetail(role: Experience, width: number): string[] {
  const period = formatPeriod(role.start, role.end);
  const meta = [period, role.location].filter(Boolean).join(' · ');
  const lines = [...wrap(roleTitle(role) + (role.client ? ` (client: ${role.client})` : ''), width)];
  if (meta) lines.push(meta);
  lines.push(blank, ...wrap(role.summary, width), blank);
  for (const item of role.highlights) lines.push(...bullet(item, width));
  lines.push(blank, ...wrap(`Stack: ${role.stack.join(', ')}`, width));
  return lines;
}

function educationList({ schools, credentials }: EducationData, width: number): string[] {
  const lines: string[] = schools.length ? [] : ['No education is listed yet.'];
  schools.forEach((school, index) => {
    const period = formatPeriod(school.start, school.end);
    lines.push(
      ...(index ? [blank] : []),
      ...wrap(school.degree, width),
      ...wrap(school.school, width, '  '),
      ...(period ? [`  ${period}`] : []),
    );
  });
  if (credentials.length) {
    lines.push(blank, ...heading('Credentials', width));
    for (const credential of credentials) lines.push(...bullet(`${credential.name} — ${credential.issuer}`, width));
  }
  return lines;
}

function educationDetail(school: Education, width: number): string[] {
  const period = formatPeriod(school.start, school.end);
  const lines = [...wrap(school.degree, width), ...wrap(school.school, width)];
  if (period) lines.push(period);
  if (school.notes.length) {
    lines.push(blank, ...heading('Coursework', width));
    for (const note of school.notes) lines.push(...bullet(note, width));
  }
  return lines;
}

function skills(groups: readonly SkillGroup[], width: number): string[] {
  return groups.flatMap((group, index) => [
    ...(index ? [blank] : []),
    ...heading(group.label, width),
    ...wrap(group.items.map((item) => item.name).join(', '), width),
  ]);
}

function resume({ resume: file, person, file: meta }: ResumeData, width: number): string[] {
  return [
    `${person.name} — Résumé`,
    ...wrap(
      `Updated ${file.updated}${meta ? ` · ${resumeFileLabel(meta)} · ${meta.pages} ${meta.pages === 1 ? 'page' : 'pages'}` : ''}`,
      width,
    ),
    blank,
    ...wrap(`Open: ${file.file}`, width),
  ];
}

function contactLines(contact: Contact): string[] {
  return [`Email     ${contact.email}`, ...contact.links.map((link) => `${link.label.padEnd(9)} ${link.url}`)];
}

function contactView({ contact, person }: ContactData, width: number): string[] {
  return [...wrap(person.openTo, width), blank, ...contactLines(contact).flatMap((line) => wrap(line, width))];
}

function legal(data: LegalData, width: number): string[] {
  const lines = wrap(
    'A personal, non-commercial portfolio. Not affiliated with, endorsed by or sponsored by any operating-system maker.',
    width,
  );
  if (data.assetMode === 'official')
    lines.push(
      blank,
      ...wrap(
        'App icons and marks belong to their owners and are used only to identify the apps they represent.',
        width,
      ),
    );
  lines.push(
    blank,
    ...wrap(`Original glyphs: ${data.glyphCredit}.`, width),
    blank,
    ...wrap(`Rights requests: ${data.contactEmail}`, width),
  );
  return lines;
}

const RENDERERS: { readonly [K in ViewId]: (data: TextViewData[K], width: number) => string[] } = {
  about,
  'project-list': projectList,
  'project-detail': projectDetail,
  'experience-list': experienceList,
  'experience-detail': experienceDetail,
  'education-list': educationList,
  'education-detail': educationDetail,
  skills,
  resume,
  contact: contactView,
  legal,
};

export function renderText<K extends ViewId>(view: K, data: TextViewData[K], width: number): readonly string[] {
  const safeWidth = Math.max(20, Math.floor(width));
  return RENDERERS[view](data, safeWidth).map((line) => line.replace(/\s+$/, ''));
}
