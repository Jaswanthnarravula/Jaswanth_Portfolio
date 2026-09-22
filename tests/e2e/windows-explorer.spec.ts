/**
 * Windows 11 — File Explorer journeys (plans/windows/apps/file-explorer.md "Feature IDs + acceptance tests"; shared/12
 * journeys N2 · D1 · H1 · N3): WIN-EXP-01 N2 Experience lists roles from data · WIN-EXP-02 D1 the role deep link ·
 * WIN-EXP-03 H1 in-app back = browser Back · WIN-EXP-04 the invalid-path message · WIN-EXP-07 Résumé.pdf opens Edge's
 * PDF tab · WIN-EXP-08 N3 the compact drill-down. Expected names, roles and dates come from the portfolio data in the
 * selectors' order (never literals); every step waits on an end state and asserts focus never rests on <body>.
 */
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { formatPeriod } from '@/components/content/format';
import { SECTION_TITLES } from '@/data/content-index';
import { portfolio } from '@/data/portfolio';
import type { PartialDate } from '@/data/schema';
import { committed, expectFocusNotOnBody, waitForOs } from './helpers';

const DESKTOP = ['chromium-desktop', 'reduced-motion', 'asset-original', 'firefox-desktop'];
const COMPACT = ['iphone', 'pixel', 'iphone-landscape'];
const desktopOnly = (info: TestInfo) =>
  test.skip(!DESKTOP.includes(info.project.name), 'fine-pointer desktop posture (expanded / large)');
const compactOnly = (info: TestInfo) => test.skip(!COMPACT.includes(info.project.name), 'compact posture (phones)');
const isCompact = (info: TestInfo) => COMPACT.includes(info.project.name);

const taskbar = (page: Page) => page.getByRole('navigation', { name: 'Taskbar' });
const tbApp = (page: Page, name: string) => taskbar(page).getByRole('link', { name: new RegExp(`^${name}(, .*)?$`) });
const win = (page: Page, role: string) => page.locator(`[data-window="windows:${role}"]`);

/** Settled: no window opening/closing and no motion tween running. */
async function settle(page: Page) {
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

// --- Expected values: the portfolio data, named the way Windows names files --------------------------------------------
// `data/selectors` imports generated JSON without an import attribute, which Playwright's ESM loader refuses; the specs
// read the one fact module and apply the selectors' documented order (DATA-SEL-01: newest first, current roles lead,
// undated roles follow; author order breaks ties).

const dateValue = (value: PartialDate | 'present' | null): number => {
  if (value === 'present') return Number.POSITIVE_INFINITY;
  if (value === null) return Number.NEGATIVE_INFINITY;
  const [year, month] = value.split('-');
  return Number(year) * 12 + (month ? Number(month) - 1 : 0);
};
/** Roles: by end, then start; schools: by end only (as `getExperience` / `getEducation` sort). */
const newestFirst = <T extends { start: PartialDate | null; end: PartialDate | 'present' | null }>(
  items: readonly T[],
  byStart: boolean,
) =>
  items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        dateValue(b.item.end) - dateValue(a.item.end) ||
        (byStart ? dateValue(b.item.start) - dateValue(a.item.start) : 0) ||
        a.index - b.index,
    )
    .map(({ item }) => item);
const roles = newestFirst(portfolio.experience, true);
const schools = newestFirst(portfolio.education, false);
const getPerson = () => portfolio.person;
/** Windows file names drop `\ / : * ? " < > |` and never end in a dot or a space: "{Company}.docx". */
const windowsName = (name: string) =>
  name
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/[. ]+$/, '')
    .trim();
const docx = (name: string) => `${windowsName(name)}.docx`;
const profile = `C:\\Users\\${windowsName(getPerson().givenName)}`;
const EXPERIENCE = SECTION_TITLES.experience;
const EDUCATION = SECTION_TITLES.education;
const RESUME_PDF = `${SECTION_TITLES.resume}.pdf`;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const explorer = (page: Page) => win(page, 'files');
const table = (page: Page, name = EXPERIENCE) => explorer(page).getByRole('table', { name });
const rows = (page: Page, name = EXPERIENCE) => table(page, name).locator('tbody').getByRole('link');
const address = (page: Page) => explorer(page).getByRole('navigation', { name: 'Address' });
const navPane = (page: Page) => explorer(page).getByRole('navigation', { name: 'Navigation pane' });
const documentView = (page: Page, file: string) => explorer(page).getByRole('region', { name: file, exact: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('pf.debug.probe', '1');
    window.sessionStorage.setItem('pf.debug.analytics', '1');
  });
});

