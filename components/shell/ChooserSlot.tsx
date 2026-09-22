'use client';
/**
 * The chooser's slot in the shell layer (plans/04 `CHOOSE-FAIL-01`). The chooser is its own lazy chunk; if that chunk
 * cannot load (offline before it was warmed, a missing deploy asset) the failure stays inside this slot — the site
 * never falls to the root error page, as an uncaught `React.lazy` rejection would — and the visitor gets the same way
 * out as a failed OS chunk: Retry (automatic when the network returns) or the plain portfolio. Focus lands on the
 * panel's heading, never on <body>.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { focusIsOnBody } from '@/lib/kernel/focus';
import { focusKeys } from '@/lib/kernel/types';

type ChooserModule = typeof import('@/components/welcome/Chooser');

export const loadChooser = (): Promise<ChooserModule> => import('@/components/welcome/Chooser');

function ChooserFailure({ onRetry }: { onRetry: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const page = document.getElementById('page-layer');
    if (focusIsOnBody() || page?.contains(document.activeElement)) headingRef.current?.focus({ preventScroll: true });
    window.addEventListener('online', onRetry, { once: true });
    return () => window.removeEventListener('online', onRetry);
  }, [onRetry]);
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  return (
    <div className="os-failure" role="alert">
      <h1 ref={headingRef} tabIndex={-1} data-focus-key={focusKeys.chooserHeading}>
        Couldn&rsquo;t load the operating systems{offline ? ' — you appear to be offline' : ''}.
      </h1>
      <p>
        <button type="button" className="cv-button cv-button-primary" onClick={onRetry}>
          Retry
        </button>{' '}
        <a className="cv-button" href="/plain">
          Read the plain portfolio
        </a>
      </p>
    </div>
  );
}

export function ChooserSlot({ load = loadChooser }: { load?: () => Promise<ChooserModule> }) {
  const [attempt, setAttempt] = useState(0);
  const [chooser, setChooser] = useState<ChooserModule['default'] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    load().then(
      (module) => alive && setChooser(() => module.default),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [load, attempt]);
  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((n) => n + 1);
  }, []);
  if (failed) return <ChooserFailure onRetry={retry} />;
  if (!chooser) return null;
  const Chooser = chooser;
  return <Chooser />;
}
