'use client';
/**
 * OS chooser — plans/04-os-chooser.md. Lives in the persistent shell layer (lazy chunk), so Back from any OS lands on
 * it without re-rendering the page. A neutral foyer in Jaswanth's own glass brand: five link cards, each a
 * viewport-shaped snapshot of that OS's full-page home (no device outline), its name and one line of character.
 *   - Cards are real links to `/{os}` (`CHOOSE-CARD-01`); only released OSes appear (`CHOOSE-REL-01`).
 *   - One "Suits your device" badge from size class + input only — never the profile (`CHOOSE-BADGE-01`).
 *   - Hover/focus prefetches that OS's chunk; idle prefetches the last or badged OS (`CHOOSE-PREF-01`).
 *   - Plain click → the shared-element enter transition (chooser-stage); Esc reverses it (`CHOOSE-ENTER-01`).
 * The profile only chooses which avatar greets the visitor in the header; it changes nothing else.
 */
import { gsap } from 'gsap';
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { OS_NAMES, type OsId } from '@/lib/kernel/ids';
import { VISIBLE_OSES } from '@/lib/kernel/route';
import { focusIsOnBody } from '@/lib/kernel/focus';
import { focusKeys } from '@/lib/kernel/types';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { flight } from '@/lib/motion/flight';
import { takeHandoff } from '@/lib/motion/handoff';
import { SPRINGS } from '@/lib/motion/spring';
import { prefetchOs } from '@/lib/os-loaders';
import { CHOOSER_HEADING, OS_CHARACTER, suitedOs } from '@/lib/welcome/chooser';
import snapshots from '@/lib/welcome/snapshots.generated.json';
import { useKernel, usePrefs } from '@/stores/kernel-context';
import { dispatch, subscribeEffects } from '@/stores/kernel-store';
import { createChooserStage, type ChooserStage, type StageView } from './chooser-stage';
import styles from './chooser.module.css';

type Orientation = 'landscape' | 'portrait';
const SNAPSHOTS = snapshots as Partial<
  Record<OsId, Record<Orientation, { src: string; width: number; height: number }>>
>;

/** A per-device number, stable across visits, used only to alternate the phone badge fairly (never the UA). */
const deviceSeed = () =>
  typeof screen === 'undefined' ? 0 : Math.max(screen.width, screen.height) + Math.min(screen.width, screen.height);

function announce(message: string) {
  const status = document.getElementById('system-status');
  if (status) status.textContent = message;
}

