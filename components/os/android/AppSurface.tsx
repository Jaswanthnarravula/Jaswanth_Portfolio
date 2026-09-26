'use client';
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react';
import { focusKeys, type WindowId } from '@/lib/kernel/types';
import { androidBinding, type AndroidRole } from './model';
import { AdaptiveIcon } from './ui';
import { loadApp, loadedApp } from './apps/registry';
import type { AndroidAppProps } from './apps/types';
import styles from './android.module.css';

export function AppSurface({
  id,
  role,
  layout,
  opening,
  originId,
  onHome,
}: {
  id: WindowId;
  role: AndroidRole;
  layout: 'phone' | 'large';
  opening: boolean;
  originId: string | null;
  onHome: () => void;
}) {
  const surface = useRef<HTMLElement>(null);
  const [Body, setBody] = useState<ComponentType<AndroidAppProps> | null>(() => loadedApp(role));
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (Body) return;
    let alive = true;
    loadApp(role).then(
      (component) => alive && setBody(() => component),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [role, Body, attempt]);
  const title = androidBinding(role).title;
  const headingId = `android-app-${role}`;
  useLayoutEffect(() => {
    if (!opening || !surface.current) return;
    const origin = originId ? document.getElementById(originId) : null;
    if (!origin) {
      surface.current.style.setProperty('--android-launch-x', '50%');
      surface.current.style.setProperty('--android-launch-y', '100%');
      return;
    }
    const from = origin.getBoundingClientRect();
    const to = surface.current.getBoundingClientRect();
    surface.current.style.setProperty('--android-launch-x', `${from.left + from.width / 2 - to.left}px`);
    surface.current.style.setProperty('--android-launch-y', `${from.top + from.height / 2 - to.top}px`);
  }, [opening, originId]);
  return (
    <section
      ref={surface}
      className={styles.appSurface}
      data-app-surface={role}
      data-opening={opening || undefined}
      aria-labelledby={headingId}
    >
      <h2 id={headingId} className="sr-only" tabIndex={-1} data-focus-key={focusKeys.window(id)}>
        {title}
      </h2>
      <div className={styles.launchSplash} aria-hidden="true">
        <AdaptiveIcon app={role} />
      </div>
      <div className={styles.appBody}>
        {failed ? (
          <div className={styles.appFailure} role="alert">
            <h3>Couldn&rsquo;t open {title}</h3>
            <button
              onClick={() => {
                setFailed(false);
                setAttempt((value) => value + 1);
              }}
            >
              Retry
            </button>
            <button onClick={onHome}>Home</button>
            <a href="/plain">Open the plain portfolio</a>
          </div>
        ) : Body ? (
          <Body id={id} role={role} active layout={layout} headingId={headingId} />
        ) : (
          <div className={styles.loading} aria-label={`Opening ${title}`} />
        )}
      </div>
    </section>
  );
}
