/**
 * Pure macOS P3 modules:
 *   MAC-CTX-01 (menu stays inside the workspace at all four corners; above the finger on touch) ·
 *   MAC-CTX-02 (menus per target) · MAC-DOCK-06/07 (Dock menu: Quit only while running; résumé stack) ·
 *   MAC-MOTION-01 (the timing table as tokens) · MAC-MENU-08 (shortcut hints are the registry's real chords) ·
 *   MAC-SET-05 / MAC-X-05 (the OS list) · MAC-TERM-03 (terminal `open` → the owning app, via runTerminalEffect) ·
 *   MAC-SPOT-04 (command results insert into Terminal, never run).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dispatched: unknown[] = [];
vi.mock('@/stores/kernel-store', async (original) => {
  const actual = await original<typeof import('@/stores/kernel-store')>();
  return {
    ...actual,
    dispatchSoon: (action: unknown) => {
      dispatched.push(action);
    },
  };
});

const { contextMenuFor, contextMenuLabel, placeMenu, FINGER_OFFSET } =
  await import('@/components/os/macos/context-menus');
const { MAC_TIMING, EASE_OUT, EASE_OVERVIEW, timingVars } = await import('@/components/os/macos/timing');
const { MAC_MOTION } = await import('@/components/os/macos/motion');
const { macShortcuts, appleKeyboard } = await import('@/components/os/macos/shortcuts');
const { SHORTCUTS } = await import('@/lib/kernel/keymap');
const { runMacCommand, runTerminalEffect, registerMacShellHooks, openRef } =
  await import('@/components/os/macos/run-command');
const { macUi, resetMacUi } = await import('@/components/os/macos/ui');
const { toMenuEntries } = await import('@/components/os/macos/menu-entries');

const facts = {
  running: ['files', 'github'] as const,
  visible: ['files'] as const,
  titles: { files: 'Finder', github: 'GitHub', viewer: 'Preview' },
  compact: false,
};

const labels = (specs: readonly { kind: string; label?: string }[]) =>
  specs.filter((spec) => spec.kind !== 'separator').map((spec) => spec.label);

beforeEach(() => {
  dispatched.length = 0;
  resetMacUi();
});

describe('MAC-CTX-01 context menu placement', () => {
  const space = { left: 0, top: 24, right: 1440, bottom: 820 };
  const box = { w: 240, h: 300 };
  it('opens at the pointer when it fits', () => {
    expect(placeMenu({ x: 400, y: 300 }, box, space)).toEqual({ x: 400, y: 300 });
  });
  it.each([
    ['top-left', { x: 0, y: 0 }],
    ['top-right', { x: 1440, y: 0 }],
    ['bottom-left', { x: 0, y: 900 }],
    ['bottom-right', { x: 1440, y: 900 }],
  ])('stays inside the workspace at the %s corner (never under the menu bar or the Dock)', (_corner, point) => {
    const at = placeMenu(point, box, space);
    expect(at.x).toBeGreaterThanOrEqual(space.left);
    expect(at.y).toBeGreaterThanOrEqual(space.top);
    expect(at.x + box.w).toBeLessThanOrEqual(space.right);
    expect(at.y + box.h).toBeLessThanOrEqual(space.bottom);
  });
  it('flips left and up near the far edges', () => {
    expect(placeMenu({ x: 1400, y: 700 }, box, space)).toEqual({ x: 1160, y: 400 });
  });
  it('on a coarse pointer the menu sits above the finger, below it only when there is no room', () => {
    expect(placeMenu({ x: 400, y: 600 }, box, space, { coarse: true }).y).toBe(600 - FINGER_OFFSET - box.h);
    expect(placeMenu({ x: 400, y: 100 }, box, space, { coarse: true }).y).toBe(100 + FINGER_OFFSET);
  });
  it('a menu taller than the workspace is pinned to its top', () => {
    expect(placeMenu({ x: 10, y: 500 }, { w: 200, h: 2000 }, space).y).toBe(space.top + 4);
  });
});

describe('MAC-CTX-02 menus per target', () => {
  it('desktop: New Finder Window · Change Wallpaper… · Show View Options (disabled) · Switch Operating System…', () => {
    const menu = contextMenuFor({ kind: 'desktop' }, facts);
    expect(labels(menu)).toEqual([
      'New Finder Window',
      'Change Wallpaper…',
      'Show View Options',
      'Switch Operating System…',
    ]);
    expect(menu.find((spec) => spec.kind === 'item' && spec.id === 'view-options')).toMatchObject({ disabled: true });
    expect(menu.find((spec) => spec.kind === 'item' && spec.id === 'change-wallpaper')).toMatchObject({
      command: { kind: 'settings', pane: 'appearance' },
    });
  });

  it('desktop item: Open · Open in New Window (disabled) · Get Info · Quick Look · Copy Link (+ Download for the résumé)', () => {
    const role = contextMenuFor({ kind: 'item', ref: { section: 'experience' }, label: 'Experience' }, facts);
    expect(labels(role)).toEqual(['Open', 'Open in New Window', 'Get Info', 'Quick Look', 'Copy Link']);
    const resume = contextMenuFor({ kind: 'item', ref: { section: 'resume' }, label: 'Résumé.pdf' }, facts);
    expect(labels(resume)).toContain('Download');
    expect(resume.find((spec) => spec.kind === 'item' && spec.id === 'copy-link')).toMatchObject({
      command: { kind: 'copy-link', ref: { section: 'resume' } },
    });
  });

  it('MAC-DOCK-06: Quit only for a running app; Hide only with a visible window; Options ▸ is decorative', () => {
    const running = contextMenuFor({ kind: 'dock', role: 'github' }, facts);
    expect(labels(running)).toEqual(['Show GitHub', 'Show All Windows', 'Hide GitHub', 'Quit GitHub', 'Options']);
    expect(running.find((spec) => spec.kind === 'item' && spec.id === 'hide')).toMatchObject({ disabled: true });
    expect(running.find((spec) => spec.kind === 'submenu')).toMatchObject({ disabled: true });
    const idle = contextMenuFor({ kind: 'dock', role: 'viewer' }, facts);
    expect(labels(idle)).not.toContain('Quit Preview');
    expect(labels(idle)[0]).toBe('Open');
  });

  it('MAC-DOCK-07: the résumé stack offers Open in Preview and Download PDF', () => {
    expect(labels(contextMenuFor({ kind: 'dock-resume' }, facts))).toEqual(['Open in Preview', 'Download PDF']);
  });

  it('title bar: Minimize · Zoom · Move · Size · Center · Close (geometry items disabled in compact)', () => {
    const menu = contextMenuFor({ kind: 'titlebar', role: 'files' }, facts);
    expect(labels(menu)).toEqual(['Minimize', 'Zoom', 'Move', 'Size', 'Center', 'Close']);
    const compact = contextMenuFor({ kind: 'titlebar', role: 'files' }, { ...facts, compact: true });
    expect(
      compact.filter((spec) => spec.kind === 'item' && spec.disabled).map((spec) => spec.kind === 'item' && spec.id),
    ).toEqual(['zoom', 'move', 'size', 'center']);
  });

  it('every menu has an accessible name', () => {
    expect(contextMenuLabel({ kind: 'desktop' }, facts)).toBe('Desktop');
    expect(contextMenuLabel({ kind: 'dock', role: 'github' }, facts)).toBe('GitHub (Dock)');
    expect(contextMenuLabel({ kind: 'titlebar', role: 'files' }, facts)).toBe('Finder window');
  });

  it('menu data becomes Menu primitive entries that run their command', () => {
    const run = vi.fn();
    const entries = toMenuEntries(contextMenuFor({ kind: 'desktop' }, facts), run);
    const first = entries[0]!;
    expect(first.kind).toBe('item');
    if (first.kind === 'item') first.onSelect();
    expect(run).toHaveBeenCalledWith({ kind: 'open', role: 'files' });
  });
});

describe('MAC-MOTION-01 the macOS timing table as tokens (plans/macos/03-motion.md)', () => {
  it('window motion', () => {
    expect(MAC_MOTION.open.ms).toBe(200);
    expect(MAC_MOTION.open.fromScale).toBe(0.92);
    expect(MAC_MOTION.close.ms).toBe(140);
    expect(MAC_MOTION.close.toScale).toBe(0.96);
    expect(MAC_MOTION.minimize.ms).toBe(380);
    expect(MAC_MOTION.restore.ms).toBe(340);
    expect(MAC_MOTION.slowFactor).toBe(6);
    expect(MAC_MOTION.zoom.ms).toBe(420);
    expect(MAC_MOTION.columnPush.ms).toBe(200);
  });
  it('surfaces', () => {
    expect(MAC_TIMING.menu).toEqual({ openMs: 0, blinkMs: 60, fadeOutMs: 130 });
    expect(MAC_TIMING.dock.magnify).toEqual({ response: 0.18, damping: 1 });
    expect(MAC_TIMING.dock.bounceMs).toBe(520);
    expect(MAC_TIMING.dock.bouncePx).toBe(18);
    expect(MAC_TIMING.spotlight).toMatchObject({ inMs: 120, inScale: 0.98, outMs: 100 });
    expect(MAC_TIMING.banner.in).toEqual({ response: 0.4, damping: 0.85 });
    expect(MAC_TIMING.banner.outMs).toBe(250);
    expect(MAC_TIMING.banner.dwellMs).toBeGreaterThanOrEqual(6000);
    expect(MAC_TIMING.center).toEqual({ ms: 300, ease: EASE_OUT });
    expect(MAC_TIMING.mission).toEqual({ ms: 420, ease: EASE_OVERVIEW });
    expect(MAC_TIMING.sheet).toMatchObject({ dropMs: 260, liftMs: 200 });
    expect(MAC_TIMING.lock).toEqual({ contentMs: 220, wallpaperMs: 260, staggerMs: 60 });
    expect(EASE_OUT).toBe('cubic-bezier(0.2, 0.9, 0.3, 1)');
    expect(EASE_OVERVIEW).toBe('cubic-bezier(0.3, 0, 0.1, 1)');
  });
  it('the stylesheet-driven durations come from the same tokens', () => {
    expect(timingVars()).toMatchObject({ '--mac-dur-spotlight-in': '120ms', '--mac-dur-center': '300ms' });
  });
});

describe('MAC-MENU-08 shortcut hints are the registry chords macOS handles', () => {
  it('lists only macOS chords, each from the registry (never Home or Snap)', () => {
    const list = macShortcuts({ apple: false });
    const ids = list.map((item) => item.id);
    expect(ids).not.toContain('home');
    expect(ids.some((id) => id.startsWith('snap'))).toBe(false);
    for (const item of list) {
      const registered = SHORTCUTS.find((shortcut) => shortcut.id === item.id);
      expect(registered).toBeDefined();
    }
    expect(list.find((item) => item.id === 'close-window')?.keys).toBe('Alt+Shift+W');
    expect(macShortcuts({ apple: true }).find((item) => item.id === 'close-window')?.keys).toBe('⌥⇧W');
  });
  it('single-key shortcuts disappear when switched off (WCAG 2.1.4)', () => {
    const ids = macShortcuts({ singleKeys: false }).map((item) => item.id);
    expect(ids).not.toContain('search-slash');
    expect(ids).not.toContain('help');
    expect(ids).toContain('search');
  });
  it('Apple keyboards are recognised from the platform only', () => {
    expect(appleKeyboard({ platform: 'MacIntel', userAgent: '' })).toBe(true);
    expect(appleKeyboard({ platform: 'Win32', userAgent: '' })).toBe(false);
    expect(appleKeyboard(undefined)).toBe(false);
  });
});

describe('runMacCommand / runTerminalEffect', () => {
  it('MAC-TERM-03: `open` dispatches OPEN_APP for the app that owns the content', () => {
    runTerminalEffect({ k: 'open', ref: { section: 'projects', slug: 'x' } });
    runTerminalEffect({ k: 'open', ref: 'resume' });
    runTerminalEffect({ k: 'reveal', path: ['home', 'jaswanth'], ref: null });
    expect(dispatched).toEqual([
      expect.objectContaining({
        type: 'OPEN_APP',
        os: 'macos',
        role: 'github',
        location: { kind: 'content', ref: { section: 'projects', slug: 'x' } },
      }),
      expect.objectContaining({ type: 'OPEN_APP', role: 'viewer' }),
      expect.objectContaining({ type: 'OPEN_APP', role: 'files' }),
    ]);
  });

  it('MAC-SPOT-04: a command result is inserted for the Terminal — Terminal opens, nothing runs', () => {
    runMacCommand({ kind: 'terminal-insert', command: 'neofetch' });
    expect(macUi.getState().terminalInsert).toBe('neofetch');
    expect(dispatched).toEqual([expect.objectContaining({ type: 'OPEN_APP', role: 'terminal' })]);
  });

  it('window commands act on the focused window; overlays go through the arbiter', () => {
    runMacCommand({ kind: 'switch-os' });
    expect(macUi.getState()).toMatchObject({ overlay: 'dialog', dialog: { kind: 'switch-os' } });
    resetMacUi();
    runMacCommand({ kind: 'spotlight', query: 'go' });
    expect(macUi.getState()).toMatchObject({ overlay: 'spotlight', spotlightQuery: 'go' });
    runMacCommand({ kind: 'notification-center' });
    expect(macUi.getState().overlay).toBe('notification-center');
    runMacCommand({ kind: 'notification-center' });
    expect(macUi.getState().overlay).toBeNull();
  });

  it('shell hooks receive Mission Control, window modes, the tour and restart', () => {
    const hooks = {
      overview: vi.fn(),
      windowMode: vi.fn(),
      startTour: vi.fn(),
      selectAllDesktop: vi.fn(),
      restart: vi.fn(),
    };
    const off = registerMacShellHooks(hooks);
    runMacCommand({ kind: 'mission-control' });
    runMacCommand({ kind: 'tour' });
    runMacCommand({ kind: 'restart-now' });
    expect(hooks.overview).toHaveBeenCalled();
    expect(hooks.startTour).toHaveBeenCalled();
    expect(hooks.restart).toHaveBeenCalled();
    off();
    runMacCommand({ kind: 'tour' });
    expect(hooks.startTour).toHaveBeenCalledTimes(1);
  });

  it('Quit and Show All are kernel actions', () => {
    runMacCommand({ kind: 'quit', role: 'github' });
    runMacCommand({ kind: 'show-all' });
    expect(dispatched).toEqual([
      { type: 'QUIT_APP', role: 'github', os: 'macos' },
      { type: 'SHOW_ALL', os: 'macos' },
    ]);
  });

  it('opening content passes the launcher as the flight origin and focus return', () => {
    openRef({ section: 'experience' }, 'desk-experience');
    expect(dispatched[0]).toMatchObject({ originId: 'desk-experience', invoker: 'desk-experience', role: 'files' });
  });
});
