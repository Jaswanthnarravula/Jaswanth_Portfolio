import { Fragment, type CSSProperties, type ReactNode } from 'react';
import type { Person, Resume, ResumeBlock, ResumePage } from '@/data/schema';
import { resumeFileLabel, type ResumeFileMeta } from './format';
import { Heading, withSlots, type ViewProps } from './slots';

export { resumeFileLabel, type ResumeFileMeta };

export interface ResumeData {
  readonly resume: Resume;
  readonly person: Person;
  readonly file: ResumeFileMeta | null;
}

/**
 * `ResumeView` — viewer / Quick Look / Edge PDF tab, `open resume`. Offers Open (the OS viewer or the PDF) and
 * Download. When the PDF is missing (placeholder phase) the Download action is hidden.
 */
export function ResumeView({ data, density = 'comfortable', slots, headingLevel = 2 }: ViewProps<ResumeData>) {
  const { Action } = withSlots(slots);
  const { resume, file } = data;
  const label = resumeFileLabel(file);
  return (
    <section className="cv cv-resume" data-density={density} aria-labelledby="cv-resume-title">
      <header className="cv-header">
        <Heading level={headingLevel} id="cv-resume-title" className="cv-title">
          Résumé
        </Heading>
        <p className="cv-meta">
          Updated <time dateTime={resume.updated}>{formatUpdated(resume.updated)}</time>
          {file ? ` · ${label} · ${file.pages} ${file.pages === 1 ? 'page' : 'pages'}` : null}
        </p>
      </header>
      {file && (
        <p className="cv-actions">
          <a className="cv-button cv-button-primary" href={resume.file} type="application/pdf">
            Open PDF
          </a>
          {Action ? (
            <Action
              action={{ kind: 'download', href: resume.file, filename: resume.downloadName }}
              className="cv-button"
            >
              Download <span className="cv-muted">({label})</span>
            </Action>
          ) : (
            <a className="cv-button" href={resume.file} download={resume.downloadName}>
              Download <span className="cv-muted">({label})</span>
            </a>
          )}
        </p>
      )}
    </section>
  );
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
export function formatUpdated(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${MONTHS[Number(month) - 1] ?? ''} ${Number(day)}, ${year}`.trim();
}

/** An address in the résumé's text: an email, or a web address written with a scheme, `www.` or a path. */
const ADDRESS =
  /(?<![\w.@/-])(?:[\w.+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+|(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/[^\s•|,;)]*)?)/g;

function addressHref(text: string): string | null {
  if (text.includes('@')) return `mailto:${text}`;
  if (/^https?:\/\//.test(text)) return text;
  return /^www\./.test(text) || text.includes('/') ? `https://${text}` : null;
}

/** A run with its addresses as real links (the PDF's page images cannot be clicked). */
function linkify(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(ADDRESS)) {
    const address = match[0].replace(/[.]+$/, '');
    const href = addressHref(address);
    if (!href) continue;
    if (match.index > last) out.push(text.slice(last, match.index));
    out.push(
      href.startsWith('mailto:') ? (
        <a key={match.index} href={href}>
          {address}
        </a>
      ) : (
        <a key={match.index} href={href} target="_blank" rel="noopener noreferrer">
          {address}
        </a>
      ),
    );
    last = match.index + address.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const runs = (block: ResumeBlock) =>
  block.runs.map((run, index) =>
    run.bold ? <strong key={index}>{linkify(run.text)}</strong> : <Fragment key={index}>{linkify(run.text)}</Fragment>,
  );

/**
 * The résumé's text version — the published PDF's own words (scripts/resume-pages.mjs), so it can never differ from
 * the pages it sits beside: the name, section headings, entry rows with their dates, bullet lists; addresses are
 * links. Selectable and screen-reader friendly; hosts render it on paper or keep it first in DOM order.
 */
export function ResumeDocument({ data, headingLevel = 2 }: ViewProps<readonly ResumeBlock[]>) {
  if (!data.length) return null;
  const sub = Math.min(headingLevel + 1, 6);
  const title = data.find((block) => block.kind === 'title');
  const name = title ? title.runs.map((run) => run.text).join('') : 'Résumé';
  const nodes: ReactNode[] = [];
  let items: ResumeBlock[] = [];
  let beforeHeadings = true;
  const flush = (key: number) => {
    if (!items.length) return;
    nodes.push(
      <ul key={`list-${key}`}>
        {items.map((item, index) => (
          <li key={index}>{runs(item)}</li>
        ))}
      </ul>,
    );
    items = [];
  };
  data.forEach((block, index) => {
    if (block.kind === 'item') {
      items.push(block);
      return;
    }
    flush(index);
    if (block.kind === 'title')
      nodes.push(
        <Heading key={index} level={headingLevel} className="cv-doc-name">
          {runs(block)}
        </Heading>,
      );
    else if (block.kind === 'heading') {
      beforeHeadings = false;
      nodes.push(
        <Heading key={index} level={sub} className="cv-doc-section">
          {runs(block)}
        </Heading>,
      );
    } else if (block.aside)
      nodes.push(
        <p key={index} className="cv-doc-row">
          <span className="cv-doc-lead">{runs(block)}</span>
          <span className="cv-doc-aside">{block.aside}</span>
        </p>,
      );
    else
      nodes.push(
        <p key={index} className={beforeHeadings ? 'cv-doc-headline' : undefined}>
          {runs(block)}
        </p>,
      );
  });
  flush(data.length);
  return (
    <article className="cv cv-resume-doc" aria-label={`${name} — résumé`}>
      {nodes}
    </article>
  );
}

export interface ResumePagesProps {
  readonly pages: readonly ResumePage[];
  /** The `sizes` attribute: how wide one page is drawn (the host knows its zoom). */
  readonly sizes?: string;
  readonly className?: string;
  readonly pageClassName?: string;
  /** Layout only (a zoomed width) — never an animated value. */
  readonly style?: CSSProperties;
  /** Shown instead when the pages could not be rendered (Open / Download stay available). */
  readonly children?: ReactNode;
}

/**
 * The published PDF's pages as images — the real résumé in every browser, phones included (an inline PDF `<object>`
 * is blocked by the CSP and phones have none). Decorative: the text version beside them carries the words.
 */
export function ResumePages({
  pages,
  sizes = '(max-width: 860px) 100vw, 816px',
  className,
  pageClassName,
  style,
  children = null,
}: ResumePagesProps) {
  if (!pages.length) return <>{children}</>;
  return (
    <div className={className} style={style} data-resume-pages="">
      {pages.map((page, index) => (
        // eslint-disable-next-line @next/next/no-img-element -- pre-rendered at build time, fixed dimensions (CLS)
        <img
          key={page.srcset[0]?.[0] ?? index}
          className={pageClassName}
          src={(page.srcset[1] ?? page.srcset[0])?.[0]}
          srcSet={page.srcset.map(([src, width]) => `${src} ${width}w`).join(', ')}
          sizes={sizes}
          width={page.width}
          height={page.height}
          alt=""
          decoding="async"
          loading={index === 0 ? undefined : 'lazy'}
          draggable={false}
          data-page={index + 1}
        />
      ))}
    </div>
  );
}
