'use client';
/**
 * Files — experience, education and the résumé as the iOS Files app (plans/ios/apps/files.md, `IOS-FILES-01…07`):
 *   · phone: a bottom **tab bar** — Recents · Browse. Browse: large title, search, "Locations" (On My iPhone),
 *     "Favorites" (Experience · Education · Résumé.pdf), "Tags" (the stack tags from data → roles and projects);
 *   · the tree is the same on every OS: On My iPhone › {given name} › Experience/{Company} — {Role} · Education/{School}
 *     · Résumé.pdf · aliases Projects (→ GitHub) and About (→ Safari). Folders push (their URL when they have one:
 *     `/ios/files/experience[/{slug}]`); On My iPhone, the owner's folder and tags are session screens (`ui.trail`);
 *   · folder view: ⋯ menu (`Menu`) — Icons / List (default on the phone) · Sort by Name / Date; rows are links named
 *     "{Company} — {Role}, {period}"; long-press / ⋯ → preview with Open · Copy link · Share; "Folder is Empty";
 *   · a role or school opens as a document page (`ExperienceDetail` / `EducationDetail`) with Share · Copy link;
 *   · the résumé opens in **Quick Look** (`files-quicklook.tsx`) — zoom from the row, Done, swipe down, thumbnails,
 *     Download, Text version;
 *   · deep open from the Dock (`/ios/files/resume`) synthesizes [Browse, {owner}, Quick Look]: Done returns to the
 *     folder, the browser's Back then returns Home (`IOS-FILES-05`) — every URL pop is `APP_BACK` when the parent is the
 *     previous history entry, else a replace;
 *   · full page (`IOS-FILES-06`): sidebar (Recents · Locations · Favorites · Tags) + content (icons by default); Quick
 *     Look floats as a large centred sheet.
 */
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { EducationDetail, ExperienceDetail, formatCredential, formatUpdated, resumeFileLabel } from '@/components/content';
import { Menu, type MenuEntry } from '@/components/primitives/Menu';
import type { ContentRef } from '@/data/schema';
import {
  getCredentials,
  getEducation,
  getExperience,
  getPerson,
  getProjects,
  getResume,
  getResumeFileMeta,
} from '@/data/selectors';
import { currentLocation } from '@/lib/kernel/state';
import type { AppLocation } from '@/lib/kernel/types';
import { useKernel } from '@/stores/kernel-context';
import { dispatchSoon, getKernel } from '@/stores/kernel-store';
import { iosId } from '../model';
import { useAppUi, useAppUiJson, useIos } from '../shell-context';
import { Glyph } from '../ui/glyphs';
import {
  appHref,
  BarButton,
  contentHref,
  Group,
  PushLink,
  Row,
  SearchField,
  TabBar,
  uiStyles,
  type RowPreview,
} from '../ui/kit';
import { NavStack, scrollStackToTop, type NavScreen } from '../ui/NavStack';
import * as M from './files-model';
import { QuickLook, QUICK_LOOK_TITLE } from './files-quicklook';
import type { IosAppProps } from './registry';
import styles from './files.module.css';

type Tab = 'browse' | 'recents';
type Side = 'recents' | 'iphone' | M.Section | `tag:${string}`;
type View = 'list' | 'icons';

const FOLDER_TITLE: Readonly<Record<M.Section, string>> = { experience: 'Experience', education: 'Education' };
const LOCATION = 'On My iPhone';

const TABS: readonly { id: Tab; label: string; glyph: 'clock' | 'folder' }[] = [
  { id: 'recents', label: 'Recents', glyph: 'clock' },
  { id: 'browse', label: 'Browse', glyph: 'folder' },
];

interface Frame {
  readonly key: string;
  readonly kind: 'browse' | 'recents' | 'iphone' | 'jaswanth' | 'tag' | 'folder' | 'doc';
  /** URL frames (folders and documents with a route). */
  readonly place?: M.Place;
  /** Session frames: the trail entry they stand for. */
  readonly entry?: M.TrailEntry;
  readonly tag?: string;
}

const isSide = (value: string): value is Side =>
  value === 'recents' ||
  value === 'iphone' ||
  value === 'experience' ||
  value === 'education' ||
  value.startsWith('tag:');

/** Full page: the sidebar selection that fits the URL (a folder URL selects its favourite unless browsed to). */
export function resolveSide(stored: string, place: M.Place): Side {
  const side: Side = isSide(stored) ? stored : 'iphone';
  switch (place.kind) {
    case 'root':
      return side === 'experience' || side === 'education' ? 'iphone' : side;
    case 'resume':
      return side;
    case 'folder':
      return side === 'iphone' || side === place.section ? side : place.section;
    case 'doc':
      return side === 'iphone' || side === place.section || side === 'recents' || side.startsWith('tag:')
        ? side
        : place.section;
  }
}

