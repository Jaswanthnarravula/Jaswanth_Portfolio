/**
 * About-me shortcuts — linux/04. Convenience only: everything they print is also reachable with plain `cd`/`ls`/`cat`,
 * and every fact comes from `TerminalData` (the selectors), rendered width-aware.
 */
import { wrap, formatPeriod } from '@/components/content/format';
import { dim, err, line, padEnd, spansLine, table, width, type Cell } from '../format';
import type { Command, Line, Span } from '../types';
import { USER } from '../vfs';
import { fail, ok, parseArgs, readFile } from './args';

export const whoami: Command = (_args, ctx) => {
  const { person } = ctx.data;
  return ok([line(USER), ...wrap(`${person.name} — ${person.headline} · ${person.location}`, ctx.cols).map(dim)]);
};

export const about: Command = (_args, ctx) => {
  const read = readFile('about', '/home/jaswanth/about.txt', ctx);
  return read.ok ? ok(read.lines.map((value) => line(value))) : fail([read.line]);
};

/** The dim "try …" hints under a listing (insertable); one per line when the terminal is narrow. */
function footer(dir: string, placeholder: string, cols: number): Line[] {
  const cd: Span = { t: `cd ${dir} && ls`, cls: 'dim', insert: `cd ~/${dir} && ls` };
  const open: Span = { t: `open ${dir}/${placeholder}`, cls: 'dim', insert: `open ~/${dir}/` };
  if (cols < 50) return [spansLine([{ t: 'try  ', cls: 'dim' }, cd]), spansLine([{ t: '     ', cls: 'dim' }, open])];
  return [spansLine([{ t: 'try  ', cls: 'dim' }, cd, { t: '  ·  ', cls: 'dim' }, open])];
}

export const projects: Command = (args, ctx) => {
  const parsed = parseArgs('projects', args, { long: ['--all'] });
  if (!parsed.ok) return parsed.result;
  const { projects: list, githubFor, moreOnGithub } = ctx.data;
  if (list.length === 0) return ok([dim('No projects are listed yet.')]);
  const rows: Cell[][] = list.map((project) => [
    { text: project.slug, cls: 'dir', insert: `open ~/projects/${project.slug}.md` },
    { text: project.name },
    { text: project.stack.join(', ') },
    { text: project.year ? String(project.year) : '—' },
  ]);
  const nameWidth = Math.max(12, Math.min(30, Math.floor(ctx.cols * 0.3)));
  const stackWidth = Math.max(10, ctx.cols - 2 - Math.max(...list.map((p) => width(p.slug))) - 2 - nameWidth - 2 - 6);
  const lines = table(['SLUG', 'NAME', 'STACK', 'YEAR'], rows, ctx.cols, [null, nameWidth, stackWidth, null]);
  if (parsed.args.long.has('--all') && moreOnGithub.length) {
    lines.push(line(''), line('More on GitHub', 'head'));
    for (const repo of moreOnGithub)
      lines.push(
        spansLine([
          { t: padEnd(repo.name, 24) },
          { t: `★ ${repo.stars}`, cls: 'dim' },
          { t: `  ${repo.url}`, href: repo.url },
        ]),
      );
  }
  const withStats = list.filter((project) => githubFor(project)).length;
  if (withStats) lines.push(dim(`${withStats} with live GitHub stats — open one to see them`));
  lines.push(line(''), ...footer('projects', '<slug>', ctx.cols));
  return ok(lines);
};

export const experience: Command = (_args, ctx) => {
  const roles = ctx.data.experience;
  if (roles.length === 0) return ok([dim('No roles are listed yet.')]);
  const periods = roles.map((role) => formatPeriod(role.start, role.end) ?? '—');
  const lines: Line[] = [];
  if (ctx.cols < 50) {
    roles.forEach((role, index) => {
      if (index) lines.push(line(''));
      lines.push(dim(periods[index]!));
      const title = role.role ? `${role.role} @ ${role.company}` : role.company;
      lines.push(
        spansLine([
          { t: title + (role.client ? ` (client: ${role.client})` : ''), insert: `open ~/experience/${role.slug}.md` },
        ]),
      );
      for (const text of wrap(role.summary, ctx.cols)) lines.push(line(text));
    });
  } else {
    const dateWidth = Math.max(...periods.map((period) => width(period))) + 2;
    roles.forEach((role, index) => {
      const title = role.role ? `${role.role} @ ${role.company}` : role.company;
      lines.push(
        spansLine([
          { t: padEnd(periods[index]!, dateWidth), cls: 'dim' },
          {
            t: title + (role.client ? ` (client: ${role.client})` : ''),
            cls: 'head',
            insert: `open ~/experience/${role.slug}.md`,
          },
        ]),
      );
      for (const text of wrap(role.summary, ctx.cols - dateWidth)) lines.push(line(' '.repeat(dateWidth) + text));
    });
  }
  lines.push(line(''), ...footer('experience', '<slug>', ctx.cols));
  return ok(lines);
};

