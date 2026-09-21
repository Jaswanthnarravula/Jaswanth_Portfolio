import { runInNewContext } from 'node:vm';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { classify, postureFor, viewportFor } from '@/lib/kernel/geometry';
import { isReserved, matchShortcut, SHORTCUTS, formatChord } from '@/lib/kernel/keymap';
import { TIER_SCRIPT } from '@/lib/kernel/tier-script';
import { createGovernor, flightFailed } from '@/lib/motion/governor';
import { createDirector } from '@/lib/motion/director';
import { dur, REDUCED_CROSSFADE_MS } from '@/lib/motion/dur';
import { solveSpring, spring } from '@/lib/motion/spring';
import { OS_IDS, SECTION_IDS } from '@/lib/kernel/ids';
import { OS_REGISTRY, ownerOf, registryProblems } from '@/lib/kernel/registry';

describe('KRN-REG-01 registry + role bindings', () => {
  it('every section is reachable in every OS', () => {
    expect(registryProblems()).toEqual([]);
    for (const os of OS_IDS) for (const section of SECTION_IDS) expect(ownerOf(os, section).owns).toContain(section);
  });
  it('matches the documented app slugs', () => {
    const slugs = Object.fromEntries(OS_IDS.map((os) => [os, OS_REGISTRY[os].apps.map((app) => app.slug)]));
    expect(slugs).toEqual({
      ios: ['safari', 'github', 'files', 'notes', 'mail', 'messages', 'settings'],
      macos: ['finder', 'safari', 'github', 'preview', 'mail', 'vscode', 'terminal', 'settings'],
      windows: ['explorer', 'edge', 'github', 'outlook', 'vscode', 'terminal', 'settings'],
      android: ['chrome', 'github', 'files', 'keep', 'gmail', 'settings'],
      linux: ['terminal', 'viewer'],
    });
  });
});

describe('RESP-CLASS-01 size classes + posture', () => {
  it.each([
    [844, 390, 'fine', 'compact', 'compact'],
    [390, 844, 'coarse', 'compact', 'compact'],
    [1180, 820, 'coarse', 'expanded', 'touch'],
    [820, 1180, 'coarse', 'medium', 'touch'],
    [1440, 900, 'fine', 'expanded', 'pointer'],
    [1920, 1080, 'fine', 'large', 'pointer'],
    [1024, 768, 'fine', 'medium', 'touch'],
    [1440, 480, 'fine', 'compact', 'compact'],
    [320, 700, 'fine', 'compact', 'compact'],
  ] as const)('%i×%i %s → %s / %s', (w, h, pointer, size, posture) => {
    expect(classify(w, h)).toBe(size);
    expect(postureFor(classify(w, h), pointer)).toBe(posture);
    expect(viewportFor(w, h, pointer).orientation).toBe(w >= h ? 'landscape' : 'portrait');
  });
  it('400 % zoom on a 1280 px laptop is compact (WCAG 1.4.10)', () => {
    expect(classify(1280 / 4, 800 / 4)).toBe('compact');
  });
});

describe('A11Y-KEY-01 keymap registry + deny-list', () => {
  it('the registry has no reserved chord', () => {
    for (const shortcut of SHORTCUTS)
      for (const chord of shortcut.chords) expect(isReserved(chord), `${shortcut.id}`).toBe(false);
  });
  it('the deny-list catches reserved chords', () => {
    expect(isReserved({ key: 'k', ctrlOrMeta: true, alt: true })).toBe(true);
    expect(isReserved({ key: ' ', alt: true })).toBe(true);
    expect(isReserved({ key: 'F6' })).toBe(true);
    expect(isReserved({ key: 'F10' })).toBe(true);
    expect(isReserved({ key: 'l', ctrlOrMeta: true })).toBe(true);
    expect(isReserved({ key: 't', alt: true, shift: true })).toBe(true);
    expect(isReserved({ key: 'w', alt: true, shift: true })).toBe(false);
  });
  it('matches physical keys for Alt+Shift chords and respects text fields and single-key settings', () => {
    const base = { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false };
    expect(
      matchShortcut(
        { ...base, key: '„', code: 'KeyW', altKey: true, shiftKey: true },
        { inTextField: false, singleKeyShortcuts: true },
      ),
    ).toBe('close-window');
    expect(
      matchShortcut(
        { ...base, key: 'W', code: 'KeyW', altKey: true, shiftKey: true },
        { inTextField: true, singleKeyShortcuts: true },
      ),
    ).toBeNull();
    expect(matchShortcut({ ...base, key: 'k', metaKey: true }, { inTextField: true, singleKeyShortcuts: true })).toBe(
      'search',
    );
    expect(matchShortcut({ ...base, key: '/' }, { inTextField: false, singleKeyShortcuts: false })).toBeNull();
    expect(matchShortcut({ ...base, key: '?', shiftKey: true }, { inTextField: false, singleKeyShortcuts: true })).toBe(
      'help',
    );
    expect(formatChord({ key: 'k', ctrlOrMeta: true }, true)).toBe('⌘K');
    expect(formatChord({ key: 'w', alt: true, shift: true }, false)).toBe('Alt+Shift+W');
  });
});

