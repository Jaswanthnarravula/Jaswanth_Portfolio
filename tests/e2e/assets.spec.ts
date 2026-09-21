/**
 * ASSET-MODE-01 (journeys pass in both modes) · ASSET-MODE-02 (no official requests in original mode) ·
 * ASSET-BOX-01 / DS-ICONBOX-01 (identical boxes → zero layout shift when the mode flips).
 * The official build serves :3000; the `asset-original` project runs this file against the original build on :3001.
 */
import { expect, test, type Page } from '@playwright/test';
import { isOriginalMode, waitForOs } from './helpers';

const ORIGINAL = process.env.TEST_BASE_URL_ORIGINAL ?? 'http://localhost:3001';
const OFFICIAL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

async function iconBoxes(page: Page) {
  return page.locator('[data-asset]').evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        id: node.getAttribute('data-asset'),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      };
    }),
  );
}

test('the stub OS journey works and icons render in this build’s asset mode', async ({ page }, info) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));
  await page.goto('/macos');
  await waitForOs(page, 'macos');
  const modes = await page
    .locator('[data-asset]')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-asset-mode')));
  expect(modes.length).toBeGreaterThan(0);
  expect(new Set(modes)).toEqual(new Set([isOriginalMode(info) ? 'original' : 'official']));
  await page.getByRole('link', { name: 'Finder' }).click();
  await expect(page.getByRole('region', { name: 'Finder' })).toBeFocused();
  const official = requests.filter((path) => path.startsWith('/assets/official/'));
  if (isOriginalMode(info)) expect(official).toEqual([]);
  else expect(official.length).toBeGreaterThan(0);
});

test('switching the asset mode never shifts layout (identical boxes)', async ({ browser }, info) => {
  test.skip(info.project.name !== 'chromium-desktop', 'compares the two production builds once');
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${OFFICIAL}/macos`);
  await waitForOs(page, 'macos');
  const official = await iconBoxes(page);
  await page.goto(`${ORIGINAL}/macos`);
  await waitForOs(page, 'macos');
  const original = await iconBoxes(page);
  expect(original).toEqual(official);
  await context.close();
});
