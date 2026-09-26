import type { Experience, Glance, Person, Project } from '@/data/schema';
import { formatPartialDate } from './format';
import { Heading, withSlots, type ViewProps } from './slots';

/** The recruiter card's rows (shared/23 `CONTENT-GLANCE-01`) — there is deliberately no work-authorization row. */
export function glanceRows(glance: Glance): readonly (readonly [label: string, value: string])[] {
  return [
    ['Target role', glance.targetRoles.join(' · ')],
    ['Experience', glance.experience],
    ['Core stack', glance.coreStack.join(' · ')],
    ['Strengths', glance.strengths.join(' · ')],
    ['Location', glance.workModes.join(' · ')],
    ['Availability', glance.availability],
  ];
}

/** "Updated Sep 2026" for the Now note. */
export const nowUpdated = (person: Person): string | null =>
  person.now ? `Updated ${formatPartialDate(person.now.updated)}` : null;

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
      {person.glance && (
        <section className="cv-section cv-glance" aria-labelledby="cv-about-glance">
          <Heading level={headingLevel + 1} id="cv-about-glance" className="cv-subtitle">
            At a glance
          </Heading>
          <dl className="cv-glance-list">
            {glanceRows(person.glance).map(([label, value]) => (
              <div key={label} className="cv-glance-row">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <div className="cv-prose">
        {person.summary.map((paragraph) => (
          <p key={paragraph.slice(0, 32)}>{paragraph}</p>
        ))}
        <p className="cv-open-to">{person.openTo}</p>
        {person.now && (
          <p className="cv-now">
            <strong>Now:</strong> {person.now.text} <span className="cv-muted">({nowUpdated(person)})</span>
          </p>
        )}
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
