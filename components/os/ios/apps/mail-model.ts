/**
 * iOS Mail — the pure part (plans/ios/apps/mail.md): the session stack (Mailboxes → a mailbox → a message), the
 * row's spoken name, the list's short date and the saved draft. No React, no DOM.
 */
import type { InboxMessage, InboxMessageId } from '@/components/content/inbox';

export type Mailbox = 'inbox' | 'sent' | 'drafts';
export const MAILBOXES: readonly Mailbox[] = ['inbox', 'sent', 'drafts'];
export const MAILBOX_TITLE: Readonly<Record<Mailbox, string>> = { inbox: 'Inbox', sent: 'Sent', drafts: 'Drafts' };

export interface MailStack {
  readonly box: Mailbox | null;
  readonly message: InboxMessageId | null;
}

/** `ui.stack` → what is pushed: `[]` · `['inbox']` · `['inbox', 'msg:lets-talk']` · `['sent']` · `['drafts']`. */
export function readStack(raw: unknown, messages: readonly InboxMessage[]): MailStack {
  if (!Array.isArray(raw)) return { box: null, message: null };
  const [first, second] = raw as unknown[];
  const box = MAILBOXES.find((candidate) => candidate === first) ?? null;
  if (!box) return { box: null, message: null };
  const id = typeof second === 'string' && second.startsWith('msg:') ? second.slice(4) : null;
  const message = box === 'inbox' ? (messages.find((candidate) => candidate.id === id)?.id ?? null) : null;
  return { box, message };
}

export const writeStack = ({ box, message }: MailStack): string[] =>
  box ? (message && box === 'inbox' ? [box, `msg:${message}`] : [box]) : [];

/** Pop one level. */
export const popStack = (stack: MailStack): MailStack =>
  stack.message ? { box: stack.box, message: null } : { box: null, message: null };

/** The list's date column, iOS style: "1/9/26". */
export function shortDate(iso: string): string {
  const [year = '1970', month = '1', day = '1'] = iso.split('-');
  return `${Number(month)}/${Number(day)}/${year.slice(-2)}`;
}

/** A message row's accessible name: "Unread. Jaswanth Narravula. Let's talk. Hi, thanks for stopping by…". */
export const rowLabel = (message: InboxMessage, unread: boolean): string =>
  `${unread ? 'Unread. ' : ''}${message.from.name}. ${message.subject}. ${message.preview}`;

export const isUnread = (message: InboxMessage, read: readonly string[]): boolean =>
  message.unread && !read.includes(message.id);

export function markRead(read: readonly InboxMessageId[], id: InboxMessageId): InboxMessageId[] {
  return read.includes(id) ? [...read] : [...read, id];
}

export function searchMessages(messages: readonly InboxMessage[], query: string): readonly InboxMessage[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return messages;
  return messages.filter((message) =>
    [message.from.name, message.subject, message.preview, ...message.body].join(' ').toLowerCase().includes(needle),
  );
}

/** A draft kept with "Save Draft" (Drafts lists it). Session state, capped like every `ui` value. */
export interface SavedDraft {
  readonly subject: string;
  readonly body: string;
}

export const SAVED_BODY_MAX = 3800;

export function readSaved(raw: unknown): SavedDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const { subject, body } = raw as Record<string, unknown>;
  if (typeof subject !== 'string' || typeof body !== 'string') return null;
  if (!subject.trim() && !body.trim()) return null;
  return { subject, body };
}

export const saveDraft = (subject: string, body: string): SavedDraft => ({
  subject,
  body: body.slice(0, SAVED_BODY_MAX),
});

/** One line for a draft row. */
export const draftPreview = (draft: SavedDraft): string => draft.body.replace(/\s+/g, ' ').trim().slice(0, 140);
