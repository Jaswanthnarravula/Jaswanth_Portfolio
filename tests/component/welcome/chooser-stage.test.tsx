/**
 * CHOOSE-ENTER-01 · CHOOSE-FAIL-01 · CHOOSE-RM-01 — the chooser's stage controller against the real kernel reducer,
 * with a controllable flight: enter → land → PHASE_DONE → reveal; Esc mid-flight and Back while loading return to the
 * card; a failed chunk flies back and offers Retry; last click wins; the stage owns exactly the phases it animates.
 */
import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createChooserStage, type StageView } from '@/components/welcome/chooser-stage';
import type { KernelAction } from '@/lib/kernel/actions';
import type { OsId } from '@/lib/kernel/ids';
import { reduce, type KernelResult } from '@/lib/kernel/reducers';
import type { KernelState } from '@/lib/kernel/types';
import type { flight, FlightEnd } from '@/lib/motion/flight';
import type { KernelEffect } from '@/stores/kernel-store';
import { isClaimed, resetStageClaims } from '@/stores/transition-stage';
import { booted, makeDeps } from '../../fixtures/portfolio';

interface FakeFlight {
  readonly el: HTMLElement;
  land(): void;
  reversed: boolean;
  killed: boolean;
  retargets: number;
}

function harness(extra: Partial<Parameters<typeof createChooserStage>[0]> = {}) {
  const deps = makeDeps();
  let state: KernelState = booted('/macos');
  const listeners = new Set<(effect: KernelEffect) => void>();
  const dispatched: KernelAction[] = [];
  const results: KernelResult[] = [];
  const dispatch = (action: KernelAction) => {
    dispatched.push(action);
    const previous = state;
    const result = reduce(state, action, deps);
    state = result.state;
    results.push(result);
    for (const listener of listeners) listener({ ...result, action, previous });
    return result;
  };
  // Settle on the chooser (the kernel's own route to it).
  dispatch({ type: 'SWITCH_OS', to: null, via: 'switch' });
  dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch: state.epoch } });

  const root = document.createElement('div');
  root.innerHTML = ['macos', 'linux', 'windows']
    .map(
      (os) =>
        `<li data-chooser-fade="${os}"><a data-chooser-card="${os}" href="/${os}"><span data-shot><img src="/${os}.avif" alt=""></span></a></li>`,
    )
    .join('')
    .concat('<footer data-chooser-fade="footer"></footer>');
  document.body.append(root);

  const flights: FakeFlight[] = [];
  const fly = ((el: HTMLElement) => {
    let settle: (end: FlightEnd) => void = () => undefined;
    const done = new Promise<FlightEnd>((resolve) => (settle = resolve));
    const handle: FakeFlight = { el, land: () => settle('landed'), reversed: false, killed: false, retargets: 0 };
    flights.push(handle);
    return {
      done,
      retarget: () => void handle.retargets++,
      reverse: () => {
        handle.reversed = true;
        settle('reversed');
      },
      finish: () => settle('landed'),
      kill: () => {
        handle.killed = true;
        settle('killed');
      },
    };
  }) as unknown as typeof flight;

  const views: StageView[] = [];
  const announced: string[] = [];
  const stage = createChooserStage({
    root,
    overlayClassName: 'stage',
    dispatch,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onView: (view) => views.push(view),
    announce: (message) => announced.push(message),
    fly,
    getState: () => state,
    ...extra,
  });
  const overlays = () => document.querySelectorAll('body > .stage');
  const shot = (os: OsId) => root.querySelector<HTMLElement>(`[data-chooser-card="${os}"] [data-shot]`)!;
  return {
    stage,
    dispatch,
    dispatched,
    results,
    flights,
    views,
    announced,
    overlays,
    shot,
    root,
    get state() {
      return state;
    },
  };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  document.documentElement.dataset.motion = 'reduced'; // 150 ms crossfades keep the tests quick
});
afterEach(() => {
  document.body.innerHTML = '';
  delete document.documentElement.dataset.motion;
  resetStageClaims();
});

