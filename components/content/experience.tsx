import type { Credential, Education, Experience } from '@/data/schema';
import { formatPeriod } from './format';
import { Heading, withSlots, type ViewProps } from './slots';

const roleTitle = (role: Experience) => role.role ?? role.company;
const roleSub = (role: Experience) =>
  [role.role ? role.company : null, role.client ? `for ${role.client}` : null].filter(Boolean).join(' ');

/** `ExperienceList` — files apps, `experience`. */
export function ExperienceList({
  data,
  density = 'comfortable',
  slots,
  headingLevel = 2,
}: ViewProps<readonly Experience[]>) {
  const { Link } = withSlots(slots);
  if (data.length === 0)
    return (
      <p className="cv cv-empty" role="status">
        No roles are listed yet.
      </p>
    );
  return (
    <ol className="cv cv-timeline" data-density={density} role="list">
      {data.map((role) => {
        const period = formatPeriod(role.start, role.end);
        return (
          <li key={role.slug} className="cv-timeline-item">
            <Heading level={headingLevel} className="cv-card-title">
              <Link to={{ section: 'experience', slug: role.slug }} className="cv-link">
                {roleTitle(role)}
              </Link>
            </Heading>
            <p className="cv-card-context">{roleSub(role) || role.company}</p>
            {period && <p className="cv-meta">{period}</p>}
            {density !== 'compact' && <p className="cv-card-body">{role.summary}</p>}
          </li>
        );
      })}
    </ol>
  );
}

/** `ExperienceDetail` — files apps, viewer. */
export function ExperienceDetail({
  data: role,
  density = 'comfortable',
  slots,
  headingLevel = 2,
}: ViewProps<Experience>) {
  const { Tag } = withSlots(slots);
  const period = formatPeriod(role.start, role.end);
  const meta = [period, role.location].filter(Boolean).join(' · ');
  return (
    <article className="cv cv-role" data-density={density}>
      <header className="cv-header">
        <p className="cv-eyebrow">{role.client ? `${role.company} · ${role.client}` : role.company}</p>
        <Heading level={headingLevel} className="cv-title">
          {roleTitle(role)}
        </Heading>
        {meta && <p className="cv-meta">{meta}</p>}
        <p className="cv-lede">{role.summary}</p>
      </header>
      <ul className="cv-bullets">
        {role.highlights.map((item) => (
          <li key={item.slice(0, 40)}>{item}</li>
        ))}
      </ul>
      <ul className="cv-tags" role="list" aria-label="Stack">
        {role.stack.map((item) => (
          <li key={item}>
            <Tag>{item}</Tag>
          </li>
        ))}
      </ul>
    </article>
  );
}

export interface EducationData {
  readonly schools: readonly Education[];
  readonly credentials: readonly Credential[];
}

/** `EducationList` — files apps, `/go/education`. */
export function EducationList({ data, density = 'comfortable', slots, headingLevel = 2 }: ViewProps<EducationData>) {
  const { Link } = withSlots(slots);
  return (
    <div className="cv cv-education" data-density={density}>
      {data.schools.length === 0 ? (
        <p className="cv-empty" role="status">
          No education is listed yet.
        </p>
      ) : (
        <ol className="cv-timeline" role="list">
          {data.schools.map((school) => {
            const period = formatPeriod(school.start, school.end);
            return (
              <li key={school.slug} className="cv-timeline-item">
                <Heading level={headingLevel} className="cv-card-title">
                  <Link to={{ section: 'education', slug: school.slug }} className="cv-link">
                    {school.degree}
                  </Link>
                </Heading>
                <p className="cv-card-context">{school.school}</p>
                {period && <p className="cv-meta">{period}</p>}
              </li>
            );
          })}
        </ol>
      )}
      {data.credentials.length > 0 && (
        <section className="cv-section" aria-labelledby="cv-credentials">
          <Heading level={headingLevel} id="cv-credentials" className="cv-subtitle">
            Credentials
          </Heading>
          <ul className="cv-bullets">
            {data.credentials.map((credential) => (
              <li key={credential.name}>
                {credential.name} <span className="cv-muted">— {credential.issuer}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** `EducationDetail` — one school (files apps, viewer, `/go/education/{slug}`). */
export function EducationDetail({ data: school, density = 'comfortable', headingLevel = 2 }: ViewProps<Education>) {
  const period = formatPeriod(school.start, school.end);
  return (
    <article className="cv cv-school" data-density={density}>
      <header className="cv-header">
        <p className="cv-eyebrow">{school.school}</p>
        <Heading level={headingLevel} className="cv-title">
          {school.degree}
        </Heading>
        {period && <p className="cv-meta">{period}</p>}
      </header>
      {school.notes.length > 0 && (
        <section className="cv-section" aria-labelledby={`cv-notes-${school.slug}`}>
          <Heading level={headingLevel + 1} id={`cv-notes-${school.slug}`} className="cv-subtitle">
            Coursework
          </Heading>
          <ul className="cv-bullets">
            {school.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
