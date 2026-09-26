/**
 * Reader-page motion driver — shared/24 `READER-FX-02/04/05/09/10/12`. Pointer position, pointer speed, scroll speed
 * and on-screen state go straight to CSS custom properties and data attributes on the elements that use them (never
 * React state, never the root, so a write restyles one small subtree). One animation-frame loop eases every value and
 * sleeps as soon as all of them have settled. Scroll-linked motion itself is CSS (`animation-timeline`), not here.
 *
 * Hooks in the markup: `data-fx-nav` (section links), `data-fx-live` (on-screen only), `data-fx-vel` (scroll speed),
 * `data-fx-hero` + `data-fx-spot` + `data-fx-object` (hero light and object), `data-fx-tilt[="deg"]`, `data-fx-light`,
 * `data-fx-magnet`, `data-fx-type` (the About code card's typing loop, `code-typing.ts`).
 */

import { startCodeTyping } from './code-typing';

interface Channel {
  value: number;
  target: number;
  readonly unit: string;
  readonly epsilon: number;
  readonly decay: boolean;
}

interface WriteOptions {
  /** Start at the target instead of easing towards it (a light appearing under the pointer). */
  readonly jump?: boolean;
  /** The target itself relaxes to 0 (scroll speed). */
  readonly decay?: boolean;
}

/** Share of the remaining distance covered per 60 fps frame: ~300 ms to settle, so it trails the input and lands. */
const CATCH_UP = 0.16;
const FRAME = 1000 / 60;
const MAGNET_PULL = 0.3;
const MAGNET_MAX = 8;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const epsilonFor = (unit: string) => (unit === 'px' ? 0.05 : unit === 'deg' ? 0.01 : 0.001);

/**
 * Marks the section in view with `aria-current="location"` on every link to it (the header nav and the side rail).
 * Navigation state, so always on.
 */
function markActiveSection(root: HTMLElement): () => void {
  const links = new Map<string, HTMLAnchorElement[]>();
  for (const link of root.querySelectorAll<HTMLAnchorElement>('[data-fx-nav] a[href^="#"]')) {
    const id = link.hash.slice(1);
    links.set(id, [...(links.get(id) ?? []), link]);
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const [id, group] of links)
          for (const link of group)
            if (id === entry.target.id) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  for (const id of links.keys()) {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  }
  return () => {
    observer.disconnect();
    for (const group of links.values()) for (const link of group) link.removeAttribute('aria-current');
  };
}

/** Continuous decoration (request pulses) runs only while its block is on screen. */
function runWhileVisible(root: HTMLElement): () => void {
  const blocks = [...root.querySelectorAll<HTMLElement>('[data-fx-live]')];
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.toggleAttribute('data-fx-on', entry.isIntersecting);
  });
  for (const block of blocks) observer.observe(block);
  return () => {
    observer.disconnect();
    for (const block of blocks) block.removeAttribute('data-fx-on');
  };
}

