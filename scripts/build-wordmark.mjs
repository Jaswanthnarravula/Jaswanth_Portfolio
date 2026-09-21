/**
 * Name wordmark for the intro — plans/03-netflix-page.md "Wordmark" (`NFLX-MARK-01`).
 * "JASWANTH" (from `person.givenName`) in a streaming-intro arc style: condensed capitals whose height grows toward
 * both ends, so the top and bottom edges curve. Original artwork in both asset modes — generated from Bebas Neue
 * (SIL OFL 1.1), never a third-party logo. Deterministic.
 *   node --experimental-strip-types scripts/build-wordmark.mjs → lib/welcome/wordmark.generated.json
 * The font is a build input only (assets-inbox/fonts/), never shipped.
 */
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const WORDMARK_VIEW = { width: 1000, pad: 8 };
/** Relative height gain at the outermost letters (0 = flat). */
export const ARC = 0.24;
const TRACKING = 0.02; // em

const round = (n) => Math.round(n * 10) / 10;

/**
 * Warp and normalize opentype.js path commands (y-down). Every coordinate, control points included, is scaled
 * vertically about the text's centre line by `1 + ARC·u²`, where `u` ∈ [-1, 1] is the horizontal position.
 * @param {{ type: string, x?: number, y?: number, x1?: number, y1?: number, x2?: number, y2?: number }[]} commands
 */
export function warpWordmark(commands, arc = ARC) {
  const xs = [];
  const ys = [];
  for (const c of commands)
    for (const [x, y] of [
      [c.x, c.y],
      [c.x1, c.y1],
      [c.x2, c.y2],
    ])
      if (x !== undefined && y !== undefined) {
        xs.push(x);
        ys.push(y);
      }
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const cx = (x0 + x1) / 2;
  const half = (x1 - x0) / 2 || 1;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const warp = (x, y) => {
    const u = (x - cx) / half;
    return [x, cy + (y - cy) * (1 + arc * u * u)];
  };
  const warped = commands.map((c) => {
    const out = { type: c.type };
    for (const [kx, ky] of [
      ['x', 'y'],
      ['x1', 'y1'],
      ['x2', 'y2'],
    ])
      if (c[kx] !== undefined) [out[kx], out[ky]] = warp(c[kx], c[ky]);
    return out;
  });
  // Normalize: fit the width, keep the aspect.
  const wx = [];
  const wy = [];
  for (const c of warped)
    for (const [kx, ky] of [
      ['x', 'y'],
      ['x1', 'y1'],
      ['x2', 'y2'],
    ])
      if (c[kx] !== undefined) {
        wx.push(c[kx]);
        wy.push(c[ky]);
      }
  const minX = Math.min(...wx);
  const minY = Math.min(...wy);
  const scale = (WORDMARK_VIEW.width - 2 * WORDMARK_VIEW.pad) / (Math.max(...wx) - minX);
  const height = Math.ceil((Math.max(...wy) - minY) * scale + 2 * WORDMARK_VIEW.pad);
  const p = (x, y) =>
    `${round((x - minX) * scale + WORDMARK_VIEW.pad)} ${round((y - minY) * scale + WORDMARK_VIEW.pad)}`;
  let d = '';
  for (const c of warped) {
    if (c.type === 'M') d += `M${p(c.x, c.y)}`;
    else if (c.type === 'L') d += `L${p(c.x, c.y)}`;
    else if (c.type === 'Q') d += `Q${p(c.x1, c.y1)} ${p(c.x, c.y)}`;
    else if (c.type === 'C') d += `C${p(c.x1, c.y1)} ${p(c.x2, c.y2)} ${p(c.x, c.y)}`;
    else if (c.type === 'Z') d += 'Z';
  }
  return { viewBox: [0, 0, WORDMARK_VIEW.width, height], d };
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const opentype = createRequire(join(root, 'package.json'))('opentype.js');
  const { portfolio } = await import(pathToFileURL(join(root, 'data/portfolio.ts')).href);
  const text = portfolio.person.givenName.toUpperCase();
  const buffer = await readFile(join(root, 'assets-inbox/fonts/bebasneue-BebasNeue-Regular.ttf'));
  const font = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  const size = 1000;
  const path = font.getPath(text, 0, 0, size, { kerning: true, letterSpacing: TRACKING });
  const output = {
    text,
    source: { font: 'Bebas Neue', licence: 'SIL OFL 1.1', copyright: 'The Bebas Neue Project Authors' },
    ...warpWordmark(path.commands),
  };
  const target = join(root, 'lib/welcome/wordmark.generated.json');
  await writeFile(target, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`[wordmark] "${text}" → ${target} (${output.d.length} chars, viewBox ${output.viewBox.join(' ')})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
