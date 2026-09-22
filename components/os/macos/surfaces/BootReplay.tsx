'use client';
/**
 * Apple menu → Restart… (after its confirm sheet): the startup beat replayed for fun (plans/macos/surfaces/menu-bar.md
 * "Apple menu"). The same look as the chooser's boot frame (plans/macos/surfaces/boot.md: black stage, the startup
 * mark, a 200 × 4 px bar filled with `scaleX`), about a second long, then the lock screen. Any key or press skips it at
 * once; reduced motion skips it entirely. `aria-hidden` (announced once through the status region); focus is never
 * placed inside it. Windows and the session are untouched — it is a costume change, not a reload.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { announce } from '../announce';
import { setLocked } from '../ui';
import styles from './boot-replay.module.css';

/** How long the replayed bar takes to fill (well under the boot budget of 1.5 s). */
export const REPLAY_MS = 1100;

export function BootReplay({ onDone }: { onDone: () => void }) {
  const bar = useRef<HTMLSpanElement>(null);
  const finished = useRef(false);

  useLayoutEffect(() => {
    const finish = () => {
      if (finished.current) return;
      finished.current = true;
      setLocked(true);
      onDone();
    };
    if (prefersReducedMotion() || typeof bar.current?.animate !== 'function') {
      finish();
      return;
    }
    announce('Restarting');
    const fill = bar.current.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
      duration: REPLAY_MS,
      easing: 'cubic-bezier(0.3, 0, 0.2, 1)',
      fill: 'forwards',
    });
    fill.finished.then(finish, () => undefined);
    return () => fill.cancel();
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Any input skips straight to the lock screen.
  useEffect(() => {
    const skip = () => {
      if (finished.current) return;
      finished.current = true;
      setLocked(true);
      onDone();
    };
    document.addEventListener('keydown', skip, true);
    document.addEventListener('pointerdown', skip, true);
    return () => {
      document.removeEventListener('keydown', skip, true);
      document.removeEventListener('pointerdown', skip, true);
    };
  }, [onDone]);

  return (
    <div className={styles.boot} aria-hidden="true" data-boot-replay="">
      <span className={styles.mark}>
        <AssetIcon id="system.apple-logo" size={72} />
      </span>
      <span className={styles.track}>
        <span ref={bar} className={styles.bar} />
      </span>
    </div>
  );
}
