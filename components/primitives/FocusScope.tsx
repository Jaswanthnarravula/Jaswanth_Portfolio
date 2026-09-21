'use client';
/**
 * FocusScope / inert manager — shared/09 `A11Y-PRIM-04`. Only true modals (search, dialogs) trap focus; windows never
 * do. `makeInert` moves focus to a sensible target *before* making a subtree inert, so focus is never lost to <body>.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { applyFocus, moveFocusOutOf } from '@/lib/kernel/focus';
import type { FocusTarget } from '@/lib/kernel/types';

const TABBABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

export function tabbables(root: Element): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter(
    (element) =>
      element.tabIndex >= 0 && !element.closest('[inert],[hidden]') && element.getAttribute('aria-hidden') !== 'true',
  );
}

export interface FocusScopeProps {
  readonly children: ReactNode;
  /** Tab / Shift+Tab cycle inside (modals only). */
  readonly trapped?: boolean;
  /** Return focus to the element that was focused before the scope mounted. */
  readonly restoreFocus?: boolean;
  /** Focus the first tabbable element on mount (the scope opened by user intent). */
  readonly initialFocus?: boolean;
  readonly className?: string;
}

export function FocusScope({
  children,
  trapped = false,
  restoreFocus = false,
  initialFocus = false,
  className,
}: FocusScopeProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (initialFocus && ref.current) tabbables(ref.current)[0]?.focus({ preventScroll: true });
    return () => {
      if (restoreFocus && previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [initialFocus, restoreFocus]);

  // The trap is a native listener: the wrapper is not itself an interactive element.
  useEffect(() => {
    const node = ref.current;
    if (!trapped || !node) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = tabbables(node);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [trapped]);

  return (
    <div ref={ref} className={className} data-focus-scope={trapped ? 'trapped' : 'open'}>
      {children}
    </div>
  );
}

/** Make `element` inert, moving focus to `target` first if focus is inside. Returns a release function. */
export function makeInert(element: HTMLElement, target: FocusTarget): () => void {
  moveFocusOutOf(element, target);
  if (element.contains(document.activeElement)) applyFocus(target);
  element.setAttribute('inert', '');
  return () => element.removeAttribute('inert');
}
