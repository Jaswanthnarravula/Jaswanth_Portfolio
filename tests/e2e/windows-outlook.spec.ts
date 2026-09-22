/**
 * Windows 11 · Outlook — the e2e acceptance tests named in plans/windows/apps/outlook.md:
 *   WIN-OUT-02 P1 (the draft survives reload) · WIN-OUT-03 (Send = an encoded `mailto:` hand-off, end to end) ·
 *   WIN-OUT-04 (the attachment chip opens /windows/edge/resume; Save as downloads) · WIN-OUT-05 N3 (phones: push
 *   navigation, sticky Send) · WIN-OUT-06 X1 (axe clean: reading pane, compose, the discard dialog).
 * Patterns from windows.spec.ts: every step waits on an end state (never a sleep for correctness) and focus never rests
 * on <body>. The `mailto:` navigation is observed and cancelled through the Navigation API, so the page never leaves.
 * Expected values come from the data (`data/portfolio` + the generated résumé meta, exactly what `data/selectors`
 * returns — the selectors module itself can't load here: Node ESM refuses its JSON imports without import attributes).
 */
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { buildInbox, CONTINUED_NOTE, MAILTO_BODY_LIMIT, sendTarget } from '@/components/content/inbox';
import { portfolio } from '@/data/portfolio';
import { committed, expectFocusNotOnBody, waitForOs } from './helpers';

// --- Data (as data/selectors returns it) ----------------------------------------------------------------------------

const { person, contact, resume } = portfolio;
const meta = JSON.parse(readFileSync(new URL('../../data/generated/resume.json', import.meta.url), 'utf8')) as {
  file?: string;
  bytes?: number;
  pages?: number;
};
/** `getResumeFileMeta()`. */
const file =
  meta.file === resume.file && typeof meta.bytes === 'number' && typeof meta.pages === 'number'
    ? { bytes: meta.bytes, pages: meta.pages }
    : null;
const inbox = buildInbox({ person, contact, resume, file });
const [talk, find, cv] = inbox as [(typeof inbox)[0], (typeof inbox)[0], (typeof inbox)[0]];

/** The list row's full name, as Outlook composes it (WIN-OUT-06 "ul of buttons with full names"). */
const rowName = (message: (typeof inbox)[0], unread: boolean) =>
  [
    unread ? 'Unread' : null,
    message.from.name,
    message.subject,
    message.preview,
    message.dateLabel,
    message.attachment ? 'Has attachments' : null,
    message.pinned ? 'Pinned' : null,
  ]
    .filter(Boolean)
    .join(', ');

// --- Helpers (windows.spec.ts patterns) -----------------------------------------------------------------------------

const COMPACT = ['iphone', 'pixel', 'iphone-landscape'];
const isCompact = (info: TestInfo) => COMPACT.includes(info.project.name);
const compactOnly = (info: TestInfo) => test.skip(!isCompact(info), 'compact posture (phones)');

const outlookWindow = (page: Page) => page.locator('[data-window="windows:mail"]');
const boxOf = (locator: ReturnType<Page['locator']>) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });

/** Settled: no window opening/closing, no motion tween, and Outlook's own CSS animations (pane fades, InfoBar) done. */
async function settle(page: Page) {
  await page.waitForFunction(() => {
    if (document.querySelector('[data-window][data-phase="opening"],[data-window][data-phase="closing"]')) return false;
    const motion = (window as unknown as { __motion?: { debug(): { tweens: number } } }).__motion;
    if (motion && motion.debug().tweens !== 0) return false;
    const outlook = document.querySelector('[data-window="windows:mail"]');
    return !outlook || outlook.getAnimations({ subtree: true }).every((animation) => animation.playState !== 'running');
  });
}

/** Outlook opened from its deep link, its lazy chunk loaded (the ribbon is the app's own chrome). */
async function openOutlook(page: Page) {
  await page.goto('/windows/outlook');
  await waitForOs(page, 'windows');
  const outlook = outlookWindow(page);
  await expect(outlook.getByRole('toolbar', { name: 'Mail commands' })).toBeVisible();
  await settle(page);
  return outlook;
}

const handedOff = (page: Page) =>
  page.evaluate(() => [...((window as unknown as { __mailto?: string[] }).__mailto ?? [])]);
