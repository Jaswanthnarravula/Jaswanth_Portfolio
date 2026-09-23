'use client';
import { useEffect, useMemo, useState } from 'react';
import { getPerson, getProjects, getResume, getSkills } from '@/data/selectors';
import { IconButton, Symbol, TopBar } from '../ui';
import { useAndroid, useAppUi } from '../shell-context';
import type { AndroidAppProps } from './types';
import styles from '../android.module.css';

interface Note {
  id: string;
  title: string;
  lines: readonly string[];
  label: string;
  pinned?: boolean;
  tone: number;
}

export default function Keep({ id, headingId }: AndroidAppProps) {
  const android = useAndroid();
  const [screen, setScreen] = useAppUi(id, 'note', '');
  const [query, setQuery] = useState('');
  const [label, setLabel] = useState('');
  const [list, setList] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [dialog, setDialog] = useState(false);
  const notes = useMemo<readonly Note[]>(() => {
    const skills = getSkills();
    return [
      {
        id: 'overview',
        title: 'Skills — overview',
        lines: skills.flatMap((group) => group.items.map((item) => item.name)).slice(0, 8),
        label: 'Overview',
        pinned: true,
        tone: 0,
      },
      {
        id: 'work',
        title: 'How I work',
        lines: [
          getPerson().headline,
          ...getPerson().summary,
          ...getProjects()
            .filter((project) => project.featured)
            .map((project) => project.name),
        ].slice(0, 8),
        label: 'Work',
        pinned: true,
        tone: 1,
      },
      ...skills.map((group, index) => ({
        id: group.id,
        title: group.label,
        lines: group.items.map((item) => `${item.name} · ${item.level}/5`),
        label: group.label,
        tone: (index % 4) + 2,
      })),
      {
        id: 'projects',
        title: 'Stack by project',
        lines: getProjects().map((project) => `${project.name}: ${project.stack.join(', ')}`),
        label: 'Projects',
        tone: 3,
      },
    ];
  }, []);
  const chosen = notes.find((note) => note.id === screen);
  useEffect(
    () =>
      android.registerBack(id, () => {
        if (dialog) {
          setDialog(false);
          return true;
        }
        if (drawer) {
          setDrawer(false);
          return true;
        }
        if (chosen) {
          setScreen(null);
          return true;
        }
        return false;
      }),
    [android, id, dialog, drawer, chosen, setScreen],
  );
  if (chosen)
    return (
      <div className={styles.app} aria-labelledby={headingId} data-app="keep">
        <TopBar
          title={chosen.title}
          back={android.back}
          actions={
            <>
              <IconButton label="Pin note">
                <Symbol>push_pin</Symbol>
              </IconButton>
              <IconButton label="Note options">
                <Symbol>more_vert</Symbol>
              </IconButton>
            </>
          }
        />
        <article className={styles.notePage} data-tone={chosen.tone}>
          <h3>{chosen.title}</h3>
          <ul>
            {chosen.lines.map((line, index) => (
              <li key={index}>{line}</li>
            ))}
          </ul>
          <p>Edited {getResume().updated}</p>
        </article>
      </div>
    );
  const shown = notes.filter(
    (note) =>
      (!label || note.label === label) &&
      (!query || `${note.title} ${note.lines.join(' ')}`.toLowerCase().includes(query.toLowerCase())),
  );
  return (
    <div className={styles.app} aria-labelledby={headingId} data-app="keep">
      <header className={styles.keepSearch}>
        <IconButton label="Labels" onClick={() => setDrawer(true)}>
          <Symbol>menu</Symbol>
        </IconButton>
        <input
          aria-label="Search your notes"
          placeholder="Search your notes"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <IconButton label={list ? 'Grid view' : 'List view'} onClick={() => setList((value) => !value)}>
          <Symbol>{list ? 'grid_view' : 'view_agenda'}</Symbol>
        </IconButton>
        <span className={styles.avatar}>J</span>
      </header>
      <main className={styles.appScroller}>
        <div className={styles.noteBoard} data-list={list || undefined}>
          {label ? (
            <button className={styles.filterChip} onClick={() => setLabel('')}>
              {label} ×
            </button>
          ) : null}
          {['Pinned', 'Others'].map((section) => (
            <section key={section}>
              <h3>{section}</h3>
              <ul>
                {shown
                  .filter((note) => Boolean(note.pinned) === (section === 'Pinned'))
                  .map((note) => (
                    <li key={note.id}>
                      <button className={styles.noteCard} data-tone={note.tone} onClick={() => setScreen(note.id)}>
                        <strong>{note.title}</strong>
                        {note.lines.slice(0, 8).map((line, index) => (
                          <span key={index}>{line}</span>
                        ))}
                        <small>{note.label}</small>
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
          {shown.length === 0 ? <p>No matching notes</p> : null}
        </div>
      </main>
      <footer className={styles.keepBar} aria-label="Note actions">
        <span aria-hidden="true">
          <Symbol>check_box</Symbol>
          <Symbol>brush</Symbol>
          <Symbol>mic</Symbol>
          <Symbol>image</Symbol>
        </span>
        <button className={styles.fab} aria-label="New note" onClick={() => setDialog(true)}>
          <Symbol>add</Symbol>
        </button>
      </footer>
      {drawer ? (
        <div
          className={styles.modalScrim}
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setDrawer(false)}
        >
          <nav className={styles.sideSheet} aria-label="Labels">
            <h3>Labels</h3>
            <button
              onClick={() => {
                setLabel('');
                setDrawer(false);
              }}
            >
              All notes
            </button>
            {notes
              .map((note) => note.label)
              .filter((value, index, array) => array.indexOf(value) === index)
              .map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setLabel(item);
                    setDrawer(false);
                  }}
                >
                  {item}
                </button>
              ))}
          </nav>
        </div>
      ) : null}
      {dialog ? (
        <div className={styles.modalScrim}>
          <section className={styles.basicDialog} role="dialog" aria-modal="true" aria-labelledby="read-only-title">
            <h3 id="read-only-title">This board is read-only</h3>
            <p>These notes describe my skills, but you can write to me instead.</p>
            <div>
              <button onClick={() => setDialog(false)}>Cancel</button>
              <button onClick={(event) => android.openApp('mail', undefined, event.currentTarget)}>Open Gmail</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
