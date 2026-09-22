'use client';
/**
 * Settings — plans/windows/apps/settings.md (`WIN-SET-01…05`, `WIN-SET-07`; shared/09 `A11Y-PREF-01`, shared/11
 * `ASSET-LEGAL-01`, shared/18 `ANL-NOTICE-01`, shared/21 found counter, shared/20 restart point). The real Windows 11
 * Settings app, not a preferences form:
 *   · NavigationView (280 px): user tile, "Find a setting" (suggestions; choosing one opens its page, scrolls to the card
 *     and flashes it; the page list narrows to the pages that match), the page list — a `nav` list with the 3 px accent
 *     bar and `aria-current="page"`, one tab stop, arrow keys.
 *   · a breadcrumb page header (Title 28 px): `System › About` on the About sub-page; pages drill in (250 ms rise + fade),
 *     going back drills out (167 ms fade).
 *   · stroked cards (68 px rows: glyph · title + description · control), expander cards (clip-path reveal, 167 ms — no
 *     height animation), real controls: `role="switch"` buttons, native ranges with labels, native radio groups.
 *   · every change is one `SET_PREF`: applied at once (the shell writes `<html>`), persisted by the prefs store.
 *   · the page is session state (`/windows/settings` only); other surfaces open a page through a `settings` intent.
 *   · `medium` (or a window narrower than 760 px): the pane collapses behind a hamburger; compact: the page list is the
 *     first screen and a page is pushed with a back arrow; cards full width, rows ≥ 48 px.
 * Portfolio facts come only from `data/selectors`; the legal and privacy statements are the shared content views.
 */
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { formatUpdated, LegalNotice, PrivacyNotice } from '@/components/content';
import { Combobox, type ComboboxGroup } from '@/components/primitives/Combobox';
import { RovingGroup } from '@/components/primitives/RovingGroup';
import { KernelLink } from '@/components/shell/KernelLink';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { contentRev, SECTION_TITLES } from '@/data/content-index';
import { getContact, getPerson, getResume } from '@/data/selectors';
import { readPrivacySignals } from '@/lib/analytics';
import { COUNTED } from '@/lib/analytics/notice';
import { GLYPH_CREDIT } from '@/lib/assets/glyphs';
import { assetCredits, ASSET_MODE } from '@/lib/assets/manifest';
import { eggProgress } from '@/lib/eggs';
import { OS_NAMES, type OsId } from '@/lib/kernel/ids';
import { TEXT_SCALE_RANGE } from '@/lib/kernel/persist/prefs';
import { getSafeStorage } from '@/lib/kernel/persist/storage';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import { routeCodec, VISIBLE_OSES } from '@/lib/kernel/route';
import { ACCENT_IDS, type AccentId, type OsAppBinding, type UserPreferences } from '@/lib/kernel/types';
import { useKernel, usePrefs } from '@/stores/kernel-context';
import { dispatch, dispatchSoon } from '@/stores/kernel-store';
import {
  flAccessibility,
  flAlert,
  flApps,
  flAppsList,
  flArrowLeft,
  flCheckmark,
  flChevronDown,
  flChevronRight,
  flConsole,
  flContrast,
  flCopy,
  flDarkTheme,
  flDesktop,
  flDocument,
  flDocumentText,
  flDrop,
  flEye,
  flFlash,
  flHome,
  flInfo,
  flKeyboard,
  flLaptop,
  flLock,
  flNavigation,
  flOpen,
  flPaint,
  flPanelBottom,
  flSearch,
  flShield,
  flSparkle,
  flSpeaker,
  flSpeakerMute,
  flSwap,
  flTextSize,
  flTour,
  flWindow,
  type Glyph,
} from '../fluent.generated';
import { Fl } from '../icons';
import { subscribeIntents, takeIntent, type SettingsPage, type WinIntent } from '../intents';
import { initialsOf } from '../model';
import { drillIn, drillOut } from '../motion';
import { useWinShell } from '../shell-context';
import { TitleBar, type WindowBodyProps } from '../window/Window';
import styles from './settings.module.css';

// --- Pages and cards (one source for the pages, the search index and the intents) ---------------------------------

type Page = SettingsPage;
type Sub = 'about';

interface View {
  readonly page: Page;
  readonly sub: Sub | null;
}

const PAGES: readonly { readonly id: Page; readonly title: string; readonly glyph: Glyph }[] = [
  { id: 'system', title: 'System', glyph: flDesktop },
  { id: 'personalization', title: 'Personalization', glyph: flPaint },
  { id: 'accessibility', title: 'Accessibility', glyph: flAccessibility },
  { id: 'privacy', title: 'Privacy & security', glyph: flShield },
  { id: 'apps', title: 'Apps', glyph: flAppsList },
  { id: 'switch', title: 'Switch operating system', glyph: flSwap },
  { id: 'tour', title: 'Tour', glyph: flTour },
];
const PAGE_TITLES = Object.fromEntries(PAGES.map((page) => [page.id, page.title])) as Readonly<Record<Page, string>>;
const SUB_TITLES: Readonly<Record<Sub, string>> = { about: 'About' };

interface CardInfo {
  readonly page: Page;
  readonly sub?: Sub;
  readonly title: string;
  readonly description: string;
  readonly glyph: Glyph;
  readonly keywords?: string;
  /** An expander card: choosing it from search (or an intent) opens it. */
  readonly expander?: boolean;
}

