/**
 * The welcome-motion chunk (plans/02 "Motion", plans/03 intro + hand-off): every authored sequence can be finished
 * or killed at once (input always wins), the intro's end hands over exactly once, the hand-off resolves where the
 * avatar landed, and the greeting loop restores the static Hello when stopped. HELLO-GL-01's bootstrap: Tier 2
 * decides before three.js is imported, and a stopped stage never restarts in the same session.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { greetingLoop, handOff, playIntro, profilesEntrance } from '@/components/welcome/motion';
import paths from '@/lib/welcome/hello-paths.generated.json';

const svgPath = (d = '') => {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  if (d) path.setAttribute('d', d);
  document.body.append(path);
  return path;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('intro timeline', () => {
  it.each([
    ['full', { muted: false, reduced: false }],
    ['muted', { muted: true, reduced: false }],
    ['reduced', { muted: false, reduced: true }],
  ] as const)('%s: finish() lands the end state and hands over once', (_name, options) => {
    const mark = document.createElement('div');
    const onDone = vi.fn();
    const playback = playIntro(mark, { ...options, onDone });
    playback.finish();
    playback.finish();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(Number(getComputedStyle(mark).opacity)).toBe(0); // faded out at the end
    playback.kill();
  });
});

describe('profiles entrance and hand-off', () => {
  it('finish() shows every card at rest', () => {
    const heading = document.createElement('h1');
    const cards = [document.createElement('button'), document.createElement('button')];
    const playback = profilesEntrance(heading, cards);
    playback.finish();
    expect(heading.style.opacity).toBe('1');
    for (const card of cards) expect(card.style.opacity).toBe(''); // clearProps: nothing left inline
    playback.kill();
  });

  it('the hand-off fades the others and resolves with the avatar rect', async () => {
    const avatar = document.createElement('span');
    const other = document.createElement('button');
    document.body.append(avatar, other);
    const rect = await handOff(avatar, [other], { reduced: true });
    expect(rect).toHaveProperty('width');
    expect(other.style.opacity).toBe('0');
  });
});

describe('greeting loop', () => {
  it('starts after the draw and, when stopped, restores the static Hello', () => {
    const glyph = svgPath('M0 0L10 10');
    const alt = svgPath();
    const stop = greetingLoop(glyph, alt);
    expect(glyph.style.strokeDasharray).toBe('none');
    stop();
    expect(glyph.getAttribute('d')).toBe(paths.greetings[0]!.d);
    expect(alt.style.opacity).toBe('0');
  });
});

describe('HELLO-GL-01 WebGL bootstrap', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@/lib/webgl/tier2');
    vi.doUnmock('@/lib/webgl/glass-stage');
    delete document.documentElement.dataset.webgl;
  });
  const mockStage = (verdict: { ok: boolean; reason: string; dpr: number }) => {
    const created: { onStop: (reason: 'lost' | 'slow') => void }[] = [];
    vi.doMock('@/lib/webgl/tier2', () => ({
      evaluateTier2: () => Promise.resolve(verdict),
      browserTier2Environment: () => ({}),
    }));
    vi.doMock('@/lib/webgl/glass-stage', () => ({
      createGlassStage: (options: { onStop: (reason: 'lost' | 'slow') => void }) => {
        created.push(options);
        return {
          dim: () => Promise.resolve(),
          dispose: () => undefined,
          memory: () => ({ geometries: 0, textures: 0 }),
        };
      },
    }));
    return created;
  };

  it('T1 never imports the stage', async () => {
    const created = mockStage({ ok: false, reason: 'pointer', dpr: 1 });
    const { startHelloStage } = await import('@/lib/webgl');
    await expect(startHelloStage({ container: document.body, panels: [] })).resolves.toBeNull();
    expect(created).toHaveLength(0);
    expect(document.documentElement.dataset.webgl).toBeUndefined();
  });

  it('T2 starts the stage and marks the page; a stop returns to CSS glass for the rest of the session', async () => {
    const created = mockStage({ ok: true, reason: 'capable', dpr: 1.5 });
    const { startHelloStage } = await import('@/lib/webgl');
    const stage = await startHelloStage({ container: document.body, panels: [] });
    expect(stage).not.toBeNull();
    expect(document.documentElement.dataset.webgl).toBe('on');
    created[0]!.onStop('lost');
    expect(document.documentElement.dataset.webgl).toBeUndefined();
    await expect(startHelloStage({ container: document.body, panels: [] })).resolves.toBeNull();
    expect(created).toHaveLength(1);
  });

  it('dispose() clears the marker', async () => {
    mockStage({ ok: true, reason: 'capable', dpr: 1 });
    const { startHelloStage } = await import('@/lib/webgl');
    const stage = await startHelloStage({ container: document.body, panels: [] });
    stage!.dispose();
    expect(document.documentElement.dataset.webgl).toBeUndefined();
  });
});
