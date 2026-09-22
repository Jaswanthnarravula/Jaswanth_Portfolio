/**
 * Windows Terminal in jsdom, inside the real Windows window frame (plans/windows/apps/windows-terminal.md):
 * WIN-TERM-01 (tab strip in the title bar: APG tabs, "+" up to 3 tabs, the ▾ profiles Menu, Delete / ✕ / `exit` close
 * a tab, the last one closes the window; the Acrylic body) · WIN-TERM-05 (`start` / `open` dispatch the owning Windows
 * app — the pure effect mapper, and `start resume` end to end → Edge's PDF tab) · WIN-TERM-06 (static: terminal
 * behaviour only from lib/terminal + the shared TerminalView; the terminal a11y contract inside the window) ·
 * WIN-TERM-07 (Ubuntu asks first: Cancel never switches, Switch dispatches SWITCH_OS linux) · SRCH-TERM-01 (a "Run in
 * Terminal" intent inserts, never runs) · EGG-WINVER-01 (`winver` opens About Windows, runs nothing).
 */
import { readFileSync } from 'node:fs';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { useMemo, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Terminal, { effectOutcomes, MAX_TABS, prefPatch } from '@/components/os/windows/apps/Terminal';
import { requestIntent, resetIntents } from '@/components/os/windows/intents';
import {
  useWinShell,
  WinShellProvider,
  type ContextMenuSpec,
  type WinShellServices,
} from '@/components/os/windows/shell-context';
import { WinWindow } from '@/components/os/windows/window/Window';
import { Menu } from '@/components/primitives/Menu';
import { getContact } from '@/data/selectors';
import { currentLocation, DEFAULT_CAPABILITIES, DEFAULT_PREFS } from '@/lib/kernel/state';
import { dispatch, dispatchSoon, getKernel } from '@/stores/kernel-store';

// Presses commit to the kernel after paint in the app; here they commit at once (and are observable).
vi.mock('@/stores/kernel-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/stores/kernel-store')>();
  return { ...actual, dispatchSoon: vi.fn((action: Parameters<typeof actual.dispatch>[0]) => actual.dispatch(action)) };
});

const HOME = ['home', 'jaswanth'];
const TERMINAL = 'windows:terminal' as const;

let booted = false;
function boot() {
  if (booted) return;
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

function closeAll() {
  for (const id of Object.keys(getKernel().sessions.windows.windows) as (typeof TERMINAL)[]) {
    dispatch({ type: 'CLOSE_WINDOW', id });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
  }
}

/** The Windows shell's services for an isolated window: the fallback set, plus a real Menu for `openMenu`. */
function Harness({ services = {} }: { readonly services?: Partial<WinShellServices> }) {
  const fallback = useWinShell();
  const [menu, setMenu] = useState<ContextMenuSpec | null>(null);
  const value = useMemo(() => ({ ...fallback, openMenu: setMenu, ...services }), [fallback, services]);
  return (
    <WinShellProvider value={value}>
      <main>
        <WinWindow
          id={TERMINAL}
          zIndex={100}
          focused
          compact={false}
          touch={false}
          shownInCompact
          dimmed={false}
          body={(props) => <Terminal {...props} />}
        />
      </main>
      {menu ? (
        <Menu
          label={menu.label}
          items={menu.items}
          onClose={() => setMenu(null)}
          returnFocusTo={{ current: menu.returnFocusTo ?? null }}
        />
      ) : null}
    </WinShellProvider>
  );
}

function renderTerminal(services?: Partial<WinShellServices>) {
  act(() => {
    dispatch({ type: 'OPEN_APP', os: 'windows', role: 'terminal' });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id: TERMINAL } });
  });
  const view = render(<Harness services={services} />);
  const tablist = () => screen.getByRole('tablist', { name: 'Terminal tabs' });
  const tabs = () => within(tablist()).getAllByRole('tab');
  const selectedPanel = () => screen.getByRole('tabpanel');
  const prompt = () => within(selectedPanel()).getByRole<HTMLInputElement>('textbox', { name: /^Command, current/ });
  return { ...view, tablist, tabs, selectedPanel, prompt };
}

const ready = (panel: HTMLElement) =>
  waitFor(() => expect(panel.querySelector('[data-terminal]')).toHaveAttribute('data-ready'), { timeout: 10_000 });

