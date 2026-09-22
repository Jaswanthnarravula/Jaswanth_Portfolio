/**
 * `assets-inbox/` ingestion — shared/11 `ASSET-INBOX-01`.
 * Validates each dropped file (format, minimum dimensions), optimizes it (WebP at the sizes each OS needs; SVGs
 * minified), applies the declared transform, writes content-hashed files to `public/assets/official/`, and records
 * manifest fields in `lib/assets/official.generated.json`. Missing or invalid files are skipped with a warning — the
 * original baseline renders instead; this script never fails a build.
 *   node --experimental-strip-types scripts/ingest-assets.mjs
 * Uses `sharp`, which ships with Next.js (build-script only; never imported by app code — shared/01).
 */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const BUDGETS = { 'app-icon': 12 * 1024, 'system-icon': 12 * 1024, avatar: 16 * 1024, audio: 80 * 1024 };
const MAC_GRID = 0.805; // Big Sur icon body / canvas

const hash = (buffer) => createHash('sha256').update(buffer).digest('hex').slice(0, 10);

/**
 * CSS `hue-rotate(deg) saturate(amount)` as one 3 × 3 matrix on sRGB values — the Filter Effects matrices, in the
 * space browsers apply them in. The derived green profile avatar is the owner storyboard's
 * `filter: hue-rotate(-62deg) saturate(1.15)` on the blue one (plans/03 "Visual target"), baked in.
 */