// --- WIN-EXP-01 ------------------------------------------------------------------------------------------------------

test('WIN-EXP-01 N2 Experience lists roles from data: tab, breadcrumb, command bar, nav pane, Details list', async ({
  page,
}, info) => {
  desktopOnly(info);
  await openWindows(page);
  await tbApp(page, 'File Explorer').click();
  await settle(page);
  await expect(page).toHaveURL(/\/windows\/explorer$/);
  await navPane(page).getByRole('link', { name: EXPERIENCE, exact: true }).click();
  await expect(page).toHaveURL(/\/windows\/explorer\/experience$/);
  await expect(navPane(page).getByRole('link', { name: EXPERIENCE, exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );

  // The window names its folder; the tab strip holds one tab with its own ✕.
  await expect(explorer(page).getByRole('heading', { level: 2 })).toHaveText(`File Explorer — ${EXPERIENCE}`);
  await expect(explorer(page).getByRole('button', { name: 'Close tab' })).toBeVisible();
  await expect(address(page).getByRole('link')).toHaveText(['Home', EXPERIENCE]);
  const commands = explorer(page).getByRole('toolbar', { name: 'Command bar' });
  for (const name of ['Copy link', 'Share', 'Sort', 'View', 'Details'])
    await expect(commands.getByRole('button', { name, exact: true })).toBeVisible();

  // One {Company}.docx per role, newest first, with its role and dates (the storyboard's Name · Role · Dates).
  const list = table(page);
  await expect(list.getByRole('columnheader')).toHaveText(['Name', 'Role', 'Dates']);
  await expect(rows(page)).toHaveText(roles.map((role) => docx(role.company)));
  const bodyRows = list.locator('tbody tr');
  for (const [index, role] of roles.entries()) {
    const cells = bodyRows.nth(index).getByRole('cell');
    await expect(cells.nth(1)).toHaveText(role.role ?? '');
    await expect(cells.nth(2)).toHaveText(formatPeriod(role.start, role.end) ?? '');
  }
  await expect(explorer(page)).toContainText(`${roles.length} ${roles.length === 1 ? 'item' : 'items'}`);
  await expect(explorer(page)).not.toContainText(/Acme|Globex|Initech/);
  await expectFocusNotOnBody(page);
});

// --- WIN-EXP-02 ------------------------------------------------------------------------------------------------------

test('WIN-EXP-02 D1 /windows/explorer/experience/{slug} opens only File Explorer, on that role in the same tab', async ({
  page,
}, info) => {
  const role = roles[0]!;
  const file = docx(role.company);
  await openWindows(page, `/windows/explorer/experience/${role.slug}`);
  await expect(page.locator('[data-window]')).toHaveCount(1);
  await expect(page.locator('[data-boot]')).toHaveCount(0);
  await expect(page.locator('[data-lock]')).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/windows/explorer/experience/${escape(role.slug)}$`));

  // The file opens as its document in the tab: the role from data, headings from h3.
  const document = documentView(page, file);
  await expect(document).toBeVisible();
  await expect(document.getByRole('heading', { level: 3 }).first()).toHaveText(role.role ?? role.company);
  await expect(document).toContainText(role.summary);
  if (!isCompact(info)) await expect(address(page).getByRole('link')).toHaveText(['Home', EXPERIENCE, file]);

  // Back to the folder: the file stays selected (desktop) — or the drill-down's list (compact).
  if (isCompact(info))
    await explorer(page)
      .getByRole('button', { name: `Back to ${EXPERIENCE}` })
      .click();
  else await document.getByRole('button', { name: 'Back to folder' }).click();
  await committed(page);
  await expect(documentView(page, file)).toHaveCount(0);
  await expect(rows(page).first()).toBeVisible();
  if (!isCompact(info)) {
    await expect(rows(page).filter({ hasText: file })).toHaveAttribute('aria-current', 'true');
    await expect(rows(page).filter({ hasText: file })).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`/windows/explorer/experience/${escape(role.slug)}$`));
  }
  await expectFocusNotOnBody(page);

  // Select → URL; open (double-click / tap) → the document again.
  if (!isCompact(info)) {
    const last = roles.at(-1)!;
    await rows(page)
      .filter({ hasText: docx(last.company) })
      .click();
    await expect(page).toHaveURL(new RegExp(`/windows/explorer/experience/${escape(last.slug)}$`));
    await rows(page)
      .filter({ hasText: docx(last.company) })
      .dblclick();
    await expect(documentView(page, docx(last.company))).toBeVisible();
    await expect(documentView(page, docx(last.company))).toBeFocused();
  }
});

// --- WIN-EXP-03 ------------------------------------------------------------------------------------------------------

test('WIN-EXP-03 H1 in-app back = browser Back: Explorer Back/Forward and the browser walk one history', async ({
  page,
}, info) => {
  desktopOnly(info);
  const role = roles[0]!;
  await openWindows(page, '/windows/explorer/experience');
  const back = explorer(page).getByRole('button', { name: 'Back', exact: true });
  const forward = explorer(page).getByRole('button', { name: 'Forward', exact: true });
  await expect(back).toBeDisabled();

  // Three places: the folder → a role selected → another folder.
  await rows(page)
    .filter({ hasText: docx(role.company) })
    .click();
  await expect(page).toHaveURL(new RegExp(`/windows/explorer/experience/${escape(role.slug)}$`));
  await navPane(page).getByRole('link', { name: EDUCATION, exact: true }).click();
  await expect(page).toHaveURL(/\/windows\/explorer\/education$/);
  await expect(rows(page, EDUCATION)).toHaveText(schools.map((school) => docx(school.school)));
  const length = await page.evaluate(() => history.length);

  // In-app Back is a browser Back: the URL steps back, no entry is added, and Forward still leads on.
  await back.click();
  await expect(page).toHaveURL(new RegExp(`/windows/explorer/experience/${escape(role.slug)}$`));
  await expect(rows(page).filter({ hasText: docx(role.company) })).toHaveAttribute('aria-current', 'true');
  expect(await page.evaluate(() => history.length)).toBe(length);
  await page.goBack();
  await expect(page).toHaveURL(/\/windows\/explorer\/experience$/);
  await expect(back).toBeDisabled();
  await expect(rows(page).locator('[aria-current="true"]')).toHaveCount(0);
  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`/windows\/explorer\/experience\/${escape(role.slug)}$`));
  await forward.click();
  await expect(page).toHaveURL(/\/windows\/explorer\/education$/);
  await expect(forward).toBeDisabled();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/windows/explorer/experience/${escape(role.slug)}$`));
  await expect(forward).toBeEnabled();

  // Up goes to the parent (a new entry, as Windows does); Back never closes the window (E14).
  await explorer(page).getByRole('button', { name: 'Up to Home' }).click();
  await expect(page).toHaveURL(/\/windows\/explorer$/);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/windows/explorer/experience/${escape(role.slug)}$`));
  await expect(explorer(page)).toHaveCount(1);
  await expectFocusNotOnBody(page);
});

// --- WIN-EXP-04 ------------------------------------------------------------------------------------------------------

test('WIN-EXP-04 · E19 the address bar takes a typed path: invalid-path message, then normalized navigation', async ({
  page,
}) => {
  await openWindows(page, '/windows/explorer/experience');
  await explorer(page).getByRole('button', { name: 'Edit address' }).click();
  const field = explorer(page).getByRole('textbox', { name: 'Address' });
  await expect(field).toBeFocused();
  await expect(field).toHaveValue(`${profile}\\${EXPERIENCE}`);

  // A path that does not exist: Windows' own message, inline; the field keeps the text to fix.
  await field.fill('Downloads');
  await field.press('Enter');
  const message = explorer(page).getByRole('alert');
  await expect(message).toHaveText("Windows can't find 'Downloads'. Check the spelling and try again.");
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL(/\/windows\/explorer\/experience$/);

  // Mixed separators, wrong case, trailing slashes → normalized navigation.
  await field.fill(`c:/USERS/${getPerson().givenName.toLowerCase()}//${EDUCATION.toUpperCase()}/`);
  await field.press('Enter');
  await expect(page).toHaveURL(/\/windows\/explorer\/education$/);
  await expect(explorer(page).getByRole('textbox', { name: 'Address' })).toHaveCount(0);
  await expect(address(page).getByRole('link')).toHaveText(['Home', EDUCATION]);
  await expectFocusNotOnBody(page);

  // Esc leaves the field unchanged and focus on the address bar.
  await explorer(page).getByRole('button', { name: 'Edit address' }).click();
  await page.keyboard.press('Escape');
  await expect(explorer(page).getByRole('textbox', { name: 'Address' })).toHaveCount(0);
  await expect(explorer(page).getByRole('button', { name: 'Edit address' })).toBeFocused();
});

