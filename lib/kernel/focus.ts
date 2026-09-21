/**
 * FocusManager — shared/04 `KRN-FOCUS-01`, rules in shared/09. The single owner of programmatic focus: it applies the
 * kernel's `focusTarget` (first candidate present in the DOM), always with `preventScroll`, moves focus *before*
 * anything is made `inert`/hidden, and guarantees focus never rests on `<body>`.
 */
import { focusKeys, type FocusTarget } from './types';

const FOCUS_ATTR = 'data-focus-key';

export const focusKeyAttr = (key: string) => ({ [FOCUS_ATTR]: key }) as Record<string, string>;

function isUsable(element: Element | null): element is HTMLElement {
  if (!element || !(element instanceof HTMLElement) || !element.isConnected) return false;
  if (element.closest('[inert],[hidden],[aria-hidden="true"]')) return false;
  if (element.hasAttribute('disabled')) return false;
  return true;
}

function find(root: ParentNode, key: string): HTMLElement | null {
  const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(key) : key.replace(/["\\]/g, '\\$&');
  const element = root.querySelector(`[${FOCUS_ATTR}="${escaped}"]`);
  return isUsable(element) ? element : null;
}

function focusElement(element: HTMLElement): boolean {
  if (!element.hasAttribute('tabindex') && element.tabIndex < 0) element.setAttribute('tabindex', '-1');
  element.focus({ preventScroll: true });
  return element.ownerDocument.activeElement === element;
}

export interface FocusManagerOptions {
  readonly root?: Document;
  /** Keys tried after the target's own candidates. */
  readonly fallbacks?: readonly string[];
  readonly onBodyFocus?: () => void;
}

/** Focus the first present candidate; returns the element that received focus (or `null` if none could). */
export function applyFocus(target: FocusTarget | null, options: FocusManagerOptions = {}): HTMLElement | null {
  const root = options.root ?? (typeof document === 'undefined' ? null : document);
  if (!root || !target) return null;
  const keys = [...target.candidates, ...(options.fallbacks ?? [focusKeys.osHeading, focusKeys.chooserHeading])];
  for (const key of keys) {
    const element = find(root, key);
    if (element && focusElement(element)) return element;
  }
  if (root.activeElement === root.body) options.onBodyFocus?.();
  return null;
}

/**
 * Call before hiding / inerting `container`: if it holds focus, focus moves to `target` first (shared/09 — focus
 * moves before `inert`/`hidden`; `aria-hidden` on a subtree holding focus is forbidden).
 */
export function moveFocusOutOf(
  container: Element | null,
  target: FocusTarget,
  options: FocusManagerOptions = {},
): void {
  const root = options.root ?? (typeof document === 'undefined' ? null : document);
  if (!root || !container) return;
  const active = root.activeElement;
  if (active && active !== root.body && container.contains(active)) applyFocus(target, options);
}

/** Development assertion used by e2e helpers and the shell: focus must never rest on `<body>` after an action. */
export const focusIsOnBody = (root: Document = document): boolean =>
  root.activeElement === null || root.activeElement === root.body;
