import { describe, expect, it } from 'vitest';
import { reduce } from '@/lib/kernel/reducers';
import { initialKernelState, DEFAULT_CAPABILITIES, DEFAULT_PREFS } from '@/lib/kernel/state';
import {
  parsePersistedSessions,
  toPersisted,
  SESSION_TTL_COLD,
  SESSION_TTL_RELOAD,
} from '@/lib/kernel/persist/sessions';
import type { KernelAction, NavigationType } from '@/lib/kernel/actions';
import type { KernelState, PersistedSessionsV1, WindowId } from '@/lib/kernel/types';
import { booted, fixtureCatalog, last, makeDeps, run } from '../../fixtures/portfolio';

const deps = makeDeps();
const settle = (id: WindowId): KernelAction => ({ type: 'PHASE_DONE', target: { kind: 'window', id } });

/** A macOS session with Finder (at experience/acme) behind Safari, persisted at `savedAt`. */
function snapshot(savedAt: number): PersistedSessionsV1 {
  const state = last(
    run(booted('/macos'), [
      { type: 'OPEN_APP', role: 'files', location: { kind: 'content', ref: { section: 'experience', slug: 'acme' } } },
      settle('macos:files'),
      { type: 'OPEN_APP', role: 'browser' },
      settle('macos:browser'),
    ]),
  ).state;
  return JSON.parse(JSON.stringify(toPersisted(state, savedAt, fixtureCatalog.rev))) as PersistedSessionsV1;
}

function bootWith(
  url: string,
  navType: NavigationType,
  persisted: PersistedSessionsV1 | null,
  now: number,
): KernelState {
  return reduce(
    initialKernelState(),
    {
      type: 'BOOT',
      url,
      navType,
      viewport: { w: 1440, h: 900, pointer: 'fine' },
      persisted,
      capabilities: DEFAULT_CAPABILITIES,
    },
    makeDeps({ now }),
  ).state;
}

