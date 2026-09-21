import type { Experience, Person, Project } from '@/data/schema';
import { Heading, withSlots, type ViewProps } from './slots';

export interface AboutData {
  readonly person: Person;
  readonly featured: readonly Project[];
  readonly current?: Experience;
}

/** `AboutOverview` — browser apps, `/go/about`, `whoami` / `cat about.txt`. */
export function AboutOverview({ data, density = 'comfortable', slots, headingLevel = 2 }: ViewProps<AboutData>) {
  const { Link } = withSlots(slots);
  const { person, featured, current } = data;
  return (
    <article className="cv cv-about" data-density={density}>
      {density !== 'compact' && (
        <header className="cv-header">
          <Heading level={headingLevel} className="cv-title">
            {person.name}
          </Heading>
          <p className="cv-lede">{person.headline}</p>
          <p className="cv-meta">
            {current?.role ? `${current.role} at ${current.company}` : person.role} · {person.location}
          </p>
        </header>
      )}
      <div className="cv-prose">
        {person.summary.map((paragraph) => (
          <p key={paragraph.slice(0, 32)}>{paragraph}</p>
        ))}
        <p className="cv-open-to">{person.openTo}</p>
      </div>
      {featured.length > 0 && density !== 'compact' && (
        <section className="cv-section" aria-labelledby="cv-about-featured">
          <Heading level={headingLevel + 1} id="cv-about-featured" className="cv-subtitle">
            Selected work
          </Heading>
          <ul className="cv-list" role="list">
            {featured.map((project) => (
              <li key={project.slug} className="cv-list-item">
                <Link to={{ section: 'projects', slug: project.slug }} className="cv-link">
                  {project.name}
                </Link>
                <span className="cv-muted"> — {project.tagline}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
