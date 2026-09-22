'use client';
/**
 * Outlook — plans/windows/apps/outlook.md (`WIN-OUT-01…06`). Contact as the new Outlook for Windows, never a form:
 *   · Mica title bar with the search box (filters the open folder) · far-left app rail (Mail · Calendar · People, the
 *     last two decorative-disabled) · the simplified one-row ribbon: **New mail** (accent) · Reply · Copy address · ⋯;
 *   · three panes: folder pane (Inbox (unread) · Sent Items · Drafts (1)) · message list with the Focused | Other pivot
 *     (rows: sender, subject, preview, date; unread = accent bar + bold; selecting clears it for the page session) ·
 *     reading pane (header, attachment chip, body, Reply by email · Copy address · LinkedIn ↗) — `WIN-OUT-01`;
 *   · the inbox is the shared, data-generated one (`components/content/inbox.ts`); nothing about the career is typed here;
 *   · compose opens **inside the reading pane** (To prefilled read-only, Subject, message, **Send**, Discard); its text
 *     lives in the kernel as `WindowInstance.draft` (JSON), so it survives reload, and Drafts shows (1); a closed window
 *     hands its draft back when reopened; Discard confirms only when there is text (a modal `dialog`) — `WIN-OUT-02`;
 *   · Send = an encoded `mailto:` hand-off (body ≤ 1800 characters, a longer one is cut with a note and copied whole) →
 *     the form collapses (167 ms) → an InfoBar slides down (250 ms): "Handed to your email app. Nothing opened? Copy the
 *     address." (`role="status"`) — `WIN-OUT-03`; Ctrl/Cmd+Enter sends, Enter in the message never does;
 *   · the attachment chip opens the PDF tab in Edge (`/windows/edge/resume`, a real link); its chevron menu offers Open ·
 *     Save as (a real download + the "Download complete" toast) — `WIN-OUT-04`;
 *   · `medium` (or a narrow window) collapses the folder pane to icons; compact (and windows under 720 px) push the list
 *     to the message with a back arrow; compose is full-height with a sticky Send bar; the ribbon folds into ⋯ beside a
 *     New mail button — `WIN-OUT-05`;
 *   · folder pane `nav`, message list `ul` of buttons named in full, compose a labelled `<form>`, InfoBar `role="status"`,
 *     discard confirmation a trapped modal `dialog`; headings start at h3 under the window's h2 — `WIN-OUT-06`.
 * Motion is CSS on the Windows ladder tokens (pane swaps 167 ms fade, hover fills 83 ms; reduced motion = instant).
 */
import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { buildInbox, replySubject, sendTarget, type InboxMessage, type InboxMessageId } from '@/components/content';
import { FocusScope } from '@/components/primitives/FocusScope';
import type { MenuEntry } from '@/components/primitives/Menu';
import { RovingGroup } from '@/components/primitives/RovingGroup';
import { KernelLink, type KernelTarget } from '@/components/shell/KernelLink';
import { getContact, getPerson, getResume, getResumeFileMeta } from '@/data/selectors';
import { analytics } from '@/lib/analytics/loader';
import type { AppLocation } from '@/lib/kernel/types';
import { dur } from '@/lib/motion/dur';
import { useKernel } from '@/stores/kernel-context';
import { dispatchSoon } from '@/stores/kernel-store';
import {
  flArrowLeft,
  flAttach,
  flCalendar,
  flChevronDown,
  flCompose,
  flCopy,
  flDelete,
  flDismiss,
  flDownload,
  flDrafts,
  flInbox,
  flInfoFilled,
  flMail,
  flMailFilled,
  flMore,
  flNavigation,
  flOpen,
  flPeople,
  flPin,
  flReply,
  flSearch,
  flSend,
  flSent,
  type Glyph,
} from '../fluent.generated';
import { Fl, PdfFile } from '../icons';
import { subscribeIntents, takeIntent } from '../intents';
import { winBinding, windowTitle } from '../model';
import { useWinShell, type WinShellServices } from '../shell-context';
import { downloadToast } from '../slots';
import { TitleBar, type WindowBodyProps } from '../window/Window';
import styles from './outlook.module.css';

// --- Model ----------------------------------------------------------------------------------------------------------

type Folder = 'inbox' | 'sent' | 'drafts';
type Pivot = 'focused' | 'other';
type View = 'list' | 'message';

const FOLDERS: readonly { readonly id: Folder; readonly label: string; readonly icon: Glyph }[] = [
  { id: 'inbox', label: 'Inbox', icon: flInbox },
  { id: 'sent', label: 'Sent Items', icon: flSent },
  { id: 'drafts', label: 'Drafts', icon: flDrafts },
];
const FOLDER_LABEL: Readonly<Record<Folder, string>> = { inbox: 'Inbox', sent: 'Sent Items', drafts: 'Drafts' };

/** The compose state as the kernel keeps it (`WindowInstance.draft`, JSON, ≤ 10 000 characters). */
interface Draft {
  /** Compose is showing in the reading pane (else it waits in Drafts). */
  readonly open: boolean;
  readonly subject: string;
  readonly body: string;
  /** The subject it started with ("Re: …" or empty): only changes from it count as text. */
  readonly base: string;
  readonly reply: InboxMessageId | null;
}

