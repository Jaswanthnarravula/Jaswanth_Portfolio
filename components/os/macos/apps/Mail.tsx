'use client';
/**
 * Mail — Contact as a three-pane mail client (plans/macos/apps/mail.md, `MAC-MAIL-01…06`; `VIEW-CONTACT-01`).
 *   · toolbar: New Message (primary) · Reply · Copy Address; sidebar: Inbox (unread) · Sent · Drafts (1 with a draft);
 *     the message list (sender, subject, two-line preview, date, unread dot); the reading pane with its actions;
 *   · the inbox is generated from data by the shared `buildInbox` (every OS's mail app reads the same three messages);
 *   · compose is a sheet attached to the window (a modal `dialog` scoped to it: the rest of the window is inert),
 *     dropping from under the toolbar; its text is `WindowInstance.draft`, so it survives reload (`MAC-MAIL-02`);
 *   · Send = the encoded `mailto:` hand-off (body ≤ 1800 characters; a longer body is cut with a note and the full
 *     text copied) + a calm confirmation with Copy address; `contact_initiated` counted once (`MAC-MAIL-03`);
 *   · Copy address: clipboard + banner, or a selected read-only field when the clipboard is blocked (`MAC-MAIL-04`);
 *   · medium: the sidebar becomes a popover; compact: list → message push navigation, full-height compose with a
 *     sticky Send above the safe area (`MAC-MAIL-05`); Enter in the body never sends, Ctrl/Cmd+Enter does.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  buildInbox,
  copyText,
  replySubject,
  sendTarget,
  type InboxMessage,
  type InboxMessageId,
} from '@/components/content';
import { getContact, getPerson, getResume, getResumeFileMeta } from '@/data/selectors';
import { analytics } from '@/lib/analytics/loader';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { useKernel } from '@/stores/kernel-context';
import { dispatchSoon } from '@/stores/kernel-store';
import { useAppCommands } from '../commands';
import { openMailto } from '../hand-off';
import {
  ComposeGlyph,
  CopyGlyph,
  DraftGlyph,
  ExternalGlyph,
  InboxGlyph,
  PaperclipGlyph,
  ReplyGlyph,
  SendGlyph,
} from '../glyphs';
import { ChevronLeft } from '../icons';
import { openResume } from '../run-command';
import { MAC_TIMING } from '../timing';
import { notify } from '../ui';
import type { WindowBodyProps } from '../window/Window';
import app from './app.module.css';
import styles from './mail.module.css';

type Mailbox = 'inbox' | 'sent' | 'drafts';

interface Draft {
  readonly subject: string;
  readonly body: string;
  /** The compose sheet is open (a draft can also rest closed, listed under Drafts). */
  readonly open: boolean;
}

const EMPTY: Draft = { subject: '', body: '', open: false };

export function parseDraft(text: string | undefined | null): Draft | null {
  if (!text) return null;
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object') return null;
    const { subject, body, open } = value as Record<string, unknown>;
    if (typeof subject !== 'string' || typeof body !== 'string') return null;
    return { subject, body, open: open === true };
  } catch {
    return null;
  }
}

const serializeDraft = (draft: Draft): string =>
  draft.subject.trim() || draft.body.trim() || draft.open ? JSON.stringify(draft) : '';

const hasText = (draft: Draft) => draft.subject.trim() !== '' || draft.body.trim() !== '';

/**
 * Session memory (never persisted beyond the macOS session): which messages were read, and a draft handed back when
 * Mail reopens after its window closed ("Draft present when closing the window → kept").
 */
const session: { read: Set<InboxMessageId>; draft: Draft | null } = { read: new Set(), draft: null };

const rememberRead = (read: Set<InboxMessageId>) => {
  session.read = read;
};
const rememberDraft = (draft: Draft) => {
  session.draft = hasText(draft) ? draft : null;
};

/** Test seam. */
export function resetMailSession(): void {
  session.read = new Set();
  session.draft = null;
}

const MAILBOXES: readonly { id: Mailbox; label: string }[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'sent', label: 'Sent' },
  { id: 'drafts', label: 'Drafts' },
];

function MailboxIcon({ id }: { id: Mailbox }) {
  if (id === 'inbox') return <InboxGlyph size={16} />;
  if (id === 'sent') return <SendGlyph size={16} />;
  return <DraftGlyph size={16} />;
}

