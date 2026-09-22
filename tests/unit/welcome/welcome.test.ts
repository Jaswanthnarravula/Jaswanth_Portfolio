/**
 * P1 welcome logic — NFLX-PROF-01 (five data-driven profiles) · CHOOSE-BADGE-01 (badge decision table) ·
 * NFLX-MARK-01 (no "Netflix" in UI strings or metadata) · HELLO-RETURN-01 / NFLX-RETURN-01 (pre-paint hint) ·
 * PERF-GL-02 (Tier 2 decision table: coarse pointers and weak GPUs never get WebGL) · the kernel bridge, stage claims
 * and the chooser visibility selector that the journeys rely on.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';
import type { KernelAction } from '@/lib/kernel/actions';
import { PERSONA_IDS } from '@/lib/kernel/ids';
import { DEFAULT_PREFS, chooserShown } from '@/lib/kernel/state';
import { WELCOME_SCRIPT } from '@/lib/kernel/welcome-script';
import { beginHandoff, takeHandoff } from '@/lib/motion/handoff';
import { metadataForRoute, SITE_DESCRIPTION } from '@/lib/seo/metadata';
import { SITE_TITLE } from '@/lib/kernel/route/title';
import { evaluateTier2, type Tier2Environment } from '@/lib/webgl/tier2';
import { CHOOSER_HEADING, OS_CHARACTER, suitedOs } from '@/lib/welcome/chooser';
import { PROFILES } from '@/lib/welcome/profiles';
import snapshots from '@/lib/welcome/snapshots.generated.json';
import wordmark from '@/lib/welcome/wordmark.generated.json';
import { encodeWithinBudget, SNAPSHOT_BUDGET } from '../../../scripts/capture-snapshots.mjs';
import { EM, MARK } from '../../../scripts/build-wordmark.mjs';
import { attachKernel, resetKernelBridge, sendToKernel, whenKernel } from '@/stores/kernel-bridge';
import { claimPhases, isClaimed, resetStageClaims } from '@/stores/transition-stage';
import { booted, last, run } from '../../fixtures/portfolio';

describe('CHOOSE-CARD-01 snapshot pipeline', () => {
  const manifest = snapshots as Record<
    string,
    Record<string, { avif: string; webp: string; width: number; height: number }>
  >;
  it('every OS has a landscape and a portrait snapshot, each as AVIF and a WebP fallback within 25 KB', () => {
    expect(Object.keys(manifest).sort()).toEqual(['android', 'ios', 'linux', 'macos', 'windows']);
    for (const [os, shots] of Object.entries(manifest)) {
      expect(Object.keys(shots).sort(), os).toEqual(['landscape', 'portrait']);
      expect(shots.landscape!.width, os).toBeGreaterThan(shots.landscape!.height);
      expect(shots.portrait!.height, os).toBeGreaterThan(shots.portrait!.width);
      for (const shot of Object.values(shots))
        for (const [format, src] of [
          ['avif', shot.avif],
          ['webp', shot.webp],
        ] as const) {
          const name = src.replace('/assets/snapshots/', '');
          expect(name, os).toMatch(/^[a-z]+\.(landscape|portrait)\.[0-9a-f]{10}\.(avif|webp)$/);
          expect(name.startsWith(`${os}.`) && name.endsWith(`.${format}`), src).toBe(true);
          const bytes = statSync(join(process.cwd(), 'public', src)).size;
          expect(bytes, src).toBeGreaterThan(0);
          expect(bytes, src).toBeLessThanOrEqual(SNAPSHOT_BUDGET);
        }
    }
  });
  it('the encoder steps quality down until the budget fits, and refuses to go below q30', async () => {
    const tried: number[] = [];
    const fit = await encodeWithinBudget(async (q: number) => {
      tried.push(q);
      return new Uint8Array(q > 40 ? 30_000 : 20_000);
    });
    expect(fit.quality).toBe(38);
    expect(tried).toEqual([62, 54, 46, 38]);
    await expect(encodeWithinBudget(async () => new Uint8Array(30_000))).rejects.toThrow(/cannot fit/);
  });
});

describe('NFLX-PROF-01 five profiles, data-driven', () => {
  it('has exactly the five PersonaIds, each with a name and its own avatar', () => {
    expect(PROFILES.map((p) => p.id)).toEqual([...PERSONA_IDS]);
    expect(new Set(PROFILES.map((p) => p.avatar)).size).toBe(5);
    for (const p of PROFILES) expect(p.avatar).toBe(`avatar.${p.id}`);
    // Data only: no behaviour, destination or content per profile.
    for (const p of PROFILES) expect(Object.keys(p).sort()).toEqual(['avatar', 'id', 'name']);
  });
});

describe('CHOOSE-BADGE-01 device-suited badge from size + input only', () => {
  const all = ['ios', 'macos', 'windows', 'android', 'linux'] as const;
  it.each([
    ['coarse', 'compact', 0, 'ios'],
    ['coarse', 'compact', 1, 'android'],
    ['coarse', 'compact', 2, 'ios'],
    ['fine', 'expanded', 0, 'macos'],
    ['fine', 'large', 7, 'macos'],
    ['coarse', 'medium', 0, null], // a tablet: no badge
    ['coarse', 'expanded', 0, null], // a large tablet: no badge
    ['fine', 'medium', 0, null], // a medium-width desktop window: nothing else
    ['fine', 'compact', 0, null], // a narrow desktop window: no badge
    ['none', 'expanded', 0, null],
  ] as const)('%s pointer, %s, seed %i → %s', (pointer, sizeClass, seed, expected) => {
    expect(suitedOs({ pointer, sizeClass, seed, visible: all })).toBe(expected);
  });
  it('only a visible (released) OS can carry it, and a phone falls back to the other phone OS', () => {
    expect(suitedOs({ pointer: 'fine', sizeClass: 'large', seed: 0, visible: ['linux'] })).toBeNull();
    expect(suitedOs({ pointer: 'coarse', sizeClass: 'compact', seed: 0, visible: ['android'] })).toBe('android');
    expect(suitedOs({ pointer: 'coarse', sizeClass: 'compact', seed: 0, visible: [] })).toBeNull();
  });
  it('is identical for all PersonaIds: the rule has no profile input at all', () => {
    const input = { pointer: 'fine', sizeClass: 'expanded', seed: 3, visible: all } as const;
    const results = PERSONA_IDS.map((persona) => suitedOs({ ...input, persona } as typeof input));
    expect(new Set(results)).toEqual(new Set(['macos']));
    expect(suitedOs.length).toBe(1);
  });
});

describe('NFLX-MARK-01 the name wordmark; no "Netflix" in UI strings or metadata', () => {
  const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? sourceFiles(path) : /\.(tsx?|css)$/.test(name) ? [path] : [];
    });
  /** Code with comments removed (the plan file names in comments are not UI). */
  const code = (path: string) =>
    readFileSync(path, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('the wordmark is the visitor-facing name, generated as original artwork', () => {
    expect(wordmark.text).toBe('JASWANTH');
    expect(wordmark.source.licence).toBe('SIL OFL 1.1');
  });
  it('the wordmark is the storyboard frame’s `.mark` box: line-height .9 + .12 em padding, ellipse under the feet', () => {
    const [x, y, width, height] = wordmark.viewBox;
    expect([x, y]).toEqual([0, 0]);
    expect(height).toBe((MARK.lineHeight + MARK.padBottom) * EM);
    expect(wordmark.widthEm).toBeCloseTo(width! / EM, 3);
    // The frame's ellipse: 6 % wider than the box each side, .62 em tall, its bottom .34 em below the box.
    expect(wordmark.cut.rx).toBeCloseTo(width! * (0.5 + MARK.cut.overhang), 0);
    expect(wordmark.cut.cy + wordmark.cut.ry).toBeCloseTo(height! + MARK.cut.bottom * EM, 0);
    // Only the letters' feet are trimmed: the ellipse's top stays below the baseline's cap region.
    expect(wordmark.cut.cy - wordmark.cut.ry).toBeGreaterThan(wordmark.baseline - 0.05 * EM);
  });
  it('no welcome, chooser, layout, SEO or data string says "Netflix"', () => {
    for (const dir of ['components/welcome', 'components/shell', 'app', 'lib/seo', 'lib/welcome', 'data'])
      for (const file of sourceFiles(dir)) expect(code(file), file).not.toMatch(/netflix/i);
  });
  it('titles, descriptions and chooser copy never say it either', () => {
    const texts = [
      SITE_TITLE,
      SITE_DESCRIPTION,
      CHOOSER_HEADING,
      ...Object.values(OS_CHARACTER),
      ...PROFILES.map((p) => p.name),
      JSON.stringify(metadataForRoute({ kind: 'welcome' })),
    ];
    for (const text of texts) expect(text).not.toMatch(/netflix/i);
  });
});