const DRAFT_LIMIT = 10_000;
const MESSAGE_IDS: readonly InboxMessageId[] = ['lets-talk', 'where-to-find-me', 'resume'];
const isMessageId = (value: unknown): value is InboxMessageId => MESSAGE_IDS.includes(value as InboxMessageId);

function parseDraft(raw: string | null | undefined): Draft | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Record<keyof Draft, unknown>> | null;
    if (!value || typeof value !== 'object' || typeof value.subject !== 'string' || typeof value.body !== 'string')
      return null;
    return {
      open: value.open !== false,
      subject: value.subject,
      body: value.body,
      base: typeof value.base === 'string' ? value.base : '',
      reply: isMessageId(value.reply) ? value.reply : null,
    };
  } catch {
    // Plain text from anywhere else: keep it as the message.
    return { open: true, subject: '', body: raw, base: '', reply: null };
  }
}

function serializeDraft(draft: Draft | null): string {
  if (!draft) return '';
  let body = draft.body;
  let text = JSON.stringify({ v: 1, ...draft, body });
  while (text.length > DRAFT_LIMIT && body.length > 0) {
    body = body.slice(0, Math.max(0, body.length - (text.length - DRAFT_LIMIT) - 1));
    text = JSON.stringify({ v: 1, ...draft, body });
  }
  return text;
}

/** Text exists: a message, or a subject changed from the one it started with. */
const hasText = (draft: Draft | null): draft is Draft =>
  !!draft && (draft.body.trim() !== '' || draft.subject.trim() !== draft.base.trim());

/**
 * Page-session memory. Read marks are session state (plans/windows/apps/outlook "Select message"); the kernel drops a
 * window — and its draft — when it closes, so the last draft is also kept here and handed back when Outlook reopens.
 */
const session: { read: Set<InboxMessageId>; draft: string | null } = { read: new Set(), draft: null };

const rememberDraft = (text: string) => {
  session.draft = text || null;
};
const rememberRead = (id: InboxMessageId, value: boolean): ReadonlySet<InboxMessageId> => {
  if (value) session.read.add(id);
  else session.read.delete(id);
  return new Set(session.read);
};

/** Test seam: forget the page session. */
export function resetOutlookSession(): void {
  session.read.clear();
  session.draft = null;
}

/** The hand-off itself (a seam tests replace): navigating to a `mailto:` opens the visitor's email app. */
export const mailHandOff = {
  open(url: string): void {
    globalThis.location.href = url;
  },
};

const RESUME: KernelTarget = { os: 'windows', ref: { section: 'resume' } };
const RESUME_LOCATION: AppLocation = { kind: 'content', ref: { section: 'resume' } };

const openResume = () => dispatchSoon({ type: 'OPEN_APP', os: 'windows', role: 'browser', location: RESUME_LOCATION });

/** Save as: a real download of the PDF, the analytics event and the Windows "Download complete" toast. */
function saveResume(shell: WinShellServices) {
  const resume = getResume();
  const link = document.createElement('a');
  link.href = resume.file;
  link.download = resume.downloadName;
  link.type = 'application/pdf';
  link.hidden = true;
  link.setAttribute('data-resume-download', '');
  document.body.append(link);
  link.click();
  link.remove();
  analytics.track({ name: 'resume_downloaded', os: 'windows' });
  shell.notify(downloadToast(resume.downloadName));
}

const trackLink = () => analytics.track({ name: 'contact_initiated', channel: 'link' });

