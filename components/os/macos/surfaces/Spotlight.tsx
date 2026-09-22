'use client';
/**
 * Spotlight — the macOS skin of system-wide search (plans/macos/surfaces/spotlight.md, `MAC-SPOT-01…06`; shared/15).
 *   · a centred 680 px bar at 22 % of the workspace (a full-width top sheet in compact, bounded by `--vvh`);
 *   · opens instantly on the zero state (Résumé · Projects · Contact · recents) while the index chunk loads;
 *   · live matching (no debounce); the result count is announced after 400 ms; IME text matches on compositionend;
 *   · results grouped Top Hit · Applications · Portfolio · Projects · Experience · Skills · Actions · Terminal, with a
 *     preview pane (hidden under 700 px) built from the content's own text view + its primary action;
 *   · Enter opens the result through the kernel from the panel's rect (one kernel action, one history entry);
 *     "Run in Terminal" inserts the command, never runs it; Esc clears, then closes; focus returns to the invoker;
 *   · a modal dialog "Spotlight Search" (Combobox + Listbox); the Shell makes the background inert while it is open.
 * Appear: scale 0.98 → 1 + fade 120 ms; close: fade 100 ms (a non-interactive ghost); reduced motion: instant.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { renderText, viewDataFor } from '@/components/content';
import { Combobox, type ComboboxGroup, type ComboboxOption } from '@/components/primitives/Combobox';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { SECTION_TITLES } from '@/data/content-index';
import { analytics } from '@/lib/analytics/loader';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { loadSearchEngine, type SearchEngine } from '@/lib/search/load';
import type { SearchEntry, SearchResult } from '@/lib/search/types';
import { getPrefs } from '@/stores/prefs-store';
import { dispatchSoon } from '@/stores/kernel-store';
import { useKernel } from '@/stores/kernel-context';
import { preloadApp } from '../apps/registry';
import { DocumentGlyph, FolderGlyph, SearchGlyph } from '../icons';
import { CheckGlyph, PlayGlyph } from '../glyphs';
import { macBinding } from '../model';
import { MAC_TIMING } from '../timing';
import { openRef, openResume, runMacCommand } from '../run-command';
import { closeOverlay, returnFocus, setSpotlightQuery, useMacUi } from '../ui';
import styles from './spotlight.module.css';

export const SPOTLIGHT_ID = 'mac-spotlight';

/**
 * Terminal eggs Spotlight recognises as "Run in Terminal" (shared/21 "Discovery") — found by typing them, never listed
 * in the zero state.
 */
export const MAC_SEARCH_EXTRAS: readonly SearchEntry[] = [
  {
    id: 'command:neofetch',
    kind: 'command',
    title: 'neofetch',
    subtitle: 'Run in Terminal',
    keywords: ['neofetch', 'system info', 'specs'],
    command: 'neofetch',
    weight: 1,
  },
  {
    id: 'command:sudo-hire-me',
    kind: 'command',
    title: 'sudo hire-me',
    subtitle: 'Run in Terminal',
    keywords: ['sudo hire-me', 'hire', 'hire me'],
    command: 'sudo hire-me',
    weight: 1,
  },
];

type GroupId =
  'top' | 'apps' | 'portfolio' | 'projects' | 'experience' | 'skills' | 'actions' | 'commands' | 'suggested' | 'recent';

const GROUP_LABELS: Readonly<Record<GroupId, string>> = {
  top: 'Top Hit',
  apps: 'Applications',
  portfolio: 'Portfolio',
  projects: 'Projects',
  experience: 'Experience',
  skills: 'Skills',
  actions: 'Actions',
  commands: 'Terminal',
  suggested: 'Suggestions',
  recent: 'Recent',
};
const ORDER: readonly GroupId[] = [
  'top',
  'apps',
  'portfolio',
  'projects',
  'experience',
  'skills',
  'actions',
  'commands',
];

const groupOf = (entry: SearchEntry): GroupId => {
  if (entry.kind === 'app') return 'apps';
  if (entry.kind === 'action') return 'actions';
  if (entry.kind === 'command') return 'commands';
  const section = entry.ref?.section;
  if (section === 'projects') return 'projects';
  if (section === 'experience' || section === 'education') return 'experience';
  if (section === 'skills') return 'skills';
  return 'portfolio';
};

