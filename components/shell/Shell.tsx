'use client';
/**
 * The Shell lives in the root layout and survives every navigation (shared/01 `ARCH-SHELL-01`). Its first client
 * render is exactly `{children}` — constant and URL-independent — so hydration never mismatches (`ARCH-HYDR-01`).
 * The kernel runtime is a separate lazy chunk: on OS and `/go` routes its import starts at module scope so it
 * overlaps hydration; on the welcome page it loads after the first paint, in idle time; `/plain` never needs it —
 * there only the analytics loader starts, likewise after the first paint, so reader visits are counted too
 * (shared/18 `ANL-PV-01`, `ANL-LAZY-01`).
 */
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { routePath } from '@/lib/kernel/types';
import { afterFirstPaint } from '@/lib/motion/idle';

type RuntimeModule = { ShellRuntime: ComponentType };
const loadRuntime = (): Promise<RuntimeModule> => import('./ShellRuntime');

const eager = (path: string) => /^\/(ios|macos|windows|android|linux|go)(\/|$)/.test(path);
if (typeof window !== 'undefined' && eager(window.location.pathname)) void loadRuntime();

export function Shell({ children }: { children: ReactNode }) {
  const [Runtime, setRuntime] = useState<ComponentType | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    const lifetime = new AbortController();
    const { signal } = lifetime;
    if (path === '/plain' || path.startsWith('/plain/')) {
      afterFirstPaint(
        () =>
          void import('@/lib/analytics/loader').then(
            (module) => module.startReaderAnalytics(routePath('/plain')),
            () => undefined,
          ),
        { signal, idleTimeout: 1500 },
      );
      return () => lifetime.abort();
    }
    const start = () =>
      void loadRuntime().then(
        (module) => {
          if (!signal.aborted) setRuntime(() => module.ShellRuntime);
        },
        () => undefined, // Offline / chunk failure: the semantic page underneath stays complete.
      );
    if (eager(path)) start();
    else afterFirstPaint(start, { signal, idleTimeout: 1500 });
    return () => lifetime.abort();
  }, []);

  return (
    <>
      {children}
      {Runtime ? <Runtime /> : null}
    </>
  );
}
