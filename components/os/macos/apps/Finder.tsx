'use client';
/**
 * Finder — plans/macos/apps/finder.md (`MAC-FIND-01/02/03/07`). Experience and education exist as folders and files:
 *   sidebar (Favourites) · the real unified toolbar (traffic lights over the sidebar, Back/Forward, folder title) ·
 *   column view: the home folder · the folder's entries · a preview column. Everything comes from `data/selectors`
 *   and the shared content views; nothing about the career is typed here.
 *   · select (click, or arrows) → the preview column updates and the URL follows (`go`, via NAVIGATE_IN_APP);
 *   · open (double-click / Enter / the preview's Open) → the document view: the full `ExperienceDetail` in this window;
 *   · Back/Forward are the window's own nav stack, which the kernel keeps aligned with browser Back (`MAC-FIND-03`);
 *   · compact: the same DOM becomes a drill-down — the sidebar is the first level, a folder the second, a file opens as
 *     the document — with a back chevron and 44 px rows (`MAC-FIND-07`).
 * Columns are lists of links with one tab stop each (roving): Up/Down select, Right/Enter drill in, Left goes back.
 * P3 (`MAC-FIND-04/05/06/08/09`): View as Icons · List (a real sortable table, `aria-sort`) · Columns (default), kept for
 * the session; Space opens Quick Look on the selected item (a modal sheet; Space / Esc closes, focus returns); the home
 * folder's aliases open their apps (Projects → GitHub, Résumé.pdf → Preview, About Jaswanth → Safari); the menu bar's
 * File / View / Go commands act here; a path bar and a status bar ("N items") can be shown or hidden.
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { EducationDetail, ExperienceDetail, formatPeriod } from '@/components/content';
import type { Education, Experience } from '@/data/schema';
import { RovingGroup } from '@/components/primitives/RovingGroup';
import { KernelLink, hrefFor } from '@/components/shell/KernelLink';
import type { ContentRef } from '@/data/schema';
import { getEducation, getEducationEntry, getExperience, getExperienceEntry } from '@/data/selectors';
import type { EducationSlug, ExperienceSlug } from '@/data/content-index';
import { currentLocation } from '@/lib/kernel/state';
import type { AppLocation } from '@/lib/kernel/types';
import { afterQueued, dispatchSoon as dispatch } from '@/stores/kernel-store';
import { useAppCommands } from '../commands';
import { ColumnsGlyph, GridGlyph, ListGlyph } from '../glyphs';
import { ChevronLeft, ChevronRight, DocumentGlyph, DocumentIcon, FolderGlyph, FolderIcon, HomeGlyph } from '../icons';
import { runMacCommand } from '../run-command';
import { setAppState, useAppState } from '../ui';
import { FOLDER_TITLES, finderPlace, type FinderFolder } from '../model';
import { MAC_SLOTS } from '../slots';
import type { WindowBodyProps } from '../window/Window';
import styles from './finder.module.css';

type Section = Exclude<FinderFolder, 'home'>;

const at = (section?: Section, slug?: string): AppLocation =>
  section ? { kind: 'content', ref: (slug ? { section, slug } : { section }) as ContentRef } : { kind: 'root' };

interface Entry {
  readonly slug: string;
  readonly label: string;
}

/** The entries of a folder, from the selectors, labelled as Finder names them ("{Company} — {Role}"). */
function entriesOf(folder: FinderFolder): readonly Entry[] {
  if (folder === 'experience')
    return getExperience().map((role) => ({
      slug: role.slug,
      label: role.role ? `${role.company} — ${role.role}` : role.company,
    }));
  if (folder === 'education') return getEducation().map((school) => ({ slug: school.slug, label: school.school }));
  return [];
}

