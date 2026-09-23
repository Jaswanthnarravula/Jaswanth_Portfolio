/**
 * Navigation and file commands — linux/04 "Navigation and files". Pure functions over the VFS; output respects
 * `ctx.cols`; errors are the exact POSIX-style strings; nothing writes (the filesystem is read-only).
 */
import { refSlug, type ContentRef } from '@/data/schema';
import { voice } from '../flavor';
import {
  columns,
  dim,
  err,
  humanSize,
  line,
  lsDate,
  modeString,
  padStart,
  spansLine,
  utf8Length,
  type Cell,
} from '../format';
import type { Command, Ctx, Line, Result, Span, VfsNode, VfsPath } from '../types';
import { absolutePath, HOME, isPrivate, stem, USER } from '../vfs';
import { classOf, fail, inputOf, insertFor, ok, parseArgs, readFile, text, usage } from './args';

const reasonText = (reason: 'ENOENT' | 'ENOTDIR' | 'EACCES') =>
  reason === 'ENOENT' ? 'No such file or directory' : reason === 'ENOTDIR' ? 'Not a directory' : 'Permission denied';

// --- pwd / cd -------------------------------------------------------------------------------------------------------

export const pwd: Command = (args, ctx) => {
  const parsed = parseArgs('pwd', args, { flags: 'LP' });
  if (!parsed.ok) return parsed.result;
  return ok([line(voice(ctx.flavor).path(ctx.cwd))]);
};

export const cd: Command = (args, ctx) => {
  const shell = voice(ctx.flavor);
  const parsed = parseArgs('cd', args, { flags: 'LP' });
  if (!parsed.ok) return parsed.result;
  const operands = parsed.args.operands;
  if (operands.length > 1) return fail([err(shell.cd(operands[1]!, 'ARGS'))]);
  let target = operands[0] ?? '~';
  let announce = false;
  if (target === '-') {
    const previous = ctx.env.OLDPWD;
    if (!previous) return fail([err(shell.cd('-', 'OLDPWD'))]);
    target = previous;
    announce = true;
  }
  const resolved = ctx.vfs.resolve(ctx.cwd, target);
  if (!resolved.ok) return fail([err(shell.cd(operands[0] ?? target, resolved.reason))]);
  if (resolved.node.kind !== 'dir') return fail([err(shell.cd(operands[0] ?? target, 'ENOTDIR'))]);
  if (isPrivate(resolved.node)) return fail([err(shell.cd(operands[0] ?? target, 'EACCES'))]);
  return ok(announce ? [line(shell.path(resolved.path))] : [], [{ k: 'cd', to: resolved.path }]);
};

// --- ls ---------------------------------------------------------------------------------------------------------------

interface Entry {
  readonly name: string;
  readonly node: VfsNode;
  /** The path to insert (`projects/x.md` when listing `projects`). */
  readonly shown: string;
}

function entriesOf(path: VfsPath, prefix: string, ctx: Ctx, all: boolean, almost: boolean): Entry[] {
  const node = ctx.vfs.at(path);
  if (!node || node.kind !== 'dir') return [];
  const join = (name: string) => (prefix ? `${prefix.replace(/\/$/, '')}/${name}` : name);
  const children = node.children
    .filter((child) => all || almost || !child.name.startsWith('.'))
    .map((child) => ({ name: child.name, node: child, shown: join(child.name) }));
  if (!all) return children;
  const parent = ctx.vfs.at(path.slice(0, -1)) ?? node;
  return [{ name: '.', node, shown: join('.') }, { name: '..', node: parent, shown: join('..') }, ...children];
}

