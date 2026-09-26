'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildInbox, copyText, sendTarget } from '@/components/content';
import { getContact, getPerson, getResume, getResumeFileMeta } from '@/data/selectors';
import { useKernel } from '@/stores/kernel-context';
import { dispatchSoon } from '@/stores/kernel-store';
import { IconButton, Symbol, TopBar } from '../ui';
import { useAndroid, useAppUi } from '../shell-context';
import type { AndroidAppProps } from './types';
import styles from '../android.module.css';

export default function Gmail({ id, headingId, layout }: AndroidAppProps) {
  const android = useAndroid();
  const messages = useMemo(
    () => buildInbox({ person: getPerson(), contact: getContact(), resume: getResume(), file: getResumeFileMeta() }),
    [],
  );
  const [screen, setScreen] = useAppUi(id, 'screen', layout === 'large' ? 'message:lets-talk' : 'inbox');
  const [drawer, setDrawer] = useState(false);
  const [fabSmall, setFabSmall] = useState(false);
  const bodyField = useRef<HTMLTextAreaElement>(null);
  const draft = useKernel((state) => state.sessions.android.windows[id]?.draft ?? '');
  const selectedId = screen.startsWith('message:') ? screen.slice(8) : null;
  const selected = messages.find((item) => item.id === selectedId) ?? messages[0]!;
  // The wide-screen visual target exposes the résumé directly from the pinned conversation as a useful contact
  // shortcut; the dedicated "My résumé" message remains the canonical attachment-bearing inbox item.
  const displayedAttachment =
    selected.attachment ??
    (selected.id === 'lets-talk' ? messages.find((item) => item.id === 'resume')?.attachment : null);
  useEffect(
    () =>
      android.registerBack(id, () => {
        if (drawer) {
          setDrawer(false);
          return true;
        }
        if (screen === 'compose') {
          setScreen('inbox');
          if (draft.trim()) android.notify('Draft saved');
          return true;
        }
        if (screen.startsWith('message:')) {
          setScreen('inbox');
          return true;
        }
        return false;
      }),
    [android, id, drawer, screen, draft, setScreen],
  );
  const compose = () => setScreen('compose');
  useEffect(() => {
    if (screen === 'compose') bodyField.current?.focus();
  }, [screen]);
  const copy = async () => {
    const outcome = await copyText(getContact().email, navigator.clipboard);
    android.notify(outcome === 'copied' ? 'Copied to clipboard' : getContact().email);
  };
  if (screen === 'compose') {
    return (
      <div className={styles.app} aria-labelledby={headingId} data-app="gmail">
        <section className={styles.compose} role="dialog" aria-modal="true" aria-labelledby="android-compose-title">
          <TopBar
            title="Compose"
            back={android.back}
            actions={
              <>
                <IconButton label="Attach" disabled>
                  <Symbol>attach_file</Symbol>
                </IconButton>
                <button className={styles.sendButton} type="submit" form="android-compose">
                  <Symbol>send</Symbol>
                  <span className="sr-only">Send</span>
                </button>
              </>
            }
          />
          <form
            id="android-compose"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const target = sendTarget({
                email: getContact().email,
                subject: String(data.get('subject') ?? ''),
                body: draft,
              });
              window.location.href = target.url;
              dispatchSoon({ type: 'SET_DRAFT', id, draft: '' });
              setScreen('inbox');
              android.notify('Handed to your email app', { label: 'Copy address', run: () => void copy() });
            }}
          >
            <label>
              From <input readOnly value="You" />
            </label>
            <label>
              To <input readOnly value={getContact().email} />
            </label>
            <label>
              Subject <input name="subject" defaultValue="Portfolio conversation" />
            </label>
            <textarea
              ref={bodyField}
              aria-label="Message"
              placeholder="Write a message"
              value={draft}
              onChange={(event) => dispatchSoon({ type: 'SET_DRAFT', id, draft: event.target.value })}
            />
          </form>
        </section>
      </div>
    );
  }
  const messagePane = (
    <article className={styles.messagePane} aria-label={selected.subject}>
      <h3>{selected.subject}</h3>
      <div className={styles.sender}>
        <span className={styles.avatar}>{selected.from.initials[0]}</span>
        <span>
          <strong>{selected.from.name}</strong>
          <small>to you · 9:12 AM</small>
        </span>
      </div>
      {selected.body.slice(0, -1).map((part, index) => (
        <p key={index}>{part}</p>
      ))}
      {displayedAttachment ? (
        <button
          className={styles.attachment}
          onClick={(event) => android.openContent({ section: 'resume' }, event.currentTarget)}
        >
          <b>PDF</b>
          {displayedAttachment.name} · {displayedAttachment.size}
        </button>
      ) : null}
      <div className={styles.messageActions}>
        <button onClick={compose}>Reply</button>
        <button onClick={() => void copy()}>Copy address</button>
      </div>
    </article>
  );
  return (
    <div className={styles.app} aria-labelledby={headingId} data-app="gmail">
      <div className={styles.gmailLayout}>
        <nav className={styles.gmailRail} aria-label="Mailboxes">
          <IconButton label="Main menu" onClick={() => setDrawer(true)}>
            <Symbol>menu</Symbol>
          </IconButton>
          <button className={styles.railFab} aria-label="Compose" onClick={compose}>
            <Symbol>edit</Symbol>
          </button>
          {(
            [
              ['inbox', 'Inbox'],
              ['star', 'Starred'],
              ['send', 'Sent'],
            ] as const
          ).map(([glyph, label], index) => (
            <button key={label} aria-current={index === 0 ? 'page' : undefined}>
              <Symbol filled={index === 0}>{glyph}</Symbol>
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <section className={styles.inboxPane}>
          <header className={styles.mailSearch}>
            <Symbol>search</Symbol>
            <input aria-label="Search in mail" placeholder="Search in mail" />
            <span className={styles.avatar}>J</span>
          </header>
          <h3>Primary</h3>
          <ul onScroll={(event) => setFabSmall(event.currentTarget.scrollTop > 40)}>
            {messages.map((message, index) => (
              <li key={message.id}>
                <button
                  onClick={() => setScreen(`message:${message.id}`)}
                  aria-label={`${message.unread ? 'Unread, ' : ''}${message.from.name}, ${message.subject}, ${message.preview}`}
                  aria-current={selected.id === message.id && layout === 'large' ? 'true' : undefined}
                >
                  <span className={styles.avatar} data-tone={index}>
                    {message.from.initials[0]}
                  </span>
                  <span>
                    <strong>{message.from.name}</strong>
                    <b>{message.subject}</b>
                    <small>{message.preview}</small>
                  </span>
                </button>
                <IconButton label={`Star ${message.subject}`}>
                  <Symbol>star</Symbol>
                </IconButton>
              </li>
            ))}
          </ul>
        </section>
        {layout === 'large' || selectedId ? messagePane : null}
      </div>
      {layout === 'phone' && selectedId ? messagePane : null}
      <button className={styles.extendedFab} data-small={fabSmall || undefined} onClick={compose}>
        <Symbol>edit</Symbol>
        <span>Compose</span>
      </button>
      {drawer ? (
        <div
          className={styles.modalScrim}
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setDrawer(false)}
        >
          <nav className={styles.sideSheet} aria-label="Gmail navigation">
            <h3>Gmail</h3>
            <button aria-current="page">
              <Symbol>inbox</Symbol>Primary
            </button>
            <button>
              <Symbol>send</Symbol>Sent
            </button>
            <button>
              <Symbol>draft</Symbol>Drafts {draft.trim() ? '1' : ''}
            </button>
            <button onClick={(event) => android.openApp('settings', undefined, event.currentTarget)}>
              <Symbol>settings</Symbol>Settings
            </button>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
