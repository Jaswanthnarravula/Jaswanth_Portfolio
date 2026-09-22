'use client';
/**
 * The macOS app registry: each app's body is its own lazy chunk (shared/10 budgets), Finder excepted — it is the
 * default app and ships with the shell. While a chunk loads, the window shows skeleton rows under its real title (no
 * spinner — plans/macos/apps/finder.md "Loading") and the app's Dock icon bounces (`MAC-DOCK-03`: bounce only while
 * loading). A chunk that fails shows a calm in-window state with Try again and the plain portfolio, plus the
 * "Couldn't open" notification (06-edge-cases E13). Hovering or focusing a Dock icon preloads its chunk, and after the
 * desktop paints the Dock's apps are warmed one by one in idle time (owner direction: first opens never wait), so most
 * launches never bounce at all. Warming is silent: an icon bounces only while a window is actually waiting.
 */
import { useEffect, useState, type ComponentType } from 'react';
import type { AppRole } from '@/lib/kernel/ids';
import { afterFirstPaint } from '@/lib/motion/idle';
import { macBinding, windowTitle } from '../model';
import { notify, setLoading } from '../ui';
import { TitleBar, type WindowBodyProps } from '../window/Window';
import app from './app.module.css';
import { Finder } from './Finder';

type Body = ComponentType<WindowBodyProps>;
type Loader = () => Promise<{ default: Body }>;

const LOADERS: Partial<Record<AppRole, Loader>> = {
  browser: () => import('./Safari'),
  github: () => import('./GitHub'),
  viewer: () => import('./Preview'),
  mail: () => import('./Mail'),
  editor: () => import('./VSCode'),
  terminal: () => import('./Terminal'),
  settings: () => import('./Settings'),
};

const loaded = new Map<AppRole, Body>([['files', Finder as Body]]);
const failures = new Set<(role: AppRole) => void>();

/** Hear about app chunks that failed to load (the tour skips ahead). Returns the disposer. */
export function onAppFailed(listener: (role: AppRole) => void): () => void {
  failures.add(listener);
  return () => {
    failures.delete(listener);
  };
}
const pending = new Map<AppRole, { request: Promise<Body>; waiting: boolean }>();

/**
 * Load (once) and cache an app body. A window waiting for it makes its Dock icon bounce until it lands; a quiet load
 * (warming, preloading) shows nothing — unless a window starts waiting for it meanwhile.
 */
export function loadApp(
  role: AppRole,
  loader: Loader | undefined = LOADERS[role],
  { quiet = false }: { quiet?: boolean } = {},
): Promise<Body> {
  const ready = loaded.get(role);
  if (ready) return Promise.resolve(ready);
  const inFlight = pending.get(role);
  if (inFlight) {
    if (!quiet && !inFlight.waiting) {
      inFlight.waiting = true;
      setLoading(role, true);
    }
    return inFlight.request;
  }
  if (!loader) return Promise.reject(new Error(`macOS has no ${role} app`));
  if (!quiet) setLoading(role, true);
  const request = loader().then(
    (module) => {
      loaded.set(role, module.default);
      pending.delete(role);
      setLoading(role, false);
      return module.default;
    },
    (error: unknown) => {
      pending.delete(role);
      setLoading(role, false);
      throw error;
    },
  );
  pending.set(role, { request, waiting: !quiet });
  return request;
}

/** Warm a chunk without showing anything (Dock hover / focus, Spotlight's selected result). */
export function preloadApp(role: AppRole): void {
  if (loaded.has(role) || pending.has(role) || !LOADERS[role]) return;
  loadApp(role, LOADERS[role], { quiet: true }).catch(() => undefined);
}

/**
 * After the desktop paints, warm the Dock's apps one by one in idle time, so a first open never waits (and the dev
 * server compiles every app ahead of the visitor). Abortable; skipped under Data Saver; a failure stays silent until a
 * window actually opens (its own load retries and reports).
 */
export function warmApps(roles: readonly AppRole[], signal: AbortSignal): void {
  const saveData = (globalThis.navigator as (Navigator & { connection?: { saveData?: boolean } }) | undefined)
    ?.connection?.saveData;
  if (saveData) return;
  const next = (index: number) => {
    const role = roles[index];
    if (!role || signal.aborted) return;
    afterFirstPaint(
      () => {
        if (signal.aborted) return;
        if (loaded.has(role) || !LOADERS[role]) {
          next(index + 1);
          return;
        }
        void loadApp(role, LOADERS[role], { quiet: true })
          .catch(() => undefined)
          .then(() => next(index + 1));
      },
      { signal, idleTimeout: 2000 },
    );
  };
  next(0);
}

/** Test seam. */
export function resetAppRegistry(): void {
  for (const role of [...loaded.keys()]) if (role !== 'files') loaded.delete(role);
  pending.clear();
}

export const isAppLoaded = (role: AppRole) => loaded.has(role);

function Skeleton({ titleId, role }: { titleId: string; role: AppRole }) {
  return (
    <>
      <TitleBar titleId={titleId}>{macBinding(role).title}</TitleBar>
      <div className={app.skeleton} aria-busy="true" aria-label={`Opening ${macBinding(role).title}`} role="status">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
    </>
  );
}

function Failure({ titleId, role, onRetry }: { titleId: string; role: AppRole; onRetry: () => void }) {
  const name = macBinding(role).title;
  return (
    <>
      <TitleBar titleId={titleId}>{name}</TitleBar>
      <div className={app.failure}>
        <p>
          <strong>{name} couldn’t open.</strong>
        </p>
        <p>Check your connection and try again — everything it holds is also in the plain portfolio.</p>
        <p>
          <button type="button" className={`${app.tool} ${app.primary}`} onClick={onRetry}>
            Try again
          </button>{' '}
          <a href="/plain">Plain portfolio</a>
        </p>
      </div>
    </>
  );
}

/** A window's body: the app, or its skeleton while the chunk loads, or the failure state. */
export function AppFrame(props: WindowBodyProps) {
  const role = props.window.role;
  const [state, setState] = useState<{ role: AppRole; body: Body | null; failed: boolean; attempt: number }>(() => ({
    role,
    body: loaded.get(role) ?? null,
    failed: false,
    attempt: 0,
  }));
  // A window's role never changes, but guard anyway (derived during render, not in an effect).
  if (state.role !== role) setState({ role, body: loaded.get(role) ?? null, failed: false, attempt: 0 });

  useEffect(() => {
    if (state.body || state.failed) return;
    let alive = true;
    loadApp(role).then(
      (body) => alive && setState((current) => ({ ...current, body })),
      () => {
        if (!alive) return;
        setState((current) => ({ ...current, failed: true }));
        notify({ kind: 'app-failed', role, name: windowTitle(props.window).app });
        for (const listener of failures) listener(role);
      },
    );
    return () => {
      alive = false;
    };
    // Re-run on retry (attempt) only; the window prop object changes on every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, state.attempt, state.body, state.failed]);

  if (state.failed)
    return (
      <Failure
        titleId={props.titleId}
        role={role}
        onRetry={() => setState((current) => ({ ...current, failed: false, attempt: current.attempt + 1 }))}
      />
    );
  if (!state.body) return <Skeleton titleId={props.titleId} role={role} />;
  const Body = state.body;
  return <Body {...props} />;
}

/** The Shell's body renderer for `MacWindow`. */
export const macAppBody = (props: WindowBodyProps) => <AppFrame {...props} />;
