import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { committed, expectFocusNotOnBody, isTouchProject, waitForOs } from './helpers';

const shell = (page: Page) => page.locator('[data-linux]');
const terminal = (page: Page) => shell(page).getByRole('region', { name: 'Terminal' });
const prompt = (page: Page) => terminal(page).getByRole('textbox', { name: /^Command, current directory/ });
// The compact viewer intentionally removes the terminal tile from the
// accessibility tree. Use the stable DOM hook so its restored transcript can
// still be asserted while the viewer owns the small-screen surface.
const output = (page: Page) => shell(page).locator('[data-scrollback]');

async function openLinux(page: Page) {
  await page.goto('/linux');
  await waitForOs(page, 'linux');
  await expect(shell(page)).toBeVisible();
  await expect(terminal(page).locator('[data-terminal]')).toHaveAttribute('data-ready');
}

async function run(page: Page, command: string) {
  await prompt(page).fill(command);
  await prompt(page).press('Enter');
}

test('L1 command suite, cwd routing, exact errors and viewer continuity @smoke', async ({ page }) => {
  await openLinux(page);
  await expect(prompt(page)).toHaveAttribute('aria-label', 'Command, current directory ~');
  await expect(terminal(page).locator('form [aria-hidden="true"]').first()).toHaveText('jaswanth@portfolio:~$');

  await run(page, 'cd projects && ls | head -3');
  await expect(page).toHaveURL(/\/linux\/terminal\/projects$/);
  await expect(prompt(page)).toHaveAttribute('aria-label', 'Command, current directory ~/projects');
  await expect(output(page)).toContainText('.md');

  await run(page, 'projcts');
  await expect(output(page)).toContainText('bash: projcts: command not found');
  await expect(output(page)).toContainText("Did you mean 'projects'?");

  await run(page, 'open enterprise-sso');
  await expect(page).toHaveURL(/\/linux\/viewer\/projects\/enterprise-sso$/);
  const viewer = shell(page).getByRole('region', { name: /viewer .* projects\/enterprise-sso\.md/i });
  await expect(viewer).toBeVisible();
  await expect(output(page)).toContainText('Opening enterprise-sso.md');
  await expect(viewer.getByRole('heading', { level: 2 })).toBeFocused();
  await viewer.getByRole('region', { name: 'Viewer document' }).press('q');
  await expect(viewer).toHaveCount(0);
  await expect(prompt(page)).toBeFocused();
  await expectFocusNotOnBody(page);
});

test('L2 MOTD and search entries insert but never execute', async ({ page }) => {
  await openLinux(page);
  const resume = terminal(page).getByRole('button', { name: 'Insert command: open resume' });
  await resume.click();
  await expect(prompt(page)).toHaveValue('open resume');
  await expect(page).toHaveURL(/\/linux$/);
  await expect(shell(page).locator('[data-viewer]')).toHaveCount(0);
  await prompt(page).fill('search typescript');
  await prompt(page).press('Enter');
  const result = output(page)
    .getByRole('button', { name: /Insert command:/ })
    .last();
  await result.click();
  await expect(prompt(page)).not.toHaveValue('');
  await expect(shell(page).locator('[data-viewer]')).toHaveCount(0);
});

test('H1/D1 Back and deep links reconcile without re-executing commands', async ({ page }) => {
  await openLinux(page);
  await run(page, 'cd projects');
  await expect(page).toHaveURL(/\/linux\/terminal\/projects$/);
  const before = await output(page).locator('[data-echo]').count();
  await page.goBack();
  await expect(page).toHaveURL(/\/linux$/);
  await expect(prompt(page)).toHaveAttribute('aria-label', 'Command, current directory ~');
  expect(await output(page).locator('[data-echo]').count()).toBe(before);

  await page.goto('/linux/viewer/resume');
  await waitForOs(page, 'linux');
  await expect(shell(page).getByRole('region', { name: /viewer — resume\.pdf/i })).toBeVisible();
  await expect(output(page)).toContainText('open resume');
  await expect(output(page)).toContainText('session restored');
});

