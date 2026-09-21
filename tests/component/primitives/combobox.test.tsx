/**
 * A11Y-PRIM-03 — Combobox + Listbox (written before the implementation): `aria-activedescendant`, grouped options,
 * list autocomplete only, debounced polite result count, Esc clears then closes, options are real clickable elements.
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Combobox, type ComboboxGroup } from '@/components/primitives/Combobox';

const ALL: ComboboxGroup[] = [
  {
    id: 'apps',
    label: 'Applications',
    options: [
      { id: 'finder', label: 'Finder' },
      { id: 'safari', label: 'Safari' },
    ],
  },
  {
    id: 'content',
    label: 'Portfolio',
    options: [
      { id: 'resume', label: 'Résumé' },
      { id: 'rocket', label: 'Rocket' },
    ],
  },
];

function Search({
  onSelect = () => {},
  onClose = () => {},
}: {
  onSelect?: (id: string) => void;
  onClose?: () => void;
}) {
  const [query, setQuery] = useState('');
  const groups = query
    ? ALL.map((group) => ({
        ...group,
        options: group.options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase())),
      })).filter((group) => group.options.length)
    : ALL;
  return (
    <Combobox label="Search" value={query} onChange={setQuery} groups={groups} onSelect={onSelect} onClose={onClose} />
  );
}

describe('A11Y-PRIM-03 Combobox / Listbox', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('exposes combobox + grouped listbox semantics', () => {
    render(<Search />);
    const input = screen.getByRole('combobox', { name: 'Search' });
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox');
    expect(input).toHaveAttribute('aria-controls', listbox.id);
    expect(
      screen
        .getAllByRole('group')
        .map(
          (group) =>
            group.getAttribute('aria-labelledby') &&
            document.getElementById(group.getAttribute('aria-labelledby')!)?.textContent,
        ),
    ).toEqual(['Applications', 'Portfolio']);
    expect(screen.getAllByRole('option')).toHaveLength(4);
  });

  it('arrows move aria-activedescendant (focus stays in the input)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Search />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Finder' }).id);
    await user.keyboard('{ArrowDown}{ArrowDown}');
    const resume = screen.getByRole('option', { name: 'Résumé' });
    expect(input).toHaveAttribute('aria-activedescendant', resume.id);
    expect(resume).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Rocket' }).id);
  });

  it('Enter selects the active option; options are clickable', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Search onSelect={onSelect} />);
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenLastCalledWith('safari');
    await user.click(screen.getByRole('option', { name: 'Rocket' }));
    expect(onSelect).toHaveBeenLastCalledWith('rocket');
  });

  it('announces a debounced result count in a polite status', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Search />);
    const status = screen.getByRole('status');
    await user.click(screen.getByRole('combobox'));
    await user.keyboard('r');
    await user.keyboard('o');
    expect(status).toHaveTextContent(/^$/);
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(status).toHaveTextContent('1 result');
    await user.keyboard('x');
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(status).toHaveTextContent('No results');
  });

  it('Esc clears first, then closes', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Search onClose={onClose} />);
    const input = screen.getByRole('combobox');
    await user.click(input);
    await user.keyboard('saf');
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
    expect(onClose).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
