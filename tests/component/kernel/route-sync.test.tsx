/**
 * RouteSync + history adapters + boot glue (ROUTE-PORT-01, ROUTE-SER-01 integration, ARCH-HYDR-01 boot sequence).
 */
import { act, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootAction, currentPointer, navigationType, watchViewport } from '@/lib/kernel/boot';
import { browserCapabilities } from '@/lib/kernel/capabilities';
import { createMemoryHistory, createNativeHistory, createNextRouterHistory } from '@/lib/kernel/history/adapters';
import { readOsk } from '@/lib/kernel/history/port';
import {
  historyAdapterOverride,
  readPersistedSessions,
  writePersistedSessions,
  getSafeStorage,
} from '@/lib/kernel/persist/storage';
import { reduce } from '@/lib/kernel/reducers';
import { startRouteSync } from '@/lib/kernel/route-sync';
import { DEFAULT_CAPABILITIES, initialKernelState } from '@/lib/kernel/state';
import type { KernelAction } from '@/lib/kernel/actions';
import { routePath, type KernelState, type RouteIntent } from '@/lib/kernel/types';
import { makeDeps } from '../../fixtures/portfolio';

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

function harness(initialUrl: string, port = createMemoryHistory(initialUrl, { sync: true })) {
  const deps = makeDeps();
  let state: KernelState = initialKernelState();
  const listeners = new Set<
    (effect: { state: KernelState; previous: KernelState; routeIntent: RouteIntent }) => void
  >();
  const dispatch = (action: KernelAction) => {
    const previous = state;
    const result = reduce(state, action, deps);
    state = result.state;
    for (const listener of listeners) listener({ state, previous, routeIntent: result.routeIntent });
  };
  const routes: string[] = [];
  const stop = startRouteSync({
    port,
    getState: () => state,
    dispatch,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    encode: deps.codec.encode,
    title: (route) => `title:${deps.codec.encode(route)}`,
    onRoute: (route) => routes.push(deps.codec.encode(route)),
  });
  return {
    port,
    dispatch,
    get state() {
      return state;
    },
    routes,
    stop,
    deps,
  };
}

describe('RouteSync binds kernel effects to history', () => {
  afterEach(() => {
    document.title = '';
  });

  it('canonicalizes one frame after mount, then writes go() for each route intent, sets titles', async () => {
    const h = harness('/macos/preview/resume');
    h.dispatch({
      type: 'BOOT',
      url: '/macos/preview/resume',
      navType: 'navigate',
      viewport: { w: 1440, h: 900, pointer: 'fine' },
      persisted: null,
      capabilities: DEFAULT_CAPABILITIES,
    });
    expect(h.port.url()).toBe('/macos/preview/resume'); // nothing written before the first frame
    await act(nextFrame);
    expect(h.port.url()).toBe('/macos/preview');
    expect(readOsk(h.port.state())).toEqual({ idx: 0, prev: null });
    expect(document.title).toBe('title:/macos/preview');

    h.dispatch({ type: 'OPEN_APP', role: 'files', location: { kind: 'content', ref: { section: 'experience' } } });
    expect(h.port.url()).toBe('/macos/finder/experience');
    expect(h.port.entries).toHaveLength(2);
    expect(document.title).toBe('title:/macos/finder/experience');

    // Back-collapse: focusing Preview again goes back instead of pushing.
    h.dispatch({ type: 'FOCUS_WINDOW', id: 'macos:viewer' });
    expect(h.port.index).toBe(0);
    expect(h.routes).toEqual(['/macos/preview', '/macos/finder/experience', '/macos/preview']);
    h.stop();
  });

  it('visitor traversals dispatch ROUTE_CHANGED and never write', async () => {
    const h = harness('/macos');
    h.dispatch({
      type: 'BOOT',
      url: '/macos',
      navType: 'navigate',
      viewport: { w: 1440, h: 900, pointer: 'fine' },
      persisted: null,
      capabilities: DEFAULT_CAPABILITIES,
    });
    await act(nextFrame);
    h.dispatch({ type: 'OPEN_APP', role: 'mail' });
    expect(h.port.url()).toBe('/macos/mail');
    h.port.back();
    expect(h.state.sessions.macos.focused).toBeNull();
    expect(h.port.entries.map((entry) => entry.url)).toEqual(['/macos', '/macos/mail']);
    h.port.forward();
    expect(h.state.sessions.macos.focused).toBe('macos:mail');
    h.stop();
  });

  it('a Back pressed before the first frame is not lost, and the first write never overwrites it', async () => {
    // History after a reload on /macos/safari: [/macos/finder, /macos/safari] at index 1.
    const port = createMemoryHistory('/macos/finder', { sync: true });
    port.push({ osk: { idx: 1, prev: routePath('/macos/finder') } }, '/macos/safari');
    const h = harness('/macos/safari', port);
    h.dispatch({
      type: 'BOOT',
      url: '/macos/safari',
      navType: 'reload',
      viewport: { w: 1440, h: 900, pointer: 'fine' },
      persisted: null,
      capabilities: DEFAULT_CAPABILITIES,
    });
    port.back(); // the visitor is faster than the first frame
    expect(h.deps.codec.encode(h.state.route)).toBe('/macos/finder');
    await act(nextFrame);
    expect(port.url()).toBe('/macos/finder');
    expect(port.entries.map((entry) => entry.url)).toEqual(['/macos/finder', '/macos/safari']);
    h.stop();
  });

  it('re-asserts the kernel title when the framework rewrites <title>', async () => {
    const h = harness('/macos');
    h.dispatch({
      type: 'BOOT',
      url: '/macos',
      navType: 'navigate',
      viewport: { w: 1440, h: 900, pointer: 'fine' },
      persisted: null,
      capabilities: DEFAULT_CAPABILITIES,
    });
    await act(nextFrame);
    document.title = 'Framework title';
    await waitFor(() => expect(document.title).toBe('title:/macos'));
    h.stop();
  });

  it('bfcache restores reconcile without re-booting', async () => {
    const h = harness('/macos');
    h.dispatch({
      type: 'BOOT',
      url: '/macos',
      navType: 'navigate',
      viewport: { w: 1440, h: 900, pointer: 'fine' },
      persisted: null,
      capabilities: DEFAULT_CAPABILITIES,
    });
    await act(nextFrame);
    window.history.replaceState(null, '', '/macos/mail');
    const event = new Event('pageshow') as PageTransitionEvent;
    Object.defineProperty(event, 'persisted', { value: true });
    window.dispatchEvent(event);
    expect(h.state.sessions.macos.focused).toBe('macos:mail');
    window.history.replaceState(null, '', '/');
    h.stop();
  });
});

