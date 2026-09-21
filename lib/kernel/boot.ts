/**
 * The idempotent boot sequence — shared/01 `ARCH-HYDR-01` step 3: detect capabilities → rehydrate prefs → rehydrate
 * sessions → dispatch `BOOT{url, navType, viewport}`. Safe under StrictMode double effects (the reducer ignores a
 * second BOOT). Also owns the rAF-debounced viewport listener (`RESP-ROT-01`).
 */
import type { KernelAction, NavigationType } from './actions';
import { browserCapabilities } from './capabilities';
import type { PointerKind } from './geometry';
import { readPersistedSessions } from './persist/storage';

export function currentPointer(): PointerKind {
  if (typeof window === 'undefined') return 'fine';
  if (window.matchMedia('(pointer: coarse)').matches) return 'coarse';
  return window.matchMedia('(pointer: fine)').matches ? 'fine' : 'none';
}

export function navigationType(): NavigationType {
  try {
    const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const type: string | undefined = entry?.type;
    return type === 'reload' || type === 'back_forward' || type === 'prerender' ? type : 'navigate';
  } catch {
    return 'navigate';
  }
}

export function bootAction(): KernelAction {
  return {
    type: 'BOOT',
    url: window.location.pathname,
    navType: navigationType(),
    viewport: { w: window.innerWidth, h: window.innerHeight, pointer: currentPointer() },
    persisted: readPersistedSessions(),
    capabilities: browserCapabilities(),
  };
}

/**
 * Marks this page load's Shell instance (e2e: the id must survive app opens, OS switches and Back/Forward — proof that
 * in-OS navigation never reloads the document, `ARCH-SHELL-01`).
 */
export function markShellInstance(root: HTMLElement = document.documentElement): string {
  root.dataset.shellInstance ??= `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return root.dataset.shellInstance;
}

/** rAF-debounced resize / rotation → `VIEWPORT_CHANGED`. */
export function watchViewport(dispatch: (action: KernelAction) => void): () => void {
  const lifecycle = new AbortController();
  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() =>
      dispatch({ type: 'VIEWPORT_CHANGED', w: window.innerWidth, h: window.innerHeight, pointer: currentPointer() }),
    );
  };
  window.addEventListener('resize', schedule, { passive: true, signal: lifecycle.signal });
  window.addEventListener('orientationchange', schedule, { passive: true, signal: lifecycle.signal });
  return () => {
    lifecycle.abort();
    cancelAnimationFrame(frame);
  };
}
