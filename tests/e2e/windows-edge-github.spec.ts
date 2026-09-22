/**
 * Windows 11 — Microsoft Edge and GitHub (plans/windows/apps/edge.md, plans/windows/apps/github.md; shared/12 journeys
 * N2 · N3 · D1 · X1 · RES-DL-01). Expected values come from `data/selectors`, never typed here. Every step waits on an
 * end state (never a sleep for correctness) and asserts focus never rests on <body>.
 */
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { committed, expectFocusNotOnBody, waitForOs, waitForSettled } from './helpers';

import { portfolio } from '@/data/portfolio';
import type { Portfolio } from '@/data/schema';

// `data/selectors` imports its generated JSON without an import attribute (the bundler's dialect), which Playwright's
// loader rejects; these apply the selectors' own rules to the same data (no fact typed here).
const data: Portfolio = portfolio;
const getPerson = () => data.person;
const getResume = () => data.resume;
/** Featured first, then newest (by year) first; author order breaks ties (Array#sort is stable). */
const getProjects = () =>
  [...data.projects].sort((a, b) => Number(b.featured) - Number(a.featured) || (b.year ?? 0) - (a.year ?? 0));
const getFeaturedProjects = () => getProjects().filter((project) => project.featured);
/** Size and page count of the generated PDF; `null` if it has not been built. */
function getResumeFileMeta(): { readonly bytes: number; readonly pages: number } | null {
  const meta = JSON.parse(readFileSync(new URL('../../data/generated/resume.json', import.meta.url), 'utf8')) as {
    file?: string;
    bytes?: number;
    pages?: number;
  };
  if (meta.file !== data.resume.file || typeof meta.bytes !== 'number' || typeof meta.pages !== 'number') return null;
  return { bytes: meta.bytes, pages: meta.pages };
}

type Box = { x: number; y: number; w: number; h: number };

const DESKTOP = ['chromium-desktop', 'reduced-motion', 'asset-original', 'firefox-desktop'];
const COMPACT = ['iphone', 'pixel', 'iphone-landscape'];
const desktopOnly = (info: TestInfo) =>
  test.skip(!DESKTOP.includes(info.project.name), 'fine-pointer desktop posture (expanded / large)');
const compactOnly = (info: TestInfo) => test.skip(!COMPACT.includes(info.project.name), 'compact posture (phones)');

const taskbar = (page: Page) => page.getByRole('navigation', { name: 'Taskbar' });
const tbApp = (page: Page, name: string) => taskbar(page).getByRole('link', { name: new RegExp(`^${name}(, .*)?$`) });
const win = (page: Page, role: string) => page.locator(`[data-window="windows:${role}"]`);
const boxOf = (locator: Locator): Promise<Box> =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Settled: no window opening/closing and no motion tween running. */
async function settle(page: Page) {
  await committed(page);
  await page.waitForFunction(() => {
    if (document.querySelector('[data-window][data-phase="opening"],[data-window][data-phase="closing"]')) return false;
    const motion = (window as unknown as { __motion?: { debug(): { tweens: number } } }).__motion;
    return !motion || motion.debug().tweens === 0;
  });
}

async function openWindows(page: Page, path = '/windows') {
  await page.goto(path);
  await waitForOs(page, 'windows');
  await settle(page);
}

const edge = (page: Page) => win(page, 'browser');
const github = (page: Page) => win(page, 'github');
const tab = (page: Page, name: string | RegExp) => edge(page).getByRole('tab', { name });
const aboutTab = (page: Page) => tab(page, `About ${getPerson().givenName}`);
const resumeTab = (page: Page) => tab(page, 'Résumé.pdf');
const pdfTools = (page: Page) => edge(page).getByRole('toolbar', { name: 'PDF tools' });
const rail = (page: Page) => github(page).getByRole('navigation', { name: 'Navigation' });
const analyticsEvents = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __pfAnalytics?: { events: { name: string; os?: string }[] } }).__pfAnalytics?.events ??
      [],
  );