export function startReaderFx(root: HTMLElement): () => void {
  const html = document.documentElement;
  const stops: Array<() => void> = [markActiveSection(root)];
  const stopAll = () => {
    for (const stop of stops) stop();
  };
  const reduced = html.dataset.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || html.dataset.tier === '0') return stopAll;
  stops.push(runWhileVisible(root));
  stops.push(startCodeTyping(root));

  const channels = new Map<HTMLElement, Map<string, Channel>>();
  let frame = 0;
  let last = 0;

  const tick = (now: number) => {
    const elapsed = last ? Math.min(now - last, 64) : FRAME;
    last = now;
    const k = 1 - Math.pow(1 - CATCH_UP, elapsed / FRAME);
    let moving = false;
    for (const [element, vars] of channels)
      for (const [name, channel] of vars) {
        if (channel.decay) {
          channel.target *= Math.pow(0.86, elapsed / FRAME);
          if (Math.abs(channel.target) < channel.epsilon) channel.target = 0;
        }
        const gap = channel.target - channel.value;
        const next = Math.abs(gap) < channel.epsilon ? channel.target : channel.value + gap * k;
        if (next !== channel.value) {
          channel.value = next;
          element.style.setProperty(name, `${Number(next.toFixed(3))}${channel.unit}`);
        }
        if (channel.value !== channel.target || (channel.target !== 0 && channel.decay)) moving = true;
      }
    frame = moving ? requestAnimationFrame(tick) : 0;
    if (!frame) last = 0;
  };

  const write = (element: HTMLElement, name: string, target: number, unit = '', options: WriteOptions = {}) => {
    let vars = channels.get(element);
    if (!vars) channels.set(element, (vars = new Map()));
    const channel = vars.get(name);
    if (channel) {
      channel.target = target;
      if (options.jump) channel.value = target;
    } else {
      const value = options.jump ? target : 0;
      vars.set(name, { value, target, unit, epsilon: epsilonFor(unit), decay: options.decay ?? false });
      if (options.jump) element.style.setProperty(name, `${Number(value.toFixed(3))}${unit}`);
    }
    if (!frame) frame = requestAnimationFrame(tick);
  };
  const valueOf = (element: HTMLElement, name: string) => channels.get(element)?.get(name)?.value ?? 0;

  // Scroll speed → `--fx-vel` (−1…1) on the few elements that lean with it.
  const leaners = [...root.querySelectorAll<HTMLElement>('[data-fx-vel]')];
  let lastY = scrollY;
  let lastT = performance.now();
  const onScroll = () => {
    const now = performance.now();
    const speed = clamp((scrollY - lastY) / Math.max(now - lastT, 8) / 3, -1, 1);
    lastY = scrollY;
    lastT = now;
    for (const element of leaners) write(element, '--fx-vel', speed, '', { decay: true });
  };
  addEventListener('scroll', onScroll, { passive: true });
  stops.push(() => removeEventListener('scroll', onScroll));

  // Pointer effects need a real pointer that hovers.
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const hero = root.querySelector<HTMLElement>('[data-fx-hero]');
    const spot = root.querySelector<HTMLElement>('[data-fx-spot]');
    const object = root.querySelector<HTMLElement>('[data-fx-object]');
    let card: HTMLElement | null = null;
    let panel: HTMLElement | null = null;
    let magnet: HTMLElement | null = null;
    let lastX = 0;
    let lastPY = 0;
    let lastPT = 0;

    const light = (element: HTMLElement, x: number, y: number, rect: DOMRect) => {
      const fresh = valueOf(element, '--fx-la') < 0.02;
      write(element, '--fx-lx', x - rect.left, 'px', { jump: fresh });
      write(element, '--fx-ly', y - rect.top, 'px', { jump: fresh });
      write(element, '--fx-la', 1);
    };
    const release = (element: HTMLElement | null) => {
      if (!element) return;
      write(element, '--fx-la', 0);
      if (element.hasAttribute('data-fx-tilt')) {
        write(element, '--fx-rx', 0, 'deg');
        write(element, '--fx-ry', 0, 'deg');
      }
    };
    const releaseMagnet = (element: HTMLElement | null) => {
      if (!element) return;
      write(element, '--fx-mx', 0, 'px');
      write(element, '--fx-my', 0, 'px');
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const { clientX: x, clientY: y } = event;
      const speed = lastPT ? Math.hypot(x - lastX, y - lastPY) / Math.max(event.timeStamp - lastPT, 8) : 0;
      lastX = x;
      lastPY = y;
      lastPT = event.timeStamp;

      if (hero && spot && object) {
        const rect = hero.getBoundingClientRect();
        const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        const fresh = valueOf(spot, '--fx-sa') < 0.02;
        write(spot, '--fx-sx', x - rect.left, 'px', { jump: fresh });
        write(spot, '--fx-sy', y - rect.top, 'px', { jump: fresh });
        write(spot, '--fx-sa', inside ? 1 : 0);
        // Cursor speed swells the light a little (READER-FX-05); it never replaces the cursor.
        write(spot, '--fx-ss', 1 + clamp(speed, 0, 2) * 0.12);
        const nx = inside ? (x - rect.left) / rect.width - 0.5 : 0;
        const ny = inside ? (y - rect.top) / rect.height - 0.5 : 0;
        write(object, '--fx-tx', nx * 18, 'deg');
        write(object, '--fx-ty', -ny * 14, 'deg');
      }

      const target = event.target instanceof Element ? event.target : null;
      const nextCard = target?.closest<HTMLElement>('[data-fx-tilt]') ?? null;
      if (card !== nextCard) release(card);
      card = nextCard;
      if (card) {
        const rect = card.getBoundingClientRect();
        const max = Number(card.dataset.fxTilt) || 5;
        light(card, x, y, rect);
        write(card, '--fx-rx', -((y - rect.top) / rect.height - 0.5) * max, 'deg');
        write(card, '--fx-ry', ((x - rect.left) / rect.width - 0.5) * max, 'deg');
      }

      const nextPanel = target?.closest<HTMLElement>('[data-fx-light]') ?? null;
      if (panel !== nextPanel) release(panel);
      panel = nextPanel;
      if (panel) light(panel, x, y, panel.getBoundingClientRect());

      const nextMagnet = target?.closest<HTMLElement>('[data-fx-magnet]') ?? null;
      if (magnet !== nextMagnet) releaseMagnet(magnet);
      magnet = nextMagnet;
      if (magnet) {
        const rect = magnet.getBoundingClientRect();
        const dx = x - (rect.left + rect.width / 2);
        const dy = y - (rect.top + rect.height / 2);
        write(magnet, '--fx-mx', clamp(dx * MAGNET_PULL, -MAGNET_MAX, MAGNET_MAX), 'px');
        write(magnet, '--fx-my', clamp(dy * MAGNET_PULL, -MAGNET_MAX, MAGNET_MAX), 'px');
      }
    };
    const onLeave = () => {
      release(card);
      release(panel);
      releaseMagnet(magnet);
      card = panel = magnet = null;
      if (spot) write(spot, '--fx-sa', 0);
      if (object) {
        write(object, '--fx-tx', 0, 'deg');
        write(object, '--fx-ty', 0, 'deg');
      }
    };
    root.addEventListener('pointermove', onMove, { passive: true });
    root.addEventListener('pointerleave', onLeave);
    stops.push(() => {
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
    });
  }

  stops.push(() => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    for (const [element, vars] of channels) for (const name of vars.keys()) element.style.removeProperty(name);
    channels.clear();
  });
  return stopAll;
}
