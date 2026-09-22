/**
 * File Explorer in jsdom (plans/windows/apps/file-explorer.md), rendered in the real window frame:
 * WIN-EXP-01 (tabbed title bar, breadcrumb, command bar, nav pane, Details list from the selectors) · WIN-EXP-02
 * (select → details pane + URL; open → document view in the tab) · WIN-EXP-03 (Back / Forward / Up, crumbs, sibling
 * menus) · WIN-EXP-04 (editable address bar: typed paths, the "Windows can't find" message) · WIN-EXP-05 (sortable
 * table with aria-sort; Tiles / Large icons) · WIN-EXP-06 (Home: Quick access + Recent from data) · WIN-EXP-07
 * (shortcuts open GitHub and Edge's PDF tab) · WIN-EXP-08 (compact drill-down) · the removed-item InfoBar
 * (plans/windows/06) · semantics + axe (plans/windows/05).
 */
import { readFileSync } from 'node:fs';
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Explorer from '@/components/os/windows/apps/Explorer';
import { explorerFileName, fileSafe, formatExplorerPath } from '@/components/os/windows/apps/explorer-path';
import { useWinShell, WinShellProvider, type WinShellServices } from '@/components/os/windows/shell-context';
import { WinWindow } from '@/components/os/windows/window/Window';
import type { MenuEntry } from '@/components/primitives/Menu';
import { getCurrentRole, getEducation, getExperience, getPerson, getProjects } from '@/data/selectors';
import { routeCodec } from '@/lib/kernel/route';
import { currentLocation, DEFAULT_CAPABILITIES, deriveRoute } from '@/lib/kernel/state';
import type { AppLocation } from '@/lib/kernel/types';
import { dispatch, flushQueued, getKernel } from '@/stores/kernel-store';

const ID = 'windows:files' as const;
const roles = getExperience();
const schools = getEducation();
const role = roles[0]!;

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

function closeAll() {
  for (const id of Object.keys(getKernel().sessions.windows.windows) as (typeof ID)[]) {
    dispatch({ type: 'CLOSE_WINDOW', id });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
  }
}

function openExplorer(location: AppLocation = { kind: 'content', ref: { section: 'experience' } }) {
  dispatch({ type: 'OPEN_APP', os: 'windows', role: 'files', location });
  dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id: ID } });
}

/** The shell's own no-op services, with spies for what the Explorer hands to the shell. */
function services(overrides: Partial<WinShellServices> = {}): WinShellServices {
  const probe = renderHook(() => useWinShell());
  const fallback = probe.result.current;
  probe.unmount();
  return {
    ...fallback,
    openMenu: vi.fn(),
    openProperties: vi.fn(),
    openSearch: vi.fn(),
    copyLink: vi.fn(() => Promise.resolve(true)),
    copyText: vi.fn(() => Promise.resolve(true)),
    ...overrides,
  };
}

function renderExplorer({ compact = false, shell = services() }: { compact?: boolean; shell?: WinShellServices } = {}) {
  const view = render(
    <WinShellProvider value={shell}>
      <main>
        <h1>Windows 11 — test</h1>
        <WinWindow
          id={ID}
          zIndex={100}
          focused
          compact={compact}
          touch={false}
          shownInCompact
          dimmed={false}
          body={(props) => <Explorer {...props} />}
        />
      </main>
    </WinShellProvider>,
  );
  return { ...view, shell };
}

/** Presses dispatch after the next paint (shared/10 INP); commit them now. */
const commit = () =>
  act(() => {
    flushQueued();
  });

const location = () => currentLocation(getKernel().sessions.windows.windows[ID]!);
const url = () => routeCodec.encode(deriveRoute(getKernel()));
const fileName = (company: string) => `${fileSafe(company)}.docx`;
const table = () => screen.getByRole('table', { name: 'Experience' });
const rowLinks = () => within(table()).getAllByRole('link');
const menuSpec = (shell: WinShellServices, call = -1) =>
  vi.mocked(shell.openMenu).mock.calls.at(call)![0] as Parameters<WinShellServices['openMenu']>[0];
/** What a screen reader reads for an element: its text without the aria-hidden decorations (the PDF badge). */
const spoken = (element: Element) => {
  const clone = element.cloneNode(true) as Element;
  for (const hidden of clone.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
  return clone.textContent?.trim() ?? '';
};
const labels = (entries: readonly MenuEntry[]) =>
  entries.map((entry) => (entry.kind === 'separator' ? '—' : entry.label));

async function audit(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: {
      type: 'rule',
      values: [
        'heading-order',
        'list',
        'listitem',
        'aria-allowed-attr',
        'aria-required-children',
        'aria-valid-attr-value',
        'nested-interactive',
        'button-name',
        'link-name',
      ],
    },
  });
  return results.violations.map((violation) => violation.id);
}

