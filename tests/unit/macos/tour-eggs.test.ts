/**
 * shared/20 + shared/21 mechanics: TOUR-REAL-01 (every scripted action is a valid kernel action for the registry) ·
 * TOUR-NEVER-01 / TOUR-CANCEL-01 / TOUR-A11Y-01 at the director level (nothing runs before Start; any input cancels;
 * reduced motion never auto-advances) · EGG-COUNT-01 (an egg counts once; n / N per OS) · EGG-KONAMI-01 (the sequence).
 */
import { describe, expect, it, vi } from 'vitest';
import { createKonami, eggProgress, eggsFor, recordEgg } from '@/lib/eggs';
import { reduce } from '@/lib/kernel/reducers';
import { createTourDirector, STEP_MAX_MS, type TourHost } from '@/lib/tour';
import { MACOS_TOUR } from '@/lib/tour/scripts';
import { booted, makeDeps } from '../../fixtures/portfolio';

function host(reduced = false) {
  const timers = new Map<number, () => void>();
  let next = 1;
  const log: string[] = [];
  const h: TourHost & { fire(): void; log: string[]; pending(): number } = {
    dispatch: vi.fn(),
    show: (step, index, total) => log.push(`show ${step.id} ${index + 1}/${total}`),
    announce: (text) => log.push(`say ${text}`),
    end: (reason) => log.push(`end ${reason}`),
    reducedMotion: () => reduced,
    setTimeout: (callback) => {
      timers.set(next, callback);
      return next++;
    },
    clearTimeout: (handle) => void timers.delete(handle),
    fire() {
      const entries = [...timers.entries()];
      timers.clear();
      for (const [, callback] of entries) callback();
    },
    pending: () => timers.size,
    log,
  };
  return h;
}

describe('TOUR-REAL-01 the macOS script drives real kernel actions', () => {
  it('each action changes kernel state the way the step says (opens a real window)', () => {
    let state = booted('/macos');
    const deps = makeDeps();
    for (const step of MACOS_TOUR.steps) {
      if (!step.action) continue;
      const result = reduce(state, step.action, deps);
      expect(result.state, step.id).not.toBe(state);
      expect(result.state.sessions.macos.focused).toBe(
        `macos:${step.action.type === 'OPEN_APP' ? step.action.role : ''}`,
      );
      state = result.state;
    }
    expect(MACOS_TOUR.steps).toHaveLength(5);
    expect(MACOS_TOUR.steps.map((step) => step.pointAt)).toEqual([
      'mac-dock',
      'dock-github',
      'mac-lights-github',
      'dock-resume',
      'menubar-spotlight',
    ]);
  });
});

describe('the director', () => {
  it('TOUR-NEVER-01 nothing happens until start()', () => {
    const h = host();
    createTourDirector(MACOS_TOUR, h);
    expect(h.dispatch).not.toHaveBeenCalled();
    expect(h.log).toEqual([]);
  });

  it('runs steps: action, settle, auto-advance (≤ 5 s), completes', () => {
    const h = host();
    const tour = createTourDirector(MACOS_TOUR, h);
    tour.start();
    expect(h.dispatch).toHaveBeenCalledWith(MACOS_TOUR.steps[0]!.action);
    expect(h.pending()).toBe(0); // waits for the app to settle
    tour.settled();
    expect(h.pending()).toBe(1);
    h.fire();
    expect(tour.index).toBe(1);
    tour.settled();
    h.fire();
    h.fire();
    h.fire();
    h.fire();
    expect(h.log.at(-1)).toBe('end completed');
    expect(tour.running).toBe(false);
    expect(STEP_MAX_MS).toBe(5000);
  });

  it('TOUR-CANCEL-01 any input cancels at once; what it opened stays open (no undo dispatch)', () => {
    const h = host();
    const tour = createTourDirector(MACOS_TOUR, h);
    tour.start();
    tour.cancel();
    expect(h.log.at(-1)).toBe('end cancelled');
    expect(h.dispatch).toHaveBeenCalledTimes(1);
    tour.cancel();
    expect(h.log.filter((line) => line.startsWith('end'))).toHaveLength(1);
  });

  it('TOUR-A11Y-01 reduced motion: captions announced, Next only', () => {
    const h = host(true);
    const tour = createTourDirector(MACOS_TOUR, h);
    tour.start();
    tour.settled();
    expect(h.pending()).toBe(0);
    expect(h.log).toContain('say 1 of 5. Everything here is an app — this is the Dock.');
    tour.next();
    expect(tour.index).toBe(1);
  });

  it('a failed app skips ahead; starting twice restarts from step 1', () => {
    const h = host();
    const tour = createTourDirector(MACOS_TOUR, h);
    tour.start();
    tour.failed();
    expect(h.log).toContain('say Skipping ahead');
    expect(tour.index).toBe(1);
    tour.start();
    expect(tour.index).toBe(0);
  });
});

describe('easter eggs', () => {
  it('EGG-COUNT-01 an egg counts once; n / N per OS', () => {
    const once = recordEgg([], 'EGG-ABOUT-01')!;
    expect(once).toEqual(['EGG-ABOUT-01']);
    expect(recordEgg(once, 'EGG-ABOUT-01')).toBeNull();
    expect(recordEgg(once, 'NOT-AN-EGG')).toBeNull();
    expect(eggProgress(once, 'macos')).toEqual({ found: 1, total: eggsFor('macos').length });
    expect(eggsFor('macos')).toHaveLength(8);
    expect(eggProgress(once, 'windows').found).toBe(0);
  });

  it('EGG-KONAMI-01 ↑↑↓↓←→←→BA, with restarts', () => {
    const konami = createKonami();
    const keys = [
      'ArrowUp',
      'ArrowUp',
      'ArrowUp',
      'ArrowDown',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ArrowLeft',
      'ArrowRight',
      'B',
      'a',
    ];
    expect(keys.map((key) => konami.push(key))).toEqual([...Array(10).fill(false), true]);
    expect(['x', 'ArrowUp', 'ArrowUp'].map((key) => konami.push(key))).toEqual([false, false, false]);
    konami.reset();
    expect(konami.push('ArrowDown')).toBe(false);
  });
});