/** Session recents (most recent first, at most 3) — never persisted. */
let recents: readonly string[] = [];
const remember = (id: string) => {
  recents = [id, ...recents.filter((item) => item !== id)].slice(0, 3);
};
/** Test seam. */
export const resetSpotlightRecents = () => {
  recents = [];
};

/** Group results for the list: the best match is the Top Hit, then each kind in the spec's order. */
export function groupResults(
  results: readonly SearchEntry[],
): readonly { id: GroupId; entries: readonly SearchEntry[] }[] {
  if (!results.length) return [];
  const [top, ...rest] = results;
  const groups = new Map<GroupId, SearchEntry[]>([['top', [top!]]]);
  for (const entry of rest) {
    const id = groupOf(entry);
    groups.set(id, [...(groups.get(id) ?? []), entry]);
  }
  return ORDER.filter((id) => groups.has(id)).map((id) => ({ id, entries: groups.get(id)! }));
}

function EntryIcon({ entry, size }: { entry: SearchEntry; size: number }) {
  if (entry.kind === 'app' && entry.role) return <AssetIcon id={macBinding(entry.role).icon} size={size} />;
  if (entry.kind === 'command') return <PlayGlyph size={size * 0.8} />;
  if (entry.kind === 'action') return <CheckGlyph size={size * 0.8} />;
  const collection = entry.ref && !('slug' in entry.ref && entry.ref.slug) && entry.ref.section !== 'resume';
  return collection ? <FolderGlyph width={size} height={size} /> : <DocumentGlyph width={size} height={size} />;
}

/** What the primary action does, in words (the preview button, the Enter hint). */
function actionLabel(entry: SearchEntry): string {
  if (entry.kind === 'command') return 'Run in Terminal';
  if (entry.kind === 'app' && entry.role) return `Open ${macBinding(entry.role).title}`;
  if (entry.kind === 'action') return entry.title;
  if (entry.ref?.section === 'resume') return 'Open in Preview';
  if (entry.ref) {
    const role = entryRole(entry);
    return role ? `Open in ${macBinding(role).title}` : 'Open';
  }
  return 'Open';
}

/** The app a result opens in (content → the section's macOS owner, from the registry). */
const entryRole = (entry: SearchEntry) =>
  entry.role ?? (entry.ref ? OS_REGISTRY.macos.sectionOwner[entry.ref.section] : null);

/** Run a result: one kernel action (the window opens from the panel's rect); Spotlight writes no history itself. */
export function runEntry(entry: SearchEntry): void {
  remember(entry.id);
  analytics.track({ name: 'search_used', os: 'macos', resultKind: entry.kind });
  closeOverlay('spotlight');
  if (entry.kind === 'command' && entry.command) {
    runMacCommand({ kind: 'terminal-insert', command: entry.command });
    return;
  }
  if (entry.kind === 'app' && entry.role) {
    runMacCommand({ kind: 'open', role: entry.role, origin: SPOTLIGHT_ID });
    return;
  }
  if (entry.ref) {
    if (entry.ref.section === 'resume') openResume(SPOTLIGHT_ID);
    else openRef(entry.ref, SPOTLIGHT_ID);
    return;
  }
  switch (entry.action) {
    case 'switch-os':
      runMacCommand({ kind: 'switch-os' });
      return;
    case 'open-resume':
      openResume(SPOTLIGHT_ID);
      return;
    case 'start-tour':
      runMacCommand({ kind: 'tour' });
      return;
    case 'show-shortcuts':
      runMacCommand({ kind: 'shortcuts' });
      return;
    case 'toggle-sound': {
      const sound = getPrefs().sound;
      dispatchSoon({ type: 'SET_PREF', patch: { sound: { ...sound, enabled: !sound.enabled } } });
      return;
    }
    case 'reduce-motion':
      dispatchSoon({
        type: 'SET_PREF',
        patch: { motion: document.documentElement.dataset.motion === 'reduced' ? 'full' : 'reduced' },
      });
      return;
  }
}

