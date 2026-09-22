/**
 * The Windows shell in jsdom (plans/windows):
 *   WIN-A11Y-01 landmarks + DOM order (main → nav "Taskbar" last → status regions present from mount) ·
 *   WIN-TASK-01 / WIN-TASK-08 the taskbar: real links, one tab stop, Left/Right, names with ", running" /
 *   ", active, press to minimize", the active app `aria-current` · WIN-TASK-05 tray flyouts ·
 *   WIN-START-01 / WIN-START-08 Start: dialog, search combobox, pinned grid, recommended, footer; Esc returns focus ·
 *   WIN-SEARCH-02 / WIN-SEARCH-06 typing in Start morphs to Search in place (the same input keeps focus) with chips ·
 *   WIN-NOTIF-01 the toast region exists from mount · WIN-TV-04 / WIN-TV-05 Task View semantics and the disabled
 *   "New desktop" · WIN-LOCK-01 / WIN-LOCK-03 the lock: cards from data, two steps, no credential field ·
 *   WIN-CTX-02 the desktop menu (View ▸ · Sort by ▸ · Refresh · Switch operating system).
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';
import WindowsShell from '@/components/os/windows/Shell';
import { getPerson, getProjects } from '@/data/selectors';
import { DEFAULT_CAPABILITIES } from '@/lib/kernel/state';
import { focusKeys, type WindowId } from '@/lib/kernel/types';
import { dispatch, flushQueued, getKernel } from '@/stores/kernel-store';

let booted = false;
function boot(w = 1440, h = 900) {
  if (!booted) {
    dispatch({
      type: 'BOOT',
      url: '/windows',
      navType: 'navigate',
      viewport: { w, h, pointer: 'fine' },
      persisted: null,
      capabilities: DEFAULT_CAPABILITIES,
    });
    booted = true;
  } else dispatch({ type: 'VIEWPORT_CHANGED', w, h, pointer: 'fine' });
}

function closeAll() {
  for (const id of Object.keys(getKernel().sessions.windows.windows) as WindowId[]) {
    dispatch({ type: 'CLOSE_WINDOW', id });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
  }
}

const settle = (id: WindowId) =>
  act(() => {
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
  });

function renderShell() {
  return render(
    <>
      <div role="status" aria-live="polite" id="system-status" className="sr-only" />
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
}

beforeEach(() => {
  boot();
  act(() => closeAll());
});

describe('WIN-A11Y-01 landmarks in reading order', () => {
  it('main (h1, desktop, windows in open order) → the taskbar nav last → the status regions', async () => {
    const { container } = renderShell();
    act(() => {
      dispatch({ type: 'OPEN_APP', os: 'windows', role: 'github' });
      dispatch({ type: 'OPEN_APP', os: 'windows', role: 'files' });
    });
    settle('windows:github');
    settle('windows:files');
    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { level: 1 })).toHaveTextContent('Windows 11 — Jaswanth');
    expect(within(main).getByRole('list', { name: 'Desktop' })).toBeInTheDocument();
    const regions = [...container.querySelectorAll('[data-window]')].map((el) => el.getAttribute('data-window'));
    expect(regions).toEqual(['windows:github', 'windows:files']);
    const order = [...container.querySelectorAll('main, nav[aria-label="Taskbar"], [data-toast-region]')].map((el) =>
      el.tagName.toLowerCase(),
    );
    expect(order).toEqual(['main', 'nav', 'section']);
    expect(container.querySelector('[data-toast-region]')).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('menubar')).toBeNull(); // no global menu bar on Windows
    const results = await axe.run(container, {
      runOnly: {
        type: 'rule',
        values: ['landmark-unique', 'aria-allowed-attr', 'list', 'listitem', 'button-name', 'link-name'],
      },
    });
    expect(results.violations).toEqual([]);
  });
});

describe('WIN-TASK-01 · WIN-TASK-08 the taskbar', () => {
  it('real links, one tab stop, Left/Right, state suffixes, the active app is current', async () => {
    const user = userEvent.setup();
    renderShell();
    const taskbar = screen.getByRole('navigation', { name: 'Taskbar' });
    const explorer = within(taskbar).getByRole('link', { name: 'File Explorer' });
    expect(explorer).toHaveAttribute('href', '/windows/explorer');
    expect(within(taskbar).getByRole('link', { name: 'Résumé (PDF)' })).toHaveAttribute('href', '/windows/edge/resume');
    const items = taskbar.querySelectorAll<HTMLElement>('[data-taskbar-list] [data-roving-item]');
    expect([...items].filter((item) => item.tabIndex === 0)).toHaveLength(1);
    const start = within(taskbar).getByRole('button', { name: 'Start' });
    start.focus();
    await user.keyboard('{ArrowRight}');
    expect(within(taskbar).getByRole('button', { name: 'Search' })).toHaveFocus();
    act(() => {
      dispatch({ type: 'OPEN_APP', os: 'windows', role: 'files' });
    });
    settle('windows:files');
    expect(within(taskbar).getByRole('link', { name: 'File Explorer, active, press to minimize' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    act(() => {
      dispatch({ type: 'MINIMIZE', id: 'windows:files' });
    });
    expect(within(taskbar).getByRole('link', { name: 'File Explorer, running, minimized' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('WIN-TASK-05 the tray: Quick Settings and the Notification Center (with the calendar grid) toggle', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: /^Quick Settings/ }));
    const quick = await screen.findByRole('dialog', { name: 'Quick Settings' });
    expect(within(quick).getByRole('button', { name: 'Reduce motion' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(quick).getByRole('slider', { name: 'Volume' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Notification Center/ }));
    const center = await screen.findByRole('dialog', { name: 'Notification Center' });
    expect(within(center).getByRole('grid')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Quick Settings' })).toBeNull());
  });
});

describe('WIN-START-01 · WIN-START-08 · WIN-SEARCH-02 · WIN-SEARCH-06 Start and Search', () => {
  it('Start: a dialog with the search box, a pinned grid of links, recommended, a footer; Esc → Start button', async () => {
    const user = userEvent.setup();
    renderShell();
    const start = screen.getByRole('button', { name: 'Start' });
    await user.click(start);
    const dialog = await screen.findByRole('dialog', { name: 'Start' });
    expect(within(dialog).getByRole('combobox', { name: 'Search' })).toHaveFocus();
    const pinned = within(dialog).getByRole('list', { name: 'Pinned' });
    // Names as assistive tech reads them (the tile art — e.g. the PDF badge — is hidden).
    const names = [
      'File Explorer',
      'Microsoft Edge',
      'GitHub',
      'Outlook',
      'Visual Studio Code',
      'Terminal',
      'Settings',
      'Résumé',
      'Projects',
      'Experience',
      'Contact',
    ];
    const links = within(pinned).getAllByRole('link');
    expect(links).toHaveLength(names.length);
    names.forEach((name, i) => expect(links[i]).toHaveAccessibleName(name));
    expect(within(dialog).getByRole('heading', { name: 'Recommended' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Power' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(start).toHaveFocus());
  });

  it('typing in Start morphs it into Search in place — the same input keeps every keystroke; chips are a radiogroup', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: 'Start' }));
    const input = await screen.findByRole('combobox', { name: 'Search' });
    await user.keyboard('proj');
    const search = await screen.findByRole('dialog', { name: 'Search' });
    expect(within(search).getByRole('combobox', { name: 'Search' })).toBe(input);
    expect(input).toHaveValue('proj');
    expect(input).toHaveFocus();
    expect(within(search).getByRole('radiogroup', { name: 'Filter results' })).toBeInTheDocument();
    await waitFor(() => expect(within(search).getAllByRole('option').length).toBeGreaterThan(0));
    expect(input.getAttribute('aria-activedescendant')).toBeTruthy();
  });
});

describe('WIN-TV-04 · WIN-TV-05 Task View', () => {
  it('a modal dialog; windows as buttons incl. minimized; the disabled New desktop explains itself', async () => {
    const user = userEvent.setup();
    renderShell();
    act(() => {
      dispatch({ type: 'OPEN_APP', os: 'windows', role: 'files' });
      dispatch({ type: 'OPEN_APP', os: 'windows', role: 'github' });
    });
    settle('windows:files');
    settle('windows:github');
    act(() => {
      dispatch({ type: 'MINIMIZE', id: 'windows:files' });
    });
    await user.click(screen.getByRole('button', { name: 'Task View' }));
    const view = await screen.findByRole('dialog', { name: 'Task View' });
    expect(view).toHaveAttribute('aria-modal', 'true');
    expect(within(view).getByRole('button', { name: /^File Explorer — Home, minimized$/ })).toBeInTheDocument();
    expect(within(view).getByRole('button', { name: /^GitHub/ })).toBeInTheDocument();
    const add = within(view).getByRole('button', { name: /New desktop/ });
    expect(add).toHaveAttribute('aria-disabled', 'true');
    expect(add).toHaveAccessibleDescription('One desktop is plenty here');
  });
});

describe('WIN-LOCK-01 · WIN-LOCK-03 the lock screen', () => {
  it('first chooser entry: cards from data; Continue → sign-in card without any credential field → desktop', async () => {
    const user = userEvent.setup();
    act(() => {
      // A chooser arrival that has not seen the lock yet (the kernel records it when the shell shows it).
      dispatch({ type: 'SWITCH_OS', to: null, via: 'switch' });
    });
    const state = getKernel();
    if (state.transition.phase !== 'idle')
      act(() => {
        dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch: state.epoch } });
      });
    act(() => {
      dispatch({ type: 'SWITCH_OS', to: 'windows', via: 'chooser' });
    });
    for (let step = 0; step < 3 && getKernel().transition.phase !== 'idle'; step++)
      act(() => {
        dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch: getKernel().epoch } });
      });
    if (getKernel().sessions.windows.lockSeen) return; // an earlier test already saw it this session
    renderShell();
    const lock = await screen.findByRole('main');
    expect(within(lock).getByRole('heading', { level: 1 })).toHaveTextContent(getPerson().name);
    const cards = within(lock).getByRole('list', { name: 'Notifications' });
    expect(within(cards).getAllByRole('link')[0]).toHaveTextContent('Résumé ready to view');
    expect(within(cards).getAllByRole('link')[1]).toHaveTextContent(`${getProjects().length} projects`);
    await user.click(within(lock).getByRole('button', { name: /Press any key or click to continue/ }));
    const signIn = await screen.findByRole('button', { name: 'Sign in' });
    expect(signIn).toHaveFocus();
    expect(lock.querySelector('input')).toBeNull();
    await user.click(signIn);
    await waitFor(() => expect(screen.getByRole('navigation', { name: 'Taskbar' })).toBeInTheDocument());
    expect(getKernel().sessions.windows.lockSeen).toBe(true);
  });
});

describe('WIN-CTX-02 the desktop context menu', () => {
  it('View ▸ · Sort by ▸ · Refresh · Display settings · Personalize · Switch operating system (+ Show more options)', async () => {
    renderShell();
    const desktop = document.querySelector<HTMLElement>('[data-desktop]')!;
    act(() => {
      desktop.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, button: 2, clientX: 400, clientY: 300 }));
    });
    const menu = await screen.findByRole('menu', { name: 'Desktop' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent?.replace(/Shift\+F10$/, '')),
    ).toEqual([
      'View',
      'Sort by',
      'Refresh',
      'Display settings',
      'Personalize',
      'Switch operating system',
      'Show more options',
    ]);
    act(() => flushQueued());
  });
});
