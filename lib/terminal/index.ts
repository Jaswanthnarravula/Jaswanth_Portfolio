/**
 * The terminal engine's public API (`lib/terminal`, a lazy chunk — shared/10 "Terminal engine ≤ 18 KB"). A host (the
 * Linux OS, the macOS / Windows Terminal apps) creates one engine per session and feeds it lines; it gets back lines,
 * an exit code and effects to map onto kernel actions. No React, no DOM, no I/O.
 */
import type { OsId } from '@/lib/kernel/ids';
import { complete, type Completion } from './completion';
import type { TerminalData } from './data';
import { aliasesFor, execute, initialShellState } from './engine';
import { voice } from './flavor';
import type { Execution, Flavor, ShellState, Vfs, VfsPath } from './types';
import { buildVfs } from './vfs';

export interface Terminal {
  readonly vfs: Vfs;
  readonly flavor: Flavor;
  run(input: string, state: ShellState, size: { cols: number; rows: number }): Execution;
  complete(input: string, cursor: number, state: ShellState, cols: number, listing: boolean): Completion;
  prompt(cwd: VfsPath): string;
  initial(cwd?: VfsPath, history?: readonly string[]): ShellState;
}

export function createTerminal({ data, flavor, os }: { data: TerminalData; flavor: Flavor; os: OsId }): Terminal {
  const vfs = buildVfs(data);
  const skillGroups = data.skills.map((group) => group.id);
  return {
    vfs,
    flavor,
    run: (input, state, size) => execute(input, state, { vfs, data, flavor, os, cols: size.cols, rows: size.rows }),
    complete: (input, cursor, state, cols, listing) =>
      complete(input, cursor, { vfs, cwd: state.cwd, aliases: aliasesFor(vfs, flavor), cols, skillGroups }, listing),
    prompt: (cwd) => voice(flavor).prompt(cwd),
    initial: (cwd, history) => initialShellState(cwd, history),
  };
}

export type { Completion } from './completion';
export type { TerminalData } from './data';
export type { Effect, Execution, Flavor, Line, LineClass, ShellState, Span, VfsPath } from './types';
export { cursorAt, newer, older, reverseSearch, type HistoryCursor } from './history';
export { controlAction, editLine, INPUT_CAP, trimPaste, type LineState } from './line-editing';
export { HOME, cwdToUrlPath, tildePath, urlPathToCwd } from './vfs';
