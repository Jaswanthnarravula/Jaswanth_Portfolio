/**
 * The chooser's enter and return transitions — plans/04-os-chooser.md "The enter transition" (`CHOOSE-ENTER-01`,
 * `CHOOSE-ENTER-02`, `CHOOSE-FAIL-01`, `CHOOSE-RM-01`) and "The exit transition" (`CHOOSE-EXIT-01`). Imperative (no
 * React state per frame), driven by the kernel's switch machine:
 *   click → SWITCH_OS (epoch bump; the URL is pushed by RouteSync) → the other cards dismiss (200 ms, 30 ms stagger)
 *   while the chosen card's snapshot flies to full screen (spring r 0.55 ζ 0.9) → PHASE_DONE → the OS chunk loads
 *   under the snapshot → `entering` → 180 ms crossfade from the snapshot to the live shell → PHASE_DONE.
 *   Boot frame: if the chunk is still loading 150 ms into `loading` on the OS's first chooser entry this session, that
 *   OS's boot screen covers the snapshot; its bar follows real milestones (chunk resolved 0.6 → shell mounted 0.9 →
 *   first frame 1), holds 120 ms, crossfades 180 ms; any key or press drops the extra beats. Cached → no boot frame.
 *   Esc or Back mid-flight reverses into the card (focus returns to it); a chunk failure flies back and the card
 *   offers Retry. Any retry of that failure — the card's Retry or the kernel's own on the `online` event — flies the
 *   card again. Last click wins. Reduced motion: every flight is a 150 ms crossfade and there is no boot frame.
 *   Return: after a leaving OS's exit beat, `returnFrom` shows that OS's snapshot full screen and shrinks it back into
 *   its re-measured card while the foyer fades in around it.
 * The stage claims the phases it animates (stores/transition-stage), so the TransitionDriver leaves them alone.
 */
import { gsap } from 'gsap';
import type { KernelAction } from '@/lib/kernel/actions';
import type { OsId } from '@/lib/kernel/ids';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { flight, type Flight, type Rect } from '@/lib/motion/flight';
import { SPRINGS, type SpringConfig } from '@/lib/motion/spring';
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
  /** The kernel's current state (the boot frame's rules read `bootSeen` and the live transition). */
  readonly getState?: () => KernelState;
  /** Show (an OS) or hide (null) that OS's boot frame over the snapshot. */
  readonly onBoot?: (os: OsId | null) => void;
  /** OSes whose boot surface exists (each OS brings its own in its phase). */
  readonly bootable?: readonly OsId[];
  /** How long a chunk may load before the boot frame appears (plans/04 step 4: 150 ms). */
  readonly bootDelayMs?: number;
  /** The chooser mounted underneath a leaving OS (its return flight, or the kernel going idle, uncovers it). */
  readonly returning?: boolean;
}

interface BootRun {
  skip: boolean;
  /** Called when the visitor presses a key or the pointer during the boot frame. */
  onSkip: (() => void) | null;
  readonly stop: () => void;
}

interface Run {
  readonly os: OsId;
  readonly label: string;
  readonly overlay: HTMLElement;
  readonly releases: (() => void)[];
  flight: Flight | null;
  dismiss: gsap.core.Tween | null;
  phase: 'flying' | 'covered' | 'revealing' | 'returning';
  boot: BootRun | null;
  bootTimer: ReturnType<typeof setTimeout> | null;
}

const REVEAL_S = 0.18;
const BOOT_HOLD_S = 0.12;
const BOOT_STEP_S = 0.2;
const BOOT_DELAY_MS = 150;
const SHELL_WAIT_MS = 1000;
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
  /**
   * The rest of a leaving OS's exit (it played its beat): its snapshot shrinks back into its card and the kernel
   * settles on the chooser. Returns false when this stage cannot (no such card), so the OS completes the phase.
   */
  returnFrom(os: OsId, epoch: Epoch, label: string): boolean;
  dispose(): void;
}

