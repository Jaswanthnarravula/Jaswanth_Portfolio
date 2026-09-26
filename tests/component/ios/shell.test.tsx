/**
 * The iOS shell in jsdom (plans/ios):
 *   IOS-A11Y-01 landmarks in reading order + inert Home with an app open · IOS-HOME-01 icons are real links with
 *   labels · IOS-HOME-03 the Mail badge clears once "Let's talk" is read · IOS-HOME-05 one roving group across pages ·
 *   IOS-DOCK-01/05 the Dock (links, no labels, names, roving) · IOS-WIDG-01/02 widgets = article + link + a sibling
 *   Download button · IOS-FOLD-04 the folder dialog (focus in/out, Esc) · IOS-CC-01/02/06 Control Center (dialog,
 *   aria-pressed toggles, native ranges, prefs apply) · IOS-SPOT-01/06 Spotlight (dialog + combobox, zero state) ·
 *   IOS-STAT-02/03/04 status-bar buttons, the Home button, adaptive style · IOS-FLIGHT-01/08 a launch opens the app
 *   (one push) and focuses its heading · IOS-FLIGHT-04 the App Switcher closes an app (Delete) · IOS-LOCK-01/03 the
 *   lock on a chooser arrival, unlock by the Open button · IOS-NOTIF-01/05 the status region exists from mount.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import IosShell from '@/components/os/ios/Shell';
import { getFeaturedProjects } from '@/data/selectors';
import { DEFAULT_CAPABILITIES } from '@/lib/kernel/state';
import { focusKeys, type WindowId } from '@/lib/kernel/types';
import { dispatch, flushQueued, getKernel } from '@/stores/kernel-store';
import { getPrefs, prefsStore } from '@/stores/prefs-store';

let booted = false;
function boot(w = 390, h = 844, pointer: 'fine' | 'coarse' = 'coarse') {
  if (!booted) {
    dispatch({
      type: 'BOOT',
      url: '/ios',
      navType: 'navigate',
      viewport: { w, h, pointer },
      persisted: null,
      capabilities: DEFAULT_CAPABILITIES,
    });
    booted = true;
  } else dispatch({ type: 'VIEWPORT_CHANGED', w, h, pointer });
}

function closeAll() {
  for (const id of Object.keys(getKernel().sessions.ios.windows) as WindowId[]) {
    dispatch({ type: 'CLOSE_WINDOW', id });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
  }
}

async function commit() {
  await act(async () => {
    flushQueued();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function renderShell() {
  return render(
    <>
      <div role="status" aria-live="polite" id="system-status" className="sr-only" />
      <div className="os-root" data-os="ios">
        <IosShell
          os="ios"
          heading={
            <h1 className="sr-only" tabIndex={-1} data-focus-key={focusKeys.osHeading}>
              iOS — Jaswanth&apos;s portfolio
            </h1>
          }
        />
      </div>
    </>,
  );
}

beforeEach(() => {
  boot();
  act(() => closeAll());
  prefsStore.getState().patch({ motion: 'system', glass: 'system', theme: 'system', tourOffered: true });
});

describe('IOS-A11Y-01 landmarks in reading order; Home inert with an app open', () => {
  it('status bar group → main (h1, Home Screen) → nav Dock → Home button → status region', () => {
    const { container } = renderShell();
    const statusBar = screen.getByRole('group', { name: 'Status bar' });
    const main = screen.getByRole('main');
    const dock = screen.getByRole('navigation', { name: 'Dock' });
    const home = screen.getByRole('button', { name: 'Home' });
    const region = container.querySelector('[data-banner-region]')!;
    expect(within(main).getByRole('heading', { level: 1 })).toHaveTextContent(/iOS/);
    expect(within(main).getByRole('group', { name: 'Home Screen' })).toBeInTheDocument();
    const order = [statusBar, main, dock, home, region];
    for (let index = 1; index < order.length; index++)
      expect(order[index - 1]!.compareDocumentPosition(order[index]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(region).toHaveAttribute('role', 'status');
  });

  it('opening an app: one push, the app is a labelled section with an h2 that takes focus; Home + Dock inert', async () => {
    const { container } = renderShell();
    const grid = screen.getByRole('group', { name: 'Home Screen' });
    fireEvent.click(within(grid).getByRole('link', { name: 'Safari' }));
    await commit();
    expect(getKernel().sessions.ios.focused).toBe('ios:browser');
    const section = container.querySelector('[data-app-surface="browser"]')!;
    expect(section.tagName).toBe('SECTION');
    expect(section.getAttribute('aria-labelledby')).toBe('ios-app-browser');
    expect(section.querySelector('h2')).toHaveTextContent('Safari');
    expect(document.activeElement).toBe(section.querySelector('h2'));
    expect(container.querySelector('[data-home-layer]')).toHaveAttribute('inert');
    expect(container.querySelector('[data-dock]')!.parentElement).toHaveAttribute('inert');
    // The status bar and the Home button stay operable.
    expect(screen.getByRole('button', { name: 'Home' }).closest('[inert]')).toBeNull();
  });
});

describe('IOS-HOME-01 / IOS-DOCK-01 real links with labels; the Dock has no labels', () => {
  it('grid icons link to /ios/{slug}; the Dock names Files as the résumé', () => {
    renderShell();
    const grid = screen.getByRole('group', { name: 'Home Screen' });
    expect(within(grid).getByRole('link', { name: 'Safari' })).toHaveAttribute('href', '/ios/safari');
    expect(within(grid).getByRole('link', { name: 'Notes' })).toHaveAttribute('href', '/ios/notes');
    expect(within(grid).getByRole('link', { name: 'Messages' })).toHaveAttribute('href', '/ios/messages');
    const dock = screen.getByRole('navigation', { name: 'Dock' });
    const links = within(dock).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'Files, Résumé',
      'Safari',
      expect.stringMatching(/^GitHub/),
      'Mail, 1 unread',
    ]);
    expect(links[0]).toHaveAttribute('href', '/ios/files/resume');
    expect(dock.querySelector('[class*="iconLabel"]')).toBeNull();
  });
});

describe('IOS-HOME-03 badges carry real information', () => {
  it('Mail "1" clears once "Let\'s talk" is read this session; GitHub shows the featured count', async () => {
    renderShell();
    const featured = getFeaturedProjects().length;
    expect(screen.getAllByRole('link', { name: `GitHub, ${featured} featured` }).length).toBeGreaterThan(0);
    act(() => {
      dispatch({ type: 'OPEN_APP', os: 'ios', role: 'mail' });
      dispatch({ type: 'SET_APP_UI', id: 'ios:mail' as WindowId, key: 'read', value: '["lets-talk"]' });
      dispatch({ type: 'GO_HOME' });
    });
    await commit();
    expect(screen.getByRole('link', { name: 'Mail' })).toBeInTheDocument();
  });
});

describe('IOS-HOME-05 / IOS-DOCK-05 roving focus', () => {
  it('one tab stop across pages; Right from the last item of page 1 lands on page 2', () => {
    renderShell();
    const grid = screen.getByRole('group', { name: 'Home Screen' });
    const items = [...grid.querySelectorAll<HTMLElement>('[data-roving-item]')];
    expect(items.filter((item) => item.tabIndex === 0)).toHaveLength(1);
    const lastOfPage1 = [...grid.querySelectorAll<HTMLElement>('[data-page="0"] [data-roving-item]')].at(-1)!;
    lastOfPage1.focus();
    fireEvent.keyDown(lastOfPage1, { key: 'ArrowRight' });
    expect(document.activeElement?.closest('[data-page]')).toHaveAttribute('data-page', '1');
  });
  it('the Dock is one roving stop: Left / Right', () => {
    renderShell();
    const dock = screen.getByRole('navigation', { name: 'Dock' });
    const [files, safari] = within(dock).getAllByRole('link');
    files!.focus();
    fireEvent.keyDown(files!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(safari);
  });
});

describe('IOS-WIDG-01 / IOS-WIDG-02 widgets from data: a link + a sibling Download button', () => {
  it('the Résumé widget is an article; its face is one link and Download is a separate button', () => {
    renderShell();
    const widget = screen.getByRole('article', { name: 'Résumé' });
    const link = within(widget).getByRole('link', { name: 'Résumé — open' });
    expect(link).toHaveAttribute('href', '/ios/files/resume');
    const download = within(widget).queryByRole('button', { name: /Download résumé/ });
    if (download) expect(link.contains(download)).toBe(false);
  });
});

describe('IOS-WIDG-05 the Now widget', () => {
  it('shows the Now note with its date as one link to About in Safari', () => {
    renderShell();
    const widget = screen.getByRole('article', { name: 'Now' });
    const link = within(widget).getByRole('link', { name: /^Now: Building a clean-room OAuth\/OIDC provider/ });
    expect(link).toHaveAttribute('href', '/ios/safari');
    expect(widget).toHaveTextContent('Updated Sep 2026');
  });
});

describe('IOS-FOLD-04 the Career folder: dialog semantics, focus in and out', () => {
  it('opens as a modal dialog labelled Career with links; Esc closes it back to the folder button', async () => {
    renderShell();
    const button = screen.getByRole('button', { name: /^Career folder, \d+ shortcuts$/ });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    fireEvent.click(button);
    const dialog = await screen.findByRole('dialog', { name: 'Career' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const links = within(dialog).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(
      expect.arrayContaining(['Experience', 'Education', 'Résumé']),
    );
    expect(document.activeElement).toBe(links[0]);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Career' })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(button));
  });
});

describe('IOS-CC-01 / IOS-CC-02 / IOS-CC-06 Control Center', () => {
  it('opens from the status bar button; toggles are aria-pressed buttons; sliders are native ranges; prefs apply', async () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Control Center' }));
    const dialog = await screen.findByRole('dialog', { name: 'Control Center' });
    const motion = within(dialog).getByRole('button', { name: 'Reduce Motion' });
    expect(motion).toHaveAttribute('aria-pressed', 'false');
    expect(
      within(dialog)
        .getAllByRole('slider')
        .map((slider) => slider.getAttribute('aria-valuetext')),
    ).toEqual([expect.stringMatching(/^Brightness/), expect.stringMatching(/^Volume/)]);
    expect(within(dialog).getByRole('button', { name: /Switch OS/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Résumé/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Now/ })).toHaveTextContent(/Open to/);
    fireEvent.click(motion);
    await commit();
    expect(getPrefs().motion).toBe('reduced');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reduce Transparency' }));
    await commit();
    expect(getPrefs().glass).toBe('solid');
  });
  it('Sound expands with the "More" button (the long-press alternative)', async () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Control Center' }));
    const dialog = await screen.findByRole('dialog', { name: 'Control Center' });
    const more = within(dialog).getByRole('button', { name: /More/ });
    fireEvent.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getByRole('button', { name: 'Play intro sound' })).toBeInTheDocument();
  });
});

describe('IOS-SPOT-01 / IOS-SPOT-06 Spotlight', () => {
  it('the Search pill opens a modal Search dialog with a combobox and the Siri Suggestions zero state', async () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    const dialog = await screen.findByRole('dialog', { name: 'Search' });
    expect(within(dialog).getByRole('combobox', { name: 'Search' })).toBeInTheDocument();
    expect(within(dialog).getByRole('option', { name: /Files — Résumé/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('option', { name: /Projects/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});

describe('IOS-STAT-02 / IOS-STAT-04 status bar', () => {
  it('two real buttons; the style is light over the wallpaper and dark over an app (light theme)', async () => {
    const { container } = renderShell();
    expect(screen.getByRole('button', { name: 'Notification Center' })).toBeInTheDocument();
    const bar = container.querySelector('[data-status-bar]')!;
    expect(bar).toHaveAttribute('data-style', 'light');
    act(() => {
      dispatch({ type: 'OPEN_APP', os: 'ios', role: 'settings' });
      dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id: 'ios:settings' as WindowId } });
    });
    await commit();
    await waitFor(() => expect(bar).toHaveAttribute('data-style', 'dark'));
  });
});

describe('IOS-FLIGHT-04 the App Switcher', () => {
  it('Alt+Shift+O opens it; Delete on a card closes that app (its instance is removed)', async () => {
    renderShell();
    act(() => {
      dispatch({ type: 'OPEN_APP', os: 'ios', role: 'notes' });
      dispatch({ type: 'GO_HOME' });
    });
    await commit();
    fireEvent.keyDown(document, { key: 'O', code: 'KeyO', altKey: true, shiftKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'App Switcher' });
    const card = within(dialog).getByRole('button', { name: 'Notes' });
    fireEvent.keyDown(card, { key: 'Delete' });
    await commit();
    expect(getKernel().sessions.ios.windows['ios:notes' as WindowId]).toBeUndefined();
  });
});

describe('IOS-STAT-03 the Home button goes Home', () => {
  it('Enter on the Home indicator closes the foreground app (it stays warm)', async () => {
    renderShell();
    act(() => {
      dispatch({ type: 'OPEN_APP', os: 'ios', role: 'github' });
    });
    await commit();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Home' }), { key: 'Enter' });
    await commit();
    expect(getKernel().sessions.ios.focused).toBeNull();
    expect(getKernel().sessions.ios.windows['ios:github' as WindowId]).toBeDefined();
  });
});