describe('CHOOSE-ENTER-01 the enter transition', () => {
  it('enter → the snapshot flies; landing completes the exit; entering crossfades to the live shell', async () => {
    const h = harness();
    h.stage.enter('linux', 'Linux');
    expect(h.state.transition).toMatchObject({ phase: 'exiting', from: null, to: 'linux' });
    const epoch = h.state.epoch;
    expect(isClaimed(epoch, 'exiting') && isClaimed(epoch, 'entering') && isClaimed(epoch, 'failed')).toBe(true);
    expect(h.announced).toEqual(['Entering Linux']);
    expect(h.overlays()).toHaveLength(1);
    expect(h.overlays()[0]!.getAttribute('aria-hidden')).toBe('true');
    expect(h.shot('linux').style.visibility).toBe('hidden');

    h.flights[0]!.land();
    await tick();
    expect(h.views.at(-1)).toEqual({ covered: true, failed: null });
    expect(h.state.transition.phase).toBe('loading');

    h.dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch } }); // the chunk arrived → entering
    expect(h.state.transition.phase).toBe('entering');
    await waitFor(() => expect(h.state.transition.phase).toBe('idle'));
    expect(h.state.activeOs).toBe('linux');
    expect(h.overlays()).toHaveLength(0);
    expect(h.shot('linux').style.visibility).toBe('');
    expect(isClaimed(epoch, 'entering')).toBe(false);
  });

  it('Esc mid-flight reverses into the card; focus is aimed at that card and the push is undone', async () => {
    const h = harness();
    h.stage.enter('windows', 'Windows 11');
    expect(h.stage.cancel()).toBe(true);
    expect(h.state.transition).toMatchObject({ phase: 'exiting', from: 'windows', to: null });
    expect(h.flights[0]!.reversed).toBe(true);
    await waitFor(() => expect(h.state.transition.phase).toBe('idle'));
    expect(h.state.activeOs).toBeNull();
    expect(h.state.route.kind).toBe('welcome');
    expect(h.results.at(-1)!.focusTarget?.candidates[0]).toBe('chooser-card:windows');
    expect(h.overlays()).toHaveLength(0);
    expect(h.stage.cancel()).toBe(false); // nothing left to reverse
  });

  it('Back while the chunk loads flies the snapshot back into its card', async () => {
    const h = harness();
    h.stage.enter('macos', 'macOS');
    h.flights[0]!.land();
    await tick();
    expect(h.state.transition.phase).toBe('loading');
    h.dispatch({ type: 'SWITCH_OS', to: null, via: 'history' });
    expect(h.state.transition.phase).toBe('idle');
    expect(h.views.at(-1)).toEqual({ covered: false, failed: null });
    expect(h.flights).toHaveLength(2); // a return flight from full screen to the card
    h.flights[1]!.land();
    await waitFor(() => expect(h.overlays()).toHaveLength(0));
  });

  it('the last click wins and a resize retargets the flight', () => {
    const h = harness();
    h.stage.enter('macos', 'macOS');
    h.stage.enter('linux', 'Linux');
    expect(h.flights[0]!.killed).toBe(true);
    expect(h.overlays()).toHaveLength(1);
    expect(h.state.transition).toMatchObject({ phase: 'exiting', to: 'linux' });
    window.dispatchEvent(new Event('resize'));
    expect(h.flights[1]!.retargets).toBe(1);
    h.stage.dispose();
    expect(h.overlays()).toHaveLength(0);
  });
});

