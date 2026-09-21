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

function harness() {
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
});
