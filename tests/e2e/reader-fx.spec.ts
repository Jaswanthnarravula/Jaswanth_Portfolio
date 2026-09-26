/**
 * shared/24 reader motion on `/plain` — READER-FX-01…15 (the meter parser and flow data are unit-tested in
 * tests/unit/content/reader-fx.test.ts). Motion checks run on desktop Chromium with full motion; the reduced-motion
 * project checks the static design; content checks run everywhere.
 */
import { expect, test, type Page } from '@playwright/test';

const desktopMotion = (name: string) => name === 'chromium-desktop';

async function scrollToY(page: Page, y: number) {
  await page.evaluate(async (target) => {
    const start = scrollY;
    for (let step = 1; step <= 6; step++) {
      scrollTo(0, start + ((target - start) * step) / 6);
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
  }, y);
  await page.waitForTimeout(400);
}

async function scrollToSelector(page: Page, selector: string, offset = 120) {
  const y = await page.evaluate(
    ([s, o]) => (document.querySelector(s as string)?.getBoundingClientRect().top ?? 0) + scrollY - (o as number),
    [selector, offset] as const,
  );
  await scrollToY(page, y);
}

const translateY = (page: Page, selector: string) =>
  page.evaluate((s) => new DOMMatrixReadOnly(getComputedStyle(document.querySelector(s)!).transform).m42, selector);

test.beforeEach(async ({ page }) => {
  await page.goto('/plain');
  await page.waitForLoadState('networkidle');
});

test('READER-FX-06 name and titles keep one accessible name; the About lead is complete text', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(/^Jaswanth\s*Narravula\.$/);
  for (const title of ['About', 'Projects', 'Experience', 'Contact'])
    await expect(page.getByRole('heading', { level: 2, name: title, exact: true })).toBeVisible();
  const lead = await page.locator('#about p').first().textContent();
  expect(lead?.split(' ').length).toBeGreaterThan(10);
  expect(lead).not.toMatch(/\s{2,}/);
});

test('READER-FX-08 / -15 / -04 decorative layers are hidden from assistive tech and never take the pointer', async ({
  page,
}) => {
  const grain = page.locator('[class*="grain"]');
  await expect(grain).toHaveAttribute('aria-hidden', 'true');
  expect(await grain.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
  await expect(page.locator('[class*="placeholder"]')).toHaveAttribute('aria-hidden', 'true');
  // The placeholder sits under the portrait image.
  const zImg = await page.locator('[data-fx-object] img').evaluate((el) => getComputedStyle(el).zIndex);
  expect(zImg).toBe('1');
  for (const selector of ['[class*="field"]', '[data-fx-spot]'])
    await expect(page.locator(selector).first()).toHaveAttribute('aria-hidden', 'true');
});

test('READER-FX-11 each featured project tells challenge, role, decisions and results', async ({ page }, info) => {
  const chapters = page.locator('article[aria-labelledby^="chapter-"]');
  expect(await chapters.count()).toBeGreaterThanOrEqual(1);
  for (const chapter of await chapters.all()) {
    for (const beat of ['The challenge', 'My role', 'Key decisions', 'Results'])
      await expect(chapter.getByRole('heading', { level: 4, name: beat })).toHaveCount(1);
    await expect(chapter.getByRole('link', { name: /Read the full case study/ })).toHaveAttribute(
      'href',
      /\/go\/projects\//,
    );
  }
  // Sticky from 1000 px wide and 760 px tall (shorter screens keep it in the flow).
  if (desktopMotion(info.project.name)) {
    const position = await page
      .locator('[class*="visual"]')
      .first()
      .evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe('sticky');
  }
});

test('READER-FX-02 progress bar scales with scroll; the section in view is aria-current', async ({ page }) => {
  const scale = () =>
    page.locator('[class*="progress"]').evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a);
  expect(await scale()).toBeLessThan(0.05);
  await scrollToSelector(page, '#experience');
  expect(await scale()).toBeGreaterThan(0.2);
  await expect(
    page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'Experience' }),
  ).toHaveAttribute('aria-current', 'location');
});

