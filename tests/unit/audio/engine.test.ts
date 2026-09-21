/**
 * ASSET-AUDIO-01 (engine never throws when blocked or missing) · NFLX-AUDIO-01 (official mp3 or the original chime;
 * muted, blocked and missing all complete silently) · NFLX-AUDIO-02 (nothing fetched until prefetch is called).
 */
import { describe, expect, it } from 'vitest';
import {
  createAudioEngine,
  type AudioContextLike,
  type AudioEnvironment,
  type AudioParamLike,
} from '@/lib/audio/engine';

const param = (): AudioParamLike & { ramps: number[] } => {
  const p = {
    value: 1,
    ramps: [] as number[],
    setValueAtTime: (v: number) => (p.value = v),
    linearRampToValueAtTime: (v: number) => p.ramps.push(v),
    exponentialRampToValueAtTime: () => undefined,
    cancelScheduledValues: () => undefined,
  };
  return p;
};

function fakeContext(options: { decode?: 'ok' | 'fail'; resume?: 'ok' | 'reject' } = {}) {
  const log = { oscillators: 0, buffers: 0, stopped: 0, closed: false, gains: [] as ReturnType<typeof param>[] };
  const node = () => ({ connect: () => undefined });
  const source = () => ({
    ...node(),
    start: () => undefined,
    stop: () => {
      log.stopped++;
    },
  });
  const ctx: AudioContextLike = {
    currentTime: 0,
    state: 'running',
    destination: {},
    resume: () => (options.resume === 'reject' ? Promise.reject(new Error('blocked')) : Promise.resolve()),
    close: () => {
      log.closed = true;
      return Promise.resolve();
    },
    createGain: () => {
      const gain = param();
      log.gains.push(gain);
      return { ...node(), gain };
    },
    createBufferSource: () => {
      log.buffers++;
      return { ...source(), buffer: null };
    },
    createOscillator: () => {
      log.oscillators++;
      return { ...source(), type: 'sine', frequency: param() };
    },
    decodeAudioData: () =>
      options.decode === 'fail' ? Promise.reject(new Error('corrupt')) : Promise.resolve({ duration: 1.2 }),
  };
  return { ctx, log };
}

function environment(overrides: Partial<AudioEnvironment> & { ctx?: AudioContextLike | null } = {}) {
  const fetched: string[] = [];
  let clock = 0;
  const env: AudioEnvironment = {
    createContext: () => (overrides.ctx === undefined ? fakeContext().ctx : overrides.ctx),
    fetchBytes: (url) => {
      fetched.push(url);
      return Promise.resolve(new ArrayBuffer(8));
    },
    now: () => clock,
    ...overrides,
  };
  return { env, fetched, advance: (ms: number) => (clock += ms) };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const ON = { enabled: true, volume: 0.8 };

describe('ASSET-AUDIO-01 / NFLX-AUDIO-01 audio engine', () => {
  it('plays the official sound when it decodes in time', async () => {
    const { ctx, log } = fakeContext();
    const { env } = environment({ ctx });
    const engine = createAudioEngine({ src: '/intro.mp3', env });
    engine.prefetch();
    engine.unlock();
    engine.playIntro(ON);
    await flush();
    expect(log.buffers).toBe(1);
    expect(log.oscillators).toBe(0);
  });

  it('original mode (no file) plays the original chime and fetches nothing', async () => {
    const { ctx, log } = fakeContext();
    const { env, fetched } = environment({ ctx });
    const engine = createAudioEngine({ src: null, env });
    engine.prefetch();
    engine.unlock();
    engine.playIntro(ON);
    await flush();
    expect(fetched).toEqual([]);
    expect(log.oscillators).toBeGreaterThan(0);
    expect(log.buffers).toBe(0);
  });

  it('a missing file or a corrupt file falls back to the chime', async () => {
    for (const env of [
      environment({ ctx: fakeContext().ctx, fetchBytes: () => Promise.reject(new Error('404')) }),
      environment({ ctx: fakeContext({ decode: 'fail' }).ctx }),
    ]) {
      const context = env.env.createContext()!;
      const engine = createAudioEngine({ src: '/intro.mp3', env: { ...env.env, createContext: () => context } });
      engine.prefetch();
      engine.unlock();
      expect(() => engine.playIntro(ON)).not.toThrow();
      await flush();
    }
  });

  it('never throws when audio is blocked or unavailable, and stays silent', async () => {
    const blocked = createAudioEngine({
      src: '/intro.mp3',
      env: environment({
        createContext: () => {
          throw new Error('NotAllowedError');
        },
      }).env,
    });
    const missing = createAudioEngine({ src: '/intro.mp3', env: environment({ ctx: null }).env });
    const rejecting = createAudioEngine({
      src: '/intro.mp3',
      env: environment({ ctx: fakeContext({ resume: 'reject' }).ctx }).env,
    });
    for (const engine of [blocked, missing, rejecting]) {
      expect(() => {
        engine.prefetch();
        engine.unlock();
        engine.playIntro(ON);
        engine.fadeOut();
        engine.dispose();
      }).not.toThrow();
    }
    await flush();
  });

  it('muted plays nothing, even with the file decoded', async () => {
    const { ctx, log } = fakeContext();
    const engine = createAudioEngine({ src: '/intro.mp3', env: environment({ ctx }).env });
    engine.prefetch();
    engine.unlock();
    engine.playIntro({ enabled: false, volume: 0.8 });
    engine.playIntro({ enabled: true, volume: 0 });
    await flush();
    expect(log.buffers + log.oscillators).toBe(0);
  });

  it('a decode that lands too late stays silent instead of sounding out of step', async () => {
    const { ctx, log } = fakeContext();
    let release: (value: ArrayBuffer) => void = () => undefined;
    const clock = environment({ ctx, fetchBytes: () => new Promise((resolve) => (release = resolve)) });
    const engine = createAudioEngine({ src: '/intro.mp3', env: clock.env });
    engine.prefetch();
    engine.unlock();
    engine.playIntro(ON);
    clock.advance(900);
    release(new ArrayBuffer(8));
    await flush();
    expect(log.buffers + log.oscillators).toBe(0);
  });

  it('skip fades over 150 ms and a pending decode never starts afterwards', async () => {
    const { ctx, log } = fakeContext();
    const engine = createAudioEngine({ src: null, env: environment({ ctx }).env });
    engine.unlock();
    engine.playIntro(ON);
    engine.fadeOut(150);
    expect(log.gains[0]!.ramps).toEqual([0]);
    expect(log.stopped).toBeGreaterThan(0);

    const late = fakeContext();
    const lateEngine = createAudioEngine({ src: '/intro.mp3', env: environment({ ctx: late.ctx }).env });
    lateEngine.prefetch();
    lateEngine.unlock();
    lateEngine.playIntro(ON);
    lateEngine.fadeOut();
    await flush();
    expect(late.log.buffers).toBe(0);
    lateEngine.dispose();
    expect(late.log.closed).toBe(true);
  });
});
