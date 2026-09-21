/**
 * A11Y-PRIM-04 — FocusScope / inert manager (written before the implementation): modal scopes trap Tab and restore
 * focus to the invoker; the inert manager moves focus out *before* making anything inert — focus is never lost.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { FocusScope, makeInert } from '@/components/primitives/FocusScope';

function Dialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        open
      </button>
      {open && (
        <FocusScope trapped restoreFocus initialFocus>
          <div role="dialog" aria-label="Search" aria-modal="true">
            <input aria-label="query" />
            <button type="button">one</button>
            <button type="button" onClick={() => setOpen(false)}>
              close
            </button>
          </div>
        </FocusScope>
      )}
    </>
  );
}

describe('A11Y-PRIM-04 FocusScope / inert manager', () => {
  it('auto-focuses the first field, traps Tab both ways, restores focus on close', async () => {
    const user = userEvent.setup();
    render(<Dialog />);
    await user.click(screen.getByText('open'));
    expect(screen.getByLabelText('query')).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(screen.getByText('close')).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText('query')).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByText('close')).toHaveFocus();
    await user.click(screen.getByText('close'));
    expect(screen.getByText('open')).toHaveFocus();
  });

  it('moves focus before making a subtree inert (no focus loss)', () => {
    render(
      <>
        <div data-testid="home">
          <a href="/ios/safari">Safari</a>
        </div>
        <section aria-label="Safari" tabIndex={-1} data-focus-key="window:ios:browser">
          window
        </section>
      </>,
    );
    screen.getByText('Safari').focus();
    const release = makeInert(screen.getByTestId('home'), { candidates: ['window:ios:browser'] });
    expect(screen.getByRole('region', { name: 'Safari' })).toHaveFocus();
    expect(screen.getByTestId('home')).toHaveAttribute('inert');
    expect(document.activeElement).not.toBe(document.body);
    release();
    expect(screen.getByTestId('home')).not.toHaveAttribute('inert');
  });
});
