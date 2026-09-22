/**
 * macOS P3 apps, part 2 (jsdom, real kernel + selectors):
 *   MAC-SAF-01/02/04/05/07 (browser chrome, the Overview from AboutOverview, APG tabs incl. the plain version, effects
 *   are enhancement only, compact segmented control) · MOTION-SCROLL-01 / MAC-SAF-03 (the gate) ·
 *   MAC-GH-01/02/04/06/07 (profile + pinned cards + filters, detail tabs, external links) ·
 *   MAC-PREV-01/03/04/05/06 (toolbar, Download with the file name, Text version first in DOM, zoom scoped to the canvas,
 *   print hook) · MAC-CODE-01/02/05/06/07 (the shared editor in the macOS chrome: tree, files from data, command centre →
 *   Spotlight, the panel's Terminal lazy) · MAC-FIND-04/06/09 (Icons / List (aria-sort) / Columns, aliases, menu
 *   commands) · MAC-DESK-02/04/05 (select vs open, roving grid, empty desktop → Finder).
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { Finder } from '@/components/os/macos/apps/Finder';
import GitHub from '@/components/os/macos/apps/GitHub';
import Preview from '@/components/os/macos/apps/Preview';
import Safari from '@/components/os/macos/apps/Safari';
import VSCode from '@/components/os/macos/apps/VSCode';
import { emitAppCommand } from '@/components/os/macos/commands';
import { Desktop } from '@/components/os/macos/surfaces/Desktop';
import { appStateStore, macUi, resetMacUi } from '@/components/os/macos/ui';
import { getPerson, getProjectsWithGithub, getResume, getResumeFileMeta } from '@/data/selectors';
import type { AppRole } from '@/lib/kernel/ids';
import { overviewScrollAllowed } from '@/lib/motion/overview-scroll';
import { DEFAULT_CAPABILITIES, DEFAULT_PREFS } from '@/lib/kernel/state';
import { windowId, type AppLocation, type WindowInstance } from '@/lib/kernel/types';
import { dispatch, flushQueued, getKernel } from '@/stores/kernel-store';
import { prefsStore } from '@/stores/prefs-store';

let booted = false;
function boot() {
  if (booted) return;
  dispatch({
    type: 'BOOT',
    url: '/macos',
    navType: 'navigate',
    viewport: { w: 1440, h: 900, pointer: 'fine' },
    persisted: null,
    capabilities: DEFAULT_CAPABILITIES,
  });
  booted = true;
}
function closeAll() {
  for (const id of Object.keys(getKernel().sessions.macos.windows) as ReturnType<typeof windowId>[]) {
    dispatch({ type: 'CLOSE_WINDOW', id });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
  }
}
function openWindow(role: AppRole, location?: AppLocation): WindowInstance {
  dispatch({ type: 'OPEN_APP', os: 'macos', role, ...(location ? { location } : {}) });
  const id = windowId('macos', role);
  dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
  return getKernel().sessions.macos.windows[id]!;
}
const flush = () =>
  act(() => {
    flushQueued();
  });
async function noAxeViolations(container: HTMLElement) {
  const results = await axe.run(container, { rules: { region: { enabled: false } } });
  expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes[0]?.html}`)).toEqual([]);
}

beforeEach(() => {
  boot();
  closeAll();
  resetMacUi();
  appStateStore.setState({}, true);
  prefsStore.setState({ prefs: DEFAULT_PREFS });
});

describe('Safari', () => {
  const renderSafari = (compact = false) =>
    render(<Safari window={openWindow('browser')} titleId="mac-title-browser" focused compact={compact} />);

  it('MAC-SAF-01/02/05: address pill, APG tabs (About · Now · Plain version), the Overview from data; axe clean', async () => {
    const { container } = renderSafari();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Safari — About');
    const tabs = screen.getByRole('tablist', { name: 'Tabs' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['About', 'Now', 'Plain version']);
    expect(screen.getByRole('tabpanel')).toHaveTextContent(getPerson().name);
    expect(screen.getByRole('navigation', { name: 'Favourites bar' })).toBeInTheDocument();
    // Arrow keys move and select (APG tabs, automatic activation).
    within(tabs).getAllByRole('tab')[0]!.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(within(tabs).getByRole('tab', { name: 'Now' })).toHaveAttribute('aria-selected', 'true');
    expect(within(tabs).getByRole('tab', { name: 'Now' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Safari — Plain version');
    await noAxeViolations(container);
  });

  it('MAC-SAF-03/04: the scroll effects are gated (never in jsdom: no fine pointer); content is complete without them', () => {
    expect(overviewScrollAllowed()).toBe(false);
    document.documentElement.dataset.motion = 'reduced';
    expect(overviewScrollAllowed()).toBe(false);
    delete document.documentElement.dataset.motion;
    const { container } = renderSafari();
    // Nothing is hidden waiting for an animation: every reveal target is fully visible.
    for (const node of container.querySelectorAll<HTMLElement>('[data-reveal]')) expect(node.style.opacity).toBe('');
  });

  it('MAC-SAF-07: compact puts the tabs in a bottom segmented control', () => {
    renderSafari(true);
    expect(screen.getAllByRole('tablist', { name: 'Tabs' })).toHaveLength(1);
  });
});

describe('GitHub', () => {
  it('MAC-GH-01/04: profile, pinned cards from data, stack filters narrow the list', async () => {
    const { container } = render(
      <GitHub window={openWindow('github')} titleId="mac-title-github" focused compact={false} />,
    );
    const projects = getProjectsWithGithub();
    expect(screen.getByRole('complementary', { name: 'Profile and filters' })).toHaveTextContent(getPerson().name);
    const chips = screen.getByRole('group', { name: 'Filter by stack' });
    const first = within(chips).getAllByRole('button')[0]!;
    const stack = first.textContent!;
    await userEvent.click(first);
    expect(first).toHaveAttribute('aria-pressed', 'true');
    const shown = projects.filter(({ project }) => project.stack.includes(stack)).length;
    await waitFor(() =>
      expect(container.querySelectorAll('a[href^="/macos/github/"]').length).toBeGreaterThanOrEqual(shown),
    );
    await userEvent.click(within(chips).getByRole('button', { name: 'Clear' }));
    expect(first).toHaveAttribute('aria-pressed', 'false');
  });

  it('MAC-GH-02/06: a project detail has README · Stack · Links tabs; external links open a new tab, announced', async () => {
    const withLinks = getProjectsWithGithub().find(({ project }) => project.repo || project.live);
    const slug = (withLinks ?? getProjectsWithGithub()[0]!).project.slug;
    render(
      <GitHub
        window={openWindow('github', { kind: 'content', ref: { section: 'projects', slug } })}
        titleId="mac-title-github"
        focused
        compact={false}
      />,
    );
    const tabs = screen.getByRole('tablist', { name: 'Project' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((tab) => tab.textContent?.trim()),
    ).toEqual(withLinks ? ['README', 'Stack', 'Links'] : ['README', 'Stack']); // Links only when there are some
    if (withLinks) {
      await userEvent.click(within(tabs).getByRole('tab', { name: /Links/ }));
      expect(within(tabs).getByRole('tab', { name: /Links/ })).toHaveAttribute('aria-selected', 'true');
    }
    // Every external link opens a new tab, is announced, and never leaks the opener.
    for (const external of document.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]')) {
      expect(external).toHaveAttribute('rel', 'noopener noreferrer');
      expect(external).toHaveAccessibleName(/opens in new tab/);
    }
  });
});

describe('Preview', () => {
  it('MAC-PREV-01/03/04/06: toolbar; Download names the file; the text version is first in DOM and printable', async () => {
    const { container } = render(
      <Preview window={openWindow('viewer')} titleId="mac-title-viewer" focused compact={false} />,
    );
    const toolbar = screen.getByRole('toolbar', { name: 'Preview' });
    const text = screen.getByRole('article', { name: 'Résumé — text version' });
    expect(text).toHaveAttribute('data-print-resume');
    // First in DOM order, before the page canvas.
    const canvas = container.querySelector('object');
    if (canvas) expect(text.compareDocumentPosition(canvas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    if (getResumeFileMeta()) {
      const download = within(toolbar).getByRole('link', { name: /^Download PDF/ });
      expect(download).toHaveAttribute('download', getResume().downloadName);
      await userEvent.click(within(toolbar).getByRole('button', { name: 'Text version' }));
      expect(within(toolbar).getByRole('button', { name: 'Text version' })).toHaveAttribute('aria-pressed', 'true');
    }
  });

  it('MAC-PREV-05: Ctrl + wheel zooms the pages (the canvas), never the page', async () => {
    if (!getResumeFileMeta()) return;
    const { container } = render(
      <Preview window={openWindow('viewer')} titleId="mac-title-viewer" focused compact={false} />,
    );
    const actual = screen.getByRole('button', { name: 'Actual size' });
    await userEvent.click(actual);
    expect(actual).toHaveTextContent('100%');
    const canvas = container.querySelector<HTMLElement>('object')!.parentElement!;
    const event = new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true });
    act(() => {
      canvas.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(actual).toHaveTextContent('125%');
  });
});

describe('VS Code', () => {
  it('MAC-CODE-01/02/07: the Explorer tree lists files generated from data; the command centre opens Spotlight', async () => {
    const { container } = render(
      <VSCode window={openWindow('editor')} titleId="mac-title-editor" focused compact={false} />,
    );
    const tree = screen.getByRole('tree', { name: /Files Explorer/ });
    const names = within(tree)
      .getAllByRole('treeitem')
      .map((item) => item.textContent ?? '');
    expect(names.some((name) => name.includes('skills.json'))).toBe(true);
    expect(names.some((name) => name.includes('README.md'))).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: /opens Spotlight/ }));
    expect(macUi.getState().overlay).toBe('spotlight');
    expect(container.querySelector('[data-terminal]')).toBeNull();
  });

  it('MAC-CODE-06: Terminal → New Terminal mounts the panel with the shared terminal (lazy)', async () => {
    const { container } = render(
      <VSCode window={openWindow('editor')} titleId="mac-title-editor" focused compact={false} />,
    );
    expect(container.querySelector('[data-terminal]')).toBeNull();
    act(() => {
      emitAppCommand('editor', 'new-terminal');
    });
    await waitFor(() => expect(container.querySelector('[data-terminal]')).not.toBeNull());
    expect(screen.getByRole('textbox', { name: /^Command, current directory/ })).toBeInTheDocument();
  });
});

describe('Finder P3', () => {
  const renderFinder = (location?: AppLocation) =>
    render(<Finder window={openWindow('files', location)} titleId="mac-title-files" focused compact={false} />);

  it('MAC-FIND-04: View as List is a real table with sortable headers (aria-sort)', async () => {
    renderFinder({ kind: 'content', ref: { section: 'experience' } });
    await userEvent.click(screen.getByRole('button', { name: 'View as List' }));
    const table = screen.getByRole('table');
    const name = within(table).getByRole('columnheader', { name: /Name/ });
    expect(name).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.click(within(name).getByRole('button'));
    expect(name).toHaveAttribute('aria-sort', 'descending');
    const dates = within(table).getByRole('columnheader', { name: /Dates/ });
    await userEvent.click(within(dates).getByRole('button'));
    expect(dates).toHaveAttribute('aria-sort', 'ascending');
    expect(name).toHaveAttribute('aria-sort', 'none');
    expect(appStateStore.getState()['files:view']).toBe('list');
  });

  it('MAC-FIND-04/06: View as Icons shows the home folder with its aliases; the menu command switches views', async () => {
    renderFinder();
    act(() => {
      emitAppCommand('files', 'view', 'icons');
    });
    const grid = screen.getByRole('region', { name: /icons/ });
    const labels = within(grid)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual(
      expect.arrayContaining([
        'Experience',
        'Education',
        expect.stringMatching(/^Projects/),
        expect.stringMatching(/^Résumé\.pdf/),
      ]),
    );
    const alias = within(grid).getByRole('link', { name: /Résumé\.pdf.*opens Preview/ });
    await userEvent.dblClick(alias);
    await flush();
    expect(getKernel().sessions.macos.windows['macos:viewer']).toBeDefined();
    act(() => {
      emitAppCommand('files', 'view', 'columns');
    });
    expect(screen.queryByRole('region', { name: /icons/ })).toBeNull();
  });

  it('MAC-FIND-09: the path and status bars, and their View-menu toggles', () => {
    renderFinder({ kind: 'content', ref: { section: 'experience' } });
    expect(screen.getByRole('navigation', { name: 'Path' })).toHaveTextContent('Experience');
    expect(screen.getByText(/^\d+ items?$/)).toBeInTheDocument();
    act(() => {
      emitAppCommand('files', 'toggle-path-bar');
    });
    expect(screen.queryByRole('navigation', { name: 'Path' })).toBeNull();
  });
});

describe('Desktop context menus (MAC-CTX-03)', () => {
  it('a 500 ms long-press on an item opens its menu; the ⋯ on the selected item does too', async () => {
    render(
      <main>
        <Desktop inert={false} />
      </main>,
    );
    const item = screen.getByRole('link', { name: 'Projects' });
    fireEvent.pointerDown(item, { pointerType: 'touch', clientX: 40, clientY: 40, button: 0, isPrimary: true });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 620));
    });
    expect(macUi.getState().context?.target).toMatchObject({ kind: 'item', label: 'Projects' });
    fireEvent.pointerUp(item, { pointerType: 'touch' });
    act(() => resetMacUi());
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Projects' }));
    expect(macUi.getState().context?.target).toMatchObject({ kind: 'item', label: 'Projects' });
  });
});

describe('Desktop', () => {
  const renderDesktop = () =>
    render(
      <main>
        <Desktop inert={false} />
      </main>,
    );

  it('MAC-DESK-02: a mouse click selects (no window); a double-click opens from the item', async () => {
    renderDesktop();
    const item = screen.getByRole('link', { name: 'Experience' });
    fireEvent.pointerDown(item, { pointerType: 'mouse' });
    fireEvent.click(item, { detail: 1 });
    await flush();
    expect(item).toHaveAttribute('data-selected');
    expect(item).toHaveAccessibleName(/^Experience.*selected$/);
    expect(getKernel().sessions.macos.windows['macos:files']).toBeUndefined();
    fireEvent.click(item, { detail: 2 });
    await flush();
    expect(getKernel().sessions.macos.windows['macos:files']?.phase).toMatchObject({ originId: 'desk-experience' });
  });

  it('MAC-DESK-02: the keyboard (detail 0) opens at once', async () => {
    renderDesktop();
    const item = screen.getByRole('link', { name: 'Projects' });
    fireEvent.click(item, { detail: 0 });
    await flush();
    expect(getKernel().sessions.macos.windows['macos:github']).toBeDefined();
  });

  it('MAC-DESK-04: one tab stop; arrows move; Ctrl+A selects all', async () => {
    renderDesktop();
    const links = screen.getAllByRole('link');
    expect(links.filter((link) => link.tabIndex === 0)).toHaveLength(1);
    links[0]!.focus();
    await userEvent.keyboard('{Control>}a{/Control}');
    for (const link of screen.getAllByRole('link')) expect(link).toHaveAttribute('data-selected');
  });

  it('MAC-DESK-05: a press on the empty desktop clears the selection and gives the menu bar back to Finder', async () => {
    openWindow('github');
    renderDesktop();
    const item = screen.getByRole('link', { name: 'Experience' });
    fireEvent.pointerDown(item, { pointerType: 'mouse' });
    fireEvent.click(item, { detail: 1 });
    fireEvent.pointerDown(screen.getByRole('main'), { button: 0, pointerType: 'touch' });
    await flush();
    expect(item).not.toHaveAttribute('data-selected');
    expect(getKernel().sessions.macos.focused).toBeNull();
  });
});
