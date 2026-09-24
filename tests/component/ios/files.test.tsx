/**
 * iOS Files (plans/ios/apps/files.md): Browse/Recents from data (IOS-FILES-01), folders + ⋯ menu + URLs (02), the
 * document page (03), Quick Look (04), the synthesized stack of a Dock deep open (05), the full-page split (06) and
 * the semantics + axe (07). Drags and the zoom flight are e2e (jsdom has no layout or WAAPI).
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Files from '@/components/os/ios/apps/Files';
import * as M from '@/components/os/ios/apps/files-model';
import { formatPeriod } from '@/components/content';
import * as selectors from '@/data/selectors';
import { currentLocation } from '@/lib/kernel/state';
import type { AppLocation, WindowId } from '@/lib/kernel/types';
import { getKernel } from '@/stores/kernel-store';
import { closeAllIos, renderIosApp, settle } from './harness';

const FILES = 'ios:files' as WindowId;
const overrides: { meta?: ReturnType<typeof selectors.getResumeFileMeta>; noRoles?: boolean } = {};

vi.mock('@/data/selectors', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/selectors')>();
  return {
    ...actual,
    getResumeFileMeta: () => ('meta' in overrides ? overrides.meta : actual.getResumeFileMeta()),
    getExperience: () => (overrides.noRoles ? [] : actual.getExperience()),
  };
});

const roles = () => selectors.getExperience();
const person = () => selectors.getPerson();
const win = () => getKernel().sessions.ios.windows[FILES]!;
const here = () => currentLocation(win());
const experience: AppLocation = { kind: 'content', ref: { section: 'experience' } };
const resume: AppLocation = { kind: 'content', ref: { section: 'resume' } };

/** The top screen of the stack (the one that is neither hidden nor inert). */
const top = () => {
  const screens = [...document.querySelectorAll<HTMLElement>('[data-screen]')].filter(
    (el) => !el.hidden && !el.hasAttribute('inert'),
  );
  return screens[screens.length - 1]!;
};

