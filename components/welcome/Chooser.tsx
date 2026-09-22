'use client';
/**
 * OS chooser — plans/04-os-chooser.md. Lives in the persistent shell layer (lazy chunk), so Back from any OS lands on
 * it without re-rendering the page. The foyer is the owner's storyboard frame (`plans/visual-targets/chooser.png`):
 * a light field, the heading, and five glass cards — each a viewport-shaped snapshot of that OS's full-page home (no
 * device outline), its name and one line of character.
 *   - Cards are real links to `/{os}` (`CHOOSE-CARD-01`); only released OSes appear (`CHOOSE-REL-01`).
 *   - One "Suits your device" badge from size class + input only — never the profile (`CHOOSE-BADGE-01`).
 *   - Hover/focus prefetches that OS's chunk; idle prefetches the last or badged OS (`CHOOSE-PREF-01`).
 *   - Plain click → the shared-element enter transition (chooser-stage); Esc reverses it (`CHOOSE-ENTER-01`).
 * The profile changes nothing here: the picked avatar's flight ends on the profiles screen and dissolves as the
 * foyer fades in over it (the frame has no avatar).
 */
import { gsap } from 'gsap';
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { OS_NAMES, type OsId } from '@/lib/kernel/ids';
import { VISIBLE_OSES } from '@/lib/kernel/route';
import type { KernelState } from '@/lib/kernel/types';
import { focusIsOnBody } from '@/lib/kernel/focus';
import { focusKeys } from '@/lib/kernel/types';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { takeHandoff } from '@/lib/motion/handoff';
import { prefetchOs } from '@/lib/os-loaders';
import { CHOOSER_HEADING, OS_CHARACTER, suitedOs } from '@/lib/welcome/chooser';
import snapshots from '@/lib/welcome/snapshots.generated.json';
import { useKernel, usePrefs } from '@/stores/kernel-context';
import { dispatch, getKernel, subscribeEffects } from '@/stores/kernel-store';
import { prefsStore } from '@/stores/prefs-store';
import { registerReturnStage } from '@/stores/transition-stage';
import { chooserFontsReady } from './chooser-fonts';
import { createChooserStage, type ChooserStage, type StageView } from './chooser-stage';
import { WindowsBoot } from '@/components/os/windows/surfaces/Boot';
import styles from './chooser.module.css';

type Orientation = 'landscape' | 'portrait';
const SNAPSHOTS = snapshots as Partial<
  Record<OsId, Record<Orientation, { avif: string; webp: string; width: number; height: number }>>
>;

/** A per-device number, stable across visits, used only to alternate the phone badge fairly (never the UA). */
const deviceSeed = () =>
  typeof screen === 'undefined' ? 0 : Math.max(screen.width, screen.height) + Math.min(screen.width, screen.height);

/** OSes whose boot screen exists (each OS brings its own with its phase; plans/{os}/surfaces/boot.md). */
const BOOTABLE: readonly OsId[] = ['macos', 'windows'];

/** The chooser mounted underneath an OS that is leaving (its exit beat plays first; then the return flight). */
const returningFrom = (state: KernelState) =>
  state.transition.phase === 'exiting' && state.transition.to === null && state.activeOs !== null;

/** A card can be entered when its OS is visible here: released, or previewed in a preview/test build. */
const enterable = (os: OsId) => VISIBLE_OSES.includes(os);

/**
 * The boot screen that covers the snapshot while a slow chunk loads (plans/04 step 4, `CHOOSE-ENTER-02`), in each OS's
 * own look: macOS (plans/macos/surfaces/boot.md) — black, the startup mark, a thin bar the stage fills with real
 * milestones; Windows (plans/windows/surfaces/boot.md) — the logo over an indeterminate ring of orbiting dots, no bar.
 */
