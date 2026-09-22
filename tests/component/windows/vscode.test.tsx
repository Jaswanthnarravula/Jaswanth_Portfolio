/**
 * Visual Studio Code on Windows in jsdom (plans/windows/apps/vscode.md), rendered in the real window frame, plus the
 * shared editor body (plans/macos/apps/vscode.md) with the deterministic fixture:
 * WIN-CODE-01 (Mica title bar: in-window menu bar, command centre, layout toggles, caption buttons on the right) ·
 * WIN-CODE-02 (the shared EditorBody over `buildWorkspace` — no fork) · WIN-CODE-03 (command centre / Ctrl+K / Open
 * File… → Windows Search scoped to files) · WIN-CODE-04 (backslash paths; the PowerShell panel loads only when opened) ·
 * WIN-CODE-05 (Menubar APG keys; Alt/F10 unbound) · WIN-CODE-06 (compact: ☰, bottom activity bar, drill-down Explorer,
 * files push in) · MAC-CODE-01 (preview vs pinned tabs, max 6) · MAC-CODE-04 (read-only message once; inlay hints) ·
 * MAC-CODE-05 (Search view on the shared matcher) · MAC-CODE-07 (tree keyboard, plain skills list, axe).
 */
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildWorkspace, fileKey, workspaceName, type WorkspaceFile } from '@/components/content/workspace';
import {
  DEFAULT_LAYOUT,
  EditorBody,
  READ_ONLY_MESSAGE,
  resetEditorSession,
  type EditorIcons,
} from '@/components/os/shared/editor/EditorBody';
import { MAX_TABS, openTab } from '@/components/os/shared/editor/tabs';
import VSCode, { MENUBAR_MIN_WIDTH } from '@/components/os/windows/apps/VSCode';
import { useWinShell, WinShellProvider, type WinShellServices } from '@/components/os/windows/shell-context';
import { WinWindow } from '@/components/os/windows/window/Window';
import type { SkillGroup } from '@/data/schema';
import { getContact, getExperience, getPerson, getProjects, getSkills } from '@/data/selectors';
import { DEFAULT_CAPABILITIES, DEFAULT_PREFS } from '@/lib/kernel/state';
import { dispatch } from '@/stores/kernel-store';
import { prefsStore } from '@/stores/prefs-store';
import { fixturePortfolio as p } from '../../fixtures/portfolio';

const ID = 'windows:editor' as const;
const MENUS = ['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal', 'Help'];

let booted = false;
function boot(w = 1440, h = 900) {
  if (!booted) {
    dispatch({
      type: 'BOOT',
      url: '/windows',
      navType: 'navigate',
      viewport: { w, h, pointer: 'fine' },
      persisted: null,
      capabilities: DEFAULT_CAPABILITIES,
    });
    booted = true;
  } else dispatch({ type: 'VIEWPORT_CHANGED', w, h, pointer: 'fine' });
}

/** The shell's own no-op services (what an app sees outside the shell), with the overrides a test spies on. */
function services(overrides: Partial<WinShellServices> = {}): WinShellServices {
  const probe = renderHook(() => useWinShell());
  const fallback = probe.result.current;
  probe.unmount();
  return { ...fallback, ...overrides };
}

function renderCode({ compact = false, shell = services() }: { compact?: boolean; shell?: WinShellServices } = {}) {
  return render(
    <WinShellProvider value={shell}>
      <WinWindow
        id={ID}
        zIndex={100}
        focused
        compact={compact}
        touch={false}
        shownInCompact
        dimmed={false}
        body={(props) => <VSCode {...props} />}
      />
    </WinShellProvider>,
  );
}

