'use client';
/**
 * Safari — the portfolio overview in mobile Safari (plans/ios/apps/safari.md, `IOS-SAF-01…06`):
 *   · a full-screen page scrolling natively under the status bar (no Lenis, no ScrollTrigger — `MOTION-SCROLL-01`);
 *     the About tab is the shared `AboutOverview` in a mobile composition (single column, large type), the Plain
 *     version tab the `/plain` content views inline;
 *   · the iOS 15+ **bottom** bar: a floating address capsule (the "AA" page menu left, Reload right, a thin loading
 *     line) above a toolbar — Back · Forward · Share · Bookmarks · Tabs. Scrolling down collapses it to a slim address
 *     line; scrolling up or tapping restores it (12 pt hysteresis, 250 ms `0.32, 0.72, 0, 1`, transform/opacity only,
 *     written imperatively — never React state per scroll frame). Short pages keep it expanded;
 *   · section reveals through an `IntersectionObserver` that adds a state once (fade + 12 pt rise, 300 ms); reduced
 *     motion → none. Reload re-runs them;
 *   · the share sheet (medium detent): Copy Link · Open Plain Version · Download Résumé; the bookmarks sheet: GitHub ·
 *     Résumé · Mail · Messages (open the apps, flying from the pressed row); the tab overview: 2 cards, spring
 *     r 0.42 ζ 0.86; swiping the address capsule switches tabs (the overview is the alternative);
 *   · Back / Forward walk the in-app tab history (session state; anchors never push);
 *   · phone landscape: a compact bar at the **top**; pad and larger: a top toolbar with a centred address field and a
 *     sidebar button (bookmarks + tabs as a sidebar); the content column is 760 px max, centred, filling the page;
 *   · the bar never covers focused content (`scroll-padding` = bar height + safe area); the address is a read-only
 *     field, so no keyboard ever appears.
 * All state is session state (`WindowInstance.ui`): the tab history, open sheet, overview, sidebar, scroll.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { AboutOverview, ContentFor, goHref, type LinkSlotProps, type ViewSlots } from '@/components/content';
import { KernelLink } from '@/components/shell/KernelLink';
import { SECTION_TITLES } from '@/data/content-index';
import type { ContentRef } from '@/data/schema';
import { getCurrentRole, getFeaturedProjects, getPerson, getResumeFileMeta } from '@/data/selectors';
import { publicEnv } from '@/lib/config/environment';
import type { AppRole } from '@/lib/kernel/ids';
import type { AppLocation } from '@/lib/kernel/types';
import { drag } from '@/lib/motion/drag';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { getKernel, dispatchSoon } from '@/stores/kernel-store';
import { iosId } from '../model';
import { IOS_EASE, IOS_SPRINGS, IOS_TIMING, springIn } from '../motion';
import { useAppUi, useAppUiJson, useIos } from '../shell-context';
import { Glyph, type GlyphName } from '../ui/glyphs';
import { appHref, contentHref, Group, Row } from '../ui/kit';
import { ActionSheet, Sheet } from '../ui/Sheet';
import type { IosAppProps } from './registry';
import styles from './safari.module.css';

export type SafariTab = 'about' | 'plain';

export const SAFARI_TABS: readonly { readonly id: SafariTab; readonly title: string }[] = [
  { id: 'about', title: 'About' },
  { id: 'plain', title: 'Plain version' },
];

/** The site's own address (never hard-coded): what the capsule shows and Copy Link copies. */
export const SITE_HOST = new URL(publicEnv.siteUrl).host;
const PAGE_URL: Readonly<Record<SafariTab, string>> = {
  about: new URL(goHref({ section: 'about' }), publicEnv.siteUrl).href,
  plain: new URL('/plain', publicEnv.siteUrl).href,
};

const PLAIN_SECTIONS = ['about', 'projects', 'experience', 'education', 'skills', 'contact'] as const;

/** Scroll hysteresis before the bar changes state (plans/ios/apps/safari.md "Bar collapse"). */
export const BAR_HYSTERESIS = 12;
const HISTORY_MAX = 24;

interface TabHistory {
  readonly e: readonly SafariTab[];
  readonly i: number;
}
const START: TabHistory = { e: ['about'], i: 0 };

