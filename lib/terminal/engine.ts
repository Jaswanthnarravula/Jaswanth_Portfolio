/**
 * The interpreter — linux/02 `LNX-SH-04/05/10`. `input → history expansion → tokenize → parse (aliases) → expand →
 * execute`, purely: the result is `{ lines, exitCode, effects }` plus the next shell state; effects are returned and
 * never performed. Pipes feed `lines[].t` to the next command's stdin (error lines go straight to the screen, like
 * stderr); `&&` / `||` / `;` follow exit codes; `$?` is the last exit code. Caps: 8 commands per pipeline, 2000 lines
 * per command. Total: no input can make it throw (a fuzz suite runs it in `strict` mode to prove the safety net is
 * never reached).
 */
import type { OsId } from '@/lib/kernel/ids';
import type { TerminalData } from './data';
import { expandWord, expandWords, type ExpandEnv } from './expand';
import { voice } from './flavor';
import { dim, editDistance, err } from './format';
import { expandHistory, record } from './history';
import { BASHRC_ALIASES, COMMANDS, POWERSHELL_ALIASES } from './manifest';
import { parse, type SimpleCommand } from './parser';
import { tokenize } from './tokenizer';
import { COMMAND_TABLE } from './commands';
import type { Ctx, Effect, Execution, Flavor, Line, Result, ShellState, Vfs, VfsPath } from './types';
import { absolutePath, HOME, parseAliases, USER } from './vfs';

export const MAX_STAGES = 8;
export const OUTPUT_CAP = 2000;

export interface EngineConfig {
  readonly vfs: Vfs;
  readonly data: TerminalData;
  readonly flavor: Flavor;
  readonly os: OsId;
  readonly cols: number;
  readonly rows: number;
  /** Rethrow instead of reporting an internal error (tests prove the safety net is never needed). */
  readonly strict?: boolean;
}

export const initialShellState = (cwd: VfsPath = HOME, history: readonly string[] = []): ShellState => ({
  cwd,
  oldpwd: null,
  lastExit: 0,
  history,
});

const aliasCache = new WeakMap<Vfs, Map<Flavor, ReadonlyMap<string, string>>>();

/** The alias table, loaded from `~/.bashrc` (never from code), plus PowerShell's own `type` alias. */
export function aliasesFor(vfs: Vfs, flavor: Flavor): ReadonlyMap<string, string> {
  let byFlavor = aliasCache.get(vfs);
  if (!byFlavor) aliasCache.set(vfs, (byFlavor = new Map()));
  const cached = byFlavor.get(flavor);
  if (cached) return cached;
  const bashrc = vfs.at([...HOME, '.bashrc']);
  const aliases = parseAliases(
    bashrc?.kind === 'file' ? bashrc.read(200) : BASHRC_ALIASES.map(([n, v]) => `alias ${n}='${v}'`),
  );
  if (flavor === 'powershell') for (const [name, value] of POWERSHELL_ALIASES) aliases.set(name, value);
  byFlavor.set(flavor, aliases);
  return aliases;
}

export function envFor(state: ShellState, config: EngineConfig): Record<string, string> {
  const shell = voice(config.flavor);
  return {
    HOME: absolutePath(HOME),
    USER,
    LOGNAME: USER,
    PWD: absolutePath(state.cwd),
    ...(state.oldpwd ? { OLDPWD: absolutePath(state.oldpwd) } : {}),
    HOSTNAME: shell.hostname,
    SHELL: shell.shellPath,
    COLUMNS: String(config.cols),
    LINES: String(config.rows),
    PATH: '/usr/bin:/bin',
    TERM: 'xterm-256color',
    LANG: 'en_US.UTF-8',
  };
}

const VISIBLE = COMMANDS.filter((meta) => !meta.hidden).map((meta) => meta.name);

/** "Did you mean …?" — the closest visible command or alias (Damerau-Levenshtein ≤ 2; ≤ 1 for very short names). */
export function suggest(name: string, aliases: ReadonlyMap<string, string>): string | null {
  const limit = name.length <= 2 ? 1 : 2;
  let best: { word: string; distance: number } | null = null;
  for (const word of [...VISIBLE, ...aliases.keys()]) {
    if (word === name) continue;
    const distance = editDistance(name, word);
    if (distance <= limit && (!best || distance < best.distance)) best = { word, distance };
  }
  return best?.word ?? null;
}

function capped(result: Result): Result {
  if (result.lines.length <= OUTPUT_CAP) return result;
  return { ...result, lines: [...result.lines.slice(0, OUTPUT_CAP), dim("… output truncated — pipe to 'less'")] };
}

interface Run {
  cwd: VfsPath;
  oldpwd: VfsPath | null;
  lastExit: number;
  history: readonly string[];
}