describe('MOTION-SPRING-01 spring with velocity-preserving retarget', () => {
  it('converges to the target for under-, critically- and over-damped springs', () => {
    for (const damping of [0.5, 1, 1.6]) {
      const end = solveSpring(1, 0, { response: 0.4, damping }, 5);
      expect(Math.abs(end.value)).toBeLessThan(1e-3);
    }
  });
  it('under-damped springs overshoot; critical ones do not', () => {
    const samples = (damping: number) =>
      Array.from({ length: 200 }, (_, i) => solveSpring(-1, 0, { response: 0.5, damping }, i / 100).value);
    expect(Math.max(...samples(0.6))).toBeGreaterThan(0.01);
    expect(Math.max(...samples(1))).toBeLessThanOrEqual(1e-9);
  });
  it('velocity matches the numerical derivative', () => {
    for (const damping of [0.7, 1, 1.4]) {
      const config = { response: 0.45, damping };
      const t = 0.12;
      const h = 1e-5;
      const numeric = (solveSpring(1, 2, config, t + h).value - solveSpring(1, 2, config, t - h).value) / (2 * h);
      expect(solveSpring(1, 2, config, t).velocity).toBeCloseTo(numeric, 3);
    }
  });
  it('retarget mid-flight keeps position and velocity continuous', () => {
    const s = spring(0, { response: 0.42, damping: 0.86 }, 0);
    s.retarget(100, 0);
    const before = s.sample(120);
    s.retarget(-50, 120);
    const after = s.sample(120);
    expect(after.value).toBeCloseTo(before.value, 9);
    expect(after.velocity).toBeCloseTo(before.velocity, 9);
    expect(s.target).toBe(-50);
    expect(s.atRest(10_000)).toBe(true);
    s.snap(3, 10_000);
    expect(s.sample(10_001).value).toBe(3);
  });
});

describe('MOTION-DIR-01 epoch director', () => {
  it('kill(epoch) stops older timelines only', () => {
    const director = createDirector();
    const killed: string[] = [];
    const timeline = (name: string) => ({ kill: () => killed.push(name) });
    director.register(1, timeline('a'));
    director.register(2, timeline('b'));
    const unregister = director.register(3, timeline('c'));
    expect(director.kill(3)).toBe(2);
    expect(killed).toEqual(['a', 'b']);
    expect(director.size).toBe(1);
    unregister();
    expect(director.size).toBe(0);
  });
});

describe('MOTION-RM-01 (primitive) dur()', () => {
  it('collapses durations under reduced motion', () => {
    expect(dur(420, { reduced: false })).toBe(420);
    expect(dur(420, { reduced: true })).toBe(0);
    expect(dur(420, { reduced: true, crossfade: true })).toBe(REDUCED_CROSSFADE_MS);
  });
});

describe('PERF-GOV-01 demote-only governor', () => {
  const fly = (governor: ReturnType<typeof createGovernor>, deltas: number[]) => {
    const flight = governor.startFlight();
    deltas.forEach((delta) => flight.frame(delta));
    return flight.end();
  };
  it('a flight fails on p95 > 22 ms or three frames > 50 ms, ignoring the first two frames', () => {
    expect(flightFailed([200, 200, 16, 16, 16])).toBe(false);
    expect(flightFailed([16, 16, ...Array(20).fill(25)])).toBe(true);
    expect(flightFailed([16, 16, 60, 60, 60, ...Array(100).fill(16)])).toBe(true);
    expect(flightFailed([16, 16, 60, 60, ...Array(100).fill(16)])).toBe(false);
  });
  it('3 failed flights in a rolling 10 demote one tier, persist, and never promote', () => {
    const demotions: { tier: number; exp: number }[] = [];
    const governor = createGovernor({ tier: 2, now: () => 1000, onDemote: (d) => demotions.push(d) });
    const bad = [16, 16, ...Array(20).fill(30)];
    const good = Array(30).fill(16);
    fly(governor, bad);
    fly(governor, good);
    fly(governor, bad);
    expect(governor.tier).toBe(2);
    fly(governor, bad);
    expect(governor.tier).toBe(1);
    expect(demotions).toEqual([{ tier: 1, exp: 1000 + 14 * 24 * 3600 * 1000 }]);
    for (let i = 0; i < 20; i++) fly(governor, good);
    expect(governor.tier).toBe(1);
  });
});

