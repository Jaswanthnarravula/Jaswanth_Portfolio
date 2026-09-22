'use client';
/**
 * The lock screen — a welcome that is an accelerator, not a gate (plans/macos/surfaces/lock-screen.md,
 * `MAC-LOCK-01…05`). Shown on the first chooser entry of a macOS session only (never after a deep link, a refresh,
 * `/go` or a re-entry — the Shell decides), and from Apple menu → Lock Screen. Identical for every visitor.
 *   · the wallpaper's soft variant (a pre-softened gradient, never a live filter), a large clock and date (`<time>`,
 *     not live), the avatar with initials, the name and headline, "Click or press any key to enter";
 *   · three notifications built from data — Preview (résumé updated), GitHub (n projects), Mail (what Jaswanth is
 *     open to) — each a real link that unlocks and opens its app from the card's rect in one motion;
 *   · any press on the background, any character key, Enter, Space or Esc unlocks; Tab and the arrows stay navigation
 *     keys; an explicit "Enter macOS" button holds focus first. No password field, no timers.
 * Unlock: the content fades and rises 12 px (220 ms) while the soft wallpaper crossfades away (260 ms); the Shell
 * brings in the Dock and menu bar. Reduced motion: one 150 ms crossfade.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { hrefFor } from '@/components/shell/KernelLink';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { formatUpdated } from '@/components/content';
import { getFeaturedProjects, getPerson, getProjects, getResume } from '@/data/selectors';
import type { AppRole } from '@/lib/kernel/ids';
import { prefersReducedMotion, REDUCED_CROSSFADE_MS } from '@/lib/motion/dur';
import { focusKeys } from '@/lib/kernel/types';
import { afterQueued, dispatchSoon } from '@/stores/kernel-store';
import { macBinding } from '../model';
import { runMacCommand } from '../run-command';
import { MAC_TIMING } from '../timing';
import { setLocked } from '../ui';
import styles from './lock-screen.module.css';

export interface LockCard {
  readonly id: string;
  readonly role: AppRole;
  readonly title: string;
  readonly body: string;
}

/** The three notifications, from portfolio data only (no persona, no invented facts) — `MAC-LOCK-01/05`. */
export function lockCards(): readonly LockCard[] {
  const person = getPerson();
  const resume = getResume();
  const projects = getProjects();
  const featured = getFeaturedProjects()[0] ?? projects[0];
  const cards: LockCard[] = [
    {
      id: 'lock-resume',
      role: 'viewer',
      title: 'Résumé ready to view',
      body: `Updated ${formatUpdated(resume.updated)}`,
    },
  ];
  if (projects.length)
    cards.push({
      id: 'lock-projects',
      role: 'github',
      title: `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`,
      body: featured ? `${featured.name}${projects.length > 1 ? ' and more' : ''}` : 'See the work',
    });
  cards.push({ id: 'lock-mail', role: 'mail', title: person.openTo, body: 'Say hello' });
  return cards;
}