function longRows(entries: readonly Entry[], human: boolean, classify: boolean): Line[] {
  const sizeOf = (node: VfsNode) => (node.kind === 'dir' ? 4096 : node.size);
  const links = (node: VfsNode) => (node.kind === 'dir' ? 2 + node.children.filter((c) => c.kind === 'dir').length : 1);
  const rows = entries.map((entry) => ({
    mode: modeString(entry.node.kind, entry.node.mode),
    links: String(links(entry.node)),
    size: human ? humanSize(sizeOf(entry.node)) : String(sizeOf(entry.node)),
    date: lsDate(entry.node.mtime),
    entry,
  }));
  const linkWidth = Math.max(1, ...rows.map((row) => row.links.length));
  const sizeWidth = Math.max(1, ...rows.map((row) => row.size.length));
  return rows.map((row) => {
    const suffix = classify
      ? row.entry.node.kind === 'dir'
        ? '/'
        : row.entry.node.kind === 'file' && row.entry.node.mime === 'exe'
          ? '*'
          : ''
      : '';
    const cls = classOf(row.entry.node);
    return spansLine([
      {
        t: `${row.mode} ${padStart(row.links, linkWidth)} ${USER} ${USER} ${padStart(row.size, sizeWidth)} ${row.date} `,
      },
      { t: row.entry.name + suffix, ...(cls ? { cls } : {}), insert: insertFor(row.entry.node, row.entry.shown) },
    ]);
  });
}

/** Stacked `ls -l` under 50 columns (linux/10): name first, then the fields, dimmed. */
function stackedRows(entries: readonly Entry[], human: boolean): Line[] {
  return entries.flatMap((entry, index) => {
    const size = entry.node.kind === 'dir' ? 4096 : entry.node.size;
    const cls = classOf(entry.node);
    return [
      ...(index ? [line('')] : []),
      spansLine([{ t: entry.name, ...(cls ? { cls } : {}), insert: insertFor(entry.node, entry.shown) }]),
      dim(
        `  ${modeString(entry.node.kind, entry.node.mode)} · ${human ? humanSize(size) : size} · ${lsDate(entry.node.mtime)}`,
      ),
    ];
  });
}

function listing(entries: readonly Entry[], ctx: Ctx, flags: ReadonlySet<string>): Line[] {
  const long = flags.has('l');
  const human = flags.has('h');
  const classify = flags.has('F');
  if (long) {
    const blocks = entries.reduce(
      (sum, entry) => sum + (entry.node.kind === 'dir' ? 4 : Math.ceil((entry.node.size || 0) / 4096) * 4),
      0,
    );
    return [
      line(`total ${blocks}`),
      ...(ctx.cols < 50 ? stackedRows(entries, human) : longRows(entries, human, classify)),
    ];
  }
  const cells: Cell[] = entries.map((entry) => {
    const suffix = classify
      ? entry.node.kind === 'dir'
        ? '/'
        : entry.node.kind === 'file' && entry.node.mime === 'exe'
          ? '*'
          : ''
      : '';
    const cls = classOf(entry.node);
    return { text: entry.name + suffix, ...(cls ? { cls } : {}), insert: insertFor(entry.node, entry.shown) };
  });
  if (flags.has('1') || ctx.piped)
    return cells.map((cell) =>
      spansLine([
        { t: cell.text, ...(cell.cls ? { cls: cell.cls } : {}), ...(cell.insert ? { insert: cell.insert } : {}) },
      ]),
    );
  return columns(cells, ctx.cols);
}

export const ls: Command = (args, ctx) => {
  const parsed = parseArgs('ls', args, { flags: 'laA1hFd' });
  if (!parsed.ok) return parsed.result;
  const { flags, operands } = parsed.args;
  const all = flags.has('a');
  const almost = flags.has('A');
  const targets = operands.length ? operands : ['.'];
  const errors: Line[] = [];
  const files: Entry[] = [];
  const dirs: { shown: string; path: VfsPath }[] = [];
  let code = 0;
  for (const target of targets) {
    const resolved = ctx.vfs.resolve(ctx.cwd, target);
    if (!resolved.ok) {
      errors.push(err(`ls: cannot access '${target}': ${reasonText(resolved.reason)}`));
      code = 2;
      continue;
    }
    if (resolved.node.kind === 'file' || flags.has('d'))
      files.push({ name: target, node: resolved.node, shown: target });
    else if (isPrivate(resolved.node)) {
      errors.push(err(`ls: cannot open directory '${target}': Permission denied`));
      code = 2;
    } else dirs.push({ shown: target === '.' ? '' : target, path: resolved.path });
  }
  // GNU order: file operands first, then each directory, both sorted by name.
  files.sort((a, b) => (a.shown < b.shown ? -1 : a.shown > b.shown ? 1 : 0));
  dirs.sort((a, b) => (a.shown < b.shown ? -1 : a.shown > b.shown ? 1 : 0));
  const lines: Line[] = [...errors];
  if (files.length) lines.push(...listing(files, ctx, flags));
  const headed = targets.length > 1;
  dirs.forEach((dir, index) => {
    if (headed) {
      if (lines.length > errors.length || index > 0) lines.push(line(''));
      lines.push(line(`${dir.shown || '.'}:`));
    }
    lines.push(...listing(entriesOf(dir.path, dir.shown, ctx, all, almost), ctx, flags));
  });
  return { lines, exitCode: code, effects: [] };
};

