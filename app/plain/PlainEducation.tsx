/**
 * Reader-mode Education (`ROUTE-PLAIN-01` deviation, owner 2026-09-25): one card per school with its coursework, then
 * credentials as cards whose status and kind are stated plainly (shared/23 `CONTENT-CRED-01`).
 */
import { formatCredential, formatPeriod } from '@/components/content';
import { getCredentials, getEducation } from '@/data/selectors';
import { PlainLogo } from './PlainLogo';
import fx from './fx.module.css';
import styles from './plain.module.css';

export function PlainEducation() {
  const schools = getEducation();
  const credentials = getCredentials();
  return (
    <div className={styles.education}>
      <ol className={`${styles.schools} ${styles.reveal}`}>
        {schools.map((school) => {
          const period = formatPeriod(school.start, school.end);
          return (
            <li
              key={school.slug}
              className={`${styles.school} ${fx.tilt}`}
              id={`education-${school.slug}`}
              data-fx-tilt="4"
            >
              <span className={fx.light} aria-hidden="true" />
              <div className={styles.schoolTop}>
                <PlainLogo name={school.school} height={44} />
                {period && <span className={styles.eyebrow}>{period}</span>}
              </div>
              <h3>{school.degree}</h3>
              <p className={styles.schoolName}>{school.school}</p>
              {school.notes.length > 0 && (
                <>
                  <p className={styles.eyebrow}>Coursework</p>
                  <ul className={styles.chips} aria-label={`${school.degree} coursework`}>
                    {school.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </>
              )}
            </li>
          );
        })}
      </ol>
      {credentials.length > 0 && (
        <section className={`${styles.credentials} ${styles.reveal}`} aria-labelledby="plain-credentials">
          <h3 id="plain-credentials" className={styles.eyebrow}>
            Credentials
          </h3>
          <ul className={styles.credentialList}>
            {credentials.map((credential) => (
              <li key={credential.name} className={styles.credential} data-status={credential.status}>
                <div className={styles.credentialTop}>
                  <PlainLogo name={credential.issuer} height={24} small />
                  <span className={styles.credentialStatus}>
                    {credential.status === 'earned' ? 'Earned' : 'In progress'}
                  </span>
                </div>
                <h4>{credential.name}</h4>
                <p>{credential.issuer}</p>
                <p className={styles.credentialMeta}>{formatCredential(credential)}</p>
                {credential.verifyUrl && (
                  <a className={styles.caseLink} href={credential.verifyUrl} target="_blank" rel="noopener noreferrer">
                    Verify <span aria-hidden="true">↗</span>
                    <span className="sr-only"> {credential.name} (opens in a new tab)</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
