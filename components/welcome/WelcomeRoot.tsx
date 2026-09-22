'use client';
/**
 * Welcome island — plans/02-hello-page.md and plans/03-netflix-page.md. Owns the *visual* Hello → intro → profiles
 * sequence on `/` and answers input instantly; the kernel (lazy chunk) is told through the bridge and owns everything
 * from the chooser on. The markup is server-rendered (complete without JavaScript); this root only switches
 * `data-screen`, moves focus, plays sound and starts the lazily loaded motion.
 *   - Tap to begin works from first paint, mid-draw included; a second tap is ignored (plans/02 "Edge cases").
 *   - Any click, tap or key during the intro — or "Skip intro" — lands on the profiles (plans/03).
 *   - Every profile runs the same handler: one transition, one destination (`NFLX-PROF-02`).
 */
import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { browserAudioEnvironment, createAudioEngine, type AudioEngine } from '@/lib/audio/engine';
import { isPersonaId, type PersonaId } from '@/lib/kernel/ids';
import { beginHandoff } from '@/lib/motion/handoff';
import { afterFirstPaint } from '@/lib/motion/idle';
import type { GlassStage } from '@/lib/webgl';
import { attachedKernel, sendToKernel, whenKernel } from '@/stores/kernel-bridge';

export type WelcomeScreen = 'hello' | 'intro' | 'profiles' | 'leaving';

type Motion = typeof import('./motion');
let motionModule: Promise<Motion> | null = null;
const loadMotion = (): Promise<Motion> => (motionModule ??= import('./motion'));

const DEFAULT_VOLUME = 0.8;
const STALL_MS = 6000;
/** Headroom for the React commit after the full intro's hand-over (plans/03: profiles by 3500 ms). */
const HANDOVER_MARGIN_MS = 100;
const subscribeNever = () => () => undefined;
const htmlData = (key: 'sound' | 'persona') => () => document.documentElement.dataset[key] ?? null;
const onServer = () => null;
const reducedMotion = () => document.documentElement.dataset.motion === 'reduced';

/** Resolves once `ms` pass with no pointer or key input (the WebGL stage never starts under the visitor's hand). */
function whenQuiet(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    let timer = setTimeout(resolve, ms);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(resolve, ms);
    };
    for (const type of ['pointermove', 'pointerdown', 'keydown'] as const)
      window.addEventListener(type, reset, { signal, passive: true });
    signal.addEventListener('abort', () => clearTimeout(timer));
  });
}

interface WelcomeApi {
  readonly screen: WelcomeScreen;
  readonly soundOn: boolean;
  readonly lastPersona: PersonaId | null;
  tap(): void;
  skip(): void;
  replay(): void;
  restart(): void;
  select(id: PersonaId, card: HTMLElement): void;
  toggleSound(): void;
}

const WelcomeContext = createContext<WelcomeApi | null>(null);

function useWelcome(): WelcomeApi {
  const api = use(WelcomeContext);
  if (!api) throw new Error('Welcome controls must render inside <WelcomeRoot>.');
  return api;
}