// --- tree -------------------------------------------------------------------------------------------------------------

export const tree: Command = (args, ctx) => {
  const parsed = parseArgs('tree', args, { flags: 'a', valued: 'L' });
  if (!parsed.ok) return parsed.result;
  const depthText = parsed.args.values.get('L');
  const maxDepth = depthText === undefined ? Infinity : Number(depthText);
  if (depthText !== undefined && (!Number.isInteger(maxDepth) || maxDepth < 1))
    return usage('tree', `Invalid level, must be greater than 0.`);
  const target = parsed.args.operands[0] ?? '.';
  const resolved = ctx.vfs.resolve(ctx.cwd, target);
  if (!resolved.ok) return fail([err(`${target} [error opening dir]`), line(''), line('0 directories, 0 files')], 2);
  if (resolved.node.kind !== 'dir')
    return fail([err(`${target} [error opening dir]`), line(''), line('0 directories, 0 files')], 2);
  let dirs = 0;
  let files = 0;
  const lines: Line[] = [spansLine([{ t: target, cls: 'dir' }])];
  const all = parsed.args.flags.has('a');
  const visit = (node: VfsNode, prefix: string, depth: number, shownPath: string) => {
    if (node.kind !== 'dir' || depth > maxDepth) return;
    const children = node.children.filter((child) => all || !child.name.startsWith('.'));
    children.forEach((child, index) => {
      const last = index === children.length - 1;
      const shown = shownPath === '.' ? child.name : `${shownPath}/${child.name}`;
      const cls = classOf(child);
      const denied = isPrivate(child);
      const spans: Span[] = [
        { t: `${prefix}${last ? '└── ' : '├── '}` },
        { t: child.name, ...(cls ? { cls } : {}), insert: insertFor(child, shown) },
      ];
      if (denied) spans.push({ t: '  [error opening dir]', cls: 'err' });
      lines.push(spansLine(spans));
      if (child.kind === 'dir') {
        dirs++;
        if (!denied) visit(child, `${prefix}${last ? '    ' : '│   '}`, depth + 1, shown);
      } else files++;
    });
  };
  visit(resolved.node, '', 1, target === '.' ? '.' : target.replace(/\/$/, ''));
  lines.push(
    line(''),
    line(`${dirs} ${dirs === 1 ? 'directory' : 'directories'}, ${files} ${files === 1 ? 'file' : 'files'}`),
  );
  return ok(lines);
};

// --- cat / head / tail / less -------------------------------------------------------------------------------------------

export const cat: Command = (args, ctx) => {
  const parsed = parseArgs('cat', args, { flags: 'n' });
  if (!parsed.ok) return parsed.result;
  const { operands, flags } = parsed.args;
  const out: Line[] = [];
  let code = 0;
  const emit = (values: readonly string[]) => {
    for (const value of values)
      out.push(line(flags.has('n') ? `${padStart(String(out.length + 1), 6)}\t${value}` : value));
  };
  if (operands.length === 0) {
    emit(ctx.stdin ?? []);
    return ok(out);
  }
  for (const operand of operands) {
    if (operand === '-') {
      emit(ctx.stdin ?? []);
      continue;
    }
    const read = readFile('cat', operand, ctx);
    if (!read.ok) {
      out.push(read.line);
      code = read.code;
      continue;
    }
    if (read.node.kind === 'file' && read.node.mime === 'pdf') {
      out.push(dim(`${operand}: binary file — try 'open resume'`));
      continue;
    }
    if (read.node.kind === 'file' && read.node.mime === 'exe') {
      out.push(dim(`${operand}: binary file — try 'man ${read.node.name}'`));
      continue;
    }
    emit(read.lines);
  }
  return { lines: out, exitCode: code, effects: [] };
};