describe('PERF-TIER-01 pre-paint tier script', () => {
  interface Env {
    media?: string[];
    storage?: Record<string, string>;
    deviceMemory?: number;
    hardwareConcurrency?: number;
    saveData?: boolean;
    backdrop?: boolean;
  }
  function execute(env: Env = {}) {
    // Like a real DOMStringMap, assignments are coerced to strings.
    const dataset = new Proxy<Record<string, string>>(
      {},
      {
        set: (target, key, value) => Reflect.set(target, key, String(value)),
      },
    );
    const style: Record<string, string> = env.backdrop === false ? {} : { backdropFilter: '' };
    const context = {
      document: { documentElement: { dataset, style } },
      navigator: {
        deviceMemory: env.deviceMemory,
        hardwareConcurrency: env.hardwareConcurrency ?? 8,
        connection: { saveData: env.saveData ?? false },
      },
      // A media-query list matches when any of its queries does, as in browsers.
      matchMedia: (query: string) => ({ matches: query.split(',').some((q) => (env.media ?? []).includes(q)) }),
      localStorage: env.storage ?? {},
      JSON,
      Date,
    };
    const before = Object.keys(context).sort();
    runInNewContext(TIER_SCRIPT, context);
    expect(Object.keys(context).sort(), 'the script leaks no globals').toEqual(before);
    return dataset;
  }
  const prefs = (state: object) => ({ 'pf.prefs.v1': JSON.stringify({ state, version: 1 }) });

  it('is small enough to inline (≤ 600 B raw)', () => {
    expect(Buffer.byteLength(TIER_SCRIPT)).toBeLessThanOrEqual(600);
    expect(gzipSync(TIER_SCRIPT).length).toBeLessThan(450); // what actually crosses the wire
  });
  it.each<[string, Env, Record<string, string>]>([
    ['default desktop', {}, { tier: '1', motion: 'full', glass: 'full' }],
    ['Save-Data', { saveData: true }, { tier: '0' }],
    ['prefers-reduced-data', { media: ['(prefers-reduced-data)'] }, { tier: '0' }],
    ['2 GB memory', { deviceMemory: 2 }, { tier: '0' }],
    ['2 cores', { hardwareConcurrency: 2 }, { tier: '0' }],
    ['no backdrop-filter', { backdrop: false }, { tier: '0' }],
    ['forced colors', { media: ['(forced-colors)'] }, { tier: '0' }],
    ['unknown deviceMemory is not low', { deviceMemory: undefined }, { tier: '1' }],
    ['system reduced motion', { media: ['(prefers-reduced-motion)'] }, { motion: 'reduced' }],
    [
      'in-app full motion wins over the system',
      { media: ['(prefers-reduced-motion)'], storage: prefs({ motion: 'full' }) },
      { motion: 'full' },
    ],
    ['in-app reduced motion', { storage: prefs({ motion: 'reduced' }) }, { motion: 'reduced' }],
    ['reduced transparency', { media: ['(prefers-reduced-transparency)'] }, { glass: 'solid' }],
    ['high contrast', { media: ['(prefers-contrast:more)'] }, { glass: 'solid' }],
    ['in-app solid glass', { storage: prefs({ glass: 'solid' }) }, { glass: 'solid' }],
    [
      'a live demotion caps the tier',
      { storage: prefs({ demotion: { tier: 0, exp: Date.now() + 60_000 } }) },
      { tier: '0' },
    ],
    ['an expired demotion is ignored', { storage: prefs({ demotion: { tier: 0, exp: 1 } }) }, { tier: '1' }],
    ['chosen theme applies before paint', { storage: prefs({ theme: 'dark' }) }, { theme: 'dark' }],
    ['corrupt prefs never break the page', { storage: { 'pf.prefs.v1': '{nope' } }, { tier: '1', motion: 'full' }],
  ])('%s', (_name, env, expected) => {
    expect(execute(env)).toMatchObject(expected);
  });
  it('system theme sets no data-theme', () => {
    expect(execute({ storage: prefs({ theme: 'system' }) }).theme).toBeUndefined();
  });
});
