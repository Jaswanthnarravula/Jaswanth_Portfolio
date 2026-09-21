/**
 * RouteSync — shared/05. Binds the history controller to kernel effects. It is the only writer of history:
 *   effect.routeIntent → go / canonicalize the URL of the new state; popstate → ROUTE_CHANGED (never writes).
 * Next.js caveats handled here only: first write deferred one frame after mount; `history.state` never spread;
 * `scrollRestoration = 'manual'`; `document.title` set with the same function as `generateMetadata`;
 * bfcache restores (`pageshow.persisted`) reconcile without re-booting.
 */
import type { KernelAction } from './actions';
import { createHistoryController, type HistoryController } from './history/controller';
import type { HistoryPort } from './history/port';
import { sameRoute } from './state';
import type { KernelState, RouteIntent, RoutePath, RouteState } from './types';

export interface RouteSyncOptions {
  readonly port: HistoryPort;
  readonly getState: () => KernelState;
  readonly dispatch: (action: KernelAction) => void;
  readonly subscribe: (
    listener: (effect: { state: KernelState; previous: KernelState; routeIntent: RouteIntent }) => void,
  ) => () => void;
  readonly encode: (route: RouteState) => RoutePath;
  readonly title: (route: RouteState) => string;
  readonly onRoute?: (route: RouteState) => void;
}

export function startRouteSync(options: RouteSyncOptions): () => void {
  const { port, getState, dispatch, subscribe, encode, title, onRoute } = options;
  const lifecycle = new AbortController();
  // Listen from the start: a Back pressed before the first frame must reach the kernel, or the deferred first write
  // would overwrite the entry the visitor just returned to. Creating the controller writes nothing.
  const controller: HistoryController = createHistoryController({
    port,
    onPop: (url) => dispatch({ type: 'ROUTE_CHANGED', url }),
  });
  let started = false;
  let lastRoute: RouteState | null = null;

  let desiredTitle: string | null = null;
  const commitTitle = (route: RouteState) => {
    if (lastRoute && sameRoute(lastRoute, route)) return;
    lastRoute = route;
    desiredTitle = title(route);
    if (typeof document !== 'undefined') document.title = desiredTitle;
    onRoute?.(route);
  };
  // Next re-renders its metadata <title> after a shallow history write; the kernel's route title wins.
  const titleGuard =
    typeof MutationObserver !== 'undefined' && typeof document !== 'undefined'
      ? new MutationObserver(() => {
          if (desiredTitle !== null && document.title !== desiredTitle) document.title = desiredTitle;
        })
      : null;
  titleGuard?.observe(document.head, { childList: true, subtree: true, characterData: true });

  const unsubscribe = subscribe(({ state, routeIntent }) => {
    // Before the first frame only the kernel state moves; the first write below reads the latest state.
    if (!started) return;
    if (state.route.kind === 'plain' || state.route.kind === 'go') return;
    if (routeIntent) controller.write(routeIntent, encode(state.route));
    commitTitle(state.route);
  });

  if (typeof window !== 'undefined' && 'scrollRestoration' in window.history)
    window.history.scrollRestoration = 'manual';

  // Next.js patches `history` in an effect: our first write waits one frame after mount.
  const frame = requestAnimationFrame(() => {
    if (lifecycle.signal.aborted) return;
    started = true;
    const state = getState();
    if (state.route.kind !== 'plain' && state.route.kind !== 'go') controller.canonicalize(encode(state.route));
    commitTitle(state.route);
  });

  if (typeof window !== 'undefined')
    window.addEventListener(
      'pageshow',
      (event) => {
        if (event.persisted) dispatch({ type: 'ROUTE_CHANGED', url: window.location.pathname });
      },
      { signal: lifecycle.signal },
    );

  return () => {
    lifecycle.abort();
    titleGuard?.disconnect();
    cancelAnimationFrame(frame);
    unsubscribe();
    controller.dispose();
  };
}
