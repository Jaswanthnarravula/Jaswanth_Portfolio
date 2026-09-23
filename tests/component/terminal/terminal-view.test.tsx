/**
 * The shared terminal host (components/os/shared/terminal) against the Linux accessibility contract, as the macOS
 * Terminal uses it — MAC-TERM-06 (terminal a11y suite: labelled input, scrollback region, separate synchronous `log`
 * announcer, Tab pass-through, Esc-then-Tab) · LNX-SH-08 (Ctrl+C with a selection copies; Ctrl+U/K/W edit) · LNX-SH-06
 * (↑/↓ keep the draft) · MAC-TERM-04 (the static first line shows before the engine loads) · LNX-A11Y-07 style inserts
 * (tapping an entry inserts, never runs).
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createRef, Profiler } from 'react';
import { TerminalView, type TerminalViewHandle } from '@/components/os/shared/terminal/TerminalView';
import { createTerminal, type Terminal } from '@/lib/terminal';
import { terminalDataFrom } from '@/lib/terminal/data';
import { fixtureCatalog, fixturePortfolio } from '../../fixtures/portfolio';

const data = terminalDataFrom(fixturePortfolio, fixtureCatalog.rev);
const engine = (): Promise<Terminal> => Promise.resolve(createTerminal({ data, flavor: 'zsh', os: 'macos' }));

function setup(props: Partial<Parameters<typeof TerminalView>[0]> = {}) {
  const onEffect = vi.fn();
  const onRecord = vi.fn();
  const ref = createRef<TerminalViewHandle>();
  const view = render(
    <TerminalView
      ref={ref}
      flavor="zsh"
      os="macos"
      session={null}
      firstLine="Last login: today on ttys000"
      onEffect={onEffect}
      onRecord={onRecord}
      loadEngine={engine}
      {...props}
    />,
  );
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: /^Command, current directory/ });
  const log = view.container.querySelector('[role="log"]') as HTMLElement;
  return { ...view, input, log, onEffect, onRecord, ref };
}

const ready = (container: HTMLElement) =>
  waitFor(() => expect(container.querySelector('[data-terminal]')).toHaveAttribute('data-ready'));

describe('MAC-TERM-06 terminal accessibility contract', () => {
  it('labelled input in a form, a labelled focusable scrollback region, a separate log announcer', async () => {
    const { input, log, container } = setup();
    expect(input).toHaveAccessibleName('Command, current directory ~');
    expect(input.closest('form')).not.toBeNull();
    const region = screen.getByRole('region', { name: 'Terminal output' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(region.contains(log)).toBe(false);
    await ready(container);
    // The visual prompt (the zsh voice once the engine is in) is hidden from assistive tech.
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('jaswanth@MacBook-Pro ~ % ');
  });

  it('MAC-TERM-04 the static first line shows before the engine chunk resolves; commands typed meanwhile run later', async () => {
    let resolve: (terminal: Terminal) => void = () => undefined;
    const slow = () => new Promise<Terminal>((done) => (resolve = done));
    const { input, container } = setup({ loadEngine: slow });
    expect(container.textContent).toContain('Last login: today on ttys000');
    await userEvent.type(input, 'pwd{Enter}');
    expect(container.textContent).not.toContain('/home/jaswanth');
    await act(async () => resolve(await engine()));
    await waitFor(() => expect(container.textContent).toContain('/home/jaswanth'));
  });

  it('LNX-BOOT-06 exposes a calm retry and plain-reader recovery when the engine fails', async () => {
    let attempts = 0;
    const flaky = vi.fn(() => (attempts++ === 0 ? Promise.reject(new Error('offline')) : engine()));
    const { container } = setup({
      os: 'linux',
      flavor: 'bash',
      loadEngine: flaky,
      loadingLabel: '[ .... ] Starting command interpreter…',
      recoveryHref: '/plain',
    });
    expect(screen.getByRole('status')).toHaveTextContent('Starting command interpreter');
    await screen.findByText('[FAILED] Command interpreter unavailable.');
    expect(screen.getByRole('link', { name: 'Read plain portfolio' })).toHaveAttribute('href', '/plain');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await ready(container);
    expect(flaky).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-terminal]')).toHaveAttribute('data-load-state', 'ready');
  });

  it('the announcer receives the final output text synchronously (not the echo); long output is summarised', async () => {
    const { input, log, container } = setup();
    await ready(container);
    await userEvent.type(input, 'whoami{Enter}');
    expect(log.textContent).toBe('jaswanth\nAda Example — Engineer of examples · Testville');
    await userEvent.type(input, 'cat nope{Enter}');
    expect(log.textContent).toBe('Error: cat: nope: No such file or directory');
    await userEvent.type(input, 'help{Enter}');
    expect(log.textContent).toMatch(/^help: \d+ lines\. Explore$/);
  });

  it('LNX-OUT-03 input finishes an active reveal and the solid-typing state never blocks characters', async () => {
    const { input, container } = setup();
    await ready(container);
    await userEvent.type(input, 'help{Enter}');
    const output = [...container.querySelectorAll<HTMLElement>('[data-scrollback] [data-line]')];
    fireEvent.keyDown(input, { key: 'x' });
    fireEvent.change(input, { target: { value: 'x' } });
    expect(input).toHaveValue('x');
    expect(container.querySelector('[data-terminal]')).toHaveAttribute('data-typing', 'true');
    expect(output.every((line) => line.style.opacity === '' && line.style.transform === '')).toBe(true);
  });

  it('Tab passes through on an empty prompt; completes a token; Esc then Tab always leaves', async () => {
    const { input, container } = setup();
    await ready(container);
    input.focus();
    const empty = fireEvent.keyDown(input, { key: 'Tab' });
    expect(empty).toBe(true); // not prevented → focus moves
    await userEvent.type(input, 'whoa');
    const completing = fireEvent.keyDown(input, { key: 'Tab' });
    expect(completing).toBe(false);
    await waitFor(() => expect(input).toHaveValue('whoami '));
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(fireEvent.keyDown(input, { key: 'Tab' })).toBe(true);
  });

  it('a second Tab lists candidates in the scrollback', async () => {
    const { input, container } = setup();
    await ready(container);
    await userEvent.type(input, 'cd e');
    fireEvent.keyDown(input, { key: 'Tab' });
    fireEvent.keyDown(input, { key: 'Tab' });
    await waitFor(() => expect(container.textContent).toContain('education/  experience/'));
  });
});

describe('LNX-SH-08 line editing at the prompt', () => {
  it('Ctrl+C with a selection is left to the browser (copy); without one it cancels the line (^C, exit 130)', async () => {
    const { input, container } = setup();
    await ready(container);
    await userEvent.type(input, 'echo hi');
    input.setSelectionRange(0, 4);
    expect(fireEvent.keyDown(input, { key: 'c', ctrlKey: true })).toBe(true); // not prevented: the browser copies
    expect(input).toHaveValue('echo hi');
    input.setSelectionRange(7, 7);
    expect(fireEvent.keyDown(input, { key: 'c', ctrlKey: true })).toBe(false);
    await waitFor(() => expect(input).toHaveValue(''));
    expect(container.textContent).toContain('echo hi^C');
  });

  it('Ctrl+U / Ctrl+K / Ctrl+W edit the line', async () => {
    const { input, container } = setup();
    await ready(container);
    await userEvent.type(input, 'cat about.txt');
    input.setSelectionRange(4, 4);
    fireEvent.keyDown(input, { key: 'k', ctrlKey: true });
    await waitFor(() => expect(input).toHaveValue('cat '));
    await userEvent.type(input, 'skills.txt');
    fireEvent.keyDown(input, { key: 'w', ctrlKey: true });
    await waitFor(() => expect(input).toHaveValue('cat '));
    fireEvent.keyDown(input, { key: 'u', ctrlKey: true });
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('Ctrl+L clears; Ctrl+D on an empty line exits', async () => {
    const { input, container, onEffect } = setup();
    await ready(container);
    await userEvent.type(input, 'whoami{Enter}');
    fireEvent.keyDown(input, { key: 'l', ctrlKey: true });
    expect(container.querySelector('[data-scrollback]')?.childElementCount).toBe(0);
    fireEvent.keyDown(input, { key: 'd', ctrlKey: true });
    expect(onEffect).toHaveBeenCalledWith({ k: 'exit' });
  });

  it('multi-line paste keeps the first line with a notice', async () => {
    const { input, container } = setup();
    await ready(container);
    input.focus();
    fireEvent.paste(input, { clipboardData: { getData: () => 'ls\nrm -rf /' } });
    await waitFor(() => expect(input).toHaveValue('ls'));
    expect(container.textContent).toContain('Multi-line paste trimmed to its first line.');
  });
});

describe('LNX-SH-06 history at the prompt', () => {
  it('↑/↓ browse history and give the draft back', async () => {
    const { input, container } = setup();
    await ready(container);
    await userEvent.type(input, 'pwd{Enter}whoami{Enter}half');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    await waitFor(() => expect(input).toHaveValue('whoami'));
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    await waitFor(() => expect(input).toHaveValue('pwd'));
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await waitFor(() => expect(input).toHaveValue('half'));
  });

  it('Ctrl+R finds a past command; Enter runs it', async () => {
    const { input, container } = setup();
    await ready(container);
    await userEvent.type(input, 'whoami{Enter}pwd{Enter}');
    fireEvent.keyDown(input, { key: 'r', ctrlKey: true });
    const search = screen.getByRole('textbox', { name: 'Reverse search through history' });
    await userEvent.type(search, 'who');
    expect(container.textContent).toContain("(reverse-i-search)'who': ");
    await userEvent.type(search, '{Enter}');
    await waitFor(() => expect(container.querySelectorAll('[data-echo]').length).toBe(3));
  });
});

describe('effects, inserts and persistence', () => {
  it('LNX-OUT-05 output length does not multiply React commits', async () => {
    const commits: string[] = [];
    const view = render(
      <Profiler id="terminal" onRender={(_, phase) => commits.push(phase)}>
        <TerminalView flavor="bash" os="linux" session={null} onEffect={vi.fn()} loadEngine={engine} />
      </Profiler>,
    );
    await ready(view.container);
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: /^Command/ });
    fireEvent.change(input, { target: { value: 'help' } });
    commits.length = 0;
    fireEvent.submit(input.closest('form')!);
    const longCommits = commits.length;
    expect(view.container.querySelectorAll('[data-scrollback] [data-line]').length).toBeGreaterThan(10);
    fireEvent.change(input, { target: { value: 'whoami' } });
    commits.length = 0;
    fireEvent.submit(input.closest('form')!);
    expect(longCommits).toBeLessThanOrEqual(commits.length + 1);
    expect(longCommits).toBeLessThan(4);
  });

  it('effects reach the host (open resume, cd); persistence records echo + output', async () => {
    const { input, container, onEffect, onRecord } = setup();
    await ready(container);
    await userEvent.type(input, 'cd projects{Enter}');
    expect(onEffect).toHaveBeenCalledWith({ k: 'cd', to: ['home', 'jaswanth', 'projects'] });
    expect(input).toHaveAccessibleName('Command, current directory ~/projects');
    await userEvent.type(input, 'open resume{Enter}');
    expect(onEffect).toHaveBeenCalledWith({ k: 'open', ref: 'resume' });
    expect(onRecord).toHaveBeenLastCalledWith('open resume', [
      'jaswanth@MacBook-Pro ~/projects % open resume',
      'Opening resume.pdf…',
    ]);
  });

  it('tapping an entry inserts its command and never runs it; the handle inserts unsubmitted too', async () => {
    const { input, container, onEffect, ref } = setup();
    await ready(container);
    await userEvent.type(input, 'ls{Enter}');
    const entry = screen.getByRole('button', { name: 'Insert command: cd projects/' });
    await userEvent.click(entry);
    expect(input).toHaveValue('cd projects/');
    expect(onEffect).not.toHaveBeenCalledWith(expect.objectContaining({ k: 'cd' }));
    act(() => ref.current?.insert('neofetch'));
    expect(input).toHaveValue('neofetch');
    expect(container.querySelectorAll('[data-echo]').length).toBe(1);
  });

  it('the pager opens for man, q quits back to the prompt; the vim buffer leaves on :q', async () => {
    const { input, container } = setup();
    await ready(container);
    await userEvent.type(input, 'man ls{Enter}');
    const pager = await screen.findByRole('region', { name: /pager, q to quit/ });
    expect(pager).toHaveFocus();
    fireEvent.keyDown(pager, { key: 'q' });
    await waitFor(() => expect(screen.queryByRole('region', { name: /pager/ })).toBeNull());
    await userEvent.type(input, 'vim{Enter}');
    const buffer = await screen.findByRole('region', { name: /press Escape to leave/ });
    fireEvent.keyDown(buffer, { key: ':' });
    const field = await screen.findByRole('textbox', { name: 'Editor command' });
    await userEvent.type(field, 'q{Enter}');
    await waitFor(() => expect(screen.queryByRole('region', { name: /press Escape/ })).toBeNull());
    expect(container.textContent).toBeTruthy();
  });

  it('a restored session shows its scrollback and cwd', async () => {
    const { input, container } = setup({
      session: { cwd: ['home', 'jaswanth', 'experience'], history: ['ls'], scrollback: ['old line'] },
    });
    await ready(container);
    expect(container.textContent).toContain('old line');
    expect(container.textContent).toContain('— session restored —');
    expect(input).toHaveAccessibleName('Command, current directory ~/experience');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    await waitFor(() => expect(input).toHaveValue('ls'));
  });
});
