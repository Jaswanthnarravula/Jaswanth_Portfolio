'use client';
/**
 * Visual Studio Code on Windows 11 — plans/windows/apps/vscode.md (`WIN-CODE-01…06`). Only the Windows chrome lives
 * here; the editor body is the shared one (components/os/shared/editor, the same component and the same generated
 * workspace as macOS — `WIN-CODE-02`):
 *   · the custom Mica title bar (the frame's `TitleBar`): app icon = system menu · the in-window menu bar File Edit
 *     Selection View Go Run Terminal Help (the APG `Menubar`, Windows menu skin: 8 px radius, glyph column, 167 ms in) ·
 *     the centred command centre "jaswanth-portfolio" · layout toggles · caption buttons on the right (`WIN-CODE-01`);
 *   · the command centre, File › Open File… and Ctrl/Cmd+K anywhere in the window open the Windows Search flyout scoped
 *     to files — one search system, no second palette (`WIN-CODE-03`);
 *   · backslash paths (`C:\Users\{given name}\portfolio\…`) in breadcrumbs and tab tooltips; the Terminal panel is
 *     PowerShell, its engine chunk requested only when the panel first opens (`WIN-CODE-04`);
 *   · neither Alt nor F10 is bound — the menu bar is one Tab stop (`WIN-CODE-05`);
 *   · compact, or a window narrower than the menu bar: the menus collapse into ☰ (`WIN-CODE-06`).
 * Every career fact comes from `data/selectors` through `buildWorkspace`.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { buildWorkspace, fileKey, workspaceName } from '@/components/content/workspace';
import {
  DEFAULT_LAYOUT,
  EditorBody,
  type EditorHandle,
  type EditorIcons,
  type EditorLayout,
} from '@/components/os/shared/editor/EditorBody';
import { Menu, Menubar, type MenuEntry, type MenubarMenu } from '@/components/primitives/Menu';
import type { ContentRef } from '@/data/schema';
import { getContact, getExperience, getPerson, getProjects, getSkills } from '@/data/selectors';
import { ownerOf } from '@/lib/kernel/registry';
import { currentLocation } from '@/lib/kernel/state';
import type { Effect } from '@/lib/terminal';
import { dispatch, subscribeEffects } from '@/stores/kernel-store';
import { flDismiss, flSearch } from '../fluent.generated';
import {
  flBranch,
  flCheckmark,
  flChevronDown,
  flChevronLeft,
  flChevronRight,
  flCopy,
  flDocument,
  flError,
  flFiles,
  flNavigation,
  flPanelBottom,
  flPanelLeft,
  flPuzzle,
  flSourceControl,
  flWarning,
} from '../fluent.apps.generated';
import { Fl } from '../icons';
import { useWinShell } from '../shell-context';
import { TitleBar, useWindowChrome, windowStyles, type WindowBodyProps } from '../window/Window';
import styles from './vscode.module.css';

/** The shared terminal host, loaded only when the panel first opens (it lazy-loads the engine itself). */
const TerminalView = lazy(() =>
  import('@/components/os/shared/terminal/TerminalView').then((module) => ({ default: module.TerminalView })),
);

/** Window width below which the in-window menu bar no longer fits beside the command centre → ☰. */
export const MENUBAR_MIN_WIDTH = 880;

const ICONS: EditorIcons = {
  explorer: <Fl icon={flFiles} size={24} />,
  search: <Fl icon={flSearch} size={24} />,
  scm: <Fl icon={flSourceControl} size={24} />,
  extensions: <Fl icon={flPuzzle} size={24} />,
  file: <Fl icon={flDocument} />,
  chevronRight: <Fl icon={flChevronRight} />,
  chevronDown: <Fl icon={flChevronDown} />,
  back: <Fl icon={flChevronLeft} size={20} />,
  close: <Fl icon={flDismiss} />,
  branch: <Fl icon={flBranch} size={14} />,
  error: <Fl icon={flError} size={14} />,
  warning: <Fl icon={flWarning} size={14} />,
  check: <Fl icon={flCheckmark} size={14} />,
};

/** The workspace, generated once from the selectors when this chunk loads (the same formatters as macOS). */
const FILES = buildWorkspace({
  person: getPerson(),
  skills: getSkills(),
  experience: getExperience(),
  projects: getProjects(),
  contact: getContact(),
});
const SKILLS = getSkills();
const SKILLS_FILE = 'skills.json';
const NAME = workspaceName(getPerson());
/** `C:\Users\{given name}\portfolio` — breadcrumbs and tab tooltips use backslashes (`WIN-CODE-04`). */
const ROOT = `C:\\Users\\${getPerson().givenName}\\portfolio`;