export default function Chooser({ oses = VISIBLE_OSES }: { oses?: readonly OsId[] } = {}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<ChooserStage | null>(null);
  const [view, setView] = useState<StageView>({ covered: false, failed: null });
  const pointer = useKernel((state) => state.capabilities.pointer);
  const sizeClass = useKernel((state) => state.viewport.sizeClass);
  const width = useKernel((state) => state.viewport.w);
  const height = useKernel((state) => state.viewport.h);
  const persona = usePrefs((prefs) => prefs.persona);
  const lastOs = usePrefs((prefs) => prefs.lastOs);
  const [seed] = useState(deviceSeed);

  const orientation: Orientation = width >= height ? 'landscape' : 'portrait';
  const badge = suitedOs({ pointer, compact: sizeClass === 'compact', seed, visible: oses });

  // The stage (enter / reverse / retry) lives as long as the chooser.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stage = createChooserStage({
      root,
      overlayClassName: styles.stage!,
      dispatch,
      subscribe: subscribeEffects,
      onView: setView,
      announce,
    });
    stageRef.current = stage;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && stage.cancel()) event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      stage.dispose();
      stageRef.current = null;
    };
  }, []);

  // Arrival: continue the avatar flight from the profiles screen, fade the foyer in, stagger the cards.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // The kernel asked for the heading before this lazy chunk existed; if focus fell to <body> meanwhile, land it now.
    const page = document.getElementById('page-layer');
    if (focusIsOnBody() || page?.contains(document.activeElement))
      root.querySelector<HTMLElement>(`[data-focus-key="${focusKeys.chooserHeading}"]`)?.focus({ preventScroll: true });
    const reduced = prefersReducedMotion();
    const cards = [...root.querySelectorAll('[data-chooser-card]')];
    const handoff = takeHandoff();
    const tl = gsap.timeline({ paused: true });
    tl.fromTo(root, { opacity: 0 }, { opacity: 1, duration: reduced ? 0.15 : 0.24, ease: 'power1.out' }, 0);
    if (!reduced)
      tl.fromTo(
        cards,
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.32, stagger: 0.06, ease: 'power2.out', clearProps: 'transform,opacity' },
        0.08,
      );
    let cancelled = false;
    let avatarFlight: ReturnType<typeof flight> | null = null;
    const slot = root.querySelector<HTMLElement>('[data-chooser-avatar]');
    if (!handoff) tl.play();
    else {
      gsap.set(root, { opacity: 0 });
      void handoff.then((arrived) => {
        if (cancelled) return;
        tl.play();
        if (!arrived || !slot || reduced) return;
        // The avatar the visitor picked lands in the header: a clone flies from where the profiles screen left it.
        const clone = slot.cloneNode(true) as HTMLElement;
        clone.classList.add(styles.avatarFlying!);
        document.body.append(clone);
        slot.style.visibility = 'hidden';
        const to = slot.getBoundingClientRect();
        avatarFlight = flight(
          clone,
          arrived.rect,
          { x: to.left, y: to.top, width: to.width, height: to.height },
          {
            spring: SPRINGS.card,
            radius: [8, 999],
          },
        );
        void avatarFlight.done.then(() => {
          slot.style.removeProperty('visibility');
          clone.remove();
        });
      });
    }
    // Idle: warm the chunk the visitor is most likely to pick.
    const likely = (lastOs && oses.includes(lastOs) ? lastOs : null) ?? badge;
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const idle = () => likely && !cancelled && prefetchOs(likely);
    if (w.requestIdleCallback) w.requestIdleCallback(idle);
    else setTimeout(idle, 500);
    return () => {
      cancelled = true;
      tl.kill();
      avatarFlight?.finish();
    };
    // Arrival runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enter = (event: MouseEvent<HTMLAnchorElement>, os: OsId) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return; // new tab / window: let the real link work
    event.preventDefault();
    stageRef.current?.enter(os, OS_NAMES[os]);
  };

  // Fine pointers only: the card tilts up to 4° toward the pointer (transform only, on GSAP's ticker).
  const tilt = (event: PointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType !== 'mouse' || prefersReducedMotion()) return;
    const card = event.currentTarget;
    const r = card.getBoundingClientRect();
    const x = (event.clientX - r.left) / r.width - 0.5;
    const y = (event.clientY - r.top) / r.height - 0.5;
    gsap.to(card, { rotationY: x * 8, rotationX: -y * 8, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
  };
  const untilt = (event: PointerEvent<HTMLAnchorElement>) =>
    gsap.to(event.currentTarget, { rotationX: 0, rotationY: 0, duration: 0.4, ease: 'power2.out', overwrite: 'auto' });

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-covered={view.covered || undefined}
      style={{ ['--viewport-aspect' as string]: `${width} / ${height}` }}
    >
      <div className={styles.field} aria-hidden="true" />
      <div className={styles.inner}>
        <div className={styles.main}>
          <header className={styles.header} data-chooser-fade="header">
            {persona ? (
              <span className={styles.avatar} data-chooser-avatar aria-hidden="true">
                <AssetIcon id={`avatar.${persona}`} size={44} fluid />
              </span>
            ) : null}
            <h1 className={styles.heading} tabIndex={-1} data-focus-key={focusKeys.chooserHeading}>
              {CHOOSER_HEADING}
            </h1>
          </header>

          {oses.length > 0 ? (
            <nav aria-label="Operating systems" className={styles.nav}>
              <ul className={styles.cards} data-count={oses.length}>
                {oses.map((os) => {
                  const shot = SNAPSHOTS[os]?.[orientation];
                  const suits = badge === os;
                  const failed = view.failed === os;
                  return (
                    <li key={os} className={styles.item} data-chooser-fade={os}>
                      <a
                        href={`/${os}`}
                        className={styles.card}
                        data-chooser-card={os}
                        aria-label={`${OS_NAMES[os]} — ${OS_CHARACTER[os]}${suits ? ', suits your device' : ''}`}
                        data-focus-key={focusKeys.chooserCard(os)}
                        onClick={(event) => enter(event, os)}
                        onPointerEnter={() => prefetchOs(os)}
                        onFocus={() => prefetchOs(os)}
                        onPointerMove={tilt}
                        onPointerLeave={untilt}
                      >
                        <span className={styles.shot} data-shot>
                          {shot ? (
                            // eslint-disable-next-line @next/next/no-img-element -- pre-encoded static AVIF snapshot
                            <img src={shot.src} alt="" width={shot.width} height={shot.height} decoding="async" />
                          ) : null}
                        </span>
                        <span className={styles.label}>
                          <span className={styles.name}>{OS_NAMES[os]}</span>
                          <span className={styles.character}>{OS_CHARACTER[os]}</span>
                          {suits ? <span className={styles.badge}>Suits your device</span> : null}
                        </span>
                      </a>
                      {failed ? (
                        <p className={styles.failure} role="alert">
                          Couldn&rsquo;t load {OS_NAMES[os]}.{' '}
                          <button type="button" onClick={() => stageRef.current?.retry(os, OS_NAMES[os])}>
                            Retry
                          </button>{' '}
                          <a href="/plain">Plain portfolio</a>
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </nav>
          ) : (
            <p className={styles.empty} data-chooser-fade="empty">
              The operating systems open here as each one is finished. Meanwhile the whole portfolio is one click away.
            </p>
          )}
        </div>

        <footer className={styles.footer} data-chooser-fade="footer">
          <a href="/go/resume">Résumé</a>
          <a href="/plain">Skip the OS</a>
        </footer>
      </div>
    </div>
  );
}
