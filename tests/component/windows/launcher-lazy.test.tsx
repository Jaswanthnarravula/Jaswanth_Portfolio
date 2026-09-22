/**
 * plans/windows/06 E9 with the on-demand launcher (shared/10 shell budget): Start / Search is its own chunk. Keys typed
 * the moment the panel opens — before that chunk has arrived — land in a placeholder field and reach the real Search
 * box; none is lost. (Its own file: once loaded in a module registry, the launcher never shows the placeholder again.)
 */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import WindowsShell from '@/components/os/windows/Shell';
import { DEFAULT_CAPABILITIES } from '@/lib/kernel/state';
import { focusKeys } from '@/lib/kernel/types';
import { dispatch } from '@/stores/kernel-store';

it('WIN-SEARCH-02 · WIN-START-03 keys typed while Start / Search loads all reach the Search box', async () => {
  act(() => {
    dispatch({
      type: 'BOOT',
      url: '/windows',
      navType: 'navigate',
      viewport: { w: 1440, h: 900, pointer: 'fine' },
      persisted: null,
      capabilities: DEFAULT_CAPABILITIES,
    });
  });
  const user = userEvent.setup();
  render(
    <div className="os-root" data-os="windows">
      <WindowsShell
        os="windows"
        heading={
          <h1 className="sr-only" tabIndex={-1} data-focus-key={focusKeys.osHeading}>
            Windows 11 — Jaswanth
          </h1>
        }
      />
    </div>,
  );
  await user.click(screen.getByRole('button', { name: 'Start' }));
  // Typed at once, into whatever holds focus: the placeholder field until the launcher arrives.
  await user.keyboard('whoami');
  const field = await screen.findByRole('combobox', { name: 'Search' });
  expect(field).toHaveValue('whoami');
  expect(field.closest('[role="dialog"]')).toHaveAccessibleName('Search');
});
