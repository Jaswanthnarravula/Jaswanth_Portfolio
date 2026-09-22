'use client';
/**
 * Preview-only stub OS (P0): proves the kernel end to end — launchers, windows, in-app navigation, deep links,
 * Back/Forward and refresh — before any real OS exists. Never released (`OS_REGISTRY[os].released` stays false until
 * that OS's own shell replaces this in its phase); visible only in preview/test builds via NEXT_PUBLIC_OS_PREVIEW.
 */
import { useEffect } from 'react';
import { ContentFor } from '@/components/content';
import type { LinkSlotProps } from '@/components/content/slots';
import type { ContentRef } from '@/data/schema';
import { OS_NAMES, type OsId } from '@/lib/kernel/ids';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import { VISIBLE_OSES } from '@/lib/kernel/route';
import { refForLocation } from '@/lib/kernel/route/codec';
import { currentLocation, isFocusable } from '@/lib/kernel/state';
import { focusKeys, type WindowId, type WindowInstance } from '@/lib/kernel/types';
import type { OsShellProps } from '@/lib/os-loaders';
import { useKernel } from '@/stores/kernel-context';
import { dispatch } from '@/stores/kernel-store';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { KernelLink } from './KernelLink';
import styles from './StubOs.module.css';

function contentLink(os: OsId) {
  return function StubLink({ to, children, ...rest }: LinkSlotProps) {
    return (
      <KernelLink to={{ os, ref: to }} {...rest}>
        {children}
      </KernelLink>
    );
  };
}

function StubWindow({ os, id, zIndex, focused }: { os: OsId; id: WindowId; zIndex: number; focused: boolean }) {
  const window = useKernel((state) => state.sessions[os].windows[id]) as WindowInstance | undefined;
  const phase = window?.phase.s;

  useEffect(() => {
    if (phase === 'opening' || phase === 'closing') dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
  }, [phase, id]);

  if (!window || !isFocusable(window)) return null;
  const binding = OS_REGISTRY[os].apps.find((app) => app.role === window.role);
  const location = currentLocation(window);
  const ref: ContentRef | null = refForLocation(os, window.role, location, OS_REGISTRY);
  const titleId = `stub-title-${id.replace(':', '-')}`;
  return (
    <section
      className={styles.window}
      data-focused={focused || undefined}
      style={{ zIndex }}
      aria-labelledby={titleId}
      tabIndex={-1}
      data-focus-key={focusKeys.window(id)}
      data-window={id}
    >
      <header className={styles.titlebar}>
        <div className={styles.controls} role="group" aria-label="Window controls">
          <button
            type="button"
            onClick={() => dispatch({ type: 'CLOSE_WINDOW', id })}
            aria-label={`Close ${binding?.title}`}
          >
            ×
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'APP_BACK', id })}
            aria-label="Back"
            disabled={window.nav.index === 0}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'APP_FORWARD', id })}
            aria-label="Forward"
            disabled={window.nav.index >= window.nav.entries.length - 1}
          >
            ›
          </button>
        </div>
        <h2 id={titleId} className={styles.title}>
          {binding?.title}
        </h2>
      </header>
      <div className={styles.body}>
        {ref ? (
          <ContentFor target={ref} headingLevel={3} slots={{ Link: contentLink(os) }} resumePages={false} />
        ) : (
          <p className={styles.empty}>
            {binding?.title} opens here in the finished {OS_NAMES[os]}.
          </p>
        )}
      </div>
    </section>
  );
}

export default function StubOs({ os, heading, chunk }: OsShellProps & { readonly chunk?: string }) {
  const zOrder = useKernel((state) => state.sessions[os].zOrder);
  const focused = useKernel((state) => state.sessions[os].focused);
  return (
    <div className={styles.root} data-stub-os={os} data-os-chunk={chunk}>
      {heading}
      <header className={styles.bar}>
        <p className={styles.badge}>{OS_NAMES[os]} · preview</p>
        <nav aria-label="Apps">
          <ul className={styles.apps}>
            {OS_REGISTRY[os].apps.map((app) => (
              <li key={app.role}>
                <KernelLink
                  to={{ os, role: app.role }}
                  className={styles.app}
                  data-focus-key={focusKeys.launcher(os, app.role)}
                  invoker={focusKeys.launcher(os, app.role)}
                  aria-current={focused === `${os}:${app.role}` ? 'true' : undefined}
                >
                  <AssetIcon id={app.icon} size={24} className={styles.icon} priority />
                  {app.title}
                </KernelLink>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Switch operating system" className={styles.switcher}>
          {VISIBLE_OSES.filter((other) => other !== os).map((other) => (
            <button
              key={other}
              type="button"
              className={styles.switch}
              onClick={() => dispatch({ type: 'SWITCH_OS', to: other, via: 'switch' })}
            >
              {OS_NAMES[other]}
            </button>
          ))}
        </nav>
      </header>
      <main
        className={styles.desk}
        data-focus-key={focusKeys.home(os)}
        tabIndex={-1}
        aria-label={`${OS_NAMES[os]} workspace`}
      >
        {zOrder.map((id, index) => (
          <StubWindow key={id} os={os} id={id} zIndex={100 + index} focused={focused === id} />
        ))}
      </main>
    </div>
  );
}