// --- Dates (Outlook's short forms) ------------------------------------------------------------------------------------

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const dayOf = (iso: string) => {
  const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number);
  return { y, m, d };
};
/** "1/1/2026" — the list's date column. */
const shortDate = (iso: string) => {
  const { y, m, d } = dayOf(iso);
  return `${m}/${d}/${y}`;
};
/** "Thu 1/1/2026" — the reading pane's header. */
const headerDate = (iso: string) => {
  const { y, m, d } = dayOf(iso);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${m}/${d}/${y}`;
};

// --- Focus --------------------------------------------------------------------------------------------------------

const shown = (el: HTMLElement) => !el.closest('[hidden], [inert]') && el.checkVisibility?.() !== false;
/** Still in the app and visible (a removed or hidden control has lost its place). */
const shownIn = (root: HTMLElement, el: HTMLElement) => root.contains(el) && shown(el);

function focusFirst(root: HTMLElement | null, selectors: readonly string[]) {
  if (!root) return;
  for (const selector of selectors) {
    const el = root.querySelector<HTMLElement>(selector);
    if (el && shown(el)) {
      el.focus();
      return;
    }
  }
}

const menuPoint = (button: HTMLElement) => {
  const box = button.getBoundingClientRect();
  return { x: box.left, y: box.bottom + 4 };
};

// --- The app --------------------------------------------------------------------------------------------------------

export default function Outlook({ window: win, compact }: WindowBodyProps) {
  const shell = useWinShell();
  const sizeClass = useKernel((state) => state.viewport.sizeClass);
  const uid = useId();
  const root = useRef<HTMLDivElement>(null);
  const person = getPerson();
  const contact = getContact();
  const inbox = useMemo(
    () => buildInbox({ person: getPerson(), contact: getContact(), resume: getResume(), file: getResumeFileMeta() }),
    [],
  );
  const linkedin = contact.links.find((link) => link.kind === 'linkedin');

  const [draft, setDraft] = useState<Draft | null>(() => parseDraft(win.draft) ?? parseDraft(session.draft));
  const [view, setView] = useState<View>(() => (draft?.open ? 'message' : 'list'));
  const [folder, setFolder] = useState<Folder>('inbox');
  const [pivot, setPivot] = useState<Pivot>('focused');
  const [selected, setSelected] = useState<InboxMessageId | null>(null);
  const [read, setRead] = useState<ReadonlySet<InboxMessageId>>(() => new Set(session.read));
  const [query, setQuery] = useState('');
  const [foldersOpen, setFoldersOpen] = useState(false);
  const [collapsedPref, setCollapsedPref] = useState<boolean | null>(null);
  const [sent, setSent] = useState<{
    readonly key: number;
    readonly truncated: boolean;
    /** The full (truncated) message reached the clipboard. */
    readonly copied?: boolean;
  } | null>(null);
  const [leaving, setLeaving] = useState<Draft | null>(null);
  const [confirming, setConfirming] = useState(false);
  /** The clipboard was blocked: the text shows selected in a read-only field (plans/windows/apps/outlook "Edge cases"). */
  const [manual, setManual] = useState<{ readonly key: number; readonly text: string; readonly what: string } | null>(
    null,
  );
  const focusNext = useRef<readonly string[] | null>(null);
  /** The last element focused inside the app (Chromium blurs a control to <body> the moment its pane hides). */
  const lastFocus = useRef<HTMLElement | null>(null);
  const [, rerender] = useReducer((tick: number) => tick + 1, 0);
  /** Move focus after the next commit (a render is guaranteed even when nothing else changed). */
  const requestFocus = (selectors: readonly string[]) => {
    focusNext.current = selectors;
    rerender();
  };

  const current = inbox.find((message) => message.id === selected) ?? null;
  const unread = (message: InboxMessage) => message.unread && !read.has(message.id);
  const unreadCount = inbox.filter(unread).length;
  const draftCount = hasText(draft) ? 1 : 0;
  const collapsed = collapsedPref ?? sizeClass === 'medium';
  const composing = !!draft?.open;
  const paneKey = leaving ? 'leaving' : composing ? 'compose' : (current?.id ?? 'empty');

  // A window reopened after closing: the kernel dropped the draft with it — hand the page session's copy back.
  const kernelDraft = win.draft ?? '';
  useEffect(() => {
    if (!kernelDraft && session.draft) dispatchSoon({ type: 'SET_DRAFT', id: win.id, draft: session.draft });
  }, [kernelDraft, win.id]);

  // The form collapses for 167 ms after Send, then the reading pane settles on the InfoBar.
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setLeaving(null), dur(167));
    return () => clearTimeout(timer);
  }, [leaving]);

  // Focus follows the visible pane: an explicit request after any commit …
  useLayoutEffect(() => {
    const request = focusNext.current;
    if (!request) return;
    focusNext.current = null;
    focusFirst(root.current, request);
  });
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const remember = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement) lastFocus.current = event.target;
    };
    el.addEventListener('focusin', remember);
    return () => el.removeEventListener('focusin', remember);
  }, []);
  // … and focus is rescued from a pane that just hid (compact push, a narrow window, the folders sheet) — whether the
  // browser still reports the hidden control as focused, or has already dropped focus to <body>.
  useLayoutEffect(() => {
    const el = root.current;
    const active = document.activeElement;
    if (!el) return;
    const inside = active instanceof HTMLElement && el.contains(active);
    const dropped = (!active || active === document.body) && !!lastFocus.current && !shownIn(el, lastFocus.current);
    if (inside ? shown(active) : !dropped) return;
    focusFirst(
      el,
      view === 'message'
        ? ['[data-focus="reading"]', '[data-focus="subject"]', '[data-focus="infobar-copy"]', '[data-focus="back"]']
        : [`[data-message="${selected ?? ''}"]`, '[data-focus="folder"]', '[data-focus="new-mail"]'],
    );
  }, [view, foldersOpen, paneKey, folder, sent, confirming, selected]);

  // --- Draft ---------------------------------------------------------------------------------------------------
  const writeDraft = (next: Draft | null) => {
    const text = serializeDraft(next);
    rememberDraft(text);
    setDraft(next);
    dispatchSoon({ type: 'SET_DRAFT', id: win.id, draft: text });
  };

  /** Leaving compose for something else: text waits in Drafts; an untouched draft is simply dropped. */
  const setAside = () => {
    if (!draft?.open) return;
    writeDraft(hasText(draft) ? { ...draft, open: false } : null);
  };

  const compose = (reply: InboxMessage | null) => {
    setSent(null);
    setFoldersOpen(false);
    setView('message');
    if (hasText(draft)) {
      // One draft at a time: bring the one with text back rather than lose it.
      if (!draft.open) writeDraft({ ...draft, open: true });
      requestFocus(['[data-focus="body"]', '[data-focus="subject"]']);
      return;
    }
    const base = reply ? replySubject(reply.subject) : '';
    writeDraft({ open: true, subject: base, body: '', base, reply: reply?.id ?? null });
    requestFocus(reply ? ['[data-focus="body"]'] : ['[data-focus="subject"]']);
  };

  const onIntent = useEffectEvent(() => compose(null));
  useEffect(() => {
    // A jump list or another surface asked for a new message (plans/windows/surfaces/taskbar).
    if (takeIntent('compose')) queueMicrotask(() => onIntent());
    return subscribeIntents((intent) => {
      if (intent.kind !== 'compose') return;
      takeIntent('compose');
      onIntent();
    });
  }, []);

  const discardNow = () => {
    setConfirming(false);
    writeDraft(null);
    setView(selected ? 'message' : 'list');
    requestFocus([
      `[data-message="${selected ?? ''}"]`,
      '[data-focus="reading"]',
      '[data-focus="folder"]',
      '[data-focus="new-mail"]',
    ]);
  };
  const requestDiscard = () => (hasText(draft) ? setConfirming(true) : discardNow());

  /** Clipboard with the shell's toast; blocked → the text selected in a read-only field, focus in it (Ctrl+C). */
  const copy = (text: string, what: string, message: string): Promise<boolean> =>
    shell.copyText(text, message).then((copied) => {
      if (!copied) {
        setManual((previous) => ({ key: (previous?.key ?? 0) + 1, text, what }));
        requestFocus(['[data-focus="manual"]']);
      }
      return copied;
    });

  const copyAddress = () => {
    void copy(contact.email, 'the address', 'Copied to clipboard');
    analytics.track({ name: 'contact_initiated', channel: 'copy' });
  };

  const send = () => {
    if (!draft) return;
    const target = sendTarget({ email: contact.email, subject: draft.subject, body: draft.body });
    mailHandOff.open(target.url);
    analytics.track({ name: 'contact_initiated', channel: 'mailto' });
    setLeaving(draft);
    writeDraft(null);
    setSent((previous) => ({ key: (previous?.key ?? 0) + 1, truncated: target.truncated }));
    if (target.truncated)
      void copy(draft.body, 'your whole message', 'Full message copied — paste the rest in your email app').then(
        (copied) => copied && setSent((now) => (now?.truncated ? { ...now, copied: true } : now)),
      );
    requestFocus(['[data-focus="infobar-copy"]']);
  };

  // --- Navigation ----------------------------------------------------------------------------------------------
  const markRead = (id: InboxMessageId, value = true) => {
    setRead(rememberRead(id, value));
  };

  const select = (message: InboxMessage) => {
    setAside();
    setSent(null);
    setSelected(message.id);
    markRead(message.id);
    setView('message');
    if (compact) requestFocus(['[data-focus="reading"]']);
  };

  const chooseFolder = (next: Folder) => {
    setAside();
    setFolder(next);
    setSelected(null);
    setFoldersOpen(false);
    setView('list');
    if (compact) requestFocus(['[data-focus="folder"]']);
  };

  const back = () => {
    setAside();
    setView('list');
    if (compact) requestFocus([`[data-message="${selected ?? ''}"]`, '[data-focus="folder"]']);
  };

  const openDraft = () => {
    if (!draft) return;
    setSent(null);
    writeDraft({ ...draft, open: true });
    setView('message');
    requestFocus(['[data-focus="body"]']);
  };

  // --- Menus ---------------------------------------------------------------------------------------------------
  const readToggle: MenuEntry = {
    kind: 'item',
    id: 'read',
    label: current && !unread(current) ? 'Mark as unread' : 'Mark as read',
    disabled: !current,
    onSelect: () => current && markRead(current.id, unread(current)),
  };
  const resumeItems: readonly MenuEntry[] = [
    { kind: 'item', id: 'resume-open', label: 'Open résumé', icon: <Fl icon={flOpen} />, onSelect: openResume },
    {
      kind: 'item',
      id: 'resume-save',
      label: 'Save résumé',
      icon: <Fl icon={flDownload} />,
      disabled: getResumeFileMeta() === null,
      onSelect: () => saveResume(shell),
    },
  ];
  const openMore = (button: HTMLElement) =>
    shell.openMenu({
      label: 'More options',
      at: menuPoint(button),
      returnFocusTo: button,
      items: compact
        ? [
            {
              kind: 'item',
              id: 'reply',
              label: 'Reply',
              icon: <Fl icon={flReply} />,
              disabled: !current,
              onSelect: () => current && compose(current),
            },
            { kind: 'item', id: 'copy', label: 'Copy address', icon: <Fl icon={flCopy} />, onSelect: copyAddress },
            { kind: 'separator', id: 'sep-1' },
            readToggle,
            { kind: 'separator', id: 'sep-2' },
            ...resumeItems,
          ]
        : [readToggle, { kind: 'separator', id: 'sep' }, ...resumeItems],
    });

  // --- List ----------------------------------------------------------------------------------------------------
  const needle = query.trim().toLowerCase();
  const matches = (...texts: readonly string[]) => !needle || texts.some((text) => text.toLowerCase().includes(needle));
  const inboxRows = inbox.filter((message) =>
    matches(message.from.name, message.subject, message.preview, ...message.body),
  );
  const draftRows = draft && hasText(draft) && matches(draft.subject, draft.body) ? [draft] : [];

  let listBody: ReactNode;
  if (folder === 'inbox' && pivot === 'other') {
    listBody = (
      <Empty title="Nothing in Other" line={`Everything from ${person.givenName} lands in Focused.`} icon={flMail} />
    );
  } else if (folder === 'inbox') {
    listBody =
      inboxRows.length === 0 ? (
        <Empty title="No results" line="Try a different word or clear the search." icon={flSearch} />
      ) : (
        <RovingGroup as="ul" role="list" orientation="vertical" className={styles.rows} aria-label="Messages">
          {inboxRows.map((message) => {
            const isUnread = unread(message);
            return (
              <li key={message.id}>
                <button
                  type="button"
                  className={styles.row}
                  data-roving-item=""
                  data-message={message.id}
                  data-unread={isUnread || undefined}
                  aria-current={message.id === selected ? 'true' : undefined}
                  aria-label={[
                    isUnread ? 'Unread' : null,
                    message.from.name,
                    message.subject,
                    message.preview,
                    message.dateLabel,
                    message.attachment ? 'Has attachments' : null,
                    message.pinned ? 'Pinned' : null,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  onClick={() => select(message)}
                >
                  <span className={styles.avatar} aria-hidden="true">
                    {message.from.initials}
                  </span>
                  <span className={styles.rowFrom}>{message.from.name}</span>
                  <span className={styles.rowIcons} aria-hidden="true">
                    {message.attachment ? <Fl icon={flAttach} size={14} /> : null}
                    {message.pinned ? <Fl icon={flPin} size={14} /> : null}
                  </span>
                  <span className={styles.rowSubject}>{message.subject}</span>
                  <time className={styles.rowTime} dateTime={message.date}>
                    {shortDate(message.date)}
                  </time>
                  <span className={styles.rowPreview}>{message.preview}</span>
                </button>
              </li>
            );
          })}
        </RovingGroup>
      );
  } else if (folder === 'drafts' && draftRows.length > 0) {
    const waiting = draftRows[0]!;
    const preview = waiting.body.trim().replace(/\s+/g, ' ').slice(0, 160);
    listBody = (
      <ul role="list" className={styles.rows} aria-label="Drafts">
        <li>
          <button
            type="button"
            className={styles.row}
            data-draft=""
            aria-current={waiting.open ? 'true' : undefined}
            aria-label={['Draft', `To ${person.name}`, waiting.subject.trim() || '(No subject)', preview]
              .filter(Boolean)
              .join(', ')}
            onClick={openDraft}
          >
            <span className={styles.avatar} aria-hidden="true">
              <Fl icon={flDrafts} size={16} />
            </span>
            <span className={styles.rowFrom}>
              <span className={styles.draftMark}>[Draft]</span> {person.name}
            </span>
            <span className={styles.rowSubject}>{waiting.subject.trim() || '(No subject)'}</span>
            <span className={styles.rowPreview}>{preview || 'No preview is available.'}</span>
          </button>
        </li>
      </ul>
    );
  } else if (folder === 'drafts') {
    listBody = (
      <Empty
        title={needle ? 'No results' : 'Nothing in Drafts'}
        line="A message you start here waits in Drafts until you send or discard it."
        icon={flDrafts}
      />
    );
  } else {
    listBody = (
      <Empty title="Nothing in Sent Items" line="Messages you send open in your own mail app." icon={flSent} />
    );
  }

  // --- Reading pane ------------------------------------------------------------------------------------------------
  let reading: ReactNode;
  if (leaving) {
    reading = (
      <ComposeForm
        key="leaving"
        uid={`${uid}-leaving`}
        draft={leaving}
        email={contact.email}
        compact={compact}
        leaving
      />
    );
  } else if (draft?.open) {
    reading = (
      <ComposeForm
        key="compose"
        uid={uid}
        draft={draft}
        email={contact.email}
        compact={compact}
        onChange={(patch) => writeDraft({ ...draft, ...patch })}
        onSend={send}
        onDiscard={requestDiscard}
      />
    );
  } else if (current) {
    reading = (
      <article key={current.id} className={styles.message} aria-labelledby={`${uid}-subject`}>
        <h3 id={`${uid}-subject`} className={styles.subject} tabIndex={-1} data-focus="reading">
          {current.subject}
        </h3>
        <div className={styles.header}>
          <span className={styles.avatarLarge} aria-hidden="true">
            {current.from.initials}
          </span>
          <div className={styles.headerText}>
            <p className={styles.sender}>
              <span className={styles.senderName}>{current.from.name}</span>{' '}
              <span className={styles.senderAddress}>&lt;{current.from.address}&gt;</span>
            </p>
            <p className={styles.recipients}>To: {current.to}</p>
          </div>
          <time className={styles.headerDate} dateTime={current.date}>
            {headerDate(current.date)}
          </time>
        </div>
        {current.attachment ? (
          <div className={styles.attachment}>
            <KernelLink
              to={RESUME}
              className={styles.attachmentOpen}
              aria-label={`${current.attachment.name}, ${current.attachment.label}. Open in ${winBinding('browser').title}`}
              data-attachment=""
            >
              <PdfFile size={32} />
              <span className={styles.attachmentText}>
                <span className={styles.attachmentName}>{current.attachment.name}</span>
                <span className={styles.attachmentSize}>{current.attachment.size ?? current.attachment.label}</span>
              </span>
            </KernelLink>
            <button
              type="button"
              className={styles.attachmentMore}
              aria-haspopup="menu"
              aria-label={`More actions for ${current.attachment.name}`}
              onClick={(event) =>
                shell.openMenu({
                  label: `${current.attachment!.name} actions`,
                  at: menuPoint(event.currentTarget),
                  returnFocusTo: event.currentTarget,
                  items: [
                    { kind: 'item', id: 'open', label: 'Open', icon: <Fl icon={flOpen} />, onSelect: openResume },
                    {
                      kind: 'item',
                      id: 'save',
                      label: 'Save as',
                      icon: <Fl icon={flDownload} />,
                      disabled: !current.attachment!.downloadable,
                      onSelect: () => saveResume(shell),
                    },
                  ],
                })
              }
            >
              <Fl icon={flChevronDown} size={12} />
            </button>
          </div>
        ) : null}
        <div className={styles.body}>
          {current.body.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        {current.links && current.links.length > 0 ? (
          <ul role="list" className={styles.links} aria-label="Links">
            {current.links.map((link) => (
              <li key={link.url}>
                <a
                  className={styles.button}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={trackLink}
                >
                  <span>{link.label}</span>
                  <span className={styles.dim}>{link.handle}</span>
                  <Fl icon={flOpen} size={16} />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={() => compose(current)}>
            <Fl icon={flReply} size={16} />
            Reply by email
          </button>
          <button type="button" className={styles.button} onClick={copyAddress}>
            <Fl icon={flCopy} size={16} />
            Copy address
          </button>
          {linkedin ? (
            <a
              className={styles.button}
              href={linkedin.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={trackLink}
            >
              {linkedin.label}
              <Fl icon={flOpen} size={16} />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}
        </div>
      </article>
    );
  } else {
    reading = <Empty key="empty" title="Select an item to read" line="Nothing is selected" icon={flMail} large />;
  }

  const pushed = (pane: 'folders' | 'list' | 'reading') =>
    compact &&
    (pane === 'folders'
      ? !foldersOpen
      : pane === 'list'
        ? foldersOpen || view === 'message'
        : foldersOpen || view === 'list');

  return (
    <>
      <TitleBar tall>
        <span className={styles.appName} aria-hidden="true" data-compact={compact || undefined}>
          {windowTitle(win).visible}
        </span>
        <div className={styles.searchSlot} data-compact={compact || undefined}>
          <div className={styles.search} role="search">
            <Fl icon={flSearch} size={16} className={styles.searchIcon} />
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search"
              aria-label="Search mail"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && query) {
                  event.preventDefault();
                  setQuery('');
                }
              }}
            />
          </div>
        </div>
      </TitleBar>
      <div
        ref={root}
        className={styles.app}
        data-compact={compact || undefined}
        data-view={view}
        data-folders={collapsed && !compact ? 'icons' : undefined}
      >
        <nav className={styles.rail} aria-label="Outlook apps" inert={confirming || undefined}>
          <ul role="list" className={styles.railList}>
            <li>
              <button
                type="button"
                className={styles.railItem}
                aria-current="page"
                aria-label="Mail"
                title="Mail"
                onClick={() => chooseFolder('inbox')}
              >
                <Fl icon={flMailFilled} size={20} />
              </button>
            </li>
            <li>
              <button type="button" className={styles.railItem} aria-label="Calendar" title="Calendar" disabled>
                <Fl icon={flCalendar} size={20} />
              </button>
            </li>
            <li>
              <button type="button" className={styles.railItem} aria-label="People" title="People" disabled>
                <Fl icon={flPeople} size={20} />
              </button>
            </li>
          </ul>
        </nav>
        <div className={styles.main} inert={confirming || undefined}>
          <RovingGroup
            as="div"
            role="toolbar"
            aria-label="Mail commands"
            orientation="horizontal"
            className={styles.ribbon}
          >
            {compact ? (
              <button
                type="button"
                className={styles.command}
                data-roving-item=""
                aria-label="Folders"
                aria-expanded={foldersOpen}
                onClick={() => {
                  setFoldersOpen((open) => !open);
                  if (!foldersOpen) requestFocus(['[aria-current="page"][data-folder]', '[data-folder]']);
                }}
              >
                <Fl icon={flNavigation} size={20} />
              </button>
            ) : null}
            <button
              type="button"
              className={styles.newMail}
              data-roving-item=""
              data-focus="new-mail"
              onClick={() => compose(null)}
            >
              <Fl icon={flCompose} size={20} />
              New mail
            </button>
            {compact ? null : (
              <>
                <span className={styles.divider} aria-hidden="true" />
                <button
                  type="button"
                  className={styles.command}
                  data-roving-item=""
                  disabled={!current}
                  onClick={() => current && compose(current)}
                >
                  <Fl icon={flReply} size={20} />
                  Reply
                </button>
                <button type="button" className={styles.command} data-roving-item="" onClick={copyAddress}>
                  <Fl icon={flCopy} size={20} />
                  Copy address
                </button>
              </>
            )}
            <button
              type="button"
              className={styles.command}
              data-roving-item=""
              aria-label="More options"
              aria-haspopup="menu"
              onClick={(event) => openMore(event.currentTarget)}
            >
              <Fl icon={flMore} size={20} />
            </button>
          </RovingGroup>
          {manual ? (
            <div key={manual.key} className={styles.manual} role="group" aria-labelledby={`${uid}-manual-label`}>
              <Fl icon={flInfoFilled} size={16} className={styles.infoIcon} />
              <label id={`${uid}-manual-label`} htmlFor={`${uid}-manual`} className={styles.manualLabel}>
                The clipboard is blocked here. Press Ctrl+C to copy {manual.what}.
              </label>
              {manual.text.includes('\n') || manual.text.length > 80 ? (
                <textarea
                  id={`${uid}-manual`}
                  className={styles.manualField}
                  data-focus="manual"
                  readOnly
                  rows={3}
                  value={manual.text}
                  onFocus={(event) => event.currentTarget.select()}
                />
              ) : (
                <input
                  id={`${uid}-manual`}
                  className={styles.manualField}
                  data-focus="manual"
                  readOnly
                  value={manual.text}
                  size={Math.max(8, manual.text.length)}
                  onFocus={(event) => event.currentTarget.select()}
                />
              )}
              <button
                type="button"
                className={styles.infoClose}
                aria-label="Close"
                onClick={() => {
                  setManual(null);
                  requestFocus(['[data-focus="new-mail"]']);
                }}
              >
                <Fl icon={flDismiss} size={16} />
              </button>
            </div>
          ) : null}
          <div className={styles.panes}>
            <nav className={styles.folders} aria-label="Folders" hidden={pushed('folders') || undefined}>
              {compact ? null : (
                <button
                  type="button"
                  className={styles.hamburger}
                  aria-label={collapsed ? 'Expand navigation pane' : 'Collapse navigation pane'}
                  aria-expanded={!collapsed}
                  title={collapsed ? 'Expand navigation pane' : 'Collapse navigation pane'}
                  onClick={() => setCollapsedPref(!collapsed)}
                >
                  <Fl icon={flNavigation} size={20} />
                </button>
              )}
              <RovingGroup as="ul" role="list" orientation="vertical" className={styles.folderList}>
                {FOLDERS.map((item) => {
                  const count = item.id === 'inbox' ? unreadCount : item.id === 'drafts' ? draftCount : 0;
                  const spoken =
                    count === 0
                      ? item.label
                      : item.id === 'inbox'
                        ? `${item.label}, ${count} unread`
                        : `${item.label}, ${count} ${count === 1 ? 'item' : 'items'}`;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={styles.folder}
                        data-roving-item=""
                        data-folder={item.id}
                        aria-current={folder === item.id ? 'page' : undefined}
                        aria-label={spoken}
                        title={item.label}
                        onClick={() => chooseFolder(item.id)}
                      >
                        <Fl icon={item.icon} size={20} />
                        <span className={styles.folderLabel}>{item.label}</span>
                        {count > 0 ? (
                          <span className={styles.count} data-kind={item.id}>
                            {count}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </RovingGroup>
            </nav>
            <div className={styles.list} hidden={pushed('list') || undefined}>
              <div className={styles.listHeader}>
                <h3 className={styles.folderTitle} tabIndex={-1} data-focus="folder">
                  {FOLDER_LABEL[folder]}
                </h3>
              </div>
              {folder === 'inbox' ? (
                <>
                  <RovingGroup
                    as="div"
                    role="tablist"
                    aria-label="Inbox view"
                    orientation="horizontal"
                    className={styles.pivot}
                  >
                    {(['focused', 'other'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        role="tab"
                        id={`${uid}-tab-${tab}`}
                        className={styles.tab}
                        data-roving-item=""
                        aria-selected={pivot === tab}
                        aria-controls={`${uid}-panel`}
                        onClick={() => setPivot(tab)}
                      >
                        {tab === 'focused' ? 'Focused' : 'Other'}
                      </button>
                    ))}
                  </RovingGroup>
                  <div
                    role="tabpanel"
                    id={`${uid}-panel`}
                    aria-labelledby={`${uid}-tab-${pivot}`}
                    className={styles.panel}
                  >
                    {listBody}
                  </div>
                </>
              ) : (
                <div className={styles.panel}>{listBody}</div>
              )}
            </div>
            <section className={styles.reading} aria-label="Reading pane" hidden={pushed('reading') || undefined}>
              <div className={styles.readingBar}>
                <button
                  type="button"
                  className={styles.back}
                  data-focus="back"
                  aria-label={`Back to ${FOLDER_LABEL[folder]}`}
                  onClick={back}
                >
                  <Fl icon={flArrowLeft} size={16} />
                  {FOLDER_LABEL[folder]}
                </button>
              </div>
              <div className={styles.status} role="status">
                {sent ? (
                  <div key={sent.key} className={styles.infobar}>
                    <Fl icon={flInfoFilled} size={16} className={styles.infoIcon} />
                    <p className={styles.infoText}>
                      <strong>Handed to your email app.</strong> Nothing opened? Copy the address.
                      {sent.truncated ? ' Your message was long, so only its first part went across.' : null}
                      {sent.copied ? ' The full text is on your clipboard — paste it in.' : null}
                    </p>
                    <button type="button" className={styles.button} data-focus="infobar-copy" onClick={copyAddress}>
                      Copy
                    </button>
                    <button
                      type="button"
                      className={styles.infoClose}
                      aria-label="Close"
                      onClick={() => {
                        setSent(null);
                        requestFocus([
                          '[data-focus="reading"]',
                          `[data-message="${selected ?? ''}"]`,
                          '[data-focus="new-mail"]',
                        ]);
                      }}
                    >
                      <Fl icon={flDismiss} size={16} />
                    </button>
                  </div>
                ) : null}
              </div>
              <div key={paneKey} className={styles.pane}>
                {reading}
              </div>
            </section>
          </div>
        </div>
        {confirming ? (
          <DiscardDialog
            uid={uid}
            onDiscard={discardNow}
            onKeep={() => {
              setConfirming(false);
              requestFocus(['[data-focus="discard"]', '[data-focus="body"]']);
            }}
          />
        ) : null}
      </div>
    </>
  );
}

// --- Pieces ---------------------------------------------------------------------------------------------------------

function Empty({
  title,
  line,
  icon,
  large = false,
}: {
  readonly title: string;
  readonly line: string;
  readonly icon: Glyph;
  readonly large?: boolean;
}) {
  return (
    <div className={styles.empty} data-large={large || undefined}>
      <Fl icon={icon} size={large ? 48 : 32} className={styles.emptyIcon} />
      <p className={styles.emptyTitle}>{title}</p>
      <p className={styles.emptyLine}>{line}</p>
    </div>
  );
}

function ComposeForm({
  uid,
  draft,
  email,
  compact,
  leaving = false,
  onChange,
  onSend,
  onDiscard,
}: {
  readonly uid: string;
  readonly draft: Draft;
  readonly email: string;
  readonly compact: boolean;
  /** The collapsing copy shown for 167 ms after Send: inert, not a form anyone can use. */
  readonly leaving?: boolean;
  readonly onChange?: (patch: Partial<Pick<Draft, 'subject' | 'body'>>) => void;
  readonly onSend?: () => void;
  readonly onDiscard?: () => void;
}) {
  const body = useRef<HTMLTextAreaElement>(null);
  const sendKeys = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      onSend?.();
    }
  };
  const bar = (
    <div className={styles.composeBar}>
      <button type="submit" className={styles.send} aria-describedby={`${uid}-hint`}>
        <Fl icon={flSend} size={16} />
        Send
      </button>
      <button type="button" className={styles.button} data-focus="discard" onClick={onDiscard}>
        <Fl icon={flDelete} size={16} />
        Discard
      </button>
    </div>
  );
  return (
    <form
      className={styles.compose}
      aria-labelledby={`${uid}-compose`}
      data-leaving={leaving || undefined}
      inert={leaving || undefined}
      onSubmit={(event) => {
        event.preventDefault();
        onSend?.();
      }}
    >
      <h3 id={`${uid}-compose`} className="sr-only">
        {draft.reply ? 'Reply' : 'New message'}
      </h3>
      {compact ? null : bar}
      <div className={styles.field}>
        <label htmlFor={`${uid}-to`} className={styles.fieldLabel}>
          To
        </label>
        <input id={`${uid}-to`} className={styles.recipient} readOnly value={email} size={Math.max(8, email.length)} />
      </div>
      <div className={styles.field}>
        <label htmlFor={`${uid}-subject-input`} className="sr-only">
          Subject
        </label>
        <input
          id={`${uid}-subject-input`}
          className={styles.subjectInput}
          data-focus="subject"
          placeholder="Add a subject"
          autoComplete="off"
          readOnly={leaving}
          value={draft.subject}
          onChange={(event) => onChange?.({ subject: event.target.value })}
          onKeyDown={(event) => {
            sendKeys(event);
            if (event.key === 'Enter' && !event.defaultPrevented) {
              // Enter in the subject moves on to the message; only Ctrl/Cmd+Enter or Send sends.
              event.preventDefault();
              body.current?.focus();
            }
          }}
        />
      </div>
      <label htmlFor={`${uid}-body`} className="sr-only">
        Message
      </label>
      <textarea
        id={`${uid}-body`}
        ref={body}
        className={styles.bodyInput}
        data-focus="body"
        readOnly={leaving}
        value={draft.body}
        onChange={(event) => onChange?.({ body: event.target.value })}
        onKeyDown={sendKeys}
      />
      <p id={`${uid}-hint`} className={styles.hint}>
        Send opens your email app with this message · Ctrl+Enter
      </p>
      {compact ? bar : null}
    </form>
  );
}

function DiscardDialog({
  uid,
  onDiscard,
  onKeep,
}: {
  readonly uid: string;
  readonly onDiscard: () => void;
  readonly onKeep: () => void;
}) {
  const keep = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const escape = useEffectEvent((event: globalThis.KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    onKeep();
  });
  useEffect(() => {
    keep.current?.focus();
    const node = dialog.current;
    const onKey = (event: globalThis.KeyboardEvent) => escape(event);
    node?.addEventListener('keydown', onKey);
    return () => node?.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className={styles.smoke}>
      <FocusScope trapped className={styles.dialogScope}>
        <div
          ref={dialog}
          className={styles.dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${uid}-discard-title`}
          aria-describedby={`${uid}-discard-text`}
        >
          <div className={styles.dialogContent}>
            <h3 id={`${uid}-discard-title`} className={styles.dialogTitle}>
              Discard this draft?
            </h3>
            <p id={`${uid}-discard-text`}>The text you wrote will be deleted.</p>
          </div>
          <div className={styles.dialogButtons}>
            <button type="button" className={styles.dialogPrimary} onClick={onDiscard}>
              Discard
            </button>
            <button ref={keep} type="button" className={styles.button} onClick={onKeep}>
              Keep
            </button>
          </div>
        </div>
      </FocusScope>
    </div>
  );
}