const isTab = (value: unknown): value is SafariTab => value === 'about' || value === 'plain';
function parseHistory(value: TabHistory): TabHistory {
  const entries = Array.isArray(value?.e) ? value.e.filter(isTab).slice(-HISTORY_MAX) : [];
  if (entries.length === 0) return START;
  const index = Number.isInteger(value.i) ? Math.min(entries.length - 1, Math.max(0, value.i)) : entries.length - 1;
  return { e: entries, i: index };
}

const isPlainClick = (event: ReactMouseEvent) =>
  !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/** Content links inside the page open content in its iOS app (the shared views' `Link` slot). */
function IosLink({ to, children, ...rest }: LinkSlotProps) {
  return (
    <KernelLink to={{ os: 'ios', ref: to }} {...rest}>
      {children}
    </KernelLink>
  );
}
const SLOTS: Partial<ViewSlots> = { Link: IosLink };

type Bookmark = {
  readonly id: string;
  readonly title: string;
  readonly glyph: GlyphName;
  readonly tint: string;
  readonly href: string;
  readonly open: (el: HTMLElement) => void;
};

export default function Safari({ id, layout, landscape, headingId }: IosAppProps) {
  const ios = useIos();
  const [rawHistory, setHistory] = useAppUiJson<TabHistory>(id, 'hist', START);
  const history = parseHistory(rawHistory);
  const tab = history.e[history.i] ?? 'about';
  const [sheet, setSheet] = useAppUi(id, 'sheet', '');
  const [overview, setOverview] = useAppUi(id, 'overview', '');
  const [sidebar, setSidebar] = useAppUi(id, 'sidebar', '');
  const [menuOpen, setMenuOpen] = useState(false);
  const [manualCopy, setManualCopy] = useState<string | null>(null);
  // Copying was blocked: the link is shown selected in a read-only field, focused, ready for the system copy.
  useEffect(() => {
    if (manualCopy) document.querySelector<HTMLInputElement>('[data-manual-copy]')?.focus();
  }, [manualCopy]);
  const pad = layout === 'pad';
  const barAt: 'bottom' | 'top' | 'pad' = pad ? 'pad' : landscape ? 'top' : 'bottom';

  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const mini = useRef<HTMLButtonElement>(null);
  const capsule = useRef<HTMLDivElement>(null);
  const progress = useRef<HTMLSpanElement>(null);
  const collapsed = useRef(false);

  const person = getPerson();
  const hasPdf = getResumeFileMeta() !== null;

  // --- Navigation: the tab history ---------------------------------------------------------------------------------
  const navigate = useCallback(
    (to: SafariTab) => {
      const current = parseHistory(rawHistory);
      if (current.e[current.i] === to) return;
      const e = [...current.e.slice(0, current.i + 1), to].slice(-HISTORY_MAX);
      setHistory({ e, i: e.length - 1 });
    },
    [rawHistory, setHistory],
  );
  const canBack = history.i > 0;
  const canForward = history.i < history.e.length - 1;
  const go = (delta: -1 | 1) => {
    const i = history.i + delta;
    if (i < 0 || i >= history.e.length) return;
    setHistory({ e: history.e, i });
  };

  // --- Bar collapse (imperative: transforms + opacity, CSS transition 250 ms) ---------------------------------------
  const setCollapsed = useCallback(
    (next: boolean) => {
      if (collapsed.current === next) return;
      collapsed.current = next;
      const barEl = bar.current;
      const miniEl = mini.current;
      root.current?.toggleAttribute('data-collapsed', next);
      if (barEl) barEl.style.transform = next ? (barAt === 'top' ? 'translateY(-100%)' : 'translateY(100%)') : '';
      if (miniEl) {
        miniEl.style.opacity = next ? '1' : '0';
        miniEl.style.transform = next ? '' : `translateY(${barAt === 'top' ? -6 : 6}px) scale(0.9)`;
        miniEl.tabIndex = next ? 0 : -1;
        miniEl.setAttribute('aria-hidden', next ? 'false' : 'true');
      }
    },
    [barAt],
  );
  const expand = useCallback(() => setCollapsed(false), [setCollapsed]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let lastY = el.scrollTop;
    let run = 0;
    let save: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      const y = el.scrollTop;
      const dy = y - lastY;
      lastY = y;
      if (save) clearTimeout(save);
      save = setTimeout(() => {
        dispatchSoon({ type: 'SET_SCROLL', id, top: y });
        dispatchSoon({ type: 'SET_APP_UI', id, key: 'scrollTab', value: tab });
      }, 200);
      if (barAt === 'pad') return;
      // Short content, or back at the top: the bar stays expanded.
      const short = el.scrollHeight - el.clientHeight < 96;
      if (short || y <= 0) {
        run = 0;
        setCollapsed(false);
        return;
      }
      if (dy === 0) return;
      if (Math.sign(dy) !== Math.sign(run)) run = 0;
      run += dy;
      if (run > BAR_HYSTERESIS) setCollapsed(true);
      else if (run < -BAR_HYSTERESIS) setCollapsed(false);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (save) clearTimeout(save);
    };
  }, [barAt, id, tab, setCollapsed]);

  // A layout change (rotation, phone ↔ pad) starts expanded.
  useLayoutEffect(() => {
    collapsed.current = true;
    setCollapsed(false);
  }, [barAt, setCollapsed]);

  // --- Scroll memory per tab (warm apps keep the DOM; evicted ones restore from the kernel) ---------------------------
  const memory = useRef(new Map<SafariTab, number>());
  const shownTab = useRef<SafariTab | null>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const before = shownTab.current;
    if (before) memory.current.set(before, el.scrollTop);
    shownTab.current = tab;
    let top = memory.current.get(tab);
    if (top === undefined && before === null) {
      const win = getKernel().sessions.ios.windows[id];
      top = win?.ui?.scrollTab === tab ? win.scrollTop : 0;
    }
    el.scrollTop = top ?? 0;
  }, [tab, id]);

  // --- Section reveals + the loading line ----------------------------------------------------------------------------
  const observer = useRef<IntersectionObserver | null>(null);
  /** Watch the sections still waiting for their reveal (each is revealed once, then unobserved). */
  const observePending = useCallback(() => {
    const page = scroller.current;
    observer.current?.disconnect();
    observer.current = null;
    if (!page) return;
    const pending = [...page.querySelectorAll<HTMLElement>('[data-reveal="pending"]')];
    if (pending.length === 0) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      for (const target of pending) target.setAttribute('data-reveal', 'shown');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-reveal', 'shown');
          io.unobserve(entry.target);
        }
      },
      { root: page, threshold: 0.01 },
    );
    for (const target of pending) io.observe(target);
    observer.current = io;
  }, []);
  const reveal = useCallback(() => {
    const page = scroller.current;
    if (!page) return;
    const targets = page.querySelectorAll<HTMLElement>(
      '[data-reveal-scope] > :not(.cv), [data-reveal-scope] > .cv > *',
    );
    for (const target of targets) target.setAttribute('data-reveal', 'pending');
    observePending();
  }, [observePending]);
  // Hidden (a warm app in the background) → the observer stops; shown again → it resumes where it was.
  useEffect(() => {
    observePending();
    return () => {
      observer.current?.disconnect();
      observer.current = null;
    };
  }, [observePending]);

  const load = useCallback(() => {
    reveal();
    const line = progress.current;
    if (!line || prefersReducedMotion() || typeof line.animate !== 'function') return;
    line.animate(
      [
        { transform: 'scaleX(0)', opacity: 1 },
        { transform: 'scaleX(0.7)', opacity: 1, offset: 0.55 },
        { transform: 'scaleX(1)', opacity: 1, offset: 0.9 },
        { transform: 'scaleX(1)', opacity: 0 },
      ],
      { duration: 720, easing: 'ease-out' },
    );
  }, [reveal]);

  // Every page load (first show, a tab switch) runs the reveals and the loading line — not a warm app shown again.
  const loaded = useRef<SafariTab | null>(null);
  useLayoutEffect(() => {
    if (loaded.current === tab) return;
    loaded.current = tab;
    load();
  }, [tab, load]);

  const refresh = () => {
    expand();
    load();
    ios.announce(`Reloaded ${SAFARI_TABS.find((spec) => spec.id === tab)?.title ?? ''}`.trim());
  };

  // The status-bar time tap scrolls the page to the top.
  useEffect(() => {
    ios.onScrollToTop(id, () => {
      scroller.current?.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      expand();
    });
    return () => ios.onScrollToTop(id, null);
  }, [ios, id, expand]);

  // --- Swipe on the address capsule switches tabs (the tab overview is the alternative) ------------------------------
  const onCapsuleDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = capsule.current;
    if (!el || event.button > 0 || (event.target as Element).closest('button')) return;
    let startedAt = performance.now();
    drag(el, event.nativeEvent, {
      threshold: 8,
      onStart: () => {
        startedAt = performance.now();
      },
      onMove: (dx) => {
        el.style.transform = `translateX(${dx * 0.85}px)`;
      },
      onEnd: ({ dx, moved }) => {
        const from = el.style.transform || 'translateX(0)';
        el.style.transform = '';
        if (!moved) return;
        const velocity = dx / Math.max(1, performance.now() - startedAt);
        const index = SAFARI_TABS.findIndex((spec) => spec.id === tab);
        const commit = Math.abs(dx) > 64 || Math.abs(velocity) > 0.5;
        const next = SAFARI_TABS[index + (dx < 0 ? 1 : -1)];
        if (commit && next) navigate(next.id);
        if (typeof el.animate === 'function' && !prefersReducedMotion())
          el.animate([{ transform: from }, { transform: 'translateX(0)' }], {
            duration: IOS_TIMING.safariBarMs,
            easing: IOS_EASE.nav,
          });
      },
    });
  };

  // --- Copying the page's link -------------------------------------------------------------------------------------
  const copyLink = async () => {
    const ok =
      tab === 'about' ? await ios.copyLink({ section: 'about' }, 'Link') : await ios.copy(PAGE_URL.plain, 'Link');
    setManualCopy(ok ? null : PAGE_URL[tab]);
    return ok;
  };

  // --- Bookmarks (open apps, flying from the pressed row) ------------------------------------------------------------
  const openRole = (role: AppRole, el: HTMLElement, location?: AppLocation) => ios.openApp(role, location, el);
  const openRef = (ref: ContentRef, el: HTMLElement) => ios.openContent(ref, el);
  const bookmarks: readonly Bookmark[] = [
    {
      id: 'github',
      title: 'GitHub',
      glyph: 'repo',
      tint: '#24292f',
      href: appHref(iosId('github'), { kind: 'root' }),
      open: (el) => openRole('github', el),
    },
    {
      id: 'resume',
      title: 'Résumé',
      glyph: 'doc',
      tint: '#ff9500',
      href: contentHref({ section: 'resume' }),
      open: (el) => openRef({ section: 'resume' }, el),
    },
    {
      id: 'mail',
      title: 'Mail',
      glyph: 'envelope',
      tint: '#0a84ff',
      href: contentHref({ section: 'contact' }),
      open: (el) => openRef({ section: 'contact' }, el),
    },
    {
      id: 'messages',
      title: 'Messages',
      glyph: 'bubble',
      tint: '#34c759',
      href: appHref(iosId('messages'), { kind: 'root' }),
      open: (el) => openRole('messages', el),
    },
  ];
  const bookmarkRows = (after?: () => void) =>
    bookmarks.map((bookmark) => (
      <Row
        key={bookmark.id}
        kind="href"
        href={bookmark.href}
        title={bookmark.title}
        icon={{ glyph: bookmark.glyph, tint: bookmark.tint }}
        dataAttrs={{ 'data-bookmark': bookmark.id }}
        onClick={(event) => {
          if (!isPlainClick(event)) return;
          event.preventDefault();
          bookmark.open(event.currentTarget);
          after?.();
        }}
      />
    ));

  const closeSheet = () => {
    setSheet(null);
    setManualCopy(null);
  };
  const openOverview = () => {
    setSheet(null);
    setOverview('1');
  };
  const closeOverview = (to?: SafariTab) => {
    if (to) navigate(to);
    setOverview(null);
    root.current?.querySelector<HTMLElement>('[data-tabs-button]')?.focus({ preventScroll: true });
  };

  // --- Page ----------------------------------------------------------------------------------------------------------
  const page: ReactNode =
    tab === 'about' ? (
      <div className={styles.site} data-reveal-scope="">
        <AboutOverview
          data={{ person, featured: getFeaturedProjects(), current: getCurrentRole() }}
          headingLevel={3}
          slots={SLOTS}
        />
        <section className={styles.cta} aria-labelledby="saf-contact">
          <h4 id="saf-contact">Get in touch</h4>
          <p className={styles.ctaActions}>
            <KernelLink to={{ os: 'ios', role: 'messages' }} className={styles.ctaPrimary}>
              Message {person.givenName}
            </KernelLink>
            <KernelLink to={{ os: 'ios', ref: { section: 'contact' } }} className={styles.ctaSecondary}>
              Email
            </KernelLink>
            <KernelLink to={{ os: 'ios', ref: { section: 'resume' } }} className={styles.ctaSecondary}>
              Résumé
            </KernelLink>
          </p>
        </section>
      </div>
    ) : (
      <article className={styles.site} data-reveal-scope="" aria-labelledby="saf-plain">
        <header>
          <h3 id="saf-plain" className={styles.plainTitle}>
            {person.name}
          </h3>
          <p className={styles.plainNote}>
            The whole portfolio on one page. <a href="/plain">Open it outside iOS</a>
          </p>
        </header>
        {PLAIN_SECTIONS.map((section) => (
          <div key={section} className={styles.plainSection}>
            <h4 id={`saf-plain-${section}`}>{SECTION_TITLES[section]}</h4>
            <ContentFor target={{ section }} headingLevel={4} slots={SLOTS} resumePages={false} />
          </div>
        ))}
      </article>
    );

  // --- Chrome ------------------------------------------------------------------------------------------------------
  const iconButton = (
    label: string,
    glyph: GlyphName,
    onPress: (el: HTMLButtonElement) => void,
    extra: { disabled?: boolean; haspopup?: boolean; pressed?: boolean; tabs?: boolean } = {},
  ) => (
    <button
      key={label}
      type="button"
      data-tabs-button={extra.tabs ? '' : undefined}
      className={styles.barButton}
      aria-label={label}
      aria-haspopup={extra.haspopup ? 'dialog' : undefined}
      aria-pressed={extra.pressed}
      disabled={extra.disabled}
      onClick={(event) => onPress(event.currentTarget)}
    >
      <Glyph name={glyph} size={barAt === 'bottom' ? 24 : 22} strokeWidth={2} />
    </button>
  );
  const onToolbarKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return;
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0 || buttons.length === 0) return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  const backButton = iconButton('Back', 'chevron-left', () => go(-1), { disabled: !canBack });
  const forwardButton = iconButton('Forward', 'chevron-right', () => go(1), { disabled: !canForward });
  const shareButton = iconButton('Share', 'share', () => setSheet('share'), { haspopup: true });
  const bookmarksButton = iconButton('Bookmarks', 'book', () => setSheet('bookmarks'), { haspopup: true });
  const tabsButtonEl = iconButton('Tabs', 'tabs', openOverview, { haspopup: true, tabs: true });
  const sidebarButton = iconButton('Sidebar', 'sidebar', () => setSidebar(sidebar ? null : '1'), {
    pressed: !!sidebar,
  });

  const addressCapsule = (
    <div ref={capsule} className={styles.capsule} onPointerDown={onCapsuleDown} data-capsule="">
      <span ref={progress} className={styles.progress} aria-hidden="true" />
      <button
        type="button"
        className={styles.capsuleButton}
        aria-label="Page menu"
        aria-haspopup="dialog"
        onClick={() => setMenuOpen(true)}
      >
        <Glyph name="text-size" size={20} strokeWidth={2} />
      </button>
      <label className={styles.address}>
        <span className="sr-only">Address</span>
        <input
          type="text"
          readOnly
          inputMode="none"
          value={SITE_HOST}
          title={PAGE_URL[tab]}
          onFocus={(event) => event.currentTarget.select()}
          onContextMenu={(event) => {
            event.preventDefault();
            void copyLink();
          }}
        />
      </label>
      <button type="button" className={styles.capsuleButton} aria-label="Reload page" onClick={refresh}>
        <Glyph name="refresh" size={19} strokeWidth={2.2} />
      </button>
    </div>
  );

  const chrome =
    barAt === 'bottom' ? (
      <div ref={bar} className={styles.bottomBar} data-bar="" onFocusCapture={expand}>
        <div className={styles.capsuleRow}>{addressCapsule}</div>
        <div role="toolbar" aria-label="Safari" className={styles.toolbar} onKeyDown={onToolbarKey}>
          {backButton}
          {forwardButton}
          {shareButton}
          {bookmarksButton}
          {tabsButtonEl}
        </div>
      </div>
    ) : (
      <div ref={bar} className={styles.topBar} data-bar="" data-at={barAt} onFocusCapture={expand}>
        <div role="toolbar" aria-label="Navigation" className={styles.toolGroup} onKeyDown={onToolbarKey}>
          {pad ? sidebarButton : null}
          {backButton}
          {forwardButton}
        </div>
        <div className={styles.topCapsule}>{addressCapsule}</div>
        <div role="toolbar" aria-label="Page" className={styles.toolGroup} onKeyDown={onToolbarKey}>
          {shareButton}
          {pad ? null : bookmarksButton}
          {tabsButtonEl}
        </div>
      </div>
    );

  const overviewOpen = overview === '1';
  const blocked = overviewOpen;

  return (
    <div
      ref={root}
      className={styles.safari}
      data-bar-at={barAt}
      data-sidebar={(pad && !!sidebar) || undefined}
      aria-labelledby={headingId}
    >
      {pad && sidebar ? (
        <nav className={styles.sidebar} aria-label="Sidebar" inert={blocked || undefined}>
          <h3 className={styles.sidebarTitle}>Safari</h3>
          <Group header="Tabs">
            {SAFARI_TABS.map((spec) => (
              <Row
                key={spec.id}
                kind="button"
                title={spec.title}
                icon={{ glyph: spec.id === 'about' ? 'globe' : 'plain' }}
                aria-current={spec.id === tab ? 'page' : undefined}
                selected={spec.id === tab}
                onPress={() => navigate(spec.id)}
              />
            ))}
          </Group>
          <Group header="Bookmarks">{bookmarkRows()}</Group>
        </nav>
      ) : null}
      <div className={styles.main} inert={blocked || undefined}>
        <div className={styles.statusScrim} aria-hidden="true" />
        <div ref={scroller} className={styles.page} data-page="" data-scroller="">
          <div className={styles.column}>{page}</div>
        </div>
        {chrome}
        <button
          ref={mini}
          type="button"
          className={styles.mini}
          data-at={barAt}
          aria-label={`Show toolbar, ${SITE_HOST}`}
          aria-hidden="true"
          tabIndex={-1}
          onClick={expand}
          hidden={barAt === 'pad'}
        >
          {SITE_HOST}
        </button>
      </div>
      {overviewOpen ? (
        <TabOverview
          current={tab}
          onPick={(to) => closeOverview(to)}
          onDone={() => closeOverview()}
          page={root}
          givenName={person.name}
          headline={person.headline}
        />
      ) : null}

      <Sheet
        open={sheet === 'share'}
        title="Share"
        cancelLabel="Done"
        onCancel={closeSheet}
        detent="medium"
        expandable={false}
      >
        <div className={styles.shareHead}>
          <span className={styles.shareIcon} aria-hidden="true">
            <Glyph name="globe" size={26} strokeWidth={1.7} />
          </span>
          <span className={styles.shareText}>
            <span className={styles.shareTitle}>
              {tab === 'about' ? person.name : `${person.name} — Plain version`}
            </span>
            <span className={styles.shareHost}>{SITE_HOST}</span>
          </span>
        </div>
        <Group>
          <Row
            kind="button"
            title="Copy Link"
            icon={{ glyph: 'link' }}
            onPress={() => {
              void copyLink().then((ok) => ok && closeSheet());
            }}
          />
          <Row
            kind="button"
            title={tab === 'plain' ? 'Open About' : 'Open Plain Version'}
            icon={{ glyph: 'plain' }}
            onPress={() => {
              navigate(tab === 'plain' ? 'about' : 'plain');
              closeSheet();
            }}
          />
          {hasPdf ? (
            <Row
              kind="button"
              title="Download Résumé"
              icon={{ glyph: 'download' }}
              onPress={() => {
                ios.downloadResume();
                closeSheet();
              }}
            />
          ) : null}
        </Group>
        {manualCopy ? (
          <div className={styles.manual} role="status">
            <label>
              <span>Copying is blocked here — select the link and copy it:</span>
              <input
                type="text"
                readOnly
                value={manualCopy}
                onFocus={(event) => event.currentTarget.select()}
                data-manual-copy=""
              />
            </label>
          </div>
        ) : null}
      </Sheet>

      <Sheet open={sheet === 'bookmarks'} title="Bookmarks" cancelLabel="Done" onCancel={closeSheet} detent="medium">
        <Group header="Favorites">{bookmarkRows(closeSheet)}</Group>
      </Sheet>

      <ActionSheet
        open={menuOpen}
        title={SITE_HOST}
        actions={[
          {
            id: 'copy',
            label: 'Copy Link',
            run: () => {
              setMenuOpen(false);
              void copyLink().then((ok) => {
                if (!ok) setSheet('share');
              });
            },
          },
          {
            id: 'plain',
            label: tab === 'plain' ? 'Show About' : 'Show Plain Version',
            run: () => {
              setMenuOpen(false);
              navigate(tab === 'plain' ? 'about' : 'plain');
            },
          },
          ...(barAt === 'pad'
            ? []
            : [
                {
                  id: 'hide',
                  label: 'Hide Toolbar',
                  run: () => {
                    setMenuOpen(false);
                    setCollapsed(true);
                    mini.current?.focus({ preventScroll: true });
                  },
                },
              ]),
        ]}
        onCancel={() => setMenuOpen(false)}
      />
    </div>
  );
}