function Preview({ entry, actionRef }: { entry: SearchEntry; actionRef: RefObject<HTMLButtonElement | null> }) {
  let lines: readonly string[] = [];
  if (entry.ref) {
    try {
      const { view, data } = viewDataFor(entry.ref);
      lines = renderText(view, data as never, 46)
        .filter((line) => line.trim())
        .slice(0, 9);
    } catch {
      lines = [];
    }
  }
  const kindLabel =
    entry.kind === 'app'
      ? 'Application'
      : entry.kind === 'command'
        ? 'Command'
        : entry.kind === 'action'
          ? 'Action'
          : entry.ref
            ? SECTION_TITLES[entry.ref.section]
            : '';
  return (
    <aside className={styles.preview} aria-label={`Preview: ${entry.title}`}>
      <div className={styles.previewIcon} aria-hidden="true">
        <EntryIcon entry={entry} size={56} />
      </div>
      <h3 className={styles.previewTitle}>{entry.title}</h3>
      <p className={styles.previewKind}>{entry.subtitle ?? kindLabel}</p>
      {lines.length ? (
        <pre className={styles.previewText} aria-hidden="true">
          {lines.join('\n')}
        </pre>
      ) : null}
      <button ref={actionRef} type="button" className={styles.previewAction} onClick={() => runEntry(entry)}>
        {actionLabel(entry)}
      </button>
    </aside>
  );
}

function Panel({ leaving, onGone }: { leaving: boolean; onGone: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const query = useMacUi((state) => state.spotlightQuery);
  const compact = useKernel((state) => state.viewport.posture === 'compact');
  const [engine, setEngine] = useState<SearchEngine | null>(null);
  const [failed, setFailed] = useState(false);
  const [match, setMatch] = useState(query);
  const [activeId, setActiveId] = useState<string | null>(null);
  const composing = useRef(false);

  useEffect(() => {
    let alive = true;
    loadSearchEngine('macos', MAC_SEARCH_EXTRAS).then(
      (loaded) => alive && setEngine(loaded),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, []);

  // Appear (scale + fade, 120 ms) and the leaving ghost (fade, 100 ms): transform and opacity only.
  useLayoutEffect(() => {
    const node = panel.current;
    if (!node || typeof node.animate !== 'function') {
      if (leaving) onGone();
      return;
    }
    if (prefersReducedMotion()) {
      if (leaving) onGone();
      return;
    }
    const animation = leaving
      ? node.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: MAC_TIMING.spotlight.outMs,
          easing: 'linear',
          fill: 'forwards',
        })
      : node.animate(
          [
            { opacity: 0, transform: `scale(${MAC_TIMING.spotlight.inScale})` },
            { opacity: 1, transform: 'none' },
          ],
          {
            duration: MAC_TIMING.spotlight.inMs,
            easing: MAC_TIMING.spotlight.ease,
          },
        );
    if (leaving) animation.finished.then(onGone, onGone);
    return () => animation.cancel();
  }, [leaving, onGone]);

  const hasQuery = match.trim().length > 0;
  const results: readonly SearchResult[] = hasQuery && engine ? engine.query(match) : [];
  const zero: readonly SearchEntry[] = engine ? engine.zero([]) : [];
  const recent = engine
    ? recents
        .map((id) => engine.entries.find((entry) => entry.id === id))
        .filter((entry): entry is SearchEntry => !!entry && !zero.some((z) => z.id === entry.id))
    : [];

  const byId = new Map<string, SearchEntry>();
  const toOption = (entry: SearchEntry): ComboboxOption => {
    byId.set(entry.id, entry);
    return { id: entry.id, label: entry.title, description: entry.subtitle };
  };
  const groups: ComboboxGroup[] = hasQuery
    ? groupResults(results).map((group) => ({
        id: group.id,
        label: GROUP_LABELS[group.id],
        options: group.entries.map(toOption),
      }))
    : [
        ...(zero.length ? [{ id: 'suggested', label: GROUP_LABELS.suggested, options: zero.map(toOption) }] : []),
        ...(recent.length ? [{ id: 'recent', label: GROUP_LABELS.recent, options: recent.map(toOption) }] : []),
      ];

  const active = (activeId && byId.get(activeId)) || null;
  const showPreview = !compact && active !== null;

  const onChange = (value: string) => {
    setSpotlightQuery(value);
    if (!composing.current) setMatch(value);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Tab moves into the preview's primary action (Shift+Tab stays in the field's natural order).
    if (event.key === 'Tab' && !event.shiftKey && showPreview && actionRef.current) {
      event.preventDefault();
      actionRef.current.focus();
    }
  };

  const renderOption = (option: ComboboxOption, isActive: boolean): ReactNode => {
    const entry = byId.get(option.id);
    if (!entry) return option.label;
    return (
      <span className={styles.option} data-active={isActive || undefined}>
        <span className={styles.optionIcon} aria-hidden="true">
          <EntryIcon entry={entry} size={20} />
        </span>
        <span className={styles.optionTitle}>{entry.title}</span>
        {entry.subtitle ? <span className={styles.optionSubtitle}> — {entry.subtitle}</span> : null}
      </span>
    );
  };

  return (
    <div
      ref={panel}
      id={SPOTLIGHT_ID}
      className={styles.panel}
      role="dialog"
      aria-modal="true"
      aria-label="Spotlight Search"
      data-spotlight=""
      data-leaving={leaving || undefined}
      inert={leaving || undefined}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={(event) => {
        composing.current = false;
        setMatch((event.target as HTMLInputElement).value);
      }}
    >
      <div className={styles.searchRow}>
        <SearchGlyph size={22} className={styles.magnifier} />
        <Combobox
          label="Spotlight Search"
          placeholder="Spotlight Search"
          value={query}
          onChange={onChange}
          groups={groups}
          onSelect={(id) => {
            const entry = byId.get(id);
            if (entry) runEntry(entry);
          }}
          onClose={() => closeOverlay('spotlight')}
          onActiveChange={(id) => {
            setActiveId(id);
            const entry = id ? byId.get(id) : null;
            const role = entry ? entryRole(entry) : null;
            if (role) preloadApp(role);
          }}
          onInputKeyDown={onInputKeyDown}
          statusDelayMs={400}
          // Spotlight opens by the visitor's own request; its field takes focus (APG combobox dialog).
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          className={styles.combobox}
          inputClassName={styles.input}
          listClassName={styles.list}
          renderOption={renderOption}
          emptyState={
            engine ? (
              <p className={styles.empty}>
                No results for “{match}”. <a href="/plain">Search the plain portfolio</a>
              </p>
            ) : failed ? (
              <p className={styles.empty}>
                Search couldn’t load. <a href="/plain">Read the plain portfolio</a>
              </p>
            ) : (
              <p className={styles.empty}>Searching…</p>
            )
          }
        />
      </div>
      {showPreview && active ? <Preview entry={active} actionRef={actionRef} /> : null}
    </div>
  );
}

