import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LinuxShell from '@/components/os/linux/Shell';
import { contentRev } from '@/data/content-index';
import { DEFAULT_CAPABILITIES, DEFAULT_PREFS, initialKernelState } from '@/lib/kernel/state';
import { focusKeys } from '@/lib/kernel/types';
import { dispatch, kernelStore } from '@/stores/kernel-store';
import { prefsStore } from '@/stores/prefs-store';

const { routerPush } = vi.hoisted(() => ({ routerPush: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: routerPush }) }));

vi.mock('@/stores/kernel-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/kernel-store')>();
  return { ...actual, dispatchSoon: vi.fn((action: Parameters<typeof actual.dispatch>[0]) => actual.dispatch(action)) };
});

function boot(url = '/linux') {
  kernelStore.setState({ kernel: initialKernelState(contentRev) });
  dispatch({
    type: 'BOOT',
    url,
    navType: 'navigate',
    viewport: { w: 1440, h: 900, pointer: 'fine' },
    persisted: null,
    capabilities: DEFAULT_CAPABILITIES,
  });
}

function renderShell() {
  return render(
    <LinuxShell
      os="linux"
      heading={
        <h1 className="sr-only" tabIndex={-1} data-focus-key={focusKeys.osHeading}>
          Linux — Jaswanth&apos;s portfolio
        </h1>
      }
    />,
  );
}

function chooserArrival() {
  const state = kernelStore.getState().kernel;
  kernelStore.setState({
    kernel: {
      ...state,
      arrival: 'chooser',
      continuity: { ref: { section: 'projects' }, fromOs: 'macos', at: Date.now() },
      sessions: { ...state.sessions, linux: { ...state.sessions.linux, bootSeen: false } },
    },
  });
}

beforeEach(() => {
  routerPush.mockClear();
  prefsStore.setState({ prefs: DEFAULT_PREFS });
  boot();
});

