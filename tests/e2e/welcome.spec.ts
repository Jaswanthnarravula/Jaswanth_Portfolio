/**
 * Welcome journeys (plans/02 Hello, plans/03 intro + "Who's watching?", shared/12 W1 · W3 · R1 · X1 · X4 · X5):
 *   HELLO-TAP-01 · HELLO-RETURN-01 · HELLO-MUTE-01 · HELLO-RM-01 · HELLO-A11Y-01 · HELLO-RESP-01 · HELLO-GLASS-01 ·
 *   NFLX-INTRO-01 · NFLX-SKIP-01 · NFLX-AUDIO-01 · NFLX-PROF-02 · NFLX-CARD-01 · NFLX-RETURN-01 · NFLX-RM-01 ·
 *   NFLX-A11Y-01 · NFLX-HAND-01 · RES-PRE-01 · DS-GLASS-01 · MOTION-RM-01 · RESP-VP-01
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { expectFocusNotOnBody, skipIntro, waitForSettled } from './helpers';

const PERSONAS = ['Recruiter', 'Developer', 'Adventurer', 'Designer', 'Guest'] as const;
const webkitTouch = (project: string) => ['iphone', 'ipad-portrait', 'ipad-landscape'].includes(project);

const screen = (page: Page) => page.locator('[data-screen]').first();
const tap = (page: Page) => page.getByRole('button', { name: 'Tap to begin' }).click();
const whoIsWatching = (page: Page) => page.getByRole('heading', { name: 'Who’s watching?' });
const chooserHeading = (page: Page) => page.getByRole('heading', { name: 'Choose how you want to explore' });

async function toProfiles(page: Page) {
  await page.goto('/');
  await tap(page);
  await skipIntro(page);
  await expect(whoIsWatching(page)).toBeFocused();
}
async function toChooser(page: Page, persona: (typeof PERSONAS)[number] = 'Guest') {
  await toProfiles(page);
  await page.getByRole('button', { name: persona }).click();
  await expect(chooserHeading(page)).toBeVisible();
}
/** Every running CSS animation/transition, as [name, duration ms] (GSAP tweens are not in getAnimations). */
const longAnimations = (page: Page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .map((a) => [
        (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? 'wa',
        Number(a.effect?.getComputedTiming().duration ?? 0),
      ])
      .filter(([, duration]) => (duration as number) > 200),
  );

test.describe('Hello', () => {
  test('W1 tap during the stroke draw advances to the intro at once @smoke', async ({ page }, info) => {
    await page.goto('/');
    if (info.project.name !== 'reduced-motion') {
      const drawing = await page.evaluate(() =>
        document
          .querySelector('[data-ink]')!
          .getAnimations()
          .some((a) => a.playState === 'running'),
      );
      expect(drawing, 'the Hello is still drawing').toBe(true);
    }
    await tap(page);
    await expect(screen(page)).toHaveAttribute('data-screen', 'intro');
    await expect(page.getByRole('button', { name: 'Skip intro' })).toBeFocused();
    // A second tap (the pill is hidden now, so dispatch it directly) changes nothing.
    await page.locator('[data-tap-to-begin]').evaluate((el: HTMLElement) => el.click());
    await expect(screen(page)).toHaveAttribute('data-screen', 'intro');
  });

  test('the SSR h1 names Jaswanth and the morphing glyph is hidden from assistive tech', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Jaswanth — Software Engineer' })).toBeVisible();
    await expect(page.locator('svg:has([data-glyph])')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByRole('button', { name: 'Sound' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('R1 reduced motion: nothing on / animates longer than 200 ms and the Hello is fully drawn', async ({
    page,
  }, info) => {
    test.skip(info.project.name !== 'reduced-motion', 'reduced-motion project');
    await page.goto('/');
    expect(await longAnimations(page)).toEqual([]);
    const offset = await page.locator('[data-ink]').evaluate((el) => getComputedStyle(el).strokeDashoffset);
    expect(offset).toMatch(/^0(px)?$/);
    await tap(page);
    expect(await longAnimations(page)).toEqual([]);
  });

  test('X5 at most three live backdrop blurs; tier 0 and solid glass drop them all', async ({ page }) => {
    await page.goto('/');
    const blurs = () =>
      page.evaluate(() => {
        let count = 0;
        for (const el of document.querySelectorAll('body *'))
          for (const pseudo of [null, '::before', '::after']) {
            const value = getComputedStyle(el, pseudo).backdropFilter;
            if (value && value !== 'none') count++;
          }
        return count;
      });
    expect(await blurs()).toBeLessThanOrEqual(3);
    await page.evaluate(() => (document.documentElement.dataset.tier = '0'));
    expect(await blurs()).toBe(0);
    await page.evaluate(() => {
      document.documentElement.dataset.tier = '1';
      document.documentElement.dataset.glass = 'solid';
    });
    expect(await blurs()).toBe(0);
  });

  test('X4 no horizontal scroll at 320 px on Hello and the profiles; landscape phones never scroll', async ({
    page,
  }) => {
    const overflow = () =>
      page.evaluate(() => [
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.documentElement.scrollHeight - window.innerHeight,
      ]);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('/');
    expect((await overflow())[0]).toBeLessThanOrEqual(0);
    await tap(page);
    await skipIntro(page);
    await expect(whoIsWatching(page)).toBeVisible();
    expect((await overflow())[0]).toBeLessThanOrEqual(0);
    await page.setViewportSize({ width: 844, height: 390 });
    const [x, y] = await overflow();
    expect(x).toBeLessThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(0);
    await page.goto('/');
    const [hx, hy] = await overflow();
    expect(hx).toBeLessThanOrEqual(0);
    expect(hy).toBeLessThanOrEqual(0);
  });
});

test.describe('intro and profiles', () => {
  test('W1 the intro reaches the profiles within 3.5 s on its own @smoke', async ({ page }, info) => {
    await page.goto('/');
    // Timed inside the page: from the tap to the moment the profiles screen takes over.
    await page.evaluate(() => {
      const w = window as unknown as { __tapAt: number; __profilesAt: number };
      document.querySelector('[data-tap-to-begin]')!.addEventListener('click', () => (w.__tapAt = performance.now()), {
        once: true,
      });
      const root = document.querySelector('[data-screen]')!;
      new MutationObserver(() => {
        if (root.getAttribute('data-screen') === 'profiles' && !w.__profilesAt) w.__profilesAt = performance.now();
      }).observe(root, { attributes: true, attributeFilter: ['data-screen'] });
    });
    await tap(page);
    await expect(whoIsWatching(page)).toBeFocused({ timeout: 6000 });
    const elapsed = await page.evaluate(() => {
      const w = window as unknown as { __tapAt: number; __profilesAt: number };
      return w.__profilesAt - w.__tapAt;
    });
    // The intro hands over at 3.4 s from the tap (800 ms reduced) so the profiles commit lands by 3.5 s; the bound
    // keeps one more frame of slack for a loaded CI machine.
    expect(elapsed).toBeLessThanOrEqual(info.project.name === 'reduced-motion' ? 900 : 3600);
  });

  test('W1 a keypress at 200 ms shows the profiles immediately', async ({ page }) => {
    await page.goto('/');
    await tap(page);
    await page.waitForTimeout(200);
    await page.keyboard.press('KeyA');
    await expect(whoIsWatching(page)).toBeVisible({ timeout: 700 });
  });

  test('W3 blocked, missing and muted audio all complete the intro @smoke', async ({ browser }) => {
    const variants: [string, (page: Page) => Promise<unknown>][] = [
      [
        'blocked',
        (page) =>
          page.addInitScript(() => {
            const blocked = function () {
              throw new DOMException('blocked', 'NotAllowedError');
            };
            Object.assign(window, { AudioContext: blocked, webkitAudioContext: blocked });
          }),
      ],
      ['missing', (page) => page.route('**/*.mp3', (route) => route.fulfill({ status: 404 }))],
      [
        'muted',
        (page) =>
          page.addInitScript(() =>
            localStorage.setItem(
              'pf.prefs.v1',
              JSON.stringify({ state: { sound: { enabled: false, volume: 0.8, ui: false } }, version: 1 }),
            ),
          ),
      ],
    ];
    for (const [name, arrange] of variants) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await arrange(page);
      await page.goto('/');
      await tap(page);
      await expect(whoIsWatching(page), name).toBeFocused({ timeout: 6000 });
      expect(errors, name).toEqual([]);
      await context.close();
    }
  });

  test('W3 the muted preference survives a reload', async ({ page }) => {
    await page.goto('/');
    const sound = page.getByRole('button', { name: 'Sound' });
    await sound.click();
    await expect(sound).toHaveAttribute('aria-pressed', 'false');
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('pf.prefs.v1') ?? '{}').state?.sound?.enabled))
      .toBe(false);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Sound' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('W1 each of the five profiles runs the identical transition to the chooser @smoke', async ({ browser }) => {
    test.slow(); // five full journeys, each in a fresh context
    const traces: string[] = [];
    for (const persona of PERSONAS) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await toProfiles(page);
      await page.evaluate(() => {
        const trace: string[] = [];
        (window as unknown as { __trace: string[] }).__trace = trace;
        const root = document.querySelector('[data-screen]')!;
        new MutationObserver(() => trace.push(`screen:${root.getAttribute('data-screen')}`)).observe(root, {
          attributes: true,
          attributeFilter: ['data-screen'],
        });
        new MutationObserver(() => {
          if (document.querySelector('[data-chooser-card]') && !trace.includes('chooser')) trace.push('chooser');
        }).observe(document.body, { childList: true, subtree: true });
      });
      await page.getByRole('button', { name: persona }).click();
      await expect(chooserHeading(page)).toBeFocused();
      const state = await page.evaluate(() => ({
        trace: (window as unknown as { __trace: string[] }).__trace,
        url: location.pathname,
        cards: [...document.querySelectorAll('[data-chooser-card]')].map((a) => a.getAttribute('href')),
        recommendationBadge: document.body.textContent?.includes('Suits your device') ?? false,
      }));
      traces.push(JSON.stringify(state));
      // Preferences reach storage through the debounced safe writer, a moment after the pick.
      await expect
        .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('pf.prefs.v1') ?? '{}').state))
        .toMatchObject({ persona: persona.toLowerCase(), introSeen: true });
      await context.close();
    }
    expect(new Set(traces).size, traces.join('\n')).toBe(1);
  });

  test('W1 no blank frame between the profiles and the chooser', async ({ page }) => {
    await toProfiles(page);
    await waitForSettled(page, '[data-profile]'); // past the intro → profiles crossfade
    // Every frame, something is painted over the stage: the profiles screen or the chooser (a flying avatar sits on
    // top of either). Computed visibility + opacity, not hit-testing: the page layer turns inert while it is covered.
    await page.evaluate(() => {
      const frames: string[] = [];
      (window as unknown as { __frames: string[] }).__frames = frames;
      const shown = (el: Element | null) => {
        if (!el) return false;
        const style = getComputedStyle(el);
        return style.visibility === 'visible' && Number(style.opacity) > 0.01;
      };
      const profiles = document.querySelector('[aria-labelledby="profiles-heading"]');
      const sample = () => {
        const chooser = document.querySelector('[data-chooser-card]')?.closest('[style*="--viewport-aspect"]') ?? null;
        // The chooser covers the profiles screen, which stays painted beneath it: check the top layer first.
        frames.push(shown(chooser) ? 'chooser' : shown(profiles) ? 'profiles' : 'blank');
        // Until the chooser has been on screen for a few frames (or 6 s, whichever first).
        if (frames.filter((frame) => frame === 'chooser').length < 5 && frames.length < 400)
          requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await page.getByRole('button', { name: 'Recruiter' }).click();
    await expect(chooserHeading(page)).toBeVisible();
    await page.waitForFunction(
      () => {
        const frames = (window as unknown as { __frames: string[] }).__frames;
        return frames.filter((frame) => frame === 'chooser').length >= 5 || frames.length >= 400;
      },
      null,
      { timeout: 15_000 },
    );
    const frames = await page.evaluate(() => (window as unknown as { __frames: string[] }).__frames);
    expect(frames.filter((frame) => frame === 'blank')).toEqual([]);
    expect(frames).toContain('chooser');
  });

  test('W1 second visit lands on the profiles, last one marked, no auto-advance', async ({ page }) => {
    await toChooser(page, 'Designer');
    await page.goto('/');
    await expect(whoIsWatching(page)).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Jaswanth — / })).toBeHidden();
    const designer = page.getByRole('button', { name: /Designer/ });
    await expect(designer).toHaveAttribute('aria-pressed', 'true');
    await expect(designer.getByText('Last time')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Guest/ })).toHaveAttribute('aria-pressed', 'false');
    // Returning visitors skip Hello, so the replay mark and Sound are theirs here (a first visit shows neither).
    await expect(page.getByRole('button', { name: 'Replay intro' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sound' })).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(whoIsWatching(page)).toBeVisible(); // still here: the visitor must choose
  });

  test('R1 reduced motion: the intro fades without zooming', async ({ page }, info) => {
    test.skip(info.project.name !== 'reduced-motion', 'reduced-motion project');
    await page.goto('/');
    await tap(page);
    const scales: number[] = [];
    for (let i = 0; i < 6; i++) {
      scales.push(
        await page.locator('[data-intro] [data-wordmark]').evaluate((el) => {
          const transform = getComputedStyle(el).transform;
          return transform === 'none' ? 1 : new DOMMatrixReadOnly(transform).a;
        }),
      );
      await page.waitForTimeout(100);
    }
    expect(new Set(scales)).toEqual(new Set([1]));
    await expect(whoIsWatching(page)).toBeFocused({ timeout: 2000 });
  });

  test('NFLX-CARD-01 profile layout at 1440 and 390 px, with hover and focus states', async ({ page }, info) => {
    test.skip(
      Boolean(info.project.use.isMobile),
      'desktop and phone widths are both set here; phones emulate their own',
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await toProfiles(page);
    const boxes = async () => {
      const cards = page.locator('[data-profile]');
      return Promise.all((await cards.all()).map((card) => card.boundingBox()));
    };
    await waitForSettled(page, '[data-profile]');
    const wide = (await boxes()).map((b) => b!);
    expect(new Set(wide.map((b) => Math.round(b.y))).size, 'one row on desktop').toBe(1);
    await page.keyboard.press('Tab'); // keyboard focus, so :focus-visible applies
    await expect(page.getByRole('button', { name: /^Recruiter/ })).toBeFocused();
    // The white border fades in (200 ms border-color transition): wait for its end state.
    await expect
      .poll(() =>
        page.locator('[data-profile="recruiter"] [data-avatar]').evaluate((el) => getComputedStyle(el).borderTopColor),
      )
      .toBe('rgb(255, 255, 255)');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()); // focus lifts a card
    await page.mouse.move(0, 0);
    await page.setViewportSize({ width: 390, height: 844 });
    // Two per row once the blurred card's focus lift has settled back (a transform transition).
    await expect
      .poll(async () => {
        const [first, second] = await boxes();
        return Math.abs(first!.y - second!.y) < 0.5;
      })
      .toBe(true);
    const narrow = (await boxes()).map((b) => b!);
    expect(narrow[2]!.y).toBeGreaterThan(narrow[0]!.y);
    const fifth = narrow[4]!;
    expect(Math.abs(fifth.x + fifth.width / 2 - 195)).toBeLessThan(4); // centred on its own row
    const [overflowX, overflowY] = await page.evaluate(() => [
      document.documentElement.scrollWidth - innerWidth,
      document.documentElement.scrollHeight - innerHeight,
    ]);
    expect(overflowX).toBeLessThanOrEqual(0);
    expect(overflowY).toBeLessThanOrEqual(0);
  });
});

