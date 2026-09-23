/**
 * iOS — P5 system surfaces (plans/ios/01-identity.md, plans/ios/surfaces/*.md): icon boxes across asset modes, theme
 * parity, boot, Control Center, the Dock, folders, banners and Notification Center, quick actions, Spotlight's layouts,
 * the status bar variants and the widget flight. Every step waits on an end state (never a sleep for correctness; a
 * held press is the gesture itself) and focus never rests on <body>. With `pf.debug.probe` set, each app surface reports
 * where it is drawn (`data-visual`), so a flight's first frame and its landing can be compared with the origin's rect.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { expectFocusNotOnBody, skipIntro, waitForOs, waitForSettled } from './helpers';

type Box = { x: number; y: number; w: number; h: number };

const PORT = Number(process.env.E2E_PORT ?? 3000);
const OFFICIAL = process.env.TEST_BASE_URL ?? `http://localhost:${PORT}`;
const ORIGINAL = process.env.TEST_BASE_URL_ORIGINAL ?? `http://localhost:${PORT + 1}`;

const PHONE = ['iphone', 'pixel', 'iphone-landscape'];
const PAD = ['ipad-portrait', 'ipad-landscape'];
/** Projects where iOS is the badged OS on the chooser, so its chunk is warmed at idle before any click. */
const IOS_PREFETCHED = ['iphone', 'pixel', 'iphone-landscape'];
const motionOnly = (info: TestInfo) => test.skip(info.project.name === 'reduced-motion', 'flights (full motion)');

const grid = (page: Page) => page.getByRole('group', { name: 'Home Screen' });
const dock = (page: Page) => page.getByRole('navigation', { name: 'Dock' });
const surface = (page: Page, role: string) => page.locator(`[data-app-surface="${role}"]`);
const boxOf = (locator: Locator): Promise<Box> =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
const visualOf = async (locator: Locator): Promise<Box | null> => {
  const raw = await locator.getAttribute('data-visual');
  if (!raw) return null;
  const [x, y, w, h] = raw.split(',').map(Number) as [number, number, number, number];
  return { x, y, w, h };
};
const parseBox = (raw: string | null | undefined): Box | null => {
  if (!raw) return null;
  const [x, y, w, h] = raw.split(',').map(Number) as [number, number, number, number];
  return { x, y, w, h };
};
function expectNear(actual: Box | null, expected: Box, label: string, tolerance = 2) {
  expect(actual, `${label}: no probe`).not.toBeNull();
  for (const key of ['x', 'y', 'w', 'h'] as const)
    expect(
      Math.abs(actual![key] - expected[key]),
      `${label} ${key}: ${JSON.stringify(actual)} vs ${JSON.stringify(expected)}`,
    ).toBeLessThanOrEqual(tolerance);
}

/** No surface is flying and no finite animation is running. */
async function settle(page: Page) {
  await page.waitForFunction(() => {
    if (document.querySelector('[data-app-surface][data-state="opening"],[data-app-surface][data-state="closing"]'))
      return false;
    return document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== 'running' || animation.effect?.getComputedTiming().iterations === Infinity,
      );
  });
}

async function openIos(page: Page, path = '/ios') {
  await page.goto(path);
  await waitForOs(page, 'ios');
  await settle(page);
}

async function toChooser(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tap to begin' }).click();
  await skipIntro(page);
  await page.getByRole('button', { name: /^Guest/ }).click();
  await expect(page.getByRole('heading', { name: 'Choose how you want to explore' })).toBeFocused();
  await waitForSettled(page, '[data-chooser-card]');
}

/**
 * Records, per app surface, the first `data-visual` it reports — i.e. the flight's first frame. A MutationObserver
 * callback runs in a microtask after the task that launched the app, before any animation frame.
 */
async function recordFirstVisuals(page: Page) {
  await page.evaluate(() => {
    const seen: Record<string, string> = {};
    (window as unknown as { __firstVisual: Record<string, string> }).__firstVisual = seen;
    const scan = () => {
      for (const el of document.querySelectorAll<HTMLElement>('[data-app-surface][data-visual]')) {
        const role = el.dataset.appSurface!;
        if (!(role in seen)) seen[role] = el.dataset.visual!;
      }
    };
    new MutationObserver(scan).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-visual'],
    });
  });
}
const firstVisual = async (page: Page, role: string) =>
  parseBox(
    await page.evaluate(
      (r) => (window as unknown as { __firstVisual?: Record<string, string> }).__firstVisual?.[r] ?? null,
      role,
    ),
  );

/** A held press: the gesture itself (500 ms long-press threshold), not a wait for an end state. */
async function longPress(page: Page, target: Locator, holdMs = 750) {
  const b = await boxOf(target);
  await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2);
  await page.mouse.down();
  await page.waitForTimeout(holdMs);
  await page.mouse.up();
}

const menuItems = (menu: Locator) =>
  menu.getByRole('menuitem').evaluateAll((els) => els.map((el) => (el.textContent ?? '').trim()));

/** Download Résumé from the Dock's Files quick actions (keyboard invocation): raises the "Résumé.pdf saved" banner. */
async function downloadResumeFromDock(page: Page) {
  const files = dock(page).getByRole('link', { name: 'Files, Résumé' });
  await files.focus();
  await page.keyboard.press('Shift+F10');
  const menu = page.getByRole('menu', { name: 'Files actions' });
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: /Download Résumé/ }).click();
  await expect(menu).toHaveCount(0);
}

