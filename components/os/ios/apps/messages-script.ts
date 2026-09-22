/**
 * Messages' script graph (plans/ios/apps/messages.md "Portfolio mapping", `IOS-MSG-02`): a scripted chat whose
 * quick-reply chips reveal real contact channels. Pure and React-free — every fact arrives as an argument (`person`,
 * `contact`, `resume`, the résumé file meta, featured projects), so nothing here is typed career content (north-star
 * B9). The words around the facts are first-person UI copy.
 *
 *   "What do you do?"            → headline + one-line summary        → "See projects" (opens GitHub)
 *   "Are you available?"         → person.openTo                      → "Email you" · "Copy your email"
 *   "Show me your résumé"        → an attachment bubble "Résumé.pdf"  (opens Files Quick Look)
 *   "Where else can I find you?" → a link bubble per contact.links entry (new tab)
 *   "Email you"                  → a `mailto:` hand-off (the same builder as Mail)
 * All branches visited → the top-level chips again, plus "Start over".
 */
import type { Contact, ContactLink, ContactLinkKind, Person, Project } from '@/data/schema';
import { mailtoUrl } from '@/components/content/contact-actions';
import { resumeFileLabel } from '@/components/content/format';

export type ChipId =
  'what' | 'available' | 'resume' | 'where' | 'projects' | 'email' | 'copy-email' | 'hello' | 'start-over';

/** The top-level questions, in chip order. */
export const TOP_LEVEL: readonly ChipId[] = ['what', 'available', 'resume', 'where'];

export type Speaker = 'them' | 'me';

export type ScriptBubble =
  | { readonly kind: 'text'; readonly from: Speaker; readonly text: string }
  /** A rich link to one of `contact.links` (opens in a new tab). */
  | {
      readonly kind: 'link';
      readonly from: 'them';
      readonly linkKind: ContactLinkKind;
      readonly label: string;
      readonly handle: string;
      readonly url: string;
    }
  /** A link that opens another iOS app (GitHub). */
  | {
      readonly kind: 'app';
      readonly from: 'them';
      readonly role: 'github';
      readonly label: string;
      readonly detail: string;
    }
  /** The résumé as an attachment (opens Files Quick Look). */
  | { readonly kind: 'attachment'; readonly from: 'them'; readonly name: string; readonly label: string }
  /** A `mailto:` link. */
  | {
      readonly kind: 'mailto';
      readonly from: 'them';
      readonly label: string;
      readonly email: string;
      readonly href: string;
    }
  /** The copy result: `copied` text, or — clipboard blocked — `blocked` text plus the address as selectable text. */
  | {
      readonly kind: 'address';
      readonly from: 'them';
      readonly email: string;
      readonly copied: string;
      readonly blocked: string;
    };

export type ScriptAction =
  | { readonly kind: 'open-app'; readonly role: 'github' }
  | { readonly kind: 'mailto'; readonly href: string }
  | { readonly kind: 'copy'; readonly text: string }
  | { readonly kind: 'reset' };

export interface Branch {
  readonly id: ChipId;
  /** The chip's label. */
  readonly chip: string;
  /** What the visitor "says" (the outgoing bubble). */
  readonly say: string;
  readonly replies: readonly ScriptBubble[];
  /** Follow-up chips offered right after this branch. */
  readonly next: readonly ChipId[];
  readonly action?: ScriptAction;
}

export interface Script {
  /** Conversation name ("Jaswanth") and full name (the avatar's initials). */
  readonly givenName: string;
  readonly name: string;
  readonly email: string;
  /** The two greeting bubbles shown on first open. */
  readonly greeting: readonly ScriptBubble[];
  readonly branches: Readonly<Record<ChipId, Branch>>;
}

export interface ScriptData {
  readonly person: Pick<Person, 'name' | 'givenName' | 'headline' | 'summary' | 'openTo'>;
  readonly contact: Contact;
  /** The résumé's file meta (`getResumeFileMeta()`) — `null` before the PDF is built. */
  readonly file: { readonly bytes: number; readonly pages: number } | null;
  readonly featured: readonly Pick<Project, 'name'>[];
}

/** The attachment's file name, as Files shows it (plans/ios/apps/messages.md). */
export const RESUME_ATTACHMENT = 'Résumé.pdf';

const listOf = (items: readonly string[]): string =>
  new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(items);