describe('KRN-SES-01 restore rules table', () => {
  const t0 = 1_000_000;

  it('reload restores the persisted session (< 24 h); the URL wins for focus', () => {
    const state = bootWith('/macos/finder/experience/acme', 'reload', snapshot(t0), t0 + SESSION_TTL_RELOAD - 1);
    const session = state.sessions.macos;
    expect(Object.keys(session.windows).sort()).toEqual(['macos:browser', 'macos:files']);
    expect(session.focused).toBe('macos:files');
    expect(session.zOrder.at(-1)).toBe('macos:files');
    expect(state.route).toEqual({
      kind: 'os',
      os: 'macos',
      focus: { role: 'files', location: { kind: 'content', ref: { section: 'experience', slug: 'acme' } } },
    });
  });

  it('reload after 24 h starts clean', () => {
    const state = bootWith('/macos', 'reload', snapshot(t0), t0 + SESSION_TTL_RELOAD + 1);
    expect(state.sessions.macos.windows).toEqual({});
  });

  it('transient phases settle and are never restored mid-animation', () => {
    const persisted = snapshot(t0);
    const finder = persisted.sessions.macos!.windows['macos:files']!;
    const mutated: PersistedSessionsV1 = {
      ...persisted,
      sessions: {
        macos: {
          ...persisted.sessions.macos!,
          windows: {
            ...persisted.sessions.macos!.windows,
            'macos:files': { ...finder, phase: { s: 'opening', originId: 'dock' } },
            'macos:browser': { ...persisted.sessions.macos!.windows['macos:browser']!, phase: { s: 'closing' } },
          },
        },
      },
    };
    const state = bootWith('/macos', 'reload', mutated, t0 + 1000);
    expect(state.sessions.macos.windows['macos:files']?.phase.s).toBe('normal');
    expect(state.sessions.macos.windows['macos:browser']).toBeUndefined();
  });

  it('a cold deep link opens only the named app, placed from learned geometry', () => {
    const persisted = snapshot(t0);
    const state = bootWith('/macos/safari', 'navigate', persisted, t0 + 1000);
    expect(Object.keys(state.sessions.macos.windows)).toEqual(['macos:browser']);
    expect(state.sessions.macos.windows['macos:browser']?.phase.s).toBe('normal');
    expect(state.arrival).toBe('deep-link');
  });

  it('cold /{os} restores the session only if < 30 min old', () => {
    expect(
      Object.keys(bootWith('/macos', 'navigate', snapshot(t0), t0 + SESSION_TTL_COLD - 1).sessions.macos.windows),
    ).toHaveLength(2);
    expect(bootWith('/macos', 'navigate', snapshot(t0), t0 + SESSION_TTL_COLD + 1).sessions.macos.windows).toEqual({});
  });

  it('cold /{os} with a session keeps windows but the URL says nothing is focused', () => {
    const state = bootWith('/macos', 'navigate', snapshot(t0), t0 + 1000);
    expect(state.sessions.macos.focused).toBeNull();
    expect(state.route).toEqual({ kind: 'os', os: 'macos', focus: null });
  });

  it('same-tab re-entry restores the full in-memory session with no TTL', () => {
    let state = last(run(booted('/macos'), [{ type: 'OPEN_APP', role: 'files' }, settle('macos:files')])).state;
    const windows = state.sessions.macos.windows;
    const far = makeDeps({ now: 10 ** 12 });
    state = last(run(state, [{ type: 'SWITCH_OS', to: 'windows', via: 'switch' }], far)).state;
    const epoch1 = state.epoch;
    state = last(
      run(
        state,
        [
          { type: 'PHASE_DONE', target: { kind: 'os', epoch: epoch1 } },
          { type: 'PHASE_DONE', target: { kind: 'os', epoch: epoch1 } },
          { type: 'PHASE_DONE', target: { kind: 'os', epoch: epoch1 } },
        ],
        far,
      ),
    ).state;
    expect(state.activeOs).toBe('windows');
    state = last(run(state, [{ type: 'SWITCH_OS', to: 'macos', via: 'switch' }], far)).state;
    expect(state.sessions.macos.windows).toBe(windows);
  });

  it('a schema mismatch discards sessions; corrupt payloads never throw', () => {
    expect(parsePersistedSessions({ v: 2, savedAt: 1, contentRev: 'x', sessions: {} })).toBeNull();
    expect(parsePersistedSessions('not json')).toBeNull();
    expect(parsePersistedSessions(null)).toBeNull();
    const garbage = parsePersistedSessions({
      v: 1,
      savedAt: 1,
      contentRev: 'x',
      sessions: { macos: { os: 'macos', windows: { 'macos:files': { id: 'nope' } } } },
    });
    expect(garbage?.sessions.macos?.windows).toEqual({});
  });
});

describe('KRN-SES-02 staleness + contentRev revalidation', () => {
  it('a removed slug truncates to its parent section', () => {
    const persisted = snapshot(1000);
    const finder = persisted.sessions.macos!.windows['macos:files']!;
    const stale: PersistedSessionsV1 = {
      ...persisted,
      contentRev: 'old',
      sessions: {
        macos: {
          ...persisted.sessions.macos!,
          windows: {
            'macos:files': {
              ...finder,
              nav: { entries: [{ kind: 'content', ref: { section: 'experience', slug: 'deleted-co' } }], index: 0 },
            },
          },
          zOrder: ['macos:files'],
          focused: 'macos:files',
        },
      },
    };
    const state = bootWith('/macos', 'reload', stale, 2000);
    expect(state.sessions.macos.windows['macos:files']?.nav.entries).toEqual([
      { kind: 'content', ref: { section: 'experience' } },
    ]);
    expect(state.sessions.macos.contentRev).toBe(fixtureCatalog.rev);
  });

  it('a removed slug in a URL canonicalizes to the parent', () => {
    const result = reduce(
      initialKernelState(),
      {
        type: 'BOOT',
        url: '/macos/finder/experience/deleted-co',
        navType: 'navigate',
        viewport: { w: 1440, h: 900, pointer: 'fine' },
        persisted: null,
        capabilities: DEFAULT_CAPABILITIES,
      },
      deps,
    );
    expect(result.routeIntent).toBe('canonicalize');
    expect(deps.codec.encode(result.state.route)).toBe('/macos/finder/experience');
  });
});

