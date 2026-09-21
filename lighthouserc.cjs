/**
 * Lighthouse CI — plans/shared/12 "Performance assertions" with the budgets of plans/shared/10.
 * Always a production build (`next start`, never the dev server), three runs per URL, median, mobile preset.
 * One deep link per OS joins `URLS` (and the desktop preset run for macOS/Windows) as each OS is released.
 * INP is not measured here — Lighthouse navigation mode cannot; the Playwright `perf` project owns it.
 * Reports stay on disk (`.lighthouseci/`); nothing is uploaded to public storage. Set LHCI_BASE_URL to audit a deployed
 * preview instead of the local build (the nightly workflow does).
 *
 * Assertion levels follow ledger ownership. Errors now: accessibility ≥ 0.95, CLS ≤ 0.1 (VIEW-MEDIA-01),
 * meta-viewport (ARCH-FIX-01). LCP, TBT and the per-route script budgets are owned by PERF-LCP-01 / PERF-BUDGET-01 /
 * TEST-PERF-01 (P1, which rebuilds `/`); they report as warnings until P1 sets `PHASE_ONE_DONE` below to true.
 */
const KB = 1024;
const PORT = 3000;
const REMOTE = process.env.LHCI_BASE_URL ? process.env.LHCI_BASE_URL.replace(/\/+$/, '') : null;
const BASE = REMOTE ?? `http://localhost:${PORT}`;
const PHASE_ONE_DONE = false;
const p1 = PHASE_ONE_DONE ? 'error' : 'warn';

/** Routes that exist in every phase: the welcome page, the reader, a project deep link (CLS: VIEW-MEDIA-01). */
const URLS = ['/', '/plain', '/go/projects/enterprise-sso', '/go/resume'];

const everywhere = {
  'categories:accessibility': ['error', { minScore: 0.95 }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.1, aggregationMethod: 'median' }],
  'meta-viewport': ['error', { minScore: 1 }],
  'largest-contentful-paint': [p1, { maxNumericValue: 2500, aggregationMethod: 'median' }],
  'total-blocking-time': [p1, { maxNumericValue: 200, aggregationMethod: 'median' }],
};

/** shared/10 "JavaScript budgets" (gzip transfer): welcome first load ≤ 130 KB; any OS first load ≤ 200 KB. */
const scriptBudget = (kb) => ({
  'resource-summary:script:size': [p1, { maxNumericValue: kb * KB, aggregationMethod: 'median' }],
});

const localServer = {
  startServerCommand: `node scripts/e2e-serve.mjs .next ${PORT}`,
  startServerReadyPattern: 'Ready',
  startServerReadyTimeout: 60_000,
};

module.exports = {
  ci: {
    collect: {
      ...(REMOTE ? {} : localServer),
      url: URLS.map((path) => `${BASE}${path}`),
      numberOfRuns: 3,
    },
    assert: {
      assertMatrix: [
        { matchingUrlPattern: '.*', assertions: everywhere },
        { matchingUrlPattern: '^https?://[^/]+/(plain)?$', assertions: scriptBudget(130) },
        { matchingUrlPattern: '^https?://[^/]+/go/', assertions: scriptBudget(200) },
      ],
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci/reports' },
  },
};
