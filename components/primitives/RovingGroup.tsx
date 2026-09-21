'use client';
/**
 * RovingGroup — shared/09 `A11Y-PRIM-01`. One tab stop for a group of items (icon grids, Docks, taskbars, lists):
 * 1-D or 2-D arrow keys, Home/End, type-ahead. In a grid, visual columns are *measured at keypress*, so reflow and
 * rotation never break navigation. Tab indices are managed on the DOM directly — moving never re-renders React.
 * Items are marked with `data-roving-item`; activation stays native (Enter on a link or button).
 */
import { useCallback, useLayoutEffect, useRef, type HTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';

export type RovingOrientation = 'horizontal' | 'vertical' | 'grid';

export interface RovingGroupProps extends Omit<HTMLAttributes<HTMLElement>, 'onKeyDown'> {
  readonly as?: 'ul' | 'ol' | 'div' | 'nav' | 'section';
  readonly orientation: RovingOrientation;
  /** Wrap from last to first on 1-D groups. */
  readonly wrap?: boolean;
  readonly itemSelector?: string;
  readonly children: ReactNode;
  readonly onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
}

const DEFAULT_SELECTOR = '[data-roving-item]';
const TYPEAHEAD_RESET_MS = 500;

const labelOf = (element: HTMLElement) =>
  (element.getAttribute('aria-label') ?? element.dataset.label ?? element.textContent ?? '').trim().toLowerCase();

const isEnabled = (element: HTMLElement) =>
  !element.hasAttribute('disabled') && element.getAttribute('aria-disabled') !== 'true';

/** Group items into visual rows by their measured top edge. */
function rowsOf(items: readonly HTMLElement[]): HTMLElement[][] {
  const rows: { top: number; height: number; items: HTMLElement[] }[] = [];
  for (const item of items) {
    const rect = item.getBoundingClientRect();
    const row = rows.find(
      (candidate) => Math.abs(candidate.top - rect.top) < Math.max(4, Math.min(candidate.height, rect.height) / 2),
    );
    if (row) row.items.push(item);
    else rows.push({ top: rect.top, height: rect.height, items: [item] });
  }
  return rows
    .sort((a, b) => a.top - b.top)
    .map((row) => row.items.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left));
}

const centerX = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  return rect.left + rect.width / 2;
};

export function RovingGroup({
  as = 'div',
  orientation,
  wrap = false,
  itemSelector = DEFAULT_SELECTOR,
  children,
  onKeyDown,
  ...rest
}: RovingGroupProps) {
  const ref = useRef<HTMLElement>(null);
  const typeahead = useRef({ buffer: '', at: 0 });

  const items = useCallback(
    () => [...(ref.current?.querySelectorAll<HTMLElement>(itemSelector) ?? [])].filter(isEnabled),
    [itemSelector],
  );

  const activate = useCallback(
    (target: HTMLElement, focus: boolean) => {
      for (const item of items()) item.tabIndex = item === target ? 0 : -1;
      if (focus) target.focus({ preventScroll: false });
    },
    [items],
  );

  // After every render: exactly one tabbable item (the current one, else aria-current, else the first).
  useLayoutEffect(() => {
    const all = items();
    if (all.length === 0) return;
    const current =
      all.find((item) => item.tabIndex === 0 && item.getAttribute('tabindex') === '0') ??
      all.find(
        (item) => item.getAttribute('aria-current') === 'true' || item.getAttribute('aria-current') === 'page',
      ) ??
      all[0]!;
    for (const item of all) item.tabIndex = item === current ? 0 : -1;
  });

  const handleFocus = (event: React.FocusEvent<HTMLElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(itemSelector);
    if (target && ref.current?.contains(target) && target.tabIndex !== 0) activate(target, false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const all = items();
    const current = (event.target as HTMLElement).closest<HTMLElement>(itemSelector);
    if (!current || all.length === 0) return;
    const index = all.indexOf(current);
    let next: HTMLElement | undefined;

    const linear = (delta: number) => {
      const target = index + delta;
      if (target < 0) return wrap ? all[all.length - 1] : all[0];
      if (target >= all.length) return wrap ? all[0] : all[all.length - 1];
      return all[target];
    };
    const vertical = (delta: number) => {
      const rows = rowsOf(all);
      const rowIndex = rows.findIndex((row) => row.includes(current));
      const row = rows[rowIndex + delta];
      if (!row) return current;
      const x = centerX(current);
      return row.reduce((best, item) => (Math.abs(centerX(item) - x) < Math.abs(centerX(best) - x) ? item : best));
    };

    switch (event.key) {
      case 'ArrowRight':
        if (orientation !== 'vertical') next = linear(1);
        break;
      case 'ArrowLeft':
        if (orientation !== 'vertical') next = linear(-1);
        break;
      case 'ArrowDown':
        if (orientation === 'vertical') next = linear(1);
        else if (orientation === 'grid') next = vertical(1);
        break;
      case 'ArrowUp':
        if (orientation === 'vertical') next = linear(-1);
        else if (orientation === 'grid') next = vertical(-1);
        break;
      case 'Home':
        next = all[0];
        break;
      case 'End':
        next = all[all.length - 1];
        break;
      default: {
        if (event.key.length !== 1 || event.key === ' ') return;
        const now = event.timeStamp;
        const state = typeahead.current;
        state.buffer =
          now - state.at > TYPEAHEAD_RESET_MS ? event.key.toLowerCase() : state.buffer + event.key.toLowerCase();
        state.at = now;
        const start = state.buffer.length > 1 ? index : index + 1;
        const ordered = [...all.slice(start), ...all.slice(0, start)];
        next = ordered.find((item) => labelOf(item).startsWith(state.buffer));
        if (!next) return;
      }
    }
    if (!next) return;
    event.preventDefault();
    if (next !== current) activate(next, true);
  };

  const Tag = as as 'div';
  return (
    <Tag {...rest} ref={ref as React.RefObject<HTMLDivElement>} onKeyDown={handleKeyDown} onFocus={handleFocus}>
      {children}
    </Tag>
  );
}