const NAVIGATION_KEYS = new Set([
  'Tab',
  'Shift',
  'Alt',
  'Control',
  'Meta',
  'CapsLock',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

export function unlock(): void {
  setLocked(false);
  dispatchSoon({ type: 'MARK_LOCK_SEEN', os: 'macos' });
  // Focus lands on the desktop's heading once the desktop is back — unless an app opened from a card took it.
  afterQueued(() => {
    const active = document.activeElement;
    if (active && active !== document.body && !active.closest('[data-lock-screen]')) return;
    document.querySelector<HTMLElement>(`[data-focus-key="${focusKeys.osHeading}"]`)?.focus({ preventScroll: true });
  });
}

export function LockScreen({ leaving = false, onGone }: { leaving?: boolean; onGone?: () => void }) {
  const person = getPerson();
  const [now] = useState(() => new Date());
  const root = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const enter = useRef<HTMLButtonElement>(null);
  const cards = lockCards();
  const initials = person.name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Focus starts on "Enter macOS" (never on <body>).
  useEffect(() => {
    if (!leaving) enter.current?.focus({ preventScroll: true });
  }, [leaving]);

  // Any press on the background unlocks (links and buttons keep their own action) — a native listener: the lock
  // screen is a landmark, not a widget.
  useEffect(() => {
    const node = root.current;
    if (leaving || !node) return;
    const onDown = (event: PointerEvent) => {
      if ((event.target as Element).closest('a,button')) return;
      unlock();
    };
    node.addEventListener('pointerdown', onDown);
    return () => node.removeEventListener('pointerdown', onDown);
  }, [leaving]);

  // Any character key, Enter, Space or Esc unlocks (navigation keys keep navigating).
  useEffect(() => {
    if (leaving) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || NAVIGATION_KEYS.has(event.key) || event.ctrlKey || event.metaKey || event.altKey)
        return;
      if ((event.key === 'Enter' || event.key === ' ') && (event.target as Element).closest('a,button')) return;
      event.preventDefault();
      unlock();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [leaving]);

  // Unlock beat: content fades + rises, the soft wallpaper crossfades to the desktop (transform / opacity only).
  useLayoutEffect(() => {
    const node = root.current;
    const body = content.current;
    if (!leaving || !node || !body) return;
    const done = () => onGone?.();
    if (typeof node.animate !== 'function') {
      done();
      return;
    }
    if (prefersReducedMotion()) {
      node
        .animate([{ opacity: 1 }, { opacity: 0 }], { duration: REDUCED_CROSSFADE_MS, fill: 'forwards' })
        .finished.then(done, done);
      return;
    }
    const { contentMs, wallpaperMs } = MAC_TIMING.lock;
    body.animate(
      [
        { opacity: 1, transform: 'none' },
        { opacity: 0, transform: 'translateY(-12px)' },
      ],
      { duration: contentMs, easing: 'ease-out', fill: 'forwards' },
    );
    node
      .animate([{ opacity: 1 }, { opacity: 0 }], { duration: wallpaperMs, easing: 'linear', fill: 'forwards' })
      .finished.then(done, done);
  }, [leaving, onGone]);

  return (
    <main
      ref={root}
      className={styles.lock}
      data-lock-screen=""
      data-leaving={leaving || undefined}
      inert={leaving || undefined}
      aria-hidden={leaving || undefined}
    >
      <div ref={content} className={styles.content}>
        <p className={styles.clock}>
          <time dateTime={now.toISOString()}>
            <span className={styles.date}>
              {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
            <span className={styles.time}>{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
          </time>
        </p>
        <div className={styles.user}>
          <span className={styles.avatar} aria-hidden="true">
            {initials}
          </span>
          <h1 className={styles.name}>
            {person.givenName}
            <span className="sr-only"> — {person.headline}</span>
          </h1>
          <p className={styles.headline} aria-hidden="true">
            {person.headline}
          </p>
          <button ref={enter} type="button" className={styles.enter} onClick={unlock}>
            Enter macOS
          </button>
          <p className={styles.hint}>Click or press any key to enter</p>
        </div>
        <ul className={styles.cards} aria-label="Notifications">
          {cards.map((card) => {
            const binding = macBinding(card.role);
            return (
              <li key={card.id}>
                <a
                  id={card.id}
                  className={styles.card}
                  href={hrefFor({ os: 'macos', role: card.role })}
                  onClick={(event) => {
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    unlock();
                    runMacCommand({ kind: 'open', role: card.role, origin: card.id });
                  }}
                >
                  <span className={styles.cardIcon} aria-hidden="true">
                    <AssetIcon id={binding.icon} size={28} />
                  </span>
                  <span className={styles.cardText}>
                    <span className={styles.cardApp}>{binding.title}</span>
                    <span className={styles.cardTitle}>{card.title}</span>
                    <span className={styles.cardBody}>{card.body}</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