test.beforeEach(async ({ page }, info) => {
  if (['chromium-desktop', 'reduced-motion', 'asset-original'].includes(info.project.name))
    await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    window.sessionStorage.setItem('pf.debug.probe', '1');
    window.sessionStorage.setItem('pf.debug.analytics', '1');
  });
});

// --- Identity ---------------------------------------------------------------------------------------------------------

test('IOS-ID-02 DS-ICONBOX-01 on iOS: icon boxes and the squircle mask are identical in both asset modes', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'chromium-desktop', 'compares the two production builds once');
  const measure = async (base: string, viewport: { width: number; height: number }) => {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() => window.sessionStorage.setItem('pf.debug.probe', '1'));
    const page = await context.newPage();
    await page.goto(`${base}/ios`);
    await waitForOs(page, 'ios');
    await settle(page);
    // Layout boxes: the squircle that holds the artwork, and the artwork's own laid-out size. (A visual-only
    // transform inside the mask — Settings' official artwork is cropped with scale(1.26) — moves no layout.)
    const boxes = await page.locator('.os-root [data-asset]').evaluateAll((nodes) =>
      nodes.map((node) => {
        const holder = node.closest('[data-art]') ?? node;
        const rect = holder.getBoundingClientRect();
        const css = getComputedStyle(node);
        return {
          id: node.getAttribute('data-asset'),
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          layout: `${Math.round(parseFloat(css.width))}x${Math.round(parseFloat(css.height))}`,
        };
      }),
    );
    const masks = await page.locator('.os-root [data-art]').evaluateAll((nodes) =>
      nodes.map((node) => {
        const css = getComputedStyle(node);
        const mask = css.maskImage || (css as unknown as { webkitMaskImage?: string }).webkitMaskImage || '';
        const rect = node.getBoundingClientRect();
        return `${Math.round(rect.width)}x${Math.round(rect.height)} ${mask.slice(0, 80)}`;
      }),
    );
    const modes = await page
      .locator('.os-root [data-asset]')
      .evaluateAll((nodes) => [...new Set(nodes.map((node) => node.getAttribute('data-asset-mode')))]);
    await context.close();
    return { boxes, masks, modes };
  };
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const official = await measure(OFFICIAL, viewport);
    const original = await measure(ORIGINAL, viewport);
    expect(official.boxes.length).toBeGreaterThan(0);
    expect(official.modes).toEqual(['official']);
    expect(original.modes).toEqual(['original']);
    expect(original.boxes, `${viewport.width}×${viewport.height}`).toEqual(official.boxes);
    expect(original.masks).toEqual(official.masks);
    expect(official.masks.every((mask) => /url\(|svg/i.test(mask))).toBe(true);
  }
});

