/**
 * The published résumé as page images + its own text (shared/14 `RES-OPEN-01`, shared/03 `VIEW-RESUME-01`). Every
 * viewer shows the real document this way: an inline PDF `<object>` is blocked by the CSP (`object-src 'none'`) and
 * phones have no inline PDF viewer, but an image of each page renders everywhere. The text version (accessible
 * reading order, "Text version" toggles) comes from the same PDF, so no viewer can show a different résumé.
 * Build-time only (scripts/build-resume.mjs): pdf.js parses, @napi-rs/canvas rasterizes, sharp encodes.
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Bump when the extraction or the encoding changes, so committed output is rebuilt. */
export const PAGES_VERSION = 1;
/** Widths each page is encoded at; one page is 816 CSS px wide at 100 % (US Letter at 96 dpi). */
export const PAGE_WIDTHS = [816, 1224, 1632, 2448];

/** A line that starts with a bullet glyph (Word's Symbol-font bullets are private-use U+F0B7 / U+F0A7). */
const BULLET = /^(?:[\u2022\u25CF\u25AA\u25E6\u2023\u2043\u2219\u27A2\u25BA\uF0B7\uF0A7]\s*|[-\u2013*\u00B7]\s+)/u;
const BOLD_FONT = /bold|black|heavy|semibold|demi/i;

/**
 * @typedef {{ page: number, str: string, x: number, y: number, width: number, size: number, bold: boolean }} TextItem
 * @typedef {{ text: string, bold?: true }} Run
 * @typedef {{ page: number, x: number, y: number, right: number, size: number, runs: Run[], aside: string | null }} Line
 * @typedef {{ kind: 'title' | 'heading' | 'text' | 'item', runs: Run[], aside?: string }} Block
 */

const plain = (runs) => runs.map((run) => run.text).join('');

function pushRun(runs, text, bold) {
  const last = runs[runs.length - 1];
  if (last && Boolean(last.bold) === bold) last.text += text;
  else runs.push(bold ? { text, bold: true } : { text });
}

/** Tidy whitespace across runs: single spaces, none at the ends, empty runs dropped. */
function tidy(runs) {
  const out = [];
  for (const run of runs) {
    const text = run.text.replace(/\s+/g, ' ');
    if (text) pushRun(out, text, Boolean(run.bold));
  }
  if (out.length) {
    out[0].text = out[0].text.replace(/^ /, '');
    out[out.length - 1].text = out[out.length - 1].text.replace(/ $/, '');
  }
  return out.filter((run) => run.text);
}

/** Groups positioned text into lines (top to bottom), splitting off a far-right part (dates) as `aside`. */
export function linesFromItems(items) {
  const groups = [];
  for (const item of items) {
    if (!item.str) continue;
    const group = groups.find(
      (candidate) =>
        candidate.page === item.page && Math.abs(candidate.y - item.y) <= Math.max(candidate.size, item.size) * 0.35,
    );
    if (group) {
      group.items.push(item);
      group.size = Math.max(group.size, item.size);
    } else groups.push({ page: item.page, y: item.y, size: item.size, items: [item] });
  }
  groups.sort((a, b) => a.page - b.page || b.y - a.y);

  return groups.flatMap((group) => {
    const sorted = [...group.items].sort((a, b) => a.x - b.x);
    const main = [];
    let aside = null;
    let prev = null;
    let space = false;
    let right = sorted[0].x;
    for (const item of sorted) {
      // Whitespace items (often one wide space spanning a tab stop) are gaps, not text.
      if (!item.str.trim()) {
        space = true;
        continue;
      }
      const gap = prev ? item.x - (prev.x + prev.width) : 0;
      const spaced = space || gap > item.size * 0.18;
      space = false;
      if (aside !== null) aside += (spaced ? ' ' : '') + item.str;
      else if (prev && gap > item.size * 1.5) aside = item.str;
      else {
        if (prev && spaced && !/\s$/.test(prev.str) && !/^\s/.test(item.str)) pushRun(main, ' ', item.bold);
        pushRun(main, item.str, item.bold);
        right = Math.max(right, item.x + item.width);
      }
      prev = item;
    }
    const runs = tidy(main);
    if (!runs.length) return [];
    const note = aside?.replace(/\s+/g, ' ').trim() || null;
    return [{ page: group.page, x: sorted[0].x, y: group.y, right, size: group.size, runs, aside: note }];
  });
}

const isHeading = (line, body) => {
  const text = plain(line.runs);
  const letters = text.replace(/[^\p{L}]/gu, '');
  return (
    !line.aside &&
    letters.length >= 3 &&
    letters === letters.toUpperCase() &&
    letters !== letters.toLowerCase() &&
    (line.runs.every((run) => run.bold) || line.size > body * 1.05)
  );
};

/** Joins a wrapped line onto the block it continues: no space after a hyphen or slash. */
function append(block, runs) {
  const last = block.runs[block.runs.length - 1];
  const glue = /[-/]$/.test(last.text) ? '' : ' ';
  block.runs = tidy([...block.runs, { text: glue, bold: last.bold }, ...runs]);
}

