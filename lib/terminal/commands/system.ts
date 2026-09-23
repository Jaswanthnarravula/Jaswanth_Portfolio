/** Linux system commands (plans/linux/04, P7). Pure command functions: hosts perform returned effects. */
import { wrap } from '@/components/content/format';
import type { OsId } from '@/lib/kernel/ids';
import { dim, err, line, spansLine } from '../format';
import type { Command, Result } from '../types';
import { fail, ok } from './args';

const pref = (key: string, value: unknown, message: string): Result =>
  ok([line(message, 'ok')], [{ k: 'pref', key, value }]);

const choices = (command: string, value: string | undefined, allowed: readonly string[]): string | Result => {
  if (value && allowed.includes(value)) return value;
  return fail([err(`${command}: expected ${allowed.join('|')}`), dim(`Usage: ${command} ${allowed.join('|')}`)], 2);
};

export const theme: Command = (args) => {
  const value = choices('theme', args[0], ['dark', 'light', 'system']);
  return typeof value === 'string' ? pref('theme', value, `theme: ${value}`) : value;
};

export const motion: Command = (args) => {
  const value = choices('motion', args[0], ['full', 'reduced', 'system']);
  return typeof value === 'string' ? pref('motion', value, `motion: ${value}`) : value;
};

export const sound: Command = (args) => {
  const value = choices('sound', args[0], ['on', 'off']);
  return typeof value === 'string' ? pref('sound', value, `sound: ${value}`) : value;
};

export const hints: Command = (args) => {
  const value = choices('hints', args[0] ?? 'status', ['on', 'off', 'status']);
  return typeof value === 'string' ? (value === 'status' ? ok() : pref('hints', value, `hints: ${value}`)) : value;
};

export const settings: Command = (args) => {
  if (args.length === 0 || args[0] === 'list')
    return ok([
      line('Terminal settings', 'head'),
      line('  theme     dark | light | system'),
      line('  motion    full | reduced | system'),
      line('  glass     full | solid | system'),
      line('  sound     on | off'),
      line('  hints     on | off'),
      line('  textsize  100-130'),
      dim('Use: settings set <key> <value>'),
    ]);
  if (args[0] !== 'set' || !args[1] || !args[2])
    return fail([err('settings: usage: settings [list | set <key> <value>]')], 2);
  const [key, value] = args.slice(1);
  if (key === 'theme') return theme([value!], {} as never);
  if (key === 'motion') return motion([value!], {} as never);
  if (key === 'glass' && ['full', 'solid', 'system'].includes(value!)) return pref('glass', value, `glass: ${value}`);
  if (key === 'sound') return sound([value!], {} as never);
  if (key === 'hints') return hints([value!], {} as never);
  if (key === 'textsize') {
    const amount = Number(value);
    if (Number.isInteger(amount) && amount >= 100 && amount <= 130)
      return pref('textScale', amount / 100, `textsize: ${amount}%`);
  }
  return fail([err(`settings: unknown or invalid setting '${key}'`), dim("Try 'settings list'.")], 2);
};

function pathFor(ref: { section: string; slug?: string }): string {
  if (ref.section === 'resume') return 'resume.pdf';
  if (ref.slug) return `${ref.section}/${ref.slug}.md`;
  if (ref.section === 'about' || ref.section === 'skills' || ref.section === 'contact') return `${ref.section}.txt`;
  return ref.section;
}

