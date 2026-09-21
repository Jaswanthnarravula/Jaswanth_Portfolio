/**
 * Publishes the résumé PDF and records its metadata for the UI ("PDF, 12 KB"). Runs in `prebuild`.
 *   - The owner's file wins: `content/resume.pdf` is copied to `public/<portfolio.resume.file>` (shared/02
 *     "Résumé ingestion", step 3).
 *   - Until it exists, the PDF is generated from the typed portfolio data (lib/resume/pdf.ts) so the Download always
 *     works; deterministic — the same data always produces the same bytes.
 *   node --experimental-strip-types scripts/build-resume.mjs [--check]
 * `--check` fails when the published PDF is stale (used by `npm run check`).
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const OWNER_RESUME = 'content/resume.pdf';

/** Page objects in a PDF (`/Type /Page`, never the `/Pages` tree nodes). */
export function pdfPageCount(bytes) {
  return (
    Buffer.from(bytes)
      .toString('latin1')
      .match(/\/Type\s*\/Page(?![A-Za-z])/g) ?? []
  ).length;
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

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const { portfolio } = await import(pathToFileURL(join(root, 'data/portfolio.ts')).href);
  const { buildResumePdf } = await import(pathToFileURL(join(root, 'lib/resume/pdf.ts')).href);

  const { bytes, pages, source } = await resolveResume({ root, portfolio, generate: buildResumePdf });
  const file = portfolio.resume.file;
  const target = join(root, 'public', file);
  const meta = {
    file,
    bytes: bytes.length,
    pages,
    source,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  const metaPath = join(root, 'data/generated/resume.json');

  if (process.argv.includes('--check')) {
    const existing = await readFile(target).catch(() => null);
    const recorded = await readFile(metaPath, 'utf8').catch(() => '');
    if (!existing || createHash('sha256').update(existing).digest('hex') !== meta.sha256) {
      console.error(`[resume] ${file} is stale — run: npm run build:resume`);
      process.exitCode = 1;
    } else if (recorded !== `${JSON.stringify(meta, null, 2)}\n`) {
      console.error('[resume] data/generated/resume.json is stale — run: npm run build:resume');
      process.exitCode = 1;
    } else console.log(`[resume] ${file} is current (${source}, ${pages} pages, ${bytes.length} bytes).`);
  } else {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
    await writeFile(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
    console.log(`[resume] wrote ${file} (${source}, ${pages} pages, ${bytes.length} bytes)`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
