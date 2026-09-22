/**
 * The Windows input/display adapter — plans/windows/apps/windows-terminal.md (`WIN-TERM-02`, `WIN-TERM-03`) over the
 * shared engine (plans/linux/02 `LNX-SH-09`: a flavor changes the voice, never the logic). Inside, the engine stays
 * POSIX (`~/projects`); this module only rewrites what a Windows user types before the engine sees it, and spells engine
 * paths the way Windows does:
 *   · input — `\` and `/` both separate path segments (outside quotes); `C:\Users\Jaswanth`, `$HOME`,
 *     `$env:USERPROFILE` and `~` are home; `C:\` is `/`; `cd..` and `cd\` work; the first word of every command in a
 *     list or pipeline resolves the Windows aliases (`dir`, `type`, `cls`, `start`, `ii`, `Get-Help`, …) and is matched
 *     case-insensitively, as PowerShell does (and so do `help` / `man` topics: `Get-Help dir` is the help for `ls`);
 *     `-Path` / `-LiteralPath` are accepted and dropped; `winver` runs nothing — the host opens its About dialog.
 *     Quoted strings and flags are never touched; `echo` keeps its backslashes.
 *   · display — `/home/jaswanth/projects` ↔ `C:\Users\jaswanth\projects` (exactly the PowerShell voice's spelling), and
 *     the Command Prompt prompt `C:\Users\jaswanth>`.
 * Pure TypeScript and import-light (the command table only), so the Terminal window loads it at once while the engine
 * stays a lazy chunk. `HOME` / `USER` mirror lib/terminal/vfs; tests/unit/terminal/powershell.test.ts pins the parity
 * with the PowerShell voice.
 */
import { BASHRC_ALIASES, COMMANDS } from './manifest';
import type { VfsPath } from './types';

const HOME: VfsPath = ['home', 'jaswanth'];
const USER = 'jaswanth';

/** Windows command names → the engine command they run (keys lower-case: PowerShell ignores case). */
export const WINDOWS_ALIASES: ReadonlyMap<string, string> = new Map([
  ['dir', 'ls'],
  ['gci', 'ls'],
  ['get-childitem', 'ls'],
  ['type', 'cat'],
  ['gc', 'cat'],
  ['get-content', 'cat'],
  ['cls', 'clear'],
  ['clear-host', 'clear'],
  ['start', 'open'],
  ['ii', 'open'],
  ['invoke-item', 'open'],
  ['start-process', 'open'],
  ['get-help', 'help'],
  ['set-location', 'cd'],
  ['sl', 'cd'],
  ['chdir', 'cd'],
  ['get-location', 'pwd'],
  ['gl', 'pwd'],
  ['write-output', 'echo'],
  ['write-host', 'echo'],
]);

/** Engine command and alias names, for case-insensitive matching (`LS`, `Help`). */
const ENGINE_WORDS: ReadonlySet<string> = new Set([
  ...COMMANDS.map((meta) => meta.name),
  ...BASHRC_ALIASES.map(([name]) => name),
]);

/** PowerShell's named path parameters: `Get-Content -Path about.txt` is `cat about.txt`. */
const PATH_PARAMETERS: ReadonlySet<string> = new Set(['-path', '-literalpath']);

// --- Paths ------------------------------------------------------------------------------------------------------------

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const HOME_WORD = /^(?:~|\$home|\$env:userprofile|\$env:home)(?=\/|$)/i;
const USER_DIR = new RegExp(`^c:/users/${escapeRegExp(USER)}(?=/|$)`, 'i');
const USERS_DIR = /^c:\/users(?=\/|$)/i;
const DRIVE = /^c:(?=\/|$)/i;

/** Where a `/`-separated Windows spelling is rooted: `[base segments, the rest]`, or `null` for a relative path. */
function rooted(posix: string): readonly [VfsPath, string] | null {
  const home = HOME_WORD.exec(posix) ?? USER_DIR.exec(posix);
  if (home) return [HOME, posix.slice(home[0].length)];
  const users = USERS_DIR.exec(posix);
  if (users) return [HOME.slice(0, 1), posix.slice(users[0].length)];
  const drive = DRIVE.exec(posix);
  if (drive) return [[], posix.slice(drive[0].length)];
  return null;
}

/** One unquoted path argument as the engine reads it: `C:\Users\Jaswanth\projects` → `~/projects`, `C:\` → `/`. */
function enginePath(word: string): string {
  const posix = word.replace(/\\/g, '/');
  const root = rooted(posix);
  if (!root) return posix;
  const [base, rest] = root;
  const prefix = base === HOME ? '~' : `/${base.join('/')}`;
  if (prefix === '/') return rest === '' ? '/' : rest;
  return `${prefix}${rest}`;
}

/** `/home/jaswanth/projects` → `C:\Users\jaswanth\projects` (the PowerShell voice's own spelling). */
export function toWindowsPath(path: VfsPath): string {
  const underHome = HOME.every((part, i) => path[i] === part);
  return underHome
    ? `C:\\Users\\${USER}${path.length > HOME.length ? `\\${path.slice(HOME.length).join('\\')}` : ''}`
    : `C:\\${path.join('\\')}`;
}

/**
 * The inverse, leniently: either separator, any case for the drive and the user folder, `~` / `$HOME` for home, `.`
 * and `..` resolved (never above `C:\`). A relative path or another drive is `null`.
 */