/** axe (WCAG 2.2 AA) on one window only — the other surfaces have their own X1 scans in windows.spec.ts. */
async function axeClean(page: Page, selector: string, label: string) {
  const { violations } = await new AxeBuilder({ page })
    .include(selector)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(violations.map((violation) => `${label}: ${violation.id} ${violation.nodes[0]?.target}`)).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('pf.debug.probe', '1');
    window.sessionStorage.setItem('pf.debug.analytics', '1');
  });
});

// --- Microsoft Edge ---------------------------------------------------------------------------------------------------

test('WIN-EDGE-01 N2 window renders; strip opens apps', async ({ page }, info) => {
  desktopOnly(info);
  await openWindows(page);
  await tbApp(page, 'Microsoft Edge').click();
  await settle(page);
  await expect(page).toHaveURL(/\/windows\/edge$/);
  await expect(edge(page)).toBeFocused();

  // Tabs live in the title bar (the drag region); the About tab is selected.
  const titleBar = edge(page).locator('header[data-drag-region]');
  const tabs = titleBar.getByRole('tablist', { name: 'Tabs' });
  await expect(tabs.getByRole('tab')).toHaveCount(2);
  await expect(tabs.getByRole('tab').nth(0)).toHaveAccessibleName(`About ${getPerson().givenName}`);
  await expect(tabs.getByRole('tab').nth(1)).toHaveAccessibleName('Résumé.pdf');
  await expect(aboutTab(page)).toHaveAttribute('aria-selected', 'true');
  await expect(titleBar.getByRole('button', { name: /^New tab/ })).toBeEnabled();

  // The address field is display-only and labelled; the page is the shared Overview.
  const address = edge(page).getByRole('textbox', { name: 'Address' });
  await expect(address).toHaveAttribute('readonly', '');
  await expect(address).toHaveValue(/\/go\/about$/);
  await expect(
    edge(page).getByRole('tabpanel').getByRole('heading', { level: 3, name: getPerson().name }),
  ).toBeVisible();
  await expect(edge(page).getByRole('button', { name: 'Back' })).toHaveAttribute('aria-disabled', 'true');

  // The sidebar strip: GitHub · Outlook · Search, each opening its app / Search.
  const strip = edge(page).getByRole('toolbar', { name: 'Sidebar' });
  await expect(strip.getByRole('button')).toHaveCount(3);
  await strip.getByRole('button', { name: 'GitHub' }).click();
  await settle(page);
  await expect(github(page)).toBeVisible();
  await expect(github(page)).toHaveAttribute('data-focused');
  await expect(page).toHaveURL(/\/windows\/github$/);

  await tbApp(page, 'Microsoft Edge').click(); // behind → the taskbar brings Edge forward
  await settle(page);
  await expect(edge(page)).toHaveAttribute('data-focused');
  await strip.getByRole('button', { name: 'Outlook' }).click();
  await settle(page);
  await expect(win(page, 'mail')).toHaveAttribute('data-focused');
  await expect(page).toHaveURL(/\/windows\/outlook$/);

  await tbApp(page, 'Microsoft Edge').click();
  await settle(page);
  await expect(edge(page)).toHaveAttribute('data-focused');
  await strip.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
  await expectFocusNotOnBody(page);
});

