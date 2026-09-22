'use client';
/**
 * Spotlight — the iOS skin of system search (plans/ios/surfaces/spotlight.md, `IOS-SPOT-01…06`; shared/15).
 *   · Home blurs and dims (one blur surface); phone: the search field sits at the **bottom** (iOS 16+) above the
 *     keyboard, results scroll above it bounded by `--vvh`; full page: the field at the top centre with a 640 px column.
 *   · Zero state ("Siri Suggestions"): four suggested apps + Suggestions (Résumé · Projects · Contact) — instant; the
 *     index loads lazily (`SRCH-LAZY-01`).
 *   · Results in grouped cards: Top Hit · Applications · Projects · Experience · Skills · Actions · Try in Linux ·
 *     "Search in plain portfolio". Enter opens the top hit; a result opens with a flight **from its row**; Spotlight
 *     writes no history (the chosen result pushes one entry).
 *   · Commands are not run here (no terminal on iOS): they show "Try this in Linux", and switching happens only after
 *     an explicit confirm, with the command inserted at the Linux prompt — never run (`IOS-SPOT-04`).
 *   · Invoke: pull down on Home (the shell drives the reveal), the Search pill, Ctrl/Cmd+K, `/`. Cancel / swipe down /
 *     Esc (clear, then close) → Home; focus returns to the pill. Modal `dialog` "Search" with the Combobox primitive.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Combobox, type ComboboxGroup, type ComboboxOption } from '@/components/primitives/Combobox';
import type { ContentRef } from '@/data/schema';
import { analytics } from '@/lib/analytics/loader';
import { loadSearchEngine, type SearchEngine } from '@/lib/search/load';
import type { SearchEntry } from '@/lib/search/types';
import { drag } from '@/lib/motion/drag';
import { prefersReducedMotion } from '@/lib/motion/dur';
import {
  commits,
  iosBinding,
  SPOTLIGHT_SUGGESTED_APPS,
  SPOTLIGHT_SUGGESTIONS,
  type IosLayout,
  type IosRole,
} from '../model';
import { IOS_SPRINGS, springSamples } from '../motion';
import { Glyph } from '../ui/glyphs';
import { AppArt } from './Icons';
import styles from '../ios.module.css';

export type SpotlightChoice =
  | { readonly kind: 'app'; readonly role: IosRole; readonly origin: HTMLElement | null }
  | { readonly kind: 'content'; readonly ref: ContentRef; readonly origin: HTMLElement | null }
  | { readonly kind: 'action'; readonly action: NonNullable<SearchEntry['action']> }
  | { readonly kind: 'linux'; readonly command: string }
  | { readonly kind: 'plain'; readonly query: string };

export interface SpotlightHandle {
  /** Interactive reveal (pull-down): 0 hidden … 1 open. */
  setProgress(progress: number): void;
}

export interface SpotlightProps {
  readonly layout: IosLayout;
  readonly initialQuery?: string;
  readonly closing: boolean;
  /** Opened by a pull-down still under the finger: the entrance is driven, not played. */
  readonly interactive?: boolean;
  readonly onChoose: (choice: SpotlightChoice) => void;
  readonly onClose: () => void;
  readonly onClosed: () => void;
}

const GROUP_ORDER = [
  'top',
  'apps',
  'projects',
  'experience',
  'education',
  'skills',
  'other',
  'actions',
  'commands',
] as const;
type GroupId = (typeof GROUP_ORDER)[number];
const GROUP_LABEL: Readonly<Record<GroupId, string>> = {
  top: 'Top Hit',
  apps: 'Applications',
  projects: 'Projects',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  other: 'Portfolio',
  actions: 'Actions',
  commands: 'Try in Linux',
};

const groupOf = (entry: SearchEntry): GroupId => {
  if (entry.kind === 'app') return 'apps';
  if (entry.kind === 'action') return 'actions';
  if (entry.kind === 'command') return 'commands';
  const section = entry.ref?.section;
  if (section === 'projects' || section === 'experience' || section === 'education' || section === 'skills')
    return section;
  return 'other';
};

const IOS_ROLES_SET = new Set<string>(['browser', 'github', 'files', 'notes', 'mail', 'messages', 'settings']);

