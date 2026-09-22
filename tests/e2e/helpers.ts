/** Shared e2e helpers (shared/12): wait on end states, never sleep; focus is never on <body>. */
import { expect, type Page, type TestInfo } from '@playwright/test';

/** The OS layer is mounted and the kernel booted (the stub or a real shell renders `[data-os]`). */
export async function waitForOs(page: Page, os: string): Promise<void> {
  await expect(page.locator(`.os-root[data-os="${os}"] [data-os-shell="${os}"]`)).toBeAttached();
}

/** Focus never rests on <body> after an interaction (shared/09). */
export async function expectFocusNotOnBody(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => document.activeElement !== document.body && document.activeElement !== null))
    .toBe(true);
}

/**
 * Presses inside an OS commit to the kernel one frame + one task later (`dispatchSoon`, shared/10 INP). A frame + a
 * task queued now runs after any such commit, so what is checked next sees the press's result.
 */
export const committed = (page: Page): Promise<void> =>
  page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => setTimeout(done, 0))));

export const shellInstance = (page: Page) =>
  page.evaluate(() => document.documentElement.dataset.shellInstance ?? null);

/** A sentinel on `window` survives only while the document is not reloaded. */
export const plantSentinel = (page: Page) =>
  page.evaluate(() => ((window as unknown as { __sentinel: string }).__sentinel = 'alive'));
export const sentinel = (page: Page) =>
  page.evaluate(() => (window as unknown as { __sentinel?: string }).__sentinel ?? null);

export const isOriginalMode = (info: TestInfo) => info.project.name === 'asset-original';
export const isTouchProject = (info: TestInfo) =>
  ['iphone', 'pixel', 'ipad-portrait', 'ipad-landscape', 'iphone-landscape'].includes(info.project.name);

/**
 * An entrance has settled: every matched element and its ancestors are fully opaque (GSAP entrances animate opacity
 * inline, then clear it). Wait on this, not a fixed sleep, before measuring contrast or geometry.
 */
export async function waitForSettled(page: Page, selector: string): Promise<void> {
  await page.waitForFunction((sel) => {
    const elements = [...document.querySelectorAll(sel)];
    return (
      elements.length > 0 &&
      elements.every((el) => {
        for (let node: Element | null = el; node && node !== document.body; node = node.parentElement)
          if (Number(getComputedStyle(node).opacity) < 1) return false;
        return true;
      })
    );
  }, selector);
}

/** The chooser's "Suits your device" rule (plans/04): coarse + compact → a phone OS; fine + expanded/large → macOS. */
export const expectedBadges = (page: Page) =>
  page.evaluate(() => {
    const w = innerWidth;
    const h = innerHeight;
    const compact = w < 700 || h < 500;
    const coarse = matchMedia('(pointer: coarse)').matches;
    return (coarse && compact) || (!coarse && !compact && w >= 1100) ? 1 : 0;
  });

/**
 * Setup step: skip the intro if it is still playing. On a slow browser the 3.5 s intro can end on its own before a
 * click lands, and the button is then hidden (nothing left to skip), so this dispatches the click without waiting for
 * actionability; a skip after the intro is ignored by design. Skipping itself is tested with real input (NFLX-SKIP-01).
 */
export async function skipIntro(page: Page): Promise<void> {
  await page.locator('[data-skip-intro]').dispatchEvent('click');
}
