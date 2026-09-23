'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { ContentFor, type LinkSlotProps } from '@/components/content';
import { mailtoUrl } from '@/components/content/contact-actions';
import {
  TerminalView,
  type TerminalSessionSnapshot,
  type TerminalViewHandle,
} from '@/components/os/shared/terminal/TerminalView';
import type { ContentRef } from '@/data/schema';
import { getContact, getExperience, getFeaturedProjects, getPerson, getProjects, getResume } from '@/data/selectors';
import { eggProgress, recordEgg } from '@/lib/eggs';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import { getSafeStorage } from '@/lib/kernel/persist/storage';
import { refForLocation } from '@/lib/kernel/route/codec';
import { focusKeys } from '@/lib/kernel/types';
import type { OsShellProps } from '@/lib/os-loaders';
import { trackVisualViewport } from '@/lib/motion/visual-viewport';
import { afterNextPaint } from '@/lib/motion/yield';
import type { Effect, Execution, Line, VfsPath } from '@/lib/terminal';
import { useKernel, usePrefs } from '@/stores/kernel-context';
import { dispatchSoon } from '@/stores/kernel-store';
import { getPrefs } from '@/stores/prefs-store';
import {
  bootLines,
  HINT_IDLE_MS,
  HINT_RATE_MS,
  HINT_SESSION_CAP,
  HOME,
  motdLines,
  nextHint,
  pathLabel,
  promptText,
  type HintProgress,
} from './model';
import styles from './linux.module.css';

export const OS_CHUNK_MARKER = 'pf-os-chunk:linux';

const absoluteCwd = (path: readonly string[]): VfsPath => [...HOME, ...path];
const cwdRoute = (cwd: VfsPath) => (HOME.every((part, index) => cwd[index] === part) ? cwd.slice(HOME.length) : []);
const commandForRef = (ref: ContentRef): string => {
  if ('slug' in ref && ref.slug) return `open ${ref.section}/${ref.slug}`;
  if (ref.section === 'resume') return 'open resume';
  if (ref.section === 'projects' || ref.section === 'experience' || ref.section === 'education')
    return `cd ${ref.section} && ls`;
  return ref.section;
};

function VisualPrompt({ cwd, failed }: { cwd: VfsPath; failed: boolean }) {
  return (
    <>
      <span className={styles.promptUser}>jaswanth@portfolio</span>:
      <span className={styles.promptPath}>{pathLabel(cwd)}</span>
      <span className={failed ? styles.promptFail : undefined}>$</span>{' '}
    </>
  );
}

type HintMode = 'none' | 'nudge' | 'card' | 'confirm' | 'inserted' | 'off';

function HintSlot({
  mode,
  suggestion,
  onReveal,
  onPaste,
  onDismiss,
  onReplace,
}: {
  mode: HintMode;
  suggestion: { command: string; sentence: string };
  onReveal(): void;
  onPaste(): void;
  onDismiss(): void;
  onReplace(): void;
}) {
  if (mode === 'none') return null;
  if (mode === 'inserted') return <p className={styles.hintNotice}>Inserted — press Enter to run.</p>;
  if (mode === 'off')
    return (
      <p className={styles.hintNotice}>
        Hints off — &apos;hints on&apos; brings them back. &apos;help&apos; is always here.
      </p>
    );
  if (mode === 'nudge')
    return (
      <p className={styles.hintNotice}>
        Lost already? Linux welcomes you.{' '}
        <button type="button" aria-expanded="false" onClick={onReveal}>
          Need a hint?
        </button>
      </p>
    );
  if (mode === 'confirm')
    return (
      <div className={styles.hintCard} role="group" aria-label="Replace command">
        <span>Replace your current line?</span>{' '}
        <button type="button" onClick={onReplace}>
          Replace
        </button>
        <span> · </span>
        <button type="button" onClick={onDismiss}>
          Keep it
        </button>
      </div>
    );
  return (
    <div className={styles.hintCard} role="group" aria-label="Hint">
      <p>
        <code>{suggestion.command}</code> — {suggestion.sentence}
      </p>
      <button type="button" onClick={onPaste}>
        Paste into Terminal
      </button>
      <span> · </span>
      <button type="button" onClick={onDismiss}>
        Not now
      </button>
    </div>
  );
}

