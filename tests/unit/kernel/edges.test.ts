/** Kernel edge cases (shared/04 edge-case table, KRN-EDGE-01 logic at the reducer and module level). */
import { describe, expect, it } from 'vitest';
import { continuityOffer, reduce } from '@/lib/kernel/reducers';
import { DEFAULT_CAPABILITIES, initialKernelState } from '@/lib/kernel/state';
import { OS_REGISTRY, registryProblems } from '@/lib/kernel/registry';
import { createHistoryController } from '@/lib/kernel/history/controller';
import { createMemoryHistory } from '@/lib/kernel/history/adapters';
import { readOsk } from '@/lib/kernel/history/port';
import { createSafeStorage } from '@/lib/kernel/persist/safe-storage';
import { titleFor } from '@/lib/kernel/route/title';
import { formatChord, matchShortcut } from '@/lib/kernel/keymap';
import { routePath, type KernelState, type OsRegistry, type WindowId } from '@/lib/kernel/types';
import type { KernelAction } from '@/lib/kernel/actions';
import { booted, fixtureCatalog, last, makeDeps, run } from '../../fixtures/portfolio';

const deps = makeDeps();
const settle = (id: WindowId): KernelAction => ({ type: 'PHASE_DONE', target: { kind: 'window', id } });
const withFinderAndSafari = () =>
  last(
    run(booted('/macos'), [
      { type: 'OPEN_APP', role: 'files' },
      settle('macos:files'),
      { type: 'OPEN_APP', role: 'browser' },
      settle('macos:browser'),
    ]),
  ).state;

describe('window edge cases', () => {
  it('OPEN_APP restores a minimized, previously maximized window as maximized', () => {
    let state = withFinderAndSafari();
    state = last(
      run(state, [
        { type: 'TOGGLE_MAXIMIZE', id: 'macos:files' },
        { type: 'MINIMIZE', id: 'macos:files' },
      ]),
    ).state;
    state = reduce(state, { type: 'OPEN_APP', role: 'files' }, deps).state;
    expect(state.sessions.macos.windows['macos:files']?.phase.s).toBe('maximized');
    expect(state.sessions.macos.focused).toBe('macos:files');
  });
  it('Back/Forward restores a minimized maximized window as maximized', () => {
    let state = withFinderAndSafari();
    state = last(
      run(state, [
        { type: 'TOGGLE_MAXIMIZE', id: 'macos:browser' },
        { type: 'MINIMIZE', id: 'macos:browser' },
      ]),
    ).state;
    state = reduce(state, { type: 'ROUTE_CHANGED', url: '/macos/safari' }, deps).state;
    expect(state.sessions.macos.windows['macos:browser']?.phase.s).toBe('maximized');
  });
  it('closing or minimizing an unfocused window keeps focus where it is', () => {
    const state = withFinderAndSafari();
    const closed = reduce(state, { type: 'CLOSE_WINDOW', id: 'macos:files' }, deps).state;
    expect(closed.sessions.macos.focused).toBe('macos:browser');
    const minimized = reduce(state, { type: 'MINIMIZE', id: 'macos:files' }, deps).state;
    expect(minimized.sessions.macos.focused).toBe('macos:browser');
  });
  it('focusing the focused window, committing the same rect, or navigating to the same place are no-ops', () => {
    const state = withFinderAndSafari();
    expect(reduce(state, { type: 'FOCUS_WINDOW', id: 'macos:browser' }, deps).state).toBe(state);
    const rect = state.sessions.macos.windows['macos:files']!.rect.expanded!;
    const committed = reduce(state, { type: 'COMMIT_RECT', id: 'macos:files', rect }, deps).state;
    expect(reduce(committed, { type: 'COMMIT_RECT', id: 'macos:files', rect }, deps).state).toBe(committed);
    const at = reduce(
      state,
      { type: 'NAVIGATE_IN_APP', id: 'macos:browser', location: { kind: 'content', ref: { section: 'about' } } },
      deps,
    ).state;
    expect(at).toBe(state);
  });
  it('in-app navigation is refused on minimized windows; iOS apps cannot be resized', () => {
    const minimized = reduce(withFinderAndSafari(), { type: 'MINIMIZE', id: 'macos:files' }, deps).state;
    expect(
      reduce(minimized, { type: 'NAVIGATE_IN_APP', id: 'macos:files', location: { kind: 'root' } }, deps).state,
    ).toBe(minimized);
    const ios = last(run(booted('/ios'), [{ type: 'OPEN_APP', role: 'files' }])).state;
    expect(
      reduce(ios, { type: 'COMMIT_RECT', id: 'ios:files', rect: { x: 0, y: 0, w: 100, h: 100 } }, deps).state,
    ).toBe(ios);
  });
  it('GO_HOME is ignored mid-transition; PHASE_DONE for an unknown window is a no-op', () => {
    const state = reduce(
      last(run(booted('/ios'), [{ type: 'OPEN_APP', role: 'files' }])).state,
      { type: 'SWITCH_OS', to: 'android', via: 'switch' },
      deps,
    ).state;
    expect(reduce(state, { type: 'GO_HOME' }, deps).state).toBe(state);
    expect(reduce(state, settle('ios:mail'), deps).state).toBe(state);
  });
});