async function audit(container: HTMLElement) {
  // jsdom cannot measure colour contrast (no canvas); the e2e axe pass (X1) covers it.
  const results = await axe.run(container, {
    rules: { region: { enabled: false }, 'color-contrast': { enabled: false } },
  });
  return results.violations.map(
    (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
  );
}

beforeEach(() => {
  act(() => closeAllIos());
  delete overrides.meta;
  overrides.noRoles = false;
});
afterEach(() => {
  act(() => closeAllIos());
});

describe('IOS-FILES-01 Browse/Recents tabs, locations, favorites and tags derive from the data', () => {
  it('Browse: large title, search, Locations · Favorites · Tags (the stack tags from data)', () => {
    renderIosApp(Files, 'files');
    const browse = top();
    expect(within(browse).getByRole('heading', { level: 3, name: 'Browse' })).toBeInTheDocument();
    expect(within(browse).getByRole('searchbox', { name: 'Search files' })).toBeInTheDocument();
    const locations = within(browse).getByRole('region', { name: 'Locations' });
    expect(within(locations).getByRole('link', { name: 'On My iPhone' })).toBeInTheDocument();
    const favorites = within(browse).getByRole('region', { name: 'Favorites' });
    expect(
      within(favorites)
        .getAllByRole('link')
        .map((link) => link.getAttribute('aria-label')),
    ).toEqual([
      `Experience, folder, ${M.itemsLabel(roles().length)}`,
      `Education, folder, ${M.itemsLabel(selectors.getEducation().length)}`,
      expect.stringMatching(/^Résumé\.pdf, PDF/),
    ]);
    const tags = M.tagsFrom(roles(), selectors.getProjects());
    expect(tags.length).toBeGreaterThan(0);
    const tagGroup = within(browse).getByRole('region', { name: 'Tags' });
    expect(
      within(tagGroup)
        .getAllByRole('link')
        .map((link) => link.getAttribute('aria-label')),
    ).toEqual(tags.map((tag) => `${tag.name} tag, ${M.itemsLabel(tag.count)}`));
    const bar = screen.getByRole('navigation', { name: 'Files' });
    expect(
      within(bar)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Recents', 'Browse']);
    expect(within(bar).getByRole('link', { name: 'Browse' })).toHaveAttribute('aria-current', 'page');
  });

  it('a tag lists its roles and projects; a project opens in GitHub', async () => {
    const { calls } = renderIosApp(Files, 'files');
    const [tag] = M.tagsFrom(roles(), selectors.getProjects());
    fireEvent.click(within(top()).getByRole('link', { name: `${tag!.name} tag, ${M.itemsLabel(tag!.count)}` }));
    await settle();
    const list = top();
    expect(within(list).getByRole('heading', { level: 3, name: tag!.name })).toBeInTheDocument();
    const matches = M.tagged(tag!.name, roles(), selectors.getProjects());
    const links = within(list)
      .getAllByRole('link')
      .filter((link) => !link.closest('[data-tab-bar]'));
    expect(links).toHaveLength(matches.roles.length + matches.projects.length);
    const project = matches.projects[0];
    if (project) {
      fireEvent.click(within(list).getByRole('link', { name: `${project.name}, project, opens in GitHub` }));
      expect(calls.openContent?.[0]?.[0]).toEqual({ section: 'projects', slug: project.slug });
    }
    // A role from a tag sits straight on the tag screen (no folder under it).
    const role = matches.roles[0];
    if (role) {
      fireEvent.click(within(list).getByRole('link', { name: M.roleItem(role).label }));
      await settle();
      expect(here()).toEqual({ kind: 'content', ref: { section: 'experience', slug: role.slug } });
      expect(document.querySelector('[data-screen="folder:experience"]')).toBeNull();
      expect(document.querySelector(`[data-screen="tag:${tag!.name}"]`)).not.toBeNull();
    }
  });

  it('Recents: the résumé, then the last viewed role (session-derived)', async () => {
    const role = roles()[0]!;
    renderIosApp(Files, 'files', { location: { kind: 'content', ref: { section: 'experience', slug: role.slug } } });
    await settle();
    expect(win().ui?.lastDoc).toBe(`experience/${role.slug}`);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Files' })).getByRole('link', { name: 'Recents' }));
    await settle();
    const recents = top();
    expect(within(recents).getByRole('heading', { level: 3, name: 'Recents' })).toBeInTheDocument();
    const names = within(recents)
      .getAllByRole('link')
      .map((link) => link.getAttribute('aria-label'));
    expect(names[0]).toMatch(/^Résumé\.pdf/);
    expect(names[1]).toBe(M.roleItem(role).label);
  });

  it('search finds files by name', async () => {
    renderIosApp(Files, 'files');
    const role = roles()[0]!;
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search files' }), { target: { value: role.company } });
    await settle();
    const results = within(top()).getByRole('region', { name: 'Results' });
    expect(within(results).getByRole('link', { name: M.roleItem(role).label })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search files' }), { target: { value: 'zzzz-nothing' } });
    await settle();
    expect(within(top()).getByRole('status')).toHaveTextContent('No Results');
  });
});

describe('IOS-FILES-02 folder list/icons views with the ⋯ menu; pushed navigation writes the URL', () => {
  it('Favorites → Experience pushes /ios/files/experience; rows are links named "{Company} — {Role}, {period}"', async () => {
    renderIosApp(Files, 'files');
    const link = within(top()).getByRole('link', { name: /^Experience, folder/ });
    expect(link).toHaveAttribute('href', '/ios/files/experience');
    fireEvent.click(link);
    await settle();
    expect(here()).toEqual(experience);
    expect(win().nav.entries).toHaveLength(2);
    const folder = top();
    expect(within(folder).getByRole('heading', { level: 3, name: 'Experience' })).toBeInTheDocument();
    const names = within(folder)
      .getAllByRole('link')
      .map((row) => row.getAttribute('aria-label'));
    const sorted = M.sortItems(roles().map(M.roleItem), 'date');
    expect(names).toEqual(sorted.map((item) => item.label));
    const first = roles().find((role) => role.role && formatPeriod(role.start, role.end));
    if (first)
      expect(names).toContain(
        `${first.company} — ${first.role}, ${M.spokenPeriod(formatPeriod(first.start, first.end))}`,
      );
    const row = within(folder).getByRole('link', { name: sorted[0]!.label });
    expect(row.getAttribute('href')).toBe(`/ios/files/${sorted[0]!.key}`);
    fireEvent.click(row);
    await settle();
    expect(M.placeKey(M.placeOf(here()))).toBe(sorted[0]!.key);
    // Back: the chevron names the previous screen and pops the URL (APP_BACK: the folder is the previous entry).
    fireEvent.click(within(top()).getByRole('button', { name: 'Back to Experience' }));
    await settle();
    expect(here()).toEqual(experience);
    expect(win().nav.index).toBe(1);
  });

  it('⋯ menu: Icons / List and Sort by Name / Date (a Menu of checkable items)', async () => {
    renderIosApp(Files, 'files', { location: experience });
    await settle();
    const more = within(top()).getByRole('button', { name: 'View options' });
    expect(more).toHaveAttribute('aria-haspopup', 'menu');
    fireEvent.click(more);
    const menu = screen.getByRole('menu', { name: 'View options' });
    expect(
      within(menu)
        .getAllByRole('menuitemcheckbox')
        .map((item) => [item.textContent, item.getAttribute('aria-checked')]),
    ).toEqual([
      ['Icons', 'false'],
      ['List', 'true'],
      ['Sort by Name', 'false'],
      ['Sort by Date', 'true'],
    ]);
    fireEvent.click(within(menu).getByRole('menuitemcheckbox', { name: 'Sort by Name' }));
    await settle();
    const byName = M.sortItems(roles().map(M.roleItem), 'name').map((item) => item.label);
    expect(
      within(top())
        .getAllByRole('link')
        .map((row) => row.getAttribute('aria-label')),
    ).toEqual(byName);
    fireEvent.click(within(top()).getByRole('button', { name: 'View options' }));
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitemcheckbox', { name: 'Icons' }));
    await settle();
    expect(win().ui?.view).toBe('icons');
    const grid = top().querySelector('ul[class*="grid"]');
    expect(grid).not.toBeNull();
    expect(within(grid as HTMLElement).getAllByRole('link')).toHaveLength(roles().length);
  });

  it('an empty folder says "Folder is Empty"', async () => {
    overrides.noRoles = true;
    renderIosApp(Files, 'files', { location: experience });
    await settle();
    expect(within(top()).getByRole('status')).toHaveTextContent('Folder is Empty');
  });

  it('long-press / ⋯ on a row opens the preview with Open · Copy link · Share', async () => {
    const { calls } = renderIosApp(Files, 'files', { location: experience });
    await settle();
    const item = M.roleItem(roles()[0]!);
    fireEvent.click(within(top()).getByRole('button', { name: `${item.name} actions` }));
    const spec = calls.preview?.[0]?.[0] as {
      title: string;
      actions: { id: string; label: string; run: () => void }[];
    };
    expect(spec.title).toBe(item.name);
    expect(spec.actions.map((action) => action.label)).toEqual(['Open', 'Copy link', 'Share']);
    act(() => spec.actions[1]!.run());
    expect(calls.copyLink?.[0]?.[0]).toEqual({ section: 'experience', slug: roles()[0]!.slug });
    act(() => spec.actions[0]!.run());
    await settle();
    expect(M.placeKey(M.placeOf(here()))).toBe(item.key);
  });

  it('the owner folder: On My iPhone › {given name} holds Experience, Education, Résumé.pdf and the aliases', async () => {
    const { calls } = renderIosApp(Files, 'files');
    fireEvent.click(within(top()).getByRole('link', { name: 'On My iPhone' }));
    await settle();
    expect(within(top()).getByRole('heading', { level: 3, name: 'On My iPhone' })).toBeInTheDocument();
    fireEvent.click(within(top()).getByRole('link', { name: new RegExp(`^${person().givenName}, folder`) }));
    await settle();
    const owner = top();
    expect(within(owner).getByRole('heading', { level: 3, name: person().givenName })).toBeInTheDocument();
    const names = within(owner)
      .getAllByRole('link')
      .map((link) => link.getAttribute('aria-label'));
    expect(names).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Experience, folder/),
        expect.stringMatching(/^Education, folder/),
        expect.stringMatching(/^Résumé\.pdf/),
        'Projects, alias, opens in GitHub',
        `About ${person().givenName}, alias, opens in Safari`,
      ]),
    );
    fireEvent.click(within(owner).getByRole('link', { name: 'Projects, alias, opens in GitHub' }));
    expect(calls.openContent?.[0]?.[0]).toEqual({ section: 'projects' });
    // The URL never moved: these are session screens (the trail).
    expect(here()).toEqual({ kind: 'root' });
    expect(JSON.parse(win().ui?.trail ?? '[]')).toEqual(['iphone', 'jaswanth']);
    // Back pops the session screen.
    fireEvent.click(within(owner).getByRole('button', { name: 'Back to On My iPhone' }));
    await settle();
    expect(JSON.parse(win().ui?.trail ?? '[]')).toEqual(['iphone']);
  });
});

