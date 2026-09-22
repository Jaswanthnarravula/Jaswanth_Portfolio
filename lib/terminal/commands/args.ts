/**
 * Shared command plumbing (linux/04 "Conventions"): option parsing with the exact usage errors
 * (`cmd: invalid option -- 'x'` + `Try 'man cmd' for more information.`, exit 2), `--help` → synopsis (exit 0), and
 * small result builders. Every command is total: bad input is a usage error, never an exception.
 */
import { dim, err, line } from '../format';
import { commandMeta } from '../manifest';
import type { Ctx, Effect, Line, Result, VfsNode } from '../types';

export const ok = (lines: readonly Line[] = [], effects: readonly Effect[] = []): Result => ({
  lines,
  exitCode: 0,
  effects,
});
export const fail = (lines: readonly Line[], exitCode = 1, effects: readonly Effect[] = []): Result => ({
  lines,
  exitCode,
  effects,
});
export const text = (values: readonly string[]): Line[] => values.map((value) => line(value));

export function usage(name: string, message: string): Result {
  return fail([err(`${name}: ${message}`), dim(`Try 'man ${name}' for more information.`)], 2);
}

export interface Parsed {
  readonly flags: ReadonlySet<string>;
  readonly values: ReadonlyMap<string, string>;
  readonly long: ReadonlySet<string>;
  readonly operands: readonly string[];
}

export interface ArgSpec {
  /** Boolean single-letter flags. */
  readonly flags?: string;
  /** Flags that take a value (`-n 5`, `-n5`). */
  readonly valued?: string;
  readonly long?: readonly string[];
  /** `head -3` means `head -n 3`. */
  readonly numeric?: string;
}

export type ParseOutcome =
  { readonly ok: true; readonly args: Parsed } | { readonly ok: false; readonly result: Result };

export function parseArgs(name: string, args: readonly string[], spec: ArgSpec = {}): ParseOutcome {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  const long = new Set<string>();
  const operands: string[] = [];
  const allowed = spec.flags ?? '';
  const valued = spec.valued ?? '';
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--') {
      operands.push(...args.slice(i + 1));
      break;
    }
    if (arg === '--help') return { ok: false, result: helpFor(name) };
    if (arg.startsWith('--')) {
      if (spec.long?.includes(arg)) {
        long.add(arg);
        continue;
      }
      return { ok: false, result: usage(name, `unrecognized option '${arg}'`) };
    }
    if (arg.startsWith('-') && arg.length > 1) {
      if (spec.numeric && /^-\d+$/.test(arg)) {
        values.set(spec.numeric, arg.slice(1));
        continue;
      }
      for (let j = 1; j < arg.length; j++) {
        const flag = arg[j]!;
        if (valued.includes(flag)) {
          const value = arg.slice(j + 1) || args[i + 1];
          if (value === undefined)
            return { ok: false, result: usage(name, `option requires an argument -- '${flag}'`) };
          if (!arg.slice(j + 1)) i++;
          values.set(flag, value);
          break;
        }
        if (!allowed.includes(flag)) return { ok: false, result: usage(name, `invalid option -- '${flag}'`) };
        flags.add(flag);
      }
      continue;
    }
    operands.push(arg);
  }
  return { ok: true, args: { flags, values, long, operands } };
}

export function helpFor(name: string): Result {
  const meta = commandMeta(name);
  return ok(meta ? [line(`Usage: ${meta.synopsis}`), dim(meta.summary)] : [line(`Usage: ${name}`)]);
}

/** Read a file's text for `cat` & co.; errors use the coreutils phrasing. */
export function readFile(
  name: string,
  path: string,
  ctx: Ctx,
): { ok: true; lines: readonly string[]; node: VfsNode } | { ok: false; line: Line; code: number } {
  const resolved = ctx.vfs.resolve(ctx.cwd, path);
  if (!resolved.ok)
    return {
      ok: false,
      line: err(
        `${name}: ${path}: ${resolved.reason === 'ENOENT' ? 'No such file or directory' : resolved.reason === 'ENOTDIR' ? 'Not a directory' : 'Permission denied'}`,
      ),
      code: 1,
    };
  if (resolved.node.kind === 'dir') return { ok: false, line: err(`${name}: ${path}: Is a directory`), code: 1 };
  return { ok: true, lines: resolved.node.read(ctx.cols), node: resolved.node };
}

/** The input lines of a filter: its files, else piped stdin, else nothing. */
export function inputOf(
  name: string,
  files: readonly string[],
  ctx: Ctx,
): { lines: string[]; errors: Line[]; code: number } {
  if (files.length === 0) return { lines: [...(ctx.stdin ?? [])], errors: [], code: 0 };
  const lines: string[] = [];
  const errors: Line[] = [];
  let code = 0;
  for (const file of files) {
    const read = readFile(name, file, ctx);
    if (!read.ok) {
      errors.push(read.line);
      code = read.code;
      continue;
    }
    if (read.node.kind === 'file' && read.node.mime !== 'text') {
      errors.push(dim(`${name}: ${file}: binary file`));
      continue;
    }
    lines.push(...read.lines);
  }
  return { lines, errors, code };
}

/** How `ls` & co. colour an entry. */
export const classOf = (node: VfsNode): Line['cls'] =>
  node.kind === 'dir' ? 'dir' : node.mime === 'exe' ? 'exe' : node.mime === 'pdf' ? 'pdf' : undefined;

/** What tapping an entry inserts (linux/10 "Touch assists"): `cd name/`, `open name` or `cat name`. */
export function insertFor(node: VfsNode, shown: string): string {
  if (node.kind === 'dir') return `cd ${shown.endsWith('/') ? shown : `${shown}/`}`;
  if (node.mime === 'pdf' || (node.ref && typeof node.ref === 'object' && 'slug' in node.ref)) return `open ${shown}`;
  if (node.mime === 'exe') return `man ${node.name}`;
  return `cat ${shown}`;
}
