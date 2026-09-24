/**
 * Publishes the résumé PDF, its page images and its text, and records the metadata the UI reads. Runs in `prebuild`.
 *   - The owner's file wins: `Resume.pdf` at the repository root is copied as-is to `public/<portfolio.resume.file>`
 *     (shared/02 "Résumé ingestion") — every Open, Download and preview in every OS is that one file.
 *   - Until it exists, the PDF is generated from the typed portfolio data (lib/resume/pdf.ts) so the Download always
 *     works; deterministic — the same data always produces the same bytes.
 *   - Page images + text (scripts/resume-pages.mjs) are rebuilt only when the PDF or `PAGES_VERSION` changes, so a
 *     build of a committed résumé never needs the renderer. If rendering fails the PDF still ships and the viewers
 *     fall back to Open / Download — never a stale or different page.
 *   node --experimental-strip-types scripts/build-resume.mjs [--check]
 * `--check` fails when the published PDF, its pages or the metadata are stale (used by `npm run check`).
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PAGES_VERSION, renderResumePages } from './resume-pages.mjs';

export const OWNER_RESUME = 'Resume.pdf';
/** Page images live beside the PDF; names carry the PDF's hash so a new résumé never shows a cached old page. */
const PAGES_DIR = '/resume/pages';

/** Page objects in a PDF (`/Type /Page`, never the `/Pages` tree nodes); compressed object streams hide them, so
 * the page tree's `/Count` is the fallback. */
export function pdfPageCount(bytes) {
  const text = Buffer.from(bytes).toString('latin1');
  const objects = (text.match(/\/Type\s*\/Page(?![A-Za-z])/g) ?? []).length;
  if (objects) return objects;
  const counts = [...text.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/g)].map((match) => Number(match[1]));
  return Math.max(1, ...counts);
}

/**
 * @param {{ root: string, portfolio: { resume: { file: string } }, generate: (data: unknown) => { bytes: Uint8Array, pages: number } }} options
 * @returns {Promise<{ bytes: Uint8Array, pages: number, source: 'owner' | 'generated' }>}
 */
export async function resolveResume({ root, portfolio, generate }) {
  const owner = await readFile(join(root, OWNER_RESUME)).catch(() => null);
  if (owner) {
    if (owner.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error(`${OWNER_RESUME} is not a PDF`);
    return { bytes: owner, pages: pdfPageCount(owner), source: 'owner' };
  }
  return { ...generate(portfolio), source: 'generated' };
}

const exists = (path) =>
  stat(path).then(
    () => true,
    () => false,
  );

/** True when the recorded pages belong to this PDF and every image is on disk. */
async function pagesCurrent(root, meta, sha256) {
  if (!meta || meta.sha256 !== sha256 || meta.version !== PAGES_VERSION) return false;
  if (!Array.isArray(meta.images) || meta.images.length !== meta.pages || !Array.isArray(meta.text)) return false;
  for (const page of meta.images)
    for (const [src] of page.srcset) if (!(await exists(join(root, 'public', src)))) return false;
  return true;
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const { portfolio } = await import(pathToFileURL(join(root, 'data/portfolio.ts')).href);
  const { buildResumePdf } = await import(pathToFileURL(join(root, 'lib/resume/pdf.ts')).href);

  const { bytes, pages, source } = await resolveResume({ root, portfolio, generate: buildResumePdf });
  const file = portfolio.resume.file;
  const target = join(root, 'public', file);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const metaPath = join(root, 'data/generated/resume.json');
  const recorded = await readFile(metaPath, 'utf8').catch(() => '');
  const previous = (() => {
    try {
      return JSON.parse(recorded);
    } catch {
      return null;
    }
  })();

  if (process.argv.includes('--check')) {
    const existing = await readFile(target).catch(() => null);
    const expected = { file, bytes: bytes.length, source, sha256 };
    if (!existing || createHash('sha256').update(existing).digest('hex') !== sha256) {
      console.error(`[resume] ${file} is stale — run: npm run build:resume`);
      process.exitCode = 1;
    } else if (!previous || Object.entries(expected).some(([key, value]) => previous[key] !== value)) {
      console.error('[resume] data/generated/resume.json is stale — run: npm run build:resume');
      process.exitCode = 1;
    } else if (!(await pagesCurrent(root, previous, sha256))) {
      console.error('[resume] the page images or text are stale or missing — run: npm run build:resume');
      process.exitCode = 1;
    } else console.log(`[resume] ${file} is current (${source}, ${previous.pages} pages, ${bytes.length} bytes).`);
    return;
  }

  let meta;
  if (await pagesCurrent(root, previous, sha256)) {
    meta = { file, bytes: bytes.length, pages: previous.pages, source, sha256, version: PAGES_VERSION };
    meta.images = previous.images;
    meta.text = previous.text;
  } else {
    const dir = join(root, 'public', PAGES_DIR);
    await mkdir(dir, { recursive: true });
    for (const name of await readdir(dir)) await rm(join(dir, name));
    try {
      const rendered = await renderResumePages({ root, bytes });
      const images = [];
      for (const [index, page] of rendered.pages.entries()) {
        const srcset = [];
        for (const image of page.images) {
          const src = posix.join(PAGES_DIR, `${sha256.slice(0, 10)}-${index + 1}-${image.width}.png`);
          await writeFile(join(root, 'public', src), image.png);
          srcset.push([src, image.width]);
        }
        images.push({ width: page.width, height: page.height, srcset });
      }
      meta = { file, bytes: bytes.length, pages: images.length, source, sha256, version: PAGES_VERSION, images };
      meta.text = rendered.text;
    } catch (error) {
      console.warn(`[resume] could not render the pages (${error.message}); viewers will offer Open / Download only.`);
      meta = { file, bytes: bytes.length, pages, source, sha256, version: null, images: [], text: [] };
    }
  }

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
  await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  console.log(
    `[resume] wrote ${file} (${source}, ${meta.pages} pages, ${bytes.length} bytes, ${meta.images.length} page images)`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
