/**
 * iOS Notes in jsdom (plans/ios/apps/notes.md): IOS-NOTES-01 (Folders → list → note, pinned first, derived from the
 * data, session-state path, intents) · IOS-NOTES-02 (generated notes: checklists + dot meters, table with project
 * links, tags) · IOS-NOTES-03 (read-only banner once, Find in note highlights + cycles + "Not found", tag filter) ·
 * IOS-NOTES-04 (pad three columns, phone-landscape two columns) · IOS-NOTES-05 (document semantics, "View as list"
 * plain alternative, axe clean).
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Notes from '@/components/os/ios/apps/Notes';
import { requestIntent, resetIntents } from '@/components/os/ios/intents';
import { iosId } from '@/components/os/ios/model';
import { IosShellProvider } from '@/components/os/ios/shell-context';
import type { SkillGroup } from '@/data/schema';
import { getPerson, getProjects, getSkills } from '@/data/selectors';
import { dispatch, getKernel } from '@/stores/kernel-store';
import { bootIos, closeAllIos, fakeServices, renderIosApp, settle } from './harness';

const fixture = vi.hoisted(() => ({ skills: null as null | readonly SkillGroup[] }));
vi.mock('@/data/selectors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/selectors')>();
  return { ...actual, getSkills: () => fixture.skills ?? actual.getSkills() };
});

const RATED: readonly SkillGroup[] = [
  {
    id: 'frontend',
    label: 'Frontend',
    items: [
      { name: 'TypeScript', level: 4, years: 6 },
      { name: 'Svelte', level: 2 },
      { name: 'CSS', years: 8 },
    ],
  },
];

const ID = iosId('notes');
const ui = () => getKernel().sessions.ios.windows[ID]?.ui ?? {};
/** The props the app surface passes (spread: `role` here is the app's role, not an ARIA role). */
const appProps = (landscape: boolean) => ({
  id: ID,
  role: 'notes' as const,
  active: true,
  layout: 'phone' as const,
  landscape,
  headingId: 'h',
});
const click = async (el: Element) => {
  fireEvent.click(el);
  await settle();
};
const openFolder = async () => click(screen.getByRole('button', { name: /^Notes/ }));
const openNote = async (title: string) => click(screen.getByRole('button', { name: new RegExp(`^${title}`) }));
const noteArticle = (title: string) => screen.getByRole('article', { name: title });
/**
 * The app's own root (axe runs here): the harness names its app section with the lowercase role, and the real shell
 * names it with the app title — a screen titled like the app would otherwise be reported against the harness wrapper.
 */
const appRoot = () => document.querySelector<HTMLElement>('[data-app-surface] > h2 + *')!;

beforeEach(() => {
  resetIntents();
  fixture.skills = null;
});
afterEach(() => {
  closeAllIos();
});

