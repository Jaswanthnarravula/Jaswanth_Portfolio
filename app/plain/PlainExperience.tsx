/**
 * Reader-mode Experience (`ROUTE-PLAIN-01` deviation, owner 2026-09-26): an alternating timeline — each role's card sits
 * left or right of one centre rule, its dates on the opposite side. The card shows the summary and stack; scope and
 * every highlight stay one "+ more" away in a native `<details>`, so nothing is hidden from no-JS or search.
 */
import { formatPeriod } from '@/components/content';
import { getExperience } from '@/data/selectors';
import { PlainLogo } from './PlainLogo';
import styles from './plain.module.css';

export function PlainExperience() {
  return (
    <ol className={styles.timeline}>
      {getExperience().map((role) => {
        const period = formatPeriod(role.start, role.end);
        const title = role.role ?? role.company;
        const hasMore = Boolean(role.scope) || role.highlights.length > 0;
        return (
          <li key={role.slug} id={`experience-${role.slug}`} className={styles.entry}>
            <span className={styles.entryDot} aria-hidden="true" />
            {period && <p className={styles.entryDate}>{period}</p>}
            <article className={styles.entryCard}>
              <div className={styles.roleLogos}>
                <PlainLogo name={role.company} height={26} small />
                {role.client && (
                  <>
                    <span className={styles.roleFor} aria-hidden="true">
                      for
                    </span>
                    <PlainLogo name={role.client} height={22} small />
                  </>
                )}
              </div>
              <h3 className={styles.entryTitle}>{title}</h3>
              <p className={styles.entryCompany}>
                {role.role ? role.company : null}
                {role.client ? ` for ${role.client}` : null}
                {role.location ? <span> · {role.location}</span> : null}
              </p>
              <p className={styles.entrySummary}>{role.summary}</p>
              <ul className={styles.chips} aria-label={`${title} stack`}>
                {role.stack.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              {hasMore && (
                <details className={styles.entryMore}>
                  <summary>
                    <span className={styles.moreOpen}>+ more</span>
                    <span className={styles.moreClose}>− less</span>
                    <span className="sr-only">
                      {' '}
                      about {title} at {role.company}
                    </span>
                  </summary>
                  {role.scope && (
                    <p className={styles.entryScope}>
                      <strong>Scope</strong> {role.scope}
                    </p>
                  )}
                  {role.highlights.length > 0 && (
                    <ul className={styles.entryHighlights}>
                      {role.highlights.map((item) => (
                        <li key={item.slice(0, 40)}>{item}</li>
                      ))}
                    </ul>
                  )}
                </details>
              )}
            </article>
          </li>
        );
      })}
    </ol>
  );
}
