'use client';
import { useEffect, useMemo, useState } from 'react';
import { ContentFor } from '@/components/content';
import { getPerson, getProjectsWithGithub } from '@/data/selectors';
import { currentLocation } from '@/lib/kernel/state';
import type { ContentRef } from '@/data/schema';
import { useKernel } from '@/stores/kernel-context';
import { dispatchSoon } from '@/stores/kernel-store';
import { BottomNav, IconButton, Symbol, TopBar } from '../ui';
import { useAndroid, useAppUi } from '../shell-context';
import type { AndroidAppProps } from './types';
import styles from '../android.module.css';

const NAV = [
  { id: 'home', label: 'Home', glyph: 'home' },
  { id: 'projects', label: 'Projects', glyph: 'source' },
  { id: 'profile', label: 'Profile', glyph: 'person' },
] as const;

export default function GitHub({ id, headingId }: AndroidAppProps) {
  const android = useAndroid();
  const windowState = useKernel((state) => state.sessions.android.windows[id]);
  const location = windowState ? currentLocation(windowState) : { kind: 'root' as const };
  const detail =
    location.kind === 'content' && location.ref.section === 'projects' && 'slug' in location.ref && !!location.ref.slug;
  const [tab, setTab] = useAppUi(id, 'tab', location.kind === 'content' ? 'projects' : 'home');
  const [readmeTab, setReadmeTab] = useAppUi(id, 'detail-tab', 'readme');
  const [filters, setFilters] = useState<readonly string[]>([]);
  const [menu, setMenu] = useState<string | null>(null);
  const repos = useMemo(() => getProjectsWithGithub(), []);
  useEffect(
    () =>
      android.registerBack(id, () => {
        if (menu) {
          setMenu(null);
          return true;
        }
        return false;
      }),
    [android, id, menu],
  );
  const open = (ref: ContentRef, origin?: HTMLElement) =>
    dispatchSoon({ type: 'NAVIGATE_IN_APP', id, location: { kind: 'content', ref }, ...(origin ? {} : {}) });
  if (detail) {
    const ref = location.ref;
    return (
      <div className={styles.app} aria-labelledby={headingId} data-app="github">
        <TopBar
          title="Repository"
          back={android.back}
          actions={
            <IconButton label="Share">
              <Symbol>share</Symbol>
            </IconButton>
          }
        />
        <div className={styles.detailTabs} role="tablist" aria-label="Repository">
          <button role="tab" aria-selected={readmeTab === 'readme'} onClick={() => setReadmeTab('readme')}>
            README
          </button>
          <button role="tab" aria-selected={readmeTab === 'stack'} onClick={() => setReadmeTab('stack')}>
            Stack
          </button>
          <button role="tab" aria-selected={readmeTab === 'about'} onClick={() => setReadmeTab('about')}>
            About
          </button>
        </div>
        <main className={styles.appScroller}>
          {readmeTab === 'readme' ? (
            <ContentFor target={ref} headingLevel={3} />
          ) : (
            <section className={styles.proseCard}>
              <h4>{readmeTab === 'stack' ? 'Technology stack' : 'About this repository'}</h4>
              <ContentFor target={ref} density="compact" headingLevel={4} />
            </section>
          )}
        </main>
      </div>
    );
  }
  const shown = filters.length
    ? repos.filter(({ project }) =>
        filters.some((filter) => project.stack.some((item) => item.toLowerCase().includes(filter))),
      )
    : repos;
  return (
    <div className={styles.app} aria-labelledby={headingId} data-app="github">
      <TopBar
        title={tab === 'projects' ? 'Repositories' : tab === 'profile' ? 'Profile' : 'Home'}
        actions={
          <IconButton label="Search">
            <Symbol>search</Symbol>
          </IconButton>
        }
      />
      <main className={styles.appScroller}>
        {tab === 'home' ? (
          <div className={styles.materialPage}>
            <h4>My work</h4>
            <button className={styles.listRow} onClick={() => setTab('projects')}>
              <Symbol>source</Symbol>
              <span>
                <strong>Projects</strong>
                <small>Repositories and case studies</small>
              </span>
            </button>
            <button
              className={styles.listRow}
              onClick={(event) => android.openContent({ section: 'resume' }, event.currentTarget)}
            >
              <Symbol>description</Symbol>
              <span>
                <strong>Résumé</strong>
                <small>Experience and skills</small>
              </span>
            </button>
            <button
              className={styles.listRow}
              onClick={(event) => android.openApp('mail', undefined, event.currentTarget)}
            >
              <Symbol>mail</Symbol>
              <span>
                <strong>Contact</strong>
                <small>Start a conversation</small>
              </span>
            </button>
            <h4>Favorites</h4>
            <div className={styles.cardRail}>
              {repos
                .filter(({ project }) => project.featured)
                .map(({ project }) => (
                  <button
                    key={project.slug}
                    className={styles.projectCard}
                    onClick={(event) => open({ section: 'projects', slug: project.slug }, event.currentTarget)}
                  >
                    <strong>{project.name}</strong>
                    <span>{project.tagline}</span>
                  </button>
                ))}
            </div>
          </div>
        ) : null}
        {tab === 'projects' ? (
          <div className={styles.materialPage}>
            <div className={styles.chips} role="group" aria-label="Filter repositories">
              {['react', 'typescript', 'cloud'].map((filter) => (
                <button
                  key={filter}
                  aria-pressed={filters.includes(filter)}
                  onClick={() =>
                    setFilters((all) =>
                      all.includes(filter) ? all.filter((item) => item !== filter) : [...all, filter],
                    )
                  }
                >
                  {filters.includes(filter) ? '✓ ' : ''}
                  {filter}
                </button>
              ))}
            </div>
            <ul className={styles.projectList}>
              {shown.map(({ project, github }) => (
                <li key={project.slug}>
                  <button
                    className={styles.projectCard}
                    onClick={(event) => open({ section: 'projects', slug: project.slug }, event.currentTarget)}
                  >
                    <strong>{project.name}</strong>
                    <span>{project.tagline}</span>
                    <small>
                      {project.stack[0]} · ★ {github?.stars ?? 0} · {project.year}
                    </small>
                  </button>
                  <IconButton label={`${project.name} menu`} onClick={() => setMenu(project.slug)}>
                    <Symbol>more_vert</Symbol>
                  </IconButton>
                </li>
              ))}
            </ul>
            {shown.length === 0 ? (
              <p>
                No repositories match. <button onClick={() => setFilters([])}>Clear</button>
              </p>
            ) : null}
          </div>
        ) : null}
        {tab === 'profile' ? (
          <div className={styles.profilePage}>
            <span className={styles.bigAvatar}>{getPerson().givenName[0]}</span>
            <h4>{getPerson().name}</h4>
            <p>{getPerson().headline}</p>
            <h4>Pinned</h4>
            <div className={styles.cardGrid}>
              {repos.slice(0, 4).map(({ project }) => (
                <button
                  key={project.slug}
                  className={styles.projectCard}
                  onClick={() => open({ section: 'projects', slug: project.slug })}
                >
                  {project.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </main>
      <BottomNav items={NAV} current={tab} onChange={setTab} />
      {menu ? (
        <div className={styles.popupMenu} role="menu" aria-label="Repository menu">
          <button
            role="menuitem"
            onClick={() => {
              const project = repos.find(({ project }) => project.slug === menu)?.project;
              if (project) open({ section: 'projects', slug: project.slug });
              setMenu(null);
            }}
          >
            Open
          </button>
          <button
            role="menuitem"
            onClick={() => {
              android.notify('Link copied');
              setMenu(null);
            }}
          >
            Copy link
          </button>
          <button role="menuitem" onClick={() => setMenu(null)}>
            Share
          </button>
        </div>
      ) : null}
    </div>
  );
}
