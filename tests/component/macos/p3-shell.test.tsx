/**
 * The macOS shell with every P3 surface mounted (jsdom, real kernel + prefs + selectors):
 *   MAC-LOCK-02 (the lock screen on the first chooser entry only; a deep link never) · MAC-LOCK-03 (unlock → focus on the
 *   desktop heading, the welcome banner) · MAC-SPOT-02 (Ctrl+K in the shell; the page behind is inert) · MAC-MENU-02
 *   (the APG menubar follows the focused app) · MAC-MC-04/05 (Alt+Shift+O dialog; empty state) · MAC-WM-04 (resize rule)
 *   · MAC-X-03 (tour placement) · EGG-KONAMI-01.
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import MacShell from '@/components/os/macos/Shell';
import { placeCoach } from '@/components/os/macos/surfaces/Tour';
import { macUi } from '@/components/os/macos/ui';
import { resizeRect } from '@/components/os/macos/window/Window';
import { DEFAULT_CAPABILITIES, DEFAULT_PREFS } from '@/lib/kernel/state';
import { focusKeys, type WindowId } from '@/lib/kernel/types';
import { dispatch, flushQueued, getKernel, kernelStore } from '@/stores/kernel-store';
import { getPrefs, prefsStore } from '@/stores/prefs-store';

let booted = false;
function boot() {
  if (booted) return;
  dispatch({
    type: 'BOOT',
    url: '/macos',
    navType: 'navigate',
    viewport: { w: 1440, h: 900, pointer: 'fine' },
    persisted: null,
    capabilities: DEFAULT_CAPABILITIES,
  });
  booted = true;
}
function closeAll() {
  for (const id of Object.keys(getKernel().sessions.macos.windows) as WindowId[]) {
    dispatch({ type: 'CLOSE_WINDOW', id });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
  }
}
const renderShell = () =>
  render(
    <MacShell
      os="macos"
      heading={
        <h1 className="sr-only" tabIndex={-1} data-focus-key={focusKeys.osHeading}>
          macOS — Jaswanth
        </h1>
      }
    />,
  );

beforeEach(() => {
  boot();
  closeAll();
  prefsStore.setState({ prefs: DEFAULT_PREFS });
  const status = document.getElementById('system-status') ?? document.createElement('div');
  status.id = 'system-status';
  document.body.append(status);
});

describe('lock screen rules', () => {
  it('MAC-LOCK-02: a deep link / refresh shows no lock screen', () => {
    renderShell();
    expect(document.querySelector('[data-lock-screen]')).toBeNull();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('MAC-LOCK-02/03: the first chooser entry locks; unlocking lands focus on the heading and says welcome', async () => {
    const state = getKernel();
    kernelStore.setState({
      kernel: {
        ...state,
        arrival: 'chooser',
        sessions: { ...state.sessions, macos: { ...state.sessions.macos, lockSeen: false } },
      },
    });
    renderShell();
    const enter = screen.getByRole('button', { name: 'Enter macOS' });
    expect(enter).toHaveFocus();
    expect(screen.getAllByRole('main')).toHaveLength(1); // the lock screen is the page's main while it shows
    await userEvent.click(enter);
    await act(async () => {
      flushQueued();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(getKernel().sessions.macos.lockSeen).toBe(true);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'macOS — Jaswanth' })).toHaveFocus());
    await waitFor(() => expect(screen.getByRole('group', { name: 'macOS notification' })).toBeInTheDocument());
    kernelStore.setState({ kernel: { ...getKernel(), arrival: null } });
  });
});

describe('shell surfaces', () => {
  it('MAC-MENU-02: the menubar is an APG menubar whose app menu follows the focused window', async () => {
    renderShell();
    // The bar re-mounts when the focused app changes (its menus are the app's): query it fresh each time.
    const bar = () => screen.getByRole('menubar', { name: 'Menu bar' });
    expect(within(bar()).getByRole('menuitem', { name: 'Finder' })).toBeInTheDocument();
    act(() => {
      dispatch({ type: 'OPEN_APP', os: 'macos', role: 'github' });
      dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id: 'macos:github' } });
    });
    await waitFor(() => expect(within(bar()).getByRole('menuitem', { name: 'GitHub' })).toBeInTheDocument());
    await userEvent.click(within(bar()).getByRole('menuitem', { name: 'GitHub' }));
    expect(screen.getByRole('menu', { name: 'GitHub' })).toBeInTheDocument();
    await waitFor(() => expect(macUi.getState().overlay).toBe('menu'));
  });

  it('MAC-SPOT-02: Ctrl+K opens Spotlight and makes the page behind inert', async () => {
    renderShell();
    await userEvent.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('dialog', { name: 'Spotlight Search' })).toBeInTheDocument();
    expect(document.querySelector('main')).toHaveAttribute('inert');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.querySelector('main')).not.toHaveAttribute('inert'));
  });

  it('MAC-MC-04/05: Alt+Shift+O opens Mission Control; no windows gives shortcuts', async () => {
    renderShell();
    await userEvent.keyboard('{Alt>}{Shift>}o{/Shift}{/Alt}');
    const overview = screen.getByRole('dialog', { name: 'Mission Control' });
    expect(within(overview).getByText('No open windows')).toBeInTheDocument();
    expect(within(overview).getByRole('button', { name: 'Open Finder' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Mission Control' })).toBeNull());
  });

  it('EGG-KONAMI-01: the Konami code on the desktop counts the egg once and shows the banner', async () => {
    renderShell();
    await userEvent.keyboard(
      '{ArrowUp}{ArrowUp}{ArrowDown}{ArrowDown}{ArrowLeft}{ArrowRight}{ArrowLeft}{ArrowRight}ba',
    );
    await act(async () => {
      flushQueued();
    });
    expect(getPrefs().eggsFound).toContain('EGG-KONAMI-01');
    expect(macUi.getState().center[0]?.title).toBe('Cheat code accepted');
  });
});

describe('pure helpers', () => {
  const space = { x: 0, y: 24, w: 1440, h: 800 };
  const min = { w: 560, h: 360 };
  it('MAC-WM-04: each zone grows from its edges, never below minPx, never outside the workspace', () => {
    const start = { x: 200, y: 200, w: 700, h: 500 };
    expect(resizeRect(start, 'se', 80, 40, min, space)).toEqual({ x: 200, y: 200, w: 780, h: 540 });
    expect(resizeRect(start, 'nw', -50, -30, min, space)).toEqual({ x: 150, y: 170, w: 750, h: 530 });
    expect(resizeRect(start, 'w', 500, 0, min, space)).toEqual({ x: 340, y: 200, w: 560, h: 500 });
    expect(resizeRect(start, 'n', 0, -900, min, space).y).toBe(24);
    expect(resizeRect(start, 'e', 5000, 0, min, space).w).toBe(1240);
  });

  it('MAC-X-03: the coach card sits above a low target (the Dock), below a high one, inside the viewport', () => {
    const viewport = { w: 1440, h: 900 };
    const dock = placeCoach({ left: 600, top: 830, width: 240, height: 60 }, { w: 300, h: 120 }, viewport);
    expect(dock.y + 120).toBeLessThanOrEqual(830);
    const top = placeCoach({ left: 1380, top: 2, width: 40, height: 20 }, { w: 300, h: 120 }, viewport);
    expect(top.y).toBeGreaterThan(22);
    expect(top.x + 300).toBeLessThanOrEqual(1440 - 8);
    expect(placeCoach(null, { w: 300, h: 120 }, viewport)).toEqual({ x: 570, y: 270 });
  });
});
