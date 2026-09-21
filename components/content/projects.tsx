import type { GithubRepo } from '@/data/github-schema';
import type { Project } from '@/data/schema';
import { Heading, withSlots, type ViewProps } from './slots';

/** `ProjectList` — github apps, `projects`, `ls ~/projects`. */
export function ProjectList({ data, density = 'comfortable', slots, headingLevel = 2 }: ViewProps<readonly Project[]>) {
  const { Link, Tag } = withSlots(slots);
  if (data.length === 0)
    return (
      <p className="cv cv-empty" role="status">
        No projects are listed yet.
      </p>
    );
  return (
    <ul className="cv cv-projects" data-density={density} role="list" data-long={data.length > 12 || undefined}>
      {data.map((project) => (
        <li key={project.slug} className="cv-card">
          <Heading level={headingLevel} className="cv-card-title">
            <Link to={{ section: 'projects', slug: project.slug }} className="cv-link">
              {project.name}
            </Link>
          </Heading>
          <p className="cv-card-context">{project.context}</p>
          <p className="cv-card-body">{project.tagline}</p>
          {density !== 'compact' && (
            <ul className="cv-tags" role="list" aria-label="Stack">
              {project.stack.slice(0, 6).map((item) => (
                <li key={item}>
                  <Tag>{item}</Tag>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export interface ProjectDetailData {
  readonly project: Project;
  readonly github?: GithubRepo;
}

/** `ProjectDetail` — github apps, viewer, `/go/projects/{slug}`. */
export function ProjectDetail({
  data,
  density = 'comfortable',
  slots,
  headingLevel = 2,
}: ViewProps<ProjectDetailData>) {
  const { Tag, Media } = withSlots(slots);
  const { project, github } = data;
  return (
    <article className="cv cv-project" data-density={density}>
      <header className="cv-header">
        <p className="cv-eyebrow">{project.context}</p>
        <Heading level={headingLevel} className="cv-title">
          {project.name}
        </Heading>
        <p className="cv-lede">{project.tagline}</p>
        {github && (
          <p className="cv-meta">
            {github.language && <span>{github.language}</span>} <span>★ {github.stars}</span>
          </p>
        )}
      </header>
      {project.media?.map((media) => (
        <Media key={media.src} media={media} className="cv-media" />
      ))}
      <div className="cv-prose">
        {project.description.map((paragraph) => (
          <p key={paragraph.slice(0, 32)}>{paragraph}</p>
        ))}
      </div>
      <section className="cv-section" aria-labelledby={`cv-hl-${project.slug}`}>
        <Heading level={headingLevel + 1} id={`cv-hl-${project.slug}`} className="cv-subtitle">
          Highlights
        </Heading>
        <ul className="cv-bullets">
          {project.highlights.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section className="cv-section" aria-labelledby={`cv-stack-${project.slug}`}>
        <Heading level={headingLevel + 1} id={`cv-stack-${project.slug}`} className="cv-subtitle">
          Stack
        </Heading>
        <ul className="cv-tags" role="list">
          {project.stack.map((item) => (
            <li key={item}>
              <Tag>{item}</Tag>
            </li>
          ))}
        </ul>
      </section>
      {(project.repo || project.live || project.closedSource) && (
        <p className="cv-actions">
          {project.repo && (
            <a className="cv-button" href={project.repo} target="_blank" rel="noopener noreferrer">
              Source code<span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
          {project.live && (
            <a className="cv-button" href={project.live} target="_blank" rel="noopener noreferrer">
              Live site<span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
          {project.closedSource && !project.repo && (
            <span className="cv-muted">Built in production; source is proprietary.</span>
          )}
        </p>
      )}
    </article>
  );
}
