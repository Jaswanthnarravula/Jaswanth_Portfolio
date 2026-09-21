/**
 * Kernel flows: history reconciliation (ROUTE-EVENT semantics at the reducer), `/go` resolution (ROUTE-GO-01 logic),
 * transition retargeting / failure / retry (KRN-SWITCH-01/02 logic), mobile Home, terminal, continuity capture,
 * in-app navigation, scroll/draft, viewport re-clamp (RESP-ROT-01 logic) and Linux mapping.
 */
import { describe, expect, it } from 'vitest';
import { defaultOsFor, reduce } from '@/lib/kernel/reducers';
import { DEFAULT_CAPABILITIES, DEFAULT_PREFS } from '@/lib/kernel/state';
import type { KernelAction } from '@/lib/kernel/actions';
import type { KernelState, WindowId } from '@/lib/kernel/types';
import { booted, last, makeDeps, run } from '../../fixtures/portfolio';

const deps = makeDeps();
const settle = (id: WindowId): KernelAction => ({ type: 'PHASE_DONE', target: { kind: 'window', id } });
const osDone = (state: KernelState): KernelAction => ({
  type: 'PHASE_DONE',
  target: { kind: 'os', epoch: state.epoch },
});

describe('ROUTE_CHANGED (popstate) reconciliation', () => {
  it('Back to / from an OS shows the chooser (never Hello again)', () => {
    const state = reduce(booted('/macos'), { type: 'ROUTE_CHANGED', url: '/' }, deps);
    expect(state.state.onboarding).toBe('chooser');
    expect(state.state.transition).toMatchObject({ phase: 'exiting', to: null });
    expect(state.routeIntent).toBeNull();
  });
  it('a different OS in the URL switches without writing history', () => {
    const result = reduce(booted('/macos'), { type: 'ROUTE_CHANGED', url: '/windows/edge' }, deps);
    expect(result.state.transition).toMatchObject({ phase: 'exiting', to: 'windows' });
    expect(result.state.sessions.windows.focused).toBe('windows:browser');
    expect(result.routeIntent).toBeNull();
  });
  it('same OS: opens, focuses, restores and moves within the app stack', () => {
    let state = last(
      run(booted('/macos'), [
        { type: 'OPEN_APP', role: 'files', location: { kind: 'content', ref: { section: 'experience' } } },
        settle('macos:files'),
        {
          type: 'OPEN_APP',
          role: 'files',
          location: { kind: 'content', ref: { section: 'experience', slug: 'acme' } },
        },
        { type: 'MINIMIZE', id: 'macos:files' },
      ]),
    ).state;
    expect(state.sessions.macos.windows['macos:files']?.phase.s).toBe('minimized');
    state = reduce(state, { type: 'ROUTE_CHANGED', url: '/macos/finder/experience' }, deps).state;
    const finder = state.sessions.macos.windows['macos:files']!;
    expect(finder.phase.s).toBe('normal');
    expect(finder.nav.index).toBe(0); // adjacent entry reused (Back)
    state = reduce(state, { type: 'ROUTE_CHANGED', url: '/macos/finder/experience/acme' }, deps).state;
    expect(state.sessions.macos.windows['macos:files']!.nav.index).toBe(1); // Forward
    state = reduce(state, { type: 'ROUTE_CHANGED', url: '/macos/mail' }, deps).state;
    expect(state.sessions.macos.windows['macos:mail']?.phase.s).toBe('opening');
  });
  it('an invalid URL is repaired with canonicalize (the only write a popstate may cause)', () => {
    const result = reduce(booted('/macos'), { type: 'ROUTE_CHANGED', url: '/macos/nope' }, deps);
    expect(result.routeIntent).toBe('canonicalize');
  });
  it('popstate into /plain parks the OS', () => {
    const result = reduce(booted('/macos'), { type: 'ROUTE_CHANGED', url: '/plain' }, deps);
    expect(result.state.activeOs).toBeNull();
    expect(result.state.route).toEqual({ kind: 'plain' });
  });
  it('is ignored before boot', () => {
    const fresh = reduce(booted('/'), { type: 'ROUTE_CHANGED', url: '/macos' }, deps).state;
    expect(fresh.activeOs).not.toBe(undefined);
  });
});

