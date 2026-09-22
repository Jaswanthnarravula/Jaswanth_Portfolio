/**
 * Owner-reported (2026-09-22): "clicked Safari twice, it didn't open until I reloaded" — on the dev server. React Strict
 * Mode runs every effect twice in development; the window's unmount cleanup killed the open tween at its first frame
 * (opacity 0) and the re-run skipped the unchanged phase, so the window stayed invisible in `opening` forever.
 * WIN-WM-01 · WIN-MOTION-02: under Strict Mode the open animation still plays to the end and reports PHASE_DONE.
 */
import { act, render, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { WinWindow } from '@/components/os/windows/window/Window';
import { DEFAULT_CAPABILITIES } from '@/lib/kernel/state';
import type { WindowId } from '@/lib/kernel/types';
import { dispatch, getKernel } from '@/stores/kernel-store';

const ID = 'windows:github' as WindowId;

let booted = false;
beforeEach(() => {
  if (!booted) {
    dispatch({
      type: 'BOOT',
      url: '/windows',
      navType: 'navigate',
      viewport: { w: 1440, h: 900, pointer: 'fine' },
      persisted: null,
      capabilities: DEFAULT_CAPABILITIES,
    });
    booted = true;
  }
  for (const id of Object.keys(getKernel().sessions.windows.windows) as WindowId[])
    act(() => {
      dispatch({ type: 'CLOSE_WINDOW', id });
      dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
    });
});

describe('WIN-WM-01 · WIN-MOTION-02 the open animation survives Strict Mode (development)', () => {
  it('opens to phase normal at full opacity, with no transform left behind', async () => {
    act(() => {
      dispatch({ type: 'OPEN_APP', os: 'windows', role: 'github' });
    });
    const { container } = render(
      <StrictMode>
        <main>
          <WinWindow
            id={ID}
            zIndex={100}
            focused
            compact={false}
            touch={false}
            shownInCompact
            dimmed={false}
            body={() => <p>GitHub</p>}
          />
        </main>
      </StrictMode>,
    );
    const section = container.querySelector<HTMLElement>(`[data-window="${ID}"]`)!;
    expect(section).toHaveAttribute('data-phase', 'opening');
    await waitFor(() => expect(getKernel().sessions.windows.windows[ID]?.phase.s).toBe('normal'), { timeout: 3000 });
    await waitFor(() => expect(section).toHaveAttribute('data-phase', 'normal'));
    expect(section.style.opacity).toBe('');
    expect(section.style.transform).toBe('');
  });
});