describe('P7 Linux terminal shell', () => {
  it('LNX-BOOT-01/02/04 boots from real facts, identifies the previous OS, and any key skips it once', async () => {
    chooserArrival();
    const first = renderShell();
    const overlay = first.container.querySelector('[data-linux-boot]');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveTextContent('PortfolioOS version');
    await waitFor(
      () => expect(first.container.querySelector('[data-linux-boot]')).toHaveTextContent('Mounted /home/jaswanth'),
      { timeout: 600 },
    );
    expect(first.container.querySelector('[data-scrollback]')).toHaveTextContent(/Last login: .* from macos/);
    expect(first.container).not.toHaveTextContent(/password:/i);
    fireEvent.keyDown(document, { key: 'x' });
    await waitFor(() => expect(first.container.querySelector('[data-linux-boot]')).toBeNull());
    expect(kernelStore.getState().kernel.sessions.linux.bootSeen).toBe(true);
    expect(first.container).toHaveTextContent('Last viewed on macos: projects.');
    await userEvent.click(screen.getByRole('button', { name: 'Paste into Terminal' }));
    expect(screen.getByRole('textbox', { name: /^Command/ })).toHaveValue('cd projects && ls');
    expect(kernelStore.getState().kernel.continuity).toBeNull();
    first.unmount();

    const reentry = renderShell();
    expect(reentry.container.querySelector('[data-linux-boot]')).toBeNull();
    expect(reentry.container.querySelector('[data-scrollback]')).not.toHaveTextContent('portfolio login:');
  });

  it('LNX-ID-01/05 · LNX-A11Y-01/03 renders landmarks, authentic prompt and a non-trapping input', async () => {
    const { container } = renderShell();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Workspaces' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent("Linux — Jaswanth's portfolio");
    const terminal = screen.getByRole('region', { name: 'Terminal' });
    const input = within(terminal).getByRole<HTMLInputElement>('textbox', { name: 'Command, current directory ~' });
    await waitFor(() => expect(container.querySelector('[data-terminal]')).toHaveAttribute('data-ready'));
    expect(container.querySelector('[data-terminal] [aria-hidden="true"]')?.textContent).toBe('jaswanth@portfolio:~$ ');
    input.focus();
    expect(fireEvent.keyDown(input, { key: 'Tab' })).toBe(true);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(fireEvent.keyDown(input, { key: 'Tab' })).toBe(true);
  });

  it('LNX-BOOT-03 · LNX-A11Y-07 MOTD entries insert and never execute', async () => {
    const user = userEvent.setup();
    const { container } = renderShell();
    await waitFor(() => expect(container.querySelector('[data-terminal]')).toHaveAttribute('data-ready'));
    const insert = screen.getByRole('button', { name: 'Insert command: open resume' });
    await user.click(insert);
    expect(screen.getByRole('textbox', { name: /^Command, current directory/ })).toHaveValue('open resume');
    expect(screen.queryByRole('region', { name: /viewer/i })).toBeNull();
  });

  it('LNX-VIEW-01/02 · RES-IDIOM-01 opens the résumé tile in one action and q returns focus', async () => {
    const user = userEvent.setup();
    const { container } = renderShell();
    await user.click(screen.getByRole('link', { name: 'Résumé (PDF)' }));
    expect(container.querySelector('[data-linux]')).toHaveAttribute('data-splitting', 'true');
    fireEvent.resize(window);
    const viewer = await screen.findByRole('region', { name: /viewer — resume\.pdf/i });
    expect(viewer).toBeInTheDocument();
    await waitFor(() => expect(container.querySelector('[data-linux]')).not.toHaveAttribute('data-splitting'));
    const heading = within(viewer).getByRole('heading', { level: 2 });
    await waitFor(() => expect(heading).toHaveFocus());
    fireEvent.keyDown(within(viewer).getByRole('region', { name: 'Viewer document' }), { key: 'q' });
    await waitFor(() => expect(screen.queryByRole('region', { name: /viewer —/i })).toBeNull());
    await waitFor(() => expect(screen.getByRole('textbox', { name: /^Command/ })).toHaveFocus());
  });

  it('LNX-VIEW-04 gates single-key viewer commands while Escape and visible controls remain', async () => {
    prefsStore.getState().patch({ singleKeyShortcuts: false });
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('link', { name: 'Résumé (PDF)' }));
    const viewer = await screen.findByRole('region', { name: /viewer — resume\.pdf/i });
    expect(within(viewer).getByRole('button', { name: '[q] close' })).toBeVisible();
    const document = within(viewer).getByRole('region', { name: 'Viewer document' });
    fireEvent.keyDown(document, { key: 'q' });
    expect(viewer).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('region', { name: /viewer —/i })).toBeNull());
  });

  it('LNX-A11Y-06 has no serious or critical axe violations on the home shell', async () => {
    const { container } = renderShell();
    await waitFor(() => expect(container.querySelector('[data-terminal]')).toHaveAttribute('data-ready'));
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual(
      [],
    );
  });

  it('LNX-HINT-01/02/04/07 struggle hints disclose and insert without executing', async () => {
    const user = userEvent.setup();
    const { container } = renderShell();
    await waitFor(() => expect(container.querySelector('[data-terminal]')).toHaveAttribute('data-ready'));
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: /^Command/ });
    for (const command of ['nope-one', 'nope-two', 'nope-three']) await user.type(input, `${command}{Enter}`);
    const disclosure = await screen.findByRole('button', { name: 'Need a hint?' });
    const echoes = container.querySelectorAll('[data-echo]').length;
    expect(disclosure.closest('[role="status"]')).not.toBeNull();
    await user.click(disclosure);
    await user.click(screen.getByRole('button', { name: 'Paste into Terminal' }));
    expect(input).toHaveValue('help');
    expect(input).toHaveFocus();
    expect(container.querySelectorAll('[data-echo]')).toHaveLength(echoes);
    expect(container.querySelector('[data-hint-slot] [role="status"]')).toHaveTextContent(
      'Inserted — press Enter to run.',
    );
  });

  it('LNX-HINT-05 protects an existing externally inserted draft before replacement', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(100_000);
    const user = userEvent.setup();
    const { container } = renderShell();
    await waitFor(() => expect(container.querySelector('[data-terminal]')).toHaveAttribute('data-ready'));
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: /^Command/ });
    for (const command of ['bad-one', 'bad-two', 'bad-three']) await user.type(input, `${command}{Enter}`);
    await user.click(await screen.findByRole('button', { name: 'Need a hint?' }));
    await user.click(screen.getByRole('button', { name: 'Insert command: open resume' }));
    expect(input).toHaveValue('open resume');
    await user.click(screen.getByRole('button', { name: 'Paste into Terminal' }));
    expect(screen.getByRole('group', { name: 'Replace command' })).toHaveTextContent('Replace your current line?');
    await user.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(input).toHaveValue('open resume');
    expect(container.querySelectorAll('[data-echo]')).toHaveLength(3);
    now.mockRestore();
  });

  it('LNX-HINT-01 rate-limits nudges and switches off after two explicit dismissals', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(100_000);
    const user = userEvent.setup();
    const { container } = renderShell();
    await waitFor(() => expect(container.querySelector('[data-terminal]')).toHaveAttribute('data-ready'));
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: /^Command/ });
    for (const command of ['fail-one', 'fail-two', 'fail-three']) await user.type(input, `${command}{Enter}`);
    await user.click(await screen.findByRole('button', { name: 'Need a hint?' }));
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    await user.type(input, 'still-failing{Enter}');
    expect(screen.queryByRole('button', { name: 'Need a hint?' })).toBeNull();
    now.mockReturnValue(160_001);
    await user.type(input, 'later-failure{Enter}');
    await user.click(await screen.findByRole('button', { name: 'Need a hint?' }));
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(container.querySelector('[data-hint-slot]')).toHaveTextContent(
      "Hints off — 'hints on' brings them back. 'help' is always here.",
    );
    now.mockRestore();
  });

  it('LNX-X-04/05 tour waits for Enter, exits on free typing, and settings reports egg progress', async () => {
    const user = userEvent.setup();
    const { container } = renderShell();
    await waitFor(() => expect(container.querySelector('[data-terminal]')).toHaveAttribute('data-ready'));
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: /^Command/ });
    await user.type(input, 'settings list{Enter}');
    await waitFor(() => expect(container).toHaveTextContent('eggs found: 0 / 6'));
    expect(container).toHaveTextContent(/storage: (local|memory \(this session only\))/);
    await user.type(input, 'neofetch{Enter}settings list{Enter}');
    await waitFor(() => expect(container).toHaveTextContent('eggs found: 1 / 6'));
    const before = container.querySelectorAll('[data-echo]').length;
    await user.type(input, 'tour{Enter}');
    expect(input).toHaveValue('ls');
    expect(container.querySelectorAll('[data-echo]')).toHaveLength(before + 1);
    await user.type(input, '{Enter}');
    await waitFor(() => expect(input).toHaveValue('cd projects'));
    await user.clear(input);
    await user.type(input, 'whoami{Enter}');
    await waitFor(() => expect(container).toHaveTextContent("You've got it. 'tour' starts again anytime."));
  });

  it('LNX-CMD-plain asks the app router to open reader mode', async () => {
    const user = userEvent.setup();
    const { container } = renderShell();
    await waitFor(() => expect(container.querySelector('[data-terminal]')).toHaveAttribute('data-ready'));
    await user.type(screen.getByRole('textbox', { name: /^Command/ }), 'plain{Enter}');
    expect(routerPush).toHaveBeenCalledWith('/plain');
  });

  it('LNX-CASE-04 preserves an unsubmitted draft when the Linux shell remounts', async () => {
    const user = userEvent.setup();
    const first = renderShell();
    await waitFor(() => expect(first.container.querySelector('[data-terminal]')).toHaveAttribute('data-ready'));
    await user.type(screen.getByRole('textbox', { name: /^Command/ }), 'unfinished command');
    expect(kernelStore.getState().kernel.sessions.linux.terminal?.draft).toBe('unfinished command');
    first.unmount();
    renderShell();
    expect(screen.getByRole('textbox', { name: /^Command/ })).toHaveValue('unfinished command');
  });
});
