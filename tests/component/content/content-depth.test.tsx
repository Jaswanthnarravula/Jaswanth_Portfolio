/**
 * shared/23 content depth — the shared views and text renderers: CONTENT-GLANCE-01, CONTENT-NOW-01,
 * CONTENT-SCOPE-01, CONTENT-CASE-01, CONTENT-DIVE-01, and the rendered halves of CONTENT-CRED-01 / CONTENT-SKILL-01.
 * Runs on the real data (through the selectors), so what is asserted is what visitors read.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  AboutOverview,
  ContentFor,
  DeepDiveArticle,
  EducationList,
  ExperienceDetail,
  ProjectCaseStudy,
  ProjectDetail,
  SkillsMatrix,
  renderText,
} from '@/components/content';
import {
  getCredentials,
  getCurrentRole,
  getEducation,
  getExperienceEntry,
  getFeaturedProjects,
  getPerson,
  getProject,
  getSkills,
} from '@/data/selectors';

const person = getPerson();
const sso = getProject('enterprise-sso')!;
const loan = getProject('loan-processing')!;
const asl = getProject('asl-gesture-recognition')!;
const about = { person, featured: getFeaturedProjects(), current: getCurrentRole() };
const widest = (lines: readonly string[]) => Math.max(...lines.map((line) => line.length));

describe('CONTENT-GLANCE-01 recruiter card', () => {
  it('renders target, experience, stack, strengths, location and availability as a description list', () => {
    render(<AboutOverview data={about} headingLevel={2} />);
    const card = screen.getByRole('region', { name: 'At a glance' });
    const terms = within(card)
      .getAllByRole('term')
      .map((term) => term.textContent);
    expect(terms).toEqual(['Target role', 'Experience', 'Core stack', 'Strengths', 'Location', 'Availability']);
    expect(card).toHaveTextContent('Backend Software Engineer · Software Engineer II');
    expect(card).toHaveTextContent('Two weeks’ notice');
    expect(card).toHaveTextContent('Open to relocate');
  });
  it('never mentions work authorization, in the card or the text form', () => {
    const { container } = render(<AboutOverview data={about} headingLevel={2} />);
    const text = `${container.textContent} ${renderText('about', about, 80).join(' ')}`.toLowerCase();
    for (const hidden of ['authorization', 'visa', 'sponsorship', 'gpa']) expect(text).not.toContain(hidden);
  });
  it('the about text form carries the card within 80 and 40 columns', () => {
    for (const width of [80, 40]) {
      const lines = renderText('about', about, width);
      expect(lines).toContain('AT A GLANCE');
      expect(lines.join(' ')).toContain('Availability: Two weeks’ notice');
      expect(widest(lines)).toBeLessThanOrEqual(width);
    }
  });
});

describe('CONTENT-NOW-01 Now note', () => {
  it('About shows the Now note with its date', () => {
    render(<AboutOverview data={about} headingLevel={2} />);
    expect(screen.getByText(/Building a clean-room OAuth\/OIDC provider in Go/)).toBeInTheDocument();
    expect(screen.getByText('(Updated Sep 2026)')).toBeInTheDocument();
  });
  it('the text form prints it', () => {
    expect(renderText('about', about, 80).join(' ')).toMatch(/Now: Building a clean-room OAuth\/OIDC provider/);
  });
});

describe('CONTENT-SCOPE-01 role scope', () => {
  it('the role detail shows the scope paragraph in its header', () => {
    render(<ExperienceDetail data={getExperienceEntry('ibm')!} headingLevel={3} />);
    expect(screen.getByText(/Seven-person IBM squad/).closest('header')).not.toBeNull();
  });
  it('the text renderer prints it within the width', () => {
    for (const width of [80, 40]) {
      const lines = renderText('experience-detail', getExperienceEntry('xclusive-trading')!, width);
      expect(lines.join(' ')).toContain('Scope: Eight-person engineering team');
      expect(widest(lines)).toBeLessThanOrEqual(width);
    }
  });
});

describe('CONTENT-CASE-01 case study', () => {
  it('renders the four parts in order, with rejected alternatives and result metrics', () => {
    render(<ProjectCaseStudy data={sso} headingLevel={4} />);
    expect(screen.getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent)).toEqual([
      'The problem',
      'My role',
      'Key decisions',
      'Results',
    ]);
    expect(screen.getByText(/^Rejected: Moving everything to a commercial IdP/)).toBeInTheDocument();
    const results = screen.getByRole('region', { name: 'Results' });
    expect(
      within(results)
        .getAllByRole('definition')
        .map((value) => value.textContent),
    ).toContain('~3,000');
  });
  it('renders nothing for a project without a case study', () => {
    const { container } = render(<ProjectCaseStudy data={asl} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('ProjectDetail appends it only with depth (reader pages), never by default (OS apps place it themselves)', () => {
    const { rerender } = render(<ProjectDetail data={{ project: loan }} headingLevel={2} />);
    expect(screen.queryByRole('heading', { name: 'Case study' })).toBeNull();
    rerender(<ProjectDetail data={{ project: loan, depth: true }} headingLevel={2} />);
    expect(screen.getByRole('heading', { level: 3, name: 'Case study' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: 'Key decisions' })).toBeInTheDocument();
  });
  it('ContentFor passes depth through for /go project pages', () => {
    render(<ContentFor target={{ section: 'projects', slug: 'enterprise-sso' }} headingLevel={1} depth />);
    expect(screen.getByRole('heading', { level: 2, name: 'Case study' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Deep dives' })).toBeInTheDocument();
  });
  it('the project text prints THE PROBLEM … RESULTS within the width', () => {
    for (const width of [80, 40]) {
      const lines = renderText('project-detail', { project: sso }, width);
      const order = ['THE PROBLEM', 'MY ROLE', 'KEY DECISIONS', 'RESULTS'].map((title) => lines.indexOf(title));
      expect(order.every((index, i) => index > 0 && (i === 0 || index > order[i - 1]!))).toBe(true);
      expect(widest(lines)).toBeLessThanOrEqual(width);
    }
  });
});

describe('CONTENT-DIVE-01 deep dives', () => {
  const dive = sso.deepDives![1]!;
  it('steps render as an ordered list after their lead-in paragraph', () => {
    render(<DeepDiveArticle data={dive} headingLevel={3} />);
    const article = screen.getByRole('article', { name: dive.title });
    const steps = within(article).getByRole('list');
    expect(steps.tagName).toBe('OL');
    expect(within(steps).getAllByRole('listitem')).toHaveLength(4);
  });
  it('the text form numbers the steps and stays within the width', () => {
    for (const width of [80, 40]) {
      const lines = renderText('deep-dive', dive, width);
      expect(lines[0]).toBe(width >= dive.title.length ? dive.title : lines[0]);
      expect(lines.some((line) => line.startsWith('1. Publish the new public key'))).toBe(true);
      expect(widest(lines)).toBeLessThanOrEqual(width);
    }
  });
});

describe('CONTENT-CRED-01 · CONTENT-SKILL-01 rendered', () => {
  it('a course never reads "certification"; verify links open safely', () => {
    render(<EducationList data={{ schools: getEducation(), credentials: getCredentials() }} headingLevel={3} />);
    const items = within(screen.getByRole('region', { name: 'Credentials' })).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('AWS Academy Cloud Architecting — AWS Academy · Course credential · Jan 2022');
    expect(items[0]).not.toHaveTextContent(/certification/i);
    const verify = within(items[0]!).getByRole('link', { name: /Verify/ });
    expect(verify).toHaveAttribute('rel', 'noopener noreferrer');
  });
  it('skill years read "1.5+ yrs" / "~1 yr"', () => {
    render(<SkillsMatrix data={getSkills()} headingLevel={3} />);
    expect(screen.getByText('Java 17').parentElement).toHaveTextContent('Java 17 · 1.5+ yrs');
    expect(screen.getByText('React').parentElement).toHaveTextContent('React · ~1 yr');
  });
});
