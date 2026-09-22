/**
 * The Windows boot screen — plans/windows/surfaces/boot.md (`WIN-BOOT-01`, `WIN-BOOT-04`): a black stage, the centred
 * logo (96 px, 72 px compact; the asset manifest swaps in the original mark in `original` mode) and below it the
 * **indeterminate ring of orbiting dots** — five dots on a 32 px circle, staggered 120 ms, a 2 s loop, pure CSS
 * `transform` (off the main thread). No text and no percentage (Windows never shows one); after 4 s a quiet
 * "Just a moment…" + the plain-portfolio link fade in. Hook-free: the chooser shows it over the snapshot while the
 * Windows chunk loads on the first chooser entry (plans/04 `CHOOSE-ENTER-02`), and Start → Restart replays it.
 * Decorative (`aria-hidden`); the status region announces "Starting Windows" / "Windows ready".
 */
import { AssetIcon } from '@/components/ui/AssetIcon';
import styles from './boot.module.css';

export function WindowsBoot({
  className,
  slowLink = true,
}: {
  readonly className?: string;
  readonly slowLink?: boolean;
}) {
  return (
    <div className={`${styles.boot} ${className ?? ''}`} data-boot="windows" data-win-boot="" aria-hidden="true">
      <span className={styles.logo}>
        <AssetIcon id="system.windows-logo" size={96} priority fluid />
      </span>
      <span className={styles.ring}>
        {[0, 1, 2, 3, 4].map((dot) => (
          <i key={dot} className={styles.dot} style={{ animationDelay: `${dot * 120}ms` }} />
        ))}
      </span>
      {slowLink ? (
        <span className={styles.slow}>
          Just a moment…{' '}
          <a href="/plain" tabIndex={-1}>
            Open the plain portfolio
          </a>
        </span>
      ) : null}
    </div>
  );
}
