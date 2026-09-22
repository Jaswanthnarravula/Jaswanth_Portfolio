'use client';
/**
 * Mail — contact as the iOS Mail app (plans/ios/apps/mail.md, `IOS-MAIL-01…06`):
 *   · Mailboxes (Inbox (n unread) · Sent · Drafts) → Inbox (search, rows with the unread dot, sender, time, subject,
 *     two-line preview; toolbar: filter · "Updated Just Now" · Compose) → Message (initials avatar, subject 22 bold,
 *     body, attachment tile → Quick Look in Files; toolbar Reply · Copy address · Share). The stack is session state.
 *   · read messages are recorded in `ui.read` (a JSON array of message ids) — the Home Screen badge reads it;
 *   · Compose / Reply: a sheet (large detent) with Cancel · "New Message" · Send ↑; To is a read-only token; Subject and
 *     body (17 px) persist as `WindowInstance.draft` + `ui.subject`, and `ui.compose` reopens the sheet after a reload;
 *     Cancel with text → action sheet "Delete Draft / Save Draft"; Drafts lists a saved draft;
 *   · Send = the encoded `mailto:` hand-off (body ≤ 1800, a longer one cut with a note and copied whole) → the sheet
 *     flies up and out → banner "Handed to your mail app" with Copy address;
 *   · swipe a row left → "Copy address" (alternatives: long-press / ⋯ preview, the message toolbar);
 *   · full page: three columns (mailboxes · list · message); compose is the centred form sheet.
 */
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { buildInbox, replySubject, sendTarget, type InboxMessage, type InboxMessageId } from '@/components/content';
import { usePress } from '@/components/primitives/Press';
import { getContact, getPerson, getResume, getResumeFileMeta } from '@/data/selectors';
import { analytics } from '@/lib/analytics/loader';
import { drag } from '@/lib/motion/drag';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { useKernel } from '@/stores/kernel-context';
import { dispatchSoon } from '@/stores/kernel-store';
import { commits } from '../model';
import { IOS_EASE } from '../motion';
import { subscribeIntents, takeIntent } from '../intents';
import { useAppUi, useAppUiJson, useIos, type IosServices } from '../shell-context';
import { Glyph } from '../ui/glyphs';
import { appHref, BarButton, contentHref, Group, PillButton, Row, SearchField, uiStyles } from '../ui/kit';
import { NavStack, type NavScreen } from '../ui/NavStack';
import { ActionSheet, Sheet } from '../ui/Sheet';
import * as M from './mail-model';
import type { IosAppProps } from './registry';
import styles from './mail.module.css';

/** The hand-off itself (a seam tests replace): navigating to a `mailto:` opens the visitor's email app. */
export const mailHandOff = {
  open(url: string): void {
    globalThis.location.href = url;
  },
};

/** Width of the revealed swipe action. */
const ACTION_W = 112;

// --- A message row (link + swipe action + ⋯) ------------------------------------------------------------------------