describe('IOS-NOTES-01 folders → list → note; pinned notes; session-state path', () => {
  it('IOS-NOTES-01 folders → list → note, pinned first, derived from the data', async () => {
    renderIosApp(Notes, 'notes');
    expect(screen.getByRole('heading', { level: 3, name: 'Folders' })).toBeInTheDocument();
    const folder = screen.getByRole('button', { name: /^Notes/ });
    // "Notes (n)": the folder shows how many notes the data produced (no "Currently learning": no ratings published).
    expect(folder).toHaveTextContent('3');

    await openFolder();
    expect(screen.getByRole('heading', { level: 3, name: 'Notes' })).toBeInTheDocument();
    const pinned = screen.getByRole('region', { name: 'Pinned' });
    expect(
      within(pinned)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual([expect.stringContaining('Skills'), expect.stringContaining('How I work')]);
    // Unpinned notes under their own "Notes" header.
    expect(screen.getByRole('heading', { level: 4, name: 'Notes' })).toBeInTheDocument();
    expect(within(pinned).queryByRole('button', { name: /Stack by project/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Stack by project/ })).toBeInTheDocument();
    // Row second line = date + the note's first line, from the data.
    expect(within(pinned).getAllByRole('button')[1]).toHaveTextContent(getPerson().summary[0]!.slice(0, 30));

    await openNote('How I work');
    expect(screen.getByRole('heading', { level: 3, name: 'How I work' })).toHaveFocus();
    expect(noteArticle('How I work')).toHaveTextContent(getPerson().summary[0]!);
    // The path is session state (URL stays /ios/notes).
    expect(JSON.parse(ui().path!)).toEqual(['list', 'note:how-i-work']);
    expect(getKernel().sessions.ios.windows[ID]?.nav.entries).toHaveLength(1);

    // Back (the chevron labelled with the previous title) → the list, focus on the row that pushed.
    await click(screen.getByRole('button', { name: 'Back to Notes' }));
    expect(JSON.parse(ui().path!)).toEqual(['list']);
    expect(screen.getByRole('button', { name: /^How I work/ })).toHaveFocus();
    await click(screen.getByRole('button', { name: 'Back to Folders' }));
    expect(ui().path).toBeUndefined();
  });

  it('IOS-NOTES-01 the pushed path restores on return (evicted app remounts on its note)', async () => {
    const first = renderIosApp(Notes, 'notes');
    await openFolder();
    await openNote('Skills');
    first.unmount();
    // Remount against the same window (no reopen): the note is still on screen.
    const { services } = fakeServices();
    render(
      <IosShellProvider value={services}>
        <Notes {...appProps(false)} />
      </IosShellProvider>,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Skills' })).toBeInTheDocument();
  });

  it('IOS-NOTES-01 a { kind: "note" } intent opens that pinned note (waiting at mount and while open)', async () => {
    requestIntent({ kind: 'note', note: 'how-i-work' });
    renderIosApp(Notes, 'notes');
    await settle();
    expect(screen.getByRole('heading', { level: 3, name: 'How I work' })).toBeInTheDocument();
    act(() => requestIntent({ kind: 'note', note: 'skills' }));
    await settle();
    expect(screen.getByRole('heading', { level: 3, name: 'Skills' })).toBeInTheDocument();
    // Unknown ids are ignored.
    act(() => requestIntent({ kind: 'note', note: 'nope' }));
    await settle();
    expect(JSON.parse(ui().path!)).toEqual(['list', 'note:skills']);
  });
});

describe('IOS-NOTES-02 generated notes: checklists + meters, table, tags', () => {
  it('IOS-NOTES-02 skills note: headed groups, static circles (aria-hidden), meters only when a level exists', async () => {
    fixture.skills = RATED;
    renderIosApp(Notes, 'notes');
    await openFolder();
    // A skill at level ≤ 2 → "Currently learning" exists.
    expect(screen.getByRole('button', { name: /^Currently learning/ })).toBeInTheDocument();
    await openNote('Skills');
    const note = noteArticle('Skills');
    expect(within(note).getByRole('heading', { level: 4, name: 'Frontend' })).toBeInTheDocument();
    expect(within(note).getByRole('img', { name: 'TypeScript: 4 of 5, 6 years' })).toBeInTheDocument();
    expect(within(note).getByRole('img', { name: 'Svelte: 2 of 5' })).toBeInTheDocument();
    // No level → no meter (never inferred), only the years text.
    expect(within(note).queryByRole('img', { name: /^CSS/ })).toBeNull();
    expect(within(note).getByText('8 yrs')).toBeVisible();
    const meter = within(note).getByRole('img', { name: /TypeScript/ });
    expect(meter.querySelectorAll('i[data-on]')).toHaveLength(4);
    expect(meter.querySelectorAll('i')).toHaveLength(5);
    expect(note.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(3);
    for (const circle of note.querySelectorAll('li > span:first-child'))
      expect(circle).toHaveAttribute('aria-hidden', 'true');
  });

  it('IOS-NOTES-02 stack by project: a real <table> with headers; project names open GitHub', async () => {
    const { calls } = renderIosApp(Notes, 'notes');
    await openFolder();
    await openNote('Stack by project');
    const table = screen.getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((th) => th.textContent),
    ).toEqual(['Project', 'Technologies']);
    const first = getProjects().find((project) => project.stack.length)!;
    const link = within(table).getByRole('link', { name: first.name });
    expect(link.getAttribute('href')).toContain(first.slug);
    expect(within(table).getByRole('rowheader', { name: first.name })).toBeInTheDocument();
    fireEvent.click(link);
    expect(calls.openContent?.[0]?.[0]).toEqual({ section: 'projects', slug: first.slug });
  });

  it('IOS-NOTES-02 many skills: groups collapse behind "Show all"', async () => {
    renderIosApp(Notes, 'notes');
    await openFolder();
    await openNote('Skills');
    const note = noteArticle('Skills');
    const group = getSkills().find((g) => g.items.length > 6)!;
    const more = within(note).getAllByRole('button', { name: `Show all ${group.items.length}` })[0]!;
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(within(note).queryByText(group.items.at(-1)!.name)).toBeNull();
    fireEvent.click(more);
    expect(within(note).getByText(group.items.at(-1)!.name)).toBeInTheDocument();
    expect(within(note).getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('IOS-NOTES-03 read-only banner, Find in note, tag filter', () => {
  it('IOS-NOTES-03 tapping the body shows the read-only banner once per session', async () => {
    const { calls } = renderIosApp(Notes, 'notes');
    await openFolder();
    await openNote('How I work');
    const paragraph = within(noteArticle('How I work')).getAllByText(/./, { selector: 'p' })[0]!;
    fireEvent.pointerUp(paragraph);
    await settle();
    fireEvent.pointerUp(paragraph);
    await settle();
    expect(calls.notify).toHaveLength(1);
    expect(calls.notify?.[0]?.[0]).toMatchObject({ role: 'notes', title: expect.stringContaining('read-only') });
    // Controls in the note never trigger it.
    expect(ui().readonly).toBe('1');
  });

  it('IOS-NOTES-03 find highlights + cycles (Enter / Shift+Enter) and reports "Not found"', async () => {
    fixture.skills = RATED;
    renderIosApp(Notes, 'notes');
    await openFolder();
    await openNote('Skills');
    const more = screen.getByRole('button', { name: 'More' });
    fireEvent.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('menu', { name: 'Note actions' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Copy link', 'Find in note']);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Find in note' }));
    const input = screen.getByRole('searchbox', { name: 'Find in note' });
    expect(input).toHaveFocus();

    // "s" appears in "TypeScript", "Svelte", "CSS" (×2) and the tag "#frontend" has none → 4 matches.
    fireEvent.change(input, { target: { value: 's' } });
    const note = noteArticle('Skills');
    const marks = () => [...note.querySelectorAll('mark')];
    expect(marks()).toHaveLength(4);
    expect(screen.getByRole('status')).toHaveTextContent('1 of 4');
    expect(marks()[0]).toHaveAttribute('data-current');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('status')).toHaveTextContent('2 of 4');
    expect(marks()[1]).toHaveAttribute('data-current');
    expect(marks()[0]).not.toHaveAttribute('data-current');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(screen.getByRole('status')).toHaveTextContent('4 of 4');
    fireEvent.click(screen.getByRole('button', { name: 'Next match' }));
    expect(screen.getByRole('status')).toHaveTextContent('1 of 4');

    fireEvent.change(input, { target: { value: 'zzz' } });
    expect(screen.getByRole('status')).toHaveTextContent('Not found');
    expect(marks()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Next match' })).toBeDisabled();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('searchbox', { name: 'Find in note' })).toBeNull();
    // Focus returns to the ⋯ button that opened Find (never <body>).
    expect(screen.getByRole('button', { name: 'More' })).toHaveFocus();
  });

  it('IOS-NOTES-03 share and "Copy link" copy the canonical link', async () => {
    const { calls } = renderIosApp(Notes, 'notes');
    await openFolder();
    await openNote('Skills');
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy link' }));
    expect(calls.copyLink).toHaveLength(2);
    expect(calls.copyLink?.[0]?.[0]).toEqual({ section: 'skills' });
  });

  it('IOS-NOTES-03 a tag chip filters the notes list to notes carrying the tag', async () => {
    fixture.skills = RATED;
    renderIosApp(Notes, 'notes');
    await openFolder();
    await openNote('Skills');
    fireEvent.click(within(noteArticle('Skills')).getByRole('button', { name: '#frontend' }));
    await settle();
    // Back on the list, filtered: Skills and Currently learning carry #frontend; How I work doesn't.
    expect(ui().tag).toBe('frontend');
    expect(screen.getByRole('button', { name: /^Skills/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Currently learning/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^How I work/ })).toBeNull();
    await click(screen.getByRole('button', { name: 'Show all notes' }));
    expect(screen.getByRole('button', { name: /^How I work/ })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search notes' })).toHaveFocus();
  });

  it('IOS-NOTES-03 list search filters by title and body; "No Results" + Clear', async () => {
    renderIosApp(Notes, 'notes');
    await openFolder();
    const search = screen.getByRole('searchbox', { name: 'Search notes' });
    fireEvent.change(search, { target: { value: 'stack by' } });
    await settle();
    expect(screen.getByRole('button', { name: /^Stack by project/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Skills/ })).toBeNull();
    fireEvent.change(search, { target: { value: 'qqqqqq' } });
    await settle();
    expect(screen.getByText('No Results')).toBeInTheDocument();
    await click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByRole('button', { name: /^Skills/ })).toBeInTheDocument();
  });
});

describe('IOS-NOTES-04 split layouts', () => {
  it('IOS-NOTES-04 pad: three columns (folders · list · note), selection is the session path', async () => {
    renderIosApp(Notes, 'notes', { layout: 'pad' });
    expect(screen.getByRole('navigation', { name: 'Folders' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Notes' })).toBeInTheDocument();
    // The first pinned note shows until another is chosen.
    expect(noteArticle('Skills')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Skills/ })).toHaveAttribute('aria-current', 'true');
    await openNote('Stack by project');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Stack by project/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.queryByRole('button', { name: /^Back to/ })).toBeNull();
  });

  it('IOS-NOTES-04 phone landscape: two columns (list · note), no folders column', () => {
    bootIos(844, 390);
    dispatch({ type: 'OPEN_APP', os: 'ios', role: 'notes' });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id: ID } });
    const { services } = fakeServices('phone');
    const { container } = render(
      <IosShellProvider value={services}>
        <Notes {...appProps(true)} />
      </IosShellProvider>,
    );
    expect(container.querySelector('[data-columns="2"]')).not.toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Folders' })).toBeNull();
    expect(screen.getByRole('heading', { level: 3, name: 'Notes' })).toBeInTheDocument();
    expect(noteArticle('Skills')).toBeInTheDocument();
  });
});

describe('IOS-NOTES-05 document semantics + plain skills alternative', () => {
  it('IOS-NOTES-05 "View as list" renders SkillsMatrix semantically and is remembered', async () => {
    renderIosApp(Notes, 'notes');
    await openFolder();
    await openNote('Skills');
    const toggle = screen.getByRole('button', { name: 'View as list' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await click(toggle);
    expect(screen.getByRole('button', { name: 'View as list' })).toHaveAttribute('aria-pressed', 'true');
    const note = noteArticle('Skills');
    expect(note.querySelector('.cv-skills')).not.toBeNull();
    for (const group of getSkills()) {
      expect(within(note).getByRole('heading', { level: 4, name: group.label })).toBeInTheDocument();
      // Every skill is listed (nothing collapsed in the plain view).
      for (const item of group.items)
        expect(within(note).getAllByText(item.name, { exact: false }).length).toBeGreaterThan(0);
    }
    expect(ui().plain).toBe('1');
  });

  it('IOS-NOTES-05 every screen is axe clean (headings, lists, table, names)', async () => {
    fixture.skills = RATED;
    renderIosApp(Notes, 'notes');
    const container = appRoot();
    const rules = [
      'heading-order',
      'label',
      'aria-allowed-attr',
      'aria-valid-attr-value',
      'aria-required-children',
      'list',
      'listitem',
      'button-name',
      'link-name',
      'role-img-alt',
      'td-headers-attr',
      'th-has-data-cells',
      'landmark-unique',
    ];
    const check = async () => {
      const results = await axe.run(container, { runOnly: { type: 'rule', values: rules } });
      expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes[0]?.html}`)).toEqual([]);
    };
    await check();
    await openFolder();
    await check();
    await openNote('Skills');
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Find in note' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find in note' }), { target: { value: 'type' } });
    await check();
    await click(screen.getByRole('button', { name: 'Back to Notes' }));
    await openNote('Stack by project');
    await check();
  });

  it('IOS-NOTES-05 pad layout is axe clean', async () => {
    renderIosApp(Notes, 'notes', { layout: 'pad' });
    const container = appRoot();
    const results = await axe.run(container, {
      runOnly: {
        type: 'rule',
        values: ['heading-order', 'label', 'list', 'listitem', 'button-name', 'landmark-unique', 'aria-allowed-attr'],
      },
    });
    expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes[0]?.html}`)).toEqual([]);
  });
});
