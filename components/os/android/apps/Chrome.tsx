'use client';
import { useEffect, useRef, useState } from 'react';
import { AboutOverview } from '@/components/content';
import { getCurrentRole, getFeaturedProjects, getPerson } from '@/data/selectors';
import { IconButton, Symbol } from '../ui';
import { useAndroid } from '../shell-context';
import type { AndroidAppProps } from './types';
import styles from '../android.module.css';

export default function Chrome({ id, headingId, layout }: AndroidAppProps) {
  const android = useAndroid();
  const [menu, setMenu] = useState(false);
  const [tabs, setTabs] = useState(false);
  const [share, setShare] = useState(false);
  const [find, setFind] = useState(false);
  const [query, setQuery] = useState('');
  const [hidden, setHidden] = useState(false);
  const lastScroll = useRef(0);
  const findInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (find) findInput.current?.focus();
  }, [find]);
  useEffect(
    () =>
      android.registerBack(id, () => {
        if (share) {
          setShare(false);
          return true;
        }
        if (menu) {
          setMenu(false);
          return true;
        }
        if (tabs) {
          setTabs(false);
          return true;
        }
        if (find) {
          setFind(false);
          setQuery('');
          return true;
        }
        return false;
      }),
    [android, id, share, menu, tabs, find],
  );
  const person = getPerson();
  return (
    <div className={styles.app} aria-labelledby={headingId} data-app="chrome">
      {layout === 'large' ? (
        <div className={styles.tabStrip}>
          <button type="button" aria-current="page">
            <Symbol>language</Symbol>
            About
          </button>
          <a href="/plain">
            <Symbol>article</Symbol>
            Plain version
          </a>
          <button type="button" aria-label="New tab">
            <Symbol>add</Symbol>
          </button>
        </div>
      ) : null}
      <header className={styles.chromeBar} data-hidden={hidden || undefined} role="toolbar" aria-label="Chrome toolbar">
        {find ? (
          <>
            <input
              ref={findInput}
              aria-label="Find in page"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find in page"
            />
            <span>{query ? '1 / 1' : '0 / 0'}</span>
            <IconButton label="Close find" onClick={() => setFind(false)}>
              <Symbol>close</Symbol>
            </IconButton>
          </>
        ) : (
          <>
            <label className={styles.omnibox}>
              <Symbol>tune</Symbol>
              <input
                aria-label="Address"
                readOnly
                value="jaswanth.dev"
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
            <button className={styles.tabCount} type="button" aria-label="2 open tabs" onClick={() => setTabs(true)}>
              <span aria-hidden="true">2</span>
            </button>
            <IconButton label="Chrome menu" aria-haspopup="menu" onClick={() => setMenu((value) => !value)}>
              <Symbol>more_vert</Symbol>
            </IconButton>
          </>
        )}
      </header>
      <div className={styles.progress} aria-hidden="true" />
      <article
        className={styles.chromePage}
        onScroll={(event) => {
          const top = event.currentTarget.scrollTop;
          if (Math.abs(top - lastScroll.current) > 16) {
            setHidden(top > lastScroll.current && top > 80);
            lastScroll.current = top;
          }
        }}
      >
        <AboutOverview data={{ person, featured: getFeaturedProjects(), current: getCurrentRole() }} headingLevel={3} />
      </article>
      {menu ? (
        <div className={styles.popupMenu} role="menu" aria-label="Chrome menu">
          <button role="menuitem" onClick={() => setMenu(false)}>
            New tab
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setFind(true);
              setMenu(false);
            }}
          >
            Find in page
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setShare(true);
              setMenu(false);
            }}
          >
            Share…
          </button>
          <button role="menuitem" onClick={(event) => android.openApp('github', undefined, event.currentTarget)}>
            Bookmarks › GitHub
          </button>
          <button role="menuitemcheckbox" aria-checked="false">
            Desktop site
          </button>
        </div>
      ) : null}
      {tabs ? (
        <div
          className={styles.modalScrim}
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setTabs(false)}
        >
          <section className={styles.tabSwitcher} role="dialog" aria-modal="true" aria-label="Open tabs">
            <header>
              <h4>Tabs</h4>
              <IconButton label="Close tabs" onClick={() => setTabs(false)}>
                <Symbol>close</Symbol>
              </IconButton>
            </header>
            <div>
              <button type="button" onClick={() => setTabs(false)}>
                <strong>About</strong>
                <span>jaswanth.dev</span>
              </button>
              <a href="/plain">
                <strong>Plain version</strong>
                <span>Accessible portfolio</span>
              </a>
            </div>
          </section>
        </div>
      ) : null}
      {share ? (
        <div
          className={styles.modalScrim}
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setShare(false)}
        >
          <section className={styles.bottomSheet} role="dialog" aria-modal="true" aria-label="Share">
            <span className={styles.dragHandle} />
            <h4>Share</h4>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(location.href);
                android.notify('Link copied');
                setShare(false);
              }}
            >
              Copy link
            </button>
            <a href="/plain">Plain version</a>
            <button type="button" onClick={android.downloadResume}>
              Download résumé
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}
