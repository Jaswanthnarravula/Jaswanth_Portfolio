'use client';
/**
 * File Explorer — plans/windows/apps/file-explorer.md (`WIN-EXP-01…08`) on the storyboard frame (plans/windows/01
 * "Visual target": File Explorer at Experience). Experience and education exist as folders and files; every name,
 * role and date comes from `data/selectors` and the shared content views — nothing about the career is typed here.
 *   · title bar with one tab "{Folder} ✕" (✕ closes the window; "+" is disabled with a tooltip) · address row: Back /
 *     Forward / Up, the breadcrumb (crumbs navigate, chevrons open sibling menus; clicking the field turns it into a
 *     text box that takes a typed path — explorer-path.ts) and the search box · command bar · navigation pane · the
 *     Details list (a real table; header buttons sort, `aria-sort`) or Tiles / Large icons · details pane · status bar
 *     (`WIN-EXP-01`, `WIN-EXP-05`).
 *   · select (click, arrows, type-ahead) → details pane + URL (NAVIGATE_IN_APP); open (double-click / Enter) → the
 *     document view in the same tab with a "Back to folder" crumb (`WIN-EXP-02`). Back / Forward are the window's nav
 *     stack, which the kernel keeps aligned with browser Back; Up goes to the parent (`WIN-EXP-03`).
 *   · Home: Quick access tiles + Recent (the current role, the latest project), from data (`WIN-EXP-06`); Projects and
 *     Résumé are shortcuts that open GitHub and Edge's PDF tab (`WIN-EXP-07`).
 *   · compact: the navigation pane is the first screen, folders drill down with a back arrow in the title row, a file
 *     is its document, the command bar collapses to ⋯ (`WIN-EXP-08`).
 *   · a removed item lands on its folder with the InfoBar "That item is no longer available" (plans/windows/06).
 * Motion (plans/windows/03): a folder change drills the list in (8 px rise), the document drills in (16 px), the
 * details pane slides 250 ms — transform / opacity only, all interruptible. Focus never falls to <body>.
 */
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { EducationDetail, ExperienceDetail, formatPeriod, formatUpdated } from '@/components/content';
import type { MenuEntry } from '@/components/primitives/Menu';
import { usePress } from '@/components/primitives/Press';
import { RovingGroup } from '@/components/primitives/RovingGroup';
import { hrefFor, KernelLink } from '@/components/shell/KernelLink';
import { AssetIcon } from '@/components/ui/AssetIcon';
import type { EducationSlug, ExperienceSlug } from '@/data/content-index';
import type { ContentRef } from '@/data/schema';
import {
  getCurrentRole,
  getEducation,
  getEducationEntry,
  getExperience,
  getExperienceEntry,
  getProjects,
  getResume,
} from '@/data/selectors';
import type { KernelAction } from '@/lib/kernel/actions';
import { routeCodec } from '@/lib/kernel/route';
import { currentLocation, sameLocation } from '@/lib/kernel/state';
import type { AppLocation, WindowId } from '@/lib/kernel/types';
import { dispatchSoon, subscribeEffects } from '@/stores/kernel-store';
import {
  flChevronUp,
  flDismiss,
  flInfo,
  flLink,
  flMore,
  flOpen,
  flSearch,
  flShare,
  flSort,
  flView,
  flWindowNew,
  type Glyph,
} from '../fluent.generated';
import {
  flAdd,
  flArrowLeft,
  flArrowRight,
  flArrowUp,
  flChevronDown,
  flChevronRight,
  flCopy,
  flCut,
  flError,
  flHome,
  flHomeFilled,
  flInfoFilled,
  flList,
  flPanelRight,
  flPaste,
  flPin,
} from '../fluent.apps.generated';
import { DocFile, Fl, PdfFile, ShortcutArrow } from '../icons';
import { explorerPlace, FOLDER_TITLES, type ExplorerFolder } from '../model';
import { drillIn } from '../motion';
import { useWinShell } from '../shell-context';
import { WIN_SLOTS } from '../slots';
import { TitleBar, useWindowChrome, type WindowBodyProps } from '../window/Window';
import {
  explorerFileName,
  explorerFiles,
  formatExplorerPath,
  parseExplorerPath,
  shortcutName,
  userRoot,
  type ExplorerSection,
} from './explorer-path';
import styles from './explorer.module.css';

// --- Places --------------------------------------------------------------------------------------------------------

const ROOT: AppLocation = { kind: 'root' };

const at = (section?: ExplorerSection, slug?: string): AppLocation =>
  section ? { kind: 'content', ref: (slug ? { section, slug } : { section }) as ContentRef } : ROOT;

const plainClick = (event: MouseEvent) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

type ViewMode = 'details' | 'tiles' | 'icons';
type ColumnKey = 'name' | 'title' | 'dates' | 'where';
type SortDir = 'ascending' | 'descending';
interface SortState {
  readonly key: ColumnKey;
  readonly dir: SortDir;
}

/** A file in a folder, as the Details list shows it. */
interface Entry {
  readonly slug: string;
  readonly name: string;
  /** Role (Experience) or degree (Education); '' when none is published. */
  readonly title: string;
  readonly dates: string;
  readonly where: string;
  /** Position in the selectors' order (newest first) — the Dates sort key. */
  readonly rank: number;
  readonly ref: ContentRef;
  readonly location: AppLocation;
}

function entriesOf(folder: ExplorerFolder): readonly Entry[] {
  if (folder === 'home') return [];
  const names = new Map(explorerFiles(folder).map((file) => [file.slug, file.name]));
  if (folder === 'experience')
    return getExperience().map((role, rank) => ({
      slug: role.slug,
      name: names.get(role.slug) ?? role.slug,
      title: role.role ?? '',
      dates: formatPeriod(role.start, role.end) ?? '',
      where: role.location ?? '',
      rank,
      ref: { section: 'experience', slug: role.slug },
      location: at('experience', role.slug),
    }));
  return getEducation().map((school, rank) => ({
    slug: school.slug,
    name: names.get(school.slug) ?? school.slug,
    title: school.degree,
    dates: formatPeriod(school.start, school.end) ?? '',
    where: '',
    rank,
    ref: { section: 'education', slug: school.slug },
    location: at('education', school.slug),
  }));
}