/**
 * The Spotlight host: mounts the panel while the arbiter says Spotlight is open, keeps a non-interactive ghost for
 * the 100 ms close fade, and returns focus to whatever invoked it (derived during render — no effect sets state).
 */
export function Spotlight() {
  const open = useMacUi((state) => state.overlay === 'spotlight');
  const [shown, setShown] = useState(open);
  // Each opening is a fresh panel (reopening during the close fade gets a new, focused field).
  const [opening, setOpening] = useState(0);
  const [wasOpenRender, setWasOpenRender] = useState(open);
  if (open !== wasOpenRender) {
    setWasOpenRender(open);
    if (open) {
      setOpening((value) => value + 1);
      setShown(true);
    }
  }
  if (open && !shown) setShown(true);
  const onGone = useCallback(() => setShown(false), []);

  // Focus returns to the invoker when Spotlight closes without opening something (opening moves focus itself).
  const wasOpen = useRef(open);
  useEffect(() => {
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closed) return;
    // Opening a result moves focus itself; otherwise it goes back to the invoker (or the desktop's heading).
    const active = document.activeElement;
    if (!active || active === document.body || active.closest(`#${SPOTLIGHT_ID}`)) returnFocus('spotlight');
  }, [open]);

  if (!shown) return null;
  return (
    <div className={styles.layer} data-open={open || undefined}>
      <div
        className={styles.scrim}
        aria-hidden="true"
        onPointerDown={(event) => {
          event.preventDefault();
          closeOverlay('spotlight');
        }}
      />
      <Panel key={opening} leaving={!open} onGone={onGone} />
    </div>
  );
}
