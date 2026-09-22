'use client';
/**
 * Sheets (plans/ios/02 "Sheets", `IOS-FLIGHT-07`): modal cards rising from the bottom with detents (medium ≈ 50 %,
 * large); the app behind scales to 0.94 and dims; the grabber (and the header) drag the sheet with the finger and a
 * release decides by projected position — dismiss, snap to the other detent, or spring back (`IOS-MOTION-02`); a
 * touch on a moving sheet catches it where it is (`IOS-MOTION-03`). Visible Cancel / Done buttons are always present
 * (the non-gesture alternative), Esc = Cancel, and the browser's Back dismisses the sheet first (one transient history
 * entry — plans/ios/06 E14). Full page: a centred form sheet, max 720 px wide. Modal `dialog`, Cancel first in order;
 * focus returns to the invoking control.
 * The sheet renders into its app surface's sheet layer (a portal), so it flies with the app and the app content behind
 * can scale without scaling the sheet.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { pushTransientHistory } from '@/lib/kernel/route-sync';
import { drag } from '@/lib/motion/drag';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { commits } from '../model';
import { IOS_EASE, IOS_SPRINGS, springSamples } from '../motion';
import { Glyph } from './glyphs';
import styles from './ui.module.css';

/** The app surface provides its sheet layer (and marks itself while a sheet is up, so its content scales back). */
export interface SheetHost {
  readonly layer: HTMLElement | null;
  readonly setOpen: (id: string, open: boolean) => void;
}
export const SheetHostContext = createContext<SheetHost | null>(null);

export type Detent = 'medium' | 'large';

export interface SheetProps {
  readonly open: boolean;
  readonly title: string;
  /** Visible dismiss control (Cancel / Done / Close) — first in the reading order. */
  readonly cancelLabel?: string;
  readonly onCancel: () => void;
  /** Optional confirm control on the right (Mail's Send). */
  readonly confirm?: {
    readonly label: string;
    readonly onConfirm: () => void;
    readonly disabled?: boolean;
    readonly glyph?: 'send';
  };
  readonly detent?: Detent;
  /** Allow dragging up to the large detent from medium. */
  readonly expandable?: boolean;
  readonly children: ReactNode;
  /** Called once the exit animation ended (the parent may unmount). */
  readonly onClosed?: () => void;
  /** Focus goes here on close (defaults to what was focused on open). */
  readonly returnFocus?: HTMLElement | null;
  /** Hide the title visually (Quick Look draws its own chrome) — it still names the dialog. */
  readonly hideHeader?: boolean;
  readonly className?: string;
  /** Leave the app behind unscaled (full-screen covers). */
  readonly cover?: boolean;
}

const HEADER_DRAG_SELECTOR = '[data-sheet-grab]';

