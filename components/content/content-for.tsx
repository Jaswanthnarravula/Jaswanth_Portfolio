/**
 * Maps any `ContentRef` to its view — used by the SSR semantic fallback, `/go/*`, `/plain` and OS apps that show a
 * section generically. Hook-free and server-renderable.
 */
import type { ContentRef } from '@/data/schema';
import { getResumeFileMeta, getResumePages, getResumeText, resolveContent } from '@/data/selectors';
import { AboutOverview } from './about';
import { ContactPanel } from './contact';
import { EducationDetail, EducationList, ExperienceDetail, ExperienceList } from './experience';
import { ProjectDetail, ProjectList } from './projects';
import { ResumeDocument, ResumePages, ResumeView } from './resume';
import { SkillsMatrix } from './skills';
import type { Density, HeadingLevel, ViewSlots } from './slots';
import type { TextViewData, ViewId } from './text';

export interface ContentForProps {
  readonly target: ContentRef;
  readonly density?: Density;
  readonly slots?: Partial<ViewSlots>;
  readonly headingLevel?: HeadingLevel;
  /** Show the résumé's pages (the published PDF) under the Open/Download actions. */
  readonly resumePages?: boolean;
}

/**
 * `headingLevel` is where a view's headings start: a detail view's title, or a list's item headings (lists have no
 * title of their own). The résumé pages nest one level below the Résumé title.
 */
const sub = (level: HeadingLevel): HeadingLevel => Math.min(level + 1, 4) as HeadingLevel;

export function ContentFor({ target, density, slots, headingLevel = 2, resumePages = true }: ContentForProps) {
  const content = resolveContent(target);
  const common = { density, slots, headingLevel };
  switch (content.section) {
    case 'about':
      return <AboutOverview data={content} {...common} />;
    case 'projects':
      return <ProjectList data={content.projects} {...common} />;
    case 'project':
      return <ProjectDetail data={content} {...common} />;
    case 'experience':
      return <ExperienceList data={content.roles} {...common} />;
    case 'role':
      return <ExperienceDetail data={content.role} {...common} />;
    case 'education':
      return <EducationList data={content} {...common} />;
    case 'school':
      return <EducationDetail data={content.school} {...common} />;
    case 'skills':
      return <SkillsMatrix data={content.groups} {...common} />;
    case 'resume':
      return (
        <>
          <ResumeView
            data={{ resume: content.resume, person: content.person, file: getResumeFileMeta() }}
            {...common}
          />
          {resumePages && (
            <div className="cv-resume-pages">
              {/* The PDF's own text first in DOM order (screen readers, search, no-JS); a keyboard user tabbing in sees it. */}
              <div className="cv-text-hidden cv-paper">
                <ResumeDocument data={getResumeText()} headingLevel={sub(headingLevel)} />
              </div>
              <ResumePages pages={getResumePages()} className="cv-pages" pageClassName="cv-page" />
            </div>
          )}
        </>
      );
    case 'contact':
      return <ContactPanel data={content} {...common} />;
    default: {
      const exhaustive: never = content;
      return exhaustive;
    }
  }
}

/** The text view + data for a ref (terminal output, screen-reader summaries). */
export function viewDataFor(
  target: ContentRef,
): { [K in ViewId]: { view: K; data: TextViewData[K] } }[Exclude<ViewId, 'legal'>] {
  const content = resolveContent(target);
  switch (content.section) {
    case 'about':
      return { view: 'about', data: content };
    case 'projects':
      return { view: 'project-list', data: content.projects };
    case 'project':
      return { view: 'project-detail', data: content };
    case 'experience':
      return { view: 'experience-list', data: content.roles };
    case 'role':
      return { view: 'experience-detail', data: content.role };
    case 'education':
      return { view: 'education-list', data: content };
    case 'school':
      return { view: 'education-detail', data: content.school };
    case 'skills':
      return { view: 'skills', data: content.groups };
    case 'resume':
      return { view: 'resume', data: { resume: content.resume, person: content.person, file: getResumeFileMeta() } };
    case 'contact':
      return { view: 'contact', data: content };
    default: {
      const exhaustive: never = content;
      return exhaustive;
    }
  }
}