describe('IOS-FILES-03 document view for roles and schools', () => {
  it('ExperienceDetail inside the document chrome, with Share · Copy link', async () => {
    const role = roles()[0]!;
    const { calls } = renderIosApp(Files, 'files', {
      location: { kind: 'content', ref: { section: 'experience', slug: role.slug } },
    });
    await settle();
    const page = top();
    const documentPage = page.querySelector('[data-document]');
    expect(documentPage).not.toBeNull();
    const article = within(documentPage as HTMLElement).getByRole('article');
    expect(article).toHaveClass('cv-role');
    expect(within(article).getByRole('heading', { level: 4 })).toHaveTextContent(role.role ?? role.company);
    for (const highlight of role.highlights) expect(article).toHaveTextContent(highlight);
    const toolbar = within(page).getByRole('toolbar');
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Copy link' }));
    fireEvent.click(within(toolbar).getByRole('button', { name: 'Share' }));
    expect(calls.copyLink?.map((call) => call[0])).toEqual([
      { section: 'experience', slug: role.slug },
      { section: 'experience', slug: role.slug },
    ]);
  });

  it('EducationDetail for a school', async () => {
    const school = selectors.getEducation()[0]!;
    renderIosApp(Files, 'files', { location: { kind: 'content', ref: { section: 'education', slug: school.slug } } });
    await settle();
    const article = within(top().querySelector('[data-document]') as HTMLElement).getByRole('article');
    expect(article).toHaveClass('cv-school');
    expect(article).toHaveTextContent(school.degree);
  });

  it('a deep link to a role synthesizes [Browse, {owner}, Experience, role]', async () => {
    const role = roles()[0]!;
    renderIosApp(Files, 'files', { location: { kind: 'content', ref: { section: 'experience', slug: role.slug } } });
    await settle();
    expect(within(top()).getByRole('button', { name: 'Back to Experience' })).toBeInTheDocument();
    fireEvent.click(within(top()).getByRole('button', { name: 'Back to Experience' }));
    await settle();
    // No history under the deep link: the pop is a replace.
    expect(here()).toEqual(experience);
    expect(win().nav.entries).toHaveLength(1);
    expect(within(top()).getByRole('button', { name: `Back to ${person().givenName}` })).toBeInTheDocument();
  });
});