export function fromWindowsPath(text: string): VfsPath | null {
  const root = rooted(text.trim().replace(/\\/g, '/'));
  if (!root) return null;
  const [base, rest] = root;
  const path = [...base];
  for (const segment of rest.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') path.pop();
    else path.push(segment);
  }
  return path;
}

/** The Windows PowerShell prompt, before and after the engine loads (`PS C:\Users\jaswanth> `). */
export const powershellPromptFor = (cwd: VfsPath): string => `PS ${toWindowsPath(cwd)}> `;

/** The Command Prompt profile's prompt (`C:\Users\jaswanth>` — cmd's `$P$G`, no trailing space). */
export const commandPromptFor = (cwd: VfsPath): string => `${toWindowsPath(cwd)}>`;

// --- Input ------------------------------------------------------------------------------------------------------------

interface Piece {
  readonly kind: 'space' | 'op' | 'word';
  readonly text: string;
  /** The word holds a quote: it is passed through exactly as typed. */
  readonly quoted: boolean;
}

const OPERATORS = ['&&', '||', '|', ';'] as const;

/** Split a line into words, operators and the whitespace between them (quotes respected; nothing is lost). */
function scan(line: string): Piece[] {
  const pieces: Piece[] = [];
  let i = 0;
  while (i < line.length) {
    const start = i;
    if (/\s/.test(line[i]!)) {
      while (i < line.length && /\s/.test(line[i]!)) i++;
      pieces.push({ kind: 'space', text: line.slice(start, i), quoted: false });
      continue;
    }
    const op = OPERATORS.find((candidate) => line.startsWith(candidate, i));
    if (op) {
      i += op.length;
      pieces.push({ kind: 'op', text: op, quoted: false });
      continue;
    }
    let quoted = false;
    while (i < line.length && !/\s/.test(line[i]!) && !OPERATORS.some((candidate) => line.startsWith(candidate, i))) {
      const char = line[i]!;
      if (char === "'" || char === '"') {
        quoted = true;
        i++;
        while (i < line.length && line[i] !== char) i += char === '"' && line[i] === '\\' ? 2 : 1;
        i = Math.min(line.length, i + 1);
        continue;
      }
      i++;
    }
    pieces.push({ kind: 'word', text: line.slice(start, i), quoted });
  }
  return pieces;
}

/** A command's first word: `cd..` / `cd\x` split, Windows aliases resolved, engine names case-folded. */
function commandWord(word: string): { readonly text: string; readonly command: string } {
  const glued = /^(cd|chdir)((?:\.\.|[\\/]).*)$/i.exec(word);
  if (glued) return { text: `cd ${enginePath(glued[2]!)}`, command: 'cd' };
  const lower = word.toLowerCase();
  const alias = WINDOWS_ALIASES.get(lower);
  if (alias) return { text: alias, command: alias };
  if (ENGINE_WORDS.has(lower)) return { text: lower, command: lower };
  return { text: word, command: word };
}

/** Commands whose operands name commands: `Get-Help dir` is the help for `ls`, as PowerShell answers it. */
const TOPIC_COMMANDS: ReadonlySet<string> = new Set(['help', 'man']);

function topicWord(word: string): string {
  const lower = word.toLowerCase();
  return WINDOWS_ALIASES.get(lower) ?? (ENGINE_WORDS.has(lower) ? lower : word);
}

export interface EngineInput {
  /** The line the engine runs (`''` when nothing should run). */
  readonly line: string;
  /** `winver`: the host opens its About dialog (shared/21 `EGG-WINVER-01`) instead of running anything. */
  readonly winver: boolean;
}

/** What a Windows user typed → what the POSIX engine runs (`WIN-TERM-02`, `WIN-TERM-03`). */
/** Windows has no sudo (plans/windows/apps/windows-terminal "Behaviour"): this line first, then the shared egg. */
export const SUDO_NOTE = 'sudo: not on Windows — but the answer is still yes.';

export function toEngineInput(line: string): EngineInput {
  const pieces = scan(line);
  const first = pieces.find((piece) => piece.kind !== 'space');
  if (first?.kind === 'word' && !first.quoted && /^winver(?:\.exe)?$/i.test(first.text))
    return { line: '', winver: true };

  let out = '';
  let command: string | null = null;
  let dropSpace = false;
  for (const piece of pieces) {
    if (piece.kind === 'space') {
      if (!dropSpace) out += piece.text;
      dropSpace = false;
      continue;
    }
    dropSpace = false;
    if (piece.kind === 'op') {
      command = null;
      out += piece.text;
      continue;
    }
    if (piece.quoted) {
      command ??= piece.text;
      out += piece.text;
      continue;
    }
    if (command === null) {
      const resolved = commandWord(piece.text);
      command = resolved.command;
      out += resolved.text;
      continue;
    }
    if (command === 'echo') out += piece.text.replace(/\\/g, '\\\\');
    else if (TOPIC_COMMANDS.has(command) && !piece.text.startsWith('-')) out += topicWord(piece.text);
    else if (PATH_PARAMETERS.has(piece.text.toLowerCase())) dropSpace = true;
    else if (piece.text.startsWith('-')) out += piece.text;
    else out += enginePath(piece.text);
  }
  // Only the egg (`sudo hire-me`) is a yes; any other sudo keeps the engine's own answer.
  const sudo = first?.kind === 'word' && !first.quoted && /^\s*sudo\s+hire[- ]me\s*$/i.test(out);
  return { line: sudo ? `echo "${SUDO_NOTE}"; ${out.trimStart()}` : out, winver: false };
}