test('WIN-EDGE-03 D1 /windows/edge/resume opens the PDF tab; Back returns to About', async ({ page }) => {
  // Cold deep link: only Edge, on the PDF tab.
  await openWindows(page, '/windows/edge/resume');
  await expect(page.locator('[data-window]')).toHaveCount(1);
  await expect(resumeTab(page)).toHaveAttribute('aria-selected', 'true');
  await expect(pdfTools(page)).toBeVisible();
  await expect(edge(page).getByRole('textbox', { name: 'Address' })).toHaveValue(
    /^file:\/\/\/C:\/Users\/.+\/Résumé\.pdf$/,
  );
  await expect(page).toHaveTitle(/^Résumé · Microsoft Edge/);

  // Refresh keeps the tab (the URL wins).
  await page.reload();
  await waitForOs(page, 'windows');
  await expect(resumeTab(page)).toHaveAttribute('aria-selected', 'true');

  // Tabs are routed: from About, the Résumé tab pushes one entry; browser Back returns to About, and so does the
  // toolbar Back (the kernel's back-collapse steps history back instead of pushing a duplicate).
  await openWindows(page, '/windows/edge');
  await expect(aboutTab(page)).toHaveAttribute('aria-selected', 'true');
  await resumeTab(page).click();
  await expect(page).toHaveURL(/\/windows\/edge\/resume$/);
  await expect(resumeTab(page)).toHaveAttribute('aria-selected', 'true');
  await expect(pdfTools(page)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/windows\/edge$/);
  await expect(aboutTab(page)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-window]')).toHaveCount(1); // Back never closes the window
  await page.goForward();
  await expect(page).toHaveURL(/\/windows\/edge\/resume$/);
  await expect(resumeTab(page)).toHaveAttribute('aria-selected', 'true');
  await edge(page).getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/windows\/edge$/);
  await expect(aboutTab(page)).toHaveAttribute('aria-selected', 'true');
  await expectFocusNotOnBody(page);
});

