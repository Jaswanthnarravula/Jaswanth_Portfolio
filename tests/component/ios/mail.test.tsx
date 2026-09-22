/**
 * iOS Mail (plans/ios/apps/mail.md): Mailboxes → Inbox → Message from data (IOS-MAIL-01), compose + draft + action
 * sheet (02), the mailto hand-off (03), the attachment → Quick Look (04), 17 px inputs + the pad split view (05), form
 * / dialog semantics, the swipe alternatives and axe (06). Keyboard-up and the real swipe are e2e.
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import Mail, { mailHandOff } from '@/components/os/ios/apps/Mail';
import * as M from '@/components/os/ios/apps/mail-model';
import { requestIntent, resetIntents } from '@/components/os/ios/intents';
import { buildInbox, CONTINUED_NOTE, MAILTO_BODY_LIMIT } from '@/components/content';
import { getContact, getPerson, getResume, getResumeFileMeta } from '@/data/selectors';
import { analytics } from '@/lib/analytics/loader';
import type { WindowId } from '@/lib/kernel/types';
import { dispatch, getKernel } from '@/stores/kernel-store';
import { closeAllIos, renderIosApp, settle } from './harness';

const MAIL = 'ios:mail' as WindowId;
const inbox = buildInbox({
  person: getPerson(),
  contact: getContact(),
  resume: getResume(),
  file: getResumeFileMeta(),
});
const email = getContact().email;
const win = () => getKernel().sessions.ios.windows[MAIL]!;
const top = () => {
  const screens = [...document.querySelectorAll<HTMLElement>('[data-screen]')].filter(
    (el) => !el.hidden && !el.hasAttribute('inert'),
  );
  return screens[screens.length - 1]!;
};

let handOff: MockInstance;
let track: MockInstance;

async function audit(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: { region: { enabled: false }, 'color-contrast': { enabled: false } },
  });
  return results.violations.map(
    (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
  );
}

async function toInbox() {
  fireEvent.click(within(top()).getByRole('link', { name: /^Inbox/ }));
  await settle();
}

async function compose() {
  fireEvent.click(within(top()).getByRole('button', { name: 'Compose' }));
  await settle();
  return screen.getByRole('dialog', { name: 'New Message' });
}

beforeEach(() => {
  act(() => closeAllIos());
  resetIntents();
  handOff = vi.spyOn(mailHandOff, 'open').mockImplementation(() => undefined);
  track = vi.spyOn(analytics, 'track').mockImplementation(() => undefined);
});
afterEach(() => act(() => closeAllIos()));

describe('IOS-MAIL-01 Mailboxes → Inbox → Message with data-generated messages', () => {
  it('Mailboxes lists Inbox (1 unread) · Sent · Drafts; the Inbox lists the three messages from data', async () => {
    renderIosApp(Mail, 'mail');
    expect(within(top()).getByRole('heading', { level: 3, name: 'Mailboxes' })).toBeInTheDocument();
    const unread = inbox.filter((message) => message.unread).length;
    expect(
      within(top())
        .getAllByRole('link')
        .map((link) => link.getAttribute('aria-label')),
    ).toEqual([`Inbox, ${unread} unread`, 'Sent', 'Drafts']);
    await toInbox();
    const list = top();
    expect(within(list).getByRole('heading', { level: 3, name: 'Inbox' })).toBeInTheDocument();
    expect(within(list).getByRole('searchbox', { name: 'Search mail' })).toBeInTheDocument();
    const rows = within(list)
      .getAllByRole('link')
      .map((link) => link.getAttribute('aria-label'));
    expect(rows).toEqual(inbox.map((message) => M.rowLabel(message, message.unread)));
    expect(rows[0]).toMatch(new RegExp(`^Unread\\. ${getPerson().name}\\. Let's talk\\.`));
    const toolbar = within(list).getByRole('toolbar');
    expect(toolbar).toHaveTextContent('Updated Just Now');
    expect(
      within(toolbar)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Compose']);
  });

  it('opening a message pushes it, clears its dot and records it in ui.read (the Home badge reads this)', async () => {
    renderIosApp(Mail, 'mail');
    await toInbox();
    const talk = inbox[0]!;
    fireEvent.click(within(top()).getByRole('link', { name: M.rowLabel(talk, true) }));
    await settle();
    expect(JSON.parse(win().ui!.read!)).toEqual(['lets-talk']);
    const message = top();
    expect(within(message).getByRole('heading', { level: 3, name: talk.subject })).toBeInTheDocument();
    const article = within(message).getByRole('article', { name: talk.subject });
    for (const paragraph of talk.body) expect(article).toHaveTextContent(paragraph);
    expect(article).toHaveTextContent(talk.from.initials);
    expect(
      within(within(message).getByRole('toolbar'))
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Reply', 'Copy address', 'Share']);
    fireEvent.click(within(message).getByRole('button', { name: 'Back to Inbox' }));
    await settle();
    expect(within(top()).getByRole('link', { name: M.rowLabel(talk, false) })).toBeInTheDocument();
    // The stack is session state.
    expect(JSON.parse(win().ui!.stack!)).toEqual(['inbox']);
  });

  it('Sent and Drafts', async () => {
    renderIosApp(Mail, 'mail');
    fireEvent.click(within(top()).getByRole('link', { name: 'Sent' }));
    await settle();
    expect(within(top()).getByRole('status')).toHaveTextContent('Messages open in your own mail app.');
    fireEvent.click(within(top()).getByRole('button', { name: 'Back to Mailboxes' }));
    await settle();
    fireEvent.click(within(top()).getByRole('link', { name: 'Drafts' }));
    await settle();
    expect(within(top()).getByRole('status')).toHaveTextContent('No Drafts');
  });

  it('search filters the inbox', async () => {
    renderIosApp(Mail, 'mail');
    await toInbox();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search mail' }), { target: { value: 'résumé' } });
    await settle();
    expect(
      within(top())
        .getAllByRole('link')
        .map((link) => link.getAttribute('aria-label')),
    ).toEqual([M.rowLabel(inbox[2]!, true)]);
  });
});

describe('IOS-MAIL-02 compose sheet with draft persistence and the Delete / Save action sheet', () => {
  it('text persists to the kernel (draft + ui.subject + ui.compose) and the sheet reopens after a remount', async () => {
    const first = renderIosApp(Mail, 'mail');
    await toInbox();
    const sheet = await compose();
    fireEvent.input(within(sheet).getByRole('textbox', { name: 'Subject:' }), { target: { value: 'Hello there' } });
    fireEvent.input(within(sheet).getByRole('textbox', { name: 'Message' }), { target: { value: 'A draft body' } });
    await settle();
    expect(win().draft).toBe('A draft body');
    expect(win().ui).toMatchObject({ compose: '1', subject: 'Hello there' });
    // Reload / eviction: a fresh body restores the sheet with its text.
    first.unmount();
    renderIosApp(Mail, 'mail');
    await settle();
    const again = screen.getByRole('dialog', { name: 'Hello there' });
    expect(within(again).getByRole('textbox', { name: 'Subject:' })).toHaveValue('Hello there');
    expect(within(again).getByRole('textbox', { name: 'Message' })).toHaveValue('A draft body');
  });

  it('Cancel with text → "Delete Draft / Save Draft"; Save keeps it in Drafts; Delete clears it', async () => {
    renderIosApp(Mail, 'mail');
    await toInbox();
    let sheet = await compose();
    fireEvent.input(within(sheet).getByRole('textbox', { name: 'Message' }), { target: { value: 'Keep me' } });
    await settle();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await settle();
    const actions = screen.getByRole('dialog', { name: 'Delete this draft?' });
    expect(
      within(actions)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Delete Draft', 'Save Draft', 'Cancel']);
    fireEvent.click(within(actions).getByRole('button', { name: 'Save Draft' }));
    await settle();
    expect(win().ui?.compose).toBeUndefined();
    expect(JSON.parse(win().ui!.saved!)).toEqual({ subject: '', body: 'Keep me' });
    fireEvent.click(within(top()).getByRole('button', { name: 'Back to Mailboxes' }));
    await settle();
    fireEvent.click(within(top()).getByRole('link', { name: 'Drafts, 1 draft' }));
    await settle();
    fireEvent.click(within(top()).getByRole('button', { name: /^Draft\. No Subject\. Keep me/ }));
    await settle();
    sheet = screen.getByRole('dialog', { name: 'New Message' });
    expect(within(sheet).getByRole('textbox', { name: 'Message' })).toHaveValue('Keep me');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await settle();
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Delete this draft?' })).getByRole('button', { name: 'Delete Draft' }),
    );
    await settle();
    expect(win().draft).toBe('');
    expect(win().ui?.saved).toBeUndefined();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Cancel without text simply closes (no action sheet)', async () => {
    renderIosApp(Mail, 'mail');
    await toInbox();
    const sheet = await compose();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel' }));
    await settle();
    expect(screen.queryByRole('dialog', { name: 'Delete this draft?' })).toBeNull();
    expect(win().ui?.compose).toBeUndefined();
  });

  it('the Home quick action "New Message" (compose intent) opens the sheet', async () => {
    renderIosApp(Mail, 'mail');
    await settle();
    act(() => requestIntent({ kind: 'compose' }));
    await settle();
    expect(screen.getByRole('dialog', { name: 'New Message' })).toBeInTheDocument();
  });

  it('Reply prefills "Re: {subject}"', async () => {
    renderIosApp(Mail, 'mail');
    await toInbox();
    fireEvent.click(within(top()).getByRole('link', { name: M.rowLabel(inbox[0]!, true) }));
    await settle();
    fireEvent.click(within(top()).getByRole('button', { name: 'Reply' }));
    await settle();
    const sheet = screen.getByRole('dialog', { name: "Re: Let's talk" });
    expect(within(sheet).getByRole('textbox', { name: 'Subject:' })).toHaveValue("Re: Let's talk");
  });
});

describe('IOS-MAIL-03 Send = an encoded mailto: hand-off + a banner with the copy fallback', () => {
  it('encodes subject and body, emits contact_initiated, dismisses and says "Handed to your mail app"', async () => {
    const { calls } = renderIosApp(Mail, 'mail');
    await toInbox();
    const sheet = await compose();
    fireEvent.input(within(sheet).getByRole('textbox', { name: 'Subject:' }), { target: { value: 'Hi & hello' } });
    fireEvent.input(within(sheet).getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Line one\nLine two?' },
    });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Send' }));
    await settle();
    expect(handOff).toHaveBeenCalledWith(`mailto:${email}?subject=Hi%20%26%20hello&body=Line%20one%0D%0ALine%20two%3F`);
    expect(track).toHaveBeenCalledWith({ name: 'contact_initiated', channel: 'mailto' });
    expect(screen.queryByRole('dialog', { name: /New Message|Hi & hello/ })).toBeNull();
    expect(win().draft).toBe('');
    const banner = calls.notify?.[0]?.[0] as { title: string; actions: { label: string; run: () => void }[] };
    expect(banner.title).toBe('Handed to your mail app');
    expect(banner.actions.map((action) => action.label)).toEqual(['Copy address']);
    act(() => banner.actions[0]!.run());
    await settle();
    expect(calls.copy?.[0]).toEqual([email, 'Email address']);
  });

  it('a body over the limit is cut with the note and the full text is copied', async () => {
    const { calls } = renderIosApp(Mail, 'mail');
    await toInbox();
    const sheet = await compose();
    const long = 'word '.repeat(600).trim();
    fireEvent.input(within(sheet).getByRole('textbox', { name: 'Message' }), { target: { value: long } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Send' }));
    await settle();
    const url = handOff.mock.calls[0]![0] as string;
    const body = decodeURIComponent(url.split('body=')[1]!).replace(/\r\n/g, '\n');
    expect(body.length).toBeLessThanOrEqual(MAILTO_BODY_LIMIT);
    expect(body.endsWith(CONTINUED_NOTE)).toBe(true);
    expect(calls.copy?.[0]?.[0]).toBe(long);
  });

  it('Copy address falls back to a sheet with the address selected when the clipboard is blocked', async () => {
    const view = renderIosApp(Mail, 'mail');
    (view.services.copy as unknown as MockInstance).mockImplementation(async () => false);
    await toInbox();
    fireEvent.click(within(top()).getByRole('link', { name: M.rowLabel(inbox[0]!, true) }));
    await settle();
    fireEvent.click(within(top()).getByRole('button', { name: 'Copy address' }));
    await settle();
    expect(track).toHaveBeenCalledWith({ name: 'contact_initiated', channel: 'copy' });
    const sheet = screen.getByRole('dialog', { name: 'Email Address' });
    expect(within(sheet).getByRole('textbox', { name: 'Copy this address' })).toHaveValue(email);
  });
});

describe('IOS-MAIL-04 the attachment opens the résumé in Files (Quick Look)', () => {
  it('attachment tile names the file with type + size and opens {section: resume}', async () => {
    const { calls } = renderIosApp(Mail, 'mail');
    await toInbox();
    const cv = inbox.find((message) => message.attachment)!;
    fireEvent.click(within(top()).getByRole('link', { name: M.rowLabel(cv, true) }));
    await settle();
    const tile = within(top()).getByRole('link', { name: /^Attachment:/ });
    expect(tile).toHaveAttribute('href', '/ios/files/resume');
    expect(tile.getAttribute('aria-label')).toContain(cv.attachment!.label);
    fireEvent.click(tile);
    expect(calls.openContent?.[0]?.[0]).toEqual({ section: 'resume' });
  });
});

describe('IOS-MAIL-05 keyboard-safe compose (17 px fields, Send in the header) and the pad split view', () => {
  it('Send lives in the sheet header, before the form', async () => {
    renderIosApp(Mail, 'mail');
    await toInbox();
    const sheet = await compose();
    const send = within(sheet).getByRole('button', { name: 'Send' });
    const formEl = within(sheet).getByRole('form', { name: 'New message' });
    expect(send.compareDocumentPosition(formEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Send is the form's submit button.
    expect(send).toHaveAttribute('type', 'submit');
    expect(send).toHaveAttribute('form', formEl.id);
  });

  it('full page: three columns — mailboxes · list · message', async () => {
    renderIosApp(Mail, 'mail', { layout: 'pad' });
    await settle();
    const sidebar = screen.getByRole('navigation', { name: 'Mailboxes' });
    expect(within(sidebar).getByRole('link', { name: /^Inbox/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 3, name: 'No Message Selected' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: M.rowLabel(inbox[1]!, true) }));
    await settle();
    expect(screen.getByRole('article', { name: inbox[1]!.subject })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: M.rowLabel(inbox[1]!, false) })).toHaveAttribute('aria-current', 'page');
  });
});

describe('IOS-MAIL-06 form / dialog semantics; the swipe action has non-gesture equivalents', () => {
  it('compose is a modal dialog with a <form>, Cancel first', async () => {
    renderIosApp(Mail, 'mail');
    await toInbox();
    const sheet = await compose();
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    expect(within(sheet).getAllByRole('button')[0]).toHaveTextContent('Cancel');
    expect(within(sheet).getByRole('form', { name: 'New message' })).toBeInTheDocument();
    expect(sheet).toHaveTextContent(getPerson().name);
  });

  it('row ⋯ / long-press preview offers Open · Copy address · Share', async () => {
    const { calls } = renderIosApp(Mail, 'mail');
    await toInbox();
    fireEvent.click(within(top()).getByRole('button', { name: "Let's talk actions" }));
    const spec = calls.preview?.[0]?.[0] as { actions: { label: string; run: () => void }[] };
    expect(spec.actions.map((action) => action.label)).toEqual(['Open', 'Copy address', 'Share']);
    act(() => spec.actions[1]!.run());
    await settle();
    expect(calls.copy?.[0]).toEqual([email, 'Email address']);
  });

  it('axe: Mailboxes, Inbox, a message and compose', async () => {
    const view = renderIosApp(Mail, 'mail');
    expect(await audit(view.container)).toEqual([]);
    await toInbox();
    expect(await audit(view.container)).toEqual([]);
    fireEvent.click(within(top()).getByRole('link', { name: M.rowLabel(inbox[2]!, true) }));
    await settle();
    expect(await audit(view.container)).toEqual([]);
    fireEvent.click(within(top()).getByRole('button', { name: 'Reply' }));
    await settle();
    expect(await audit(view.container)).toEqual([]);
  });

  it('pad is axe clean', async () => {
    const view = renderIosApp(Mail, 'mail', { layout: 'pad' });
    await settle();
    dispatch({ type: 'SET_APP_UI', id: MAIL, key: 'stack', value: JSON.stringify(['inbox', 'msg:resume']) });
    await settle();
    expect(await audit(view.container)).toEqual([]);
  });
});

describe('mail-model', () => {
  it('reads and pops the session stack', () => {
    expect(M.readStack(['inbox', 'msg:lets-talk'], inbox)).toEqual({ box: 'inbox', message: 'lets-talk' });
    expect(M.readStack(['sent', 'msg:lets-talk'], inbox)).toEqual({ box: 'sent', message: null });
    expect(M.readStack('junk', inbox)).toEqual({ box: null, message: null });
    expect(M.popStack({ box: 'inbox', message: 'resume' })).toEqual({ box: 'inbox', message: null });
    expect(M.writeStack({ box: 'inbox', message: 'resume' })).toEqual(['inbox', 'msg:resume']);
    expect(M.shortDate('2026-01-09')).toBe('1/9/26');
  });
});