/** Card ids are stable: search results and other surfaces' intents (`{ page, card }`) name them. */
const CARDS = {
  sound: {
    page: 'system',
    title: 'Sound',
    description: 'Volume, UI sounds, intro sound',
    glyph: flSpeaker,
    keywords: 'audio mute chime volume',
    expander: true,
  },
  notifications: {
    page: 'system',
    title: 'Notifications',
    description: 'Toasts from apps and the system — the notification center keeps them either way',
    glyph: flAlert,
    keywords: 'toast banner alerts',
  },
  about: {
    page: 'system',
    title: 'About',
    description: 'Device specifications, easter eggs, legal notices',
    glyph: flInfo,
    keywords: 'winver version build',
  },
  'device-specs': {
    page: 'system',
    sub: 'about',
    title: 'Device specifications',
    description: 'Who this device belongs to',
    glyph: flLaptop,
    keywords: 'name role headline location resume résumé updated build',
  },
  eggs: {
    page: 'system',
    sub: 'about',
    title: 'Easter eggs found',
    description: 'Some commands aren’t listed.',
    glyph: flSparkle,
    keywords: 'secrets easter eggs',
  },
  legal: {
    page: 'system',
    sub: 'about',
    title: 'Legal notices',
    description: 'Credits, trademarks and rights requests',
    glyph: flDocumentText,
    keywords: 'license licence copyright trademark credits',
    expander: true,
  },
  theme: {
    page: 'personalization',
    title: 'Choose your mode',
    description: 'Light, dark, or follow your device',
    glyph: flDarkTheme,
    keywords: 'theme dark light mode',
  },
  accent: {
    page: 'personalization',
    title: 'Accent color',
    description: 'Toggles, selection bars and highlights',
    glyph: flDrop,
    keywords: 'accent colour color palette',
    expander: true,
  },
  transparency: {
    page: 'personalization',
    title: 'Transparency effects',
    description: 'Windows and surfaces appear somewhat translucent',
    glyph: flWindow,
    keywords: 'glass acrylic mica blur translucent',
  },
  'taskbar-alignment': {
    page: 'personalization',
    title: 'Taskbar alignment',
    description: 'Where Start and your apps sit',
    glyph: flPanelBottom,
    keywords: 'taskbar center centre left start',
  },
  'text-size': {
    page: 'accessibility',
    title: 'Text size',
    description: 'Makes text bigger across this desktop',
    glyph: flTextSize,
    keywords: 'font larger bigger zoom',
  },
  contrast: {
    page: 'accessibility',
    title: 'Contrast themes',
    description: 'Solid surfaces and stronger outlines',
    glyph: flContrast,
    keywords: 'high contrast increase',
  },
  animation: {
    page: 'accessibility',
    title: 'Animation effects',
    description: 'Windows, pages and menus move as they open and close',
    glyph: flFlash,
    keywords: 'motion reduce animations',
  },
  'a11y-transparency': {
    page: 'accessibility',
    title: 'Transparency effects',
    description: 'Windows and surfaces appear somewhat translucent',
    glyph: flWindow,
    keywords: 'glass acrylic mica blur translucent',
  },
  'single-key': {
    page: 'accessibility',
    title: 'Single-key shortcuts',
    description: 'Keys like ? work on their own. Turn this off if they get in the way of speech input.',
    glyph: flKeyboard,
    keywords: 'keyboard shortcuts hotkeys speech',
  },
  plain: {
    page: 'accessibility',
    title: 'Plain portfolio',
    description: 'Everything on one simple page, without an operating system',
    glyph: flDocument,
    keywords: 'reader text simple skip',
  },
  diagnostics: {
    page: 'privacy',
    title: 'Diagnostics & feedback',
    description: 'What this site counts, and what it never does',
    glyph: flShield,
    keywords: 'analytics tracking privacy data',
    expander: true,
  },
  signals: {
    page: 'privacy',
    title: 'Do Not Track and Global Privacy Control',
    description: 'When your browser sends either, nothing is counted',
    glyph: flEye,
    keywords: 'dnt gpc tracking',
  },
  cookies: {
    page: 'privacy',
    title: 'Cookies',
    description: 'This site sets none. Your settings stay in this browser.',
    glyph: flLock,
    keywords: 'cookies storage identifiers',
  },
  chooser: {
    page: 'switch',
    title: 'Back to chooser',
    description: 'Pick an operating system from the start',
    glyph: flHome,
    keywords: 'chooser shut down exit leave',
  },
  tour: {
    page: 'tour',
    title: 'Guided tour',
    description: 'Start, Snap, the résumé and Search in a few short steps. Leave whenever you like.',
    glyph: flTour,
    keywords: 'help tour tips get started',
  },
} as const satisfies Record<string, CardInfo>;
type CardKey = keyof typeof CARDS;

/**
 * What analytics count (shared/18 "Privacy statement") — the same five lines `/plain` shows. The list lives inline in
 * app/plain/page.tsx and is not exported; kept identical here until it moves to one shared module.
 */
const FLUENT_CREDIT = 'Fluent UI System Icons (© Microsoft Corporation, MIT License)';

const ACCENT_NAMES: Readonly<Record<AccentId, string>> = {
  blue: 'Blue',
  navy: 'Navy',
  teal: 'Teal',
  green: 'Green',
  purple: 'Purple',
  plum: 'Plum',
  red: 'Red',
  orange: 'Orange',
  graphite: 'Graphite',
};

const OS_KIND: Readonly<Record<'desktop' | 'mobile' | 'terminal', { readonly label: string; readonly glyph: Glyph }>> =
  {
    desktop: { label: 'Desktop · overlapping windows and a pointer', glyph: flDesktop },
    mobile: { label: 'Phone · one app at a time', glyph: flApps },
    terminal: { label: 'Terminal · a shell and its commands', glyph: flConsole },
  };

const WIN_APPS = OS_REGISTRY.windows.apps;
const OTHER_OSES: readonly OsId[] = VISIBLE_OSES.filter((os) => os !== 'windows');

const appMeta = (binding: OsAppBinding) =>
  binding.owns.length ? binding.owns.map((section) => SECTION_TITLES[section]).join(' · ') : 'System app';

const where = (page: Page, sub: Sub | null) => (sub ? `${PAGE_TITLES[page]} › ${SUB_TITLES[sub]}` : PAGE_TITLES[page]);

// --- Search ("Find a setting") ----------------------------------------------------------------------------------------

interface Entry {
  readonly id: string;
  readonly page: Page;
  readonly sub: Sub | null;
  readonly title: string;
  readonly where: string;
  readonly glyph: Glyph;
  readonly expander: boolean;
  readonly haystack: string;
}

const entry = (id: string, info: CardInfo): Entry => {
  const sub = info.sub ?? null;
  const place = where(info.page, sub);
  return {
    id,
    page: info.page,
    sub,
    title: info.title,
    where: place,
    glyph: info.glyph,
    expander: info.expander ?? false,
    haystack: `${info.title} ${info.description} ${place} ${info.keywords ?? ''}`.toLowerCase(),
  };
};