function MailRow({
  message,
  unread,
  href,
  selected,
  pad,
  onOpen,
  onCopy,
  onPreview,
}: {
  readonly message: InboxMessage;
  readonly unread: boolean;
  readonly href: string;
  readonly selected: boolean;
  readonly pad: boolean;
  readonly onOpen: () => void;
  readonly onCopy: () => void;
  readonly onPreview: (anchor: HTMLElement) => void;
}) {
  const link = useRef<HTMLAnchorElement>(null);
  const swiped = useRef(false);
  const press = usePress({ onLongPress: () => link.current && onPreview(link.current) });

  const settle = (open: boolean) => {
    const el = link.current;
    if (!el) return;
    const from = el.style.transform || 'translateX(0)';
    const to = open ? `translateX(-${ACTION_W}px)` : 'translateX(0)';
    el.style.transform = open ? to : '';
    el.parentElement?.toggleAttribute('data-open', open);
    if (!prefersReducedMotion())
      el.animate?.([{ transform: from }, { transform: to }], { duration: 260, easing: IOS_EASE.nav });
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    press.onPointerDown(event);
    const el = link.current;
    if (!el || event.button > 0) return;
    const start = el.parentElement?.hasAttribute('data-open') ? -ACTION_W : 0;
    let axis: 'x' | 'y' | null = null;
    let last = { t: performance.now(), x: start };
    let velocity = 0;
    drag(el, event.nativeEvent, {
      threshold: 8,
      onMove: (dx, dy) => {
        axis ??= Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (axis !== 'x') return;
        swiped.current = true;
        let x = start + dx;
        if (x > 0) x /= 4;
        if (x < -ACTION_W) x = -ACTION_W + (x + ACTION_W) / 3;
        const t = performance.now();
        if (t > last.t) velocity = ((x - last.x) / (t - last.t)) * 1000;
        last = { t, x };
        el.style.transform = `translateX(${x}px)`;
      },
      onEnd: ({ dx, moved }) => {
        if (!moved || axis !== 'x') return;
        settle(commits(-(start + dx) / ACTION_W, -velocity / ACTION_W));
      },
    });
  };

  return (
    <li className={styles.item} data-unread={unread || undefined}>
      <button
        type="button"
        className={styles.swipeAction}
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => {
          onCopy();
          settle(false);
        }}
      >
        <Glyph name="copy" size={20} />
        <span>Copy address</span>
      </button>
      <a
        ref={link}
        className={`${styles.mailRow} ${uiStyles.press}`}
        href={href}
        aria-label={M.rowLabel(message, unread)}
        aria-current={selected ? 'page' : undefined}
        data-selected={selected || undefined}
        data-push-key={`msg:${message.id}`}
        onPointerDown={onPointerDown}
        onPointerMove={press.onPointerMove}
        onPointerUp={press.onPointerUp}
        onPointerCancel={press.onPointerCancel}
        onContextMenu={press.onContextMenu}
        onKeyDown={(event: KeyboardEvent<HTMLAnchorElement>) => {
          if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
            event.preventDefault();
            onPreview(event.currentTarget);
          }
        }}
        onClick={(event) => {
          press.onClick(event);
          if (event.defaultPrevented) return;
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          if (swiped.current) {
            swiped.current = false;
            return;
          }
          if (event.currentTarget.parentElement?.hasAttribute('data-open')) {
            settle(false);
            return;
          }
          onOpen();
        }}
      >
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.rowBody}>
          <span className={styles.rowTop}>
            <span className={styles.sender}>{message.from.name}</span>
            <time className={styles.time} dateTime={message.date}>
              {M.shortDate(message.date)}
            </time>
            {pad ? null : <Glyph name="chevron-right" size={14} strokeWidth={2.4} className={styles.rowChevron} />}
          </span>
          <span className={styles.subject}>
            {message.subject}
            {message.attachment ? <Glyph name="link" size={13} className={styles.clip} /> : null}
          </span>
          <span className={styles.preview}>{message.preview}</span>
        </span>
      </a>
      <button
        type="button"
        className={uiStyles.rowMore}
        aria-label={`${message.subject} actions`}
        onClick={(event) => onPreview(link.current ?? event.currentTarget)}
      >
        <Glyph name="ellipsis" size={20} />
      </button>
    </li>
  );
}

// --- The message ------------------------------------------------------------------------------------------------------