describe('boot, onboarding and history edge cases', () => {
  it('a second BOOT and a pre-boot ROUTE_CHANGED are ignored', () => {
    const state = booted('/macos');
    expect(
      reduce(
        state,
        {
          type: 'BOOT',
          url: '/windows',
          navType: 'navigate',
          viewport: { w: 1, h: 1, pointer: 'fine' },
          persisted: null,
          capabilities: DEFAULT_CAPABILITIES,
        },
        deps,
      ).state,
    ).toBe(state);
    const fresh = initialKernelState();
    expect(reduce(fresh, { type: 'ROUTE_CHANGED', url: '/macos' }, deps).state).toBe(fresh);
  });
  it('onboarding advances one step at a time and focuses each screen heading', () => {
    let result = reduce(booted('/'), { type: 'ONBOARDING_ADVANCE' }, deps);
    expect(result.state.onboarding).toBe('intro');
    result = reduce(result.state, { type: 'ONBOARDING_ADVANCE' }, deps);
    expect(result.state.onboarding).toBe('profiles');
    expect(result.focusTarget?.candidates[0]).toBe('profiles-heading');
    result = reduce(result.state, { type: 'ONBOARDING_ADVANCE', to: 'chooser' }, deps);
    expect(result.focusTarget?.candidates[0]).toBe('chooser-heading');
    const done = reduce(
      reduce(result.state, { type: 'ONBOARDING_ADVANCE' }, deps).state,
      { type: 'ONBOARDING_ADVANCE' },
      deps,
    );
    expect(done.state.onboarding).toBe('done');
  });
  it('Back to / with no OS active returns a finished onboarding to the chooser', () => {
    const plain = reduce(booted('/macos'), { type: 'ROUTE_CHANGED', url: '/plain' }, deps).state;
    const back = reduce(plain, { type: 'ROUTE_CHANGED', url: '/' }, deps).state;
    expect(back.onboarding).toBe('chooser');
  });
  it('popstate to /go resolves into an OS; to an unreleased OS it stays put', () => {
    const go = reduce(booted('/'), { type: 'ROUTE_CHANGED', url: '/go/contact' }, deps);
    expect(go.state.sessions.macos.focused).toBe('macos:mail');
    expect(go.routeIntent).toBe('canonicalize');
    const narrow = makeDeps({ visible: ['macos'] });
    const state = reduce(
      initialKernelState(),
      {
        type: 'BOOT',
        url: '/macos',
        navType: 'navigate',
        viewport: { w: 1440, h: 900, pointer: 'fine' },
        persisted: null,
        capabilities: DEFAULT_CAPABILITIES,
      },
      narrow,
    ).state;
    const blocked = reduce(state, { type: 'ROUTE_CHANGED', url: '/windows' }, narrow);
    expect(blocked.state.activeOs).toBe('macos');
  });
  it('re-entering the target of an in-flight switch is a no-op; failed → chooser goes idle', () => {
    let state = reduce(booted('/macos'), { type: 'SWITCH_OS', to: 'windows', via: 'switch' }, deps).state;
    const epoch = state.epoch;
    state = reduce(state, { type: 'PHASE_DONE', target: { kind: 'os', epoch } }, deps).state;
    state = reduce(state, { type: 'PHASE_DONE', target: { kind: 'os', epoch } }, deps).state;
    expect(state.transition.phase).toBe('entering');
    expect(reduce(state, { type: 'SWITCH_OS', to: 'windows', via: 'switch' }, deps).state).toBe(state);
    let failed = reduce(booted('/macos'), { type: 'SWITCH_OS', to: 'ios', via: 'switch' }, deps).state;
    failed = reduce(failed, { type: 'PHASE_DONE', target: { kind: 'os', epoch: failed.epoch } }, deps).state;
    failed = reduce(failed, { type: 'TRANSITION_FAILED', epoch: failed.epoch, reason: 'timeout' }, deps).state;
    expect(reduce(failed, { type: 'SWITCH_OS', to: null, via: 'switch' }, deps).state.transition.phase).toBe('idle');
  });
  it('the chooser exit focuses the card of the OS that was left', () => {
    let result = reduce(booted('/linux'), { type: 'SWITCH_OS', to: null, via: 'switch' }, deps);
    result = reduce(result.state, { type: 'PHASE_DONE', target: { kind: 'os', epoch: result.state.epoch } }, deps);
    expect(result.focusTarget?.candidates[0]).toBe('chooser-card:linux');
  });
});

