/**
 * shared/24 reader motion — the data half: READER-FX-12 (architecture flows come from project data and are complete)
 * and READER-FX-13 (before → after meters never invent a comparison).
 */
import { describe, expect, it } from 'vitest';
import { parseMeter } from '@/app/plain/meter';
import { portfolio } from '@/data/portfolio';
import type { Portfolio } from '@/data/schema';

const data: Portfolio = portfolio;

describe('READER-FX-12 architecture flows', () => {
  it('every featured case study has a flow, and every flow step is non-empty', () => {
    const featured = data.projects.filter((project) => project.featured && project.caseStudy);
    expect(featured.length).toBeGreaterThan(0);
    for (const project of featured) {
      const flow = project.caseStudy?.flow ?? [];
      expect(flow.length, project.slug).toBeGreaterThanOrEqual(3);
      for (const step of flow) {
        expect(step.label.trim(), project.slug).not.toBe('');
        expect(step.detail.trim(), project.slug).not.toBe('');
      }
      expect(new Set(flow.map((step) => step.label)).size, `${project.slug} labels are unique`).toBe(flow.length);
    }
  });
});

describe('READER-FX-13 before → after meters', () => {
  it('parses "4:20 → 1:45" as minutes and seconds', () => {
    const meter = parseMeter('4:20 → 1:45');
    expect(meter).toMatchObject({ before: 260, after: 105 });
    expect(meter?.ratio).toBeCloseTo(105 / 260);
  });
  it('parses "420 → 290 ms"', () => {
    expect(parseMeter('420 → 290 ms')).toMatchObject({ before: 420, after: 290 });
  });
  it('leaves values without a comparison alone', () => {
    for (const value of ['No logouts', '180–195 ms', '~3,000', '< 650 ms', 'Rerun-safe', '6'])
      expect(parseMeter(value), value).toBeNull();
  });
  it('never draws a meter that grows (only a shrinking number is a before → after gain here)', () => {
    expect(parseMeter('100 → 200 ms')).toBeNull();
  });
  it('every published "→" result either parses or is deliberately skipped', () => {
    const arrows = data.projects.flatMap((project) =>
      (project.caseStudy?.results ?? []).filter((result) => result.value.includes('→')),
    );
    for (const result of arrows) expect(parseMeter(result.value), result.value).not.toBeNull();
  });
});
