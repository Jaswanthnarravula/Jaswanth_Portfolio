'use client';
/**
 * Start and Search — one Acrylic panel centred above the taskbar (plans/windows/surfaces/start-menu.md
 * `WIN-START-01…08`, surfaces/search.md `WIN-SEARCH-01…06`). They share a footprint and an input: typing in Start
 * **morphs** the panel into Search in place (content crossfade, the same `<input>` keeps focus and every keystroke —
 * plans/windows/06 E9). One `Combobox` (shared/15 contract: `aria-activedescendant`, grouped listbox, debounced count,
 * Esc clears then closes) sits at the top in both modes.
 *   Start: Pinned (6 × 3 grid of links, 2-D roving) · All apps (A–Z with a letter jump grid) · Recommended from data ·
 *   footer: user tile (About me · Settings · Switch operating system · Lock) and power (Sleep · Shut down · Restart).
 *   Search: filter chips (a radiogroup), best match + grouped results, a preview pane with Open · Copy link · Open in
 *   plain view; commands offer "Run in Terminal" (inserted, never executed); `winver` opens the About dialog.
 * Opening anything is one kernel action + one `go()`; the window flies from the tile (or the panel) rect. Start writes
 * no history; in compact mode it is a full-height modal sheet that Back closes (transient entry — the Shell owns it).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Combobox, type ComboboxGroup } from '@/components/primitives/Combobox';
import { FocusScope } from '@/components/primitives/FocusScope';
import { RovingGroup } from '@/components/primitives/RovingGroup';
import { KernelLink, type KernelTarget } from '@/components/shell/KernelLink';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { SECTION_TITLES } from '@/data/content-index';
import { getPerson, getProject } from '@/data/selectors';
import type { ProjectSlug } from '@/data/content-index';
import type { AppRole } from '@/lib/kernel/ids';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import type { SearchEntry, SearchResult } from '@/lib/search/types';
import { dispatchSoon } from '@/stores/kernel-store';
import { flInfo, flLink, flOpen, flRefresh, flSearch, flSwap } from '../fluent.generated';
import {
  flApps,
  flChevronLeft,
  flChevronRight,
  flConsole,
  flLock,
  flPerson,
  flPower,
  flSettings,
  flMoon,
} from '../fluent.apps.generated';
import { prefetchApp } from '../apps/AppBody';
import { Fl, PdfFile } from '../icons';
import { requestIntent } from '../intents';
import {
  allApps,
  initialsOf,
  LAUNCHER_ID,
  launcherPlaceholder,
  startPinned,
  startRecommended,
  winBinding,
  type StartTile,
} from '../model';
import { useWinShell } from '../shell-context';
import styles from '../windows.module.css';

export type LauncherMode = 'start' | 'search';

type Chip = 'all' | 'apps' | 'projects' | 'experience' | 'skills' | 'actions';
const CHIPS: readonly { id: Chip; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'apps', label: 'Apps' },
  { id: 'projects', label: 'Projects' },
  { id: 'experience', label: 'Experience' },
  { id: 'skills', label: 'Skills' },
  { id: 'actions', label: 'Actions' },
];

/** The search engine, loaded when the panel first opens (shared/15 `SRCH-LAZY-01`: never on an OS's first load). */
interface Engine {
  readonly entries: readonly SearchEntry[];
  query(text: string): readonly SearchResult[];
  zero(recent: readonly string[]): readonly SearchEntry[];
}

let enginePromise: Promise<Engine> | null = null;
export function loadSearchEngine(): Promise<Engine> {
  enginePromise ??= Promise.all([
    import('@/lib/search/index-builder'),
    import('@/lib/search/matcher'),
    import('@/lib/terminal/manifest'),
    import('@/data/content-index'),
    import('@/lib/kernel/route'),
    import('@/data/selectors'),
  ]).then(([builder, matcher, manifest, content, route, selectors]) => {
    const entries: SearchEntry[] = [
      ...builder.buildSearchIndex({
        os: 'windows',
        registry: OS_REGISTRY,
        catalog: content.contentIndex,
        visible: route.VISIBLE_OSES,
        commands: manifest.searchableCommands(),
        featured: selectors.getFeaturedProjects().map((project) => project.slug),
      }),
      // Windows' own Run-box classic (shared/21 `EGG-WINVER-01`): found by typing it, never listed in the zero state.
      {
        id: 'command:winver',
        kind: 'command',
        title: 'winver',
        subtitle: 'About Windows',
        keywords: ['winver', 'about windows', 'version'],
        command: 'winver',
        weight: 1,
      },
    ];
    const prepared = matcher.prepare(entries);
    return {
      entries,
      query: (text) => matcher.search(prepared, text, 24),
      zero: (recent) => matcher.zeroState(entries, recent),
    };
  });
  return enginePromise.catch((error: unknown) => {
    enginePromise = null;
    throw error;
  });
}

