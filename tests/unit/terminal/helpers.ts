/** Shared terminal test harness: the engine over the deterministic fixture portfolio (never the real content). */
import { fixtureCatalog, fixturePortfolio } from '../../fixtures/portfolio';
import { terminalDataFrom } from '@/lib/terminal/data';
import { execute, initialShellState, type EngineConfig } from '@/lib/terminal/engine';
import type { Execution, Flavor, Line, ShellState } from '@/lib/terminal/types';
import { buildVfs, HOME } from '@/lib/terminal/vfs';
import type { OsId } from '@/lib/kernel/ids';

export const data = terminalDataFrom(fixturePortfolio, fixtureCatalog.rev, {
  resumeFile: { bytes: 12_845, pages: 1 },
});
export const vfs = buildVfs(data);

export function config(overrides: Partial<EngineConfig> = {}): EngineConfig {
  return { vfs, data, flavor: 'bash', os: 'linux', cols: 80, rows: 24, strict: true, ...overrides };
}

/** Run one or more lines in order (state carries over); returns the last execution. */
export function sh(
  input: string | readonly string[],
  options: { cols?: number; flavor?: Flavor; os?: OsId; state?: ShellState; cwd?: readonly string[] } = {},
): Execution {
  let state = options.state ?? initialShellState(options.cwd ?? HOME);
  let last: Execution | null = null;
  for (const text of typeof input === 'string' ? [input] : input) {
    last = execute(
      text,
      state,
      config({ cols: options.cols ?? 80, flavor: options.flavor ?? 'bash', os: options.os ?? 'linux' }),
    );
    state = last.state;
  }
  return last!;
}

export const texts = (lines: readonly Line[]): string[] => lines.map((line) => line.t);
export const out = (input: string | readonly string[], options?: Parameters<typeof sh>[1]): string[] =>
  texts(sh(input, options).lines);
