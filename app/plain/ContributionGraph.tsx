/**
 * The GitHub contribution calendar, drawn the way the profile page draws it: Sunday-first weeks, month and weekday
 * labels, GitHub's own 0–4 colour levels and legend. Data comes from the build-time snapshot (shared/17). Narrow screens
 * clip the oldest weeks rather than scroll. Visual only — the total is the text.
 */
import type { GithubSnapshot } from '@/data/github-schema';
import styles from './plain.module.css';

type Contributions = NonNullable<GithubSnapshot['contributions']>;

const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

/** 0 = none, 1–4 = quarters of the busiest day (used only when the snapshot has no GitHub levels). */
export const contributionLevel = (count: number, max: number): number =>
  count <= 0 || max <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((count / max) * 4)));

/** A month name over the first week that starts in that month; labels closer than two weeks give way. */
export function monthLabels(start: string, weekCount: number): readonly string[] {
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const startDay = new Date(startMs).getUTCDay();
  const firstDayOf = (week: number) => new Date(week === 0 ? startMs : startMs + (7 * week - startDay) * DAY_MS);
  const labels = Array.from({ length: weekCount }, () => '');
  let last = -Infinity;
  for (let week = 0; week < weekCount; week += 1) {
    const month = firstDayOf(week).getUTCMonth();
    const changed = week === 0 || month !== firstDayOf(week - 1).getUTCMonth();
    if (!changed) continue;
    if (week - last < 2) labels[last] = '';
    labels[week] = MONTHS[month]!;
    last = week;
  }
  return labels;
}

export function ContributionGraph({ contributions }: { readonly contributions: Contributions }) {
  const { total, weeks, levels, start } = contributions;
  const max = Math.max(0, ...weeks.flat());
  const months = start ? monthLabels(start, weeks.length) : null;
  const totalText = total.toLocaleString('en-US');
  return (
    <figure className={styles.contributions}>
      <figcaption className={styles.contributionTitle}>{totalText} contributions in the last year</figcaption>
      <div className={styles.contributionCard}>
        <div className={styles.contributionBody} role="img" aria-label={`${totalText} contributions in the last year`}>
          <div className={styles.contributionDays} aria-hidden="true">
            {WEEKDAYS.map((day, index) => (
              <span key={index}>{day}</span>
            ))}
          </div>
          <div className={styles.contributionClip}>
            <div className={styles.contributionGrid}>
              {months && (
                <div className={styles.contributionMonths} aria-hidden="true">
                  {months.map((label, index) => (
                    <span key={index}>{label}</span>
                  ))}
                </div>
              )}
              <div className={styles.contributionWeeks}>
                {weeks.map((week, weekIndex) => (
                  <span
                    key={weekIndex}
                    className={styles.contributionWeek}
                    // The first week can start mid-week: its days sit at the bottom, like GitHub's calendar.
                    data-first={weekIndex === 0 ? '' : undefined}
                  >
                    {week.map((count, dayIndex) => (
                      <span
                        key={dayIndex}
                        data-level={levels?.[weekIndex]?.[dayIndex] ?? contributionLevel(count, max)}
                      />
                    ))}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className={styles.contributionFooter}>
          <a
            href="https://docs.github.com/account-and-profile/setting-up-and-managing-your-github-profile/managing-contribution-settings-on-your-profile/why-are-my-contributions-not-showing-up-on-my-profile"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn how GitHub counts contributions
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <p className={styles.contributionLegend} aria-hidden="true">
            Less
            {[0, 1, 2, 3, 4].map((level) => (
              <span key={level} data-level={level} />
            ))}
            More
          </p>
        </div>
      </div>
    </figure>
  );
}