function headTail(name: 'head' | 'tail'): Command {
  return (args, ctx) => {
    const parsed = parseArgs(name, args, { valued: 'n', numeric: 'n' });
    if (!parsed.ok) return parsed.result;
    const raw = parsed.args.values.get('n') ?? '10';
    const count = Number(raw);
    if (!/^\d+$/.test(raw)) return usage(name, `invalid number of lines: '${raw}'`);
    const input = inputOf(name, parsed.args.operands, ctx);
    const selected = name === 'head' ? input.lines.slice(0, count) : count === 0 ? [] : input.lines.slice(-count);
    return { lines: [...input.errors, ...text(selected)], exitCode: input.code, effects: [] };
  };
}
export const head = headTail('head');
export const tail = headTail('tail');

export const less: Command = (args, ctx) => {
  const parsed = parseArgs('less', args);
  if (!parsed.ok) return parsed.result;
  const file = parsed.args.operands[0];
  let lines: readonly Line[];
  let title = 'stdin';
  if (file) {
    const read = readFile('less', file, ctx);
    if (!read.ok) return fail([read.line], read.code);
    if (read.node.kind === 'file' && read.node.mime !== 'text')
      return fail([dim(`${file}: binary file — try 'open ${file}'`)]);
    lines = text(read.lines);
    title = file;
  } else if (ctx.stdin) lines = text(ctx.stdin);
  else return usage('less', 'missing filename ("less --help" for help)');
  // Not the last stage of a pipeline: behave like `cat` (a pager only takes over a terminal).
  if (ctx.piped) return ok(lines);
  return ok([], [{ k: 'pager', lines, title }]);
};

// --- grep / find / wc / sort / uniq / echo ------------------------------------------------------------------------

function compile(pattern: string, ignoreCase: boolean): RegExp {
  const flags = ignoreCase ? 'gi' : 'g';
  if (pattern.length <= 200)
    try {
      return new RegExp(pattern, flags);
    } catch {
      // Not a valid regular expression: match it literally.
    }
  return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
}

function highlight(value: string, regex: RegExp, prefix: string): Line {
  const spans: Span[] = prefix ? [{ t: prefix, cls: 'dim' }] : [];
  let last = 0;
  regex.lastIndex = 0;
  for (let match = regex.exec(value); match; match = regex.exec(value)) {
    if (match[0] === '') {
      regex.lastIndex++;
      continue;
    }
    if (match.index > last) spans.push({ t: value.slice(last, match.index) });
    spans.push({ t: match[0], cls: 'match' });
    last = match.index + match[0].length;
  }
  if (last < value.length) spans.push({ t: value.slice(last) });
  return spansLine(spans);
}