const events = (page: Page) =>
  page.evaluate(() => [
    ...((window as unknown as { __pfAnalytics?: { events: Record<string, unknown>[] } }).__pfAnalytics?.events ?? []),
  ]);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('pf.debug.probe', '1');
    window.sessionStorage.setItem('pf.debug.analytics', '1');
    // The hand-off is recorded and cancelled before it leaves the page (no email app is launched in the test).
    const record: string[] = [];
    (window as unknown as { __mailto: string[] }).__mailto = record;
    (window as unknown as { navigation?: EventTarget }).navigation?.addEventListener('navigate', (event) => {
      const navigate = event as Event & { destination: { url: string } };
      if (!navigate.destination.url.startsWith('mailto:')) return;
      record.push(navigate.destination.url);
      navigate.preventDefault();
    });
  });
});

// --- WIN-OUT-02 -----------------------------------------------------------------------------------------------------

test('WIN-OUT-02 P1 draft survives reload: compose comes back in the reading pane with its subject and message', async ({
  page,
}, info) => {
  const outlook = await openOutlook(page);
  await outlook.getByRole('button', { name: 'New mail' }).click();
  const form = outlook.getByRole('form', { name: 'New message' });
  await expect(form.getByRole('textbox', { name: 'To' })).toHaveValue(contact.email);
  await expect(form.getByRole('textbox', { name: 'Subject' })).toBeFocused();
  await page.keyboard.type('Hello from P1');
  await form.getByRole('textbox', { name: 'Message' }).fill('Line one\nLine two');
  await committed(page);
  // The kernel's debounced session write has landed before the reload.
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem('pf.sessions.v1') ?? ''))
    .toContain('Hello from P1');

  await page.reload();
  await waitForOs(page, 'windows');
  const restored = outlookWindow(page).getByRole('form', { name: 'New message' });
  await expect(restored.getByRole('textbox', { name: 'Subject' })).toHaveValue('Hello from P1');
  await expect(restored.getByRole('textbox', { name: 'Message' })).toHaveValue('Line one\nLine two');
  if (!isCompact(info))
    await expect(
      outlookWindow(page).getByRole('navigation', { name: 'Folders' }).getByRole('button', { name: 'Drafts, 1 item' }),
    ).toBeVisible();
  await expect(page).toHaveURL(/\/windows\/outlook$/);
});

// --- WIN-OUT-03 -----------------------------------------------------------------------------------------------------

test('WIN-OUT-03 Send hands an encoded mailto: to the email app (the page never leaves); the InfoBar offers Copy', async ({
  page,
}) => {
  const outlook = await openOutlook(page);
  expect(await page.evaluate(() => 'navigation' in window), 'the Navigation API observes the hand-off').toBe(true);
  await outlook
    .getByRole('list', { name: 'Messages' })
    .getByRole('button', { name: rowName(talk, true) })
    .click();
  const reading = outlook.getByRole('region', { name: 'Reading pane' });
  await expect(reading.getByRole('heading', { level: 3, name: talk.subject })).toBeVisible();
  await reading.getByRole('button', { name: 'Reply by email' }).click();
  const form = outlook.getByRole('form', { name: 'Reply' });
  const subject = form.getByRole('textbox', { name: 'Subject' });
  await expect(subject).toHaveValue(`Re: ${talk.subject}`);
  await expect(form.getByRole('textbox', { name: 'Message' })).toBeFocused();
  await subject.fill('Hi & hello — 100%?');
  await form.getByRole('textbox', { name: 'Message' }).fill('Line 1\nLine 2 = ok?');
  await form.getByRole('button', { name: 'Send' }).click();

  const expected = sendTarget({ email: contact.email, subject: 'Hi & hello — 100%?', body: 'Line 1\nLine 2 = ok?' });
  await expect.poll(() => handedOff(page)).toEqual([expected.url]);
  const url = new URL(expected.url);
  expect(url.protocol).toBe('mailto:');
  expect(url.pathname).toBe(contact.email);
  expect(url.search).toBe(
    '?subject=Hi%20%26%20hello%20%E2%80%94%20100%25%3F&body=Line%201%0D%0ALine%202%20%3D%20ok%3F',
  );
  await expect(page).toHaveURL(/\/windows\/outlook$/); // never left

  const status = outlook.getByRole('region', { name: 'Reading pane' }).getByRole('status');
  await expect(status).toContainText('Handed to your email app. Nothing opened? Copy the address.');
  await expect(status.getByRole('button', { name: 'Copy' })).toBeFocused();
  await expect(outlook.getByRole('form')).toHaveCount(0);
  await expect.poll(() => events(page)).toContainEqual({ name: 'contact_initiated', channel: 'mailto' });

  // Ctrl+Enter sends from the message; a body over the limit is cut with the note (the full text is copied).
  await outlook.getByRole('button', { name: 'New mail' }).click();
  const long = Array.from({ length: 400 }, (_, index) => `word${index}`).join(' ');
  const message = outlook.getByRole('form', { name: 'New message' }).getByRole('textbox', { name: 'Message' });
  await message.fill(long);
  await message.press('Enter'); // Enter alone never sends
  expect(await handedOff(page)).toHaveLength(1);
  await message.press('Control+Enter');
  await expect.poll(async () => (await handedOff(page)).length).toBe(2);
  const carried = new URL((await handedOff(page))[1]!).searchParams.get('body')!.replace(/\r\n/g, '\n');
  expect(carried.length).toBeLessThanOrEqual(MAILTO_BODY_LIMIT);
  expect(carried.endsWith(`\n\n${CONTINUED_NOTE}`)).toBe(true);
  expect(long.startsWith(carried.slice(0, -CONTINUED_NOTE.length - 2))).toBe(true);
  await expect(page).toHaveURL(/\/windows\/outlook$/);
  await expectFocusNotOnBody(page);
});