describe('/go resolution', () => {
  it('uses the last OS, else the device default, and opens the section owner', () => {
    const go = booted('/go/projects/rocket');
    expect(go.activeOs).toBe('macos');
    expect(go.sessions.macos.focused).toBe('macos:github');
    expect(go.arrival).toBe('go');
    const lastOs = booted('/go/resume', { prefs: { ...DEFAULT_PREFS, lastOs: 'windows' } });
    expect(lastOs.sessions.windows.focused).toBe('windows:browser');
    const linux = booted('/go/projects/rocket', { prefs: { ...DEFAULT_PREFS, lastOs: 'linux' } });
    expect(linux.sessions.linux.focused).toBe('linux:viewer');
  });
  it('without any visible OS the /go page stays a semantic page', () => {
    const none = booted('/go/about', { deps: { visible: [] } });
    expect(none.activeOs).toBeNull();
    expect(none.route).toMatchObject({ kind: 'go' });
  });
  it('device defaults never sniff the user agent', () => {
    const phone = { ...DEFAULT_CAPABILITIES, deviceClass: 'phone' as const };
    expect(defaultOsFor(phone, DEFAULT_PREFS, ['ios', 'android', 'macos'], true)).toBe('ios');
    expect(defaultOsFor(phone, DEFAULT_PREFS, ['ios', 'android', 'macos'], false)).toBe('android');
    expect(defaultOsFor({ ...DEFAULT_CAPABILITIES, deviceClass: 'tablet' }, DEFAULT_PREFS, ['windows'])).toBe(
      'windows',
    );
    expect(defaultOsFor(DEFAULT_CAPABILITIES, DEFAULT_PREFS, [])).toBeNull();
    expect(defaultOsFor(DEFAULT_CAPABILITIES, DEFAULT_PREFS, ['linux'])).toBe('linux');
  });
});

describe('transition retargeting, failure and retry', () => {
  it('a switch during loading retargets the load; during entering it exits the entering OS', () => {
    let state = reduce(booted('/macos'), { type: 'SWITCH_OS', to: 'windows', via: 'switch' }, deps).state;
    state = reduce(state, osDone(state), deps).state;
    expect(state.transition.phase).toBe('loading');
    state = reduce(state, { type: 'SWITCH_OS', to: 'ios', via: 'switch' }, deps).state;
    expect(state.transition).toMatchObject({ phase: 'loading', to: 'ios' });
    state = reduce(state, osDone(state), deps).state;
    expect(state.transition).toMatchObject({ phase: 'entering', to: 'ios' });
    state = reduce(state, { type: 'SWITCH_OS', to: 'linux', via: 'switch' }, deps).state;
    expect(state.transition).toMatchObject({ phase: 'exiting', from: 'ios', to: 'linux' });
    expect(reduce(state, { type: 'SWITCH_OS', to: 'linux', via: 'switch' }, deps).state.transition).toMatchObject({
      to: 'linux',
    });
  });
  it('switching to the chooser during loading goes straight to idle', () => {
    let state = reduce(booted('/macos'), { type: 'SWITCH_OS', to: 'windows', via: 'switch' }, deps).state;
    state = reduce(state, osDone(state), deps).state;
    state = reduce(state, { type: 'SWITCH_OS', to: null, via: 'switch' }, deps).state;
    expect(state.transition.phase).toBe('idle');
    expect(state.activeOs).toBeNull();
  });
  it('chunk failure → failed; retry → loading with a new epoch; stale failures ignored', () => {
    let state = reduce(booted('/macos'), { type: 'SWITCH_OS', to: 'windows', via: 'switch' }, deps).state;
    state = reduce(state, osDone(state), deps).state;
    const epoch = state.epoch;
    expect(reduce(state, { type: 'TRANSITION_FAILED', epoch: (epoch - 1) as never, reason: 'chunk' }, deps).state).toBe(
      state,
    );
    state = reduce(state, { type: 'TRANSITION_FAILED', epoch, reason: 'offline' }, deps).state;
    expect(state.transition).toMatchObject({ phase: 'failed', to: 'windows', reason: 'offline' });
    expect(reduce(state, osDone(state), deps).state).toBe(state);
    state = reduce(state, { type: 'RETRY_TRANSITION' }, deps).state;
    expect(state.transition).toMatchObject({ phase: 'loading', to: 'windows' });
    expect(state.epoch).toBe(epoch + 1);
    expect(reduce(state, { type: 'RETRY_TRANSITION' }, deps).state).toBe(state);
    const fresh = booted('/macos');
    expect(reduce(fresh, { type: 'SWITCH_OS', to: 'macos', via: 'switch' }, deps).state).toBe(fresh);
  });
});

