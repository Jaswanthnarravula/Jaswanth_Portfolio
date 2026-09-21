/**
 * TEST-MATRIX-01 — the Playwright project matrix matches the table in plans/shared/12-testing.md: PR-gate projects
 * always run, smoke projects run `@smoke` on PR and everything nightly, nightly-only projects appear only nightly.
 */
import { readFileSync } from 'node:fs';
import type {
  PlaywrightTestConfig,
  PlaywrightTestOptions,
  PlaywrightWorkerOptions,
  Project as AnyProject,
} from '@playwright/test';
import { afterEach, describe, expect, it, vi } from 'vitest';

type Tier = 'pr' | 'smoke' | 'nightly';
type Project = AnyProject<PlaywrightTestOptions, PlaywrightWorkerOptions>;

/** Project names per tier, read from the plan's "Playwright project matrix" table. */
function plannedMatrix(): Record<Tier, string[]> {
  const plan = readFileSync('plans/shared/12-testing.md', 'utf8');
  const table = plan.slice(plan.indexOf('### Playwright project matrix'), plan.indexOf('### Gates'));
  const tiers: Record<Tier, string[]> = { pr: [], smoke: [], nightly: [] };
  for (const row of table.split('\n').filter((line) => line.startsWith('| `'))) {
    const [projects = '', runs = ''] = row.split('|').slice(1, 3);
    const tier: Tier = /PR gate/.test(runs) ? 'pr' : /smoke on PR/.test(runs) ? 'smoke' : 'nightly';
    tiers[tier] = [...projects.matchAll(/`([a-z][a-z0-9-]*)`/g)].map((match) => match[1]!);
  }
  return tiers;
}

async function loadConfig(nightly: boolean): Promise<Project[]> {
  vi.resetModules();
  vi.stubEnv('NIGHTLY', nightly ? '1' : '');
  vi.stubEnv('TEST_BASE_URL', '');
  const config = (await import('../../playwright.config')).default as PlaywrightTestConfig<
    PlaywrightTestOptions,
    PlaywrightWorkerOptions
  >;
  return config.projects ?? [];
}

const byName = (projects: Project[], name: string) => projects.find((project) => project.name === name)!;

describe('TEST-MATRIX-01 matrix config matches shared/12', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  const plan = plannedMatrix();

  it('the plan table lists every tier', () => {
    expect(plan.pr).toEqual([
      'chromium-desktop',
      'iphone',
      'pixel',
      'reduced-motion',
      'no-js',
      'perf',
      'asset-original',
    ]);
    expect(plan.smoke).toEqual(['firefox-desktop', 'ipad-portrait', 'ipad-landscape']);
    expect(plan.nightly).toEqual(['webkit-desktop', 'iphone-landscape', 'forced-colors', 'visual', 'leak']);
  });

  it('PR runs the gate projects in full and the smoke projects on @smoke only', async () => {
    const projects = await loadConfig(false);
    expect(projects.map((project) => project.name).sort()).toEqual([...plan.pr, ...plan.smoke].sort());
    for (const name of plan.pr) expect(byName(projects, name).grep, name).toBeUndefined();
    for (const name of plan.smoke) expect(byName(projects, name).grep, name).toEqual(/@smoke/);
  });

  it('nightly runs everything in full', async () => {
    const projects = await loadConfig(true);
    expect(projects.map((project) => project.name).sort()).toEqual([...plan.pr, ...plan.smoke, ...plan.nightly].sort());
    for (const project of projects) expect(project.grep, project.name).toBeUndefined();
  });

  it('each project emulates what the plan names', async () => {
    const projects = await loadConfig(true);
    expect(byName(projects, 'chromium-desktop').use?.viewport).toEqual({ width: 1440, height: 900 });
    expect(byName(projects, 'firefox-desktop').use?.viewport).toEqual({ width: 1366, height: 768 });
    expect(byName(projects, 'firefox-desktop').use?.defaultBrowserType).toBe('firefox');
    expect(byName(projects, 'iphone').use?.defaultBrowserType).toBe('webkit');
    expect(byName(projects, 'pixel').use?.defaultBrowserType).toBe('chromium');
    expect(byName(projects, 'webkit-desktop').use?.defaultBrowserType).toBe('webkit');
    expect(byName(projects, 'ipad-landscape').use?.viewport?.width).toBeGreaterThan(
      byName(projects, 'ipad-portrait').use?.viewport?.width ?? Infinity,
    );
    expect(byName(projects, 'reduced-motion').use?.reducedMotion).toBe('reduce');
    expect(byName(projects, 'no-js').use?.javaScriptEnabled).toBe(false);
    expect(byName(projects, 'forced-colors').use).toMatchObject({ forcedColors: 'active', contrast: 'more' });
    expect(byName(projects, 'asset-original').use?.baseURL).toBe('http://localhost:3001');
  });
});