const ENTRIES: readonly Entry[] = [
  ...(Object.entries(CARDS) as [CardKey, CardInfo][]).map(([id, info]) => entry(id, info)),
  ...WIN_APPS.map((binding) =>
    entry(`app-${binding.slug}`, {
      page: 'apps',
      title: binding.title,
      description: appMeta(binding),
      glyph: flApps,
      keywords: 'installed app open',
    }),
  ),
  ...OTHER_OSES.map((os) =>
    entry(`os-${os}`, {
      page: 'switch',
      title: OS_NAMES[os],
      description: OS_KIND[OS_REGISTRY[os].chrome].label,
      glyph: OS_KIND[OS_REGISTRY[os].chrome].glyph,
      keywords: 'switch operating system os',
    }),
  ),
];
const BY_ID = new Map(ENTRIES.map((item) => [item.id, item]));

/** Every card whose words contain all the query's words; titles that start with the query first. */
function findSettings(query: string): readonly Entry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const phrase = words.join(' ');
  const rank = (item: Entry) => {
    const title = item.title.toLowerCase();
    return title.startsWith(phrase) ? 0 : title.includes(phrase) ? 1 : 2;
  };
  return ENTRIES.filter((item) => words.every((word) => item.haystack.includes(word))).sort(
    (a, b) => rank(a) - rank(b),
  );
}

const MAX_SUGGESTIONS = 8;
/** The flash on a card chosen from search (or named by an intent) — kept in step with the CSS keyframes. */
const FLASH_MS = 1200;

// --- Session state ---------------------------------------------------------------------------------------------------

interface Ui {
  readonly view: View;
  /** Compact: a page is pushed over the page list. */
  readonly pushed: boolean;
  /** Open expander cards. */
  readonly open: ReadonlySet<string>;
  /** A card to scroll to, focus and flash (`n` makes a repeat request a new one). */
  readonly flash: { readonly card: string; readonly n: number } | null;
}

const HOME: View = { page: 'system', sub: null };

function show(ui: Ui, view: View, card?: string): Ui {
  const target = card ? BY_ID.get(card) : undefined;
  return {
    view,
    pushed: true,
    open: target?.expander ? new Set([...ui.open, target.id]) : ui.open,
    flash: target ? { card: target.id, n: (ui.flash?.n ?? 0) + 1 } : ui.flash,
  };
}

function fromIntent(ui: Ui, intent: Extract<WinIntent, { kind: 'settings' }>): Ui {
  const card = intent.card ? BY_ID.get(intent.card) : undefined;
  return card ? show(ui, { page: card.page, sub: card.sub }, card.id) : show(ui, { page: intent.page, sub: null });
}

function initialUi(intent: Extract<WinIntent, { kind: 'settings' }> | null): Ui {
  // Accent colours and the privacy statement start open, as Windows opens its primary expanders.
  const base: Ui = { view: HOME, pushed: false, open: new Set(['accent', 'diagnostics']), flash: null };
  return intent ? fromIntent(base, intent) : base;
}

type Patch = Partial<Omit<UserPreferences, 'v'>>;
/** A press: the control paints its own feedback first, the preference commits in the next task (shared/10 INP). */
const setPref = (patch: Patch) => dispatchSoon({ type: 'SET_PREF', patch });
/**
 * A dragged slider or a native radio: commit now. A controlled input snaps back to its old value until the preference
 * commits, so a deferred commit would leave the thumb or the radio showing the wrong value for a frame.
 */
const setPrefNow = (patch: Patch) => dispatch({ type: 'SET_PREF', patch });

const neverChanges = () => () => undefined;

// --- The app ---------------------------------------------------------------------------------------------------------