describe('CHOOSE-FAIL-01 a failed chunk', () => {
  it('flies back, owns the failure (no generic screen) and retries into a fresh flight', async () => {
    const h = harness();
    h.stage.enter('linux', 'Linux');
    h.flights[0]!.land();
    await tick();
    const epoch = h.state.epoch;
    h.dispatch({ type: 'TRANSITION_FAILED', epoch, reason: 'offline' });
    expect(h.state.transition.phase).toBe('failed');
    expect(isClaimed(epoch, 'failed')).toBe(true);
    expect(h.views.at(-1)).toEqual({ covered: false, failed: 'linux' });
    h.flights[1]!.land(); // the return flight
    await waitFor(() => expect(h.overlays()).toHaveLength(0));

    h.stage.retry('linux', 'Linux');
    expect(h.state.transition).toMatchObject({ phase: 'loading', to: 'linux' });
    expect(isClaimed(epoch, 'failed')).toBe(false); // released once the kernel left `failed`
    expect(h.views.at(-1)).toEqual({ covered: false, failed: null });
    expect(h.overlays()).toHaveLength(1);
    h.flights[2]!.land();
    await tick();
    h.dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch: h.state.epoch } });
    await waitFor(() => expect(h.state.transition.phase).toBe('idle'));
    expect(h.state.activeOs).toBe('linux');
  });

  it('the kernel’s own retry (the online event) flies the failed card again, like Retry', async () => {
    const h = harness();
    h.stage.enter('linux', 'Linux');
    h.flights[0]!.land();
    await tick();
    h.dispatch({ type: 'TRANSITION_FAILED', epoch: h.state.epoch, reason: 'offline' });
    h.flights[1]!.land();
    await waitFor(() => expect(h.overlays()).toHaveLength(0));

    h.dispatch({ type: 'RETRY_TRANSITION' }); // what TransitionDriver dispatches on `online`
    const epoch = h.state.epoch;
    expect(h.state.transition).toMatchObject({ phase: 'loading', to: 'linux' });
    expect(h.views.at(-1)).toEqual({ covered: false, failed: null });
    expect(h.announced.filter((message) => message === 'Entering Linux')).toHaveLength(2);
    expect(h.overlays()).toHaveLength(1);
    expect(isClaimed(epoch, 'entering') && isClaimed(epoch, 'failed')).toBe(true);
    h.flights[2]!.land();
    await tick();
    h.dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch } });
    await waitFor(() => expect(h.state.transition.phase).toBe('idle'));
    expect(h.state.activeOs).toBe('linux');
  });

  it('a plain switch after a failure is not mistaken for a retry', async () => {
    const h = harness();
    h.stage.enter('linux', 'Linux');
    h.flights[0]!.land();
    await tick();
    h.dispatch({ type: 'TRANSITION_FAILED', epoch: h.state.epoch, reason: 'chunk' });
    h.flights[1]!.land();
    await waitFor(() => expect(h.overlays()).toHaveLength(0));
    h.stage.enter('windows', 'Windows 11'); // the visitor chooses another card instead
    const epoch = h.state.epoch;
    expect(h.state.transition).toMatchObject({ phase: 'loading', to: 'windows' }); // nothing left to exit
    expect(h.views.at(-1)).toEqual({ covered: false, failed: null });
    expect(h.overlays()).toHaveLength(1);
    expect(h.flights.at(-1)!.el).toBe(h.overlays()[0]);
    expect(isClaimed(epoch, 'entering') && isClaimed(epoch, 'failed')).toBe(true);
    h.flights.at(-1)!.land();
    await tick();
    expect(h.state.transition.phase).toBe('loading'); // the driver, not the stage, completes loading
    h.dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch } });
    expect(h.state.transition).toMatchObject({ phase: 'entering', to: 'windows' });
  });
});

/** Enter macOS through the stage and settle it idle on macOS (the chunk "loads" when the test says so). */
async function enterMacos(h: ReturnType<typeof harness>) {
  h.stage.enter('macos', 'macOS');
  h.flights.at(-1)!.land();
  await tick();
  return h.state.epoch;
}