export const Spotlight = forwardRef<SpotlightHandle, SpotlightProps>(function Spotlight(
  { layout, initialQuery = '', closing, interactive = false, onChoose, onClose, onClosed },
  ref,
) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [engine, setEngine] = useState<SearchEngine | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    setProgress(progress) {
      const p = Math.max(0, Math.min(1, progress));
      if (root.current) root.current.style.opacity = String(p);
      if (panel.current) panel.current.style.transform = `translateY(${(1 - p) * (layout === 'phone' ? 40 : -40)}px)`;
    },
  }));

  useEffect(() => {
    let alive = true;
    loadSearchEngine('ios').then(
      (loaded) => alive && setEngine(loaded),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);

  // Entrance: blur/dim 0 → 1 and the field rising (spring r 0.38 ζ 1); a pull-down drives it instead.
  useEffect(() => {
    if (interactive) return;
    const el = root.current;
    if (!el || typeof el.animate !== 'function') return;
    if (prefersReducedMotion()) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
      return;
    }
    const { values, durationMs } = springSamples(IOS_SPRINGS.sheet, 12);
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
    panel.current?.animate(
      values.map((v) => ({ transform: `translateY(${(1 - v) * (layout === 'phone' ? 40 : -40)}px)` })),
      { duration: durationMs },
    );
    // Entrance only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!closing) return;
    const el = root.current;
    if (!el || typeof el.animate !== 'function') {
      onClosed();
      return;
    }
    el.style.opacity = '';
    const out = el.animate([{ opacity: Number(getComputedStyle(el).opacity) || 1 }, { opacity: 0 }], {
      duration: prefersReducedMotion() ? 150 : 200,
      fill: 'forwards',
    });
    out.onfinish = onClosed;
    out.oncancel = onClosed;
    // An interrupted exit (a reopen, or the surface replaced) is not a close: detach before cancelling.
    return () => {
      out.onfinish = null;
      out.oncancel = null;
      out.cancel();
    };
  }, [closing, onClosed]);

  const results = useMemo(() => (engine && query.trim() ? engine.query(query) : []), [engine, query]);
  const byId = useMemo(() => new Map(results.map((entry) => [entry.id, entry])), [results]);

  const groups: ComboboxGroup[] = useMemo(() => {
    if (!query.trim()) {
      return [
        {
          id: 'siri',
          label: 'Siri Suggestions',
          options: SPOTLIGHT_SUGGESTED_APPS.map((role) => ({
            id: `zero-app:${role}`,
            label: role === 'files' ? 'Files — Résumé' : iosBinding(role).title,
          })),
        },
        {
          id: 'suggestions',
          label: 'Suggestions',
          options: SPOTLIGHT_SUGGESTIONS.map((item) => ({ id: `zero-ref:${item.id}`, label: item.label })),
        },
      ];
    }
    const buckets = new Map<GroupId, ComboboxOption[]>();
    const usable = results.filter((entry) => entry.kind !== 'app' || (entry.role && IOS_ROLES_SET.has(entry.role)));
    usable.forEach((entry, index) => {
      const group = index === 0 ? 'top' : groupOf(entry);
      const list = buckets.get(group) ?? [];
      list.push({
        id: entry.id,
        label: entry.title,
        description: entry.kind === 'command' ? 'Try this in Linux' : entry.subtitle,
      });
      buckets.set(group, list);
    });
    const list: ComboboxGroup[] = GROUP_ORDER.filter((id) => buckets.has(id)).map((id) => ({
      id,
      label: GROUP_LABEL[id],
      options: buckets.get(id)!,
    }));
    // The plain-portfolio fallback appears once the index answered (Enter never jumps there while it loads).
    if (engine)
      list.push({
        id: 'plain',
        label: 'Search in',
        options: [{ id: 'plain:search', label: 'Search in plain portfolio' }],
      });
    return list;
  }, [query, results, engine]);

  // Enter pressed before the index arrived: remember it and open the top hit as soon as results exist.
  const pendingEnter = useRef(false);
  useEffect(() => {
    if (!pendingEnter.current || !engine || !query.trim()) return;
    pendingEnter.current = false;
    const top = groups[0]?.options[0];
    if (top) select(top.id);
    // Runs when the engine arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  const optionEl = (id: string) =>
    root.current?.querySelector<HTMLElement>(`[data-combobox-option][id$="-option-${CSS.escape(id)}"]`) ?? null;

  const select = (id: string) => {
    const origin = optionEl(id);
    if (id.startsWith('zero-app:')) {
      const role = id.slice(9) as IosRole;
      analytics.track({ name: 'search_used', os: 'ios', resultKind: 'app' });
      onChoose(
        role === 'files' ? { kind: 'content', ref: { section: 'resume' }, origin } : { kind: 'app', role, origin },
      );
      return;
    }
    if (id.startsWith('zero-ref:')) {
      const item = SPOTLIGHT_SUGGESTIONS.find((candidate) => `zero-ref:${candidate.id}` === id);
      if (!item) return;
      analytics.track({ name: 'search_used', os: 'ios', resultKind: 'content' });
      onChoose({ kind: 'content', ref: item.ref, origin });
      return;
    }
    if (id === 'plain:search') {
      analytics.track({ name: 'search_used', os: 'ios', resultKind: 'none' });
      onChoose({ kind: 'plain', query });
      return;
    }
    const entry = byId.get(id);
    if (!entry) return;
    analytics.track({ name: 'search_used', os: 'ios', resultKind: entry.kind });
    if (entry.kind === 'command' && entry.command) {
      // Never auto-switch: ask first (insert-only on the Linux side).
      setConfirm(entry.command);
      return;
    }
    if (entry.kind === 'app' && entry.role) onChoose({ kind: 'app', role: entry.role as IosRole, origin });
    else if (entry.kind === 'action' && entry.action) onChoose({ kind: 'action', action: entry.action });
    else if (entry.ref) onChoose({ kind: 'content', ref: entry.ref, origin });
  };

  const renderOption = (option: ComboboxOption) => {
    const role = option.id.startsWith('zero-app:')
      ? (option.id.slice(9) as IosRole)
      : byId.get(option.id)?.kind === 'app'
        ? (byId.get(option.id)?.role as IosRole | undefined)
        : undefined;
    const entry = byId.get(option.id);
    return (
      <span className={styles.spotRow}>
        {role && IOS_ROLES_SET.has(role) ? (
          <AppArt role={role} size={36} />
        ) : (
          <span className={styles.spotGlyph} aria-hidden="true">
            <Glyph
              name={
                entry?.kind === 'command'
                  ? 'play'
                  : entry?.kind === 'action'
                    ? 'gear'
                    : option.id === 'plain:search'
                      ? 'plain'
                      : entry?.ref?.section === 'projects'
                        ? 'repo'
                        : entry?.ref?.section === 'experience'
                          ? 'briefcase'
                          : entry?.ref?.section === 'education'
                            ? 'graduation'
                            : 'doc'
              }
              size={20}
            />
          </span>
        )}
        <span className={styles.spotText}>
          <span className={styles.spotTitle}>{option.label}</span>
          {option.description ? <span className={styles.spotSub}>{option.description}</span> : null}
        </span>
        <Glyph name="chevron-right" size={14} strokeWidth={2.4} className={styles.spotChevron} />
      </span>
    );
  };

  // Swipe down on the results (phone) dismisses (projected).
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' || (event.target as Element).closest('input, button, [role="option"]')) return;
    const el = panel.current;
    if (!el) return;
    let velocity = 0;
    let last = { t: performance.now(), y: 0 };
    drag(el, event.nativeEvent, {
      threshold: 8,
      onMove: (_dx, dy) => {
        const t = performance.now();
        if (t > last.t) velocity = ((dy - last.y) / (t - last.t)) * 1000;
        last = { t, y: dy };
        el.style.transform = `translateY(${Math.max(0, dy)}px)`;
      },
      onEnd: ({ dy, moved }) => {
        el.style.transform = '';
        if (moved && commits(Math.max(0, dy) / 300, velocity / 300)) onClose();
      },
    });
  };

  return (
    <div
      ref={root}
      className={styles.spotlight}
      data-layout={layout}
      data-spotlight=""
      data-closing={closing || undefined}
    >
      <div className={styles.spotBackdrop} aria-hidden="true" onClick={onClose} />
      {/* A modal surface owns Esc / Tab and its drag (keys reach it from the control inside). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className={styles.spotPanel}
        onPointerDown={onPointerDown}
        onKeyDown={(event) => {
          if (event.key === 'Tab') trap(event, panel.current);
        }}
      >
        {confirm ? (
          <div className={styles.spotConfirm} role="alertdialog" aria-labelledby="ios-spot-confirm">
            <p id="ios-spot-confirm">
              iOS has no terminal. <code>{confirm}</code> works in Linux — switch there? The command will be typed at
              the prompt for you to run; nothing runs by itself.
            </p>
            <div>
              <button
                type="button"
                className={styles.spotConfirmPrimary}
                onClick={() => onChoose({ kind: 'linux', command: confirm })}
              >
                Switch to Linux
              </button>
              {/* The safe choice takes focus when the question appears (nothing switches without a press). */}
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <button type="button" className={styles.spotConfirmSecondary} onClick={() => setConfirm(null)} autoFocus>
                Stay in iOS
              </button>
            </div>
          </div>
        ) : null}
        <Combobox
          label="Search"
          value={query}
          onChange={setQuery}
          groups={groups}
          onSelect={select}
          onClose={onClose}
          placeholder="Search"
          // Opened by the visitor (pill, pull, ⌘K): the field takes their keystrokes at once.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          renderOption={renderOption}
          onInputKeyDown={(event) => {
            if (event.key === 'Enter' && !engine && query.trim()) {
              event.preventDefault();
              pendingEnter.current = true;
            }
          }}
          className={styles.spotCombobox}
          inputClassName={styles.spotInput}
          listClassName={styles.spotList}
          emptyState={
            engine ? (
              <div className={styles.spotEmpty}>
                <p>No results for “{query}”.</p>
                <a href="/plain">Search the plain portfolio</a>
              </div>
            ) : (
              <div className={styles.spotEmpty} aria-busy="true">
                <p>Searching…</p>
              </div>
            )
          }
        />
        <button type="button" className={styles.spotCancel} onClick={onClose} data-spot-cancel="">
          Cancel
        </button>
      </div>
    </div>
  );
});

function trap(event: React.KeyboardEvent, root: HTMLElement | null) {
  if (!root) return;
  const items = [...root.querySelectorAll<HTMLElement>('input, button:not([disabled]), a[href]')];
  if (items.length === 0) return;
  const first = items[0]!;
  const last = items[items.length - 1]!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