const refOf = (place: M.Place): ContentRef | null => {
  switch (place.kind) {
    case 'folder':
      return { section: place.section };
    case 'doc':
      return { section: place.section, slug: place.slug };
    case 'resume':
      return { section: 'resume' };
    default:
      return null;
  }
};

const sessionFrame = (entry: M.TrailEntry): Frame | null => {
  if (entry === 'iphone') return { key: 'iphone', kind: 'iphone', entry };
  if (entry === 'jaswanth') return { key: 'jaswanth', kind: 'jaswanth', entry };
  if (entry.startsWith('tag:')) return { key: entry, kind: 'tag', entry, tag: entry.slice(4) };
  return null;
};

function urlFrames(place: M.Place, direct: boolean, withFolder: boolean): Frame[] {
  if (place.kind === 'folder') return withFolder ? [{ key: `folder:${place.section}`, kind: 'folder', place }] : [];
  if (place.kind !== 'doc') return [];
  const doc: Frame = { key: `doc:${M.placeKey(place)}`, kind: 'doc', place };
  if (direct || !withFolder) return [doc];
  return [{ key: `folder:${place.section}`, kind: 'folder', place: { kind: 'folder', section: place.section } }, doc];
}

// --- Artwork (drawn, original) -------------------------------------------------------------------------------------

/** An alias draws what it points to: a folder (Projects) or a document (a web location, a project).  */
const artOf = (item: M.FileItem): M.FileKind =>
  item.kind === 'alias' && item.ref?.section === 'projects' && !('slug' in item.ref) ? 'folder' : item.kind;

function FileArt({
  kind,
  tint,
  size = 30,
  alias = false,
}: {
  kind: M.FileKind | 'tag';
  tint?: string;
  size?: number;
  alias?: boolean;
}) {
  if (kind === 'tag')
    return <span className={styles.tagDot} style={{ background: tint }} aria-hidden="true" data-ql-thumb="" />;
  const badge = alias ? (
    <g>
      <circle cx="31" cy="31" r="7" fill="#ffffff" />
      <path d="M28 34l6-6m-4.5 0H34v4.5" stroke="#3a3a3c" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </g>
  ) : null;
  if (kind === 'folder')
    return (
      <svg className={styles.art} width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" data-ql-thumb="">
        <path
          d="M3 10.5A3.5 3.5 0 0 1 6.5 7h8.2c1 0 1.9.4 2.5 1.2L19 10h14.5A3.5 3.5 0 0 1 37 13.5V30a3.5 3.5 0 0 1-3.5 3.5h-27A3.5 3.5 0 0 1 3 30z"
          fill="#1f8ef1"
        />
        <path
          d="M3 15.5A3.5 3.5 0 0 1 6.5 12h27a3.5 3.5 0 0 1 3.5 3.5V30a3.5 3.5 0 0 1-3.5 3.5h-27A3.5 3.5 0 0 1 3 30z"
          fill="#5eb8ff"
        />
        {badge}
      </svg>
    );
  const pdf = kind === 'pdf';
  return (
    <svg className={styles.art} width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" data-ql-thumb="">
      <path
        d="M9 3.5h15l8 8V35a1.5 1.5 0 0 1-1.5 1.5h-21A1.5 1.5 0 0 1 8 35V5A1.5 1.5 0 0 1 9.5 3.5z"
        fill="#ffffff"
        stroke="#c7c7cc"
        strokeWidth="1"
      />
      <path d="M24 3.5v6.5a1.5 1.5 0 0 0 1.5 1.5H32" fill="#ececf1" stroke="#c7c7cc" strokeWidth="1" />
      <path d="M12 16h14M12 19.5h16M12 23h12M12 26.5h15" stroke="#c7c7cc" strokeWidth="1.2" strokeLinecap="round" />
      {pdf ? (
        <g>
          <rect x="10.5" y="29" width="15" height="6" rx="1.5" fill="#e5332a" />
          <text
            x="18"
            y="33.6"
            textAnchor="middle"
            fontSize="4.6"
            fontWeight="700"
            fill="#ffffff"
            fontFamily="-apple-system, sans-serif"
          >
            PDF
          </text>
        </g>
      ) : null}
      {badge}
    </svg>
  );
}

// --- The ⋯ menu (Icons / List · Sort by Name / Date) ------------------------------------------------------------------