// --- WIN-EXP-07 ------------------------------------------------------------------------------------------------------

test("WIN-EXP-07 Résumé.pdf opens Edge's PDF tab; Projects opens GitHub", async ({ page }, info) => {
  await openWindows(page, '/windows/explorer');
  const resume = isCompact(info)
    ? navPane(page).getByRole('link', { name: SECTION_TITLES.resume, exact: true })
    : explorer(page)
        .getByRole('region', { name: 'Quick access' })
        .getByRole('link', { name: new RegExp(`^${escape(RESUME_PDF)}`) });
  await expect(resume).toHaveAttribute('href', '/windows/edge/resume');
  await resume.click();
  await expect(page).toHaveURL(/\/windows\/edge\/resume$/);
  await settle(page);
  const edge = win(page, 'browser');
  await expect(edge).toBeVisible();
  await expect(edge.getByRole('tab', { name: new RegExp(escape(RESUME_PDF)), selected: true })).toBeVisible();
  await expectFocusNotOnBody(page);

  // The Projects shortcut hands over to GitHub.
  await openWindows(page, '/windows/explorer');
  await navPane(page).getByRole('link', { name: SECTION_TITLES.projects, exact: true }).click();
  await expect(page).toHaveURL(/\/windows\/github$/);
  await settle(page);
  await expect(win(page, 'github')).toBeVisible();
});

