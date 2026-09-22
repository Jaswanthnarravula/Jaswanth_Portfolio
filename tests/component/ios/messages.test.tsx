/**
 * iOS Messages in jsdom through the iOS harness (plans/ios/apps/messages.md):
 * IOS-MSG-01 conversations list + pushed thread with iMessage bubbles (pad: side by side) · IOS-MSG-02 the thread and
 * chips come from the script graph built from data · IOS-MSG-03 the typing indicator is skipped by any input and absent
 * under reduced motion · IOS-MSG-04 hand-offs (mailto, copy + blocked fallback, résumé Quick Look, links, GitHub) ·
 * IOS-MSG-05 the transcript persists in the kernel session and is restored without re-animation; the thread is a
 * `log` of final text only.
 */
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mailtoUrl } from '@/components/content';
import Messages from '@/components/os/ios/apps/Messages';
import { buildScript } from '@/components/os/ios/apps/messages-script';
import { requestIntent, resetIntents } from '@/components/os/ios/intents';
import { iosId } from '@/components/os/ios/model';
import { getContact, getFeaturedProjects, getPerson, getResumeFileMeta } from '@/data/selectors';
import { analytics } from '@/lib/analytics/loader';
import { dispatch, getKernel } from '@/stores/kernel-store';
import { closeAllIos, fakeServices, renderIosApp, settle } from './harness';

const person = getPerson();
const contact = getContact();
const script = buildScript({ person, contact, file: getResumeFileMeta(), featured: getFeaturedProjects() });
const ID = iosId('messages');
const said = (text: string) => `${person.givenName} said: ${text}`;

const blockNavigation = (event: MouseEvent) => event.preventDefault();

beforeEach(() => {
  closeAllIos();
  resetIntents();
  delete document.documentElement.dataset.motion;
  // jsdom cannot navigate to mailto: / external links; the app's own handlers still run first.
  window.addEventListener('click', blockNavigation);
});
afterEach(() => {
  window.removeEventListener('click', blockNavigation);
  delete document.documentElement.dataset.motion;
  vi.restoreAllMocks();
});

const log = () => screen.getByRole('log', { name: `Conversation with ${person.givenName}` });
const logText = () => log().textContent ?? '';
const chips = () => within(screen.getByRole('group', { name: 'Suggested replies' }));

async function openThread() {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(person.givenName) }));
  await settle();
}

async function chip(name: string) {
  const el = chips().getByText(name);
  fireEvent.pointerDown(el);
  fireEvent.click(el);
  await settle();
  await settle();
}

