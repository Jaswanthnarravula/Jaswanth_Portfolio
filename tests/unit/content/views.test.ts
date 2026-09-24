/**
 * VIEW-CAT-01 (views render in a server/node environment), VIEW-TEXT-01 (text snapshots at 80 and 40 columns),
 * DATA-EMPTY-01 (empty states), VIEW-CONTACT-01 (mailto encoding + copy fallback), VIEW-RESUME-01 (the published
 * PDF's pages + its own text).
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
  ResumePages,
  ResumeView,
  SkillsMatrix,
  copyText,
  mailtoUrl,
  renderText,
} from '@/components/content';
import type { ResumeBlock, ResumePage } from '@/data/schema';
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
/** The shape scripts/resume-pages.mjs extracts from a PDF. */
const resumeText: readonly ResumeBlock[] = [
  { kind: 'title', runs: [{ text: 'ADA LOVELACE', bold: true }] },
  { kind: 'text', runs: [{ text: 'London • ada@example.com • github.com/ada • Node.js' }] },
  { kind: 'heading', runs: [{ text: 'EXPERIENCE', bold: true }] },
  { kind: 'text', runs: [{ text: 'Analyst, Engine Co.', bold: true }], aside: 'Jan 1843 - Present' },
  { kind: 'item', runs: [{ text: 'Wrote the first program.' }] },
  { kind: 'item', runs: [{ text: 'Notes:', bold: true }, { text: ' on the Analytical Engine.' }] },
  { kind: 'heading', runs: [{ text: 'EDUCATION', bold: true }] },
  { kind: 'text', runs: [{ text: 'Private tutoring' }] },
];
const resumePages: readonly ResumePage[] = [
  {
    width: 816,
    height: 1056,
    srcset: [
      ['/resume/pages/abc-1-1224.png', 1224],
      ['/resume/pages/abc-1-1632.png', 1632],
    ],
  },
];

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
    ['ResumeDocument', () => html(ResumeDocument, resumeText)],
    ['ResumePages', () => renderToStaticMarkup(createElement(ResumePages, { pages: resumePages }))],
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

describe('VIEW-RESUME-01 the résumé is the published PDF: its pages and its own text', () => {
  it('the text version keeps the PDF structure: name, sections, dated rows, bullet lists', () => {
    const markup = html(ResumeDocument, resumeText);
    expect(markup).toContain('aria-label="ADA LOVELACE — résumé"');
    expect(markup).toContain('<h2 class="cv-doc-name"><strong>ADA LOVELACE</strong></h2>');
    expect(markup.match(/<h3 class="cv-doc-section">/g)).toHaveLength(2);
    expect(markup).toContain(
      '<p class="cv-doc-row"><span class="cv-doc-lead"><strong>Analyst, Engine Co.</strong></span><span class="cv-doc-aside">Jan 1843 - Present</span></p>',
    );
    expect(markup).toContain(
      '<ul><li>Wrote the first program.</li><li><strong>Notes:</strong> on the Analytical Engine.</li></ul>',
    );
    expect(markup).toContain('<p class="cv-doc-headline">London');
    expect(markup).toContain('<p>Private tutoring</p>');
  });
  it('addresses become links; other dotted words do not', () => {
    const markup = html(ResumeDocument, resumeText);
    expect(markup).toContain('<a href="mailto:ada@example.com">ada@example.com</a>');
    expect(markup).toContain(
      '<a href="https://github.com/ada" target="_blank" rel="noopener noreferrer">github.com/ada</a>',
    );
    expect(markup).not.toContain('href="https://Node.js"');
    expect(markup.match(/<a /g)).toHaveLength(2);
  });
  it('no extracted text renders nothing (the host keeps Open / Download)', () => {
    expect(html(ResumeDocument, [])).toBe('');
  });
  it('the pages are decorative images with every rendered width and fixed dimensions', () => {
    const markup = renderToStaticMarkup(createElement(ResumePages, { pages: resumePages, sizes: '600px' }));
    expect(markup).toContain('srcSet="/resume/pages/abc-1-1224.png 1224w, /resume/pages/abc-1-1632.png 1632w"');
    expect(markup).toContain('src="/resume/pages/abc-1-1632.png"');
    expect(markup).toContain('sizes="600px"');
    expect(markup).toContain('width="816" height="1056" alt=""');
  });
  it('without page images the fallback shows instead', () => {
    const markup = renderToStaticMarkup(
      createElement(ResumePages, { pages: [] }, createElement('a', { href: '/r.pdf' }, 'Open')),
    );
    expect(markup).toBe('<a href="/r.pdf">Open</a>');
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