function MessageView({ message, ios }: { readonly message: InboxMessage; readonly ios: IosServices }) {
  return (
    <article className={styles.message} aria-label={message.subject}>
      <header className={styles.header}>
        <span className={styles.avatar} aria-hidden="true">
          {message.from.initials}
        </span>
        <span className={styles.headerText}>
          <span className={styles.from}>{message.from.name}</span>
          <span className={styles.to}>To: {message.to}</span>
        </span>
        <time className={styles.date} dateTime={message.date}>
          {message.dateLabel}
        </time>
      </header>
      <p className={styles.subjectLine} aria-hidden="true">
        {message.subject}
      </p>
      <div className={styles.body}>
        {message.body.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      {message.links && message.links.length > 0 ? (
        <ul className={styles.links} role="list" aria-label="Where to find me">
          {message.links.map((link) => (
            <li key={link.url}>
              <PillButton
                href={link.url}
                external
                tone="tinted"
                onPress={() => analytics.track({ name: 'contact_initiated', channel: 'link' })}
              >
                {link.label} <Glyph name="arrow-up-right" size={15} strokeWidth={2.4} />
              </PillButton>
            </li>
          ))}
        </ul>
      ) : null}
      {message.attachment ? (
        <a
          className={`${styles.attachment} ${uiStyles.press}`}
          href={contentHref({ section: 'resume' })}
          aria-label={`Attachment: ${message.attachment.name}, ${message.attachment.label}. Opens in Quick Look`}
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
            event.preventDefault();
            ios.openContent({ section: 'resume' }, event.currentTarget);
          }}
        >
          <svg width="34" height="40" viewBox="0 0 34 40" aria-hidden="true">
            <path
              d="M3 1.5h19l9 9V37a1.5 1.5 0 0 1-1.5 1.5h-26A1.5 1.5 0 0 1 2 37V3A1.5 1.5 0 0 1 3.5 1.5z"
              fill="#ffffff"
              stroke="#c7c7cc"
            />
            <path d="M22 1.5V9a1.5 1.5 0 0 0 1.5 1.5H31" fill="#ececf1" stroke="#c7c7cc" />
            <rect x="5" y="27" width="17" height="7" rx="1.5" fill="#e5332a" />
            <text
              x="13.5"
              y="32.6"
              textAnchor="middle"
              fontSize="5.4"
              fontWeight="700"
              fill="#ffffff"
              fontFamily="-apple-system, sans-serif"
            >
              PDF
            </text>
          </svg>
          <span className={styles.attachmentText}>
            <span className={styles.attachmentName}>{message.attachment.name}</span>
            <span className={styles.attachmentMeta}>
              {message.attachment.label}
              {message.attachment.pages
                ? ` · ${message.attachment.pages} ${message.attachment.pages === 1 ? 'page' : 'pages'}`
                : ''}
            </span>
          </span>
        </a>
      ) : null}
    </article>
  );
}

// --- The app ------------------------------------------------------------------------------------------------------------

