import { mailtoUrl } from '@/components/content/contact-actions';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { getContact, getPerson } from '@/data/selectors';
import { orgAssetId } from '@/lib/assets/orgs';
import styles from './plain.module.css';

function ContactIcon({ kind }: { kind: string }) {
  if (['email', 'github', 'linkedin', 'instagram'].includes(kind))
    return <AssetIcon id={orgAssetId(kind === 'email' ? 'gmail' : kind)} size={28} />;
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a20 20 0 0 1 0 18 20 20 0 0 1 0-18" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 18 18 6M6 6h12v12" />
    </svg>
  );
}

/** Reader-only contact presentation; every destination remains a native link. */
export function PlainContact() {
  const contact = getContact();
  const person = getPerson();
  return (
    <div className={styles.contactContent}>
      <p className={styles.contactIntro}>{person.openTo}</p>
      <div className={styles.contactGrid}>
        <a
          className={styles.contactEmail}
          href={mailtoUrl({ email: contact.email, subject: `Hello ${person.givenName}` })}
        >
          <span className={styles.contactEmailTop}>
            <span className={styles.contactIcon} aria-hidden="true">
              <ContactIcon kind="email" />
            </span>
            <span className={styles.contactKicker}>Let’s connect</span>
            <span className={styles.contactArrow}>
              <Arrow />
            </span>
          </span>
          <span className={styles.contactEmailTitle}>
            A conversation.
            <br />A new possibility.
          </span>
          <span className={styles.contactEmailBottom}>
            <span className={styles.contactKicker}>Email me directly</span>
            <span className={styles.contactAddress}>{contact.email}</span>
          </span>
        </a>
        <ul className={styles.contactLinks} aria-label="Social profiles">
          {contact.links.map((link) => (
            <li key={link.url}>
              <a
                className={styles.contactProfile}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                data-kind={link.kind}
              >
                <span className={styles.contactIcon} aria-hidden="true">
                  <ContactIcon kind={link.kind} />
                </span>
                <span className={styles.contactProfileText}>
                  <span className={styles.contactProfileLabel}>{link.label}</span>
                  <span className={styles.contactProfileDescription}>
                    {link.kind === 'linkedin'
                      ? 'Experience & professional connections'
                      : link.kind === 'github'
                        ? 'Code, projects & contributions'
                        : link.kind === 'instagram'
                          ? 'Beyond the code'
                          : 'Explore my profile'}
                  </span>
                  <span className={styles.contactHandle}>{link.handle}</span>
                </span>
                <span className={styles.contactArrow}>
                  <Arrow />
                </span>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <p className={styles.contactFootnote}>
        <span aria-hidden="true">↗</span> Based in {person.location}. Start with an introduction, a role, or an idea.
      </p>
    </div>
  );
}
