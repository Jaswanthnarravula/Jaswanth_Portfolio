/**
 * The iOS apps as lazy chunks (shared/10 "Content apps ≤ 15 KB each — app launch; prefetch on icon hover/focus").
 * The flight never waits for them: the launch placeholder flies at once and the app mounts at progress > 0.9 or at rest
 * (plans/ios/02 step 4). Loaded bodies are cached, so a reopened app renders at once. A chunk that cannot load leaves
 * the placeholder with "Couldn't open {App}" · Retry · Home (plans/ios/06 E18).
 */
import type { ComponentType } from 'react';
import type { AppRole } from '@/lib/kernel/ids';
import type { WindowId } from '@/lib/kernel/types';
import { afterFirstPaint } from '@/lib/motion/idle';
import type { IosLayout, IosRole } from '../model';

/** What every iOS app receives. It reads its own window from the kernel (`useKernel`) by `id`. */
export interface IosAppProps {
  readonly id: WindowId;
  readonly role: IosRole;
  /** The app is the foreground app and its open flight has landed (it may move focus / start timers). */
  readonly active: boolean;
  readonly layout: IosLayout;
  readonly landscape: boolean;
  /** Id of the app surface's visually hidden `h2` (screens' titles are `h3`+). */
  readonly headingId: string;
}

type Body = ComponentType<IosAppProps>;
type Loader = () => Promise<{ default: Body }>;

export const APP_LOADERS: Readonly<Record<IosRole, Loader>> = {
  browser: () => import('./Safari'),
  github: () => import('./GitHub'),
  files: () => import('./Files'),
  notes: () => import('./Notes'),
  mail: () => import('./Mail'),
  messages: () => import('./Messages'),
  settings: () => import('./Settings'),
};

const loaded = new Map<AppRole, Body>();
const pending = new Map<AppRole, Promise<Body>>();

export const loadedApp = (role: AppRole): Body | null => loaded.get(role) ?? null;

export function loadApp(role: IosRole): Promise<Body> {
  const ready = loaded.get(role);
  if (ready) return Promise.resolve(ready);
  const inFlight = pending.get(role);
  if (inFlight) return inFlight;
  const request = APP_LOADERS[role]().then(
    (module) => {
      loaded.set(role, module.default);
      pending.delete(role);
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

/** Icon hover / focus / press-down warms the app's chunk; failures are silent here (opening shows them). */
export const prefetchApp = (role: IosRole): void => void loadApp(role).catch(() => undefined);

/** Warm the apps one by one in idle time after the Home Screen paints (a first open never waits on the network). */
export function warmApps(roles: readonly IosRole[], signal: AbortSignal): void {
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

/** Test seam. */
export function resetAppCache(): void {
  loaded.clear();
  pending.clear();
}

export type { IosLayout };
