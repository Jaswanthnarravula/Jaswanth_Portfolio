'use client';
/**
 * EditorBody — the one VS Code editor body both OSes render (plans/macos/apps/vscode.md `MAC-CODE-01…08`; plans/windows/
 * apps/vscode.md `WIN-CODE-02` "one shared component, no fork"). Each OS supplies only its chrome (macOS: traffic
 * lights + global menu bar; Windows: Mica title bar + in-window menus + command centre).
 *
 * Props (the whole API):
 *   files          `buildWorkspace(…)` — the read-only generated files (nothing is typed here)
 *   skills         `SkillGroup[]` — "View as plain skills list" (`SkillsMatrix`) and the Extensions view
 *   workspace      the folder name in the Explorer header ("jaswanth-portfolio")
 *   root           absolute workspace path for tooltips (`C:\Users\Jaswanth\portfolio`, `/Users/jaswanth/portfolio`)
 *   pathSeparator  '/' | '\\' — breadcrumbs and tab tooltips
 *   layout         controlled `{ sidebar, panel, minimap }`; `onLayout` receives the next value (the OS's toggles and
 *                  menus drive it too)
 *   icons          the OS's glyphs (activity bar, twisties, tabs, status bar)
 *   compact        phone posture: bottom activity bar, the Explorer is the first screen and files push in; no minimap,
 *                  no panel; code wraps softly
 *   terminal       the panel's content (node or render function), mounted the first time the panel opens — the OS
 *                  lazy-loads the terminal engine inside it (`MAC-CODE-06`, `WIN-CODE-04`)
 *   initial        a file shown first, pinned beside the README (the app's route section: skills → `skills.json`)
 *   ref            `EditorHandle` for the OS's menus: open · show · closeActive · selectAll · copyText · openPanel
 * Session state (tabs, active file, carets, side-bar view, tree) lives here. Behaviour: preview vs pinned tabs (max 6 —
 * ./tabs), the read-only status message once per session, inlay skill hints on hover / on the caret line, the Search
 * view on the shared matcher, a minimap that is a transform-scaled clone (hidden on tier 0 and below 600 px of editor
 * width), theme = Dark Modern / Light Modern from the `theme` preference ('system' resolved by matchMedia).
 * Semantics: the activity bar is a toolbar; the Explorer an APG tree; the open editors APG tabs; code is real text in
 * `<pre><code>` with `aria-hidden` line numbers; headings start at h3 (the window's title is the h2).
 */
import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { SkillsMatrix } from '@/components/content/skills';
import { inlineMarkdown, tokenize, type SyntaxLanguage, type TokenLine } from '@/components/content/syntax';
import { fileKey, type WorkspaceFile } from '@/components/content/workspace';
import { RovingGroup } from '@/components/primitives/RovingGroup';
import type { SkillGroup } from '@/data/schema';
import { prepare, search } from '@/lib/search/matcher';
import type { SearchEntry } from '@/lib/search/types';
import { usePrefs } from '@/stores/kernel-context';
import { closeTab, firstTab, openTab, type EditorTab } from './tabs';
import styles from './editor.module.css';

export type EditorView = 'explorer' | 'search' | 'scm' | 'extensions';

export interface EditorLayout {
  readonly sidebar: boolean;
  readonly panel: boolean;
  readonly minimap: boolean;
}

export const DEFAULT_LAYOUT: EditorLayout = { sidebar: true, panel: false, minimap: true };

export interface EditorIcons {
  readonly explorer: ReactNode;
  readonly search: ReactNode;
  readonly scm: ReactNode;
  readonly extensions: ReactNode;
  readonly file: ReactNode;
  readonly chevronRight: ReactNode;
  readonly chevronDown: ReactNode;
  readonly back: ReactNode;
  readonly close: ReactNode;
  readonly branch: ReactNode;
  readonly error: ReactNode;
  readonly warning: ReactNode;
  readonly check: ReactNode;
}

export interface EditorHandle {
  /** Open a file by its key (`fileKey`, e.g. `projects/portfolio-os.md`); focus moves to it unless `focus` is false. */
  open(key: string, mode?: 'preview' | 'pinned', focus?: boolean): void;
  show(view: EditorView): void;
  closeActive(): void;
  selectAll(): void;
  /** The selection, else the caret line (VS Code's empty-selection copy). */
  copyText(): string;
  openPanel(): void;
}

export interface EditorBodyProps {
  readonly files: readonly WorkspaceFile[];
  readonly skills: readonly SkillGroup[];
  readonly workspace: string;
  readonly root: string;
  readonly pathSeparator: '/' | '\\';
  readonly layout: EditorLayout;
  readonly onLayout: (layout: EditorLayout) => void;
  readonly icons: EditorIcons;
  readonly compact?: boolean;
  readonly terminal?: ReactNode | (() => ReactNode);
  /** A file to show first, pinned beside the README (the app's section: `skills` → `skills.json`). */
  readonly initial?: string;
}

export const READ_ONLY_MESSAGE = 'Read-only workspace — but thanks for trying to fix my code.';
const NOTICE_MS = 6000;
/** Once per session (page lifetime), across every editor window. */
let noticeShown = false;
/** Test seam: a new "session". */
export const resetEditorSession = () => {
  noticeShown = false;
};

