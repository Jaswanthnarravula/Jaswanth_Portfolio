/**
 * W2 (no-js project) — ARCH-NOJS-01 · ROUTE-PLAIN-01 · RES-NOJS-01: without JavaScript every page is complete,
 * readable semantic content; `/plain` never redirects; `/go/resume` offers the PDF.
 */
import { expect, test } from '@playwright/test';

const SECTIONS = ['About', 'Projects', 'Experience', 'Skills', 'Education', 'Résumé', 'Contact'];

test('/plain holds every section and never redirects', async ({ page }) => {
  const response = await page.goto('/plain');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/plain$/);
  for (const section of SECTIONS) await expect(page.getByRole('heading', { name: section, level: 2 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Enterprise SSO Identity Provider' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open PDF' }).first()).toHaveAttribute(
    'href',
    '/resume/jaswanth-narravula-resume.pdf',
  );
  await expect(page.getByRole('heading', { name: 'Legal & credits' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible();
});

test('/ draws the Hello in CSS and offers the portfolio, the résumé and the OSes as real links', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Jaswanth');
  // HELLO-DRAW-01: the stroke draw runs from first paint with no JavaScript and ends fully drawn.
  await expect(page.locator('[data-ink]')).toHaveCSS('stroke-dashoffset', '0px', { timeout: 6000 });
  await expect(page.getByRole('link', { name: /Skip the OS/ }).first()).toHaveAttribute('href', '/plain');
  await expect(page.getByRole('link', { name: 'Résumé', exact: true }).first()).toHaveAttribute('href', '/go/resume');
  // The pill is a real link to the chooser section; the no-JS chooser lists every visible OS as a link (CHOOSE-CARD-01 W2).
  await expect(page.getByRole('link', { name: 'Tap to begin' })).toHaveAttribute('href', '#begin');
  await page.getByRole('link', { name: 'Tap to begin' }).click();
  const chooser = page.getByRole('navigation', { name: 'Operating systems' });
  await expect(chooser).toBeVisible();
  for (const [name, href] of [
    ['iOS', '/ios'],
    ['macOS', '/macos'],
    ['Windows 11', '/windows'],
    ['Android', '/android'],
    ['Linux', '/linux'],
  ] as const)
    await expect(chooser.getByRole('link', { name: new RegExp(`^${name}\\b`) })).toHaveAttribute('href', href);
  await expect(page.getByRole('link', { name: 'Read the plain portfolio' })).toHaveAttribute('href', '/plain');
  // The JavaScript-only controls never appear without JavaScript.
  await expect(page.getByRole('button', { name: 'Tap to begin' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Sound' })).toBeHidden();
});

test('/go/resume offers the PDF (open + download) and the pages', async ({ page }) => {
  await page.goto('/go/resume');
  await expect(page).toHaveURL(/\/go\/resume$/);
  await expect(page.getByRole('heading', { name: 'Résumé', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open PDF' })).toHaveAttribute(
    'href',
    '/resume/jaswanth-narravula-resume.pdf',
  );
  const download = page.getByRole('link', { name: /Download/ });
  await expect(download).toHaveAttribute('download', 'Jaswanth-Resume.pdf');
  await expect(download).toContainText('PDF, 13 KB');
  await expect(page.getByRole('article', { name: /résumé/ })).toBeVisible();
});

test.describe('every /go section and one deep link per OS is complete without JavaScript', () => {
  for (const path of [
    '/go/about',
    '/go/projects',
    '/go/projects/loan-processing',
    '/go/experience',
    '/go/experience/xclusive-trading',
    '/go/education',
    '/go/skills',
    '/go/contact',
  ]) {
    test(path, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      expect((await page.locator('main').innerText()).length).toBeGreaterThan(80);
    });
  }
  for (const path of [
    '/macos/finder/experience/ibm',
    '/windows/edge/resume',
    '/ios/github/enterprise-sso',
    '/android/files/education',
    '/linux/viewer/projects/portfolio-os',
  ]) {
    test(path, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.locator('.doc-notice')).toContainText('when JavaScript is available');
    });
  }
});

test('unknown routes are a real 404 with a way back', async ({ page }) => {
  const response = await page.goto('/macos/nope/nope');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('link', { name: 'Read the plain portfolio' })).toBeVisible();
});
