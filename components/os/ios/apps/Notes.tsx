'use client';
/**
 * Notes — the skills and engineering depth as Apple Notes (plans/ios/apps/notes.md, `IOS-NOTES-01…05`).
 *   · phone: Folders ("iCloud" → Notes (n)) → Notes list (large title, search, "Pinned" then "Notes"; rows: title,
 *     date + first line) → a note on a warm paper canvas. Every pushed screen is session state (`WindowInstance.ui`
 *     `path`): the URL stays `/ios/notes` and the screen restores on return / reload;
 *   · notes are generated from the data by `notes-model` (Skills with checklists and dot meters, How I work, Stack by
 *     project as a table whose names open GitHub, Currently learning — absent when empty);
 *   · the note's nav bar: Share (copy link) · ⋯ (Copy link · Find in note). Find is an inline bar: `<mark>`s, Enter /
 *     Shift+Enter cycle, "Not found";
 *   · tapping the body once per session shows the read-only banner; tag chips filter the list;
 *   · "View as list" renders the shared `SkillsMatrix` (the plain alternative to the meters);
 *   · full page: three columns (folders · list · note); phone landscape: two (list · note). Text follows the Text Size
 *     preference (`--text-scale`) and browser zoom.
 * Intents: `{ kind: 'note', note }` (the Notes icon's quick actions) opens that note.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { SkillsMatrix } from '@/components/content';
import { Menu } from '@/components/primitives/Menu';
import type { SkillGroup } from '@/data/schema';
import { getExperience, getPerson, getProjects, getResume, getSkills } from '@/data/selectors';
import { subscribeIntents, takeIntent } from '../intents';
import { useAppUi, useAppUiJson, useIos, type IosServices } from '../shell-context';
import { Glyph } from '../ui/glyphs';
import { BarButton, Chip, contentHref, Group, Row, SearchField, uiStyles } from '../ui/kit';
import { NavStack, type NavScreen } from '../ui/NavStack';
import {
  buildNotes,
  countMatches,
  meterLabel,
  noteMatches,
  notesWithTag,
  shortDate,
  shouldCollapse,
  SKILL_COLLAPSE,
  skillMeta,
  splitMatches,
  type Note,
  type NoteBlock,
  type SkillLine,
} from './notes-model';
import type { IosAppProps } from './registry';
import styles from './notes.module.css';

const READ_ONLY = 'These notes are read-only — they’re about me, after all.';
const noteKey = (id: string) => `note:${id}`;

interface FindState {
  readonly note: string;
  readonly query: string;
  readonly index: number;
}

const isPlainClick = (event: MouseEvent) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

export default function Notes({ id, layout, landscape, headingId }: IosAppProps) {
  const ios = useIos();
  const skills = useMemo(() => getSkills(), []);
  const notes = useMemo(
    () => buildNotes({ skills, person: getPerson(), experience: getExperience(), projects: getProjects() }),
    [skills],
  );
  const date = shortDate(getResume().updated);
  const [path, setPath] = useAppUiJson<readonly string[]>(id, 'path', []);
  const [query, setQuery] = useAppUi(id, 'q', '');
  const [tag, setTag] = useAppUi(id, 'tag', '');
  const [plain, setPlain] = useAppUi(id, 'plain', '');
  const [readOnlyShown, setReadOnlyShown] = useAppUi(id, 'readonly', '');
  const [find, setFind] = useState<FindState | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const moreRef = useRef<HTMLButtonElement | null>(null);

  const split = layout === 'pad' ? 3 : landscape ? 2 : 1;
  const openId = path.find((entry) => entry.startsWith('note:'))?.slice(5) ?? null;
  const requested = openId ? notes.find((note) => note.id === openId) : undefined;
  // Split views always show a note (the first pinned one until the visitor picks another).
  const current = requested ?? (split > 1 ? notes[0] : undefined);

  const openNote = (noteId: string) => setPath(['list', noteKey(noteId)]);

  // Intents (the Notes icon's quick actions): one waiting at mount, and any that arrive while the app is open.
  const notesRef = useRef(notes);
  const setPathRef = useRef(setPath);
  useEffect(() => {
    notesRef.current = notes;
    setPathRef.current = setPath;
  });
  useEffect(() => {
    const apply = (noteId: string) => {
      if (notesRef.current.some((note) => note.id === noteId)) setPathRef.current(['list', noteKey(noteId)]);
    };
    const waiting = takeIntent('note');
    if (waiting) apply(waiting.note);
    return subscribeIntents((intent) => {
      if (intent.kind !== 'note') return;
      takeIntent('note');
      apply(intent.note);
    });
  }, []);

  const filtered = notesWithTag(notes, tag || null).filter((note) => noteMatches(note, query));
  const pinned = filtered.filter((note) => note.pinned);
  const others = filtered.filter((note) => !note.pinned);

  const findFor = current && find?.note === current.id ? find : null;

  const onTag = (next: string) => {
    setTag(next);
    setQuery(null);
    // On the phone the list is under the note: go back to it, filtered.
    if (split === 1) setPath(['list']);
  };

  // The control that cleared the filter disappears with it: focus moves to the search field (never to <body>).
  const searchRef = useRef<HTMLInputElement>(null);
  const clearTag = () => {
    setTag(null);
    searchRef.current?.focus({ preventScroll: true });
  };
  // Closing Find removes its field: focus returns to the ⋯ button that opened it.
  const closeFind = () => {
    setFind(null);
    moreRef.current?.focus({ preventScroll: true });
  };

  const showReadOnly = () => {
    if (readOnlyShown) return;
    setReadOnlyShown('1');
    ios.notify({ id: 'notes-read-only', role: 'notes', app: 'Notes', title: READ_ONLY });
  };

  // --- Pieces -------------------------------------------------------------------------------------------------------
  const noteRow = (note: Note) => {
    const selected = split > 1 && note.id === current?.id;
    return (
      <Row
        key={note.id}
        kind="button"
        pushKey={noteKey(note.id)}
        className={selected ? styles.current : undefined}
        aria-current={selected ? 'true' : undefined}
        title={<span className={styles.rowTitle}>{note.title}</span>}
        subtitle={
          <span className={styles.rowLine}>
            <span className={styles.rowDate}>{date}</span> {note.preview}
          </span>
        }
        accessory="none"
        onPress={() => openNote(note.id)}
      />
    );
  };

  const tagBar = tag ? (
    <div className={styles.tagBar} role="group" aria-label="Tag filter">
      <Chip selected onPress={clearTag}>
        #{tag}
      </Chip>
      <button type="button" className={uiStyles.textButton} onClick={clearTag}>
        Show all notes
      </button>
    </div>
  ) : null;

  const listBody = (): ReactNode => (
    <>
      {tagBar}
      {filtered.length === 0 ? (
        <div className={styles.empty} role="status">
          <p>No Results</p>
          <button
            type="button"
            className={uiStyles.textButton}
            onClick={() => {
              setQuery(null);
              clearTag();
            }}
          >
            Clear search
          </button>
        </div>
      ) : (
        <>
          {pinned.length > 0 ? (
            <Group header={<span className={styles.pinnedHeader}>Pinned</span>}>{pinned.map(noteRow)}</Group>
          ) : null}
          {others.length > 0 ? (
            // Headed but not a second "Notes" region (the app itself is the "Notes" region).
            <div className={styles.others}>
              <h4 className={uiStyles.groupHeader}>Notes</h4>
              <Group className={styles.othersGroup}>{others.map(noteRow)}</Group>
            </div>
          ) : null}
        </>
      )}
      <p className={styles.count} aria-hidden="true">
        {filtered.length} {filtered.length === 1 ? 'Note' : 'Notes'}
      </p>
    </>
  );

  const search = (
    <SearchField
      value={query}
      onChange={(value) => setQuery(value || null)}
      label="Search notes"
      onCancel={() => setQuery(null)}
      inputRef={searchRef}
    />
  );

  const folderRow = (selected: boolean, onPress: () => void) => (
    <Row
      kind="button"
      pushKey="list"
      title="Notes"
      icon={{ node: <Glyph name="folder" size={24} className={styles.folderGlyph} /> }}
      value={String(notes.length)}
      accessory={selected ? 'none' : 'chevron'}
      className={selected ? styles.current : undefined}
      aria-current={selected ? 'true' : undefined}
      onPress={onPress}
    />
  );

  const trailing = (note: Note) => (
    <span className={styles.more}>
      <BarButton label="Share" glyph="share" onPress={() => void ios.copyLink({ section: 'skills' }, note.title)} />
      <span ref={(el) => void (moreRef.current = el?.querySelector('button') ?? null)} className={styles.moreAnchor}>
        <BarButton
          label="More"
          glyph="ellipsis"
          aria-haspopup="menu"
          aria-expanded={menuFor === note.id}
          onPress={() => setMenuFor(menuFor === note.id ? null : note.id)}
        />
        {menuFor === note.id ? (
          <Menu
            label="Note actions"
            className={styles.menu}
            returnFocusTo={moreRef}
            onClose={() => setMenuFor(null)}
            items={[
              {
                kind: 'item',
                id: 'copy-link',
                label: 'Copy link',
                icon: <Glyph name="link" size={18} />,
                onSelect: () => void ios.copyLink({ section: 'skills' }, note.title),
              },
              {
                kind: 'item',
                id: 'find',
                label: 'Find in note',
                icon: <Glyph name="find" size={18} />,
                onSelect: () => setFind({ note: note.id, query: '', index: 0 }),
              },
            ]}
          />
        ) : null}
      </span>
    </span>
  );

  const noteScreen = (note: Note): NavScreen => ({
    key: noteKey(note.id),
    title: note.title,
    large: true,
    tone: 'paper',
    trailing: trailing(note),
    render: () => (
      <NoteView
        key={note.id}
        note={note}
        skills={skills}
        ios={ios}
        plain={plain === '1'}
        onPlain={(next) => setPlain(next ? '1' : null)}
        onTag={onTag}
        onBody={showReadOnly}
        find={findFor}
        onFind={(next) => (next ? setFind(next) : closeFind())}
      />
    ),
  });

  const listScreen: NavScreen = {
    key: 'list',
    title: 'Notes',
    large: true,
    accessory: search,
    render: listBody,
  };

  const foldersScreen: NavScreen = {
    key: 'folders',
    title: 'Folders',
    large: true,
    render: () => <Group header="All iCloud">{folderRow(false, () => setPath(['list']))}</Group>,
  };

  // --- Phone portrait: one stack --------------------------------------------------------------------------------------
  if (split === 1) {
    const screens: NavScreen[] = [foldersScreen];
    if (path[0] === 'list' || requested) screens.push(listScreen);
    if (requested) screens.push(noteScreen(requested));
    return (
      <div className={styles.notes} aria-labelledby={headingId}>
        <NavStack id="notes" window={id} screens={screens} onPop={(to) => setPath(to === 0 ? null : ['list'])} />
      </div>
    );
  }

  // --- Split views: pad (folders · list · note), phone landscape (list · note) ---------------------------------------
  return (
    <div className={`${styles.notes} ${styles.split}`} data-columns={split} aria-labelledby={headingId}>
      {split === 3 ? (
        <nav className={styles.folders} aria-labelledby="notes-folders-title">
          <h3 id="notes-folders-title" className={styles.columnTitle}>
            Folders
          </h3>
          <Group header="All iCloud">{folderRow(true, () => undefined)}</Group>
        </nav>
      ) : null}
      {/* A plain column (not a landmark): the app itself is the "Notes" region. */}
      <div className={styles.list} data-notes-list="">
        <h3 className={styles.columnTitle}>Notes</h3>
        <div className={styles.listSearch}>{search}</div>
        {listBody()}
      </div>
      <div className={styles.detail}>
        {current ? (
          <NavStack id="notes-detail" window={id} screens={[noteScreen(current)]} onPop={() => undefined} />
        ) : null}
      </div>
    </div>
  );
}

