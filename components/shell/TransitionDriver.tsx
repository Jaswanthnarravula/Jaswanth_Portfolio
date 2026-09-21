'use client';
/**
 * Drives the OS switch machine (shared/04 `KRN-SWITCH-*`): exiting → loading (chunk import, two retries) → entering →
 * idle, each step completed with an epoch-tagged `PHASE_DONE` so stale completions are ignored. Chunk failure → the
 * `failed` phase (Retry + /plain); the `online` event retries automatically. Exit/enter motion is layered on by a
 * stage (stores/transition-stage): a phase a stage has claimed is completed by that stage; every unclaimed phase
 * completes on the next frame, and the generic failure UI shows only when no stage owns the failure.
 */
import { useEffect } from 'react';
import { loadOs } from '@/lib/os-loaders';
import { useKernel } from '@/stores/kernel-context';
import { dispatch } from '@/stores/kernel-store';
import { isClaimed } from '@/stores/transition-stage';

export function TransitionDriver() {
  const transition = useKernel((state) => state.transition);

  useEffect(() => {
    if (transition.phase === 'idle') return;
    const epoch = 'epoch' in transition ? transition.epoch : null;
    if (epoch === null) return;
    let cancelled = false;
    const done = () => {
      if (!cancelled) dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch } });
    };
    switch (transition.phase) {
      case 'exiting':
      case 'entering': {
        const phase = transition.phase;
        const timer = setTimeout(() => !isClaimed(epoch, phase) && done(), 0);
        return () => {
          cancelled = true;
          clearTimeout(timer);
        };
      }
      case 'loading': {
        loadOs(transition.to).then(done, () => {
          if (cancelled) return;
          dispatch({ type: 'TRANSITION_FAILED', epoch, reason: navigator.onLine ? 'chunk' : 'offline' });
        });
        return () => {
          cancelled = true;
        };
      }
      case 'failed': {
        const retry = () => dispatch({ type: 'RETRY_TRANSITION' });
        window.addEventListener('online', retry, { once: true });
        return () => window.removeEventListener('online', retry);
      }
    }
  }, [transition]);

  if (transition.phase !== 'failed' || isClaimed(transition.epoch, 'failed')) return null;
  return (
    <div className="os-failure" role="alert">
      <p>
        Couldn&rsquo;t load this operating system{transition.reason === 'offline' ? ' — you appear to be offline' : ''}.
      </p>
      <p>
        <button
          type="button"
          className="cv-button cv-button-primary"
          onClick={() => dispatch({ type: 'RETRY_TRANSITION' })}
        >
          Retry
        </button>{' '}
        <a className="cv-button" href="/plain">
          Read the plain portfolio
        </a>
      </p>
    </div>
  );
}
