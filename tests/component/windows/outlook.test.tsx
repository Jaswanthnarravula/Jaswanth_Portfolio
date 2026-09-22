/**
 * Outlook in the real Windows window frame (plans/windows/apps/outlook.md), on the fixture portfolio:
 * WIN-OUT-01 (app rail, simplified ribbon, three panes, Focused/Other pivot, messages from data, unread clears) ·
 * WIN-OUT-02 (compose inside the reading pane; the draft lives in the kernel and survives a remount and a close/reopen;
 * Discard confirms only with text) · WIN-OUT-03 (Send = encoded mailto: + InfoBar + copy; long bodies truncated and
 * copied; Ctrl+Enter sends, Enter does not) · WIN-OUT-04 (the attachment chip opens Edge's résumé tab; Save as downloads)
 * · WIN-OUT-05 (compact push navigation, sticky Send, ribbon in ⋯) · WIN-OUT-06 (labelled form, status InfoBar, trapped
 * modal dialog; axe heading-order / label / list / listitem clean).
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { buildInbox, CONTINUED_NOTE, MAILTO_BODY_LIMIT } from '@/components/content';
import Outlook, { mailHandOff, resetOutlookSession } from '@/components/os/windows/apps/Outlook';
import { resetIntents } from '@/components/os/windows/intents';
import { WinShellProvider, type WinShellServices } from '@/components/os/windows/shell-context';
import { WinWindow } from '@/components/os/windows/window/Window';
import type { MenuEntry } from '@/components/primitives/Menu';
import { analytics } from '@/lib/analytics/loader';
import { currentLocation, DEFAULT_CAPABILITIES } from '@/lib/kernel/state';
import type { WindowId } from '@/lib/kernel/types';
import { dispatch, flushQueued, getKernel } from '@/stores/kernel-store';
import { fixturePortfolio as p } from '../../fixtures/portfolio';

const FILE = { bytes: 13_245, pages: 2 };

vi.mock('@/data/selectors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/selectors')>();
  const { fixturePortfolio } = await import('../../fixtures/portfolio');
  return {
    ...actual,
    getPerson: () => fixturePortfolio.person,
    getContact: () => fixturePortfolio.contact,
    getContactChannels: () => fixturePortfolio.contact.links,
    getResume: () => fixturePortfolio.resume,
    getResumeFile: () => fixturePortfolio.resume.file,
    getResumeFileMeta: () => ({ bytes: 13_245, pages: 2 }),
  };
});

const MAIL = 'windows:mail' as WindowId;
const inbox = buildInbox({ person: p.person, contact: p.contact, resume: p.resume, file: FILE });

interface Shell {
  readonly services: WinShellServices;
  readonly copyText: Mock<WinShellServices['copyText']>;
  readonly notify: Mock<WinShellServices['notify']>;
  readonly openMenu: Mock<WinShellServices['openMenu']>;
}
let shell: Shell;
/** The shell's services as test doubles: the clipboard works unless a test blocks it. */
function makeShell(): Shell {
  const copyText = vi.fn<WinShellServices['copyText']>(() => Promise.resolve(true));
  const notify = vi.fn<WinShellServices['notify']>();
  const openMenu = vi.fn<WinShellServices['openMenu']>();
  const services = {
    announce: vi.fn(),
    snapPreview: { show: vi.fn(), hide: vi.fn() },
    notify,
    openMenu,
    openPanel: vi.fn(),
    closePanel: vi.fn(),
    openSearch: vi.fn(),
    runInTerminal: vi.fn(),
    openWinver: vi.fn(),
    startTour: vi.fn(),
    showShortcuts: vi.fn(),
    copyLink: vi.fn(() => Promise.resolve(true)),
    copyText,
    openProperties: vi.fn(),
    setDragging: vi.fn(),
    peek: null,
  } as WinShellServices;
  return { services, copyText, notify, openMenu };
}

