/**
 * Renders every frame of the owner's storyboard full screen — shared/06 "Owner visual targets", north-star smell
 * test 8 ("Storyboard test"). Each `.screen` of the storyboard is drawn edge to edge at the given viewport (default
 * 1440 × 900), with its animations frozen at a fixed state (the Hello fully drawn, the pill's beam at 0°, the caret
 * shown), and saved to plans/visual-targets/frames/{name}.png — the pixels the live screens are compared against.
 *   node scripts/render-visual-targets.mjs [width height] [outDir]
 * Reads assets-inbox/preview/storyboard.html (its images resolve against assets-inbox/); needs the network for the
 * storyboard's web fonts. A build tool only: nothing here ships.
 */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Storyboard section id → frame file names (one per `.screen` in the section). */
export const FRAMES = {
  hello: ['hello'],
  intro: ['intro'],
  profiles: ['profiles'],
  chooser: ['chooser'],
  macos: ['macos'],
  windows: ['windows'],
  ios: ['ios-1', 'ios-2'],
  android: ['android-1', 'android-2'],
  linux: ['linux'],
};

async function main() {
  const [w = '1440', h = '900', out = join(root, 'plans/visual-targets/frames')] = process.argv.slice(2);
  const source = join(root, 'assets-inbox/preview/storyboard.html');
  if (!existsSync(source)) throw new Error(`missing ${source} (the storyboard and its images live in assets-inbox/)`);
  const { chromium } = createRequire(join(root, 'package.json'))('playwright-core');
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(source).href, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    for (const [id, names] of Object.entries(FRAMES))
      for (const [index, name] of names.entries()) {
        await page.evaluate(
          ({ id, index }) => {
            for (const screen of document.querySelectorAll('.screen')) screen.removeAttribute('style');
            document
              .querySelectorAll(`#${id} .screen`)
              [index].setAttribute(
                'style',
                'position:fixed;inset:0;width:100vw;height:100vh;max-width:none;aspect-ratio:auto;border:0;' +
                  'border-radius:0;box-shadow:none;z-index:99999',
              );
            for (const animation of document.getAnimations()) {
              const name = animation.animationName ?? '';
              if (/draw/.test(name)) animation.finish();
              else if (/spin|blink/.test(name)) {
                animation.pause();
                animation.currentTime = 0;
              }
            }
          },
          { id, index },
        );
        await page.waitForTimeout(300);
        await page.screenshot({ path: join(out, `${name}.png`) });
        console.log(`[frames] ${name}.png`);
      }
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
