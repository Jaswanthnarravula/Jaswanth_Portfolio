'use client';
/**
 * Combobox + Listbox — shared/09 `A11Y-PRIM-03`, shared/15 search contract. Focus stays in the input;
 * `aria-activedescendant` points at the active option; options are grouped with labels; list autocomplete only;
 * the result count is announced in a debounced polite status; Esc clears, then closes. Options are real clickable
 * elements (pointer never steals focus from the input). Headless: OS search skins style `[data-combobox*]`.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface ComboboxOption {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly icon?: ReactNode;
}

export interface ComboboxGroup {
  readonly id: string;
  readonly label: string;
  readonly options: readonly ComboboxOption[];
}

export interface ComboboxProps {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly groups: readonly ComboboxGroup[];
  readonly onSelect: (id: string) => void;
  readonly onClose: () => void;
  readonly placeholder?: string;
  readonly statusDelayMs?: number;
  readonly autoFocus?: boolean;
  readonly renderOption?: (option: ComboboxOption, active: boolean) => ReactNode;
  readonly emptyState?: ReactNode;
  readonly className?: string;
  readonly inputClassName?: string;
  readonly listClassName?: string;
  /** addition (plans/windows/surfaces/search): content between the input and the list (filter chips). */
  readonly beforeList?: ReactNode;
  /** addition: the active option changed (a preview pane follows the selection). */
  readonly onActiveChange?: (id: string | null) => void;
  /** addition: runs before the built-in keys; calling `preventDefault()` skips them (e.g. Right into a preview pane). */
  readonly onInputKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  /** addition: the input's id (a label or skin can point at it). */
  readonly inputId?: string;
}

export const resultCountText = (count: number) =>
  count === 0 ? 'No results' : count === 1 ? '1 result' : `${count} results`;

export function Combobox({
  label,
  value,
  onChange,
  groups,
  onSelect,
  onClose,
  placeholder,
  statusDelayMs = 300,
  autoFocus = false,
  renderOption,
  emptyState,
  className,
  inputClassName,
  listClassName,
  beforeList,
  onActiveChange,
  onInputKeyDown,
  inputId,
}: ComboboxProps) {
  const baseId = useId();
  const listId = `${baseId}-listbox`;
  const optionId = (id: string) => `${baseId}-option-${id}`;
  const flat = groups.flatMap((group) => group.options);
  const input = useRef<HTMLInputElement>(null);
  const composing = useRef(false);

  // The cursor belongs to one result set: new results derive a fresh cursor on the first option (no effect needed).
  const signature = flat.map((option) => option.id).join('|');
  const [cursor, setCursor] = useState({ signature, index: 0 });
  const active = cursor.signature === signature ? cursor.index : 0;
  const setActive = (next: number | ((index: number) => number)) =>
    setCursor((current) => {
      const from = current.signature === signature ? current.index : 0;
      return { signature, index: typeof next === 'function' ? next(from) : next };
    });

  // Debounced, polite result count; cleared (derived) when the query is empty.
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (!value) return;
    const timer = setTimeout(() => setStatus(resultCountText(flat.length)), statusDelayMs);
    return () => clearTimeout(timer);
  }, [value, flat.length, statusDelayMs]);
  const statusText = value ? status : '';

  const activeOption = flat[Math.min(active, flat.length - 1)];
  const activeId = activeOption?.id ?? null;
  useEffect(() => {
    onActiveChange?.(activeId);
    // The callback identity may change every render; only the active option matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (composing.current) return;
    onInputKeyDown?.(event);
    if (event.defaultPrevented) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (flat.length) setActive((index) => (index + 1) % flat.length);
        return;
      case 'ArrowUp':
        event.preventDefault();
        if (flat.length) setActive((index) => (index - 1 + flat.length) % flat.length);
        return;
      case 'Home':
      case 'End':
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        setActive(event.key === 'Home' ? 0 : flat.length - 1);
        return;
      case 'Enter':
        if (activeOption) {
          event.preventDefault();
          onSelect(activeOption.id);
        }
        return;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        if (value) onChange('');
        else onClose();
        return;
    }
  };

  let index = -1;
  return (
    <div className={className} data-combobox="">
      <input
        ref={input}
        id={inputId}
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={flat.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeOption ? optionId(activeOption.id) : undefined}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="go"
        placeholder={placeholder}
        // Search surfaces open by user intent; focusing their field is expected (not autofocus on page load).
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        value={value}
        className={inputClassName}
        data-combobox-input=""
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={(event) => {
          composing.current = false;
          onChange(event.currentTarget.value);
        }}
      />
      {beforeList}
      <div role="listbox" id={listId} aria-label={`${label} results`} className={listClassName} data-combobox-list="">
        {groups.map((group) => {
          const groupLabelId = `${baseId}-group-${group.id}`;
          return (
            <div key={group.id} role="group" aria-labelledby={groupLabelId} data-combobox-group="">
              <div id={groupLabelId} role="presentation" data-combobox-group-label="">
                {group.label}
              </div>
              {group.options.map((option) => {
                index++;
                const isActive = activeOption?.id === option.id;
                const position = index;
                return (
                  <div
                    key={option.id}
                    id={optionId(option.id)}
                    role="option"
                    aria-selected={isActive}
                    data-combobox-option=""
                    data-active={isActive || undefined}
                    tabIndex={-1}
                    onPointerDown={(event) => event.preventDefault()}
                    onPointerMove={() => setActive(position)}
                    onClick={() => onSelect(option.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') onSelect(option.id);
                    }}
                  >
                    {renderOption ? renderOption(option, isActive) : option.label}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      {flat.length === 0 && value ? <div data-combobox-empty="">{emptyState}</div> : null}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-combobox-status="">
        {statusText}
      </div>
    </div>
  );
}
