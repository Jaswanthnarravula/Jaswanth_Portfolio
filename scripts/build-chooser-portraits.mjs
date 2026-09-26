/**
 * Phone-portrait chooser previews — plans/04-os-chooser.md (`CHOOSE-CARD-01`). The desktop foyer shows the approved
 * detailed miniatures (public/assets/chooser/{os}-hd.webp); phones get a portrait crop of the same artwork, so both
 * postures preview the same detailed home instead of the old wireframe captures. Each HD source keeps its OS art in
 * the central band of a landscape canvas, so the crop is that band at full height. Re-run after replacing an HD file:
 *   node scripts/build-chooser-portraits.mjs
 * Writes public/assets/chooser/{os}-portrait.{avif,webp}, each within 40 KB (the desktop HD files are 150–300 KB).
 */
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeWithinBudget } from './capture-snapshots.mjs';

const OSES = ['ios', 'macos', 'windows', 'android', 'linux'];
/** Width of the central band, as a share of the canvas height (the art spans ~1000 of 1272 px). */
const BAND = 0.79;
const OUT_WIDTH = 600;
const BUDGET = 40 * 1024;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sharp = createRequire(join(root, 'package.json'))('sharp');
const dir = join(root, 'public/assets/chooser');

for (const os of OSES) {
  const source = sharp(join(dir, `${os}-hd.webp`));
  const { width, height } = await source.metadata();
  const band = Math.round(height * BAND);
  const crop = { left: Math.round((width - band) / 2), top: 0, width: band, height };
  const outHeight = Math.round((OUT_WIDTH * height) / band);
  const base = () =>
    sharp(join(dir, `${os}-hd.webp`))
      .extract(crop)
      .resize(OUT_WIDTH, outHeight);
  for (const format of ['avif', 'webp']) {
    const { bytes, quality } = await encodeWithinBudget(
      (q) =>
        base()
          .toFormat(format, { quality: q, ...(format === 'webp' ? { smartSubsample: true } : {}) })
          .toBuffer(),
      BUDGET,
    );
    await writeFile(join(dir, `${os}-portrait.${format}`), bytes);
    console.log(`[chooser] ${os}-portrait.${format} ${OUT_WIDTH}x${outHeight} ${bytes.length} B (q${quality})`);
  }
}
