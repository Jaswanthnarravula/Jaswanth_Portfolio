/**
 * A11Y-PRIM-02 — Menu / Menubar (written before the implementation). WAI-ARIA APG menubar + menu:
 * Left/Right between menus, Down opens, Up opens at the end, type-ahead, Esc closes to the invoker, Tab leaves.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Menu, Menubar, type MenuEntry } from '@/components/primitives/Menu';

const onSelect = vi.fn();
const fileMenu: MenuEntry[] = [
  { kind: 'item', id: 'new', label: 'New Window', shortcut: '⌘N', onSelect: () => onSelect('new') },
  { kind: 'item', id: 'open', label: 'Open…', onSelect: () => onSelect('open') },
  { kind: 'separator', id: 's1' },
  { kind: 'item', id: 'close', label: 'Close Window', disabled: true, onSelect: () => onSelect('close') },
  { kind: 'checkbox', id: 'hidden', label: 'Show Hidden Files', checked: false, onSelect: () => onSelect('hidden') },
];
const menus = [
  { id: 'file', label: 'File', items: fileMenu },
  {
    id: 'edit',
    label: 'Edit',
    items: [
      { kind: 'item' as const, id: 'copy', label: 'Copy', onSelect: () => onSelect('copy') },
      { kind: 'item' as const, id: 'paste', label: 'Paste', onSelect: () => onSelect('paste') },
    ],
  },
  {
    id: 'view',
    label: 'View',
    items: [{ kind: 'item' as const, id: 'icons', label: 'as Icons', onSelect: () => onSelect('icons') }],
  },
];

describe('A11Y-PRIM-02 Menubar', () => {
  it('renders APG roles and a single tab stop', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Menubar label="Application menus" menus={menus} />
        <button type="button">after</button>
      </>,
    );
    expect(screen.getByRole('menubar', { name: 'Application menus' })).toBeInTheDocument();
    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual(['File', 'Edit', 'View']);
    expect(items[0]).toHaveAttribute('aria-haspopup', 'menu');
    expect(items[0]).toHaveAttribute('aria-expanded', 'false');
    await user.tab();
    expect(items[0]).toHaveFocus();
    await user.tab();
    expect(screen.getByText('after')).toHaveFocus();
  });

  it('Left/Right move between menus and wrap', async () => {
    const user = userEvent.setup();
    render(<Menubar label="Menus" menus={menus} />);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('menuitem', { name: 'View' })).toHaveFocus();
  });

  it('Down opens the menu on its first item; Up opens on the last enabled item', async () => {
    const user = userEvent.setup();
    render(<Menubar label="Menus" menus={menus} />);
    await user.tab();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menu', { name: 'File' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /New Window/ })).toHaveFocus();
    expect(screen.getByRole('menuitem', { name: 'File' })).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Show Hidden Files' })).toHaveFocus();
  });

  it('Up/Down move within the menu, skipping separators and disabled items; Home/End', async () => {
    const user = userEvent.setup();
    render(<Menubar label="Menus" menus={menus} />);
    await user.tab();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Open…' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Show Hidden Files' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: /New Window/ })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Show Hidden Files' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: /New Window/ })).toHaveFocus();
    expect(screen.getByRole('menuitem', { name: 'Close Window' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('Right/Left inside an open menu move to the neighbouring menu, open', async () => {
    const user = userEvent.setup();
    render(<Menubar label="Menus" menus={menus} />);
    await user.tab();
    await user.keyboard('{ArrowDown}{ArrowRight}');
    expect(screen.getByRole('menu', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Copy' })).toHaveFocus();
    expect(screen.queryByRole('menu', { name: 'File' })).not.toBeInTheDocument();
  });

  it('Esc closes and restores focus to the invoker', async () => {
    const user = userEvent.setup();
    render(<Menubar label="Menus" menus={menus} />);
    await user.tab();
    await user.keyboard('{ArrowRight}{Enter}');
    expect(screen.getByRole('menuitem', { name: 'Copy' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus();
  });

  it('type-ahead and activation', async () => {
    onSelect.mockClear();
    const user = userEvent.setup();
    render(<Menubar label="Menus" menus={menus} />);
    await user.tab();
    await user.keyboard('{ArrowDown}o');
    expect(screen.getByRole('menuitem', { name: 'Open…' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith('open');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'File' })).toHaveFocus();
  });

  it('Tab closes the menu and moves on', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Menubar label="Menus" menus={menus} />
        <button type="button">after</button>
      </>,
    );
    await user.tab();
    await user.keyboard('{ArrowDown}');
    await user.tab();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByText('after')).toHaveFocus();
  });
});

describe('A11Y-PRIM-02 Menu (context menu)', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    const invoker = useRef<HTMLButtonElement>(null);
    return (
      <>
        <button ref={invoker} type="button" onClick={() => setOpen(true)}>
          Item
        </button>
        {open && (
          <Menu
            label="Item actions"
            items={fileMenu}
            onClose={() => setOpen(false)}
            returnFocusTo={invoker}
            position={{ x: 10, y: 10 }}
          />
        )}
      </>
    );
  }
  it('focuses the first item; Esc returns focus to the invoker', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('Item'));
    expect(screen.getByRole('menu', { name: 'Item actions' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /New Window/ })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByText('Item')).toHaveFocus();
  });
});