describe('HELLO-RETURN-01 / NFLX-RETURN-01 pre-paint welcome hint', () => {
  const execute = (storage: Record<string, string>) => {
    const dataset: Record<string, string> = {};
    runInNewContext(WELCOME_SCRIPT, { document: { documentElement: { dataset } }, localStorage: storage, JSON });
    return dataset;
  };
  const prefs = (state: object) => ({ 'pf.prefs.v1': JSON.stringify({ state, version: 1 }) });

  it('keeps the root URL on Hello while preserving the last profile marker', () => {
    expect(execute(prefs({ ...DEFAULT_PREFS, introSeen: true, persona: 'designer' }))).toEqual({
      persona: 'designer',
    });
  });
  it('a first visit, a muted visitor and corrupt storage', () => {
    expect(execute({})).toEqual({});
    expect(execute(prefs({ ...DEFAULT_PREFS, sound: { enabled: false, volume: 0.8, ui: false } }))).toEqual({
      sound: 'off',
    });
    expect(execute({ 'pf.prefs.v1': '{nope' })).toEqual({});
  });
  it('never writes an unexpected persona value into the page', () => {
    expect(execute(prefs({ introSeen: true, persona: '"><img src=x onerror=alert(1)>' }))).toEqual({});
  });
});

describe('kernel bridge: the welcome island queues until the kernel boots', () => {
  afterEach(() => resetKernelBridge());
  it('flushes queued actions in order and builds deferred messages from the live prefs', async () => {
    const seen: KernelAction[] = [];
    sendToKernel({ type: 'ONBOARDING_ADVANCE', to: 'intro' });
    sendToKernel((kernel) => ({ type: 'SET_PREF', patch: { sound: { ...kernel.prefs().sound, enabled: false } } }));
    sendToKernel({ type: 'SELECT_PERSONA', id: 'guest' });
    const ready = whenKernel();
    attachKernel({
      dispatch: (a) => seen.push(a),
      prefs: () => ({ ...DEFAULT_PREFS, sound: { ...DEFAULT_PREFS.sound, volume: 0.3 } }),
    });
    await expect(ready).resolves.toBeDefined();
    expect(seen).toEqual([
      { type: 'ONBOARDING_ADVANCE', to: 'intro' },
      { type: 'SET_PREF', patch: { sound: { enabled: false, volume: 0.3, ui: false } } },
      { type: 'SELECT_PERSONA', id: 'guest' },
    ]);
    sendToKernel({ type: 'ONBOARDING_ADVANCE', to: 'profiles' });
    expect(seen).toHaveLength(4); // attached: immediate
  });
});

