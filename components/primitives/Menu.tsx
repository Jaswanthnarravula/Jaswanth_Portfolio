'use client';
/**
 * Menu / Menubar — shared/09 `A11Y-PRIM-02`, WAI-ARIA APG. Headless: OS skins style `[data-menu*]` hooks.
 * Menubar: one tab stop; Left/Right between menus; Down/Enter/Space open on the first item, Up on the last.
 * Menu: Up/Down (wrapping, skipping separators and disabled items), Home/End, type-ahead, Enter/Space activate,
 * Esc closes to the invoker, Left/Right move to the neighbouring menubar menu, Tab closes and moves on.
 * Menus appear instantly — no animation lives here.
 */
import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';

export type MenuEntry =
  | {
      readonly kind: 'item';
      readonly id: string;
      readonly label: string;
      readonly shortcut?: string;
      readonly disabled?: boolean;
      readonly icon?: ReactNode;
      readonly onSelect: () => void;
    }
  | {
      readonly kind: 'checkbox';
      readonly id: string;
      readonly label: string;
      readonly checked: boolean;
      readonly disabled?: boolean;
      readonly onSelect: () => void;
    }
  | { readonly kind: 'separator'; readonly id: string }
  | { readonly kind: 'heading'; readonly id: string; readonly label: string };

type Actionable = Extract<MenuEntry, { kind: 'item' | 'checkbox' }>;
const isActionable = (entry: MenuEntry): entry is Actionable =>
  (entry.kind === 'item' || entry.kind === 'checkbox') && !entry.disabled;

type CloseReason = 'escape' | 'tab' | 'select' | 'outside';

