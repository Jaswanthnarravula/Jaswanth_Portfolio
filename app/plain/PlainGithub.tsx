/**
 * Reader-mode GitHub panel (`ROUTE-PLAIN-01` deviation, owner 2026-09-25): the build-time snapshot (shared/17) — profile,
 * public repositories, latest activity. Renders nothing when the snapshot is empty (a fetch can never fail the build).
 */
import { formatPartialDate } from '@/components/content';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { getGithubSnapshot } from '@/data/selectors';
import type { PartialDate } from '@/data/schema';
import { orgAssetId } from '@/lib/assets/orgs';
import { ContributionGraph } from './ContributionGraph';
import fx from './fx.module.css';
import styles from './plain.module.css';

/** Fewer cards fit the panel without moving, so the rail only runs from four (shared/24 `READER-FX-14`). */
const RAIL_MIN = 4;
const month = (iso: string) => formatPartialDate(iso.slice(0, 7) as PartialDate);

export function PlainGithub() {
  const { user, repos, contributions } = getGithubSnapshot();
  if (!user) return null;
  const shown = repos
    .filter((repo) => !repo.archived)
    .toSorted((a, b) => b.pushedAt.localeCompare(a.pushedAt))
    .slice(0, 6);
  const latest = shown[0]?.pushedAt;
  return (
    <section className={`${styles.github} ${styles.reveal} ${fx.lit}`} aria-labelledby="plain-github" data-fx-light="">
      <span className={fx.light} aria-hidden="true" />
      <header className={styles.githubHeading}>
        <span className={styles.githubMark} aria-hidden="true">
          <AssetIcon id={orgAssetId('github')} size={36} />
        </span>
        <div>
          <h3 id="plain-github">On GitHub</h3>
          <a className={styles.githubHandle} href={user.url} target="_blank" rel="noopener noreferrer">
            @{user.login}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
        <dl className={styles.githubStats}>
          <div>
            <dt>Public repositories</dt>
            <dd>{user.publicRepos}</dd>
          </div>
          {latest && (
            <div>
              <dt>Latest push</dt>
              <dd>{month(latest)}</dd>
            </div>
          )}
        </dl>
      </header>
      {contributions && <ContributionGraph contributions={contributions} />}
      {shown.length > 0 && (
        // Desktop: a horizontal rail driven by the vertical scroll (shared/24 READER-FX-14); focus turns it back into a
        // normal scroller. Elsewhere it stays the grid.
        <div className={fx.rail} data-rail={shown.length >= RAIL_MIN ? '' : undefined}>
          <div className={fx.railStage}>
            <ul className={`${styles.repos} ${fx.railTrack}`}>
              {shown.map((repo) => {
                // A repository named after the account is GitHub's profile README.
                const description = repo.description ?? (repo.name === user.login ? 'Profile README' : null);
                return (
                  <li key={repo.url}>
                    <a
                      className={`${styles.repo} ${fx.tilt}`}
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-fx-tilt="6"
                    >
                      <span className={fx.light} aria-hidden="true" />
                      <span className={styles.repoName}>
                        <span className={styles.repoOwner}>{user.login} /</span> {repo.name}
                        <span aria-hidden="true"> ↗</span>
                        <span className="sr-only"> (opens in a new tab)</span>
                      </span>
                      {description && <span className={styles.repoDescription}>{description}</span>}
                      <span className={styles.repoMeta}>
                        {repo.language && <span className={styles.repoLanguage}>{repo.language}</span>}
                        <span>Updated {month(repo.pushedAt)}</span>
                        {repo.stars > 0 && <span>★ {repo.stars}</span>}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
      <a
        className={`${styles.githubCta} ${fx.magnet}`}
        data-fx-magnet=""
        href={user.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        View profile on GitHub <span aria-hidden="true">↗</span>
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </section>
  );
}
