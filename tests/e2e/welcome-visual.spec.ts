/**
 * Hello, the intro and "Who's watching?" are the owner's storyboard frames (plans/02 and plans/03 "Visual target";
 * shared/06 "Owner visual targets"; north-star smell test 8). The boxes below were measured from
 * plans/visual-targets/storyboard.html (`#hello`, `#intro`, `#profiles`) drawn full-screen at exactly 1440 × 900; the
 * live screens must land on them. Text boxes are compared as content boxes (the hit-area padding is not drawn).
 */
import { expect, test, type Page } from '@playwright/test';
import { skipIntro, waitForSettled } from './helpers';

type Box = readonly [x: number, y: number, width: number, height: number];

/** plans/visual-targets/storyboard.html at 1440 × 900 (x, y, width, height in CSS px). */
const FRAME = {
  hello: {
    skip: [50.5, 42.73, 100.34, 25.23],
    end: [1211.95, 42.73, 177.55, 25.23],
    lens: [316.8, 144, 806.41, 630],
    // The glyph and pill below follow the owner's liquid-glass decision of 2026-09-21, not the
    // frame: the rod "hello" is 25 em wide (the frame's is 17 em). Measured on the build (plans/06 Deviations log).
    glyph: [464.41, 324.81, 511.19, 185.94],
    pill: [624.83, 533.25, 190.34, 59.94],
  },
  intro: { mark: [246.04, 314.44, 947.93, 271.13], skip: [1260.88, 812.16, 130.06, 46.95] },
  profiles: {
    heading: [467.86, 253.19, 504.28, 87.72],
    cards: [
      [177.13, 415.13, 184.44, 231.67],
      [402.45, 415.13, 184.44, 231.67],
      [627.78, 415.13, 184.44, 231.67],
      [853.11, 415.13, 184.44, 231.67],
      [1078.44, 415.13, 184.44, 231.67],
    ],
    /** The frame shows Developer chosen (`.prof.on`): its avatar lifted .4 em with a white border. */
    developerAvatar: [402.45, 406.13, 184.44, 184.44],
    footer: [614.95, 839.81, 210.09, 25.23],
  },
} as const;

/** Border box, or content box (padding and border removed) for text whose hit area is padded. */
const boxes = (page: Page, selector: string, content = false) =>
  page.locator(selector).evaluateAll(
    (els, content) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        if (!content) return [r.x, r.y, r.width, r.height] as const;
        const s = getComputedStyle(el);
        const px = (v: string) => Number.parseFloat(v) || 0;
        const l = px(s.paddingLeft) + px(s.borderLeftWidth);
        const t = px(s.paddingTop) + px(s.borderTopWidth);
        const w = l + px(s.paddingRight) + px(s.borderRightWidth);
        const h = t + px(s.paddingBottom) + px(s.borderBottomWidth);
        return [r.x + l, r.y + t, r.width - w, r.height - h] as const;
      }),
    content,
  );
const expectBox = (actual: readonly number[] | undefined, expected: Box, what: string, tolerance = 1.5) => {
  expect(actual, what).toBeDefined();
  actual!.forEach((value, i) =>
    expect(Math.abs(value - expected[i]!), `${what} [${i}] ${value} vs ${expected[i]}`).toBeLessThanOrEqual(tolerance),
  );
};

