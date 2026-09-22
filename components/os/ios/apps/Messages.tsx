'use client';
/**
 * Messages — a friendlier, conversational route to contact (plans/ios/apps/messages.md, `IOS-MSG-01…05`):
 *   · Conversations list (large title "Messages"): one pinned conversation with an initials avatar, its last line and
 *     time; the thread is pushed onto the stack (session state — `/ios/messages` only);
 *   · the thread: a nav bar with the centred avatar + name; iMessage bubbles (incoming grey left, outgoing blue right,
 *     18 pt radius with a tail), centred timestamps, "Delivered" under the last outgoing bubble;
 *   · the composer: a row of quick-reply chips (a `group` "Suggested replies") above a field that only *looks* like a
 *     text field ("Choose a reply above", `aria-hidden`; tapping it focuses the first chip) — there is no backend to
 *     receive free text, so none is offered;
 *   · every bubble comes from the script graph (`messages-script.ts`) built from data — no typed facts;
 *   · a greeting (2 bubbles) on first open with a typing indicator (≤ 600 ms per bubble) that ANY tap or key press
 *     skips entirely; reduced motion → bubbles appended at once with no indicator (`IOS-MSG-03`);
 *   · hand-offs: `mailto:` (the same builder as Mail), copy (blocked → the address as selectable text), the résumé in
 *     Files Quick Look, contact links in a new tab, projects in GitHub (`IOS-MSG-04`);
 *   · the transcript (visited branches) lives in the session (`WindowInstance.ui.thread`) and is restored without
 *     re-animation; the thread is a `log` whose additions are final text only (`IOS-MSG-05`).
 * Pad: the list and the thread side by side; the thread column is 640 pt max, centred; chips wrap to two rows.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getContact, getFeaturedProjects, getPerson, getResumeFileMeta } from '@/data/selectors';
import { analytics } from '@/lib/analytics/loader';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { subscribeIntents, takeIntent } from '../intents';
import { iosId, initialsOf } from '../model';
import { IOS_SPRINGS, springIn } from '../motion';
import { useAppUi, useAppUiJson, useIos } from '../shell-context';
import { Glyph, type GlyphName } from '../ui/glyphs';
import { appHref, contentHref, uiStyles } from '../ui/kit';
import { NavStack, type NavScreen } from '../ui/NavStack';
import {
  bubbleText,
  buildScript,
  chipsAfter,
  MAX_STEPS,
  parseThread,
  transcript,
  typingMs,
  type ChipId,
  type Line,
  type Script,
  type Step,
  type ThreadState,
} from './messages-script';
import type { IosServices } from '../shell-context';
import type { IosAppProps } from './registry';
import styles from './messages.module.css';

/** A new centred timestamp when the conversation resumes after a pause this long. */
const STAMP_GAP_MS = 15 * 60 * 1000;

const timeLabel = (ms: number) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(ms);

function sameDay(a: number, b: number) {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

/** iMessage's centred caption: "Today 9:41 AM" · "Mon, Sep 21 at 9:41 AM". */
function stampParts(ms: number, now: number): { day: string; time: string } {
  if (sameDay(ms, now)) return { day: 'Today', time: timeLabel(ms) };
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(ms);
  return { day, time: `at ${timeLabel(ms)}` };
}

/** The conversation list's time: "9:41 AM" today, else the short date. */
const listTime = (ms: number, now: number) =>
  sameDay(ms, now)
    ? timeLabel(ms)
    : new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }).format(ms);

const LINK_GLYPH: Readonly<Record<string, GlyphName>> = {
  github: 'repo',
  linkedin: 'person',
  site: 'globe',
  x: 'globe',
};