export default function Settings({ compact }: WindowBodyProps) {
  const prefs = usePrefs((value) => value);
  const medium = useKernel((state) => state.viewport.sizeClass === 'medium');
  const [ui, setUi] = useState<Ui>(() => initialUi(takeIntent('settings')));
  const [query, setQuery] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const [memoryOnly] = useState(() => typeof window !== 'undefined' && getSafeStorage().mode === 'memory');
  const person = getPerson();
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const paneId = useId();
  const backward = useRef(false);
  const pendingFocus = useRef<string | null>(null);
  const shownView = useRef(`${ui.view.page}/${ui.view.sub ?? ''}`);

  const layout = compact ? 'compact' : medium ? 'collapsed' : 'full';
  const { view } = ui;

  // Intents from other surfaces (Start, Search, the desktop menu): one waiting at mount was taken above; later ones
  // arrive here — including one that arrived while the window was minimized (hidden: effects paused, state kept).
  useEffect(() => {
    const apply = (intent: WinIntent) => {
      if (intent.kind !== 'settings') return;
      takeIntent('settings');
      backward.current = false;
      setNavOpen(false);
      setUi((current) => fromIntent(current, intent));
    };
    const unsubscribe = subscribeIntents(apply);
    const waiting = takeIntent('settings');
    if (waiting) apply(waiting);
    return unsubscribe;
  }, []);

  // Page changes drill in (250 ms rise + fade); going back drills out (167 ms fade). The page starts at its top.
  const viewKey = `${view.page}/${view.sub ?? ''}`;
  useLayoutEffect(() => {
    if (shownView.current === viewKey) return;
    shownView.current = viewKey;
    if (scroller.current) scroller.current.scrollTop = 0;
    const el = pageRef.current;
    if (!el) return;
    return backward.current ? drillOut(el) : drillIn(el);
  }, [viewKey]);

  // A chosen search result (or an intent's card): scroll to it, focus it and flash it.
  const { flash } = ui;
  useEffect(() => {
    if (!flash) return;
    const card = root.current?.querySelector<HTMLElement>(`[data-card="${flash.card}"]`);
    if (!card) return;
    card.scrollIntoView?.({ block: 'nearest' });
    card.focus({ preventScroll: true });
    card.removeAttribute('data-flash');
    card.getBoundingClientRect(); // a style flush restarts the keyframes when the same card is chosen twice
    card.setAttribute('data-flash', '');
    const timer = setTimeout(() => card.removeAttribute('data-flash'), FLASH_MS);
    return () => {
      clearTimeout(timer);
      card.removeAttribute('data-flash');
    };
  }, [flash]);

  // Focus follows navigation that removes the focused control (a sub-page, a pushed page, the collapsed pane).
  useEffect(() => {
    const selector = pendingFocus.current;
    if (!selector) return;
    pendingFocus.current = null;
    root.current?.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
  });

  // The collapsed pane closes on a press outside it.
  useEffect(() => {
    const el = root.current;
    if (!navOpen || !el) return;
    const onDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (target.closest('[data-settings-pane]') || target.closest('[data-settings-hamburger]')) return;
      setNavOpen(false);
    };
    el.addEventListener('pointerdown', onDown);
    return () => el.removeEventListener('pointerdown', onDown);
  }, [navOpen]);

  const HEADING = '[data-settings-heading]';

  const go = (next: View, options: { card?: string; back?: boolean; focus?: string | null } = {}) => {
    backward.current = options.back ?? false;
    if (options.focus !== undefined) pendingFocus.current = options.focus;
    setUi((current) => show(current, next, options.card));
  };

  const choosePage = (page: Page) => {
    const overlay = navOpen;
    setNavOpen(false);
    setQuery('');
    // Wide layouts keep focus on the page list (as Windows does); a pushed page or a closing pane moves it.
    go({ page, sub: null }, { focus: compact || overlay ? HEADING : null });
  };

  const chooseResult = (id: string) => {
    const target = BY_ID.get(id);
    if (!target) return;
    setNavOpen(false);
    setQuery('');
    go({ page: target.page, sub: target.sub }, { card: target.id });
  };

  const back = () => {
    if (view.sub) {
      go({ page: view.page, sub: null }, { back: true, focus: `[data-card="${view.sub}"] button` });
      return;
    }
    if (compact) {
      pendingFocus.current = `[data-page="${view.page}"]`;
      setUi((current) => ({ ...current, pushed: false }));
    }
  };

  const toggle = (card: string) =>
    setUi((current) => {
      const open = new Set(current.open);
      if (open.has(card)) open.delete(card);
      else open.add(card);
      return { ...current, open };
    });

  const closePane = (focusHamburger: boolean) => {
    if (!navOpen) return;
    setNavOpen(false);
    if (focusHamburger) pendingFocus.current = '[data-settings-hamburger]';
  };

  const matches = findSettings(query);
  const pagesShown = query && matches.length ? PAGES.filter((page) => matches.some((m) => m.page === page.id)) : PAGES;
  const groups: readonly ComboboxGroup[] = matches.length
    ? [
        {
          id: 'suggestions',
          label: 'Suggestions',
          options: matches.slice(0, MAX_SUGGESTIONS).map((item) => ({
            id: item.id,
            label: item.title,
            description: item.where,
            icon: <Fl icon={item.glyph} size={16} />,
          })),
        },
      ]
    : [];

  const showPane = !compact || !ui.pushed;
  const showContent = !compact || ui.pushed;
  const showBack = compact ? ui.pushed : view.sub !== null;

  const pageProps: PageProps = {
    prefs,
    isOpen: (card) => ui.open.has(card),
    toggle,
    go,
  };

  return (
    <>
      <TitleBar title="Settings" />
      <div ref={root} className={styles.root}>
        <div
          className={styles.frame}
          data-layout={layout}
          data-nav-open={navOpen || undefined}
          data-pushed={compact && ui.pushed ? '' : undefined}
        >
          <div id={paneId} className={styles.pane} data-settings-pane="" hidden={!showPane}>
            <div className={styles.user}>
              <span className={styles.avatar} aria-hidden="true">
                {initialsOf(person.name)}
              </span>
              <span className={styles.userText}>
                <span className={styles.userName}>{person.name}</span>
                <span className={styles.userKind}>Local account</span>
              </span>
            </div>
            <div className={styles.search} role="search" aria-label="Find a setting">
              <Combobox
                label="Find a setting"
                placeholder="Find a setting"
                value={query}
                onChange={setQuery}
                groups={groups}
                onSelect={chooseResult}
                onClose={() => closePane(true)}
                renderOption={(option) => (
                  <>
                    <span className={styles.suggestionGlyph}>{option.icon}</span>
                    <span className={styles.suggestionText}>
                      <span>{option.label}</span>
                      <span className={styles.suggestionWhere}>{option.description}</span>
                    </span>
                  </>
                )}
                emptyState={<span className={styles.noResults}>No results found</span>}
                className={styles.combo}
                inputClassName={styles.searchInput}
                listClassName={styles.suggestions}
              />
              <Fl icon={flSearch} size={16} className={styles.searchGlyph} />
            </div>
            <nav aria-label="Settings" className={styles.nav}>
              <RovingGroup
                as="ul"
                role="list"
                orientation="vertical"
                className={styles.navList}
                onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
                  if (event.key !== 'Escape' || !navOpen) return;
                  event.preventDefault();
                  event.stopPropagation();
                  closePane(true);
                }}
              >
                {pagesShown.map((page) => (
                  <li key={page.id}>
                    <button
                      type="button"
                      className={styles.navItem}
                      data-roving-item=""
                      data-page={page.id}
                      aria-current={view.page === page.id ? 'page' : undefined}
                      onClick={() => choosePage(page.id)}
                    >
                      <Fl icon={page.glyph} size={16} />
                      <span className={styles.navLabel}>{page.title}</span>
                      {compact ? <Fl icon={flChevronRight} size={16} className={styles.navChevron} /> : null}
                    </button>
                  </li>
                ))}
              </RovingGroup>
            </nav>
          </div>

          <div className={styles.content} hidden={!showContent}>
            {memoryOnly ? (
              <p className={styles.infobar} role="status">
                <Fl icon={flInfo} size={16} />
                Changes last for this visit only — this browser isn&rsquo;t allowing storage.
              </p>
            ) : null}
            <header className={styles.header}>
              {showBack ? (
                <button type="button" className={styles.iconButton} aria-label="Back" onClick={back}>
                  <Fl icon={flArrowLeft} size={16} />
                </button>
              ) : null}
              {compact ? null : (
                <button
                  type="button"
                  className={`${styles.iconButton} ${styles.hamburger}`}
                  data-settings-hamburger=""
                  aria-label="Open navigation"
                  aria-expanded={navOpen}
                  aria-controls={paneId}
                  onClick={() => {
                    const opening = !navOpen;
                    setNavOpen(opening);
                    if (opening) pendingFocus.current = `[data-page="${view.page}"]`;
                  }}
                >
                  <Fl icon={flNavigation} size={16} />
                </button>
              )}
              <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
                <ol className={styles.crumbs}>
                  {view.sub ? (
                    <li className={styles.crumb}>
                      <button
                        type="button"
                        className={styles.crumbLink}
                        onClick={() =>
                          go({ page: view.page, sub: null }, { back: true, focus: `[data-card="${view.sub}"] button` })
                        }
                      >
                        {PAGE_TITLES[view.page]}
                      </button>
                    </li>
                  ) : null}
                  <li className={styles.crumb}>
                    {view.sub ? <Fl icon={flChevronRight} size={16} className={styles.crumbChevron} /> : null}
                    <h3 className={styles.crumbCurrent} aria-current="page" tabIndex={-1} data-settings-heading="">
                      {view.sub ? SUB_TITLES[view.sub] : PAGE_TITLES[view.page]}
                    </h3>
                  </li>
                </ol>
              </nav>
            </header>
            {/* The header stays put; only the page scrolls (as in Windows). */}
            <div ref={scroller} className={styles.scroll}>
              <div ref={pageRef} className={styles.page} data-page-view={viewKey}>
                <PageBody view={view} {...pageProps} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// --- Pages -------------------------------------------------------------------------------------------------------------

