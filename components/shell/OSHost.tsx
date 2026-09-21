'use client';
/** Mounts the active OS's lazy chunk. Leaving an OS unmounts it; its session is parked in the kernel (shared/04). */
import { useEffect, useState, type ComponentType } from 'react';
import type { OsId } from '@/lib/kernel/ids';
import { loadOs, type OsShellProps } from '@/lib/os-loaders';

export function OSHost({ os }: { os: OsId }) {
  const [loaded, setLoaded] = useState<{ os: OsId; Component: ComponentType<OsShellProps> } | null>(null);

  useEffect(() => {
    let alive = true;
    loadOs(os).then(
      (module) => {
        if (alive) setLoaded({ os, Component: module.default });
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [os]);

  if (!loaded || loaded.os !== os) return null;
  const { Component } = loaded;
  // `display: contents` — a readiness marker only (tests and the transition stage wait on it), never a layout box.
  return (
    <div className="os-shell" data-os-shell={os}>
      <Component os={os} />
    </div>
  );
}
