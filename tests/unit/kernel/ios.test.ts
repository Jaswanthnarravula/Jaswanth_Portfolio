/**
 * Kernel additions for iOS (logged in plans/shared/22 Deviations): `WindowInstance.ui` + `SET_APP_UI` (app session
 * state that survives eviction and reload — IOS-FLIGHT-05, IOS-MSG-05) and `NAVIGATE_IN_APP { replace }` (a pop to a
 * synthesized parent replaces the entry, so the next Back returns Home — IOS-FILES-05, plans/ios/06 E13), plus the
 * iOS history rules: open pushes, Home collapses, Back at the root closes the app (ROUTE-MOBILE-01 on iOS).
 */
import { describe, expect, it } from 'vitest';
import { contentIndex } from '@/data/content-index';
import type { KernelAction } from '@/lib/kernel/actions';
import { APP_UI_LIMITS, reduce, type KernelDeps } from '@/lib/kernel/reducers';
import { parsePersistedSessions } from '@/lib/kernel/persist/sessions';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import { createRouteCodec } from '@/lib/kernel/route/codec';
import { DEFAULT_CAPABILITIES, DEFAULT_PREFS, initialKernelState } from '@/lib/kernel/state';
import { OS_IDS } from '@/lib/kernel/ids';
import type { KernelState, WindowId } from '@/lib/kernel/types';

const visible = OS_IDS;
const deps: KernelDeps = {
  registry: OS_REGISTRY,
  catalog: contentIndex,
  codec: createRouteCodec({ registry: OS_REGISTRY, catalog: contentIndex, visible }),
  prefs: DEFAULT_PREFS,
  visible,
  now: 1_000,
};
const run = (state: KernelState, ...actions: KernelAction[]) => {
  let current = state;
  let last = reduce(current, actions[0]!, deps);
  for (const action of actions) {
    last = reduce(current, action, deps);
    current = last.state;
  }
  return last;
};
const boot = (url = '/ios') =>
  reduce(
    initialKernelState(contentIndex.rev),
    {
      type: 'BOOT',
      url,
      navType: 'navigate',
      viewport: { w: 390, h: 844, pointer: 'coarse' },
      persisted: null,
      capabilities: DEFAULT_CAPABILITIES,
    },
    deps,
  ).state;
const MAIL = 'ios:mail' as WindowId;
const FILES = 'ios:files' as WindowId;

describe('SET_APP_UI (WindowInstance.ui)', () => {
  it('sets, replaces and clears keys; unchanged values keep the same state', () => {
    let state = run(boot(), { type: 'OPEN_APP', os: 'ios', role: 'mail' }).state;
    state = run(state, { type: 'SET_APP_UI', id: MAIL, key: 'read', value: '["lets-talk"]' }).state;
    expect(state.sessions.ios.windows[MAIL]?.ui).toEqual({ read: '["lets-talk"]' });
    const same = reduce(state, { type: 'SET_APP_UI', id: MAIL, key: 'read', value: '["lets-talk"]' }, deps);
    expect(same.state).toBe(state);
    state = run(state, { type: 'SET_APP_UI', id: MAIL, key: 'read', value: null }).state;
    expect(state.sessions.ios.windows[MAIL]?.ui).toEqual({});
  });
  it('is capped (keys, key length, value length) and never writes history', () => {
    let state = run(boot(), { type: 'OPEN_APP', os: 'ios', role: 'mail' }).state;
    const result = reduce(state, { type: 'SET_APP_UI', id: MAIL, key: 'k', value: 'x'.repeat(9000) }, deps);
    expect(result.routeIntent).toBeNull();
    expect(result.state.sessions.ios.windows[MAIL]?.ui?.k?.length).toBe(APP_UI_LIMITS.value);
    expect(reduce(state, { type: 'SET_APP_UI', id: MAIL, key: 'x'.repeat(41), value: '1' }, deps).state).toBe(state);
    for (let index = 0; index < APP_UI_LIMITS.keys + 5; index++)
      state = run(state, { type: 'SET_APP_UI', id: MAIL, key: `k${index}`, value: '1' }).state;
    expect(Object.keys(state.sessions.ios.windows[MAIL]!.ui!).length).toBe(APP_UI_LIMITS.keys);
  });
  it('persists through the validator (strings only, bad entries dropped)', () => {
    const state = run(
      boot(),
      { type: 'OPEN_APP', os: 'ios', role: 'mail' },
      {
        type: 'SET_APP_UI',
        id: MAIL,
        key: 'tab',
        value: 'inbox',
      },
    ).state;
    const raw = JSON.parse(
      JSON.stringify({ v: 1, savedAt: 1, contentRev: contentIndex.rev, sessions: state.sessions, learnedRects: {} }),
    );
    raw.sessions.ios.windows[MAIL].ui.bad = 42;
    const parsed = parsePersistedSessions(raw);
    expect(parsed?.sessions.ios?.windows[MAIL]?.ui).toEqual({ tab: 'inbox' });
  });
});