function Viewer({ target, onClose }: { target: ContentRef; onClose(): void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const singleKeys = usePrefs((prefs) => prefs.singleKeyShortcuts);
  const siblings = target.section === 'projects' ? getProjects().map((item) => item.slug) : [];
  const at = 'slug' in target && target.slug ? siblings.indexOf(target.slug) : -1;
  const title =
    target.section === 'resume' ? 'resume.pdf' : `${target.section}/${'slug' in target ? target.slug : 'README'}.md`;
  const open = (ref: ContentRef) =>
    dispatchSoon({ type: 'OPEN_APP', os: 'linux', role: 'viewer', location: { kind: 'content', ref } });
  const neighbour = (delta: number) => {
    if (at < 0 || !siblings.length) return;
    const slug = siblings[(at + delta + siblings.length) % siblings.length]!;
    open({ section: 'projects', slug });
  };
  const download = () => {
    if (target.section !== 'resume') return;
    const resume = getResume();
    const anchor = document.createElement('a');
    anchor.href = resume.file;
    anchor.download = resume.downloadName;
    anchor.click();
  };
  const copy = () => void navigator.clipboard?.writeText(window.location.href);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' || (singleKeys && event.key === 'q')) {
      event.preventDefault();
      onClose();
      return;
    }
    if (!singleKeys || (event.target as HTMLElement).matches('input,textarea,select')) return;
    const node = body.current;
    if (!node) return;
    if (event.key === 'j' || event.key === 'ArrowDown') node.scrollTop += 48;
    else if (event.key === 'k' || event.key === 'ArrowUp') node.scrollTop -= 48;
    else if (event.key === 'g') node.scrollTop = 0;
    else if (event.key === 'G') node.scrollTop = node.scrollHeight;
    else if (event.key === 'd') download();
    else if (event.key === 'l') copy();
    else if (event.key === 'n') neighbour(1);
    else if (event.key === 'p') neighbour(-1);
    else return;
    event.preventDefault();
  };
  useEffect(() => {
    // Enter may leave the submitting input focused until the key event has
    // fully settled. Move focus on the next frame, once the routed viewer is
    // painted and owns the active tile.
    let alive = true;
    afterNextPaint(() => {
      if (alive) heading.current?.focus({ preventScroll: true });
    });
    return () => {
      alive = false;
    };
  }, [title]);
  const Link = ({ to, children, ...rest }: LinkSlotProps) => (
    <a
      href={`/linux/viewer/${to.section}${'slug' in to ? `/${to.slug}` : ''}`}
      onClick={(event) => {
        event.preventDefault();
        open(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
  return (
    <section className={styles.viewer} aria-labelledby="linux-viewer-title" data-viewer="">
      <div className={styles.tileTitle}>
        <h2 id="linux-viewer-title" ref={heading} tabIndex={-1} data-focus-key={focusKeys.window('linux:viewer')}>
          viewer — {title}
        </h2>
        <nav aria-label="Viewer actions">
          <button type="button" onClick={onClose}>
            [q] close
          </button>
          {target.section === 'resume' ? (
            <button type="button" onClick={download}>
              [d] download
            </button>
          ) : null}
          <button type="button" onClick={copy}>
            [l] copy link
          </button>
        </nav>
      </div>
      {/* A readable scroll region; single-key shortcuts apply only while it owns focus. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={body}
        className={styles.viewerBody}
        role="region"
        aria-label="Viewer document"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <ContentFor target={target} density="compact" headingLevel={3} slots={{ Link }} />
      </div>
      {siblings.length ? (
        <footer className={styles.viewerFooter}>
          <button type="button" onClick={() => neighbour(1)}>
            n next
          </button>
          <span> · </span>
          <button type="button" onClick={() => neighbour(-1)}>
            p previous
          </button>
        </footer>
      ) : null}
    </section>
  );
}

export default function LinuxShell({ heading }: OsShellProps) {
  const router = useRouter();
  const terminal = useRef<TerminalViewHandle>(null);
  const root = useRef<HTMLDivElement>(null);
  const splitTimer = useRef<number | null>(null);
  const route = useKernel((state) => state.route);
  const session = useKernel((state) => state.sessions.linux);
  const pointer = useKernel((state) => state.capabilities.pointer);
  const reduced = useKernel((state) => state.capabilities.reducedMotion);
  const arrival = useKernel((state) => state.arrival);
  const continuity = useKernel((state) => state.continuity);
  const routeFocus = route.kind === 'os' && route.os === 'linux' ? route.focus : null;
  const routeCwd =
    routeFocus?.role === 'terminal' && routeFocus.location.kind === 'vfs'
      ? absoluteCwd(routeFocus.location.path)
      : (session.terminal?.cwd ?? HOME);
  const viewerTarget =
    routeFocus?.role === 'viewer' && routeFocus.location.kind === 'vfs'
      ? refForLocation('linux', 'viewer', routeFocus.location, OS_REGISTRY)
      : null;
  const deepLink = Boolean(
    routeFocus &&
    (routeFocus.role === 'viewer' || (routeFocus.location.kind === 'vfs' && routeFocus.location.path.length)),
  );
  const [coldDeepLink] = useState(deepLink);
  const shouldBoot = arrival === 'chooser' && !session.bootSeen && !coldDeepLink && !reduced;
  const [booting, setBooting] = useState(shouldBoot);
  const [bootCount, setBootCount] = useState(shouldBoot ? 1 : 99);
  const [split, setSplit] = useState(56);
  const [splitting, setSplitting] = useState(false);
  const [help, setHelp] = useState(false);
  const [matrix, setMatrix] = useState(false);
  const [hintMode, setHintMode] = useState<HintMode>('none');
  const [activity, setActivity] = useState(0);
  const draft = useRef('');
  const hintMeta = useRef({ shown: 0, dismissed: 0, last: 0, failures: 0, successes: 0, enabled: true });
  const initialProgress: HintProgress = {
    ranHelp: false,
    listed: false,
    enteredDirectory: false,
    listedProjects: false,
    openedProject: false,
    openedResume: false,
    visitedExperience: false,
    usedContact: false,
    cwd: routeCwd,
  };
  const progress = useRef<HintProgress>(initialProgress);
  const featured = getFeaturedProjects()[0]?.slug;
  const [suggestion, setSuggestion] = useState(() => nextHint(initialProgress, featured));
  const boot = useMemo(
    () => bootLines(session.contentRev, getProjects().length, getExperience().length),
    [session.contentRev],
  );
  const tourStep = useRef<number | null>(null);
  const tourCommands = useMemo(
    () => ['ls', 'cd projects', 'ls', `open projects/${featured ?? ''}`, 'resume', 'help'],
    [featured],
  );

  useEffect(() => {
    const node = root.current;
    return node ? trackVisualViewport(node) : undefined;
  }, []);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const resetIdle = () => setActivity((value) => value + 1);
    node.addEventListener('keydown', resetIdle, { capture: true });
    node.addEventListener('pointerdown', resetIdle, { capture: true });
    return () => {
      node.removeEventListener('keydown', resetIdle, { capture: true });
      node.removeEventListener('pointerdown', resetIdle, { capture: true });
    };
  }, []);

  const finishBoot = useCallback(() => {
    setBooting(false);
    setBootCount(boot.length);
    dispatchSoon({ type: 'MARK_BOOT_SEEN', os: 'linux' });
    if (pointer === 'fine') queueMicrotask(() => terminal.current?.focus());
  }, [boot.length, pointer]);

  useEffect(() => {
    if (!booting) return;
    const timer = window.setInterval(
      () =>
        setBootCount((count) => {
          if (count >= boot.length) {
            window.clearInterval(timer);
            queueMicrotask(finishBoot);
            return count;
          }
          return count + 1;
        }),
      55,
    );
    return () => window.clearInterval(timer);
  }, [boot.length, booting, finishBoot]);

  useEffect(() => {
    if (!booting) return;
    const skip = () => finishBoot();
    const finishWhenVisible = () => {
      if (document.visibilityState === 'visible') finishBoot();
    };
    document.addEventListener('keydown', skip, { once: true });
    document.addEventListener('visibilitychange', finishWhenVisible);
    return () => {
      document.removeEventListener('keydown', skip);
      document.removeEventListener('visibilitychange', finishWhenVisible);
    };
  }, [booting, finishBoot]);

  useEffect(() => {
    if (!splitting) return;
    const finish = () => setSplitting(false);
    window.addEventListener('resize', finish, { once: true });
    return () => window.removeEventListener('resize', finish);
  }, [splitting]);

  useEffect(() => {
    if (routeFocus?.role === 'terminal' && routeFocus.location.kind === 'vfs')
      terminal.current?.navigate(absoluteCwd(routeFocus.location.path));
  }, [routeFocus]);

  useEffect(() => {
    if (booting || coldDeepLink || viewerTarget || tourStep.current !== null || !hintMeta.current.enabled) return;
    const timer = window.setTimeout(() => {
      const meta = hintMeta.current;
      if (
        !draft.current &&
        !window.getSelection()?.toString() &&
        hintMode === 'none' &&
        meta.successes < 2 &&
        meta.shown < HINT_SESSION_CAP &&
        Date.now() - meta.last >= HINT_RATE_MS
      ) {
        meta.shown += 1;
        meta.last = Date.now();
        setHintMode('nudge');
      }
    }, HINT_IDLE_MS);
    return () => window.clearTimeout(timer);
  }, [booting, coldDeepLink, viewerTarget, activity, hintMode]);

  const closeViewer = useCallback(() => {
    dispatchSoon({
      type: 'OPEN_APP',
      os: 'linux',
      role: 'terminal',
      location: { kind: 'vfs', path: cwdRoute(session.terminal?.cwd ?? HOME) },
    });
    // The compact layout keeps the terminal visibility-hidden until the route
    // commit removes the viewer. Focusing on the next frame works for both the
    // tiled desktop view and the one-surface touch view.
    afterNextPaint(() => terminal.current?.focus());
  }, [session.terminal?.cwd]);

  const openViewer = useCallback(
    (ref: ContentRef) => {
      if (!viewerTarget && !reduced) {
        setSplitting(true);
        if (splitTimer.current) window.clearTimeout(splitTimer.current);
        splitTimer.current = window.setTimeout(() => {
          splitTimer.current = null;
          setSplitting(false);
        }, 200);
      }
      dispatchSoon({ type: 'OPEN_APP', os: 'linux', role: 'viewer', location: { kind: 'content', ref } });
    },
    [reduced, viewerTarget],
  );

  useEffect(
    () => () => {
      if (splitTimer.current) window.clearTimeout(splitTimer.current);
    },
    [],
  );

  const perform = useCallback(
    (effect: Effect) => {
      switch (effect.k) {
        case 'cd':
          dispatchSoon({ type: 'TERMINAL_SET_CWD', os: 'linux', cwd: effect.to });
          return;
        case 'open':
          openViewer(effect.ref === 'resume' ? { section: 'resume' } : effect.ref);
          return;
        case 'reveal':
          return;
        case 'mailto':
          window.location.assign(
            mailtoUrl({ email: getContact().email, ...(effect.subject ? { subject: effect.subject } : {}) }),
          );
          return;
        case 'download': {
          const resume = getResume();
          const link = document.createElement('a');
          link.href = resume.file;
          link.download = resume.downloadName;
          link.click();
          return;
        }
        case 'switch-os':
          dispatchSoon({ type: 'SWITCH_OS', to: effect.to ?? null, via: 'switch' });
          return;
        case 'pref':
          if (effect.key === 'hints') {
            hintMeta.current.enabled = effect.value === 'on';
            setHintMode(effect.value === 'on' ? 'none' : 'off');
          } else if (effect.key === 'sound') {
            dispatchSoon({
              type: 'SET_PREF',
              patch: { sound: { ...getPrefs().sound, ui: effect.value === 'on' } },
            });
          } else dispatchSoon({ type: 'SET_PREF', patch: { [effect.key]: effect.value } });
          return;
        case 'tour':
          terminal.current?.insert('ls');
          setHintMode('inserted');
          tourStep.current = 0;
          return;
        case 'plain':
          router.push('/plain');
          return;
        case 'egg': {
          const found = recordEgg(getPrefs().eggsFound, effect.id);
          if (found) dispatchSoon({ type: 'SET_PREF', patch: { eggsFound: found } });
          if (effect.id === 'EGG-MATRIX-01' && !reduced) setMatrix(true);
          return;
        }
        case 'exit':
          if (viewerTarget) closeViewer();
          else dispatchSoon({ type: 'SWITCH_OS', to: null, via: 'switch' });
          return;
        case 'history-clear':
          dispatchSoon({ type: 'TERMINAL_CLEAR', os: 'linux', history: true });
          return;
        case 'clear':
        case 'pager':
          return;
      }
    },
    [closeViewer, openViewer, reduced, router, viewerTarget],
  );

  useEffect(() => {
    const node = root.current;
    if (!matrix || !node) return;
    const stop = () => setMatrix(false);
    const timer = window.setTimeout(stop, 3000);
    node.addEventListener('keydown', stop, { capture: true, once: true });
    node.addEventListener('pointerdown', stop, { capture: true, once: true });
    return () => {
      window.clearTimeout(timer);
      node.removeEventListener('keydown', stop, { capture: true });
      node.removeEventListener('pointerdown', stop, { capture: true });
    };
  }, [matrix]);

  const ran = useCallback(
    (command: string, result: Execution) => {
      const clean = command.trim();
      const meta = hintMeta.current;
      if (result.exitCode === 0) {
        meta.successes += 1;
        meta.failures = 0;
      } else meta.failures += 1;
      const previous = progress.current;
      progress.current = {
        ...previous,
        ranHelp: previous.ranHelp || clean === 'help',
        listed: previous.listed || clean === 'ls',
        enteredDirectory: previous.enteredDirectory || clean.startsWith('cd '),
        listedProjects: previous.listedProjects || (pathLabel(result.state.cwd) === '~/projects' && clean === 'ls'),
        openedProject: previous.openedProject || clean.startsWith('open projects/'),
        openedResume: previous.openedResume || clean === 'resume' || clean === 'open resume',
        visitedExperience: previous.visitedExperience || clean.includes('experience'),
        usedContact: previous.usedContact || clean === 'contact' || clean === 'mail',
        cwd: result.state.cwd,
      };
      setSuggestion(nextHint(progress.current, featured));
      setActivity((value) => value + 1);
      if (clean === 'settings' || clean === 'settings list') {
        const eggs = eggProgress(getPrefs().eggsFound, 'linux');
        const storage = getSafeStorage().mode;
        queueMicrotask(() =>
          terminal.current?.print(
            [
              { t: `eggs found: ${eggs.found} / ${eggs.total}`, cls: 'dim' },
              {
                t: storage === 'local' ? 'storage: local' : 'storage: memory (this session only)',
                cls: storage === 'local' ? 'dim' : 'warn',
              },
            ],
            'Easter egg progress',
          ),
        );
      }
      if (clean === 'hints' || clean === 'hints status') {
        queueMicrotask(() =>
          terminal.current?.print(
            [{ t: `hints: ${hintMeta.current.enabled ? 'on' : 'off'}`, cls: 'dim' }],
            'Hint status',
          ),
        );
      }
      if (meta.failures >= 3 && meta.shown < HINT_SESSION_CAP && Date.now() - meta.last >= HINT_RATE_MS) {
        meta.shown += 1;
        meta.last = Date.now();
        setHintMode('nudge');
      }
      // The `tour` effect has already primed step zero before this callback runs.
      // The command that starts the tour is not itself one of the guided steps.
      if (clean === 'tour') return;
      const step = tourStep.current;
      if (step === null) return;
      if (clean !== tourCommands[step]) {
        tourStep.current = null;
        setHintMode('none');
        queueMicrotask(() =>
          terminal.current?.print([{ t: "You've got it. 'tour' starts again anytime.", cls: 'dim' }], 'Tour ended'),
        );
        return;
      }
      const next = step + 1;
      if (next >= tourCommands.length) {
        tourStep.current = null;
        setHintMode('none');
        return;
      }
      tourStep.current = next;
      queueMicrotask(() => terminal.current?.insert(tourCommands[next]!));
      setHintMode('inserted');
    },
    [featured, tourCommands],
  );

  const pasteHint = () => {
    if (draft.current) {
      setHintMode('confirm');
      return;
    }
    terminal.current?.insert(suggestion.command);
    setHintMode('inserted');
  };
  const dismissHint = () => {
    const meta = hintMeta.current;
    meta.dismissed += 1;
    if (meta.dismissed >= 2) {
      meta.enabled = false;
      setHintMode('off');
    } else setHintMode('none');
  };

  const seeded: Line[] = [];
  if (routeFocus?.role === 'viewer' && routeFocus.location.kind === 'vfs') {
    const path = routeFocus.location.path.join('/');
    if (routeFocus.location.path.length > 1) seeded.push({ t: `cd ${routeFocus.location.path[0]}`, cls: 'dim' });
    seeded.push({ t: `open ${path}`, cls: 'dim' }, { t: '— session restored —', cls: 'dim' });
  }
  const initialLines: readonly Line[] = coldDeepLink
    ? seeded.length
      ? seeded
      : [{ t: '— session restored —', cls: 'dim' }]
    : [
        ...(shouldBoot
          ? [
              { t: `PortfolioOS ${getResume().updated} portfolio tty1`, cls: 'dim' as const },
              { t: 'portfolio login: jaswanth' },
              {
                t: `Last login: ${new Date().toUTCString().slice(0, 16)} from ${continuity?.fromOs ?? 'the-internet'}`,
                cls: 'dim' as const,
              },
              { t: '' },
            ]
          : []),
        ...motdLines(getProjects().length, getPerson().openTo),
      ];
  const seed: TerminalSessionSnapshot = {
    cwd: routeCwd,
    history: session.terminal?.history ?? [],
    scrollback: session.terminal?.scrollback ?? [],
    draft: session.terminal?.draft ?? '',
  };
  const viewerOpen = Boolean(viewerTarget);
  const continuityCommand =
    !coldDeepLink && continuity && continuity.fromOs !== 'linux' ? commandForRef(continuity.ref) : null;

  const resizeDivider = (event: PointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const box = root.current?.getBoundingClientRect();
    if (!box) return;
    const move = (moveEvent: globalThis.PointerEvent) =>
      setSplit(Math.max(30, Math.min(70, ((moveEvent.clientX - box.left) / box.width) * 100)));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };

  const openResume = () => openViewer({ section: 'resume' });

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.altKey && event.shiftKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        setSplit((value) => Math.max(30, Math.min(70, value + (event.key === 'ArrowLeft' ? -5 : 5))));
      }
      if (event.altKey && event.shiftKey && (event.key.toLowerCase() === 'n' || event.key.toLowerCase() === 'p')) {
        const viewer = node.querySelector<HTMLElement>('[data-viewer] h2');
        if (viewer) {
          event.preventDefault();
          if (event.key.toLowerCase() === 'n') viewer.focus({ preventScroll: true });
          else terminal.current?.focus();
        }
      }
      if (event.altKey && event.shiftKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        dispatchSoon({ type: 'SWITCH_OS', to: null, via: 'switch' });
      }
    };
    node.addEventListener('keydown', onKey);
    return () => node.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      ref={root}
      className={styles.shell}
      data-linux=""
      data-viewer-open={viewerOpen || undefined}
      data-splitting={splitting || undefined}
      style={{ '--split': `${split}%` } as CSSProperties}
    >
      <a className={styles.skip} href="/plain">
        Skip the OS: plain portfolio
      </a>
      <header className={styles.statusBar}>
        <nav aria-label="Workspaces">
          <button type="button" aria-current={!viewerOpen ? 'page' : undefined} onClick={closeViewer}>
            1:term
          </button>
          {viewerOpen ? (
            <button
              type="button"
              aria-current="page"
              onClick={() => document.querySelector<HTMLElement>('[data-viewer] h2')?.focus()}
            >
              2:view
            </button>
          ) : null}
        </nav>
        <nav aria-label="Linux actions">
          <a
            href="/linux/viewer/resume"
            aria-label="Résumé (PDF)"
            onClick={(event) => {
              event.preventDefault();
              openResume();
            }}
          >
            résumé
          </a>
          <button type="button" aria-expanded={help} onClick={() => setHelp((value) => !value)}>
            ?
          </button>
          <time dateTime={new Date().toISOString()}>
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </time>
          <button type="button" onClick={() => perform({ k: 'exit' })}>
            exit
          </button>
        </nav>
      </header>
      <main className={styles.workspace}>
        {heading}
        <section
          className={styles.terminalTile}
          aria-label="Terminal"
          data-focused={!viewerOpen || undefined}
          onPointerDown={(event) => {
            if (viewerOpen && !(event.target as Element).closest('a,button,input')) terminal.current?.focus();
          }}
        >
          <div className={styles.tileTitle}>
            <span>jaswanth@portfolio: {pathLabel(session.terminal?.cwd ?? routeCwd)}</span>
            <a
              href="/linux/viewer/resume"
              onClick={(event) => {
                event.preventDefault();
                openResume();
              }}
            >
              résumé ↵
            </a>
          </div>
          <TerminalView
            ref={terminal}
            flavor="bash"
            os="linux"
            focusKey={focusKeys.window('linux:terminal')}
            session={seed}
            promptFor={promptText}
            visualPrompt={(cwd, failed) => <VisualPrompt cwd={cwd} failed={Boolean(failed)} />}
            initialLines={initialLines}
            loadingLabel="[ .... ] Starting command interpreter…"
            recoveryHref="/plain"
            onEffect={perform}
            onRecord={(command, output) => dispatchSoon({ type: 'TERMINAL_RECORD', os: 'linux', command, output })}
            onClear={() => dispatchSoon({ type: 'TERMINAL_CLEAR', os: 'linux' })}
            onSize={() => {
              const node = root.current;
              if (node) node.dataset.rewraps = String(Number(node.dataset.rewraps ?? 0) + 1);
            }}
            onRun={ran}
            onDraftChange={(value) => {
              draft.current = value;
              setActivity((current) => current + 1);
              dispatchSoon({ type: 'TERMINAL_SET_DRAFT', os: 'linux', draft: value });
            }}
            onUserInput={() => {
              if (hintMode === 'nudge' || hintMode === 'card') setHintMode('none');
            }}
            active={!viewerOpen}
            focusOnMount={!booting && pointer === 'fine'}
            accessory
            hintSlot={
              <>
                {continuityCommand && continuity ? (
                  <div className={styles.hintCard} role="status">
                    Last viewed on {continuity.fromOs}: {continuity.ref.section}.{' '}
                    <button
                      type="button"
                      onClick={() => {
                        terminal.current?.insert(continuityCommand);
                        dispatchSoon({ type: 'CONTINUITY_DISMISS' });
                      }}
                    >
                      Paste into Terminal
                    </button>
                  </div>
                ) : null}
                <div role="status" aria-live="polite" className={styles.hintStatus}>
                  <HintSlot
                    mode={hintMode}
                    suggestion={suggestion}
                    onReveal={() => setHintMode('card')}
                    onPaste={pasteHint}
                    onDismiss={dismissHint}
                    onReplace={() => {
                      terminal.current?.insert(suggestion.command);
                      setHintMode('inserted');
                    }}
                  />
                </div>
              </>
            }
          />
          {matrix ? (
            <pre className={styles.matrix} aria-hidden="true">
              {
                '01001 41 11010 7f 00101 a3 10110\n10110 2c 00101 9a 11001 f0 01010\n00101 b7 10110 6d 01011 3e 11000\n11010 8f 01001 d4 10101 5b 00110'
              }
            </pre>
          ) : null}
          {pointer === 'coarse' && !booting ? (
            <button type="button" className={styles.tapType} onClick={() => terminal.current?.focus()}>
              tap here to type
            </button>
          ) : null}
        </section>
        {viewerOpen && viewerTarget ? (
          <>
            <div
              className={styles.divider}
              role="separator"
              // The separator is pointer draggable; Alt+Shift+Arrow is its global keyboard alternative.
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              tabIndex={0}
              aria-label="Resize terminal and viewer"
              aria-orientation="vertical"
              aria-valuemin={30}
              aria-valuemax={70}
              aria-valuenow={split}
              onPointerDown={resizeDivider}
            />
            <Viewer target={viewerTarget} onClose={closeViewer} />
          </>
        ) : null}
      </main>
      {help ? (
        <section className={styles.help} role="group" aria-label="Linux shortcuts">
          <strong>Shortcuts</strong>
          <p>Tab completes · ↑/↓ history · Ctrl+C cancels · Esc then Tab leaves.</p>
          <button
            type="button"
            onClick={() => {
              setHelp(false);
              terminal.current?.insert('help');
              terminal.current?.focus();
            }}
          >
            Paste help
          </button>
          <button type="button" onClick={() => setHelp(false)}>
            Close
          </button>
        </section>
      ) : null}
      {booting ? (
        // Pointer input and any document key both skip the decorative boot
        // log; the overlay stays out of the accessibility tree and tab order.
        <div className={styles.boot} data-linux-boot="" aria-hidden="true" onPointerDown={finishBoot}>
          {boot.slice(0, bootCount).map((text) => (
            <div key={text}>{text}</div>
          ))}
        </div>
      ) : null}
      <div className="sr-only" role="status" aria-live="polite">
        {booting ? 'Starting Linux' : 'Linux ready'}
      </div>
    </div>
  );
}