export default function Mail({ id, layout }: IosAppProps) {
  const ios = useIos();
  const window = useKernel((state) => state.sessions.ios.windows[id]);
  const [stackRaw, setStackRaw] = useAppUiJson<string[]>(id, 'stack', []);
  const [read, setRead] = useAppUiJson<InboxMessageId[]>(id, 'read', []);
  const [query, setQuery] = useAppUi(id, 'q', '');
  const [composeRaw, setCompose] = useAppUi(id, 'compose', '');
  const [subject, setSubject] = useAppUi(id, 'subject', '');
  const [savedRaw, setSaved] = useAppUiJson<M.SavedDraft | null>(id, 'saved', null);
  const [discarding, setDiscarding] = useState(false);
  const [manual, setManual] = useState(false);
  const [composeKey, setComposeKey] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const subjectField = useRef<HTMLInputElement>(null);
  const bodyField = useRef<HTMLTextAreaElement>(null);
  const manualField = useRef<HTMLInputElement>(null);
  const submitWired = useRef(false);

  const person = getPerson();
  const contact = getContact();
  const messages = useMemo(
    () => buildInbox({ person, contact, resume: getResume(), file: getResumeFileMeta() }),
    [person, contact],
  );
  const stack = M.readStack(stackRaw, messages);
  const saved = M.readSaved(savedRaw);
  const body = window?.draft ?? '';
  const composeOpen = composeRaw === '1';
  const pad = layout === 'pad';
  const unreadCount = messages.filter((message) => M.isUnread(message, read)).length;
  const current = stack.message ? messages.find((message) => message.id === stack.message) : undefined;

  const setStack = (next: M.MailStack) => setStackRaw(M.writeStack(next));
  const openMessage = (message: InboxMessage) => {
    if (!read.includes(message.id)) setRead(M.markRead(read, message.id));
    setStack({ box: 'inbox', message: message.id });
  };

  // --- Actions -----------------------------------------------------------------------------------------------------
  const copyAddress = () => {
    analytics.track({ name: 'contact_initiated', channel: 'copy' });
    void ios.copy(contact.email, 'Email address').then((copied) => {
      if (!copied) setManual(true);
    });
  };
  const share = () => void ios.copyLink({ section: 'contact' }, 'Contact');

  const openCompose = (nextSubject: string, nextBody = '') => {
    dispatchSoon({ type: 'SET_DRAFT', id, draft: nextBody });
    setSubject(nextSubject || null);
    setCompose('1');
    setComposeKey((key) => key + 1);
  };

  const clearActive = () => {
    dispatchSoon({ type: 'SET_DRAFT', id, draft: '' });
    setSubject(null);
  };

  const closeCompose = () => {
    setDiscarding(false);
    setCompose(null);
  };

  const cancelCompose = () => {
    const text = (subjectField.current?.value ?? subject).trim() || (bodyField.current?.value ?? body).trim();
    if (text) setDiscarding(true);
    else {
      clearActive();
      closeCompose();
    }
  };

  const send = () => {
    const subjectText = subjectField.current?.value ?? subject;
    const bodyText = bodyField.current?.value ?? body;
    const target = sendTarget({ email: contact.email, subject: subjectText, body: bodyText });
    mailHandOff.open(target.url);
    analytics.track({ name: 'contact_initiated', channel: 'mailto' });
    if (target.truncated) void ios.copy(bodyText.trimEnd(), 'Your full message');
    clearActive();
    ios.notify({
      id: `mail-sent-${Date.now()}`,
      role: 'mail',
      app: 'Mail',
      title: 'Handed to your mail app',
      body: target.truncated
        ? 'Your message was long, so only its first part went across — the full text is on your clipboard.'
        : `To ${contact.email}. If nothing opened, copy the address instead.`,
      actions: [{ label: 'Copy address', run: copyAddress }],
    });
    // The sheet flies up and out (300 ms ease-in), then dismisses.
    const panel = form.current?.closest<HTMLElement>('[data-sheet]');
    if (panel && typeof panel.animate === 'function' && !prefersReducedMotion()) {
      const flight = panel.animate(
        [
          { transform: 'translateY(0)', opacity: 1 },
          { transform: 'translateY(-110%)', opacity: 0 },
        ],
        { duration: 300, easing: IOS_EASE.bannerOut, fill: 'forwards' },
      );
      flight.onfinish = closeCompose;
      flight.oncancel = closeCompose;
    } else closeCompose();
  };

  // Send is the form's submit button (the sheet draws it in its header, above the keyboard).
  useLayoutEffect(() => {
    if (!composeOpen) {
      submitWired.current = false;
      return;
    }
    const formEl = form.current;
    const button = formEl?.closest('[role="dialog"]')?.querySelector<HTMLButtonElement>('[data-sheet-confirm]');
    if (!formEl || !button) return;
    button.type = 'submit';
    button.setAttribute('form', formEl.id);
    submitWired.current = true;
  });

  // The Home quick action "New Message" (and any other surface) asks for compose through an intent.
  useEffect(() => {
    const take = () => {
      const intent = takeIntent('compose');
      if (intent) openCompose(intent.subject ?? '');
    };
    take();
    return subscribeIntents((intent) => {
      if (intent.kind === 'compose') take();
    });
    // Subscribe once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The copy fallback: the address, selected.
  useEffect(() => {
    if (!manual) return;
    const field = manualField.current;
    field?.focus({ preventScroll: true });
    field?.select();
  }, [manual]);

  // --- Screens -----------------------------------------------------------------------------------------------------
  const rootHref = appHref(id, { kind: 'root' });
  const boxRow = (box: M.Mailbox, glyph: 'tray' | 'paperplane' | 'doc', count: number, label: string) => (
    <Row
      key={box}
      kind="href"
      href={rootHref}
      title={M.MAILBOX_TITLE[box]}
      value={count > 0 ? String(count) : undefined}
      icon={{ glyph }}
      aria-label={label}
      pushKey={`box:${box}`}
      selected={pad && (stack.box ?? 'inbox') === box}
      aria-current={pad && (stack.box ?? 'inbox') === box ? 'page' : undefined}
      accessory={pad ? 'none' : 'chevron'}
      onClick={(event) => {
        event.preventDefault();
        setStack({ box, message: null });
      }}
    />
  );
  const mailboxRows = (
    <Group>
      {boxRow('inbox', 'tray', unreadCount, unreadCount > 0 ? `Inbox, ${unreadCount} unread` : 'Inbox')}
      {boxRow('sent', 'paperplane', 0, 'Sent')}
      {boxRow('drafts', 'doc', saved ? 1 : 0, saved ? 'Drafts, 1 draft' : 'Drafts')}
    </Group>
  );

  const previewFor = (message: InboxMessage) => (anchor: HTMLElement) =>
    ios.preview({
      title: message.subject,
      summary: message.preview,
      meta: [message.from.name, message.dateLabel],
      ref: { section: 'contact' },
      anchor,
      actions: [
        { id: 'open', label: 'Open', run: () => openMessage(message) },
        { id: 'copy', label: 'Copy address', run: copyAddress },
        { id: 'share', label: 'Share', run: share },
      ],
    });

  const visible = M.searchMessages(messages, query);
  const inboxBody = () =>
    visible.length === 0 ? (
      <p className={styles.empty} role="status">
        No Results
      </p>
    ) : (
      <ul className={styles.list} role="list">
        {visible.map((message) => (
          <MailRow
            key={message.id}
            message={message}
            unread={M.isUnread(message, read)}
            href={rootHref}
            selected={pad && current?.id === message.id}
            pad={pad}
            onOpen={() => openMessage(message)}
            onCopy={copyAddress}
            onPreview={previewFor(message)}
          />
        ))}
      </ul>
    );

  const inboxToolbar = (
    <>
      <span className={styles.filter} aria-hidden="true">
        <Glyph name="filter" size={22} />
      </span>
      <span className={styles.updated}>Updated Just Now</span>
      <BarButton label="Compose" glyph="compose" aria-haspopup="dialog" onPress={() => openCompose('')} />
    </>
  );

  const boxScreen = (box: M.Mailbox): NavScreen => {
    if (box === 'inbox')
      return {
        key: 'box:inbox',
        title: 'Inbox',
        large: true,
        tone: 'plain',
        accessory: (
          <SearchField
            value={query}
            onChange={(value) => setQuery(value || null)}
            label="Search mail"
            onCancel={() => setQuery(null)}
          />
        ),
        toolbar: inboxToolbar,
        render: inboxBody,
      };
    if (box === 'sent')
      return {
        key: 'box:sent',
        title: 'Sent',
        large: true,
        tone: 'plain',
        toolbar: inboxToolbar,
        render: () => (
          <p className={styles.empty} role="status">
            Messages open in your own mail app.
          </p>
        ),
      };
    return {
      key: 'box:drafts',
      title: 'Drafts',
      large: true,
      tone: 'plain',
      toolbar: inboxToolbar,
      render: () =>
        saved ? (
          <Group plain>
            <Row
              kind="button"
              title={<span className={styles.draftLabel}>Draft</span>}
              subtitle={saved.subject.trim() || 'No Subject'}
              detail={M.draftPreview(saved) || 'No content'}
              aria-label={`Draft. ${saved.subject.trim() || 'No Subject'}. ${M.draftPreview(saved)}`}
              onPress={() => {
                setSaved(null);
                openCompose(saved.subject, saved.body);
              }}
            />
          </Group>
        ) : (
          <p className={styles.empty} role="status">
            No Drafts
          </p>
        ),
    };
  };

  const messageScreen = (message: InboxMessage): NavScreen => ({
    key: `msg:${message.id}`,
    title: message.subject,
    tone: 'plain',
    toolbar: (
      <>
        <BarButton
          label="Reply"
          glyph="reply"
          aria-haspopup="dialog"
          onPress={() => openCompose(replySubject(message.subject))}
        />
        <BarButton label="Copy address" glyph="copy" onPress={copyAddress} />
        <BarButton label="Share" glyph="share" onPress={share} />
      </>
    ),
    render: () => <MessageView message={message} ios={ios} />,
  });

  const mailboxesScreen: NavScreen = { key: 'mailboxes', title: 'Mailboxes', large: true, render: () => mailboxRows };

  // --- Sheets ------------------------------------------------------------------------------------------------------
  const formId = `ios-mail-compose-${composeKey}`;
  const sheets = (
    <>
      <Sheet
        open={composeOpen}
        title={subject.trim() || 'New Message'}
        onCancel={cancelCompose}
        confirm={{ label: 'Send', glyph: 'send', onConfirm: () => (submitWired.current ? undefined : send()) }}
        detent="large"
        className={styles.composeSheet}
      >
        <form
          key={composeKey}
          id={formId}
          ref={form}
          className={styles.compose}
          aria-label="New message"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <div className={styles.field}>
            <span className={styles.fieldLabel}>To:</span>
            <span className={styles.token}>
              {person.name}
              <span className="sr-only"> ({contact.email})</span>
            </span>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={`${formId}-subject`}>
              Subject:
            </label>
            <input
              ref={subjectField}
              id={`${formId}-subject`}
              name="subject"
              className={styles.input}
              defaultValue={subject}
              autoComplete="off"
              enterKeyHint="next"
              onInput={(event) => setSubject(event.currentTarget.value || null)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                bodyField.current?.focus();
              }}
            />
          </div>
          <textarea
            ref={bodyField}
            name="body"
            aria-label="Message"
            className={styles.bodyField}
            defaultValue={body}
            onInput={(event) => dispatchSoon({ type: 'SET_DRAFT', id, draft: event.currentTarget.value })}
          />
        </form>
      </Sheet>
      <ActionSheet
        open={discarding}
        title="Delete this draft?"
        actions={[
          {
            id: 'delete',
            label: 'Delete Draft',
            destructive: true,
            run: () => {
              clearActive();
              closeCompose();
            },
          },
          {
            id: 'save',
            label: 'Save Draft',
            run: () => {
              setSaved(M.saveDraft(subjectField.current?.value ?? subject, bodyField.current?.value ?? body));
              clearActive();
              closeCompose();
            },
          },
        ]}
        onCancel={() => setDiscarding(false)}
      />
      <Sheet open={manual} title="Email Address" cancelLabel="Done" detent="medium" onCancel={() => setManual(false)}>
        <div className={styles.manual}>
          <label className={styles.manualLabel} htmlFor="ios-mail-address">
            Copy this address
          </label>
          <input
            ref={manualField}
            id="ios-mail-address"
            className={styles.input}
            readOnly
            value={contact.email}
            onFocus={(event) => event.currentTarget.select()}
          />
          <p className={styles.manualHint}>Touch and hold the address, then choose Copy.</p>
        </div>
      </Sheet>
    </>
  );

  // --- Full page: three columns ------------------------------------------------------------------------------------
  if (pad) {
    const box = stack.box ?? 'inbox';
    return (
      <div className={styles.split} data-mail="">
        <nav className={styles.sidebar} aria-label="Mailboxes">
          <h3 className={styles.sidebarTitle}>Mailboxes</h3>
          {mailboxRows}
        </nav>
        <div className={styles.column}>
          <NavStack id={`mail-pad-${box}`} window={id} screens={[boxScreen(box)]} onPop={() => undefined} />
        </div>
        <div className={styles.column} data-detail="">
          {current && box === 'inbox' ? (
            <NavStack
              key={current.id}
              id="mail-pad-message"
              window={id}
              screens={[messageScreen(current)]}
              onPop={() => setStack({ box: 'inbox', message: null })}
            />
          ) : (
            <section className={styles.noMessage} aria-labelledby="ios-mail-none">
              <h3 id="ios-mail-none">No Message Selected</h3>
            </section>
          )}
        </div>
        {sheets}
      </div>
    );
  }

  // --- Phone: one stack ----------------------------------------------------------------------------------------------
  const screens: NavScreen[] = [mailboxesScreen];
  if (stack.box) screens.push(boxScreen(stack.box));
  if (current) screens.push(messageScreen(current));
  return (
    <div className={styles.app} data-mail="">
      <NavStack id="mail" window={id} screens={screens} onPop={() => setStack(M.popStack(stack))} />
      {sheets}
    </div>
  );
}