test('Q1 résumé is one action away and shell is axe clean', async ({ page }) => {
  await openLinux(page);
  await shell(page).getByRole('link', { name: 'Résumé (PDF)' }).click();
  await expect(page).toHaveURL(/\/linux\/viewer\/resume$/);
  await expect(shell(page).getByRole('region', { name: /viewer — resume\.pdf/i })).toBeVisible();
  const audit = await new AxeBuilder({ page }).analyze();
  expect(audit.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
});

test('LNX-ID-03/A11Y-06 light and dark themes remain contrast-clean at 200% text', async ({ page }, info) => {
  test.skip(isTouchProject(info), 'desktop accessibility posture only');
  await openLinux(page);
  for (const theme of ['light', 'dark']) {
    await run(page, `theme ${theme}`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await shell(page).getByRole('link', { name: /PDF/ }).click();
    const audit = await new AxeBuilder({ page }).analyze();
    expect(audit.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
    await shell(page).getByRole('region', { name: 'Viewer document' }).press('Escape');
  }
  await page.locator('html').evaluate((root) => root.style.setProperty('--text-scale', '2'));
  await expect.poll(() => shell(page).evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  const fieldBox = await prompt(page).boundingBox();
  const shellBox = await shell(page).boundingBox();
  expect(fieldBox && shellBox && fieldBox.y + fieldBox.height <= shellBox.y + shellBox.height).toBe(true);
});

test('L3 touch prompt keeps native attributes and accessory keys insert without submitting', async ({ page }, info) => {
  test.skip(!isTouchProject(info), 'touch posture only');
  await openLinux(page);
  const field = prompt(page);
  await expect(field).not.toBeFocused();
  await expect(field).toHaveAttribute('inputmode', 'text');
  await expect(field).toHaveAttribute('enterkeyhint', 'send');
  await expect(field).toHaveAttribute('autocapitalize', 'none');
  await shell(page).getByRole('button', { name: 'tap here to type' }).click();
  const keys = terminal(page).getByRole('toolbar', { name: 'Terminal keys' });
  await expect(keys).toBeVisible();
  await keys.getByRole('button', { name: 'Slash' }).click();
  await expect(field).toHaveValue('/');
  await expect(output(page).locator('[data-echo]')).toHaveCount(0);
  await field.fill('whoa');
  await keys.getByRole('button', { name: 'Tab (complete)' }).dispatchEvent('click');
  await expect(field).toHaveValue('whoami ');
  await expect(field).toBeFocused();
  await committed(page);
  await expectFocusNotOnBody(page);
});

test('plain command opens the reader portfolio', async ({ page }) => {
  await openLinux(page);
  await run(page, 'plain');
  await expect(page).toHaveURL(/\/plain$/);
});

test('LNX-OUT-04 preserves reading position and offers the new-output chip', async ({ page }, info) => {
  test.skip(isTouchProject(info), 'desktop scroll posture only');
  await openLinux(page);
  for (let index = 0; index < 5; index += 1) await run(page, 'help');
  const field = prompt(page);
  await field.fill('whoami');
  const scroller = terminal(page).getByRole('region', { name: 'Terminal output' });
  await scroller.evaluate((node) => {
    node.scrollTop = 0;
    node.dispatchEvent(new Event('scroll'));
  });
  const before = await scroller.evaluate((node) => node.scrollTop);
  await field.press('Enter');
  await expect(terminal(page).getByRole('button', { name: '↓ new output' })).toBeVisible();
  expect(await scroller.evaluate((node) => node.scrollTop)).toBe(before);
  await terminal(page).getByRole('button', { name: '↓ new output' }).click();
  await expect(terminal(page).getByRole('button', { name: '↓ new output' })).toHaveCount(0);
});

test('LNX-X-06 exit closes the viewer layer before leaving Linux', async ({ page }) => {
  await openLinux(page);
  await run(page, 'open resume');
  await expect(shell(page).locator('[data-viewer]')).toBeVisible();
  await shell(page).getByRole('button', { name: 'exit' }).click();
  await expect(shell(page).locator('[data-viewer]')).toHaveCount(0);
  await expect(page).toHaveURL(/\/linux(?:\/terminal(?:\/.*)?)?$/);
  await shell(page).getByRole('button', { name: 'exit' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('LNX-CASE-04 switching away mid-output and Back restores cwd, scrollback and draft', async ({ page }, info) => {
  test.skip(isTouchProject(info), 'keyboard switch posture only');
  await openLinux(page);
  await run(page, 'cd projects');
  await run(page, 'help');
  await expect(output(page)).toContainText('Explore');
  await prompt(page).fill('unfinished command');
  await prompt(page).press('Alt+Shift+s');
  await expect(page).toHaveURL(/\/$/);
  await page.goBack();
  await waitForOs(page, 'linux');
  await expect(prompt(page)).toHaveAttribute('aria-label', 'Command, current directory ~/projects');
  await expect(prompt(page)).toHaveValue('unfinished command');
  await expect(output(page)).toContainText('Explore');
  await expect(output(page)).toContainText('session restored');
  await expect(shell(page).locator('[data-linux-boot]')).toHaveCount(0);
});

test('viewer single-key navigation and keyboard divider alternative work @smoke', async ({ page }, info) => {
  test.skip(isTouchProject(info), 'desktop tiled posture only');
  await openLinux(page);
  await page.waitForTimeout(120);
  const rewraps = Number((await shell(page).getAttribute('data-rewraps')) ?? 0);
  await run(page, 'open projects/enterprise-sso');
  const viewer = shell(page).locator('[data-viewer]');
  await expect(viewer).toBeVisible();
  if (await shell(page).getAttribute('data-splitting')) {
    expect(Number((await shell(page).getAttribute('data-rewraps')) ?? 0)).toBe(rewraps);
    await expect(shell(page)).not.toHaveAttribute('data-splitting');
    await expect.poll(async () => Number((await shell(page).getAttribute('data-rewraps')) ?? 0)).toBe(rewraps + 1);
  }
  const separator = shell(page).getByRole('separator', { name: 'Resize terminal and viewer' });
  await expect(separator).toHaveAttribute('aria-valuenow', '56');
  await separator.press('Alt+Shift+ArrowRight');
  await expect(separator).toHaveAttribute('aria-valuenow', '61');
  const box = await separator.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 80, box.y + box.height / 2, { steps: 4 });
    await page.mouse.up();
    await expect(separator).not.toHaveAttribute('aria-valuenow', '61');
  }
  await prompt(page).press('Alt+Shift+n');
  await expect(viewer.getByRole('heading', { level: 2 })).toBeFocused();
  await viewer.getByRole('heading', { level: 2 }).press('Alt+Shift+p');
  await expect(prompt(page)).toBeFocused();
  const firstUrl = page.url();
  await viewer.getByRole('region', { name: 'Viewer document' }).press('n');
  await expect(page).not.toHaveURL(firstUrl);
  await viewer.getByRole('region', { name: 'Viewer document' }).press('Escape');
  await expect(viewer).toHaveCount(0);
  await expect(prompt(page)).toBeFocused();
});

test('LNX-RESP-03/07 visual viewport and rotation preserve the draft and viewer', async ({ page }, info) => {
  test.skip(!isTouchProject(info), 'touch posture only');
  await openLinux(page);
  const field = prompt(page);
  await field.fill('open resume');
  await page.evaluate(() => {
    if (!window.visualViewport) return;
    Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 360 });
    Object.defineProperty(window.visualViewport, 'offsetTop', { configurable: true, value: 7 });
    window.visualViewport.dispatchEvent(new Event('resize'));
  });
  await expect(shell(page)).toHaveCSS('--vvh', '360px');
  await expect(shell(page)).toHaveCSS('--vv-top', '7px');
  await shell(page).getByRole('link', { name: /PDF/ }).click();
  const viewer = shell(page).locator('[data-viewer]');
  await expect(viewer).toBeVisible();
  const viewport = page.viewportSize();
  if (viewport) await page.setViewportSize({ width: viewport.height, height: viewport.width });
  await expect(viewer).toBeVisible();
  await expect(shell(page).locator('input[data-focus-key="window:linux:terminal"]')).toHaveValue('open resume');
});
