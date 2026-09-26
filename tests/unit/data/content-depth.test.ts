/**
 * shared/23 content depth — the data half: DATA-COPY-01 (owner-approved copy), CONTENT-INV-01 (invariants),
 * CONTENT-CRED-01 (credentials never overstated) and CONTENT-SKILL-01 (skill years and the evidence-only list).
 */
import { describe, expect, it } from 'vitest';
import { formatCredential, formatYears } from '@/components/content';
import { portfolio } from '@/data/portfolio';
import type { Portfolio } from '@/data/schema';

const data: Portfolio = portfolio;
const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const everyText = JSON.stringify(portfolio).toLowerCase();

describe('DATA-COPY-01 owner-approved copy', () => {
  it('carries the approved headline and puts Java 17 first', () => {
    expect(data.person.headline).toBe(
      'Backend Software Engineer — Java/Spring Boot and Go · distributed systems and identity',
    );
    expect(data.skills[0]?.items[0]?.name).toBe('Java 17');
    expect(data.person.glance?.coreStack[0]).toBe('Java 17');
  });
  it('states the before → after numbers the owner gave', () => {
    const summary = data.person.summary.join(' ');
    for (const figure of ['3+ years', '3,000', '4 min 20 s', '1 min 45 s', '420 ms', '290 ms'])
      expect(summary).toContain(figure);
  });
  it('labels projects the way the owner described them', () => {
    const context = (slug: string) => data.projects.find((project) => project.slug === slug)?.context;
    expect(context('price-intelligence')).toBe('Solo UAB project');
    expect(context('asl-gesture-recognition')).toBe('Solo course project · UAB');
    expect(context('workforce-management')).toBe('Xclusive Trading Inc.');
  });
  it('has no placeholder left', () => {
    expect(data.person.placeholder).toBeUndefined();
    for (const entry of [...data.experience, ...data.projects, ...data.education])
      expect(entry.placeholder, 'slug' in entry ? entry.slug : '').toBeUndefined();
  });
});

describe('CONTENT-INV-01 content-depth invariants', () => {
  it('every case study has all four parts, with non-empty text', () => {
    const studies = data.projects.flatMap((project) => (project.caseStudy ? [project.caseStudy] : []));
    expect(studies.length).toBeGreaterThanOrEqual(3);
    for (const study of studies) {
      expect(study.problem.length).toBeGreaterThan(0);
      expect(study.role.trim()).not.toBe('');
      expect(study.decisions.length).toBeGreaterThan(0);
      expect(study.results.length).toBeGreaterThan(0);
      for (const decision of study.decisions) {
        expect(decision.title.trim()).not.toBe('');
        expect(decision.detail.trim()).not.toBe('');
        if (decision.rejected !== undefined) expect(decision.rejected.trim()).not.toBe('');
      }
      for (const metric of study.results) {
        expect(metric.value.trim()).not.toBe('');
        expect(metric.label.trim()).not.toBe('');
      }
    }
  });
  it('deep-dive slugs are kebab-case and unique across all projects; every dive has text', () => {
    const dives = data.projects.flatMap((project) => project.deepDives ?? []);
    expect(dives.map((dive) => dive.slug)).toEqual([
      'why-we-built-our-own-idp',
      'rotating-signing-keys',
      'race-conditions-in-loan-approvals',
    ]);
    expect(new Set(dives.map((dive) => dive.slug)).size).toBe(dives.length);
    for (const dive of dives) {
      expect(dive.slug).toMatch(kebab);
      expect(dive.title.trim()).not.toBe('');
      expect(dive.summary.trim()).not.toBe('');
      expect(dive.blocks.length).toBeGreaterThan(0);
      for (const block of dive.blocks)
        if (block.kind === 'p') expect(block.text.trim()).not.toBe('');
        else expect(block.items.length).toBeGreaterThan(0);
    }
  });
  it('a metric quoted in a role bullet matches its project case study', () => {
    const pairs: [role: string, project: string, figures: string[]][] = [
      ['xclusive-trading', 'enterprise-sso', ['3,000', '1,200–1,800']],
      ['xclusive-trading', 'sales-platform', ['180–195 ms', '50M+']],
      ['ibm', 'loan-processing', ['420', '290', '650', '250–400']],
    ];
    for (const [roleSlug, projectSlug, figures] of pairs) {
      const role = JSON.stringify(data.experience.find((entry) => entry.slug === roleSlug));
      const project = JSON.stringify(data.projects.find((entry) => entry.slug === projectSlug));
      for (const figure of figures) {
        expect(role, `${roleSlug} ${figure}`).toContain(figure);
        expect(project, `${projectSlug} ${figure}`).toContain(figure);
      }
    }
  });
  it('the Now note and recruiter card are present, dated and complete', () => {
    expect(data.person.now?.text.trim()).not.toBe('');
    expect(data.person.now?.updated).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
    const glance = data.person.glance!;
    for (const list of [glance.targetRoles, glance.coreStack, glance.strengths, glance.workModes])
      expect(list.length).toBeGreaterThan(0);
    expect(glance.availability.trim()).not.toBe('');
  });
  it('facts the owner withheld appear nowhere in the data', () => {
    for (const hidden of ['work authorization', 'visa', 'opt', 'h-1b', 'sponsorship', 'gpa', 'recommendation'])
      expect(everyText).not.toMatch(new RegExp(`\\b${hidden}\\b`));
  });
  it('every role in a real company carries a scope paragraph', () => {
    for (const slug of ['xclusive-trading', 'ibm'])
      expect(data.experience.find((role) => role.slug === slug)?.scope?.trim()).toBeTruthy();
  });
});

