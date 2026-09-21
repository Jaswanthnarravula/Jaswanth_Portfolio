/**
 * The chooser's enter transition — plans/04-os-chooser.md "The enter transition" (`CHOOSE-ENTER-01`,
 * `CHOOSE-FAIL-01`, `CHOOSE-RM-01`). Imperative (no React state per frame), driven by the kernel's switch machine:
 *   click → SWITCH_OS (epoch bump; the URL is pushed by RouteSync) → the other cards dismiss (200 ms, 30 ms stagger)
 *   while the chosen card's snapshot flies to full screen (spring r 0.55 ζ 0.9) → PHASE_DONE → the OS chunk loads
 *   under the snapshot → `entering` → 180 ms crossfade from the snapshot to the live shell → PHASE_DONE.
 *   Esc or Back mid-flight reverses into the card (focus returns to it); a chunk failure flies back and the card
 *   offers Retry. Last click wins. Reduced motion: every flight is a 150 ms crossfade.
 * The stage claims the phases it animates (stores/transition-stage), so the TransitionDriver leaves them alone.
 */
import { gsap } from 'gsap';
import type { KernelAction } from '@/lib/kernel/actions';
import type { OsId } from '@/lib/kernel/ids';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { flight, type Flight, type Rect } from '@/lib/motion/flight';
import { SPRINGS } from '@/lib/motion/spring';
import type { KernelEffect } from '@/stores/kernel-store';
import { claimPhases } from '@/stores/transition-stage';
import type { Epoch, KernelState } from '@/lib/kernel/types';

export interface StageView {
  /** The snapshot covers the screen: the chooser underneath is hidden (the live shell shows through the fade). */
  readonly covered: boolean;
  /** An OS whose chunk failed to load: its card shows Retry. */
  readonly failed: OsId | null;
}

export interface ChooserStageDeps {
  readonly root: HTMLElement;
  readonly overlayClassName: string;
  readonly dispatch: (action: KernelAction) => { readonly state: KernelState };
  readonly subscribe: (listener: (effect: KernelEffect) => void) => () => void;
  readonly onView: (view: StageView) => void;
  readonly announce: (message: string) => void;
  /** The flight primitive (tests inject a controllable one). */
  readonly fly?: typeof flight;
}

interface Run {
  readonly os: OsId;
  readonly overlay: HTMLElement;
  readonly releases: (() => void)[];
  flight: Flight | null;
  dismiss: gsap.core.Tween | null;
  phase: 'flying' | 'covered' | 'revealing' | 'returning';
}

const REVEAL_S = 0.18;
const full = (): Rect => ({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight });
const rectOf = (el: Element): Rect => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
};

export interface ChooserStage {
  enter(os: OsId, label: string): void;
  retry(os: OsId, label: string): void;
  /** Esc: reverse whatever is in flight. Returns whether there was anything to reverse. */
  cancel(): boolean;
  dispose(): void;
}