beforeEach(() => {
  boot();
  act(() => closeAll());
  act(() => openExplorer());
});

describe('WIN-EXP-01 tabbed Mica title bar, breadcrumb, command bar, nav pane, Details list', () => {
  it('lists one {Company}.docx per role from the selectors under Name · Role · Dates · Location', () => {
    renderExplorer();
    const region = screen.getByRole('region', { name: 'File Explorer — Experience' });
    expect(within(region).getByRole('heading', { level: 2 })).toHaveTextContent('File Explorer — Experience');
    expect(within(region).getByRole('button', { name: 'Close tab' })).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: 'New tab' })).toHaveAttribute('aria-disabled', 'true');

    const address = within(region).getByRole('navigation', { name: 'Address' });
    expect(within(address).getAllByRole('link').map(spoken)).toEqual(['Home', 'Experience']);
    expect(within(address).getByRole('link', { name: 'Experience' })).toHaveAttribute('aria-current', 'page');

    const commands = within(region).getByRole('toolbar', { name: 'Command bar' });
    for (const name of ['Copy link', 'Share', 'Sort', 'View', 'Details', 'See more'])
      expect(within(commands).getByRole('button', { name })).toBeInTheDocument();
    for (const name of ['New', 'Cut', 'Copy', 'Paste'])
      expect(within(commands).getByRole('button', { name })).toHaveAttribute('aria-disabled', 'true');

    const nav = within(region).getByRole('navigation', { name: 'Navigation pane' });
    expect(within(nav).getAllByRole('link').map(spoken)).toEqual([
      'Home',
      'Experience',
      'Education',
      'Projects',
      'Résumé',
      'This PC',
    ]);
    expect(within(nav).getByRole('link', { name: 'Experience' })).toHaveAttribute('aria-current', 'page');

    expect(
      within(table())
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Name', 'Role', 'Dates', 'Location']);
    expect(rowLinks().map(spoken)).toEqual(roles.map((entry) => fileName(entry.company)));
    const firstRow = rowLinks()[0]!.closest('tr')!;
    expect(firstRow).toHaveTextContent(role.role ?? '');
    expect(screen.getByText(`${roles.length} ${roles.length === 1 ? 'item' : 'items'}`)).toBeInTheDocument();
    // The storyboard's sample names never reach the screen (north-star B8/B9).
    for (const sample of ['Acme', 'Globex', 'Initech']) expect(region).not.toHaveTextContent(sample);
  });

  it('types no career fact: every name, role and school reaches the Explorer through the selectors', () => {
    const source = readFileSync('components/os/windows/apps/Explorer.tsx', 'utf8');
    const facts = [
      getPerson().givenName,
      ...roles.flatMap((entry) => [entry.company, entry.role, entry.client]),
      ...schools.flatMap((entry) => [entry.school, entry.shortName, entry.degree]),
      ...getProjects().map((project) => project.name),
    ].filter((fact): fact is string => !!fact && fact.length > 3);
    for (const fact of facts) expect(source).not.toContain(fact);
  });

  it('the tab ✕ closes the window', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.click(screen.getByRole('button', { name: 'Close tab' }));
    commit();
    expect(getKernel().sessions.windows.windows[ID]?.phase.s).toBe('closing');
  });
});