// --- One note ---------------------------------------------------------------------------------------------------------

function NoteView({
  note,
  skills,
  ios,
  plain,
  onPlain,
  onTag,
  onBody,
  find,
  onFind,
}: {
  readonly note: Note;
  readonly skills: readonly SkillGroup[];
  readonly ios: IosServices;
  readonly plain: boolean;
  readonly onPlain: (next: boolean) => void;
  readonly onTag: (tag: string) => void;
  readonly onBody: () => void;
  readonly find: FindState | null;
  readonly onFind: (next: FindState | null) => void;
}) {
  const article = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState<readonly string[]>([]);
  const query = find?.query ?? '';
  const total = find ? countMatches(note, query) : 0;
  const index = total > 0 ? (((find?.index ?? 0) % total) + total) % total : 0;
  const finding = query.trim().length > 0;
  const collapse = shouldCollapse(skills) && !finding;
  // Find reads the note itself: while it has a query the note shows its own text (the list view has no highlights).
  const showPlain = plain && note.id === 'skills' && !finding;

  // Tapping the body (not a link, chip or control) shows the read-only banner once per session.
  const onBodyRef = useRef(onBody);
  useEffect(() => {
    onBodyRef.current = onBody;
  });
  useEffect(() => {
    const el = article.current;
    if (!el) return;
    const handler = (event: PointerEvent) => {
      if ((event.target as Element).closest('a, button, input, label, [role="search"]')) return;
      onBodyRef.current();
    };
    el.addEventListener('pointerup', handler);
    return () => el.removeEventListener('pointerup', handler);
  }, []);

  // The find bar takes focus when it opens.
  const open = find !== null;
  useEffect(() => {
    if (open) input.current?.focus({ preventScroll: true });
  }, [open]);

  // The current match is marked and scrolled into view.
  useLayoutEffect(() => {
    const el = article.current;
    if (!el) return;
    const marks = el.querySelectorAll<HTMLElement>('mark[data-find]');
    marks.forEach((mark, i) => mark.toggleAttribute('data-current', i === index));
    const target = marks[index];
    if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'center' });
  }, [index, query]);

  // Highlighting in reading order (the same order as `noteStrings`, so `countMatches` agrees with the marks).
  const hl = (text: string): ReactNode => {
    if (!finding) return text;
    const parts = splitMatches(text, query);
    return parts.map((part, i) =>
      part.match ? (
        <mark key={i} data-find="" className={styles.mark}>
          {part.text}
        </mark>
      ) : (
        part.text
      ),
    );
  };

  const step = (delta: number) => find && total > 0 && onFind({ ...find, index: index + delta });

  const checklist = (block: Extract<NoteBlock, { kind: 'checklist' }>) => {
    const open = expanded.includes(block.group);
    const shown = collapse && !open ? block.items.slice(0, SKILL_COLLAPSE.visible) : block.items;
    return (
      <>
        <ul className={styles.checklist} role="list">
          {shown.map((item) => (
            <SkillItem key={item.name} item={item} name={hl(item.name)} />
          ))}
        </ul>
        {collapse && block.items.length > SKILL_COLLAPSE.visible ? (
          <button
            type="button"
            className={`${uiStyles.textButton} ${styles.showAll}`}
            aria-expanded={open}
            onClick={() =>
              setExpanded((all) => (open ? all.filter((group) => group !== block.group) : [...all, block.group]))
            }
          >
            {open ? 'Show less' : `Show all ${block.items.length}`}
          </button>
        ) : null}
      </>
    );
  };

  const renderBlock = (block: NoteBlock, i: number): ReactNode => {
    switch (block.kind) {
      case 'heading':
        return (
          <h4 key={i} className={styles.heading}>
            {hl(block.text)}
          </h4>
        );
      case 'paragraph':
        return (
          <p key={i} className={styles.paragraph}>
            {hl(block.text)}
          </p>
        );
      case 'bullets':
        return (
          <ul key={i} className={styles.bullets}>
            {block.items.map((item) => (
              <li key={item}>{hl(item)}</li>
            ))}
          </ul>
        );
      case 'checklist':
        return <div key={i}>{checklist(block)}</div>;
      case 'table':
        return (
          <div key={i} className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className="sr-only">{block.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">{hl(block.columns[0])}</th>
                  <th scope="col">{hl(block.columns[1])}</th>
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row) => {
                  const ref = { section: 'projects', slug: row.slug } as const;
                  return (
                    <tr key={row.slug}>
                      <th scope="row">
                        <a
                          href={contentHref(ref)}
                          className={styles.projectLink}
                          onClick={(event) => {
                            if (!isPlainClick(event)) return;
                            event.preventDefault();
                            ios.openContent(ref, event.currentTarget);
                          }}
                        >
                          {hl(row.name)}
                        </a>
                      </th>
                      <td>{hl(row.stack.join(', '))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
    }
  };

  return (
    <article ref={article} className={styles.note} aria-label={note.title}>
      {find ? (
        <div className={styles.findBar} role="search">
          <label className={styles.findField}>
            <Glyph name="search" size={16} strokeWidth={2.2} />
            <span className="sr-only">Find in note</span>
            <input
              ref={input}
              type="search"
              value={find.query}
              placeholder="Find in note"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => onFind({ ...find, query: event.target.value, index: 0 })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  step(event.shiftKey ? -1 : 1);
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  onFind(null);
                }
              }}
            />
          </label>
          <span className={styles.findCount} role="status">
            {finding ? (total > 0 ? `${index + 1} of ${total}` : 'Not found') : ''}
          </span>
          <button
            type="button"
            className={styles.findStep}
            aria-label="Previous match"
            disabled={total === 0}
            onClick={() => step(-1)}
          >
            <Glyph name="chevron-down" size={18} strokeWidth={2.4} className={styles.up} />
          </button>
          <button
            type="button"
            className={styles.findStep}
            aria-label="Next match"
            disabled={total === 0}
            onClick={() => step(1)}
          >
            <Glyph name="chevron-down" size={18} strokeWidth={2.4} />
          </button>
          <button
            type="button"
            className={`${uiStyles.textButton} ${uiStyles.textButtonBold}`}
            onClick={() => onFind(null)}
          >
            Done
          </button>
        </div>
      ) : null}

      {note.id === 'skills' ? (
        <div className={styles.viewToggle}>
          <button type="button" className={styles.toggle} aria-pressed={plain} onClick={() => onPlain(!plain)}>
            <Glyph name="list" size={18} />
            View as list
          </button>
        </div>
      ) : null}

      {showPlain ? (
        <div className={styles.plain}>
          <SkillsMatrix data={skills} headingLevel={4} density="compact" />
        </div>
      ) : (
        note.blocks.map(renderBlock)
      )}

      {note.tags.length > 0 ? (
        <ul className={styles.tags} role="list" aria-label="Tags">
          {note.tags.map((tag) => (
            <li key={tag}>
              <Chip onPress={() => onTag(tag)}>{hl(`#${tag}`)}</Chip>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

/** A checklist line: a static circle (decorative), the name, and — only when published — the dot meter and years. */
function SkillItem({ item, name }: { readonly item: SkillLine; readonly name: ReactNode }) {
  const label = meterLabel(item);
  const meta = skillMeta(item);
  return (
    <li className={styles.checkItem}>
      <span className={styles.circle} aria-hidden="true" />
      <span className={styles.skillName}>{name}</span>
      {label && item.level ? (
        <>
          <span className={styles.meter} role="img" aria-label={label}>
            {[1, 2, 3, 4, 5].map((dot) => (
              <i key={dot} data-on={dot <= item.level! || undefined} />
            ))}
          </span>
          <span className={styles.meta} aria-hidden="true">
            {meta}
          </span>
        </>
      ) : meta ? (
        <span className={styles.meta}>{meta}</span>
      ) : null}
    </li>
  );
}
