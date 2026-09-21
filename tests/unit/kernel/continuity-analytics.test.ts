import { describe, expect, it } from 'vitest';
import { continuityOffer, CONTINUITY_TTL, reduce } from '@/lib/kernel/reducers';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import type { KernelState, WindowId } from '@/lib/kernel/types';
import { routePath } from '@/lib/kernel/types';
import type { KernelAction } from '@/lib/kernel/actions';
import {
  analyticsPath,
  createDeferredPort,
  createNoopAdapter,
  createPageviewTracker,
  selectAdapter,
} from '@/lib/analytics';
import type { AnalyticsEvent } from '@/lib/analytics/events';
import { booted, fixtureCatalog, fixtureCodec, last, makeDeps, run } from '../../fixtures/portfolio';

const deps = makeDeps();
const rocket = { section: 'projects', slug: 'rocket' } as const;

function switchAndSettle(state: KernelState, to: 'windows' | 'macos', now = deps.now): KernelState {
  const d = makeDeps({ now });
  let next = reduce(state, { type: 'SWITCH_OS', to, via: 'switch' }, d).state;
  const done: KernelAction = { type: 'PHASE_DONE', target: { kind: 'os', epoch: next.epoch } };
  next = last(run(next, [done, done, done], d)).state;
  return next;
}

describe('CONT-CAP-01 capture on content focus', () => {
  it('captures content refs', () => {
    const state = last(
      run(booted('/macos'), [{ type: 'OPEN_APP', role: 'github', location: { kind: 'content', ref: rocket } }]),
    ).state;
    expect(state.continuity).toEqual({ ref: rocket, fromOs: 'macos', at: deps.now });
  });
  it('section roots count; app roots do not', () => {
    const section = last(
      run(booted('/macos'), [
        { type: 'OPEN_APP', role: 'files', location: { kind: 'content', ref: { section: 'experience' } } },
      ]),
    ).state;
    expect(section.continuity?.ref).toEqual({ section: 'experience' });
    const root = last(run(booted('/macos'), [{ type: 'OPEN_APP', role: 'files' }])).state;
    expect(root.continuity).toBeNull();
    const settings = last(run(booted('/macos'), [{ type: 'OPEN_APP', role: 'settings' }])).state;
    expect(settings.continuity).toBeNull();
  });
  it('the Linux viewer maps to content; the terminal at ~ does not', () => {
    // A deep link captures (the next OS may offer it); only the *offer* is suppressed on deep-link arrival.
    const viewer = booted('/linux/viewer/projects/rocket');
    expect(viewer.continuity?.ref).toEqual(rocket);
    expect(continuityOffer(viewer, fixtureCatalog, OS_REGISTRY, deps.now)).toBeNull();
    expect(booted('/linux').continuity).toBeNull();
    const opened = last(
      run(booted('/linux'), [
        { type: 'OPEN_APP', role: 'viewer', location: { kind: 'vfs', path: ['projects', 'rocket'] } },
      ]),
    ).state;
    expect(opened.continuity?.ref).toEqual(rocket);
  });
});

describe('CONT-OFFER-01 offer decision table', () => {
  const viewedOnMac = () =>
    last(
      run(booted('/macos'), [
        { type: 'OPEN_APP', role: 'github', location: { kind: 'content', ref: rocket } },
        { type: 'PHASE_DONE', target: { kind: 'window', id: 'macos:github' as WindowId } },
      ]),
    ).state;

  it('offers a fresh ref from another OS after a switch', () => {
    const arrived = switchAndSettle(viewedOnMac(), 'windows');
    expect(continuityOffer(arrived, fixtureCatalog, OS_REGISTRY, deps.now + 1000)).toEqual(rocket);
  });
  it('not after 10 minutes', () => {
    const arrived = switchAndSettle(viewedOnMac(), 'windows');
    expect(continuityOffer(arrived, fixtureCatalog, OS_REGISTRY, deps.now + CONTINUITY_TTL)).toBeNull();
  });
  it('not in the same OS it came from', () => {
    expect(continuityOffer(viewedOnMac(), fixtureCatalog, OS_REGISTRY, deps.now)).toBeNull();
  });
  it('not on deep-link or /go arrival', () => {
    const state = { ...switchAndSettle(viewedOnMac(), 'windows'), arrival: 'deep-link' as const };
    expect(continuityOffer(state, fixtureCatalog, OS_REGISTRY, deps.now)).toBeNull();
    expect(continuityOffer({ ...state, arrival: 'go' }, fixtureCatalog, OS_REGISTRY, deps.now)).toBeNull();
  });
  it('not when the ref no longer resolves', () => {
    const state = { ...switchAndSettle(viewedOnMac(), 'windows') };
    const gone = {
      ...state,
      continuity: { ref: { section: 'projects' as const, slug: 'deleted' }, fromOs: 'macos' as const, at: deps.now },
    };
    expect(continuityOffer(gone, fixtureCatalog, OS_REGISTRY, deps.now)).toBeNull();
  });
  it('not when the target OS already shows it', () => {
    const arrived = switchAndSettle(viewedOnMac(), 'windows');
    const shown = reduce(
      arrived,
      { type: 'OPEN_APP', role: 'github', location: { kind: 'content', ref: rocket } },
      deps,
    ).state;
    expect(continuityOffer(shown, fixtureCatalog, OS_REGISTRY, deps.now)).toBeNull();
  });
  it('dismiss clears it', () => {
    const arrived = switchAndSettle(viewedOnMac(), 'windows');
    expect(reduce(arrived, { type: 'CONTINUITY_DISMISS' }, deps).state.continuity).toBeNull();
  });
});

