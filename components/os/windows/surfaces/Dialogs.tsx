'use client';
/**
 * The shell's small modal dialogs, in the Windows dialog skin (Mica title strip, 8 px radius, a footer of buttons):
 *   · Properties — plans/windows/surfaces/context-menus (`WIN-CTX-02`): type, location, dates, stack, and the item's
 *     canonical link with Copy link (shown selected when the clipboard is blocked).
 *   · Keyboard shortcuts — the `?` dialog rendered from the one registry (shared/09 `A11Y-KEY-01`), plus a tour
 *     restart point (shared/20).
 *   · The tour's coach mark — an Acrylic teaching tip with a tail and an accent ring on its target (plans/windows/07).
 * Dialogs trap focus (true modals only), Esc closes, focus returns to the invoker.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { goHref } from '@/components/content';
import { FocusScope } from '@/components/primitives/FocusScope';
import { formatChord, SHORTCUTS } from '@/lib/kernel/keymap';
import type { TourStep } from '@/lib/tour';
import { flDismiss } from '../fluent.generated';
import { Fl } from '../icons';
import type { PropertiesSpec } from '../shell-context';
import styles from '../windows.module.css';

function Dialog({
  title,
  onClose,
  children,
  footer,
  className,
}: {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer: ReactNode;
  readonly className?: string;
}) {
  const id = `win-dialog-${title.replace(/\W+/g, '-').toLowerCase()}`;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div className={styles.dialogLayer}>
      <div role="dialog" aria-modal="true" aria-labelledby={id} className={`${styles.dialog} ${className ?? ''}`}>
        <FocusScope trapped restoreFocus initialFocus>
          <header className={styles.dialogTitlebar}>
            <h2 id={id} className={styles.dialogTitle}>
              {title}
            </h2>
            <button type="button" className={styles.dialogClose} aria-label="Close" onClick={onClose}>
              <Fl icon={flDismiss} size={16} />
            </button>
          </header>
          <div className={styles.dialogBody}>{children}</div>
          <footer className={styles.dialogFooter}>{footer}</footer>
        </FocusScope>
      </div>
    </div>
  );
}

export function PropertiesDialog({
  spec,
  onClose,
  onCopy,
}: {
  readonly spec: PropertiesSpec;
  readonly onClose: () => void;
  readonly onCopy: () => Promise<boolean>;
}) {
  const [blocked, setBlocked] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const link =
    spec.ref && typeof window !== 'undefined' ? new URL(goHref(spec.ref), window.location.origin).href : null;
  useLayoutEffect(() => {
    if (blocked) field.current?.select();
  }, [blocked]);
  return (
    <Dialog
      title={`${spec.title} Properties`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={styles.buttonAccent} onClick={onClose}>
            OK
          </button>
          <button type="button" className={styles.buttonSubtle} onClick={onClose}>
            Cancel
          </button>
        </>
      }
    >
      <p className={styles.propertiesName}>{spec.title}</p>
      <dl className={styles.properties}>
        {spec.rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}:</dt>
            <dd>{value}</dd>
          </div>
        ))}
        {link ? (
          <div>
            <dt>Link:</dt>
            <dd className={styles.propertiesLink}>
              <input
                ref={field}
                readOnly
                aria-label="Link"
                value={link}
                className={styles.propertiesField}
                onFocus={(event) => event.currentTarget.select()}
              />
              <button
                type="button"
                className={styles.buttonSubtle}
                onClick={() => void onCopy().then((copied) => setBlocked(!copied))}
              >
                Copy link
              </button>
            </dd>
          </div>
        ) : null}
      </dl>
    </Dialog>
  );
}

export function ShortcutsDialog({ onClose, onTour }: { readonly onClose: () => void; readonly onTour: () => void }) {
  return (
    <Dialog
      title="Keyboard shortcuts"
      onClose={onClose}
      className={styles.shortcutsDialog}
      footer={
        <>
          <button
            type="button"
            className={styles.buttonSubtle}
            onClick={() => {
              onClose();
              onTour();
            }}
          >
            Take the tour
          </button>
          <button type="button" className={styles.buttonAccent} onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <table className={styles.shortcuts}>
        <caption className="sr-only">Keyboard shortcuts</caption>
        <tbody>
          {SHORTCUTS.map((shortcut) => (
            <tr key={shortcut.id}>
              <th scope="row">{shortcut.label}</th>
              <td>
                {shortcut.chords.map((chord) => (
                  <kbd key={formatChord(chord, false)}>{formatChord(chord, false)}</kbd>
                ))}
              </td>
            </tr>
          ))}
          <tr>
            <th scope="row">Context menu</th>
            <td>
              <kbd>Shift+F10</kbd>
            </td>
          </tr>
          <tr>
            <th scope="row">Snap by keyboard, move, size</th>
            <td>
              <kbd>Window menu</kbd>
            </td>
          </tr>
        </tbody>
      </table>
    </Dialog>
  );
}

/**
 * The tour's teaching tip: Acrylic, a tail pointing at the target, "2 / 5", Next · End tour; an accent ring around the
 * target (never a dimming overlay that blocks the UI). A labelled `group`, reachable by Tab.
 */
export function CoachMark({
  step,
  index,
  total,
  onNext,
  onEnd,
}: {
  readonly step: TourStep;
  readonly index: number;
  readonly total: number;
  readonly onNext: () => void;
  readonly onEnd: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const target = step.pointAt ? document.getElementById(step.pointAt) : null;
    const el = card.current;
    if (!el) return;
    if (!target) {
      el.style.left = '50%';
      el.style.top = '40%';
      el.style.transform = 'translate(-50%, -50%)';
      el.dataset.tail = 'none';
      if (ring.current) ring.current.hidden = true;
      return;
    }
    const box = target.getBoundingClientRect();
    const width = el.offsetWidth || 320;
    const height = el.offsetHeight || 150;
    const below = box.top < window.innerHeight / 2;
    const left = Math.min(window.innerWidth - width - 12, Math.max(12, box.left + box.width / 2 - width / 2));
    const top = below ? box.bottom + 14 : box.top - height - 14;
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(Math.max(12, top))}px`;
    el.style.transform = '';
    el.dataset.tail = below ? 'up' : 'down';
    el.style.setProperty('--tail-x', `${Math.round(box.left + box.width / 2 - left)}px`);
    if (ring.current) {
      ring.current.hidden = false;
      ring.current.style.left = `${Math.round(box.left - 4)}px`;
      ring.current.style.top = `${Math.round(box.top - 4)}px`;
      ring.current.style.width = `${Math.round(box.width + 8)}px`;
      ring.current.style.height = `${Math.round(box.height + 8)}px`;
    }
  }, [step]);
  return (
    <>
      <div ref={ring} className={styles.tourRing} aria-hidden="true" />
      <div
        ref={card}
        className={styles.coach}
        role="group"
        aria-label={`Tour, step ${index + 1} of ${total}`}
        data-coach=""
      >
        <p className={styles.coachCount}>
          {index + 1} / {total}
        </p>
        <p className={styles.coachText}>{step.say}</p>
        <div className={styles.coachActions}>
          <button type="button" className={styles.buttonSubtle} onClick={onEnd}>
            End tour
          </button>
          <button type="button" className={styles.buttonAccent} onClick={onNext}>
            {index + 1 === total ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </>
  );
}