const LANGUAGE: Readonly<Record<SyntaxLanguage, string>> = {
  markdown: 'Markdown',
  json: 'JSON',
  typescript: 'TypeScript',
  log: 'Log',
  dotenv: 'Dotenv',
};
const VIEWS: readonly (readonly [EditorView, string])[] = [
  ['explorer', 'Explorer'],
  ['search', 'Search'],
  ['scm', 'Source Control'],
  ['extensions', 'Extensions'],
];
const VIEW_TITLE = Object.fromEntries(VIEWS) as Record<EditorView, string>;
/** Line height of the code (px) — PageUp/PageDown step. */
const LINE_PX = 19;
/** The minimap draws the code at this scale (a line ≈ 2 px, as VS Code's). */
const MINIMAP_SCALE = 0.105;
const SKILLS = 'skills.json';
const README = 'README.md';

interface Caret {
  readonly line: number;
  readonly col: number;
  /** Reveal in the middle of the view (search results), else just into view. */
  readonly center?: boolean;
}

// --- Theme ---------------------------------------------------------------------------------------------------------

const DARK_QUERY = '(prefers-color-scheme: dark)';
const subscribeScheme = (onChange: () => void) => {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener?.('change', onChange);
  return () => media.removeEventListener?.('change', onChange);
};

/** Dark Modern / Light Modern from the theme preference; 'system' follows the OS (dark before hydration). */
function useScheme(): 'dark' | 'light' {
  const theme = usePrefs((prefs) => prefs.theme);
  const systemDark = useSyncExternalStore(
    subscribeScheme,
    () => window.matchMedia(DARK_QUERY).matches,
    () => true,
  );
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}

// --- Explorer tree ---------------------------------------------------------------------------------------------------

interface TreeNode {
  readonly key: string;
  readonly name: string;
  readonly parent: string | null;
  readonly file?: WorkspaceFile;
  readonly children: readonly TreeNode[];
}

