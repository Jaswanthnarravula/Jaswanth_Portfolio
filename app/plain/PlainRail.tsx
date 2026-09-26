/**
 * Reader-mode section rail (`ROUTE-PLAIN-01` deviation, owner 2026-09-26): a fixed column of dots on the right edge,
 * one real link per section. The section in view (marked by the reader driver's `data-fx-nav` tracking with
 * `aria-current`) grows into a ringed icon with a `> Title` label; others show their label on hover or focus. A thin
 * line behind the dots fills with the scroll. Wide screens only; the header nav covers every other width.
 */
import type { ReactNode } from 'react';
import { SECTION_TITLES } from '@/data/content-index';
import { SECTION_IDS, type SectionId } from '@/data/schema';
import styles from './plain.module.css';

const ICONS: Readonly<Record<SectionId | 'home', ReactNode>> = {
  home: <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />,
  about: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </>
  ),
  projects: (
    <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" />
  ),
  experience: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18" />
    </>
  ),
  skills: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9.5l3 2.5-3 2.5M12.5 15h4.5" />
    </>
  ),
  education: <path d="M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />,
  resume: <path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6" />,
  contact: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
};

const STOPS: ReadonlyArray<readonly [SectionId | 'home', string]> = [
  ['home', 'Home'],
  ...SECTION_IDS.map((id) => [id, SECTION_TITLES[id]] as const),
];

export function PlainRail() {
  return (
    <nav className={styles.jump} aria-label="Section rail" data-fx-nav="">
      <span className={styles.jumpTrack} aria-hidden="true">
        <span className={styles.jumpFill} />
      </span>
      <ol>
        {STOPS.map(([id, title]) => (
          <li key={id}>
            <a href={`#${id}`}>
              <span className={styles.jumpLabel}>
                <span aria-hidden="true">&gt; </span>
                {title}
              </span>
              <span className={styles.jumpMark} aria-hidden="true">
                <span className={styles.jumpDot} />
                <span className={styles.jumpIcon}>
                  <span className={styles.jumpRing} />
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    {ICONS[id]}
                  </svg>
                </span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
