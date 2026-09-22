'use client';
/**
 * The Windows app host: each app is its own lazy chunk (shared/10 "Content apps ≤ 15 KB each — app launch; prefetch on
 * icon hover/focus"), rendered inside the window frame. While a chunk loads the window already shows its real title bar
 * (the frame, caption buttons and system menu work at once) over a quiet skeleton — skeleton cards for GitHub; a chunk
 * that cannot load shows a calm "Couldn't open {App}" with Retry (plans/windows/06 E17) and the taskbar button says so.
 * A loaded body is cached, so a reopened app renders at once with no skeleton frame.
 */
import { useEffect, useState, type ComponentType } from 'react';
import type { AppRole } from '@/lib/kernel/ids';
import { afterFirstPaint } from '@/lib/motion/idle';
import { winBinding, windowTitle } from '../model';
import { TitleBar, windowStyles, type WindowBodyProps } from '../window/Window';

type Body = ComponentType<WindowBodyProps>;
type Loader = () => Promise<{ default: Body }>;

/** One loader per app (taskbar buttons and Start tiles prefetch them on hover / focus). */
export const APP_LOADERS: Readonly<Partial<Record<AppRole, Loader>>> = {
  files: () => import('./Explorer'),
  browser: () => import('./Edge'),
  github: () => import('./GitHub'),
  mail: () => import('./Outlook'),
  editor: () => import('./VSCode'),
  terminal: () => import('./Terminal'),
  settings: () => import('./Settings'),
};

const loaded = new Map<AppRole, Body>();
const pending = new Map<AppRole, Promise<Body>>();
const failed = new Set<AppRole>();
const failureListeners = new Set<(failed: ReadonlySet<AppRole>) => void>();

const notifyFailures = () => {
  for (const listener of failureListeners) listener(new Set(failed));
};

/** Load (once) and cache an app body. A failure is forgotten, so the next attempt fetches again; only a window that
 * could not open reports it (a background warm-up never raises a "Couldn't open" toast). */
function loadApp(role: AppRole): Promise<Body> {
  const ready = loaded.get(role);
  if (ready) return Promise.resolve(ready);
  const inFlight = pending.get(role);
  if (inFlight) return inFlight;
  const loader = APP_LOADERS[role];
  if (!loader) return Promise.reject(new Error(`No Windows app for ${role}`));
  const request = loader().then(
    (module) => {
      loaded.set(role, module.default);
      pending.delete(role);
      if (failed.delete(role)) notifyFailures();
      return module.default;
    },
    (error: unknown) => {
      pending.delete(role);
      throw error;
    },
  );
  pending.set(role, request);
  return request;
}

export function subscribeAppFailures(listener: (failed: ReadonlySet<AppRole>) => void): () => void {
  failureListeners.add(listener);
  return () => {
    failureListeners.delete(listener);
  };
}

const reportFailure = (role: AppRole) => {
  if (failed.has(role)) return;
  failed.add(role);
  notifyFailures();
};

/** Warm an app's chunk (taskbar hover/focus, Start tiles). Failures are silent here; opening shows them. */
export function prefetchApp(role: AppRole): void {
  if (loaded.has(role) || pending.has(role) || !APP_LOADERS[role]) return;
  loadApp(role).catch(() => undefined);
}

/**
 * Warm the pinned apps one by one in idle time once the desktop has painted, so a first open never waits on the
 * network (the owner's "super smooth" rule; hover / focus prefetch still front-runs it). Aborting stops the chain.
 */
export function warmApps(roles: readonly AppRole[], signal: AbortSignal): void {
  const next = (index: number) => {
    const role = roles[index];
    if (!role || signal.aborted) return;
    afterFirstPaint(
      () => {
        if (signal.aborted) return;
        void loadApp(role)
          .catch(() => undefined)
          .then(() => next(index + 1));
      },
      { signal, idleTimeout: 2000 },
    );
  };
  next(0);
}

/** GitHub loads as skeleton cards (plans/windows/apps/github "Loading"); every other app as quiet text lines. */
const CARD_SKELETONS: ReadonlySet<AppRole> = new Set<AppRole>(['github']);

function Skeleton({ window }: WindowBodyProps) {
  const cards = CARD_SKELETONS.has(window.role);
  return (
    <>
      <TitleBar title={windowTitle(window).visible} />
      <div className={windowStyles.body} aria-busy="true" data-app-loading="">
        <div className={windowStyles.skeleton} aria-hidden="true" data-skeleton={cards ? 'cards' : 'lines'}>
          <span />
          <span />
          <span />
          {cards ? <span /> : null}
        </div>
      </div>
    </>
  );
}

function Failure({ role, onRetry }: { readonly role: AppRole; readonly onRetry: () => void }) {
  const app = winBinding(role).title;
  return (
    <>
      <TitleBar title={app} />
      <div className={windowStyles.body}>
        <div className={windowStyles.failure} role="alert">
          <p>Couldn&rsquo;t open {app}.</p>
          <p>
            <button type="button" className={windowStyles.failureButton} onClick={onRetry}>
              Retry
            </button>{' '}
            <a href="/plain">Read the plain portfolio</a>
          </p>
        </div>
      </div>
    </>
  );
}

/** A window's body: the app, its skeleton while the chunk loads, or the failure state with Retry. */
export function AppBody(props: WindowBodyProps) {
  const role = props.window.role;
  const [state, setState] = useState<{ body: Body | null; failed: boolean; attempt: number }>(() => ({
    body: loaded.get(role) ?? null,
    failed: false,
    attempt: 0,
  }));

  useEffect(() => {
    if (state.body || state.failed) return;
    let alive = true;
    loadApp(role).then(
      (body) => alive && setState((current) => ({ ...current, body })),
      () => {
        if (!alive) return;
        reportFailure(role);
        setState((current) => ({ ...current, failed: true }));
      },
    );
    return () => {
      alive = false;
    };
  }, [role, state.attempt, state.body, state.failed]);

  if (state.failed)
    return (
      <Failure
        role={role}
        onRetry={() => setState((current) => ({ ...current, failed: false, attempt: current.attempt + 1 }))}
      />
    );
  if (!state.body) return <Skeleton {...props} />;
  const App = state.body;
  return <App {...props} />;
}
