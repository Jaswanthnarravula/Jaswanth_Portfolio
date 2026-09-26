import type { DeepDive, Project } from '@/data/schema';
import { Heading, type ViewProps } from './slots';

/**
 * `ProjectCaseStudy` — shared/23 `CONTENT-CASE-01`: the problem → my role → key decisions → results, in that order.
 * `headingLevel` is the level of its four part headings. Renders nothing for a project without a case study.
 */
export function ProjectCaseStudy({ data: project, density = 'comfortable', headingLevel = 3 }: ViewProps<Project>) {
  const study = project.caseStudy;
  if (!study) return null;
  const id = (part: string) => `cv-case-${part}-${project.slug}`;
  return (
    <div className="cv cv-case" data-density={density}>
      <section className="cv-case-part" aria-labelledby={id('problem')}>
        <Heading level={headingLevel} id={id('problem')} className="cv-subtitle">
          The problem
        </Heading>
        <div className="cv-prose">
          {study.problem.map((paragraph) => (
            <p key={paragraph.slice(0, 32)}>{paragraph}</p>
          ))}
        </div>
      </section>
      <section className="cv-case-part" aria-labelledby={id('role')}>
        <Heading level={headingLevel} id={id('role')} className="cv-subtitle">
          My role
        </Heading>
        <p className="cv-case-role">{study.role}</p>
      </section>
      <section className="cv-case-part" aria-labelledby={id('decisions')}>
        <Heading level={headingLevel} id={id('decisions')} className="cv-subtitle">
          Key decisions
        </Heading>
        <ol className="cv-decisions" role="list">
          {study.decisions.map((decision) => (
            <li key={decision.title} className="cv-decision">
              <p className="cv-decision-title">{decision.title}</p>
              <p className="cv-decision-detail">{decision.detail}</p>
              {decision.rejected && <p className="cv-decision-rejected">Rejected: {decision.rejected}</p>}
            </li>
          ))}
        </ol>
      </section>
      <section className="cv-case-part" aria-labelledby={id('results')}>
        <Heading level={headingLevel} id={id('results')} className="cv-subtitle">
          Results
        </Heading>
        <dl className="cv-results">
          {study.results.map((metric) => (
            <div key={metric.label} className="cv-result">
              <dt>{metric.label}</dt>
              <dd>{metric.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

/** `DeepDiveArticle` — shared/23 `CONTENT-DIVE-01`: title, summary, then paragraphs and ordered steps. */
export function DeepDiveArticle({ data: dive, density = 'comfortable', headingLevel = 3 }: ViewProps<DeepDive>) {
  const titleId = `cv-dive-${dive.slug}`;
  return (
    <article className="cv cv-dive" data-density={density} aria-labelledby={titleId}>
      <header className="cv-header">
        <Heading level={headingLevel} id={titleId} className="cv-title">
          {dive.title}
        </Heading>
        <p className="cv-lede">{dive.summary}</p>
      </header>
      <div className="cv-prose">
        {dive.blocks.map((block, index) =>
          block.kind === 'p' ? (
            <p key={index}>{block.text}</p>
          ) : (
            <ol key={index} className="cv-steps">
              {block.items.map((item) => (
                <li key={item.slice(0, 40)}>{item}</li>
              ))}
            </ol>
          ),
        )}
      </div>
    </article>
  );
}

/** The dive's file name in a repository listing (`docs/{slug}.md`). */
export const deepDiveFile = (dive: Pick<DeepDive, 'slug'>): string => `${dive.slug}.md`;
