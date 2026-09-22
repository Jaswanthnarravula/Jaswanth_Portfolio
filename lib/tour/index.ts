/**
 * The tour director — shared/20 (`lib/tour`, a lazy chunk ≤ 8 KB). A tour is a script of steps: a caption, an optional
 * **real** kernel action (`TOUR-REAL-01`), an element to point at, and what to wait for. The director never starts
 * itself (`TOUR-NEVER-01`), any input cancels it and leaves whatever it opened open (`TOUR-CANCEL-01`), and under
 * reduced motion it never auto-advances — Next only (`TOUR-A11Y-01`). It is framework-free: the host OS renders the
 * coach mark, dispatches, and reports when an opened app has settled.
 */
import type { KernelAction } from '@/lib/kernel/actions';
import type { OsId } from '@/lib/kernel/ids';

export interface TourStep {
  readonly id: string;
  readonly say: string;
  readonly action?: KernelAction;
  /** Element id the coach mark points at (a highlight ring, never a dimming overlay). */
  readonly pointAt?: string;
  /** `settled`: wait for the host to say the opened app settled; a number: wait that many ms; `user-enter`: Next only. */
  readonly waitFor: 'settled' | 'user-enter' | number;
}

export interface TourScript {
  readonly os: OsId;
  readonly steps: readonly TourStep[];
  /** Focus key the director hands focus back to when the tour ends normally. */
  readonly home: string;
}

/** Each step auto-advances at most this long after its app settled (shared/20 "Timing"). */
export const STEP_MAX_MS = 5000;

export type TourEnd = 'completed' | 'cancelled';

export interface TourHost {
  dispatch(action: KernelAction): void;
  /** Render (or re-render) the coach mark for a step. */
  show(step: TourStep, index: number, total: number): void;
  /** Captions are announced politely (the shared status region). */
  announce(text: string): void;
  end(reason: TourEnd): void;
  reducedMotion(): boolean;
  /** Timers are injected so tests run on a fake clock. */
  setTimeout(callback: () => void, ms: number): number;
  clearTimeout(handle: number): void;
}

export interface TourDirector {
  start(): void;
  next(): void;
  /** Any input the visitor makes outside the coach mark; also Esc, Back and OS switches. */
  cancel(): void;
  /** The app a step opened has settled (its window's first frame). */
  settled(): void;
  /** The step's app could not load: skip ahead with a caption. */
  failed(): void;
  readonly index: number;
  readonly running: boolean;
}

export function createTourDirector(script: TourScript, host: TourHost): TourDirector {
  let index = -1;
  let running = false;
  let timer: number | null = null;

  const clear = () => {
    if (timer !== null) host.clearTimeout(timer);
    timer = null;
  };
  const finish = (reason: TourEnd) => {
    if (!running) return;
    clear();
    running = false;
    index = -1;
    host.end(reason);
  };
  const arm = (ms: number) => {
    clear();
    if (host.reducedMotion()) return; // manual Next only
    timer = host.setTimeout(() => go(index + 1), ms);
  };
  const go = (to: number) => {
    if (!running) return;
    clear();
    if (to >= script.steps.length) {
      finish('completed');
      return;
    }
    index = to;
    const step = script.steps[to]!;
    host.show(step, to, script.steps.length);
    host.announce(`${to + 1} of ${script.steps.length}. ${step.say}`);
    if (step.action) host.dispatch(step.action);
    if (typeof step.waitFor === 'number') arm(Math.min(step.waitFor, STEP_MAX_MS));
    else if (step.waitFor === 'settled' && !step.action) arm(STEP_MAX_MS);
  };

  return {
    start() {
      // Starting twice restarts from step 1 (shared/20 edge cases).
      clear();
      running = true;
      go(0);
    },
    next() {
      go(index + 1);
    },
    cancel() {
      finish('cancelled');
    },
    settled() {
      const step = script.steps[index];
      if (running && step?.waitFor === 'settled') arm(STEP_MAX_MS);
    },
    failed() {
      if (!running) return;
      host.announce('Skipping ahead');
      go(index + 1);
    },
    get index() {
      return index;
    },
    get running() {
      return running;
    },
  };
}