export const grep: Command = (args, ctx) => {
  const parsed = parseArgs('grep', args, { flags: 'inrvcRlH' });
  if (!parsed.ok) return parsed.result;
  const { flags, operands } = parsed.args;
  const [pattern, ...paths] = operands;
  if (pattern === undefined)
    return fail([err('Usage: grep [OPTION]... PATTERNS [FILE]...'), dim("Try 'grep --help' for more information.")], 2);
  const recursive = flags.has('r') || flags.has('R');
  const regex = compile(pattern, flags.has('i'));
  const invert = flags.has('v');
  const matches = (value: string) => {
    regex.lastIndex = 0;
    return regex.test(value) !== invert;
  };
  const sources: { label: string; lines: readonly string[] }[] = [];
  const errors: Line[] = [];
  let errorCode = 0;
  const targets = paths.length ? paths : recursive ? ['.'] : [];
  if (targets.length === 0) {
    if (ctx.stdin === null)
      return fail(
        [err('Usage: grep [OPTION]... PATTERNS [FILE]...'), dim("Try 'grep --help' for more information.")],
        2,
      );
    sources.push({ label: '(standard input)', lines: ctx.stdin });
  }
  for (const target of targets) {
    const resolved = ctx.vfs.resolve(ctx.cwd, target);
    if (!resolved.ok) {
      errors.push(err(`grep: ${target}: ${reasonText(resolved.reason)}`));
      errorCode = 2;
      continue;
    }
    if (resolved.node.kind === 'dir') {
      if (!recursive) {
        errors.push(err(`grep: ${target}: Is a directory`));
        errorCode = 2;
        continue;
      }
      for (const [path, node] of ctx.vfs.walk(resolved.path)) {
        if (node.kind === 'dir') {
          if (isPrivate(node)) {
            errors.push(err(`grep: ${relative(target, resolved.path, path)}: Permission denied`));
            errorCode = 2;
          }
          continue;
        }
        if (node.mime !== 'text') continue;
        sources.push({ label: relative(target, resolved.path, path), lines: node.read(ctx.cols) });
      }
      continue;
    }
    if (resolved.node.mime !== 'text') continue;
    sources.push({ label: target, lines: resolved.node.read(ctx.cols) });
  }
  const labelled = recursive || sources.length > 1 || flags.has('H');
  const out: Line[] = [...errors];
  let found = 0;
  for (const source of sources) {
    let count = 0;
    source.lines.forEach((value, index) => {
      if (!matches(value)) return;
      count++;
      found++;
      if (flags.has('c') || flags.has('l')) return;
      const prefix = `${labelled ? `${source.label}:` : ''}${flags.has('n') ? `${index + 1}:` : ''}`;
      out.push(
        invert
          ? spansLine([...(prefix ? [{ t: prefix, cls: 'dim' as const }] : []), { t: value }])
          : highlight(value, regex, prefix),
      );
    });
    if (flags.has('c')) out.push(line(`${labelled ? `${source.label}:` : ''}${count}`));
    else if (flags.has('l') && count > 0) out.push(line(source.label));
  }
  return { lines: out, exitCode: errorCode || (found > 0 ? 0 : 1), effects: [] };
};

/** A walked path shown relative to where the walk started, as typed (`./projects/x.md`, `projects/x.md`). */
function relative(typed: string, base: VfsPath, path: VfsPath): string {
  const rest = path.slice(base.length).join('/');
  if (!rest) return typed;
  return `${typed.replace(/\/$/, '')}/${rest}`;
}

