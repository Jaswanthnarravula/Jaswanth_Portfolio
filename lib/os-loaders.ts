/**
 * One lazy chunk per OS (shared/01 `ARCH-SPLIT-01`): visiting macOS never downloads Android. Each loader resolves an
 * `OsModule`. Until an OS's own shell is built in its phase, it resolves the preview stub (never released).
 */
import type { ComponentType } from 'react';
import type { OsId } from '@/lib/kernel/ids';

export interface OsShellProps {
  readonly os: OsId;
}

export interface OsModule {
  readonly default: ComponentType<OsShellProps>;
}

export type OsLoaders = Readonly<Record<OsId, () => Promise<OsModule>>>;

export const OS_LOADERS: OsLoaders = {
  macos: () => import('@/components/os/macos/Shell'),
  windows: () => import('@/components/os/windows/Shell'),
  ios: () => import('@/components/os/ios/Shell'),
  android: () => import('@/components/os/android/Shell'),
  linux: () => import('@/components/os/linux/Shell'),
};

/** Import each OS once, with two retries (shared/04: "Two retries → failed"); failures are not cached. */
export function createOsLoader(loaders: OsLoaders, retryDelayMs = 400) {
  const cache = new Map<OsId, Promise<OsModule>>();
  return function load(os: OsId, attempts = 3): Promise<OsModule> {
    const cached = cache.get(os);
    if (cached) return cached;
    const attempt = (left: number): Promise<OsModule> =>
      loaders[os]().catch((error: unknown) => {
        if (left <= 1) throw error;
        return new Promise<OsModule>((resolve, reject) => {
          setTimeout(() => attempt(left - 1).then(resolve, reject), retryDelayMs);
        });
      });
    const promise = attempt(attempts).catch((error: unknown) => {
      cache.delete(os);
      throw error;
    });
    cache.set(os, promise);
    return promise;
  };
}

/** Chooser hover/focus and idle time call `prefetchOs`; OSHost and the transition driver call `loadOs`. */
export const loadOs = createOsLoader(OS_LOADERS);

export const prefetchOs = (os: OsId): void => void loadOs(os).catch(() => undefined);
