/**
 * IOS-QA-05 (plans/ios/surfaces/quick-actions): the quick-action menu is the APG `Menu` primitive in the iOS skin —
 * `role="menu"` of `menuitem`s named by the actions, focus on the first item at open, Up/Down wrap, Home/End,
 * type-ahead, Enter/Space activate (the menu closes, then the action runs), Esc closes and returns focus to the invoker
 * (the icon or the row). Proved on the surface itself (icon menus and context previews) and through the real shell
 * (Shift+F10 on a Home Screen icon).
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import IosShell from '@/components/os/ios/Shell';
import type { QuickAction } from '@/components/os/ios/model';
import { QuickActions, type QuickSpec } from '@/components/os/ios/surfaces/QuickActions';
import { DEFAULT_CAPABILITIES } from '@/lib/kernel/state';
import { focusKeys, type WindowId } from '@/lib/kernel/types';
import { dispatch, flushQueued, getKernel } from '@/stores/kernel-store';
import { prefsStore } from '@/stores/prefs-store';

const ACTIONS: readonly QuickAction[] = [
  {
    id: 'open-resume',
    label: 'Open Résumé',
    glyph: 'doc',
    command: { kind: 'open', role: 'files', location: { kind: 'content', ref: { section: 'resume' } } },
  },
  { id: 'download', label: 'Download PDF', glyph: 'download', command: { kind: 'download-resume' } },
  {
    id: 'experience',
    label: 'Experience',
    glyph: 'briefcase',
    command: { kind: 'open', role: 'files', location: { kind: 'content', ref: { section: 'resume' } } },
  },
  { id: 'copy-link', label: 'Copy link', glyph: 'link', command: { kind: 'copy-link', ref: { section: 'resume' } } },
];

/** Mounts an invoker; pressing it opens the quick actions anchored to it (as the shell does); closing unmounts. */
function Harness({
  kind,
  onAction,
  onRun,
}: {
  readonly kind: 'icon' | 'preview';
  readonly onAction: (action: QuickAction) => void;
  readonly onRun: (id: string) => void;
}) {
  // The shell keeps the invoking element (the icon or row) as the anchor the menu grows from and returns focus to.
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const spec = (): QuickSpec =>
    kind === 'icon'
      ? { kind: 'icon', role: 'files', label: 'Files', anchor: anchor!, actions: ACTIONS, onAction }
      : {
          kind: 'preview',
          spec: {
            title: 'Enterprise SSO',
            summary: 'Single sign-on',
            meta: ['TypeScript', '2025'],
            ref: { section: 'projects', slug: 'sso' },
            anchor: anchor!,
            actions: [
              { id: 'open', label: 'Open', run: () => onRun('open') },
              { id: 'copy', label: 'Copy link', run: () => onRun('copy') },
              { id: 'share', label: 'Share', run: () => onRun('share') },
            ],
          },
        };
  return (
    <div data-os="ios">
      <a
        href="/ios/files"
        aria-keyshortcuts="Shift+F10"
        onKeyDown={(event) => {
          if (event.shiftKey && event.key === 'F10') {
            event.preventDefault();
            setAnchor(event.currentTarget);
          }
        }}
      >
        {kind === 'icon' ? 'Files' : 'Enterprise SSO'}
      </a>
      <button type="button">elsewhere</button>
      {anchor ? <QuickActions spec={spec()} layout="phone" onClose={() => setAnchor(null)} /> : null}
    </div>
  );
}

function openMenu(kind: 'icon' | 'preview' = 'icon') {
  const onAction = vi.fn();
  const onRun = vi.fn();
  render(<Harness kind={kind} onAction={onAction} onRun={onRun} />);
  const invoker = screen.getByRole('link', { name: kind === 'icon' ? 'Files' : 'Enterprise SSO' });
  act(() => invoker.focus());
  fireEvent.keyDown(invoker, { key: 'F10', shiftKey: true });
  const menu = screen.getByRole('menu');
  return { invoker, menu, items: () => within(menu).getAllByRole('menuitem'), onAction, onRun };
}