const COLUMNS: Readonly<Record<ExplorerSection, readonly { key: ColumnKey; label: string }[]>> = {
  experience: [
    { key: 'name', label: 'Name' },
    { key: 'title', label: 'Role' },
    { key: 'dates', label: 'Dates' },
    { key: 'where', label: 'Location' },
  ],
  education: [
    { key: 'name', label: 'Name' },
    { key: 'title', label: 'Degree' },
    { key: 'dates', label: 'Dates' },
  ],
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function sortEntries(entries: readonly Entry[], sort: SortState): readonly Entry[] {
  const dir = sort.dir === 'ascending' ? 1 : -1;
  return [...entries].sort((a, b) => {
    // Rank 0 is the newest: ascending dates = oldest first.
    const primary = sort.key === 'dates' ? b.rank - a.rank : collator.compare(a[sort.key], b[sort.key]);
    return primary * dir || a.rank - b.rank;
  });
}

const matches = (entry: Entry, query: string) =>
  !query || [entry.name, entry.title, entry.dates, entry.where].some((value) => value.toLowerCase().includes(query));

/** A new sort column starts where Windows starts it: dates newest first, text A → Z. */
const defaultDir = (key: ColumnKey): SortDir => (key === 'dates' ? 'descending' : 'ascending');

/** Session memory (never persisted): the view, sort and details pane survive closing and reopening the window. */
const memory: { view: ViewMode; sort: SortState; pane: boolean } = {
  view: 'details',
  sort: { key: 'dates', dir: 'descending' },
  pane: false,
};

// --- A removed item (plans/windows/apps/file-explorer "Edge cases") -----------------------------------------------

/** The kernel repairs a stale slug to its folder; the Explorer says so. `true` when a URL named a missing item. */
function urlNamesMissingItem(url: string): AppLocation | null {
  const decoded = routeCodec.decode(url.split(/[?#]/)[0] || '/');
  if (decoded.ok || decoded.reason !== 'unknown-slug') return null;
  const route = decoded.nearest;
  if (route.kind !== 'os' || route.os !== 'windows' || route.focus?.role !== 'files') return null;
  return route.focus.location.kind === 'content' ? route.focus.location : null;
}

const knownItem = (ref: ContentRef): boolean | null => {
  if (!('slug' in ref) || !ref.slug) return null;
  if (ref.section === 'experience') return !!getExperienceEntry(ref.slug as ExperienceSlug);
  if (ref.section === 'education') return !!getEducationEntry(ref.slug as EducationSlug);
  return null;
};

/** What an action asked this Explorer to show: a missing item, or an item opened from outside (Start, Search…). */
function requestOf(action: KernelAction, id: WindowId): { missing: boolean; opened: string | null } | null {
  if (action.type === 'ROUTE_CHANGED') return urlNamesMissingItem(action.url) ? { missing: true, opened: null } : null;
  const own =
    (action.type === 'OPEN_APP' && (action.os ?? 'windows') === 'windows') ||
    (action.type === 'NAVIGATE_IN_APP' && action.id === id);
  if (!own || !('location' in action) || action.location?.kind !== 'content') return null;
  const { ref } = action.location;
  const known = knownItem(ref);
  if (known === null) return null;
  if (!known) return { missing: true, opened: null };
  return { missing: false, opened: action.type === 'OPEN_APP' && 'slug' in ref ? (ref.slug ?? null) : null };
}

/** A cold deep link to a removed item: the page's own navigation entry still names it (read once per page load). */
let coldChecked = false;
function coldMissing(location: AppLocation): boolean {
  if (coldChecked) return false;
  try {
    const entry = globalThis.performance?.getEntriesByType?.('navigation')[0];
    if (!entry) return false;
    const nearest = urlNamesMissingItem(new URL(entry.name).pathname);
    return !!nearest && sameLocation(nearest, location);
  } catch {
    return false;
  }
}

// --- The app -------------------------------------------------------------------------------------------------------

/** Where focus lands after a change; `rescue` acts only if the change left focus nowhere (a button turned disabled). */
type FocusGoal = 'document' | 'selected' | 'content' | 'edit' | 'address' | 'places' | 'rescue';

const itemFor = (node: ParentNode | null | undefined, slug: string): HTMLElement | null =>
  [...(node?.querySelectorAll<HTMLElement>('[data-exp-item]') ?? [])].find((el) => el.dataset.expItem === slug) ?? null;

export default function Explorer({ window, compact }: WindowBodyProps) {
  const shell = useWinShell();
  const chrome = useWindowChrome();
  const coarse = chrome?.touch ?? false;
  const location = currentLocation(window);
  const place = explorerPlace(location);
  const folder = place.folder;
  const section: ExplorerSection | null = folder === 'home' ? null : folder;
  const all = entriesOf(folder);
  const stale = place.slug !== null && !all.some((entry) => entry.slug === place.slug);
  const slug = stale ? null : place.slug;

  const [opened, setOpened] = useState<string | null>(() => explorerPlace(currentLocation(window)).slug);
  const [missing, setMissing] = useState(() => coldMissing(currentLocation(window)));
  const [view, setView] = useState<ViewMode>(memory.view);
  const [sort, setSort] = useState<SortState>(memory.sort);
  const [pane, setPane] = useState(memory.pane);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState({ quick: true, recent: true });

  // A new folder starts unfiltered; leaving a file closes its document (the previous value lives in state).
  const [seen, setSeen] = useState({ folder, slug });
  if (seen.folder !== folder || seen.slug !== slug) {
    setSeen({ folder, slug });
    if (seen.folder !== folder) setQuery('');
    if (opened !== null && opened !== slug) setOpened(null);
  }

  const root = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const arrowMove = useRef(false);
  /** A file whose document opens once the kernel has navigated to it (no frame of the list in between). */
  const arrival = useRef<string | null>(null);
  const pending = useRef<{ goal: FocusGoal; ready: (location: AppLocation) => boolean } | null>(null);
  const ids = useId();

  const documentShown = slug !== null && (compact || opened === slug);
  const level: 'home' | 'folder' | 'file' = documentShown ? 'file' : folder === 'home' ? 'home' : 'folder';
  const q = query.trim().toLowerCase();
  const entries = sortEntries(all, sort).filter((entry) => matches(entry, q));
  const selected = slug ? (all.find((entry) => entry.slug === slug) ?? null) : null;
  const columns = section ? COLUMNS[section] : [];
  const folderName = FOLDER_TITLES[folder];
  const canBack = window.nav.index > 0;
  const canForward = window.nav.index < window.nav.entries.length - 1;
  /** Up: from a document to its folder (the file stays selected), from a folder to Home. */
  const upTarget: AppLocation | null = documentShown && section ? at(section) : section ? ROOT : null;
  const upName = documentShown ? folderName : FOLDER_TITLES.home;
  const addressLocation = documentShown ? location : section ? at(section) : ROOT;
  const currentRef: ContentRef | null = selected ? selected.ref : section ? { section } : null;
  const currentLabel = selected ? selected.name : folderName;

  // --- Motion: a folder change drills the list in (8 px), a document drills in (16 px) ------------------------------
  // Declared before the focus effect: the drill starts first, then focus lands (a tween never disturbs focus).
  const shownFolder = useRef(folder);
  useLayoutEffect(() => {
    if (shownFolder.current === folder) return;
    shownFolder.current = folder;
    const count = folder === 'home' ? 0 : entriesOf(folder).length;
    shell.announce(
      folder === 'home' ? FOLDER_TITLES.home : `${FOLDER_TITLES[folder]}, ${count} ${count === 1 ? 'item' : 'items'}`,
    );
    if (listRef.current) drillIn(listRef.current, 8);
  }, [folder, shell]);
  const shownDocument = useRef<string | null>(documentShown ? slug : null);
  useLayoutEffect(() => {
    const now = documentShown ? slug : null;
    if (shownDocument.current === now) return;
    shownDocument.current = now;
    if (now && documentRef.current) drillIn(documentRef.current);
  }, [documentShown, slug]);

  // --- Focus: land on what replaced the thing that had focus, once the kernel has committed -------------------------
  const focusSoon = (goal: FocusGoal, ready: (location: AppLocation) => boolean = () => true) => {
    const job = { goal, ready };
    pending.current = job;
    // A change that never lands (the kernel refused it) must not steal focus later.
    setTimeout(() => {
      if (pending.current === job) pending.current = null;
    }, 3000);
  };
  useLayoutEffect(() => {
    const job = pending.current;
    const node = root.current;
    if (!job || !node) return;
    if (!job.ready(location)) return;
    if (job.goal === 'rescue') {
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== document.body && !active.matches(':disabled')) {
        pending.current = null;
        return;
      }
    }
    const find = (selector: string) => node.querySelector<HTMLElement>(selector);
    const target =
      job.goal === 'document'
        ? find('[data-exp-document]')
        : job.goal === 'edit'
          ? editRef.current
          : job.goal === 'address'
            ? editButton.current
            : job.goal === 'places'
              ? (find('[data-exp-nav] [aria-current="page"]') ?? find('[data-exp-nav] a'))
              : (find('[data-exp-item][aria-current="true"]') ??
                (job.goal === 'selected'
                  ? find('[data-exp-item]')
                  : (find('[data-exp-item]') ?? find('[data-exp-home] a') ?? find('[data-exp-nav] a'))));
    if (!target) return;
    pending.current = null;
    target.focus({ preventScroll: false });
    if (job.goal === 'edit') editRef.current?.select();
  });

  // --- Kernel requests: an item opened from outside shows its document; a removed item raises the InfoBar ----------
  const windowId = window.id;
  useEffect(
    () =>
      subscribeEffects(({ action, state }) => {
        const own = state.sessions.windows.windows[windowId];
        if (state.activeOs !== 'windows' || !own) return;
        // A file this Explorer asked to open: its document shows in the same render the kernel lands on it.
        const landed = explorerPlace(currentLocation(own)).slug;
        if (arrival.current !== null && landed === arrival.current) {
          arrival.current = null;
          setOpened(landed);
        }
        const request = requestOf(action, windowId);
        if (!request) return;
        if (request.missing) setMissing(true);
        else if (request.opened) setOpened(request.opened);
      }),
    [windowId],
  );
  useEffect(() => {
    coldChecked = true;
  }, []);

  // --- Session memory ------------------------------------------------------------------------------------------------
  useEffect(() => {
    memory.view = view;
    memory.sort = sort;
    memory.pane = pane;
  }, [view, sort, pane]);

  // --- Actions -------------------------------------------------------------------------------------------------------
  const go = (target: AppLocation, keepArrival = false) => {
    if (!keepArrival) arrival.current = null;
    setMissing(false);
    dispatchSoon({ type: 'NAVIGATE_IN_APP', id: window.id, location: target });
  };
  const select = (entry: Entry) => {
    if (entry.slug !== slug) go(entry.location);
  };
  /** Open a file's document: now if it is the selection, else when the kernel lands on it. */
  const openAt = (target: AppLocation, file: string) => {
    if (sameLocation(target, location)) setOpened(file);
    else {
      arrival.current = file;
      go(target, true);
    }
    focusSoon('document', (now) => sameLocation(now, target));
  };
  const openEntry = (entry: Entry) => openAt(entry.location, entry.slug);
  /** Up: a document closes to its folder (the file stays selected); a folder goes to Home. */
  const up = () => {
    if (!upTarget) return;
    if (documentShown && !compact) {
      setOpened(null);
      focusSoon('selected');
      return;
    }
    // Compact back arrow: collapse into the nav stack when the level above is where the visitor came from.
    const previous = window.nav.entries[window.nav.index - 1];
    if (compact && previous && sameLocation(previous, upTarget)) dispatchSoon({ type: 'APP_BACK', id: window.id });
    else go(upTarget);
    const goal: FocusGoal = compact && upTarget.kind === 'root' ? 'places' : compact ? 'selected' : 'rescue';
    focusSoon(goal, (now) => sameLocation(now, upTarget));
  };
  const closeDocument = () => {
    if (compact) {
      up();
      return;
    }
    setOpened(null);
    focusSoon('selected');
  };
  /** A folder from the nav pane, a crumb or a tile. Focus follows only when what had it goes away. */
  const openFolder = (target: ExplorerSection | null, follow = false) => {
    const destination = at(target ?? undefined);
    if (!sameLocation(destination, location)) go(destination);
    else if (documentShown) setOpened(null);
    focusSoon(follow ? 'content' : 'rescue', (now) => sameLocation(now, destination));
  };
  /** Back / Forward: the window's nav stack (the kernel mirrors it into browser history). */
  const step = (type: 'APP_BACK' | 'APP_FORWARD') => {
    const before = location;
    arrival.current = null;
    dispatchSoon(type === 'APP_BACK' ? { type: 'APP_BACK', id: window.id } : { type: 'APP_FORWARD', id: window.id });
    // If this button turns disabled, focus moves to the content instead of falling to <body>.
    focusSoon('rescue', (now) => !sameLocation(now, before));
  };

  const properties = (entry: Entry | null) => {
    if (entry && section === 'experience') {
      const role = getExperienceEntry(entry.slug as ExperienceSlug);
      const rows: [string, string][] = [
        ['Type', 'DOCX File'],
        ['Location', formatExplorerPath(at(section))],
      ];
      if (role) {
        rows.push(['Company', role.company]);
        if (role.client) rows.push(['Client', role.client]);
        if (role.role) rows.push(['Role', role.role]);
      }
      if (entry.dates) rows.push(['Dates', entry.dates]);
      if (entry.where) rows.push(['Place', entry.where]);
      shell.openProperties({ title: entry.name, rows, ref: entry.ref });
      return;
    }
    if (entry && section === 'education') {
      const school = getEducationEntry(entry.slug as EducationSlug);
      const rows: [string, string][] = [
        ['Type', 'DOCX File'],
        ['Location', formatExplorerPath(at(section))],
      ];
      if (school) rows.push(['School', school.school], ['Degree', school.degree]);
      if (entry.dates) rows.push(['Dates', entry.dates]);
      shell.openProperties({ title: entry.name, rows, ref: entry.ref });
      return;
    }
    if (section) {
      shell.openProperties({
        title: folderName,
        rows: [
          ['Type', 'File folder'],
          ['Location', userRoot()],
          ['Contains', `${all.length} ${all.length === 1 ? 'file' : 'files'}`],
        ],
        ref: { section },
      });
      return;
    }
    shell.openProperties({
      title: FOLDER_TITLES.home,
      rows: [
        ['Type', 'System folder'],
        ['Location', userRoot()],
      ],
      ref: null,
    });
  };

  /** Copy link; a blocked clipboard opens Properties, which shows the link selected (shell-context `copyLink`). */
  const copyLink = (entry: Entry | null) => {
    const ref = entry ? entry.ref : currentRef;
    if (!ref) return;
    void shell.copyLink(ref, entry ? entry.name : currentLabel).then((copied) => {
      if (!copied) properties(entry ?? selected);
    });
  };
  const share = (entry: Entry | null) => {
    const ref = entry ? entry.ref : currentRef;
    if (!ref) return;
    const nav = globalThis.navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (typeof nav?.share === 'function') {
      const url = new URL(hrefFor({ os: 'windows', ref }), globalThis.location.href).href;
      // The system share sheet (Windows' own on Edge / Chrome); cancelling it is not an error.
      nav.share({ title: entry ? entry.name : currentLabel, url }).catch(() => undefined);
      return;
    }
    copyLink(entry);
  };
  /** Copy as path; a blocked clipboard shows the path selected in the address bar instead. */
  const copyPath = (target: AppLocation) => {
    const text = `"${formatExplorerPath(target)}"`;
    void shell.copyText(text, 'Path copied').then((copied) => {
      if (!copied) startEdit(text);
    });
  };

  /** A new view (or the pane going away) replaces what may hold focus: rescue it if it falls. */
  const changeView = (next: ViewMode) => {
    setView(next);
    focusSoon('rescue');
  };
  const togglePane = () => {
    setPane((value) => !value);
    focusSoon('rescue');
  };

  const sortBy = (key: ColumnKey) =>
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'ascending' ? 'descending' : 'ascending' }
        : { key, dir: defaultDir(key) },
    );
  const sortEntriesMenu = (): MenuEntry[] =>
    section
      ? [
          ...COLUMNS[section].map((column): MenuEntry => ({
            kind: 'checkbox',
            id: `sort-${column.key}`,
            label: column.label,
            checked: sort.key === column.key,
            onSelect: () =>
              setSort({ key: column.key, dir: sort.key === column.key ? sort.dir : defaultDir(column.key) }),
          })),
          { kind: 'separator', id: 'sort-sep' },
          {
            kind: 'checkbox',
            id: 'sort-asc',
            label: 'Ascending',
            checked: sort.dir === 'ascending',
            onSelect: () => setSort({ ...sort, dir: 'ascending' }),
          },
          {
            kind: 'checkbox',
            id: 'sort-desc',
            label: 'Descending',
            checked: sort.dir === 'descending',
            onSelect: () => setSort({ ...sort, dir: 'descending' }),
          },
        ]
      : [];
  const viewEntriesMenu = (): MenuEntry[] => [
    {
      kind: 'checkbox',
      id: 'view-icons',
      label: 'Large icons',
      checked: view === 'icons',
      onSelect: () => changeView('icons'),
    },
    {
      kind: 'checkbox',
      id: 'view-tiles',
      label: 'Tiles',
      checked: view === 'tiles',
      onSelect: () => changeView('tiles'),
    },
    {
      kind: 'checkbox',
      id: 'view-details',
      label: 'Details',
      checked: view === 'details',
      onSelect: () => changeView('details'),
    },
    ...(compact
      ? []
      : ([
          { kind: 'separator', id: 'view-sep' },
          { kind: 'checkbox', id: 'view-pane', label: 'Details pane', checked: pane, onSelect: () => togglePane() },
        ] satisfies MenuEntry[])),
  ];
  const below = (el: HTMLElement) => {
    const box = el.getBoundingClientRect();
    return { x: box.left, y: box.bottom + 4 };
  };
  const openSortMenu = (el: HTMLElement) =>
    shell.openMenu({ label: 'Sort', at: below(el), items: sortEntriesMenu(), returnFocusTo: el });
  const openViewMenu = (el: HTMLElement) =>
    shell.openMenu({ label: 'View', at: below(el), items: viewEntriesMenu(), returnFocusTo: el });
  const openMoreMenu = (el: HTMLElement) =>
    shell.openMenu({
      label: 'See more',
      at: below(el),
      returnFocusTo: el,
      items: [
        ...(compact
          ? ([
              {
                kind: 'item',
                id: 'more-link',
                label: 'Copy link',
                icon: <Fl icon={flLink} />,
                disabled: !currentRef,
                onSelect: () => copyLink(null),
              },
              {
                kind: 'item',
                id: 'more-share',
                label: 'Share',
                icon: <Fl icon={flShare} />,
                disabled: !currentRef,
                onSelect: () => share(null),
              },
              { kind: 'separator', id: 'more-s0' },
              {
                kind: 'submenu',
                id: 'more-sort',
                label: 'Sort',
                icon: <Fl icon={flSort} />,
                disabled: !section,
                items: sortEntriesMenu(),
              },
              { kind: 'submenu', id: 'more-view', label: 'View', icon: <Fl icon={flView} />, items: viewEntriesMenu() },
              { kind: 'separator', id: 'more-s1' },
            ] satisfies MenuEntry[])
          : []),
        {
          kind: 'item',
          id: 'more-none',
          label: 'Select none',
          disabled: !selected || documentShown,
          onSelect: () => section && go(at(section)),
        },
        { kind: 'item', id: 'more-path', label: 'Copy as path', onSelect: () => copyPath(addressLocation) },
        { kind: 'separator', id: 'more-s2' },
        {
          kind: 'item',
          id: 'more-properties',
          label: 'Properties',
          shortcut: 'Alt+Enter',
          icon: <Fl icon={flInfo} />,
          onSelect: () => properties(selected),
        },
      ],
    });

  const itemMenu = (entry: Entry, point: { x: number; y: number }, invoker: HTMLElement | null) => {
    select(entry);
    shell.openMenu({
      label: `${entry.name} actions`,
      at: point,
      returnFocusTo: invoker,
      commands: [
        {
          id: 'copy-link',
          label: 'Copy link',
          icon: <Fl icon={flLink} />,
          onSelect: () => copyLink(entry),
        },
        { id: 'share', label: 'Share', icon: <Fl icon={flShare} />, onSelect: () => share(entry) },
      ],
      items: [
        {
          kind: 'item',
          id: 'open',
          label: 'Open',
          shortcut: 'Enter',
          icon: <Fl icon={flOpen} />,
          onSelect: () => openEntry(entry),
        },
        {
          kind: 'item',
          id: 'new-window',
          label: 'Open in new window',
          icon: <Fl icon={flWindowNew} />,
          disabled: true,
          onSelect: () => undefined,
        },
        { kind: 'separator', id: 's1' },
        {
          kind: 'item',
          id: 'properties',
          label: 'Properties',
          shortcut: 'Alt+Enter',
          icon: <Fl icon={flInfo} />,
          onSelect: () => properties(entry),
        },
      ],
      legacy: [
        { kind: 'item', id: 'l-open', label: 'Open', onSelect: () => openEntry(entry) },
        { kind: 'item', id: 'l-path', label: 'Copy as path', onSelect: () => copyPath(entry.location) },
        { kind: 'separator', id: 'l-s' },
        { kind: 'item', id: 'l-properties', label: 'Properties', onSelect: () => properties(entry) },
      ],
    });
  };

  const backgroundMenu = (point: { x: number; y: number }) =>
    shell.openMenu({
      label: folderName,
      at: point,
      returnFocusTo: root.current?.querySelector<HTMLElement>('[data-exp-item][tabindex="0"]') ?? null,
      items: [
        { kind: 'submenu', id: 'bg-view', label: 'View', icon: <Fl icon={flView} />, items: viewEntriesMenu() },
        { kind: 'submenu', id: 'bg-sort', label: 'Sort by', icon: <Fl icon={flSort} />, items: sortEntriesMenu() },
        { kind: 'separator', id: 'bg-s' },
        {
          kind: 'item',
          id: 'bg-properties',
          label: 'Properties',
          icon: <Fl icon={flInfo} />,
          onSelect: () => properties(null),
        },
      ],
      legacy: [
        { kind: 'item', id: 'bg-l-path', label: 'Copy as path', onSelect: () => copyPath(addressLocation) },
        { kind: 'separator', id: 'bg-l-s' },
        { kind: 'item', id: 'bg-l-properties', label: 'Properties', onSelect: () => properties(null) },
      ],
    });

  // --- Address bar ---------------------------------------------------------------------------------------------------
  const startEdit = (text = formatExplorerPath(addressLocation)) => {
    setDraft(text);
    setError(null);
    setEditing(true);
    focusSoon('edit');
  };
  const cancelEdit = (refocus: boolean) => {
    setEditing(false);
    setError(null);
    if (refocus) focusSoon('address');
  };
  const commitEdit = () => {
    const text = draft.trim();
    if (!text) {
      cancelEdit(true);
      return;
    }
    const result = parseExplorerPath(text, addressLocation);
    if (!result.ok) {
      setError(result.error);
      editRef.current?.select();
      return;
    }
    setEditing(false);
    setError(null);
    const target = result.location;
    const targetPlace = explorerPlace(target);
    const own = target.kind === 'root' || targetPlace.folder !== 'home';
    if (!own) {
      // A shortcut: the kernel hands it to its app (Projects → GitHub, Résumé → Edge).
      go(target);
      return;
    }
    // A typed file path opens the file (as Windows does); a folder path shows the folder.
    if (targetPlace.slug) {
      openAt(target, targetPlace.slug);
      return;
    }
    if (!sameLocation(target, location)) go(target);
    focusSoon('content', (now) => sameLocation(now, target));
  };

  const crumbMenu = (kind: 'home' | 'files', anchor: HTMLElement) => {
    const items: MenuEntry[] =
      kind === 'home'
        ? [
            ...(['experience', 'education'] as const).map((target): MenuEntry => ({
              kind: 'item',
              id: `crumb-${target}`,
              label: FOLDER_TITLES[target],
              icon: <AssetIcon id="system.windows-folder" size={16} />,
              onSelect: () => openFolder(target),
            })),
            {
              kind: 'item',
              id: 'crumb-projects',
              label: shortcutName('projects').stem,
              icon: <AssetIcon id="app.windows.github" size={16} />,
              onSelect: () => go({ kind: 'content', ref: { section: 'projects' } }),
            },
            {
              kind: 'item',
              id: 'crumb-resume',
              label: `${shortcutName('resume').stem}${shortcutName('resume').ext}`,
              icon: <PdfFile size={16} />,
              onSelect: () => go({ kind: 'content', ref: { section: 'resume' } }),
            },
            {
              kind: 'item',
              id: 'crumb-about',
              label: shortcutName('about').stem,
              icon: <AssetIcon id="app.windows.edge" size={16} />,
              onSelect: () => go({ kind: 'content', ref: { section: 'about' } }),
            },
          ]
        : all.map((entry): MenuEntry => ({
            kind: 'item',
            id: `crumb-file-${entry.slug}`,
            label: entry.name,
            icon: <DocFile size={16} />,
            onSelect: () => openEntry(entry),
          }));
    shell.openMenu({
      label: kind === 'home' ? 'Folders in Home' : `Files in ${folderName}`,
      at: below(anchor),
      items,
      returnFocusTo: anchor,
    });
  };

  // --- Keyboard shortcuts and pointer delegation (native listeners: the root is not itself a widget) ----------------
  const latest = useRef<{
    key: (event: globalThis.KeyboardEvent) => void;
    click: (event: globalThis.MouseEvent) => void;
    dblclick: (event: globalThis.MouseEvent) => void;
    menu: (event: globalThis.MouseEvent) => void;
  } | null>(null);
  useLayoutEffect(() => {
    const rowOf = (event: Event) => {
      const target = event.target as Element;
      if (!target.closest('[data-exp-list]') || target.closest('a, button, input, thead')) return undefined;
      const row = target.closest<HTMLElement>('[data-exp-row]');
      return row ? (all.find((entry) => entry.slug === row.dataset.expRow) ?? null) : null;
    };
    const focusItem = (entry: Entry) => itemFor(root.current, entry.slug)?.focus({ preventScroll: true });
    latest.current = {
      key: (event) => {
        const target = event.target as Element;
        const typing = target.closest('input, textarea');
        const code = event.code;
        if (event.altKey && !event.ctrlKey && event.key === 'ArrowUp') {
          event.preventDefault();
          up();
        } else if (
          (event.altKey && !event.shiftKey && code === 'KeyD') ||
          (event.ctrlKey && code === 'KeyL') ||
          event.key === 'F4'
        ) {
          event.preventDefault();
          startEdit();
        } else if ((event.ctrlKey && (code === 'KeyE' || code === 'KeyF')) || event.key === 'F3') {
          event.preventDefault();
          searchRef.current?.focus();
          searchRef.current?.select();
        } else if (event.altKey && event.key === 'Enter' && !typing) {
          event.preventDefault();
          properties(selected);
        } else if (event.altKey && event.shiftKey && code === 'KeyP' && !compact) {
          event.preventDefault();
          togglePane();
        } else if (
          event.ctrlKey &&
          event.shiftKey &&
          !typing &&
          (code === 'Digit2' || code === 'Digit6' || code === 'Digit7')
        ) {
          event.preventDefault();
          changeView(code === 'Digit2' ? 'icons' : code === 'Digit6' ? 'details' : 'tiles');
        } else if (event.key === 'Escape' && target.closest('[data-exp-document]')) {
          event.preventDefault();
          event.stopPropagation();
          closeDocument();
        }
      },
      click: (event) => {
        if (event.button !== 0) return;
        const entry = rowOf(event);
        if (entry === undefined) return;
        if (entry === null) {
          // Empty space in the list: Windows clears the selection.
          if (selected && section && !documentShown) go(at(section));
          return;
        }
        focusItem(entry);
        if (coarse || compact) openEntry(entry);
        else select(entry);
      },
      dblclick: (event) => {
        const entry = rowOf(event);
        if (entry) openEntry(entry);
      },
      menu: (event) => {
        const entry = rowOf(event);
        if (entry === undefined || (entry === null && !section)) return;
        event.preventDefault();
        const point = { x: event.clientX, y: event.clientY };
        if (entry) {
          focusItem(entry);
          itemMenu(entry, point, itemFor(root.current, entry.slug));
        } else backgroundMenu(point);
      },
    };
  });
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const lifecycle = new AbortController();
    const { signal } = lifecycle;
    el.addEventListener('keydown', (event) => latest.current?.key(event), { signal });
    el.addEventListener('click', (event) => latest.current?.click(event), { signal });
    el.addEventListener('dblclick', (event) => latest.current?.dblclick(event), { signal });
    el.addEventListener('contextmenu', (event) => latest.current?.menu(event), { signal });
    return () => lifecycle.abort();
  }, []);

  /** Arrow keys / Home / End / type-ahead move the selection with the focus (Windows list behaviour). */
  const markMove = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (/^(Arrow(Up|Down|Left|Right)|Home|End)$/.test(event.key) || (event.key.length === 1 && event.key !== ' ')) {
      arrowMove.current = true;
      queueMicrotask(() => {
        arrowMove.current = false;
      });
    }
  };
  const itemProps: ItemHandlers = {
    coarse,
    compact,
    onSelect: select,
    onOpen: openEntry,
    onMenu: itemMenu,
    onFocusMove: (entry) => {
      if (!arrowMove.current) return;
      arrowMove.current = false;
      select(entry);
    },
  };

  // --- Layout --------------------------------------------------------------------------------------------------------
  const count = level === 'home' ? homeCount(q) : entries.length;
  const tabIcon =
    folder === 'home' ? (
      <Fl icon={flHomeFilled} size={16} />
    ) : (
      <AssetIcon id="system.windows-folder" size={16} priority />
    );

  return (
    <>
      <TitleBar tall>
        <div className={styles.tabs} data-compact={compact || undefined}>
          {compact && upTarget ? (
            <button
              type="button"
              className={styles.titleBack}
              aria-label={`Back to ${upName}`}
              title={`Back to ${upName}`}
              onClick={up}
            >
              <Fl icon={flArrowLeft} size={16} />
            </button>
          ) : null}
          <div className={styles.tab}>
            <span className={styles.tabIcon} aria-hidden="true">
              {tabIcon}
            </span>
            <span className={styles.tabLabel}>{folderName}</span>
            <button
              type="button"
              className={styles.tabClose}
              aria-label="Close tab"
              title="Close tab"
              onClick={() => dispatchSoon({ type: 'CLOSE_WINDOW', id: window.id })}
            >
              <Fl icon={flDismiss} size={12} />
            </button>
          </div>
          <button
            type="button"
            className={styles.newTab}
            aria-label="New tab"
            aria-disabled="true"
            tabIndex={-1}
            title="New tab isn't available here"
          >
            <Fl icon={flAdd} size={16} />
          </button>
        </div>
      </TitleBar>

      <div
        ref={root}
        className={styles.explorer}
        data-compact={compact || undefined}
        data-level={level}
        data-view={view}
        data-coarse={coarse || undefined}
      >
        <div className={styles.addressRow}>
          {compact ? null : (
            <div className={styles.navButtons}>
              <button
                type="button"
                className={styles.iconButton}
                aria-label="Back"
                title="Back (Alt+Left arrow)"
                disabled={!canBack}
                onClick={() => step('APP_BACK')}
              >
                <Fl icon={flArrowLeft} size={16} />
              </button>
              <button
                type="button"
                className={styles.iconButton}
                aria-label="Forward"
                title="Forward (Alt+Right arrow)"
                disabled={!canForward}
                onClick={() => step('APP_FORWARD')}
              >
                <Fl icon={flArrowRight} size={16} />
              </button>
              <button
                type="button"
                className={styles.iconButton}
                aria-label={upTarget ? `Up to ${upName}` : 'Up'}
                title={upTarget ? `Up to "${upName}" (Alt+Up arrow)` : 'Up'}
                disabled={!upTarget}
                onClick={up}
              >
                <Fl icon={flArrowUp} size={16} />
              </button>
            </div>
          )}

          <div className={styles.address} data-editing={editing || undefined}>
            {editing ? (
              <>
                <input
                  ref={editRef}
                  className={styles.addressInput}
                  type="text"
                  aria-label="Address"
                  value={draft}
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${ids}-address-error` : undefined}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitEdit();
                    } else if (event.key === 'Escape') {
                      event.preventDefault();
                      event.stopPropagation();
                      cancelEdit(true);
                    }
                  }}
                  onBlur={() => cancelEdit(false)}
                />
                {error ? (
                  <p id={`${ids}-address-error`} className={styles.addressError} role="alert">
                    <Fl icon={flError} size={16} className={styles.errorGlyph} />
                    <span>{error}</span>
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <nav aria-label="Address" className={styles.crumbs}>
                  <ol role="list" className={styles.crumbList}>
                    <Crumb
                      label={FOLDER_TITLES.home}
                      target={ROOT}
                      current={level === 'home'}
                      onGo={() => openFolder(null)}
                      menu={{ label: 'Folders in Home', open: (el) => crumbMenu('home', el) }}
                    />
                    {section ? (
                      <Crumb
                        label={folderName}
                        target={at(section)}
                        current={level === 'folder'}
                        onGo={() => openFolder(section)}
                        menu={
                          documentShown
                            ? { label: `Files in ${folderName}`, open: (el) => crumbMenu('files', el) }
                            : null
                        }
                      />
                    ) : null}
                    {documentShown && selected ? (
                      <Crumb
                        label={selected.name}
                        target={selected.location}
                        current
                        onGo={() => undefined}
                        menu={null}
                      />
                    ) : null}
                  </ol>
                </nav>
                <button
                  ref={editButton}
                  type="button"
                  className={styles.editArea}
                  aria-label="Edit address"
                  title={formatExplorerPath(addressLocation)}
                  onClick={() => startEdit()}
                />
              </>
            )}
          </div>

          <div className={styles.search}>
            <input
              ref={searchRef}
              className={styles.searchInput}
              type="search"
              aria-label={`Search ${folderName}`}
              placeholder={`Search ${folderName}`}
              value={query}
              autoComplete="off"
              onChange={(event) => {
                setQuery(event.target.value);
                if (documentShown && !compact) setOpened(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  shell.openSearch({ query: query.trim() || undefined, invoker: event.currentTarget });
                } else if (event.key === 'Escape' && query) {
                  event.preventDefault();
                  event.stopPropagation();
                  setQuery('');
                }
              }}
            />
            <Fl icon={flSearch} size={16} className={styles.searchGlyph} />
          </div>

          {compact ? (
            <button
              type="button"
              className={styles.iconButton}
              aria-label="See more"
              aria-haspopup="menu"
              title="See more"
              onClick={(event) => openMoreMenu(event.currentTarget)}
            >
              <Fl icon={flMore} size={16} />
            </button>
          ) : null}
        </div>

        {compact ? null : (
          <RovingGroup
            as="div"
            role="toolbar"
            aria-label="Command bar"
            orientation="horizontal"
            className={styles.commandBar}
          >
            <Command icon={flAdd} label="New" menu disabled title="New isn't available here" />
            <span className={styles.commandSep} aria-hidden="true" />
            <Command icon={flCut} label="Cut" iconOnly disabled title="Cut (Ctrl+X)" />
            <Command icon={flCopy} label="Copy" iconOnly disabled title="Copy (Ctrl+C)" />
            <Command icon={flPaste} label="Paste" iconOnly disabled title="Paste (Ctrl+V)" />
            <span className={styles.commandSep} aria-hidden="true" />
            <Command icon={flLink} label="Copy link" disabled={!currentRef} onPress={() => copyLink(null)} />
            <Command icon={flShare} label="Share" disabled={!currentRef} onPress={() => share(null)} />
            <span className={styles.commandSep} aria-hidden="true" />
            <Command icon={flSort} label="Sort" menu disabled={!section || documentShown} onPress={openSortMenu} />
            <Command icon={flView} label="View" menu onPress={openViewMenu} />
            <span className={styles.commandSep} aria-hidden="true" />
            <Command icon={flMore} label="See more" iconOnly menu onPress={openMoreMenu} />
            <span className={styles.commandSpacer} />
            <Command
              icon={flPanelRight}
              label="Details"
              pressed={pane}
              title="Details pane (Alt+Shift+P)"
              onPress={() => togglePane()}
            />
          </RovingGroup>
        )}

        <div className={styles.main}>
          {!compact || level === 'home' ? (
            <NavPane compact={compact} folder={folder} onFolder={(target) => openFolder(target, compact)} />
          ) : null}

          {compact && level === 'home' ? null : (
            <div className={styles.content}>
              {missing || stale ? (
                <div className={styles.infoBar} role="status">
                  <Fl icon={flInfoFilled} size={16} className={styles.infoGlyph} />
                  <p className={styles.infoText}>That item is no longer available</p>
                  <button
                    type="button"
                    className={styles.infoClose}
                    aria-label="Dismiss"
                    onClick={() => {
                      setMissing(false);
                      focusSoon('content');
                    }}
                  >
                    <Fl icon={flDismiss} size={12} />
                  </button>
                </div>
              ) : null}

              {documentShown && selected && section ? (
                <DocumentView
                  ref={documentRef}
                  entry={selected}
                  section={section}
                  compact={compact}
                  onBack={closeDocument}
                />
              ) : (
                <div ref={listRef} className={styles.list} data-exp-list="">
                  {level === 'home' ? (
                    <HomePage
                      ids={ids}
                      query={q}
                      expanded={expanded}
                      onToggle={(key) => setExpanded((value) => ({ ...value, [key]: !value[key] }))}
                      onFolder={(target) => openFolder(target, true)}
                      onRole={(roleSlug) => openAt(at('experience', roleSlug), roleSlug)}
                    />
                  ) : view === 'details' || compact ? (
                    <RovingGroup as="div" orientation="vertical" className={styles.tableWrap} onKeyDown={markMove}>
                      <table className={styles.table} aria-label={folderName}>
                        <thead>
                          <tr>
                            {columns.map((column) => {
                              const sorted = sort.key === column.key;
                              return (
                                <th
                                  key={column.key}
                                  scope="col"
                                  className={`${styles.th} ${styles[`col-${column.key}`]}`}
                                  aria-sort={sorted ? sort.dir : undefined}
                                >
                                  <button
                                    type="button"
                                    className={styles.headerButton}
                                    onClick={() => sortBy(column.key)}
                                  >
                                    {column.label}
                                    {sorted ? (
                                      <Fl
                                        icon={sort.dir === 'ascending' ? flChevronUp : flChevronDown}
                                        size={10}
                                        className={styles.sortGlyph}
                                      />
                                    ) : null}
                                  </button>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {entries.map((entry) => (
                            <DetailsRow
                              key={entry.slug}
                              entry={entry}
                              columns={columns}
                              selected={entry.slug === slug}
                              {...itemProps}
                            />
                          ))}
                          {entries.length === 0 ? (
                            <tr>
                              <td colSpan={columns.length} className={styles.empty}>
                                {q ? 'No items match your search.' : 'This folder is empty.'}
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </RovingGroup>
                  ) : (
                    <>
                      <RovingGroup
                        as="ul"
                        role="list"
                        orientation="grid"
                        aria-label={folderName}
                        className={view === 'tiles' ? styles.tiles : styles.icons}
                        onKeyDown={markMove}
                      >
                        {entries.map((entry) => (
                          <GridItem
                            key={entry.slug}
                            entry={entry}
                            view={view}
                            selected={entry.slug === slug}
                            {...itemProps}
                          />
                        ))}
                      </RovingGroup>
                      {entries.length === 0 ? (
                        <p className={styles.emptyNote}>
                          {q ? 'No items match your search.' : 'This folder is empty.'}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {pane && !compact && !documentShown ? (
            <DetailsPane folder={folder} selected={selected} count={count} />
          ) : null}
        </div>

        <div className={styles.status}>
          <span>
            {count} {count === 1 ? 'item' : 'items'}
          </span>
          {selected ? (
            <>
              <span className={styles.statusSep} aria-hidden="true" />
              <span>1 item selected</span>
            </>
          ) : null}
          <span className={styles.statusSpacer} />
          {!compact && level === 'folder' ? (
            <div className={styles.statusViews} role="group" aria-label="Layout">
              <button
                type="button"
                className={styles.statusButton}
                aria-label="Details"
                aria-pressed={view === 'details'}
                title="Show items in a list with details (Ctrl+Shift+6)"
                onClick={() => changeView('details')}
              >
                <Fl icon={flList} size={16} />
              </button>
              <button
                type="button"
                className={styles.statusButton}
                aria-label="Large icons"
                aria-pressed={view === 'icons'}
                title="Display items using large thumbnails (Ctrl+Shift+2)"
                onClick={() => changeView('icons')}
              >
                <Fl icon={flView} size={16} />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

// --- Command bar -----------------------------------------------------------------------------------------------------

function Command({
  icon,
  label,
  iconOnly = false,
  menu = false,
  disabled = false,
  pressed,
  title,
  onPress,
}: {
  readonly icon: Glyph;
  readonly label: string;
  readonly iconOnly?: boolean;
  readonly menu?: boolean;
  readonly disabled?: boolean;
  readonly pressed?: boolean;
  readonly title?: string;
  readonly onPress?: (el: HTMLButtonElement) => void;
}) {
  return (
    <button
      type="button"
      className={styles.command}
      data-icon-only={iconOnly || undefined}
      data-roving-item={disabled ? undefined : ''}
      aria-label={iconOnly ? label : undefined}
      aria-disabled={disabled || undefined}
      aria-haspopup={menu && !disabled ? 'menu' : undefined}
      aria-pressed={pressed}
      tabIndex={disabled ? -1 : undefined}
      title={title ?? label}
      onClick={(event) => {
        if (!disabled) onPress?.(event.currentTarget);
      }}
    >
      <Fl icon={icon} size={16} className={styles.commandGlyph} />
      {iconOnly ? null : <span>{label}</span>}
      {menu ? <Fl icon={flChevronDown} size={10} className={styles.commandChevron} /> : null}
    </button>
  );
}

// --- Breadcrumb ------------------------------------------------------------------------------------------------------

function Crumb({
  label,
  target,
  current,
  onGo,
  menu,
}: {
  readonly label: string;
  readonly target: AppLocation;
  readonly current: boolean;
  readonly onGo: () => void;
  readonly menu: { readonly label: string; readonly open: (el: HTMLElement) => void } | null;
}) {
  return (
    <li className={styles.crumbItem}>
      <a
        href={hrefFor({ os: 'windows', role: 'files', location: target })}
        className={styles.crumb}
        aria-current={current ? 'page' : undefined}
        onClick={(event) => {
          if (!plainClick(event)) return;
          event.preventDefault();
          if (!current) onGo();
        }}
      >
        {label}
      </a>
      {menu ? (
        <button
          type="button"
          className={styles.crumbChevron}
          aria-label={menu.label}
          aria-haspopup="menu"
          title={menu.label}
          onClick={(event) => menu.open(event.currentTarget)}
        >
          <Fl icon={flChevronRight} size={10} />
        </button>
      ) : null}
    </li>
  );
}

// --- Navigation pane -------------------------------------------------------------------------------------------------

function NavPane({
  compact,
  folder,
  onFolder,
}: {
  readonly compact: boolean;
  readonly folder: ExplorerFolder;
  readonly onFolder: (target: ExplorerSection | null) => void;
}) {
  const folderLink = (target: ExplorerSection | null, icon: ReactNode) => {
    const key = target ?? 'home';
    const current = folder === key;
    return (
      <li key={key}>
        <a
          href={hrefFor({ os: 'windows', role: 'files', location: at(target ?? undefined) })}
          className={styles.navItem}
          data-roving-item=""
          aria-current={current ? 'page' : undefined}
          onClick={(event) => {
            if (!plainClick(event)) return;
            event.preventDefault();
            onFolder(target);
          }}
        >
          <span className={styles.navIcon} aria-hidden="true">
            {icon}
          </span>
          <span className={styles.navLabel}>{FOLDER_TITLES[key]}</span>
        </a>
      </li>
    );
  };
  const folderIcon = <AssetIcon id="system.windows-folder" size={compact ? 24 : 16} priority />;
  return (
    <nav className={styles.nav} aria-label="Navigation pane" data-exp-nav="">
      <RovingGroup as="ul" role="list" orientation="vertical" className={styles.navList}>
        {compact ? null : folderLink(null, <Fl icon={folder === 'home' ? flHomeFilled : flHome} size={16} />)}
        {compact ? null : <li className={styles.navSep} aria-hidden="true" />}
        {folderLink('experience', folderIcon)}
        {folderLink('education', folderIcon)}
        <li>
          <KernelLink
            to={{ os: 'windows', ref: { section: 'projects' } }}
            className={styles.navItem}
            data-roving-item=""
          >
            <span className={styles.navIcon} aria-hidden="true">
              <AssetIcon id="app.windows.github" size={compact ? 24 : 16} />
            </span>
            <span className={styles.navLabel}>{shortcutName('projects').stem}</span>
          </KernelLink>
        </li>
        <li>
          <KernelLink to={{ os: 'windows', ref: { section: 'resume' } }} className={styles.navItem} data-roving-item="">
            <span className={styles.navIcon} aria-hidden="true">
              <PdfFile size={compact ? 24 : 16} />
            </span>
            <span className={styles.navLabel}>{shortcutName('resume').stem}</span>
          </KernelLink>
        </li>
        {compact ? null : <li className={styles.navSep} aria-hidden="true" />}
        {compact ? null : (
          <li>
            <a
              href={hrefFor({ os: 'windows', role: 'files', location: ROOT })}
              className={styles.navItem}
              data-roving-item=""
              onClick={(event) => {
                if (!plainClick(event)) return;
                event.preventDefault();
                onFolder(null);
              }}
            >
              <span className={styles.navIcon} aria-hidden="true">
                <AssetIcon id="system.windows-this-pc" size={16} />
              </span>
              <span className={styles.navLabel}>This PC</span>
            </a>
          </li>
        )}
      </RovingGroup>
    </nav>
  );
}

// --- Items -----------------------------------------------------------------------------------------------------------

interface ItemHandlers {
  readonly coarse: boolean;
  readonly compact: boolean;
  readonly onSelect: (entry: Entry) => void;
  readonly onOpen: (entry: Entry) => void;
  readonly onMenu: (entry: Entry, at: { x: number; y: number }, invoker: HTMLElement | null) => void;
  readonly onFocusMove: (entry: Entry) => void;
}

/**
 * One item's link: a real link to the item's URL. Click selects (a touch tap, a keyboard click or compact opens),
 * double-click / Enter opens, Space selects, right-click / long-press / Shift+F10 opens the item's menu.
 */
function useItemLink(entry: Entry, handlers: ItemHandlers) {
  const link = useRef<HTMLAnchorElement>(null);
  const press = usePress({
    onLongPress: (origin, point) => {
      const box = link.current?.getBoundingClientRect();
      const at = origin === 'keyboard' && box ? { x: box.left + 24, y: box.top + box.height / 2 } : point;
      handlers.onMenu(entry, at, link.current);
    },
  });
  return {
    ref: link,
    href: hrefFor({ os: 'windows', role: 'files', location: entry.location }),
    'data-exp-item': entry.slug,
    'data-roving-item': '',
    onPointerDown: press.onPointerDown,
    onPointerMove: press.onPointerMove,
    onPointerUp: press.onPointerUp,
    onPointerCancel: press.onPointerCancel,
    onContextMenu: press.onContextMenu,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      press.onClick(event);
      if (event.defaultPrevented || !plainClick(event)) return;
      event.preventDefault();
      if (event.detail === 0 || handlers.coarse || handlers.compact) handlers.onOpen(entry);
      else handlers.onSelect(entry);
    },
    onDoubleClick: (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      handlers.onOpen(entry);
    },
    onKeyDown: (event: KeyboardEvent<HTMLAnchorElement>) => {
      if (event.key === 'Enter' && !event.altKey) {
        event.preventDefault();
        handlers.onOpen(entry);
      } else if (event.key === ' ') {
        event.preventDefault();
        handlers.onSelect(entry);
      }
    },
    onFocus: () => handlers.onFocusMove(entry),
  };
}

function DetailsRow({
  entry,
  columns,
  selected,
  ...handlers
}: ItemHandlers & {
  readonly entry: Entry;
  readonly columns: readonly { key: ColumnKey; label: string }[];
  readonly selected: boolean;
}) {
  const link = useItemLink(entry, handlers);
  const sub = [entry.title, entry.dates].filter(Boolean).join(' · ');
  return (
    <tr className={styles.row} data-exp-row={entry.slug} data-selected={selected || undefined}>
      {columns.map((column) =>
        column.key === 'name' ? (
          <td key="name" className={`${styles.td} ${styles['col-name']}`}>
            <a {...link} className={styles.name} aria-current={selected ? 'true' : undefined}>
              <span className={styles.fileIcon} aria-hidden="true">
                <DocFile size={handlers.compact ? 32 : 20} />
              </span>
              <span className={styles.nameText}>
                <span className={styles.nameLine}>{entry.name}</span>
                {handlers.compact && sub ? <span className={styles.subLine}>{sub}</span> : null}
              </span>
            </a>
          </td>
        ) : (
          <td key={column.key} className={`${styles.td} ${styles[`col-${column.key}`]}`}>
            {entry[column.key]}
          </td>
        ),
      )}
    </tr>
  );
}

function GridItem({
  entry,
  view,
  selected,
  ...handlers
}: ItemHandlers & { readonly entry: Entry; readonly view: ViewMode; readonly selected: boolean }) {
  const link = useItemLink(entry, handlers);
  return (
    <li className={styles.gridCell} data-exp-row={entry.slug}>
      <a {...link} className={styles.gridItem} aria-current={selected ? 'true' : undefined}>
        <span className={styles.gridIcon} aria-hidden="true">
          <DocFile size={view === 'tiles' ? 48 : 72} />
        </span>
        <span className={styles.gridText}>
          <span className={styles.gridName}>{entry.name}</span>
          {view === 'tiles' && entry.title ? <span className={styles.gridMeta}>{entry.title}</span> : null}
          {view === 'tiles' && entry.dates ? <span className={styles.gridMeta}>{entry.dates}</span> : null}
        </span>
      </a>
    </li>
  );
}

// --- Home ------------------------------------------------------------------------------------------------------------

interface HomeData {
  readonly quick: readonly {
    readonly key: string;
    readonly label: string;
    readonly detail: string;
    readonly folder: ExplorerSection | null;
    readonly to: ContentRef | null;
  }[];
  readonly recent: readonly {
    readonly key: string;
    readonly label: string;
    readonly where: string;
    readonly kind: 'role' | 'project';
    readonly slug: string;
  }[];
}

/** Quick access (Experience, Education, Projects, Résumé) and Recent (the current role, the latest project). */
function homeData(): HomeData {
  const files = (section: ExplorerSection) => {
    const n = explorerFiles(section).length;
    return `${n} ${n === 1 ? 'file' : 'files'}`;
  };
  const role = getCurrentRole();
  // Newest year first; the selectors' order (featured first) breaks ties.
  const latest = [...getProjects()].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0];
  const recent: HomeData['recent'][number][] = [];
  if (role)
    recent.push({
      key: `role-${role.slug}`,
      label: explorerFileName('experience', role.slug) ?? role.company,
      where: formatExplorerPath(at('experience')),
      kind: 'role',
      slug: role.slug,
    });
  if (latest)
    recent.push({
      key: `project-${latest.slug}`,
      label: latest.name,
      where: 'GitHub',
      kind: 'project',
      slug: latest.slug,
    });
  return {
    quick: [
      {
        key: 'experience',
        label: FOLDER_TITLES.experience,
        detail: files('experience'),
        folder: 'experience',
        to: null,
      },
      { key: 'education', label: FOLDER_TITLES.education, detail: files('education'), folder: 'education', to: null },
      {
        key: 'projects',
        label: shortcutName('projects').stem,
        detail: 'Shortcut · GitHub',
        folder: null,
        to: { section: 'projects' },
      },
      {
        key: 'resume',
        label: `${shortcutName('resume').stem}${shortcutName('resume').ext}`,
        detail: `Updated ${formatUpdated(getResume().updated)}`,
        folder: null,
        to: { section: 'resume' },
      },
    ],
    recent,
  };
}

const homeMatches = (label: string, query: string) => !query || label.toLowerCase().includes(query);

function homeCount(query: string): number {
  const data = homeData();
  return (
    data.quick.filter((item) => homeMatches(item.label, query)).length +
    data.recent.filter((item) => homeMatches(item.label, query)).length
  );
}

function HomePage({
  ids,
  query,
  expanded,
  onToggle,
  onFolder,
  onRole,
}: {
  readonly ids: string;
  readonly query: string;
  readonly expanded: { readonly quick: boolean; readonly recent: boolean };
  readonly onToggle: (key: 'quick' | 'recent') => void;
  readonly onFolder: (folder: ExplorerSection) => void;
  readonly onRole: (slug: string) => void;
}) {
  const data = homeData();
  const quick = data.quick.filter((item) => homeMatches(item.label, query));
  const recent = data.recent.filter((item) => homeMatches(item.label, query));
  const heading = (key: 'quick' | 'recent', label: string) => (
    <h3 id={`${ids}-${key}`} className={styles.expanderHeading}>
      <button
        type="button"
        className={styles.expander}
        aria-expanded={expanded[key]}
        aria-controls={`${ids}-${key}-body`}
        onClick={() => onToggle(key)}
      >
        <Fl icon={expanded[key] ? flChevronDown : flChevronRight} size={12} className={styles.expanderGlyph} />
        {label}
      </button>
    </h3>
  );
  return (
    <div className={styles.home} data-exp-home="">
      <section className={styles.homeSection} aria-labelledby={`${ids}-quick`}>
        {heading('quick', 'Quick access')}
        {expanded.quick ? (
          <RovingGroup as="ul" role="list" orientation="grid" id={`${ids}-quick-body`} className={styles.quick}>
            {quick.map((item) => {
              const icon =
                item.key === 'resume' ? (
                  <PdfFile size={40} />
                ) : item.key === 'projects' ? (
                  <span className={styles.shortcutIcon}>
                    <AssetIcon id="app.windows.github" size={40} />
                    <span className={styles.shortcutArrow}>
                      <ShortcutArrow size={14} />
                    </span>
                  </span>
                ) : (
                  <AssetIcon id="system.windows-folder" size={48} priority />
                );
              const body = (
                <>
                  <span className={styles.quickIcon} aria-hidden="true">
                    {icon}
                  </span>
                  <span className={styles.quickText}>
                    <span className={styles.quickName}>{item.label}</span>
                    <span className={styles.quickDetail}>
                      {item.folder ? <Fl icon={flPin} size={12} className={styles.pinGlyph} /> : null}
                      {item.detail}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={item.key}>
                  {item.folder ? (
                    <a
                      href={hrefFor({ os: 'windows', role: 'files', location: at(item.folder) })}
                      className={styles.quickItem}
                      data-roving-item=""
                      onClick={(event) => {
                        if (!plainClick(event)) return;
                        event.preventDefault();
                        onFolder(item.folder!);
                      }}
                    >
                      {body}
                    </a>
                  ) : (
                    <KernelLink to={{ os: 'windows', ref: item.to! }} className={styles.quickItem} data-roving-item="">
                      {body}
                    </KernelLink>
                  )}
                </li>
              );
            })}
          </RovingGroup>
        ) : null}
      </section>

      <section className={styles.homeSection} aria-labelledby={`${ids}-recent`}>
        {heading('recent', 'Recent')}
        {expanded.recent ? (
          <div id={`${ids}-recent-body`}>
            <table className={`${styles.table} ${styles.recentTable}`} aria-labelledby={`${ids}-recent`}>
              <thead>
                <tr>
                  <th scope="col" className={`${styles.th} ${styles['col-name']}`}>
                    <span className={styles.headerLabel}>Name</span>
                  </th>
                  <th scope="col" className={`${styles.th} ${styles['col-where']}`}>
                    <span className={styles.headerLabel}>File location</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {recent.map((item) => (
                  <tr key={item.key} className={styles.row}>
                    <td className={`${styles.td} ${styles['col-name']}`}>
                      {item.kind === 'role' ? (
                        <a
                          href={hrefFor({ os: 'windows', role: 'files', location: at('experience', item.slug) })}
                          className={styles.name}
                          onClick={(event) => {
                            if (!plainClick(event)) return;
                            event.preventDefault();
                            onRole(item.slug);
                          }}
                        >
                          <span className={styles.fileIcon} aria-hidden="true">
                            <DocFile size={20} />
                          </span>
                          <span className={styles.nameText}>
                            <span className={styles.nameLine}>{item.label}</span>
                          </span>
                        </a>
                      ) : (
                        <KernelLink
                          to={{ os: 'windows', ref: { section: 'projects', slug: item.slug } as ContentRef }}
                          className={styles.name}
                        >
                          <span className={styles.fileIcon} aria-hidden="true">
                            <AssetIcon id="app.windows.github" size={20} />
                          </span>
                          <span className={styles.nameText}>
                            <span className={styles.nameLine}>{item.label}</span>
                          </span>
                        </KernelLink>
                      )}
                    </td>
                    <td className={`${styles.td} ${styles['col-where']}`}>{item.where}</td>
                  </tr>
                ))}
                {recent.length === 0 ? (
                  <tr>
                    <td colSpan={2} className={styles.empty}>
                      {query ? 'No items match your search.' : 'No recent files.'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}

// --- Details pane ----------------------------------------------------------------------------------------------------

function DetailsPane({
  folder,
  selected,
  count,
}: {
  readonly folder: ExplorerFolder;
  readonly selected: Entry | null;
  readonly count: number;
}) {
  const role = selected && folder === 'experience' ? getExperienceEntry(selected.slug as ExperienceSlug) : undefined;
  const school = selected && folder === 'education' ? getEducationEntry(selected.slug as EducationSlug) : undefined;
  return (
    <aside
      className={styles.pane}
      aria-label="Details pane"
      // A scrollable pane must be a tab stop so keyboard users can scroll it (WCAG 2.1.1, axe
      // scrollable-region-focusable) — the one case jsx-a11y's non-interactive rule does not model.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
    >
      {selected ? (
        <>
          <div className={styles.paneHeader}>
            <DocFile size={64} />
            <p className={styles.paneName}>{selected.name}</p>
            <p className={styles.paneType}>DOCX File</p>
          </div>
          <div className={styles.paneBody}>
            {role ? <ExperienceDetail data={role} density="compact" headingLevel={3} slots={WIN_SLOTS} /> : null}
            {school ? <EducationDetail data={school} density="compact" headingLevel={3} slots={WIN_SLOTS} /> : null}
          </div>
        </>
      ) : folder === 'home' ? (
        <p className={styles.paneHint}>Select a single file to get more information.</p>
      ) : (
        <div className={styles.paneHeader}>
          <AssetIcon id="system.windows-folder" size={64} />
          <p className={styles.paneName}>{FOLDER_TITLES[folder]}</p>
          <p className={styles.paneType}>
            {count} {count === 1 ? 'item' : 'items'}
          </p>
        </div>
      )}
    </aside>
  );
}

// --- Document view ---------------------------------------------------------------------------------------------------

function DocumentView({
  ref,
  entry,
  section,
  compact,
  onBack,
}: {
  readonly ref: Ref<HTMLElement>;
  readonly entry: Entry;
  readonly section: ExplorerSection;
  readonly compact: boolean;
  readonly onBack: () => void;
}) {
  const role = section === 'experience' ? getExperienceEntry(entry.slug as ExperienceSlug) : undefined;
  const school = section === 'education' ? getEducationEntry(entry.slug as EducationSlug) : undefined;
  return (
    <section
      ref={ref}
      className={styles.document}
      aria-label={entry.name}
      // A scrollable document must be a tab stop so keyboard users can scroll it (WCAG 2.1.1, axe
      // scrollable-region-focusable) — the one case jsx-a11y's non-interactive rule does not model.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      data-exp-document=""
    >
      <div className={styles.docBar}>
        {compact ? null : (
          <button type="button" className={styles.backToFolder} onClick={onBack} title="Back to folder (Esc)">
            <Fl icon={flArrowLeft} size={16} />
            <span>Back to folder</span>
          </button>
        )}
        <span className={styles.docName}>
          <DocFile size={16} />
          <span>{entry.name}</span>
        </span>
      </div>
      <div className={styles.sheet}>
        {role ? <ExperienceDetail data={role} headingLevel={3} slots={WIN_SLOTS} /> : null}
        {school ? <EducationDetail data={school} headingLevel={3} slots={WIN_SLOTS} /> : null}
      </div>
    </section>
  );
}