describe('CONTENT-CRED-01 credentials are never overstated', () => {
  it('every credential has a kind and a status; AWS Academy items are courses', () => {
    for (const credential of data.credentials) {
      expect(['course', 'certification']).toContain(credential.kind);
      expect(['earned', 'in-progress']).toContain(credential.status);
      if (credential.issuer === 'AWS Academy') expect(credential.kind).toBe('course');
    }
  });
  it('a course never reads "certification"; an in-progress item shows its target', () => {
    for (const credential of data.credentials) {
      const label = formatCredential(credential);
      if (credential.kind === 'course') expect(label.toLowerCase()).not.toContain('certification');
      if (credential.status === 'in-progress') expect(label).toMatch(/in progress · target \w{3} \d{4}/);
    }
    expect(formatCredential({ name: 'X', issuer: 'Y', kind: 'course', status: 'earned', date: '2022-01' })).toBe(
      'Course credential · Jan 2022',
    );
    expect(
      formatCredential({ name: 'X', issuer: 'Y', kind: 'certification', status: 'in-progress', date: '2027-03' }),
    ).toBe('Certification · in progress · target Mar 2027');
  });
});

describe('CONTENT-SKILL-01 skill years and the evidence-only list', () => {
  it('years appear only on the skills the owner gave years for', () => {
    const withYears = data.skills
      .flatMap((group) => group.items)
      .filter((skill) => skill.years)
      .map((skill) => skill.name)
      .sort();
    expect(withYears).toEqual(
      [
        'Docker',
        'FastAPI',
        'GitHub Actions',
        'Go',
        'Java 17',
        'JWT (RS256 / JWKS)',
        'MySQL',
        'OAuth 2.1',
        'OpenID Connect',
        'PostgreSQL',
        'Python',
        'React',
        'Redis',
        'Spring Boot',
        'TypeScript',
      ].sort(),
    );
  });
  it('removed skills are gone', () => {
    const names = data.skills.flatMap((group) => group.items.map((skill) => skill.name));
    for (const removed of [
      'C',
      'C++',
      'Node.js',
      'Redux',
      'Tailwind CSS',
      'Selenium',
      'Bash',
      'Event-driven architecture',
    ])
      expect(names).not.toContain(removed);
  });
  it('formats years as stated: "1.5+ yrs", "1+ yr", "~1 yr", spelled out for accessible names', () => {
    expect(formatYears({ years: 1.5 })).toBe('1.5+ yrs');
    expect(formatYears({ years: 1 })).toBe('1+ yr');
    expect(formatYears({ years: 1, approx: true })).toBe('~1 yr');
    expect(formatYears({ years: 1.5 }, true)).toBe('1.5+ years');
    expect(formatYears({ years: 1, approx: true }, true)).toBe('about 1 year');
    expect(formatYears({})).toBeNull();
  });
});