const chipAccepts = (chip: Chip, entry: SearchEntry, scope?: 'files') => {
  if (scope === 'files' && !(entry.ref?.section === 'skills' || entry.ref?.section === 'projects')) return false;
  switch (chip) {
    case 'all':
      return true;
    case 'apps':
      return entry.kind === 'app';
    case 'projects':
      return entry.ref?.section === 'projects';
    case 'experience':
      return entry.ref?.section === 'experience' || entry.ref?.section === 'education';
    case 'skills':
      return entry.ref?.section === 'skills';
    case 'actions':
      return entry.kind === 'action' || entry.kind === 'command';
  }
};

const KIND_TITLES: Readonly<Record<SearchEntry['kind'], string>> = {
  app: 'Apps',
  content: 'Documents',
  action: 'Settings and actions',
  command: 'Commands',
};

function roleForEntry(entry: SearchEntry): AppRole | null {
  if (entry.role) return entry.role;
  if (entry.ref) return OS_REGISTRY.windows.sectionOwner[entry.ref.section];
  if (entry.kind === 'command') return 'terminal';
  if (entry.kind === 'action') return 'settings';
  return null;
}

function EntryIcon({ entry, size }: { readonly entry: SearchEntry; readonly size: number }) {
  if (entry.ref?.section === 'resume') return <PdfFile size={size} />;
  if (entry.ref?.section === 'experience' || entry.ref?.section === 'education')
    return <AssetIcon id="system.windows-folder" size={size} />;
  if (entry.kind === 'action') return <Fl icon={entry.action === 'switch-os' ? flSwap : flSettings} size={size} />;
  if (entry.kind === 'command' && entry.command === 'winver') return <Fl icon={flInfo} size={size} />;
  const role = roleForEntry(entry);
  return role ? <AssetIcon id={winBinding(role).icon} size={size} /> : <Fl icon={flSearch} size={size} />;
}

const entryKindLabel = (entry: SearchEntry): string => {
  if (entry.kind === 'app') return 'App';
  if (entry.kind === 'command') return entry.command === 'winver' ? 'Run command' : 'Run in Terminal';
  if (entry.kind === 'action') return 'Action';
  if (!entry.ref) return 'Document';
  if (entry.ref.section === 'projects') return 'slug' in entry.ref && entry.ref.slug ? 'Project' : 'Folder';
  if (entry.ref.section === 'experience') return 'slug' in entry.ref && entry.ref.slug ? 'Role' : 'Folder';
  if (entry.ref.section === 'education') return 'slug' in entry.ref && entry.ref.slug ? 'School' : 'Folder';
  return SECTION_TITLES[entry.ref.section];
};

export interface LauncherProps {
  readonly mode: LauncherMode;
  readonly initialQuery: string;
  readonly scope?: 'files';
  readonly compact: boolean;
  readonly coarse: boolean;
  readonly closing: boolean;
  readonly live: boolean;
  readonly recent: readonly string[];
  readonly onMode: (mode: LauncherMode) => void;
  /** Close because something opened (focus goes to what opened). */
  readonly onClose: () => void;
  /** Close without choosing (Esc in the field): focus returns to the button that opened the panel. */
  readonly onDismiss: () => void;
  readonly onLock: () => void;
  readonly onRestart: () => void;
}