describe('PERF-GL-02 / HELLO-GL-01 Tier 2 candidacy (WebGL only where it cannot hurt)', () => {
  const capable: Tier2Environment = {
    matches: (q) => q === '(pointer: fine)' || q === '(hover: hover)',
    width: 1440,
    deviceMemory: 8,
    hardwareConcurrency: 10,
    dataset: { tier: '1', motion: 'full', glass: 'full' },
    battery: () => Promise.resolve({ charging: true, level: 1 }),
    probe: () => ({ renderer: 'ANGLE (NVIDIA GeForce RTX 3060)', release: () => undefined }),
    devicePixelRatio: 2,
  };
  const verdict = (overrides: Partial<Tier2Environment>, forced = false) =>
    evaluateTier2({ ...capable, ...overrides }, { forced });

  it('a capable desktop gets T2 at DPR ≤ 1.5', async () => {
    await expect(verdict({})).resolves.toEqual({ ok: true, reason: 'capable', dpr: 1.5 });
  });
  it.each([
    ['coarse pointer', { matches: (q: string) => q === '(pointer: coarse)' }, 'pointer'],
    ['narrow screen', { width: 900 }, 'width'],
    ['4 GB memory', { deviceMemory: 4 }, 'memory'],
    ['4 cores', { hardwareConcurrency: 4 }, 'cores'],
    ['reduced motion', { dataset: { tier: '1', motion: 'reduced', glass: 'full' } }, 'preference'],
    ['solid glass', { dataset: { tier: '1', motion: 'full', glass: 'solid' } }, 'preference'],
    ['low battery', { battery: () => Promise.resolve({ charging: false, level: 0.2 }) }, 'battery'],
    ['no WebGL2', { probe: (): null => null }, 'webgl2'],
    ['software GL', { probe: () => ({ renderer: 'Google SwiftShader', release: () => undefined }) }, 'gpu'],
    ['mobile GPU', { probe: () => ({ renderer: 'Mali-G78', release: () => undefined }) }, 'gpu'],
  ] as const)('%s → T1', async (_name, overrides, reason) => {
    await expect(verdict(overrides as Partial<Tier2Environment>)).resolves.toMatchObject({ ok: false, reason });
  });
  it('Iris Xe is allowed at DPR 1.0; the CI flag forces software GL through', async () => {
    await expect(
      verdict({ probe: () => ({ renderer: 'Intel(R) Iris(R) Xe Graphics', release: () => undefined }) }),
    ).resolves.toEqual({ ok: true, reason: 'capable', dpr: 1 });
    await expect(
      verdict(
        {
          matches: () => false,
          probe: (allow: boolean) => (allow ? { renderer: 'SwiftShader', release: () => undefined } : null),
        },
        true,
      ),
    ).resolves.toMatchObject({ ok: true, reason: 'forced' });
  });
});

