/**
 * Playwright project matrix — shared/12 `TEST-MATRIX-01`.
 *   PR gate: chromium-desktop 1440×900 · iphone (WebKit) · pixel (Chromium) · reduced-motion · no-js · perf ·
 *            asset-original (a second production build with NEXT_PUBLIC_ASSET_MODE=original, served on :3001)
 *   Smoke on PR, full nightly: firefox-desktop 1366×768 · ipad-portrait · ipad-landscape
 *   Nightly: webkit-desktop · iphone-landscape · forced-colors + contrast:more · visual · leak
 * Always against production builds (`npm run test:e2e:build`), never the dev server.
 */
import { defineConfig, devices } from '@playwright/test';

const nightly = process.env.NIGHTLY === '1';
const remote = process.env.TEST_BASE_URL;
/** Local ports (override with E2E_PORT to run beside other servers on a shared machine: official, +1, +2). */
const PORT = Number(process.env.E2E_PORT ?? 3000);
const OFFICIAL = remote ?? `http://localhost:${PORT}`;
const ORIGINAL = process.env.TEST_BASE_URL_ORIGINAL ?? `http://localhost:${PORT + 1}`;
/** A real production build (no preview OSes; analytics on) for the production-only assertions (shared/18, shared/13). */
export const PRODUCTION = process.env.TEST_BASE_URL_PRODUCTION ?? `http://localhost:${PORT + 2}`;

/** Specs that only run in their dedicated project. */
const DEDICATED = [
  '**/no-js.spec.ts',
  '**/performance.spec.ts',
  '**/production.spec.ts',
  '**/visual.spec.ts',
  '**/leak.spec.ts',
];
const journeys = { testIgnore: DEDICATED };
const smoke = nightly ? {} : { grep: /@smoke/ };

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 45_000,
  expect: { timeout: 7_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: OFFICIAL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: remote
    ? undefined
    : [
        {
          command: `node scripts/e2e-serve.mjs .next ${PORT}`,
          url: OFFICIAL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: `node scripts/e2e-serve.mjs .next-original ${PORT + 1}`,
          url: ORIGINAL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: `node scripts/e2e-serve.mjs .next-production ${PORT + 2}`,
          url: PRODUCTION,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      ...journeys,
    },
    { name: 'iphone', use: { ...devices['iPhone 13'] }, ...journeys },
    { name: 'pixel', use: { ...devices['Pixel 7'] }, ...journeys },
    { name: 'reduced-motion', use: { ...devices['Desktop Chrome'], reducedMotion: 'reduce' }, ...journeys },
    { name: 'no-js', use: { ...devices['Desktop Chrome'], javaScriptEnabled: false }, testMatch: '**/no-js.spec.ts' },
    {
      name: 'perf',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['**/performance.spec.ts', '**/production.spec.ts'],
    },
    { name: 'asset-original', use: { ...devices['Desktop Chrome'], baseURL: ORIGINAL }, ...journeys },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1366, height: 768 } },
      ...journeys,
      ...smoke,
    },
    { name: 'ipad-portrait', use: { ...devices['iPad (gen 7)'] }, ...journeys, ...smoke },
    { name: 'ipad-landscape', use: { ...devices['iPad (gen 7) landscape'] }, ...journeys, ...smoke },
    ...(nightly
      ? [
          { name: 'webkit-desktop', use: { ...devices['Desktop Safari'] }, ...journeys },
          { name: 'iphone-landscape', use: { ...devices['iPhone 13 landscape'] }, ...journeys },
          {
            name: 'forced-colors',
            use: { ...devices['Desktop Chrome'], forcedColors: 'active' as const, contrast: 'more' as const },
            ...journeys,
          },
          { name: 'visual', use: { ...devices['Desktop Chrome'] }, testMatch: '**/visual.spec.ts' },
          { name: 'leak', use: { ...devices['Desktop Chrome'] }, testMatch: '**/leak.spec.ts' },
        ]
      : []),
  ],
});