describe('NAVIGATE_IN_APP { replace } — a pop to a synthesized parent', () => {
  it('replaces the current entry and canonicalizes (history replace), so Back then returns Home', () => {
    let state = boot();
    // Home → the Dock's Files opens straight at the résumé (a push).
    const open = reduce(
      state,
      { type: 'OPEN_APP', os: 'ios', role: 'files', location: { kind: 'content', ref: { section: 'resume' } } },
      deps,
    );
    expect(open.routeIntent).toBe('go');
    state = open.state;
    expect(deps.codec.encode(state.route)).toBe('/ios/files/resume');
    // Done → the folder, replacing the résumé entry.
    const done = reduce(state, { type: 'NAVIGATE_IN_APP', id: FILES, location: { kind: 'root' }, replace: true }, deps);
    expect(done.routeIntent).toBe('canonicalize');
    expect(deps.codec.encode(done.state.route)).toBe('/ios/files');
    expect(done.state.sessions.ios.windows[FILES]?.nav.entries).toEqual([{ kind: 'root' }]);
    // Browser Back from there lands on /ios: the app goes Home (it stays warm).
    const back = reduce(done.state, { type: 'ROUTE_CHANGED', url: '/ios' }, deps);
    expect(back.state.sessions.ios.focused).toBeNull();
    expect(back.state.sessions.ios.windows[FILES]).toBeDefined();
    expect(back.routeIntent).toBeNull();
  });
  it('without replace it is still a push', () => {
    const state = run(boot(), { type: 'OPEN_APP', os: 'ios', role: 'files' }).state;
    const push = reduce(
      state,
      { type: 'NAVIGATE_IN_APP', id: FILES, location: { kind: 'content', ref: { section: 'experience' } } },
      deps,
    );
    expect(push.routeIntent).toBe('go');
    expect(push.state.sessions.ios.windows[FILES]?.nav.entries.length).toBe(2);
  });
});

describe('ROUTE-MOBILE-01 on iOS: opening an app is a push; Home and Back at the root go Home', () => {
  it('open → go; GO_HOME → go(/ios) (collapses in the history writer); the app stays warm', () => {
    const state = boot();
    const open = reduce(state, { type: 'OPEN_APP', os: 'ios', role: 'github' }, deps);
    expect(open.routeIntent).toBe('go');
    expect(deps.codec.encode(open.state.route)).toBe('/ios/github');
    const home = reduce(open.state, { type: 'GO_HOME' }, deps);
    expect(home.routeIntent).toBe('go');
    expect(deps.codec.encode(home.state.route)).toBe('/ios');
    expect(home.state.sessions.ios.windows['ios:github' as WindowId]).toBeDefined();
    expect(home.focusTarget?.candidates[0]).toBe('launcher:ios:github');
  });
  it('a deep link to a project opens GitHub directly with no flight phase to wait on (E12)', () => {
    const state = boot('/ios/github/enterprise-sso');
    expect(state.sessions.ios.focused).toBe('ios:github');
    expect(state.arrival).toBe('deep-link');
  });
});
