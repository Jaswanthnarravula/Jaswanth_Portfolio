'use client';
/**
 * Quick Look — the résumé viewer of iOS Files (plans/ios/apps/files.md "Quick Look", `IOS-FILES-04` · `IOS-FILES-07`):
 *   · a modal `dialog` named "Résumé.pdf": **Done** first in the reading order (left), the title, **Share** (right);
 *   · the page: the **text version** (`ResumeDocument`, from data) comes first in the DOM, then the PDF `<object>`;
 *     the text version is what shows when the visitor asks for it, when the PDF is missing, and where the browser has no
 *     inline PDF viewer (mobile Safari — `navigator.pdfViewerEnabled === false`);
 *   · bottom: page thumbnails (scroll-snap strip) · **Download** stating type + size (hidden without a PDF) · "Text
 *     version" toggle;
 *   · it opens as a **zoom from the file row's thumbnail** (spring r 0.42 ζ 0.86 sampled into WAAPI keyframes) and
 *     returns into it on Done; a **swipe down** on the page drags it with the finger and dismisses by projected position
 *     (Done is the visible alternative); Esc = Done. Reduced motion: 150 ms fades.
 *   · phone: full screen over the app (landscape: a tap on the page hides the bars); full page: a large centred sheet.
 * Only `transform` / `opacity` animate, written by WAAPI or directly on the element — never through React state.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ResumeDocument, resumeFileLabel } from '@/components/content';
import {
  getContact,
  getCredentials,
  getEducation,
  getExperience,
  getPerson,
  getProjects,
  getResume,
  getResumeFileMeta,
  getSkills,
} from '@/data/selectors';
import { drag } from '@/lib/motion/drag';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { commits, type IosLayout } from '../model';
import { IOS_EASE, IOS_SPRINGS, springSamples } from '../motion';
import type { IosServices } from '../shell-context';
import { Glyph } from '../ui/glyphs';
import styles from './files.module.css';

export const QUICK_LOOK_TITLE = 'Résumé.pdf';
/** US Letter: 8.5 × 11 in. */
const PAGE_RATIO = 11 / 8.5;
/** Projected travel (of the page height) past which a swipe down dismisses. */
const DISMISS_AT = 0.3;

export interface QuickLookProps {
  readonly open: boolean;
  readonly layout: IosLayout;
  readonly landscape: boolean;
  readonly text: boolean;
  readonly onText: (next: boolean) => void;
  readonly onDone: () => void;
  readonly ios: IosServices;
  /** The thumbnail rect it zooms out of (taken once, on open); `null` → it simply appears (a deep link, another app). */
  readonly takeOrigin: () => DOMRect | null;
  /** The row it returns into (measured at close), or `null`. */
  readonly findOrigin: () => HTMLElement | null;
  /** Where focus goes when the row is gone (the screen's title). */
  readonly fallbackFocus: () => HTMLElement | null;
}

/** Keyframes for the zoom between a thumbnail rect and the viewer's rect (uniform scale + translate, then opacity). */
export function zoomFrames(from: DOMRect, to: DOMRect, closing: boolean): { frames: Keyframe[]; durationMs: number } {
  const scale = Math.min(1, Math.max(0.04, from.width / Math.max(1, to.width)));
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const { values, durationMs } = springSamples(closing ? IOS_SPRINGS.close : IOS_SPRINGS.open, 20);
  const frames = values.map((value, index) => {
    const p = closing ? 1 - value : value;
    const k = 1 - p;
    return {
      offset: index / (values.length - 1),
      transform: `translate(${dx * k}px, ${dy * k}px) scale(${scale + (1 - scale) * p})`,
      opacity: Math.min(1, Math.max(0, closing ? p * 3 : 0.15 + p * 2.5)),
    };
  });
  return { frames, durationMs };
}

const inlinePdf = (): boolean => (typeof navigator === 'undefined' ? true : navigator.pdfViewerEnabled !== false);

