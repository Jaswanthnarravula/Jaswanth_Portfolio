'use client';
/**
 * Microsoft Edge — the portfolio overview and the résumé viewer (plans/windows/apps/edge.md, `WIN-EDGE-01…06`).
 *   · tabs live in the Mica title bar (APG tablist, arrow keys; the rest of the title bar still drags the window):
 *     "About {givenName}" (`/windows/edge`) · "Résumé.pdf" (`/windows/edge/resume`) — routed, so Back, refresh and
 *     deep links work (`WIN-EDGE-03`) — and "+", which opens the preset "Plain version" tab (session state), then
 *     disables; the selected tab's card slides 167 ms, the page crossfades 167 ms;
 *   · toolbar: back / forward / refresh on the window's own history · the display-only address field (read-only and
 *     labelled; focus selects it and offers Copy link) with the decorative favourites star · ⋯ (Print · Copy link ·
 *     Open plain version); a thin accent progress line under it while a tab loads (real milestones);
 *   · the right sidebar strip (a vertical `toolbar`): GitHub · Outlook open those apps, Search opens Search;
 *   · About = the shared `AboutOverview` with the Overview's work strip, skills snapshot and contact call to action
 *     (the same content as macOS Safari — `WIN-EDGE-02`) in a nested scroller; Lenis + ScrollTrigger only through
 *     `attachOverviewScroll` (fine pointer, tier ≥ 1, full motion), torn down on tab change, close and minimize
 *     (`WIN-EDGE-05`); every effect is an enhancement — the page is complete without it;
 *   · Résumé.pdf = Edge's PDF viewer (`WIN-EDGE-04`): page `1 / N`, zoom − / + / fit (a transform on the sheet), rotate
 *     (disabled), Print, **Save** (a real `<a download>` + `resume_downloaded` + the "Download complete" toast); the text
 *     version (ResumeView + the PDF's own text on paper) is first in DOM, then the published PDF's pages as images
 *     (an inline `<object>` is blocked by the CSP — shared/03 VIEW-RESUME-01), an Open link if they could not be
 *     rendered; no PDF yet (placeholder phase) → the text version only, Save hidden.
 * medium: no sidebar strip. compact (`WIN-EDGE-06`): tabs become a scrolling row under a compact title, the PDF toolbar
 * is Save · ⋯, native scroll only. Print hides every piece of OS chrome (edge.module.css).
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  AboutOverview,
  ContentFor,
  goHref,
  ResumeDocument,
  resumeFileLabel,
  ResumePages,
  ResumeView,
  SkillsMatrix,
} from '@/components/content';
import type { MenuEntry } from '@/components/primitives/Menu';
import { RovingGroup } from '@/components/primitives/RovingGroup';
import { KernelLink } from '@/components/shell/KernelLink';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { SECTION_TITLES } from '@/data/content-index';
import type { ContentRef } from '@/data/schema';
import {
  getCurrentRole,
  getFeaturedProjects,
  getPerson,
  getProjects,
  getResume,
  getResumeFileMeta,
  getResumePages,
  getResumeText,
  getSkills,
} from '@/data/selectors';
import { analytics } from '@/lib/analytics/loader';
import { publicEnv } from '@/lib/config/environment';
import type { AppRole } from '@/lib/kernel/ids';
import { currentLocation } from '@/lib/kernel/state';
import type { AppLocation } from '@/lib/kernel/types';
import { cubicBezier } from '@/lib/motion/bezier';
import { dur, prefersReducedMotion } from '@/lib/motion/dur';
import {
  attachOverviewScroll,
  overviewScrollAllowed,
  refreshOverviewScroll,
  type ScrollKit,
} from '@/lib/motion/overview-scroll';
import { useKernel } from '@/stores/kernel-context';
import { dispatchSoon } from '@/stores/kernel-store';
import { flInfo, flLink, flMore, flOpen, flRefresh, flSearch } from '../fluent.generated';
import {
  flAdd,
  flArrowLeft,
  flArrowRight,
  flGlobe,
  flLock,
  flPageFit,
  flPrint,
  flRotate,
  flSave,
  flStarAdd,
  flZoomIn,
  flZoomOut,
} from '../fluent.apps.generated';
import { Fl, PdfFile } from '../icons';
import { EDGE_TAB_TITLES, edgeTab, userFolder, winBinding, type EdgeTab } from '../model';
import { WIN_CURVES, WIN_MOTION } from '../motion';
import { useWinShell } from '../shell-context';
import { downloadToast, WIN_SLOTS } from '../slots';
import { TitleBar, type WindowBodyProps } from '../window/Window';
import styles from './edge.module.css';

type Tab = EdgeTab | 'plain';

/** What the address bar shows: the same link Copy link copies (the site's own URL), and the résumé as a local file. */
const siteAddress = (ref: ContentRef) => new URL(goHref(ref), publicEnv.siteUrl).href;
const ADDRESS: Readonly<Record<Tab, string>> = {
  about: siteAddress({ section: 'about' }),
  resume: `file:///C:/Users/${userFolder()}/Résumé.pdf`,
  plain: new URL('/plain', publicEnv.siteUrl).href,
};
const LINK_REF: Readonly<Record<Tab, ContentRef | null>> = {
  about: { section: 'about' },
  resume: { section: 'resume' },
  plain: null,
};
const LOCATION: Readonly<Record<EdgeTab, AppLocation>> = {
  about: { kind: 'root' },
  resume: { kind: 'content', ref: { section: 'resume' } },
};
const PLAIN_TITLE = 'Plain version';
const PLAIN_SECTIONS = ['about', 'projects', 'experience', 'education', 'skills', 'contact'] as const;