interface Row {
  readonly node: TreeNode;
  readonly depth: number;
  readonly size: number;
  readonly pos: number;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Folders first, then files, each by name — VS Code's default Explorer order. */
function buildTree(files: readonly WorkspaceFile[]): readonly TreeNode[] {
  interface Draft {
    key: string;
    name: string;
    parent: string | null;
    file?: WorkspaceFile;
    children: Map<string, Draft>;
  }
  const root = new Map<string, Draft>();
  for (const file of files) {
    let level = root;
    let parent: string | null = null;
    file.path.forEach((name, index) => {
      const key = file.path.slice(0, index + 1).join('/');
      const leaf = index === file.path.length - 1;
      let draft = level.get(name);
      if (!draft) level.set(name, (draft = { key, name, parent, children: new Map(), ...(leaf ? { file } : {}) }));
      level = draft.children;
      parent = key;
    });
  }
  const finish = (level: Map<string, Draft>): TreeNode[] =>
    [...level.values()]
      .map((draft) => ({ ...draft, children: finish(draft.children) }))
      .sort((a, b) => Number(!!a.file) - Number(!!b.file) || collator.compare(a.name, b.name));
  return finish(root);
}

function flatten(nodes: readonly TreeNode[], expanded: ReadonlySet<string>, depth = 0, out: Row[] = []): Row[] {
  nodes.forEach((node, index) => {
    out.push({ node, depth, size: nodes.length, pos: index + 1 });
    if (!node.file && expanded.has(node.key)) flatten(node.children, expanded, depth + 1, out);
  });
  return out;
}

const findNode = (nodes: readonly TreeNode[], key: string): TreeNode | undefined => {
  for (const node of nodes) {
    if (node.key === key) return node;
    const inner = findNode(node.children, key);
    if (inner) return inner;
  }
  return undefined;
};

// --- The editor ------------------------------------------------------------------------------------------------------

export const EditorBody = forwardRef<EditorHandle, EditorBodyProps>(function EditorBody(
  { files, skills, workspace, root, pathSeparator, layout, onLayout, icons, compact = false, terminal, initial },
  handle,
) {
  const uid = useId();
  const scheme = useScheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Where focus goes after the next commit (a surface that was just shown, or a fallback for one just hidden). */
  const focusNext = useRef<'code' | 'tree' | 'tabs' | 'view' | 'panel' | 'main' | null>(null);

  const byKey = useMemo(() => new Map(files.map((file) => [fileKey(file), file])), [files]);
  const tree = useMemo(() => buildTree(files), [files]);
  const startKey = byKey.has(README) ? README : files[0] ? fileKey(files[0]) : null;

  const [view, setView] = useState<EditorView>('explorer');
  const [group, setGroup] = useState<{ tabs: readonly EditorTab[]; active: string | null }>(() => {
    const first = initial && byKey.has(initial) ? initial : null;
    const keys = [...new Set([startKey, first].filter((key): key is string => key !== null))];
    return { tabs: keys.map(firstTab), active: first ?? startKey };
  });
  const [carets, setCarets] = useState<Readonly<Record<string, Caret>>>({});
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(files.filter((file) => file.path.length > 1).map((file) => file.path[0]!)),
  );
  const [rootOpen, setRootOpen] = useState(true);
  const [treeFocus, setTreeFocus] = useState<string | null>(null);
  const [drill, setDrill] = useState<string | null>(null);
  const [screen, setScreen] = useState<'side' | 'editor'>('side');
  const [plain, setPlain] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [panelOpened, setPanelOpened] = useState(false);

  const tabId = (key: string) => `${uid}-tab-${key}`;
  const panelId = `${uid}-editor`;
  const showSidebar = compact ? screen === 'side' : layout.sidebar;
  const showPanel = !compact && layout.panel;
  if (showPanel && !panelOpened) setPanelOpened(true);

  const { tabs, active } = group;
  const activeFile = active ? byKey.get(active) : undefined;
  const caret: Caret = (active && carets[active]) || { line: 0, col: 0 };

  const rows = useMemo(() => {
    if (!compact) return flatten(tree, expanded);
    const level = drill ? (findNode(tree, drill)?.children ?? tree) : tree;
    return level.map((node, index) => ({ node, depth: 0, size: level.length, pos: index + 1 }));
  }, [compact, drill, expanded, tree]);
  const currentRow =
    rows.find((row) => row.node.key === treeFocus) ?? rows.find((row) => row.node.key === active) ?? rows[0];

  useEffect(() => {
    const timer = noticeTimer;
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Focus: land on what was just shown; never leave it inside something that was just hidden.
  useLayoutEffect(() => {
    const target = focusNext.current;
    const host = rootRef.current;
    if (!target || !host) return;
    focusNext.current = null;
    const pick: Record<NonNullable<typeof target>, () => HTMLElement | null | undefined> = {
      code: () => host.querySelector<HTMLElement>('[role="tabpanel"]'),
      tree: () => treeRef.current?.querySelector<HTMLElement>('[role="treeitem"][tabindex="0"]'),
      tabs: () => host.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]'),
      view: () =>
        ['input', '[role="treeitem"][tabindex="0"]', 'h3']
          .map((selector) => sidebarRef.current?.querySelector<HTMLElement>(selector))
          .find(Boolean),
      panel: () => panelRef.current?.querySelector<HTMLElement>('input, textarea, [tabindex="0"]'),
      main: () => null,
    };
    const element =
      pick[target]() ??
      host.querySelector<HTMLElement>('[role="tabpanel"]') ??
      host.querySelector<HTMLElement>('[data-editor-main]');
    element?.focus({ preventScroll: true });
  });

  useLayoutEffect(() => {
    if (!showSidebar && sidebarRef.current?.contains(document.activeElement)) {
      focusNext.current = null;
      rootRef.current
        ?.querySelector<HTMLElement>('[role="tabpanel"], [data-editor-main]')
        ?.focus({ preventScroll: true });
    }
  }, [showSidebar]);
  useLayoutEffect(() => {
    if (!showPanel && panelRef.current?.contains(document.activeElement))
      rootRef.current
        ?.querySelector<HTMLElement>('[role="tabpanel"], [data-editor-main]')
        ?.focus({ preventScroll: true });
  }, [showPanel]);

  // --- Actions ---------------------------------------------------------------------------------------------------

  const openFile = (key: string, mode: 'preview' | 'pinned', options: { line?: number; focus?: boolean } = {}) => {
    if (!byKey.has(key)) return;
    setGroup((current) => ({ tabs: openTab(current.tabs, key, mode, current.active), active: key }));
    if (options.line !== undefined) {
      const line = options.line;
      setCarets((current) => ({ ...current, [key]: { line, col: 0, center: true } }));
    }
    if (key === SKILLS) setPlain(false);
    if (compact) setScreen('editor');
    // Compact pushes the file in, so focus follows it unless the caller opened it silently (a deep link).
    if (options.focus ?? compact) focusNext.current = 'code';
  };

  /** Close a tab; focus follows to the next tab when it was on the closing tab (or when asked). */
  const close = (key: string, refocus: boolean) => {
    if (document.getElementById(tabId(key))?.parentElement?.contains(document.activeElement)) refocus = true;
    const next = closeTab(tabs, key, active);
    setGroup(next);
    if (compact && !next.active) setScreen('side');
    if (refocus) focusNext.current = next.active ? 'tabs' : showSidebar ? 'tree' : 'main';
  };

  const showView = (next: EditorView, focus: boolean) => {
    setView(next);
    if (compact) setScreen('side');
    else if (!layout.sidebar) onLayout({ ...layout, sidebar: true });
    if (focus) focusNext.current = 'view';
  };

  const onType = () => {
    if (noticeShown) return;
    noticeShown = true;
    setNotice(READ_ONLY_MESSAGE);
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
  };

  const setCaret = (next: Caret) => active && setCarets((current) => ({ ...current, [active]: next }));

  useImperativeHandle(handle, () => ({
    open: (key, mode = 'pinned', focus = true) => openFile(key, mode, { focus }),
    show: (next) => showView(next, true),
    closeActive: () => {
      if (active) close(active, true);
    },
    selectAll: () => {
      const code = rootRef.current?.querySelector('pre code');
      if (code) window.getSelection()?.selectAllChildren(code);
    },
    copyText: () => {
      const selected = window.getSelection()?.toString() ?? '';
      if (selected) return selected;
      return activeFile ? (activeFile.text.split('\n')[caret.line] ?? '') : '';
    },
    openPanel: () => {
      if (compact) return;
      if (!layout.panel) onLayout({ ...layout, panel: true });
      focusNext.current = 'panel';
    },
  }));

  // --- Explorer ------------------------------------------------------------------------------------------------------

  const focusTreeItem = (key: string | undefined) => {
    if (!key) return;
    setTreeFocus(key);
    const items = treeRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [];
    for (const item of items) if (item.dataset.key === key) item.focus({ preventScroll: false });
  };

  const toggleFolder = (key: string, open: boolean) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });

  const drillInto = (node: TreeNode) => {
    setDrill(node.key);
    setTreeFocus(node.children[0]?.key ?? null);
    focusNext.current = 'tree';
  };
  const drillOut = () => {
    if (!drill) return;
    setDrill(findNode(tree, drill)?.parent ?? null);
    setTreeFocus(drill);
    focusNext.current = 'tree';
  };

  const activateRow = (node: TreeNode, mode: 'preview' | 'pinned', focus = false) => {
    if (node.file) openFile(node.key, mode, focus ? { focus } : {});
    else if (compact) drillInto(node);
    else toggleFolder(node.key, !expanded.has(node.key));
    setTreeFocus(node.key);
  };