describe('WIN-EXP-02 select → details pane + URL; open → document view in the tab', () => {
  it('a click selects: the URL follows and the details pane shows the role', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.click(rowLinks()[0]!);
    commit();
    expect(location()).toEqual({ kind: 'content', ref: { section: 'experience', slug: role.slug } });
    expect(url()).toBe(`/windows/explorer/experience/${role.slug}`);
    expect(rowLinks()[0]).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('1 item selected')).toBeInTheDocument();

    const toggle = within(screen.getByRole('toolbar', { name: 'Command bar' })).getByRole('button', {
      name: 'Details',
    });
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    const pane = screen.getByRole('complementary', { name: 'Details pane' });
    expect(within(pane).getByText(fileName(role.company))).toBeInTheDocument();
    expect(within(pane).getByRole('heading', { level: 3 })).toHaveTextContent(role.role ?? role.company);
    await user.click(toggle);
    expect(screen.queryByRole('complementary', { name: 'Details pane' })).not.toBeInTheDocument();
  });

  it('arrow keys move the selection with the focus', async () => {
    if (roles.length < 2) return;
    const user = userEvent.setup();
    renderExplorer();
    await user.click(rowLinks()[0]!);
    commit();
    await user.keyboard('{ArrowDown}');
    commit();
    expect(document.activeElement).toBe(rowLinks()[1]);
    expect(location()).toEqual({ kind: 'content', ref: { section: 'experience', slug: roles[1]!.slug } });
  });

  it('Enter opens the document view with a "Back to folder" crumb; focus follows both ways', async () => {
    const user = userEvent.setup();
    const { container } = renderExplorer();
    await user.click(rowLinks()[0]!);
    commit();
    await user.keyboard('{Enter}');
    commit();
    const document = screen.getByRole('region', { name: fileName(role.company) });
    expect(within(document).getByRole('heading', { level: 3 })).toHaveTextContent(role.role ?? role.company);
    expect(globalThis.document.activeElement).toBe(document);
    const address = screen.getByRole('navigation', { name: 'Address' });
    expect(within(address).getAllByRole('link').map(spoken)).toEqual(['Home', 'Experience', fileName(role.company)]);
    expect(await audit(container)).toEqual([]);

    await user.click(within(document).getByRole('button', { name: 'Back to folder' }));
    expect(screen.queryByRole('region', { name: fileName(role.company) })).not.toBeInTheDocument();
    expect(globalThis.document.activeElement).toBe(rowLinks()[0]);
    expect(location()).toEqual({ kind: 'content', ref: { section: 'experience', slug: role.slug } });
  });

  it('double-click opens; an item opened from outside (Start, Search) shows its document', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.dblClick(rowLinks()[0]!);
    commit();
    const opened = screen.getByRole('region', { name: fileName(role.company) });
    expect(globalThis.document.activeElement).toBe(opened);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: fileName(role.company) })).not.toBeInTheDocument();
    expect(globalThis.document.activeElement).toBe(rowLinks()[0]);

    const other = roles.at(-1)!;
    act(() => {
      dispatch({
        type: 'OPEN_APP',
        os: 'windows',
        role: 'files',
        location: { kind: 'content', ref: { section: 'experience', slug: other.slug } },
      });
    });
    expect(screen.getByRole('region', { name: fileName(other.company) })).toBeInTheDocument();
  });

  it('right-click / Shift+F10 opens the item menu: Copy link · Share, Open, Open in new window, Properties', async () => {
    const { shell } = renderExplorer();
    fireEvent.contextMenu(rowLinks()[0]!, { button: 2, clientX: 40, clientY: 60 });
    commit();
    const spec = menuSpec(shell);
    expect(spec.at).toEqual({ x: 40, y: 60 });
    expect(spec.commands?.map((command) => command.label)).toEqual(['Copy link', 'Share']);
    expect(labels(spec.items)).toEqual(['Open', 'Open in new window', '—', 'Properties']);
    expect(spec.items.find((entry) => entry.id === 'new-window')).toMatchObject({ disabled: true });
    expect(labels(spec.legacy ?? [])).toEqual(['Open', 'Copy as path', '—', 'Properties']);
    expect(location()).toEqual({ kind: 'content', ref: { section: 'experience', slug: role.slug } });

    act(() => (spec.items.find((entry) => entry.id === 'properties') as { onSelect: () => void }).onSelect());
    expect(vi.mocked(shell.openProperties).mock.calls.at(-1)![0]).toMatchObject({
      title: fileName(role.company),
      ref: { section: 'experience', slug: role.slug },
    });
    await act(async () => spec.commands![0]!.onSelect());
    expect(shell.copyLink).toHaveBeenCalledWith({ section: 'experience', slug: role.slug }, fileName(role.company));

    // Shift+F10 / the Menu key: the menu opens at the item, not at the pointer.
    fireEvent.contextMenu(rowLinks()[0]!, { button: 0 });
    expect(menuSpec(shell).returnFocusTo).toBe(rowLinks()[0]);
  });
});