describe('KRN-SWITCH-01 epoch-tagged OS switch', () => {
  const settled = () => last(run(booted('/macos'), [{ type: 'OPEN_APP', role: 'files' }, settle('macos:files')])).state;

  it('runs exiting → loading → entering → idle and parks the old session', () => {
    let state = reduce(settled(), { type: 'SWITCH_OS', to: 'windows', via: 'switch' }, deps).state;
    const epoch = state.epoch;
    expect(state.transition).toMatchObject({ phase: 'exiting', from: 'macos', to: 'windows' });
    expect(state.sessions.macos.parkedAt).toBe(deps.now);
    expect(deps.codec.encode(state.route)).toBe('/windows');
    state = reduce(state, { type: 'PHASE_DONE', target: { kind: 'os', epoch } }, deps).state;
    expect(state.transition.phase).toBe('loading');
    expect(state.activeOs).toBeNull();
    const entering = reduce(state, { type: 'PHASE_DONE', target: { kind: 'os', epoch } }, deps);
    state = entering.state;
    expect(state.transition.phase).toBe('entering');
    expect(state.activeOs).toBe('windows');
    // shared/09: focus moves when the enter animation starts, not when it ends.
    expect(entering.focusTarget?.candidates[0]).toBe('os-heading');
    const done = reduce(state, { type: 'PHASE_DONE', target: { kind: 'os', epoch } }, deps);
    expect(done.state.transition.phase).toBe('idle');
    expect(done.focusTarget?.candidates[0]).toBe('os-heading');
  });

  it('a stale PHASE_DONE is ignored', () => {
    const first = reduce(settled(), { type: 'SWITCH_OS', to: 'windows', via: 'switch' }, deps).state;
    const second = reduce(first, { type: 'SWITCH_OS', to: 'ios', via: 'switch' }, deps).state;
    expect(second.epoch).toBe(first.epoch + 1);
    expect(reduce(second, { type: 'PHASE_DONE', target: { kind: 'os', epoch: first.epoch } }, deps).state).toBe(second);
    expect(second.transition).toMatchObject({ phase: 'exiting', from: 'macos', to: 'ios' });
  });

  it('returning to the origin mid-exit reverses into it', () => {
    const exiting = reduce(settled(), { type: 'SWITCH_OS', to: 'windows', via: 'switch' }, deps).state;
    const reversed = reduce(exiting, { type: 'SWITCH_OS', to: 'macos', via: 'history' }, deps);
    expect(reversed.state.transition).toMatchObject({ phase: 'entering', to: 'macos', reverse: true });
    expect(reversed.state.activeOs).toBe('macos');
    expect(reversed.state.sessions.macos.parkedAt).toBeNull();
    expect(reversed.routeIntent).toBeNull();
  });

  it('switching to the chooser ends on the welcome route with the chooser shown', () => {
    let state = reduce(settled(), { type: 'SWITCH_OS', to: null, via: 'switch' }, deps).state;
    expect(state.route).toEqual({ kind: 'welcome' });
    expect(state.onboarding).toBe('chooser');
    state = reduce(state, { type: 'PHASE_DONE', target: { kind: 'os', epoch: state.epoch } }, deps).state;
    expect(state.activeOs).toBeNull();
    expect(state.transition.phase).toBe('idle');
  });

  it('Esc / Back during the chooser enter flight reverses into the chosen card (CHOOSE-ENTER-01)', () => {
    let chooser = reduce(settled(), { type: 'SWITCH_OS', to: null, via: 'switch' }, deps).state;
    chooser = reduce(chooser, { type: 'PHASE_DONE', target: { kind: 'os', epoch: chooser.epoch } }, deps).state;
    const flying = reduce(chooser, { type: 'SWITCH_OS', to: 'windows', via: 'chooser' }, deps).state;
    expect(flying.transition).toMatchObject({ phase: 'exiting', from: null, to: 'windows' });
    const reversed = reduce(flying, { type: 'SWITCH_OS', to: null, via: 'chooser' }, deps);
    expect(reversed.state.transition).toMatchObject({ phase: 'exiting', from: 'windows', to: null });
    expect(reversed.routeIntent).toBe('go'); // go('/') back-collapses the pushed /windows entry
    const landed = reduce(
      reversed.state,
      { type: 'PHASE_DONE', target: { kind: 'os', epoch: reversed.state.epoch } },
      deps,
    );
    expect(landed.state.transition.phase).toBe('idle');
    expect(landed.focusTarget?.candidates[0]).toBe('chooser-card:windows');
  });

  it('Back while the chunk is loading returns to the chooser with focus on that card', () => {
    let chooser = reduce(settled(), { type: 'SWITCH_OS', to: null, via: 'switch' }, deps).state;
    chooser = reduce(chooser, { type: 'PHASE_DONE', target: { kind: 'os', epoch: chooser.epoch } }, deps).state;
    let state = reduce(chooser, { type: 'SWITCH_OS', to: 'ios', via: 'chooser' }, deps).state;
    state = reduce(state, { type: 'PHASE_DONE', target: { kind: 'os', epoch: state.epoch } }, deps).state;
    expect(state.transition.phase).toBe('loading');
    const back = reduce(state, { type: 'SWITCH_OS', to: null, via: 'history' }, deps);
    expect(back.state.transition.phase).toBe('idle');
    expect(back.state.activeOs).toBeNull();
    expect(back.focusTarget?.candidates[0]).toBe('chooser-card:ios');
  });

  it('never switches to an OS that is not visible', () => {
    const state = settled();
    expect(
      reduce(state, { type: 'SWITCH_OS', to: 'windows', via: 'switch' }, makeDeps({ visible: ['macos'] })).state,
    ).toBe(state);
  });
});