interface PageProps {
  readonly prefs: UserPreferences;
  readonly isOpen: (card: string) => boolean;
  readonly toggle: (card: string) => void;
  readonly go: (view: View, options?: { card?: string; back?: boolean; focus?: string | null }) => void;
}

function PageBody({ view, ...props }: PageProps & { readonly view: View }) {
  switch (view.page) {
    case 'system':
      return view.sub === 'about' ? <AboutPage {...props} /> : <SystemPage {...props} />;
    case 'personalization':
      return <PersonalizationPage {...props} />;
    case 'accessibility':
      return <AccessibilityPage {...props} />;
    case 'privacy':
      return <PrivacyPage {...props} />;
    case 'apps':
      return <AppsPage />;
    case 'switch':
      return <SwitchPage />;
    case 'tour':
      return <TourPage />;
  }
}

function SystemPage({ prefs, isOpen, toggle, go }: PageProps) {
  const person = getPerson();
  const volume = Math.round(prefs.sound.volume * 100);
  const volumeId = useId();
  return (
    <>
      <div className={styles.hero}>
        <DevicePreview align={prefs.taskbarAlign} />
        <div className={styles.heroText}>
          <span className={styles.heroName}>{`${person.givenName}’s Portfolio`}</span>
          <span className={styles.heroMeta}>{person.role}</span>
        </div>
      </div>
      <div className={styles.cards}>
        <Expander
          card="sound"
          glyph={prefs.sound.enabled ? flSpeaker : flSpeakerMute}
          summary={`${volume}%`}
          open={isOpen('sound')}
          onToggle={() => toggle('sound')}
        >
          <Row
            nested
            title="Volume"
            labelFor={volumeId}
            control={() => (
              <Slider
                id={volumeId}
                min={0}
                max={100}
                step={1}
                value={volume}
                valueText={`${volume}%`}
                onChange={(value) => setPrefNow({ sound: { ...prefs.sound, volume: value / 100 } })}
              />
            )}
          />
          <Row
            nested
            title="UI sounds"
            description="A soft pop for toasts, a low thud for errors"
            control={(ids) => (
              <Toggle
                ids={ids}
                checked={prefs.sound.ui}
                onChange={(ui) => setPref({ sound: { ...prefs.sound, ui } })}
              />
            )}
          />
          <Row
            nested
            title="Play intro sound"
            description="The chime when the site opens — only ever after you tap"
            control={(ids) => (
              <Toggle
                ids={ids}
                checked={prefs.sound.enabled}
                onChange={(enabled) => setPref({ sound: { ...prefs.sound, enabled } })}
              />
            )}
          />
        </Expander>
        <ToggleCard
          card="notifications"
          checked={prefs.notifications}
          onChange={(notifications) => setPref({ notifications })}
        />
        <NavCard
          card="about"
          onOpen={() => go({ page: 'system', sub: 'about' }, { focus: '[data-settings-heading]' })}
        />
      </div>
    </>
  );
}