const hostOf = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/** The wall clock for captions, refreshed each minute (never read during render). */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export default function Messages({ id, active, layout, headingId }: IosAppProps) {
  const ios = useIos();
  const script = useMemo(
    () =>
      buildScript({
        person: getPerson(),
        contact: getContact(),
        file: getResumeFileMeta(),
        featured: getFeaturedProjects(),
      }),
    [],
  );
  const [stored, setStored] = useAppUiJson<unknown>(id, 'thread', null);
  const thread = useMemo(() => parseThread(stored), [stored]);
  const [screen, setScreen] = useAppUi(id, 'screen', 'list');
  const pad = layout === 'pad';
  const threadOpen = pad || screen === 'thread';

  // The latest thread, including writes not committed yet (presses commit after paint).
  const latest = useRef<ThreadState>(thread);
  useLayoutEffect(() => {
    latest.current = thread;
  }, [thread]);
  const write = useCallback(
    (next: ThreadState) => {
      latest.current = next;
      setStored(next);
    },
    [setStored],
  );

  // The conversation is "opened" (its greeting delivered) the first time the thread is on screen.
  useEffect(() => {
    if (threadOpen && active && latest.current.at === null) write({ ...latest.current, at: Date.now() });
  }, [threadOpen, active, write]);

  /** A chip: record the branch (after its hand-off ran), so the transcript and chips follow. */
  const press = useCallback(
    async (chip: ChipId, origin: HTMLElement | null) => {
      const now = Date.now();
      if (chip === 'start-over') {
        write({ at: now, s: [], r: (latest.current.r ?? 0) + 1 });
        ios.announce('Conversation cleared.');
        return;
      }
      let step: Step = { c: chip, t: now };
      const action = script.branches[chip].action;
      if (action?.kind === 'open-app') ios.openApp(action.role, undefined, origin);
      if (action?.kind === 'mailto') analytics.track({ name: 'contact_initiated', channel: 'mailto' });
      if (action?.kind === 'copy') {
        analytics.track({ name: 'contact_initiated', channel: 'copy' });
        const copied = await ios.copy(action.text, 'Email address');
        step = { ...step, o: copied ? 'copied' : 'blocked' };
      }
      const current = latest.current;
      write({ ...current, at: current.at ?? now, s: [...current.s, step].slice(-MAX_STEPS) });
    },
    [ios, script, write],
  );

  // The Home quick action "Say hello" (an intent, not a URL): open the thread and say hello.
  const pressRef = useRef(press);
  useLayoutEffect(() => {
    pressRef.current = press;
  }, [press]);
  useEffect(() => {
    const sayHello = () => {
      if (!takeIntent('say-hello')) return;
      setScreen('thread');
      void pressRef.current('hello', null);
    };
    sayHello();
    return subscribeIntents((intent) => {
      if (intent.kind === 'say-hello') sayHello();
    });
  }, [setScreen]);

  const scrollToTop = useCallback((handler: (() => void) | null) => ios.onScrollToTop(id, handler), [ios, id]);
  const lines = useMemo(() => transcript(script, thread), [script, thread]);
  const last = lines[lines.length - 1];
  const now = useNow();
  const unread = thread.at === null;

  const conversation = (
    <Conversation
      key={thread.r ?? 0}
      script={script}
      thread={thread}
      lines={lines}
      live={active && threadOpen}
      pad={pad}
      onChip={(chip, el) => void press(chip, el)}
      onBack={pad ? undefined : () => setScreen(null)}
      onScrollToTop={scrollToTop}
    />
  );

  const row = (
    <ul role="list" className={styles.convos}>
      <li>
        <button
          type="button"
          className={`${styles.convo} ${uiStyles.press}`}
          data-push-key="thread"
          data-selected={pad || undefined}
          aria-current={pad ? 'true' : undefined}
          onClick={() => setScreen('thread')}
        >
          <span className={styles.unreadDot} data-on={unread || undefined} aria-hidden="true" />
          <span className={styles.avatar} aria-hidden="true">
            {initialsOf(script.name)}
          </span>
          <span className={styles.convoText}>
            <span className={styles.convoTop}>
              <span className={styles.convoName}>{script.givenName}</span>
              <span className={styles.convoTime}>
                <Glyph name="pin" size={12} strokeWidth={2.2} />
                <span className="sr-only">Pinned, </span>
                {listTime(thread.at === null ? now : (last?.time ?? now), now)}
                {pad ? null : (
                  <Glyph name="chevron-right" size={14} strokeWidth={2.4} className={styles.convoChevron} />
                )}
              </span>
            </span>
            <span className={styles.convoPreview}>
              {unread ? <span className="sr-only">Unread: </span> : null}
              {last ? bubbleText(last) : ''}
            </span>
          </span>
        </button>
      </li>
    </ul>
  );

  if (pad) {
    return (
      <div className={styles.split} aria-labelledby={headingId}>
        <section className={styles.sidebar} aria-label="Conversations">
          <h3 className={styles.sidebarTitle}>Messages</h3>
          {row}
        </section>
        <div className={styles.detail}>{conversation}</div>
      </div>
    );
  }

  const screens: NavScreen[] = [{ key: 'list', title: 'Messages', large: true, tone: 'plain', render: () => row }];
  if (screen === 'thread')
    screens.push({ key: 'thread', title: script.givenName, bare: true, tone: 'plain', render: () => conversation });
  return (
    <div className={styles.app}>
      <NavStack id="messages" window={id} screens={screens} onPop={() => setScreen(null)} />
    </div>
  );
}