let booted = false;
function viewport(w: number, h: number) {
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

function openOutlook() {
  act(() => {
    dispatch({ type: 'OPEN_APP', os: 'windows', role: 'mail' });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id: MAIL } });
  });
}

function renderOutlook({ compact = false } = {}) {
  return render(
    <WinShellProvider value={shell.services}>
      <WinWindow
        id={MAIL}
        zIndex={100}
        focused
        compact={compact}
        touch={false}
        shownInCompact
        dimmed={false}
        body={(props) => <Outlook {...props} />}
      />
    </WinShellProvider>,
  );
}

/** Commit presses still waiting for paint (dispatchSoon) — the kernel then holds what the visitor did. */
const flush = () =>
  act(() => {
    flushQueued();
  });

const kernelDraft = () => getKernel().sessions.windows.windows[MAIL]?.draft ?? '';
const readingPane = () => screen.getByRole('region', { name: 'Reading pane' });
const menuItems = (call: number) =>
  (shell.openMenu.mock.calls[call]![0] as { items: readonly MenuEntry[] }).items.flatMap((item) =>
    item.kind === 'item' ? [item] : [],
  );

let track: ReturnType<typeof vi.spyOn>;
let handOff: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  viewport(1440, 900);
  act(() => closeAll());
  resetOutlookSession();
  resetIntents();
  shell = makeShell();
  track = vi.spyOn(analytics, 'track').mockImplementation(() => undefined);
  handOff = vi.spyOn(mailHandOff, 'open').mockImplementation(() => undefined);
  openOutlook();
});

