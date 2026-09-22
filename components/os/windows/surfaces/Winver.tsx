'use client';
/**
 * `winver` — plans/windows/apps/settings.md "winver" (`WIN-SET-06`) and shared/21 `EGG-WINVER-01`. The small fixed
 * "About Windows" dialog: a modal `dialog` with a Mica-like title strip, the mark (the site's own mark in `original`
 * mode — the manifest swaps it), "{givenName}'s Portfolio", "Version {résumé updated} (OS Build {content revision})",
 * the licence line, and OK. Focus is trapped and starts on OK; Esc (= OK), ✕ or any press outside closes it and focus
 * returns to where it was. The first time it opens, the egg is recorded once in `prefs.eggsFound` and `egg_found` is
 * tracked once. Every fact comes from `data/selectors`.
 */
import { useEffect, useEffectEvent, useId, useRef } from 'react';
import { FocusScope } from '@/components/primitives/FocusScope';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { contentRev } from '@/data/content-index';
import { getPerson, getResume } from '@/data/selectors';
import { analytics } from '@/lib/analytics/loader';
import { recordEgg } from '@/lib/eggs';
import { dispatch } from '@/stores/kernel-store';
import { getPrefs } from '@/stores/prefs-store';
import { flClose } from '../fluent.generated';
import { Fl } from '../icons';
import { returnFocus } from './focus-return';
import styles from './winver.module.css';

export const WINVER_EGG = 'EGG-WINVER-01';

export function Winver({ onClose }: { readonly onClose: () => void }) {
  const person = getPerson();
  const resume = getResume();
  const titleId = useId();
  const bodyId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const ok = useRef<HTMLButtonElement>(null);
  const dismiss = useEffectEvent(() => onClose());

  // OK is the default button: focused on open. On close, focus returns to where it came from — unless that was in
  // Search, which closed as the dialog opened: then the focused window, else the desktop — never <body> (shared/09).
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ok.current?.focus({ preventScroll: true });
    return () => {
      setTimeout(() => returnFocus(opener), 0);
    };
  }, []);

  // The egg counts once, ever (shared/21): recorded in the preferences, tracked only when newly found.
  useEffect(() => {
    const found = recordEgg(getPrefs().eggsFound, WINVER_EGG);
    if (!found) return;
    dispatch({ type: 'SET_PREF', patch: { eggsFound: found } });
    analytics.track({ name: 'egg_found', id: WINVER_EGG });
  }, []);

  // Esc = OK; a press outside the dialog dismisses it too (eggs never trap). Native listeners: the dialog itself is
  // not an interactive element, and Esc must not reach the shell behind it.
  useEffect(() => {
    const el = dialog.current;
    const outside = backdrop.current;
    if (!el || !outside) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    };
    const onPress = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      dismiss();
    };
    el.addEventListener('keydown', onKey);
    outside.addEventListener('pointerdown', onPress);
    return () => {
      el.removeEventListener('keydown', onKey);
      outside.removeEventListener('pointerdown', onPress);
    };
  }, []);

  return (
    <div className={styles.layer} data-winver="" data-dialog-layer="">
      <div ref={backdrop} className={styles.backdrop} aria-hidden="true" />
      <FocusScope trapped className={styles.scope}>
        <div
          ref={dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          className={styles.dialog}
        >
          <header className={styles.titlebar}>
            <h2 id={titleId} className={styles.title}>
              About Windows
            </h2>
            <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
              <Fl icon={flClose} size={16} />
            </button>
          </header>
          <div id={bodyId} className={styles.body}>
            <div className={styles.brand}>
              <span className={styles.mark}>
                <AssetIcon id="system.windows-logo" size={56} priority />
              </span>
              <p className={styles.product}>{`${person.givenName}’s Portfolio`}</p>
            </div>
            <hr className={styles.rule} />
            <p className={styles.line}>
              Version <time dateTime={resume.updated}>{resume.updated}</time> (OS Build {contentRev})
            </p>
            <p className={styles.fine}>
              An original recreation made for a personal portfolio. It is not affiliated with or endorsed by Microsoft.
            </p>
            <p className={styles.licence}>
              This product is licensed to: <span className={styles.licensee}>you, the visitor</span>
            </p>
          </div>
          <footer className={styles.footer}>
            <button ref={ok} type="button" className={styles.ok} onClick={onClose}>
              OK
            </button>
          </footer>
        </div>
      </FocusScope>
    </div>
  );
}