/** US Letter at 96 dpi — one PDF page at 100 %. */
const PAGE_W = 816;
const PAGE_H = 1056;
const PAGE_GAP = 16;
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;

const curve = (name: keyof typeof WIN_CURVES) => `cubic-bezier(${WIN_CURVES[name].join(', ')})`;
const entrance = cubicBezier(...WIN_CURVES.entrance);

/** Slide the selected tab's card (its ::before) from where the previous one sat — 167 ms, compositor only. */
function slideIndicator(list: HTMLElement | null, last: { current: { list: HTMLElement; left: number } | null }) {
  const tab = list?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
  if (!list || !tab) return;
  const left = tab.offsetLeft;
  const from = last.current?.list === list ? last.current.left : null;
  last.current = { list, left };
  if (from === null || from === left || prefersReducedMotion() || typeof tab.animate !== 'function') return;
  try {
    tab.animate([{ transform: `translateX(${from - left}px)` }, { transform: 'none' }], {
      duration: WIN_MOTION.pill.ms,
      easing: curve('pointToPoint'),
      pseudoElement: '::before',
    });
  } catch {
    // No pseudo-element animation in this engine: the card simply moves.
  }
}

/** The Overview's scroll effects — the same content as macOS Safari, on the Windows curves and duration ladder. */
function overviewEffects({ gsap, ScrollTrigger, scroller }: ScrollKit) {
  for (const heading of scroller.querySelectorAll<HTMLElement>('[data-reveal]'))
    gsap.from(heading, {
      opacity: 0,
      y: WIN_MOTION.drillIn.rise,
      duration: WIN_MOTION.taskViewIn.ms / 1000,
      ease: entrance,
      scrollTrigger: { trigger: heading, scroller, start: 'top 88%', once: true },
    });
  const strip = scroller.querySelector<HTMLElement>('[data-strip]');
  const track = strip?.querySelector<HTMLElement>('[data-track]');
  if (strip && track && track.scrollWidth > strip.clientWidth)
    gsap.to(track, {
      x: () => -(track.scrollWidth - strip.clientWidth),
      ease: 'none',
      scrollTrigger: { trigger: strip, scroller, start: 'top 75%', end: 'bottom 25%', scrub: true },
    });
  for (const counter of scroller.querySelectorAll<HTMLElement>('[data-count]')) {
    const state = { value: 0 };
    gsap.to(state, {
      value: Number(counter.dataset.count),
      duration: 0.5,
      ease: entrance,
      onUpdate: () => void (counter.textContent = String(Math.round(state.value))),
      scrollTrigger: { trigger: counter, scroller, start: 'top 90%', once: true },
    });
  }
  ScrollTrigger.refresh();
}

