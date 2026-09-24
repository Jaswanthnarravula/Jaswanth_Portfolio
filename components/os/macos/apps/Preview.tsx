'use client';
/**
 * Preview — the résumé viewer (plans/macos/apps/preview.md, `MAC-PREV-01…06`; target of the résumé fast path).
 *   · toolbar: thumbnails · zoom out / in / actual size · "1 / N" · Download · Share (Copy Link → /go/resume) · Print;
 *   · the published PDF's pages as images (`ResumePages`, rendered at build time from the owner's Resume.pdf) — the
 *     real résumé in every browser; an inline `<object>` is blocked by the CSP (shared/03 VIEW-RESUME-01 deviation);
 *   · the Text version (the same PDF's own text) is FIRST in DOM order and visually toggled, so assistive tech gets
 *     real headings and lists either way;
 *   · zoom 50–300 %, fit-width by default; Ctrl/Cmd + wheel zooms the pages, never the OS;
 *   · Download = `<a download>` + `resume_downloaded` + a banner; Print prints only the résumé (print stylesheet).
 * Missing PDF (placeholder phase): text version only, Download hidden.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { copyText, ResumeDocument, ResumePages, resumeFileLabel } from '@/components/content';
import { getResume, getResumeFileMeta, getResumePages, getResumeText } from '@/data/selectors';
import { analytics } from '@/lib/analytics/loader';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { useKernel } from '@/stores/kernel-context';
import { useAppCommands } from '../commands';
import { DownloadGlyph, PrintGlyph, ShareGlyph, SidebarGlyph, TextGlyph, ZoomInGlyph, ZoomOutGlyph } from '../glyphs';
import { notify, setAppState } from '../ui';
import type { WindowBodyProps } from '../window/Window';
import app from './app.module.css';
import styles from './preview.module.css';

const ZOOM_STEPS = [50, 75, 100, 125, 150, 200, 250, 300] as const;
const ZOOM_MIN = 50;
const ZOOM_MAX = 300;
/** US Letter at 96 dpi: the page's actual size (100 %). */
const PAGE_W = 816;
const PAGE_GAP = 24;

