'use client';
/**
 * The lock screen — plans/windows/surfaces/lock-screen.md (`WIN-LOCK-01…05`). A one-time welcome on the first chooser
 * entry of a session (never on deep links, refresh, `/go` or re-entry — the Shell decides), identical for every
 * visitor (nothing here reads a profile).
 *   · Step 1 — the lock: the wallpaper, sharp (Windows lock screens are not blurred); the clock + date bottom-left
 *     (72 px light / 20 px, `<time>`, never live); "Press any key or click to continue"; up to three Acrylic status
 *     cards from data (Résumé ready · projects · open to), a continuity offer replacing the third.
 *   · Any key / click / swipe up → the lock content slides up (333 ms) and the sign-in card fades in (167 ms): avatar
 *     initials, name, headline and one "Sign in" button — no password or PIN (it would imply a gate). A second key during
 *     the slide completes at once.
 *   · A status card is a shortcut: it skips sign-in and opens its app from the card's rect.
 * `<main>` + `<h1>`; explicit Continue / Sign in buttons take focus; Esc and Enter both continue.
 */
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { hrefFor } from '@/components/shell/KernelLink';
import { getPerson } from '@/data/selectors';
import { initialsOf, winBinding, type LockCard } from '../model';
import styles from '../windows.module.css';

export type LockStep = 'lock' | 'signin';

const timeText = (date: Date) =>
  date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/, '');
const dateText = (date: Date) => date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

export function LockScreen({
  cards,
  onSignIn,
  onCard,
  compact,
}: {
  readonly cards: readonly LockCard[];
  /** Sign in → the desktop. */
  readonly onSignIn: () => void;
  /** A status card: straight to the desktop with that app opening from the card. */
  readonly onCard: (card: LockCard, originId: string) => void;
  readonly compact: boolean;
}) {
  const person = getPerson();
  const [step, setStep] = useState<LockStep>('lock');
  const [now] = useState(() => new Date());
  const continueButton = useRef<HTMLButtonElement>(null);
  const signIn = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    (step === 'lock' ? continueButton : signIn).current?.focus({ preventScroll: true });
  }, [step]);

  const advance = () => {
    if (step === 'lock') setStep('signin');
    else onSignIn();
  };

  // Read by the native listeners below (always the latest step).
  const continueOn = useEffectEvent(advance);

  // Any key, click or upward swipe continues (the Continue / Sign in buttons are the explicit alternatives). Native
  // listeners: the stage itself is not an interactive element.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let press: number | null = null;
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as Element).closest('a')) return; // a status card link handles its own Enter
      if (
        ['Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(event.key) ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      if ((event.key === ' ' || event.key === 'Enter') && (event.target as Element).closest('button')) return;
      event.preventDefault();
      continueOn();
    };
    const onDown = (event: PointerEvent) => {
      if ((event.target as Element).closest('a, button')) return;
      press = event.clientY;
    };
    const onUp = () => {
      if (press === null) return;
      press = null;
      continueOn();
    };
    el.addEventListener('keydown', onKey);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('keydown', onKey);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
    };
  }, []);

  return (
    <main ref={root} className={styles.lock} data-lock={step} data-compact={compact || undefined}>
      <h1 className="sr-only">
        {person.name} — {person.headline}
      </h1>
      <div className={styles.lockWallpaper} aria-hidden="true" />
      <div className={styles.lockStage} data-step={step} inert={step === 'signin' || undefined}>
        <p className={styles.lockClock}>
          <time dateTime={now.toISOString()} className={styles.lockTime}>
            {timeText(now)}
          </time>
          <time dateTime={now.toISOString().slice(0, 10)} className={styles.lockDate}>
            {dateText(now)}
          </time>
        </p>
        <button ref={continueButton} type="button" className={styles.lockContinue} onClick={advance}>
          Press any key or click to continue
          <span className="sr-only"> (Continue)</span>
        </button>
        {cards.length ? (
          <ul className={styles.lockCards} role="list" aria-label="Notifications">
            {cards.map((card) => {
              const id = `lock-card-${card.id}`;
              return (
                <li key={card.id}>
                  <a
                    id={id}
                    href={hrefFor(card.to)}
                    className={styles.lockCard}
                    data-acrylic="live"
                    onClick={(event) => {
                      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                        return;
                      event.preventDefault();
                      onCard(card, id);
                    }}
                  >
                    <AssetIcon id={winBinding(card.app).icon} size={24} />
                    <span className={styles.lockCardText}>
                      <span className={styles.lockCardTitle}>{card.title}</span>
                      {card.body ? <span className={styles.lockCardBody}>{card.body}</span> : null}
                      <span className="sr-only">, opens {winBinding(card.app).title}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      {step === 'signin' ? (
        <section className={styles.signin} aria-labelledby="win-signin-name">
          <span className={styles.signinAvatar} aria-hidden="true">
            {initialsOf(person.name)}
          </span>
          <h2 id="win-signin-name" className={styles.signinName}>
            {person.givenName}
          </h2>
          <p className={styles.signinHeadline}>{person.headline}</p>
          <button ref={signIn} type="button" className={styles.signinButton} onClick={onSignIn}>
            Sign in
          </button>
        </section>
      ) : null}
    </main>
  );
}