// --- Tab overview -------------------------------------------------------------------------------------------------

function TabOverview({
  current,
  onPick,
  onDone,
  page,
  givenName,
  headline,
}: {
  readonly current: SafariTab;
  readonly onPick: (tab: SafariTab) => void;
  readonly onDone: () => void;
  readonly page: React.RefObject<HTMLElement | null>;
  readonly givenName: string;
  readonly headline: string;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  // Esc = Done (a keyboard listener on the dialog itself).
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onDone();
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [onDone]);

  // The page scales down into its card (spring r 0.42 ζ 0.86); focus lands on the current tab's card.
  useLayoutEffect(() => {
    const card = grid.current?.querySelector<HTMLElement>('[aria-current="page"]');
    card?.focus({ preventScroll: true });
    if (!card || !page.current) return;
    const from = page.current.getBoundingClientRect();
    const to = card.getBoundingClientRect();
    if (to.width < 1 || from.width < 1) return;
    const scale = from.width / to.width;
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    springIn(card, IOS_SPRINGS.open, { transform: `translate(${dx}px, ${dy}px) scale(${scale})` });
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.overview} role="dialog" aria-modal="true" aria-labelledby="saf-tabs-title" ref={dialog}>
      <h3 id="saf-tabs-title" className="sr-only">
        Tabs
      </h3>
      <div ref={grid} className={styles.cards}>
        <ul role="list">
          {SAFARI_TABS.map((spec) => (
            <li key={spec.id}>
              <button
                type="button"
                className={styles.card}
                aria-current={spec.id === current ? 'page' : undefined}
                data-tab-card={spec.id}
                onClick={() => onPick(spec.id)}
              >
                <span className={styles.cardThumb} aria-hidden="true">
                  <span className={styles.thumbTitle}>{spec.id === 'about' ? givenName : 'Plain version'}</span>
                  <span className={styles.thumbText}>{spec.id === 'about' ? headline : SITE_HOST}</span>
                  <span className={styles.thumbLines} />
                </span>
                <span className={styles.cardLabel}>
                  <Glyph name={spec.id === 'about' ? 'globe' : 'plain'} size={14} strokeWidth={2} />
                  {spec.title}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.overviewBar}>
        <span className={styles.overviewCount}>{SAFARI_TABS.length} Tabs</span>
        <button type="button" className={styles.done} onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