export function createChooserStage(deps: ChooserStageDeps): ChooserStage {
  const { root } = deps;
  const fly = deps.fly ?? flight;
  let run: Run | null = null;
  let failedClaim: (() => void) | null = null;

  const shotOf = (os: OsId) => root.querySelector<HTMLElement>(`[data-chooser-card="${os}"] [data-shot]`);
  const faders = (os: OsId) =>
    [...root.querySelectorAll<HTMLElement>('[data-chooser-fade]')].filter((el) => el.dataset.chooserFade !== os);
  const radiusOf = (el: HTMLElement) => Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  const flightOptions = (radius: readonly [number, number]) => ({
    spring: SPRINGS.chooserFlight,
    radius,
    reduced: prefersReducedMotion(),
  });

  function makeOverlay(shot: HTMLElement): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = deps.overlayClassName;
    overlay.setAttribute('aria-hidden', 'true');
    const source = shot.querySelector('img');
    if (source) {
      const img = document.createElement('img');
      img.src = source.currentSrc || source.src;
      img.alt = '';
      overlay.append(img);
    }
    document.body.append(overlay);
    return overlay;
  }

  function cleanup(current: Run) {
    current.flight?.kill();
    current.dismiss?.kill();
    gsap.set(faders(current.os), { clearProps: 'opacity,transform' });
    shotOf(current.os)?.style.removeProperty('visibility');
    current.overlay.remove();
    for (const release of current.releases) release();
    if (run === current) run = null;
  }

  function launch(os: OsId, epoch: Epoch, phases: Parameters<typeof claimPhases>[1], completeExit: boolean) {
    const shot = shotOf(os);
    if (!shot) return;
    const current: Run = {
      os,
      overlay: makeOverlay(shot),
      releases: [claimPhases(epoch, phases)],
      flight: null,
      dismiss: null,
      phase: 'flying',
    };
    run = current;
    const from = rectOf(shot);
    shot.style.visibility = 'hidden'; // the overlay is the card's snapshot now
    const reduced = prefersReducedMotion();
    current.dismiss = gsap.to(faders(os), {
      opacity: 0,
      y: reduced ? 0 : 10,
      duration: reduced ? 0.15 : 0.2,
      stagger: reduced ? 0 : 0.03,
      ease: 'power2.out',
    });
    const forward = fly(current.overlay, from, full(), flightOptions([radiusOf(shot), 0]));
    current.flight = forward;
    void forward.done.then((end) => {
      if (run !== current || end !== 'landed' || current.phase !== 'flying') return;
      current.phase = 'covered';
      deps.onView({ covered: true, failed: null });
      if (completeExit) deps.dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch } });
    });
  }

  function returnToCard(current: Run, completeEpoch: Epoch | null, failed: OsId | null = null) {
    if (current.phase === 'returning') return;
    const wasFlying = current.phase === 'flying';
    current.phase = 'returning';
    deps.onView({ covered: false, failed });
    const shot = shotOf(current.os);
    let back: Flight | null = null;
    if (wasFlying && current.flight) {
      current.flight.reverse();
      back = current.flight;
    } else if (shot) {
      current.flight?.kill();
      back = fly(current.overlay, full(), rectOf(shot), flightOptions([0, radiusOf(shot)]));
      current.flight = back;
    }
    current.dismiss?.reverse();
    const finish = () => {
      cleanup(current);
      if (completeEpoch !== null) deps.dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch: completeEpoch } });
    };
    if (back) void back.done.then(finish);
    else finish();
  }

  function reveal(current: Run, epoch: Epoch) {
    current.phase = 'revealing';
    current.releases.push(claimPhases(epoch, ['entering']));
    current.flight?.finish();
    gsap.to(current.overlay, {
      opacity: 0,
      duration: prefersReducedMotion() ? 0.15 : REVEAL_S,
      ease: 'power1.out',
      onComplete: () => {
        cleanup(current);
        deps.dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch } });
      },
    });
  }

  const unsubscribe = deps.subscribe((effect) => {
    const t = effect.state.transition;
    if (failedClaim && t.phase !== 'failed') {
      failedClaim();
      failedClaim = null;
    }
    const current = run;
    if (!current) return;
    switch (t.phase) {
      case 'entering':
        if (t.to === current.os && current.phase !== 'revealing' && current.phase !== 'returning')
          reveal(current, t.epoch);
        return;
      case 'exiting':
        // Esc / Back mid-flight: the kernel runs the exit "from" the chosen OS back to the chooser.
        if (t.to === null && t.from === current.os) {
          current.releases.push(claimPhases(t.epoch, ['exiting']));
          returnToCard(current, t.epoch);
        }
        return;
      case 'idle':
        // Back while the chunk was loading: the kernel is already idle on the chooser.
        if (effect.state.activeOs === null && current.phase !== 'returning' && current.phase !== 'revealing')
          returnToCard(current, null);
        return;
      case 'failed':
        if (t.to === current.os) {
          failedClaim = claimPhases(t.epoch, ['failed']);
          returnToCard(current, null, current.os);
        }
        return;
      case 'loading':
        return;
    }
  });

  const onResize = () => {
    if (run && (run.phase === 'flying' || run.phase === 'covered')) run.flight?.retarget(full());
  };
  window.addEventListener('resize', onResize);

  return {
    enter(os, label) {
      if (run) cleanup(run); // last click wins
      const { state } = deps.dispatch({ type: 'SWITCH_OS', to: os, via: 'chooser' });
      const t = state.transition;
      if (t.phase !== 'exiting' || t.to !== os) return;
      deps.announce(`Entering ${label}`);
      launch(os, t.epoch, ['exiting', 'entering', 'failed'], true);
    },
    retry(os, label) {
      if (run) cleanup(run);
      const { state } = deps.dispatch({ type: 'RETRY_TRANSITION' });
      const t = state.transition;
      if (t.phase !== 'loading' || t.to !== os) return;
      deps.onView({ covered: false, failed: null });
      deps.announce(`Entering ${label}`);
      launch(os, t.epoch, ['entering', 'failed'], false);
    },
    cancel() {
      if (!run || run.phase === 'returning' || run.phase === 'revealing') return false;
      deps.dispatch({ type: 'SWITCH_OS', to: null, via: 'chooser' });
      return true;
    },
    dispose() {
      unsubscribe();
      window.removeEventListener('resize', onResize);
      if (run) cleanup(run);
      failedClaim?.();
    },
  };
}