// --- The thread ---------------------------------------------------------------------------------------------------

interface ConversationProps {
  readonly script: Script;
  readonly thread: ThreadState;
  readonly lines: readonly Line[];
  /** The thread is on screen in the foreground app: timers may run. */
  readonly live: boolean;
  readonly pad: boolean;
  readonly onChip: (chip: ChipId, el: HTMLElement) => void;
  readonly onBack?: () => void;
  readonly onScrollToTop: (handler: (() => void) | null) => void;
}

function Conversation({ script, thread, lines, live, pad, onChip, onBack, onScrollToTop }: ConversationProps) {
  const ios = useIos();
  const total = lines.length;
  // A restored conversation is shown whole, without re-animation; a first open delivers the greeting.
  const [shown, setShown] = useState(() => (thread.at === null ? 0 : total));
  const reduced = prefersReducedMotion();
  const visible = reduced ? total : Math.min(shown, total);
  const pending = visible < total ? lines[visible] : undefined;
  const typing = !reduced && live && pending?.bubble.from === 'them';
  const scroller = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const hintId = useId();

  // Deliver the next bubble: outgoing at once, incoming after the typing indicator (≤ 600 ms).
  useEffect(() => {
    if (shown >= total && !reduced) return;
    if (reduced) {
      if (shown === total) return;
      const timer = setTimeout(() => setShown(total), 0);
      return () => clearTimeout(timer);
    }
    if (!live || !pending) return;
    const target = shown + 1;
    const timer = setTimeout(
      () => setShown((value) => Math.max(value, target)),
      pending.bubble.from === 'me' ? 0 : typingMs(pending),
    );
    return () => clearTimeout(timer);
  }, [shown, total, reduced, live, pending]);

  // Any tap or key press skips the typing: everything already said appears at once.
  const skip = () => {
    if (visible < total) setShown(total);
  };

  // New bubbles spring in (scale 0.9 → 1 + rise 8 pt, r 0.35 ζ 0.8); restored ones never animate.
  const animatedUpTo = useRef(visible);
  useLayoutEffect(() => {
    const from = animatedUpTo.current;
    animatedUpTo.current = visible;
    if (visible <= from || !list.current) return;
    for (let index = from; index < visible; index++) {
      const line = lines[index];
      if (!line) continue;
      const el = list.current.querySelector<HTMLElement>(`[data-line="${line.key}"] [data-bubble]`);
      springIn(el, IOS_SPRINGS.bubble, { transform: 'scale(0.9) translateY(8px)', opacity: 0 });
    }
  }, [visible, lines]);

  // Auto-scroll pins to the bottom unless the visitor scrolled up.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [visible, typing]);

  useEffect(() => {
    onScrollToTop(() => scroller.current?.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' }));
    return () => onScrollToTop(null);
  }, [onScrollToTop]);

  const visited = thread.s.map((step) => step.c);
  const chips = chipsAfter(script, visited);
  const now = useNow();
  const shownLines = lines.slice(0, visible);
  let lastMine = -1;
  shownLines.forEach((line, index) => {
    if (line.bubble.from === 'me') lastMine = index;
  });

  const items: ReactNode[] = [];
  shownLines.forEach((line, index) => {
    const previous = shownLines[index - 1];
    const next = shownLines[index + 1];
    const stamp = !previous || line.time - previous.time > STAMP_GAP_MS;
    const nextStamp = next ? next.time - line.time > STAMP_GAP_MS : false;
    if (stamp && line.time > 0) {
      const { day, time } = stampParts(line.time, now);
      items.push(
        <li key={`stamp:${line.key}`} className={styles.stamp}>
          <time dateTime={new Date(line.time).toISOString()}>
            <b>{day}</b> {time}
          </time>
        </li>,
      );
    }
    const tail = !next || next.bubble.from !== line.bubble.from || nextStamp;
    items.push(
      <li
        key={line.key}
        className={styles.line}
        data-line={line.key}
        data-from={line.bubble.from}
        data-tail={tail || undefined}
        data-kind={line.bubble.kind}
      >
        <span className="sr-only">{line.bubble.from === 'me' ? 'You said: ' : `${script.givenName} said: `}</span>
        <BubbleBody line={line} ios={ios} />
      </li>,
    );
    if (index === lastMine)
      items.push(
        <li key="delivered" className={styles.delivered} aria-hidden="true">
          Delivered
        </li>,
      );
  });

  const focusFirstChip = () => chipsRef.current?.querySelector<HTMLElement>('button, a')?.focus();

  return (
    <div className={styles.thread} data-pad={pad || undefined} onPointerDownCapture={skip} onKeyDownCapture={skip}>
      <div className={styles.threadBar}>
        {onBack ? (
          <button type="button" className={styles.back} aria-label="Back to Messages" onClick={onBack} data-back="">
            <Glyph name="chevron-left" size={24} strokeWidth={2.6} />
          </button>
        ) : null}
        <div className={styles.contact}>
          <span className={styles.avatarSmall} aria-hidden="true">
            {initialsOf(script.name)}
          </span>
          {pad ? (
            <h3 className={styles.contactName}>{script.givenName}</h3>
          ) : (
            <span className={styles.contactName} aria-hidden="true">
              {script.givenName}
              <Glyph name="chevron-right" size={10} strokeWidth={3} />
            </span>
          )}
        </div>
      </div>
      <div
        ref={scroller}
        className={styles.scroll}
        role="region"
        aria-label={`Messages with ${script.givenName}`}
        // A scrollable region must be reachable by keyboard (axe scrollable-region-focusable): older bubbles scroll.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        onScroll={(event) => {
          const el = event.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        <div className={styles.column}>
          <p className={styles.service} aria-hidden="true">
            iMessage
          </p>
          <div role="log" aria-label={`Conversation with ${script.givenName}`} className={styles.log}>
            <ul ref={list} role="list" className={styles.lines}>
              {items}
            </ul>
          </div>
          {typing ? (
            <div className={styles.typing} aria-hidden="true" data-typing="">
              <span />
              <span />
              <span />
            </div>
          ) : null}
        </div>
      </div>
      <div className={styles.composer}>
        <div
          ref={chipsRef}
          role="group"
          aria-label="Suggested replies"
          aria-describedby={hintId}
          className={styles.chips}
          data-chips=""
        >
          {chips.map((chip) => {
            const branch = script.branches[chip];
            if (branch.action?.kind === 'mailto')
              return (
                <a
                  key={chip}
                  href={branch.action.href}
                  className={`${styles.chip} ${uiStyles.press}`}
                  data-chip={chip}
                  onClick={(event) => onChip(chip, event.currentTarget)}
                >
                  {branch.chip}
                </a>
              );
            return (
              <button
                key={chip}
                type="button"
                className={`${styles.chip} ${uiStyles.press}`}
                data-chip={chip}
                data-variant={chip === 'start-over' ? 'plain' : undefined}
                onClick={(event) => onChip(chip, event.currentTarget)}
              >
                {branch.chip}
              </button>
            );
          })}
        </div>
        <p id={hintId} className="sr-only">
          Choose a reply to send it to {script.givenName}.
        </p>
        <div className={styles.fieldRow} aria-hidden="true" onPointerUp={focusFirstChip}>
          <span className={styles.plus}>
            <Glyph name="plus" size={18} strokeWidth={2.4} />
          </span>
          <span className={styles.field}>Choose a reply above</span>
        </div>
      </div>
    </div>
  );
}

function BubbleBody({ line, ios }: { readonly line: Line; readonly ios: IosServices }) {
  const { bubble } = line;
  switch (bubble.kind) {
    case 'text':
      return (
        <span className={styles.bubble} data-bubble="">
          {bubble.text}
        </span>
      );
    case 'link':
      return (
        <a
          className={`${styles.bubble} ${styles.card}`}
          data-bubble=""
          href={bubble.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => analytics.track({ name: 'contact_initiated', channel: 'link' })}
        >
          <span className={styles.cardArt} aria-hidden="true">
            <Glyph name={LINK_GLYPH[bubble.linkKind] ?? 'globe'} size={34} strokeWidth={1.6} />
          </span>
          <span className={styles.cardText}>
            <span className={styles.cardTitle}>
              {bubble.label} · {bubble.handle}
            </span>
            <span className={styles.cardDetail}>{hostOf(bubble.url)}</span>
          </span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      );
    case 'app':
      return (
        <a
          className={`${styles.bubble} ${styles.card}`}
          data-bubble=""
          href={appHref(iosId(bubble.role), { kind: 'root' })}
          onClick={(event) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey)
              return;
            event.preventDefault();
            ios.openApp(bubble.role, undefined, event.currentTarget);
          }}
        >
          <span className={styles.cardArt} aria-hidden="true">
            <Glyph name="repo" size={34} strokeWidth={1.6} />
          </span>
          <span className={styles.cardText}>
            <span className={styles.cardTitle}>{bubble.label}</span>
            <span className={styles.cardDetail}>{bubble.detail}</span>
          </span>
        </a>
      );
    case 'attachment':
      return (
        <a
          className={`${styles.bubble} ${styles.file}`}
          data-bubble=""
          href={contentHref({ section: 'resume' })}
          onClick={(event) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey)
              return;
            event.preventDefault();
            ios.openContent({ section: 'resume' }, event.currentTarget);
          }}
        >
          <span className={styles.fileIcon} aria-hidden="true">
            <Glyph name="doc" size={26} strokeWidth={1.7} />
            <b>PDF</b>
          </span>
          <span className={styles.cardText}>
            <span className={styles.cardTitle}>{bubble.name}</span>
            <span className={styles.cardDetail}>{bubble.label}</span>
          </span>
        </a>
      );
    case 'mailto':
      return (
        <a
          className={`${styles.bubble} ${styles.card}`}
          data-bubble=""
          href={bubble.href}
          onClick={() => analytics.track({ name: 'contact_initiated', channel: 'mailto' })}
        >
          <span className={styles.cardArt} aria-hidden="true">
            <Glyph name="envelope" size={34} strokeWidth={1.6} />
          </span>
          <span className={styles.cardText}>
            <span className={styles.cardTitle}>{bubble.label}</span>
            <span className={styles.cardDetail}>{bubble.email}</span>
          </span>
        </a>
      );
    case 'address':
      return line.outcome === 'blocked' ? (
        <span className={styles.bubble} data-bubble="">
          {bubble.blocked} <span className={styles.selectable}>{bubble.email}</span>
        </span>
      ) : (
        <span className={styles.bubble} data-bubble="">
          {bubble.copied}
        </span>
      );
  }
}