describe('CHOOSE-EXIT-01 the return flight after a leaving OS’s exit beat', () => {
  it('reduced motion: the foyer uncovers and the kernel settles on the chooser, focus on the card', async () => {
    const h = harness({ returning: true });
    const epoch = await enterMacos(h);
    h.dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch } }); // loading → entering
    await waitFor(() => expect(h.state.transition.phase).toBe('idle'));
    expect(h.state.activeOs).toBe('macos');
    h.dispatch({ type: 'ROUTE_CHANGED', url: '/' }); // Back: macOS exits (its beat owns the phase)
    expect(h.state.transition).toMatchObject({ phase: 'exiting', from: 'macos', to: null });
    expect(h.stage.returnFrom('macos', h.state.epoch, 'macOS')).toBe(true);
    expect(h.views.at(-1)).toEqual({ covered: false, failed: null });
    expect(h.state.transition.phase).toBe('idle');
    expect(h.state.activeOs).toBeNull();
    expect(h.results.at(-1)!.focusTarget?.candidates[0]).toBe('chooser-card:macos');
    expect(h.overlays()).toHaveLength(0); // no flight under reduced motion
  });

  it('full motion: the snapshot appears over the leaving OS, then flies back into its re-measured card', async () => {
    const h = harness();
    const epoch = await enterMacos(h);
    h.dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch } });
    await waitFor(() => expect(h.state.transition.phase).toBe('idle'));
    delete document.documentElement.dataset.motion;
    h.dispatch({ type: 'ROUTE_CHANGED', url: '/' });
    const flightsBefore = h.flights.length;
    expect(h.stage.returnFrom('macos', h.state.epoch, 'macOS')).toBe(true);
    expect(h.overlays()).toHaveLength(1);
    expect(h.shot('macos').style.visibility).toBe('hidden');
    // After the overlay's 90 ms fade-in the kernel settles and the flight into the card starts.
    await waitFor(() => expect(h.flights.length).toBe(flightsBefore + 1));
    expect(h.state.transition.phase).toBe('idle');
    expect(h.views.at(-1)).toEqual({ covered: false, failed: null });
    h.flights.at(-1)!.land();
    await waitFor(() => expect(h.overlays()).toHaveLength(0));
    expect(h.shot('macos').style.visibility).toBe('');
  });

  it('declines (the OS completes its own exit) when there is no card for that OS', async () => {
    const h = harness();
    expect(h.stage.returnFrom('ios', h.state.epoch, 'iOS')).toBe(false);
  });

  it('a chooser mounted under a leaving OS uncovers itself if the OS finished without a return flight', async () => {
    const h = harness({ returning: true });
    // macOS reached without this stage (e.g. a deep link), idle and live:
    h.dispatch({ type: 'SWITCH_OS', to: 'macos', via: 'switch' });
    for (let step = 0; step < 3; step++)
      h.dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch: h.state.epoch } });
    expect(h.state).toMatchObject({ activeOs: 'macos', transition: { phase: 'idle' } });
    h.dispatch({ type: 'ROUTE_CHANGED', url: '/' });
    const views = h.views.length;
    h.dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch: h.state.epoch } }); // the OS completed it itself
    expect(h.views.slice(views)).toContainEqual({ covered: false, failed: null });
  });
});

describe('CHOOSE-ENTER-02 the boot frame', () => {
  const shell = () => {
    const el = document.createElement('div');
    el.dataset.osShell = 'macos';
    return el;
  };

  it('a chunk still loading after the delay shows that OS’s boot frame once; it ends in a crossfade', async () => {
    delete document.documentElement.dataset.motion;
    const boots: (string | null)[] = [];
    const h = harness({ onBoot: (os) => boots.push(os), bootable: ['macos'], bootDelayMs: 5 });
    const epoch = await enterMacos(h);
    expect(h.state.transition.phase).toBe('loading');
    await waitFor(() => expect(boots).toEqual(['macos']));
    expect(h.state.sessions.macos.bootSeen).toBe(true);
    expect(h.announced).toContain('Starting macOS');
    document.body.append(shell()); // the shell mounted
    h.dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch } }); // the chunk resolved
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' })); // any input drops the hold
    await waitFor(() => expect(h.state.transition.phase).toBe('idle'), { timeout: 3000 });
    expect(boots).toEqual(['macos', null]);
    expect(h.announced).toContain('macOS ready');
    expect(h.overlays()).toHaveLength(0);
  });

  it('a cached chunk (loaded before the delay) never shows it; reduced motion never shows it', async () => {
    delete document.documentElement.dataset.motion;
    const boots: (string | null)[] = [];
    const h = harness({ onBoot: (os) => boots.push(os), bootable: ['macos'], bootDelayMs: 40 });
    const epoch = await enterMacos(h);
    h.dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch } }); // resolved at once
    await waitFor(() => expect(h.state.transition.phase).toBe('idle'));
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(boots).toEqual([]);

    document.documentElement.dataset.motion = 'reduced';
    const r = harness({ onBoot: (os) => boots.push(os), bootable: ['macos'], bootDelayMs: 5 });
    await enterMacos(r);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(boots).toEqual([]);
  });

  it('only OSes with a boot surface get one', async () => {
    delete document.documentElement.dataset.motion;
    const boots: (string | null)[] = [];
    const h = harness({ onBoot: (os) => boots.push(os), bootable: ['macos'], bootDelayMs: 5 });
    h.stage.enter('linux', 'Linux');
    h.flights.at(-1)!.land();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(boots).toEqual([]);
  });
});