export function Launcher({
  mode,
  initialQuery,
  scope,
  compact,
  coarse,
  closing,
  live,
  recent,
  onMode,
  onClose,
  onDismiss,
  onLock,
  onRestart,
}: LauncherProps) {
  const shell = useWinShell();
  const [query, setQuery] = useState(initialQuery);
  const [chip, setChip] = useState<Chip>('all');
  const [engine, setEngine] = useState<Engine | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [view, setView] = useState<'pinned' | 'all' | 'letters'>('pinned');
  const panel = useRef<HTMLDivElement>(null);
  // Arriving in place of the loading placeholder (its chunk was not warm yet): no second entrance, before first paint.
  useLayoutEffect(() => {
    if (performance.now() - launcherPlaceholder.shownAt < 2000 && panel.current) panel.current.dataset.swap = '';
  }, []);
  const preview = useRef<HTMLDivElement>(null);
  const pinnedHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let alive = true;
    loadSearchEngine().then(
      (value) => alive && setEngine(value),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);

  // Coarse pointers: focus the "Pinned" heading, never the field (no keyboard popping up — WIN-START-08).
  useEffect(() => {
    if (coarse && mode === 'start') pinnedHeading.current?.focus({ preventScroll: true });
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const results = useMemo(() => {
    if (!engine) return [] as readonly SearchEntry[];
    const list = query.trim() ? engine.query(query) : engine.zero(recent);
    return list.filter((entry) => chipAccepts(chip, entry, scope));
  }, [engine, query, chip, scope, recent]);

  const groups: readonly ComboboxGroup[] = useMemo(() => {
    if (mode !== 'search') return [];
    if (!query.trim())
      return [
        {
          id: 'quick',
          label: 'Quick searches',
          options: results.slice(0, 3).map((entry) => ({ id: entry.id, label: entry.title })),
        },
        ...(results.length > 3
          ? [
              {
                id: 'recent',
                label: 'Recent',
                options: results.slice(3, 8).map((entry) => ({ id: entry.id, label: entry.title })),
              },
            ]
          : []),
      ];
    const [best, ...rest] = results;
    if (!best) return [];
    const byKind = new Map<SearchEntry['kind'], SearchEntry[]>();
    for (const entry of rest) byKind.set(entry.kind, [...(byKind.get(entry.kind) ?? []), entry]);
    return [
      {
        id: 'best',
        label: 'Best match',
        options: [{ id: best.id, label: best.title, description: entryKindLabel(best) }],
      },
      ...[...byKind].map(([kind, entries]) => ({
        id: kind,
        label: KIND_TITLES[kind],
        options: entries.map((entry) => ({ id: entry.id, label: entry.title, description: entry.subtitle })),
      })),
    ];
  }, [mode, query, results]);

  const byId = useMemo(() => new Map((engine?.entries ?? []).map((entry) => [entry.id, entry])), [engine]);
  const activeEntry = (active && byId.get(active)) || results[0] || null;

  const run = (entry: SearchEntry) => {
    const originId = LAUNCHER_ID;
    if (entry.kind === 'command') {
      onClose();
      if (entry.command === 'winver') shell.openWinver();
      else if (entry.command) shell.runInTerminal(entry.command);
      return;
    }
    if (entry.kind === 'action') {
      onClose();
      switch (entry.action) {
        case 'switch-os':
          dispatchSoon({ type: 'SWITCH_OS', to: null, via: 'switch' });
          return;
        case 'open-resume':
          dispatchSoon({
            type: 'OPEN_APP',
            os: 'windows',
            role: 'browser',
            location: { kind: 'content', ref: { section: 'resume' } },
            originId,
          });
          return;
        case 'start-tour':
          shell.startTour();
          return;
        case 'toggle-sound':
        case 'reduce-motion':
          requestIntent(
            entry.action === 'toggle-sound'
              ? { kind: 'settings', page: 'system', card: 'sound' }
              : { kind: 'settings', page: 'accessibility', card: 'animation' },
          );
          dispatchSoon({ type: 'OPEN_APP', os: 'windows', role: 'settings', originId });
          return;
        case 'show-shortcuts':
          shell.showShortcuts();
          return;
        default:
          return;
      }
    }
    onClose();
    if (entry.ref)
      dispatchSoon({
        type: 'OPEN_APP',
        os: 'windows',
        role: 'files',
        location: { kind: 'content', ref: entry.ref },
        originId,
      });
    else if (entry.role) dispatchSoon({ type: 'OPEN_APP', os: 'windows', role: entry.role, originId });
  };

  const onSelect = (id: string) => {
    const entry = byId.get(id);
    if (entry) run(entry);
  };

  const onQuery = (value: string) => {
    setQuery(value);
    if (value && mode === 'start') {
      onMode('search');
      setView('pinned');
    }
  };

  const onInputKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'ArrowRight' || mode !== 'search' || !activeEntry) return;
    const input = event.currentTarget;
    if (input.selectionStart !== input.value.length) return;
    const first = preview.current?.querySelector<HTMLElement>('button, a[href]');
    if (!first) return;
    event.preventDefault();
    first.focus();
  };

  const placeholder = mode === 'start' ? 'Search for apps, settings, and documents' : 'Type here to search';

  return (
    <div
      ref={panel}
      id={LAUNCHER_ID}
      className={styles.launcher}
      role="dialog"
      aria-modal={compact || mode === 'search' ? 'true' : undefined}
      aria-label={mode === 'start' ? 'Start' : 'Search'}
      data-launcher={mode}
      data-state={closing ? 'closing' : 'open'}
      data-acrylic={live ? 'live' : 'tint'}
      data-compact={compact || undefined}
    >
      <FocusScope trapped={compact || mode === 'search'} className={styles.launcherScope}>
        <Combobox
          label="Search"
          value={query}
          onChange={onQuery}
          groups={groups}
          onSelect={onSelect}
          onClose={onDismiss}
          placeholder={placeholder}
          // Start / Search open by the visitor's own request; the field takes focus (APG combobox dialog) — except
          // Start on a coarse pointer, where the heading takes it so the on-screen keyboard stays down.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={!coarse || mode === 'search'}
          className={styles.searchBox}
          inputClassName={styles.searchInput}
          listClassName={styles.results}
          onActiveChange={setActive}
          onInputKeyDown={onInputKey}
          renderOption={(option, isActive) => {
            const entry = byId.get(option.id);
            return entry ? (
              <ResultRow
                entry={entry}
                active={isActive}
                best={groups[0]?.id === 'best' && groups[0].options[0]?.id === option.id}
              />
            ) : (
              option.label
            );
          }}
          emptyState={
            <p className={styles.searchEmpty}>
              No results for &lsquo;{query}&rsquo;. <a href="/plain">Search the plain portfolio</a>
            </p>
          }
          beforeList={
            mode === 'search' ? (
              <div className={styles.chips} role="radiogroup" aria-label="Filter results">
                {CHIPS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={chip === item.id}
                    className={styles.chip}
                    onClick={() => setChip(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null
          }
        />
        {mode === 'search' ? (
          <SearchPreview ref={preview} entry={activeEntry} onRun={run} />
        ) : view === 'pinned' ? (
          <StartHome pinnedHeading={pinnedHeading} compact={compact} onAll={() => setView('all')} onClose={onClose} />
        ) : (
          <AllApps
            letters={view === 'letters'}
            onLetters={(on) => setView(on ? 'letters' : 'all')}
            onBack={() => setView('pinned')}
            onClose={onClose}
          />
        )}
        {mode === 'start' ? <StartFooter onClose={onClose} onLock={onLock} onRestart={onRestart} /> : null}
      </FocusScope>
    </div>
  );
}

function ResultRow({
  entry,
  active,
  best,
}: {
  readonly entry: SearchEntry;
  readonly active: boolean;
  readonly best: boolean;
}) {
  return (
    <span className={styles.resultRow} data-best={best || undefined} data-active={active || undefined}>
      <span className={styles.resultIcon} aria-hidden="true">
        <EntryIcon entry={entry} size={best ? 32 : 20} />
      </span>
      <span className={styles.resultText}>
        <span className={styles.resultTitle}>{entry.title}</span>
        <span className={styles.resultSub}>
          {best ? entryKindLabel(entry) : (entry.subtitle ?? entryKindLabel(entry))}
        </span>
      </span>
    </span>
  );
}

const SearchPreview = function SearchPreview({
  ref,
  entry,
  onRun,
}: {
  readonly ref: React.RefObject<HTMLDivElement | null>;
  readonly entry: SearchEntry | null;
  readonly onRun: (entry: SearchEntry) => void;
}) {
  const shell = useWinShell();
  if (!entry)
    return (
      <div ref={ref} className={styles.previewPane} aria-live="off">
        <p className={styles.previewEmpty}>Search apps, projects, roles, skills and settings.</p>
      </div>
    );
  const project =
    entry.ref?.section === 'projects' && 'slug' in entry.ref && entry.ref.slug
      ? getProject(entry.ref.slug as ProjectSlug)
      : undefined;
  return (
    <section ref={ref} className={styles.previewPane} aria-label={`${entry.title} preview`} data-search-preview="">
      <span className={styles.previewIcon} aria-hidden="true">
        <EntryIcon entry={entry} size={64} />
      </span>
      <h2 className={styles.previewName}>{entry.title}</h2>
      <p className={styles.previewKind}>{entryKindLabel(entry)}</p>
      {project ? (
        <div className={styles.previewProject}>
          <p>{project.tagline}</p>
          {project.highlights[0] ? <p className={styles.previewHighlight}>{project.highlights[0]}</p> : null}
          <ul className={styles.previewTags} aria-label="Stack">
            {project.stack.slice(0, 6).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className={styles.previewActions}>
        <button type="button" className={styles.previewAction} onClick={() => onRun(entry)}>
          <Fl icon={entry.kind === 'command' ? flConsole : flOpen} />
          {entry.kind === 'command' && entry.command !== 'winver' ? 'Run in Terminal' : 'Open'}
        </button>
        {entry.ref ? (
          <>
            <button
              type="button"
              className={styles.previewAction}
              onClick={() => shell.copyLink(entry.ref ?? null, entry.title)}
            >
              <Fl icon={flLink} />
              Copy link
            </button>
            <a className={styles.previewAction} href={`/plain#${entry.ref.section}`}>
              <Fl icon={flOpen} />
              Open in plain view
            </a>
          </>
        ) : null}
      </div>
    </section>
  );
};

function Tile({ tile, onClose }: { readonly tile: StartTile; readonly onClose: () => void }) {
  const shell = useWinShell();
  const id = `start-${tile.id}`;
  return (
    <li>
      <KernelLink
        to={tile.to}
        id={id}
        originId={id}
        className={styles.tile}
        data-roving-item=""
        data-label={tile.label}
        onActivate={onClose}
        onPointerEnter={() => prefetchApp(tileRole(tile))}
        onFocus={() => prefetchApp(tileRole(tile))}
        onContextMenu={(event) => {
          event.preventDefault();
          const box = event.currentTarget.getBoundingClientRect();
          const at = event.button === 2 ? { x: event.clientX, y: event.clientY } : { x: box.left, y: box.bottom };
          shell.openMenu({
            label: `${tile.label} actions`,
            at,
            returnFocusTo: event.currentTarget,
            items: [
              {
                kind: 'item',
                id: 'open',
                label: 'Open',
                icon: <Fl icon={flOpen} />,
                onSelect: () => openTarget(tile.to, id, onClose),
              },
              { kind: 'item', id: 'pin', label: 'Pin to taskbar', disabled: true, onSelect: () => undefined },
              {
                kind: 'item',
                id: 'settings',
                label: 'App settings',
                icon: <Fl icon={flSettings} />,
                onSelect: () => {
                  onClose();
                  requestIntent({ kind: 'settings', page: 'apps' });
                  dispatchSoon({ type: 'OPEN_APP', os: 'windows', role: 'settings', originId: id });
                },
              },
            ],
          });
        }}
      >
        <span className={styles.tileIcon} aria-hidden="true">
          {tile.kind === 'app' && tile.role ? (
            <AssetIcon id={winBinding(tile.role).icon} size={32} priority />
          ) : tile.kind === 'pdf' ? (
            <PdfFile size={32} />
          ) : tile.kind === 'folder' ? (
            <AssetIcon id="system.windows-folder" size={32} />
          ) : (
            <AssetIcon id={winBinding(tileRole(tile)).icon} size={32} />
          )}
        </span>
        <span className={styles.tileLabel}>{tile.label}</span>
      </KernelLink>
    </li>
  );
}

/** The app a shortcut tile opens (its section's owner). */
const tileRole = (tile: StartTile): AppRole =>
  tile.role ?? ('ref' in tile.to ? OS_REGISTRY.windows.sectionOwner[tile.to.ref.section] : tile.to.role);

function openTarget(to: KernelTarget, originId: string, onClose: () => void) {
  onClose();
  if ('ref' in to)
    dispatchSoon({
      type: 'OPEN_APP',
      os: 'windows',
      role: 'files',
      location: { kind: 'content', ref: to.ref },
      originId,
    });
  else dispatchSoon({ type: 'OPEN_APP', os: 'windows', role: to.role, location: to.location, originId });
}

function StartHome({
  pinnedHeading,
  compact,
  onAll,
  onClose,
}: {
  readonly pinnedHeading: React.RefObject<HTMLHeadingElement | null>;
  readonly compact: boolean;
  readonly onAll: () => void;
  readonly onClose: () => void;
}) {
  const recommended = startRecommended();
  return (
    <div className={styles.startBody} data-start-home="">
      <section className={styles.startSection} aria-labelledby="start-pinned">
        <header className={styles.startHeader}>
          <h2 id="start-pinned" ref={pinnedHeading} tabIndex={-1} className={styles.startTitle}>
            Pinned
          </h2>
          <button type="button" className={styles.startMore} onClick={onAll}>
            All apps <Fl icon={flChevronRight} size={12} />
          </button>
        </header>
        <RovingGroup as="ul" orientation="grid" role="list" className={styles.pinned} aria-labelledby="start-pinned">
          {startPinned().map((tile) => (
            <Tile key={tile.id} tile={tile} onClose={onClose} />
          ))}
        </RovingGroup>
      </section>
      <section className={styles.startSection} aria-labelledby="start-recommended">
        <header className={styles.startHeader}>
          <h2 id="start-recommended" className={styles.startTitle}>
            Recommended
          </h2>
          {compact ? null : (
            <span className={styles.startMoreDisabled} aria-hidden="true">
              More <Fl icon={flChevronRight} size={12} />
            </span>
          )}
        </header>
        <ul className={styles.recommended} role="list">
          {recommended.map((item) => (
            <li key={item.id}>
              <KernelLink
                to={item.to}
                id={`rec-${item.id}`}
                originId={`rec-${item.id}`}
                className={styles.recItem}
                onActivate={onClose}
              >
                <span className={styles.recIcon} aria-hidden="true">
                  {item.kind === 'pdf' ? (
                    <PdfFile size={28} />
                  ) : item.kind === 'project' ? (
                    <AssetIcon id={winBinding('github').icon} size={28} />
                  ) : item.kind === 'now' ? (
                    <AssetIcon id={winBinding('browser').icon} size={28} />
                  ) : item.kind === 'role' ? (
                    <AssetIcon id="system.windows-folder" size={28} />
                  ) : (
                    <AssetIcon id={winBinding('mail').icon} size={28} />
                  )}
                </span>
                <span className={styles.recText}>
                  <span className={styles.recTitle}>{item.title}</span>
                  <span className={styles.recDetail}>{item.detail}</span>
                </span>
              </KernelLink>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function AllApps({
  letters,
  onLetters,
  onBack,
  onClose,
}: {
  readonly letters: boolean;
  readonly onLetters: (on: boolean) => void;
  readonly onBack: () => void;
  readonly onClose: () => void;
}) {
  const groups = allApps();
  const available = new Set(groups.map((group) => group.letter));
  const list = useRef<HTMLDivElement>(null);
  return (
    <div className={styles.startBody} data-all-apps="">
      <header className={styles.startHeader}>
        <h2 className={styles.startTitle} id="start-all">
          All apps
        </h2>
        <button type="button" className={styles.startMore} onClick={onBack}>
          <Fl icon={flChevronLeft} size={12} /> Back
        </button>
      </header>
      {letters ? (
        <RovingGroup
          as="div"
          orientation="grid"
          className={styles.letterGrid}
          role="group"
          aria-label="Jump to a letter"
        >
          {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => (
            <button
              key={letter}
              type="button"
              className={styles.letter}
              data-roving-item=""
              disabled={!available.has(letter)}
              onClick={() => {
                onLetters(false);
                setTimeout(
                  () => list.current?.querySelector<HTMLElement>(`[data-letter="${letter}"] + ul a`)?.focus(),
                  0,
                );
              }}
            >
              {letter}
            </button>
          ))}
        </RovingGroup>
      ) : (
        <div ref={list} className={styles.allList} aria-labelledby="start-all" role="group">
          {groups.map((group) => (
            <div key={group.letter}>
              <button
                type="button"
                className={styles.letterHeader}
                data-letter={group.letter}
                onClick={() => onLetters(true)}
              >
                <span className="sr-only">Letter </span>
                {group.letter}
                <span className="sr-only">, jump to another letter</span>
              </button>
              <ul role="list" className={styles.allGroup}>
                {group.apps.map((binding) => (
                  <li key={binding.slug}>
                    <KernelLink
                      to={{ os: 'windows', role: binding.role }}
                      id={`all-${binding.slug}`}
                      originId={`all-${binding.slug}`}
                      className={styles.allItem}
                      onActivate={onClose}
                    >
                      <AssetIcon id={binding.icon} size={24} />
                      <span>{binding.title}</span>
                    </KernelLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StartFooter({
  onClose,
  onLock,
  onRestart,
}: {
  readonly onClose: () => void;
  readonly onLock: () => void;
  readonly onRestart: () => void;
}) {
  const shell = useWinShell();
  const person = getPerson();
  const user = useRef<HTMLButtonElement>(null);
  const power = useRef<HTMLButtonElement>(null);
  const menuAt = (button: HTMLButtonElement | null) => {
    const box = button?.getBoundingClientRect();
    return { x: box?.left ?? 0, y: (box?.top ?? 0) - 8 };
  };
  const switchOs = () => {
    onClose();
    dispatchSoon({ type: 'SWITCH_OS', to: null, via: 'switch' });
  };
  return (
    <footer className={styles.startFooter}>
      <button
        ref={user}
        type="button"
        className={styles.userTile}
        aria-haspopup="menu"
        onClick={() =>
          shell.openMenu({
            label: person.name,
            at: menuAt(user.current),
            returnFocusTo: user.current,
            items: [
              {
                kind: 'item',
                id: 'about',
                label: 'About me',
                icon: <Fl icon={flPerson} />,
                onSelect: () => openTarget({ os: 'windows', role: 'browser' }, 'start-user', onClose),
              },
              {
                kind: 'item',
                id: 'settings',
                label: 'Settings',
                icon: <Fl icon={flSettings} />,
                onSelect: () => openTarget({ os: 'windows', role: 'settings' }, 'start-user', onClose),
              },
              {
                kind: 'item',
                id: 'tour',
                label: 'Take the tour',
                icon: <Fl icon={flApps} />,
                onSelect: () => (onClose(), shell.startTour()),
              },
              { kind: 'separator', id: 's' },
              {
                kind: 'item',
                id: 'switch',
                label: 'Switch operating system',
                icon: <Fl icon={flSwap} />,
                onSelect: switchOs,
              },
              {
                kind: 'item',
                id: 'lock',
                label: 'Lock',
                icon: <Fl icon={flLock} />,
                onSelect: () => (onClose(), onLock()),
              },
            ],
          })
        }
      >
        <span className={styles.avatar} aria-hidden="true">
          {initialsOf(person.name)}
        </span>
        <span>{person.givenName}</span>
      </button>
      <button
        ref={power}
        id="start-power"
        type="button"
        className={styles.powerButton}
        aria-label="Power"
        aria-haspopup="menu"
        onClick={() =>
          shell.openMenu({
            label: 'Power',
            at: menuAt(power.current),
            returnFocusTo: power.current,
            items: [
              {
                kind: 'item',
                id: 'sleep',
                label: 'Sleep',
                icon: <Fl icon={flMoon} />,
                onSelect: () => (onClose(), onLock()),
              },
              { kind: 'item', id: 'shutdown', label: 'Shut down', icon: <Fl icon={flPower} />, onSelect: switchOs },
              {
                kind: 'item',
                id: 'restart',
                label: 'Restart',
                icon: <Fl icon={flRefresh} />,
                onSelect: () => (onClose(), onRestart()),
              },
            ],
          })
        }
      >
        <Fl icon={flPower} size={16} />
      </button>
    </footer>
  );
}