export default function Mail({ window: win, titleId, compact }: WindowBodyProps) {
  const person = getPerson();
  const contact = getContact();
  const [inbox] = useState(() => buildInbox({ person, contact, resume: getResume(), file: getResumeFileMeta() }));
  const medium = useKernel((state) => state.viewport.sizeClass === 'medium');
  const [mailbox, setMailbox] = useState<Mailbox>('inbox');
  const [selected, setSelected] = useState<InboxMessageId>('lets-talk');
  const [view, setView] = useState<'list' | 'message'>('list');
  const [read, setRead] = useState<ReadonlySet<InboxMessageId>>(() => new Set(session.read));
  const [draft, setDraft] = useState<Draft>(() => parseDraft(win.draft) ?? session.draft ?? EMPTY);
  const [sent, setSent] = useState<{ truncated: boolean } | null>(null);
  const [manual, setManual] = useState<string | null>(null);
  const [popover, setPopover] = useState(false);
  const composeInvoker = useRef<HTMLElement | null>(null);
  const confirmation = useRef<HTMLDivElement>(null);
  const manualField = useRef<HTMLInputElement>(null);

  // The manual-copy field appears selected, ready for Ctrl/Cmd+C.
  useEffect(() => {
    if (manual) manualField.current?.select();
  }, [manual]);

  const message = inbox.find((item) => item.id === selected) ?? inbox[0]!;
  const unread = inbox.filter((item) => item.unread && !read.has(item.id)).length;
  const drafts = hasText(draft) ? 1 : 0;

  // The draft lives in the kernel (persisted with the session) and in session memory for a reopened window.
  const saveDraft = (next: Draft) => {
    setDraft(next);
    rememberDraft(next);
    dispatchSoon({ type: 'SET_DRAFT', id: win.id, draft: serializeDraft(next) });
  };

  const markRead = (id: InboxMessageId) => {
    if (read.has(id)) return;
    const next = new Set(read).add(id);
    rememberRead(next);
    setRead(next);
  };

  const select = (id: InboxMessageId) => {
    setSelected(id);
    markRead(id);
    setView('message');
  };

  const compose = (subject: string, from: HTMLElement | null) => {
    composeInvoker.current = from ?? (document.activeElement as HTMLElement | null);
    setSent(null);
    // A resting draft reopens as it was; otherwise the sheet starts with the subject (a reply's "Re: …").
    saveDraft(hasText(draft) ? { ...draft, open: true } : { subject, body: '', open: true });
  };

  const closeCompose = () => saveDraft({ ...draft, open: false });

  const copyAddress = async () => {
    const outcome = await copyText(contact.email, navigator.clipboard);
    if (outcome === 'copied') {
      setManual(null);
      analytics.track({ name: 'contact_initiated', channel: 'copy' });
      notify({ kind: 'email-copied' });
    } else setManual(contact.email);
  };

  const send = async () => {
    const target = sendTarget({ email: contact.email, subject: draft.subject, body: draft.body });
    if (target.truncated) await copyText(draft.body, navigator.clipboard);
    analytics.track({ name: 'contact_initiated', channel: 'mailto' });
    // The hand-off: the visitor's own email app takes over (no detection — the confirmation covers "nothing opened").
    openMailto(target.url);
    saveDraft(EMPTY);
    setSent({ truncated: target.truncated });
  };

  useAppCommands('mail', (command, arg) => {
    if (command === 'compose') compose('', null);
    else if (command === 'reply') compose(replySubject(message.subject), null);
    else if (command === 'copy-address') void copyAddress();
    else if (command === 'mailbox' && (arg === 'inbox' || arg === 'sent' || arg === 'drafts')) {
      setMailbox(arg);
      setView('list');
    }
  });

  // When the sheet goes away (after its window content is interactive again), focus lands on the confirmation after a
  // send, or back on whatever opened the sheet — never on <body>.
  const composing = draft.open;
  const wasComposing = useRef(composing);
  useEffect(() => {
    if (wasComposing.current === composing) return;
    wasComposing.current = composing;
    if (composing) return;
    if (sent) confirmation.current?.focus({ preventScroll: true });
    else composeInvoker.current?.focus({ preventScroll: true });
  }, [composing, sent]);

  const showList = !compact || view === 'list';
  const showReader = !compact || view === 'message';

  const sidebar = (
    <ul className={app.sourceList}>
      {MAILBOXES.map((box) => (
        <li key={box.id}>
          <button
            type="button"
            className={app.sourceItem}
            aria-current={box.id === mailbox ? 'true' : undefined}
            onClick={() => {
              setMailbox(box.id);
              setView('list');
              setPopover(false);
            }}
          >
            <MailboxIcon id={box.id} />
            {box.label}
            {box.id === 'inbox' && unread ? (
              <span className={app.count}>
                {unread}
                <span className="sr-only"> unread</span>
              </span>
            ) : null}
            {box.id === 'drafts' && drafts ? <span className={app.count}>{drafts}</span> : null}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={`${app.app} ${styles.mail}`} data-body="" data-composing={composing || undefined}>
      <header className={app.toolbar} data-drag-region="" inert={composing || undefined}>
        {medium && !compact ? (
          <span className={styles.popoverWrap}>
            <button
              type="button"
              className={app.tool}
              aria-expanded={popover}
              aria-label="Mailboxes"
              onClick={() => setPopover((open) => !open)}
            >
              <InboxGlyph />
            </button>
            {popover ? (
              <div className={styles.popover}>
                <nav aria-label="Mailboxes">{sidebar}</nav>
              </div>
            ) : null}
          </span>
        ) : null}
        {compact && view === 'message' ? (
          <button type="button" className={app.tool} aria-label="Back to Inbox" onClick={() => setView('list')}>
            <ChevronLeft size={18} />
          </button>
        ) : null}
        <div className={app.titleBlock}>
          <h2 id={titleId} className={app.title}>
            <span className="sr-only">Mail — </span>
            {MAILBOXES.find((box) => box.id === mailbox)!.label}
          </h2>
          <p className={app.subtitle}>
            {mailbox === 'inbox' ? `${inbox.length} messages${unread ? `, ${unread} unread` : ''}` : ''}
          </p>
        </div>
        <span className={app.spacer} />
        <div role="toolbar" aria-label="Mail" className={styles.tools}>
          <button
            type="button"
            className={app.tool}
            aria-label="New Message"
            onClick={(event) => compose('', event.currentTarget)}
          >
            <ComposeGlyph />
          </button>
          <button
            type="button"
            className={app.tool}
            aria-label="Reply"
            onClick={(event) => compose(replySubject(message.subject), event.currentTarget)}
          >
            <ReplyGlyph />
          </button>
          <button type="button" className={app.tool} aria-label="Copy Address" onClick={() => void copyAddress()}>
            <CopyGlyph />
          </button>
        </div>
      </header>
      {manual ? (
        <p className={styles.manual}>
          <label>
            Email address:{' '}
            <input ref={manualField} readOnly value={manual} onFocus={(event) => event.currentTarget.select()} />
          </label>{' '}
          <span className={styles.hint}>Press Ctrl/Cmd+C to copy</span>
        </p>
      ) : null}
      <div className={`${app.split} ${styles.panes}`} inert={composing || undefined}>
        {!medium && !compact ? (
          <nav className={`${app.sidebar} ${styles.sidebar}`} aria-label="Mailboxes">
            <h3 className={app.sidebarHeading}>Favourites</h3>
            {sidebar}
          </nav>
        ) : null}
        {showList ? (
          <section
            className={styles.list}
            aria-label={`${MAILBOXES.find((box) => box.id === mailbox)!.label} messages`}
          >
            {compact ? (
              <div className={styles.compactBoxes}>
                <nav aria-label="Mailboxes">{sidebar}</nav>
              </div>
            ) : null}
            {mailbox === 'inbox' ? (
              <ul className={styles.messages}>
                {inbox.map((item) => (
                  <MessageRow
                    key={item.id}
                    message={item}
                    unread={item.unread && !read.has(item.id)}
                    selected={item.id === selected && !compact}
                    onSelect={() => select(item.id)}
                  />
                ))}
              </ul>
            ) : mailbox === 'sent' ? (
              <p className={app.empty}>Messages you send open in your own mail app.</p>
            ) : drafts ? (
              <ul className={styles.messages}>
                <li>
                  <button
                    type="button"
                    className={styles.row}
                    onClick={(event) => compose(draft.subject, event.currentTarget)}
                  >
                    <span className={styles.rowTop}>
                      <span className={styles.sender}>Draft</span>
                    </span>
                    <span className={styles.subject}>{draft.subject || '(No subject)'}</span>
                    <span className={styles.preview}>{draft.body || ' '}</span>
                  </button>
                </li>
              </ul>
            ) : (
              <p className={app.empty}>No drafts.</p>
            )}
          </section>
        ) : null}
        {showReader ? (
          mailbox === 'inbox' ? (
            <Reader
              message={message}
              onReply={(from) => compose(replySubject(message.subject), from)}
              onCopy={() => void copyAddress()}
            />
          ) : (
            <div className={`${styles.reader} ${app.empty}`}>No message selected</div>
          )
        ) : null}
      </div>
      {sent ? (
        <div
          ref={confirmation}
          className={styles.confirmation}
          role="status"
          tabIndex={-1}
          inert={composing || undefined}
        >
          <p>
            Handed to your email app. If nothing opened, copy the address instead.
            {sent.truncated ? ' The full message was copied — paste the rest in your email app.' : ''}
          </p>
          <span className={styles.confirmActions}>
            <button type="button" className={styles.button} onClick={() => void copyAddress()}>
              Copy address
            </button>
            <button type="button" className={styles.button} onClick={() => setSent(null)}>
              Done
            </button>
          </span>
        </div>
      ) : null}
      {composing ? (
        <Compose
          email={contact.email}
          draft={draft}
          compact={compact}
          onChange={(next) => saveDraft({ ...next, open: true })}
          onClose={closeCompose}
          onSend={() => void send()}
        />
      ) : null}
    </div>
  );
}

function MessageRow({
  message,
  unread,
  selected,
  onSelect,
}: {
  message: InboxMessage;
  unread: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={styles.row}
        aria-current={selected ? 'true' : undefined}
        data-unread={unread || undefined}
        onClick={onSelect}
      >
        <span className="sr-only">{unread ? 'Unread. ' : ''}From </span>
        <span className={styles.rowTop}>
          <span className={styles.dot} aria-hidden="true" />
          <span className={styles.sender}>{message.from.name}</span>
          <span className="sr-only">. </span>
          <time className={styles.date} dateTime={message.date}>
            {message.dateLabel}
          </time>
        </span>
        <span className="sr-only">. </span>
        <span className={styles.subject}>
          {message.subject}
          {message.attachment ? <PaperclipGlyph size={12} /> : null}
        </span>
        <span className="sr-only">. </span>
        <span className={styles.preview}>{message.preview}</span>
      </button>
    </li>
  );
}

function Reader({
  message,
  onReply,
  onCopy,
}: {
  message: InboxMessage;
  onReply: (from: HTMLElement) => void;
  onCopy: () => void;
}) {
  const linkedin = getContact().links.find((link) => link.kind === 'linkedin');
  return (
    <article className={styles.reader} aria-labelledby="mail-subject">
      <header className={styles.readerHead}>
        <span className={styles.avatar} aria-hidden="true">
          {message.from.initials}
        </span>
        <div className={styles.headText}>
          <h3 id="mail-subject" className={styles.readerSubject}>
            {message.subject}
          </h3>
          <p className={styles.meta}>
            <span>
              From: <strong>{message.from.name}</strong> &lt;{message.from.address}&gt;
            </span>
            <span>To: {message.to}</span>
          </p>
        </div>
        <time className={styles.date} dateTime={message.date}>
          {message.dateLabel}
        </time>
      </header>
      <div className={styles.body}>
        {message.body.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
        {message.links?.length ? (
          <ul className={styles.channels}>
            {message.links.map((link) => (
              <li key={link.url}>
                <a className={styles.button} href={link.url} target="_blank" rel="noopener noreferrer">
                  {link.label} <ExternalGlyph size={12} />
                  <span className="sr-only"> (opens in new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {message.attachment ? (
          <div className={styles.attachment}>
            <button type="button" className={styles.chip} onClick={() => openResume()}>
              <PaperclipGlyph size={14} />
              <span>
                {message.attachment.name}
                <span className={styles.chipMeta}> · {message.attachment.label}</span>
              </span>
              <span className="sr-only"> — open in Preview</span>
            </button>
            {message.attachment.downloadable ? (
              <a
                className={styles.button}
                href={message.attachment.href}
                download={message.attachment.name}
                type="application/pdf"
                onClick={() => {
                  analytics.track({ name: 'resume_downloaded', os: 'macos' });
                  notify({ kind: 'resume-downloaded' });
                }}
              >
                Download ({message.attachment.label})
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
      <footer className={styles.actions}>
        <button
          type="button"
          className={`${styles.button} ${styles.primary}`}
          onClick={(event) => onReply(event.currentTarget)}
        >
          Reply by email
        </button>
        <button type="button" className={styles.button} onClick={onCopy}>
          Copy address
        </button>
        {linkedin ? (
          <a className={styles.button} href={linkedin.url} target="_blank" rel="noopener noreferrer">
            Open {linkedin.label} <ExternalGlyph size={12} />
            <span className="sr-only"> (opens in new tab)</span>
          </a>
        ) : null}
      </footer>
    </article>
  );
}

function Compose({
  email,
  draft,
  compact,
  onChange,
  onClose,
  onSend,
}: {
  email: string;
  draft: Draft;
  compact: boolean;
  onChange: (draft: Draft) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  const id = useId();
  const sheet = useRef<HTMLFormElement>(null);
  const subject = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLTextAreaElement>(null);

  // The sheet drops from under the toolbar (transform only; reduced motion: it simply appears) and takes focus.
  useLayoutEffect(() => {
    const node = sheet.current;
    if (!node) return;
    (draft.subject ? body.current : subject.current)?.focus({ preventScroll: true });
    if (prefersReducedMotion() || typeof node.animate !== 'function') return;
    const drop = node.animate([{ transform: 'translateY(-100%)' }, { transform: 'none' }], {
      duration: MAC_TIMING.sheet.dropMs,
      easing: MAC_TIMING.sheet.ease,
    });
    return () => drop.cancel();
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const node = sheet.current;
    if (!node) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    node.addEventListener('keydown', onKey);
    return () => node.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const node = sheet.current;
    // Send: the sheet lifts away (200 ms, transform + opacity) while the hand-off happens at once.
    if (node && !prefersReducedMotion() && typeof node.animate === 'function')
      node.animate(
        [
          { transform: 'none', opacity: 1 },
          { transform: 'translateY(-40%)', opacity: 0 },
        ],
        {
          duration: MAC_TIMING.sheet.liftMs,
          easing: MAC_TIMING.sheet.liftEase,
          fill: 'forwards',
        },
      );
    onSend();
  };

  const onBodyKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      sheet.current?.requestSubmit();
    }
  };

  return (
    <div className={styles.scrim} data-compact={compact || undefined}>
      <form
        ref={sheet}
        className={styles.sheet}
        // Modal within its window (a macOS sheet): the rest of the window is inert while it is open; the other
        // windows, the menu bar and the Dock stay reachable, as on a real Mac.
        role="dialog"
        aria-labelledby={`${id}-title`}
        onSubmit={submit}
      >
        <header className={styles.sheetHead}>
          <button type="button" className={styles.button} onClick={onClose}>
            Cancel
          </button>
          <h3 id={`${id}-title`} className={styles.sheetTitle}>
            {draft.subject.trim() || 'New Message'}
          </h3>
          <button type="submit" className={`${styles.button} ${styles.primary} ${styles.sendTop}`}>
            <SendGlyph size={14} /> Send
          </button>
        </header>
        <div className={styles.field}>
          <label htmlFor={`${id}-to`}>To:</label>
          <input id={`${id}-to`} readOnly value={email} />
        </div>
        <div className={styles.field}>
          <label htmlFor={`${id}-subject`}>Subject:</label>
          <input
            ref={subject}
            id={`${id}-subject`}
            value={draft.subject}
            maxLength={200}
            onChange={(event) => onChange({ ...draft, subject: event.target.value })}
          />
        </div>
        <label className="sr-only" htmlFor={`${id}-body`}>
          Message
        </label>
        <textarea
          ref={body}
          id={`${id}-body`}
          className={styles.message}
          value={draft.body}
          maxLength={8000}
          aria-describedby={`${id}-hint`}
          onChange={(event) => onChange({ ...draft, body: event.target.value })}
          onKeyDown={onBodyKey}
        />
        <p id={`${id}-hint`} className={styles.sheetHint}>
          Send opens your own email app. Ctrl/Cmd+Enter sends.
        </p>
        <div className={styles.stickySend}>
          <button type="submit" className={`${styles.button} ${styles.primary}`}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