function BootFrame({ os }: { readonly os: OsId }) {
  if (os === 'windows')
    return createPortal(
      <div className={styles.boot} data-boot={os} aria-hidden="true">
        <WindowsBoot />
      </div>,
      document.body,
    );
  return createPortal(
    <div className={styles.boot} data-boot={os} aria-hidden="true">
      <span className={styles.bootMark}>
        <AssetIcon id="system.apple-logo" size={72} priority />
      </span>
      <span className={styles.bootTrack}>
        <span className={styles.bootBar} data-boot-bar="" />
      </span>
    </div>,
    document.body,
  );
}

function announce(message: string) {
  const status = document.getElementById('system-status');
  if (status) status.textContent = message;
}

/**
 * `oses` defaults to the visible set (ARCH-REL-01 / CHOOSE-REL-01): released OSes, plus the preview allow-list in
 * preview/test builds — where all five appear, as in the storyboard frame. An OS passed in that is not visible
 * renders as a non-enterable "Coming soon" card.
 */
export default function Chooser({ oses = VISIBLE_OSES }: { oses?: readonly OsId[] } = {}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<ChooserStage | null>(null);
  // Mounting underneath a leaving OS: stay covered (the OS is still on screen) until the return flight uncovers it.
  const [returning] = useState(() => returningFrom(getKernel()));
  const [view, setView] = useState<StageView>({ covered: returning, failed: null });
  const [boot, setBoot] = useState<OsId | null>(null);
  const pointer = useKernel((state) => state.capabilities.pointer);
  const sizeClass = useKernel((state) => state.viewport.sizeClass);
  const width = useKernel((state) => state.viewport.w);
  const height = useKernel((state) => state.viewport.h);
  const lastOs = usePrefs((prefs) => prefs.lastOs);
  const [seed] = useState(deviceSeed);

  const orientation: Orientation = width >= height ? 'landscape' : 'portrait';
  // Returning visitors (they have entered an OS before) get "Continue in {lastOs}" above the grid (`CHOOSE-CONT-01`).
  const continueOs = lastOs && oses.includes(lastOs) && enterable(lastOs) ? lastOs : null;
  const badge = suitedOs({ pointer, sizeClass, seed, visible: oses });

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
      getState: getKernel,
      onBoot: setBoot,
      bootable: BOOTABLE,
      returning,
    });
    stageRef.current = stage;
    // The leaving OS hands the end of its exit to this stage (CHOOSE-EXIT-01).
    const unregister = registerReturnStage(({ epoch, from }) =>
      stage.returnFrom(from, epoch as Parameters<typeof stage.returnFrom>[1], OS_NAMES[from]),
    );
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && stage.cancel()) event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      unregister();
      stage.dispose();
      stageRef.current = null;
    };
    // The stage lives as long as the chooser.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Arrival: fade the foyer in over the profiles screen (the picked avatar dissolves beneath it), stagger the cards.
  // The reveal waits for the storyboard faces — at most 300 ms, usually already loaded during the avatar's flight.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // The kernel asked for the heading before this lazy chunk existed; if focus fell to <body> meanwhile, land it now.
    const page = document.getElementById('page-layer');
    if (focusIsOnBody() || page?.contains(document.activeElement))
      root.querySelector<HTMLElement>(`[data-focus-key="${focusKeys.chooserHeading}"]`)?.focus({ preventScroll: true });
    const reduced = prefersReducedMotion();
    const cards = [...root.querySelectorAll('[data-chooser-card]')];
    const tl = gsap.timeline({ paused: true });
    // Coming back from an OS, the return flight is the arrival: no fade, no stagger over it.
    if (returning) return () => tl.kill();
    tl.fromTo(root, { opacity: 0 }, { opacity: 1, duration: reduced ? 0.15 : 0.24, ease: 'power1.out' }, 0);
    // An unreleased portfolio deliberately has no cards yet. GSAP warns when asked to animate an empty target list.
    if (!reduced && cards.length > 0)
      tl.fromTo(
        cards,
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.32, stagger: 0.06, ease: 'power2.out', clearProps: 'transform,opacity' },
        0.08,
      );
    let cancelled = false;
    void Promise.all([takeHandoff(), chooserFontsReady()]).then(() => {
      if (!cancelled) tl.play();
    });
    // Idle: warm the chunk the visitor is most likely to pick.
    const likely = (lastOs && oses.includes(lastOs) ? lastOs : null) ?? badge;
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const idle = () => likely && !cancelled && prefetchOs(likely);
    if (w.requestIdleCallback) w.requestIdleCallback(idle);
    else setTimeout(idle, 500);
    return () => {
      cancelled = true;
      tl.kill();
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

  const restartWelcome = () => {
    // This shell is persistent, so a visitor who already selected a profile can otherwise remain on the chooser above
    // `/`. Persist first, then reload the semantic home page without the saved returning-visitor state.
    prefsStore.getState().patch({ introSeen: false, persona: null });
    window.location.assign('/');
  };

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-covered={view.covered || undefined}
      style={{ ['--viewport-aspect' as string]: `${width} / ${height}` }}
    >
      <div className={styles.inner}>
        <div className={styles.main}>
          <h1
            className={styles.heading}
            tabIndex={-1}
            data-focus-key={focusKeys.chooserHeading}
            data-chooser-fade="header"
          >
            {CHOOSER_HEADING}
          </h1>

          {continueOs ? (
            <a
              href={`/${continueOs}`}
              className={styles.continue}
              data-chooser-fade="continue"
              onClick={(event) => enter(event, continueOs)}
              onPointerEnter={() => prefetchOs(continueOs)}
              onFocus={() => prefetchOs(continueOs)}
            >
              Continue in {OS_NAMES[continueOs]} <span aria-hidden="true">→</span>
            </a>
          ) : null}

          {oses.length > 0 ? (
            <nav aria-label="Operating systems" className={styles.nav}>
              <ul className={styles.cards} data-count={oses.length}>
                {oses.map((os) => {
                  const shot = SNAPSHOTS[os]?.[orientation];
                  const suits = badge === os;
                  const failed = view.failed === os;
                  const released = enterable(os);
                  return (
                    <li key={os} className={styles.item} data-chooser-fade={os}>
                      <a
                        href={`/${os}`}
                        className={`${styles.card} ${released ? '' : styles.comingSoon}`}
                        data-chooser-card={os}
                        aria-label={`${OS_NAMES[os]} — ${OS_CHARACTER[os]}${suits ? ', suits your device' : ''}`}
                        aria-disabled={!released || undefined}
                        data-focus-key={released ? focusKeys.chooserCard(os) : undefined}
                        onClick={(event) => {
                          if (released) enter(event, os);
                          else event.preventDefault();
                        }}
                        onPointerEnter={released ? () => prefetchOs(os) : undefined}
                        onFocus={released ? () => prefetchOs(os) : undefined}
                        onPointerMove={released ? tilt : undefined}
                        onPointerLeave={released ? untilt : undefined}
                      >
                        {suits ? <span className={styles.badge}>Suits your device</span> : null}
                        <span className={styles.shot} data-shot>
                          {shot ? (
                            // AVIF, or WebP where AVIF cannot decode (older Safari); decorative either way.
                            <picture>
                              <source type="image/avif" srcSet={shot.avif} />
                              <img src={shot.webp} alt="" width={shot.width} height={shot.height} decoding="async" />
                            </picture>
                          ) : null}
                        </span>
                        <span className={styles.name}>{OS_NAMES[os]}</span>
                        <span className={styles.character}>{OS_CHARACTER[os]}</span>
                        {!released ? <span className={styles.soon}>Coming soon</span> : null}
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

        {boot ? <BootFrame os={boot} /> : null}

        <footer className={styles.footer} data-chooser-fade="footer">
          <button type="button" className={styles.restart} onClick={restartWelcome}>
            Start at Hello
          </button>
          <a href="/go/resume">Résumé</a>
          <a href="/plain">Skip the OS</a>
        </footer>
      </div>
    </div>
  );
}