function ViewMenu({
  view,
  sort,
  onView,
  onSort,
}: {
  readonly view: View;
  readonly sort: M.SortKey;
  readonly onView: (next: View) => void;
  readonly onSort: (next: M.SortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const items: MenuEntry[] = [
    { kind: 'checkbox', id: 'icons', label: 'Icons', checked: view === 'icons', onSelect: () => onView('icons') },
    { kind: 'checkbox', id: 'list', label: 'List', checked: view === 'list', onSelect: () => onView('list') },
    { kind: 'separator', id: 'sep' },
    { kind: 'checkbox', id: 'name', label: 'Sort by Name', checked: sort === 'name', onSelect: () => onSort('name') },
    { kind: 'checkbox', id: 'date', label: 'Sort by Date', checked: sort === 'date', onSelect: () => onSort('date') },
  ];
  return (
    <div className={styles.menuAnchor}>
      <button
        ref={button}
        type="button"
        className={uiStyles.barButton}
        aria-label="View options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown') return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        <span className={styles.moreGlyph} aria-hidden="true">
          <Glyph name="ellipsis" size={18} strokeWidth={2.4} />
        </span>
      </button>
      {open ? (
        <Menu
          label="View options"
          items={items}
          onClose={() => setOpen(false)}
          returnFocusTo={button}
          className={styles.menu}
        />
      ) : null}
    </div>
  );
}

// --- The app ---------------------------------------------------------------------------------------------------------

export default function Files({ id, layout, landscape }: IosAppProps) {
  const ios = useIos();
  const window = useKernel((state) => state.sessions.ios.windows[id]);
  const github = useKernel((state) => state.sessions.ios.windows[iosId('github')]);
  const [tabRaw, setTab] = useAppUi(id, 'tab', 'browse');
  const [sideRaw, setSide] = useAppUi(id, 'side', 'iphone');
  const [trailRaw, setTrailRaw] = useAppUiJson<M.TrailEntry[] | null>(id, 'trail', null);
  const [viewRaw, setView] = useAppUi(id, 'view', '');
  const [sortRaw, setSort] = useAppUi(id, 'sort', 'date');
  const [query, setQuery] = useAppUi(id, 'q', '');
  const [lastDoc, setLastDoc] = useAppUi(id, 'lastDoc', '');
  const [textRaw, setText] = useAppUi(id, 'qlText', '');
  const [tops, setTops] = useAppUiJson<Partial<Record<Tab, string>>>(id, 'tops', {});
  const root = useRef<HTMLDivElement>(null);
  const origin = useRef<DOMRect | null>(null);

  const person = getPerson();
  const data = useMemo(() => {
    const roles = getExperience();
    const schools = getEducation();
    const projects = getProjects();
    return {
      roles,
      schools,
      projects,
      credentials: getCredentials(),
      roleItems: roles.map(M.roleItem),
      schoolItems: schools.map(M.schoolItem),
      tags: M.tagsFrom(roles, projects),
    };
  }, []);
  const resume = getResume();
  const file = getResumeFileMeta();

  const view: View = viewRaw === 'icons' || viewRaw === 'list' ? viewRaw : layout === 'pad' ? 'icons' : 'list';
  const sort: M.SortKey = sortRaw === 'name' ? 'name' : 'date';

  // --- Where the URL says we are ----------------------------------------------------------------------------------
  const location: AppLocation = window ? currentLocation(window) : { kind: 'root' };
  const requested = M.placeOf(location);
  const docItem =
    requested.kind === 'doc'
      ? (requested.section === 'experience' ? data.roleItems : data.schoolItems).find(
          (item) => item.key === M.placeKey(requested),
        )
      : undefined;
  const removed = requested.kind === 'doc' && !docItem;
  const place: M.Place =
    removed && requested.kind === 'doc' ? { kind: 'folder', section: requested.section } : requested;
  const trail = M.resolveTrail(place, trailRaw);
  const qlOpen = place.kind === 'resume';
  const tab: Tab = tabRaw === 'recents' ? 'recents' : 'browse';
  const side = resolveSide(sideRaw, place);

  // --- Items -------------------------------------------------------------------------------------------------------
  const folderItem = (section: M.Section): M.FileItem => {
    const children = section === 'experience' ? data.roleItems : data.schoolItems;
    return {
      key: `folder:${section}`,
      kind: 'folder',
      name: FOLDER_TITLE[section],
      secondary: M.itemsLabel(children.length),
      label: `${FOLDER_TITLE[section]}, folder, ${M.itemsLabel(children.length)}`,
      date: Math.max(0, ...children.map((child) => child.date)),
      place: { kind: 'folder', section },
    };
  };
  const pdfItem: M.FileItem = {
    key: 'resume',
    kind: 'pdf',
    name: QUICK_LOOK_TITLE,
    secondary: [formatUpdated(resume.updated), resumeFileLabel(file)].join(' · '),
    label: `${QUICK_LOOK_TITLE}, ${resumeFileLabel(file)}`,
    date: M.dateValue(resume.updated.slice(0, 7) as `${number}-${number}`),
    place: M.RESUME,
  };
  const aliases: M.FileItem[] = [
    {
      key: 'alias:projects',
      kind: 'alias',
      name: 'Projects',
      secondary: 'Opens in GitHub',
      label: 'Projects, alias, opens in GitHub',
      date: 0,
      ref: { section: 'projects' },
    },
    {
      key: 'alias:about',
      kind: 'alias',
      name: `About ${person.givenName}`,
      secondary: 'Opens in Safari',
      label: `About ${person.givenName}, alias, opens in Safari`,
      date: 0,
      ref: { section: 'about' },
    },
  ];
  const ownerItems = [folderItem('experience'), folderItem('education'), pdfItem, ...aliases];
  const ownerFolder: M.FileItem = {
    key: 'jaswanth',
    kind: 'folder',
    name: person.givenName,
    secondary: M.itemsLabel(ownerItems.length),
    label: `${person.givenName}, folder, ${M.itemsLabel(ownerItems.length)}`,
    date: 0,
    trail: 'jaswanth',
  };
  const allFiles = [...data.roleItems, ...data.schoolItems, pdfItem];
  const recentItems = (): M.FileItem[] => {
    const items = [pdfItem];
    const viewed = allFiles.find((item) => item.key === lastDoc);
    if (viewed) items.push(viewed);
    const projectLocation = github ? currentLocation(github) : null;
    const projectSlug =
      projectLocation?.kind === 'content' && projectLocation.ref.section === 'projects' && 'slug' in projectLocation.ref
        ? projectLocation.ref.slug
        : undefined;
    const project = data.projects.find((candidate) => candidate.slug === projectSlug);
    if (project)
      items.push({
        key: `project:${project.slug}`,
        kind: 'alias',
        name: project.name,
        secondary: 'Opens in GitHub',
        label: `${project.name}, opens in GitHub`,
        date: 0,
        ref: { section: 'projects', slug: project.slug },
      });
    return items;
  };

  // --- Session state writers ---------------------------------------------------------------------------------------
  const setTrail = (next: readonly M.TrailEntry[]) => {
    if (JSON.stringify(next) !== JSON.stringify(trailRaw)) setTrailRaw([...next]);
  };

  /** Pop the URL to `parent`: `APP_BACK` when it is the previous history entry, else a replace (a synthesized stack). */
  const popTo = (parent: M.Place) => {
    const win = getKernel().sessions.ios.windows[id];
    const previous = win && win.nav.index > 0 ? win.nav.entries[win.nav.index - 1] : null;
    if (previous && M.placeKey(M.placeOf(previous)) === M.placeKey(parent)) dispatchSoon({ type: 'APP_BACK', id });
    else dispatchSoon({ type: 'NAVIGATE_IN_APP', id, location: M.locationOf(parent), replace: true });
  };

  // --- Frames: [root, …session trail, …URL screens] -------------------------------------------------------------------
  let frames: Frame[];
  if (layout === 'pad') {
    if (side === 'recents') frames = [{ key: 'recents', kind: 'recents' }, ...urlFrames(place, true, false)];
    else if (side.startsWith('tag:'))
      frames = [
        { key: side, kind: 'tag', entry: side as M.TrailEntry, tag: side.slice(4) },
        ...urlFrames(place, true, false),
      ];
    else if (side === 'experience' || side === 'education')
      frames = [
        { key: `folder:${side}`, kind: 'folder', place: { kind: 'folder', section: side } },
        ...urlFrames(place, true, false),
      ];
    else {
      const sessions = trail
        .filter((entry) => entry === 'jaswanth')
        .map(sessionFrame)
        .filter((frame): frame is Frame => frame !== null);
      frames = [
        { key: 'iphone', kind: 'iphone', entry: 'iphone' },
        ...sessions,
        ...urlFrames(place, M.opensDirect(trail), true),
      ];
    }
  } else {
    const tabRoot: Tab = tab === 'recents' && place.kind !== 'folder' ? 'recents' : 'browse';
    if (tabRoot === 'recents') frames = [{ key: 'recents', kind: 'recents' }, ...urlFrames(place, true, false)];
    else {
      const sessions = trail.map(sessionFrame).filter((frame): frame is Frame => frame !== null);
      frames = [{ key: 'browse', kind: 'browse' }, ...sessions, ...urlFrames(place, M.opensDirect(trail), true)];
    }
  }

  const viaAt = (index: number): M.TrailEntry[] =>
    frames.slice(0, index + 1).flatMap((frame) => (frame.entry ? [frame.entry] : []));

  const pop = () => {
    const top = frames[frames.length - 1];
    if (!top || frames.length < 2) return;
    if (top.place) {
      const parent = [...frames.slice(0, -1)].reverse().find((frame) => frame.place)?.place ?? M.ROOT;
      setTrail(trail);
      popTo(parent);
    } else setTrail(trail.slice(0, -1));
  };

  const doneQuickLook = () => {
    setTrail(trail);
    popTo(
      layout === 'pad' && (side === 'experience' || side === 'education') ? { kind: 'folder', section: side } : M.ROOT,
    );
  };

  // --- Effects -----------------------------------------------------------------------------------------------------
  const docKey = docItem?.key ?? '';
  useEffect(() => {
    if (docKey && docKey !== lastDoc) setLastDoc(docKey);
  }, [docKey, lastDoc, setLastDoc]);

  // A removed slug lands on its folder with a banner (plans/ios/apps/files "Edge cases").
  const missing = removed ? M.placeKey(requested) : null;
  const reported = useRef<string | null>(null);
  const { notify, onScrollToTop } = ios;
  useEffect(() => {
    if (!missing || reported.current === missing) return;
    reported.current = missing;
    const section = missing.startsWith('education') ? 'education' : 'experience';
    notify({
      id: `files-missing-${missing}`,
      role: 'files',
      app: 'Files',
      title: 'File not found',
      body: `That file isn’t in ${FOLDER_TITLE[section]} any more — here’s the folder.`,
    });
    dispatchSoon({ type: 'NAVIGATE_IN_APP', id, location: { kind: 'content', ref: { section } }, replace: true });
  }, [missing, notify, id]);

  useEffect(() => {
    onScrollToTop(id, () => scrollStackToTop(root.current));
    return () => onScrollToTop(id, null);
  }, [id, onScrollToTop]);

  // --- Activation ---------------------------------------------------------------------------------------------------
  /** Clicks on the résumé's row remember its thumbnail: Quick Look zooms out of it. */
  const captureOrigin = (event: ReactMouseEvent<HTMLElement>) => {
    const row = (event.target as Element).closest?.('[data-ql-origin]');
    if (!row) return;
    const thumb = row.querySelector('[data-ql-thumb]') ?? row;
    origin.current = thumb.getBoundingClientRect();
  };

  const activate = (item: M.FileItem, via: readonly M.TrailEntry[] | null, anchor: HTMLElement | null) => {
    if (item.trail) {
      setTrail([...(via ?? []), item.trail]);
      return;
    }
    if (item.ref) {
      ios.openContent(item.ref, anchor);
      return;
    }
    if (!item.place) return;
    if (item.kind === 'pdf' && anchor) {
      const thumb = anchor.querySelector('[data-ql-thumb]') ?? anchor;
      origin.current = thumb.getBoundingClientRect();
    }
    if (via) setTrail(via);
    dispatchSoon({ type: 'NAVIGATE_IN_APP', id, location: M.locationOf(item.place) });
  };

  const previewFor = (item: M.FileItem, via: readonly M.TrailEntry[] | null): RowPreview | undefined => {
    const ref = item.ref ?? (item.place ? refOf(item.place) : null);
    if (!ref) return undefined;
    return {
      label: `${item.name} actions`,
      open: (anchor) =>
        ios.preview({
          title: item.name,
          summary: item.secondary,
          ref,
          anchor,
          actions: [
            { id: 'open', label: 'Open', run: () => activate(item, via, anchor) },
            { id: 'copy', label: 'Copy link', run: () => void ios.copyLink(ref, item.name) },
            { id: 'share', label: 'Share', run: () => void ios.copyLink(ref, item.name) },
          ],
        }),
    };
  };

  const fileRow = (item: M.FileItem, via: readonly M.TrailEntry[] | null, selected = false) => {
    const common = {
      title: item.name,
      subtitle: item.secondary || undefined,
      icon: { node: <FileArt kind={artOf(item)} alias={item.kind === 'alias'} tint={item.tint} /> },
      'aria-label': item.label,
      pushKey: `file:${item.key}`,
      preview: previewFor(item, via),
      selected,
      dataAttrs: item.kind === 'pdf' ? { 'data-ql-origin': '' } : undefined,
    } as const;
    if (item.place)
      return (
        <Row
          key={item.key}
          {...common}
          kind="push"
          app={id}
          location={M.locationOf(item.place)}
          onActivate={via ? () => setTrail(via) : undefined}
          accessory={item.kind === 'folder' && layout !== 'pad' ? 'chevron' : 'none'}
        />
      );
    return (
      <Row
        key={item.key}
        {...common}
        kind="href"
        href={item.ref ? contentHref(item.ref) : appHref(id, { kind: 'root' })}
        accessory={item.kind === 'folder' ? 'chevron' : 'none'}
        onClick={(event) => {
          event.preventDefault();
          activate(item, via, event.currentTarget);
        }}
      />
    );
  };

  const fileTile = (item: M.FileItem, via: readonly M.TrailEntry[] | null) => {
    const preview = previewFor(item, via);
    const body = (
      <>
        <span className={styles.tileArt}>
          <FileArt kind={artOf(item)} alias={item.kind === 'alias'} size={64} />
        </span>
        <span className={styles.tileName}>{item.name}</span>
        {item.secondary ? <span className={styles.tileMeta}>{item.secondary}</span> : null}
      </>
    );
    const shared = {
      className: `${styles.tile} ${uiStyles.press}`,
      'aria-label': item.label,
      'data-push-key': `file:${item.key}`,
      'data-ql-origin': item.kind === 'pdf' ? '' : undefined,
      onContextMenu: preview
        ? (event: ReactMouseEvent<HTMLAnchorElement>) => {
            event.preventDefault();
            preview.open(event.currentTarget);
          }
        : undefined,
    };
    return (
      <li key={item.key}>
        {item.place ? (
          <PushLink
            {...shared}
            app={id}
            location={M.locationOf(item.place)}
            onActivate={via ? () => setTrail(via) : undefined}
          >
            {body}
          </PushLink>
        ) : (
          <a
            {...shared}
            href={item.ref ? contentHref(item.ref) : appHref(id, { kind: 'root' })}
            onClick={(event) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
              event.preventDefault();
              activate(item, via, event.currentTarget);
            }}
          >
            {body}
          </a>
        )}
      </li>
    );
  };

  const folderBody = (
    items: readonly M.FileItem[],
    via: readonly M.TrailEntry[] | null,
    extra?: ReactNode,
    ordered = false,
  ): ReactNode => {
    if (items.length === 0 && !extra)
      return (
        <p className={styles.empty} role="status">
          Folder is Empty
        </p>
      );
    const sorted = ordered ? [...items] : M.sortItems(items, sort);
    return (
      <>
        {view === 'icons' ? (
          <ul className={styles.grid} role="list">
            {sorted.map((item) => fileTile(item, via))}
          </ul>
        ) : (
          <Group>{sorted.map((item) => fileRow(item, via))}</Group>
        )}
        {extra}
        <p className={styles.count}>{M.itemsLabel(items.length)}</p>
      </>
    );
  };

  const viewMenu = (
    <ViewMenu view={view} sort={sort} onView={(next) => setView(next)} onSort={(next) => setSort(next)} />
  );

  const results = M.searchItems(allFiles, query);
  const searchResults = (via: readonly M.TrailEntry[]) =>
    results.length === 0 ? (
      <p className={styles.empty} role="status">
        No Results
      </p>
    ) : (
      <Group header="Results">{results.map((item) => fileRow(item, via))}</Group>
    );

  const tagRow = (tag: M.Tag, via: readonly M.TrailEntry[]) => (
    <Row
      key={tag.name}
      kind="href"
      href={appHref(id, { kind: 'root' })}
      title={tag.name}
      value={String(tag.count)}
      icon={{ node: <FileArt kind="tag" tint={tag.color} /> }}
      pushKey={`tag:${tag.name}`}
      accessory="chevron"
      aria-label={`${tag.name} tag, ${M.itemsLabel(tag.count)}`}
      onClick={(event) => {
        event.preventDefault();
        setTrail([...via, `tag:${tag.name}`]);
      }}
    />
  );

  const browseBody = (): ReactNode =>
    query.trim() ? (
      searchResults(['@'])
    ) : (
      <>
        <Group header="Locations">
          {fileRow(
            { ...ownerFolder, key: 'iphone', name: LOCATION, secondary: '', label: LOCATION, trail: 'iphone' },
            [],
          )}
        </Group>
        <Group header="Favorites">
          {[folderItem('experience'), folderItem('education'), pdfItem].map((item) => fileRow(item, []))}
        </Group>
        {data.tags.length > 0 ? <Group header="Tags">{data.tags.map((tag) => tagRow(tag, []))}</Group> : null}
      </>
    );

  const tagBody = (name: string, via: readonly M.TrailEntry[]): ReactNode => {
    const matches = M.tagged(name, data.roles, data.projects);
    const roleItems = data.roleItems.filter((item) =>
      matches.roles.some((role) => item.key === `experience/${role.slug}`),
    );
    const projectItems: M.FileItem[] = matches.projects.map((project) => ({
      key: `project:${project.slug}`,
      kind: 'alias',
      name: project.name,
      secondary: project.tagline,
      label: `${project.name}, project, opens in GitHub`,
      date: project.year ? project.year * 100 : 0,
      ref: { section: 'projects', slug: project.slug },
    }));
    if (roleItems.length === 0 && projectItems.length === 0)
      return (
        <p className={styles.empty} role="status">
          Folder is Empty
        </p>
      );
    return (
      <>
        {roleItems.length > 0 ? (
          <Group header="Experience">{M.sortItems(roleItems, sort).map((item) => fileRow(item, via))}</Group>
        ) : null}
        {projectItems.length > 0 ? (
          <Group header="Projects">{M.sortItems(projectItems, sort).map((item) => fileRow(item, via))}</Group>
        ) : null}
      </>
    );
  };

  const credentialsGroup =
    data.credentials.length > 0 ? (
      <Group header="Credentials">
        {data.credentials.map((credential) => (
          <Row
            key={credential.name}
            kind="static"
            title={credential.name}
            subtitle={`${credential.issuer} · ${formatCredential(credential)}`}
            icon={{ glyph: 'graduation' }}
          />
        ))}
      </Group>
    ) : undefined;

  const docScreen = (frame: Frame): NavScreen => {
    const target = frame.place as Extract<M.Place, { kind: 'doc' }>;
    const item = (target.section === 'experience' ? data.roleItems : data.schoolItems).find(
      (candidate) => candidate.key === M.placeKey(target),
    );
    const ref: ContentRef = { section: target.section, slug: target.slug };
    const role =
      target.section === 'experience' ? data.roles.find((candidate) => candidate.slug === target.slug) : undefined;
    const school =
      target.section === 'education' ? data.schools.find((candidate) => candidate.slug === target.slug) : undefined;
    const title = item?.name ?? FOLDER_TITLE[target.section];
    return {
      key: frame.key,
      title,
      tone: 'grouped',
      toolbar: (
        <>
          <BarButton label="Share" glyph="share" onPress={() => void ios.copyLink(ref, title)} />
          <BarButton label="Copy link" glyph="link" onPress={() => void ios.copyLink(ref, title)} />
        </>
      ),
      render: () => (
        <div className={styles.document} data-document="">
          <div className={styles.paper}>
            {role ? <ExperienceDetail data={role} headingLevel={4} /> : null}
            {school ? <EducationDetail data={school} headingLevel={4} /> : null}
          </div>
        </div>
      ),
    };
  };

  const screenFor = (frame: Frame, index: number): NavScreen => {
    const via = viaAt(index);
    switch (frame.kind) {
      case 'browse':
        return {
          key: frame.key,
          title: 'Browse',
          large: true,
          accessory: (
            <SearchField
              value={query}
              onChange={(value) => setQuery(value || null)}
              label="Search files"
              onCancel={() => setQuery(null)}
            />
          ),
          render: browseBody,
        };
      case 'recents':
        return {
          key: frame.key,
          title: 'Recents',
          large: true,
          trailing: viewMenu,
          render: () => folderBody(recentItems(), null, undefined, true),
        };
      case 'iphone':
        return {
          key: frame.key,
          title: LOCATION,
          large: true,
          trailing: viewMenu,
          render: () => folderBody([ownerFolder], via),
        };
      case 'jaswanth':
        return {
          key: frame.key,
          title: person.givenName,
          large: true,
          trailing: viewMenu,
          render: () => folderBody(ownerItems, via),
        };
      case 'tag':
        return { key: frame.key, title: frame.tag ?? '', large: true, render: () => tagBody(frame.tag ?? '', via) };
      case 'folder': {
        const section = (frame.place as Extract<M.Place, { kind: 'folder' }>).section;
        return {
          key: frame.key,
          title: FOLDER_TITLE[section],
          large: true,
          trailing: viewMenu,
          render: () =>
            section === 'experience'
              ? folderBody(data.roleItems, via)
              : folderBody(data.schoolItems, via, credentialsGroup),
        };
      }
      case 'doc':
        return docScreen(frame);
    }
  };

  const screens = frames.map(screenFor);

  const quickLook = (
    <QuickLook
      open={qlOpen}
      layout={layout}
      landscape={landscape}
      text={textRaw === '1'}
      onText={(next) => setText(next ? '1' : null)}
      onDone={doneQuickLook}
      ios={ios}
      takeOrigin={() => {
        const rect = origin.current;
        origin.current = null;
        return rect;
      }}
      findOrigin={() => {
        const candidates = [
          ...(root.current?.querySelectorAll<HTMLElement>('[data-screen]:not([hidden]) [data-ql-origin]') ?? []),
        ];
        return (
          candidates.find((el) => el.getBoundingClientRect().width > 0) ?? candidates[candidates.length - 1] ?? null
        );
      }}
      fallbackFocus={() => {
        const titles = root.current?.querySelectorAll<HTMLElement>('[data-screen]:not([hidden]) [data-screen-title]');
        return titles?.[titles.length - 1] ?? null;
      }}
    />
  );

  // --- Full page: sidebar + content ------------------------------------------------------------------------------------
  if (layout === 'pad') {
    const select = (next: Side, anchorPlace: M.Place) => {
      setSide(next);
      setTrail([]);
      dispatchSoon({ type: 'NAVIGATE_IN_APP', id, location: M.locationOf(anchorPlace) });
    };
    const sideRow = (key: Side, title: string, icon: ReactNode, target: M.Place, value?: string) => (
      <Row
        key={key}
        kind="href"
        href={appHref(id, M.locationOf(target))}
        title={title}
        value={value}
        icon={{ node: icon }}
        selected={side === key}
        aria-current={side === key ? 'page' : undefined}
        onClick={(event) => {
          event.preventDefault();
          select(key, target);
        }}
      />
    );
    return (
      <div ref={root} className={styles.split} onClickCapture={captureOrigin} data-files="">
        <div className={styles.stackHost} inert={qlOpen || undefined}>
          <nav className={styles.sidebar} aria-label="Files">
            <h3 className={styles.sidebarTitle}>Files</h3>
            <div className={styles.sidebarSearch}>
              <SearchField value={query} onChange={(value) => setQuery(value || null)} label="Search files" />
            </div>
            {query.trim() ? searchResults(['@']) : null}
            <Group className={styles.sidebarGroup}>
              {sideRow('recents', 'Recents', <Glyph name="clock" size={22} />, M.ROOT)}
            </Group>
            <Group header="Locations" className={styles.sidebarGroup}>
              {sideRow('iphone', LOCATION, <Glyph name="folder" size={22} />, M.ROOT)}
            </Group>
            <Group header="Favorites" className={styles.sidebarGroup}>
              {sideRow('experience', FOLDER_TITLE.experience, <Glyph name="folder" size={22} />, {
                kind: 'folder',
                section: 'experience',
              })}
              {sideRow('education', FOLDER_TITLE.education, <Glyph name="folder" size={22} />, {
                kind: 'folder',
                section: 'education',
              })}
              {fileRow({ ...pdfItem, secondary: '' }, [])}
            </Group>
            {data.tags.length > 0 ? (
              <Group header="Tags" className={styles.sidebarGroup}>
                {data.tags.map((tag) =>
                  sideRow(`tag:${tag.name}`, tag.name, <FileArt kind="tag" tint={tag.color} />, M.ROOT),
                )}
              </Group>
            ) : null}
          </nav>
          <div className={styles.detail}>
            <NavStack id={`files-pad-${side}`} window={id} screens={screens} onPop={pop} />
          </div>
        </div>
        {quickLook}
      </div>
    );
  }

  // --- Phone: tab bar + one stack per tab --------------------------------------------------------------------------
  const selectTab = (next: Tab, again: boolean) => {
    if (again) {
      if (frames.length > 1) {
        setTrail([]);
        if (place.kind !== 'root') popTo(M.ROOT);
      } else scrollStackToTop(root.current);
      return;
    }
    setTops({ ...tops, [tab]: M.placeKey(place) });
    setTab(next);
    dispatchSoon({ type: 'NAVIGATE_IN_APP', id, location: M.locationOf(M.placeFromKey(tops[next])), replace: true });
  };
  const tabBar = (
    <TabBar
      label="Files"
      tabs={TABS.map((spec) => ({ ...spec, href: appHref(id, { kind: 'root' }) }))}
      active={frames[0]?.kind === 'recents' ? 'recents' : 'browse'}
      onSelect={selectTab}
    />
  );
  const rootKind = frames[0]?.kind ?? 'browse';
  return (
    <div ref={root} className={styles.app} onClickCapture={captureOrigin} data-files="">
      <div className={styles.stackHost} inert={qlOpen || undefined}>
        <NavStack key={rootKind} id={`files-${rootKind}`} window={id} screens={screens} onPop={pop} tabBar={tabBar} />
      </div>
      {quickLook}
    </div>
  );
}