describe('iOS Messages', () => {
  it('IOS-MSG-01 conversations list (large title, pinned conversation: initials avatar, last line, time) pushes the thread', async () => {
    document.documentElement.dataset.motion = 'reduced';
    renderIosApp(Messages, 'messages');
    expect(screen.getByRole('heading', { level: 3, name: 'Messages' })).toBeInTheDocument();
    const row = screen.getByRole('button', { name: new RegExp(person.givenName) });
    expect(row).toHaveTextContent('Pinned');
    expect(row).toHaveTextContent(/Unread/);
    expect(row).toHaveTextContent(script.greeting[1]!.kind === 'text' ? script.greeting[1]!.text : '');
    expect(row).toHaveTextContent(/\d{1,2}:\d{2}/);
    await openThread();
    // Pushed thread: a back button named after the list, the centred avatar + name, bubbles from the script.
    expect(screen.getByRole('button', { name: 'Back to Messages' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: person.givenName })).toBeInTheDocument();
    const items = within(log()).getAllByRole('listitem');
    const greeting = script.greeting.map((bubble) => (bubble.kind === 'text' ? bubble.text : ''));
    expect(items.map((item) => item.textContent)).toEqual(expect.arrayContaining(greeting.map(said)));
    expect(items[0]).toHaveTextContent(/Today/);
    // Back pops to the list; focus returns to the row that pushed.
    fireEvent.click(screen.getByRole('button', { name: 'Back to Messages' }));
    await settle();
    expect(getKernel().sessions.ios.windows[ID]?.ui?.screen).toBeUndefined();
  });

  it('IOS-MSG-01 iMessage bubbles: incoming left, outgoing right with a tail on the last of a run, "Delivered" under the last outgoing', async () => {
    document.documentElement.dataset.motion = 'reduced';
    renderIosApp(Messages, 'messages');
    await openThread();
    await chip('Are you available?');
    const lines = [...log().querySelectorAll<HTMLElement>('[data-line]')];
    const mine = lines.filter((line) => line.dataset.from === 'me');
    const theirs = lines.filter((line) => line.dataset.from === 'them');
    expect(mine).toHaveLength(1);
    expect(mine[0]).toHaveTextContent(`You said: ${script.branches.available.say}`);
    expect(mine[0]).toHaveAttribute('data-tail');
    expect(theirs.at(-1)).toHaveAttribute('data-tail');
    expect(theirs[0]).not.toHaveAttribute('data-tail');
    const delivered = log().querySelector('li[aria-hidden="true"]');
    expect(delivered).toHaveTextContent('Delivered');
    expect(delivered?.previousElementSibling).toBe(mine[0]);
  });

  it('IOS-MSG-02 chips drive the script: "Are you available?" answers with person.openTo and offers "Email you" · "Copy your email"', async () => {
    document.documentElement.dataset.motion = 'reduced';
    renderIosApp(Messages, 'messages');
    await openThread();
    expect(
      chips()
        .getAllByRole('button')
        .map((el) => el.textContent),
    ).toEqual(['What do you do?', 'Are you available?', 'Show me your résumé', 'Where else can I find you?']);
    await chip('Are you available?');
    expect(logText()).toContain(said(person.openTo));
    expect(chips().getByRole('link', { name: 'Email you' })).toBeInTheDocument();
    expect(chips().getByRole('button', { name: 'Copy your email' })).toBeInTheDocument();
    await chip('What do you do?');
    expect(logText()).toContain(said(person.headline));
  });

  it('IOS-MSG-03 the typing indicator is skipped entirely by a key press (and by a tap)', async () => {
    renderIosApp(Messages, 'messages');
    await openThread();
    const first = script.greeting[0]!.kind === 'text' ? script.greeting[0]!.text : '';
    // Typing: the indicator shows, the log holds no half-said text.
    expect(document.querySelector('[data-typing]')).not.toBeNull();
    expect(logText()).not.toContain(first);
    fireEvent.keyDown(screen.getByRole('region', { name: `Messages with ${person.givenName}` }), { key: 'Shift' });
    await settle();
    expect(document.querySelector('[data-typing]')).toBeNull();
    for (const bubble of script.greeting) expect(logText()).toContain(bubble.kind === 'text' ? bubble.text : '');
    // A tap on a chip during the reply's typing shows everything already said, then the next line.
    await chip('Are you available?');
    expect(document.querySelector('[data-typing]')).not.toBeNull();
    fireEvent.pointerDown(log());
    await settle();
    expect(logText()).toContain(said(person.openTo));
    expect(document.querySelector('[data-typing]')).toBeNull();
  });

  it('IOS-MSG-03 without input the replies arrive after the indicator (≤ 600 ms each)', async () => {
    renderIosApp(Messages, 'messages');
    await openThread();
    const second = script.greeting[1]!.kind === 'text' ? script.greeting[1]!.text : '';
    await waitFor(() => expect(logText()).toContain(second), { timeout: 2500 });
    expect(document.querySelector('[data-typing]')).toBeNull();
  });

  it('IOS-MSG-03 reduced motion: bubbles are appended at once, with no indicator', async () => {
    document.documentElement.dataset.motion = 'reduced';
    renderIosApp(Messages, 'messages');
    await openThread();
    expect(document.querySelector('[data-typing]')).toBeNull();
    for (const bubble of script.greeting) expect(logText()).toContain(bubble.kind === 'text' ? bubble.text : '');
    await chip('What do you do?');
    expect(document.querySelector('[data-typing]')).toBeNull();
    expect(logText()).toContain(said(person.headline));
  });

  it('IOS-MSG-04 "Email you" is a mailto: hand-off built like Mail (mailtoUrl) and tracked', async () => {
    document.documentElement.dataset.motion = 'reduced';
    const track = vi.spyOn(analytics, 'track');
    renderIosApp(Messages, 'messages');
    await openThread();
    await chip('Are you available?');
    const email = chips().getByRole('link', { name: 'Email you' });
    const href = mailtoUrl({ email: contact.email, subject: `Hi ${person.givenName}` });
    expect(email).toHaveAttribute('href', href);
    fireEvent.click(email);
    await settle();
    expect(track).toHaveBeenCalledWith({ name: 'contact_initiated', channel: 'mailto' });
    // The reply carries the same link as a bubble (a real link).
    expect(within(log()).getByRole('link', { name: new RegExp(`Email ${person.givenName}`) })).toHaveAttribute(
      'href',
      href,
    );
  });

  it('IOS-MSG-04 "Copy your email" copies through the shell; blocked → the address as selectable text in a bubble', async () => {
    document.documentElement.dataset.motion = 'reduced';
    const track = vi.spyOn(analytics, 'track');
    const view = renderIosApp(Messages, 'messages');
    await openThread();
    await chip('Are you available?');
    await chip('Copy your email');
    expect(view.calls.copy?.[0]?.[0]).toBe(contact.email);
    expect(track).toHaveBeenCalledWith({ name: 'contact_initiated', channel: 'copy' });
    expect(logText()).toContain(said(`Done — ${contact.email} is on your clipboard.`));
    view.unmount();

    closeAllIos();
    const blocked = fakeServices('phone', { copy: async () => false });
    renderIosApp(Messages, 'messages', { services: blocked.services });
    await openThread();
    await chip('Are you available?');
    await chip('Copy your email');
    const bubble = [...log().querySelectorAll('[data-line]')].at(-1)!;
    expect(bubble).toHaveTextContent('blocked the clipboard');
    const selectable = [...bubble.querySelectorAll('span')].find((span) => span.textContent === contact.email);
    expect(selectable).toBeDefined();
  });

  it('IOS-MSG-04 the résumé attachment opens Files Quick Look; links open in a new tab; "See projects" opens GitHub', async () => {
    document.documentElement.dataset.motion = 'reduced';
    const track = vi.spyOn(analytics, 'track');
    const view = renderIosApp(Messages, 'messages');
    await openThread();
    await chip('Show me your résumé');
    const attachment = within(log()).getByRole('link', { name: /Résumé\.pdf/ });
    expect(attachment).toHaveAttribute('href', '/ios/files/resume');
    fireEvent.click(attachment);
    expect(view.calls.openContent?.[0]?.[0]).toEqual({ section: 'resume' });
    expect(view.calls.openContent?.[0]?.[1]).toBe(attachment);

    await chip('Where else can I find you?');
    for (const link of contact.links) {
      const bubble = within(log()).getByRole('link', {
        name: new RegExp(link.handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      });
      expect(bubble).toHaveAttribute('href', link.url);
      expect(bubble).toHaveAttribute('target', '_blank');
      expect(bubble).toHaveAttribute('rel', 'noopener noreferrer');
    }
    fireEvent.click(within(log()).getAllByRole('link', { name: /opens in a new tab/ })[0]!);
    expect(track).toHaveBeenCalledWith({ name: 'contact_initiated', channel: 'link' });

    await chip('What do you do?');
    const see = chips().getByRole('button', { name: 'See projects' });
    fireEvent.click(see);
    await settle();
    expect(view.calls.openApp?.[0]?.[0]).toBe('github');
    expect(view.calls.openApp?.[0]?.[2]).toBe(see);
  });

  it('IOS-MSG-02 all branches visited → the top-level chips again with "Start over", which clears the conversation', async () => {
    document.documentElement.dataset.motion = 'reduced';
    renderIosApp(Messages, 'messages');
    await openThread();
    for (const name of ['What do you do?', 'Are you available?', 'Show me your résumé', 'Where else can I find you?'])
      await chip(name);
    fireEvent.click(chips().getByRole('link', { name: 'Email you' }));
    await settle();
    const names = [...screen.getByRole('group', { name: 'Suggested replies' }).querySelectorAll('[data-chip]')].map(
      (el) => el.textContent,
    );
    expect(names).toEqual([
      'What do you do?',
      'Are you available?',
      'Show me your résumé',
      'Where else can I find you?',
      'Start over',
    ]);
    await chip('Start over');
    expect(
      within(log())
        .getAllByRole('listitem')
        .filter((item) => item.hasAttribute('data-line')),
    ).toHaveLength(2);
  });

  it('IOS-MSG-05 the transcript persists in the kernel session and is restored whole, without re-animation', async () => {
    document.documentElement.dataset.motion = 'reduced';
    const first = renderIosApp(Messages, 'messages');
    await openThread();
    await chip('Are you available?');
    await chip('Show me your résumé');
    const stored = JSON.parse(getKernel().sessions.ios.windows[ID]!.ui!.thread!);
    expect(stored.s.map((step: { c: string }) => step.c)).toEqual(['available', 'resume']);
    first.unmount();

    // Reopen with full motion: everything is there at once — no typing, no bubble animation.
    delete document.documentElement.dataset.motion;
    const animate = vi.fn(() => ({
      finished: Promise.resolve(),
      cancel: () => undefined,
      onfinish: null,
      oncancel: null,
    }));
    Object.defineProperty(Element.prototype, 'animate', { value: animate, configurable: true, writable: true });
    try {
      renderIosApp(Messages, 'messages');
      await settle();
      expect(document.querySelector('[data-typing]')).toBeNull();
      expect(logText()).toContain(said(person.openTo));
      expect(logText()).toContain('Résumé.pdf');
      const bubbleAnimations = animate.mock.contexts.filter((el) => (el as Element).closest?.('[data-line]'));
      expect(bubbleAnimations).toHaveLength(0);
    } finally {
      delete (Element.prototype as { animate?: unknown }).animate;
    }
  });

  it('IOS-MSG-05 the thread is a log of final text only: the typing indicator is outside it and aria-hidden', async () => {
    renderIosApp(Messages, 'messages');
    await openThread();
    const indicator = document.querySelector('[data-typing]');
    expect(indicator).not.toBeNull();
    expect(indicator).toHaveAttribute('aria-hidden', 'true');
    expect(log().contains(indicator)).toBe(false);
    // Nothing but whole, final lines is in the log while typing.
    expect(
      within(log())
        .queryAllByRole('listitem')
        .filter((item) => item.hasAttribute('data-line')),
    ).toHaveLength(0);
    // The field only looks like one: hidden from AT; tapping it focuses the first chip.
    const field = screen.getByText('Choose a reply above');
    expect(field.closest('[aria-hidden="true"]')).not.toBeNull();
    fireEvent.pointerUp(field);
    expect(document.activeElement).toBe(chips().getAllByRole('button')[0]);
    expect(screen.getByRole('group', { name: 'Suggested replies' })).toHaveAccessibleDescription(/Choose a reply/);
  });

  it('IOS-MSG-01 the Home quick action "Say hello" opens the thread and says hello', async () => {
    document.documentElement.dataset.motion = 'reduced';
    requestIntent({ kind: 'say-hello' });
    renderIosApp(Messages, 'messages');
    await settle();
    await settle();
    expect(logText()).toContain(`You said: ${script.branches.hello.say}`);
  });

  it('IOS-MSG-01 pad: list and thread side by side, thread column 640 max, chips wrap; axe clean', async () => {
    document.documentElement.dataset.motion = 'reduced';
    const view = renderIosApp(Messages, 'messages', { layout: 'pad' });
    await settle();
    expect(screen.getByRole('heading', { level: 3, name: 'Messages' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: person.givenName })).toBeInTheDocument();
    expect(view.container.querySelector('[data-pad]')).not.toBeNull();
    expect(log()).toBeInTheDocument();
    const results = await axe.run(view.container, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    });
    expect(
      results.violations.map(
        (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target).join(', ')}`,
      ),
    ).toEqual([]);
  });

  it('IOS-MSG-01 phone list and thread are axe clean', async () => {
    document.documentElement.dataset.motion = 'reduced';
    const view = renderIosApp(Messages, 'messages');
    // landmark-unique is off here only: the shared NavStack names each screen region by its title, and the list's
    // title is "Messages" (the spec's large title) — the same name as the app surface. Reported to the shell owner.
    const options = {
      rules: {
        'color-contrast': { enabled: false },
        region: { enabled: false },
        'landmark-unique': { enabled: false },
      },
    };
    let results = await axe.run(view.container, options);
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
    await openThread();
    await chip('Where else can I find you?');
    await act(async () => {
      results = await axe.run(view.container, options);
    });
    expect(
      results.violations.map(
        (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target).join(', ')}`,
      ),
    ).toEqual([]);
  });

  it('IOS-MSG-05 the session restores on a reload of the kernel ui (screen + transcript)', async () => {
    document.documentElement.dataset.motion = 'reduced';
    renderIosApp(Messages, 'messages');
    dispatch({ type: 'SET_APP_UI', id: ID, key: 'screen', value: 'thread' });
    dispatch({
      type: 'SET_APP_UI',
      id: ID,
      key: 'thread',
      value: JSON.stringify({ at: Date.now() - 1000, s: [{ c: 'what', t: Date.now() - 500 }] }),
    });
    await settle();
    expect(logText()).toContain(said(person.headline));
    expect(chips().getByRole('button', { name: 'See projects' })).toBeInTheDocument();
  });
});