const QUARTERS: ReadonlySet<string> = new Set(['tl', 'tr', 'bl', 'br']);

const noop = () => undefined;
const separator = (id: string): MenuEntry => ({ kind: 'separator', id });
const enabled = (items: readonly MenuEntry[]) =>
  items.some((item) => item.kind !== 'separator' && item.kind !== 'heading' && !item.disabled);

export default function VSCode({ window, focused, compact }: WindowBodyProps) {
  const shell = useWinShell();
  const chrome = useWindowChrome();
  const editor = useRef<EditorHandle>(null);
  const body = useRef<HTMLDivElement>(null);
  const hamburger = useRef<HTMLButtonElement>(null);
  const [layout, setLayout] = useState<EditorLayout>(DEFAULT_LAYOUT);
  const [narrow, setNarrow] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const collapsed = compact || narrow;

  // Snapped to a quarter, the side bar collapses (the visitor can reopen it); leaving the quarter does not reopen it.
  const quarter = !!window.snap && QUARTERS.has(window.snap.zone);
  const [wasQuarter, setWasQuarter] = useState(quarter);
  if (quarter !== wasQuarter) {
    setWasQuarter(quarter);
    if (quarter) setLayout((current) => ({ ...current, sidebar: false }));
  }

  const openSearch = (invoker: HTMLElement | null) => shell.openSearch({ scope: 'files', invoker });
  const toggle = (key: keyof EditorLayout) => setLayout((current) => ({ ...current, [key]: !current[key] }));

  // A window narrower than the menu bar collapses it into ☰ (only a threshold crossing re-renders).
  useEffect(() => {
    const section = body.current?.closest<HTMLElement>('[data-window]');
    if (!section || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setNarrow(entry.contentRect.width < MENUBAR_MIN_WIDTH);
    });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  // Ctrl/Cmd+K anywhere in the window → Windows Search scoped to files (before the shell's own Ctrl+K sees it).
  useEffect(() => {
    const section = body.current?.closest<HTMLElement>('[data-window]');
    if (!section) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey)
        return;
      event.preventDefault();
      event.stopPropagation();
      shell.openSearch({ scope: 'files', invoker: event.target instanceof HTMLElement ? event.target : null });
    };
    section.addEventListener('keydown', onKey);
    return () => section.removeEventListener('keydown', onKey);
  }, [shell]);

  // The editor's route is its section (skills): it opens on skills.json, and a later request for the skills while it is
  // open (a search result, a link) brings skills.json back to the front.
  const [initial] = useState(() => {
    const location = currentLocation(window);
    return location.kind === 'content' && location.ref.section === 'skills' ? SKILLS_FILE : undefined;
  });
  useEffect(
    () =>
      subscribeEffects(({ action, state }) => {
        if (action.type !== 'OPEN_APP' || (action.os ?? state.activeOs) !== 'windows') return;
        if (action.location?.kind === 'content' && action.location.ref.section === 'skills')
          editor.current?.open(SKILLS_FILE, 'pinned', false);
      }),
    [],
  );

  const onTerminalEffect = (effect: Effect) => {
    const openRef = (ref: ContentRef) =>
      dispatch({ type: 'OPEN_APP', role: ownerOf('windows', ref.section).role, location: { kind: 'content', ref } });
    switch (effect.k) {
      case 'exit':
        setLayout((current) => ({ ...current, panel: false }));
        return;
      case 'open':
        openRef(effect.ref === 'resume' ? { section: 'resume' } : effect.ref);
        return;
      case 'reveal':
        if (effect.ref) openRef(effect.ref);
        else dispatch({ type: 'OPEN_APP', role: 'files' });
        return;
      case 'mailto':
        openRef({ section: 'contact' });
        return;
      case 'switch-os':
        dispatch({ type: 'SWITCH_OS', to: effect.to ?? null, via: 'switch' });
        return;
      case 'tour':
        shell.startTour();
        return;
      default:
    }
  };

  const terminal = () => (
    <Suspense fallback={<p className={styles.loading}>Starting PowerShell…</p>}>
      <TerminalView
        flavor="powershell"
        os="windows"
        session={null}
        active={focused}
        // The panel opens only on the visitor's own command (New Terminal, the Panel toggle): the prompt takes focus.
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={!chrome?.touch}
        onEffect={onTerminalEffect}
      />
    </Suspense>
  );

  const menus: readonly MenubarMenu[] = [
    {
      id: 'file',
      label: 'File',
      items: [
        { kind: 'item', id: 'open', label: 'Open File…', shortcut: 'Ctrl+K', onSelect: () => openSearch(null) },
        separator('file-1'),
        { kind: 'item', id: 'close-editor', label: 'Close Editor', onSelect: () => editor.current?.closeActive() },
        separator('file-2'),
        { kind: 'item', id: 'exit', label: 'Exit', onSelect: () => dispatch({ type: 'CLOSE_WINDOW', id: window.id }) },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        { kind: 'item', id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z', disabled: true, onSelect: noop },
        { kind: 'item', id: 'redo', label: 'Redo', shortcut: 'Ctrl+Y', disabled: true, onSelect: noop },
        separator('edit-1'),
        { kind: 'item', id: 'cut', label: 'Cut', shortcut: 'Ctrl+X', disabled: true, onSelect: noop },
        {
          kind: 'item',
          id: 'copy',
          label: 'Copy',
          shortcut: 'Ctrl+C',
          icon: <Fl icon={flCopy} />,
          onSelect: () => {
            const text = editor.current?.copyText();
            if (text) void shell.copyText(text);
          },
        },
        { kind: 'item', id: 'paste', label: 'Paste', shortcut: 'Ctrl+V', disabled: true, onSelect: noop },
        separator('edit-2'),
        {
          kind: 'item',
          id: 'find',
          label: 'Find in Files',
          icon: <Fl icon={flSearch} />,
          onSelect: () => editor.current?.show('search'),
        },
      ],
    },
    {
      id: 'selection',
      label: 'Selection',
      items: [
        {
          kind: 'item',
          id: 'select-all',
          label: 'Select All',
          shortcut: 'Ctrl+A',
          onSelect: () => editor.current?.selectAll(),
        },
      ],
    },
    {
      id: 'view',
      label: 'View',
      items: [
        {
          kind: 'item',
          id: 'palette',
          label: 'Command Palette…',
          shortcut: 'Ctrl+K',
          onSelect: () => openSearch(null),
        },
        separator('view-1'),
        {
          kind: 'item',
          id: 'explorer',
          label: 'Explorer',
          icon: <Fl icon={flFiles} />,
          onSelect: () => editor.current?.show('explorer'),
        },
        {
          kind: 'item',
          id: 'search',
          label: 'Search',
          icon: <Fl icon={flSearch} />,
          onSelect: () => editor.current?.show('search'),
        },
        {
          kind: 'item',
          id: 'scm',
          label: 'Source Control',
          icon: <Fl icon={flSourceControl} />,
          onSelect: () => editor.current?.show('scm'),
        },
        {
          kind: 'item',
          id: 'extensions',
          label: 'Extensions',
          icon: <Fl icon={flPuzzle} />,
          onSelect: () => editor.current?.show('extensions'),
        },
        separator('view-2'),
        {
          kind: 'submenu',
          id: 'appearance',
          label: 'Appearance',
          disabled: compact,
          items: [
            {
              kind: 'checkbox',
              id: 'sidebar',
              label: 'Primary Side Bar',
              checked: layout.sidebar,
              onSelect: () => toggle('sidebar'),
            },
            { kind: 'checkbox', id: 'panel', label: 'Panel', checked: layout.panel, onSelect: () => toggle('panel') },
            {
              kind: 'checkbox',
              id: 'minimap',
              label: 'Minimap',
              checked: layout.minimap,
              onSelect: () => toggle('minimap'),
            },
          ],
        },
        {
          kind: 'item',
          id: 'terminal',
          label: 'Terminal',
          disabled: compact,
          onSelect: () => editor.current?.openPanel(),
        },
      ],
    },
    {
      id: 'go',
      label: 'Go',
      items: [
        { kind: 'item', id: 'go-file', label: 'Go to File…', shortcut: 'Ctrl+K', onSelect: () => openSearch(null) },
        separator('go-1'),
        ...FILES.map((file): MenuEntry => ({
          kind: 'item',
          id: `go:${fileKey(file)}`,
          label: file.path.join('\\'),
          icon: <Fl icon={flDocument} />,
          onSelect: () => editor.current?.open(fileKey(file), 'pinned'),
        })),
      ],
    },
    {
      id: 'run',
      label: 'Run',
      items: [
        { kind: 'item', id: 'debug', label: 'Start Debugging', shortcut: 'F5', disabled: true, onSelect: noop },
        {
          kind: 'item',
          id: 'run',
          label: 'Run Without Debugging',
          shortcut: 'Ctrl+F5',
          disabled: true,
          onSelect: noop,
        },
        separator('run-1'),
        {
          kind: 'item',
          id: 'debuggers',
          label: 'Install Additional Debuggers…',
          onSelect: () => editor.current?.show('extensions'),
        },
      ],
    },
    {
      id: 'terminal',
      label: 'Terminal',
      items: [
        {
          kind: 'item',
          id: 'new-terminal',
          label: 'New Terminal',
          disabled: compact,
          onSelect: () => editor.current?.openPanel(),
        },
        {
          kind: 'item',
          id: 'kill-terminal',
          label: 'Kill Terminal',
          disabled: compact || !layout.panel,
          onSelect: () => setLayout((current) => ({ ...current, panel: false })),
        },
      ],
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        { kind: 'item', id: 'welcome', label: 'Welcome', onSelect: () => editor.current?.open('README.md', 'pinned') },
        {
          kind: 'item',
          id: 'commands',
          label: 'Show All Commands',
          shortcut: 'Ctrl+K',
          onSelect: () => openSearch(null),
        },
        separator('help-1'),
        { kind: 'item', id: 'shortcuts', label: 'Keyboard Shortcuts Reference', onSelect: () => shell.showShortcuts() },
      ],
    },
  ];

  const collapsedItems: readonly MenuEntry[] = menus.map((menu) => ({
    kind: 'submenu',
    id: menu.id,
    label: menu.label,
    items: menu.items,
    disabled: !enabled(menu.items),
  }));

  return (
    <>
      <TitleBar>
        <div className={styles.menus} data-no-drag="">
          {collapsed ? (
            <div className={styles.hamburgerSlot}>
              <button
                ref={hamburger}
                type="button"
                className={styles.hamburger}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Application Menu"
                title="Application Menu"
                onClick={() => setMenuOpen((open) => !open)}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowDown') return;
                  event.preventDefault();
                  setMenuOpen(true);
                }}
              >
                <Fl icon={flNavigation} />
              </button>
              {menuOpen ? (
                <Menu
                  label="Application Menu"
                  items={collapsedItems}
                  onClose={() => setMenuOpen(false)}
                  returnFocusTo={hamburger}
                  className={styles.menu}
                />
              ) : null}
            </div>
          ) : (
            <Menubar label="Application Menu" menus={menus} className={styles.menubar} menuClassName={styles.menu} />
          )}
        </div>
        <div className={styles.centre}>
          <button
            type="button"
            className={styles.commandCentre}
            aria-label={`Search files in ${NAME} (Ctrl+K)`}
            title={`Search ${NAME} (Ctrl+K)`}
            data-command-centre=""
            onClick={(event) => openSearch(event.currentTarget)}
          >
            <Fl icon={flSearch} />
            <span className={styles.centreLabel}>{NAME}</span>
          </button>
        </div>
        {compact ? null : (
          <div className={styles.toggles} role="group" aria-label="Layout controls" data-no-drag="">
            <button
              type="button"
              className={styles.toggle}
              aria-pressed={layout.sidebar}
              aria-label="Primary Side Bar"
              title="Toggle Primary Side Bar"
              onClick={() => toggle('sidebar')}
            >
              <Fl icon={flPanelLeft} />
            </button>
            <button
              type="button"
              className={styles.toggle}
              aria-pressed={layout.panel}
              aria-label="Panel"
              title="Toggle Panel"
              onClick={() => toggle('panel')}
            >
              <Fl icon={flPanelBottom} />
            </button>
          </div>
        )}
      </TitleBar>
      {/* z-index 0: the title bar's menus open over the editor (both are stacked siblings in the frame). */}
      <div ref={body} className={`${windowStyles.body} ${styles.body}`} style={{ zIndex: 0 }}>
        <EditorBody
          ref={editor}
          files={FILES}
          skills={SKILLS}
          workspace={NAME}
          root={ROOT}
          pathSeparator={'\\'}
          layout={layout}
          onLayout={setLayout}
          icons={ICONS}
          compact={compact}
          terminal={terminal}
          initial={initial}
        />
      </div>
    </>
  );
}