type Timer = { current: ReturnType<typeof setTimeout> | null };

/** The thin accent progress line under the toolbar + the tab's spinner, driven by real milestones: start (0.6)… */
function beginLoad(line: HTMLElement | null, tab: HTMLElement | null, fade: Timer) {
  tab?.setAttribute('data-loading', '');
  if (!line) return;
  if (fade.current) clearTimeout(fade.current);
  line.style.transition = 'none';
  line.style.transform = 'scaleX(0)';
  line.style.opacity = '1';
  void line.offsetWidth;
  line.style.removeProperty('transition');
  line.style.transform = 'scaleX(0.6)';
}

/** …and ready (1), then the line fades. */
function endLoad(line: HTMLElement | null, tab: HTMLElement | null, fade: Timer) {
  tab?.removeAttribute('data-loading');
  if (!line) return;
  line.style.transform = 'scaleX(1)';
  fade.current = setTimeout(() => void (line.style.opacity = '0'), WIN_MOTION.pill.ms);
}

export default function Edge({ window: win, compact }: WindowBodyProps) {
  const shell = useWinShell();
  const medium = useKernel((state) => state.viewport.sizeClass === 'medium');
  const routed = edgeTab(currentLocation(win));
  const navKey = `${win.nav.index}/${win.nav.entries.length}/${routed}`;
  const [plainOpen, setPlainOpen] = useState(false);
  const [plainSelected, setPlainSelected] = useState(false);
  const [seenNav, setSeenNav] = useState(navKey);
  const [reloads, setReloads] = useState(0);
  const [offer, setOffer] = useState(false);
  const tablist = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const lastTab = useRef<{ list: HTMLElement; left: number } | null>(null);
  const focusPlain = useRef(false);
  const progress = useRef<HTMLSpanElement>(null);
  const fade = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Any navigation of the window's own history (Back, the taskbar's Résumé, a link) brings its routed tab forward.
  if (navKey !== seenNav) {
    setSeenNav(navKey);
    setPlainSelected(false);
  }
  const active: Tab = plainSelected ? 'plain' : routed;
  const tabs: readonly { id: Tab; title: string; icon: ReactNode }[] = [
    { id: 'about', title: EDGE_TAB_TITLES.about, icon: <Fl icon={flGlobe} size={16} /> },
    { id: 'resume', title: EDGE_TAB_TITLES.resume, icon: <PdfFile size={16} /> },
    ...(plainOpen ? [{ id: 'plain' as const, title: PLAIN_TITLE, icon: <Fl icon={flGlobe} size={16} /> }] : []),
  ];
  const activeTitle = tabs.find((tab) => tab.id === active)?.title ?? EDGE_TAB_TITLES[routed];

  const select = (next: Tab) => {
    if (next === 'plain') {
      setPlainSelected(true);
      return;
    }
    setPlainSelected(false);
    if (next !== routed) dispatchSoon({ type: 'NAVIGATE_IN_APP', id: win.id, location: LOCATION[next] });
  };
  const openPlain = () => {
    setPlainOpen(true);
    setPlainSelected(true);
    focusPlain.current = true;
  };

  // The selected tab's card slides; the page crossfades (167 ms); a new tab takes focus from the disabled "+".
  useLayoutEffect(() => {
    slideIndicator(tablist.current, lastTab);
    if (focusPlain.current) {
      focusPlain.current = false;
      document.getElementById('edge-tab-plain')?.focus({ preventScroll: true });
    }
  }, [active, plainOpen, compact]);
  const firstPaint = useRef(true);
  useLayoutEffect(() => {
    if (firstPaint.current) {
      firstPaint.current = false;
      return;
    }
    const el = panel.current;
    if (el && typeof el.animate === 'function')
      el.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: dur(WIN_MOTION.pill.ms, { crossfade: true }),
        easing: curve('entrance'),
      });
  }, [active, reloads]);

  // Loading milestones: the page mounted (0.6) → its scroll effects attached or declined (1). About's nested scroller
  // gets Lenis + ScrollTrigger (never in compact: native scroll), destroyed on tab change, close and minimize.
  const attached = useRef(false);
  useEffect(() => {
    const tab = tablist.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]') ?? null;
    const line = progress.current;
    beginLoad(line, tab, fade);
    const node = scroller.current;
    // The gate is asked here too: a declined attach resolves like a real one, and `attached` must stay false then,
    // or the first resize would download ScrollTrigger under reduced motion, on touch or at tier 0 (`WIN-EDGE-05`).
    if (active !== 'about' || !node || compact || !overviewScrollAllowed()) {
      endLoad(line, tab, fade);
      return;
    }
    const lifetime = new AbortController();
    let dispose: (() => void) | null = null;
    void attachOverviewScroll(node, overviewEffects, { signal: lifetime.signal }).then((cleanup) => {
      dispose = cleanup;
      attached.current = !lifetime.signal.aborted && node.isConnected;
      endLoad(line, tab, fade);
      if (lifetime.signal.aborted) cleanup();
    });
    return () => {
      lifetime.abort();
      attached.current = false;
      dispose?.();
      endLoad(line, tab, fade);
    };
  }, [active, reloads, compact]);
  useEffect(() => () => void (fade.current && clearTimeout(fade.current)), []);

  // A resize commit re-measures the scroll effects — only when they are attached (nothing loads otherwise).
  useEffect(() => {
    const node = scroller.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void (attached.current && refreshOverviewScroll()), 150);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [active]);

  // The Copy link offer stays while focus is inside the address field or the offer itself.
  const leaveAddress = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.closest('[data-address]')?.contains(event.relatedTarget as Node | null)) setOffer(false);
  };

  const copy = () => {
    const ref = LINK_REF[active];
    if (ref) shell.copyLink(ref, activeTitle);
    else shell.copyText(`${globalThis.location.origin}/plain`, 'Link copied');
  };
  const print = () => globalThis.print();

  const menuAt = (anchor: HTMLElement) => {
    const box = anchor.getBoundingClientRect();
    return { x: box.left, y: box.bottom + 4 };
  };
  const moreMenu = (anchor: HTMLElement) =>
    shell.openMenu({
      label: 'Settings and more',
      at: menuAt(anchor),
      returnFocusTo: anchor,
      items: [
        { kind: 'item', id: 'print', label: 'Print', shortcut: 'Ctrl+P', icon: <Fl icon={flPrint} />, onSelect: print },
        { kind: 'item', id: 'copy', label: 'Copy link', icon: <Fl icon={flLink} />, onSelect: copy },
        { kind: 'separator', id: 'sep' },
        {
          kind: 'item',
          id: 'plain',
          label: 'Open plain version',
          icon: <Fl icon={flOpen} />,
          disabled: active === 'plain',
          onSelect: openPlain,
        },
      ],
    });

  const openApp = (role: AppRole, originId: string) =>
    dispatchSoon({ type: 'OPEN_APP', os: 'windows', role, originId });

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    const keys: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(tabs[next]!.id);
    document.getElementById(`edge-tab-${tabs[next]!.id}`)?.focus({ preventScroll: true });
  };

  const tabList = (
    <div className={compact ? styles.tabRow : styles.tabs}>
      <div ref={tablist} role="tablist" aria-label="Tabs" className={styles.tabStrip}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`edge-tab-${tab.id}`}
            className={styles.tab}
            aria-selected={active === tab.id}
            aria-controls="edge-panel"
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => select(tab.id)}
            onKeyDown={(event) => onTabKey(event, index)}
          >
            <span className={styles.favicon} aria-hidden="true">
              {tab.icon}
            </span>
            <span className={styles.spinner} aria-hidden="true" />
            <span className={styles.tabLabel}>{tab.title}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className={styles.newTab}
        aria-label={plainOpen ? 'New tab (the plain version is open)' : 'New tab: plain version'}
        disabled={plainOpen}
        onClick={openPlain}
      >
        <Fl icon={flAdd} size={16} />
      </button>
    </div>
  );

  const canBack = active !== 'plain' && win.nav.index > 0;
  const canForward = active !== 'plain' && win.nav.index < win.nav.entries.length - 1;

  return (
    <>
      {compact ? (
        <TitleBar
          title={
            <>
              <span className="sr-only">Microsoft Edge — </span>
              {activeTitle}
            </>
          }
        />
      ) : (
        <TitleBar tall>{tabList}</TitleBar>
      )}
      <div className={styles.edge} data-tab={active} data-compact={compact || undefined}>
        {compact ? tabList : null}
        <div className={styles.toolbar}>
          <button
            type="button"
            className={styles.tool}
            aria-label="Back"
            aria-disabled={!canBack || undefined}
            onClick={() => canBack && dispatchSoon({ type: 'APP_BACK', id: win.id })}
          >
            <Fl icon={flArrowLeft} size={16} />
          </button>
          <button
            type="button"
            className={`${styles.tool} ${styles.wide}`}
            aria-label="Forward"
            aria-disabled={!canForward || undefined}
            onClick={() => canForward && dispatchSoon({ type: 'APP_FORWARD', id: win.id })}
          >
            <Fl icon={flArrowRight} size={16} />
          </button>
          <button
            type="button"
            className={styles.tool}
            aria-label="Refresh"
            onClick={() => setReloads((value) => value + 1)}
          >
            <Fl icon={flRefresh} size={16} />
          </button>
          <div className={styles.address} data-address="">
            <span className={styles.siteInfo} aria-hidden="true">
              <Fl icon={active === 'resume' ? flInfo : flLock} size={16} />
            </span>
            <input
              readOnly
              aria-label="Address"
              className={styles.addressField}
              value={ADDRESS[active]}
              spellCheck={false}
              onFocus={(event) => {
                event.currentTarget.select();
                setOffer(true);
              }}
              onBlur={leaveAddress}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setOffer(false);
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setOffer(true);
                  event.currentTarget.parentElement?.querySelector<HTMLElement>('[data-offer]')?.focus();
                }
              }}
            />
            <span className={styles.star} aria-hidden="true">
              <Fl icon={flStarAdd} size={16} />
            </span>
            {offer ? (
              <div className={styles.suggest}>
                <button
                  type="button"
                  data-offer=""
                  onBlur={leaveAddress}
                  onClick={() => {
                    setOffer(false);
                    copy();
                  }}
                >
                  <Fl icon={flLink} size={16} />
                  <span>Copy link</span>
                  <span className={styles.suggestUrl}>{ADDRESS[active]}</span>
                </button>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className={styles.tool}
            aria-label="Settings and more"
            aria-haspopup="menu"
            onClick={(event) => moreMenu(event.currentTarget)}
          >
            <Fl icon={flMore} size={16} />
          </button>
          <span className={styles.progress} aria-hidden="true">
            <span ref={progress} />
          </span>
        </div>
        <div className={styles.frame}>
          <div
            ref={panel}
            id="edge-panel"
            role="tabpanel"
            aria-labelledby={`edge-tab-${active}`}
            className={styles.panel}
          >
            {active === 'resume' ? (
              <PdfViewer key={reloads} compact={compact} print={print} />
            ) : (
              <div
                ref={scroller}
                className={styles.page}
                // The page scrolls; keyboard users scroll it with the arrow keys once it has focus.
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                tabIndex={0}
              >
                <div key={`${active}-${reloads}`} className={styles.content}>
                  {active === 'about' ? <Overview /> : <PlainVersion />}
                </div>
              </div>
            )}
          </div>
          {medium || compact ? null : (
            <RovingGroup
              as="div"
              orientation="vertical"
              role="toolbar"
              aria-label="Sidebar"
              aria-orientation="vertical"
              className={styles.sidebar}
            >
              <button
                type="button"
                id="edge-side-github"
                data-roving-item=""
                className={styles.sideButton}
                aria-label="GitHub"
                onClick={() => openApp('github', 'edge-side-github')}
              >
                <AssetIcon id={winBinding('github').icon} size={20} />
              </button>
              <button
                type="button"
                id="edge-side-outlook"
                data-roving-item=""
                className={styles.sideButton}
                aria-label="Outlook"
                onClick={() => openApp('mail', 'edge-side-outlook')}
              >
                <AssetIcon id={winBinding('mail').icon} size={20} />
              </button>
              <span className={styles.sideRule} aria-hidden="true" />
              <button
                type="button"
                data-roving-item=""
                className={styles.sideButton}
                aria-label="Search"
                onClick={(event) => shell.openSearch({ invoker: event.currentTarget })}
              >
                <Fl icon={flSearch} size={20} />
              </button>
            </RovingGroup>
          )}
        </div>
      </div>
    </>
  );
}

