/**
 * The macOS shell in jsdom (plans/macos): MAC-DOCK-09 (one tab stop, arrow keys, names "Finder, open" / "…, minimized",
 * the active app `aria-current`) · MAC-A11Y-01 / VIEW-HEAD-01 (landmarks, the h1 inside main, windows as labelled
 * regions whose content starts at h3 — no heading-order violation) · MAC-FIND-01 (Finder lists from the selectors) ·
 * MAC-MENU-01 (the app name follows the focused window) · MAC-WM-10 (compact: the 44 px controls menu).
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';
import MacShell from '@/components/os/macos/Shell';
import { getEducation, getExperience } from '@/data/selectors';
import { DEFAULT_CAPABILITIES } from '@/lib/kernel/state';
import { focusKeys } from '@/lib/kernel/types';
import { dispatch, getKernel } from '@/stores/kernel-store';

let booted = false;
function boot(w = 1440, h = 900) {
  if (!booted) {
    dispatch({
      type: 'BOOT',
      url: '/macos',
      navType: 'navigate',
      viewport: { w, h, pointer: 'fine' },
      persisted: null,
      capabilities: DEFAULT_CAPABILITIES,
    });
    booted = true;
  } else dispatch({ type: 'VIEWPORT_CHANGED', w, h, pointer: 'fine' });
}

function closeAll() {
  for (const id of Object.keys(getKernel().sessions.macos.windows) as (keyof ReturnType<
    typeof getKernel
  >['sessions']['macos']['windows'])[]) {
    dispatch({ type: 'CLOSE_WINDOW', id });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
  }
}

const settle = (id: 'macos:files' | 'macos:github') =>
  act(() => {
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
  });

function renderShell() {
  return render(
    <MacShell
      os="macos"
      heading={
        <h1 className="sr-only" tabIndex={-1} data-focus-key={focusKeys.osHeading}>
          macOS — Jaswanth
        </h1>
      }
    />,
  );
}

beforeEach(() => {
  boot();
  act(() => closeAll());
});

describe('MAC-DOCK-09 the Dock: roving keyboard model and names with state', () => {
  it('is one tab stop; arrows and Home/End move; names carry ", open" / ", minimized"; active app is current', async () => {
    const user = userEvent.setup();
    renderShell();
    const dock = screen.getByRole('navigation', { name: 'Dock' });
    const links = within(dock).getAllByRole('link');
    expect(links.filter((link) => link.tabIndex === 0)).toHaveLength(1);
    links[0]!.focus();
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(links[1]);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(links.at(-1));
    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(links[0]);

    act(() => {
      dispatch({ type: 'OPEN_APP', role: 'files' });
    });
    settle('macos:files');
    expect(within(dock).getByRole('link', { name: 'Finder, open' })).toHaveAttribute('aria-current', 'true');
    act(() => {
      dispatch({ type: 'MINIMIZE', id: 'macos:files' });
    });
    expect(within(dock).getByRole('link', { name: 'Finder, minimized' })).not.toHaveAttribute('aria-current');
    expect(within(dock).getByRole('link', { name: 'Finder — Jaswanth, minimized window' })).toBeInTheDocument();
    expect(within(dock).getByRole('link', { name: 'Safari' })).toBeInTheDocument();
  });
});

describe('MAC-A11Y-01 · VIEW-HEAD-01 landmarks, regions and heading order', () => {
  it('menu bar → main (h1, desktop, windows in open order) → Dock, and axe finds no heading-order problem', async () => {
    const { container } = renderShell();
    act(() => {
      dispatch({ type: 'OPEN_APP', role: 'github' });
    });
    settle('macos:github');
    act(() => {
      dispatch({
        type: 'OPEN_APP',
        role: 'files',
        location: { kind: 'content', ref: { section: 'experience', slug: getExperience()[0]!.slug } },
      });
    });
    settle('macos:files');
    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { level: 1 })).toHaveTextContent('macOS — Jaswanth');
    const regions = within(main).getAllByRole('region', { name: /^(GitHub|Finder — Experience)$/ });
    expect(regions.map((region) => region.getAttribute('data-window'))).toEqual(['macos:github', 'macos:files']);
    expect(within(regions[1]!).getByRole('heading', { level: 2 })).toHaveTextContent('Finder — Experience');
    expect(within(regions[1]!).getByRole('region', { name: 'Preview' })).toBeInTheDocument();
    const order = [...container.querySelectorAll('header[data-menubar], main, nav[aria-label="Dock"]')].map((el) =>
      el.tagName.toLowerCase(),
    );
    expect(order).toEqual(['header', 'main', 'nav']);
    const results = await axe.run(container, {
      runOnly: { type: 'rule', values: ['heading-order', 'landmark-unique', 'aria-allowed-attr', 'list', 'listitem'] },
    });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});

describe('MAC-FIND-01 Finder lists come from the selectors; MAC-MENU-01 the app name follows focus', () => {
  it('Experience lists every role, Education every school; the menu bar names the focused app', async () => {
    renderShell();
    const banner = screen.getByRole('banner');
    expect(within(banner).getByText('Finder', { exact: true })).toBeInTheDocument();
    act(() => {
      dispatch({ type: 'OPEN_APP', role: 'files', location: { kind: 'content', ref: { section: 'experience' } } });
    });
    settle('macos:files');
    const finder = screen.getByRole('region', { name: 'Finder — Experience' });
    const entries = within(within(finder).getByRole('list', { name: 'Experience' })).getAllByRole('link');
    expect(entries.map((entry) => entry.textContent)).toEqual(
      getExperience().map((role) => (role.role ? `${role.company} — ${role.role}` : role.company)),
    );
    act(() => {
      dispatch({
        type: 'NAVIGATE_IN_APP',
        id: 'macos:files',
        location: { kind: 'content', ref: { section: 'education' } },
      });
    });
    const schools = within(within(finder).getByRole('list', { name: 'Education' })).getAllByRole('link');
    expect(schools.map((school) => school.textContent)).toEqual(getEducation().map((school) => school.school));
    act(() => {
      dispatch({ type: 'OPEN_APP', role: 'github' });
    });
    await waitFor(() => expect(within(banner).getByText('GitHub', { exact: true })).toBeInTheDocument());
  });
});

describe('MAC-WM-10 compact: one controls menu with Close · Minimize · Windows…', () => {
  it('offers the three actions and Minimize minimizes', async () => {
    const user = userEvent.setup();
    boot(390, 844);
    renderShell();
    act(() => {
      dispatch({ type: 'OPEN_APP', role: 'files' });
    });
    settle('macos:files');
    expect(getKernel().viewport.posture).toBe('compact');
    await user.click(screen.getByRole('button', { name: 'Window controls' }));
    const menu = screen.getByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Close', 'Minimize', 'Windows…']);
    await user.click(within(menu).getByRole('menuitem', { name: 'Minimize' }));
    expect(getKernel().sessions.macos.windows['macos:files']?.phase.s).toBe('minimized');
    boot(1440, 900);
  });
});
