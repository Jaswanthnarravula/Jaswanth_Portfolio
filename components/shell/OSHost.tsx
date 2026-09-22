'use client';
/**
 * Mounts the active OS's lazy chunk. Leaving an OS unmounts it; its session is parked in the kernel (shared/04).
 * A failed import is not final: every new `loading` attempt for this OS (Retry, or the `online` event) loads again, so
 * the shell appears when the kernel's retry succeeds (`KRN-SWITCH-*`, `CHOOSE-FAIL-01`).
 * The shell's `h1` exists from the first frame: the host renders it until the chunk mounts, then hands it to the shell,
 * which places it in its own landmark structure. If the heading had focus when it moved, focus follows it (it never
 * falls to <body>).
 */
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import type { OsId } from '@/lib/kernel/ids';
import { focusKeys } from '@/lib/kernel/types';
import { loadOs, type OsShellProps } from '@/lib/os-loaders';
import { useKernel } from '@/stores/kernel-context';

export function OSHost({ os, heading }: { os: OsId; heading: ReactNode }) {
  const [loaded, setLoaded] = useState<{ os: OsId; Component: ComponentType<OsShellProps> } | null>(null);
  const attempt = useKernel((state) =>
    state.transition.phase === 'loading' && state.transition.to === os ? state.transition.epoch : null,
  );
  const ready = loaded?.os === os;
  const headingFocused = useRef(false);

  useEffect(() => {
    if (ready) return;
    let alive = true;
    loadOs(os).then(
      (module) => {
        if (!alive) return;
        const active = document.activeElement;
        headingFocused.current = !!active?.matches?.(`[data-focus-key="${focusKeys.osHeading}"]`);
        setLoaded({ os, Component: module.default });
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [os, attempt, ready]);

  useLayoutEffect(() => {
    if (!ready || !headingFocused.current) return;
    headingFocused.current = false;
    document
      .querySelector<HTMLElement>(`[data-os-shell="${os}"] [data-focus-key="${focusKeys.osHeading}"]`)
      ?.focus({ preventScroll: true });
  }, [ready, os]);

  if (!loaded || !ready) return <>{heading}</>;
  const { Component } = loaded;
  // `display: contents` — a readiness marker only (tests and the transition stage wait on it), never a layout box.
  return (
    <div className="os-shell" data-os-shell={os}>
      <Component os={os} heading={heading} />
    </div>
  );
}