export const find: Command = (args, ctx) => {
  const paths: string[] = [];
  let name: RegExp | null = null;
  let type: 'f' | 'd' | null = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--help') return ok([line('Usage: find [path] [-name glob] [-type f|d]')]);
    if (arg === '-name' || arg === '-iname') {
      const value = args[i + 1];
      if (value === undefined) return usage('find', `missing argument to '${arg}'`);
      const source = value
        .split('')
        .map((c) => (c === '*' ? '.*' : c === '?' ? '.' : c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
        .join('');
      name = new RegExp(`^${source}$`, arg === '-iname' ? 'i' : '');
      i++;
      continue;
    }
    if (arg === '-type') {
      const value = args[i + 1];
      if (value !== 'f' && value !== 'd') return usage('find', `Unknown argument to -type: ${value ?? ''}`);
      type = value;
      i++;
      continue;
    }
    if (arg.startsWith('-')) return usage('find', `unknown predicate '${arg}'`);
    paths.push(arg);
  }
  const out: Line[] = [];
  let code = 0;
  for (const start of paths.length ? paths : ['.']) {
    const resolved = ctx.vfs.resolve(ctx.cwd, start);
    if (!resolved.ok) {
      out.push(err(`find: '${start}': ${reasonText(resolved.reason)}`));
      code = 1;
      continue;
    }
    for (const [path, node] of ctx.vfs.walk(resolved.path)) {
      const shown = relative(start, resolved.path, path);
      const kind = node.kind === 'dir' ? 'd' : 'f';
      if ((!type || type === kind) && (!name || name.test(node.name || shown))) {
        const cls = classOf(node);
        out.push(spansLine([{ t: shown, ...(cls ? { cls } : {}), insert: insertFor(node, shown) }]));
      }
      if (isPrivate(node)) {
        out.push(err(`find: '${shown}': Permission denied`));
        code = 1;
      }
    }
  }
  return { lines: out, exitCode: code, effects: [] };
};

const words = (value: string) => value.split(/\s+/).filter(Boolean).length;

export const wc: Command = (args, ctx) => {
  const parsed = parseArgs('wc', args, { flags: 'lwc' });
  if (!parsed.ok) return parsed.result;
  const { flags, operands } = parsed.args;
  const pick = flags.size ? (['l', 'w', 'c'] as const).filter((flag) => flags.has(flag)) : (['l', 'w', 'c'] as const);
  const count = (lines: readonly string[]) => ({
    l: lines.length,
    w: lines.reduce((sum, value) => sum + words(value), 0),
    c: lines.reduce((sum, value) => sum + utf8Length(value) + 1, 0),
  });
  const rows: { counts: ReturnType<typeof count>; label: string }[] = [];
  const out: Line[] = [];
  let code = 0;
  if (operands.length === 0) rows.push({ counts: count(ctx.stdin ?? []), label: '' });
  for (const operand of operands) {
    const read = readFile('wc', operand, ctx);
    if (!read.ok) {
      out.push(read.line);
      code = read.code;
      continue;
    }
    rows.push({ counts: count(read.lines), label: operand });
  }
  if (rows.length > 1)
    rows.push({
      counts: rows.reduce(
        (sum, row) => ({ l: sum.l + row.counts.l, w: sum.w + row.counts.w, c: sum.c + row.counts.c }),
        {
          l: 0,
          w: 0,
          c: 0,
        },
      ),
      label: 'total',
    });
  const widest = Math.max(1, ...rows.flatMap((row) => pick.map((flag) => String(row.counts[flag]).length)));
  for (const row of rows)
    out.push(
      line(
        [
          ...pick.map((flag) => padStart(String(row.counts[flag]), pick.length === 1 && !row.label ? 0 : widest)),
          row.label,
        ]
          .filter((part) => part !== '')
          .join(' '),
      ),
    );
  return { lines: out, exitCode: code, effects: [] };
};

export const sort: Command = (args, ctx) => {
  const parsed = parseArgs('sort', args, { flags: 'rnuf' });
  if (!parsed.ok) return parsed.result;
  const { flags, operands } = parsed.args;
  const input = inputOf('sort', operands, ctx);
  const key = (value: string) => (flags.has('f') ? value.toLowerCase() : value);
  let sorted = [...input.lines].sort((a, b) => {
    if (flags.has('n')) {
      const diff = (Number.parseFloat(a) || 0) - (Number.parseFloat(b) || 0);
      if (diff) return diff;
    }
    const ka = key(a);
    const kb = key(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  if (flags.has('r')) sorted.reverse();
  if (flags.has('u')) sorted = sorted.filter((value, index) => index === 0 || key(value) !== key(sorted[index - 1]!));
  return { lines: [...input.errors, ...text(sorted)], exitCode: input.code, effects: [] };
};

export const uniq: Command = (args, ctx) => {
  const parsed = parseArgs('uniq', args, { flags: 'cd' });
  if (!parsed.ok) return parsed.result;
  const { flags, operands } = parsed.args;
  const input = inputOf('uniq', operands, ctx);
  const groups: { value: string; count: number }[] = [];
  for (const value of input.lines) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.value === value) lastGroup.count++;
    else groups.push({ value, count: 1 });
  }
  const kept = flags.has('d') ? groups.filter((group) => group.count > 1) : groups;
  const out = kept.map((group) =>
    line(flags.has('c') ? `${padStart(String(group.count), 7)} ${group.value}` : group.value),
  );
  return { lines: [...input.errors, ...out], exitCode: input.code, effects: [] };
};

export const echo: Command = (args) => {
  const values = args[0] === '-n' ? args.slice(1) : args;
  return ok([line(values.join(' '))]);
};

// --- open -------------------------------------------------------------------------------------------------------------

/** The content a directory holds, for `reveal` (home and other folders hold none). */
const dirRef = (node: VfsNode): ContentRef | null => (node.kind === 'dir' && node.ref ? node.ref : null);

export const open: Command = (args, ctx) => {
  const parsed = parseArgs('open', args);
  if (!parsed.ok) return parsed.result;
  const target = parsed.args.operands[0];
  if (target === undefined) return usage('open', 'missing operand — try: open resume');
  if (target === 'resume' || target === 'resume.pdf' || target === 'cv')
    return ok([dim('Opening resume.pdf…')], [{ k: 'open', ref: 'resume' }]);
  let resolved = ctx.vfs.resolve(ctx.cwd, target);
  // Portfolio routes and every insertable project/role/school result use the
  // human-facing extensionless form. The VFS keeps real filenames, so resolve
  // that canonical shorthand before reporting ENOENT. LNX-FS-06 guarantees
  // sibling stems are unique.
  if (!resolved.ok && !target.split('/').at(-1)?.includes('.')) {
    for (const extension of ['.md', '.txt', '.pdf']) {
      const candidate = ctx.vfs.resolve(ctx.cwd, `${target}${extension}`);
      if (candidate.ok) {
        resolved = candidate;
        break;
      }
    }
  }
  // Search and the guided tour print portfolio-root paths (`projects/x`)
  // that remain valid from any cwd, like a small shell PATH for content.
  if (!resolved.ok && /^(projects|experience|education)\//.test(target)) {
    resolved = ctx.vfs.resolve(HOME, target);
    if (!resolved.ok && !target.split('/').at(-1)?.includes('.')) {
      for (const extension of ['.md', '.txt', '.pdf']) {
        const candidate = ctx.vfs.resolve(HOME, `${target}${extension}`);
        if (candidate.ok) {
          resolved = candidate;
          break;
        }
      }
    }
  }
  if (!resolved.ok) return fail([err(`open: ${target}: ${reasonText(resolved.reason)}`)]);
  const node = resolved.node;
  if (node.kind === 'dir') {
    if (isPrivate(node)) return fail([err(`open: ${target}: Permission denied`)]);
    // Linux: the shell *is* the file manager — change into the folder and list it. Elsewhere: the OS's own file manager.
    if (ctx.os === 'linux') {
      const listed = ls([], { ...ctx, cwd: resolved.path });
      return ok(listed.lines, [{ k: 'cd', to: resolved.path }]);
    }
    return ok([dim(`Opening ${stem(node.name) || '/'}…`)], [{ k: 'reveal', path: resolved.path, ref: dirRef(node) }]);
  }
  if (node.mime === 'pdf') return ok([dim(`Opening ${node.name}…`)], [{ k: 'open', ref: 'resume' }]);
  if (node.mime === 'exe') return fail([err(`open: ${target}: cannot open a program — try 'man ${node.name}'`)]);
  if (node.ref && node.ref !== 'resume' && refSlug(node.ref))
    return ok([dim(`Opening ${node.name}…`)], [{ k: 'open', ref: node.ref }]);
  // A text file without a rich view opens in the pager.
  return ok([], [{ k: 'pager', lines: text(node.read(ctx.cols)), title: absolutePath(resolved.path) }]);
};

// --- Read-only refusals (linux/12 E6) -----------------------------------------------------------------------------------

function refuse(name: string, verb: string): Command {
  return (args) => {
    const operands = args.filter((arg) => !arg.startsWith('-'));
    if (operands.length === 0) return usage(name, 'missing operand');
    return fail(operands.map((operand) => err(`${name}: cannot ${verb} '${operand}': Read-only file system`)));
  };
}
export const touch = refuse('touch', 'touch');
export const mkdir = refuse('mkdir', 'create directory');
export const rmdir = refuse('rmdir', 'remove');
export const cp = refuse('cp', 'create regular file');
export const mv = refuse('mv', 'move');
export const chmod = refuse('chmod', 'change permissions of');

export type { Result };