interface MenuListProps {
  readonly items: readonly MenuEntry[];
  readonly label: string;
  readonly id?: string;
  readonly initial: 'first' | 'last';
  readonly onClose: (reason: CloseReason) => void;
  /** Left/Right: move to the neighbouring menu (menubar only). */
  readonly onSideways?: (delta: -1 | 1) => void;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

function MenuList({ items, label, id, initial, onClose, onSideways, className, style }: MenuListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ buffer: '', at: 0 });
  const actionable = items.filter(isActionable);

  const focusIndex = (index: number) => {
    const target = ref.current?.querySelectorAll<HTMLElement>('[data-menu-actionable]')[index];
    target?.focus({ preventScroll: true });
  };

  useLayoutEffect(() => {
    focusIndex(initial === 'first' ? 0 : actionable.length - 1);
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = () => {
    const nodes = [...(ref.current?.querySelectorAll<HTMLElement>('[data-menu-actionable]') ?? [])];
    return { nodes, index: nodes.indexOf(document.activeElement as HTMLElement) };
  };

  const activate = (entry: Actionable) => {
    onClose('select');
    entry.onSelect();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const { nodes, index } = current();
    const count = nodes.length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusIndex(count ? (index + 1) % count : 0);
        return;
      case 'ArrowUp':
        event.preventDefault();
        focusIndex(count ? (index - 1 + count) % count : 0);
        return;
      case 'Home':
        event.preventDefault();
        focusIndex(0);
        return;
      case 'End':
        event.preventDefault();
        focusIndex(count - 1);
        return;
      case 'ArrowRight':
      case 'ArrowLeft':
        if (onSideways) {
          event.preventDefault();
          onSideways(event.key === 'ArrowRight' ? 1 : -1);
        }
        return;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        onClose('escape');
        return;
      case 'Tab':
        onClose('tab');
        return;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const entry = actionable[index];
        if (entry) activate(entry);
        return;
      }
      default: {
        if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
        const now = event.timeStamp || Date.now();
        const state = typeahead.current;
        state.buffer = now - state.at > 500 ? event.key.toLowerCase() : state.buffer + event.key.toLowerCase();
        state.at = now;
        const start = state.buffer.length > 1 ? index : index + 1;
        for (let step = 0; step < count; step++) {
          const candidate = (start + step) % count;
          if (actionable[candidate]?.label.toLowerCase().startsWith(state.buffer)) {
            focusIndex(candidate);
            return;
          }
        }
      }
    }
  };

  let actionableIndex = -1;
  return (
    <div
      ref={ref}
      role="menu"
      tabIndex={-1}
      aria-label={label}
      id={id}
      className={className}
      style={style}
      onKeyDown={onKeyDown}
      data-menu=""
    >
      {items.map((entry) => {
        if (entry.kind === 'separator') return <div key={entry.id} role="separator" data-menu-separator="" />;
        if (entry.kind === 'heading')
          return (
            <div key={entry.id} role="presentation" data-menu-heading="">
              {entry.label}
            </div>
          );
        const enabled = !entry.disabled;
        if (enabled) actionableIndex++;
        return (
          <div key={entry.id} role="none">
            <button
              type="button"
              role={entry.kind === 'checkbox' ? 'menuitemcheckbox' : 'menuitem'}
              aria-checked={entry.kind === 'checkbox' ? entry.checked : undefined}
              aria-disabled={entry.disabled || undefined}
              tabIndex={-1}
              data-menu-item=""
              data-menu-actionable={enabled ? '' : undefined}
              data-index={enabled ? actionableIndex : undefined}
              onClick={() => enabled && activate(entry)}
              onPointerMove={(event) => enabled && event.currentTarget.focus({ preventScroll: true })}
            >
              {entry.kind === 'item' && entry.icon ? <span data-menu-icon="">{entry.icon}</span> : null}
              <span data-menu-label="">{entry.label}</span>
              {entry.kind === 'item' && entry.shortcut ? (
                <kbd data-menu-shortcut="" aria-hidden="true">
                  {entry.shortcut}
                </kbd>
              ) : null}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export interface MenubarMenu {
  readonly id: string;
  readonly label: string;
  /** Visual content of the trigger (e.g. a logo); `label` remains the accessible name. */
  readonly trigger?: ReactNode;
  readonly items: readonly MenuEntry[];
}

export interface MenubarProps {
  readonly label: string;
  readonly menus: readonly MenubarMenu[];
  readonly className?: string;
  readonly menuClassName?: string;
}

export function Menubar({ label, menus, className, menuClassName }: MenubarProps) {
  const [open, setOpen] = useState<{ index: number; initial: 'first' | 'last' } | null>(null);
  const [active, setActive] = useState(0);
  const triggers = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const root = useRef<HTMLDivElement>(null);

  const focusTrigger = (index: number) => triggers.current[index]?.focus({ preventScroll: true });
  const wrapIndex = (index: number) => (index + menus.length) % menus.length;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  const openMenu = (index: number, initial: 'first' | 'last') => {
    setActive(index);
    setOpen({ index, initial });
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowLeft': {
        event.preventDefault();
        const next = wrapIndex(index + (event.key === 'ArrowRight' ? 1 : -1));
        setActive(next);
        focusTrigger(next);
        return;
      }
      case 'Home':
      case 'End': {
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : menus.length - 1;
        setActive(next);
        focusTrigger(next);
        return;
      }
      case 'ArrowDown':
      case 'Enter':
      case ' ':
        event.preventDefault();
        openMenu(index, 'first');
        return;
      case 'ArrowUp':
        event.preventDefault();
        openMenu(index, 'last');
        return;
    }
  };

  const close = (index: number, reason: CloseReason) => {
    setOpen(null);
    if (reason !== 'outside') focusTrigger(index);
  };

  return (
    <div ref={root} role="menubar" aria-label={label} className={className} data-menubar="">
      {menus.map((menu, index) => {
        const isOpen = open?.index === index;
        const menuId = `${baseId}-menu-${menu.id}`;
        return (
          <div key={menu.id} role="none" data-menubar-slot="">
            <button
              ref={(node) => {
                triggers.current[index] = node;
              }}
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={isOpen}
              aria-controls={isOpen ? menuId : undefined}
              aria-label={menu.trigger ? menu.label : undefined}
              tabIndex={index === active ? 0 : -1}
              data-menubar-item=""
              data-open={isOpen || undefined}
              onKeyDown={(event) => onTriggerKeyDown(event, index)}
              onClick={() => (isOpen ? setOpen(null) : openMenu(index, 'first'))}
              onPointerEnter={() => open && !isOpen && openMenu(index, 'first')}
              onFocus={() => setActive(index)}
            >
              {menu.trigger ?? menu.label}
            </button>
            {isOpen && (
              <MenuList
                key={`${menu.id}-${open.initial}`}
                id={menuId}
                label={menu.label}
                items={menu.items}
                initial={open.initial}
                className={menuClassName}
                onClose={(reason) => close(index, reason)}
                onSideways={(delta) => openMenu(wrapIndex(index + delta), 'first')}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export interface MenuProps {
  readonly label: string;
  readonly items: readonly MenuEntry[];
  readonly onClose: () => void;
  readonly returnFocusTo?: RefObject<HTMLElement | null>;
  readonly position?: { readonly x: number; readonly y: number };
  readonly className?: string;
}

/** Standalone menu (context menus, "⋯" menus). Closes on outside press; focus returns to the invoker. */
export function Menu({ label, items, onClose, returnFocusTo, position, className }: MenuProps) {
  const wrapper = useRef<HTMLDivElement>(null);
  const close = (reason: CloseReason) => {
    onClose();
    if (reason !== 'outside') returnFocusTo?.current?.focus({ preventScroll: true });
  };
  const onOutsidePress = useEffectEvent((event: PointerEvent) => {
    if (!wrapper.current?.contains(event.target as Node)) close('outside');
  });

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => onOutsidePress(event);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, []);

  return (
    <div
      ref={wrapper}
      data-menu-anchor=""
      style={position ? { position: 'fixed', left: position.x, top: position.y } : undefined}
    >
      <MenuList label={label} items={items} initial="first" onClose={close} className={className} />
    </div>
  );
}