// --- WIN-EXP-08 ------------------------------------------------------------------------------------------------------

test('WIN-EXP-08 N3 compact drill-down: places first, a folder with a back arrow in the title row, a file as its document', async ({
  page,
}, info) => {
  compactOnly(info);
  await openWindows(page, '/windows/explorer');
  const width = page.viewportSize()!.width;
  expect((await explorer(page).boundingBox())!.width).toBeCloseTo(width, 0);
  await expect(explorer(page).getByRole('toolbar', { name: 'Command bar' })).toHaveCount(0);
  await expect(explorer(page).getByRole('button', { name: 'See more' })).toBeVisible();

  // 1 · The places.
  const places = navPane(page).getByRole('link');
  const expected = [EXPERIENCE, EDUCATION, SECTION_TITLES.projects, SECTION_TITLES.resume];
  await expect(places).toHaveCount(expected.length);
  for (const [index, name] of expected.entries()) await expect(places.nth(index)).toHaveAccessibleName(name);
  for (const place of await places.all()) expect((await place.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // 2 · A folder: its list, full width, with the back arrow in the title row.
  await navPane(page).getByRole('link', { name: EXPERIENCE, exact: true }).click();
  await expect(page).toHaveURL(/\/windows\/explorer\/experience$/);
  await expect(navPane(page)).toHaveCount(0);
  // Compact rows are two lines: the file name, then its role · dates (the Role / Dates columns fold in).
  await expect(rows(page)).toHaveCount(roles.length);
  for (const [index, role] of roles.entries()) {
    const row = rows(page).nth(index);
    await expect(row).toHaveAccessibleName(new RegExp(`^${escape(docx(role.company))}`));
    const detail = [role.role, formatPeriod(role.start, role.end)].filter(Boolean).join(' · ');
    if (detail) await expect(row).toContainText(detail);
  }
  for (const row of await rows(page).all()) expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const backHome = explorer(page).getByRole('button', { name: 'Back to Home' });
  await expect(backHome).toBeVisible();
  await expectFocusNotOnBody(page);

  // 3 · A file: a tap opens its document.
  const role = roles[0]!;
  await rows(page)
    .filter({ hasText: docx(role.company) })
    .click();
  await expect(page).toHaveURL(new RegExp(`/windows/explorer/experience/${escape(role.slug)}$`));
  const document = documentView(page, docx(role.company));
  await expect(document).toBeVisible();
  await expect(document.getByRole('heading', { level: 3 }).first()).toHaveText(role.role ?? role.company);
  expect((await document.boundingBox())!.width).toBeCloseTo(width, 0);

  // Back up the levels: the title-row arrow, then the browser's Back — one history.
  await explorer(page)
    .getByRole('button', { name: `Back to ${EXPERIENCE}` })
    .click();
  await expect(page).toHaveURL(/\/windows\/explorer\/experience$/);
  await expect(documentView(page, docx(role.company))).toHaveCount(0);
  await expect(rows(page).first()).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/windows\/explorer$/);
  await expect(navPane(page).getByRole('link')).toHaveCount(4);
  await expectFocusNotOnBody(page);
});
