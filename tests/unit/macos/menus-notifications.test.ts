/**
 * macOS menu and notification data: MAC-MENU-02 (the bar follows the focused app; Finder with no window) ·
 * MAC-MENU-05 (Apple menu items) · MAC-MENU-07 (compact collapses into one menu of submenus) · MAC-MENU-08 (shortcut
 * hints come from the keymap registry — no invented ⌘ chords) · MAC-NOTIF-02 (trigger → notification, deterministic,
 * persona-free) · MAC-NOTIF-01 (queue: 1 visible, ≤ 3 queued; every banner also in the Center) · MAC-EDGE-04 (overlay
 * requests go through the arbiter).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { SHORTCUTS, formatChord } from '@/lib/kernel/keymap';
import { appleMenu, menuBarFor, shortcutLabel, type MenuContext, type MenuSpec } from '@/components/os/macos/menus';
import { BANNER_QUEUE_MAX, notificationFor, type Trigger } from '@/components/os/macos/notifications';
import {
  clearCenter,
  closeOverlay,
  dismissBanner,
  macUi,
  notify,
  openContextMenu,
  openDialog,
  requestOverlay,
  resetMacUi,
  setDragging,
  setLoading,
} from '@/components/os/macos/ui';

const ctx = (overrides: Partial<MenuContext> = {}): MenuContext => ({
  role: null,
  appName: 'Finder',
  windowOpen: false,
  zoomed: false,
  compact: false,
  windows: [],
  projects: [{ slug: 'portfolio-os', name: 'Portfolio OS', repo: 'https://github.com/x/y' }],
  ...overrides,
});
const labels = (items: readonly MenuSpec[]) =>
  items.filter((i) => i.kind !== 'separator').map((i) => ('label' in i ? i.label : ''));
const walk = (items: readonly MenuSpec[]): MenuSpec[] =>
  items.flatMap((i) => (i.kind === 'submenu' ? [i, ...walk(i.items)] : [i]));

describe('MAC-MENU-02 menus follow the focused app', () => {
  it('no window → Finder, with File · Edit · View · Go · Window · Help (the storyboard titles)', () => {
    const bar = menuBarFor(ctx());
    expect(bar.map((menu) => menu.label)).toEqual(['Apple', 'Finder', 'File', 'Edit', 'View', 'Go', 'Window', 'Help']);
  });

  it.each([
    ['browser', 'Safari', ['File', 'View', 'History', 'Bookmarks']],
    ['github', 'GitHub', ['File', 'View', 'Repository']],
    ['viewer', 'Preview', ['File', 'View', 'Go']],
    ['mail', 'Mail', ['File', 'Message', 'Mailbox']],
    ['editor', 'Code', ['File', 'View', 'Go', 'Terminal']],
    ['terminal', 'Terminal', ['Shell', 'Edit', 'View']],
    ['settings', 'System Settings', ['View']],
  ] as const)('%s → %s with its own menus', (role, appName, own) => {
    const bar = menuBarFor(ctx({ role, appName, windowOpen: true }));
    expect(bar.map((menu) => menu.label)).toEqual(['Apple', appName, ...own, 'Window', 'Help']);
  });

  it('app menu: About · Settings · Hide · Hide Others · Show All · Quit; window items disable without a window', () => {
    const [, app] = menuBarFor(ctx({ role: 'github', appName: 'GitHub', windowOpen: true }));
    expect(labels(app!.items)).toEqual([
      'About GitHub',
      'Settings…',
      'Hide GitHub',
      'Hide Others',
      'Show All',
      'Quit GitHub',
    ]);
    const noWindow = menuBarFor(ctx());
    const windowMenu = noWindow.find((menu) => menu.id === 'window')!;
    expect(windowMenu.items.find((i) => i.id === 'zoom')).toMatchObject({ disabled: true });
  });

  it('GitHub → View lists every project; Window lists open windows with a check on the focused one', () => {
    const bar = menuBarFor(
      ctx({
        role: 'github',
        appName: 'GitHub',
        windowOpen: true,
        windows: [
          { id: 'macos:files', label: 'Finder — Experience', focused: false },
          { id: 'macos:github', label: 'GitHub', focused: true },
        ],
      }),
    );
    const projects = walk(bar.find((menu) => menu.id === 'view')!.items).find((i) => i.id === 'projects');
    expect(projects?.kind === 'submenu' && labels(projects.items)).toEqual(['Portfolio OS']);
    const list = bar.find((menu) => menu.id === 'window')!.items.filter((i) => i.kind === 'checkbox');
    expect(list.map((i) => (i.kind === 'checkbox' ? [i.label, i.checked] : null))).toEqual([
      ['Finder — Experience', false],
      ['GitHub', true],
    ]);
  });
});

describe('MAC-MENU-05 Apple menu', () => {
  it('About This Mac · System Settings… · Switch Operating System… · Take the Tour · Lock Screen · Restart…', () => {
    expect(labels(appleMenu().items)).toEqual([
      'About This Mac',
      'System Settings…',
      'Switch Operating System…',
      'Take the Tour',
      'Lock Screen',
      'Restart…',
    ]);
    expect(
      appleMenu()
        .items.map((i) => ('command' in i ? i.command.kind : null))
        .filter(Boolean),
    ).toEqual(['about-this-mac', 'settings', 'switch-os', 'tour', 'lock', 'restart']);
  });
});

describe('MAC-MENU-07 compact collapses to one menu', () => {
  it('Apple + one app menu whose other menus are submenus', () => {
    const bar = menuBarFor(ctx({ role: 'mail', appName: 'Mail', windowOpen: true, compact: true }));
    expect(bar.map((menu) => menu.label)).toEqual(['Apple', 'Mail']);
    const subs = bar[1]!.items.filter((i) => i.kind === 'submenu').map((i) => ('label' in i ? i.label : ''));
    expect(subs).toEqual(['File', 'Message', 'Mailbox', 'Window', 'Help']);
  });
});

describe('MAC-MENU-08 shortcut hints come from the keymap registry', () => {
  it('every hint names a registered shortcut and formats from its chord', () => {
    for (const role of [null, 'browser', 'github', 'viewer', 'mail', 'editor', 'terminal', 'settings'] as const) {
      const bar = menuBarFor(ctx({ role, appName: 'X', windowOpen: true }));
      for (const spec of bar.flatMap((menu) => walk(menu.items)))
        if (spec.kind === 'item' && spec.shortcut) expect(SHORTCUTS.some((s) => s.id === spec.shortcut)).toBe(true);
    }
    const close = SHORTCUTS.find((s) => s.id === 'close-window')!.chords[0]!;
    expect(shortcutLabel('close-window', true)).toBe(formatChord(close, true));
    expect(shortcutLabel('close-window', false)).toBe('Alt+Shift+W');
    expect(shortcutLabel('search', true)).toBe('⌘K');
  });
});

describe('MAC-NOTIF-02 trigger table', () => {
  const triggers: Trigger[] = [
    { kind: 'welcome' },
    { kind: 'tour-offer' },
    { kind: 'continuity', title: 'Portfolio OS', from: 'windows', command: { kind: 'open', role: 'github' } },
    { kind: 'resume-downloaded' },
    { kind: 'email-copied' },
    { kind: 'link-copied' },
    { kind: 'offline' },
    { kind: 'online' },
    { kind: 'app-failed', role: 'github', name: 'GitHub' },
    { kind: 'konami' },
    { kind: 'storage-off' },
  ];

  it('each trigger maps to one deterministic notification (same output every call, no persona input)', () => {
    for (const trigger of triggers) expect(notificationFor(trigger)).toEqual(notificationFor(trigger));
    expect(notificationFor({ kind: 'welcome' })).toMatchObject({
      title: 'Welcome — everything here is an app.',
      body: 'Try Spotlight (Ctrl/Cmd+K).',
      action: { command: { kind: 'spotlight' } },
    });
    expect(notificationFor({ kind: 'tour-offer' })).toMatchObject({
      title: 'New here?',
      body: 'Take a 20-second tour.',
      action: { label: 'Start' },
      secondary: { label: 'Not now' },
    });
    expect(notificationFor({ kind: 'resume-downloaded' }).title).toBe('Résumé.pdf downloaded');
    expect(notificationFor({ kind: 'email-copied' }).title).toBe('Email address copied');
    expect(notificationFor({ kind: 'offline' }).title).toBe('You’re offline');
    expect(notificationFor({ kind: 'app-failed', role: 'github', name: 'GitHub' })).toMatchObject({
      title: 'Couldn’t open GitHub',
      action: { label: 'Retry' },
    });
  });
});

describe('MAC-NOTIF-01 queue and Center; MAC-EDGE-04 overlays', () => {
  beforeEach(resetMacUi);

  it('1 visible, at most 3 queued (oldest waiting drops into the Center); every banner is in the Center', () => {
    for (const kind of ['offline', 'online', 'email-copied', 'link-copied', 'konami'] as const) notify({ kind });
    const { banners, center } = macUi.getState();
    expect(banners).toHaveLength(BANNER_QUEUE_MAX);
    expect(banners[0]!.title).toBe('You’re offline'); // the visible one stays
    expect(center).toHaveLength(5);
    dismissBanner(banners[0]!.id);
    expect(macUi.getState().banners[0]!.title).toBe('Link copied');
    clearCenter('system');
    expect(macUi.getState().center.map((n) => n.app)).toEqual(['mail']);
    clearCenter();
    expect(macUi.getState().center).toEqual([]);
  });

  it('once-per-session banners (welcome, tour offer) are not repeated', () => {
    expect(notify({ kind: 'welcome' })).not.toBeNull();
    expect(notify({ kind: 'welcome' })).toBeNull();
  });

  it('overlay requests go through the arbiter; context menus and dialogs record their target', () => {
    expect(requestOverlay('mission')).toBe(true);
    expect(requestOverlay('spotlight')).toBe(false); // E15
    closeOverlay('mission');
    setDragging(true);
    expect(requestOverlay('spotlight')).toBe(false); // during a drag
    setDragging(false);
    openContextMenu({ kind: 'desktop' }, 10, 20, null);
    expect(macUi.getState()).toMatchObject({ overlay: 'context', context: { x: 10, y: 20 } });
    openDialog({ kind: 'switch-os' });
    expect(macUi.getState()).toMatchObject({ overlay: 'dialog', dialog: { kind: 'switch-os' }, context: null });
    expect(requestOverlay('menu')).toBe(false);
    closeOverlay('dialog');
    expect(macUi.getState().dialog).toBeNull();
    setLoading('github', true);
    setLoading('github', true);
    expect(macUi.getState().loading).toEqual(['github']);
    setLoading('github', false);
    expect(macUi.getState().loading).toEqual([]);
  });
});