const realFiles = () =>
  buildWorkspace({
    person: getPerson(),
    skills: getSkills(),
    experience: getExperience(),
    projects: getProjects(),
    contact: getContact(),
  });
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const tree = () => screen.getByRole('tree', { name: 'Files Explorer' });
const item = (name: string) => within(tree()).getByRole('treeitem', { name });
const tabs = () => within(screen.getByRole('tablist', { name: 'Open editors' })).getAllByRole('tab');
const tabWrapper = (name: string) => screen.getByRole('tab', { name }).parentElement!;
const region = () => screen.getByRole('region', { name: 'Visual Studio Code' });
const titlebar = () => region().querySelector<HTMLElement>('header[data-drag-region]')!;
const codeLines = (panel: HTMLElement) => [...panel.querySelectorAll<HTMLElement>('pre code > span')];

/** The shared body alone (the macOS app renders it the same way), over the fixture. */
const ICONS = Object.fromEntries(
  [
    'explorer',
    'search',
    'scm',
    'extensions',
    'file',
    'chevronRight',
    'chevronDown',
    'back',
    'close',
    'branch',
    'error',
    'warning',
    'check',
  ].map((key) => [key, <span key={key} aria-hidden="true" />]),
) as unknown as EditorIcons;

function Harness({ files, skills }: { files: readonly WorkspaceFile[]; skills: readonly SkillGroup[] }) {
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  return (
    <EditorBody
      files={files}
      skills={skills}
      workspace="ada-portfolio"
      root="/Users/ada/portfolio"
      pathSeparator="/"
      layout={layout}
      onLayout={setLayout}
      icons={ICONS}
    />
  );
}

const fixtureData = {
  person: p.person,
  skills: p.skills,
  experience: p.experience,
  projects: p.projects,
  contact: p.contact,
};

