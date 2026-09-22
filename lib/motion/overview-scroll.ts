/**
 * The Overview page's scroll effects — shared/07 "Scroll (Lenis + ScrollTrigger) — narrowly scoped"
 * (`MOTION-SCROLL-01`, `MAC-SAF-03/04/06`). Only the long-form Overview inside a desktop browser app, on its own nested
 * scroller, with a fine pointer, tier ≥ 1 and full motion. Both libraries are dynamic imports, so they are requested
 * only when that page mounts and never under reduced motion, on touch or at tier 0. Lenis runs on GSAP's ticker
 * (`autoRaf: false`); ScrollTrigger uses the same scroller. Everything the page's `setup` creates lives in one GSAP
 * context, so the returned cleanup (window close / minimize) kills it all. Effects are enhancement only: content is
 * complete and visible without them.
 */
import { gsap } from 'gsap';
import { tickerAdded, tickerRemoved } from './debug';
import { prefersReducedMotion } from './dur';

export interface ScrollKit {
  readonly gsap: typeof gsap;
  readonly ScrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger;
  readonly scroller: HTMLElement;
}

/** Whether the effects may run here (fine pointer, tier ≥ 1, full motion). */
export function overviewScrollAllowed(root: HTMLElement = document.documentElement): boolean {
  if (prefersReducedMotion(root) || root.dataset.tier === '0') return false;
  return typeof matchMedia === 'function' && matchMedia('(pointer: fine) and (hover: hover)').matches;
}

/**
 * Attach smooth scrolling + scroll-linked reveals to `scroller` (its first child is the moving content). Resolves to
 * a cleanup; resolves to a no-op when the gate says no (nothing is downloaded then).
 */
export async function attachOverviewScroll(
  scroller: HTMLElement,
  setup: (kit: ScrollKit) => void,
  { signal }: { signal?: AbortSignal } = {},
): Promise<() => void> {
  if (!overviewScrollAllowed()) return () => undefined;
  const [{ default: Lenis }, { ScrollTrigger }] = await Promise.all([import('lenis'), import('gsap/ScrollTrigger')]);
  if (signal?.aborted || !scroller.isConnected) return () => undefined;
  gsap.registerPlugin(ScrollTrigger);
  const content = (scroller.firstElementChild as HTMLElement | null) ?? scroller;
  const lenis = new Lenis({ wrapper: scroller, content, autoRaf: false, smoothWheel: true });
  const offScroll = lenis.on('scroll', () => ScrollTrigger.update());
  const tick = (time: number) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  tickerAdded();
  const context = gsap.context(() => setup({ gsap, ScrollTrigger, scroller }), scroller);
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    context.revert();
    offScroll();
    gsap.ticker.remove(tick);
    tickerRemoved();
    lenis.destroy();
  };
  signal?.addEventListener('abort', cleanup, { once: true });
  return cleanup;
}

/** Re-measure after the scroller's size settles (a window resize commit — `MAC-SAF` edge cases). */
export async function refreshOverviewScroll(): Promise<void> {
  const { ScrollTrigger } = await import('gsap/ScrollTrigger');
  ScrollTrigger.refresh();
}