test.describe('storyboard frames', () => {
  test.beforeEach(({ page: _page }, info) => {
    test.skip(info.project.name !== 'chromium-desktop', 'the frames are measured at 1440 × 900, fine pointer');
  });

  test('W1 Hello lands on the frame: top bar, glass lens, glyph and pill @smoke', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const [skip] = await boxes(page, '[data-welcome-bar] > a', true);
    expectBox(skip, FRAME.hello.skip, 'Skip the OS');
    const [end] = await boxes(page, 'nav[aria-label="Welcome"]');
    expectBox(end, FRAME.hello.end, 'Résumé · Sound on');
    expectBox((await boxes(page, '[data-lens]'))[0], FRAME.hello.lens, 'lens');
    expectBox((await boxes(page, 'svg:has([data-glyph])'))[0], FRAME.hello.glyph, 'glyph');
    await expect(page.getByRole('heading', { level: 1, name: 'Hello' })).toBeAttached();
    await expect(page.getByText('Jaswanth — Software Engineer', { exact: true })).toHaveCount(0);
    expectBox((await boxes(page, '[data-tap-to-begin]'))[0], FRAME.hello.pill, 'pill');

    const look = await page.evaluate(() => {
      const lens = getComputedStyle(document.querySelector('[data-lens]')!);
      return {
        // The tint is the lens's surface layer (::after), above its backdrop layer; it clears when refraction is on.
        lensFill: getComputedStyle(document.querySelector('[data-lens]')!, '::after').backgroundImage,
        refract: document.documentElement.dataset.refract === 'on',
        lensRadius: lens.borderTopLeftRadius,
        field: getComputedStyle(document.querySelector('[data-lens]')!.closest('[data-screen]')!.firstElementChild!)
          .backgroundImage,
        endText: (document.querySelector('nav[aria-label="Welcome"]') as HTMLElement).innerText.replace(/\u00a0/g, ' '),
        plex: document.fonts.check('600 20px "IBM Plex Sans"'),
      };
    });
    expect(look.plex).toBe(true);
    // Liquid glass: a clear body (white 12–30 %; 5–20 % while the edge refracts), not the frame's frosted white at 34 %.
    expect(look.lensFill).toBe(
      look.refract
        ? 'linear-gradient(160deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.05) 55%, rgba(255, 255, 255, 0.14))'
        : 'linear-gradient(160deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.12) 55%, rgba(255, 255, 255, 0.22))',
    );
    expect(Number.parseFloat(look.lensRadius)).toBeCloseTo(2.4 * 20.448, 0);
    expect(look.field).toContain('rgb(157, 185, 255)'); // #9db9ff at 18 % 20 %
    expect(look.field).toContain('rgb(255, 192, 222)'); // #ffc0de at 85 % 25 %
    expect(look.field).toContain('rgb(255, 217, 160)'); // #ffd9a0 at 60 % 95 %
    expect(look.endText).toBe('Résumé  ·  Sound on');
  });

  test('W1 the intro lands on the frame: the portfolio wordmark and Skip intro', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Tap to begin' }).click();
    // Measured at rest (scale 1): the zoom is a transform on the same box.
    const [mark] = await page.locator('[data-intro] [data-wordmark]').evaluateAll((els) =>
      els.map((el) => {
        (el as SVGElement).style.transform = 'none';
        const r = el.getBoundingClientRect();
        return [r.x, r.y, r.width, r.height] as const;
      }),
    );
    expectBox(mark, FRAME.intro.mark, 'wordmark');
    expectBox((await boxes(page, '[data-skip-intro]'))[0], FRAME.intro.skip, 'Skip intro');
    const fill = await page.locator('[data-intro] [data-wordmark]').evaluate((el) => getComputedStyle(el).fill);
    expect(fill).toBe('rgb(229, 9, 20)'); // #e50914
  });

  test('W1 "Who’s watching?" lands on the frame, with Developer chosen as drawn @smoke', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Tap to begin' }).click();
    await skipIntro(page);
    await expect(page.getByRole('heading', { name: 'Who’s watching?' })).toBeFocused();
    await waitForSettled(page, '[data-profile]');
    await page.evaluate(() => document.fonts.ready);
    expectBox((await boxes(page, '#profiles-heading'))[0], FRAME.profiles.heading, 'heading');
    const cards = await boxes(page, '[data-profile]');
    expect(cards).toHaveLength(5);
    cards.forEach((card, i) => expectBox(card, FRAME.profiles.cards[i]!, `card ${i}`));
    expectBox((await boxes(page, 'footer[data-profiles-fade]'))[0], FRAME.profiles.footer, 'footer');

    const avatar = page.locator('[data-profile="developer"] [data-avatar]');
    const box = (await avatar.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect
      .poll(async () => (await boxes(page, '[data-profile="developer"] [data-avatar]'))[0]![1])
      .toBeCloseTo(FRAME.profiles.developerAvatar[1], 0);
    expectBox(
      (await boxes(page, '[data-profile="developer"] [data-avatar]'))[0],
      FRAME.profiles.developerAvatar,
      'chosen avatar',
    );
    await expect.poll(() => avatar.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe('rgb(255, 255, 255)');
    const names = await page
      .locator('[data-profile-name]')
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).color));
    expect(names).toEqual([
      'rgb(128, 128, 128)',
      'rgb(255, 255, 255)',
      'rgb(128, 128, 128)',
      'rgb(128, 128, 128)',
      'rgb(128, 128, 128)',
    ]);
    // The first visit carries no top chrome: no replay mark, no Sound toggle (the frame shows neither).
    await expect(page.getByRole('button', { name: 'Replay intro' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Sound' })).toBeHidden();
  });
});
