/**
 * Reader-mode About (`ROUTE-PLAIN-01` deviation, owner 2026-09-25): the same person data as `AboutOverview`, laid out
 * as an editorial spread — lead statement beside a code card, story columns, glance tiles, and the Now / open-to pair.
 */
import { nowUpdated } from '@/components/content';
import { getPerson } from '@/data/selectors';
import { PlainCode } from './PlainCode';
import { Words } from './SplitText';
import fx from './fx.module.css';
import styles from './plain.module.css';

function Chips({ items, label }: { readonly items: readonly string[]; readonly label: string }) {
  return (
    <ul className={styles.chips} aria-label={label}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function PlainAbout() {
  const person = getPerson();
  const [lead, ...rest] = person.summary;
  // The closing paragraph (what he is looking for) pairs with "open to"; the middle ones tell the story.
  const pitch = rest.length >= 2 ? rest.at(-1) : undefined;
  const story = pitch ? rest.slice(0, -1) : rest;
  const glance = person.glance;
  return (
    <div className={styles.about}>
      {/* The lead on the left, the code card on the right (stacked below 1000 px). */}
      <div className={styles.aboutIntro}>
        {lead && (
          // Word-by-word with the scroll (shared/24 READER-FX-06); every word is real text from the first frame.
          <p className={`${styles.aboutLead} ${fx.lead}`}>
            <Words text={lead} />
          </p>
        )}
        <PlainCode />
      </div>
      {story.length > 0 && (
        <div className={`${styles.aboutStory} ${styles.reveal}`}>
          {story.map((paragraph) => (
            <p key={paragraph.slice(0, 32)}>{paragraph}</p>
          ))}
        </div>
      )}
      {glance && (
        <section className={`${styles.glance} ${styles.reveal}`} aria-labelledby="plain-about-glance">
          <h3 id="plain-about-glance" className={styles.eyebrow}>
            At a glance
          </h3>
          <dl className={styles.glanceGrid}>
            <div>
              <dt>Target role</dt>
              <dd>{glance.targetRoles.join(' · ')}</dd>
            </div>
            <div>
              <dt>Experience</dt>
              <dd>{glance.experience}</dd>
            </div>
            <div>
              <dt>Availability</dt>
              <dd>{glance.availability}</dd>
            </div>
            <div>
              <dt>Core stack</dt>
              <dd>
                <Chips items={glance.coreStack} label="Core stack" />
              </dd>
            </div>
            <div>
              <dt>Strengths</dt>
              <dd>
                <Chips items={glance.strengths} label="Strengths" />
              </dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>
                <Chips items={glance.workModes} label="Location and work modes" />
              </dd>
            </div>
          </dl>
        </section>
      )}
      <div className={`${styles.aboutPair} ${styles.reveal}`}>
        {person.now && (
          <section className={styles.now} aria-labelledby="plain-about-now">
            <h3 id="plain-about-now" className={styles.eyebrow}>
              <span className={styles.nowDot} aria-hidden="true" />
              Now
            </h3>
            <p>{person.now.text}</p>
            <p className={styles.nowUpdated}>{nowUpdated(person)}</p>
          </section>
        )}
        <div className={styles.openTo}>
          {pitch && <p>{pitch}</p>}
          <p className={styles.openToLine}>{person.openTo}</p>
          <a className={`${styles.caseLink} ${fx.magnet}`} href="#contact" data-fx-magnet="">
            Start a conversation <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </div>
  );
}
