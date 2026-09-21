/**
 * VIEW-CAT-01 (views render in a server/node environment), VIEW-TEXT-01 (text snapshots at 80 and 40 columns),
 * DATA-EMPTY-01 (empty states), VIEW-CONTACT-01 (mailto encoding + copy fallback).
 */
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  AboutOverview,
  ContactPanel,
  EducationDetail,
  EducationList,
  ExperienceDetail,
  ExperienceList,
  LegalNotice,
  ProjectDetail,
  ProjectList,
  ResumeDocument,
  ResumeView,
  SkillsMatrix,
  copyText,
  mailtoUrl,
  renderText,
} from '@/components/content';
import { fixturePortfolio as p } from '../../fixtures/portfolio';

const html = <T>(View: ComponentType<{ data: T }>, data: T) => renderToStaticMarkup(createElement(View, { data }));
const legal = {
  credits: [
    {
      label: 'Finder',
      owner: 'Apple Inc.',
      sourceUrl: 'https://example.com',
      retrieved: '2026-09-21',
      terms: 'Used referentially.',
      derived: false,
    },
  ],
  contactEmail: p.contact.email,
  glyphCredit: 'Lucide (ISC)',
  assetMode: 'official' as const,
};
const resumeData = { resume: p.resume, person: p.person, file: { bytes: 13_245, pages: 2 } };

describe('VIEW-CAT-01 every catalogue view is hook-free and server-renderable', () => {
  it.each([
    ['AboutOverview', () => html(AboutOverview, { person: p.person, featured: p.projects, current: p.experience[0] })],
    ['ProjectList', () => html(ProjectList, p.projects)],
    ['ProjectDetail', () => html(ProjectDetail, { project: p.projects[0]! })],
    ['ExperienceList', () => html(ExperienceList, p.experience)],
    ['ExperienceDetail', () => html(ExperienceDetail, p.experience[0]!)],
    ['EducationList', () => html(EducationList, { schools: p.education, credentials: p.credentials })],
    ['EducationDetail', () => html(EducationDetail, p.education[0]!)],
    ['SkillsMatrix', () => html(SkillsMatrix, p.skills)],
    ['ResumeView', () => html(ResumeView, resumeData)],
    [
      'ResumeDocument',
      () =>
        html(ResumeDocument, {
          person: p.person,
          contact: p.contact,
          experience: p.experience,
          projects: p.projects,
          education: p.education,
          credentials: p.credentials,
          skills: p.skills,
        }),
    ],
    ['ContactPanel', () => html(ContactPanel, { contact: p.contact, person: p.person })],
    ['LegalNotice', () => html(LegalNotice, legal)],
  ])('%s renders in node', (_name, render) => {
    const markup = render();
    expect(markup.length).toBeGreaterThan(40);
    expect(markup).not.toContain('undefined');
  });

  it('the résumé Download action states type and size', () => {
    expect(html(ResumeView, resumeData)).toMatch(/Download.*PDF, 13 KB/);
    expect(html(ResumeView, { ...resumeData, file: null })).not.toContain('Download');
  });
});

describe('DATA-EMPTY-01 empty collections render an empty state', () => {
  it.each([
    ['ProjectList', () => html(ProjectList, [])],
    ['ExperienceList', () => html(ExperienceList, [])],
    ['EducationList', () => html(EducationList, { schools: [], credentials: [] })],
  ])('%s', (_name, render) => {
    expect(render()).toMatch(/role="status"[^>]*>No \w+ (are|is) listed yet/);
  });
});

describe('VIEW-TEXT-01 renderText for every view', () => {
  const cases = {
    about: { person: p.person, featured: p.projects.filter((x) => x.featured), current: p.experience[0] },
    'project-list': p.projects,
    'project-detail': { project: p.projects[0]! },
    'experience-list': p.experience,
    'experience-detail': p.experience[0]!,
    'education-list': { schools: p.education, credentials: p.credentials },
    'education-detail': p.education[0]!,
    skills: p.skills,
    resume: resumeData,
    contact: { contact: p.contact, person: p.person },
    legal,
  } as const;
  for (const width of [80, 40]) {
    it.each(Object.keys(cases) as (keyof typeof cases)[])(`%s at ${width} columns`, (view) => {
      const lines = renderText(view, cases[view] as never, width);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) expect(line.length).toBeLessThanOrEqual(width);
      expect(lines).toMatchSnapshot();
    });
  }
});

describe('VIEW-CONTACT-01 contact hand-off actions', () => {
  it('builds an encoded mailto URL', () => {
    expect(mailtoUrl({ email: 'ada@example.com' })).toBe('mailto:ada@example.com');
    expect(mailtoUrl({ email: 'ada@example.com', subject: 'Hello & welcome', body: 'Line 1\nLine 2 = ok?' })).toBe(
      'mailto:ada@example.com?subject=Hello%20%26%20welcome&body=Line%201%0D%0ALine%202%20%3D%20ok%3F',
    );
  });
  it('copy falls back when the clipboard rejects or is missing', async () => {
    expect(await copyText('x', { writeText: async () => undefined })).toBe('copied');
    expect(
      await copyText('x', {
        writeText: async () => {
          throw new DOMException('denied', 'NotAllowedError');
        },
      }),
    ).toBe('fallback');
    expect(await copyText('x', undefined)).toBe('fallback');
  });
  it('the panel links the email with mailto and opens profiles safely', () => {
    const markup = html(ContactPanel, { contact: p.contact, person: p.person });
    expect(markup).toContain('href="mailto:ada@example.com?subject=Hello%20Ada"');
    expect(markup).toContain('rel="noopener noreferrer"');
  });
});
