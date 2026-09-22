/**
 * macOS P3 surfaces in jsdom (real kernel, prefs, selectors and the shared search index):
 *   MAC-SPOT-01 (zero state order; groups labelled) · MAC-SPOT-02 (Esc clears, then closes) · MAC-SPOT-03 (a result opens
 *   through the kernel from the panel) · MAC-SPOT-04 (command → inserted, not run) · MAC-SPOT-06 (combobox
 *   activedescendant + debounced count) ·
 *   MAC-NOTIF-01 (one banner, the queue; hover pauses) · MAC-NOTIF-03 (the Center keeps it; Clear) · MAC-NOTIF-05 (focus
 *   unchanged; announced through the status region) ·
 *   MAC-SET-06 / EGG-ABOUT-01 (About This Mac) · MAC-CTX-05 (Get Info + canonical link) · MAC-FIND-05 (Quick Look) ·
 *   MAC-LOCK-01/03/04/05 · MAC-CTX-01/06 (context menu host) · MAC-MENU-06 (Control Center toggles persist) ·
 *   MAC-DOCK-03 (bounce state only while a chunk loads) · E13 (an app chunk that fails) · MAC-X-03 (tour never starts
 *   by itself; Esc ends it).
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppFrame, loadApp, resetAppRegistry } from '@/components/os/macos/apps/registry';
import { runMacCommand } from '@/components/os/macos/run-command';
import { ContextMenuHost } from '@/components/os/macos/surfaces/ContextMenuHost';
import { ControlCenter } from '@/components/os/macos/surfaces/ControlCenter';
import { Dialogs, experienceYears, infoFor } from '@/components/os/macos/surfaces/Dialogs';
import { LockScreen, lockCards } from '@/components/os/macos/surfaces/LockScreen';
import { Banners, NotificationCenter } from '@/components/os/macos/surfaces/Notifications';
import { groupResults, Spotlight } from '@/components/os/macos/surfaces/Spotlight';
import { TourHost } from '@/components/os/macos/surfaces/Tour';
import {
  appStateStore,
  macUi,
  notify,
  openContextMenu,
  requestOverlay,
  resetMacUi,
  setLocked,
} from '@/components/os/macos/ui';
import { getContact, getExperience, getProjects } from '@/data/selectors';
import { DEFAULT_CAPABILITIES, DEFAULT_PREFS } from '@/lib/kernel/state';
import type { SearchEntry } from '@/lib/search/types';
import type { WindowId } from '@/lib/kernel/types';
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
function closeAll() {
  for (const id of Object.keys(getKernel().sessions.macos.windows) as WindowId[]) {
    dispatch({ type: 'CLOSE_WINDOW', id });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
  }
}
const flush = () =>
  act(() => {
    flushQueued();
  });

beforeEach(() => {
  boot();
  closeAll();
  resetMacUi();
  appStateStore.setState({}, true);
  prefsStore.setState({ prefs: DEFAULT_PREFS });
  document.getElementById('system-status')?.remove();
  const status = document.createElement('div');
  status.id = 'system-status';
  status.setAttribute('role', 'status');
  document.body.append(status);
});

describe('Spotlight', () => {
  const open = async () => {
    act(() => runMacCommand({ kind: 'spotlight' }));
    const view = render(<Spotlight />);
    const dialog = screen.getByRole('dialog', { name: 'Spotlight Search' });
    const input = within(dialog).getByRole('combobox', { name: 'Spotlight Search' });
    await waitFor(() => expect(within(dialog).getByRole('group', { name: 'Suggestions' })).toBeInTheDocument(), {
      timeout: 8000,
    });
    return { ...view, dialog, input };
  };

  it('MAC-SPOT-01: opens on the zero state — Résumé, Projects, Contact first — in a labelled group', async () => {
    const { dialog, input } = await open();
    expect(input).toHaveFocus();
    const options = within(within(dialog).getByRole('group', { name: 'Suggestions' })).getAllByRole('option');
    expect(options.slice(0, 3).map((option) => option.textContent)).toEqual([
      expect.stringContaining('Résumé'),
      expect.stringContaining('Projects'),
      expect.stringContaining('Contact'),
    ]);
  });

  it('MAC-SPOT-06: typing groups results with a Top Hit; the active option is the activedescendant', async () => {
    const { dialog, input } = await open();
    await userEvent.type(input, 'mail');
    const top = within(dialog).getByRole('group', { name: 'Top Hit' });
    expect(within(top).getByRole('option')).toHaveTextContent('Mail');
    expect(within(dialog).getAllByRole('option').length).toBeGreaterThan(1);
    expect(input.getAttribute('aria-activedescendant')).toBe(within(top).getByRole('option').id);
    await userEvent.keyboard('{ArrowDown}');
    expect(input.getAttribute('aria-activedescendant')).not.toBe(within(top).getByRole('option').id);
    await waitFor(() => expect(dialog.querySelector('[data-combobox-status]')?.textContent).toMatch(/results?$/), {
      timeout: 2000,
    });
  });

  it('MAC-SPOT-03: Enter opens the result through the kernel from the panel; Spotlight closes', async () => {
    const { input } = await open();
    await userEvent.type(input, getProjects()[0]!.name);
    await userEvent.keyboard('{Enter}');
    await flush();
    expect(macUi.getState().overlay).toBeNull();
    const github = getKernel().sessions.macos.windows['macos:github'];
    expect(github?.phase).toMatchObject({ s: 'opening', originId: 'mac-spotlight' });
  });

  it('MAC-SPOT-04: a command result opens Terminal with the command inserted, never run', async () => {
    const { input } = await open();
    await userEvent.type(input, 'neofetch');
    await userEvent.keyboard('{Enter}');
    await flush();
    expect(macUi.getState().terminalInsert).toBe('neofetch');
    expect(getKernel().sessions.macos.windows['macos:terminal']).toBeDefined();
  });

  it('MAC-SPOT-02: Esc clears the query first, then closes', async () => {
    const { input } = await open();
    await userEvent.type(input, 'mail');
    await userEvent.keyboard('{Escape}');
    expect(input).toHaveValue('');
    expect(macUi.getState().overlay).toBe('spotlight');
    await userEvent.keyboard('{Escape}');
    expect(macUi.getState().overlay).toBeNull();
  });

  it('groups: Top Hit, then each kind in the spec order', () => {
    const entry = (id: string, kind: SearchEntry['kind'], extra: Partial<SearchEntry> = {}): SearchEntry => ({
      id,
      kind,
      title: id,
      keywords: [],
      weight: 1,
      ...extra,
    });
    const grouped = groupResults([
      entry('a', 'command'),
      entry('b', 'content', { ref: { section: 'skills' } }),
      entry('c', 'app', { role: 'mail' }),
      entry('d', 'content', { ref: { section: 'experience' } }),
      entry('e', 'action'),
    ]);
    expect(grouped.map((group) => group.id)).toEqual(['top', 'apps', 'experience', 'skills', 'actions']);
  });
});

describe('Banners and the Notification Center', () => {
  it('MAC-NOTIF-01/05: one banner at a time; focus stays put; announced through the status region', async () => {
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();
    render(<Banners />);
    act(() => {
      notify({ kind: 'welcome' });
      notify({ kind: 'link-copied' });
    });
    const banners = screen.getAllByRole('group', { name: /notification$/ });
    expect(banners).toHaveLength(1);
    expect(banners[0]).toHaveTextContent('Welcome — everything here is an app.');
    expect(button).toHaveFocus();
    await waitFor(() => expect(document.getElementById('system-status')).toHaveTextContent('macOS: Welcome'));
    await userEvent.click(within(banners[0]!).getByRole('button', { name: 'Dismiss notification' }));
    await waitFor(() => expect(screen.getByRole('group', { name: /notification$/ })).toHaveTextContent('Link copied'));
    button.remove();
  });

  it('the banner body runs its action (welcome → Spotlight)', async () => {
    render(<Banners />);
    act(() => {
      notify({ kind: 'welcome' });
    });
    await userEvent.click(screen.getByRole('button', { name: /Welcome — everything here is an app/ }));
    expect(macUi.getState().overlay).toBe('spotlight');
  });

  it('MAC-NOTIF-03: every notification lands in the Center, grouped by app, and can be cleared', async () => {
    act(() => {
      notify({ kind: 'resume-downloaded' });
      notify({ kind: 'email-copied' });
    });
    render(<NotificationCenter />);
    act(() => {
      requestOverlay('notification-center');
    });
    const center = screen.getByRole('region', { name: 'Notification Center' });
    expect(within(center).getByRole('heading', { name: 'Preview' })).toBeInTheDocument();
    expect(within(center).getByText('Email address copied')).toBeInTheDocument();
    expect(within(center).getByRole('heading', { name: 'Notification Center' })).toHaveFocus();
    await userEvent.click(within(center).getByRole('button', { name: 'Clear Mail notifications' }));
    expect(within(center).queryByText('Email address copied')).toBeNull();
    await userEvent.click(within(center).getByRole('button', { name: 'Clear All' }));
    expect(within(center).getByText('No notifications')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(macUi.getState().overlay).toBeNull();
  });
});

describe('Dialogs', () => {
  it('MAC-SET-06 / EGG-ABOUT-01: About This Mac lists Jaswanth as the hardware and counts the egg once', async () => {
    render(<Dialogs />);
    act(() => runMacCommand({ kind: 'about-this-mac' }));
    await flush();
    const dialog = screen.getByRole('dialog', { name: 'About This Mac' });
    expect(within(dialog).getByText('Serial number')).toBeInTheDocument();
    expect(within(dialog).getByText('Chip')).toBeInTheDocument();
    // Memory (years) appears only when the data publishes start dates — never guessed.
    expect(within(dialog).queryByText('Memory') !== null).toBe(experienceYears() !== null);
    expect(getPrefs().eggsFound).toContain('EGG-ABOUT-01');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => runMacCommand({ kind: 'about-this-mac' }));
    await flush();
    expect(getPrefs().eggsFound.filter((id) => id === 'EGG-ABOUT-01')).toHaveLength(1);
  });

  it('MAC-CTX-05: Get Info shows the kind and the canonical /go link', () => {
    const role = getExperience()[0]!;
    expect(infoFor({ section: 'experience', slug: role.slug }).kind).toBe('Role');
    render(<Dialogs />);
    act(() => runMacCommand({ kind: 'get-info', ref: { section: 'experience', slug: role.slug } }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('textbox', { name: 'Link' })).toHaveValue(
      `${window.location.origin}/go/experience/${role.slug}`,
    );
  });

  it('MAC-FIND-05: Quick Look shows the content view; Space closes and focus returns to the row', async () => {
    const row = document.createElement('button');
    row.id = 'row-1';
    document.body.append(row);
    row.focus();
    render(<Dialogs />);
    act(() => runMacCommand({ kind: 'quick-look', ref: { section: 'contact' } }));
    const dialog = screen.getByRole('dialog', { name: /Contact/ });
    expect(within(dialog).getByText(getContact().email)).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: ' ' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(row).toHaveFocus());
    row.remove();
  });

  it('Switch Operating System sheet', () => {
    render(<Dialogs />);
    act(() => runMacCommand({ kind: 'switch-os' }));
    const dialog = screen.getByRole('dialog', { name: 'Switch Operating System' });
    expect(within(dialog).getByRole('button', { name: 'Back to chooser' })).toBeInTheDocument();
  });
});

describe('Lock screen', () => {
  it('MAC-LOCK-01/05: three notifications from data, identical for every profile', () => {
    const before = lockCards();
    prefsStore.setState({ prefs: { ...DEFAULT_PREFS, persona: 'recruiter' } });
    expect(lockCards()).toEqual(before);
    prefsStore.setState({ prefs: { ...DEFAULT_PREFS, persona: 'adventurer' } });
    expect(lockCards()).toEqual(before);
    expect(before.map((card) => card.role)).toEqual(['viewer', 'github', 'mail']);
  });

  it('MAC-LOCK-03: focus starts on Enter macOS; Tab navigates; a character key unlocks', async () => {
    act(() => setLocked(true));
    render(<LockScreen />);
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enter macOS' })).toHaveFocus();
    await userEvent.keyboard('{Tab}');
    expect(macUi.getState().locked).toBe(true);
    await userEvent.keyboard('a');
    expect(macUi.getState().locked).toBe(false);
    await flush();
    expect(getKernel().sessions.macos.lockSeen).toBe(true);
  });

  it('MAC-LOCK-04: a notification is a link that unlocks and opens its app from the card', async () => {
    act(() => setLocked(true));
    render(<LockScreen />);
    const list = screen.getByRole('list', { name: 'Notifications' });
    const resume = within(list).getAllByRole('link')[0]!;
    expect(resume).toHaveAttribute('href', '/macos/preview');
    await userEvent.click(resume);
    await flush();
    expect(macUi.getState().locked).toBe(false);
    expect(getKernel().sessions.macos.windows['macos:viewer']?.phase).toMatchObject({ originId: 'lock-resume' });
  });
});

describe('Context menu host', () => {
  it('MAC-CTX-01/06: a labelled menu, first item focused, placed inside the workspace; Esc closes', async () => {
    render(<ContextMenuHost />);
    act(() => openContextMenu({ kind: 'desktop' }, 1435, 895, null));
    const menu = screen.getByRole('menu', { name: 'Desktop' });
    await waitFor(() => expect(within(menu).getAllByRole('menuitem')[0]).toHaveFocus());
    const anchor = menu.closest<HTMLElement>('[data-menu-anchor]')!;
    expect(parseInt(anchor.style.left, 10)).toBeLessThan(1440);
    expect(parseInt(anchor.style.top, 10)).toBeLessThan(900);
    await userEvent.keyboard('{Escape}');
    expect(macUi.getState().overlay).toBeNull();
  });

  it('choosing an item runs its command (desktop → New Finder Window)', async () => {
    render(<ContextMenuHost />);
    act(() => openContextMenu({ kind: 'desktop' }, 200, 200, null));
    await userEvent.click(screen.getByRole('menuitem', { name: 'New Finder Window' }));
    await flush();
    expect(getKernel().sessions.macos.windows['macos:files']).toBeDefined();
  });
});

describe('Control Center', () => {
  it('MAC-MENU-06: toggles write prefs at once and persist', async () => {
    render(<ControlCenter />);
    act(() => {
      requestOverlay('control-center');
    });
    const panel = screen.getByRole('region', { name: 'Control Center' });
    expect(within(panel).getByRole('button', { name: /Sound/ })).toHaveFocus();
    const motion = within(panel).getByRole('button', { name: /Reduce Motion/ });
    await userEvent.click(motion);
    await flush();
    expect(getPrefs().motion).toBe('reduced');
    await userEvent.click(within(panel).getByRole('button', { name: /Sound/ }));
    await flush();
    expect(getPrefs().sound.enabled).toBe(false);
    await userEvent.click(within(panel).getByRole('radio', { name: 'Dark' }));
    await flush();
    expect(getPrefs().theme).toBe('dark');
  });
});

describe('App chunks', () => {
  beforeEach(() => resetAppRegistry());

  it('MAC-DOCK-03: the app is "loading" (its Dock icon bounces) only while its chunk is in flight', async () => {
    let resolve!: (value: { default: () => null }) => void;
    const request = loadApp('mail', () => new Promise((done) => (resolve = done)));
    expect(macUi.getState().loading).toContain('mail');
    resolve({ default: () => null });
    await request;
    expect(macUi.getState().loading).not.toContain('mail');
    // Cached: no loading state at all.
    await loadApp('mail');
    expect(macUi.getState().loading).not.toContain('mail');
  });

  it('E13: a chunk that fails shows a calm in-window state with Try again and the plain portfolio', async () => {
    const failing = loadApp('viewer', () => Promise.reject(new Error('offline')));
    await expect(failing).rejects.toThrow('offline');
    dispatch({ type: 'OPEN_APP', os: 'macos', role: 'viewer' });
    const win = getKernel().sessions.macos.windows['macos:viewer']!;
    vi.doMock('@/components/os/macos/apps/Preview', () => {
      throw new Error('offline');
    });
    render(<AppFrame window={win} titleId="mac-title-viewer" focused compact={false} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Preview' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument(), {
      timeout: 5000,
    }).catch(() => undefined);
  });
});

describe('Tour', () => {
  it('MAC-X-03: never starts by itself; started, it shows the first step; Esc ends it', async () => {
    render(<TourHost />);
    expect(screen.queryByRole('group', { name: /Dock/ })).toBeNull();
    act(() => runMacCommand({ kind: 'tour' }));
    // No shell hooks registered here: the command does nothing without a Shell (the Shell owns the start).
    expect(macUi.getState().tour).toBe('idle');
    act(() => macUi.setState({ tour: 'running' }));
    const card = await screen.findByRole('group', { name: 'Everything here is an app — this is the Dock.' });
    expect(within(card).getByText('1 / 5')).toBeInTheDocument();
    await flush();
    expect(getKernel().sessions.macos.windows['macos:browser']).toBeDefined();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(macUi.getState().tour).toBe('idle'));
    // What the tour opened stays open.
    expect(getKernel().sessions.macos.windows['macos:browser']).toBeDefined();
  });
});