export function Sheet({
  open,
  title,
  cancelLabel = 'Cancel',
  onCancel,
  confirm,
  detent: initialDetent = 'large',
  expandable = true,
  children,
  onClosed,
  returnFocus,
  hideHeader = false,
  className,
  cover = false,
}: SheetProps) {
  const host = useContext(SheetHostContext);
  const sheetId = useId();
  const titleId = `${sheetId}-title`;
  const panel = useRef<HTMLDivElement>(null);
  const [present, setPresent] = useState(open);
  const [detent, setDetent] = useState<Detent>(initialDetent);
  const opener = useRef<HTMLElement | null>(null);
  const animation = useRef<Animation | null>(null);
  const release = useRef<(() => void) | null>(null);
  const cancelRef = useRef(onCancel);
  useLayoutEffect(() => {
    cancelRef.current = onCancel;
  });

  if (open && !present) setPresent(true);

  // Tell the surface (its content scales back) while presented.
  useEffect(() => {
    if (!present || cover) return;
    host?.setOpen(sheetId, true);
    return () => host?.setOpen(sheetId, false);
  }, [present, host, sheetId, cover]);

  /** An interrupted animation is not its end: WAAPI queues `cancel` events, so detach before cancelling. */
  const stopAnimation = () => {
    const current = animation.current;
    animation.current = null;
    if (!current) return;
    current.onfinish = null;
    current.oncancel = null;
    current.cancel();
  };

  // Present: rise with a critically damped spring (r 0.38 ζ 1); focus the first control (Cancel).
  // (`present` is in the deps: on a reopen the panel only exists in the commit after `open` turned true.)
  useLayoutEffect(() => {
    if (!open || !present || !panel.current) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const el = panel.current;
    stopAnimation();
    if (!prefersReducedMotion() && typeof el.animate === 'function') {
      const { values, durationMs } = springSamples(IOS_SPRINGS.sheet, 14);
      animation.current = el.animate(
        values.map((v) => ({ transform: `translateY(${(1 - v) * 100}%)` })),
        { duration: durationMs, easing: 'linear' },
      );
    } else if (typeof el.animate === 'function') {
      animation.current = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
    }
    el.querySelector<HTMLElement>('[data-sheet-first]')?.focus({ preventScroll: true });
  }, [open, present]);

  // One transient history entry: the browser's Back dismisses the sheet (E14), history unchanged.
  useEffect(() => {
    if (!open) return;
    release.current = pushTransientHistory(() => {
      release.current = null;
      cancelRef.current();
    });
    return () => {
      release.current?.();
      release.current = null;
    };
  }, [open]);

  // Dismiss: slide down, then unmount and return focus.
  useLayoutEffect(() => {
    if (open || !present) return;
    const el = panel.current;
    const done = () => {
      setPresent(false);
      setDetent(initialDetent);
      const target = returnFocus ?? opener.current;
      if (target?.isConnected) target.focus({ preventScroll: true });
      onClosed?.();
    };
    if (!el || typeof el.animate !== 'function') {
      done();
      return;
    }
    const current = getComputedStyle(el).transform;
    stopAnimation();
    const exit = prefersReducedMotion()
      ? el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' })
      : el.animate([{ transform: current === 'none' ? 'translateY(0)' : current }, { transform: 'translateY(105%)' }], {
          duration: 280,
          easing: IOS_EASE.bannerOut,
          fill: 'forwards',
        });
    animation.current = exit;
    exit.onfinish = done;
    exit.oncancel = done;
    // Only when `open` turns false.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dismiss = useCallback(() => cancelRef.current(), []);

  // Drag the grabber / header: 1:1, decided by projected position. A touch on a moving sheet catches it.
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    if (!target.closest(HEADER_DRAG_SELECTOR) || target.closest('button, a, input, textarea')) return;
    const el = panel.current;
    if (!el) return;
    const caught = getComputedStyle(el).transform;
    const startY = caught && caught !== 'none' ? new DOMMatrixReadOnly(caught).m42 : 0;
    stopAnimation();
    const height = el.getBoundingClientRect().height;
    let last = { t: performance.now(), y: startY };
    let velocity = 0;
    el.style.transform = `translateY(${startY}px)`;
    drag(el, event.nativeEvent, {
      threshold: 2,
      onMove: (_dx, dy) => {
        const y = startY + dy;
        const shown = y < 0 ? y / 3 : y; // rubber band upward
        const t = performance.now();
        if (t > last.t) velocity = ((y - last.y) / (t - last.t)) * 1000;
        last = { t, y };
        el.style.transform = `translateY(${shown}px)`;
      },
      onEnd: ({ dy, moved }) => {
        const y = startY + (moved ? dy : 0);
        const from = el.style.transform || 'translateY(0)';
        el.style.transform = '';
        const settle = (to: string) =>
          el.animate?.([{ transform: from }, { transform: to }], { duration: 260, easing: IOS_EASE.nav });
        if (commits(Math.max(0, y) / height, velocity / height)) {
          // The exit slide starts from where the finger left the sheet (it reads the inline transform).
          el.style.transform = from;
          dismiss();
          return;
        }
        if (expandable && detent === 'medium' && y < -40) setDetent('large');
        else if (detent === 'large' && initialDetent === 'medium' && y > height * 0.25) setDetent('medium');
        settle('translateY(0)');
      },
    });
  };

  if (!present || !host?.layer) return null;
  return createPortal(
    <div className={styles.sheetLayer} data-sheet-root="" data-cover={cover || undefined}>
      <div className={styles.sheetScrim} aria-hidden="true" onClick={dismiss} data-sheet-scrim="" />
      {/* A modal surface owns Esc / Tab and its drag (keys reach it from the control inside). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`${styles.sheet} ${className ?? ''}`}
        data-detent={detent}
        data-sheet=""
        onPointerDown={onPointerDown}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            dismiss();
          }
          if (event.key === 'Tab') trapTab(event, panel.current);
        }}
      >
        <div className={styles.sheetHeader} data-sheet-grab="" data-hidden={hideHeader || undefined}>
          <span className={styles.grabber} aria-hidden="true" />
          <button
            type="button"
            className={styles.textButton}
            onClick={dismiss}
            data-sheet-first=""
            data-sheet-cancel=""
          >
            {cancelLabel}
          </button>
          <h3 id={titleId} className={hideHeader ? 'sr-only' : styles.sheetTitle}>
            {title}
          </h3>
          {confirm ? (
            <button
              type="button"
              className={confirm.glyph === 'send' ? styles.sendButton : `${styles.textButton} ${styles.textButtonBold}`}
              onClick={confirm.onConfirm}
              disabled={confirm.disabled}
              aria-label={confirm.glyph === 'send' ? confirm.label : undefined}
              data-sheet-confirm=""
            >
              {confirm.glyph === 'send' ? <Glyph name="send" size={18} strokeWidth={2.6} /> : confirm.label}
            </button>
          ) : (
            <span className={styles.sheetSpacer} />
          )}
        </div>
        <div className={styles.sheetBody}>{children}</div>
      </div>
    </div>,
    host.layer,
  );
}

function trapTab(event: React.KeyboardEvent, root: HTMLElement | null) {
  if (!root) return;
  const items = [
    ...root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, textarea, [tabindex="0"]'),
  ].filter((el) => !el.closest('[inert],[hidden]'));
  if (items.length === 0) return;
  const first = items[0]!;
  const last = items[items.length - 1]!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Action sheet: a titled list of choices with a separate Cancel (plans/ios/apps/mail "Delete Draft / Save Draft").
 * Modal `dialog`, Esc = Cancel, focus → the first choice, back to the opener on close.
 */
export function ActionSheet({
  open,
  title,
  message,
  actions,
  onCancel,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly message?: string;
  readonly actions: readonly {
    readonly id: string;
    readonly label: string;
    readonly destructive?: boolean;
    readonly run: () => void;
  }[];
  readonly onCancel: () => void;
}) {
  const host = useContext(SheetHostContext);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
    return () => {
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    };
  }, [open]);
  if (!open || !host?.layer) return null;
  return createPortal(
    <div className={styles.sheetLayer} data-action-sheet="">
      <div className={styles.sheetScrim} aria-hidden="true" onClick={onCancel} />
      {/* A modal surface owns Esc / Tab and its drag (keys reach it from the control inside). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        className={styles.actionSheet}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onCancel();
          }
          if (event.key === 'Tab') trapTab(event, root.current);
        }}
      >
        <div className={styles.actionGroup}>
          <p className={styles.actionTitle} id={`${id}-t`}>
            {title}
            {message ? <span>{message}</span> : null}
          </p>
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={styles.actionButton}
              data-destructive={action.destructive || undefined}
              onClick={action.run}
            >
              {action.label}
            </button>
          ))}
        </div>
        <button type="button" className={`${styles.actionButton} ${styles.actionCancel}`} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>,
    host.layer,
  );
}