function Preview({ folder, slug, onOpen }: { folder: FinderFolder; slug: string | null; onOpen: () => void }) {
  if (folder === 'experience' && slug) {
    const role = getExperienceEntry(slug as ExperienceSlug);
    if (role) {
      const meta = [
        role.role ? role.company : null,
        role.client ? `for ${role.client}` : null,
        formatPeriod(role.start, role.end),
      ]
        .filter(Boolean)
        .join(' · ');
      return (
        <div className={styles.previewBody}>
          <h3 className={styles.previewTitle}>{role.role ?? role.company}</h3>
          {meta ? <p className={styles.dim}>{meta}</p> : null}
          <p className={styles.previewSummary}>{role.summary}</p>
          <ul className={styles.tags} aria-label="Stack">
            {role.stack.map((item) => (
              <li key={item} className={styles.tag}>
                {item}
              </li>
            ))}
          </ul>
          <p>
            <button type="button" className={styles.open} onClick={onOpen}>
              Open
            </button>
          </p>
        </div>
      );
    }
  }
  if (folder === 'education' && slug) {
    const school = getEducationEntry(slug as EducationSlug);
    if (school) {
      const meta = [school.school, formatPeriod(school.start, school.end)].filter(Boolean).join(' · ');
      return (
        <div className={styles.previewBody}>
          <h3 className={styles.previewTitle}>{school.degree}</h3>
          <p className={styles.dim}>{meta}</p>
          {school.notes.length > 0 ? (
            <ul className={styles.tags} aria-label="Coursework">
              {school.notes.map((note) => (
                <li key={note} className={styles.tag}>
                  {note}
                </li>
              ))}
            </ul>
          ) : null}
          <p>
            <button type="button" className={styles.open} onClick={onOpen}>
              Open
            </button>
          </p>
        </div>
      );
    }
  }
  const count = folder === 'home' ? HOME.length : entriesOf(folder).length;
  return (
    <div className={styles.folderInfo}>
      <FolderIcon size={72} />
      <h3 className={styles.previewTitle}>{FOLDER_TITLES[folder]}</h3>
      <p className={styles.dim}>
        Folder · {count} {count === 1 ? 'item' : 'items'}
      </p>
    </div>
  );
}

interface RowProps {
  readonly id?: string;
  /** What Quick Look shows for this row (files only; folders have none). */
  readonly look?: ContentRef;
  readonly column: 'home' | 'entries';
  readonly target: AppLocation;
  readonly selected: boolean;
  readonly kind: 'folder' | 'file';
  readonly compact: boolean;
  readonly children: ReactNode;
  readonly onSelect: (target: AppLocation) => void;
  /** Keyboard / double-click open: a folder drills in, a file opens its document. */
  readonly onOpen: () => void;
  /** Left arrow from an entry: back to the parent folder. */
  readonly onBack: () => void;
}

/** Rows that should select when the roving group moves focus onto them with an arrow key. */
const arrowTargets = new WeakSet<Element>();

/** A row in a column: a real link; select on click (and on arrow keys), open on double-click / Enter / Right. */
function FinderRow({
  id,
  look,
  column,
  target,
  selected,
  kind,
  compact,
  children,
  onSelect,
  onOpen,
  onBack,
}: RowProps) {
  return (
    <li>
      <a
        id={id}
        href={hrefFor({ os: 'macos', role: 'files', location: target })}
        className={styles.row}
        data-finder-row=""
        data-roving-item=""
        aria-current={selected ? 'true' : undefined}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          onSelect(target);
          if (compact) onOpen();
        }}
        onDoubleClick={onOpen}
        onFocus={(event) => {
          if (!arrowTargets.delete(event.currentTarget)) return;
          onSelect(target);
        }}
        onKeyDown={(event: KeyboardEvent<HTMLAnchorElement>) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            // The roving group moves focus to the neighbouring row during this event; that row's focus selects it.
            const rows = [
              ...(event.currentTarget.closest('ul')?.querySelectorAll<HTMLElement>('[data-finder-row]') ?? []),
            ];
            const next = rows[rows.indexOf(event.currentTarget) + (event.key === 'ArrowDown' ? 1 : -1)];
            if (next) arrowTargets.add(next);
          }
          if (event.key === 'Enter' || (event.key === 'ArrowRight' && kind === 'folder')) {
            event.preventDefault();
            onSelect(target);
            onOpen();
          }
          if (event.key === 'ArrowLeft' && column === 'entries') {
            event.preventDefault();
            onBack();
          }
          if (event.key === ' ' && look) {
            // Quick Look (MAC-FIND-05): the selected file in a sheet; focus returns to this row.
            event.preventDefault();
            onSelect(target);
            runMacCommand({ kind: 'quick-look', ref: look, origin: id ?? null });
          }
        }}
      >
        <span className={styles.rowIcon} aria-hidden="true">
          {kind === 'folder' ? <FolderIcon size={18} /> : <DocumentGlyph size={16} />}
        </span>
        <span className={styles.rowLabel}>{children}</span>
        {kind === 'folder' ? <ChevronRight size={12} className={styles.chevron} /> : null}
      </a>
    </li>
  );
}