describe('ANL-PORT-01 typed port + adapters + automatic selection', () => {
  const signals = { doNotTrack: false, globalPrivacyControl: false, saveData: false, production: true };
  it('noop under DNT/GPC/Save-Data and outside production; vercel otherwise', () => {
    expect(selectAdapter(signals)).toBe('vercel');
    expect(selectAdapter({ ...signals, doNotTrack: true })).toBe('noop');
    expect(selectAdapter({ ...signals, globalPrivacyControl: true })).toBe('noop');
    expect(selectAdapter({ ...signals, saveData: true })).toBe('noop');
    expect(selectAdapter({ ...signals, production: false })).toBe('noop');
  });
  it('the deferred port buffers until the adapter loads, then forwards; failures never throw', () => {
    const record = { events: [] as AnalyticsEvent[], pageviews: [] as ReturnType<typeof routePath>[] };
    const port = createDeferredPort();
    port.track({ name: 'egg_found', id: 'vim' });
    port.pageview(routePath('/'));
    port.attach(createNoopAdapter(record));
    expect(record).toEqual({ events: [{ name: 'egg_found', id: 'vim' }], pageviews: ['/'] });
    port.attach({
      track: () => {
        throw new Error('blocked');
      },
      pageview: () => undefined,
    });
    expect(() => port.track({ name: 'egg_found', id: 'x' })).not.toThrow();
  });
});

describe('ANL-EVENT-01 kernel actions emit the specified event once', () => {
  it('OPEN_APP → app_opened; SELECT_PERSONA → persona_selected; SWITCH_OS → os_entered', () => {
    const open = reduce(
      booted('/macos'),
      { type: 'OPEN_APP', role: 'github', location: { kind: 'content', ref: rocket } },
      deps,
    );
    expect(open.events).toEqual([{ name: 'app_opened', os: 'macos', role: 'github', section: 'projects' }]);
    const again = reduce(
      open.state,
      { type: 'OPEN_APP', role: 'github', location: { kind: 'content', ref: rocket } },
      deps,
    );
    expect(again.events).toEqual([]);
    const profiles = reduce(booted('/'), { type: 'ONBOARDING_ADVANCE', to: 'profiles' }, deps).state;
    expect(reduce(profiles, { type: 'SELECT_PERSONA', id: 'recruiter' }, deps).events).toEqual([
      { name: 'persona_selected', persona: 'recruiter' },
    ]);
    const chooser = reduce(profiles, { type: 'SELECT_PERSONA', id: 'recruiter' }, deps).state;
    expect(reduce(chooser, { type: 'SWITCH_OS', to: 'linux', via: 'chooser' }, deps).events).toEqual([
      { name: 'os_entered', os: 'linux', via: 'chooser' },
    ]);
  });
  it('a deep-link boot emits exactly one os_entered', () => {
    const result = reduce(booted('/'), { type: 'ROUTE_CHANGED', url: '/macos' }, deps);
    expect(result.events.filter((event) => event.name === 'os_entered')).toHaveLength(1);
  });
});

describe('ANL-PV-01 canonical page views, debounced', () => {
  it('reports the canonical /go form plus the OS', () => {
    const route = (path: string) => {
      const decoded = fixtureCodec.decode(path);
      return decoded.ok ? decoded.route : decoded.nearest;
    };
    expect(analyticsPath(route('/macos/finder/experience/acme'), OS_REGISTRY)).toBe('/macos/go/experience/acme');
    expect(analyticsPath(route('/windows/edge/resume'), OS_REGISTRY)).toBe('/windows/go/resume');
    expect(analyticsPath(route('/linux/viewer/projects/rocket'), OS_REGISTRY)).toBe('/linux/go/projects/rocket');
    expect(analyticsPath(route('/macos'), OS_REGISTRY)).toBe('/macos');
    expect(analyticsPath(route('/macos/settings'), OS_REGISTRY)).toBe('/macos/settings');
  });
  it('a back-collapse echo does not double count', () => {
    const record = { events: [] as AnalyticsEvent[], pageviews: [] as ReturnType<typeof routePath>[] };
    const port = createNoopAdapter(record);
    let pending: (() => void) | null = null;
    const tracker = createPageviewTracker(() => port, { schedule: (run) => ((pending = run), () => (pending = null)) });
    tracker.record(routePath('/macos/go/projects'));
    tracker.record(routePath('/macos'));
    tracker.record(routePath('/macos/go/projects'));
    (pending as (() => void) | null)?.();
    tracker.record(routePath('/macos/go/projects'));
    (pending as (() => void) | null)?.();
    expect(record.pageviews).toEqual(['/macos/go/projects']);
  });
});