/** The first sentence of the summary — the "one-line summary". */
export function oneLine(summary: readonly string[]): string {
  const first = (summary[0] ?? '').replace(/\s+/g, ' ').trim();
  const match = /^.*?[.!?](?=\s|$)/.exec(first);
  return match ? match[0] : first;
}

const text = (from: Speaker, value: string): ScriptBubble => ({ kind: 'text', from, text: value });
const linkBubble = (link: ContactLink): ScriptBubble => ({
  kind: 'link',
  from: 'them',
  linkKind: link.kind,
  label: link.label,
  handle: link.handle,
  url: link.url,
});

export function buildScript({ person, contact, file, featured }: ScriptData): Script {
  const email = contact.email;
  const mailto = mailtoUrl({ email, subject: `Hi ${person.givenName}` });
  const summary = oneLine(person.summary);
  const pages = file ? `, ${file.pages} ${file.pages === 1 ? 'page' : 'pages'}` : '';
  const names = featured.map((project) => project.name);

  const branches: Record<ChipId, Branch> = {
    what: {
      id: 'what',
      chip: 'What do you do?',
      say: 'What do you do?',
      replies: [text('them', person.headline), ...(summary ? [text('them', summary)] : [])],
      next: ['projects'],
    },
    projects: {
      id: 'projects',
      chip: 'See projects',
      say: 'Can I see your projects?',
      replies: [
        text(
          'them',
          names.length > 0
            ? `Sure! A few I'm proud of: ${listOf(names)}. I've opened them in GitHub for you.`
            : `Sure! I've opened them in GitHub for you.`,
        ),
        { kind: 'app', from: 'them', role: 'github', label: 'Projects', detail: 'Open in GitHub' },
      ],
      next: [],
      action: { kind: 'open-app', role: 'github' },
    },
    available: {
      id: 'available',
      chip: 'Are you available?',
      say: 'Are you available?',
      replies: [text('them', person.openTo), text('them', 'Want to get in touch?')],
      next: ['email', 'copy-email'],
    },
    email: {
      id: 'email',
      chip: 'Email you',
      say: "I'd like to email you.",
      replies: [
        text('them', 'Great — your email app should open with my address filled in. If it didn’t, tap here:'),
        { kind: 'mailto', from: 'them', label: `Email ${person.givenName}`, email, href: mailto },
      ],
      next: [],
      action: { kind: 'mailto', href: mailto },
    },
    'copy-email': {
      id: 'copy-email',
      chip: 'Copy your email',
      say: 'Can I copy your email address?',
      replies: [
        {
          kind: 'address',
          from: 'them',
          email,
          copied: `Done — ${email} is on your clipboard.`,
          blocked: 'Your browser blocked the clipboard, so here it is to select and copy:',
        },
      ],
      next: [],
      action: { kind: 'copy', text: email },
    },
    resume: {
      id: 'resume',
      chip: 'Show me your résumé',
      say: 'Show me your résumé.',
      replies: [
        text('them', 'Here you go — tap it to read it right here.'),
        { kind: 'attachment', from: 'them', name: RESUME_ATTACHMENT, label: `${resumeFileLabel(file)}${pages}` },
      ],
      next: [],
    },
    where: {
      id: 'where',
      chip: 'Where else can I find you?',
      say: 'Where else can I find you?',
      replies:
        contact.links.length > 0
          ? [
              text('them', `You can find me on ${listOf(contact.links.map((link) => link.label))}:`),
              ...contact.links.map(linkBubble),
            ]
          : [text('them', `Email is the best place to find me: ${email}`)],
      next: ['email'],
    },
    hello: {
      id: 'hello',
      chip: 'Say hello',
      say: 'Hello!',
      replies: [text('them', `Hi! Thanks for saying hello. What would you like to know?`)],
      next: [],
    },
    'start-over': {
      id: 'start-over',
      chip: 'Start over',
      say: '',
      replies: [],
      next: [],
      action: { kind: 'reset' },
    },
  };

  return {
    givenName: person.givenName,
    name: person.name,
    email,
    greeting: [
      text('them', `Hi, I'm ${person.givenName}!`),
      text('them', 'Thanks for stopping by. Pick a question below and I’ll answer.'),
    ],
    branches,
  };
}

/**
 * The chips on offer after the visitor's `visited` branches (latest last): the last branch's follow-ups not yet
 * visited, then the unvisited top-level questions. Nothing left → the top-level set again plus "Start over".
 */