beforeEach(() => {
  boot();
  resetIntents();
  act(() => {
    closeAll();
    dispatch({ type: 'TERMINAL_SET_CWD', os: 'windows', cwd: HOME });
    dispatch({ type: 'TERMINAL_CLEAR', os: 'windows' });
  });
  vi.mocked(dispatchSoon).mockClear();
});

afterEach(() => resetIntents());

describe('WIN-TERM-01 Terminal skin: tab strip in the title bar, profile dropdown, Acrylic body', () => {
  it('N2 tabs + dropdown: APG tabs, "+" up to 3 tabs, the profiles Menu, Delete / ✕ / exit close tabs', async () => {
    const user = userEvent.setup();
    const { tabs, selectedPanel, prompt, container } = renderTerminal();

    // One "Windows PowerShell" tab in the title bar, controlling its panel; the body is the Acrylic surface.
    const region = screen.getByRole('region', { name: 'Terminal' });
    expect(within(region).getByRole('heading', { level: 2 })).toHaveClass('sr-only');
    const header = region.querySelector('header')!;
    expect(header).toHaveAttribute('data-tall');
    expect(within(header).getByRole('tablist', { name: 'Terminal tabs' })).toBeInTheDocument();
    expect(tabs()).toHaveLength(1);
    expect(tabs()[0]).toHaveAccessibleName('Windows PowerShell');
    expect(tabs()[0]).toHaveAttribute('aria-selected', 'true');
    expect(selectedPanel()).toHaveAttribute('aria-labelledby', tabs()[0]!.id);
    expect(tabs()[0]).toHaveAttribute('aria-controls', selectedPanel().id);
    expect(container.querySelectorAll('[data-acrylic]')).toHaveLength(1);
    expect(selectedPanel().querySelector('[aria-hidden="true"]')?.textContent).toBe('PS C:\\Users\\jaswanth> ');

    // "+" opens fresh PowerShell tabs, at most three.
    const newTab = screen.getByRole('button', { name: 'New tab' });
    await user.click(newTab);
    expect(tabs()).toHaveLength(2);
    expect(tabs()[1]).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(prompt());
    await user.click(newTab);
    expect(tabs()).toHaveLength(MAX_TABS);
    expect(newTab).toBeDisabled();
    expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(3);

    // ▾ is a Menu of profiles; with three tabs only Ubuntu is available.
    await user.click(screen.getByRole('button', { name: 'Profiles' }));
    let menu = screen.getByRole('menu', { name: 'Profiles' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Windows PowerShell', 'Command Prompt', 'Ubuntu']);
    expect(within(menu).getByRole('menuitem', { name: 'Command Prompt' })).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();

    // Arrow keys move and activate; Delete closes the focused tab and keeps focus in the strip.
    tabs()[2]!.focus();
    await user.keyboard('{ArrowLeft}');
    expect(tabs()[1]).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(tabs()[1]);
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(tabs()[0]);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(tabs()[2]);
    await user.keyboard('{Delete}');
    expect(tabs()).toHaveLength(2);
    expect(document.activeElement).toBe(tabs()[1]);
    expect(newTab).toBeEnabled();

    // Command Prompt: its own prompt; `exit` closes that tab.
    await user.click(screen.getByRole('button', { name: 'Profiles' }));
    menu = screen.getByRole('menu', { name: 'Profiles' });
    await user.click(within(menu).getByRole('menuitem', { name: 'Command Prompt' }));
    expect(tabs()).toHaveLength(3);
    expect(tabs()[2]).toHaveAccessibleName('Command Prompt');
    expect(selectedPanel()).toHaveAttribute('data-profile', 'cmd');
    expect(selectedPanel().querySelector('form [aria-hidden="true"]')?.textContent).toBe('C:\\Users\\jaswanth>');
    await ready(selectedPanel());
    await user.type(prompt(), 'exit{Enter}');
    expect(tabs()).toHaveLength(2);
    expect(tabs().map((tab) => tab.textContent)).toEqual(['Windows PowerShell', 'Windows PowerShell']);

    // ✕ closes a tab; closing the last one closes the window.
    fireEvent.click(tabs()[1]!.querySelector('[data-tab-close]')!);
    expect(tabs()).toHaveLength(1);
    expect(getKernel().sessions.windows.windows[TERMINAL]?.phase.s).not.toBe('closing');
    fireEvent.click(tabs()[0]!.querySelector('[data-tab-close]')!);
    expect(dispatchSoon).toHaveBeenCalledWith({ type: 'CLOSE_WINDOW', id: TERMINAL });
    expect(getKernel().sessions.windows.windows[TERMINAL]?.phase.s ?? 'closing').toBe('closing');
  });

  it('each tab is a fresh session; only the first writes the kernel terminal session', async () => {
    const user = userEvent.setup();
    const { selectedPanel, prompt } = renderTerminal();
    await ready(selectedPanel());
    await user.type(prompt(), 'cd projects{Enter}');
    expect(getKernel().sessions.windows.terminal?.cwd).toEqual([...HOME, 'projects']);
    expect(getKernel().sessions.windows.terminal?.history.at(-1)).toBe('cd projects');
    await user.click(screen.getByRole('button', { name: 'New tab' }));
    await ready(selectedPanel());
    expect(selectedPanel().querySelector('form [aria-hidden="true"]')?.textContent).toBe('PS C:\\Users\\jaswanth> ');
    await user.type(prompt(), 'cd experience{Enter}');
    expect(getKernel().sessions.windows.terminal?.cwd).toEqual([...HOME, 'projects']);
    expect(getKernel().sessions.windows.terminal?.history.at(-1)).toBe('cd projects');
  });
});

describe('WIN-TERM-05 start/open dispatches the owning Windows app', () => {
  const context = { primary: true, prefs: DEFAULT_PREFS };
  const edgeResume = {
    type: 'OPEN_APP',
    os: 'windows',
    role: 'browser',
    location: { kind: 'content', ref: { section: 'resume' } },
  } as const;

  it('the effect mapper: open resume → the Edge résumé (PDF tab) location', () => {
    expect(effectOutcomes({ k: 'open', ref: 'resume' }, context)).toEqual([{ kind: 'dispatch', action: edgeResume }]);
    act(() => {
      dispatch(edgeResume);
    });
    const edge = getKernel().sessions.windows.windows['windows:browser'];
    expect(edge).toBeDefined();
    expect(currentLocation(edge!)).toEqual({ kind: 'content', ref: { section: 'resume' } });
  });

  it('the effect mapper: content opens in its section owner; folders reveal; the rest maps to Windows services', () => {
    const open = (ref: Parameters<typeof effectOutcomes>[0] & { k: 'open' }) => effectOutcomes(ref, context);
    expect(open({ k: 'open', ref: { section: 'projects', slug: 'x' } })).toEqual([
      {
        kind: 'dispatch',
        action: {
          type: 'OPEN_APP',
          os: 'windows',
          role: 'github',
          location: { kind: 'content', ref: { section: 'projects', slug: 'x' } },
        },
      },
    ]);
    expect(open({ k: 'open', ref: { section: 'experience', slug: 'y' } })[0]).toMatchObject({
      action: { role: 'files' },
    });
    expect(open({ k: 'open', ref: { section: 'about' } })[0]).toMatchObject({ action: { role: 'browser' } });
    expect(effectOutcomes({ k: 'reveal', path: HOME, ref: null }, context)).toEqual([
      { kind: 'dispatch', action: { type: 'OPEN_APP', os: 'windows', role: 'files', location: { kind: 'root' } } },
    ]);
    expect(
      effectOutcomes({ k: 'reveal', path: [...HOME, 'education'], ref: { section: 'education' } }, context),
    ).toEqual([
      {
        kind: 'dispatch',
        action: {
          type: 'OPEN_APP',
          os: 'windows',
          role: 'files',
          location: { kind: 'content', ref: { section: 'education' } },
        },
      },
    ]);
    const email = getContact().email;
    expect(effectOutcomes({ k: 'mailto', subject: 'Hi there' }, context)).toEqual([
      { kind: 'mailto', href: `mailto:${email}?subject=Hi%20there` },
      { kind: 'track', event: { name: 'contact_initiated', channel: 'mailto' } },
    ]);
    expect(effectOutcomes({ k: 'download' }, context)).toEqual([{ kind: 'download' }]);
    expect(effectOutcomes({ k: 'tour' }, context)).toEqual([{ kind: 'tour' }]);
    expect(effectOutcomes({ k: 'exit' }, context)).toEqual([{ kind: 'close-tab' }]);
    expect(effectOutcomes({ k: 'switch-os', to: 'linux' }, context)).toEqual([
      { kind: 'dispatch', action: { type: 'SWITCH_OS', to: 'linux', via: 'switch' } },
    ]);
    expect(effectOutcomes({ k: 'switch-os' }, context)).toEqual([
      { kind: 'dispatch', action: { type: 'SWITCH_OS', to: null, via: 'switch' } },
    ]);
    expect(effectOutcomes({ k: 'cd', to: [...HOME, 'projects'] }, context)).toEqual([
      { kind: 'dispatch', action: { type: 'TERMINAL_SET_CWD', os: 'windows', cwd: [...HOME, 'projects'] } },
    ]);
    expect(effectOutcomes({ k: 'cd', to: HOME }, { ...context, primary: false })).toEqual([]);
    expect(effectOutcomes({ k: 'history-clear' }, context)).toEqual([
      { kind: 'dispatch', action: { type: 'TERMINAL_CLEAR', os: 'windows', history: true } },
    ]);
    expect(effectOutcomes({ k: 'history-clear' }, { ...context, primary: false })).toEqual([]);
  });

  it('the effect mapper: an egg counts once; a pref must be known and valid', () => {
    expect(effectOutcomes({ k: 'egg', id: 'EGG-SUDO-01' }, context)).toEqual([
      { kind: 'dispatch', action: { type: 'SET_PREF', patch: { eggsFound: ['EGG-SUDO-01'] } } },
      { kind: 'track', event: { name: 'egg_found', id: 'EGG-SUDO-01' } },
    ]);
    const found = { ...context, prefs: { ...DEFAULT_PREFS, eggsFound: ['EGG-SUDO-01'] } };
    expect(effectOutcomes({ k: 'egg', id: 'EGG-SUDO-01' }, found)).toEqual([]);
    expect(effectOutcomes({ k: 'egg', id: 'EGG-NOPE' }, context)).toEqual([]);
    expect(effectOutcomes({ k: 'pref', key: 'motion', value: 'reduced' }, context)).toEqual([
      { kind: 'dispatch', action: { type: 'SET_PREF', patch: { motion: 'reduced' } } },
    ]);
    expect(prefPatch('motion', 'sideways', DEFAULT_PREFS)).toBeNull();
    expect(prefPatch('persona', 'recruiter', DEFAULT_PREFS)).toBeNull();
    expect(prefPatch('v', 2, DEFAULT_PREFS)).toBeNull();
  });

  it('e2e in the window: start resume → Edge PDF tab (never a page link)', async () => {
    const user = userEvent.setup();
    const { selectedPanel, prompt } = renderTerminal();
    await ready(selectedPanel());
    await user.type(prompt(), 'start resume{Enter}');
    expect(dispatchSoon).toHaveBeenCalledWith(edgeResume);
    const edge = getKernel().sessions.windows.windows['windows:browser'];
    expect(currentLocation(edge!)).toEqual({ kind: 'content', ref: { section: 'resume' } });
    expect(selectedPanel().textContent).toContain('Opening resume.pdf…');
  });
});

describe('WIN-TERM-06 shared engine reuse + a11y contract parity', () => {
  it('static: Terminal.tsx takes terminal behaviour only from lib/terminal and the shared TerminalView', () => {
    const source = readFileSync('components/os/windows/apps/Terminal.tsx', 'utf8');
    const specifiers = [...source.matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g)].map((match) => match[1]!);
    const terminalish = specifiers.filter((specifier) => /terminal/i.test(specifier));
    expect(terminalish.sort()).toEqual(
      [
        '@/components/os/shared/terminal/TerminalView',
        '@/lib/terminal',
        '@/lib/terminal/powershell',
        './terminal.module.css',
      ].sort(),
    );
    // The engine stays a lazy chunk: the component imports only its types statically.
    expect(source).toMatch(/import type \{[^}]*\} from '@\/lib\/terminal';/);
    expect(specifiers.filter((specifier) => /components\/os\/(macos|linux|ios|android)\//.test(specifier))).toEqual([]);
    // No hard-coded command handling (north-star B4), and the native context menu is never overridden.
    expect(source).not.toMatch(/\b(?:input|line|raw|command|typed|value)(?:\.\w+\(\))*\s*===\s*['"`]/);
    expect(source).not.toMatch(/case\s+['"](?:ls|dir|cat|type|help|pwd|cls|whoami)['"]/);
    expect(source).not.toMatch(/onContextMenu|'contextmenu'/);
  });

  it('cmp: Terminal a11y suite — labelled input in a form, readable scrollback region, separate log announcer', async () => {
    const { selectedPanel, prompt, container } = renderTerminal();
    const input = prompt();
    expect(input).toHaveAccessibleName('Command, current directory ~');
    expect(input.closest('form')).not.toBeNull();
    const output = within(selectedPanel()).getByRole('region', { name: 'Terminal output' });
    expect(output).toHaveAttribute('tabindex', '0');
    const log = selectedPanel().querySelector('[role="log"]')!;
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(output.contains(log)).toBe(false);
    // The window is a labelled region (never a dialog, never role=application); its content starts below the h2.
    const region = screen.getByRole('region', { name: 'Terminal' });
    expect(region.tagName).toBe('SECTION');
    expect(container.querySelector('[role="application"]')).toBeNull();
    expect(within(region).queryAllByRole('heading', { level: 1 })).toHaveLength(0);
    await ready(selectedPanel());
    const results = await axe.run(container, {
      runOnly: {
        type: 'rule',
        values: [
          'aria-required-children',
          'aria-required-parent',
          'aria-allowed-attr',
          'aria-valid-attr-value',
          'button-name',
          'nested-interactive',
          'label',
        ],
      },
    });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('SRCH-TERM-01 a "Run in Terminal" intent inserts at the prompt — never executed', async () => {
    const user = userEvent.setup();
    requestIntent({ kind: 'terminal-insert', command: 'neofetch' });
    const { selectedPanel, prompt } = renderTerminal();
    expect(prompt()).toHaveValue('neofetch');
    await ready(selectedPanel());
    expect(selectedPanel().querySelector('[data-scrollback]')?.textContent).not.toContain('neofetch');
    await user.clear(prompt());
    act(() => requestIntent({ kind: 'terminal-insert', command: 'open resume' }));
    expect(prompt()).toHaveValue('open resume');
    expect(dispatchSoon).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'OPEN_APP' }));
  });

  it('↑ recalls what was typed (dir), not the engine rewrite (ls)', async () => {
    const user = userEvent.setup();
    const { selectedPanel, prompt } = renderTerminal();
    await ready(selectedPanel());
    await user.type(prompt(), 'dir{Enter}');
    await user.type(prompt(), 'cd C:\\Users\\jaswanth\\projects{Enter}');
    await user.keyboard('{ArrowUp}');
    expect(prompt()).toHaveValue('cd C:\\Users\\jaswanth\\projects');
    await user.keyboard('{ArrowUp}');
    expect(prompt()).toHaveValue('dir');
  });

  it('EGG-WINVER-01 winver opens About Windows and runs nothing', async () => {
    const user = userEvent.setup();
    const openWinver = vi.fn();
    const { selectedPanel, prompt } = renderTerminal({ openWinver });
    await ready(selectedPanel());
    await user.type(prompt(), 'winver{Enter}');
    expect(openWinver).toHaveBeenCalledTimes(1);
    expect(selectedPanel().querySelector('[data-scrollback]')?.textContent).not.toMatch(/not recognized/);
  });
});

describe('WIN-TERM-07 "Ubuntu" profile offers the Linux OS', () => {
  const chooseUbuntu = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Profiles' }));
    await user.click(within(screen.getByRole('menu', { name: 'Profiles' })).getByRole('menuitem', { name: 'Ubuntu' }));
    return screen.getByRole('dialog', { name: 'Switch to the Linux experience?' });
  };

  it('choosing it asks to switch; Cancel / Esc never switch; Switch dispatches SWITCH_OS linux', async () => {
    const user = userEvent.setup();
    const { tablist } = renderTerminal();

    // Ask first: a modal dialog, focus inside (on Cancel), the tab strip inert behind it.
    let dialog = await chooseUbuntu(user);
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('heading', { level: 3 })).toHaveTextContent('Switch to the Linux experience?');
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(tablist().closest('[inert]')).not.toBeNull();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Profiles' }));

    dialog = await chooseUbuntu(user);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(dispatchSoon).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SWITCH_OS' }));
    expect(getKernel().activeOs).toBe('windows');

    // Switch is the only way through.
    dialog = await chooseUbuntu(user);
    await user.click(within(dialog).getByRole('button', { name: 'Switch' }));
    expect(dispatchSoon).toHaveBeenCalledWith({ type: 'SWITCH_OS', to: 'linux', via: 'switch' });
  });
});