/** The home folder's contents (the frame's second column). Projects is an alias that opens GitHub. */
const HOME = [
  { key: 'experience', label: FOLDER_TITLES.experience },
  { key: 'education', label: FOLDER_TITLES.education },
  { key: 'projects', label: 'Projects' },
  { key: 'resume', label: 'Résumé.pdf' },
  { key: 'about', label: 'About Jaswanth.webloc' },
] as const;

/** The home folder's aliases and the app each opens (`MAC-FIND-06`). */
const ALIASES: Readonly<Record<string, { ref: ContentRef; opens: string; kind: 'folder' | 'file' }>> = {
  projects: { ref: { section: 'projects' }, opens: 'GitHub', kind: 'folder' },
  resume: { ref: { section: 'resume' }, opens: 'Preview', kind: 'file' },
  about: { ref: { section: 'about' }, opens: 'Safari', kind: 'file' },
};

type View = 'icons' | 'list' | 'columns';
type SortKey = 'name' | 'detail' | 'dates' | 'place';

interface Item {
  readonly key: string;
  readonly label: string;
  readonly kind: 'folder' | 'file';
  readonly target: AppLocation | null;
  readonly alias?: ContentRef;
  readonly look?: ContentRef;
  readonly detail?: string;
  readonly dates?: string;
  /** Sortable date key (ISO-like, '' when unknown). */
  readonly sortDate?: string;
  readonly place?: string;
}

/** A folder's items for the Icons and List views (home: folders + aliases; a section: its files). */
function itemsOf(folder: FinderFolder): readonly Item[] {
  if (folder === 'home')
    return HOME.map((item) => {
      const alias = ALIASES[item.key];
      return alias
        ? {
            key: item.key,
            label: item.label,
            kind: alias.kind,
            target: null,
            alias: alias.ref,
            detail: `Alias — opens ${alias.opens}`,
          }
        : { key: item.key, label: item.label, kind: 'folder', target: at(item.key as Section), detail: 'Folder' };
    });
  if (folder === 'experience')
    return getExperience().map((role: Experience) => ({
      key: role.slug,
      label: role.role ? `${role.company} — ${role.role}` : role.company,
      kind: 'file' as const,
      target: at('experience', role.slug),
      look: { section: 'experience', slug: role.slug } as ContentRef,
      detail: role.role ?? '',
      dates: formatPeriod(role.start, role.end) ?? '',
      sortDate: role.start ?? '',
      place: role.location ?? '',
    }));
  return getEducation().map((school: Education) => ({
    key: school.slug,
    label: school.school,
    kind: 'file' as const,
    target: at('education', school.slug),
    look: { section: 'education', slug: school.slug } as ContentRef,
    detail: school.degree,
    dates: formatPeriod(school.start, school.end) ?? '',
    sortDate: school.start ?? '',
    place: '',
  }));
}

const COLUMNS: Readonly<Record<FinderFolder, readonly { key: SortKey; label: string }[]>> = {
  home: [
    { key: 'name', label: 'Name' },
    { key: 'detail', label: 'Kind' },
  ],
  experience: [
    { key: 'name', label: 'Name' },
    { key: 'detail', label: 'Role' },
    { key: 'dates', label: 'Dates' },
    { key: 'place', label: 'Location' },
  ],
  education: [
    { key: 'name', label: 'Name' },
    { key: 'detail', label: 'Degree' },
    { key: 'dates', label: 'Dates' },
  ],
};

const sortValue = (item: Item, key: SortKey) =>
  key === 'name'
    ? item.label
    : key === 'detail'
      ? (item.detail ?? '')
      : key === 'dates'
        ? (item.sortDate ?? '')
        : (item.place ?? '');

