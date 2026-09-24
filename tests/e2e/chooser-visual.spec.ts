/**
 * The chooser follows the owner's compact square-card refinement (plans/04-os-chooser.md "Visual target",
 * `CHOOSE-CARD-01`; shared/06 "Owner visual targets"; north-star smell test 8).
 * The storyboard faces (DS-FONT-01): IBM Plex Sans from Hello's first paint, Bricolage Grotesque only once the
 * chooser mounts.
 */
import { expect, test, type Page } from '@playwright/test';
import { skipIntro, waitForSettled } from './helpers';

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

  test('W1 the foyer uses compact cards, smaller copy, square previews and no recommendation badge @smoke', async ({
    page,
  }) => {
    await toChooser(page);
    const look = await page.evaluate(() => {
      const heading = document.querySelector('h1[data-chooser-fade="header"]')!;
      const card = document.querySelector('[data-chooser-card]')!;
      const nav = card.closest('nav')!;
      const cards = [...document.querySelectorAll<HTMLElement>('[data-chooser-card]')];
      const shots = [...document.querySelectorAll<HTMLElement>('[data-shot]')];
      const root = card.closest<HTMLElement>('[style*="--viewport-aspect"]')!;
      const rootBox = root.getBoundingClientRect();
      const headingBox = heading.getBoundingClientRect();
      const navBox = nav.getBoundingClientRect();
      const cardBoxes = cards.map((item) => item.getBoundingClientRect());
      return {
        field: getComputedStyle(root).backgroundImage,
        base: getComputedStyle(root).backgroundColor,
        headingFace: getComputedStyle(heading).fontFamily,
        headingColor: getComputedStyle(heading).color,
        cardFace: getComputedStyle(card).fontFamily,
        cardFill: getComputedStyle(card).backgroundColor,
        headingSize: Number.parseFloat(getComputedStyle(heading).fontSize),
        navWidth: navBox.width,
        navCenterOffset: navBox.left + navBox.width / 2 - (rootBox.left + rootBox.width / 2),
        groupCenterOffset: (headingBox.top + navBox.bottom) / 2 - (rootBox.top + rootBox.height / 2),
        cardGaps: cardBoxes.slice(1).map((box, index) => box.left - cardBoxes[index]!.right),
        cards: cardBoxes.map((box) => {
          return { width: box.width, height: box.height };
        }),
        shots: shots.map((item) => {
          const box = item.getBoundingClientRect();
          return box.width / box.height;
        }),
        badge: document.body.textContent?.includes('Suits your device') ?? false,
        imageTransforms: cards.map((item) => getComputedStyle(item.querySelector('img')!).transform),
        faces: [
          document.fonts.check('700 40px "Bricolage Grotesque"'),
          document.fonts.check('400 16px "IBM Plex Sans"'),
        ],
      };
    });
    expect(look.field).toContain('rgb(192, 203, 254)'); // #c0cbfe at 10 % 10 %
    expect(look.field).toContain('rgb(250, 210, 233)'); // #fad2e9 at 95 % 90 %
    expect(look.base).toBe('rgb(240, 244, 253)'); // #f0f4fd
    expect(look.headingFace).toMatch(/^"?Bricolage Grotesque"?,/);
    expect(look.headingColor).toBe('rgb(27, 35, 71)'); // #1b2347
    expect(look.cardFace).toMatch(/^"?IBM Plex Sans"?,/);
    expect(look.cardFill).toBe('rgba(255, 255, 255, 0.55)');
    expect(look.headingSize).toBeLessThanOrEqual(42);
    expect(look.navWidth).toBeLessThanOrEqual(1200);
    expect(Math.abs(look.navCenterOffset)).toBeLessThanOrEqual(1);
    expect(Math.abs(look.groupCenterOffset)).toBeLessThanOrEqual(1);
    for (const gap of look.cardGaps) expect(gap).toBeGreaterThanOrEqual(18);
    expect(look.cards).toHaveLength(5);
    for (const card of look.cards) {
      expect(card.width).toBeLessThan(240);
      expect(card.height).toBeLessThan(320);
    }
    expect(look.shots).toHaveLength(5);
    for (const aspect of look.shots) expect(aspect).toBeCloseTo(1, 2);
    expect(look.imageTransforms[0]).not.toBe('none');
    expect(look.imageTransforms[4]).not.toBe('none');
    expect(look.badge).toBe(false);
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
