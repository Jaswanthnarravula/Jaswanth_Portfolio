/**
 * The shared inbox — every OS's mail app shows the same three messages, generated from data (plans/macos/apps/mail.md
 * "Portfolio mapping", plans/windows/apps/outlook.md; `MAC-MAIL-01` · `WIN-OUT-01`), and hands a composed message to
 * the visitor's own email app the same way (`VIEW-CONTACT-01`, `MAC-MAIL-03` · `WIN-OUT-03`):
 *   · "Let's talk" (pinned, unread) — `person.openTo`, the email address, the other channels;
 *   · "Where to find me" — `contact.links`, rendered by the app as buttons;
 *   · "My résumé" — the PDF as an attachment (name, size, pages from the build's file meta).
 * Pure and OS-agnostic: no hooks, no DOM, no `window`. The words are first-person copy; every fact is an argument.
 * Each message is dated with the résumé's `updated` day — the day this content was last revised (the only date the
 * data publishes), never an invented one.
 */
import type { Contact, ContactLink, Person, Resume } from '@/data/schema';
import { byteSize, resumeFileLabel, type ResumeFileMeta } from './format';
import { formatUpdated } from './resume';
import { mailtoUrl } from './contact-actions';

export type InboxMessageId = 'lets-talk' | 'where-to-find-me' | 'resume';

export interface InboxSender {
  readonly name: string;
  readonly address: string;
  /** "JN" — the avatar's initials. */
  readonly initials: string;
}

export interface InboxAttachment {
  /** The file's name as it downloads (`resume.downloadName`). */
  readonly name: string;
  /** The PDF's URL (`resume.file`). */
  readonly href: string;
  /** "13 KB", or `null` when the PDF has not been built. */
  readonly size: string | null;
  /** "PDF, 13 KB" (or "PDF") — the type-and-size label the download actions state. */
  readonly label: string;
  readonly pages: number | null;
  /** The PDF exists (its build meta is known): Save / Download are offered. */
  readonly downloadable: boolean;
}

export interface InboxMessage {
  readonly id: InboxMessageId;
  readonly from: InboxSender;
  /** The visitor. */
  readonly to: string;
  readonly subject: string;
  /** One line for the message list. */
  readonly preview: string;
  /** The body, one entry per paragraph (the last one is the sign-off). */
  readonly body: readonly string[];
  /** ISO day (`YYYY-MM-DD`). */
  readonly date: string;
  /** "January 1, 2026". */
  readonly dateLabel: string;
  /** Unread when the inbox first opens; the app clears it on selection (session state). */
  readonly unread: boolean;
  readonly pinned: boolean;
  readonly attachment?: InboxAttachment;
  /** Channels the app renders as link buttons (open in a new tab). */
  readonly links?: readonly ContactLink[];
}

export interface InboxData {
  readonly person: Person;
  readonly contact: Contact;
  readonly resume: Resume;
  /** `getResumeFileMeta()` — `null` before the PDF is built. */
  readonly file: ResumeFileMeta | null;
}

const PREVIEW_MAX = 160;

const initialsOf = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
};

const listOf = (items: readonly string[]): string =>
  new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(items);

const previewOf = (paragraphs: readonly string[]): string => {
  const text = paragraphs.join(' ').replace(/\s+/g, ' ').trim();
  return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX - 1).trimEnd()}…` : text;
};

/** The three messages, in list order (the pinned one first). */
export function buildInbox({ person, contact, resume, file }: InboxData): readonly InboxMessage[] {
  const from: InboxSender = { name: person.name, address: contact.email, initials: initialsOf(person.name) };
  const shared = { from, to: 'You', date: resume.updated, dateLabel: formatUpdated(resume.updated) } as const;
  const channels = contact.links.map((link) => link.label);

  const talk = [
    'Hi,',
    `Thanks for stopping by. ${person.openTo}`,
    `Email is the quickest way to reach me: ${contact.email}. Reply to this message and your own email app opens with my address already filled in.`,
    ...(channels.length > 0 ? [`You can also find me on ${listOf(channels)}.`] : []),
    person.givenName,
  ];

  const find = [
    channels.length > 0
      ? `Here's where you can find me online: ${listOf(channels)}.`
      : `Email is the best place to find me: ${contact.email}.`,
    ...(channels.length > 0 ? [`Or email me any time at ${contact.email}.`] : []),
    person.givenName,
  ];

  const attachment: InboxAttachment = {
    name: resume.downloadName,
    href: resume.file,
    size: file ? byteSize(file.bytes) : null,
    label: resumeFileLabel(file),
    pages: file ? file.pages : null,
    downloadable: file !== null,
  };
  const facts = file ? ` (${attachment.label}, ${file.pages} ${file.pages === 1 ? 'page' : 'pages'})` : '';
  const cv = [
    `My résumé is attached${facts}. I last updated it on ${formatUpdated(resume.updated)}.`,
    'Open it to read it right here, or save a copy for later.',
    person.givenName,
  ];

  return [
    {
      ...shared,
      id: 'lets-talk',
      subject: "Let's talk",
      preview: previewOf(talk.slice(0, -1)),
      body: talk,
      unread: true,
      pinned: true,
    },
    {
      ...shared,
      id: 'where-to-find-me',
      subject: 'Where to find me',
      preview: previewOf(find.slice(0, -1)),
      body: find,
      unread: true,
      pinned: false,
      links: contact.links,
    },
    {
      ...shared,
      id: 'resume',
      subject: 'My résumé',
      preview: previewOf(cv.slice(0, -1)),
      body: cv,
      unread: true,
      pinned: false,
      attachment,
    },
  ];
}

/** "Re: Let's talk" — never "Re: Re: …". */
export const replySubject = (subject: string): string => (/^re:/i.test(subject.trim()) ? subject : `Re: ${subject}`);

// --- Send = a `mailto:` hand-off (VIEW-CONTACT-01) ------------------------------------------------------------------

/** Longest body a `mailto:` link carries (plans/macos/apps/mail.md, plans/windows/apps/outlook.md). */
export const MAILTO_BODY_LIMIT = 1800;
/** Ends a body that did not fit; the app copies the full text to the clipboard. */
export const CONTINUED_NOTE = '…(continued — paste the rest in your email app)';

export interface SendTarget {
  /** The encoded `mailto:` URL. */
  readonly url: string;
  /** The body did not fit: it was cut and ends with `CONTINUED_NOTE`; the caller copies the full text. */
  readonly truncated: boolean;
  /** The body the URL carries (≤ `MAILTO_BODY_LIMIT` characters). */
  readonly body: string;
}

/** Cut `body` so that it plus the note fits the limit — at a word boundary when one is near, never inside a pair. */
function fit(body: string): string {
  const room = MAILTO_BODY_LIMIT - CONTINUED_NOTE.length - 2;
  let cut = body.slice(0, room);
  const space = cut.search(/\s\S*$/);
  if (space > room * 0.8) cut = cut.slice(0, space);
  if (/[\uD800-\uDBFF]$/.test(cut)) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}\n\n${CONTINUED_NOTE}`;
}

/** The `mailto:` a composed message hands to the visitor's email app (subject and body encoded). */
export function sendTarget({ email, subject, body }: { email: string; subject: string; body: string }): SendTarget {
  const text = body.trimEnd();
  const truncated = text.length > MAILTO_BODY_LIMIT;
  const carried = truncated ? fit(text) : text;
  return { url: mailtoUrl({ email, subject: subject.trim(), body: carried }), truncated, body: carried };
}
