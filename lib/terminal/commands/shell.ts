/**
 * System commands — linux/04: `help` and `man` are generated from the command table (`LNX-CMD-help`, `LNX-CMD-man`);
 * `which`, `type` and `alias` read the same table and the aliases loaded from `~/.bashrc` (`LNX-FS-05`).
 */
import { wrap } from '@/components/content/format';
import { voice } from '../flavor';
import { dim, err, line, padEnd, padStart, spansLine } from '../format';
import { MAN_PAGES } from '../man-pages';
import { COMMANDS, GROUP_TITLES, commandMeta, type CommandGroup } from '../manifest';
import type { Command, Line } from '../types';
import { fail, ok, parseArgs, usage } from './args';

const GROUP_ORDER: readonly CommandGroup[] = ['explore', 'about', 'files', 'system'];

export const help: Command = (args, { cols }) => {
  const topic = args.find((arg) => !arg.startsWith('-'));
  if (topic !== undefined) {
    const meta = commandMeta(topic);
    if (!meta) return fail([err(`help: no help topics match '${topic}'`)]);
    return ok([line(`${meta.name} — ${meta.summary}`), line(`Usage: ${meta.synopsis}`), dim(`More: man ${meta.name}`)]);
  }
  const visible = COMMANDS.filter((meta) => !meta.hidden);
  const widest = Math.max(...visible.map((meta) => meta.name.length));
  const lines: Line[] = [];
  for (const group of GROUP_ORDER) {
    const members = visible.filter((meta) => meta.group === group);
    if (!members.length) continue;
    if (lines.length) lines.push(line(''));
    lines.push(line(GROUP_TITLES[group], 'head'));
    for (const meta of members) {
      // The summary wraps under itself when the terminal is narrow (a hanging indent past the name column).
      const indent = 2 + widest + 2;
      const [first = '', ...rest] = wrap(meta.summary, Math.max(12, cols - indent));
      lines.push(spansLine([{ t: '  ' }, { t: padEnd(meta.name, widest), insert: meta.name }, { t: `  ${first}` }]));
      for (const more of rest) lines.push(line(' '.repeat(indent) + more));
    }
  }
  lines.push(
    line(''),
    ...wrap('Tab completes · ↑ recalls · Esc then Tab leaves the terminal.', cols).map(dim),
    dim("Some commands aren't listed."),
  );
  return ok(lines);
};

/** The manual page for any command in the table. */
export function manPage(name: string): Line[] | null {
  const meta = commandMeta(name);
  if (!meta) return null;
  const page = MAN_PAGES[name];
  const lines: Line[] = [
    line('NAME', 'head'),
    line(`       ${meta.name} — ${meta.summary}`),
    line(''),
    line('SYNOPSIS', 'head'),
    line(`       ${meta.synopsis}`),
    line(''),
    line('DESCRIPTION', 'head'),
    line(`       ${page?.description ?? `${meta.summary[0]!.toUpperCase()}${meta.summary.slice(1)}.`}`),
  ];
  if (page?.examples.length) {
    lines.push(line(''), line('EXAMPLES', 'head'));
    for (const example of page.examples) lines.push(line(`       ${example}`));
  }
  return lines;
}

export const man: Command = (args, ctx) => {
  const parsed = parseArgs('man', args);
  if (!parsed.ok) return parsed.result;
  const name = parsed.args.operands[0];
  if (name === undefined) return fail([err('What manual page do you want?'), dim("For example, try 'man ls'.")]);
  const page = manPage(name);
  if (!page) return fail([err(`No manual entry for ${name}`)], 16);
  if (ctx.piped) return ok(page);
  return ok([], [{ k: 'pager', lines: page, title: `${name}(1)` }]);
};

export const history: Command = (args, ctx) => {
  const parsed = parseArgs('history', args, { flags: 'c' });
  if (!parsed.ok) return parsed.result;
  if (parsed.args.flags.has('c')) return ok([], [{ k: 'history-clear' }]);
  const limitText = parsed.args.operands[0];
  if (limitText !== undefined && !/^\d+$/.test(limitText))
    return usage('history', `${limitText}: numeric argument required`);
  const start = limitText === undefined ? 0 : Math.max(0, ctx.history.length - Number(limitText));
  return ok(
    ctx.history
      .slice(start)
      .map((entry, index) =>
        spansLine([{ t: `${padStart(String(start + index + 1), 5)}  ` }, { t: entry, insert: entry }]),
      ),
  );
};

export const clear: Command = () => ok([], [{ k: 'clear' }]);

export const which: Command = (args, ctx) => {
  const names = args.filter((arg) => !arg.startsWith('-'));
  if (names.length === 0) return fail([], 1);
  const lines: Line[] = [];
  let code = 0;
  for (const name of names) {
    const alias = ctx.aliases.get(name);
    if (alias !== undefined) lines.push(line(`alias ${name}='${alias}'`));
    else if (commandMeta(name) && !commandMeta(name)!.builtin) lines.push(line(`/usr/bin/${name}`));
    else if (commandMeta(name)?.builtin) lines.push(line(`${name}: shell built-in command`));
    else code = 1; // silent, like `which`
  }
  return { lines, exitCode: code, effects: [] };
};

export const type: Command = (args, ctx) => {
  const shell = voice(ctx.flavor);
  const names = args.filter((arg) => !arg.startsWith('-'));
  if (names.length === 0) return ok();
  const lines: Line[] = [];
  let code = 0;
  for (const name of names) {
    const alias = ctx.aliases.get(name);
    const meta = commandMeta(name);
    if (alias !== undefined) lines.push(line(`${name} is aliased to '${alias}'`));
    else if (meta?.builtin) lines.push(line(`${name} is a shell builtin`));
    else if (meta) lines.push(line(`${name} is /usr/bin/${name}`));
    else {
      lines.push(err(shell.typeNotFound(name)));
      code = 1;
    }
  }
  return { lines, exitCode: code, effects: [] };
};

export const alias: Command = (args, ctx) => {
  const shell = voice(ctx.flavor);
  if (args.length === 0) return ok([...ctx.aliases].map(([name, value]) => line(`alias ${name}='${value}'`)));
  const lines: Line[] = [];
  let code = 0;
  for (const arg of args) {
    if (arg.includes('=')) {
      lines.push(err(`alias: ~/.bashrc is on a read-only file system — '${arg.split('=')[0]}' was not saved`));
      code = 1;
      continue;
    }
    const value = ctx.aliases.get(arg);
    if (value === undefined) {
      lines.push(err(shell.aliasNotFound(arg)));
      code = 1;
    } else lines.push(line(`alias ${arg}='${value}'`));
  }
  return { lines, exitCode: code, effects: [] };
};

export const exit: Command = () => ok([], [{ k: 'exit' }]);
