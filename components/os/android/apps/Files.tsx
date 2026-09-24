'use client';
import { useEffect, useMemo, useState } from 'react';
import { ContentFor, formatPeriod, formatUpdated, ResumeDocument, ResumePages } from '@/components/content';
import {
  getEducation,
  getExperience,
  getProjects,
  getResume,
  getResumeFileMeta,
  getResumePages,
  getResumeText,
} from '@/data/selectors';
import type { ContentRef } from '@/data/schema';
import { currentLocation } from '@/lib/kernel/state';
import { useKernel } from '@/stores/kernel-context';
import { dispatchSoon } from '@/stores/kernel-store';
import { BottomNav, IconButton, Symbol, TopBar } from '../ui';
import { useAndroid, useAppUiJson } from '../shell-context';
import type { AndroidAppProps } from './types';
import styles from '../android.module.css';

const NAV = [
  { id: 'browse', label: 'Browse', glyph: 'folder' },
  { id: 'starred', label: 'Starred', glyph: 'star' },
] as const;

export default function Files({ id, headingId }: AndroidAppProps) {
  const android = useAndroid();
  const windowState = useKernel((state) => state.sessions.android.windows[id]);
  const location = windowState ? currentLocation(windowState) : { kind: 'root' as const };
  const ref = location.kind === 'content' ? location.ref : null;
  const [tab, setTab] = useState('browse');
  const [stars, setStars] = useAppUiJson<readonly string[]>(id, 'stars', ['resume']);
  const [menu, setMenu] = useState<ContentRef | null>(null);
  const [info, setInfo] = useState<ContentRef | null>(null);
  const [grid, setGrid] = useState(false);
  const experience = useMemo(() => getExperience(), []);
  const education = useMemo(() => getEducation(), []);
  useEffect(
    () =>
      android.registerBack(id, () => {
        if (info) {
          setInfo(null);
          return true;
        }
        if (menu) {
          setMenu(null);
          return true;
        }
        return false;
      }),
    [android, id, info, menu],
  );
  const navigate = (target: ContentRef) =>
    dispatchSoon({ type: 'NAVIGATE_IN_APP', id, location: { kind: 'content', ref: target } });
  if (ref) {
    const title =
      ref.section === 'resume'
        ? 'Résumé.pdf'
        : ref.section === 'experience'
          ? 'slug' in ref && ref.slug
            ? (experience.find((item) => item.slug === ref.slug)?.company ?? 'Experience')
            : 'Experience'
          : ref.section === 'education'
            ? 'slug' in ref && ref.slug
              ? (education.find((item) => item.slug === ref.slug)?.shortName ?? 'Education')
              : 'Education'
            : ref.section;
    if (ref.section === 'resume') {
      const meta = getResumeFileMeta();
      return (
        <div className={styles.app} aria-labelledby={headingId} data-app="files" data-pdf="">
          <TopBar
            title={title}
            back={android.back}
            actions={
              <>
                <IconButton label="Search document">
                  <Symbol>search</Symbol>
                </IconButton>
                <a
                  className={styles.iconButton}
                  aria-label="Download résumé"
                  href={getResume().file}
                  download={getResume().downloadName}
                >
                  <Symbol>download</Symbol>
                </a>
                <IconButton label="More options">
                  <Symbol>more_vert</Symbol>
                </IconButton>
              </>
            }
          />
          <main className={styles.pdfArea}>
            {/* The words for assistive tech: the actions, then the PDF's own text. */}
            <div className="sr-only">
              <ContentFor target={ref} headingLevel={3} resumePages={false} />
              <ResumeDocument data={getResumeText()} headingLevel={4} />
            </div>
            {/* The page itself: the published PDF (the owner's Resume.pdf), rendered at build time. */}
            <ResumePages
              pages={getResumePages()}
              sizes="(max-width: 852px) 100vw, 800px"
              className={styles.pdfPages}
              pageClassName={styles.pdfPaper}
            />
            <span className={styles.pageChip}>1 / {meta?.pages ?? 1}</span>
            <a
              className={styles.extendedFab}
              href={getResume().file}
              download={getResume().downloadName}
              onClick={() => android.notify('Résumé.pdf · Download complete')}
            >
              <Symbol>download</Symbol>
              <span>Download</span>
            </a>
          </main>
        </div>
      );
    }
    const collection = !('slug' in ref) || !ref.slug;
    return (
      <div className={styles.app} aria-labelledby={headingId} data-app="files">
        <TopBar
          title={title[0]!.toUpperCase() + title.slice(1)}
          back={android.back}
          actions={
            collection ? (
              <>
                <IconButton label="Toggle view" onClick={() => setGrid((value) => !value)}>
                  <Symbol>{grid ? 'view_list' : 'grid_view'}</Symbol>
                </IconButton>
                <IconButton label="Sort">
                  <Symbol>sort</Symbol>
                </IconButton>
              </>
            ) : (
              <IconButton label="Share">
                <Symbol>share</Symbol>
              </IconButton>
            )
          }
        />
        <main className={styles.appScroller}>
          {collection ? (
            <ul className={grid ? styles.fileGrid : styles.fileList}>
              {(ref.section === 'experience' ? experience : education).map((item) => {
                const slug = item.slug;
                const primary = 'company' in item ? item.company : item.school;
                const secondary =
                  'role' in item ? `${item.role ?? 'Experience'} · ${formatPeriod(item.start, item.end)}` : item.degree;
                return (
                  <li key={slug}>
                    <button
                      className={styles.fileRow}
                      onClick={() => navigate({ section: ref.section as 'experience' | 'education', slug })}
                    >
                      <span className={styles.fileArt}>
                        <Symbol>description</Symbol>
                      </span>
                      <span>
                        <strong>{primary}</strong>
                        <small>{secondary}</small>
                      </span>
                    </button>
                    <IconButton
                      label={`${primary} options`}
                      onClick={() => setMenu({ section: ref.section as 'experience' | 'education', slug })}
                    >
                      <Symbol>more_vert</Symbol>
                    </IconButton>
                  </li>
                );
              })}
            </ul>
          ) : (
            <article className={styles.reader}>
              <ContentFor target={ref} headingLevel={3} />
            </article>
          )}
        </main>
        {menu ? (
          <div className={styles.popupMenu} role="menu" aria-label="File options">
            <button
              role="menuitem"
              onClick={() => {
                navigate(menu);
                setMenu(null);
              }}
            >
              Open
            </button>
            <button
              role="menuitem"
              onClick={() => {
                const key = 'slug' in menu && menu.slug ? menu.slug : menu.section;
                setStars(stars.includes(key) ? stars.filter((item) => item !== key) : [...stars, key]);
                android.notify('Added to Starred', { label: 'Undo', run: () => setStars(stars) });
                setMenu(null);
              }}
            >
              Star
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setInfo(menu);
                setMenu(null);
              }}
            >
              Info
            </button>
          </div>
        ) : null}
        {info ? (
          <div className={styles.modalScrim}>
            <section className={styles.bottomSheet} role="dialog" aria-modal="true" aria-label="File information">
              <span className={styles.dragHandle} />
              <h4>File information</h4>
              <p>Portfolio document</p>
              <p>Canonical path: /go/{info.section}</p>
              <button onClick={() => setInfo(null)}>Done</button>
            </section>
          </div>
        ) : null}
      </div>
    );
  }
  const categories = [
    { title: 'Documents', glyph: 'description', ref: { section: 'resume' } as ContentRef },
    { title: 'Experience', glyph: 'work', ref: { section: 'experience' } as ContentRef },
    { title: 'Education', glyph: 'school', ref: { section: 'education' } as ContentRef },
    { title: 'Projects', glyph: 'source', ref: { section: 'projects' } as ContentRef },
  ];
  return (
    <div className={styles.app} aria-labelledby={headingId} data-app="files">
      <header className={styles.searchHeader}>
        <button type="button" aria-label="Open navigation drawer">
          <Symbol>menu</Symbol>
        </button>
        <input aria-label="Search in Files" placeholder="Search in Files" />
        <span className={styles.avatar}>J</span>
      </header>
      <main className={styles.appScroller}>
        <div className={styles.materialPage}>
          {tab === 'starred' ? (
            <>
              <h3>Starred</h3>
              <button className={styles.recentCard} onClick={() => navigate({ section: 'resume' })}>
                <Symbol>picture_as_pdf</Symbol>
                <span>
                  <strong>Résumé.pdf</strong>
                  <small>Updated {formatUpdated(getResume().updated)}</small>
                </span>
              </button>
            </>
          ) : (
            <>
              <h3>Recents</h3>
              <div className={styles.cardRail}>
                <button className={styles.recentCard} onClick={() => navigate({ section: 'resume' })}>
                  <Symbol>picture_as_pdf</Symbol>
                  <span>
                    <strong>Résumé.pdf</strong>
                    <small>PDF document</small>
                  </span>
                </button>
                {experience.slice(0, 1).map((item) => (
                  <button
                    key={item.slug}
                    className={styles.recentCard}
                    onClick={() => navigate({ section: 'experience', slug: item.slug })}
                  >
                    <Symbol>description</Symbol>
                    <span>
                      <strong>{item.company}</strong>
                      <small>{item.role}</small>
                    </span>
                  </button>
                ))}
              </div>
              <h3>Categories</h3>
              <div className={styles.categoryGrid}>
                {categories.map((item) => (
                  <button
                    key={item.title}
                    onClick={(event) =>
                      item.ref.section === 'projects'
                        ? android.openContent(item.ref, event.currentTarget)
                        : navigate(item.ref)
                    }
                  >
                    <span className={styles.tonalIcon}>
                      <Symbol>{item.glyph}</Symbol>
                    </span>
                    <strong>{item.title}</strong>
                  </button>
                ))}
              </div>
              <h3>Storage devices</h3>
              <button className={styles.listRow} onClick={() => navigate({ section: 'experience' })}>
                <Symbol>smartphone</Symbol>
                <span>
                  <strong>Internal storage</strong>
                  <small>Jaswanth · {experience.length + education.length + getProjects().length + 1} items</small>
                </span>
              </button>
            </>
          )}
        </div>
      </main>
      <BottomNav items={NAV} current={tab} onChange={setTab} />
    </div>
  );
}