export function QuickLook({
  open,
  layout,
  landscape,
  text,
  onText,
  onDone,
  ios,
  takeOrigin,
  findOrigin,
  fallbackFocus,
}: QuickLookProps) {
  const [present, setPresent] = useState(open);
  const [page, setPage] = useState(1);
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const pdf = useRef<HTMLDivElement>(null);
  const done = useRef<HTMLButtonElement>(null);
  const animation = useRef<Animation | null>(null);
  const doneRef = useRef(onDone);
  const titleId = useId();
  useLayoutEffect(() => {
    doneRef.current = onDone;
  });

  if (open && !present) setPresent(true);

  const resume = getResume();
  const file = getResumeFileMeta();
  const pages = file?.pages ?? 1;
  // No PDF, no inline viewer (iPhone Safari), or asked for: the text version is the page.
  const canPdf = file !== null && inlinePdf();
  const showText = text || !canPdf;

  /** An interrupted animation is not its end: WAAPI queues `cancel` events, so detach before cancelling. */
  const stopAnimation = () => {
    const current = animation.current;
    animation.current = null;
    if (!current) return;
    current.onfinish = null;
    current.oncancel = null;
    current.cancel();
  };

  // Open: zoom out of the row's thumbnail (or fade), focus Done.
  useLayoutEffect(() => {
    if (!open) return;
    const el = panel.current;
    if (!el) return;
    stopAnimation();
    el.style.transform = '';
    el.style.opacity = '';
    const from = takeOrigin();
    if (typeof el.animate === 'function') {
      if (prefersReducedMotion()) animation.current = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
      else if (from) {
        const { frames, durationMs } = zoomFrames(from, el.getBoundingClientRect(), false);
        animation.current = el.animate(frames, { duration: durationMs, easing: 'linear' });
      }
      scrim.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    }
    done.current?.focus({ preventScroll: true });
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close: back into the row (or down, after a swipe), then unmount and return focus.
  useLayoutEffect(() => {
    if (open || !present) return;
    const el = panel.current;
    const origin = findOrigin();
    const finish = () => {
      setPresent(false);
      setPage(1);
      const target = origin?.isConnected ? origin : fallbackFocus();
      target?.focus({ preventScroll: true });
    };
    if (!el || typeof el.animate !== 'function') {
      finish();
      return;
    }
    const swiped = el.style.transform;
    stopAnimation();
    scrim.current?.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' });
    let exit: Animation;
    if (prefersReducedMotion())
      exit = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' });
    else if (swiped) {
      exit = el.animate(
        [
          { transform: swiped, opacity: 1 },
          { transform: 'translateY(100%)', opacity: 0 },
        ],
        {
          duration: 240,
          easing: IOS_EASE.bannerOut,
          fill: 'forwards',
        },
      );
    } else {
      const thumb = origin?.querySelector('[data-ql-thumb]') ?? origin;
      const rect = thumb?.getBoundingClientRect();
      if (rect && rect.width > 0) {
        const { frames, durationMs } = zoomFrames(rect, el.getBoundingClientRect(), true);
        exit = el.animate(frames, { duration: durationMs, easing: 'linear', fill: 'forwards' });
      } else
        exit = el.animate(
          [
            { transform: 'scale(1)', opacity: 1 },
            { transform: 'scale(0.85)', opacity: 0 },
          ],
          {
            duration: 220,
            easing: IOS_EASE.bannerOut,
            fill: 'forwards',
          },
        );
    }
    el.style.transform = '';
    animation.current = exit;
    exit.onfinish = finish;
    exit.oncancel = finish;
    // Only when `open` turns false.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // The page takes a swipe down only from its top: there, a downward pan is ours (touch-action), elsewhere it scrolls.
  useEffect(() => {
    const el = scroller.current;
    if (!el || !present) return;
    const mark = () => el.toggleAttribute('data-at-top', el.scrollTop <= 0);
    mark();
    el.addEventListener('scroll', mark, { passive: true });
    return () => el.removeEventListener('scroll', mark);
  }, [present, showText]);

  // Esc = Done and the Tab trap, on the modal dialog (a native listener: the keys come from its controls).
  useEffect(() => {
    const el = panel.current;
    if (!el || !present) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        doneRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [...el.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]')].filter(
        (node) => !node.closest('[inert],[hidden]'),
      );
      const first = items[0];
      const lastItem = items[items.length - 1];
      if (!first || !lastItem) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        first.focus();
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [present]);

  if (!present) return null;

  const goTo = (n: number) => {
    const el = scroller.current;
    const sheet = pdf.current;
    if (!el || !sheet) return;
    const top = sheet.offsetTop + ((n - 1) * sheet.offsetHeight) / pages;
    if (typeof el.scrollTo === 'function') el.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    else el.scrollTop = top;
    setPage(n);
  };

  const onScroll = () => {
    const el = scroller.current;
    const sheet = pdf.current;
    if (!el || !sheet || showText) return;
    const into = el.scrollTop + el.clientHeight / 3 - sheet.offsetTop;
    const next = Math.min(pages, Math.max(1, Math.floor(into / Math.max(1, sheet.offsetHeight / pages)) + 1));
    if (next !== page) setPage(next);
  };

  // Swipe down on the page: follows the finger, decided by projected position; a tap (landscape phone) hides the bars.
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = panel.current;
    const area = scroller.current;
    if (!open || !el || !area || event.button > 0) return;
    if ((event.target as Element).closest('a, button, input, textarea, object')) return;
    if (area.scrollTop > 0) return;
    const height = el.getBoundingClientRect().height || 1;
    let axis: 'y' | 'x' | null = null;
    let last = { t: performance.now(), y: 0 };
    let velocity = 0;
    drag(area, event.nativeEvent, {
      threshold: 8,
      onMove: (dx, dy) => {
        axis ??= Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
        if (axis !== 'y') return;
        const y = Math.max(0, dy);
        const t = performance.now();
        if (t > last.t) velocity = ((y - last.y) / (t - last.t)) * 1000;
        last = { t, y };
        el.style.transform = `translateY(${y}px) scale(${1 - Math.min(0.12, (y / height) * 0.2)})`;
        if (scrim.current) scrim.current.style.opacity = String(1 - Math.min(1, y / height));
      },
      onEnd: ({ dy, moved }) => {
        if (!moved) {
          if (layout === 'phone' && landscape) el.toggleAttribute('data-bars-hidden');
          return;
        }
        if (axis === 'y' && commits(Math.max(0, dy) / height, velocity / height, DISMISS_AT)) {
          doneRef.current();
          return;
        }
        const from = el.style.transform || 'none';
        el.style.transform = '';
        if (scrim.current) scrim.current.style.opacity = '';
        el.animate?.([{ transform: from }, { transform: 'none' }], { duration: 260, easing: IOS_EASE.nav });
      },
    });
  };

  const label = resumeFileLabel(file);
  const docData = {
    person: getPerson(),
    contact: getContact(),
    experience: getExperience(),
    projects: getProjects(),
    education: getEducation(),
    credentials: getCredentials(),
    skills: getSkills(),
  };

  return (
    <div
      className={styles.qlLayer}
      data-quick-look=""
      data-layout={layout}
      inert={!open || undefined}
      aria-hidden={!open || undefined}
    >
      <div ref={scrim} className={styles.qlScrim} aria-hidden="true" onClick={() => open && onDone()} />
      <div ref={panel} className={styles.ql} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className={styles.qlBar} data-ql-bar="">
          <button ref={done} type="button" className={styles.qlDone} data-modal-dismiss="" onClick={onDone}>
            Done
          </button>
          <h3 id={titleId} className={styles.qlTitle}>
            {QUICK_LOOK_TITLE}
          </h3>
          <button
            type="button"
            className={styles.qlIcon}
            aria-label="Share"
            onClick={() => void ios.copyLink({ section: 'resume' }, 'Résumé')}
          >
            <Glyph name="share" size={22} />
          </button>
        </div>
        {/* The page scrolls: keyboard users focus it to scroll (axe scrollable-region-focusable). */}
        <div
          ref={scroller}
          className={styles.qlPage}
          data-ql-page=""
          // A scrolling page: keyboard users focus it to scroll (axe scrollable-region-focusable).
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          role="region"
          aria-label="Page"
          onScroll={onScroll}
          onPointerDown={onPointerDown}
        >
          {/* The text version first in the DOM (IOS-FILES-07); visually it is the page only when chosen or needed. */}
          <article
            className={showText ? styles.qlText : styles.qlTextHidden}
            aria-label="Résumé — text version"
            data-ql-text=""
          >
            <div className={styles.paper}>
              <ResumeDocument data={docData} headingLevel={4} />
            </div>
          </article>
          {file ? (
            <div
              ref={pdf}
              className={styles.qlPdf}
              hidden={showText || undefined}
              style={{ aspectRatio: `8.5 / ${(11 * pages).toFixed(2)}` }}
              data-ql-pdf=""
            >
              <object data={resume.file} type="application/pdf" title="Résumé (PDF)" className={styles.qlObject}>
                <p className={styles.qlFallback}>
                  This browser can&rsquo;t show the PDF here — the text version above has the same résumé.
                </p>
              </object>
            </div>
          ) : null}
        </div>
        <div className={styles.qlBottom} data-ql-bar="">
          {file && !showText && pages > 1 ? (
            <nav className={styles.qlThumbs} aria-label="Pages">
              <ol role="list">
                {Array.from({ length: pages }, (_, index) => (
                  <li key={index}>
                    <button
                      type="button"
                      aria-label={`Page ${index + 1}`}
                      aria-current={page === index + 1 ? 'true' : undefined}
                      onClick={() => goTo(index + 1)}
                    >
                      <span
                        className={styles.qlThumb}
                        aria-hidden="true"
                        style={{ aspectRatio: `1 / ${PAGE_RATIO.toFixed(3)}` }}
                      >
                        <i />
                        <i />
                        <i />
                        <i />
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          <div className={styles.qlToolbar} role="toolbar" aria-label="Quick Look actions">
            {file ? (
              <button type="button" className={styles.qlAction} onClick={() => ios.downloadResume()}>
                <Glyph name="download" size={22} />
                <span>
                  Download <span className={styles.qlMeta}>({label})</span>
                </span>
              </button>
            ) : (
              <span />
            )}
            {canPdf ? (
              <button
                type="button"
                className={styles.qlAction}
                aria-pressed={showText}
                onClick={() => onText(!showText)}
              >
                <Glyph name="textformat" size={22} />
                <span>Text version</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