describe('ROUTE-PORT-01 adapters', () => {
  it('native adapter writes our slice of state and reports popstate', () => {
    const port = createNativeHistory();
    const pops: string[] = [];
    const stop = port.listen(({ url }) => pops.push(url));
    port.push({ osk: { idx: 1, prev: '/' as never } }, '/a');
    expect(port.url()).toBe('/a');
    expect(readOsk(port.state())).toEqual({ idx: 1, prev: '/' });
    port.replace({ osk: { idx: 1, prev: '/' as never } }, '/b');
    expect(port.url()).toBe('/b');
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    expect(pops).toEqual(['/b']);
    stop();
    window.history.replaceState(null, '', '/');
  });

  it('next-router adapter navigates through the router and attaches state once committed', () => {
    const calls: string[] = [];
    const frames: (() => void)[] = [];
    const fakeWindow = {
      location: { pathname: '/' },
      history: {
        state: null as unknown,
        replaceState(state: unknown, _title: string, url: string) {
          this.state = state;
          fakeWindow.location.pathname = url;
        },
      },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    };
    const router = {
      push: (url: string) => calls.push(`push ${url}`),
      replace: (url: string) => calls.push(`replace ${url}`),
      back: () => calls.push('back'),
    };
    const port = createNextRouterHistory(router, fakeWindow as never, (callback) => frames.push(callback));
    port.push({ osk: { idx: 1, prev: '/' as never } }, '/macos');
    expect(calls).toEqual(['push /macos']);
    expect(readOsk(port.state())).toEqual({ idx: 1, prev: '/' }); // pending state visible immediately
    expect(port.settled()).toBe(false);
    frames.shift()!(); // router has not committed yet
    fakeWindow.location.pathname = '/macos'; // router commits
    frames.shift()!();
    expect(port.settled()).toBe(true);
    expect(readOsk(fakeWindow.history.state)).toEqual({ idx: 1, prev: '/' });
    port.replace({ osk: { idx: 1, prev: null } }, '/macos'); // same URL → direct replace
    expect(calls).toHaveLength(1);
    port.replace({ osk: { idx: 1, prev: null } }, '/windows');
    port.back();
    expect(calls).toEqual(['push /macos', 'replace /windows', 'back']);
    expect(port.listen(() => undefined)).toBeTypeOf('function');
  });
});

describe('ARCH-HYDR-01 boot sequence glue', () => {
  it('bootAction reads URL, navigation type, viewport, persisted sessions and capabilities', () => {
    window.history.replaceState(null, '', '/macos/finder');
    const action = bootAction();
    expect(action).toMatchObject({ type: 'BOOT', url: '/macos/finder', navType: 'navigate', persisted: null });
    expect(action.type === 'BOOT' && action.viewport.w).toBeGreaterThan(0);
    expect(browserCapabilities()).toMatchObject({ tier: 1 });
    expect(['fine', 'coarse', 'none']).toContain(currentPointer());
    expect(navigationType()).toBe('navigate');
    window.history.replaceState(null, '', '/');
  });

  it('watchViewport dispatches one rAF-debounced VIEWPORT_CHANGED per burst', async () => {
    const dispatch = vi.fn();
    const stop = watchViewport(dispatch);
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('orientationchange'));
    await nextFrame();
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch.mock.calls[0]![0]).toMatchObject({ type: 'VIEWPORT_CHANGED' });
    stop();
    window.dispatchEvent(new Event('resize'));
    await nextFrame();
    expect(dispatch).toHaveBeenCalledOnce();
  });

  it('persisted sessions round-trip through the safe storage; the history debug switch defaults to native', () => {
    writePersistedSessions({ v: 1, savedAt: 1, contentRev: 'r', sessions: {}, learnedRects: {} });
    getSafeStorage().flush();
    expect(readPersistedSessions()).toEqual({ v: 1, savedAt: 1, contentRev: 'r', sessions: {}, learnedRects: {} });
    expect(historyAdapterOverride()).toBe('native');
    window.sessionStorage.setItem('pf.debug.history', 'next-router');
    expect(historyAdapterOverride()).toBe('next-router');
    window.sessionStorage.removeItem('pf.debug.history');
  });
});
