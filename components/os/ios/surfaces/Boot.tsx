/**
 * The iOS boot screen — plans/ios/surfaces/boot.md (`IOS-BOOT-01…04`): a pure black stage filling the page and the
 * centred logo only (72 pt on phones, 96 pt larger) — **no progress bar**, as a real iPhone boots. The chooser shows it
 * over the snapshot only if the iOS chunk is still loading 150 ms after the click, on the first chooser entry of a
 * session (never on deep links, refresh, `/go` or re-entry; never under reduced motion — plans/04 `CHOOSE-ENTER-02`).
 * After 4 s a quiet "Still starting…" and a plain-portfolio link fade in (CSS delay — no timer). Any input skips the
 * held beats (the chooser stage). Decorative (`aria-hidden`); the status region says "Starting iOS" / "iOS ready".
 * Hook-free; the official Apple mark in `official` mode, the site's own monogram in `original` mode.
 */
import { AssetIcon } from '@/components/ui/AssetIcon';
import styles from './boot.module.css';

export function IosBoot({ className, slowLink = true }: { readonly className?: string; readonly slowLink?: boolean }) {
  return (
    <div className={`${styles.boot} ${className ?? ''}`} data-boot="ios" data-ios-boot="" aria-hidden="true">
      <span className={styles.logo}>
        <AssetIcon id="system.apple-logo" size={96} priority fluid />
      </span>
      {slowLink ? (
        <span className={styles.slow}>
          Still starting…{' '}
          <a href="/plain" tabIndex={-1}>
            Open the plain portfolio
          </a>
        </span>
      ) : null}
    </div>
  );
}
