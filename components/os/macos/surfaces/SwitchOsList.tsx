'use client';
/**
 * The operating systems a visitor can switch to (plans/macos/07 "Switch OS", `MAC-X-05`, `MAC-SET-05`): the visible
 * OSes (released, plus the preview allow-list in preview builds) and "Back to chooser". Shared by the Switch OS sheet
 * and Settings → General. Choosing one parks this session and runs the exit beat (`SWITCH_OS`).
 */
import { OS_NAMES, type OsId } from '@/lib/kernel/ids';
import { VISIBLE_OSES } from '@/lib/kernel/route';
import { dispatchSoon } from '@/stores/kernel-store';
import styles from './switch-os.module.css';

export function SwitchOsList({ current = 'macos', onPick }: { current?: OsId; onPick?: () => void }) {
  const pick = (to: OsId | null) => {
    onPick?.();
    dispatchSoon({ type: 'SWITCH_OS', to, via: 'switch' });
  };
  return (
    <ul className={styles.list} aria-label="Operating systems">
      {VISIBLE_OSES.map((os) => (
        <li key={os} className={styles.row}>
          <span className={styles.name}>{OS_NAMES[os]}</span>
          {os === current ? (
            <span className={styles.current}>Current</span>
          ) : (
            <button type="button" className={styles.button} onClick={() => pick(os)}>
              Switch to {OS_NAMES[os]}
            </button>
          )}
        </li>
      ))}
      <li className={styles.row}>
        <span className={styles.name}>All operating systems</span>
        <button type="button" className={styles.button} onClick={() => pick(null)}>
          Back to chooser
        </button>
      </li>
    </ul>
  );
}