describe('terminal and continuity edge cases', () => {
  it('without a terminal window the cwd changes quietly; blank commands are not recorded', () => {
    const viewerOnly = booted('/linux/viewer/resume');
    const moved = reduce(
      viewerOnly,
      { type: 'TERMINAL_SET_CWD', os: 'linux', cwd: ['home', 'jaswanth', 'projects'] },
      deps,
    );
    expect(moved.routeIntent).toBeNull();
    const recorded = reduce(
      viewerOnly,
      { type: 'TERMINAL_RECORD', os: 'linux', command: '   ', output: [''] },
      deps,
    ).state;
    expect(recorded.sessions.linux.terminal?.history).toEqual([]);
  });
  it('no offer during a transition, or when the target shows other content', () => {
    let state = last(
      run(booted('/macos'), [
        {
          type: 'OPEN_APP',
          role: 'github',
          location: { kind: 'content', ref: { section: 'projects', slug: 'rocket' } },
        },
      ]),
    ).state;
    state = reduce(state, { type: 'SWITCH_OS', to: 'windows', via: 'switch' }, deps).state;
    expect(continuityOffer(state, fixtureCatalog, OS_REGISTRY, deps.now)).toBeNull();
    for (let i = 0; i < 3; i++)
      state = reduce(state, { type: 'PHASE_DONE', target: { kind: 'os', epoch: state.epoch } }, deps).state;
    const other = { ...state, sessions: { ...state.sessions } } as KernelState;
    expect(continuityOffer(other, fixtureCatalog, OS_REGISTRY, deps.now)).toEqual({
      section: 'projects',
      slug: 'rocket',
    });
    expect(continuityOffer(other, fixtureCatalog, OS_REGISTRY, deps.now - 1)).toBeNull(); // clock skew guard
  });
});