describe('mobile Home, in-app navigation, window data', () => {
  it('GO_HOME backgrounds the app and focuses its home icon', () => {
    const open = last(run(booted('/ios'), [{ type: 'OPEN_APP', role: 'notes' }, settle('ios:notes')])).state;
    const home = reduce(open, { type: 'GO_HOME' }, deps);
    expect(home.state.sessions.ios.focused).toBeNull();
    expect(home.state.sessions.ios.windows['ios:notes']).toBeDefined();
    expect(home.focusTarget?.candidates[0]).toBe('launcher:ios:notes');
    expect(home.routeIntent).toBe('go');
    expect(reduce(home.state, { type: 'GO_HOME' }, deps).state).toBe(home.state);
  });
  it('NAVIGATE_IN_APP pushes; a location owned by another app opens that app', () => {
    const open = last(run(booted('/macos'), [{ type: 'OPEN_APP', role: 'files' }, settle('macos:files')])).state;
    const nav = reduce(
      open,
      {
        type: 'NAVIGATE_IN_APP',
        id: 'macos:files',
        location: { kind: 'content', ref: { section: 'education', slug: 'state-u' } },
      },
      deps,
    );
    expect(nav.state.sessions.macos.windows['macos:files']?.nav.entries).toHaveLength(2);
    expect(nav.routeIntent).toBe('go');
    const cross = reduce(
      nav.state,
      { type: 'NAVIGATE_IN_APP', id: 'macos:files', location: { kind: 'content', ref: { section: 'resume' } } },
      deps,
    );
    expect(cross.state.sessions.macos.focused).toBe('macos:viewer');
    const back = reduce(nav.state, { type: 'APP_BACK', id: 'macos:files' }, deps);
    expect(back.state.sessions.macos.windows['macos:files']?.nav.index).toBe(0);
    expect(reduce(back.state, { type: 'APP_BACK', id: 'macos:files' }, deps).state).toBe(back.state);
    expect(
      reduce(back.state, { type: 'APP_FORWARD', id: 'macos:files' }, deps).state.sessions.macos.windows['macos:files']
        ?.nav.index,
    ).toBe(1);
  });
  it('scroll and drafts are stored; identical values are no-ops', () => {
    const open = last(run(booted('/macos'), [{ type: 'OPEN_APP', role: 'mail' }, settle('macos:mail')])).state;
    const scrolled = reduce(open, { type: 'SET_SCROLL', id: 'macos:mail', top: 120.4 }, deps).state;
    expect(scrolled.sessions.macos.windows['macos:mail']?.scrollTop).toBe(120);
    expect(reduce(scrolled, { type: 'SET_SCROLL', id: 'macos:mail', top: 120 }, deps).state).toBe(scrolled);
    const drafted = reduce(scrolled, { type: 'SET_DRAFT', id: 'macos:mail', draft: 'Hi' }, deps).state;
    expect(drafted.sessions.macos.windows['macos:mail']?.draft).toBe('Hi');
    expect(reduce(drafted, { type: 'SET_DRAFT', id: 'macos:mail', draft: 'Hi' }, deps).state).toBe(drafted);
  });
  it('COMMIT_RECT on a maximized window restores it; minimized windows ignore commits', () => {
    const open = last(
      run(booted('/macos'), [
        { type: 'OPEN_APP', role: 'files' },
        settle('macos:files'),
        { type: 'TOGGLE_MAXIMIZE', id: 'macos:files' },
      ]),
    ).state;
    const moved = reduce(
      open,
      { type: 'COMMIT_RECT', id: 'macos:files', rect: { x: 50, y: 60, w: 700, h: 500 } },
      deps,
    ).state;
    expect(moved.sessions.macos.windows['macos:files']?.phase.s).toBe('normal');
    const minimized = reduce(moved, { type: 'MINIMIZE', id: 'macos:files' }, deps).state;
    expect(
      reduce(minimized, { type: 'COMMIT_RECT', id: 'macos:files', rect: { x: 1, y: 30, w: 400, h: 300 } }, deps).state,
    ).toBe(minimized);
  });
  it('viewport changes re-clamp stored rects into the new viewport', () => {
    const open = last(
      run(booted('/macos'), [
        { type: 'OPEN_APP', role: 'files' },
        settle('macos:files'),
        { type: 'COMMIT_RECT', id: 'macos:files', rect: { x: 1300, y: 700, w: 700, h: 500 } },
      ]),
    ).state;
    const smaller = reduce(open, { type: 'VIEWPORT_CHANGED', w: 1200, h: 800, pointer: 'fine' }, deps).state;
    const rect = smaller.sessions.macos.windows['macos:files']!.rect.expanded!;
    expect(rect.x).toBeLessThanOrEqual(1200 - 48);
    expect(rect.y).toBeLessThanOrEqual(800 - 48);
    expect(reduce(smaller, { type: 'VIEWPORT_CHANGED', w: 1200, h: 800, pointer: 'fine' }, deps).state).toBe(smaller);
  });
});