describe('IOS-QA-05 menu semantics + focus return (Menu APG suite, iOS skin)', () => {
  it('IOS-QA-05 role=menu labelled "{App} actions", one menuitem per action, focus on the first item', () => {
    const { menu, items } = openMenu();
    expect(menu).toHaveAccessibleName('Files actions');
    expect(items().map((item) => item.textContent)).toEqual(ACTIONS.map((action) => action.label));
    for (const item of items()) {
      expect(item.tagName).toBe('BUTTON');
      expect(item).toHaveAttribute('tabindex', '-1');
    }
    expect(items()[0]).toHaveFocus();
    // Menu items sit in the iOS skin's menu (the primitive is headless; the skin styles it).
    expect(menu.closest('[data-quick-actions]')).not.toBeNull();
    expect(menu.closest('[data-os="ios"]')).not.toBeNull();
  });

  it('IOS-QA-05 ArrowDown / ArrowUp move focus and wrap; Home / End jump to the ends; type-ahead finds an item', () => {
    const { menu, items } = openMenu();
    const all = items();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(all[1]).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(all[2]).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'End' });
    expect(all[3]).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(all[0], 'Down wraps to the first').toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(all[3], 'Up wraps to the last').toHaveFocus();
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(all[0]).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'e' });
    expect(all[2], 'type-ahead "e" → Experience').toHaveFocus();
  });

  it('IOS-QA-05 Esc closes the menu and returns focus to the invoking icon; nothing runs', () => {
    const { invoker, menu, onAction } = openMenu();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(invoker).toHaveFocus();
    expect(document.activeElement).not.toBe(document.body);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('IOS-QA-05 Enter activates the focused item: the menu closes, the action runs once, focus is on the icon', () => {
    const { invoker, menu, onAction } = openMenu();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction.mock.calls[0]![0]).toMatchObject({ id: 'download' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(invoker).toHaveFocus();
  });

  it('IOS-QA-05 Space activates too; Tab closes the menu without running anything', () => {
    let opened = openMenu();
    fireEvent.keyDown(opened.menu, { key: ' ' });
    expect(opened.onAction).toHaveBeenCalledTimes(1);
    expect(opened.onAction.mock.calls[0]![0]).toMatchObject({ id: 'open-resume' });
    cleanup();
    opened = openMenu();
    fireEvent.keyDown(opened.menu, { key: 'Tab' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(opened.onAction).not.toHaveBeenCalled();
  });

  it('IOS-QA-05 a press outside closes the menu without running anything', () => {
    const { onAction } = openMenu();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('IOS-QA-05 context previews: the same menu semantics; the preview card is aria-hidden decoration; Enter runs, focus → row', () => {
    const { invoker, menu, items, onRun } = openMenu('preview');
    expect(menu).toHaveAccessibleName('Enterprise SSO actions');
    expect(items().map((item) => item.textContent)).toEqual(['Open', 'Copy link', 'Share']);
    expect(items()[0]).toHaveFocus();
    expect(screen.getByText('Single sign-on').closest('[aria-hidden="true"]')).not.toBeNull();
    fireEvent.keyDown(menu, { key: 'End' });
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(onRun).toHaveBeenCalledWith('share');
    expect(invoker).toHaveFocus();
  });
});

// --- Through the real shell ---------------------------------------------------------------------------------------

describe('IOS-QA-05 through the iOS shell: Shift+F10 on a Home Screen icon', () => {
  beforeAll(() => {
    dispatch({
      type: 'BOOT',
      url: '/ios',
      navType: 'navigate',
      viewport: { w: 390, h: 844, pointer: 'coarse' },
      persisted: null,
      capabilities: DEFAULT_CAPABILITIES,
    });
  });
  beforeEach(() => {
    act(() => {
      for (const id of Object.keys(getKernel().sessions.ios.windows) as WindowId[]) {
        dispatch({ type: 'CLOSE_WINDOW', id });
        dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
      }
    });
    prefsStore.getState().patch({ motion: 'system', glass: 'system', theme: 'system', tourOffered: true });
  });

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

  const homeIcon = (role: string) =>
    within(screen.getByRole('group', { name: 'Home Screen' }))
      .getAllByRole('link')
      .find((link) => link.getAttribute('data-role') === role);

  async function commit() {
    await act(async () => {
      flushQueued();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it('IOS-QA-05 the icon menu opens on the first item, arrows move, Esc closes back to the same icon', async () => {
    renderShell();
    const icon = homeIcon('github');
    if (!icon) throw new Error('no GitHub icon on the Home Screen');
    act(() => icon.focus());
    fireEvent.keyDown(icon, { key: 'F10', shiftKey: true });
    const menu = await screen.findByRole('menu');
    expect(menu).toHaveAccessibleName(/GitHub actions/);
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toContain('All Projects');
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(items[items.length - 1], 'Up wraps to the last').toHaveFocus();
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'End' });
    expect(items[items.length - 1]).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'Escape' });
    await commit();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(homeIcon('github')).toHaveFocus();
    expect(getKernel().sessions.ios.windows['ios:github' as WindowId]).toBeUndefined();
  });

  it('IOS-QA-05 Enter on "All Projects" closes the menu and opens GitHub', async () => {
    renderShell();
    const icon = homeIcon('github');
    if (!icon) throw new Error('no GitHub icon on the Home Screen');
    act(() => icon.focus());
    fireEvent.keyDown(icon, { key: 'F10', shiftKey: true });
    const menu = await screen.findByRole('menu');
    fireEvent.keyDown(menu, { key: 'End' });
    expect(within(menu).getByRole('menuitem', { name: 'All Projects' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'Enter' });
    await commit();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(getKernel().sessions.ios.windows['ios:github' as WindowId]).toBeDefined();
  });

  // Product bug (plans/ios/surfaces/quick-actions "Accessibility": "background `inert`"): while the menu is open the
  // Home Screen and the Dock stay live — `homeInert` in components/os/ios/Shell.tsx ignores the quick-actions overlay.
  // Remove `.fails` once the shell makes the background inert while quick actions show.
  it('IOS-QA-05 while the menu is open the background (Home Screen + Dock) is inert', async () => {
    renderShell();
    const icon = homeIcon('github');
    if (!icon) throw new Error('no GitHub icon on the Home Screen');
    act(() => icon.focus());
    fireEvent.keyDown(icon, { key: 'F10', shiftKey: true });
    const menu = await screen.findByRole('menu');
    expect(menu.closest('[inert]')).toBeNull();
    expect(icon.closest('[inert]'), 'Home Screen').not.toBeNull();
    expect(screen.getByRole('navigation', { name: 'Dock', hidden: true }).closest('[inert]'), 'Dock').not.toBeNull();
  });
});
