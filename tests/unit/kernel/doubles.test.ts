/**
 * TEST-DOUBLE-01 — the kernel runs headless: no Next, no React, no DOM. A full open → URL → Back loop is driven with
 * the memory `HistoryPort`, the no-op `AnalyticsPort`, a fixed clock and the deterministic portfolio fixture.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyticsPath, createNoopAdapter } from '@/lib/analytics';
import { createMemoryHistory } from '@/lib/kernel/history/adapters';
import { createHistoryController } from '@/lib/kernel/history/controller';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import { deriveRoute } from '@/lib/kernel/state';
import { routePath } from '@/lib/kernel/types';
import { booted, fixtureCodec, last, run } from '../../fixtures/portfolio';

const kernelSources = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? kernelSources(path) : entry.name.endsWith('.ts') ? [path] : [];
  });

describe('TEST-DOUBLE-01 kernel tests run without Next or DOM', () => {
  it('the unit project has no DOM', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it('no kernel module imports Next or React', () => {
    const sources = kernelSources('lib/kernel');
    expect(sources.length).toBeGreaterThan(20);
    for (const file of sources)
      expect(readFileSync(file, 'utf8'), file).not.toMatch(/from ['"](?:next|react|react-dom)(?:\/[^'"]*)?['"]/);
  });

  it('open → URL → Back runs end to end on the doubles', () => {
    const port = createMemoryHistory('/macos');
    const pops: string[] = [];
    let now = 0;
    const controller = createHistoryController({
      port,
      onPop: (url) => pops.push(url),
      now: () => now,
      schedule: () => () => undefined,
    });
    const record = { events: [], pageviews: [] };
    const analytics = createNoopAdapter(record);

    const state = last(run(booted('/macos'), [{ type: 'OPEN_APP', role: 'files' }])).state;
    const url = fixtureCodec.encode(deriveRoute(state));
    expect(url).toBe('/macos/finder');
    expect(controller.go(url)).toBe('push');
    analytics.pageview(analyticsPath(deriveRoute(state), OS_REGISTRY));
    expect(port.url()).toBe('/macos/finder');

    now += 1_000;
    expect(controller.go(routePath('/macos'))).toBe('back'); // back-collapse, not a new entry
    port.flush(); // traversal is asynchronous, as in a browser
    expect(port.url()).toBe('/macos');
    expect(port.entries).toHaveLength(2);
    expect(pops).toEqual([]); // the kernel's own echo is never reported as a visitor traversal
    expect(record.pageviews).toEqual(['/macos/files']); // canonical role form (shared/18), not the skin's app slug
  });
});