describe('terminal sessions and continuity capture', () => {
  it('cwd changes under ~ move the Linux URL; outside ~ the URL shows the bare terminal', () => {
    const linux = booted('/linux');
    const projects = reduce(
      linux,
      { type: 'TERMINAL_SET_CWD', os: 'linux', cwd: ['home', 'jaswanth', 'projects'] },
      deps,
    );
    expect(deps.codec.encode(projects.state.route)).toBe('/linux/terminal/projects');
    expect(projects.routeIntent).toBe('go');
    expect(projects.state.continuity?.ref).toEqual({ section: 'projects' });
    const etc = reduce(projects.state, { type: 'TERMINAL_SET_CWD', os: 'linux', cwd: ['etc'] }, deps);
    expect(deps.codec.encode(etc.state.route)).toBe('/linux/terminal');
    expect(reduce(etc.state, { type: 'TERMINAL_SET_CWD', os: 'linux', cwd: ['etc'] }, deps).state).toBe(etc.state);
  });
  it('macOS Terminal keeps its cwd in the session only', () => {
    const mac = last(run(booted('/macos'), [{ type: 'OPEN_APP', role: 'terminal' }])).state;
    const moved = reduce(mac, { type: 'TERMINAL_SET_CWD', os: 'macos', cwd: ['home', 'jaswanth', 'projects'] }, deps);
    expect(moved.routeIntent).toBeNull();
    expect(moved.state.sessions.macos.terminal?.cwd).toEqual(['home', 'jaswanth', 'projects']);
  });
  it('history and scrollback are recorded and capped; clear empties scrollback', () => {
    let state = booted('/linux');
    for (let i = 0; i < 260; i++)
      state = reduce(
        state,
        { type: 'TERMINAL_RECORD', os: 'linux', command: `echo ${i}`, output: [`${i}`, `${i}`] },
        deps,
      ).state;
    expect(state.sessions.linux.terminal?.history).toHaveLength(200);
    expect(state.sessions.linux.terminal?.scrollback).toHaveLength(500);
    state = reduce(state, { type: 'TERMINAL_CLEAR', os: 'linux' }, deps).state;
    expect(state.sessions.linux.terminal?.scrollback).toEqual([]);
    expect(reduce(state, { type: 'TERMINAL_CLEAR', os: 'linux' }, deps).state).toBe(state);
  });
  it('explicit capture validates the ref; boot/lock marks are idempotent', () => {
    const state = booted('/macos');
    expect(
      reduce(state, { type: 'CONTINUITY_CAPTURE', ref: { section: 'projects', slug: 'gone' }, os: 'macos' }, deps)
        .state,
    ).toBe(state);
    const captured = reduce(state, { type: 'CONTINUITY_CAPTURE', ref: { section: 'skills' }, os: 'macos' }, deps).state;
    expect(captured.continuity?.ref).toEqual({ section: 'skills' });
    const seen = reduce(state, { type: 'MARK_BOOT_SEEN', os: 'macos' }, deps).state;
    expect(seen.sessions.macos.bootSeen).toBe(true);
    expect(reduce(seen, { type: 'MARK_BOOT_SEEN', os: 'macos' }, deps).state).toBe(seen);
    expect(reduce(seen, { type: 'MARK_LOCK_SEEN', os: 'macos' }, deps).state.sessions.macos.lockSeen).toBe(true);
    expect(reduce(state, { type: 'CONTINUITY_DISMISS' }, deps).state).toBe(state);
  });
  it('SET_PREF only patches preferences', () => {
    const state = booted('/macos');
    const result = reduce(state, { type: 'SET_PREF', patch: { motion: 'reduced' } }, deps);
    expect(result.state).toBe(state);
    expect(result.prefsPatch).toEqual({ motion: 'reduced' });
  });
});

describe('Linux mapping of content locations', () => {
  it('OPEN_APP with a content ref lands in the terminal or the viewer', () => {
    const viewer = reduce(
      booted('/linux'),
      {
        type: 'OPEN_APP',
        role: 'terminal',
        location: { kind: 'content', ref: { section: 'experience', slug: 'acme' } },
      },
      deps,
    ).state;
    expect(viewer.sessions.linux.focused).toBe('linux:viewer');
    expect(deps.codec.encode(viewer.route)).toBe('/linux/viewer/experience/acme');
    const list = reduce(
      booted('/linux'),
      { type: 'OPEN_APP', role: 'viewer', location: { kind: 'content', ref: { section: 'education' } } },
      deps,
    ).state;
    expect(deps.codec.encode(list.route)).toBe('/linux/terminal/education');
  });
  it('a stale vfs location falls back to the app default', () => {
    const state = reduce(
      booted('/linux'),
      { type: 'OPEN_APP', role: 'viewer', location: { kind: 'vfs', path: ['projects', 'gone'] } },
      deps,
    ).state;
    expect(deps.codec.encode(state.route)).toBe('/linux/viewer/resume');
  });
  it('opening an app in a non-visible OS is refused', () => {
    const state = booted('/macos');
    expect(
      reduce(state, { type: 'OPEN_APP', role: 'files', os: 'android' }, makeDeps({ visible: ['macos'] })).state,
    ).toBe(state);
    expect(reduce(booted('/'), { type: 'OPEN_APP', role: 'files' }, deps).state).toMatchObject({ activeOs: null });
  });
});
