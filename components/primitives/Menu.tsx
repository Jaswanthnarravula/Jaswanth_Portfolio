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
  | { readonly kind: 'heading'; readonly id: string; readonly label: string }
  /**
   * addition (plans/windows/02 system menu "Snap ▸", surfaces/context-menus "View ▸"): a nested menu. Right / Enter /
   * Space (or a 150 ms hover) opens it on its first item; Left or Esc closes it back to its item.
   */
  | {
      readonly kind: 'submenu';
      readonly id: string;
      readonly label: string;
      readonly icon?: ReactNode;
      readonly disabled?: boolean;
      readonly items: readonly MenuEntry[];
    };

/**
 * addition (plans/windows/surfaces/context-menus "command row"): icon buttons across the top of a menu — a labelled
 * `group` of `menuitem`s (the visible tooltip mirrors the name). Left/Right move along the row; Up/Down continue into
 * the items below.
 */
export interface MenuCommand {
  readonly id: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly disabled?: boolean;
  readonly onSelect: () => void;
}

type Actionable = Extract<MenuEntry, { kind: 'item' | 'checkbox' | 'submenu' }> | (MenuCommand & { kind: 'command' });
const isActionable = (entry: MenuEntry): entry is Extract<MenuEntry, { kind: 'item' | 'checkbox' | 'submenu' }> =>
  (entry.kind === 'item' || entry.kind === 'checkbox' || entry.kind === 'submenu') && !entry.disabled;

type CloseReason = 'escape' | 'tab' | 'select' | 'outside';

/** Hover intent before a submenu opens (plans/windows/surfaces/context-menus "Motion"). */
export const SUBMENU_HOVER_MS = 150;

interface MenuListProps {
  readonly items: readonly MenuEntry[];
  readonly label: string;
  readonly id?: string;
  /** Which item takes focus on open; `none` keeps focus where it is (a submenu opened by hover). */
  readonly initial: 'first' | 'last' | 'none';
  readonly onClose: (reason: CloseReason) => void;
  /** Left/Right: move to the neighbouring menu (menubar only). */
  readonly onSideways?: (delta: -1 | 1) => void;
  readonly commands?: readonly MenuCommand[];
  readonly commandsLabel?: string;
  /** A submenu: Left closes it back to its item. */
  readonly nested?: boolean;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}