describe('stage claims, hand-off and chooser visibility', () => {
  afterEach(() => resetStageClaims());
  it('a stage owns only the phases and epoch it claimed', () => {
    const release = claimPhases(7, ['exiting', 'entering']);
    expect(isClaimed(7, 'exiting')).toBe(true);
    expect(isClaimed(7, 'failed')).toBe(false);
    expect(isClaimed(8, 'exiting')).toBe(false);
    release();
    expect(isClaimed(7, 'exiting')).toBe(false);
  });
  it('a hand-off is taken once', async () => {
    expect(takeHandoff()).toBeNull();
    beginHandoff(Promise.resolve({ persona: 'guest', rect: { x: 1, y: 2, width: 3, height: 4 } }));
    await expect(takeHandoff()).resolves.toMatchObject({ persona: 'guest' });
    expect(takeHandoff()).toBeNull();
  });
  it('the chooser shows on the welcome route in the chooser state and while its own flight runs', () => {
    const macos = booted('/macos');
    expect(chooserShown(macos)).toBe(false);
    const toChooser = last(run(macos, [{ type: 'SWITCH_OS', to: null, via: 'switch' }])).state;
    expect(chooserShown(toChooser)).toBe(true);
    const settled = last(run(toChooser, [{ type: 'PHASE_DONE', target: { kind: 'os', epoch: toChooser.epoch } }]));
    const flying = last(run(settled.state, [{ type: 'SWITCH_OS', to: 'windows', via: 'chooser' }])).state;
    expect(flying.route.kind).toBe('os');
    expect(chooserShown(flying)).toBe(true); // the snapshot flight covers the OS mounting underneath
  });
});