describe('module-level edge cases', () => {
  it('registry self-check reports every kind of inconsistency', () => {
    const broken: OsRegistry = {
      ...OS_REGISTRY,
      macos: {
        ...OS_REGISTRY.macos,
        apps: [
          ...OS_REGISTRY.macos.apps.slice(0, 2),
          { ...OS_REGISTRY.macos.apps[0]!, slug: 'Finder X' },
          { ...OS_REGISTRY.macos.apps[2]!, owns: ['projects', 'skills'] },
        ],
        sectionOwner: { ...OS_REGISTRY.macos.sectionOwner, resume: 'terminal' },
      },
    };
    const problems = registryProblems(broken).join('\n');
    expect(problems).toMatch(/duplicate role files/);
    expect(problems).toMatch(/not kebab-case/);
    expect(problems).toMatch(/section resume owned by unbound role terminal/);
    expect(problems).toMatch(/claims skills owned by editor/);
  });
  it('titles cover app roots, unknown bindings and the Linux viewer', () => {
    expect(
      titleFor(
        { kind: 'os', os: 'macos', focus: { role: 'settings', location: { kind: 'root' } } },
        { catalog: fixtureCatalog },
      ),
    ).toBe('System Settings · macOS — Jaswanth');
    expect(
      titleFor(
        { kind: 'os', os: 'linux', focus: { role: 'viewer', location: { kind: 'vfs', path: ['resume'] } } },
        { catalog: fixtureCatalog },
      ),
    ).toBe('Résumé · Viewer · Linux — Jaswanth');
    expect(
      titleFor(
        { kind: 'os', os: 'linux', focus: { role: 'terminal', location: { kind: 'vfs', path: [] } } },
        { catalog: fixtureCatalog },
      ),
    ).toBe('~ · Terminal · Linux — Jaswanth');
    expect(titleFor({ kind: 'go', ref: { section: 'projects', slug: 'gone' } }, { catalog: fixtureCatalog })).toBe(
      'Projects — Jaswanth',
    );
  });
  it('the controller keeps our idx/prev bookkeeping and never pushes the same URL twice', () => {
    const port = createMemoryHistory('/a', { sync: true });
    const controller = createHistoryController({ port, onPop: () => undefined });
    controller.go(routePath('/b'));
    controller.go(routePath('/c'));
    expect(readOsk(port.state())).toEqual({ idx: 2, prev: '/b' });
    expect(controller.write(null, routePath('/z'))).toBe('noop');
    controller.dispose();
    expect(readOsk({ osk: { idx: 'x' } })).toBeNull();
    expect(readOsk({ osk: null })).toBeNull();
    expect(readOsk({ osk: { idx: 1, prev: 'relative' } })).toEqual({ idx: 1, prev: null });
  });
  it('safe storage: removals are persisted, reads cache, a failing read degrades to memory', () => {
    const data = new Map<string, string>([['k', 'v']]);
    let failReads = false;
    const backing = {
      getItem: (key: string) => {
        if (failReads) throw new Error('revoked');
        return data.get(key) ?? null;
      },
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    } as unknown as Storage;
    const storage = createSafeStorage({ backing: () => backing, schedule: (run) => (run(), () => undefined) });
    expect(storage.getItem('k')).toBe('v');
    storage.removeItem('k');
    expect(data.has('k')).toBe(false);
    failReads = true;
    expect(storage.getItem('other')).toBeNull();
    expect(storage.mode).toBe('memory');
    expect(createSafeStorage({ backing: () => null }).mode).toBe('memory');
  });
  it('keymap: formatting on non-Apple keyboards and Escape', () => {
    expect(formatChord({ key: 'k', ctrlOrMeta: true }, false)).toBe('Ctrl+K');
    expect(formatChord({ key: 'Escape' }, true)).toBe('Esc');
    const base = { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false };
    expect(matchShortcut({ ...base, key: 'Escape' }, { inTextField: true, singleKeyShortcuts: false })).toBe('dismiss');
    expect(matchShortcut({ ...base, key: 'x' }, { inTextField: false, singleKeyShortcuts: true })).toBeNull();
  });
});