function MenuList({
  items,
  label,
  id,
  initial,
  onClose,
  onSideways,
  commands = [],
  commandsLabel = 'Commands',
  nested = false,
  className,
  style,
}: MenuListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  const typeahead = useRef({ buffer: '', at: 0 });
  const [sub, setSub] = useState<{ id: string; focus: boolean } | null>(null);
  const hover = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveCommands = commands.filter((command) => !command.disabled);
  const actionable: Actionable[] = [
    ...liveCommands.map((command) => ({ ...command, kind: 'command' as const })),
    ...items.filter(isActionable),
  ];
  const rowLength = liveCommands.length;

  /** This list's own items (never a nested submenu's). */
  const nodes = () => [...(ref.current?.querySelectorAll<HTMLElement>(`[data-menu-of="${listId}"]`) ?? [])];

  const focusIndex = (index: number) => nodes()[index]?.focus({ preventScroll: true });

  useLayoutEffect(() => {
    if (initial !== 'none') focusIndex(initial === 'first' ? 0 : actionable.length - 1);
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (hover.current) clearTimeout(hover.current);
    },
    [],
  );

  const current = () => {
    const list = nodes();
    return { list, index: list.indexOf(document.activeElement as HTMLElement) };
  };

  const openSub = (entryId: string, focus: boolean) => {
    if (hover.current) clearTimeout(hover.current);
    setSub({ id: entryId, focus });
  };

  const activate = (entry: Actionable) => {
    if (entry.kind === 'submenu') {
      openSub(entry.id, true);
      return;
    }
    onClose('select');
    entry.onSelect();
  };

  const closeSub = (entryId: string, reason: CloseReason) => {
    setSub(null);
    if (reason === 'select' || reason === 'tab' || reason === 'outside') onClose(reason);
    else
      ref.current
        ?.querySelector<HTMLElement>(`[data-menu-of="${listId}"][data-menu-sub-for="${entryId}"]`)
        ?.focus({ preventScroll: true });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // The innermost open list handles every key: a submenu's keys never reach its parent menu.
    if (nested || event.key === 'Escape') event.stopPropagation();
    const { list, index } = current();
    const count = list.length;
    const inRow = index >= 0 && index < rowLength;
    const entry = index >= 0 ? actionable[index] : undefined;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusIndex(count ? (inRow ? rowLength % count : (index + 1) % count) : 0);
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
        event.preventDefault();
        if (inRow && index < rowLength - 1) focusIndex(index + 1);
        else if (entry?.kind === 'submenu') openSub(entry.id, true);
        else if (onSideways && !inRow) onSideways(1);
        return;
      case 'ArrowLeft':
        event.preventDefault();
        if (inRow && index > 0) focusIndex(index - 1);
        else if (nested) onClose('escape');
        else if (onSideways && !inRow) onSideways(-1);
        return;
      case 'Escape':
        event.preventDefault();
        onClose('escape');
        return;
      case 'Tab':
        onClose('tab');
        return;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        if (entry) activate(entry);
        return;
      }
      default: {
        if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
        const now = event.timeStamp;
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

  /** Hovering an item focuses it; resting on a submenu item for 150 ms opens it, anywhere else closes it. */
  const onHover = (target: HTMLElement, submenuId: string | null) => {
    target.focus({ preventScroll: true });
    if (hover.current) clearTimeout(hover.current);
    if (submenuId === sub?.id) return;
    hover.current = setTimeout(() => setSub(submenuId ? { id: submenuId, focus: false } : null), SUBMENU_HOVER_MS);
  };

  let actionableIndex = liveCommands.length - 1;
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
      data-menu-submenu={nested ? '' : undefined}
    >
      {commands.length > 0 ? (
        <div role="group" aria-label={commandsLabel} data-menu-commands="">
          {commands.map((command) => (
            <button
              key={command.id}
              type="button"
              role="menuitem"
              aria-label={command.label}
              title={command.label}
              aria-disabled={command.disabled || undefined}
              tabIndex={-1}
              data-menu-command=""
              data-menu-of={command.disabled ? undefined : listId}
              data-menu-actionable={command.disabled ? undefined : ''}
              onClick={() => {
                if (command.disabled) return;
                onClose('select');
                command.onSelect();
              }}
              onPointerMove={(event) => !command.disabled && onHover(event.currentTarget, null)}
            >
              {command.icon}
            </button>
          ))}
        </div>
      ) : null}
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
        if (entry.kind === 'submenu') {
          const open = sub?.id === entry.id;
          return (
            <div key={entry.id} role="none" data-menu-sub-slot="">
              <button
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-disabled={entry.disabled || undefined}
                tabIndex={-1}
                data-menu-item=""
                data-menu-of={enabled ? listId : undefined}
                data-menu-actionable={enabled ? '' : undefined}
                data-menu-sub-for={entry.id}
                data-index={enabled ? actionableIndex : undefined}
                data-open={open || undefined}
                onClick={() => enabled && openSub(entry.id, true)}
                onPointerMove={(event) => enabled && onHover(event.currentTarget, entry.id)}
              >
                {entry.icon ? <span data-menu-icon="">{entry.icon}</span> : null}
                <span data-menu-label="">{entry.label}</span>
                <span data-menu-chevron="" aria-hidden="true" />
              </button>
              {open ? (
                <MenuList
                  key={`${entry.id}-${String(sub?.focus)}`}
                  label={entry.label}
                  items={entry.items}
                  initial={sub?.focus ? 'first' : 'none'}
                  nested
                  className={className}
                  onSideways={onSideways}
                  onClose={(reason) => closeSub(entry.id, reason)}
                />
              ) : null}
            </div>
          );
        }
        return (
          <div key={entry.id} role="none">
            <button
              type="button"
              role={entry.kind === 'checkbox' ? 'menuitemcheckbox' : 'menuitem'}
              aria-checked={entry.kind === 'checkbox' ? entry.checked : undefined}
              aria-disabled={entry.disabled || undefined}
              tabIndex={-1}
              data-menu-item=""
              data-menu-of={enabled ? listId : undefined}
              data-menu-actionable={enabled ? '' : undefined}
              data-index={enabled ? actionableIndex : undefined}
              onClick={() => enabled && activate(entry)}
              onPointerMove={(event) => enabled && onHover(event.currentTarget, null)}
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
  /** addition: an icon command row across the top (Windows context menus). */
  readonly commands?: readonly MenuCommand[];
  readonly commandsLabel?: string;
  /** addition: the element that holds the menu (skins measure it to clamp the menu inside the workspace). */
  readonly anchorRef?: RefObject<HTMLDivElement | null>;
}

/** Standalone menu (context menus, "⋯" menus). Closes on outside press; focus returns to the invoker. */
export function Menu({
  label,
  items,
  onClose,
  returnFocusTo,
  position,
  className,
  commands,
  commandsLabel,
  anchorRef,
}: MenuProps) {
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
      ref={(node) => {
        wrapper.current = node;
        if (anchorRef) anchorRef.current = node;
      }}
      data-menu-anchor=""
      style={position ? { position: 'fixed', left: position.x, top: position.y } : undefined}
    >
      <MenuList
        label={label}
        items={items}
        initial="first"
        onClose={close}
        className={className}
        commands={commands}
        commandsLabel={commandsLabel}
      />
    </div>
  );
}
