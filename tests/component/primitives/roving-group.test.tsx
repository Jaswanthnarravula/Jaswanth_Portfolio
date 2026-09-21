/**
 * A11Y-PRIM-01 — RovingGroup (written before the implementation).
 * IconGrid: single tab stop, 2-D arrows (visual columns measured at keypress), Home/End, type-ahead, Enter opens.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RovingGroup } from '@/components/primitives/RovingGroup';

const APPS = ['Safari', 'GitHub', 'Files', 'Notes', 'Mail', 'Messages', 'Settings'];

/** jsdom has no layout: give every item a grid position (3 columns). */
function layoutAsGrid(columns: number) {
  const items = [...document.querySelectorAll<HTMLElement>('[data-roving-item]')];
  items.forEach((item, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    item.getBoundingClientRect = () =>
      ({
        x: col * 100,
        y: row * 100,
        left: col * 100,
        top: row * 100,
        width: 80,
        height: 80,
        right: col * 100 + 80,
        bottom: row * 100 + 80,
        toJSON: () => ({}),
      }) as DOMRect;
  });
}

function Grid({ onOpen = () => {} }: { onOpen?: (name: string) => void }) {
  return (
    <>
      <button type="button">before</button>
      <RovingGroup as="ul" orientation="grid" aria-label="Apps">
        {APPS.map((name) => (
          <li key={name}>
            <a
              href={`/ios/${name.toLowerCase()}`}
              data-roving-item
              onClick={(event) => {
                event.preventDefault();
                onOpen(name);
              }}
            >
              {name}
            </a>
          </li>
        ))}
      </RovingGroup>
      <button type="button">after</button>
    </>
  );
}

describe('A11Y-PRIM-01 RovingGroup', () => {
  it('is a single tab stop', async () => {
    const user = userEvent.setup();
    render(<Grid />);
    await user.tab();
    expect(screen.getByText('before')).toHaveFocus();
    await user.tab();
    expect(screen.getByText('Safari')).toHaveFocus();
    await user.tab();
    expect(screen.getByText('after')).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByText('Safari')).toHaveFocus();
  });

  it('moves in 2-D by visual columns, measured at keypress', async () => {
    const user = userEvent.setup();
    render(<Grid />);
    layoutAsGrid(3);
    screen.getByText('Safari').focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('GitHub')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByText('Mail')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByText('Settings')).toHaveFocus(); // shorter last row: nearest column
    await user.keyboard('{ArrowUp}');
    expect(screen.getByText('Notes')).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByText('Files')).toHaveFocus();
    // Reflow to 4 columns: the same key now follows the new layout.
    layoutAsGrid(4);
    await user.keyboard('{ArrowDown}');
    expect(screen.getByText('Settings')).toHaveFocus();
  });

  it('keeps exactly one item in the tab order after moving', async () => {
    const user = userEvent.setup();
    render(<Grid />);
    layoutAsGrid(3);
    screen.getByText('Safari').focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    const tabbable = [...document.querySelectorAll('[data-roving-item]')].filter(
      (item) => item.getAttribute('tabindex') === '0',
    );
    expect(tabbable.map((item) => item.textContent)).toEqual(['Files']);
  });

  it('Home / End jump to the first and last items', async () => {
    const user = userEvent.setup();
    render(<Grid />);
    layoutAsGrid(3);
    screen.getByText('Mail').focus();
    await user.keyboard('{End}');
    expect(screen.getByText('Settings')).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByText('Safari')).toHaveFocus();
  });

  it('type-ahead focuses the next item starting with the typed text', async () => {
    const user = userEvent.setup();
    render(<Grid />);
    screen.getByText('Safari').focus();
    await user.keyboard('m');
    expect(screen.getByText('Mail')).toHaveFocus();
    await user.keyboard('e');
    expect(screen.getByText('Messages')).toHaveFocus();
  });

  it('Enter activates the focused item (keyboard click opens)', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<Grid onOpen={onOpen} />);
    layoutAsGrid(3);
    screen.getByText('Safari').focus();
    await user.keyboard('{ArrowRight}{Enter}');
    expect(onOpen).toHaveBeenCalledWith('GitHub');
  });

  it('1-D horizontal groups ignore Up/Down and wrap only when asked', async () => {
    const user = userEvent.setup();
    render(
      <RovingGroup as="div" orientation="horizontal" wrap aria-label="Dock">
        {['A', 'B', 'C'].map((name) => (
          <button key={name} type="button" data-roving-item>
            {name}
          </button>
        ))}
      </RovingGroup>,
    );
    screen.getByText('C').focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByText('C')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('A')).toHaveFocus();
  });
});
