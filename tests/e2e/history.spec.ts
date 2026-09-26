/**
 * H1 (on the real macOS shell; the OS-switch case starts in Windows and switches through its Settings) — ROUTE-CONTRACT-01 · ROUTE-PORT-01 (native and next-router adapters) · ARCH-SHELL-01 ·
 * ROUTE-GO-01 · ROUTE-DEEP-01 (D1 on macOS) · ROUTE-CODEC-02 (client repair) · ROUTE-TITLE-01 (titles unique) ·
 * ROUTE-SER-01 (traversal spam never duplicates consecutive URLs).
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { expectFocusNotOnBody, plantSentinel, sentinel, shellInstance, waitForOs } from './helpers';

/** A macOS Dock icon by app name (its name reads "Finder", "Finder, open" or "Finder, minimized"). */
const dockApp = (page: Page, name: string) =>
  page
    .getByRole('navigation', { name: 'Dock' })
    .getByRole('link', { name: new RegExp(`^${name}(, (open|minimized))?$`) });

/** A Windows app opened as a visitor does: its pinned taskbar link, or on phones the Start sheet. */
async function openWindowsApp(page: Page, name: string) {
  const taskbar = page.getByRole('navigation', { name: 'Taskbar' });
  const pinned = taskbar.getByRole('link', { name: new RegExp(`^${name}(, .*)?$`) });
  if (await pinned.isVisible()) return pinned.click();
  await taskbar.getByRole('button', { name: 'Start' }).click();
  await page.getByRole('dialog', { name: 'Start' }).getByRole('link', { name, exact: true }).click();
}

for (const adapter of ['native', 'next-router'] as const) {
  test(`history contract: push → back → forward → refresh → back, no full reload (${adapter}) @smoke`, async ({
    page,
  }) => {
    await page.addInitScript((name) => window.sessionStorage.setItem('pf.debug.history', name), adapter);
    await page.goto('/macos');
    await waitForOs(page, 'macos');
    await plantSentinel(page);
    const instance = await shellInstance(page);
    expect(instance).not.toBeNull();

    // push ×2
    await dockApp(page, 'Finder').click();
    await expect(page).toHaveURL(/\/macos\/finder$/);
    await expect(page.getByRole('region', { name: 'Finder' })).toBeFocused();
    await dockApp(page, 'Safari').click();
    await expect(page).toHaveURL(/\/macos\/safari$/);
    await expect(page.getByRole('region', { name: 'Safari' })).toBeFocused();

    // back
    await page.goBack();
    await expect(page).toHaveURL(/\/macos\/finder$/);
    await expect(page.getByRole('region', { name: 'Finder' })).toBeFocused();
    // forward
    await page.goForward();
    await expect(page).toHaveURL(/\/macos\/safari$/);
    await expect(page.getByRole('region', { name: 'Safari' })).toBeFocused();
    expect(await sentinel(page)).toBe('alive');
    expect(await shellInstance(page)).toBe(instance);

    // refresh: the static page exists, the session is revived, the URL wins
    await page.reload();
    await waitForOs(page, 'macos');
    await expect(page.getByRole('region', { name: 'Safari' })).toBeVisible();
    expect(await sentinel(page)).toBeNull();
    await plantSentinel(page);

    // back after refresh: still a shallow traversal
    await page.goBack();
    await expect(page).toHaveURL(/\/macos\/finder$/);
    await expect(page.getByRole('region', { name: 'Finder' })).toBeVisible();
    expect(await sentinel(page)).toBe('alive');
    await expectFocusNotOnBody(page);
  });
}

test('the shell instance survives app open, OS switch and Back/Forward @smoke', async ({ page }) => {
  // Windows switches OS in place from Settings › Switch operating system (WIN-SET-05): the same document throughout.
  await page.goto('/windows');
  await waitForOs(page, 'windows');
  await plantSentinel(page);
  const instance = await shellInstance(page);
  await openWindowsApp(page, 'File Explorer');
  await expect(page).toHaveURL(/\/windows\/explorer$/);
  await openWindowsApp(page, 'Settings');
  await expect(page).toHaveURL(/\/windows\/settings$/);
  const settings = page.locator('[data-window="windows:settings"]');
  await settings
    .getByRole('navigation', { name: 'Settings' })
    .getByRole('button', { name: 'Switch operating system', exact: true })
    .click();
  await settings.getByRole('link', { name: 'Switch to macOS' }).click();
  await expect(page).toHaveURL(/\/macos$/);
  await waitForOs(page, 'macos');
  await page.goBack();
  await expect(page).toHaveURL(/\/windows\/settings$/);
  await waitForOs(page, 'windows');
  await expect(page.locator('[data-window="windows:files"]')).toBeAttached(); // parked session restored
  await expect(settings).toBeAttached();
  await page.goForward();
  await waitForOs(page, 'macos');
  expect(await sentinel(page)).toBe('alive');
  expect(await shellInstance(page)).toBe(instance);
});