/**
 * Lines → reading blocks: the name, section headings, paragraphs (entry rows keep their right-aligned dates as
 * `aside`) and bullet items, with wrapped lines joined back into one.
 */
export function blocksFromLines(lines) {
  if (!lines.length) return [];
  const weighted = lines.flatMap((line) =>
    Array(Math.max(1, Math.round(plain(line.runs).length / 20))).fill(line.size),
  );
  weighted.sort((a, b) => a - b);
  const body = weighted[Math.floor(weighted.length / 2)];
  const flowing = lines.filter((line) => !line.aside);
  const left = Math.min(...lines.map((line) => line.x));
  const right = Math.max(...flowing.map((line) => line.right), left + 1);
  const wrapped = (line) => !line.aside && line.right >= right - (right - left) * 0.12;

  /** @type {Block[]} */
  const blocks = [];
  let bulletX = 0;
  lines.forEach((line, index) => {
    const prev = blocks[blocks.length - 1];
    const prevLine = lines[index - 1];
    const text = plain(line.runs);
    if (index === 0 && line.size >= body * 1.3) blocks.push({ kind: 'title', runs: line.runs });
    else if (isHeading(line, body)) blocks.push({ kind: 'heading', runs: line.runs });
    else if (BULLET.test(text)) {
      bulletX = line.x;
      const runs = tidy([{ ...line.runs[0], text: line.runs[0].text.replace(BULLET, '') }, ...line.runs.slice(1)]);
      blocks.push({ kind: 'item', runs });
    } else if (prev?.kind === 'item' && !line.aside && line.x > bulletX + body * 0.5) append(prev, line.runs);
    else if (
      prev?.kind === 'text' &&
      !prev.aside &&
      !line.aside &&
      prevLine &&
      wrapped(prevLine) &&
      (!line.runs[0].bold || prev.runs[prev.runs.length - 1].bold)
    )
      append(prev, line.runs);
    else
      blocks.push(
        line.aside ? { kind: 'text', runs: line.runs, aside: line.aside } : { kind: 'text', runs: line.runs },
      );
  });
  return blocks;
}

/** True when every pixel is grey (R = G = B within rounding): the page encodes as 4 grey levels. */
function isGrey(rgba) {
  for (let index = 0; index < rgba.length; index += 4) {
    const r = rgba[index];
    if (Math.abs(r - rgba[index + 1]) > 2 || Math.abs(r - rgba[index + 2]) > 2) return false;
  }
  return true;
}

/**
 * Renders every page and extracts the text. Throws when a renderer dependency is missing; the caller decides.
 * @param {{ root: string, bytes: Uint8Array }} options
 * @returns {Promise<{ pages: { width: number, height: number, images: { width: number, png: Buffer }[] }[], text: Block[] }>}
 */
export async function renderResumePages({ root, bytes }) {
  const require = createRequire(join(root, 'package.json'));
  const pdfjs = await import(pathToFileURL(join(root, 'node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href);
  const { createCanvas } = require('@napi-rs/canvas');
  const sharp = require('sharp');
  const assets = `${root.replace(/\\/g, '/')}/node_modules/pdfjs-dist`;

  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    standardFontDataUrl: `${assets}/standard_fonts/`,
    cMapUrl: `${assets}/cmaps/`,
    cMapPacked: true,
    disableFontFace: true,
    isEvalSupported: false,
    verbosity: 0,
  });
  const doc = await task.promise;

  const pages = [];
  /** @type {TextItem[]} */
  const items = [];
  const top = PAGE_WIDTHS[PAGE_WIDTHS.length - 1];
  try {
    for (let number = 1; number <= doc.numPages; number++) {
      const page = await doc.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: top / base.width });
      const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, canvas, viewport }).promise;

      const grey = isGrey(context.getImageData(0, 0, canvas.width, canvas.height).data);
      const source = await canvas.encode('png');
      const images = [];
      for (const width of PAGE_WIDTHS) {
        let pipeline = sharp(source).removeAlpha();
        if (width !== canvas.width) pipeline = pipeline.resize({ width, kernel: 'lanczos3' });
        pipeline = grey
          ? pipeline.toColourspace('b-w').png({ palette: true, colours: 4, dither: 0, compressionLevel: 9, effort: 10 })
          : pipeline.png({ palette: true, colours: 64, dither: 0.5, compressionLevel: 9, effort: 10 });
        images.push({ width, png: await pipeline.toBuffer() });
      }
      // CSS px at 100 % (1 pt = 4/3 px).
      pages.push({ width: Math.round((base.width * 4) / 3), height: Math.round((base.height * 4) / 3), images });

      // Real font names ("…-BoldMT") are known once the page's operators are loaded (they are, after render).
      const content = await page.getTextContent();
      for (const item of content.items) {
        if (!('str' in item) || !item.str) continue;
        let name = '';
        try {
          name = page.commonObjs.get(item.fontName)?.name ?? '';
        } catch {
          name = '';
        }
        const [, , c, d, x, y] = item.transform;
        items.push({
          page: number,
          str: item.str,
          x,
          y,
          width: item.width,
          size: Math.hypot(c, d),
          bold: BOLD_FONT.test(name),
        });
      }
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return { pages, text: blocksFromLines(linesFromItems(items)) };
}
