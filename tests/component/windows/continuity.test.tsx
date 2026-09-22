/**
 * CONT-A11Y-01 on Windows (shared/16; plans/windows/surfaces/notification-center `WIN-NOTIF-02`): the continuity offer
 * from another OS is a toast in the polite `role="status"` region that exists before it; it is announced once, focus
 * stays where the visitor had it, and nothing opens by itself (`CONT-NEVER-01`); the toast's own button accepts it.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import WindowsShell from '@/components/os/windows/Shell';
import { DEFAULT_CAPABILITIES } from '@/lib/kernel/state';
import { focusKeys } from '@/lib/kernel/types';
import { dispatch, getKernel } from '@/stores/kernel-store';

const settleOs = () => {
  for (let step = 0; step < 4 && getKernel().transition.phase !== 'idle'; step++)
    act(() => {
      dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch: getKernel().epoch } });
    });
};

beforeAll(() => {
  act(() => {
    dispatch({
      type: 'BOOT',
      url: '/macos',
      navType: 'navigate',
      viewport: { w: 1440, h: 900, pointer: 'fine' },
      persisted: null,
      capabilities: DEFAULT_CAPABILITIES,
    });
    // A project seen in macOS's GitHub is what continuity captures.
    dispatch({ type: 'OPEN_APP', os: 'macos', role: 'github' });
  });
  expect(getKernel().continuity?.fromOs).toBe('macos');
  // Switch straight to Windows (not through the chooser, so no lock screen: the offer is a toast).
  act(() => {
    dispatch({ type: 'SWITCH_OS', to: 'windows', via: 'switch' });
  });
  settleOs();
  expect(getKernel().activeOs).toBe('windows');
});

describe('CONT-A11Y-01 · CONT-NEVER-01 the continuity offer on Windows', () => {
  it('lands once in the pre-existing polite status region, keeps focus where it was, and opens nothing', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <>
        <button type="button">Somewhere the visitor was</button>
        <div className="os-root" data-os="windows">
          <WindowsShell
            os="windows"
            heading={
              <h1 className="sr-only" tabIndex={-1} data-focus-key={focusKeys.osHeading}>
                Windows 11 — Jaswanth
              </h1>
            }
          />
        </div>
      </>,
    );
    const here = screen.getByRole('button', { name: 'Somewhere the visitor was' });
    here.focus();
    const region = container.querySelector<HTMLElement>('[data-toast-region]')!;
    expect(region).toHaveAttribute('role', 'status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    const toast = await within(region).findByText(/Continue from macOS/);
    expect(within(region).getAllByText(/Continue from macOS/)).toHaveLength(1);
    expect(here).toHaveFocus();
    expect(Object.keys(getKernel().sessions.windows.windows)).toEqual([]);
    // The visitor accepts with the toast's own button: GitHub opens on Windows.
    const card = toast.closest<HTMLElement>('[data-toast]')!;
    await user.click(within(card).getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(getKernel().sessions.windows.windows['windows:github']).toBeDefined());
    expect(getKernel().continuity).toBeNull();
  });
});