export default function Preview({ titleId, compact }: WindowBodyProps) {
  const resume = getResume();
  const file = getResumeFileMeta();
  const pages = file?.pages ?? 1;
  const pageImages = getResumePages();
  const pageRatio = pageImages[0] ? pageImages[0].height / pageImages[0].width : 11 / 8.5;
  const medium = useKernel((state) => state.viewport.sizeClass === 'medium');
  const [thumbnails, setThumbnails] = useState(!compact && !medium);
  const [text, setText] = useState(!file);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [page, setPage] = useState(1);
  const [fitWidth, setFitWidth] = useState(PAGE_W);
  const [manualLink, setManualLink] = useState<string | null>(null);
  const canvas = useRef<HTMLDivElement>(null);

  const pageWidth = zoom === 'fit' ? fitWidth : Math.round((PAGE_W * zoom) / 100);
  const pageHeight = Math.round(pageWidth * pageRatio);
  const percent = zoom === 'fit' ? Math.round((fitWidth / PAGE_W) * 100) : zoom;

  useEffect(() => setAppState('viewer:thumbnails', thumbnails), [thumbnails]);
  useEffect(() => setAppState('viewer:text', text), [text]);

  // Fit width: the page fills the canvas (max 900 px), re-measured when the window is resized.
  useEffect(() => {
    const node = canvas.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setFitWidth(Math.max(240, Math.min(900, node.clientWidth - 48))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const step = useCallback(
    (direction: 1 | -1) =>
      setZoom((current) => {
        const now = current === 'fit' ? Math.round((fitWidth / PAGE_W) * 100) : current;
        const next =
          direction > 0
            ? ZOOM_STEPS.find((value) => value > now)
            : [...ZOOM_STEPS].reverse().find((value) => value < now);
        return next ?? now;
      }),
    [fitWidth],
  );

  // Ctrl/Cmd + wheel inside the canvas zooms the pages (and only there: the OS and the page never zoom).
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      step(event.deltaY < 0 ? 1 : -1);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [step]);

  const goToPage = (target: number) => {
    const node = canvas.current;
    const clamped = Math.min(pages, Math.max(1, target));
    setPage(clamped);
    node?.scrollTo({
      top: (clamped - 1) * (pageHeight + PAGE_GAP),
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };

  const download = () => {
    analytics.track({ name: 'resume_downloaded', os: 'macos' });
    notify({ kind: 'resume-downloaded' });
  };

  const share = async () => {
    const link = `${window.location.origin}/go/resume`;
    const outcome = await copyText(link, navigator.clipboard);
    if (outcome === 'copied') {
      setManualLink(null);
      notify({ kind: 'link-copied' });
    } else setManualLink(link);
  };

  useAppCommands('viewer', (command) => {
    if (command === 'toggle-thumbnails') setThumbnails((value) => !value);
    else if (command === 'toggle-text') setText((value) => !value);
    else if (command === 'zoom-in') step(1);
    else if (command === 'zoom-out') step(-1);
    else if (command === 'actual-size') setZoom(100);
    else if (command === 'next-page') goToPage(page + 1);
    else if (command === 'previous-page') goToPage(page - 1);
    else if (command === 'print') window.print();
  });

  return (
    <div className={`${app.app} ${styles.preview}`} data-body="" data-text={text || undefined}>
      <header className={app.toolbar} data-drag-region="">
        {file ? (
          <button
            type="button"
            className={`${app.tool} ${styles.wide}`}
            aria-label="Show page thumbnails"
            aria-pressed={thumbnails}
            onClick={() => setThumbnails((value) => !value)}
          >
            <SidebarGlyph />
          </button>
        ) : null}
        <div className={app.titleBlock}>
          <h2 id={titleId} className={app.title}>
            <span className="sr-only">Preview — </span>Résumé.pdf
          </h2>
          {file ? (
            <p className={`${app.subtitle} ${styles.wide}`}>
              Page {page} of {pages}
            </p>
          ) : null}
        </div>
        <span className={app.spacer} />
        <div role="toolbar" aria-label="Preview" className={styles.tools}>
          {file ? (
            <>
              <span className={`${styles.zoom} ${styles.wide}`}>
                <button
                  type="button"
                  className={app.tool}
                  aria-label="Zoom out"
                  onClick={() => step(-1)}
                  disabled={percent <= ZOOM_MIN}
                >
                  <ZoomOutGlyph />
                </button>
                <button
                  type="button"
                  className={app.tool}
                  aria-label="Zoom in"
                  onClick={() => step(1)}
                  disabled={percent >= ZOOM_MAX}
                >
                  <ZoomInGlyph />
                </button>
                <button type="button" className={app.tool} onClick={() => setZoom(100)} aria-label="Actual size">
                  {percent}%
                </button>
              </span>
              <a
                className={app.tool}
                href={resume.file}
                download={resume.downloadName}
                type="application/pdf"
                aria-label={`Download PDF (${resumeFileLabel(file).replace(/^PDF, /, '')})`}
                onClick={download}
              >
                <DownloadGlyph />
              </a>
            </>
          ) : null}
          <button type="button" className={app.tool} aria-label="Share: copy link" onClick={() => void share()}>
            <ShareGlyph />
          </button>
          {file ? (
            <button
              type="button"
              className={app.tool}
              aria-label="Text version"
              aria-pressed={text}
              onClick={() => setText((value) => !value)}
            >
              <TextGlyph />
            </button>
          ) : null}
          <button
            type="button"
            className={`${app.tool} ${styles.wide}`}
            aria-label="Print"
            onClick={() => window.print()}
          >
            <PrintGlyph />
          </button>
        </div>
      </header>
      {manualLink ? (
        <p className={styles.manual}>
          <label>
            Copy this link: <input readOnly value={manualLink} onFocus={(event) => event.currentTarget.select()} />
          </label>{' '}
          <span className={styles.hint}>Press Ctrl/Cmd+C</span>
        </p>
      ) : null}
      <div className={app.split}>
        {/* The Text version comes first in DOM order; visually it is shown only when chosen. */}
        <article
          className={`${text ? styles.text : styles.textHidden} ${styles.printable}`}
          data-print-resume=""
          aria-label="Résumé — text version"
        >
          <div className={styles.paper}>
            <ResumeDocument data={getResumeText()} headingLevel={3} />
          </div>
        </article>
        {file && thumbnails ? (
          <nav className={styles.thumbnails} aria-label="Pages">
            <ul>
              {Array.from({ length: pages }, (_, index) => (
                <li key={index}>
                  <button
                    type="button"
                    aria-current={page === index + 1 ? 'true' : undefined}
                    onClick={() => goToPage(index + 1)}
                  >
                    <span className={styles.thumb} aria-hidden="true">
                      <ResumePages pages={pageImages.slice(index, index + 1)} sizes="86px" />
                    </span>
                    Page {index + 1}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        {file ? (
          <div
            ref={canvas}
            className={styles.canvas}
            hidden={text || undefined}
            onScroll={(event) => {
              const top = event.currentTarget.scrollTop + event.currentTarget.clientHeight / 3;
              setPage(Math.min(pages, Math.max(1, Math.floor(top / (pageHeight + PAGE_GAP)) + 1)));
            }}
          >
            <ResumePages
              pages={pageImages}
              sizes={`${pageWidth}px`}
              className={styles.pages}
              pageClassName={styles.pdf}
              style={{ width: pageWidth }}
            >
              {/* The pages could not be rendered at build time: the PDF itself, one click away. */}
              <p className={styles.below}>
                <a href={resume.file} type="application/pdf">
                  Open Résumé.pdf
                </a>
              </p>
            </ResumePages>
            <p className={styles.below}>
              <a href={resume.file} download={resume.downloadName} type="application/pdf" onClick={download}>
                Download PDF ({resumeFileLabel(file).replace(/^PDF, /, '')})
              </a>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
