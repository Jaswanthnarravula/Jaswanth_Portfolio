/**
 * Terminal engine types — plans/linux/02-shell-engine.md "Execution". Pure TypeScript: no React, no DOM.
 * The engine turns `input → tokenize → expand → parse → execute → { lines, exitCode, effects }`; effects are returned,
 * never performed — each host (the Linux OS, the macOS / Windows Terminal apps) maps them to kernel actions.
 * Typed additions beyond the spec's catalogue are marked "addition" and logged in plans/linux/13 → Deviations.
 */
import type { ContentRef } from '@/data/schema';
import type { OsId } from '@/lib/kernel/ids';
import type { TerminalData } from './data';

/** Absolute path segments, e.g. `['home', 'jaswanth', 'projects']`; `[]` is `/`. */
export type VfsPath = readonly string[];

export type LineClass =
  | 'dir'
  | 'exe'
  | 'link'
  | 'err'
  | 'warn'
  | 'dim'
  | 'head'
  | 'ok'
  /** addition: `ls` colours PDFs magenta (linux/04). */
  | 'pdf'
  /** addition: `grep` highlights matches in red (linux/04). */
  | 'match';

/** A styled run inside a line (addition: `ls` columns colour and insert per entry, `contact` links per value). */
export interface Span {
  readonly t: string;
  readonly cls?: LineClass;
  readonly href?: string;
  /** Tapping / activating the entry inserts this text at the prompt — never executes (linux/10). */
  readonly insert?: string;
}

export interface Line {
  /** The plain text — what pipes, the announcer and the scrollback cap read. */
  readonly t: string;
  readonly cls?: LineClass;
  readonly href?: string;
  readonly insert?: string;
  readonly spans?: readonly Span[];
}

export type OpenTarget = ContentRef | 'resume';

export type Effect =
  | { readonly k: 'cd'; readonly to: VfsPath }
  | { readonly k: 'open'; readonly ref: OpenTarget }
  | { readonly k: 'clear' }
  | { readonly k: 'exit' }
  | { readonly k: 'pref'; readonly key: string; readonly value: unknown }
  | { readonly k: 'switch-os'; readonly to?: OsId }
  /** `subject` is an addition (`mail -s`). */
  | { readonly k: 'mailto'; readonly subject?: string }
  /** `title` / `variant` are additions: the pager names what it shows; `vim` is the egg's fake buffer. */
  | { readonly k: 'pager'; readonly lines: readonly Line[]; readonly title?: string; readonly variant?: 'vim' }
  | { readonly k: 'tour' }
  /** Navigate to the reader-mode portfolio. Kept explicit so commands stay pure. */
  | { readonly k: 'plain' }
  | { readonly k: 'egg'; readonly id: string }
  /** addition: `resume --download`. */
  | { readonly k: 'download' }
  /** addition: `history -c` — the host drops its persisted history too. */
  | { readonly k: 'history-clear' }
  /**
   * addition: `open <directory>` outside Linux shows the folder in the OS's own file manager (macOS `open .` →
   * Finder). On Linux the engine itself runs `cd` + `ls` instead.
   */
  | { readonly k: 'reveal'; readonly path: VfsPath; readonly ref: ContentRef | null };

export interface Result {
  readonly lines: readonly Line[];
  readonly exitCode: number;
  readonly effects: readonly Effect[];
}

export type Flavor = 'bash' | 'zsh' | 'powershell';

// --- Virtual filesystem (linux/03) ----------------------------------------------------------------------------------

export interface VfsDir {
  readonly kind: 'dir';
  readonly name: string;
  readonly mode: number;
  readonly mtime: string;
  readonly children: readonly VfsNode[];
  /** The section a directory holds (`~/projects` → projects), for `open` / `reveal`. */
  readonly ref?: ContentRef;
}

export interface VfsFile {
  readonly kind: 'file';
  readonly name: string;
  readonly mode: number;
  readonly mtime: string;
  readonly mime: 'text' | 'pdf' | 'exe';
  readonly size: number;
  readonly read: (cols: number) => readonly string[];
  readonly ref?: OpenTarget;
}

export type VfsNode = VfsDir | VfsFile;

export type ResolveResult =
  | { readonly ok: true; readonly path: VfsPath; readonly node: VfsNode }
  | { readonly ok: false; readonly reason: 'ENOENT' | 'ENOTDIR' | 'EACCES'; readonly at: string };

export interface Vfs {
  readonly root: VfsDir;
  readonly home: VfsPath;
  resolve(cwd: VfsPath, input: string): ResolveResult;
  list(path: VfsPath): readonly VfsNode[];
  walk(from?: VfsPath): Iterable<readonly [VfsPath, VfsNode]>;
  /** The node at an absolute path (no permission checks). */
  at(path: VfsPath): VfsNode | undefined;
}

// --- Execution ------------------------------------------------------------------------------------------------------

export interface Ctx {
  readonly cwd: VfsPath;
  readonly env: Readonly<Record<string, string>>;
  readonly vfs: Vfs;
  readonly cols: number;
  readonly rows: number;
  readonly stdin: readonly string[] | null;
  readonly flavor: Flavor;
  readonly os: OsId;
  /** addition: this command's output feeds another command (`man x | head` prints instead of paging). */
  readonly piped: boolean;
  /** addition: the session's history (for `history`), oldest first. */
  readonly history: readonly string[];
  /** addition: aliases loaded from `~/.bashrc`. */
  readonly aliases: ReadonlyMap<string, string>;
  /** addition: data the about-me commands read (the same facts every GUI app shows). */
  readonly data: TerminalData;
}

export type Command = (args: readonly string[], ctx: Ctx) => Result;

/** The shell's own state between commands (cwd, `$OLDPWD`, `$?`, history). */
export interface ShellState {
  readonly cwd: VfsPath;
  readonly oldpwd: VfsPath | null;
  readonly lastExit: number;
  readonly history: readonly string[];
}

export interface Execution extends Result {
  readonly state: ShellState;
  /** History expansion (`!!`, `!n`, `!prefix`) is echoed before running, as bash does. */
  readonly echo: string | null;
}