function runCommand(
  command: SimpleCommand,
  stdin: readonly string[] | null,
  piped: boolean,
  run: Run,
  config: EngineConfig,
): Result {
  const shell = voice(config.flavor);
  const state: ShellState = { cwd: run.cwd, oldpwd: run.oldpwd, lastExit: run.lastExit, history: run.history };
  const env = envFor(state, config);
  const expandEnv: ExpandEnv = { vars: env, lastExit: run.lastExit, vfs: config.vfs, cwd: run.cwd, home: env.HOME! };
  let input = stdin;
  for (const redirect of command.redirects) {
    const target = expandWord(redirect.target, expandEnv)[0] ?? '';
    if (redirect.op !== '<') return { lines: [err(shell.readOnly(target))], exitCode: 1, effects: [] };
    const resolved = config.vfs.resolve(run.cwd, target);
    if (!resolved.ok) return { lines: [err(shell.noSuchPath(target))], exitCode: 1, effects: [] };
    if (resolved.node.kind === 'dir') return { lines: [err(shell.isDirectory(target))], exitCode: 1, effects: [] };
    input = resolved.node.read(config.cols);
  }
  const argv = expandWords(command.words, expandEnv);
  if (argv.length === 0) return { lines: [], exitCode: 0, effects: [] };
  let name = argv[0]!;
  if (name.includes('/')) {
    const resolved = config.vfs.resolve(run.cwd, name);
    if (!resolved.ok)
      return {
        lines: [err(resolved.reason === 'EACCES' ? shell.permission(name) : shell.noSuchPath(name))],
        exitCode: resolved.reason === 'EACCES' ? 126 : 127,
        effects: [],
      };
    if (resolved.node.kind === 'dir') return { lines: [err(shell.isDirectory(name))], exitCode: 126, effects: [] };
    if (resolved.node.mime !== 'exe' || !COMMAND_TABLE[resolved.node.name])
      return { lines: [err(shell.permission(name))], exitCode: 126, effects: [] };
    name = resolved.node.name;
  }
  const implementation = Object.hasOwn(COMMAND_TABLE, name) ? COMMAND_TABLE[name] : undefined;
  if (!implementation) {
    const hint = suggest(name, aliasesFor(config.vfs, config.flavor));
    return {
      lines: [
        err(shell.notFound(name)),
        hint ? { ...dim(`Did you mean '${hint}'?`), insert: hint } : dim("Try 'help'."),
      ],
      exitCode: 127,
      effects: [],
    };
  }
  const ctx: Ctx = {
    cwd: run.cwd,
    env,
    vfs: config.vfs,
    cols: Math.max(20, Math.floor(config.cols)),
    rows: Math.max(4, Math.floor(config.rows)),
    stdin: input,
    flavor: config.flavor,
    os: config.os,
    piped,
    history: run.history,
    aliases: aliasesFor(config.vfs, config.flavor),
    data: config.data,
  };
  return capped(implementation(argv.slice(1), ctx));
}

function executeInner(input: string, state: ShellState, config: EngineConfig): Execution {
  const shell = voice(config.flavor);
  const quiet = (lines: readonly Line[], exitCode: number, history = state.history): Execution => ({
    lines,
    exitCode,
    effects: [],
    state: { ...state, lastExit: exitCode, history },
    echo: null,
  });
  if (!input.trim()) return { lines: [], exitCode: state.lastExit, effects: [], state, echo: null };

  const expanded = expandHistory(input, state.history);
  if (!expanded.ok) return quiet([err(shell.eventNotFound(expanded.spec))], 1);
  const source = expanded.line;
  const history = record(state.history, source);
  const echo = expanded.changed ? source : null;

  const tokens = tokenize(source);
  if (tokens.error)
    return {
      ...quiet(
        [
          err(
            tokens.error.kind === 'unterminated'
              ? shell.unterminated(tokens.error.quote)
              : shell.syntax(tokens.error.token),
          ),
        ],
        2,
        history,
      ),
      echo,
    };
  const parsed = parse(tokens.tokens, aliasesFor(config.vfs, config.flavor));
  if (!parsed.ok) return { ...quiet([err(shell.syntax(parsed.token))], 2, history), echo };

  const run: Run = { cwd: state.cwd, oldpwd: state.oldpwd, lastExit: state.lastExit, history };
  let lines: Line[] = [];
  const effects: Effect[] = [];
  let previous: '&&' | '||' | ';' | null = null;
  for (const item of parsed.list) {
    const skip = (previous === '&&' && run.lastExit !== 0) || (previous === '||' && run.lastExit === 0);
    previous = item.next;
    if (skip) continue;
    if (item.pipeline.length > MAX_STAGES) {
      lines.push(err(shell.tooDeep()));
      run.lastExit = 2;
      continue;
    }
    let stdin: readonly string[] | null = null;
    let exitCode = 0;
    let exited = false;
    item.pipeline.forEach((command, index) => {
      const last = index === item.pipeline.length - 1;
      const result = runCommand(command, stdin, !last, run, config);
      exitCode = result.exitCode;
      if (last) lines.push(...result.lines);
      else {
        lines.push(...result.lines.filter((l) => l.cls === 'err'));
        stdin = result.lines.filter((l) => l.cls !== 'err').map((l) => l.t);
      }
      for (const effect of result.effects) {
        if (effect.k === 'cd') {
          // A `cd` inside a pipeline runs in a subshell and changes nothing (as in bash).
          if (item.pipeline.length === 1 && absolutePath(effect.to) !== absolutePath(run.cwd)) {
            run.oldpwd = run.cwd;
            run.cwd = effect.to;
          }
          continue;
        }
        if (effect.k === 'clear') lines = [];
        if (effect.k === 'history-clear') run.history = [];
        if (effect.k === 'exit') exited = true;
        effects.push(effect);
      }
    });
    run.lastExit = exitCode;
    if (exited) break;
  }
  if (absolutePath(run.cwd) !== absolutePath(state.cwd)) effects.push({ k: 'cd', to: run.cwd });
  return {
    lines,
    exitCode: run.lastExit,
    effects,
    state: { cwd: run.cwd, oldpwd: run.oldpwd, lastExit: run.lastExit, history: run.history },
    echo,
  };
}

/** Run one input line. Never throws (unless `config.strict`, which tests use to prove it never needs to). */
export function execute(input: string, state: ShellState, config: EngineConfig): Execution {
  if (config.strict) return executeInner(input, state, config);
  try {
    return executeInner(input, state, config);
  } catch {
    const shell = voice(config.flavor);
    return {
      lines: [err(`${shell.shell}: that could not run — nothing was changed`)],
      exitCode: 1,
      effects: [],
      state: { ...state, lastExit: 1 },
      echo: null,
    };
  }
}