test.describe('accessibility and résumé reach', () => {
  const axe = (page: Page) =>
    new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();

  test('X1 axe finds nothing on Hello, the profiles and the chooser', async ({ page }) => {
    test.slow(); // three full axe scans
    await page.goto('/');
    expect((await axe(page)).violations).toEqual([]);
    await tap(page);
    await skipIntro(page);
    await expect(whoIsWatching(page)).toBeFocused();
    await waitForSettled(page, '[data-profile]');
    expect((await axe(page)).violations).toEqual([]);
    await page.getByRole('button', { name: 'Adventurer' }).click();
    await expect(chooserHeading(page)).toBeFocused();
    await waitForSettled(page, '[data-chooser-card]');
    expect((await axe(page)).violations).toEqual([]);
  });

  test('X1 keyboard only: Hello → intro → profile → chooser → an OS', async ({ page }, info) => {
    test.skip(webkitTouch(info.project.name), 'WebKit Tab skips buttons and links unless Option is held');
    await page.goto('/');
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      if (await page.getByRole('button', { name: 'Tap to begin' }).evaluate((el) => el === document.activeElement))
        break;
    }
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Skip intro' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(whoIsWatching(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: /^Recruiter/ })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('button', { name: /^Developer/ })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(chooserHeading(page)).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-os-shell]')).toBeAttached();
    // The first card is iOS: its Lock Screen shows on a chooser entry (IOS-LOCK-02), "Open iOS" focused; Enter unlocks.
    await expect(page.getByRole('button', { name: 'Open iOS' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: /About$/ })).toBeFocused();
    await expectFocusNotOnBody(page);
  });

  test('RES-PRE-01 the résumé link is present and keyboard reachable on Hello, the profiles and the chooser', async ({
    page,
  }) => {
    const reachable = async (scope: string) => {
      const link = page.locator(`${scope} a[href="/go/resume"]`).filter({ visible: true }).first();
      await expect(link, scope).toBeVisible();
      await link.focus();
      await expect(link, scope).toBeFocused();
    };
    await page.goto('/');
    await reachable('[data-welcome-bar]');
    await toProfiles(page);
    await reachable('[data-profiles-fade]');
    await page.getByRole('button', { name: /^Guest/ }).click();
    await expect(chooserHeading(page)).toBeVisible();
    await reachable('[data-chooser-fade="footer"]');
  });
});