export function chipsAfter(script: Script, visited: readonly ChipId[]): readonly ChipId[] {
  const seen = new Set(visited);
  const last = visited[visited.length - 1];
  const followUps = last ? script.branches[last].next.filter((id) => !seen.has(id)) : [];
  const rest = TOP_LEVEL.filter((id) => !seen.has(id) && !followUps.includes(id));
  const offered = [...followUps, ...rest];
  return offered.length > 0 ? offered : [...TOP_LEVEL, 'start-over'];
}

// --- Transcript ----------------------------------------------------------------------------------------------------

/** One visited branch, as the session stores it: chip, time (ms), and the copy outcome for "Copy your email". */
export interface Step {
  readonly c: ChipId;
  readonly t: number;
  readonly o?: 'copied' | 'blocked';
}

/** The conversation's session state (`WindowInstance.ui.thread`). `at` = first opened (null: never). */
export interface ThreadState {
  readonly at: number | null;
  readonly s: readonly Step[];
  /** How many times the visitor chose "Start over" (a new conversation). */
  readonly r?: number;
}

export const EMPTY_THREAD: ThreadState = { at: null, s: [] };
/** Steps kept (the session value stays far under the kernel's 4 000-character cap). */
export const MAX_STEPS = 40;

export interface Line {
  readonly key: string;
  readonly bubble: ScriptBubble;
  /** When it was said (ms) — for the centred timestamps. */
  readonly time: number;
  /** The copy outcome, for `address` bubbles. */
  readonly outcome?: 'copied' | 'blocked';
}

/** Every bubble of the conversation: the greeting, then each visited branch's outgoing line and its replies. */
export function transcript(script: Script, thread: ThreadState): readonly Line[] {
  const start = thread.at ?? 0;
  const lines: Line[] = script.greeting.map((bubble, index) => ({ key: `g:${index}`, bubble, time: start }));
  thread.s.forEach((step, stepIndex) => {
    const branch = script.branches[step.c];
    if (!branch || branch.id === 'start-over') return;
    lines.push({ key: `${stepIndex}:me`, bubble: text('me', branch.say), time: step.t });
    branch.replies.forEach((bubble, index) =>
      lines.push({ key: `${stepIndex}:${index}`, bubble, time: step.t, ...(step.o ? { outcome: step.o } : {}) }),
    );
  });
  return lines;
}

/** Parse the stored value defensively (a hand-edited or older session never breaks the app). */
export function parseThread(value: unknown): ThreadState {
  if (!value || typeof value !== 'object') return EMPTY_THREAD;
  const raw = value as { at?: unknown; s?: unknown; r?: unknown };
  const at = typeof raw.at === 'number' && Number.isFinite(raw.at) ? raw.at : null;
  const known = new Set<string>([...TOP_LEVEL, 'projects', 'email', 'copy-email', 'hello']);
  const s = Array.isArray(raw.s)
    ? raw.s
        .filter(
          (step): step is Step =>
            !!step &&
            typeof step === 'object' &&
            known.has((step as Step).c) &&
            typeof (step as Step).t === 'number' &&
            ((step as Step).o === undefined || (step as Step).o === 'copied' || (step as Step).o === 'blocked'),
        )
        .slice(-MAX_STEPS)
    : [];
  const r = typeof raw.r === 'number' && Number.isInteger(raw.r) && raw.r > 0 ? raw.r : undefined;
  return r ? { at, s, r } : { at, s };
}

/** Plain text of a bubble — what a screen reader hears and what the conversation list previews. */
export function bubbleText(line: Pick<Line, 'bubble' | 'outcome'>): string {
  const { bubble } = line;
  switch (bubble.kind) {
    case 'text':
      return bubble.text;
    case 'link':
      return `${bubble.label}: ${bubble.handle}`;
    case 'app':
      return `${bubble.label} — ${bubble.detail}`;
    case 'attachment':
      return `Attachment: ${bubble.name}, ${bubble.label}`;
    case 'mailto':
      return `${bubble.label}: ${bubble.email}`;
    case 'address':
      return line.outcome === 'blocked' ? `${bubble.blocked} ${bubble.email}` : bubble.copied;
  }
}

/** Typing time before an incoming bubble: ≤ 600 ms each (plans/ios/apps/messages.md). */
export const typingMs = (line: Pick<Line, 'bubble' | 'outcome'>): number =>
  Math.min(600, 320 + Math.round(bubbleText(line).length * 3));
