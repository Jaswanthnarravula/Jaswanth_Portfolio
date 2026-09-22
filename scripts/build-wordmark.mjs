/**
 * Name wordmark for the intro — plans/03-netflix-page.md "Wordmark" + "Visual target" (`NFLX-MARK-01`).
 * "JASWANTH" (from `person.givenName`) exactly as the owner's storyboard frame sets it (plans/visual-targets/intro.png,
 * source CSS `.mark` in plans/visual-targets/storyboard.html): Bebas Neue capitals, letter-spacing .015em, line-height
 * .9, padding 0 .1em .12em, and a dark ellipse (`.mark::after`) that trims the letters' feet into a shallow arc.
 * The output is that whole `.mark` box — view box = the box, glyphs on its baseline, the ellipse as a mask — so the
 * SVG sized to 13 em wide-per-em lands on the frame's pixels with no offsets. Original artwork in both asset modes,
 * generated from Bebas Neue (SIL OFL 1.1), never a third-party logo. Deterministic.
 *   node --experimental-strip-types scripts/build-wordmark.mjs → lib/welcome/wordmark.generated.json
 * The font is a build input only (assets-inbox/fonts/), never shipped.
 */
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Units per em of the output (the frame's font size is 1 em = 1000 units). */
export const EM = 1000;
/** The frame's `.mark` and `.mark::after`, in em. */
export const MARK = {
  tracking: 0.015,
  lineHeight: 0.9,
  padX: 0.1,
  padBottom: 0.12,
  /** `left: -6%; right: -6%; bottom: -.34em; height: .62em; border-radius: 50%`. */
  cut: { overhang: 0.06, bottom: 0.34, height: 0.62 },
};

const round = (n) => Math.round(n * 10) / 10;

/**
 * Lays the text out the way the browser lays out the frame's `.mark`: the content box is the text advance (letter
 * spacing included), the baseline sits where CSS puts it in a `line-height: .9` line box (half-leading from the
 * font's ascent and descent), and the padding surrounds it.
 * @param {{ unitsPerEm: number, tables: { hhea: { ascender: number, descender: number } },
 *   getPath: Function, getAdvanceWidth: Function }} font opentype.js font
 */
export function layoutWordmark(font, text) {
  const scale = EM / font.unitsPerEm;
  const ascent = font.tables.hhea.ascender * scale;
  const descent = -font.tables.hhea.descender * scale;
  const lineBox = MARK.lineHeight * EM;
  const baseline = (lineBox - (ascent + descent)) / 2 + ascent;
  const options = { kerning: true, letterSpacing: MARK.tracking };
  const advance = font.getAdvanceWidth(text, EM, options);
  const width = advance + 2 * MARK.padX * EM;
  const height = lineBox + MARK.padBottom * EM;
  const path = font.getPath(text, MARK.padX * EM, baseline, EM, options);
  let d = '';
  for (const c of path.commands) {
    if (c.type === 'M') d += `M${round(c.x)} ${round(c.y)}`;
    else if (c.type === 'L') d += `L${round(c.x)} ${round(c.y)}`;
    else if (c.type === 'Q') d += `Q${round(c.x1)} ${round(c.y1)} ${round(c.x)} ${round(c.y)}`;
    else if (c.type === 'C')
      d += `C${round(c.x1)} ${round(c.y1)} ${round(c.x2)} ${round(c.y2)} ${round(c.x)} ${round(c.y)}`;
    else if (c.type === 'Z') d += 'Z';
  }
  const ry = (MARK.cut.height * EM) / 2;
  return {
    viewBox: [0, 0, round(width), round(height)],
    /** The box's width in em of the frame's font size (CSS: `width: calc(13em * widthEm)` at a 13 em mark). */
    widthEm: Math.round((width / EM) * 1e4) / 1e4,
    baseline: round(baseline),
    d,
    cut: {
      cx: round(width / 2),
      cy: round(height + MARK.cut.bottom * EM - ry),
      rx: round(width * (0.5 + MARK.cut.overhang)),
      ry: round(ry),
    },
  };
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const opentype = createRequire(join(root, 'package.json'))('opentype.js');
  const { portfolio } = await import(pathToFileURL(join(root, 'data/portfolio.ts')).href);
  const text = portfolio.person.givenName.toUpperCase();
  const buffer = await readFile(join(root, 'assets-inbox/fonts/bebasneue-BebasNeue-Regular.ttf'));
  const font = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  const output = {
    text,
    source: { font: 'Bebas Neue', licence: 'SIL OFL 1.1', copyright: 'The Bebas Neue Project Authors' },
    ...layoutWordmark(font, text),
  };
  const target = join(root, 'lib/welcome/wordmark.generated.json');
  await writeFile(target, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`[wordmark] "${text}" → ${target} (${output.d.length} chars, viewBox ${output.viewBox.join(' ')})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