export const search: Command = (args, ctx) => {
  const query = args.join(' ').trim().toLocaleLowerCase();
  if (!query) return fail([err('search: missing query'), dim('Usage: search <query>')], 2);
  const entries: { title: string; path: string; insert: string; text: string }[] = [];
  const add = (title: string, path: string, insert: string, haystack: string) => {
    if (haystack.toLocaleLowerCase().includes(query)) entries.push({ title, path, insert, text: haystack });
  };
  add(ctx.data.person.name, 'about.txt', 'cat about.txt', `${ctx.data.person.name} ${ctx.data.person.headline}`);
  for (const project of ctx.data.projects)
    add(
      project.name,
      pathFor({ section: 'projects', slug: project.slug }),
      `open projects/${project.slug}`,
      `${project.name} ${project.tagline} ${project.stack.join(' ')}`,
    );
  for (const role of ctx.data.experience)
    add(
      role.role ?? role.company,
      pathFor({ section: 'experience', slug: role.slug }),
      `open experience/${role.slug}`,
      `${role.role ?? ''} ${role.company} ${role.summary} ${role.stack.join(' ')}`,
    );
  for (const school of ctx.data.education)
    add(
      school.school,
      pathFor({ section: 'education', slug: school.slug }),
      `open education/${school.slug}`,
      `${school.school} ${school.degree}`,
    );
  for (const group of ctx.data.skills)
    for (const skill of group.items)
      add(skill.name, 'skills.txt', `skills ${group.id}`, `${skill.name} ${group.label}`);
  const matches = entries.slice(0, 20);
  if (!matches.length) return fail([err(`search: nothing found for '${args.join(' ')}'`), dim("Try 'ls' or 'help'.")]);
  return ok(
    matches.map((entry, index) =>
      spansLine([
        { t: `${String(index + 1).padStart(2)}  `, cls: 'dim' },
        { t: entry.path.padEnd(Math.min(34, Math.max(16, ctx.cols - 24))), cls: 'link', insert: entry.insert },
        { t: `  ${entry.title}` },
      ]),
    ),
  );
};

export const switchCommand: Command = (args) => {
  const target = args[0];
  if (!target)
    return ok([
      dim('Choose an operating system:'),
      ...['macos', 'windows', 'ios', 'android', 'linux', 'chooser'].map((os) =>
        spansLine([{ t: `  switch ${os}`, insert: `switch ${os}` }]),
      ),
    ]);
  if (target === 'chooser') return ok([dim('logout'), dim('Connection to portfolio closed.')], [{ k: 'switch-os' }]);
  if (!['macos', 'windows', 'ios', 'android', 'linux'].includes(target))
    return fail([err(`switch: unknown operating system '${target}'`)], 2);
  return ok([dim(`switching to ${target}…`)], [{ k: 'switch-os', to: target as OsId }]);
};

export const tour: Command = () =>
  ok([dim('Tour ready. Each suggestion waits for you to press Enter.')], [{ k: 'tour' }]);

export const legal: Command = (_args, ctx) => {
  const lines = [
    line('LEGAL', 'head'),
    line(''),
    ...wrap(
      'Portfolio content is provided for professional review. Product names and marks belong to their respective owners.',
      ctx.cols,
    ).map((text) => line(text)),
    line(''),
    ...wrap(
      'This site uses no account system and sends contact through your own mail client. Read the complete notice at /plain.',
      ctx.cols,
    ).map((text) => line(text)),
  ];
  return ok([], [{ k: 'pager', lines, title: 'legal' }]);
};

export const plain: Command = () => ok([dim('Opening /plain…')], [{ k: 'plain' }]);

export const date: Command = (_args, ctx) => ok([line(new Date(`${ctx.data.resume.updated}T09:41:00Z`).toUTCString())]);
export const uname: Command = (args, ctx) =>
  ok([line(args.includes('-a') ? `PortfolioOS portfolio ${ctx.data.contentRev} #1 GNU/Linux` : 'PortfolioOS')]);
export const hostname: Command = () => ok([line('portfolio')]);

const yearOf = (value: string | null): number | null => (value ? Number(value.slice(0, 4)) : null);
export const uptime: Command = (_args, ctx) => {
  const years = ctx.data.experience
    .map((role) => yearOf(role.start))
    .filter((value): value is number => value !== null);
  const first = years.length ? Math.min(...years) : Number(ctx.data.resume.updated.slice(0, 4));
  const current = Number(ctx.data.resume.updated.slice(0, 4));
  return ok([line(`up ${Math.max(0, current - first)} years, 1 user`)]);
};
export const id: Command = () => ok([line('uid=1000(jaswanth) gid=1000(jaswanth) groups=1000(jaswanth),27(sudo)')]);
export const finger: Command = (_args, ctx) =>
  ok([
    line(`Login: jaswanth\t\tName: ${ctx.data.person.name}`),
    line(`Directory: /home/jaswanth\tShell: /bin/bash`),
    line(`Plan:`),
    ...wrap(ctx.data.person.openTo, ctx.cols).map((text) => line(`  ${text}`)),
  ]);
