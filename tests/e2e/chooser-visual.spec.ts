/**
 * The chooser is the owner's storyboard frame (plans/04-os-chooser.md "Visual target", `CHOOSE-CARD-01`;
 * shared/06 "Owner visual targets"; north-star smell test 8). The boxes below were measured from
 * plans/visual-targets/storyboard.html `#chooser` drawn at exactly 1440 × 900; the live foyer must land on them.
 * The storyboard faces (DS-FONT-01): IBM Plex Sans from Hello's first paint, Bricolage Grotesque only once the
 * chooser mounts.
 */
import { expect, test, type Page } from '@playwright/test';
import { skipIntro, waitForSettled } from './helpers';

type Box = readonly [x: number, y: number, width: number, height: number];

/** plans/visual-targets/storyboard.html `#chooser` at 1440 × 900 (x, y, width, height in CSS px). */
const FRAME = {
  heading: [346.5, 264.2, 746.9, 63.8],
  cards: [
    [57.6, 368.9, 245.3, 266.9],
    [327.5, 368.9, 245.3, 266.9],
    [597.3, 368.9, 245.3, 266.9],
    [867.2, 368.9, 245.3, 266.9],
    [1137.1, 368.9, 245.3, 266.9],
  ],
  snaps: [
    [79, 394.4, 202.5, 126.5],
    [348.9, 394.4, 202.5, 126.5],
    [618.8, 394.4, 202.5, 126.5],
    [888.6, 394.4, 202.5, 126.5],
    [1158.5, 394.4, 202.5, 126.5],
  ],
  badge: [376.7, 357.1, 146.8, 28.7],
} as const satisfies Record<string, Box | readonly Box[]>;

const box = (page: Page, selector: string) =>
  page.locator(selector).evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height] as const;
    }),
  );
const expectBox = (actual: readonly number[], expected: Box, what: string, tolerance = 1.5) => {
  actual.forEach((value, i) =>
    expect(Math.abs(value - expected[i]!), `${what} [${i}] ${value} vs ${expected[i]}`).toBeLessThanOrEqual(tolerance),
  );
};

async function toChooser(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tap to begin' }).click();
  await skipIntro(page);
  await page.mouse.move(1439, 1);
  await page.getByRole('button', { name: /^Guest/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Choose how you want to explore' })).toBeFocused();
  await waitForSettled(page, '[data-chooser-card]');
  await page.evaluate(() => document.fonts.ready);
}

test.describe('storyboard frame', () => {
  test.beforeEach(({ page: _page }, info) => {
    test.skip(info.project.name !== 'chromium-desktop', 'the frame is measured at 1440 × 900, fine pointer');
  });

  test('W1 the foyer lands on the frame: heading, cards, snapshots and badge @smoke', async ({ page }) => {
    await toChooser(page);
    const [heading] = await box(page, 'h1[data-chooser-fade="header"]');
    expectBox(heading!, FRAME.heading, 'heading', 3);
    const cards = await box(page, '[data-chooser-card]');
    const snaps = await box(page, '[data-chooser-card] [data-shot]');
    expect(cards).toHaveLength(5);
    cards.forEach((card, i) => expectBox(card, FRAME.cards[i]!, `card ${i}`));
    snaps.forEach((snap, i) => expectBox(snap, FRAME.snaps[i]!, `snapshot ${i}`));
    const [badge] = await box(page, '[data-chooser-card="macos"] > span:first-child');
    expectBox(badge!, FRAME.badge, 'badge');

    const look = await page.evaluate(() => {
      const heading = document.querySelector('h1[data-chooser-fade="header"]')!;
      const card = document.querySelector('[data-chooser-card]')!;
      const root = card.closest<HTMLElement>('[style*="--viewport-aspect"]')!;
      return {
        field: getComputedStyle(root).backgroundImage,
        base: getComputedStyle(root).backgroundColor,
        headingFace: getComputedStyle(heading).fontFamily,
        headingColor: getComputedStyle(heading).color,
        cardFace: getComputedStyle(card).fontFamily,
        cardFill: getComputedStyle(card).backgroundColor,
        faces: [
          document.fonts.check('700 40px "Bricolage Grotesque"'),
          document.fonts.check('400 16px "IBM Plex Sans"'),
        ],
      };
    });
    expect(look.field).toContain('rgb(185, 204, 255)'); // #b9ccff at 10 % 10 %
    expect(look.field).toContain('rgb(255, 208, 228)'); // #ffd0e4 at 95 % 90 %
    expect(look.base).toBe('rgb(238, 242, 251)'); // #eef2fb
    expect(look.headingFace).toMatch(/^"?Bricolage Grotesque"?,/);
    expect(look.headingColor).toBe('rgb(27, 35, 71)'); // #1b2347
    expect(look.cardFace).toMatch(/^"?IBM Plex Sans"?,/);
    expect(look.cardFill).toBe('rgba(255, 255, 255, 0.55)');
    expect(look.faces).toEqual([true, true]);
  });

  test('DS-FONT-01 Hello paints in the storyboard text face; the display face waits for the chooser', async ({
    page,
  }) => {
    const fonts: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'font') fonts.push(new URL(request.url()).pathname);
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Tap to begin' }).waitFor();
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1500))); // past load + idle warm-up
    const storyboard = () => fonts.filter((path) => path.startsWith('/assets/fonts/'));
    // Hello (plans/02 "Visual target"): IBM Plex Sans, preloaded; never the chooser's display face.
    expect(storyboard()).toEqual([expect.stringMatching(/\/ibm-plex-sans-latin-var\.[0-9a-f]{10}\.woff2$/)]);
    await page.getByRole('button', { name: 'Tap to begin' }).click();
    await skipIntro(page);
    await page.getByRole('button', { name: /^Guest/ }).click();
    await expect(page.getByRole('heading', { name: 'Choose how you want to explore' })).toBeVisible();
    // The chooser adds Bricolage Grotesque; Plex comes from the cache (one request for it, ever).
    await expect
      .poll(() => storyboard().sort())
      .toEqual([
        expect.stringMatching(/\/bricolage-grotesque-700-latin\.[0-9a-f]{10}\.woff2$/),
        expect.stringMatching(/\/ibm-plex-sans-latin-var\.[0-9a-f]{10}\.woff2$/),
      ]);
  });
});
