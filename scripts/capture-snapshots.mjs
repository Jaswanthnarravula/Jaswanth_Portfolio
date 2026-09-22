/**
 * OS chooser snapshots — plans/04-os-chooser.md "Portfolio mapping" (`CHOOSE-CARD-01`): each card previews its OS's
 * full-page home as a static AVIF (≤ 25 KB, plus a WebP fallback in the same budget for engines without AVIF) in the
 * visitor's viewport shape — landscape for laptops/desktops, portrait for phones — with no device outline. Captured
 * from a running production build with every OS visible (the e2e preview build), so a card is literally a small
 * version of the page and the enter flight is a clean uniform scale. Re-run whenever an OS home changes:
 *   npm run test:e2e:build && node scripts/e2e-serve.mjs .next 3000 &  node scripts/capture-snapshots.mjs [baseUrl]
 * Writes public/assets/snapshots/{os}.{orientation}.{hash}.{avif,webp} + lib/welcome/snapshots.generated.json.
 * An OS whose route still renders the preview stub ([data-stub-os]) gets the owner's storyboard miniature of its home
 * instead (scripts/snapshot-miniatures.mjs, plans/visual-targets/chooser.png); its real home replaces it on re-capture.
 */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { miniatureHtml } from './snapshot-miniatures.mjs';

export const SNAPSHOT_BUDGET = 25 * 1024;
export const ORIENTATIONS = {
  landscape: { viewport: { width: 1440, height: 900 }, width: 1280 },
  portrait: { viewport: { width: 390, height: 844 }, width: 600 },
};
const OSES = ['ios', 'macos', 'windows', 'android', 'linux'];

/**
 * An OS's reference state for its card (its `01-identity.md` "Visual target"), reached with real input so the card is
 * exactly what the live shell renders. macOS: `/macos/finder/experience` after opening GitHub — GitHub behind and
 * inactive, Finder front and active on Experience (landscape: its first role selected, as in the frame).
 */
const REFERENCE = {
  async macos(page, orientation) {
    await page.goto(new URL('/macos/github', page.url()).href);
    await page.locator('[data-os-shell="macos"] [data-window="macos:github"]').waitFor({ timeout: 20000 });
    await page.locator('#dock-finder').click();
    const finder = page.locator('[data-window="macos:files"]');
    await finder.getByRole('navigation', { name: 'Favourites' }).getByRole('link', { name: 'Experience' }).click();
    if (orientation === 'landscape') await finder.locator('[data-column="entries"] a').first().click();
    await page.mouse.move(0, 450);
  },
};

/** Highest quality that fits the budget (never below 30); `encode(quality)` returns the encoded bytes. */
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
  for (const file of await readdir(outDir)) if (/\.(avif|webp)$/.test(file)) await rm(join(outDir, file));

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
        const stub = (await page.locator('[data-stub-os]').count()) > 0;
        if (stub) await page.setContent(miniatureHtml(os, orientation));
        else await REFERENCE[os]?.(page, orientation);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(400); // layer fade-in settles (reduced motion keeps it short)
        console.log(
          `[snapshots] ${os} ${orientation}: ${stub ? 'storyboard miniature (home not built yet)' : 'live home'}`,
        );
        const png = await page.screenshot({ type: 'png' });
        await context.close();
        const height = Math.round((spec.width * spec.viewport.height) / spec.viewport.width);
        const resized = () => sharp(png).resize(spec.width, height);
        // AVIF first; WebP for browsers without AVIF (older Safari). Both inside the same budget.
        const files = {};
        for (const [format, encode] of [
          ['avif', (q) => resized().avif({ quality: q, effort: 6 }).toBuffer()],
          [
            'webp',
            (q) =>
              resized()
                .webp({ quality: q + 8, effort: 6 })
                .toBuffer(),
          ],
        ]) {
          const { bytes, quality } = await encodeWithinBudget(encode);
          const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 10);
          const name = `${os}.${orientation}.${hash}.${format}`;
          await writeFile(join(outDir, name), bytes);
          files[format] = { src: `/assets/snapshots/${name}`, bytes: bytes.length };
          console.log(`[snapshots] ${name} ${bytes.length} B (q${quality})`);
        }
        manifest[os][orientation] = { avif: files.avif.src, webp: files.webp.src, width: spec.width, height };
      }
    }
  } finally {
    await browser.close();
  }
  await writeFile(join(root, 'lib/welcome/snapshots.generated.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
