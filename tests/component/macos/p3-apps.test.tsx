/**
 * macOS P3 apps in jsdom, against the real kernel, prefs and selectors:
 *   MAC-SET-01 (panes + search highlights a control) · MAC-SET-02 (accessibility controls apply at once and persist) ·
 *   MAC-SET-03 (Dock magnification / size prefs) · MAC-SET-04 (Privacy + Legal reachable) · MAC-SET-05 (Switch OS) ·
 *   MAC-SET-07 (switches, radio swatches, headings; axe clean) ·
 *   MAC-MAIL-01 (inbox from data) · MAC-MAIL-02 (compose sheet, draft in the window) · MAC-MAIL-03 (encoded mailto,
 *   long body truncated + copied, confirmation) · MAC-MAIL-04 (copy address + fallback field) · MAC-MAIL-06 (form
 *   semantics; Ctrl+Enter sends, Enter does not) ·
 *   MAC-TERM-01 (zsh prompt, live cols × rows title) · MAC-TERM-03 (open → the owning app) · MAC-TERM-05 (history
 *   recorded in the macOS session) · MAC-TERM-06 (the shared a11y contract inside the app) · second tab.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const handedOff: string[] = [];
vi.mock('@/components/os/macos/hand-off', () => ({
  openMailto: (url: string) => handedOff.push(url),
  openPlain: () => handedOff.push('/plain'),
}));

import { MAILTO_BODY_LIMIT } from '@/components/content';
import Mail, { resetMailSession } from '@/components/os/macos/apps/Mail';
import Settings, { searchSettings } from '@/components/os/macos/apps/Settings';
import Terminal from '@/components/os/macos/apps/Terminal';
import { emitAppCommand } from '@/components/os/macos/commands';
import { appStateStore, macUi, resetMacUi } from '@/components/os/macos/ui';
import { getContact, getPerson } from '@/data/selectors';
import type { AppRole } from '@/lib/kernel/ids';
import { DEFAULT_CAPABILITIES, DEFAULT_PREFS } from '@/lib/kernel/state';
import { windowId, type WindowInstance } from '@/lib/kernel/types';
import { dispatch, flushQueued, getKernel } from '@/stores/kernel-store';
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

function openWindow(role: AppRole): WindowInstance {
  dispatch({ type: 'OPEN_APP', os: 'macos', role });
  const id = windowId('macos', role);
  dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
  return getKernel().sessions.macos.windows[id]!;
}

function closeAll() {
  for (const id of Object.keys(getKernel().sessions.macos.windows) as ReturnType<typeof windowId>[]) {
    dispatch({ type: 'CLOSE_WINDOW', id });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
  }
}

const flush = () =>
  act(() => {
    flushQueued();
  });

async function noAxeViolations(container: HTMLElement) {
  const results = await axe.run(container, { rules: { region: { enabled: false } } });
  expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes[0]?.html}`)).toEqual([]);
}

beforeEach(() => {
  boot();
  closeAll();
  resetMacUi();
  appStateStore.setState({}, true);
  prefsStore.setState({ prefs: DEFAULT_PREFS });
  handedOff.length = 0;
});
afterEach(() => {
  flushQueued();
});

describe('System Settings', () => {
  const renderSettings = (compact = false) => {
    const win = openWindow('settings');
    return render(<Settings window={win} titleId="mac-title-settings" focused compact={compact} />);
  };

  it('MAC-SET-01/07: a nav list of panes, a labelled pane region with headings, axe clean', async () => {
    const { container } = renderSettings();
    const nav = screen.getByRole('navigation', { name: 'Settings' });
    expect(
      within(nav)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Appearance', 'Accessibility', 'Sound', 'Desktop & Dock', 'Keyboard', 'Privacy', 'General']);
    expect(screen.getByRole('region', { name: 'System Settings — Appearance' })).toBeInTheDocument();
    const swatches = screen.getByRole('radiogroup', { name: 'Accent colour' });
    expect(
      within(swatches)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('name')),
    ).toHaveLength(6);
    expect(within(swatches).getByRole('radio', { name: 'Purple' })).toBeInTheDocument();
    await noAxeViolations(container);
  });

  it('MAC-SET-01: search filters the panes and highlights the matching control', async () => {
    expect(searchSettings('contrast')).toEqual({ panes: ['accessibility'], controls: ['contrast'] });
    expect(searchSettings('resume').panes).toEqual(['general']);
    const { container } = renderSettings();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search settings' }), 'contrast');
    await flush();
    const nav = screen.getByRole('navigation', { name: 'Settings' });
    expect(
      within(nav)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Accessibility']);
    expect(container.querySelector('[data-control="contrast"]')).toHaveAttribute('data-match');
    expect(screen.getByRole('region', { name: 'System Settings — Accessibility' })).toBeInTheDocument();
  });

  it('MAC-SET-02: Reduce motion, Increase contrast and Larger text apply at once and persist in prefs', async () => {
    renderSettings();
    await userEvent.click(screen.getByRole('button', { name: 'Accessibility' }));
    const motion = screen.getByRole('switch', { name: 'Reduce motion' });
    expect(motion).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(motion);
    await flush();
    expect(getPrefs().motion).toBe('reduced');
    expect(screen.getByRole('switch', { name: 'Reduce motion' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('switch', { name: 'Increase contrast' }));
    await flush();
    expect(getPrefs().contrast).toBe('more');
    // Increase contrast forces solid surfaces: Reduce transparency shows on.
    expect(screen.getByRole('switch', { name: 'Reduce transparency' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: '130 %' }));
    await flush();
    expect(getPrefs().textScale).toBe(1.3);
    await userEvent.click(screen.getByRole('switch', { name: 'Single-key shortcuts' }));
    await flush();
    expect(getPrefs().singleKeyShortcuts).toBe(false);
  });

  it('MAC-SET-03: Dock magnification and size; theme and accent', async () => {
    renderSettings();
    await userEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Appearance' })).getByRole('radio', { name: 'Dark' }),
    );
    await userEvent.click(screen.getByRole('radio', { name: 'Green' }));
    await flush();
    expect(getPrefs()).toMatchObject({ theme: 'dark', accent: 'green' });
    await userEvent.click(screen.getByRole('button', { name: 'Desktop & Dock' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Magnification' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Large' }));
    await flush();
    expect(getPrefs().dock).toEqual({ magnification: false, size: 'large' });
    const minimize = screen.getByRole('combobox', { name: 'Minimize windows using' });
    expect(within(minimize).getByRole('option', { name: 'Genie effect (not available)' })).toBeDisabled();
  });

  it('MAC-SET-04: Privacy states what is counted; General shows About facts, eggs n / N and the legal notice', async () => {
    renderSettings();
    await userEvent.click(screen.getByRole('button', { name: 'Privacy' }));
    expect(screen.getByRole('heading', { name: 'Privacy' })).toBeInTheDocument();
    expect(screen.getAllByText(/no cookies/i).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'General' }));
    expect(screen.getByText(getPerson().name)).toBeInTheDocument();
    expect(screen.getByText('Easter eggs found')).toBeInTheDocument();
    expect(screen.getByText(/^0 \/ \d+$/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Legal & credits' })).toBeInTheDocument();
  });

  it('MAC-SET-05: Switch Operating System lists the visible OSes and Back to chooser', async () => {
    renderSettings();
    await userEvent.click(screen.getByRole('button', { name: 'General' }));
    const list = screen.getByRole('list', { name: 'Operating systems' });
    expect(within(list).getByText('Current')).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: 'Back to chooser' })).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: 'Switch to Windows 11' })).toBeInTheDocument();
  });

  it('compact: the pane list pushes a pane; the back chevron returns', async () => {
    renderSettings(true);
    expect(screen.getByRole('heading', { level: 2, name: 'System Settings' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sound' }));
    expect(screen.getByRole('region', { name: 'System Settings — Sound' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Settings' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'All settings' }));
    expect(screen.getByRole('navigation', { name: 'Settings' })).toBeInTheDocument();
  });
});

describe('Mail', () => {
  beforeEach(() => resetMailSession());
  const renderMail = () => {
    const win = openWindow('mail');
    const view = render(<Mail window={win} titleId="mac-title-mail" focused compact={false} />);
    const rerender = () =>
      view.rerender(
        <Mail
          window={getKernel().sessions.macos.windows['macos:mail']!}
          titleId="mac-title-mail"
          focused
          compact={false}
        />,
      );
    return { ...view, rerender };
  };

  it('MAC-MAIL-01: three messages generated from data, unread and named for assistive tech', async () => {
    const { container } = renderMail();
    const list = screen.getByRole('region', { name: 'Inbox messages' });
    const rows = within(list).getAllByRole('button');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAccessibleName(expect.stringMatching(/^Unread\. From .+Let's talk/));
    expect(screen.getByRole('article')).toHaveTextContent(getContact().email);
    await userEvent.click(rows[1]!);
    expect(rows[1]).not.toHaveAttribute('data-unread');
    await noAxeViolations(container);
  });

  it('MAC-MAIL-02/06: compose is a labelled dialog form; the draft lives in the window and Enter never sends', async () => {
    renderMail();
    await userEvent.click(screen.getByRole('button', { name: 'New Message' }));
    const sheet = screen.getByRole('dialog', { name: 'New Message' });
    expect(within(sheet).getByRole('textbox', { name: 'To:' })).toHaveValue(getContact().email);
    await userEvent.type(within(sheet).getByRole('textbox', { name: 'Subject:' }), 'Hello');
    await userEvent.type(within(sheet).getByRole('textbox', { name: 'Message' }), 'Line one{Enter}Line two');
    await flush();
    expect(handedOff).toEqual([]);
    const draft = JSON.parse(getKernel().sessions.macos.windows['macos:mail']!.draft ?? '{}');
    expect(draft).toMatchObject({ subject: 'Hello', body: 'Line one\nLine two', open: true });
    // The rest of the window is inert while the sheet is open.
    expect(screen.getByRole('region', { name: 'Inbox messages' }).closest('[inert]')).not.toBeNull();
  });

  it('MAC-MAIL-03: Ctrl+Enter sends an encoded mailto:, shows the confirmation and clears the draft', async () => {
    renderMail();
    await userEvent.click(screen.getByRole('button', { name: 'Reply' }));
    const sheet = screen.getByRole('dialog');
    const body = within(sheet).getByRole('textbox', { name: 'Message' });
    await userEvent.type(body, 'Hi & thanks?');
    fireEvent.keyDown(body, { key: 'Enter', ctrlKey: true });
    await flush();
    expect(handedOff).toHaveLength(1);
    expect(handedOff[0]).toBe(
      `mailto:${getContact().email}?subject=${encodeURIComponent("Re: Let's talk")}&body=${encodeURIComponent('Hi & thanks?')}`,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Handed to your email app');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(getKernel().sessions.macos.windows['macos:mail']!.draft).toBe('');
  });

  it('MAC-MAIL-03: a body too long for mailto: is cut with a note and copied in full', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderMail();
    await userEvent.click(screen.getByRole('button', { name: 'New Message' }));
    const long = 'word '.repeat(500);
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: long } });
    await userEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: /Send/ })[0]!);
    await waitFor(() => expect(handedOff).toHaveLength(1));
    expect(writeText).toHaveBeenCalledWith(long);
    const carried = decodeURIComponent(handedOff[0]!.split('body=')[1]!);
    expect(carried.length).toBeLessThanOrEqual(MAILTO_BODY_LIMIT);
    expect(carried).toMatch(/continued — paste the rest in your email app\)$/);
    expect(screen.getByRole('status')).toHaveTextContent('The full message was copied');
  });

  it('MAC-MAIL-04: Copy Address uses the clipboard; blocked → a selected read-only field', async () => {
    const writeText = vi.fn<() => Promise<void>>(() => Promise.reject(new Error('blocked')));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderMail();
    await userEvent.click(screen.getByRole('button', { name: 'Copy Address' }));
    const field = await screen.findByRole('textbox', { name: 'Email address:' });
    expect(field).toHaveValue(getContact().email);
    expect(field).toHaveAttribute('readonly');
    writeText.mockImplementation(() => Promise.resolve());
    await userEvent.click(screen.getByRole('button', { name: 'Copy Address' }));
    await waitFor(() => expect(macUi.getState().center[0]?.title).toBe('Email address copied'));
  });

  it('a resting draft is listed under Drafts (1) and reopens as it was', async () => {
    renderMail();
    await userEvent.click(screen.getByRole('button', { name: 'New Message' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Subject:' }), 'Later');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    const drafts = screen.getByRole('button', { name: /Drafts/ });
    expect(drafts).toHaveTextContent('1');
    await userEvent.click(drafts);
    await userEvent.click(screen.getByRole('button', { name: /Later/ }));
    expect(screen.getByRole('textbox', { name: 'Subject:' })).toHaveValue('Later');
  });
});

describe('Terminal', () => {
  const renderTerminal = () => {
    const win = openWindow('terminal');
    return render(<Terminal window={win} titleId="mac-title-terminal" focused compact={false} />);
  };
  const ready = (container: HTMLElement) =>
    waitFor(() => expect(container.querySelector('[data-terminal]')).toHaveAttribute('data-ready'), { timeout: 5000 });

  it('MAC-TERM-01/04: the zsh window title with cols × rows, the static first line before the engine', async () => {
    const { container } = renderTerminal();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Terminal — jaswanth — -zsh — 80×24');
    expect(container.querySelector('[data-scrollback]')).toHaveTextContent(/^Last login: .+ on ttys000/);
    await ready(container);
    expect(container.querySelector('[data-terminal] form')).toHaveTextContent('jaswanth@MacBook-Pro ~ %');
  });

  it('MAC-TERM-03/05: `open resume` opens Preview; the command is recorded in the macOS session', async () => {
    const { container } = renderTerminal();
    await ready(container);
    const input = screen.getByRole('textbox', { name: /^Command, current directory/ });
    await userEvent.type(input, 'open resume{Enter}');
    await flush();
    expect(getKernel().sessions.macos.windows['macos:viewer']).toBeDefined();
    expect(getKernel().sessions.macos.terminal?.history.at(-1)).toBe('open resume');
    expect(getKernel().sessions.macos.windows['macos:terminal']).toBeDefined();
  });

  it('MAC-SPOT-04: a pending insert lands at the prompt unsubmitted', async () => {
    act(() => macUi.setState({ terminalInsert: 'neofetch' }));
    const { container } = renderTerminal();
    await ready(container);
    const input = screen.getByRole('textbox', { name: /^Command, current directory/ });
    await waitFor(() => expect(input).toHaveValue('neofetch'));
    expect(macUi.getState().terminalInsert).toBeNull();
    expect(getKernel().sessions.macos.terminal?.history ?? []).not.toContain('neofetch');
  });

  it('Shell → New Tab opens a second, fresh session with a tab bar (max 2)', async () => {
    const { container } = renderTerminal();
    await ready(container);
    act(() => {
      emitAppCommand('terminal', 'new-tab');
    });
    const tabs = screen.getByRole('tablist', { name: 'Terminal tabs' });
    expect(within(tabs).getAllByRole('tab')).toHaveLength(2);
    expect(within(tabs).getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
    act(() => {
      emitAppCommand('terminal', 'new-tab');
    });
    expect(within(tabs).getAllByRole('tab')).toHaveLength(2);
    act(() => {
      emitAppCommand('terminal', 'close-tab');
    });
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('`exit` closes the window', async () => {
    const { container } = renderTerminal();
    await ready(container);
    await userEvent.type(screen.getByRole('textbox', { name: /^Command, current directory/ }), 'exit{Enter}');
    await flush();
    expect(getKernel().sessions.macos.windows['macos:terminal']?.phase.s).toBe('closing');
  });
});