beforeEach(() => {
  boot();
  resetEditorSession();
  prefsStore.setState({ prefs: DEFAULT_PREFS });
  act(() => {
    dispatch({ type: 'OPEN_APP', os: 'windows', role: 'editor' });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id: ID } });
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('WIN-CODE-01 Windows chrome: Mica title bar, in-window menu bar, command centre, right caption buttons', () => {
  it('the title bar holds the system menu, the menu bar, the command centre, layout toggles and — last — the captions', () => {
    renderCode();
    expect(within(region()).getByRole('heading', { level: 2 })).toHaveTextContent('Visual Studio Code');
    const bar = titlebar();
    const menubar = within(bar).getByRole('menubar', { name: 'Application Menu' });
    expect(
      within(menubar)
        .getAllByRole('menuitem')
        .map((trigger) => trigger.textContent),
    ).toEqual(MENUS);
    const centre = within(bar).getByRole('button', { name: /^Search files in / });
    expect(centre).toHaveTextContent(workspaceName(getPerson()));
    expect(centre).toHaveTextContent('jaswanth-portfolio');
    const toggles = within(bar).getByRole('group', { name: 'Layout controls' });
    const captions = within(bar).getByRole('group', { name: 'Window controls' });
    expect(bar.lastElementChild).toBe(captions);
    const order = [within(bar).getByRole('button', { name: 'Window menu' }), menubar, centre, toggles, captions];
    order
      .slice(1)
      .forEach((element, index) =>
        expect(order[index]!.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(),
      );
    expect(
      within(captions)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Minimize Visual Studio Code', 'Maximize Visual Studio Code', 'Close Visual Studio Code']);
  });

  it('layout toggles show and hide the side bar and the panel; the menus act inside this window', async () => {
    const user = userEvent.setup();
    renderCode();
    const sidebarToggle = screen.getByRole('button', { name: 'Primary Side Bar' });
    const sidebar = region().querySelector('[data-editor-sidebar]')!;
    expect(sidebarToggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(sidebarToggle);
    expect(sidebarToggle).toHaveAttribute('aria-pressed', 'false');
    expect(sidebar).not.toBeVisible();
    await user.click(sidebarToggle);
    expect(sidebar).toBeVisible();

    await user.click(screen.getByRole('menuitem', { name: 'View' }));
    const view = screen.getByRole('menu', { name: 'View' });
    expect(titlebar().contains(view)).toBe(true);
    await user.click(within(view).getByRole('menuitem', { name: 'Search' }));
    expect(screen.getByRole('heading', { level: 3, name: 'Search' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search skills and projects' })).toHaveFocus();

    await user.click(screen.getByRole('menuitem', { name: 'Go' }));
    expect(screen.getByRole('menuitem', { name: 'projects\\portfolio-os.md' })).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'stack.ts' }));
    expect(screen.getByRole('tab', { name: 'stack.ts' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'stack.ts' })).toHaveFocus();
  });
});

describe('WIN-CODE-01 edge cases', () => {
  it('snapped to a quarter, the side bar auto-collapses (and can be reopened)', async () => {
    const user = userEvent.setup();
    renderCode();
    const toggle = screen.getByRole('button', { name: 'Primary Side Bar' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    try {
      act(() => {
        dispatch({ type: 'SNAP_WINDOW', id: ID, zone: 'tl' });
      });
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
      expect(region().querySelector('[data-editor-sidebar]')).not.toBeVisible();
      await user.click(toggle);
      expect(region().querySelector('[data-editor-sidebar]')).toBeVisible();
    } finally {
      act(() => {
        dispatch({ type: 'SNAP_WINDOW', id: ID, zone: null });
      });
    }
  });
});

describe('WIN-CODE-02 the shared editor body over the shared generated files', () => {
  it('renders EditorBody; the Explorer lists buildWorkspace(selectors) in VS Code order; files show the generated text', async () => {
    const user = userEvent.setup();
    renderCode();
    expect(region().querySelector('[data-editor]')).not.toBeNull();
    const files = realFiles();
    const byName = (list: readonly WorkspaceFile[]) => list.map((file) => file.name).sort(collator.compare);
    expect(
      within(tree())
        .getAllByRole('treeitem')
        .map((row) => row.textContent),
    ).toEqual([
      'projects',
      ...byName(files.filter((file) => file.path[0] === 'projects')),
      ...byName(files.filter((file) => file.path.length === 1)),
    ]);
    // The editor's section is the skills: it opens on skills.json, pinned beside the README (a Markdown preview).
    expect(tabs().map((tab) => tab.textContent)).toEqual(['Preview README.md', 'skills.json']);
    expect(screen.getByRole('tab', { name: 'skills.json' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('tab', { name: 'Preview README.md' }));
    const readme = screen.getByRole('tabpanel', { name: 'Preview README.md' });
    expect(within(readme).getByRole('heading', { level: 3, name: getPerson().name })).toBeInTheDocument();
    await user.click(within(readme).getAllByRole('button')[0]!);
    expect(screen.getByRole('tab', { selected: true }).textContent).toMatch(/\.md$/);

    await user.dblClick(item('skills.json'));
    const panel = screen.getByRole('tabpanel', { name: 'skills.json' });
    const text = files.find((file) => fileKey(file) === 'skills.json')!.text;
    expect(codeLines(panel).map((line) => line.querySelector('[data-lc]')!.textContent)).toEqual(text.split('\n'));
    expect(codeLines(panel)[0]!.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(codeLines(panel)[0]!.firstElementChild).toHaveTextContent('1');
    expect(screen.getByText('JSON')).toBeInTheDocument();
    expect(screen.getByText('Prettier')).toBeInTheDocument();
    // The real data publishes no levels or years: no inlay hint is invented.
    expect(panel.textContent).not.toMatch(/\d\/5|\byrs?\b/);
  });

  it('Dark Modern / Light Modern follow the theme preference', () => {
    prefsStore.getState().patch({ theme: 'dark' });
    const { unmount } = renderCode();
    expect(region().querySelector('[data-editor]')).toHaveAttribute('data-scheme', 'dark');
    act(() => prefsStore.getState().patch({ theme: 'light' }));
    expect(region().querySelector('[data-editor]')).toHaveAttribute('data-scheme', 'light');
    unmount();
  });
});

describe('WIN-CODE-03 the command centre opens Windows Search scoped to files', () => {
  it('command centre click, Ctrl+K inside the window and File › Open File… all call openSearch({ scope: files })', async () => {
    const user = userEvent.setup();
    const openSearch = vi.fn();
    renderCode({ shell: services({ openSearch }) });
    const centre = screen.getByRole('button', { name: /^Search files in / });
    await user.click(centre);
    expect(openSearch).toHaveBeenLastCalledWith({ scope: 'files', invoker: centre });

    const row = item('skills.json');
    row.focus();
    expect(fireEvent.keyDown(row, { key: 'k', ctrlKey: true })).toBe(false);
    expect(openSearch).toHaveBeenLastCalledWith({ scope: 'files', invoker: row });

    await user.click(screen.getByRole('menuitem', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Open File…' }));
    expect(openSearch).toHaveBeenLastCalledWith({ scope: 'files', invoker: null });
    expect(openSearch).toHaveBeenCalledTimes(3);
  });

  it('Search "Skills" while the editor is focused brings skills.json forward (the kernel re-focuses it)', async () => {
    const user = userEvent.setup();
    renderCode();
    await user.click(item('stack.ts'));
    expect(screen.getByRole('tab', { name: 'stack.ts' })).toHaveAttribute('aria-selected', 'true');
    // The Search flyout's content result, as the shell dispatches it (the kernel routes skills to the editor).
    act(() => {
      const result = dispatch({
        type: 'OPEN_APP',
        os: 'windows',
        role: 'files',
        location: { kind: 'content', ref: { section: 'skills' } },
        originId: null,
      });
      expect(result.focusTarget).not.toBeNull();
    });
    expect(screen.getByRole('tab', { name: 'skills.json' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'stack.ts' })).toHaveAttribute('aria-selected', 'false');
  });

  it('a request for the skills while the editor is open behind another window brings skills.json to the front', async () => {
    const user = userEvent.setup();
    renderCode();
    await user.click(item('stack.ts'));
    expect(screen.getByRole('tab', { name: 'stack.ts' })).toHaveAttribute('aria-selected', 'true');
    act(() => {
      dispatch({ type: 'OPEN_APP', os: 'windows', role: 'files' });
      dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id: 'windows:files' } });
    });
    try {
      act(() => {
        dispatch({
          type: 'OPEN_APP',
          os: 'windows',
          role: 'editor',
          location: { kind: 'content', ref: { section: 'skills' } },
        });
      });
      expect(screen.getByRole('tab', { name: 'skills.json' })).toHaveAttribute('aria-selected', 'true');
    } finally {
      act(() => {
        dispatch({ type: 'CLOSE_WINDOW', id: 'windows:files' });
        dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id: 'windows:files' } });
      });
    }
  });
});

describe('WIN-CODE-04 backslash paths and the PowerShell terminal panel', () => {
  it('breadcrumbs and tab tooltips use C:\\Users\\{given name}\\portfolio with backslashes', async () => {
    const user = userEvent.setup();
    renderCode();
    const root = `C:\\Users\\${getPerson().givenName}\\portfolio`;
    await user.click(item('portfolio-os.md'));
    const crumbs = screen.getByRole('list', { name: 'Breadcrumbs' });
    expect(crumbs.textContent).toBe('portfolio\\projects\\portfolio-os.md');
    expect(crumbs).toHaveAttribute('title', `${root}\\projects\\portfolio-os.md`);
    expect(screen.getByRole('tab', { name: 'portfolio-os.md' })).toHaveAttribute(
      'title',
      `${root}\\projects\\portfolio-os.md`,
    );
    expect(item('portfolio-os.md')).toHaveAttribute('title', `${root}\\projects\\portfolio-os.md`);
  });

  it('the panel mounts the terminal only when opened, with a PowerShell prompt', async () => {
    const user = userEvent.setup();
    renderCode();
    expect(document.querySelector('[data-terminal]')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Panel' }));
    const panel = screen.getByRole('region', { name: 'Panel' });
    expect(panel).toBeVisible();
    await screen.findByRole('textbox', { name: /^Command, current directory/ }, { timeout: 10_000 });
    const terminal = document.querySelector('[data-terminal]')!;
    await waitFor(() => expect(terminal).toHaveAttribute('data-ready'), { timeout: 10_000 });
    await waitFor(() => expect(terminal.querySelector('form > span')?.textContent).toMatch(/^PS C:\\Users\\/));
    // Closing hides the panel (the terminal session stays mounted) and focus falls back to the editor.
    await user.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(panel).not.toBeVisible();
    expect(terminal.isConnected).toBe(true);
    expect(screen.getByRole('tabpanel', { name: 'skills.json' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Panel' })).toHaveAttribute('aria-pressed', 'false');
  }, 20_000);
});

describe('WIN-CODE-05 in-window Menubar: APG keys, Windows skin, Alt and F10 unbound', () => {
  it('one Tab stop; Right/Left move and wrap; Down opens on the first item; Esc returns to the trigger', async () => {
    const user = userEvent.setup();
    renderCode();
    const menubar = screen.getByRole('menubar', { name: 'Application Menu' });
    const triggers = within(menubar).getAllByRole('menuitem');
    expect(triggers.filter((trigger) => trigger.tabIndex === 0)).toHaveLength(1);
    screen.getByRole('button', { name: 'Window menu' }).focus();
    await user.tab();
    expect(triggers[0]).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(triggers[1]).toHaveFocus();
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(triggers[7]).toHaveFocus();
    await user.keyboard('{Home}{ArrowDown}');
    const file = screen.getByRole('menu', { name: 'File' });
    expect(within(file).getByRole('menuitem', { name: 'Open File…' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('menu', { name: 'Edit' })).toBeInTheDocument();
    // Undo / Redo / Cut are disabled in a read-only workspace: Copy is the first item that takes focus.
    expect(screen.getByRole('menuitem', { name: 'Copy' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(triggers[1]).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: /^Search files in / })).toHaveFocus();

    const row = item('README.md');
    row.focus();
    await user.keyboard('{Alt}{F10}');
    expect(row).toHaveFocus();
    expect(triggers.every((trigger) => trigger.getAttribute('aria-expanded') === 'false')).toBe(true);
  });

  it('View › Appearance is a submenu of checkboxes that drive the layout', async () => {
    const user = userEvent.setup();
    renderCode();
    await user.click(screen.getByRole('menuitem', { name: 'View' }));
    screen.getByRole('menuitem', { name: 'Appearance' }).focus();
    await user.keyboard('{ArrowRight}');
    const minimap = screen.getByRole('menuitemcheckbox', { name: 'Minimap' });
    expect(minimap).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Panel' }));
    expect(screen.getByRole('button', { name: 'Panel' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('WIN-CODE-06 compact: ☰ menu, bottom activity bar, drill-down Explorer, files push in', () => {
  it('the menus collapse into ☰ — a Menu of submenus', async () => {
    const user = userEvent.setup();
    renderCode({ compact: true });
    expect(screen.queryByRole('menubar')).toBeNull();
    const hamburger = screen.getByRole('button', { name: 'Application Menu' });
    await user.click(hamburger);
    const menu = screen.getByRole('menu', { name: 'Application Menu' });
    const entries = within(menu).getAllByRole('menuitem');
    expect(entries.map((entry) => entry.textContent)).toEqual(MENUS);
    expect(entries.every((entry) => entry.getAttribute('aria-haspopup') === 'menu')).toBe(true);
    expect(entries[0]).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('menu', { name: 'File' })).toBeInTheDocument();
    await user.keyboard('{Escape}{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(hamburger).toHaveFocus();
    // Compact has no side bar / panel toggles.
    expect(screen.queryByRole('group', { name: 'Layout controls' })).toBeNull();
  });

  it('Explorer first; folders drill in; a file pushes the editor in (focus follows); Back returns', async () => {
    const user = userEvent.setup();
    renderCode({ compact: true });
    const editor = region().querySelector<HTMLElement>('[data-editor]')!;
    const activity = screen.getByRole('toolbar', { name: 'Activity Bar' });
    expect(activity).toHaveAttribute('aria-orientation', 'horizontal');
    expect(editor.lastElementChild).toBe(activity);
    const group = editor.querySelector<HTMLElement>('[data-editor-group]')!;
    expect(tree()).toBeVisible();
    expect(group).not.toBeVisible();

    await user.click(item('projects'));
    const level = within(tree()).getAllByRole('treeitem');
    expect(level.every((row) => row.textContent!.endsWith('.md'))).toBe(true);
    expect(level[0]).toHaveFocus();
    expect(screen.getByRole('button', { name: 'projects' })).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(item('projects')).toHaveFocus();

    const explorer = tree();
    await user.click(item('skills.json'));
    expect(group).toBeVisible();
    expect(explorer).not.toBeVisible();
    expect(screen.getByRole('tabpanel', { name: 'skills.json' })).toHaveFocus();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(editor.querySelector('[data-minimap]')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Back to Explorer' }));
    expect(tree()).toBeVisible();
    expect(item('skills.json')).toHaveFocus();
  });

  it('a window narrower than the menu bar also collapses it into ☰', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly callback: ResizeObserverCallback) {}
        observe() {
          this.callback([{ contentRect: { width: MENUBAR_MIN_WIDTH - 1 } } as ResizeObserverEntry], this as never);
        }
        disconnect() {}
      },
    );
    renderCode();
    expect(screen.queryByRole('menubar')).toBeNull();
    expect(screen.getByRole('button', { name: 'Application Menu' })).toBeInTheDocument();
    // Not compact: the side bar and its toggles stay.
    expect(screen.getByRole('group', { name: 'Layout controls' })).toBeInTheDocument();
  });
});

describe('MAC-CODE-07 Explorer tree keyboard (APG tree)', () => {
  it('one tab stop; Home/End; Right expands then enters; Left collapses then goes up; type-ahead; Enter pins', async () => {
    const user = userEvent.setup();
    renderCode();
    const rows = () => within(tree()).getAllByRole('treeitem');
    // The tab stop is the active file's row.
    expect(rows().filter((row) => row.tabIndex === 0)).toEqual([item('skills.json')]);
    item('skills.json').focus();
    await user.keyboard('{Home}');
    const folder = item('projects');
    expect(folder).toHaveFocus();
    expect(folder).toHaveAttribute('aria-expanded', 'true');
    const expanded = rows().length;
    await user.keyboard('{ArrowLeft}');
    expect(folder).toHaveAttribute('aria-expanded', 'false');
    expect(rows().length).toBeLessThan(expanded);
    await user.keyboard('{ArrowRight}');
    expect(folder).toHaveAttribute('aria-expanded', 'true');
    expect(folder).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    const child = document.activeElement as HTMLElement;
    expect(child).toHaveAttribute('aria-level', '2');
    await user.keyboard('{ArrowLeft}');
    expect(folder).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(child).toHaveFocus();
    await user.keyboard('{End}');
    expect(rows().at(-1)).toHaveFocus();
    await user.keyboard('{Home}{ArrowLeft}s');
    expect(item('skills.json')).toHaveFocus();
    await user.keyboard('t');
    expect(item('stack.ts')).toHaveFocus();
    expect(rows().filter((row) => row.tabIndex === 0)).toEqual([item('stack.ts')]);
    await user.keyboard('{Enter}');
    expect(screen.getByRole('tabpanel', { name: 'stack.ts' })).toHaveFocus();
    expect(tabWrapper('stack.ts')).not.toHaveAttribute('data-preview');
    expect(item('stack.ts')).toHaveAttribute('aria-selected', 'true');
  });
});

describe('MAC-CODE-01 preview vs pinned tabs (max 6)', () => {
  it('single click previews (italic, one slot); double click pins; a preview tab pins on double click', async () => {
    const user = userEvent.setup();
    renderCode();
    expect(tabs()).toHaveLength(2);
    await user.click(item('stack.ts'));
    expect(tabWrapper('stack.ts')).toHaveAttribute('data-preview');
    expect(screen.getByRole('tab', { name: 'stack.ts' })).toHaveAttribute('aria-selected', 'true');
    await user.click(item('experience.log'));
    expect(screen.queryByRole('tab', { name: 'stack.ts' })).toBeNull();
    expect(tabWrapper('experience.log')).toHaveAttribute('data-preview');
    expect(tabs()).toHaveLength(3);
    await user.dblClick(item('experience.log'));
    expect(tabWrapper('experience.log')).not.toHaveAttribute('data-preview');
    await user.click(item('.env.example'));
    await user.dblClick(screen.getByRole('tab', { name: '.env.example' }));
    expect(tabWrapper('.env.example')).not.toHaveAttribute('data-preview');
    // Delete closes the focused tab; focus moves to its neighbour.
    screen.getByRole('tab', { name: '.env.example' }).focus();
    await user.keyboard('{Delete}');
    expect(screen.queryByRole('tab', { name: '.env.example' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'experience.log' })).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'experience.log' })).toHaveAttribute('aria-selected', 'true');
  });

  it('past 6 tabs the oldest preview closes; with no preview left, the oldest tab', async () => {
    const user = userEvent.setup();
    renderCode();
    const projects = getProjects().map((project) => `${project.slug}.md`);
    const pin = async (name: string) => {
      item(name).focus();
      await user.keyboard('{Enter}');
    };
    await user.click(item('stack.ts'));
    for (const name of ['experience.log', '.env.example', projects[0]!]) await pin(name);
    expect(tabs()).toHaveLength(MAX_TABS);
    expect(tabWrapper('stack.ts')).toHaveAttribute('data-preview');
    await pin(projects[1]!);
    expect(tabs()).toHaveLength(MAX_TABS);
    expect(screen.queryByRole('tab', { name: 'stack.ts' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Preview README.md' })).toBeInTheDocument();
    await pin(projects[2]!);
    expect(tabs()).toHaveLength(MAX_TABS);
    expect(screen.queryByRole('tab', { name: 'Preview README.md' })).toBeNull();
  });

  it('openTab: the rules as a pure function', () => {
    let tabs = openTab([], 'a', 'pinned', null);
    tabs = openTab(tabs, 'b', 'preview', 'a');
    tabs = openTab(tabs, 'c', 'preview', 'b');
    expect(tabs.map((tab) => [tab.key, tab.preview])).toEqual([
      ['a', false],
      ['c', true],
    ]);
    expect(openTab(tabs, 'c', 'pinned', 'c').find((tab) => tab.key === 'c')!.preview).toBe(false);
    expect(openTab(tabs, 'a', 'preview', 'c')).toBe(tabs);
  });
});

describe('MAC-CODE-04 read-only message (once per session) and inlay skill hints', () => {
  it('typing in the editor shows the read-only status message once per session', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Harness files={buildWorkspace(fixtureData)} skills={p.skills} />);
    await user.dblClick(item('stack.ts'));
    const panel = screen.getByRole('tabpanel', { name: 'stack.ts' });
    panel.focus();
    const status = screen.getByRole('status');
    expect(status).toBeEmptyDOMElement();
    await user.keyboard('x');
    expect(status).toHaveTextContent(READ_ONLY_MESSAGE);
    await act(async () => {
      vi.advanceTimersByTime(7000);
    });
    expect(status).toBeEmptyDOMElement();
    await user.keyboard('y{Backspace}{Enter}');
    expect(status).toBeEmptyDOMElement();
  });

  it('skills.json: the caret line shows a published level / years as an inlay hint (never invented)', async () => {
    const user = userEvent.setup();
    const skills: SkillGroup[] = [
      { id: 'langs', label: 'Languages', items: [{ name: 'Go', level: 4, years: 6 }, { name: 'TypeScript' }] },
    ];
    render(<Harness files={buildWorkspace({ ...fixtureData, skills })} skills={skills} />);
    await user.dblClick(item('skills.json'));
    const panel = screen.getByRole('tabpanel', { name: 'skills.json' });
    panel.focus();
    const lines = codeLines(panel);
    expect(lines[0]).toHaveAttribute('data-caret');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(panel.querySelector('[data-caret]')).toBe(lines[2]);
    expect(lines[2]).toHaveTextContent('"Go",4/5 · 6 yrs');
    expect(lines[3]!.textContent).toBe('4    "TypeScript"');
    expect(screen.getByText('Ln 3, Col 1')).toBeInTheDocument();
    await user.keyboard('{End}');
    expect(screen.getByText('Ln 3, Col 10')).toBeInTheDocument();
    await user.keyboard('{Control>}{End}{/Control}');
    expect(panel.querySelector('[data-caret]')).toBe(lines.at(-1));
  });
});

describe('MAC-CODE-05 Search view on the shared matcher', () => {
  it('searches the skills and project files; a result opens its file at the matching line', async () => {
    const user = userEvent.setup();
    const files = buildWorkspace(fixtureData);
    render(<Harness files={files} skills={p.skills} />);
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(screen.getByRole('heading', { level: 3, name: 'Search' })).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: 'Search skills and projects' }), 'typescript');
    expect(screen.getByText('3 results in 3 files')).toBeInTheDocument();
    const results = within(screen.getByRole('group', { name: 'Search results' })).getAllByRole('button');
    expect(results.map((result) => result.getAttribute('aria-label'))).toEqual([
      '"TypeScript", skills.json line 4',
      "'TypeScript',, stack.ts line 6",
      '- TypeScript, portfolio-os.md line 15',
    ]);
    expect(results[0]!.querySelector('mark')).toHaveTextContent('TypeScript');
    await user.click(results[0]!);
    expect(screen.getByRole('tab', { name: 'skills.json' })).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel', { name: 'skills.json' });
    expect(panel.querySelector('[data-caret]')).toBe(codeLines(panel)[3]);
    expect(screen.getByText('Ln 4, Col 1')).toBeInTheDocument();
    // README and the log are outside the search scope.
    await user.clear(screen.getByRole('searchbox', { name: 'Search skills and projects' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search skills and projects' }), 'Testville');
    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });
});

describe('MAC-CODE-07 plain skills alternative and semantics', () => {
  it('"View as plain skills list" renders SkillsMatrix with real headings; back to code', async () => {
    const user = userEvent.setup();
    renderCode();
    await user.click(item('skills.json'));
    await user.click(screen.getByRole('button', { name: 'View as plain skills list' }));
    const panel = screen.getByRole('tabpanel', { name: 'skills.json' });
    expect(panel.querySelector('pre')).toBeNull();
    for (const group of getSkills())
      expect(within(panel).getByRole('heading', { level: 3, name: group.label })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View skills.json as code' }));
    expect(screen.getByRole('tabpanel', { name: 'skills.json' }).querySelector('pre')).not.toBeNull();
  });

  it('roles: toolbar, tree, tablist, menubar; headings start at h3; axe finds no violations', async () => {
    const user = userEvent.setup();
    const { container } = renderCode();
    await user.click(item('skills.json'));
    expect(screen.getByRole('toolbar', { name: 'Activity Bar' })).toHaveAttribute('aria-orientation', 'vertical');
    expect(screen.getByRole('button', { name: 'Explorer' })).toHaveAttribute('aria-pressed', 'true');
    const results = await axe.run(container, {
      runOnly: {
        type: 'rule',
        values: [
          'heading-order',
          'aria-allowed-attr',
          'aria-allowed-role',
          'aria-required-children',
          'aria-required-parent',
          'aria-valid-attr-value',
          'aria-hidden-focus',
          'nested-interactive',
          'button-name',
          'duplicate-id-aria',
          'list',
          'listitem',
        ],
      },
    });
    expect(
      results.violations.map(
        (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target).join(' | ')}`,
      ),
    ).toEqual([]);
  });
});