export function WelcomeRoot({
  audioSrc,
  className,
  stalledClassName,
  children,
}: {
  audioSrc: string | null;
  className?: string;
  stalledClassName?: string;
  children: ReactNode;
}) {
  const mutedAtLoad = useSyncExternalStore(subscribeNever, htmlData('sound'), onServer) === 'off';
  const persona = useSyncExternalStore(subscribeNever, htmlData('persona'), onServer);
  const [override, setOverride] = useState<WelcomeScreen | null>(null);
  const [soundChoice, setSoundChoice] = useState<boolean | null>(null);
  const [stalled, setStalled] = useState(false);
  // `/` is always the deliberate start of the experience. Saved preferences never replace Hello at this URL.
  const screen: WelcomeScreen = override ?? 'hello';
  const soundOn = soundChoice ?? !mutedAtLoad;

  const rootRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<WelcomeScreen>('hello');
  const engineRef = useRef<AudioEngine | null>(null);
  const introRef = useRef<{ finish(): void } | null>(null);
  /** When the visitor started the intro (tap or replay): its length is measured on the wall clock from here. */
  const introStartRef = useRef(0);
  const stageRef = useRef<GlassStage | null>(null);
  const fromIntroRef = useRef(false);

  // Handlers read the live screen from this ref, so a second tap in the same frame is ignored.
  useLayoutEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  const engine = () => (engineRef.current ??= createAudioEngine({ src: audioSrc, env: browserAudioEnvironment() }));
  const volume = () => attachedKernel()?.prefs().sound.volume ?? DEFAULT_VOLUME;
  const query = <T extends Element>(selector: string) => rootRef.current?.querySelector<T>(selector) ?? null;

  const go = (next: WelcomeScreen) => {
    screenRef.current = next;
    setOverride(next);
  };

  const toProfiles = () => {
    if (screenRef.current !== 'intro') return;
    introRef.current = null;
    fromIntroRef.current = true;
    go('profiles');
    sendToKernel({ type: 'ONBOARDING_ADVANCE', to: 'profiles' });
  };

  const api: WelcomeApi = {
    screen,
    soundOn,
    lastPersona: isPersonaId(persona) ? persona : null,
    tap() {
      if (screenRef.current !== 'hello') return;
      // The intro's clock starts at the tap itself: the first AudioContext of a browser session can take hundreds of
      // milliseconds to open the audio device, and that must not push the hand-over past 3.5 s.
      introStartRef.current = performance.now();
      engine().unlock(); // inside the user gesture
      go('intro');
      sendToKernel({ type: 'ONBOARDING_ADVANCE', to: 'intro' });
      engine().playIntro({ enabled: soundOn, volume: volume() });
    },
    skip() {
      if (screenRef.current !== 'intro') return;
      engineRef.current?.fadeOut(150);
      if (introRef.current)
        introRef.current.finish(); // → onDone → toProfiles
      else toProfiles();
    },
    replay() {
      if (screenRef.current !== 'profiles') return;
      introStartRef.current = performance.now();
      engine().unlock();
      go('intro');
      sendToKernel({ type: 'ONBOARDING_ADVANCE', to: 'intro' });
      engine().playIntro({ enabled: soundOn, volume: volume() });
    },
    restart() {
      // Returning visitors normally resume at profiles. This is the durable, explicit route back to Hello.
      if (screenRef.current !== 'profiles') return;
      document.documentElement.dataset.welcome = 'hello';
      delete document.documentElement.dataset.persona;
      go('hello');
      sendToKernel({ type: 'SET_PREF', patch: { introSeen: false, persona: null } });
    },
    select(id, card) {
      if (screenRef.current !== 'profiles') return; // first wins
      go('leaving');
      const avatar = card.querySelector<HTMLElement>('[data-avatar]') ?? card;
      const root = rootRef.current;
      const fading = root
        ? [...root.querySelectorAll('[data-profile], [data-profiles-fade]')].filter((el) => el !== card)
        : [];
      const label = card.querySelector('[data-profile-name]');
      if (label) fading.push(label);
      beginHandoff(
        loadMotion()
          .then((m) => m.handOff(avatar, fading, { reduced: reducedMotion() }))
          .then((rect) => ({ persona: id, rect }))
          .catch(() => null),
      );
      sendToKernel({ type: 'SELECT_PERSONA', id });
    },
    toggleSound() {
      const next = !soundOn;
      setSoundChoice(next);
      document.documentElement.dataset.sound = next ? 'on' : 'off';
      if (!next) engineRef.current?.fadeOut(150);
      sendToKernel((kernel) => ({
        type: 'SET_PREF',
        patch: { sound: { ...kernel.prefs().sound, enabled: next } },
      }));
    },
  };

  // After load and the first paint, in idle time: fetch the intro sound and the motion chunk.
  useEffect(() => {
    const lifetime = new AbortController();
    afterFirstPaint(
      () => {
        engine().prefetch();
        void loadMotion().catch(() => undefined); // offline: the static Hello and CSS states still work
        // The lens's edge refraction: refraction.ts decides (Chromium, desktop, full glass); else the CSS blur stays.
        const lens = query<HTMLElement>('[data-lens]');
        const filter = query<SVGFilterElement>('[data-refract-filter]');
        if (lens && filter)
          void import('./refraction')
            .then((m) => m.startLensRefraction(lens, filter, lifetime.signal))
            .catch(() => undefined);
        // Tier 2 only: the liquid-glass shader, decided (and three.js requested) only now and only on Hello.
        void whenQuiet(500, lifetime.signal)
          .then(() => (screenRef.current === 'hello' ? import('@/lib/webgl') : null))
          .then(async (webgl) => {
            const root = rootRef.current;
            if (!webgl || !root || lifetime.signal.aborted) return;
            const radius = (el: Element) => () => Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
            const panels = ['[data-lens]', '[data-tap-to-begin]']
              .map((selector) => root.querySelector(selector))
              .filter((el): el is Element => el !== null)
              .map((element) => ({ element, radius: radius(element) }));
            const stage = await webgl.startHelloStage({ container: root, panels });
            if (lifetime.signal.aborted || screenRef.current !== 'hello') stage?.dispose();
            else stageRef.current = stage;
          })
          .catch(() => undefined); // any failure keeps the CSS glass
      },
      { signal: lifetime.signal },
    );
    return () => {
      lifetime.abort();
      engineRef.current?.dispose();
      engineRef.current = null;
      stageRef.current?.dispose();
      stageRef.current = null;
    };
    // `engine` is stable for the lifetime of the island (created once, disposed on unmount).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving Hello: the shader dims to the intro's black (uDim, 240 ms), then frees its GPU memory.
  useEffect(() => {
    const stage = stageRef.current;
    if (screen === 'hello' || !stage) return;
    stageRef.current = null;
    void stage.dim(0.24).then(() => stage.dispose());
  }, [screen]);

  // Hello: once the stroke draw has finished, greetings morph every 2.4 s (never under reduced motion).
  useEffect(() => {
    if (screen !== 'hello' || reducedMotion()) return;
    const glyph = query<SVGPathElement>('[data-glyph]');
    const alt = query<SVGPathElement>('[data-glyph-alt]');
    // The draw runs on the rod group, which every glass layer inherits it from.
    const ink = query<SVGGElement>('[data-ink]');
    const inkAlt = query<SVGGElement>('[data-ink-alt]');
    if (!glyph || !alt || !ink || !inkAlt) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    const start = () =>
      void loadMotion().then(
        (m) => {
          if (!cancelled) stop = m.greetingLoop({ glyph, alt, ink, inkAlt });
        },
        () => undefined, // the static drawn Hello stays
      );
    const drawing = ink.getAnimations?.().some((a) => a.playState === 'running') ?? false;
    const lifetime = new AbortController();
    if (drawing) ink.addEventListener('animationend', start, { once: true, signal: lifetime.signal });
    else start();
    return () => {
      cancelled = true;
      lifetime.abort();
      stop?.();
    };
  }, [screen]);

  const onIntroDone = useEffectEvent(() => toProfiles());
  const onIntroInput = useEffectEvent(() => api.skip());
  const introSettings = useEffectEvent(() => ({ muted: !soundOn }));

  // Intro: focus lands on "Skip intro"; any input skips; the timeline hands over to the profiles.
  useEffect(() => {
    if (screen !== 'intro') return;
    const stage = query<HTMLElement>('[data-intro]');
    const wordmark = query<SVGSVGElement>('[data-wordmark]');
    query<HTMLButtonElement>('[data-skip-intro]')?.focus({ preventScroll: true });
    const lifetime = new AbortController();
    const { signal } = lifetime;
    let playback: { finish(): void; kill(): void } | null = null;
    const reduced = reducedMotion();
    const { muted } = introSettings();
    // The intro ends on the wall clock, counted from the tap: a late motion chunk (or none, offline) or a janky device
    // whose frames GSAP lag-smooths never holds the profiles back. The full intro hands over 100 ms early so the
    // profiles commit lands inside plans/03's "≤ 3500 ms"; the zoom's last 100 ms are below 0.2 % opacity.
    const length = reduced ? 800 : muted ? 1200 : 3500 - HANDOVER_MARGIN_MS;
    const deadline = setTimeout(
      () => (introRef.current ? introRef.current.finish() : onIntroDone()),
      Math.max(0, length - (performance.now() - introStartRef.current)),
    );
    void loadMotion().then(
      (m) => {
        if (signal.aborted || !wordmark) return;
        playback = m.playIntro(wordmark, { muted, reduced, onDone: () => onIntroDone() });
        introRef.current = playback;
      },
      () => undefined,
    );
    const skipKeys = (event: globalThis.KeyboardEvent) => {
      if (['Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
      if ((event.target as Element | null)?.closest?.('[data-welcome-bar]')) return;
      onIntroInput();
    };
    window.addEventListener('keydown', skipKeys, { signal });
    stage?.addEventListener('pointerdown', () => onIntroInput(), { signal });
    // Hidden during the intro → it completes instantly on return.
    document.addEventListener('visibilitychange', () => document.hidden && onIntroInput(), { signal });
    return () => {
      lifetime.abort();
      clearTimeout(deadline);
      playback?.kill();
      introRef.current = null;
    };
  }, [screen]);

  // Profiles after the intro: focus the heading; the entrance plays unless motion is reduced; input finishes it.
  useEffect(() => {
    if (screen !== 'profiles' || !fromIntroRef.current) return;
    fromIntroRef.current = false;
    const heading = query<HTMLElement>('[data-profiles-heading]');
    heading?.focus({ preventScroll: true });
    if (reducedMotion() || !heading || !rootRef.current) return;
    const cards = [...rootRef.current.querySelectorAll('[data-profile]')];
    const lifetime = new AbortController();
    let playback: { finish(): void; kill(): void } | null = null;
    void loadMotion().then(
      (m) => {
        if (!lifetime.signal.aborted) playback = m.profilesEntrance(heading, cards);
      },
      () => undefined,
    );
    const finish = () => playback?.finish();
    rootRef.current.addEventListener('pointerdown', finish, { signal: lifetime.signal, capture: true });
    rootRef.current.addEventListener('keydown', finish, { signal: lifetime.signal, capture: true });
    return () => {
      lifetime.abort();
      playback?.finish();
    };
  }, [screen]);

  // A picked profile waits for the kernel (the chooser lives in the shell layer). If it cannot arrive — offline, a
  // failed chunk — say so and offer the way that always works.
  useEffect(() => {
    if (screen !== 'leaving') return;
    let settled = false;
    void whenKernel().then(() => (settled = true));
    const timer = setTimeout(() => !settled && setStalled(true), STALL_MS);
    return () => clearTimeout(timer);
  }, [screen]);

  return (
    <div ref={rootRef} className={className} data-screen={screen}>
      <WelcomeContext value={api}>{children}</WelcomeContext>
      {stalled ? (
        <p role="alert" className={stalledClassName}>
          The operating systems couldn&rsquo;t load. <a href="/">Try again</a> or{' '}
          <a href="/plain">read the plain portfolio</a>.
        </p>
      ) : null}
    </div>
  );
}

// --- interactive leaves (the rest of the markup is server-rendered) --------------------------------------------------

export function TapToBegin({ className, children }: { className?: string; children: ReactNode }) {
  const { tap } = useWelcome();
  return (
    <button type="button" className={className} onClick={tap} data-tap-to-begin>
      {children}
    </button>
  );
}

export function SoundToggle({ className, children }: { className?: string; children: ReactNode }) {
  const { soundOn, toggleSound } = useWelcome();
  return (
    <button type="button" className={className} aria-pressed={soundOn} onClick={toggleSound} data-sound-toggle>
      {children}
    </button>
  );
}

export function SkipIntro({ className }: { className?: string }) {
  const { skip } = useWelcome();
  return (
    <button type="button" className={className} onClick={skip} data-skip-intro>
      Skip intro
    </button>
  );
}

export function ReplayIntro({ className, children }: { className?: string; children: ReactNode }) {
  const { replay } = useWelcome();
  return (
    <button type="button" className={className} onClick={replay} aria-label="Replay intro" data-profiles-fade>
      {children}
    </button>
  );
}

export function RestartWelcome({ className, children }: { className?: string; children: ReactNode }) {
  const { restart } = useWelcome();
  return (
    <button type="button" className={className} onClick={restart}>
      {children}
    </button>
  );
}

/** Tab and the arrow keys both move between the five profile buttons (plans/03 "Accessibility"). */
function moveBetweenProfiles(event: KeyboardEvent<HTMLButtonElement>) {
  const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[event.key];
  const group = event.currentTarget.closest('[role="group"]');
  if (!step || !group) return;
  const buttons = [...group.querySelectorAll<HTMLButtonElement>('[data-profile]')];
  const index = buttons.indexOf(event.currentTarget);
  event.preventDefault();
  buttons[(index + step + buttons.length) % buttons.length]?.focus();
}

export function ProfileButton({ id, className, children }: { id: PersonaId; className?: string; children: ReactNode }) {
  const { select, lastPersona } = useWelcome();
  return (
    <button
      type="button"
      className={className}
      data-profile={id}
      aria-pressed={lastPersona ? lastPersona === id : undefined}
      onClick={(event) => select(id, event.currentTarget)}
      onKeyDown={moveBetweenProfiles}
    >
      {children}
    </button>
  );
}