test('IOS-ID-06 visual snapshots both themes: Home, an app and Control Center in light and dark, contrast clean', async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  const contrast = async (label: string) => {
    await settle(page);
    const { violations } = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    expect(violations.map((v) => `${label}: ${v.id} ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
    await info.attach(`${label}.png`, { body: await page.screenshot(), contentType: 'image/png' });
  };
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await openIos(page);
    const root = page.locator('[data-os-chunk="pf-os-chunk:ios"]');
    if (scheme === 'dark') await expect(root).toHaveAttribute('data-ios-dark', /.*/);
    else await expect(root).not.toHaveAttribute('data-ios-dark', /.*/);
    await contrast(`home-${scheme}`);
    await grid(page).getByRole('link', { name: 'Settings' }).click();
    await settle(page);
    await expect(surface(page, 'settings')).toHaveAttribute('data-state', 'foreground');
    await contrast(`settings-${scheme}`);
    await page.keyboard.press('Alt+Shift+H');
    await settle(page);
    await page.getByRole('button', { name: 'Control Center' }).click();
    await expect(page.getByRole('dialog', { name: 'Control Center' })).toBeVisible();
    await expect(
      page.getByRole('dialog', { name: 'Control Center' }).getByRole('button', { name: 'Dark Mode' }),
    ).toHaveAttribute('aria-pressed', scheme === 'dark' ? 'true' : 'false');
    await contrast(`control-center-${scheme}`);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Control Center' })).toHaveCount(0);
  }
});

// --- Boot -------------------------------------------------------------------------------------------------------------

test('IOS-BOOT-03 keypress skips: a slow first entry shows the logo, then "Still starting…" + the plain link; a key ends it once mounted', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'reduced-motion', 'no boot under reduced motion (IOS-BOOT-04)');
  test.skip(
    IOS_PREFETCHED.includes(info.project.name),
    'iOS is the badged OS here: its chunk is warmed before the click',
  );
  test.setTimeout(90_000);
  await toChooser(page);
  // Hold every new script chunk 6 s: the iOS chunk is still loading well past the 150 ms boot delay and the 4 s slow
  // mark. (Only scripts: WebKit defers starting CSS animations while a stylesheet is pending — see the report.)
  let hold = true;
  const script = (url: URL) => url.pathname.startsWith('/_next/static/chunks/') && url.pathname.endsWith('.js');
  await page.route(script, async (route) => {
    if (hold) await new Promise((resolve) => setTimeout(resolve, 6000));
    await route.continue().catch(() => undefined);
  });
  await page.locator('[data-chooser-card="ios"]').click();
  const boot = page.locator('[data-boot="ios"]').first();
  await expect(boot).toBeAttached({ timeout: 5000 });
  await expect(boot).toHaveAttribute('aria-hidden', 'true');
  // The slow state: grey "Still starting…" with a plain-portfolio link fades in after 4 s.
  const slow = boot.getByText(/Still starting/);
  await expect(slow).toBeAttached();
  await expect(boot.locator('a[href="/plain"]')).toHaveText('Open the plain portfolio');
  await expect.poll(() => slow.evaluate((el) => Number(getComputedStyle(el).opacity)), { timeout: 8000 }).toBe(1);
  // Any key skips the held beats; it neither cancels the entry nor leaks into the OS.
  await page.keyboard.press('Shift');
  hold = false;
  await waitForOs(page, 'ios');
  await expect(page.locator('[data-boot]')).toHaveCount(0, { timeout: 5000 });
  await expect(page).toHaveURL(/\/ios$/);
  await expect(page.getByRole('button', { name: 'Open iOS' })).toBeFocused();
  await expectFocusNotOnBody(page);
});

test('IOS-BOOT-03 offline → Retry + plain link on the iOS card; it recovers online', async ({
  page,
  context,
}, info) => {
  test.skip(
    IOS_PREFETCHED.includes(info.project.name),
    'iOS is the badged OS here: its chunk is warmed before the click',
  );
  test.skip(info.project.name === 'firefox-desktop', 'Firefox emulation does not fire the online event');
  await toChooser(page);
  await context.setOffline(true);
  await page.locator('[data-chooser-card="ios"]').click();
  const alert = page.getByRole('alert').filter({ hasText: 'Couldn’t load iOS' });
  await expect(alert).toBeVisible({ timeout: 10_000 });
  await expect(alert.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(alert.getByRole('link', { name: 'Plain portfolio' })).toHaveAttribute('href', '/plain');
  await expect(page.locator('[data-boot]')).toHaveCount(0);
  await context.setOffline(false);
  await expect(page.locator('[data-os-shell="ios"]')).toBeAttached({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/ios$/);
});

test('IOS-BOOT-04 R1: reduced motion removes the boot and the arrival fly-in', async ({ page }, info) => {
  test.skip(info.project.name !== 'reduced-motion', 'the reduced-motion project');
  await toChooser(page);
  await page.evaluate(() => {
    const w = window as unknown as { __bootSeen: boolean };
    w.__bootSeen = false;
    new MutationObserver(() => {
      if (document.querySelector('[data-boot]')) w.__bootSeen = true;
    }).observe(document.body, { subtree: true, childList: true });
  });
  // A slow chunk that would show the boot at full motion.
  await page.route('**/_next/static/chunks/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue().catch(() => undefined);
  });
  await page.locator('[data-chooser-card="ios"]').click();
  await waitForOs(page, 'ios');
  const open = page.getByRole('button', { name: 'Open iOS' });
  await expect(open).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-lock]')).toHaveCount(0);
  // Straight after the unlock: no icon, widget or Dock is animating in.
  const arriving = await page.evaluate(
    () =>
      [...document.querySelectorAll('[data-page="0"] [data-cell], [data-widget], [data-dock]')].filter(
        (el) => el.getAnimations().length > 0,
      ).length,
  );
  expect(arriving).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __bootSeen: boolean }).__bootSeen)).toBe(false);
  const long = await page.evaluate(
    () =>
      document.getAnimations().filter((a) => {
        const timing = a.effect?.getComputedTiming();
        return typeof timing?.duration === 'number' && timing.duration > 200 && timing.iterations !== Infinity;
      }).length,
  );
  expect(long).toBe(0);
  await expectFocusNotOnBody(page);
});

// --- Control Center ------------------------------------------------------------------------------------------------------

test('IOS-CC-03 open by drag, click and keyboard; close by backdrop, Esc, Home and swipe up', async ({ page }) => {
  await openIos(page);
  const control = page.locator('#ios-status-control');
  const cc = page.getByRole('dialog', { name: 'Control Center' });
  const closed = async () => {
    await expect(page.locator('[data-control-center]')).toHaveCount(0);
    await expectFocusNotOnBody(page);
  };
  // 1. Click the zone; Esc closes and focus returns to it.
  await control.click();
  await expect(cc).toBeVisible();
  await expect(cc.getByRole('button', { name: 'Sound', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await closed();
  await expect(control).toBeFocused();
  // 2. Keyboard: the status-bar button with Enter; the Home shortcut closes it.
  await control.focus();
  await page.keyboard.press('Enter');
  await expect(cc).toBeVisible();
  await expect(control).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Alt+Shift+H');
  await closed();
  // 3. Drag: pull down from the status bar's right zone; a long pull stays open.
  const zone = await boxOf(control);
  const x = zone.x + zone.w / 2;
  const y = zone.y + zone.h / 2;
  const pullOpen = async () => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 120, { steps: 6 });
    await expect(page.locator('[data-control-center]')).toBeAttached();
    await page.mouse.move(x, y + 260, { steps: 6 });
    await page.mouse.up();
    await expect(cc).toBeVisible();
    await settle(page);
    await expect(cc).toBeVisible();
  };
  await pullOpen();
  // Backdrop tap closes (a corner away from the panel).
  const view = page.viewportSize()!;
  await page.mouse.click(12, view.height - 12);
  await closed();
  // A short, slow pull springs back closed (its projected end stays short of the open threshold). The pauses are the
  // gesture's own pace, not waits for a state.
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 6; step++) {
    await page.mouse.move(x, y + step * 5);
    await page.waitForTimeout(60);
  }
  await page.mouse.up();
  await closed();
  // 4. Swipe up on the panel closes it (plans/ios/surfaces/control-center "Close").
  await pullOpen();
  const panel = await boxOf(cc);
  const px = panel.x + panel.w / 2;
  const py = panel.y + panel.h - 8;
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.move(px, py - 260, { steps: 5 });
  await page.mouse.up();
  await closed();
});

test('IOS-CC-04 Sound expands both ways: long-press and the More button', async ({ page }) => {
  await openIos(page);
  await page.getByRole('button', { name: 'Control Center' }).click();
  const cc = page.getByRole('dialog', { name: 'Control Center' });
  await expect(cc).toBeVisible();
  await settle(page);
  const sound = cc.getByRole('button', { name: 'Sound', exact: true });
  const more = cc.getByRole('button', { name: 'More sound controls' });
  const expansion = page.locator('#ios-cc-sound-more');
  const pressed = await sound.getAttribute('aria-pressed');
  // Long-press → the module expands (volume slider + Play intro sound); the press does not toggle Sound.
  await longPress(page, sound);
  await expect(expansion).toBeVisible();
  await expect(expansion.getByRole('slider', { name: 'Volume' })).toHaveAttribute('aria-valuetext', /^Volume \d+ %$/);
  await expect(expansion.getByRole('button', { name: 'Play intro sound' })).toBeVisible();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  expect(await sound.getAttribute('aria-pressed')).toBe(pressed);
  // Esc collapses the expansion first; Control Center stays. (A keyboard user is on the module; WebKit does not focus
  // a button on pointer press, so focus is placed there as the keyboard would.)
  await sound.focus();
  await page.keyboard.press('Escape');
  await expect(expansion).toHaveCount(0);
  await expect(cc).toBeVisible();
  // The More button: the non-gesture alternative, both ways.
  await more.click();
  await expect(expansion).toBeVisible();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await more.click();
  await expect(expansion).toHaveCount(0);
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  expect(await sound.getAttribute('aria-pressed')).toBe(pressed);
});

// --- Dock -------------------------------------------------------------------------------------------------------------------

test('IOS-DOCK-03 I1 from the Dock: the flight starts at the Dock icon and returns into it', async ({ page }, info) => {
  motionOnly(info);
  await openIos(page);
  const icon = dock(page).getByRole('link', { name: 'Safari' });
  const result = await page.evaluate(async () => {
    const link = document.getElementById('ios-icon-dock:browser') as HTMLAnchorElement;
    const art = link.querySelector('[data-art]')!.getBoundingClientRect();
    link.click();
    await Promise.resolve();
    const section = document.querySelector<HTMLElement>('[data-app-surface="browser"]');
    return {
      visual: section?.dataset.visual ?? '',
      art: [art.x, art.y, art.width, art.height].map(Math.round).join(','),
    };
  });
  expectNear(parseBox(result.visual), parseBox(result.art)!, 'first frame');
  await settle(page);
  await expect(page).toHaveURL(/\/ios\/safari$/);
  await expect(surface(page, 'browser')).toHaveAttribute('data-state', 'foreground');
  await page.locator('[data-home-indicator]').click();
  await settle(page);
  await expect(page).toHaveURL(/\/ios$/);
  expectNear(await visualOf(surface(page, 'browser')), await boxOf(icon.locator('[data-art]')), 'landing');
  await expect(icon).toBeFocused();
});

test('IOS-DOCK-04 iphone-landscape: the Dock is a vertical plate on the trailing edge', async ({ page }, info) => {
  test.skip(info.project.name !== 'iphone-landscape', 'phone landscape');
  await openIos(page);
  const nav = page.locator('[data-dock]');
  await expect(nav).toHaveAttribute('data-edge', 'trailing');
  const view = page.viewportSize()!;
  const plate = await boxOf(nav);
  expect(plate.h).toBeGreaterThan(plate.w);
  expect(view.width - (plate.x + plate.w)).toBeLessThanOrEqual(60);
  expect(plate.x).toBeGreaterThan(view.width / 2);
  const icons = await dock(page)
    .getByRole('link')
    .evaluateAll((els) => els.map((el) => el.querySelector('[data-art]')!.getBoundingClientRect()));
  expect(icons).toHaveLength(4);
  for (let i = 1; i < icons.length; i++) {
    expect(icons[i]!.y).toBeGreaterThan(icons[i - 1]!.y + icons[i - 1]!.height - 1);
    expect(Math.abs(icons[i]!.x - icons[0]!.x)).toBeLessThanOrEqual(1);
  }
  // Roving follows the axis: Down moves along the plate.
  await dock(page).getByRole('link', { name: 'Files, Résumé' }).focus();
  await page.keyboard.press('ArrowDown');
  await expect(dock(page).getByRole('link', { name: 'Safari' })).toBeFocused();
});

test('IOS-DOCK-04 ipad: a floating Dock centred at the bottom, a divider and up to three recent apps', async ({
  page,
}, info) => {
  test.skip(![...PAD, 'chromium-desktop'].includes(info.project.name), 'pad / full-page layout');
  await openIos(page);
  const nav = page.locator('[data-dock]');
  await expect(nav).toHaveAttribute('data-layout', 'pad');
  const view = page.viewportSize()!;
  const plate = await boxOf(nav);
  expect(Math.abs(plate.x + plate.w / 2 - view.width / 2)).toBeLessThanOrEqual(2);
  expect(plate.w).toBeLessThan(view.width * 0.8);
  expect(view.height - (plate.y + plate.h)).toBeLessThan(view.height * 0.12);
  // No recents yet → no divider.
  await expect(nav.locator('li[aria-hidden="true"]')).toHaveCount(0);
  for (const name of ['Notes', 'Messages']) {
    await grid(page).getByRole('link', { name }).click();
    await settle(page);
    await page.keyboard.press('Alt+Shift+H');
    await settle(page);
  }
  await expect(nav.locator('li[aria-hidden="true"]')).toHaveCount(1);
  const ids = await dock(page)
    .getByRole('link')
    .evaluateAll((els) => els.map((el) => el.id));
  expect(ids).toEqual([
    'ios-icon-dock:files',
    'ios-icon-dock:browser',
    'ios-icon-dock:github',
    'ios-icon-dock:mail',
    'ios-icon-recent:messages',
    'ios-icon-recent:notes',
  ]);
  const wider = await boxOf(nav);
  expect(wider.w).toBeGreaterThan(plate.w);
  expect(Math.abs(wider.x + wider.w / 2 - view.width / 2)).toBeLessThanOrEqual(2);
  // A recent opens its app.
  await dock(page).getByRole('link', { name: 'Notes' }).click();
  await expect(page).toHaveURL(/\/ios\/notes/);
});

// --- Folders ------------------------------------------------------------------------------------------------------------

test('IOS-FOLD-02 I2 open from the folder icon over a blurred backdrop; close by tap-outside and Esc', async ({
  page,
}, info) => {
  await openIos(page);
  const button = grid(page).getByRole('button', { name: /^Career folder, \d+ shortcuts$/ });
  const folder = page.getByRole('dialog', { name: 'Career' });
  await expect(button).toHaveAttribute('aria-haspopup', 'dialog');
  const measured = await page.evaluate(async () => {
    const art = document.querySelector('#ios-icon-folder\\:career [data-folder-art]')!.getBoundingClientRect();
    (document.getElementById('ios-icon-folder:career') as HTMLElement).click();
    await Promise.resolve();
    // The panel as drawn in its first frame (its open animation already applied).
    const panel = document.querySelector<HTMLElement>('[data-folder-panel]')?.getBoundingClientRect();
    const box = (r: DOMRect | undefined) => (r ? { cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width } : null);
    return { icon: box(art)!, panel: box(panel) };
  });
  await expect(folder).toBeVisible();
  await expect(folder.getByRole('link').first()).toBeFocused();
  await expect(page.locator('[data-home-layer]')).not.toHaveAttribute('inert', /.*/); // Home stays behind, dimmed
  if (info.project.name !== 'reduced-motion') {
    // The panel's first frame is the folder icon's box: it expands from the icon.
    expect(measured.panel).not.toBeNull();
    expect(Math.abs(measured.panel!.w - measured.icon.w)).toBeLessThanOrEqual(2);
    expect(Math.abs(measured.panel!.cx - measured.icon.cx)).toBeLessThanOrEqual(2);
    expect(Math.abs(measured.panel!.cy - measured.icon.cy)).toBeLessThanOrEqual(2);
  }
  const blur = await page
    .locator('[data-folder-backdrop]')
    .evaluate(
      (el) => getComputedStyle(el).backdropFilter || getComputedStyle(el).getPropertyValue('-webkit-backdrop-filter'),
    );
  // Live glass only: forced colors / reduced transparency drop to a solid backdrop by design (PERF-BLUR-01).
  const solid = await page.evaluate(() => document.documentElement.dataset.glass === 'solid');
  if (solid) expect(blur).toBe('none');
  else expect(blur).toMatch(/blur\(/);
  await settle(page);
  // Tap outside the panel.
  const view = page.viewportSize()!;
  await page.mouse.click(8, view.height / 2);
  await expect(folder).toHaveCount(0);
  await expect(button).toBeFocused();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  // Esc.
  await page.keyboard.press('Enter');
  await expect(folder).toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(folder).toHaveCount(0);
  await expect(button).toBeFocused();
  expect(await page.evaluate(() => location.pathname)).toBe('/ios'); // no history for a folder
});

test('IOS-FOLD-03 I2 an item opens from its rect; the return flight lands on the item, then on the closed folder', async ({
  page,
}, info) => {
  motionOnly(info);
  await openIos(page);
  await recordFirstVisuals(page);
  await grid(page)
    .getByRole('button', { name: /^Career folder/ })
    .click();
  const folder = page.getByRole('dialog', { name: 'Career' });
  await expect(folder).toBeVisible();
  await settle(page);
  const item = folder.getByRole('link', { name: 'Experience' });
  const itemArt = await boxOf(item.locator('[data-art]'));
  await item.click();
  await expect(page).toHaveURL(/\/ios\/files\/experience$/);
  await settle(page);
  expectNear(await firstVisual(page, 'files'), itemArt, 'first frame = the folder item');
  // Home with the folder still open behind the app: it returns into that item.
  await page.keyboard.press('Alt+Shift+H');
  await settle(page);
  await page.mouse.move(page.viewportSize()!.width / 2, 1); // no hover on the measured item
  await settle(page);
  if (await folder.count()) {
    expectNear(
      await visualOf(surface(page, 'files')),
      await boxOf(item.locator('[data-art]')),
      'landing (open folder)',
    );
    await page.keyboard.press('Escape');
    await expect(folder).toHaveCount(0);
  }
  // With the folder closed, the same app returns into the folder icon.
  await page.keyboard.press('Alt+Shift+O');
  const switcher = page.getByRole('dialog', { name: 'App Switcher' });
  await switcher.getByRole('button', { name: 'Files', exact: true }).click();
  await settle(page);
  await expect(surface(page, 'files')).toHaveAttribute('data-state', 'foreground');
  await page.keyboard.press('Alt+Shift+H');
  await settle(page);
  const folderArt = await boxOf(page.locator('#ios-icon-folder\\:career [data-folder-art]'));
  expectNear(await visualOf(surface(page, 'files')), folderArt, 'landing (closed folder)');
  await expectFocusNotOnBody(page);
});

// --- Banners and Notification Center ------------------------------------------------------------------------------------

test('IOS-NOTIF-03 flight origin = banner: tapping a banner opens its app from the banner rect', async ({
  page,
}, info) => {
  motionOnly(info);
  await openIos(page);
  await downloadResumeFromDock(page);
  const banner = page.locator('[data-banner="resume-saved"]');
  await expect(banner).toBeVisible();
  await settle(page);
  const rect = await boxOf(banner);
  await recordFirstVisuals(page);
  await banner.getByText('Résumé.pdf saved', { exact: true }).click();
  await expect(page).toHaveURL(/\/ios\/files\/resume$/);
  await settle(page);
  expectNear(await firstVisual(page, 'files'), rect, 'first frame = the banner');
});

test('IOS-NOTIF-04 dismissed banner present in the Center; Clear per stack', async ({ page }) => {
  await openIos(page);
  // Two banners from two apps, each dismissed.
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  const offline = page.locator('[data-banner="offline"]');
  await expect(offline).toBeVisible();
  await offline.getByRole('button', { name: /^Dismiss: No connection/ }).click();
  await expect(offline).toHaveCount(0);
  await downloadResumeFromDock(page);
  const saved = page.locator('[data-banner="resume-saved"]');
  await expect(saved).toBeVisible();
  await saved.getByRole('button', { name: 'Dismiss: Résumé.pdf saved' }).click();
  await expect(saved).toHaveCount(0);
  // Both land in Notification Center, stacked by app.
  await page.getByRole('button', { name: 'Notification Center' }).click();
  const center = page.getByRole('dialog', { name: 'Notification Center' });
  await expect(center).toBeVisible();
  const files = center.getByRole('region', { name: 'Files' });
  const network = center.getByRole('region', { name: 'Network' });
  await expect(files).toContainText('Résumé.pdf saved');
  await expect(network).toContainText('No connection');
  // Clear one stack: only that app's notifications go.
  await files.getByRole('button', { name: 'Clear Files notifications' }).click();
  await expect(center.getByRole('region', { name: 'Files' })).toHaveCount(0);
  await expect(network).toContainText('No connection');
  // The pressed Clear button left with its stack: focus must stay inside the Center, never fall to <body>.
  await expectFocusNotOnBody(page);
  expect(await center.evaluate((el) => el.contains(document.activeElement))).toBe(true);
});

test('IOS-NOTIF-05 X1 with Center open: dialog semantics, axe clean, banners never steal focus', async ({ page }) => {
  await openIos(page);
  await expect(page.locator('[data-banner-region]')).toHaveAttribute('role', 'status');
  // A banner arriving leaves focus where it was.
  const pill = page.getByRole('button', { name: 'Search' });
  await pill.focus();
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.locator('[data-banner="offline"]')).toBeVisible();
  await expect(pill).toBeFocused();
  // The Center: a modal dialog with a heading and a Close button that takes focus.
  const zone = page.locator('#ios-status-center');
  await zone.focus();
  await page.keyboard.press('Enter');
  const center = page.getByRole('dialog', { name: 'Notification Center' });
  await expect(center).toBeVisible();
  await expect(center).toHaveAttribute('aria-modal', 'true');
  await expect(center.getByRole('heading', { name: 'Notification Center' })).toBeAttached();
  await expect(center.getByRole('button', { name: 'Close' })).toBeFocused();
  await expect(zone).toHaveAttribute('aria-expanded', 'true');
  // A banner raised while the Center is open waits (it never steals focus from the dialog).
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(center.getByRole('button', { name: 'Close' })).toBeFocused();
  await settle(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(violations.map((v) => `${v.id} ${v.nodes[0]?.target}`)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(center).toHaveCount(0);
  await expect(zone).toBeFocused();
});

// --- Quick actions ------------------------------------------------------------------------------------------------------

test('IOS-QA-02 long-press a project row → preview + actions', async ({ page }) => {
  await openIos(page, '/ios/github');
  const gh = surface(page, 'github');
  const row = gh
    .locator('[data-screen]:not([hidden]) a[data-push-key^="project:"], nav a[data-push-key^="project:"]')
    .first();
  await expect(row).toBeVisible();
  const slug = (await row.getAttribute('data-push-key'))!.slice('project:'.length);
  const url = page.url();
  const name = (await row.locator('[class*="repoName"]').first().textContent())!.trim();
  // Centre the row in its scroller (phone landscape: the tab bar would cover a row near the bottom).
  await row.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await longPress(page, row);
  const menu = page.getByRole('menu', { name: `${name} actions` });
  await expect(menu).toBeVisible();
  expect(await menuItems(menu)).toEqual(['Open', 'Copy link', 'Share']);
  const preview = page.locator('[data-quick-actions] [aria-hidden="true"]').filter({ hasText: name });
  await expect(preview).toBeVisible();
  expect(page.url()).toBe(url); // the long press did not also follow the link
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(row).toBeFocused();
  // Open runs the row's own action.
  await longPress(page, row);
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Open' }).click();
  await expect(page).toHaveURL(new RegExp(`/ios/github/${slug}$`));
});

test('IOS-QA-03 all four open the same menu: long-press, right-click, Shift+F10 / Menu key, visible ⋯', async ({
  page,
}) => {
  await openIos(page);
  const icon = grid(page).getByRole('link', { name: /^GitHub/ });
  const menu = page.getByRole('menu', { name: 'GitHub actions' });
  const close = async () => {
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(icon).toBeFocused();
  };
  // 1. Right-click.
  await icon.click({ button: 'right' });
  await expect(menu).toBeVisible();
  const expected = await menuItems(menu);
  expect(expected.length).toBeGreaterThan(1);
  expect(expected[expected.length - 1]).toBe('All Projects');
  await close();
  // 2. Long-press (last of the pointer paths: a contextmenu right after a long press is folded into it by design).
  await longPress(page, icon);
  await expect(menu).toBeVisible();
  expect(await menuItems(menu)).toEqual(expected);
  await expect(page).toHaveURL(/\/ios$/);
  await close();
  // 3. Keyboard: Shift+F10, then the Menu key.
  await icon.focus();
  await page.keyboard.press('Shift+F10');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem').first()).toBeFocused();
  expect(await menuItems(menu)).toEqual(expected);
  await close();
  await page.keyboard.press('ContextMenu');
  await expect(menu).toBeVisible();
  expect(await menuItems(menu)).toEqual(expected);
  await close();
  // 4. The visible ⋯ on the focused icon.
  await icon.focus();
  const more = grid(page).getByRole('button', { name: 'GitHub actions' });
  await expect.poll(() => more.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  await more.click();
  await expect(menu).toBeVisible();
  expect(await menuItems(menu)).toEqual(expected);
  await close();
});

test('IOS-QA-04 right-click in Notes text shows the browser menu (never prevented, no quick actions)', async ({
  page,
}) => {
  await openIos(page, '/ios/notes');
  const notes = surface(page, 'notes');
  await expect(surface(page, 'notes')).toHaveAttribute('data-state', 'foreground');
  const text = notes.locator('[data-screen]:not([hidden]) article').locator('h4, p, li').first();
  const row = (name: RegExp) =>
    notes
      .locator('[data-screen]:not([hidden]) a, [data-screen]:not([hidden]) button')
      .filter({ hasText: name })
      .first();
  // The phone opens on Folders (Notes → Skills); the full page already shows the note.
  await expect(text.or(row(/^Notes/))).toBeVisible();
  if (!(await text.isVisible())) {
    await row(/^Notes/).click();
    await settle(page);
    await row(/Skills/).click();
    await settle(page);
  }
  await expect(text).toBeVisible();
  await page.evaluate(() => {
    const events: MouseEvent[] = [];
    (window as unknown as { __ctx: MouseEvent[] }).__ctx = events;
    window.addEventListener('contextmenu', (event) => events.push(event), true);
  });
  const read = () =>
    page.evaluate(() =>
      (window as unknown as { __ctx: MouseEvent[] }).__ctx.map((event) => ({
        prevented: event.defaultPrevented,
        tag: (event.target as Element).tagName,
      })),
    );
  await text.click({ button: 'right' });
  await expect.poll(async () => (await read()).length).toBe(1);
  expect(await read()).toEqual([{ prevented: false, tag: expect.any(String) }]);
  await expect(page.locator('[data-quick-actions]')).toHaveCount(0);
  // A link inside the note keeps the native menu too.
  const link = notes.locator('[data-screen]:not([hidden]) article a[href]').first();
  if (await link.count()) {
    await link.click({ button: 'right' });
    await expect.poll(async () => (await read()).length).toBe(2);
    expect((await read())[1]!.prevented).toBe(false);
    await expect(page.locator('[data-quick-actions]')).toHaveCount(0);
  }
});

// --- Spotlight ------------------------------------------------------------------------------------------------------------

test('IOS-SPOT-05 iphone keyboard-up: the field and results stay above the keyboard (--vvh)', async ({
  page,
}, info) => {
  test.skip(!PHONE.includes(info.project.name), 'phone layout');
  await openIos(page);
  await page.getByRole('button', { name: 'Search' }).click();
  const dialog = page.getByRole('dialog', { name: 'Search' });
  const field = dialog.getByRole('combobox', { name: 'Search' });
  await expect(field).toBeFocused();
  await settle(page);
  // Bottom-anchored field (iOS 16+ placement).
  const view = page.viewportSize()!;
  const before = await boxOf(field);
  expect(before.y).toBeGreaterThan(view.height / 2);
  // The on-screen keyboard takes the lower part of the screen: the visual viewport shrinks.
  const visible = Math.round(view.height * 0.55);
  await page.evaluate((height) => {
    const vv = window.visualViewport!;
    Object.defineProperty(vv, 'height', { configurable: true, get: () => height });
    vv.dispatchEvent(new Event('resize'));
  }, visible);
  const root = page.locator('[data-os-chunk="pf-os-chunk:ios"]');
  await expect.poll(() => root.evaluate((el) => el.style.getPropertyValue('--vvh'))).toBe(`${visible}px`);
  await expect.poll(async () => (await boxOf(field)).y + (await boxOf(field)).h).toBeLessThanOrEqual(visible + 1);
  const list = dialog.getByRole('listbox');
  if (await list.count()) {
    const listBox = await boxOf(list);
    expect(listBox.y + listBox.h).toBeLessThanOrEqual((await boxOf(field)).y + 1);
    expect(listBox.y).toBeGreaterThanOrEqual(0);
  }
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
  const cancel = await boxOf(dialog.getByRole('button', { name: 'Cancel' }));
  expect(cancel.y + cancel.h).toBeLessThanOrEqual(visible + 1);
});

test('IOS-SPOT-05 ipad layout: the field sits at the top-centre, results below in a ≤ 640 px column', async ({
  page,
}, info) => {
  test.skip(![...PAD, 'chromium-desktop'].includes(info.project.name), 'pad / full-page layout');
  await openIos(page);
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Search' });
  const field = dialog.getByRole('combobox', { name: 'Search' });
  await expect(field).toBeFocused();
  await settle(page);
  const view = page.viewportSize()!;
  const box = await boxOf(field);
  expect(box.y).toBeLessThan(view.height * 0.25);
  const panel = await boxOf(page.locator('[data-spotlight] [role="dialog"]'));
  expect(panel.w).toBeLessThanOrEqual(640);
  expect(Math.abs(panel.x + panel.w / 2 - view.width / 2)).toBeLessThanOrEqual(2);
  await expect(dialog.getByRole('option').first()).toBeVisible();
  const option = await boxOf(dialog.getByRole('option').first());
  expect(option.y).toBeGreaterThanOrEqual(box.y + box.h);
  const cancel = await boxOf(dialog.getByRole('button', { name: 'Cancel' }));
  expect(cancel.y).toBeLessThan(view.height * 0.25);
});

// --- Status bar and Home indicator -------------------------------------------------------------------------------------

test('IOS-STAT-05 iphone-landscape: the bar hides; two corner handles keep Notification and Control Center', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'iphone-landscape', 'phone landscape');
  await openIos(page);
  const bar = page.getByRole('group', { name: 'Status bar' });
  await expect(bar.locator('[data-status-time]')).toHaveCount(0);
  await expect(bar.locator('time')).toHaveCount(0);
  const view = page.viewportSize()!;
  const left = await boxOf(bar.getByRole('button', { name: 'Notification Center' }));
  const right = await boxOf(bar.getByRole('button', { name: 'Control Center' }));
  expect(left.y).toBeLessThanOrEqual(2);
  expect(right.y).toBeLessThanOrEqual(2);
  expect(left.x).toBeLessThan(view.width * 0.2);
  expect(right.x + right.w).toBeGreaterThan(view.width * 0.8);
  expect(Math.min(left.w, left.h, right.w, right.h)).toBeGreaterThanOrEqual(44);
  const indicator = await boxOf(page.locator('[data-home-indicator]'));
  expect(indicator.y + indicator.h).toBeGreaterThanOrEqual(view.height - 2);
  await bar.getByRole('button', { name: 'Notification Center' }).click();
  await expect(page.getByRole('dialog', { name: 'Notification Center' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Notification Center' })).toHaveCount(0);
  await bar.getByRole('button', { name: 'Control Center' }).click();
  await expect(page.getByRole('dialog', { name: 'Control Center' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Control Center' })).toHaveCount(0);
});

test('IOS-STAT-05 ipad: a full-width bar with time and date; the Home indicator is clamp(134px, 12vw, 220px)', async ({
  page,
}, info) => {
  test.skip(!PAD.includes(info.project.name), 'ipad projects');
  await openIos(page);
  await expect(page.locator('[data-ios-layout="pad"]')).toBeAttached();
  const view = page.viewportSize()!;
  const barEl = page.locator('[data-status-bar]');
  const bar = await boxOf(barEl);
  expect(bar).toMatchObject({ x: 0, y: 0, w: view.width });
  expect(bar.h).toBeGreaterThan(14);
  expect(bar.h).toBeLessThan(44);
  await expect(barEl).toContainText(/\d{1,2}:\d{2}\s*\w{3} \d{1,2} \w{3}/);
  await expect(barEl).toContainText('80%');
  const pill = await boxOf(page.locator('[data-home-indicator] > span').first());
  const expected = Math.min(220, Math.max(134, view.width * 0.12));
  expect(Math.abs(pill.w - expected)).toBeLessThanOrEqual(1);
  expect(Math.abs(pill.x + pill.w / 2 - view.width / 2)).toBeLessThanOrEqual(2);
  await expect(page.locator('[data-home-indicator]')).toHaveAttribute('aria-label', 'Home');
});

// --- Widgets --------------------------------------------------------------------------------------------------------------

test('IOS-WIDG-03 I1 from the Résumé widget: the flight starts at the widget and returns into it', async ({
  page,
}, info) => {
  motionOnly(info);
  await openIos(page);
  const widget = page.locator('#ios-widget-resume');
  await expect(widget).toBeVisible();
  const rect = await boxOf(widget);
  await recordFirstVisuals(page);
  await widget.getByRole('link', { name: 'Résumé — open' }).click();
  await expect(page).toHaveURL(/\/ios\/files\/resume$/);
  await settle(page);
  expectNear(await firstVisual(page, 'files'), rect, 'first frame = the widget');
  await page.keyboard.press('Alt+Shift+H');
  await settle(page);
  await expect(page).toHaveURL(/\/ios\/files$|\/ios$/);
  if (!/\/ios$/.test(page.url())) {
    // Quick Look's Done is one level; Home again goes Home.
    await page.keyboard.press('Alt+Shift+H');
    await settle(page);
  }
  await expect(page).toHaveURL(/\/ios$/);
  // Home is back at rest (no leftover scale), so the widget sits where it was before the launch.
  await expect
    .poll(() => page.locator('[data-home-layer]').evaluate((el) => (el as HTMLElement).style.transform), {
      message: 'Home layer transform after the return flight',
    })
    .toBe('');
  expectNear(await boxOf(widget), rect, 'widget at rest');
  expectNear(await visualOf(surface(page, 'files')), await boxOf(widget), 'landing = the widget');
  await expectFocusNotOnBody(page);
});
