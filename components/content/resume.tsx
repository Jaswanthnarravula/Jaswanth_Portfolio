import type { Credential, Education, Experience, Person, Project, Resume, SkillGroup, Contact } from '@/data/schema';
import { formatPeriod, resumeFileLabel, type ResumeFileMeta } from './format';
import { Heading, withSlots, type ViewProps } from './slots';

export { resumeFileLabel, type ResumeFileMeta };

export interface ResumeData {
  readonly resume: Resume;
  readonly person: Person;
  readonly file: ResumeFileMeta | null;
}

/**
 * `ResumeView` — viewer / Quick Look / Edge PDF tab, `open resume`. Offers Open (the OS viewer or the PDF) and
 * Download. When the PDF is missing (placeholder phase) the Download action is hidden and the pages render from data.
 */
export function ResumeView({ data, density = 'comfortable', slots, headingLevel = 2 }: ViewProps<ResumeData>) {
  const { Action } = withSlots(slots);
  const { resume, file } = data;
  const label = resumeFileLabel(file);
  return (
    <section className="cv cv-resume" data-density={density} aria-labelledby="cv-resume-title">
      <header className="cv-header">
        <Heading level={headingLevel} id="cv-resume-title" className="cv-title">
          Résumé
        </Heading>
        <p className="cv-meta">
          Updated <time dateTime={resume.updated}>{formatUpdated(resume.updated)}</time>
          {file ? ` · ${label} · ${file.pages} ${file.pages === 1 ? 'page' : 'pages'}` : null}
        </p>
      </header>
      {file && (
        <p className="cv-actions">
          <a className="cv-button cv-button-primary" href={resume.file} type="application/pdf">
            Open PDF
          </a>
          {Action ? (
            <Action
              action={{ kind: 'download', href: resume.file, filename: resume.downloadName }}
              className="cv-button"
            >
              Download <span className="cv-muted">({label})</span>
            </Action>
          ) : (
            <a className="cv-button" href={resume.file} download={resume.downloadName}>
              Download <span className="cv-muted">({label})</span>
            </a>
          )}
        </p>
      )}
    </section>
  );
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
export function formatUpdated(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${MONTHS[Number(month) - 1] ?? ''} ${Number(day)}, ${year}`.trim();
}

export interface ResumeDocumentData {
  readonly person: Person;
  readonly contact: Contact;
  readonly experience: readonly Experience[];
  readonly projects: readonly Project[];
  readonly education: readonly Education[];
  readonly credentials: readonly Credential[];
  readonly skills: readonly SkillGroup[];
}

/**
 * The résumé as HTML pages — the same facts as the PDF, readable where a PDF cannot render inline (mobile Safari),
 * selectable and screen-reader friendly. Rendered on a paper-like sheet by the host.
 */
export function ResumeDocument({ data, headingLevel = 2 }: ViewProps<ResumeDocumentData>) {
  const { person, contact, experience, projects, education, credentials, skills } = data;
  const sub = headingLevel + 1;
  return (
    <article className="cv cv-resume-doc" aria-label={`${person.name} — résumé`}>
      <header className="cv-doc-header">
        <Heading level={headingLevel} className="cv-doc-name">
          {person.name}
        </Heading>
        <p className="cv-doc-headline">{person.headline}</p>
        <p className="cv-doc-contact">
          <a href={`mailto:${contact.email}`}>{contact.email}</a>
          {contact.links.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">
              {link.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
            </a>
          ))}
          <span>{person.location}</span>
        </p>
      </header>
      <section aria-labelledby="cv-doc-summary">
        <Heading level={sub} id="cv-doc-summary" className="cv-doc-section">
          Summary
        </Heading>
        {person.summary.slice(0, 2).map((paragraph) => (
          <p key={paragraph.slice(0, 24)}>{paragraph}</p>
        ))}
      </section>
      <section aria-labelledby="cv-doc-experience">
        <Heading level={sub} id="cv-doc-experience" className="cv-doc-section">
          Experience
        </Heading>
        {experience.map((role) => (
          <div key={role.slug} className="cv-doc-entry">
            <p className="cv-doc-row">
              <strong>
                {[role.role, role.company].filter(Boolean).join(' — ')}
                {role.client ? ` (client: ${role.client})` : ''}
              </strong>
              {formatPeriod(role.start, role.end) && <span>{formatPeriod(role.start, role.end)}</span>}
            </p>
            <ul>
              {role.highlights.map((item) => (
                <li key={item.slice(0, 32)}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
      <section aria-labelledby="cv-doc-projects">
        <Heading level={sub} id="cv-doc-projects" className="cv-doc-section">
          Selected projects
        </Heading>
        {projects.map((project) => (
          <div key={project.slug} className="cv-doc-entry">
            <p className="cv-doc-row">
              <strong>
                {project.name} — {project.context}
              </strong>
              {project.year && <span>{project.year}</span>}
            </p>
            <p>{project.tagline}</p>
          </div>
        ))}
      </section>
      <section aria-labelledby="cv-doc-education">
        <Heading level={sub} id="cv-doc-education" className="cv-doc-section">
          Education
        </Heading>
        {education.map((school) => (
          <p key={school.slug} className="cv-doc-row">
            <strong>
              {school.degree} — {school.school}
            </strong>
            {formatPeriod(school.start, school.end) && <span>{formatPeriod(school.start, school.end)}</span>}
          </p>
        ))}
        {credentials.length > 0 && <p>Credentials: {credentials.map((item) => item.name).join(', ')}</p>}
      </section>
      <section aria-labelledby="cv-doc-skills">
        <Heading level={sub} id="cv-doc-skills" className="cv-doc-section">
          Skills
        </Heading>
        {skills.map((group) => (
          <p key={group.id}>
            <strong>{group.label}:</strong> {group.items.map((item) => item.name).join(', ')}
          </p>
        ))}
      </section>
    </article>
  );
}