export const education: Command = (_args, ctx) => {
  const { education: schools, credentials } = ctx.data;
  if (schools.length === 0) return ok([dim('No education is listed yet.')]);
  const lines: Line[] = [];
  for (const school of schools) {
    const period = formatPeriod(school.start, school.end);
    const spans: Span[] = [
      { t: school.school, cls: 'head', insert: `open ~/education/${school.slug}.md` },
      { t: ` · ${school.degree}` },
    ];
    if (period) spans.push({ t: ` · ${period}`, cls: 'dim' });
    const plain = spans.map((span) => span.t).join('');
    if (width(plain) <= ctx.cols) lines.push(spansLine(spans));
    else lines.push(...wrap(plain, ctx.cols).map((text) => line(text)));
  }
  if (credentials.length) {
    lines.push(line(''), line('Credentials', 'head'));
    for (const credential of credentials)
      lines.push(...wrap(`${credential.name} — ${credential.issuer}`, ctx.cols, '  ').map((t) => line(t)));
  }
  return ok(lines);
};

/** `█████░` for a published 1–5 level; nothing when no level is published (never inferred). */
const bar = (level: number) => `${'█'.repeat(level)}${'░'.repeat(5 - level)}`;

export const skills: Command = (args, ctx) => {
  const query = args.join(' ').trim().toLowerCase();
  const groups = ctx.data.skills.filter(
    (group) => !query || group.id.toLowerCase() === query || group.label.toLowerCase().startsWith(query),
  );
  if (groups.length === 0)
    return fail([
      err(`skills: no group matches '${query}'`),
      dim(`groups: ${ctx.data.skills.map((group) => group.id).join(', ')}`),
    ]);
  const lines: Line[] = [];
  groups.forEach((group, index) => {
    if (index) lines.push(line(''));
    lines.push(
      spansLine([
        { t: group.label, cls: 'head' },
        { t: `  (skills ${group.id})`, cls: 'dim', insert: `skills ${group.id}` },
      ]),
    );
    const rated = group.items.some((item) => item.level !== undefined || item.years !== undefined);
    if (rated) {
      const widest = Math.max(...group.items.map((item) => width(item.name)));
      for (const item of group.items)
        lines.push(
          spansLine([
            { t: `  ${padEnd(item.name, widest)}  ` },
            ...(item.level !== undefined ? [{ t: bar(item.level), cls: 'ok' as const }] : []),
            ...(item.years !== undefined ? [{ t: ` ${item.years} yrs`, cls: 'dim' as const }] : []),
          ]),
        );
    } else
      for (const text of wrap(group.items.map((item) => item.name).join(', '), ctx.cols, '  ')) lines.push(line(text));
  });
  return ok(lines);
};

export const contact: Command = (_args, ctx) => {
  const { contact: channels, person } = ctx.data;
  const rows: { label: string; value: string; href: string }[] = [
    { label: 'Email', value: channels.email, href: `mailto:${channels.email}` },
    ...channels.links.map((link) => ({
      label: link.label,
      value: link.url.replace(/^https?:\/\//, ''),
      href: link.url,
    })),
  ];
  const widest = Math.max(...rows.map((row) => width(row.label)));
  const lines: Line[] = wrap(person.openTo, ctx.cols).map((text) => line(text));
  lines.push(line(''));
  for (const row of rows)
    lines.push(
      spansLine([
        { t: `${padEnd(row.label, widest)}  `, cls: 'dim' },
        { t: row.value, href: row.href },
      ]),
    );
  lines.push(
    line(''),
    spansLine([
      { t: 'mail', insert: 'mail' },
      { t: '  writes to me in your own mail app', cls: 'dim' },
    ]),
  );
  return ok(lines);
};

export const resume: Command = (args, ctx) => {
  const parsed = parseArgs('resume', args, { long: ['--download'] });
  if (!parsed.ok) return parsed.result;
  if (parsed.args.long.has('--download'))
    return ok([line(`saved: ${ctx.data.resume.downloadName}`, 'ok')], [{ k: 'download' }]);
  return ok([dim('Opening resume.pdf…')], [{ k: 'open', ref: 'resume' }]);
};

export const mail: Command = (args, ctx) => {
  const parsed = parseArgs('mail', args, { valued: 's' });
  if (!parsed.ok) return parsed.result;
  const subject = parsed.args.values.get('s');
  return ok(
    [
      dim('Handing off to your mail client…'),
      spansLine([{ t: ctx.data.contact.email, href: `mailto:${ctx.data.contact.email}` }]),
    ],
    [subject ? { k: 'mailto', subject } : { k: 'mailto' }],
  );
};