export function createChooserStage(deps: ChooserStageDeps): ChooserStage {
  const { root } = deps;
  const fly = deps.fly ?? flight;
  const bootable = deps.bootable ?? [];
  let run: Run | null = null;
  let failedClaim: (() => void) | null = null;
  /** The card whose chunk failed, until the visitor retries or chooses again. */
  let failedCard: { readonly os: OsId; readonly label: string } | null = null;
  let coveredForReturn = deps.returning ?? false;

  const shotOf = (os: OsId) => root.querySelector<HTMLElement>(`[data-chooser-card="${os}"] [data-shot]`);
  const faders = (os: OsId) =>
    [...root.querySelectorAll<HTMLElement>('[data-chooser-fade]')].filter((el) => el.dataset.chooserFade !== os);
  const radiusOf = (el: HTMLElement) => Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  const flightOptions = (radius: readonly [number, number], spring: SpringConfig = SPRINGS.chooserFlight) => ({
    spring,
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

  function stopBoot(current: Run) {
    if (current.bootTimer) clearTimeout(current.bootTimer);
    current.bootTimer = null;
    if (!current.boot) return;
    current.boot.stop();
    current.boot = null;
    deps.onBoot?.(null);
  }

  function cleanup(current: Run) {
    current.flight?.kill();
    current.dismiss?.kill();
    stopBoot(current);
    gsap.set(faders(current.os), { clearProps: 'opacity,transform' });
    shotOf(current.os)?.style.removeProperty('visibility');
    current.overlay.remove();
    for (const release of current.releases) release();
    if (run === current) run = null;
  }

  function launch(
    os: OsId,
    label: string,
    epoch: Epoch,
    phases: Parameters<typeof claimPhases>[1],
    completeExit: boolean,
  ) {
    const shot = shotOf(os);
    if (!shot) return;
    const current: Run = {
      os,
      label,
      overlay: makeOverlay(shot),
      releases: [claimPhases(epoch, phases)],
      flight: null,
      dismiss: null,
      phase: 'flying',
      boot: null,
      bootTimer: null,
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
      else scheduleBoot(current, epoch);
    });
  }

  /** CHOOSE-ENTER-02: the boot frame appears only if the chunk is still loading after 150 ms. */
  function scheduleBoot(current: Run, epoch: Epoch) {
    if (current.bootTimer || current.boot || !deps.onBoot || !bootable.includes(current.os)) return;
    current.bootTimer = setTimeout(() => {
      current.bootTimer = null;
      showBoot(current, epoch);
    }, deps.bootDelayMs ?? BOOT_DELAY_MS);
  }

  function showBoot(current: Run, epoch: Epoch) {
    if (run !== current || current.phase !== 'covered' || prefersReducedMotion()) return;
    const state = deps.getState?.();
    const t = state?.transition;
    if (!state || !t || t.phase !== 'loading' || t.epoch !== epoch || t.to !== current.os) return;
    if (state.sessions[current.os].bootSeen) return; // first chooser entry per session only
    const lifecycle = new AbortController();
    const boot: BootRun = { skip: false, onSkip: null, stop: () => lifecycle.abort() };
    const skip = () => {
      boot.skip = true;
      boot.onSkip?.();
    };
    window.addEventListener('keydown', skip, { capture: true, signal: lifecycle.signal });
    window.addEventListener('pointerdown', skip, { capture: true, signal: lifecycle.signal });
    current.boot = boot;
    deps.onBoot?.(current.os);
    deps.dispatch({ type: 'MARK_BOOT_SEEN', os: current.os });
    deps.announce(`Starting ${current.label}`);
  }

  function reveal(current: Run, epoch: Epoch) {
    current.phase = 'revealing';
    current.releases.push(claimPhases(epoch, ['entering']));
    current.flight?.finish();
    if (current.boot) {
      bootReveal(current, epoch);
      return;
    }
    stopBoot(current);
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

  /** The boot bar follows real milestones, then holds and crossfades (a key or press drops the hold). */
  function bootReveal(current: Run, epoch: Epoch) {
    const boot = current.boot!;
    const alive = () => run === current && current.boot === boot;
    const bar = () => document.querySelector<HTMLElement>('[data-boot-bar]');
    const frame = () => document.querySelector<HTMLElement>('[data-boot]');
    const step = (to: number) =>
      new Promise<void>((resolve) => {
        const target = bar();
        if (!target || boot.skip) {
          if (target) gsap.set(target, { scaleX: to });
          resolve();
          return;
        }
        gsap.to(target, { scaleX: to, duration: BOOT_STEP_S, ease: 'power2.out', onComplete: resolve });
      });
    const mounted = () =>
      new Promise<void>((resolve) => {
        const started = performance.now();
        const check = () => {
          if (
            document.querySelector(`[data-os-shell="${current.os}"]`) ||
            performance.now() - started > SHELL_WAIT_MS
          ) {
            gsap.ticker.remove(check);
            resolve();
          }
        };
        gsap.ticker.add(check);
        check();
      });
    const hold = () =>
      new Promise<void>((resolve) => {
        if (boot.skip) return resolve();
        const call = gsap.delayedCall(BOOT_HOLD_S, resolve);
        boot.onSkip = () => {
          call.kill();
          resolve();
        };
      });
    void (async () => {
      await step(0.6); // the chunk resolved
      await mounted();
      if (!alive()) return;
      await step(0.9); // the shell mounted
      await step(1); // its first frame settled
      if (!alive()) return;
      await hold();
      if (!alive()) return;
      deps.announce(`${current.label} ready`);
      gsap.to([frame(), current.overlay].filter(Boolean), {
        opacity: 0,
        duration: REVEAL_S,
        ease: 'power1.out',
        onComplete: () => {
          cleanup(current);
          deps.dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch } });
        },
      });
    })();
  }

  function returnToCard(current: Run, completeEpoch: Epoch | null, failed: OsId | null = null) {
    if (current.phase === 'returning') return;
    const wasFlying = current.phase === 'flying';
    current.phase = 'returning';
    stopBoot(current);
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

  const uncover = () => {
    coveredForReturn = false;
    deps.onView({ covered: false, failed: null });
  };

  const unsubscribe = deps.subscribe((effect) => {
    const t = effect.state.transition;
    if (failedClaim && t.phase !== 'failed') {
      failedClaim();
      failedClaim = null;
    }
    const current = run;
    if (!current) {
      // A retry of the failed card (Retry, or the kernel's own on `online`): the loading phase flies it again.
      if (t.phase === 'loading' && effect.previous.transition.phase === 'failed' && failedCard?.os === t.to) {
        const { os, label } = failedCard;
        failedCard = null;
        deps.onView({ covered: false, failed: null });
        deps.announce(`Entering ${label}`);
        launch(os, label, t.epoch, ['entering', 'failed'], false);
      }
      // A leaving OS finished its own exit without a return flight: show the foyer.
      if (coveredForReturn && t.phase === 'idle' && effect.state.activeOs === null) uncover();
      return;
    }
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
          failedCard = { os: current.os, label: current.label };
          returnToCard(current, null, current.os);
        }
        return;
      case 'loading':
        if (t.to === current.os && current.phase === 'covered') scheduleBoot(current, t.epoch);
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
      failedCard = null;
      coveredForReturn = false;
      const { state } = deps.dispatch({ type: 'SWITCH_OS', to: os, via: 'chooser' });
      const t = state.transition;
      // From the chooser the kernel exits first; after a failure there is nothing to exit, so it loads directly.
      if ((t.phase !== 'exiting' && t.phase !== 'loading') || t.to !== os) return;
      deps.onView({ covered: false, failed: null });
      deps.announce(`Entering ${label}`);
      if (t.phase === 'exiting') launch(os, label, t.epoch, ['exiting', 'entering', 'failed'], true);
      else launch(os, label, t.epoch, ['entering', 'failed'], false);
    },
    retry(os, label) {
      if (run) cleanup(run);
      failedCard = { os, label };
      deps.dispatch({ type: 'RETRY_TRANSITION' }); // its loading phase flies the card (the subscriber above)
    },
    cancel() {
      if (!run || run.phase === 'returning' || run.phase === 'revealing') return false;
      deps.dispatch({ type: 'SWITCH_OS', to: null, via: 'chooser' });
      return true;
    },
    returnFrom(os, epoch, label) {
      const shot = shotOf(os);
      if (!shot) return false;
      if (run) cleanup(run);
      const settle = () => {
        uncover();
        deps.dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch } }); // idle on the chooser; focus → card
      };
      if (prefersReducedMotion()) {
        // Reduced motion: no flight — the foyer crossfades in over 150 ms.
        settle();
        gsap.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: 'none', clearProps: 'opacity' });
        return true;
      }
      const current: Run = {
        os,
        label,
        overlay: makeOverlay(shot),
        releases: [],
        flight: null,
        dismiss: null,
        phase: 'returning',
        boot: null,
        bootTimer: null,
      };
      run = current;
      const screen = full();
      Object.assign(current.overlay.style, {
        position: 'fixed',
        left: '0px',
        top: '0px',
        width: `${screen.width}px`,
        height: `${screen.height}px`,
        opacity: '0',
      });
      shot.style.visibility = 'hidden';
      gsap.set(faders(os), { opacity: 0, y: 10 });
      // The OS's snapshot fades in over its (now empty) desktop, then shrinks back into its re-measured card.
      gsap.to(current.overlay, {
        opacity: 1,
        duration: 0.09,
        ease: 'none',
        onComplete: () => {
          if (run !== current) return;
          settle();
          current.dismiss = gsap.to(faders(os), {
            opacity: 1,
            y: 0,
            duration: 0.24,
            stagger: 0.03,
            ease: 'power2.out',
            clearProps: 'opacity,transform',
          });
          const back = fly(
            current.overlay,
            screen,
            rectOf(shot),
            flightOptions([0, radiusOf(shot)], SPRINGS.chooserReturn),
          );
          current.flight = back;
          void back.done.then(() => {
            if (run === current) cleanup(current);
          });
        },
      });
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
