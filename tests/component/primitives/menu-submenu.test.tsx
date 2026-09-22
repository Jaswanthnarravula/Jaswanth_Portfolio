/**
 * A11Y-PRIM-02 additions for Windows (plans/windows/surfaces/context-menus `WIN-CTX-01`, `WIN-CTX-05`; plans/windows/02
 * system menu "Snap ▸"): submenus open with Right / Enter / a 150 ms hover and close with Left / Esc back to their item;
 * the command row is a labelled `group` of named `menuitem` icon buttons that Left/Right walk and Down leaves.
 * Plus the Combobox additions the Start → Search morph needs (a slot before the list, the active-option callback, an
 * input key hook).
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Combobox } from '@/components/primitives/Combobox';
import { Menu, SUBMENU_HOVER_MS, type MenuCommand, type MenuEntry } from '@/components/primitives/Menu';

function Harness({ items, commands }: { items: readonly MenuEntry[]; commands?: readonly MenuCommand[] }) {
  const [open, setOpen] = useState(false);
  const invoker = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={invoker} type="button" onClick={() => setOpen(true)}>
        Desktop
      </button>
      {open ? (
        <Menu
          label="Desktop"
          items={items}
          commands={commands}
          commandsLabel="Quick actions"
          onClose={() => setOpen(false)}
          returnFocusTo={invoker}
          position={{ x: 10, y: 10 }}
        />
      ) : null}
    </>
  );
}

const picked = vi.fn();
const items: MenuEntry[] = [
  {
    kind: 'submenu',
    id: 'view',
    label: 'View',
    items: [
      { kind: 'item', id: 'large', label: 'Large icons', onSelect: () => picked('large') },
      { kind: 'item', id: 'small', label: 'Small icons', onSelect: () => picked('small') },
    ],
  },
  { kind: 'item', id: 'refresh', label: 'Refresh', onSelect: () => picked('refresh') },
];
const commands: MenuCommand[] = [
  { id: 'copy', label: 'Copy link', icon: <span>⧉</span>, onSelect: () => picked('copy') },
  { id: 'share', label: 'Share', icon: <span>↗</span>, onSelect: () => picked('share') },
  { id: 'download', label: 'Download', icon: <span>↓</span>, disabled: true, onSelect: () => picked('download') },
];

describe('A11Y-PRIM-02 · WIN-CTX-05 submenus', () => {
  it('Right opens on the first item; Left and Esc close back to the parent item; activation closes everything', async () => {
    picked.mockClear();
    const user = userEvent.setup();
    render(<Harness items={items} />);
    await user.click(screen.getByText('Desktop'));
    const view = screen.getByRole('menuitem', { name: 'View' });
    expect(view).toHaveFocus();
    expect(view).toHaveAttribute('aria-haspopup', 'menu');
    expect(view).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('menu', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Large icons' })).toHaveFocus();
    expect(view).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Small icons' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.queryByRole('menu', { name: 'View' })).not.toBeInTheDocument();
    expect(view).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('menuitem', { name: 'Large icons' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(view).toHaveFocus();
    expect(screen.getByRole('menu', { name: 'Desktop' })).toBeInTheDocument();
    await user.keyboard('{ArrowRight}{ArrowDown}{Enter}');
    expect(picked).toHaveBeenCalledWith('small');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByText('Desktop')).toHaveFocus();
  });

  it('parent Up/Down never land inside an open submenu', async () => {
    const user = userEvent.setup();
    render(<Harness items={items} />);
    await user.click(screen.getByText('Desktop'));
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Refresh' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'View' })).toHaveFocus();
  });

  it(`hovering a submenu item for ${SUBMENU_HOVER_MS} ms opens it without moving focus into it`, () => {
    vi.useFakeTimers();
    try {
      render(<Harness items={items} />);
      act(() => screen.getByText('Desktop').click());
      const view = screen.getByRole('menuitem', { name: 'View' });
      act(() => {
        view.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
      });
      expect(screen.queryByRole('menu', { name: 'View' })).not.toBeInTheDocument();
      act(() => vi.advanceTimersByTime(SUBMENU_HOVER_MS));
      expect(screen.getByRole('menu', { name: 'View' })).toBeInTheDocument();
      expect(view).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('WIN-CTX-01 · WIN-CTX-05 the command row', () => {
  it('a labelled group of named icon menuitems first; Left/Right walk it; disabled commands are skipped; Down leaves', async () => {
    picked.mockClear();
    const user = userEvent.setup();
    render(<Harness items={items} commands={commands} />);
    await user.click(screen.getByText('Desktop'));
    const row = screen.getByRole('group', { name: 'Quick actions' });
    expect(row).toBeInTheDocument();
    const copy = screen.getByRole('menuitem', { name: 'Copy link' });
    expect(copy).toHaveFocus();
    expect(copy).toHaveAttribute('title', 'Copy link');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('menuitem', { name: 'Share' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('menuitem', { name: 'Share' })).toHaveFocus(); // Download is disabled
    await user.keyboard('{ArrowLeft}');
    expect(copy).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'View' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Share' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(picked).toHaveBeenCalledWith('share');
  });
});

describe('A11Y-PRIM-03 Combobox additions for the Windows Search flyout', () => {
  it('renders the slot before the list, reports the active option, and lets a key hook pre-empt the built-ins', async () => {
    const user = userEvent.setup();
    const active = vi.fn();
    const hook = vi.fn((event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowRight') event.preventDefault();
    });
    render(
      <Combobox
        label="Search"
        value="p"
        onChange={() => undefined}
        onSelect={() => undefined}
        onClose={() => undefined}
        groups={[
          {
            id: 'g',
            label: 'Results',
            options: [
              { id: 'a', label: 'Alpha' },
              { id: 'b', label: 'Beta' },
            ],
          },
        ]}
        beforeList={<div role="radiogroup" aria-label="Filter results" />}
        onActiveChange={active}
        onInputKeyDown={hook}
        inputId="win-search-input"
      />,
    );
    const input = screen.getByRole('combobox', { name: 'Search' });
    expect(input).toHaveAttribute('id', 'win-search-input');
    const chips = screen.getByRole('radiogroup', { name: 'Filter results' });
    expect(chips.compareDocumentPosition(screen.getByRole('listbox')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(active).toHaveBeenLastCalledWith('a');
    input.focus();
    await user.keyboard('{ArrowDown}');
    expect(active).toHaveBeenLastCalledWith('b');
    await user.keyboard('{ArrowRight}');
    expect(hook).toHaveBeenCalled();
  });
});
