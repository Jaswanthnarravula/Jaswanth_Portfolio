'use client';
/**
 * The Shell lives in the root layout and survives every navigation (shared/01 `ARCH-SHELL-01`). Its first client
 * render is exactly `{children}` — constant and URL-independent — so hydration never mismatches (`ARCH-HYDR-01`).
 * The kernel runtime is a separate lazy chunk: on OS and `/go` routes its import starts at module scope so it
 * overlaps hydration; on the welcome page it loads in idle time; `/plain` never needs it — there only the analytics
 * loader starts, in idle time, so reader visits are counted too (shared/18 `ANL-PV-01`).
 */
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { routePath } from '@/lib/kernel/types';

type RuntimeModule = { ShellRuntime: ComponentType };
const loadRuntime = (): Promise<RuntimeModule> => import('./ShellRuntime');

const eager = (path: string) => /^\/(ios|macos|windows|android|linux|go)(\/|$)/.test(path);
if (typeof window !== 'undefined' && eager(window.location.pathname)) void loadRuntime();

export function Shell({ children }: { children: ReactNode }) {
  const [Runtime, setRuntime] = useState<ComponentType | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    const idle = (
      window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }
    ).requestIdleCallback;
    const whenIdle = (run: () => void) => (idle ? idle(run, { timeout: 1500 }) : setTimeout(run, 600));
    if (path === '/plain' || path.startsWith('/plain/')) {
      whenIdle(
        () =>
          void import('@/lib/analytics/loader').then(
            (module) => module.startReaderAnalytics(routePath('/plain')),
            () => undefined,
          ),
      );
      return;
    }
    let cancelled = false;
    const start = () =>
      void loadRuntime().then(
        (module) => {
          if (!cancelled) setRuntime(() => module.ShellRuntime);
        },
        () => undefined, // Offline / chunk failure: the semantic page underneath stays complete.
      );
    if (eager(path)) start();
    else whenIdle(start);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {children}
      {Runtime ? <Runtime /> : null}
    </>
  );
}