describe('KRN-PERSONA-01 no reducer branches on persona', () => {
  it('SELECT_PERSONA yields identical next state for all five ids (except the stored id)', () => {
    const profiles = reduce(booted('/'), { type: 'ONBOARDING_ADVANCE', to: 'profiles' }, deps).state;
    const outcomes = (['recruiter', 'developer', 'adventurer', 'designer', 'guest'] as const).map((id) =>
      reduce(profiles, { type: 'SELECT_PERSONA', id }, deps),
    );
    const [firstOutcome] = outcomes;
    for (const outcome of outcomes) {
      expect(outcome.state).toEqual(firstOutcome!.state);
      expect(outcome.focusTarget).toEqual(firstOutcome!.focusTarget);
      expect(outcome.routeIntent).toEqual(firstOutcome!.routeIntent);
      expect({ ...outcome.prefsPatch, persona: null }).toEqual({ ...firstOutcome!.prefsPatch, persona: null });
    }
    expect(firstOutcome!.state.onboarding).toBe('chooser');
    expect(outcomes.map((outcome) => outcome.prefsPatch?.persona)).toEqual([
      'recruiter',
      'developer',
      'adventurer',
      'designer',
      'guest',
    ]);
  });

  it('a second selection (double click) is ignored — first wins', () => {
    const profiles = reduce(booted('/'), { type: 'ONBOARDING_ADVANCE', to: 'profiles' }, deps).state;
    const once = reduce(profiles, { type: 'SELECT_PERSONA', id: 'guest' }, deps).state;
    expect(reduce(once, { type: 'SELECT_PERSONA', id: 'designer' }, deps).state).toBe(once);
  });
});

describe('onboarding boot state', () => {
  it('the root URL always starts at Hello', () => {
    expect(booted('/').onboarding).toBe('hello');
    const returning = { ...DEFAULT_PREFS, introSeen: true };
    expect(booted('/', { prefs: returning }).onboarding).toBe('hello');
    expect(booted('/', { prefs: returning, navType: 'back_forward' }).onboarding).toBe('hello');
  });
  it('a double tap on Hello is ignored (already in the intro)', () => {
    const intro = reduce(booted('/'), { type: 'ONBOARDING_ADVANCE', to: 'intro' }, deps).state;
    expect(reduce(intro, { type: 'ONBOARDING_ADVANCE', to: 'intro' }, deps).state).toBe(intro);
  });
});