describe('IOS-FILES-04 Quick Look: Done, thumbnails, Download, Text version', () => {
  it('a modal dialog "Résumé.pdf": Done first, Share, pages strip, Download with type + size, Text version', async () => {
    const { calls } = renderIosApp(Files, 'files', { location: resume });
    await settle();
    const dialog = screen.getByRole('dialog', { name: 'Résumé.pdf' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const buttons = within(dialog).getAllByRole('button');
    expect(buttons[0]).toHaveTextContent('Done');
    expect(document.activeElement).toBe(buttons[0]);
    expect(within(dialog).getByRole('button', { name: 'Share' })).toBeInTheDocument();
    const meta = selectors.getResumeFileMeta()!;
    // The strip lists every page — and, as in iOS, a one-page document has none.
    if (meta.pages > 1) {
      const pages = within(dialog).getByRole('navigation', { name: 'Pages' });
      expect(within(pages).getAllByRole('button')).toHaveLength(meta.pages);
      expect(within(pages).getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'true');
    } else expect(within(dialog).queryByRole('navigation', { name: 'Pages' })).toBeNull();
    // The page is the published PDF: one image per page.
    expect(dialog.querySelectorAll('[data-ql-pdf] img')).toHaveLength(meta.pages);
    const download = within(dialog).getByRole('button', { name: /^Download \(PDF, \d+ KB\)$/ });
    fireEvent.click(download);
    expect(calls.downloadResume).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Share' }));
    expect(calls.copyLink?.[0]?.[0]).toEqual({ section: 'resume' });
    const toggle = within(dialog).getByRole('button', { name: 'Text version' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    await settle();
    expect(within(dialog).getByRole('button', { name: 'Text version' })).toHaveAttribute('aria-pressed', 'true');
    expect(dialog.querySelector('[data-ql-pdf]')).toHaveAttribute('hidden');
    // The rest of the app is inert behind the dialog.
    expect(document.querySelector('[data-files] > div')).toHaveAttribute('inert');
  });

  it('Esc = Done', async () => {
    renderIosApp(Files, 'files', { location: resume });
    await settle();
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Résumé.pdf' }), { key: 'Escape' });
    await settle();
    expect(here()).toEqual({ kind: 'root' });
  });

  it('missing PDF → the text version only; Download, pages and the toggle are hidden', async () => {
    overrides.meta = null;
    renderIosApp(Files, 'files', { location: resume });
    await settle();
    const dialog = screen.getByRole('dialog', { name: 'Résumé.pdf' });
    expect(within(dialog).queryByRole('button', { name: /^Download/ })).toBeNull();
    expect(within(dialog).queryByRole('navigation', { name: 'Pages' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Text version' })).toBeNull();
    expect(dialog.querySelector('[data-ql-pdf]')).toBeNull();
    expect(within(dialog).getByRole('article', { name: 'Résumé — text version' })).toBeVisible();
  });
});

describe('IOS-FILES-05 synthesized stack on a deep open from the Dock', () => {
  it('/ios/files/resume → [Browse, {owner}, Quick Look]; Done returns to the folder with a replace (Back then goes Home)', async () => {
    renderIosApp(Files, 'files', { location: resume });
    await settle();
    expect(win().nav.entries).toHaveLength(1);
    expect(document.querySelector('[data-screen="browse"]')).not.toBeNull();
    expect(document.querySelector('[data-screen="jaswanth"]')).not.toBeNull();
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Résumé.pdf' })).getByRole('button', { name: 'Done' }));
    await settle();
    // Replace: one entry, at the root — the browser's Back from here leaves Files (Home).
    expect(win().nav).toEqual({ entries: [{ kind: 'root' }], index: 0 });
    expect(JSON.parse(win().ui?.trail ?? 'null')).toEqual(['jaswanth']);
    expect(within(top()).getByRole('heading', { level: 3, name: person().givenName })).toBeInTheDocument();
    expect(within(top()).getByRole('button', { name: 'Back to Browse' })).toBeInTheDocument();
  });

  it('Quick Look opened in-app: Done is APP_BACK (the folder is the previous entry)', async () => {
    renderIosApp(Files, 'files');
    fireEvent.click(within(top()).getByRole('link', { name: /^Résumé\.pdf/ }));
    await settle();
    expect(screen.getByRole('dialog', { name: 'Résumé.pdf' })).toBeInTheDocument();
    expect(win().nav.entries).toHaveLength(2);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Done' }));
    await settle();
    expect(win().nav.index).toBe(0);
    expect(win().nav.entries).toHaveLength(2);
    expect(here()).toEqual({ kind: 'root' });
  });
});

describe('IOS-FILES-06 full page: sidebar + content; Quick Look as a centred sheet', () => {
  it('sidebar (Recents · Locations · Favorites · Tags) selects the content; icons by default', async () => {
    renderIosApp(Files, 'files', { layout: 'pad' });
    const sidebar = screen.getByRole('navigation', { name: 'Files' });
    for (const name of ['Locations', 'Favorites', 'Tags'])
      expect(within(sidebar).getByRole('region', { name })).toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: 'On My iPhone' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(within(sidebar).getByRole('link', { name: 'Experience' }));
    await settle();
    expect(here()).toEqual(experience);
    expect(within(sidebar).getByRole('link', { name: 'Experience' })).toHaveAttribute('aria-current', 'page');
    const grid = top().querySelector('ul[class*="grid"]') as HTMLElement;
    expect(within(grid).getAllByRole('link')).toHaveLength(roles().length);
    fireEvent.click(within(sidebar).getByRole('link', { name: /^Résumé\.pdf/ }));
    await settle();
    expect(document.querySelector('[data-quick-look]')).toHaveAttribute('data-layout', 'pad');
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Résumé.pdf' })).getByRole('button', { name: 'Done' }));
    await settle();
    // Done returns to the folder the sheet floated over.
    expect(here()).toEqual(experience);
  });
});

describe('IOS-FILES-07 semantics: dialog Quick Look, text-first résumé, axe clean', () => {
  it("the text version (the PDF's own text) precedes the PDF's pages in the DOM", async () => {
    renderIosApp(Files, 'files', { location: resume });
    await settle();
    const dialog = screen.getByRole('dialog', { name: 'Résumé.pdf' });
    const text = within(dialog).getByRole('article', { name: 'Résumé — text version' });
    const page = dialog.querySelector<HTMLImageElement>('[data-ql-pdf] img')!;
    expect(page).not.toBeNull();
    expect(page.getAttribute('srcset')).toMatch(/^\/resume\/pages\/[0-9a-f]{10}-1-816\.png 816w/);
    expect(page).toHaveAttribute('alt', '');
    expect(dialog.querySelector('object')).toBeNull();
    expect(text.compareDocumentPosition(page) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      within(text).getByRole('heading', { level: 4, name: new RegExp(`^${person().name}$`, 'i') }),
    ).toBeInTheDocument();
  });

  it('axe: Browse, a folder, a document and Quick Look', async () => {
    const browse = renderIosApp(Files, 'files');
    expect(await audit(browse.container)).toEqual([]);
    browse.unmount();
    act(() => closeAllIos());
    const folder = renderIosApp(Files, 'files', { location: experience });
    await settle();
    expect(await audit(folder.container)).toEqual([]);
    folder.unmount();
    act(() => closeAllIos());
    const doc = renderIosApp(Files, 'files', {
      location: { kind: 'content', ref: { section: 'experience', slug: roles()[0]!.slug } },
    });
    await settle();
    expect(await audit(doc.container)).toEqual([]);
    doc.unmount();
    act(() => closeAllIos());
    const ql = renderIosApp(Files, 'files', { location: resume });
    await settle();
    expect(await audit(ql.container)).toEqual([]);
  });

  it('pad layout is axe clean too', async () => {
    const pad = renderIosApp(Files, 'files', { layout: 'pad', location: experience });
    await settle();
    expect(await audit(pad.container)).toEqual([]);
  });
});
