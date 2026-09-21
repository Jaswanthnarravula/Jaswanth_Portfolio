import type { Contact, Person } from '@/data/schema';
import { mailtoUrl } from './contact-actions';
import { Heading, withSlots, type ViewProps } from './slots';

export interface ContactData {
  readonly contact: Contact;
  readonly person: Person;
}

/** `ContactPanel` — mail / messages apps, `contact`. Contact is a `mailto:` hand-off: no backend, no network. */
export function ContactPanel({ data, density = 'comfortable', slots, headingLevel = 2 }: ViewProps<ContactData>) {
  const { Action } = withSlots(slots);
  const { contact, person } = data;
  const href = mailtoUrl({ email: contact.email, subject: `Hello ${person.givenName}` });
  return (
    <section className="cv cv-contact" data-density={density} aria-labelledby="cv-contact-title">
      <Heading level={headingLevel} id="cv-contact-title" className="cv-title">
        Contact
      </Heading>
      <p className="cv-lede">{person.openTo}</p>
      <dl className="cv-channels">
        <div className="cv-channel">
          <dt>Email</dt>
          <dd>
            <a className="cv-link" href={href}>
              {contact.email}
            </a>
            {Action && (
              <Action
                action={{ kind: 'copy', text: contact.email, label: 'Copy email address' }}
                className="cv-inline-action"
              >
                Copy
              </Action>
            )}
          </dd>
        </div>
        {contact.links.map((link) => (
          <div className="cv-channel" key={link.url}>
            <dt>{link.label}</dt>
            <dd>
              <a className="cv-link" href={link.url} target="_blank" rel="noopener noreferrer">
                {link.handle}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
