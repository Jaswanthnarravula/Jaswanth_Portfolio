import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import AndroidShell from '@/components/os/android/Shell';
import { DEFAULT_CAPABILITIES } from '@/lib/kernel/state';
import { focusKeys, type WindowId } from '@/lib/kernel/types';
import { dispatch, flushQueued, getKernel } from '@/stores/kernel-store';
import { prefsStore } from '@/stores/prefs-store';

let booted = false;
function boot(w = 1440, h = 900, pointer: 'fine' | 'coarse' = 'fine') {
  if (!booted) {
    dispatch({
      type: 'BOOT',
      url: '/android',
      navType: 'navigate',
      viewport: { w, h, pointer },
      persisted: null,
      capabilities: { ...DEFAULT_CAPABILITIES, pointer },
    });
    booted = true;
  } else {
    dispatch({ type: 'VIEWPORT_CHANGED', w, h, pointer });
    dispatch({ type: 'ROUTE_CHANGED', url: '/android' });
  }
}
function closeAll() {
  for (const id of Object.keys(getKernel().sessions.android.windows) as WindowId[]) {
    dispatch({ type: 'CLOSE_WINDOW', id });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
  }
}
async function settle() {
  await act(async () => {
    flushQueued();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
function shell() {
  return render(
    <div className="os-root" data-os="android">
      <AndroidShell
        os="android"
        heading={
          <h1 className="sr-only" data-focus-key={focusKeys.osHeading}>
            Android — Jaswanth&apos;s portfolio
          </h1>
        }
      />
    </div>,
  );
}

beforeEach(() => {
  boot();
  act(() => closeAll());
  prefsStore
    .getState()
    .patch({ androidNavigation: 'auto', androidPalette: 'sage', androidThemedIcons: false, notifications: false });
});

describe('AND-HOME-01/05 and AND-BARS-01/02', () => {
  it('fills the viewport with sparse Home, top search, taskbar and three-button navigation on a fine pointer', () => {
    const { container } = shell();
    expect(container.querySelector('[data-android-layout]')).toHaveAttribute('data-android-layout', 'large');
    expect(screen.getByRole('button', { name: 'Search apps and more' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Favorites' })).toBeInTheDocument();
    const system = screen.getByRole('navigation', { name: 'System navigation' });
    expect(within(system).getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(within(system).getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(within(system).getByRole('button', { name: 'Recent apps' })).toBeInTheDocument();
    expect(container.querySelector('[data-cutout], [data-bezel], [data-device-frame]')).toBeNull();
  });
  it('the Files favorite is the résumé fast path and launcher apps are real links', () => {
    shell();
    const favorites = screen.getByRole('navigation', { name: 'Favorites' });
    expect(within(favorites).getByRole('link', { name: 'Files, Résumé' })).toHaveAttribute(
      'href',
      '/android/files/resume',
    );
    expect(within(favorites).getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', '/android/github');
    const home = screen.getByRole('region', { name: 'Home screen' });
    // The pinned Résumé shortcut leads the Home grid (Pixel rework, 08 Deviations log 2026-09-24).
    expect(within(home).getByRole('link', { name: 'Résumé' })).toHaveAttribute('href', '/android/files/resume');
    expect(within(home).getByRole('link', { name: 'Keep' })).toHaveAttribute('href', '/android/keep');
  });
  it('AND-ID-05 every launcher icon sits on the one circular adaptive plate; themed icons swap in the glyph', () => {
    const { container } = shell();
    const plates = [...container.querySelectorAll('[data-plate]')];
    expect(plates.length).toBeGreaterThanOrEqual(10);
    for (const plate of plates) expect(['bleed', 'inset', 'foreground']).toContain(plate.getAttribute('data-plate'));
    act(() => prefsStore.getState().patch({ androidThemedIcons: true }));
    expect(container.querySelector('[data-android-layout]')).toHaveAttribute('data-themed-icons');
    expect(container.querySelectorAll('[data-symbol="lightbulb"]').length).toBeGreaterThan(0);
  });
  it('AND-ID-04 · the Pixel wallpaper and Google Sans Flex come with the shell, glyphs are real Material Symbols', () => {
    const { container } = shell();
    const root = container.querySelector('[data-android-layout]') as HTMLElement;
    expect(root.style.getPropertyValue('--android-wallpaper-official')).toMatch(
      /^url\("\/assets\/official\/wallpaper\.android\.[0-9a-f]{10}\.avif"\)$/,
    );
    expect([...document.querySelectorAll('style')].some((node) => node.textContent?.includes('Google Sans Flex'))).toBe(
      true,
    );
    const status = screen.getByRole('button', { name: 'Notifications and quick settings' });
    expect(status.querySelectorAll('svg[data-symbol]').length).toBeGreaterThanOrEqual(2);
    expect(status.textContent).not.toMatch(/[▾◢█]/);
  });
});

describe('AND-DRAWER and AND-SHADE', () => {
  it('opens the drawer from the visible button, focuses search and clears query before closing', async () => {
    shell();
    const favorites = screen.getByRole('navigation', { name: 'Favorites' });
    fireEvent.click(within(favorites).getByRole('button', { name: 'All apps' }));
    const drawer = screen.getByRole('dialog', { name: 'All apps' });
    const search = within(drawer).getByRole('combobox');
    fireEvent.change(search, { target: { value: 'experience' } });
    expect(within(drawer).getByRole('option', { name: /Experience/ })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(search).toHaveValue('');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'All apps' })).toBeNull();
  });
  it('opens the combined shade; toggles nav mode; Back steps expanded to compact to closed', async () => {
    shell();
    fireEvent.click(screen.getByRole('button', { name: 'Notifications and quick settings' }));
    const shade = screen.getByRole('dialog', { name: 'Notifications and quick settings' });
    fireEvent.click(within(shade).getByRole('button', { name: 'Expand quick settings' }));
    fireEvent.click(within(shade).getByRole('button', { name: /3-button navigation/ }));
    await settle();
    expect(prefsStore.getState().prefs.androidNavigation).toBe('buttons');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(within(shade).getByRole('button', { name: 'Expand quick settings' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Notifications and quick settings' })).toBeNull();
  });
});

describe('AND-FAV phone favourites belong to Home', () => {
  it('on a phone the favourites row is part of the Home screen, so it is inert under an open app', async () => {
    boot(412, 915, 'coarse');
    shell();
    const home = screen.getByRole('region', { name: 'Home screen' });
    const favorites = screen.getByRole('navigation', { name: 'Favorites' });
    expect(home.contains(favorites)).toBe(true);
    fireEvent.click(within(favorites).getByRole('link', { name: 'Gmail' }));
    await settle();
    expect(getKernel().sessions.android.focused).toBe('android:mail');
    expect(home).toHaveAttribute('inert');
    boot();
  });
});

describe('AND-LIFE and AND-RECENTS', () => {
  it('opens an app once, Home preserves its instance, and Recents can close it', async () => {
    shell();
    const favorites = screen.getByRole('navigation', { name: 'Favorites' });
    fireEvent.click(within(favorites).getByRole('link', { name: 'GitHub' }));
    await settle();
    expect(getKernel().sessions.android.focused).toBe('android:github');
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    expect(getKernel().sessions.android.focused).toBeNull();
    expect(getKernel().sessions.android.windows['android:github']).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Recent apps' }));
    const recents = screen.getByRole('dialog', { name: 'Recent apps' });
    fireEvent.click(within(recents).getByRole('button', { name: 'Close GitHub' }));
    await new Promise((resolve) => setTimeout(resolve, 180));
    expect(getKernel().sessions.android.windows['android:github']).toBeUndefined();
  });
});
