'use client';
/**
 * Safari — the portfolio overview in a believable browser (plans/macos/apps/safari.md, `MAC-SAF-01…07`).
 *   · unified toolbar: sidebar toggle · back/forward · the centred address pill (read-only "Address", selects on focus,
 *     offers Copy Link) · Share (Copy Link / plain version) · tab overview; tab bar About · Now · Plain version (APG
 *     tabs, session state, no history); favourites bar GitHub · Résumé · Mail (they open apps);
 *   · the About page is `AboutOverview` plus a featured-project strip, a skills snapshot and a contact call to action —
 *     all from the selectors and content views;
 *   · the only Lenis + ScrollTrigger in the product (`MOTION-SCROLL-01`): scoped to this page's own scroller, fine
 *     pointer + tier ≥ 1 + full motion only, loaded on open, destroyed on close / minimize; every effect is an
 *     enhancement — the content is complete and visible without it (`MAC-SAF-04`).
 * Compact: the address pill + Share, tabs as a bottom segmented control, native scroll.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AboutOverview, ContentFor, copyText, SkillsMatrix } from '@/components/content';
import { KernelLink } from '@/components/shell/KernelLink';
import { getCurrentRole, getFeaturedProjects, getPerson, getProjects, getSkills } from '@/data/selectors';
import { attachOverviewScroll, overviewScrollAllowed, refreshOverviewScroll } from '@/lib/motion/overview-scroll';
import { useAppCommands } from '../commands';
import { ChevronLeft, ChevronRight } from '../icons';
import { ShareGlyph, SidebarGlyph, TabsGlyph } from '../glyphs';
import { MAC_SLOTS } from '../slots';
import { notify, setAppState } from '../ui';
import type { WindowBodyProps } from '../window/Window';
import app from './app.module.css';
import styles from './safari.module.css';

type Tab = 'about' | 'now' | 'plain';
const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'about', label: 'About' },
  { id: 'now', label: 'Now' },
  { id: 'plain', label: 'Plain version' },
];
const ADDRESS: Readonly<Record<Tab, string>> = {
  about: 'jaswanth.dev/about',
  now: 'jaswanth.dev/now',
  plain: 'jaswanth.dev/plain',
};

export default function Safari({ window: win, titleId, compact }: WindowBodyProps) {
  const [tab, setTab] = useState<Tab>('about');
  const [favourites, setFavourites] = useState(true);
  const [sidebar, setSidebar] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reloads, setReloads] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLSpanElement>(null);
  const person = getPerson();
  const current = getCurrentRole();

  useEffect(() => setAppState('browser:favourites', favourites), [favourites]);

  // The load line: real milestones — the page mounted (0.6), its effects attached or declined (1).
  useEffect(() => {
    const line = progress.current;
    if (!line) return;
    line.style.transform = 'scaleX(0.6)';
    line.style.opacity = '1';
  }, [tab, reloads]);

  // Scroll effects, scoped to this page's scroller (About only), torn down on tab change, close and minimize.
  useEffect(() => {
    const node = scroller.current;
    const line = progress.current;
    // The effects are an enhancement: when the gate declines (reduced motion, coarse pointer, low tier) nothing loads.
    if (!node || tab !== 'about' || !overviewScrollAllowed()) {
      if (line) finishLoad(line);
      return;
    }
    const lifetime = new AbortController();
    let cleanup: (() => void) | null = null;
    void attachOverviewScroll(
      node,
      ({ gsap, ScrollTrigger, scroller: target }) => {
        for (const heading of target.querySelectorAll<HTMLElement>('[data-reveal]'))
          gsap.from(heading, {
            opacity: 0,
            y: 16,
            duration: 0.5,
            ease: 'power2.out',
            scrollTrigger: { trigger: heading, scroller: target, start: 'top 88%', once: true },
          });
        const strip = target.querySelector<HTMLElement>('[data-strip]');
        const track = strip?.querySelector<HTMLElement>('[data-track]');
        if (strip && track && track.scrollWidth > strip.clientWidth)
          gsap.to(track, {
            x: () => -(track.scrollWidth - strip.clientWidth),
            ease: 'none',
            scrollTrigger: { trigger: strip, scroller: target, start: 'top 75%', end: 'bottom 25%', scrub: true },
          });
        for (const counter of target.querySelectorAll<HTMLElement>('[data-count]')) {
          const to = Number(counter.dataset.count);
          const state = { value: 0 };
          gsap.to(state, {
            value: to,
            duration: 0.8,
            ease: 'power1.out',
            onUpdate: () => void (counter.textContent = String(Math.round(state.value))),
            scrollTrigger: { trigger: counter, scroller: target, start: 'top 90%', once: true },
          });
        }
        ScrollTrigger.refresh();
      },
      { signal: lifetime.signal },
    ).then((dispose) => {
      cleanup = dispose;
      if (line) finishLoad(line);
      if (lifetime.signal.aborted) dispose();
    });
    return () => {
      lifetime.abort();
      cleanup?.();
    };
  }, [tab, reloads]);

  // A resize commit re-measures the scroll effects.
  useEffect(() => {
    const node = scroller.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      if (timer) clearTimeout(timer);
      // Only refresh effects that are running: a declined gate never downloads ScrollTrigger on resize.
      timer = setTimeout(() => {
        if (overviewScrollAllowed()) void refreshOverviewScroll();
      }, 150);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const choose = (next: Tab) => {
    setTab(next);
    scroller.current?.scrollTo({ top: 0 });
  };

  const copyLink = async () => {
    setShareOpen(false);
    const outcome = await copyText(`${window.location.origin}/go/about`, navigator.clipboard);
    if (outcome === 'copied') notify({ kind: 'link-copied' });
  };

  useAppCommands('browser', (command, arg) => {
    if (command === 'new-tab') choose(TABS[(TABS.findIndex((t) => t.id === tab) + 1) % TABS.length]!.id);
    else if (command === 'close-tab') choose('about');
    else if (command === 'reload') setReloads((value) => value + 1);
    else if (command === 'toggle-favourites') setFavourites((value) => !value);
    else if (command === 'tab' && (arg === 'about' || arg === 'now')) choose(arg);
  });

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = TABS.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % TABS.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + TABS.length) % TABS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    choose(TABS[next]!.id);
    event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  };

  const tabList = (className: string | undefined) => (
    <div role="tablist" aria-label="Tabs" className={className}>
      {TABS.map((entry, index) => (
        <button
          key={entry.id}
          type="button"
          role="tab"
          id={`safari-tab-${entry.id}`}
          aria-selected={tab === entry.id}
          aria-controls="safari-panel"
          tabIndex={tab === entry.id ? 0 : -1}
          onClick={() => choose(entry.id)}
          onKeyDown={(event) => onTabKey(event, index)}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className={`${app.app} ${styles.safari}`} data-body="">
      <header className={`${app.toolbar} ${styles.toolbar}`} data-drag-region="">
        <h2 id={titleId} className="sr-only">
          Safari — {TABS.find((entry) => entry.id === tab)!.label}
        </h2>
        <button
          type="button"
          className={`${app.tool} ${styles.wide}`}
          aria-label="Show sidebar"
          aria-pressed={sidebar}
          onClick={() => setSidebar((value) => !value)}
        >
          <SidebarGlyph />
        </button>
        <span className={styles.wide}>
          <button type="button" className={app.tool} aria-label="Back" disabled>
            <ChevronLeft size={16} />
          </button>
          <button type="button" className={app.tool} aria-label="Forward" disabled>
            <ChevronRight size={16} />
          </button>
        </span>
        <label className={styles.address}>
          <span className="sr-only">Address</span>
          <input
            readOnly
            value={ADDRESS[tab]}
            onFocus={(event) => {
              event.currentTarget.select();
              setShareOpen(true);
            }}
            spellCheck={false}
          />
        </label>
        <span className={styles.shareWrap}>
          <button
            type="button"
            className={app.tool}
            aria-label="Share"
            aria-haspopup="true"
            aria-expanded={shareOpen}
            onClick={() => setShareOpen((open) => !open)}
          >
            <ShareGlyph />
          </button>
          {shareOpen ? (
            <span className={styles.shareMenu} role="group" aria-label="Share">
              <button type="button" onClick={() => void copyLink()}>
                Copy Link
              </button>
              <a href="/plain">Open plain version</a>
            </span>
          ) : null}
        </span>
        <button type="button" className={`${app.tool} ${styles.wide}`} aria-label="Tab overview" disabled>
          <TabsGlyph />
        </button>
        <span className={styles.progress} aria-hidden="true">
          <span ref={progress} />
        </span>
      </header>
      {compact ? null : tabList(styles.tabs)}
      {favourites && !compact ? (
        <nav className={styles.favourites} aria-label="Favourites bar">
          <KernelLink to={{ os: 'macos', role: 'github' }}>GitHub</KernelLink>
          <KernelLink to={{ os: 'macos', ref: { section: 'resume' } }}>Résumé</KernelLink>
          <KernelLink to={{ os: 'macos', role: 'mail' }}>Mail</KernelLink>
        </nav>
      ) : null}
      <div className={app.split}>
        {sidebar && !compact ? (
          <nav className={`${app.sidebar} ${styles.sidebar}`} aria-label="Reading list">
            <p className={app.sidebarHeading}>Reading List</p>
            <ul className={app.sourceList}>
              {TABS.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={app.sourceItem}
                    aria-current={tab === entry.id ? 'true' : undefined}
                    onClick={() => choose(entry.id)}
                  >
                    {entry.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <div
          ref={scroller}
          className={styles.page}
          role="tabpanel"
          id="safari-panel"
          aria-labelledby={`safari-tab-${tab}`}
          // The page scrolls; keyboard users scroll it with the arrow keys once it has focus.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          data-window-role={win.role}
        >
          <div className={styles.content} key={`${tab}-${reloads}`}>
            {tab === 'about' ? (
              <article className={styles.article}>
                <p className={styles.hero} data-reveal="">
                  {person.headline}.
                </p>
                <AboutOverview data={{ person, featured: [], current }} headingLevel={3} slots={MAC_SLOTS} />
                <section className={styles.section} aria-labelledby="safari-work">
                  <h3 id="safari-work" data-reveal="">
                    Selected work
                  </h3>
                  <div className={styles.strip} data-strip="">
                    <ul className={styles.track} data-track="">
                      {getFeaturedProjects().map((project) => (
                        <li key={project.slug}>
                          <KernelLink
                            to={{ os: 'macos', ref: { section: 'projects', slug: project.slug } }}
                            className={styles.card}
                          >
                            <span className={styles.cardContext}>{project.context}</span>
                            <span className={styles.cardName}>{project.name}</span>
                            <span className={styles.cardBody}>{project.tagline}</span>
                          </KernelLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className={styles.stats}>
                    <span>
                      <span className={styles.statValue} aria-hidden="true" data-count={getProjects().length}>
                        {getProjects().length}
                      </span>
                      <span className="sr-only">{getProjects().length}</span> projects
                    </span>
                    <span>
                      <span
                        className={styles.statValue}
                        aria-hidden="true"
                        data-count={getSkills().reduce((sum, group) => sum + group.items.length, 0)}
                      >
                        {getSkills().reduce((sum, group) => sum + group.items.length, 0)}
                      </span>
                      <span className="sr-only">{getSkills().reduce((sum, group) => sum + group.items.length, 0)}</span>{' '}
                      tools and skills
                    </span>
                  </p>
                  <p>
                    <KernelLink to={{ os: 'macos', ref: { section: 'projects' } }}>
                      See every project in GitHub
                    </KernelLink>
                  </p>
                </section>
                <section className={styles.section} aria-labelledby="safari-skills">
                  <h3 id="safari-skills" data-reveal="">
                    Skills snapshot
                  </h3>
                  <SkillsMatrix data={getSkills().slice(0, 3)} density="compact" headingLevel={4} />
                  <p>
                    <KernelLink to={{ os: 'macos', ref: { section: 'skills' } }}>The full list, in VS Code</KernelLink>
                  </p>
                </section>
                <section className={`${styles.section} ${styles.cta}`} aria-labelledby="safari-contact">
                  <h3 id="safari-contact" data-reveal="">
                    Get in touch
                  </h3>
                  <p>{person.openTo}</p>
                  <p className={styles.ctaActions}>
                    <KernelLink to={{ os: 'macos', ref: { section: 'contact' } }} className={styles.ctaPrimary}>
                      Write in Mail
                    </KernelLink>
                    <KernelLink to={{ os: 'macos', ref: { section: 'resume' } }} className={styles.ctaSecondary}>
                      Read the résumé
                    </KernelLink>
                  </p>
                </section>
              </article>
            ) : null}
            {tab === 'now' ? (
              <article className={styles.article}>
                <h3>Now</h3>
                {current ? (
                  <p className={styles.hero}>
                    {current.role ? `${current.role} at ${current.company}` : current.company}. {current.summary}
                  </p>
                ) : null}
                <p>{person.openTo}</p>
                <p>
                  <KernelLink to={{ os: 'macos', ref: { section: 'experience' } }}>Every role, in Finder</KernelLink>
                </p>
              </article>
            ) : null}
            {tab === 'plain' ? (
              <article className={`${styles.article} ${styles.plain}`}>
                {(['about', 'projects', 'experience', 'education', 'skills', 'contact'] as const).map((section) => (
                  <section key={section} className={styles.section}>
                    <ContentFor target={{ section }} headingLevel={3} slots={MAC_SLOTS} />
                  </section>
                ))}
              </article>
            ) : null}
          </div>
        </div>
      </div>
      {compact ? tabList(styles.segmented) : null}
    </div>
  );
}

function finishLoad(line: HTMLElement) {
  line.style.transform = 'scaleX(1)';
  window.setTimeout(() => {
    line.style.opacity = '0';
  }, 160);
}
