/**
 * DATA-SCHEMA-01 — slug unions are derived from the data, so an invalid slug reference is a compile error. The
 * `@ts-expect-error` lines are the test: `npm run typecheck` fails if any of them ever type-checks.
 */
import { describe, expect, it } from 'vitest';
import type { EducationSlug, ExperienceSlug, PortfolioRef, ProjectSlug } from '@/data/content-index';
import { getProject } from '@/data/selectors';

describe('DATA-SCHEMA-01 typed schema + slug unions', () => {
  it('valid references compile and resolve', () => {
    const refs: PortfolioRef[] = [
      { section: 'projects', slug: 'enterprise-sso' },
      { section: 'experience', slug: 'ibm' },
      { section: 'education', slug: 'uab' },
      { section: 'resume' },
    ];
    expect(refs).toHaveLength(4);
    expect(getProject('enterprise-sso')?.slug).toBe('enterprise-sso');
  });

  it('invalid slug references fail tsc', () => {
    // @ts-expect-error — not a project in data/portfolio.ts
    const project: ProjectSlug = 'not-a-project';
    // @ts-expect-error — a project slug is not an experience slug
    const experience: ExperienceSlug = 'enterprise-sso';
    // @ts-expect-error — unknown education slug
    const education: EducationSlug = 'mit';
    // @ts-expect-error — a singleton section never carries a slug
    const singleton: PortfolioRef = { section: 'about', slug: 'x' };
    // @ts-expect-error — a slug from another collection
    const crossed: PortfolioRef = { section: 'projects', slug: 'ibm' };
    // @ts-expect-error — selectors only accept known slugs
    getProject('missing');
    expect([project, experience, education, singleton, crossed]).toHaveLength(5);
  });
});