test.describe('full motion', () => {
  test.beforeEach(({}, info) => test.skip(!desktopMotion(info.project.name), 'pointer + full-motion checks'));

  // READER-FX-09 (type band) was removed by the owner on 2026-09-26, together with the hero's node network and rings.
  test('READER-FX-03 hero layers move at different rates with the scroll; the removed band stays gone', async ({
    page,
  }) => {
    await scrollToY(page, 420);
    const far = await translateY(page, '[class*="field"]');
    const mid = await translateY(page, '[class*="object"]');
    expect(far).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(0);
    await expect(page.locator('[class*="bandTrack"]')).toHaveCount(0);
  });

  test('READER-FX-04 / -05 pointer tilts the hero object and moves the light; the cursor stays native', async ({
    page,
  }) => {
    await page.mouse.move(1100, 260);
    await page.mouse.move(1180, 300, { steps: 6 });
    await page.waitForTimeout(500);
    const tilt = await page.locator('[data-fx-object]').evaluate((el) => el.style.getPropertyValue('--fx-tx'));
    expect(Math.abs(parseFloat(tilt))).toBeGreaterThan(0.5);
    const alpha = await page.locator('[data-fx-spot]').evaluate((el) => el.style.getPropertyValue('--fx-sa'));
    expect(parseFloat(alpha)).toBeGreaterThan(0.5);
    expect(await page.locator('main').evaluate((el) => getComputedStyle(el).cursor)).toBe('auto');
  });

  test('READER-FX-07 a section is fully revealed once in view', async ({ page }) => {
    await scrollToSelector(page, '#experience', 80);
    const heading = page.locator('#experience header').first();
    await expect
      .poll(() => heading.evaluate((el) => getComputedStyle(el).transform))
      .toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    expect(await heading.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  });

  test('READER-FX-10 a card tilts under the pointer; a CTA shifts at most 8 px and returns', async ({ page }) => {
    const cta = page.getByRole('link', { name: /Explore my work/ });
    const box = (await cta.boundingBox())!;
    await page.mouse.move(box.x + box.width - 2, box.y + box.height - 2, { steps: 4 });
    await page.waitForTimeout(500);
    const pull = await cta.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform));
    expect(Math.abs(pull.m41)).toBeGreaterThan(0.5);
    expect(Math.abs(pull.m41)).toBeLessThanOrEqual(8);
    expect(Math.abs(pull.m42)).toBeLessThanOrEqual(8);
    await page.mouse.move(40, 40, { steps: 4 });
    await page.waitForTimeout(700);
    expect(await cta.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)).toBeCloseTo(0, 0);

    await scrollToSelector(page, '#education');
    const school = page.locator('#education li[data-fx-tilt]').first();
    const card = (await school.boundingBox())!;
    await page.mouse.move(card.x + card.width * 0.9, card.y + card.height * 0.2, { steps: 5 });
    await page.waitForTimeout(500);
    expect(Math.abs(parseFloat(await school.evaluate((el) => el.style.getPropertyValue('--fx-ry'))))).toBeGreaterThan(
      0.5,
    );
  });

  test('READER-FX-12 request pulses run only while their chapter is on screen', async ({ page }) => {
    const chapters = page.locator('article[aria-labelledby^="chapter-"]');
    await expect(chapters.first()).not.toHaveAttribute('data-fx-on');
    await scrollToSelector(page, 'article[aria-labelledby^="chapter-"]');
    await expect(chapters.first()).toHaveAttribute('data-fx-on', '');
    await scrollToSelector(page, '#contact');
    await expect(chapters.first()).not.toHaveAttribute('data-fx-on');
  });

  test('READER-FX-14 the rail moves with the scroll and focus keeps a repo link on screen', async ({ page }) => {
    // Force the rail on with enough cards to overflow, whatever the build-time snapshot holds.
    await page.evaluate(() => {
      const rail = document.querySelector<HTMLElement>('[class*="rail"]');
      const track = rail?.querySelector('ul');
      if (!rail || !track) return;
      rail.setAttribute('data-rail', '');
      while (track.children.length < 7) track.append(track.children[0]!.cloneNode(true));
    });
    await scrollToSelector(page, '[class*="rail"]', 0);
    await scrollToY(page, (await page.evaluate(() => scrollY)) + 400);
    const shift = await page
      .locator('[class*="railTrack"]')
      .evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
    expect(shift).toBeLessThan(-10);
    const last = page.locator('[class*="railTrack"] a').last();
    await last.focus();
    await page.waitForTimeout(300);
    const rect = (await last.boundingBox())!;
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(1440);
  });
});

test('READER-FX-01 reduced motion rests every section in place with no transforms', async ({ page }, info) => {
  test.skip(info.project.name !== 'reduced-motion', 'reduced-motion project only');
  await scrollToY(page, 600);
  for (const selector of ['#about header', '#projects header', '[class*="maskInner"]', '[class*="letter"]']) {
    const style = await page
      .locator(selector)
      .first()
      .evaluate((el) => ({ transform: getComputedStyle(el).transform, opacity: getComputedStyle(el).opacity }));
    expect(style.transform, selector).toBe('none');
    expect(style.opacity, selector).toBe('1');
  }
  await page.mouse.move(1100, 300);
  expect(await page.locator('[data-fx-object]').evaluate((el) => el.style.getPropertyValue('--fx-tx'))).toBe('');
});

test('READER-FX-01 tier 0 starts no pointer driver', async ({ browser }, info) => {
  test.skip(!desktopMotion(info.project.name), 'desktop only');
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }));
  const page = await context.newPage();
  await page.goto('/plain');
  expect(await page.evaluate(() => document.documentElement.dataset.tier)).toBe('0');
  await page.mouse.move(1100, 300);
  await page.mouse.move(1150, 320, { steps: 4 });
  await page.waitForTimeout(300);
  expect(await page.locator('[data-fx-object]').evaluate((el) => el.style.getPropertyValue('--fx-tx'))).toBe('');
  await context.close();
});