test('toggling between two apps never grows history (back-collapse)', async ({ page }) => {
  await page.goto('/macos');
  await waitForOs(page, 'macos');
  const start = await page.evaluate(() => window.history.length);
  for (let i = 0; i < 4; i++) {
    await dockApp(page, 'Mail').click();
    await expect(page).toHaveURL(/\/macos\/mail$/);
    await dockApp(page, 'GitHub').click();
    await expect(page).toHaveURL(/\/macos\/github$/);
  }
  expect(await page.evaluate(() => window.history.length)).toBeLessThanOrEqual(start + 3);
});

test('spamming Back/Forward mid-click never duplicates consecutive URLs and settles consistent', async ({ page }) => {
  // Record any pushState that leaves the URL unchanged — a duplicate neighbour in the visitor's history.
  await page.addInitScript(() => {
    const duplicates: string[] = [];
    (window as unknown as { __duplicates: string[] }).__duplicates = duplicates;
    const push = window.history.pushState.bind(window.history);
    window.history.pushState = (state, unused, url) => {
      const from = window.location.pathname;
      push(state, unused, url);
      if (window.location.pathname === from) duplicates.push(from);
    };
  });
  await page.goto('/macos');
  await waitForOs(page, 'macos');
  for (const name of ['Finder', 'Safari', 'Mail', 'GitHub']) await dockApp(page, name).click();
  await expect(page).toHaveURL(/\/macos\/github$/);

  // A burst of traversals, then an app open while they are still in flight (the serializer queues it).
  await page.evaluate(() => {
    for (const step of [-1, -1, 1, -1, -1, 1]) window.history.go(step);
  });
  await dockApp(page, 'Safari').click();

  // Settled = the URL is stable and the title's app segment ("About · Safari · macOS — …") names the focused window,
  // twice in a row.
  const snapshot = () =>
    page.evaluate(() => {
      const focused = document.querySelector<HTMLElement>('[data-window][data-focused]');
      const title = focused?.dataset.appTitle ?? '';
      const segments = document.title.split(' · ');
      return `${window.location.pathname}|${title !== '' && segments.at(-2) === title}|${title}`;
    });
  let previous = '';
  await expect
    .poll(
      async () => {
        const now = await snapshot();
        const settled = now === previous && now.includes('|true|');
        previous = now;
        return settled;
      },
      { intervals: [150], timeout: 10_000 },
    )
    .toBe(true);

  // Walk the stack back to the start: no two neighbouring entries share a URL.
  const walked = [new URL(page.url()).pathname];
  for (let i = 0; i < 12 && walked.at(-1) !== '/macos'; i++) {
    await page.goBack();
    walked.push(new URL(page.url()).pathname);
  }
  expect(walked.at(-1)).toBe('/macos');
  for (let i = 1; i < walked.length; i++) expect(walked[i], walked.join(' → ')).not.toBe(walked[i - 1]);
  expect(await page.evaluate(() => (window as unknown as { __duplicates: string[] }).__duplicates)).toEqual([]);
});

test('D1 cold deep link opens only the named app', async ({ page }) => {
  await page.goto('/macos/github/enterprise-sso');
  await waitForOs(page, 'macos');
  await expect(page.getByRole('region', { name: 'GitHub' })).toBeVisible();
  await expect(page.locator('[data-window]')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Enterprise SSO Identity Provider', level: 3 })).toBeVisible();
  await expect(page).toHaveTitle('Enterprise SSO Identity Provider · GitHub · macOS — Jaswanth');
});

test('/go resolves into an OS with replaceState; Back leaves the site', async ({ page }) => {
  await page.goto('about:blank');
  await page.goto('/go/projects/sales-platform');
  // Phones land in a phone OS, desktops in macOS (device class from pointer + size, never the user agent).
  await expect(page).toHaveURL(/\/(macos|ios|android)\/github\/sales-platform$/);
  const os = new URL(page.url()).pathname.split('/')[1]!;
  await waitForOs(page, os);
  await expect(page.getByRole('region', { name: 'GitHub' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL('about:blank');
});

test('a bad URL repairs to the nearest valid route on the client', async ({ page }) => {
  // A removed slug arriving through history is repaired with replaceState (never a new entry).
  await page.goto('/macos');
  await waitForOs(page, 'macos');
  await page.evaluate(() => {
    window.history.pushState(null, '', '/macos/finder/experience/removed-company');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL(/\/macos\/finder\/experience$/);
});

test('titles are unique per route and match the shared title function', async ({ page }) => {
  const titles = new Set<string>();
  for (const path of [
    '/macos',
    '/macos/finder',
    '/macos/finder/experience',
    '/macos/finder/experience/ibm',
    '/windows/edge/resume',
    '/linux/terminal/projects',
  ]) {
    await page.goto(path);
    const title = await page.title();
    expect(titles.has(title), title).toBe(false);
    titles.add(title);
  }
  expect(titles).toContain('Software Engineer · IBM · Finder · macOS — Jaswanth');
  expect(titles).toContain('~/projects · Terminal · Linux — Jaswanth');
});
