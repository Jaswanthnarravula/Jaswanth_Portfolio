/**
 * OS chooser snapshots — plans/04-os-chooser.md "Portfolio mapping" (`CHOOSE-CARD-01`): each card previews its OS's
 * full-page home as a static AVIF (≤ 25 KB) in the visitor's viewport shape — landscape for laptops/desktops,
 * portrait for phones — with no device outline. Captured from a running production build with every OS visible
 * (the e2e preview build), so a card is literally a small version of the page and the enter flight is a clean
 * uniform scale. Re-run whenever an OS home changes:
 *   npm run test:e2e:build && node scripts/e2e-serve.mjs .next 3000 &  node scripts/capture-snapshots.mjs [baseUrl]
 * Writes public/assets/snapshots/{os}.{orientation}.{hash}.avif + lib/welcome/snapshots.generated.json.
 */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const SNAPSHOT_BUDGET = 25 * 1024;
export const ORIENTATIONS = {
  landscape: { viewport: { width: 1440, height: 900 }, width: 1280 },
  portrait: { viewport: { width: 390, height: 844 }, width: 600 },
};
const OSES = ['ios', 'macos', 'windows', 'android', 'linux'];

/** Highest AVIF quality that fits the budget (never below 30). */
export async function encodeWithinBudget(encode, budget = SNAPSHOT_BUDGET) {
  for (let quality = 62; quality >= 30; quality -= 8) {
    const bytes = await encode(quality);
    if (bytes.length <= budget) return { bytes, quality };
  }
  throw new Error(`snapshot cannot fit ${budget} bytes`);
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const base = process.argv[2] ?? 'http://localhost:3000';
  const require = createRequire(join(root, 'package.json'));
  const sharp = require('sharp');
  const { chromium } = require('playwright-core');
  const outDir = join(root, 'public/assets/snapshots');
  await mkdir(outDir, { recursive: true });
  for (const file of await readdir(outDir)) if (file.endsWith('.avif')) await rm(join(outDir, file));

  const browser = await chromium.launch();
  const manifest = {};
  try {
    for (const os of OSES) {
      manifest[os] = {};
      for (const [orientation, spec] of Object.entries(ORIENTATIONS)) {
        const context = await browser.newContext({
          viewport: spec.viewport,
          deviceScaleFactor: 2,
          isMobile: orientation === 'portrait',
          hasTouch: orientation === 'portrait',
          reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        await page.goto(`${base}/${os}`);
        await page.locator(`[data-os-shell="${os}"]`).waitFor({ state: 'attached', timeout: 20000 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(400); // layer fade-in settles (reduced motion keeps it short)
        const png = await page.screenshot({ type: 'png' });
        await context.close();
        const height = Math.round((spec.width * spec.viewport.height) / spec.viewport.width);
        const { bytes, quality } = await encodeWithinBudget((q) =>
          sharp(png).resize(spec.width, height).avif({ quality: q, effort: 6 }).toBuffer(),
        );
        const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 10);
        const name = `${os}.${orientation}.${hash}.avif`;
        await writeFile(join(outDir, name), bytes);
        manifest[os][orientation] = {
          src: `/assets/snapshots/${name}`,
          width: spec.width,
          height,
          bytes: bytes.length,
        };
        console.log(`[snapshots] ${name} ${bytes.length} B (q${quality})`);
      }
    }
  } finally {
    await browser.close();
  }
  await writeFile(join(root, 'lib/welcome/snapshots.generated.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