export function cssHueSaturate(deg, amount) {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const hue = [
    [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
    [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283],
    [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072],
  ];
  const k = amount;
  const sat = [
    [0.213 + 0.787 * k, 0.715 - 0.715 * k, 0.072 - 0.072 * k],
    [0.213 - 0.213 * k, 0.715 + 0.285 * k, 0.072 - 0.072 * k],
    [0.213 - 0.213 * k, 0.715 - 0.715 * k, 0.072 + 0.928 * k],
  ];
  return sat.map((row) => [0, 1, 2].map((j) => row.reduce((sum, v, i) => sum + v * hue[i][j], 0)));
}
export const GUEST_GREEN = cssHueSaturate(-62, 1.15);

function minifySvg(text) {
  return text
    .replace(/<\?xml[^>]*>/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<metadata[\s\S]*?<\/metadata>/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function squircleMask(sharp, size) {
  const { squircleSvg } = await import(pathToFileURL(join(root, 'lib/assets/squircle.ts')).href);
  return sharp(Buffer.from(squircleSvg(size)))
    .resize(size, size)
    .png()
    .toBuffer();
}

/** Apply the declared transform and return a square PNG buffer of `size`. */
async function render(sharp, input, size, transform) {
  const base = sharp(input, { density: 300 }).ensureAlpha();
  if (transform === 'mac-squircle' || transform === 'mac-squircle-crop') {
    const body = Math.round(size * MAC_GRID);
    let art;
    if (transform === 'mac-squircle-crop') {
      const scaled = Math.round(body * 1.26);
      const offset = Math.round((scaled - body) / 2);
      art = await base
        .resize(scaled, scaled, { fit: 'cover' })
        .extract({ left: offset, top: offset, width: body, height: body })
        .png()
        .toBuffer();
    } else art = await base.resize(body, body, { fit: 'cover' }).png().toBuffer();
    const masked = await sharp(art)
      .composite([{ input: await squircleMask(sharp, body), blend: 'dest-in' }])
      .png()
      .toBuffer();
    const pad = Math.round((size - body) / 2);
    return sharp(masked)
      .extend({
        top: pad,
        bottom: size - body - pad,
        left: pad,
        right: size - body - pad,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
  }
  const pipeline = transform === 'hue-green' ? base.recomb(GUEST_GREEN) : base;
  return pipeline
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function encodeWebp(sharp, png, budget) {
  for (const quality of [90, 84, 78, 72, 66]) {
    const out = await sharp(png).webp({ quality, alphaQuality: 90, effort: 6 }).toBuffer();
    if (out.length <= budget || quality === 66) return out;
  }
  throw new Error('unreachable');
}

/**
 * @param {{ inboxDir: string, publicDir: string, manifestPath: string, sources: import('./asset-sources.mjs').AssetSource[], sharp: any, log?: (message: string) => void }} options
 */
export async function ingestAssets({ inboxDir, publicDir, manifestPath, sources, sharp, log = console.log }) {
  const outDir = join(publicDir, 'assets', 'official');
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const entries = {};
  const warnings = [];

  for (const source of sources) {
    let file = join(inboxDir, source.file);
    let derived = false;
    if (!existsSync(file) && source.derivedFrom && existsSync(join(inboxDir, source.derivedFrom))) {
      file = join(inboxDir, source.derivedFrom);
      derived = true;
    }
    if (!existsSync(file)) {
      warnings.push(`${source.id}: missing ${source.file} — original artwork will render`);
      continue;
    }
    const input = await readFile(file);
    const extension = extname(file).toLowerCase();
    const common = {
      kind: source.kind,
      label: source.label,
      owner: source.owner,
      sourceUrl: source.sourceUrl,
      retrieved: source.retrieved,
      terms: source.terms,
      derived,
      monochrome: source.monochrome === true,
    };

    try {
      if (source.kind === 'audio') {
        if (
          extension !== '.mp3' ||
          (input.subarray(0, 3).toString('latin1') !== 'ID3' && (input[0] !== 0xff || (input[1] & 0xe0) !== 0xe0))
        )
          throw new Error('not an MP3');
        if (input.length > BUDGETS.audio) throw new Error(`audio ${input.length} B exceeds budget`);
        const name = `${source.id}.${hash(input)}.mp3`;
        await writeFile(join(outDir, name), input);
        entries[source.id] = { ...common, src: `/assets/official/${name}`, bytes: [input.length] };
        continue;
      }

      const svgText = extension === '.svg' ? minifySvg(input.toString('utf8')) : null;
      if (svgText !== null && !/^<svg[\s>]/.test(svgText)) throw new Error('not an SVG document');
      // Vector artwork within budget ships as SVG; heavier vectors are rasterized like any other icon.
      if (svgText !== null && Buffer.byteLength(svgText) <= (BUDGETS[source.kind] ?? 12 * 1024)) {
        const text = svgText;
        const meta = await sharp(Buffer.from(text)).metadata();
        const name = `${source.id}.${hash(text)}.svg`;
        await writeFile(join(outDir, name), text);
        entries[source.id] = {
          ...common,
          src: `/assets/official/${name}`,
          width: meta.width,
          height: meta.height,
          bytes: [Buffer.byteLength(text)],
        };
        continue;
      }

      const meta = await sharp(input, { density: 300 }).metadata();
      if (!['png', 'jpeg', 'webp', 'svg'].includes(meta.format)) throw new Error(`unsupported format ${meta.format}`);
      const sizes = (source.sizes ?? [48, 96]).filter((size) => size <= Math.max(meta.width ?? 0, meta.height ?? 0));
      if (sizes.length === 0)
        throw new Error(`too small (${meta.width}×${meta.height}) for ${source.sizes?.join('/')}`);
      const budget = BUDGETS[source.kind] ?? 12 * 1024;
      const files = [];
      for (const size of sizes) {
        const png = await render(sharp, input, size, derived ? 'hue-green' : source.transform);
        const webp = await encodeWebp(sharp, png, budget);
        const name = `${source.id}.${size}.${hash(webp)}.webp`;
        await writeFile(join(outDir, name), webp);
        files.push({ size, name, bytes: webp.length });
        if (webp.length > budget)
          warnings.push(`${source.id}@${size}: ${webp.length} B exceeds the ${budget} B budget`);
      }
      const largest = files[files.length - 1];
      entries[source.id] = {
        ...common,
        src: `/assets/official/${largest.name}`,
        srcSet: files.map((item) => `/assets/official/${item.name} ${item.size}w`).join(', '),
        width: largest.size,
        height: largest.size,
        bytes: files.map((item) => item.bytes),
      };
    } catch (error) {
      warnings.push(
        `${source.id}: ${error instanceof Error ? error.message : String(error)} — original artwork will render`,
      );
    }
  }

  const ordered = Object.fromEntries(
    Object.keys(entries)
      .sort()
      .map((key) => [key, entries[key]]),
  );
  await writeFile(manifestPath, `${JSON.stringify({ v: 1, entries: ordered }, null, 2)}\n`);
  for (const warning of warnings) log(`[assets] warning: ${warning}`);
  log(`[assets] ${Object.keys(ordered).length}/${sources.length} official assets ingested into ${outDir}`);
  return { entries: ordered, warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const require = createRequire(join(root, 'package.json'));
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.warn('[assets] sharp is unavailable — keeping the existing official assets.');
    process.exit(0);
  }
  const { ASSET_SOURCES } = await import('./asset-sources.mjs');
  const inboxDir = join(root, 'assets-inbox');
  if (!existsSync(inboxDir) || (await readdir(inboxDir)).length === 0) {
    console.warn('[assets] assets-inbox/ is empty — keeping the existing official assets.');
    process.exit(0);
  }
  await ingestAssets({
    inboxDir,
    publicDir: join(root, 'public'),
    manifestPath: join(root, 'lib/assets/official.generated.json'),
    sources: ASSET_SOURCES,
    sharp,
  });
}