describe('WIN-EXP-03 Back / Forward / Up, crumbs and sibling menus', () => {
  it('Back and Forward walk the nav stack; Up goes to the parent; crumbs navigate', async () => {
    const user = userEvent.setup();
    const { shell } = renderExplorer();
    await user.click(rowLinks()[0]!);
    commit();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    commit();
    expect(location()).toEqual({ kind: 'content', ref: { section: 'experience' } });
    await user.click(screen.getByRole('button', { name: 'Forward' }));
    commit();
    expect(location()).toEqual({ kind: 'content', ref: { section: 'experience', slug: role.slug } });

    await user.click(screen.getByRole('button', { name: 'Up to Home' }));
    commit();
    expect(location()).toEqual({ kind: 'root' });
    expect(screen.getByRole('button', { name: 'Up' })).toBeDisabled();
    expect(globalThis.document.activeElement).not.toBe(globalThis.document.body);

    await user.click(screen.getByRole('button', { name: 'Folders in Home' }));
    const spec = menuSpec(shell);
    expect(labels(spec.items)).toEqual([
      'Experience',
      'Education',
      'Projects',
      'Résumé.pdf',
      `About ${fileSafe(getPerson().givenName)}`,
    ]);
    act(() => (spec.items[1] as { onSelect: () => void }).onSelect());
    commit();
    expect(location()).toEqual({ kind: 'content', ref: { section: 'education' } });
    expect(screen.getByRole('table', { name: 'Education' })).toBeInTheDocument();

    await user.click(within(screen.getByRole('navigation', { name: 'Address' })).getByRole('link', { name: 'Home' }));
    commit();
    expect(location()).toEqual({ kind: 'root' });
  });

  it("the chevron after the folder lists the document's siblings; picking one swaps documents without a list frame", async () => {
    if (roles.length < 2) return;
    const user = userEvent.setup();
    const { shell } = renderExplorer();
    await user.dblClick(rowLinks()[0]!);
    commit();
    await user.click(screen.getByRole('button', { name: 'Files in Experience' }));
    const spec = menuSpec(shell);
    expect(labels(spec.items)).toEqual(roles.map((entry) => fileName(entry.company)));
    act(() => (spec.items[1] as { onSelect: () => void }).onSelect());
    // Until the kernel lands on the sibling, the open document stays (no flash of the list).
    expect(screen.getByRole('region', { name: fileName(role.company) })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    commit();
    const sibling = screen.getByRole('region', { name: fileName(roles[1]!.company) });
    expect(globalThis.document.activeElement).toBe(sibling);
    expect(location()).toEqual({ kind: 'content', ref: { section: 'experience', slug: roles[1]!.slug } });
  });
});

describe('WIN-EXP-04 · E19 editable address bar', () => {
  it('shows the path, rejects an unknown one with the Windows message, normalizes a sloppy one', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.click(screen.getByRole('button', { name: 'Edit address' }));
    const field = screen.getByRole('textbox', { name: 'Address' });
    expect(field).toHaveValue(formatExplorerPath({ kind: 'content', ref: { section: 'experience' } }));
    expect(globalThis.document.activeElement).toBe(field);

    await user.clear(field);
    await user.type(field, 'Downloads{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Windows can't find 'Downloads'. Check the spelling and try again.",
    );
    expect(field).toHaveAttribute('aria-invalid', 'true');

    await user.clear(field);
    await user.type(field, `c:/users/${getPerson().givenName.toUpperCase()}//EDUCATION/{Enter}`);
    commit();
    expect(location()).toEqual({ kind: 'content', ref: { section: 'education' } });
    expect(screen.queryByRole('textbox', { name: 'Address' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit address' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox', { name: 'Address' })).not.toBeInTheDocument();
    expect(globalThis.document.activeElement).toBe(screen.getByRole('button', { name: 'Edit address' }));
  });

  it('a typed file path opens its document', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.click(screen.getByRole('button', { name: 'Edit address' }));
    const field = screen.getByRole('textbox', { name: 'Address' });
    await user.clear(field);
    await user.type(field, `Experience/${role.slug}{Enter}`);
    commit();
    expect(screen.getByRole('region', { name: fileName(role.company) })).toBeInTheDocument();
  });
});