// --- WIN-OUT-04 -----------------------------------------------------------------------------------------------------

test('WIN-OUT-04 the attachment chip opens /windows/edge/resume — the résumé as a PDF tab in Edge', async ({
  page,
}) => {
  const outlook = await openOutlook(page);
  await outlook
    .getByRole('list', { name: 'Messages' })
    .getByRole('button', { name: rowName(cv, true) })
    .click();
  const chip = outlook.getByRole('link', {
    name: `${cv.attachment!.name}, ${cv.attachment!.label}. Open in Microsoft Edge`,
  });
  await expect(chip).toHaveAttribute('href', '/windows/edge/resume');
  await expect(chip).toContainText(cv.attachment!.name);
  if (cv.attachment!.size) await expect(chip).toContainText(cv.attachment!.size);
  await chip.click();
  await expect(page).toHaveURL(/\/windows\/edge\/resume$/);
  await settle(page);
  await expect(page.locator('[data-window="windows:browser"]')).toBeVisible();
  await expect(page).toHaveTitle(/^Résumé · Microsoft Edge · Windows 11/);
  await expectFocusNotOnBody(page);
});

test('WIN-OUT-04 the chip menu: Save as downloads the PDF and records resume_downloaded', async ({ page }) => {
  test.skip(!file, 'the PDF has not been built: Save as is disabled');
  const outlook = await openOutlook(page);
  await outlook
    .getByRole('list', { name: 'Messages' })
    .getByRole('button', { name: rowName(cv, true) })
    .click();
  await outlook.getByRole('button', { name: `More actions for ${cv.attachment!.name}` }).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem')).toHaveText(['Open', 'Save as']);
  await settle(page);
  // The menu is painted above the window it was opened from (hit-testing reaches its item, not the message body).
  const onTop = await menu.getByRole('menuitem', { name: 'Save as' }).evaluate((item) => {
    const r = item.getBoundingClientRect();
    return item.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  });
  expect(onTop, 'the chip menu paints above the Outlook window').toBe(true);
  const download = page.waitForEvent('download');
  await menu.getByRole('menuitem', { name: 'Save as' }).click();
  expect((await download).suggestedFilename()).toBe(resume.downloadName);
  await expect.poll(() => events(page)).toContainEqual({ name: 'resume_downloaded', os: 'windows' });
  await expect(page).toHaveURL(/\/windows\/outlook$/);
});

// --- WIN-OUT-05 -----------------------------------------------------------------------------------------------------