export function Finder({ window, titleId, compact }: WindowBodyProps) {
  const location = currentLocation(window);
  const { folder, slug } = finderPlace(location);
  const [opened, setOpened] = useState<string | null>(null);
  const appState = useAppState();
  const view: View = (appState['files:view'] as View | undefined) ?? 'columns';
  const pathBar = appState['files:pathBar'] !== false;
  const statusBar = appState['files:statusBar'] !== false;
  const [sort, setSort] = useState<{ key: SortKey; dir: 'ascending' | 'descending' }>({
    key: 'name',
    dir: 'ascending',
  });
  const root = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLElement>(null);
  // Compact: a file is always shown as its document (the drill-down's last level).
  const documentShown = slug !== null && (compact || opened === slug);
  const level = slug ? 'file' : folder === 'home' ? 'home' : 'folder';
  const canBack = window.nav.index > 0;
  const canForward = window.nav.index < window.nav.entries.length - 1;

  const go = (target: AppLocation) => dispatch({ type: 'NAVIGATE_IN_APP', id: window.id, location: target });
  const parent = (): AppLocation => (slug ? at(folder as Section) : at());

  /** Compact back chevron: up one level (collapsing into browser Back when the previous entry is that level). */
  const up = () => {
    const previous = window.nav.entries[window.nav.index - 1];
    const target = parent();
    const same =
      previous &&
      previous.kind === target.kind &&
      JSON.stringify(previous.kind === 'content' ? previous.ref : null) ===
        JSON.stringify(target.kind === 'content' ? target.ref : null);
    if (same) dispatch({ type: 'APP_BACK', id: window.id });
    else go(target);
    // The level being left disappears: land focus on where the visitor came from in the level above.
    afterQueued(() => {
      const home = target.kind === 'root';
      const selector = home ? 'nav [aria-current="true"]' : '[data-column="entries"] [aria-current="true"]';
      const fallback = home ? 'nav a' : '[data-column="entries"] [data-finder-row]';
      (root.current?.querySelector<HTMLElement>(selector) ?? root.current?.querySelector<HTMLElement>(fallback))?.focus(
        {
          preventScroll: true,
        },
      );
    });
  };

  // Focus moves within Finder's own lists once the press has committed and the new selection rendered.
  const focusRow = (column: string, index: 'first' | 'selected') => {
    afterQueued(() => {
      const list = root.current?.querySelector(`[data-column="${column}"]`);
      const row =
        (index === 'selected' && list?.querySelector<HTMLElement>('[aria-current="true"]')) ||
        list?.querySelector<HTMLElement>('[data-finder-row]');
      row?.focus({ preventScroll: true });
    });
  };

  const focusDocument = () =>
    afterQueued(() =>
      root.current?.querySelector<HTMLElement>('[data-finder-document]')?.focus({ preventScroll: true }),
    );
  const openDocument = (target: string) => {
    setOpened(target);
    focusDocument();
  };
  const closeDocument = () => {
    setOpened(null);
    focusRow('entries', 'selected');
  };
  const close = useRef(closeDocument);
  useLayoutEffect(() => {
    close.current = closeDocument;
  });
  // Esc inside the open document closes it (a native listener: the article is a document, not a widget).
  useEffect(() => {
    const node = documentRef.current;
    if (!node || compact) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      close.current();
    };
    node.addEventListener('keydown', onKey);
    return () => node.removeEventListener('keydown', onKey);
  }, [compact, slug]);

  /** Quick Look the selected file (File → Quick Look, Space). */
  const quickLook = () => {
    if (!slug || folder === 'home') return;
    runMacCommand({
      kind: 'quick-look',
      ref: { section: folder, slug } as ContentRef,
      origin: `finder-${folder}-${slug}`,
    });
  };

  useAppCommands('files', (command, arg) => {
    if (command === 'view' && (arg === 'icons' || arg === 'list' || arg === 'columns')) setAppState('files:view', arg);
    else if (command === 'toggle-path-bar') setAppState('files:pathBar', !pathBar);
    else if (command === 'toggle-status-bar') setAppState('files:statusBar', !statusBar);
    else if (command === 'back' && canBack) dispatch({ type: 'APP_BACK', id: window.id });
    else if (command === 'forward' && canForward) dispatch({ type: 'APP_FORWARD', id: window.id });
    else if (command === 'quick-look') quickLook();
    else if (command === 'get-info')
      runMacCommand({
        kind: 'get-info',
        ref: (folder === 'home'
          ? { section: 'experience' }
          : slug
            ? { section: folder, slug }
            : { section: folder }) as ContentRef,
      });
  });

  const entries = entriesOf(folder);
  const items = itemsOf(folder);
  const sorted = [...items].sort((a, b) => {
    const order = sortValue(a, sort.key).localeCompare(sortValue(b, sort.key), undefined, { numeric: true });
    return sort.dir === 'ascending' ? order : -order;
  });
  const flat = !compact && view !== 'columns';
  const openItem = (item: Item) => {
    if (item.alias) {
      runMacCommand({ kind: 'open-ref', ref: item.alias });
      return;
    }
    if (!item.target) return;
    if (item.kind === 'folder') go(item.target);
    else {
      go(item.target);
      openDocument(item.key);
    }
  };
  const itemSelected = (item: Item) => (item.kind === 'folder' ? false : slug === item.key);
  const sidebar = [
    { key: 'home', label: FOLDER_TITLES.home, icon: <HomeGlyph />, target: at() },
    { key: 'experience', label: FOLDER_TITLES.experience, icon: <FolderGlyph />, target: at('experience') },
    { key: 'education', label: FOLDER_TITLES.education, icon: <FolderGlyph />, target: at('education') },
  ] as const;

  return (
    <div
      ref={root}
      className={styles.finder}
      data-level={level}
      data-document={documentShown || undefined}
      data-view={flat ? view : undefined}
      data-body=""
    >
      <nav className={styles.sidebar} aria-label="Favourites">
        <div className={styles.sidebarDrag} data-drag-region="" />
        <p className={styles.sidebarHeading} aria-hidden="true">
          Favourites
        </p>
        <ul className={styles.sidebarList} role="list">
          {sidebar.map((item) => (
            <li key={item.key}>
              <a
                href={hrefFor({ os: 'macos', role: 'files', location: item.target })}
                className={styles.sidebarItem}
                aria-current={folder === item.key ? 'true' : undefined}
                onClick={(event) => {
                  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  go(item.target);
                  // Compact: the sidebar is the first level; opening a folder moves focus into it.
                  if (compact && item.key !== 'home') focusRow('entries', 'first');
                }}
              >
                <span className={styles.sidebarIcon}>{item.icon}</span>
                {item.label}
              </a>
            </li>
          ))}
          <li>
            <KernelLink to={{ os: 'macos', ref: { section: 'projects' } }} className={styles.sidebarItem}>
              <span className={styles.sidebarIcon}>
                <FolderGlyph />
              </span>
              Projects
            </KernelLink>
          </li>
          <li>
            <KernelLink to={{ os: 'macos', ref: { section: 'resume' } }} className={styles.sidebarItem}>
              <span className={styles.sidebarIcon}>
                <DocumentGlyph />
              </span>
              Résumé
            </KernelLink>
          </li>
        </ul>
      </nav>

      <header className={styles.toolbar} data-drag-region="">
        <div className={styles.history}>
          <button
            type="button"
            className={styles.tool}
            aria-label="Back"
            disabled={!canBack}
            onClick={() => dispatch({ type: 'APP_BACK', id: window.id })}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className={styles.tool}
            aria-label="Forward"
            disabled={!canForward}
            onClick={() => dispatch({ type: 'APP_FORWARD', id: window.id })}
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <button
          type="button"
          className={styles.up}
          aria-label={`Back to ${level === 'file' ? FOLDER_TITLES[folder] : FOLDER_TITLES.home}`}
          hidden={level === 'home'}
          onClick={up}
        >
          <ChevronLeft size={18} />
        </button>
        <h2 id={titleId} className={styles.title}>
          <span className="sr-only">Finder — </span>
          {FOLDER_TITLES[folder]}
        </h2>
        <span className={styles.spacer} />
        <div className={styles.views} role="group" aria-label="View">
          {(
            [
              ['icons', 'as Icons', <GridGlyph key="g" />],
              ['list', 'as List', <ListGlyph key="l" />],
              ['columns', 'as Columns', <ColumnsGlyph key="c" />],
            ] as const
          ).map(([mode, label, glyph]) => (
            <button
              key={mode}
              type="button"
              className={styles.viewButton}
              aria-label={`View ${label}`}
              aria-pressed={view === mode}
              onClick={() => setAppState('files:view', mode)}
            >
              {glyph}
            </button>
          ))}
        </div>
      </header>

      {flat && !documentShown ? (
        <section
          className={styles.flat}
          aria-label={`${FOLDER_TITLES[folder]} — ${view === 'icons' ? 'icons' : 'list'}`}
        >
          {items.length === 0 ? <p className={styles.empty}>No items</p> : null}
          {view === 'icons' && items.length ? (
            <RovingGroup as="ul" orientation="grid" role="list" className={styles.icons} data-view="icons">
              {items.map((item) => (
                <li key={item.key}>
                  <a
                    id={`finder-${folder}-${item.key}`}
                    href={
                      item.alias
                        ? hrefFor({ os: 'macos', ref: item.alias })
                        : hrefFor({ os: 'macos', role: 'files', location: item.target ?? at() })
                    }
                    className={styles.iconItem}
                    data-roving-item=""
                    aria-current={itemSelected(item) ? 'true' : undefined}
                    onClick={(event) => {
                      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                        return;
                      event.preventDefault();
                      if (event.detail !== 1 || item.alias || item.kind === 'folder') openItem(item);
                      else if (item.target) go(item.target);
                    }}
                    onDoubleClick={() => openItem(item)}
                    onKeyDown={(event) => {
                      if (event.key === ' ' && item.look) {
                        event.preventDefault();
                        if (item.target) go(item.target);
                        runMacCommand({ kind: 'quick-look', ref: item.look, origin: event.currentTarget.id });
                      }
                    }}
                  >
                    <span aria-hidden="true">
                      {item.kind === 'folder' ? <FolderIcon size={56} /> : <DocumentIcon size={52} />}
                    </span>
                    <span className={styles.iconLabel}>{item.label}</span>
                    {item.alias ? <span className="sr-only"> (alias, opens {ALIASES[item.key]?.opens})</span> : null}
                  </a>
                </li>
              ))}
            </RovingGroup>
          ) : null}
          {view === 'list' && items.length ? (
            <table className={styles.table} data-view="list">
              <caption className="sr-only">{FOLDER_TITLES[folder]}</caption>
              <thead>
                <tr>
                  {COLUMNS[folder].map((column) => (
                    <th key={column.key} scope="col" aria-sort={sort.key === column.key ? sort.dir : 'none'}>
                      <button
                        type="button"
                        className={styles.sortButton}
                        onClick={() =>
                          setSort((current) => ({
                            key: column.key,
                            dir: current.key === column.key && current.dir === 'ascending' ? 'descending' : 'ascending',
                          }))
                        }
                      >
                        {column.label}
                        <span aria-hidden="true">
                          {sort.key === column.key ? (sort.dir === 'ascending' ? ' ▲' : ' ▼') : ''}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((item) => (
                  <tr key={item.key} aria-current={itemSelected(item) ? 'true' : undefined}>
                    <th scope="row">
                      <a
                        id={`finder-${folder}-${item.key}`}
                        href={
                          item.alias
                            ? hrefFor({ os: 'macos', ref: item.alias })
                            : hrefFor({ os: 'macos', role: 'files', location: item.target ?? at() })
                        }
                        className={styles.cellLink}
                        onClick={(event) => {
                          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
                            return;
                          event.preventDefault();
                          if (event.detail !== 1 || item.alias || item.kind === 'folder') openItem(item);
                          else if (item.target) go(item.target);
                        }}
                        onDoubleClick={() => openItem(item)}
                        onKeyDown={(event) => {
                          if (event.key === ' ' && item.look) {
                            event.preventDefault();
                            if (item.target) go(item.target);
                            runMacCommand({ kind: 'quick-look', ref: item.look, origin: event.currentTarget.id });
                          }
                        }}
                      >
                        <span aria-hidden="true">
                          {item.kind === 'folder' ? <FolderIcon size={16} /> : <DocumentGlyph size={14} />}
                        </span>
                        {item.label}
                      </a>
                    </th>
                    {COLUMNS[folder].slice(1).map((column) => (
                      <td key={column.key}>{column.key === 'dates' ? item.dates : sortValue(item, column.key)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}

      <RovingGroup
        as="ul"
        orientation="vertical"
        role="list"
        aria-label={FOLDER_TITLES.home}
        className={`${styles.column} ${styles.homeColumn}`}
        data-column="home"
      >
        {HOME.map((item) =>
          item.key === 'projects' || item.key === 'resume' || item.key === 'about' ? (
            <li key={item.key}>
              <KernelLink
                to={{ os: 'macos', ref: ALIASES[item.key]!.ref }}
                className={styles.row}
                data-finder-row=""
                data-roving-item=""
              >
                <span className={styles.rowIcon} aria-hidden="true">
                  {ALIASES[item.key]!.kind === 'folder' ? <FolderIcon size={18} /> : <DocumentGlyph size={16} />}
                </span>
                <span className={styles.rowLabel}>{item.label}</span>
                <span className="sr-only"> (alias, opens {ALIASES[item.key]!.opens})</span>
              </KernelLink>
            </li>
          ) : (
            <FinderRow
              key={item.key}
              column="home"
              target={at(item.key)}
              selected={folder === item.key}
              kind="folder"
              compact={compact}
              onSelect={go}
              onOpen={() => focusRow('entries', 'first')}
              onBack={() => undefined}
            >
              {item.label}
            </FinderRow>
          ),
        )}
      </RovingGroup>

      <RovingGroup
        as="ul"
        orientation="vertical"
        role="list"
        aria-label={FOLDER_TITLES[folder]}
        className={`${styles.column} ${styles.entriesColumn}`}
        data-column="entries"
      >
        {entries.map((entry) => (
          <FinderRow
            key={entry.slug}
            id={`finder-${folder}-${entry.slug}`}
            look={{ section: folder, slug: entry.slug } as ContentRef}
            column="entries"
            target={at(folder as Section, entry.slug)}
            selected={slug === entry.slug}
            kind="file"
            compact={compact}
            onSelect={go}
            onOpen={() => (compact ? focusDocument() : openDocument(entry.slug))}
            onBack={() => {
              go(parent());
              focusRow('home', 'selected');
            }}
          >
            {entry.label}
          </FinderRow>
        ))}
        {folder !== 'home' && entries.length === 0 ? <li className={styles.empty}>No items</li> : null}
      </RovingGroup>

      <section className={styles.preview} aria-label="Preview">
        <Preview folder={folder} slug={slug} onOpen={() => slug && openDocument(slug)} />
      </section>

      {slug ? (
        <article
          ref={documentRef}
          className={styles.document}
          hidden={!documentShown || undefined}
          // A scrollable document must be a tab stop so keyboard users can scroll it (WCAG 2.1.1, axe
          // scrollable-region-focusable) — the one case jsx-a11y's non-interactive rule does not model.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={documentShown ? 0 : -1}
          data-finder-document=""
          aria-label="Document"
        >
          {!compact ? (
            <p className={styles.documentBar}>
              <button type="button" className={styles.open} onClick={closeDocument}>
                Done
              </button>
            </p>
          ) : null}
          <div className={styles.documentBody}>
            {folder === 'experience' && getExperienceEntry(slug as ExperienceSlug) ? (
              <ExperienceDetail data={getExperienceEntry(slug as ExperienceSlug)!} headingLevel={3} slots={MAC_SLOTS} />
            ) : null}
            {folder === 'education' && getEducationEntry(slug as EducationSlug) ? (
              <EducationDetail data={getEducationEntry(slug as EducationSlug)!} headingLevel={3} slots={MAC_SLOTS} />
            ) : null}
          </div>
        </article>
      ) : null}

      {pathBar || statusBar ? (
        <footer className={styles.footer}>
          {pathBar ? (
            <nav className={styles.pathBar} aria-label="Path">
              <ol>
                <li>{FOLDER_TITLES.home}</li>
                {folder !== 'home' ? <li>{FOLDER_TITLES[folder]}</li> : null}
                {slug ? <li>{entries.find((entry) => entry.slug === slug)?.label ?? slug}</li> : null}
              </ol>
            </nav>
          ) : null}
          {statusBar ? (
            <p className={styles.statusBar}>
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </p>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
}