  const typeahead = useRef({ text: '', at: 0 });
  const onTreeKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = rows.findIndex((row) => row.node.key === currentRow?.node.key);
    const row = rows[index];
    if (!row || event.altKey || event.ctrlKey || event.metaKey) return;
    const { node } = row;
    const folder = !node.file;
    const go = (target: Row | undefined) => {
      event.preventDefault();
      focusTreeItem(target?.node.key);
    };
    switch (event.key) {
      case 'ArrowDown':
        return go(rows[index + 1]);
      case 'ArrowUp':
        return go(rows[index - 1]);
      case 'Home':
        return go(rows[0]);
      case 'End':
        return go(rows[rows.length - 1]);
      case 'ArrowRight':
        event.preventDefault();
        if (!folder) return;
        if (compact) return drillInto(node);
        if (!expanded.has(node.key)) return toggleFolder(node.key, true);
        return focusTreeItem(node.children[0]?.key);
      case 'ArrowLeft':
        event.preventDefault();
        if (compact) return drillOut();
        if (folder && expanded.has(node.key)) return toggleFolder(node.key, false);
        return focusTreeItem(node.parent ?? undefined);
      case 'Enter':
        event.preventDefault();
        return activateRow(node, 'pinned', true);
      case ' ':
        event.preventDefault();
        return activateRow(node, 'preview');
      default: {
        if (event.key.length !== 1) return;
        const state = typeahead.current;
        const now = event.timeStamp;
        state.text = now - state.at > 500 ? event.key.toLowerCase() : state.text + event.key.toLowerCase();
        state.at = now;
        const start = state.text.length > 1 ? index : index + 1;
        const ordered = [...rows.slice(start), ...rows.slice(0, start)];
        const hit = ordered.find((candidate) => candidate.node.name.toLowerCase().startsWith(state.text));
        if (hit) go(hit);
      }
    }
  };

  const explorer = (
    <>
      {compact && drill ? (
        <button type="button" className={styles.drillBack} onClick={drillOut}>
          {icons.back}
          <span>{findNode(tree, drill)?.name}</span>
        </button>
      ) : (
        <button
          type="button"
          className={styles.sectionHeader}
          aria-expanded={rootOpen}
          aria-controls={`${uid}-tree`}
          onClick={() => setRootOpen(!rootOpen)}
        >
          <span className={styles.twistie} aria-hidden="true">
            {rootOpen ? icons.chevronDown : icons.chevronRight}
          </span>
          {workspace}
        </button>
      )}
      <div
        ref={treeRef}
        id={`${uid}-tree`}
        role="tree"
        aria-label="Files Explorer"
        className={styles.tree}
        hidden={!rootOpen && !(compact && drill)}
      >
        {rows.map(({ node, depth, size, pos }) => {
          const folder = !node.file;
          const open = folder && !compact && expanded.has(node.key);
          return (
            <div
              key={node.key}
              role="treeitem"
              data-key={node.key}
              aria-level={depth + 1}
              aria-setsize={size}
              aria-posinset={pos}
              aria-expanded={folder && !compact ? open : undefined}
              aria-selected={node.key === active}
              tabIndex={node.key === currentRow?.node.key ? 0 : -1}
              className={styles.row}
              style={{ ['--depth' as string]: depth }}
              title={node.file ? fullPath(root, node.file, pathSeparator) : undefined}
              onClick={() => activateRow(node, 'preview')}
              onDoubleClick={() => node.file && openFile(node.key, 'pinned')}
              onKeyDown={onTreeKey}
              onFocus={() => setTreeFocus(node.key)}
            >
              <span className={styles.twistie} aria-hidden="true">
                {folder ? (open ? icons.chevronDown : icons.chevronRight) : null}
              </span>
              {node.file ? (
                <span className={styles.fileIcon} data-lang={node.file.language} aria-hidden="true">
                  {icons.file}
                </span>
              ) : null}
              <span className={styles.label}>{node.name}</span>
            </div>
          );
        })}
      </div>
    </>
  );

  // --- Side bar views ------------------------------------------------------------------------------------------------

  const sidebar = (
    <div ref={sidebarRef} className={styles.sidebar} hidden={!showSidebar} data-view={view} data-editor-sidebar="">
      <div className={styles.paneHeader}>
        <h3 className={styles.paneTitle} tabIndex={-1}>
          {VIEW_TITLE[view]}
        </h3>
      </div>
      <div className={styles.paneBody}>
        {view === 'explorer' ? explorer : null}
        {view === 'search' ? (
          <SearchView files={files} onOpen={(key, line) => openFile(key, 'preview', { line })} fileIcon={icons.file} />
        ) : null}
        {view === 'scm' ? (
          <div className={styles.scm}>
            <p className={styles.scmBranch}>
              {icons.branch}
              <span>main</span>
              {icons.check}
            </p>
            <p className={styles.dim}>Nothing to commit, working tree clean.</p>
          </div>
        ) : null}
        {view === 'extensions' ? <Extensions skills={skills} icon={icons.extensions} /> : null}
      </div>
    </div>
  );

  const activityBar = (
    <RovingGroup
      as="div"
      role="toolbar"
      aria-label="Activity Bar"
      aria-orientation={compact ? 'horizontal' : 'vertical'}
      orientation={compact ? 'horizontal' : 'vertical'}
      className={styles.activity}
    >
      {VIEWS.map(([id, title]) => (
        <button
          key={id}
          type="button"
          data-roving-item=""
          className={styles.activityItem}
          aria-label={title}
          title={title}
          aria-pressed={view === id && showSidebar}
          onClick={() => {
            if (!compact && view === id && layout.sidebar) onLayout({ ...layout, sidebar: false });
            else showView(id, false);
          }}
        >
          {icons[id]}
        </button>
      ))}
    </RovingGroup>
  );

  // --- Editor group ------------------------------------------------------------------------------------------------

  const onTabKey = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    const move = (to: number) => {
      event.preventDefault();
      const target = tabs[(to + tabs.length) % tabs.length];
      if (!target) return;
      setGroup((current) => ({ ...current, active: target.key }));
      focusNext.current = 'tabs';
    };
    if (event.key === 'ArrowRight') move(index + 1);
    else if (event.key === 'ArrowLeft') move(index - 1);
    else if (event.key === 'Home') move(0);
    else if (event.key === 'End') move(tabs.length - 1);
    else if (event.key === 'Delete') {
      event.preventDefault();
      close(tabs[index]!.key, true);
    }
  };

  const labelled = compact || !activeFile ? { 'aria-label': activeFile?.name } : { 'aria-labelledby': tabId(active!) };
  const rendered = activeFile?.language === 'markdown' && active === README;

  const editorContent = !activeFile ? (
    <div className={styles.watermark} data-editor-main="" tabIndex={-1}>
      <p>Open a file from the Explorer to read it.</p>
    </div>
  ) : rendered ? (
    <div
      role="tabpanel"
      id={panelId}
      {...labelled}
      // APG tabs: the panel takes focus so its document can be read and scrolled from the keyboard.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      className={styles.scroller}
    >
      <MarkdownPreview text={activeFile.text} onLink={(key) => openFile(key, 'preview', { focus: true })} />
    </div>
  ) : active === SKILLS && plain ? (
    <div
      role="tabpanel"
      id={panelId}
      {...labelled}
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      className={styles.scroller}
    >
      <div className={styles.codelens}>
        <button type="button" className={styles.lens} onClick={() => setPlain(false)}>
          View skills.json as code
        </button>
      </div>
      <div className={styles.plain}>
        <SkillsMatrix data={skills} headingLevel={3} density="compact" />
      </div>
    </div>
  ) : (
    <CodeView
      key={active}
      id={panelId}
      labelled={labelled}
      file={activeFile}
      caret={caret}
      onCaret={setCaret}
      onType={onType}
      minimap={layout.minimap && !compact}
      lens={
        active === SKILLS ? (
          <button type="button" className={styles.lens} onClick={() => setPlain(true)}>
            View as plain skills list
          </button>
        ) : null
      }
    />
  );

  const rootLeaf = root.split(/[\\/]/).filter(Boolean).pop() ?? workspace;

  const main = (
    <div className={styles.main} hidden={compact && screen !== 'editor'} data-editor-group="">
      {compact ? (
        <div className={styles.compactBar}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={`Back to ${VIEW_TITLE[view]}`}
            onClick={() => {
              setScreen('side');
              focusNext.current = 'view';
            }}
          >
            {icons.back}
          </button>
        </div>
      ) : tabs.length ? (
        <div role="tablist" aria-label="Open editors" className={styles.tabs}>
          {tabs.map((tab, index) => {
            const file = byKey.get(tab.key);
            if (!file) return null;
            const selected = tab.key === active;
            return (
              <div
                key={tab.key}
                role="presentation"
                className={styles.tab}
                data-active={selected || undefined}
                data-preview={tab.preview || undefined}
              >
                <div
                  role="tab"
                  id={tabId(tab.key)}
                  aria-selected={selected}
                  aria-controls={selected ? panelId : undefined}
                  tabIndex={selected ? 0 : -1}
                  title={fullPath(root, file, pathSeparator)}
                  className={styles.tabButton}
                  onClick={() => setGroup((current) => ({ ...current, active: tab.key }))}
                  onDoubleClick={() => openFile(tab.key, 'pinned')}
                  onAuxClick={(event) => event.button === 1 && close(tab.key, false)}
                  onKeyDown={(event) => onTabKey(event, index)}
                >
                  <span className={styles.fileIcon} data-lang={file.language} aria-hidden="true">
                    {icons.file}
                  </span>
                  <span className={styles.tabLabel}>{tab.key === README ? `Preview ${file.name}` : file.name}</span>
                </div>
                <button
                  type="button"
                  className={styles.tabClose}
                  aria-hidden="true"
                  tabIndex={-1}
                  title="Close (Delete)"
                  onClick={() => close(tab.key, false)}
                >
                  {icons.close}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
      {activeFile ? (
        <ol className={styles.crumbs} aria-label="Breadcrumbs" title={fullPath(root, activeFile, pathSeparator)}>
          {[rootLeaf, ...activeFile.path].map((part, index) => (
            <li key={index}>
              {index ? (
                <span className={styles.crumbSep} aria-hidden="true">
                  {pathSeparator}
                </span>
              ) : null}
              {part}
            </li>
          ))}
        </ol>
      ) : null}
      <div className={styles.editorArea}>{editorContent}</div>
      <div ref={panelRef} className={styles.panel} hidden={!showPanel} role="region" aria-label="Panel">
        <div className={styles.panelHeader}>
          <span className={styles.panelTab}>Terminal</span>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Close panel"
            title="Close Panel"
            onClick={() => onLayout({ ...layout, panel: false })}
          >
            {icons.close}
          </button>
        </div>
        <div className={styles.panelBody}>
          {panelOpened ? (typeof terminal === 'function' ? terminal() : terminal) : null}
        </div>
      </div>
    </div>
  );

  const rendersCaret = !!activeFile && !rendered && !(active === SKILLS && plain);

  return (
    <div
      ref={rootRef}
      className={styles.editor}
      data-scheme={scheme}
      data-compact={compact || undefined}
      data-editor=""
    >
      <div className={styles.workbench}>
        {compact ? null : activityBar}
        {sidebar}
        {main}
      </div>
      <div className={styles.statusbar}>
        <span className={styles.sbItem} title="main (Git branch)">
          {icons.branch}
          main
        </span>
        <span className={styles.sbItem} title="No Problems">
          <span aria-hidden="true" className={styles.sbProblems}>
            {icons.error}0{icons.warning}0
          </span>
          <span className="sr-only">0 errors, 0 warnings</span>
        </span>
        <span className={styles.sbMessage} role="status">
          {notice}
        </span>
        <span className={styles.sbSpacer} />
        {rendersCaret ? (
          <span className={styles.sbItem}>
            Ln {caret.line + 1}, Col {caret.col + 1}
          </span>
        ) : null}
        {activeFile ? (
          <>
            <span className={styles.sbItem} data-optional="">
              Spaces: 2
            </span>
            <span className={styles.sbItem} data-optional="">
              UTF-8
            </span>
            <span className={styles.sbItem}>{LANGUAGE[activeFile.language]}</span>
          </>
        ) : null}
        <span className={styles.sbItem}>
          Prettier
          {icons.check}
        </span>
      </div>
      {compact ? activityBar : null}
    </div>
  );
});

const fullPath = (root: string, file: WorkspaceFile, separator: string) =>
  [root.replace(/[\\/]+$/, ''), ...file.path].join(separator);

// --- Code ------------------------------------------------------------------------------------------------------------

function CodeView({
  id,
  labelled,
  file,
  caret,
  onCaret,
  onType,
  minimap,
  lens,
}: {
  readonly id: string;
  readonly labelled: { readonly 'aria-label'?: string; readonly 'aria-labelledby'?: string };
  readonly file: WorkspaceFile;
  readonly caret: Caret;
  readonly onCaret: (caret: Caret) => void;
  readonly onType: () => void;
  readonly minimap: boolean;
  readonly lens: ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const code = useRef<HTMLElement>(null);
  const tokens = useMemo(() => tokenize(file.language, file.text), [file]);
  const lengths = useMemo(() => file.text.split('\n').map((line) => line.length), [file]);
  const lines = useMemo(
    () =>
      tokens.map((line, index) => (
        <span key={index} className={styles.line}>
          <span className={styles.ln} aria-hidden="true">
            {index + 1}
          </span>
          <span className={styles.lc} data-lc="">
            {renderTokens(line)}
            {file.hints?.[index] ? <span className={styles.inlay}>{file.hints[index]}</span> : null}
          </span>
        </span>
      )),
    [tokens, file],
  );

  // The caret: an attribute on its line (current-line box, cursor, inlay hint) — no re-render of the lines.
  useLayoutEffect(() => {
    const container = scroller.current;
    const element = code.current?.children[caret.line] as HTMLElement | undefined;
    code.current?.querySelector('[data-caret]')?.removeAttribute('data-caret');
    if (!container || !element) return;
    element.setAttribute('data-caret', '');
    element.style.setProperty('--col', String(caret.col));
    const top = element.offsetTop;
    const height = element.offsetHeight || LINE_PX;
    if (caret.center) container.scrollTop = Math.max(0, top - container.clientHeight / 2);
    else if (top < container.scrollTop) container.scrollTop = top;
    else if (top + height > container.scrollTop + container.clientHeight)
      container.scrollTop = top + height - container.clientHeight;
  }, [caret, lines]);

  // Keys and clicks (native listeners: the panel is a document with a caret, not a text field).
  const latest = useRef({ caret, onCaret, onType, lengths });
  useLayoutEffect(() => {
    latest.current = { caret, onCaret, onType, lengths };
  });
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const lifetime = new AbortController();
    node.addEventListener(
      'keydown',
      (event) => {
        const { caret, onCaret, onType, lengths } = latest.current;
        const last = lengths.length - 1;
        const move = (line: number, col?: number) => {
          event.preventDefault();
          const to = Math.max(0, Math.min(last, line));
          const width = lengths[to] ?? 0;
          onCaret({ line: to, col: Math.max(0, Math.min(col ?? caret.col, width)) });
        };
        if (event.altKey || event.metaKey) return;
        if (event.ctrlKey) {
          if (event.key === 'Home') move(0, 0);
          else if (event.key === 'End') move(last, Infinity);
          else if (event.key === 'a' && code.current) {
            event.preventDefault();
            window.getSelection()?.selectAllChildren(code.current);
          } else if (event.key === 'v' || event.key === 'x') onType();
          return;
        }
        const page = Math.max(1, Math.floor(node.clientHeight / LINE_PX) - 1);
        switch (event.key) {
          case 'ArrowUp':
            return move(caret.line - 1);
          case 'ArrowDown':
            return move(caret.line + 1);
          case 'PageUp':
            return move(caret.line - page);
          case 'PageDown':
            return move(caret.line + page);
          case 'Home':
            return move(caret.line, 0);
          case 'End':
            return move(caret.line, Infinity);
          case 'ArrowLeft':
            if (caret.col > 0) return move(caret.line, caret.col - 1);
            return caret.line > 0 ? move(caret.line - 1, Infinity) : event.preventDefault();
          case 'ArrowRight':
            if (caret.col < (lengths[caret.line] ?? 0)) return move(caret.line, caret.col + 1);
            return caret.line < last ? move(caret.line + 1, 0) : event.preventDefault();
          case 'Backspace':
          case 'Delete':
          case 'Enter':
            event.preventDefault();
            return onType();
          default:
            if (event.key.length === 1) {
              event.preventDefault();
              onType();
            }
        }
      },
      { signal: lifetime.signal },
    );
    // A click puts the caret where the browser put its collapsed selection (line + column).
    node.addEventListener(
      'mouseup',
      () => {
        const selection = window.getSelection();
        const anchor = selection?.anchorNode;
        if (!selection?.isCollapsed || !anchor || !code.current?.contains(anchor)) return;
        const content = (anchor instanceof Element ? anchor : anchor.parentElement)?.closest<HTMLElement>('[data-lc]');
        const line = content?.parentElement;
        if (!content || !line) return;
        const index = Array.prototype.indexOf.call(code.current.children, line);
        const range = document.createRange();
        range.setStart(content, 0);
        range.setEnd(anchor, selection.anchorOffset);
        latest.current.onCaret({ line: index, col: range.toString().length });
      },
      { signal: lifetime.signal },
    );
    return () => lifetime.abort();
  }, []);

  return (
    <>
      <div
        ref={scroller}
        role="tabpanel"
        id={id}
        {...labelled}
        // APG tabs: the panel is the focus stop; it carries the editor's caret (arrows, Home/End, PageUp/PageDown).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className={styles.scroller}
        data-code=""
        data-lang={file.language}
      >
        {lens ? <div className={styles.codelens}>{lens}</div> : null}
        <pre className={styles.pre}>
          <code ref={code}>{lines}</code>
        </pre>
      </div>
      {minimap ? <Minimap tokens={tokens} scroller={scroller} /> : null}
    </>
  );
}

const renderTokens = (line: TokenLine) =>
  line.map((token, index) =>
    token.kind === 'plain' ? (
      token.text
    ) : (
      <span key={index} data-k={token.kind}>
        {token.text}
      </span>
    ),
  );

/** A transform-scaled clone of the code as blocks (no duplicate text), with the viewport slider. Decorative. */
function Minimap({
  tokens,
  scroller,
}: {
  readonly tokens: readonly TokenLine[];
  readonly scroller: RefObject<HTMLDivElement | null>;
}) {
  const slider = useRef<HTMLDivElement>(null);
  const rows = useMemo(
    () =>
      tokens.map((line, index) => (
        <div key={index} className={styles.mmRow}>
          {line.map((token, at) => (
            <i key={at} data-k={token.text.trim() ? token.kind : 'space'} style={{ width: `${token.text.length}ch` }} />
          ))}
        </div>
      )),
    [tokens],
  );
  useEffect(() => {
    const node = scroller.current;
    const bar = slider.current;
    if (!node || !bar) return;
    const update = () => {
      bar.style.height = `${Math.round(node.clientHeight * MINIMAP_SCALE)}px`;
      bar.style.transform = `translateY(${Math.round(node.scrollTop * MINIMAP_SCALE)}px)`;
    };
    update();
    node.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(node);
    return () => {
      node.removeEventListener('scroll', update);
      observer?.disconnect();
    };
  }, [scroller]);
  return (
    <div className={styles.minimap} aria-hidden="true" data-minimap="">
      <div className={styles.mmInner} style={{ transform: `scale(${MINIMAP_SCALE})` }}>
        {rows}
      </div>
      <div ref={slider} className={styles.mmSlider} />
    </div>
  );
}

// --- Markdown preview (README) -------------------------------------------------------------------------------------

type Block =
  | { readonly kind: 'h'; readonly level: number; readonly text: string }
  | { readonly kind: 'p' | 'quote'; readonly text: string }
  | { readonly kind: 'ul'; readonly items: readonly string[] };

function blocksOf(text: string): Block[] {
  const blocks: Block[] = [];
  const paragraph: string[] = [];
  const list: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'p', text: paragraph.splice(0).join(' ') });
    if (list.length) blocks.push({ kind: 'ul', items: list.splice(0) });
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const quote = /^>\s?(.*)$/.exec(line);
    const bullet = /^[-*+]\s+(.*)$/.exec(line);
    if (!line) flush();
    else if (heading) {
      flush();
      blocks.push({ kind: 'h', level: heading[1]!.length, text: heading[2]! });
    } else if (quote) {
      flush();
      blocks.push({ kind: 'quote', text: quote[1]! });
    } else if (bullet) {
      if (paragraph.length) flush();
      list.push(bullet[1]!);
    } else if (list.length && /^\s{2,}/.test(raw)) list[list.length - 1] += ` ${line}`;
    else {
      if (list.length) flush();
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

function inline(text: string, onLink: (key: string) => void): ReactNode[] {
  return inlineMarkdown(text).map((token, index) => {
    switch (token.kind) {
      case 'strong':
        return <strong key={index}>{token.text.slice(2, -2)}</strong>;
      case 'emphasis':
        return <em key={index}>{token.text.slice(1, -1)}</em>;
      case 'code':
        return <code key={index}>{token.text.slice(1, -1)}</code>;
      case 'link': {
        const [, label = '', href = ''] = /^\[([^\]]*)\]\(([^)]*)\)$/.exec(token.text) ?? [];
        return /^[a-z]+:/i.test(href) ? (
          <a key={index} href={href} target="_blank" rel="noreferrer">
            {label}
          </a>
        ) : (
          <button key={index} type="button" className={styles.mdLink} onClick={() => onLink(href)}>
            {label}
          </button>
        );
      }
      default:
        return token.text;
    }
  });
}

function MarkdownPreview({ text, onLink }: { readonly text: string; readonly onLink: (key: string) => void }) {
  const blocks = useMemo(() => blocksOf(text), [text]);
  return (
    <div className={styles.markdown}>
      {blocks.map((block, index) => {
        if (block.kind === 'h') {
          const Tag = block.level === 1 ? 'h3' : block.level === 2 ? 'h4' : 'h5';
          return <Tag key={index}>{inline(block.text, onLink)}</Tag>;
        }
        if (block.kind === 'ul')
          return (
            <ul key={index} role="list">
              {block.items.map((item, at) => (
                <li key={at}>{inline(item, onLink)}</li>
              ))}
            </ul>
          );
        if (block.kind === 'quote') return <blockquote key={index}>{inline(block.text, onLink)}</blockquote>;
        return <p key={index}>{inline(block.text, onLink)}</p>;
      })}
    </div>
  );
}

// --- Search view (shared matcher over the skills and project files) ------------------------------------------------

interface Hit {
  readonly key: string;
  readonly line: number;
  readonly text: string;
  readonly matched: readonly (readonly [number, number])[];
}

/** One entry per non-blank line of the skills and project files: results open the file at that line. */
function lineEntries(files: readonly WorkspaceFile[]): SearchEntry[] {
  return files.flatMap((file) => {
    const key = fileKey(file);
    const project = file.path[0] === 'projects' ? file.name.replace(/\.md$/, '') : null;
    if (key !== SKILLS && key !== 'stack.ts' && !project) return [];
    return file.text.split('\n').flatMap((raw, line) => {
      const title = raw.trim();
      if (!/[\p{L}\p{N}]/u.test(title)) return [];
      return [
        {
          id: `${key}:${line}`,
          kind: 'content' as const,
          title,
          keywords: [],
          ref: project ? { section: 'projects' as const, slug: project } : { section: 'skills' as const },
          weight: 1,
        },
      ];
    });
  });
}

function SearchView({
  files,
  onOpen,
  fileIcon,
}: {
  readonly files: readonly WorkspaceFile[];
  readonly onOpen: (key: string, line: number) => void;
  readonly fileIcon: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const index = useMemo(() => prepare(lineEntries(files)), [files]);
  const groups = useMemo(() => {
    if (!query.trim()) return [];
    const hits = new Map<string, Hit[]>();
    for (const result of search(index, query, 500)) {
      const split = result.id.lastIndexOf(':');
      const key = result.id.slice(0, split);
      const hit = { key, line: Number(result.id.slice(split + 1)), text: result.title, matched: result.matched };
      hits.set(key, [...(hits.get(key) ?? []), hit]);
    }
    return files
      .map((file) => ({ file, hits: (hits.get(fileKey(file)) ?? []).sort((a, b) => a.line - b.line) }))
      .filter((group) => group.hits.length > 0);
  }, [files, index, query]);
  const total = groups.reduce((sum, group) => sum + group.hits.length, 0);
  return (
    <div className={styles.search}>
      <input
        type="search"
        className={styles.searchInput}
        aria-label="Search skills and projects"
        placeholder="Search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <p className={styles.dim} role="status">
        {query.trim()
          ? total
            ? `${total} ${total === 1 ? 'result' : 'results'} in ${groups.length} ${groups.length === 1 ? 'file' : 'files'}`
            : 'No results found.'
          : ''}
      </p>
      {groups.length ? (
        <RovingGroup
          as="div"
          orientation="vertical"
          className={styles.results}
          aria-label="Search results"
          role="group"
        >
          {groups.map(({ file, hits }) => (
            <div key={fileKey(file)} className={styles.resultFile}>
              <p className={styles.resultHeader}>
                <span className={styles.fileIcon} data-lang={file.language} aria-hidden="true">
                  {fileIcon}
                </span>
                <span>{file.name}</span>
                {file.path.length > 1 ? <span className={styles.dim}>{file.path.slice(0, -1).join('/')}</span> : null}
                <span className={styles.badge}>{hits.length}</span>
              </p>
              {hits.map((hit) => (
                <button
                  key={hit.line}
                  type="button"
                  data-roving-item=""
                  className={styles.result}
                  aria-label={`${hit.text}, ${file.name} line ${hit.line + 1}`}
                  onClick={() => onOpen(hit.key, hit.line)}
                >
                  {highlight(hit.text, hit.matched)}
                </button>
              ))}
            </div>
          ))}
        </RovingGroup>
      ) : null}
    </div>
  );
}

function highlight(text: string, ranges: readonly (readonly [number, number])[]): ReactNode[] {
  const out: ReactNode[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start < at) continue;
    if (start > at) out.push(text.slice(at, start));
    out.push(<mark key={start}>{text.slice(start, end)}</mark>);
    at = end;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

// --- Extensions view: the tools from the skills data, as installed extensions ----------------------------------------

function Extensions({ skills, icon }: { readonly skills: readonly SkillGroup[]; readonly icon: ReactNode }) {
  const tools = skills.flatMap((group) => group.items.map((item) => ({ name: item.name, group: group.label })));
  return (
    <div className={styles.extensions}>
      <p className={styles.sectionLabel}>
        Installed <span className={styles.badge}>{tools.length}</span>
      </p>
      <ul role="list" className={styles.extensionList}>
        {tools.map((tool) => (
          <li key={`${tool.group}:${tool.name}`} className={styles.extension}>
            <span className={styles.extensionIcon} aria-hidden="true">
              {icon}
            </span>
            <span className={styles.extensionName}>{tool.name}</span>
            <span className={styles.dim}>{tool.group}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