test('WIN-OUT-05 N3 phones: list → message push with a back arrow; compose full-height, Send sticky at the bottom', async ({
  page,
}, info) => {
  compactOnly(info);
  const outlook = await openOutlook(page);
  const viewport = page.viewportSize()!;
  expect((await boxOf(outlook)).x).toBe(0);
  expect((await boxOf(outlook)).w).toBe(viewport.width);
  const commands = outlook.getByRole('toolbar', { name: 'Mail commands' }).getByRole('button');
  await expect(commands).toHaveCount(3);
  for (const [index, name] of ['Folders', 'New mail', 'More options'].entries())
    await expect(commands.nth(index)).toHaveAccessibleName(name);

  const list = outlook.getByRole('list', { name: 'Messages' });
  const reading = outlook.getByRole('region', { name: 'Reading pane' });
  await expect(list).toBeVisible();
  await expect(reading).toBeHidden();
  await list.getByRole('button', { name: rowName(find, true) }).click();
  await expect(list).toBeHidden();
  await expect(reading.getByRole('heading', { level: 3, name: find.subject })).toBeFocused();
  expect((await boxOf(reading)).w).toBeGreaterThanOrEqual(viewport.width - 2);
  const links = reading.getByRole('list', { name: 'Links' });
  for (const link of contact.links)
    await expect(links.getByRole('link', { name: new RegExp(`^${link.label} `) })).toHaveAttribute('href', link.url);

  await reading.getByRole('button', { name: 'Back to Inbox' }).click();
  await expect(reading).toBeHidden();
  await expect(list.getByRole('button', { name: rowName(find, false) })).toBeFocused();

  // Compose: full height, inputs ≥ 16 px, Send at the bottom and still there when the message overflows.
  await outlook.getByRole('button', { name: 'New mail' }).click();
  const form = outlook.getByRole('form', { name: 'New message' });
  await expect(list).toBeHidden();
  for (const name of ['Subject', 'Message']) {
    const size = await form.getByRole('textbox', { name }).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size, name).toBeGreaterThanOrEqual(16);
  }
  const send = form.getByRole('button', { name: 'Send' });
  const paneBox = await boxOf(reading);
  const sendBox = await boxOf(send);
  expect(sendBox.h).toBeGreaterThanOrEqual(40);
  expect(sendBox.y + sendBox.h).toBeLessThanOrEqual(paneBox.y + paneBox.h);
  expect(sendBox.y + sendBox.h).toBeGreaterThan(paneBox.y + paneBox.h - 80);
  await form
    .getByRole('textbox', { name: 'Message' })
    .fill(Array.from({ length: 80 }, (_, i) => `Line ${i}`).join('\n'));
  await form.getByRole('textbox', { name: 'Message' }).press('End');
  await expect(send).toBeInViewport();
  const stuck = await boxOf(send);
  expect(stuck.y + stuck.h).toBeLessThanOrEqual(paneBox.y + paneBox.h);

  // Back from compose keeps the draft waiting (Drafts (1)) and returns to the list.
  await reading.getByRole('button', { name: 'Back to Inbox' }).click();
  await expect(list).toBeVisible();
  await outlook.getByRole('button', { name: 'Folders' }).click();
  await expect(
    outlook.getByRole('navigation', { name: 'Folders' }).getByRole('button', { name: 'Drafts, 1 item' }),
  ).toBeVisible();
  await expectFocusNotOnBody(page);
});

// --- WIN-OUT-06 -----------------------------------------------------------------------------------------------------

test('WIN-OUT-06 X1 axe clean: the reading pane, compose and the discard dialog', async ({ page }) => {
  test.slow(); // three full-page axe runs (WebKit is the slowest)
  const scan = async (label: string) => {
    await settle(page);
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(violations.map((violation) => `${label}: ${violation.id} ${violation.nodes[0]?.target}`)).toEqual([]);
  };
  const outlook = await openOutlook(page);
  const list = outlook.getByRole('list', { name: 'Messages' });
  await expect(list.getByRole('button')).toHaveCount(inbox.length);
  for (const message of inbox) await expect(list.getByRole('button', { name: rowName(message, true) })).toBeAttached();

  await list.getByRole('button', { name: rowName(cv, true) }).click();
  await expect(outlook.getByRole('heading', { level: 3, name: cv.subject })).toBeVisible();
  await scan('reading');

  await outlook.getByRole('button', { name: 'New mail' }).click();
  const form = outlook.getByRole('form', { name: 'New message' });
  await form.getByRole('textbox', { name: 'Message' }).fill('Hello');
  await scan('compose');

  await form.getByRole('button', { name: 'Discard' }).click();
  const dialog = outlook.getByRole('dialog', { name: 'Discard this draft?' });
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog.getByRole('button', { name: 'Keep' })).toBeFocused();
  await scan('dialog');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(form.getByRole('textbox', { name: 'Message' })).toHaveValue('Hello');
  await expect(form.getByRole('button', { name: 'Discard' })).toBeFocused();
});
