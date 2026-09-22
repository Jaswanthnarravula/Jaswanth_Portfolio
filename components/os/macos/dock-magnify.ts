/**
 * Dock magnification (plans/macos/surfaces/dock.md `MAC-DOCK-02`). Per icon: `scale = 1 + 0.6·cos²(πd / 2R)` with d the
 * pointer's distance to the icon's resting centre and R = 3 icon pitches; icons grow from their bottom edge and their
 * neighbours part through cumulative `translateX`, keeping the row centred. The whole effect is an envelope that
 * springs in and out (r 0.18, ζ 1) while the pointer x is tracked raw. Everything is written on GSAP's ticker as
 * transforms — no React state, no width changes, no layout reads after the entry measurement.
 */
import { gsap } from 'gsap';
import { spring, type Spring } from '@/lib/motion/spring';
import { MAC_TIMING } from './timing';

export const MAGNIFY_GAIN = 0.6;
export const MAGNIFY_REACH = 3; // icon pitches

/** The per-icon scales for a pointer x (pure — unit-tested). */
export function magnifyScales(centres: readonly number[], x: number, pitch: number, amount = 1): number[] {
  const reach = MAGNIFY_REACH * pitch;
  return centres.map((centre) => {
    const d = Math.abs(x - centre);
    if (d >= reach) return 1;
    const c = Math.cos((Math.PI * d) / (2 * reach));
    return 1 + amount * MAGNIFY_GAIN * c * c;
  });
}

/** Horizontal offsets that part the neighbours so scaled icons never overlap, keeping the row centred (pure). */
export function magnifyOffsets(scales: readonly number[], size: number): number[] {
  const extra = scales.map((scale) => (scale - 1) * size);
  const total = extra.reduce((sum, value) => sum + value, 0);
  let before = 0;
  return extra.map((value) => {
    const offset = before + value / 2 - total / 2;
    before += value;
    return offset;
  });
}

export interface DockMagnifier {
  /** The pointer entered the Dock (measures the resting centres once). */
  enter(x: number): void;
  move(x: number): void;
  leave(): void;
  kill(): void;
}

interface Target {
  readonly cell: HTMLElement;
  readonly icon: HTMLElement | null;
  readonly label: HTMLElement | null;
}

export function createMagnifier(list: HTMLElement, size: () => number): DockMagnifier {
  let targets: Target[] = [];
  let centres: number[] = [];
  let pitch = 52;
  let x = 0;
  let envelope: Spring | null = null;
  let running = false;

  const write = (amount: number) => {
    const scales = magnifyScales(centres, x, pitch, amount);
    const offsets = magnifyOffsets(scales, size());
    targets.forEach((target, index) => {
      const scale = scales[index]!;
      const offset = offsets[index]!;
      target.cell.style.transform = offset ? `translate3d(${offset}px, 0, 0)` : '';
      if (target.icon) target.icon.style.transform = scale !== 1 ? `scale(${scale})` : '';
      if (target.label) target.label.style.transform = `translate3d(-50%, ${-(scale - 1) * size()}px, 0)`;
    });
  };

  const tick = () => {
    if (!envelope) return;
    const now = performance.now();
    const amount = Math.max(0, envelope.sample(now).value);
    write(amount);
    if (envelope.target === 0 && envelope.atRest(now)) {
      stop();
      targets.forEach((target) => {
        target.cell.style.transform = '';
        if (target.icon) target.icon.style.transform = '';
        if (target.label) target.label.style.removeProperty('transform');
      });
    }
  };
  const start = () => {
    if (running) return;
    running = true;
    gsap.ticker.add(tick);
  };
  const stop = () => {
    running = false;
    gsap.ticker.remove(tick);
  };

  return {
    enter(pointerX) {
      // Resting centres are measured only while nothing is transformed (the envelope rested at 0); re-entering
      // mid-exit keeps the centres already known.
      if (!running) {
        targets = [...list.querySelectorAll<HTMLElement>('[data-magnify]')].map((cell) => ({
          cell,
          icon: cell.querySelector<HTMLElement>('[data-magnify-icon]'),
          label: cell.querySelector<HTMLElement>('[data-dock-label]'),
        }));
        centres = targets.map(({ cell }) => {
          const box = cell.getBoundingClientRect();
          return box.left + box.width / 2;
        });
        pitch = centres.length > 1 ? Math.abs(centres[1]! - centres[0]!) : size() + 4;
      }
      x = pointerX;
      const now = performance.now();
      envelope ??= spring(0, MAC_TIMING.dock.magnify, now);
      envelope.retarget(1, now);
      start();
    },
    move(pointerX) {
      x = pointerX;
    },
    leave() {
      if (!envelope) return;
      envelope.retarget(0, performance.now());
      start();
    },
    kill() {
      stop();
      targets.forEach((target) => {
        target.cell.style.transform = '';
        if (target.icon) target.icon.style.transform = '';
      });
    },
  };
}
