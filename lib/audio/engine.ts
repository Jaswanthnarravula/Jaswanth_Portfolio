/**
 * Audio engine — plans/03-netflix-page.md "Sound" (`NFLX-AUDIO-01`, `NFLX-AUDIO-02`) · shared/11 `ASSET-AUDIO-01`.
 *   prefetch()  idle after first paint: fetch the official intro bytes (no AudioContext, no decode yet)
 *   unlock()    inside the Tap-to-begin gesture: create/resume the context, decode what was fetched
 *   playIntro() the official sound when decoded in time, else an original synthesized chime (original mode, file
 *               missing, fetch or decode failed); never a sound-alike
 *   fadeOut()   150 ms fade on skip
 * Blocked, missing or failing audio never throws and never delays the intro: every path degrades to silence.
 */

/** The slice of the Web Audio API the engine uses (injectable for tests). */
export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
  cancelScheduledValues(time: number): unknown;
}
export interface AudioNodeLike {
  connect(destination: unknown): unknown;
}
export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}
export interface SourceNodeLike extends AudioNodeLike {
  start(when?: number): void;
  stop(when?: number): void;
}
export interface BufferSourceLike extends SourceNodeLike {
  buffer: unknown;
}
export interface OscillatorLike extends SourceNodeLike {
  type: string;
  readonly frequency: AudioParamLike;
}
export interface AudioContextLike {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: unknown;
  resume(): Promise<void>;
  close(): Promise<void>;
  createGain(): GainNodeLike;
  createBufferSource(): BufferSourceLike;
  createOscillator(): OscillatorLike;
  decodeAudioData(data: ArrayBuffer): Promise<unknown>;
}

export interface AudioEnvironment {
  /** Returns null when Web Audio is unavailable. May throw (blocked) — the engine catches it. */
  readonly createContext: () => AudioContextLike | null;
  readonly fetchBytes: (url: string) => Promise<ArrayBuffer>;
  readonly now: () => number;
}

export interface AudioEngine {
  prefetch(): void;
  unlock(): void;
  playIntro(options: { enabled: boolean; volume: number }): void;
  fadeOut(ms?: number): void;
  dispose(): void;
}

/** Played only if the official sound decodes within this window after the request; otherwise the intro stays silent. */
const LATE_START_MS = 400;
const noop = () => undefined;

/**
 * The original chime: a soft two-note bell (E5 → B5, bell partials, exponential decay) over a warm A3 body.
 * Written for this site; not modelled on any product sound.
 */
function playChime(ctx: AudioContextLike, out: GainNodeLike): SourceNodeLike[] {
  const t = ctx.currentTime + 0.01;
  const voices: [freq: number, type: string, at: number, peak: number, decay: number][] = [
    [220, 'sine', 0, 0.1, 0.7],
    [659.25, 'triangle', 0, 0.2, 0.9],
    [987.77, 'sine', 0.12, 0.2, 1.4],
    [1975.53, 'sine', 0.12, 0.05, 0.8],
  ];
  return voices.map(([freq, type, at, peak, decay]) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t + at);
    env.gain.setValueAtTime(0.0001, t + at);
    env.gain.exponentialRampToValueAtTime(peak, t + at + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t + at + decay);
    osc.connect(env);
    env.connect(out);
    osc.start(t + at);
    osc.stop(t + at + decay + 0.05);
    return osc;
  });
}

export function createAudioEngine({ src, env }: { src: string | null; env: AudioEnvironment }): AudioEngine {
  let bytes: Promise<ArrayBuffer | null> | null = null;
  let ctx: AudioContextLike | null = null;
  let decoded: Promise<unknown> | null = null;
  let master: GainNodeLike | null = null;
  let playing: SourceNodeLike[] = [];
  let request = 0; // bumps on every play/fade so a late decode never starts a stale sound

  const safe = (run: () => void) => {
    try {
      run();
    } catch {
      /* blocked or unsupported: silence */
    }
  };

  const stopAll = (when = 0) => {
    for (const source of playing) safe(() => source.stop(when));
    playing = [];
  };

  return {
    prefetch() {
      if (!src || bytes) return;
      bytes = env.fetchBytes(src).then(
        (data) => data,
        () => null, // missing file / offline → the chime
      );
    },

    unlock() {
      if (ctx) {
        void ctx.resume().catch(noop);
        return;
      }
      safe(() => {
        ctx = env.createContext();
      });
      if (!ctx) return;
      const context: AudioContextLike = ctx;
      void context.resume().catch(noop);
      safe(() => {
        master = context.createGain();
        master.connect(context.destination);
      });
      // A corrupt file resolves to null, which plays the chime.
      if (bytes) decoded = bytes.then((data) => (data ? context.decodeAudioData(data) : null)).catch(() => null);
    },

    playIntro({ enabled, volume }) {
      const id = ++request;
      if (!enabled || volume <= 0 || !ctx || !master) return;
      const context: AudioContextLike = ctx;
      const out: GainNodeLike = master;
      safe(() => {
        out.gain.cancelScheduledValues(context.currentTime);
        out.gain.setValueAtTime(Math.min(1, volume), context.currentTime);
      });
      const chime = () => safe(() => (playing = playChime(context, out)));
      if (!decoded) {
        chime();
        return;
      }
      const asked = env.now();
      void decoded.then((buffer) => {
        if (id !== request) return; // skipped or replayed meanwhile
        if (!buffer) return chime();
        if (env.now() - asked > LATE_START_MS) return; // too late to feel like an answer to the tap
        safe(() => {
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.connect(out);
          source.start();
          playing = [source];
        });
      }, noop);
    },

    fadeOut(ms = 150) {
      request++;
      const context = ctx;
      const out = master;
      if (!context || !out || playing.length === 0) return;
      const end = context.currentTime + ms / 1000;
      safe(() => {
        out.gain.cancelScheduledValues(context.currentTime);
        out.gain.setValueAtTime(out.gain.value, context.currentTime);
        out.gain.linearRampToValueAtTime(0, end);
      });
      stopAll(end + 0.02);
    },

    dispose() {
      request++;
      stopAll();
      const context = ctx;
      ctx = null;
      master = null;
      if (context) void context.close().catch(noop);
    },
  };
}

/** The browser environment; returns null contexts where Web Audio is missing. */
export function browserAudioEnvironment(): AudioEnvironment {
  return {
    createContext: () => {
      const w = window as Window & { webkitAudioContext?: typeof AudioContext };
      const Context = window.AudioContext ?? w.webkitAudioContext;
      return Context ? (new Context() as unknown as AudioContextLike) : null;
    },
    fetchBytes: (url) =>
      fetch(url).then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error('missing')))),
    now: () => performance.now(),
  };
}
