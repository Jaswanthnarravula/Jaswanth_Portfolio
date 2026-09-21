/** History adapters: native (default), Next router, and an in-memory double (shared/12 test doubles). */
import type { HistoryEntryState, HistoryPort, PopEvent } from './port';

type HistoryWindow = Pick<Window, 'history' | 'location' | 'addEventListener' | 'removeEventListener'>;

/**
 * Native adapter: `history.pushState/replaceState` integrate with the Next.js router (documented behaviour), so
 * opening an app never costs an RSC round trip. Next merges its own internals into the state we pass.
 */
export function createNativeHistory(win: HistoryWindow = window): HistoryPort {
  return {
    name: 'native',
    url: () => win.location.pathname,
    state: () => win.history.state as unknown,
    push: (state, url) => win.history.pushState(state, '', url),
    replace: (state, url) => win.history.replaceState(state, '', url),
    back: () => win.history.back(),
    listen(onPop) {
      const handler = (event: PopStateEvent) => onPop({ url: win.location.pathname, state: event.state as unknown });
      win.addEventListener('popstate', handler);
      return () => win.removeEventListener('popstate', handler);
    },
  };
}

export interface RouterLike {
  push(href: string, options?: { scroll?: boolean }): void;
  replace(href: string, options?: { scroll?: boolean }): void;
  back(): void;
}

/**
 * Next-router adapter: navigations go through `router.push/replace` (full RSC navigation to the static page); our
 * entry state is attached with `history.replaceState` once the router has committed the URL.
 */
export function createNextRouterHistory(
  router: RouterLike,
  win: HistoryWindow = window,
  nextFrame: (callback: () => void) => void = (callback) => void requestAnimationFrame(callback),
): HistoryPort & { settled(): boolean } {
  let attaching: { url: string; state: HistoryEntryState; tries: number } | null = null;
  const attach = () => {
    if (!attaching) return;
    if (win.location.pathname === attaching.url || attaching.tries > 60) {
      if (win.location.pathname === attaching.url) win.history.replaceState(attaching.state, '', attaching.url);
      attaching = null;
      return;
    }
    attaching.tries++;
    nextFrame(attach);
  };
  return {
    name: 'next-router',
    url: () => win.location.pathname,
    state: () => (attaching ? attaching.state : (win.history.state as unknown)),
    push(state, url) {
      router.push(url, { scroll: false });
      attaching = { url, state, tries: 0 };
      nextFrame(attach);
    },
    replace(state, url) {
      if (win.location.pathname === url) win.history.replaceState(state, '', url);
      else {
        router.replace(url, { scroll: false });
        attaching = { url, state, tries: 0 };
        nextFrame(attach);
      }
    },
    back: () => router.back(),
    listen(onPop) {
      const handler = (event: PopStateEvent) => onPop({ url: win.location.pathname, state: event.state as unknown });
      win.addEventListener('popstate', handler);
      return () => win.removeEventListener('popstate', handler);
    },
    settled: () => attaching === null,
  };
}

export interface MemoryHistory extends HistoryPort {
  readonly entries: readonly { url: string; state: unknown }[];
  readonly index: number;
  forward(): void;
  /** Deliver any pending popstate now (tests). */
  flush(): void;
}

/** In-memory double with real `history` semantics: `back()` is asynchronous and fires one popstate. */
export function createMemoryHistory(initialUrl = '/', { sync = false }: { sync?: boolean } = {}): MemoryHistory {
  const entries: { url: string; state: unknown }[] = [{ url: initialUrl, state: null }];
  let index = 0;
  const listeners = new Set<(event: PopEvent) => void>();
  const queued: (() => void)[] = [];
  const emit = () => {
    const entry = entries[index]!;
    for (const listener of listeners) listener({ url: entry.url, state: entry.state });
  };
  const traverse = (delta: number) => {
    // Like a browser, each queued traversal moves relative to wherever history is when it runs.
    const run = () => {
      const target = index + delta;
      if (target < 0 || target >= entries.length) return;
      index = target;
      emit();
    };
    if (sync) run();
    else queued.push(run);
  };
  return {
    name: 'memory',
    get entries() {
      return entries;
    },
    get index() {
      return index;
    },
    url: () => entries[index]!.url,
    state: () => entries[index]!.state,
    push(state, url) {
      entries.splice(index + 1, entries.length, { url, state });
      index = entries.length - 1;
    },
    replace(state, url) {
      entries[index] = { url, state };
    },
    back: () => traverse(-1),
    forward: () => traverse(1),
    flush() {
      while (queued.length) queued.shift()!();
    },
    listen(onPop) {
      listeners.add(onPop);
      return () => listeners.delete(onPop);
    },
  };
}