/** "About {givenName}" — the portfolio overview (the same page as macOS Safari's, from the selectors). */
function Overview() {
  const person = getPerson();
  const projects = getProjects().length;
  const skills = getSkills().reduce((sum, group) => sum + group.items.length, 0);
  return (
    <article className={`${styles.article} ${styles.printSheet}`}>
      <AboutOverview data={{ person, featured: [], current: getCurrentRole() }} headingLevel={3} slots={WIN_SLOTS} />
      <section className={styles.section} aria-labelledby="edge-work">
        <h3 id="edge-work" data-reveal="">
          Selected work
        </h3>
        <div className={styles.strip} data-strip="">
          <ul className={styles.track} data-track="" role="list">
            {getFeaturedProjects().map((project) => (
              <li key={project.slug}>
                <KernelLink
                  to={{ os: 'windows', ref: { section: 'projects', slug: project.slug } }}
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
            <span className={styles.statValue} aria-hidden="true" data-count={projects}>
              {projects}
            </span>
            <span className="sr-only">{projects}</span> projects
          </span>
          <span>
            <span className={styles.statValue} aria-hidden="true" data-count={skills}>
              {skills}
            </span>
            <span className="sr-only">{skills}</span> tools and skills
          </span>
        </p>
        <p>
          <KernelLink to={{ os: 'windows', ref: { section: 'projects' } }}>See every project in GitHub</KernelLink>
        </p>
      </section>
      <section className={styles.section} aria-labelledby="edge-skills">
        <h3 id="edge-skills" data-reveal="">
          Skills snapshot
        </h3>
        <SkillsMatrix data={getSkills().slice(0, 3)} density="compact" headingLevel={4} />
        <p>
          <KernelLink to={{ os: 'windows', ref: { section: 'skills' } }}>The full list, in VS Code</KernelLink>
        </p>
      </section>
      <section className={`${styles.section} ${styles.cta}`} aria-labelledby="edge-contact">
        <h3 id="edge-contact" data-reveal="">
          Get in touch
        </h3>
        <p>{person.openTo}</p>
        <p className={styles.ctaActions}>
          <KernelLink to={{ os: 'windows', ref: { section: 'contact' } }} className={styles.ctaPrimary}>
            Write in Outlook
          </KernelLink>
          <KernelLink to={{ os: 'windows', ref: { section: 'resume' } }} className={styles.ctaSecondary}>
            Read the résumé
          </KernelLink>
        </p>
      </section>
    </article>
  );
}

/** The third preset tab: the whole portfolio as one plain page (the `/plain` content views, inline). */
function PlainVersion() {
  return (
    <article className={`${styles.article} ${styles.printSheet}`}>
      <p className={styles.plainNote}>
        The whole portfolio on one page. <a href="/plain">Open it outside the desktop</a>
      </p>
      {PLAIN_SECTIONS.map((section) => (
        <section key={section} className={styles.section} aria-labelledby={`edge-plain-${section}`}>
          <h3 id={`edge-plain-${section}`}>{SECTION_TITLES[section]}</h3>
          <ContentFor target={{ section }} headingLevel={4} slots={WIN_SLOTS} />
        </section>
      ))}
    </article>
  );
}

/** Edge's built-in PDF viewer for Résumé.pdf: the text version first in DOM, then the PDF's pages. */
function PdfViewer({ compact, print }: { readonly compact: boolean; readonly print: () => void }) {
  const shell = useWinShell();
  const resume = getResume();
  const file = getResumeFileMeta();
  const pages = file?.pages ?? 1;
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [width, setWidth] = useState(PAGE_W + 48);
  const [page, setPage] = useState(1);
  const canvas = useRef<HTMLDivElement>(null);
  const sizer = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  const fit = Math.max(0.25, Math.min(900, width - 48) / PAGE_W);
  const scale = zoom === 'fit' ? fit : zoom;
  const percent = Math.round(scale * 100);

  // Fit width follows the canvas (a window resize re-measures it).
  useEffect(() => {
    const node = canvas.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Zoom is a transform on the sheet; the sizer reserves the scaled box so scrolling reaches every edge.
  useLayoutEffect(() => {
    const box = sizer.current;
    const el = sheet.current;
    if (!box || !el) return;
    el.style.transform = `scale(${scale})`;
    box.style.width = `${Math.round(PAGE_W * scale)}px`;
    box.style.height = `${Math.round(el.offsetHeight * scale)}px`;
  }, [scale]);

  const step = (direction: 1 | -1) => {
    const next =
      direction > 0
        ? ZOOM_STEPS.find((value) => value > scale + 0.001)
        : [...ZOOM_STEPS].reverse().find((value) => value < scale - 0.001);
    if (next === undefined) return;
    setZoom(next);
    shell.announce(`Zoom ${Math.round(next * 100)}%`);
  };
  const toFit = () => {
    setZoom('fit');
    shell.announce('Fit to width');
  };

  const save = () => {
    analytics.track({ name: 'resume_downloaded', os: 'windows' });
    shell.notify(downloadToast(resume.downloadName));
  };
  const saveLink = file ? (
    <a
      className={`${styles.tool} ${styles.save}`}
      href={resume.file}
      download={resume.downloadName}
      type="application/pdf"
      data-resume-download=""
      data-roving-item=""
      aria-label={`Save (${resumeFileLabel(file)})`}
      onClick={save}
    >
      <Fl icon={flSave} size={16} />
      <span aria-hidden="true">Save</span>
    </a>
  ) : null;

  const compactMenu = (anchor: HTMLElement) => {
    const box = anchor.getBoundingClientRect();
    const items: MenuEntry[] = [
      { kind: 'item', id: 'zoom-in', label: 'Zoom in', icon: <Fl icon={flZoomIn} />, onSelect: () => step(1) },
      { kind: 'item', id: 'zoom-out', label: 'Zoom out', icon: <Fl icon={flZoomOut} />, onSelect: () => step(-1) },
      { kind: 'item', id: 'fit', label: 'Fit to width', icon: <Fl icon={flPageFit} />, onSelect: toFit },
      { kind: 'separator', id: 'sep' },
      { kind: 'item', id: 'print', label: 'Print', icon: <Fl icon={flPrint} />, onSelect: print },
    ];
    shell.openMenu({ label: 'PDF tools', at: { x: box.left, y: box.bottom + 4 }, items, returnFocusTo: anchor });
  };

  const paper = (
    <div className={`cv-paper ${styles.paper}`}>
      <ResumeDocument data={getResumeText()} headingLevel={3} />
    </div>
  );

  return (
    <div className={styles.viewer}>
      <RovingGroup as="div" orientation="horizontal" role="toolbar" aria-label="PDF tools" className={styles.pdfBar}>
        {compact ? (
          <>
            <span className={styles.barSpacer} />
            {saveLink}
            <button
              type="button"
              data-roving-item=""
              className={styles.tool}
              aria-label="More PDF tools"
              aria-haspopup="menu"
              onClick={(event) => compactMenu(event.currentTarget)}
            >
              <Fl icon={flMore} size={16} />
            </button>
          </>
        ) : (
          <>
            {file ? (
              <span className={styles.pageNo}>
                <span aria-hidden="true">
                  <span className={styles.pageBox}>{page}</span> / {pages}
                </span>
                <span className="sr-only">
                  Page {page} of {pages}
                </span>
              </span>
            ) : null}
            <span className={styles.barRule} aria-hidden="true" />
            <button
              type="button"
              data-roving-item=""
              className={styles.tool}
              aria-label="Zoom out"
              aria-disabled={scale <= ZOOM_STEPS[0] || undefined}
              onClick={() => step(-1)}
            >
              <Fl icon={flZoomOut} size={16} />
            </button>
            <span className={styles.percent} aria-hidden="true">
              {percent}%
            </span>
            <button
              type="button"
              data-roving-item=""
              className={styles.tool}
              aria-label="Zoom in"
              aria-disabled={scale >= ZOOM_STEPS[6] || undefined}
              onClick={() => step(1)}
            >
              <Fl icon={flZoomIn} size={16} />
            </button>
            <span className={styles.barRule} aria-hidden="true" />
            <button
              type="button"
              data-roving-item=""
              className={styles.tool}
              aria-label="Fit to width"
              aria-pressed={zoom === 'fit'}
              onClick={toFit}
            >
              <Fl icon={flPageFit} size={16} />
            </button>
            <button type="button" className={styles.tool} aria-label="Rotate" disabled>
              <Fl icon={flRotate} size={16} />
            </button>
            <span className={styles.barSpacer} />
            <button type="button" data-roving-item="" className={styles.tool} aria-label="Print" onClick={print}>
              <Fl icon={flPrint} size={16} />
            </button>
            {saveLink}
          </>
        )}
      </RovingGroup>
      <div
        ref={canvas}
        className={styles.canvas}
        // The pages scroll; keyboard users scroll them with the arrow keys once the canvas has focus.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        onScroll={(event) => {
          if (!file) return;
          const node = event.currentTarget;
          const top = node.scrollTop - (sizer.current?.offsetTop ?? 0) + node.clientHeight / 3;
          setPage(Math.min(pages, Math.max(1, Math.floor(top / ((PAGE_H + PAGE_GAP) * scale)) + 1)));
        }}
      >
        {/* The text version comes first in DOM order: real headings and lists for assistive tech, the PDF after. */}
        <section
          className={`${file ? styles.textHidden : styles.textShown} ${styles.printSheet}`}
          aria-label="Résumé — text version"
        >
          <ResumeView data={{ resume, person: getPerson(), file }} headingLevel={3} slots={WIN_SLOTS} />
          {file ? (
            paper
          ) : (
            <div ref={sizer} className={styles.sizer}>
              <div ref={sheet} className={styles.sheet}>
                {paper}
              </div>
            </div>
          )}
        </section>
        {file ? (
          <div ref={sizer} className={styles.sizer}>
            <div ref={sheet} className={styles.sheet}>
              <ResumePages
                pages={getResumePages()}
                sizes={`${Math.round(PAGE_W * scale)}px`}
                className={styles.pages}
                pageClassName={styles.pdf}
              >
                {/* The pages could not be rendered at build time: the PDF itself, one click away. */}
                <span className={styles.fallback}>
                  <PdfFile size={40} />
                  <a href={resume.file} type="application/pdf">
                    Open Résumé.pdf ({resumeFileLabel(file)})
                  </a>
                </span>
              </ResumePages>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