describe('WIN-OUT-01 shell: app rail, simplified ribbon, three panes, Focused/Other pivot, messages from data', () => {
  it('renders the new Outlook anatomy inside the window region', () => {
    renderOutlook();
    const window = screen.getByRole('region', { name: 'Outlook' });
    expect(within(window).getByRole('heading', { level: 2, name: 'Outlook' })).toBeInTheDocument();
    expect(within(window).getByRole('searchbox', { name: 'Search mail' })).toBeInTheDocument();

    const rail = within(window).getByRole('navigation', { name: 'Outlook apps' });
    expect(within(rail).getByRole('button', { name: 'Mail' })).toHaveAttribute('aria-current', 'page');
    expect(within(rail).getByRole('button', { name: 'Calendar' })).toBeDisabled();
    expect(within(rail).getByRole('button', { name: 'People' })).toBeDisabled();

    const ribbon = within(window).getByRole('toolbar', { name: 'Mail commands' });
    expect(
      within(ribbon)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label') ?? button.textContent),
    ).toEqual(['New mail', 'Reply', 'Copy address', 'More options']);
    expect(within(ribbon).getByRole('button', { name: 'Reply' })).toBeDisabled();

    const folders = within(window).getByRole('navigation', { name: 'Folders' });
    expect(
      within(folders)
        .getAllByRole('button', { name: /^(Inbox|Sent Items|Drafts)/ })
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Inbox, 3 unread', 'Sent Items', 'Drafts']);
    expect(within(folders).getByRole('button', { name: 'Inbox, 3 unread' })).toHaveAttribute('aria-current', 'page');

    const pivot = within(window).getByRole('tablist', { name: 'Inbox view' });
    expect(within(pivot).getByRole('tab', { name: 'Focused' })).toHaveAttribute('aria-selected', 'true');
    expect(within(pivot).getByRole('tab', { name: 'Other' })).toHaveAttribute('aria-selected', 'false');

    expect(within(readingPane()).getByText('Select an item to read')).toBeInTheDocument();
  });

  it('lists the three data-generated messages with full names; selecting one reads it and clears unread', async () => {
    const user = userEvent.setup();
    renderOutlook();
    const list = screen.getByRole('list', { name: 'Messages' });
    const rows = within(list).getAllByRole('button');
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual(
      inbox.map((message) =>
        [
          'Unread',
          message.from.name,
          message.subject,
          message.preview,
          message.dateLabel,
          message.attachment ? 'Has attachments' : null,
          message.pinned ? 'Pinned' : null,
        ]
          .filter(Boolean)
          .join(', '),
      ),
    );
    expect(rows[0]!.getAttribute('aria-label')).toMatch(/^Unread, Ada Example, Let's talk, .*Open to tests\./);
    expect(within(rows[0]!).getByText('1/1/2026')).toBeInTheDocument();

    await user.click(rows[0]!);
    const pane = readingPane();
    expect(within(pane).getByRole('heading', { level: 3, name: "Let's talk" })).toBeInTheDocument();
    expect(within(pane).getByText('Ada Example')).toBeInTheDocument();
    expect(within(pane).getByText('<ada@example.com>')).toBeInTheDocument();
    for (const paragraph of inbox[0]!.body) expect(within(pane).getByText(paragraph)).toBeInTheDocument();
    expect(within(pane).getByRole('button', { name: 'Reply by email' })).toBeInTheDocument();
    expect(within(pane).getByRole('button', { name: 'Copy address' })).toBeInTheDocument();
    // The fixture publishes no LinkedIn: the action is simply not rendered.
    expect(within(pane).queryByRole('link', { name: /LinkedIn/ })).toBeNull();

    expect(rows[0]).toHaveAttribute('aria-current', 'true');
    expect(rows[0]!.getAttribute('aria-label')).toMatch(/^Ada Example, Let's talk/);
    expect(screen.getByRole('button', { name: 'Inbox, 2 unread' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reply' })).toBeEnabled();

    // "Where to find me": the links as buttons (new tab, noopener).
    await user.click(rows[1]!);
    const github = within(readingPane()).getByRole('link', { name: /GitHub @ada/ });
    expect(github).toHaveAttribute('href', 'https://github.com/ada');
    expect(github).toHaveAttribute('target', '_blank');
    expect(github).toHaveAttribute('rel', 'noopener noreferrer');
    await user.click(github);
    expect(track).toHaveBeenCalledWith({ name: 'contact_initiated', channel: 'link' });
  });

  it('"Other" is empty with a friendly line; the search box filters the folder', async () => {
    const user = userEvent.setup();
    renderOutlook();
    await user.click(screen.getByRole('tab', { name: 'Other' }));
    expect(screen.getByText('Nothing in Other')).toBeInTheDocument();
    expect(screen.getByText('Everything from Ada lands in Focused.')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Focused' }));

    await user.type(screen.getByRole('searchbox', { name: 'Search mail' }), 'résumé');
    expect(within(screen.getByRole('list', { name: 'Messages' })).getAllByRole('button')).toHaveLength(1);
    await user.keyboard('{Escape}');
    expect(within(screen.getByRole('list', { name: 'Messages' })).getAllByRole('button')).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Sent Items' }));
    expect(screen.getByRole('heading', { level: 3, name: 'Sent Items' })).toBeInTheDocument();
    expect(screen.getByText('Messages you send open in your own mail app.')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('Copy address copies through the shell (its toast) and is tracked', async () => {
    const user = userEvent.setup();
    renderOutlook();
    await user.click(within(screen.getByRole('toolbar')).getByRole('button', { name: 'Copy address' }));
    expect(shell.copyText).toHaveBeenCalledWith('ada@example.com', 'Copied to clipboard');
    expect(track).toHaveBeenCalledWith({ name: 'contact_initiated', channel: 'copy' });
    expect(screen.queryByRole('group', { name: /clipboard is blocked/ })).toBeNull();
  });

  it('a blocked clipboard shows the address selected in a read-only field (Ctrl+C)', async () => {
    const user = userEvent.setup();
    shell.copyText.mockResolvedValue(false);
    renderOutlook();
    await user.click(within(screen.getByRole('toolbar')).getByRole('button', { name: 'Copy address' }));
    const bar = await screen.findByRole('group', {
      name: /clipboard is blocked here\. Press Ctrl\+C to copy the address/,
    });
    const field = within(bar).getByRole('textbox') as HTMLInputElement;
    expect(field).toHaveValue('ada@example.com');
    expect(field).toHaveAttribute('readonly');
    expect(field).toHaveFocus();
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 'ada@example.com'.length]);
    await user.click(within(bar).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('group', { name: /clipboard is blocked/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'New mail' })).toHaveFocus();
  });
});

describe('WIN-OUT-02 compose inside the reading pane, persisted draft, discard confirm', () => {
  it('New mail swaps the reading pane to the compose form; the draft is written to the kernel window', async () => {
    const user = userEvent.setup();
    renderOutlook();
    await user.click(screen.getByRole('button', { name: 'New mail' }));
    const form = within(readingPane()).getByRole('form', { name: 'New message' });
    expect(within(form).getByRole('textbox', { name: 'To' })).toHaveValue('ada@example.com');
    expect(within(form).getByRole('textbox', { name: 'To' })).toHaveAttribute('readonly');
    const subject = within(form).getByRole('textbox', { name: 'Subject' });
    expect(subject).toHaveFocus();
    await user.type(subject, 'Hello');
    await user.type(within(form).getByRole('textbox', { name: 'Message' }), 'Nice portfolio');
    flush();
    expect(JSON.parse(kernelDraft())).toMatchObject({ open: true, subject: 'Hello', body: 'Nice portfolio' });
    expect(screen.getByRole('button', { name: 'Drafts, 1 item' })).toBeInTheDocument();
  });

  it('a remount restores the compose state from the kernel draft (reload path)', async () => {
    const user = userEvent.setup();
    const first = renderOutlook();
    await user.click(screen.getByRole('button', { name: 'New mail' }));
    await user.type(screen.getByRole('textbox', { name: 'Subject' }), 'Kept');
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Across a reload');
    flush();
    first.unmount();
    resetOutlookSession(); // only the kernel remembers now
    renderOutlook();
    const form = within(readingPane()).getByRole('form', { name: 'New message' });
    expect(within(form).getByRole('textbox', { name: 'Subject' })).toHaveValue('Kept');
    expect(within(form).getByRole('textbox', { name: 'Message' })).toHaveValue('Across a reload');
  });

  it('closing the window keeps the draft; reopening restores the compose state', async () => {
    const user = userEvent.setup();
    renderOutlook();
    await user.click(screen.getByRole('button', { name: 'New mail' }));
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Do not lose me');
    flush();
    act(() => {
      dispatch({ type: 'CLOSE_WINDOW', id: MAIL });
      dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id: MAIL } });
    });
    expect(screen.queryByRole('region', { name: 'Outlook' })).toBeNull();
    openOutlook();
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Do not lose me');
    flush();
    expect(JSON.parse(kernelDraft())).toMatchObject({ body: 'Do not lose me' });
  });

  it('selecting a message sets the draft aside in Drafts (1); opening it from Drafts resumes it', async () => {
    const user = userEvent.setup();
    renderOutlook();
    await user.click(screen.getByRole('button', { name: 'New mail' }));
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Later');
    await user.click(within(screen.getByRole('list', { name: 'Messages' })).getAllByRole('button')[0]!);
    expect(screen.queryByRole('form')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Drafts, 1 item' }));
    const row = within(screen.getByRole('list', { name: 'Drafts' })).getByRole('button');
    expect(row.getAttribute('aria-label')).toBe('Draft, To Ada Example, (No subject), Later');
    await user.click(row);
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Later');
  });

  it('Discard asks only when there is text: Keep keeps it, Discard clears the kernel draft', async () => {
    const user = userEvent.setup();
    renderOutlook();
    // No text → no question.
    await user.click(screen.getByRole('button', { name: 'New mail' }));
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('form')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'New mail' }));
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Text');
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    const dialog = screen.getByRole('dialog', { name: 'Discard this draft?' });
    expect(within(dialog).getByRole('button', { name: 'Keep' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Keep' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('Text');
    expect(screen.getByRole('button', { name: 'Discard' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Discard' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Discard' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('form')).toBeNull();
    flush();
    expect(kernelDraft()).toBe('');
    expect(screen.getByRole('button', { name: 'Drafts' })).toBeInTheDocument();
    expect(document.activeElement).not.toBe(document.body);
  });

  it('a compose intent (jump list) opens a new message', async () => {
    const { requestIntent } = await import('@/components/os/windows/intents');
    renderOutlook();
    await act(async () => {
      requestIntent({ kind: 'compose' });
    });
    expect(within(readingPane()).getByRole('form', { name: 'New message' })).toBeInTheDocument();
  });
});

describe('WIN-OUT-03 Send = encoded mailto: + InfoBar + copy fallback', () => {
  it('hands an encoded mailto: to the email app, then the InfoBar offers Copy', async () => {
    const user = userEvent.setup();
    renderOutlook();
    await user.click(within(screen.getByRole('list', { name: 'Messages' })).getAllByRole('button')[0]!);
    await user.click(screen.getByRole('button', { name: 'Reply by email' }));
    const subject = screen.getByRole('textbox', { name: 'Subject' });
    expect(subject).toHaveValue("Re: Let's talk");
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveFocus();
    await user.clear(subject);
    await user.type(subject, 'Hi & hello');
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Line 1{Enter}Line 2');
    expect(handOff).not.toHaveBeenCalled(); // Enter in the message never sends
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(handOff).toHaveBeenCalledWith('mailto:ada@example.com?subject=Hi%20%26%20hello&body=Line%201%0D%0ALine%202');
    expect(track).toHaveBeenCalledWith({ name: 'contact_initiated', channel: 'mailto' });
    const status = within(readingPane()).getByRole('status');
    expect(status).toHaveTextContent('Handed to your email app. Nothing opened? Copy the address.');
    const copy = within(status).getByRole('button', { name: 'Copy' });
    expect(copy).toHaveFocus();
    await user.click(copy);
    expect(shell.copyText).toHaveBeenCalledWith('ada@example.com', 'Copied to clipboard');
    expect(track).toHaveBeenCalledWith({ name: 'contact_initiated', channel: 'copy' });
    await waitFor(() => expect(screen.queryByRole('form')).toBeNull());
    flush();
    expect(kernelDraft()).toBe('');
    // The reply's message is back in the reading pane under the InfoBar.
    expect(within(readingPane()).getByRole('heading', { level: 3, name: "Let's talk" })).toBeInTheDocument();
  });

  it('Ctrl+Enter sends; a long body is cut with the note and copied whole', async () => {
    const user = userEvent.setup();
    renderOutlook();
    await user.click(screen.getByRole('button', { name: 'New mail' }));
    const long = 'x'.repeat(MAILTO_BODY_LIMIT + 200);
    const body = screen.getByRole('textbox', { name: 'Message' });
    fireEvent.change(body, { target: { value: long } });
    body.focus();
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(handOff).toHaveBeenCalledTimes(1);
    const url = handOff.mock.calls[0]![0] as string;
    const carried = decodeURIComponent(url.split('body=')[1]!);
    expect(carried.endsWith(CONTINUED_NOTE)).toBe(true);
    expect(carried.replace(/\r\n/g, '\n').length).toBeLessThanOrEqual(MAILTO_BODY_LIMIT);
    expect(shell.copyText).toHaveBeenCalledWith(long, expect.any(String));
    const status = within(readingPane()).getByRole('status');
    expect(status).toHaveTextContent('Your message was long, so only its first part went across.');
    await waitFor(() => expect(status).toHaveTextContent('The full text is on your clipboard — paste it in.'));
  });

  it('a long body with the clipboard blocked: no clipboard claim; the full text shows selected to copy by hand', async () => {
    const user = userEvent.setup();
    shell.copyText.mockResolvedValue(false);
    renderOutlook();
    await user.click(screen.getByRole('button', { name: 'New mail' }));
    const long = 'y'.repeat(MAILTO_BODY_LIMIT + 50);
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: long } });
    await user.click(screen.getByRole('button', { name: 'Send' }));
    const field = within(
      await screen.findByRole('group', { name: /Press Ctrl\+C to copy your whole message/ }),
    ).getByRole('textbox');
    expect(field).toHaveValue(long);
    expect(field).toHaveFocus();
    expect(within(readingPane()).getByRole('status')).not.toHaveTextContent('clipboard');
  });
});

describe('WIN-OUT-04 attachment chip → Edge PDF tab / download', () => {
  it('the chip is a real link to /windows/edge/resume that opens Edge at the résumé', async () => {
    const user = userEvent.setup();
    renderOutlook();
    await user.click(within(screen.getByRole('list', { name: 'Messages' })).getAllByRole('button')[2]!);
    const chip = within(readingPane()).getByRole('link', { name: /^Ada-Resume\.pdf, PDF, 13 KB\. Open in / });
    expect(chip).toHaveAttribute('href', '/windows/edge/resume');
    expect(within(chip).getByText('13 KB')).toBeInTheDocument();
    await user.click(chip);
    flush();
    const edge = getKernel().sessions.windows.windows['windows:browser' as WindowId];
    expect(edge).toBeDefined();
    expect(currentLocation(edge!)).toEqual({ kind: 'content', ref: { section: 'resume' } });
  });

  it('the chevron menu offers Open · Save as; Save as downloads the PDF with the Windows toast', async () => {
    const user = userEvent.setup();
    renderOutlook();
    await user.click(within(screen.getByRole('list', { name: 'Messages' })).getAllByRole('button')[2]!);
    await user.click(screen.getByRole('button', { name: 'More actions for Ada-Resume.pdf' }));
    const items = menuItems(0);
    expect(items.map((item) => item.label)).toEqual(['Open', 'Save as']);

    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });
    act(() => items[1]!.onSelect());
    expect(clicked).toHaveLength(1);
    expect(clicked[0]!.getAttribute('href')).toBe('/resume/ada.pdf');
    expect(clicked[0]!.getAttribute('download')).toBe('Ada-Resume.pdf');
    expect(clicked[0]!.hasAttribute('data-resume-download')).toBe(true);
    expect(clicked[0]!.isConnected).toBe(false);
    expect(track).toHaveBeenCalledWith({ name: 'resume_downloaded', os: 'windows' });
    expect(shell.notify).toHaveBeenCalledWith(expect.objectContaining({ id: 'download-resume', title: 'Résumé.pdf' }));

    act(() => items[0]!.onSelect());
    flush();
    expect(currentLocation(getKernel().sessions.windows.windows['windows:browser' as WindowId]!)).toEqual({
      kind: 'content',
      ref: { section: 'resume' },
    });
  });
});

describe('WIN-OUT-05 compact: push navigation, sticky Send, ribbon folded into ⋯', () => {
  beforeEach(() => {
    act(() => viewport(390, 844));
  });

  it('list → message push with a back arrow; focus follows the visible pane', async () => {
    const user = userEvent.setup();
    renderOutlook({ compact: true });
    const ribbon = screen.getByRole('toolbar', { name: 'Mail commands' });
    expect(
      within(ribbon)
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label') ?? b.textContent),
    ).toEqual(['Folders', 'New mail', 'More options']);
    expect(screen.queryByRole('region', { name: 'Reading pane' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Folders' })).toBeNull();

    const rows = within(screen.getByRole('list', { name: 'Messages' })).getAllByRole('button');
    await user.click(rows[0]!);
    expect(screen.queryByRole('list', { name: 'Messages' })).toBeNull();
    const heading = within(readingPane()).getByRole('heading', { level: 3, name: "Let's talk" });
    expect(heading).toHaveFocus();

    await user.click(within(readingPane()).getByRole('button', { name: 'Back to Inbox' }));
    expect(screen.queryByRole('region', { name: 'Reading pane' })).toBeNull();
    const list = screen.getByRole('list', { name: 'Messages' });
    expect(within(list).getAllByRole('button')[0]).toHaveFocus();

    await user.click(within(ribbon).getByRole('button', { name: 'More options' }));
    expect(menuItems(0).map((item) => item.label)).toEqual([
      'Reply',
      'Copy address',
      'Mark as unread', // the message just read stays selected
      'Open résumé',
      'Save résumé',
    ]);

    await user.click(within(ribbon).getByRole('button', { name: 'Folders' }));
    const folders = screen.getByRole('navigation', { name: 'Folders' });
    expect(screen.queryByRole('list', { name: 'Messages' })).toBeNull();
    await user.click(within(folders).getByRole('button', { name: 'Sent Items' }));
    expect(screen.queryByRole('navigation', { name: 'Folders' })).toBeNull();
    expect(screen.getByRole('heading', { level: 3, name: 'Sent Items' })).toHaveFocus();
  });

  it('compose is full-height with the Send bar after the message (sticky above the safe area)', async () => {
    const user = userEvent.setup();
    renderOutlook({ compact: true });
    await user.click(screen.getByRole('button', { name: 'New mail' }));
    const form = within(readingPane()).getByRole('form', { name: 'New message' });
    const message = within(form).getByRole('textbox', { name: 'Message' });
    const send = within(form).getByRole('button', { name: 'Send' });
    expect(message.compareDocumentPosition(send) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Messages' })).toBeNull();
    await user.click(within(readingPane()).getByRole('button', { name: 'Back to Inbox' }));
    expect(screen.getByRole('list', { name: 'Messages' })).toBeInTheDocument();
  });
});

describe('WIN-OUT-06 form semantics, status InfoBar, modal confirm, axe clean', () => {
  const RULES = [
    'heading-order',
    'label',
    'list',
    'listitem',
    'aria-allowed-attr',
    'aria-valid-attr-value',
    'button-name',
  ];
  const audit = async (container: HTMLElement) =>
    (await axe.run(container, { runOnly: { type: 'rule', values: RULES } })).violations.map(
      (violation) => violation.id,
    );

  it('reading, compose and the discard dialog pass axe; the dialog is a trapped modal', async () => {
    const user = userEvent.setup();
    const { container } = renderOutlook();
    expect(within(readingPane()).getByRole('status')).toBeInTheDocument(); // present before anything is announced
    await user.click(within(screen.getByRole('list', { name: 'Messages' })).getAllByRole('button')[2]!);
    expect(await audit(container)).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'New mail' }));
    const form = screen.getByRole('form', { name: 'New message' });
    for (const name of ['To', 'Subject', 'Message']) expect(within(form).getByLabelText(name)).toBeInTheDocument();
    expect(within(form).getByRole('button', { name: 'Send' })).toHaveAttribute('type', 'submit');
    expect(await audit(container)).toEqual([]);

    await user.type(within(form).getByRole('textbox', { name: 'Message' }), 'Text');
    await user.click(within(form).getByRole('button', { name: 'Discard' }));
    const dialog = screen.getByRole('dialog', { name: 'Discard this draft?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(container.querySelector('nav[aria-label="Outlook apps"]')).toHaveAttribute('inert');
    const keep = within(dialog).getByRole('button', { name: 'Keep' });
    expect(keep).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole('button', { name: 'Discard' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(keep).toHaveFocus();
    expect(await audit(container)).toEqual([]);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(form).getByRole('textbox', { name: 'Message' })).toHaveValue('Text');
  });
});