function AboutPage({ prefs, isOpen, toggle }: PageProps) {
  const person = getPerson();
  const resume = getResume();
  const shell = useWinShell();
  const eggs = eggProgress(prefs.eggsFound, 'windows');
  const specs: readonly (readonly [string, ReactNode, string])[] = [
    ['Name', person.name, person.name],
    ['Role', person.role, person.role],
    ['Headline', person.headline, person.headline],
    ['Location', person.location, person.location],
    [
      'Résumé updated',
      <time key="updated" dateTime={resume.updated}>
        {formatUpdated(resume.updated)}
      </time>,
      formatUpdated(resume.updated),
    ],
    ['OS build', contentRev, contentRev],
  ];
  return (
    <div className={styles.cards}>
      <Card card="device-specs">
        <Row
          glyph={CARDS['device-specs'].glyph}
          title={CARDS['device-specs'].title}
          control={() => (
            <button
              type="button"
              className={styles.button}
              onClick={() =>
                shell.copyText(
                  specs.map(([label, , text]) => `${label}\t${text}`).join('\n'),
                  'Device specifications copied',
                )
              }
            >
              <Fl icon={flCopy} size={16} />
              Copy
            </button>
          )}
        />
        <dl className={styles.specs}>
          {specs.map(([label, value]) => (
            <div key={label} className={styles.spec}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card card="eggs">
        <Row
          glyph={CARDS.eggs.glyph}
          title={CARDS.eggs.title}
          description={CARDS.eggs.description}
          control={() => (
            <span className={styles.value}>
              {eggs.found} / {eggs.total}
            </span>
          )}
        />
      </Card>
      <Expander card="legal" open={isOpen('legal')} onToggle={() => toggle('legal')}>
        <div className={styles.prose}>
          <LegalNotice
            data={{
              credits: assetCredits(),
              contactEmail: getContact().email,
              glyphCredit: GLYPH_CREDIT,
              assetMode: ASSET_MODE,
            }}
            headingLevel={4}
          />
          <p>Windows system glyphs: {FLUENT_CREDIT}.</p>
        </div>
      </Expander>
    </div>
  );
}

function PersonalizationPage({ prefs, isOpen, toggle }: PageProps) {
  const theme = useId();
  const accent = useId();
  const align = useId();
  const systemSolid = useKernel((state) => state.capabilities.reducedTransparency);
  const transparency = transparencyOn(prefs, systemSolid);
  return (
    <>
      <div className={styles.hero}>
        <DevicePreview align={prefs.taskbarAlign} large />
      </div>
      <div className={styles.cards}>
        <Card card="theme">
          <Row
            glyph={CARDS.theme.glyph}
            title={CARDS.theme.title}
            description={CARDS.theme.description}
            control={() => null}
            render={(ids) => (
              <div role="radiogroup" aria-labelledby={ids.labelId} className={styles.tiles}>
                {(['light', 'dark', 'system'] as const).map((mode) => (
                  <label key={mode} htmlFor={`${theme}-${mode}`} className={styles.tile}>
                    <span className={styles.tileArt} data-mode={mode} aria-hidden="true">
                      <span className={styles.tileWindow} />
                    </span>
                    <span className={styles.tileLabel}>
                      <input
                        id={`${theme}-${mode}`}
                        type="radio"
                        name={theme}
                        className={styles.radio}
                        checked={prefs.theme === mode}
                        onChange={() => setPrefNow({ theme: mode })}
                      />
                      {mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'System'}
                    </span>
                  </label>
                ))}
              </div>
            )}
          />
        </Card>
        <Expander
          card="accent"
          summary={
            <>
              <span className={styles.swatchDot} data-accent={prefs.accent ?? 'auto'} aria-hidden="true" />
              {prefs.accent ? ACCENT_NAMES[prefs.accent] : 'Automatic'}
            </>
          }
          open={isOpen('accent')}
          onToggle={() => toggle('accent')}
        >
          <div className={styles.swatchBlock}>
            <span id={`${accent}-label`} className={styles.subTitle}>
              Windows colors
            </span>
            <div role="radiogroup" aria-labelledby={`${accent}-label`} className={styles.swatches}>
              {(['auto', ...ACCENT_IDS] as const).map((id) => {
                const name = id === 'auto' ? 'Automatic' : ACCENT_NAMES[id];
                const checked = (prefs.accent ?? 'auto') === id;
                return (
                  <label key={id} htmlFor={`${accent}-${id}`} className={styles.swatch} data-accent={id} title={name}>
                    <input
                      id={`${accent}-${id}`}
                      type="radio"
                      name={accent}
                      className={styles.swatchInput}
                      checked={checked}
                      onChange={() => setPrefNow({ accent: id === 'auto' ? null : id })}
                    />
                    <span className={styles.swatchChip} aria-hidden="true">
                      {checked ? (
                        <Fl icon={flCheckmark} size={16} />
                      ) : id === 'auto' ? (
                        <Fl icon={flSparkle} size={16} />
                      ) : null}
                    </span>
                    <span className="sr-only">{name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </Expander>
        <ToggleCard
          card="transparency"
          checked={transparency}
          description={transparencyNote(prefs)}
          onChange={(on) => setPref({ glass: on ? 'full' : 'solid' })}
        />
        <Card card="taskbar-alignment">
          <Row
            glyph={CARDS['taskbar-alignment'].glyph}
            title={CARDS['taskbar-alignment'].title}
            description={CARDS['taskbar-alignment'].description}
            control={(ids) => (
              <div role="radiogroup" aria-labelledby={ids.labelId} className={styles.segmented}>
                {(['center', 'left'] as const).map((value) => (
                  <label key={value} htmlFor={`${align}-${value}`} className={styles.option}>
                    <input
                      id={`${align}-${value}`}
                      type="radio"
                      name={align}
                      className={styles.radio}
                      checked={prefs.taskbarAlign === value}
                      onChange={() => setPrefNow({ taskbarAlign: value })}
                    />
                    {value === 'center' ? 'Center' : 'Left'}
                  </label>
                ))}
              </div>
            )}
          />
        </Card>
      </div>
    </>
  );
}

const transparencyOn = (prefs: UserPreferences, systemReduced: boolean) =>
  prefs.glass === 'full' || (prefs.glass === 'system' && !systemReduced);

const transparencyNote = (prefs: UserPreferences) =>
  prefs.contrast === 'more'
    ? 'Contrast themes keep every surface solid while they’re on'
    : CARDS.transparency.description;

function AccessibilityPage({ prefs }: PageProps) {
  const caps = useKernel((state) => state.capabilities);
  const textSize = useId();
  const scale = Math.round(prefs.textScale * 100);
  const animations = prefs.motion === 'full' || (prefs.motion === 'system' && !caps.reducedMotion);
  const userWins = caps.reducedMotion && prefs.motion === 'full';
  return (
    <>
      <div className={styles.cards}>
        <h4 className={styles.groupTitle}>Vision</h4>
        <Card card="text-size">
          <Row
            glyph={CARDS['text-size'].glyph}
            title={CARDS['text-size'].title}
            description={CARDS['text-size'].description}
            labelFor={textSize}
            control={() => (
              <Slider
                id={textSize}
                min={TEXT_SCALE_RANGE[0] * 100}
                max={TEXT_SCALE_RANGE[1] * 100}
                step={5}
                value={scale}
                valueText={`${scale}%`}
                onChange={(value) => setPrefNow({ textScale: value / 100 })}
              />
            )}
          />
          <div className={styles.textPreview}>
            <span className={styles.textPreviewLabel}>Text size preview</span>
            <p className={styles.textPreviewSample}>Drag the slider until this text is the size you want.</p>
          </div>
        </Card>
        <ToggleCard
          card="contrast"
          checked={prefs.contrast === 'more'}
          onChange={(on) => setPref({ contrast: on ? 'more' : 'system' })}
        />
        <ToggleCard
          card="animation"
          checked={animations}
          onChange={(on) => setPref({ motion: on ? 'full' : 'reduced' })}
          note={userWins ? 'Your device asks for reduced motion. Your choice here wins.' : null}
        />
        <ToggleCard
          card="a11y-transparency"
          checked={transparencyOn(prefs, caps.reducedTransparency)}
          description={transparencyNote(prefs)}
          onChange={(on) => setPref({ glass: on ? 'full' : 'solid' })}
        />
        <h4 className={styles.groupTitle}>Interaction</h4>
        <ToggleCard
          card="single-key"
          checked={prefs.singleKeyShortcuts}
          onChange={(singleKeyShortcuts) => setPref({ singleKeyShortcuts })}
        />
        <h4 className={styles.groupTitle}>Related settings</h4>
        <Card card="plain">
          <Row
            glyph={CARDS.plain.glyph}
            title={CARDS.plain.title}
            description={CARDS.plain.description}
            control={() => (
              <a href="/plain" className={styles.button}>
                Open plain portfolio
                <Fl icon={flOpen} size={16} />
              </a>
            )}
          />
        </Card>
      </div>
    </>
  );
}

const readSignals = (): string => {
  const signals = readPrivacySignals(window, true);
  return `${signals.doNotTrack ? 1 : 0}${signals.globalPrivacyControl ? 1 : 0}`;
};

function PrivacyPage({ isOpen, toggle }: PageProps) {
  const signals = useSyncExternalStore(neverChanges, readSignals, () => '00');
  const dnt = signals[0] === '1';
  const gpc = signals[1] === '1';
  return (
    <div className={styles.cards}>
      <Expander card="diagnostics" open={isOpen('diagnostics')} onToggle={() => toggle('diagnostics')}>
        <div className={styles.prose}>
          <PrivacyNotice data={{ counted: COUNTED }} headingLevel={4} />
        </div>
      </Expander>
      <Card card="signals">
        <Row
          glyph={CARDS.signals.glyph}
          title={CARDS.signals.title}
          description={`Do Not Track: ${dnt ? 'on' : 'off'} · Global Privacy Control: ${gpc ? 'on' : 'off'}`}
          control={() => (
            <span className={styles.value}>{dnt || gpc ? 'Nothing is counted' : 'Counting page views'}</span>
          )}
        />
      </Card>
      <Card card="cookies">
        <Row
          glyph={CARDS.cookies.glyph}
          title={CARDS.cookies.title}
          description={CARDS.cookies.description}
          control={() => <span className={styles.value}>No cookies</span>}
        />
      </Card>
    </div>
  );
}

function AppsPage() {
  return (
    <div className={styles.cards}>
      <div className={styles.groupHead}>
        <h4 className={styles.groupTitle}>Installed apps</h4>
        <span className={styles.count}>{WIN_APPS.length} apps found</span>
      </div>
      <ul role="list" className={styles.list}>
        {WIN_APPS.map((binding) => (
          <li key={binding.slug}>
            <Card card={`app-${binding.slug}`}>
              <Row
                icon={<AssetIcon id={binding.icon} size={32} />}
                title={binding.title}
                description={appMeta(binding)}
                control={() => (
                  <KernelLink
                    to={{ os: 'windows', role: binding.role }}
                    className={styles.button}
                    aria-label={`Open ${binding.title}`}
                  >
                    Open
                  </KernelLink>
                )}
              />
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A real link to the OS (or the chooser) whose plain click becomes one `SWITCH_OS` (the session parks). */
function SwitchLink({
  to,
  label,
  className,
  children,
}: {
  readonly to: OsId | null;
  readonly label: string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const href = routeCodec.encode(to ? { kind: 'os', os: to, focus: null } : { kind: 'welcome' });
  return (
    <a
      href={href}
      className={className}
      aria-label={label}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        if (event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        dispatchSoon({ type: 'SWITCH_OS', to, via: 'switch' });
      }}
    >
      {children}
    </a>
  );
}

function SwitchPage() {
  return (
    <div className={styles.cards}>
      <p className={styles.lede}>Your windows here stay as you left them — come back any time.</p>
      <ul role="list" className={styles.list}>
        {OTHER_OSES.map((os) => {
          const kind = OS_KIND[OS_REGISTRY[os].chrome];
          return (
            <li key={os}>
              <Card card={`os-${os}`}>
                <Row
                  glyph={kind.glyph}
                  title={OS_NAMES[os]}
                  description={kind.label}
                  control={() => (
                    <SwitchLink to={os} label={`Switch to ${OS_NAMES[os]}`} className={styles.button}>
                      Switch
                    </SwitchLink>
                  )}
                />
              </Card>
            </li>
          );
        })}
      </ul>
      <Card card="chooser">
        <Row
          glyph={CARDS.chooser.glyph}
          title={CARDS.chooser.title}
          description={CARDS.chooser.description}
          control={() => (
            <SwitchLink to={null} label="Back to chooser" className={`${styles.button} ${styles.accentButton}`}>
              Back to chooser
            </SwitchLink>
          )}
        />
      </Card>
    </div>
  );
}

function TourPage() {
  const shell = useWinShell();
  return (
    <div className={styles.cards}>
      <Card card="tour">
        <Row
          glyph={CARDS.tour.glyph}
          title={CARDS.tour.title}
          description={CARDS.tour.description}
          control={() => (
            <button
              type="button"
              className={`${styles.button} ${styles.accentButton}`}
              onClick={() => shell.startTour()}
            >
              Start tour
            </button>
          )}
        />
      </Card>
    </div>
  );
}

// --- Cards and controls ------------------------------------------------------------------------------------------------

interface Ids {
  readonly labelId: string;
  readonly descId: string | undefined;
}

/** A card: 1 px stroke, 8 px radius; focusable by script (search and intents land on it). */
function Card({ card, children }: { readonly card: string; readonly children: ReactNode }) {
  return (
    <div className={styles.card} data-card={card} tabIndex={-1}>
      {children}
    </div>
  );
}

/** One 68 px row: glyph (or app icon) · title + description · the control on the right. */
function Row({
  glyph,
  icon,
  title,
  description,
  labelFor,
  nested = false,
  control,
  render,
}: {
  readonly glyph?: Glyph;
  readonly icon?: ReactNode;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  /** The row's title is the `<label>` of this control (sliders). */
  readonly labelFor?: string;
  readonly nested?: boolean;
  readonly control: (ids: Ids) => ReactNode;
  /** Content below the row that the title labels (radio tiles). */
  readonly render?: (ids: Ids) => ReactNode;
}) {
  const id = useId();
  const ids: Ids = { labelId: `${id}-label`, descId: description ? `${id}-desc` : undefined };
  const controlNode = control(ids);
  return (
    <>
      <div className={nested ? styles.subRow : styles.row}>
        {glyph ? (
          <span className={styles.glyph}>
            <Fl icon={glyph} size={20} />
          </span>
        ) : icon ? (
          <span className={styles.appIcon}>{icon}</span>
        ) : null}
        <span className={styles.text}>
          {labelFor ? (
            <label id={ids.labelId} htmlFor={labelFor} className={styles.title}>
              {title}
            </label>
          ) : (
            <span id={ids.labelId} className={styles.title}>
              {title}
            </span>
          )}
          {description ? (
            <span id={ids.descId} className={styles.desc}>
              {description}
            </span>
          ) : null}
        </span>
        {controlNode ? <span className={styles.control}>{controlNode}</span> : null}
      </div>
      {render ? render(ids) : null}
    </>
  );
}

function ToggleCard({
  card,
  checked,
  onChange,
  description,
  note,
}: {
  readonly card: CardKey;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly description?: string;
  readonly note?: string | null;
}) {
  const info = CARDS[card];
  return (
    <Card card={card}>
      <Row
        glyph={info.glyph}
        title={info.title}
        description={description ?? info.description}
        control={(ids) => <Toggle ids={ids} checked={checked} onChange={onChange} />}
      />
      {note ? (
        <p className={styles.note}>
          <Fl icon={flInfo} size={16} />
          {note}
        </p>
      ) : null}
    </Card>
  );
}

/** The Windows toggle switch: 40 × 20 track, 12 px thumb moving in 83 ms; "On"/"Off" beside it. */
function Toggle({
  ids,
  checked,
  onChange,
}: {
  readonly ids: Ids;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <span className={styles.switchWrap}>
      <span className={styles.switchState} aria-hidden="true">
        {checked ? 'On' : 'Off'}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={ids.labelId}
        aria-describedby={ids.descId}
        className={styles.switch}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.thumb} aria-hidden="true" />
      </button>
    </span>
  );
}

/** A native range, styled as the Windows slider (accent fill left of the thumb); the row's title is its label. */
function Slider({
  id,
  min,
  max,
  step,
  value,
  valueText,
  onChange,
}: {
  readonly id: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  readonly valueText: string;
  readonly onChange: (value: number) => void;
}) {
  const fill = `${((value - min) / (max - min)) * 100}%`;
  return (
    <span className={styles.slider}>
      <input
        id={id}
        type="range"
        className={styles.range}
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={valueText}
        style={{ '--fill': fill } as CSSProperties}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
      <span className={styles.rangeValue} aria-hidden="true">
        {valueText}
      </span>
    </span>
  );
}

/** An expander card: the header is a button (`aria-expanded`); the body is revealed by clip-path, never by height. */
function Expander({
  card,
  glyph,
  summary,
  open,
  onToggle,
  children,
}: {
  readonly card: CardKey;
  readonly glyph?: Glyph;
  readonly summary?: ReactNode;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly children: ReactNode;
}) {
  const id = useId();
  const info = CARDS[card];
  return (
    <div className={styles.card} data-card={card} data-expander="" data-open={open || undefined} tabIndex={-1}>
      <button
        type="button"
        className={styles.expanderHead}
        aria-expanded={open}
        aria-controls={`${id}-body`}
        aria-labelledby={`${id}-title`}
        aria-describedby={summary ? `${id}-desc ${id}-summary` : `${id}-desc`}
        onClick={onToggle}
      >
        <span className={styles.glyph}>
          <Fl icon={glyph ?? info.glyph} size={20} />
        </span>
        <span className={styles.text}>
          <span id={`${id}-title`} className={styles.title}>
            {info.title}
          </span>
          <span id={`${id}-desc`} className={styles.desc}>
            {info.description}
          </span>
        </span>
        {summary ? (
          <span id={`${id}-summary`} className={styles.summary}>
            {summary}
          </span>
        ) : null}
        <span className={styles.chevron} aria-hidden="true">
          <Fl icon={flChevronDown} size={16} />
        </span>
      </button>
      <div id={`${id}-body`} className={styles.expanderBody} hidden={!open}>
        {children}
      </div>
    </div>
  );
}

/** A navigation card (Windows' "›" rows): opens a sub-page. */
function NavCard({ card, onOpen }: { readonly card: CardKey; readonly onOpen: () => void }) {
  const id = useId();
  const info = CARDS[card];
  return (
    <div className={styles.card} data-card={card} tabIndex={-1}>
      <button
        type="button"
        className={styles.expanderHead}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        onClick={onOpen}
      >
        <span className={styles.glyph}>
          <Fl icon={info.glyph} size={20} />
        </span>
        <span className={styles.text}>
          <span id={`${id}-title`} className={styles.title}>
            {info.title}
          </span>
          <span id={`${id}-desc`} className={styles.desc}>
            {info.description}
          </span>
        </span>
        <span className={styles.chevron} aria-hidden="true">
          <Fl icon={flChevronRight} size={16} />
        </span>
      </button>
    </div>
  );
}

/**
 * The device picture Windows shows on System and Personalization: this desktop's wallpaper in a small monitor, a
 * window in the current theme and accent, and the taskbar icons where Taskbar alignment puts them. Decorative.
 */
function DevicePreview({
  align,
  large = false,
}: {
  readonly align: UserPreferences['taskbarAlign'];
  readonly large?: boolean;
}) {
  return (
    <span className={styles.device} data-large={large || undefined} aria-hidden="true">
      <span className={styles.screen}>
        <span className={styles.miniWindow}>
          <span className={styles.miniTitle} />
          <span className={styles.miniAccent} />
        </span>
        <span className={styles.miniTaskbar} data-align={align}>
          <span className={styles.miniStart} />
          <span />
          <span />
          <span />
          <span />
        </span>
      </span>
    </span>
  );
}