describe('WIN-EXP-05 sortable details table + Tiles / Large icons', () => {
  it('header buttons sort and move aria-sort; the order follows', async () => {
    const user = userEvent.setup();
    renderExplorer();
    const header = (name: string) => within(table()).getByRole('columnheader', { name: new RegExp(`^${name}`) });
    expect(header('Dates')).toHaveAttribute('aria-sort', 'descending');
    expect(header('Name')).not.toHaveAttribute('aria-sort');
    const newest = rowLinks().map(spoken);
    expect(newest).toEqual(roles.map((entry) => fileName(entry.company)));

    await user.click(within(header('Dates')).getByRole('button'));
    expect(header('Dates')).toHaveAttribute('aria-sort', 'ascending');
    expect(rowLinks().map(spoken)).toEqual([...newest].reverse());

    await user.click(within(header('Name')).getByRole('button'));
    expect(header('Name')).toHaveAttribute('aria-sort', 'ascending');
    expect(header('Dates')).not.toHaveAttribute('aria-sort');
    expect(rowLinks().map(spoken)).toEqual(
      [...newest].sort((a, b) => a!.localeCompare(b!, undefined, { sensitivity: 'base', numeric: true })),
    );
    await user.click(within(header('Name')).getByRole('button'));
    expect(header('Name')).toHaveAttribute('aria-sort', 'descending');
    // Leave the session sort as it was found.
    await user.click(within(header('Dates')).getByRole('button'));
    expect(header('Dates')).toHaveAttribute('aria-sort', 'descending');
  });

  it('Sort ▾ and View ▾ open their menus; Tiles and Large icons show the same files', async () => {
    const user = userEvent.setup();
    const { shell } = renderExplorer();
    await user.click(screen.getByRole('button', { name: 'Sort' }));
    expect(labels(menuSpec(shell).items)).toEqual([
      'Name',
      'Role',
      'Dates',
      'Location',
      '—',
      'Ascending',
      'Descending',
    ]);
    await user.click(screen.getByRole('button', { name: 'View' }));
    const view = menuSpec(shell);
    expect(labels(view.items)).toEqual(['Large icons', 'Tiles', 'Details', '—', 'Details pane']);

    act(() => (view.items[1] as { onSelect: () => void }).onSelect());
    const tiles = screen.getByRole('list', { name: 'Experience' });
    expect(within(tiles).getAllByRole('link').map(spoken)).toEqual(
      roles.map((entry) => expect.stringContaining(fileName(entry.company))),
    );
    const layout = screen.getByRole('group', { name: 'Layout' });
    await user.click(within(layout).getByRole('button', { name: 'Large icons' }));
    expect(within(layout).getByRole('button', { name: 'Large icons' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByRole('list', { name: 'Experience' })).getAllByRole('link')).toHaveLength(roles.length);
    await user.click(within(layout).getByRole('button', { name: 'Details' }));
    expect(within(layout).getByRole('button', { name: 'Details' })).toHaveAttribute('aria-pressed', 'true');
    expect(table()).toBeInTheDocument();
  });

  it('Ctrl+Shift+2 / Ctrl+Shift+6 switch views from the keyboard and focus stays on the selected file', async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.click(rowLinks()[0]!);
    commit();
    await user.keyboard('{Control>}{Shift>}2{/Shift}{/Control}');
    const icons = screen.getByRole('list', { name: 'Experience' });
    expect(globalThis.document.activeElement).toBe(within(icons).getAllByRole('link')[0]);
    await user.keyboard('{Control>}{Shift>}6{/Shift}{/Control}');
    expect(globalThis.document.activeElement).toBe(rowLinks()[0]);
  });

  it('the search box filters the folder; Enter hands the query to Search', async () => {
    const user = userEvent.setup();
    const { shell } = renderExplorer();
    const search = screen.getByRole('searchbox', { name: 'Search Experience' });
    await user.type(search, role.company.slice(0, 3));
    expect(
      rowLinks().every((link) => link.textContent!.toLowerCase().includes(role.company.slice(0, 3).toLowerCase())),
    ).toBe(true);
    await user.type(search, 'zzzz-no-match');
    expect(within(table()).getByText('No items match your search.')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(vi.mocked(shell.openSearch).mock.calls.at(-1)![0]).toMatchObject({
      query: `${role.company.slice(0, 3)}zzzz-no-match`,
    });
  });
});

describe('WIN-EXP-06 Home: Quick access + Recent derive from data', () => {
  it('Quick access = Experience, Education, Projects, Résumé; Recent = the current role and the latest project', async () => {
    act(() => openExplorer({ kind: 'root' }));
    const { container } = renderExplorer();
    const quick = screen.getByRole('region', { name: 'Quick access' });
    expect(within(quick).getByRole('heading', { level: 3 })).toHaveTextContent('Quick access');
    const tiles = within(quick).getAllByRole('link');
    expect(tiles.map(spoken)).toEqual([
      `Experience${roles.length} ${roles.length === 1 ? 'file' : 'files'}`,
      `Education${schools.length} ${schools.length === 1 ? 'file' : 'files'}`,
      'ProjectsShortcut · GitHub',
      expect.stringMatching(/^Résumé\.pdfUpdated /),
    ]);

    const recent = screen.getByRole('region', { name: 'Recent' });
    const current = getCurrentRole();
    const latest = [...getProjects()].sort((a, b) => (b.year ?? 0) - (a.year ?? 0))[0];
    const expected = [
      ...(current ? [explorerFileName('experience', current.slug)] : []),
      ...(latest ? [latest.name] : []),
    ];
    expect(within(recent).getAllByRole('link').map(spoken)).toEqual(expected);
    expect(await audit(container)).toEqual([]);

    // Quick access → Experience drills into the folder and focus lands in its list.
    const user = userEvent.setup();
    await user.click(tiles[0]!);
    commit();
    expect(location()).toEqual({ kind: 'content', ref: { section: 'experience' } });
    expect(globalThis.document.activeElement).toBe(rowLinks()[0]);
  });

  it('Recent → the current role opens its document', async () => {
    const current = getCurrentRole();
    if (!current) return;
    act(() => openExplorer({ kind: 'root' }));
    const user = userEvent.setup();
    renderExplorer();
    await user.click(within(screen.getByRole('region', { name: 'Recent' })).getAllByRole('link')[0]!);
    commit();
    expect(screen.getByRole('region', { name: explorerFileName('experience', current.slug)! })).toBeInTheDocument();
  });
});

describe('WIN-EXP-07 shortcuts open the right apps', () => {
  it('Résumé opens Edge on the PDF tab; Projects opens GitHub', async () => {
    const user = userEvent.setup();
    renderExplorer();
    const nav = screen.getByRole('navigation', { name: 'Navigation pane' });
    expect(within(nav).getByRole('link', { name: 'Résumé' })).toHaveAttribute('href', '/windows/edge/resume');
    await user.click(within(nav).getByRole('link', { name: 'Résumé' }));
    commit();
    const edge = getKernel().sessions.windows.windows['windows:browser'];
    expect(edge && currentLocation(edge)).toEqual({ kind: 'content', ref: { section: 'resume' } });

    await user.click(within(nav).getByRole('link', { name: 'Projects' }));
    commit();
    expect(getKernel().sessions.windows.windows['windows:github']).toBeDefined();
  });
});

describe('WIN-EXP-08 compact drill-down', () => {
  it('places first; a folder drills down with a back arrow in the title row; a file is its document', async () => {
    const user = userEvent.setup();
    boot(390, 844);
    act(() => closeAll());
    act(() => openExplorer({ kind: 'root' }));
    const { container } = renderExplorer({ compact: true });
    expect(screen.queryByRole('toolbar', { name: 'Command bar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'See more' })).toHaveAttribute('aria-haspopup', 'menu');
    const places = screen.getByRole('navigation', { name: 'Navigation pane' });
    expect(within(places).getAllByRole('link').map(spoken)).toEqual(['Experience', 'Education', 'Projects', 'Résumé']);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await user.click(within(places).getByRole('link', { name: 'Experience' }));
    commit();
    expect(screen.queryByRole('navigation', { name: 'Navigation pane' })).not.toBeInTheDocument();
    expect(globalThis.document.activeElement).toBe(rowLinks()[0]);
    expect(screen.getByRole('button', { name: 'Back to Home' })).toBeInTheDocument();

    await user.click(rowLinks()[0]!);
    commit();
    expect(screen.getByRole('region', { name: fileName(role.company) })).toBeInTheDocument();
    expect(await audit(container)).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Back to Experience' }));
    commit();
    expect(location()).toEqual({ kind: 'content', ref: { section: 'experience' } });
    expect(table()).toBeInTheDocument();
    boot(1440, 900);
  });
});

describe('E-removed a removed item lands on its folder with the InfoBar', () => {
  it('"That item is no longer available"', () => {
    act(() => openExplorer({ kind: 'root' }));
    renderExplorer();
    act(() => {
      dispatch({
        type: 'NAVIGATE_IN_APP',
        id: ID,
        location: { kind: 'content', ref: { section: 'experience', slug: 'no-such-role' } },
      });
    });
    expect(location()).toEqual({ kind: 'content', ref: { section: 'experience' } });
    expect(screen.getByRole('status')).toHaveTextContent('That item is no longer available');
    fireEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('That item is no longer available')).not.toBeInTheDocument();
  });
});

describe('WIN-A11Y-02 Explorer semantics: axe clean in the folder view', () => {
  it('heading order, lists, table headers, ARIA attributes', async () => {
    const { container } = renderExplorer();
    expect(await audit(container)).toEqual([]);
  });
});