test('WIN-EDGE-04 RES-DL-01 on Windows: Save downloads the named file; X1 axe clean', async ({ page }, info) => {
  test.slow(); // a PDF page plus two full axe runs (WebKit is the slowest)
  await openWindows(page, '/windows/edge/resume');
  const file = getResumeFileMeta();
  test.skip(!file, 'no PDF built yet (placeholder phase): Save is hidden by design');
  const tools = pdfTools(page);
  const save = tools.getByRole('link', { name: /^Save/ });
  await expect(save).toHaveAttribute('href', getResume().file);
  await expect(save).toHaveAttribute('download', getResume().downloadName);
  const [download] = await Promise.all([page.waitForEvent('download'), save.click()]);
  expect(download.suggestedFilename()).toBe(getResume().downloadName);
  await expect.poll(() => analyticsEvents(page)).toContainEqual({ name: 'resume_downloaded', os: 'windows' });
  await expect(page.getByText('Download complete').first()).toBeVisible();

  // The text version is first in DOM, the PDF after it; the page indicator reads "1 / N".
  const order = await edge(page).evaluate((el) => {
    const text = el.querySelector('[aria-label="Résumé — text version"]');
    const pdf = el.querySelector('object[type="application/pdf"]');
    return !!text && !!pdf && !!(text.compareDocumentPosition(pdf) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(order).toBe(true);
  if (!COMPACT.includes(info.project.name)) {
    await expect(tools.getByText(`Page 1 of ${file!.pages}`)).toBeAttached();
    await expect(tools.getByRole('button', { name: 'Rotate' })).toBeDisabled();
    await tools.getByRole('button', { name: 'Zoom in' }).click();
    await expect(tools.getByRole('button', { name: 'Fit to width' })).toHaveAttribute('aria-pressed', 'false');
    await tools.getByRole('button', { name: 'Fit to width' }).click();
    await expect(tools.getByRole('button', { name: 'Fit to width' })).toHaveAttribute('aria-pressed', 'true');
  }

  await axeClean(page, '[data-window="windows:browser"]', 'résumé');
  await aboutTab(page).click();
  await expect(page).toHaveURL(/\/windows\/edge$/);
  await waitForSettled(page, '[data-window="windows:browser"] [role="tabpanel"]');
  await axeClean(page, '[data-window="windows:browser"]', 'about');
  await expectFocusNotOnBody(page);
});

test('WIN-EDGE-05 perf: no lenis / ScrollTrigger requests under reduced motion', async ({ page }, info) => {
  test.skip(!['reduced-motion', 'chromium-desktop'].includes(info.project.name), 'fine-pointer Chromium desktops');
  // Both libraries are dynamic chunks; a chunk is recognised by a marker only its library ships.
  const loaded = { lenis: false, scrollTrigger: false };
  page.on('response', async (response) => {
    if (!/\/_next\/static\/chunks\/.+\.js/.test(response.url())) return;
    const body = await response.text().catch(() => '');
    if (body.includes('lenis-prevent')) loaded.lenis = true;
    if (body.includes('pinSpacing')) loaded.scrollTrigger = true;
  });
  await openWindows(page, '/windows/edge');
  const panel = edge(page).getByRole('tabpanel');
  await expect(panel.getByRole('heading', { level: 3, name: getPerson().name })).toBeVisible();
  await panel.hover();
  await page.mouse.wheel(0, 1200);
  await page.waitForLoadState('networkidle');
  const gated = await page.evaluate(
    () =>
      document.documentElement.dataset.motion !== 'reduced' &&
      document.documentElement.dataset.tier !== '0' &&
      matchMedia('(pointer: fine) and (hover: hover)').matches,
  );
  if (info.project.name === 'reduced-motion') {
    expect(gated).toBe(false);
    expect(loaded).toEqual({ lenis: false, scrollTrigger: false });
  } else {
    // The positive control: with full motion on a fine pointer the Overview does load both (so the check is real).
    expect(gated).toBe(true);
    await expect.poll(() => ({ ...loaded })).toEqual({ lenis: true, scrollTrigger: true });
  }
  // Content is complete either way (effects are an enhancement).
  await expect(panel.getByRole('heading', { level: 3, name: 'Get in touch' })).toBeAttached();
});

test('WIN-EDGE-06 N3 compact Edge: tabs row under a compact title, PDF toolbar Save · ⋯, no strip', async ({
  page,
}, info) => {
  compactOnly(info);
  await openWindows(page, '/windows/edge/resume');
  const box = await boxOf(edge(page));
  expect(box.x).toBe(0);
  expect(box.w).toBe(page.viewportSize()!.width);

  const titleBar = edge(page).locator('header[data-drag-region]');
  await expect(titleBar.getByRole('tablist')).toHaveCount(0);
  await expect(titleBar.getByRole('heading', { level: 2 })).toHaveText('Microsoft Edge — Résumé.pdf');
  const tabs = edge(page).getByRole('tablist', { name: 'Tabs' });
  await expect(tabs).toBeVisible();
  expect((await boxOf(tabs)).y).toBeGreaterThanOrEqual((await boxOf(titleBar)).y + (await boxOf(titleBar)).h - 1);

  const tools = pdfTools(page);
  const controls = await tools
    .locator('a, button')
    .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));
  expect(controls).toEqual(
    getResumeFileMeta() ? [expect.stringMatching(/^Save \(PDF/), 'More PDF tools'] : ['More PDF tools'],
  );
  await tools.getByRole('button', { name: 'More PDF tools' }).click();
  const menu = page.getByRole('menu', { name: 'PDF tools' });
  await expect(menu.getByRole('menuitem')).toHaveText(['Zoom in', 'Zoom out', 'Fit to width', 'Print']);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(tools.getByRole('button', { name: 'More PDF tools' })).toBeFocused();

  await expect(edge(page).getByRole('toolbar', { name: 'Sidebar' })).toHaveCount(0);
  for (const target of [
    edge(page).getByRole('button', { name: 'Back' }),
    tools.getByRole('button', { name: 'More PDF tools' }),
  ]) {
    const size = await boxOf(target);
    expect(size.w).toBeGreaterThanOrEqual(44);
    expect(size.h).toBeGreaterThanOrEqual(44);
  }

  await aboutTab(page).click();
  await expect(page).toHaveURL(/\/windows\/edge$/);
  await expect(titleBar.getByRole('heading', { level: 2 })).toHaveText(
    `Microsoft Edge — About ${getPerson().givenName}`,
  );
  // Native scroll only in compact: the page scrolls itself.
  const page0 = edge(page).locator('[role="tabpanel"] > div').first();
  await page0.evaluate((el) => el.scrollTo({ top: 400 }));
  await expect.poll(() => page0.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await expectFocusNotOnBody(page);
});

// --- GitHub -----------------------------------------------------------------------------------------------------------

test('WIN-GH-01 N2 projects match data', async ({ page }, info) => {
  desktopOnly(info);
  await openWindows(page);
  await tbApp(page, 'GitHub').click();
  await settle(page);
  await expect(page).toHaveURL(/\/windows\/github$/);

  // Rail: Overview (current) · Repositories · the featured projects, each a real link to its page.
  await expect(rail(page).getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  const featured = getFeaturedProjects();
  const railLinks = rail(page).getByRole('link');
  await expect(railLinks).toHaveCount(featured.length);
  for (const [index, project] of featured.entries()) {
    await expect(railLinks.nth(index)).toHaveAccessibleName(project.name);
    await expect(railLinks.nth(index)).toHaveAttribute('href', `/windows/github/${project.slug}`);
  }

  // Overview: the pinned cards are the featured projects, in order, named in full.
  const pinned = github(page).getByRole('region', { name: 'Pinned' }).getByRole('link');
  const expected = featured.length ? featured : getProjects().slice(0, 6);
  await expect(pinned).toHaveCount(expected.length);
  for (const [index, project] of expected.entries())
    await expect(pinned.nth(index)).toHaveAccessibleName(
      new RegExp(`^${escape(project.name)}, ${escape(project.tagline)}`),
    );

  // Repositories: every project, in the data's order.
  await rail(page).getByRole('button', { name: 'Repositories' }).click();
  const rows = github(page).getByRole('list', { name: 'Repositories' }).getByRole('link');
  await expect(rows).toHaveCount(getProjects().length);
  for (const [index, project] of getProjects().entries())
    await expect(rows.nth(index)).toHaveAccessibleName(new RegExp(`^${escape(project.name)},`));

  // The title-bar search filters them.
  const needle = getProjects()[0]!.name;
  await github(page).getByRole('searchbox', { name: 'Search repositories' }).fill(needle);
  await expect(rows.first()).toHaveAccessibleName(new RegExp(`^${escape(needle)},`));
  await axeClean(page, '[data-window="windows:github"]', 'github');
  await expectFocusNotOnBody(page);
});

test('WIN-GH-02 D1 /windows/github/{slug}', async ({ page }) => {
  const project = getProjects().find((item) => item.year) ?? getProjects()[0]!;
  await openWindows(page, `/windows/github/${project.slug}`);
  await expect(page.locator('[data-window]')).toHaveCount(1);
  const crumbs = github(page).getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumbs.getByRole('link', { name: 'Repositories' })).toBeVisible();
  await expect(crumbs.getByRole('heading', { level: 3, name: project.name })).toBeVisible();
  const pivots = github(page).getByRole('tablist', { name: 'Project' });
  await expect(pivots.getByRole('tab')).toHaveText(
    project.repo || project.live ? ['README', 'Stack', 'Links'] : ['README', 'Stack'],
  );
  await expect(pivots.getByRole('tab', { name: 'README' })).toHaveAttribute('aria-selected', 'true');
  for (const highlight of project.highlights)
    await expect(github(page).getByRole('tabpanel', { name: 'README' })).toContainText(highlight);
  await pivots.getByRole('tab', { name: 'README' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(pivots.getByRole('tab', { name: 'Stack' })).toBeFocused();
  await expect(github(page).getByRole('tabpanel', { name: 'Stack' }).getByRole('listitem')).toHaveText([
    ...project.stack,
  ]);
  const info = github(page).getByRole('complementary', { name: 'About' });
  if (project.year) await expect(info).toContainText(String(project.year));

  // Refresh keeps the project; the title-bar Back goes to the list.
  await page.reload();
  await waitForOs(page, 'windows');
  await expect(github(page).getByRole('heading', { level: 3, name: project.name })).toBeVisible();
  await github(page).getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/windows\/github$/);
  await expect(github(page).getByRole('heading', { level: 3, name: /^(Overview|Repositories)$/ })).toBeVisible();
  await expectFocusNotOnBody(page);
});

test('WIN-GH-05 back mid-transition lands cleanly', async ({ page }, info) => {
  desktopOnly(info);
  const project = getFeaturedProjects()[0] ?? getProjects()[0]!;
  await openWindows(page, '/windows/github');
  const card = github(page)
    .getByRole('region', { name: 'Pinned' })
    .getByRole('link', { name: new RegExp(`^${escape(project.name)},`) });
  const back = github(page).getByRole('button', { name: 'Back' });

  // Open a project and press Back while its drill-in is still running — three times over.
  for (let round = 0; round < 3; round++) {
    await card.click();
    await expect(github(page).getByRole('heading', { level: 3, name: project.name })).toBeAttached();
    await back.click(); // no settle in between: the drill-in (250 ms) is mid-flight
    await expect(github(page).getByRole('heading', { level: 3, name: 'Overview' })).toBeAttached();
  }
  await settle(page);
  await expect(page).toHaveURL(/\/windows\/github$/);
  // Landed: one page, fully opaque and in place; the drill-out copy is gone.
  await waitForSettled(page, '[data-window="windows:github"] [data-page-heading]');
  await expect(github(page).locator('[data-page-heading]')).toHaveCount(1);
  await expect(github(page).locator('[inert]')).toHaveCount(0);
  const transform = await github(page)
    .locator('[data-page-heading]')
    .evaluate((el) => {
      const chain: string[] = [];
      for (let node: Element | null = el; node && !node.hasAttribute('data-window'); node = node.parentElement)
        chain.push(getComputedStyle(node).transform);
      return chain.filter((value) => value !== 'none');
    });
  expect(transform).toEqual([]);
  await expect(github(page).getByRole('region', { name: 'Pinned' })).toBeVisible();
  await expectFocusNotOnBody(page);
});

test('WIN-GH-06 N3 compact GitHub: hamburger overlay rail, one column, scrolling pivots', async ({ page }, info) => {
  compactOnly(info);
  await openWindows(page, '/windows/github');
  const box = await boxOf(github(page));
  expect(box.x).toBe(0);
  expect(box.w).toBe(page.viewportSize()!.width);
  await expect(rail(page)).toHaveCount(0);

  const burger = github(page).getByRole('button', { name: 'Open navigation' });
  const size = await boxOf(burger);
  expect(size.w).toBeGreaterThanOrEqual(44);
  expect(size.h).toBeGreaterThanOrEqual(44);
  await burger.click();
  await expect(rail(page)).toBeVisible();
  await expect(rail(page)).toHaveAttribute('data-state', 'overlay');
  await rail(page).getByRole('button', { name: 'Repositories' }).click();
  await expect(rail(page)).toHaveCount(0);
  await expect(github(page).getByRole('heading', { level: 3, name: 'Repositories' })).toBeVisible();

  // One column: every row spans the content width.
  const rows = github(page).getByRole('list', { name: 'Repositories' }).getByRole('listitem');
  await expect(rows).toHaveCount(getProjects().length);
  const [first, second] = [await boxOf(rows.nth(0)), await boxOf(rows.nth(1))];
  expect(second.x).toBe(first.x);
  expect(second.y).toBeGreaterThan(first.y);

  const project = getProjects()[0]!;
  await rows.nth(0).getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/windows/github/${project.slug}$`));
  const pivots = github(page).getByRole('tablist', { name: 'Project' });
  await expect(pivots).toHaveCSS('overflow-x', 'auto');
  const info2 = await boxOf(github(page).getByRole('complementary', { name: 'About' }));
  const main = await boxOf(pivots);
  expect(info2.y).toBeGreaterThan(main.y); // the info card sits below, not beside
  await page.goBack();
  await expect(page).toHaveURL(/\/windows\/github$/);
  await expectFocusNotOnBody(page);
});
