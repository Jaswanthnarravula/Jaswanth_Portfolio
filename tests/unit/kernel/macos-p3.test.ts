/**
 * macOS P3 kernel behaviour (plans/macos/02-window-manager.md): MAC-WM-07 (closing keeps the app running — its Dock
 * dot stays — and only Quit stops it) · MAC-WM-12 (Hide Others / Show All) · the Dock-size-aware workspace
 * (Settings → Desktop & Dock) · the new preferences parse and survive storage (A11Y-PREF-01 / MAC-SET-03).
 */
import { describe, expect, it } from 'vitest';
import type { KernelAction } from '@/lib/kernel/actions';
import { viewportFor } from '@/lib/kernel/geometry';
import type { AppRole } from '@/lib/kernel/ids';
import { parsePrefs } from '@/lib/kernel/persist/prefs';
import { parsePersistedSessions, toPersisted } from '@/lib/kernel/persist/sessions';
import { macDockIcon, macosInsets, workspaceInsets } from '@/lib/kernel/registry';
import { DEFAULT_PREFS } from '@/lib/kernel/state';
import type { WindowId } from '@/lib/kernel/types';
import { booted, last, makeDeps, run } from '../../fixtures/portfolio';

const id = (role: AppRole) => `macos:${role}` as WindowId;
const open = (role: AppRole): KernelAction => ({ type: 'OPEN_APP', role });
const settle = (role: AppRole): KernelAction => ({ type: 'PHASE_DONE', target: { kind: 'window', id: id(role) } });

describe('MAC-WM-07 close keeps the app running; Quit removes the dot', () => {
  it('opening starts the app; closing its window keeps it running', () => {
    const results = run(booted('/macos'), [
      open('files'),
      settle('files'),
      { type: 'CLOSE_WINDOW', id: id('files') },
      settle('files'),
    ]);
    const state = last(results).state;
    expect(state.sessions.macos.windows[id('files')]).toBeUndefined();
    expect(state.sessions.macos.running).toEqual(['files']);
  });

  it('Quit closes the window with the close rules and stops the app', () => {
    const before = last(
      run(booted('/macos'), [open('files'), settle('files'), open('github'), settle('github')]),
    ).state;
    const quit = run(before, [{ type: 'QUIT_APP', role: 'github' }]);
    expect(quit[0]!.state.sessions.macos.windows[id('github')]?.phase.s).toBe('closing');
    expect(quit[0]!.state.sessions.macos.running).toEqual(['files']);
    expect(quit[0]!.state.sessions.macos.focused).toBe(id('files'));
    expect(quit[0]!.routeIntent).toBe('go');
    expect(quit[0]!.focusTarget?.candidates[0]).toBe(`window:${id('files')}`);
  });

  it('Quit of a running app with no window just stops it; Quit of a stopped app is a no-op', () => {
    const closed = last(
      run(booted('/macos'), [open('mail'), settle('mail'), { type: 'CLOSE_WINDOW', id: id('mail') }, settle('mail')]),
    ).state;
    const quit = run(closed, [{ type: 'QUIT_APP', role: 'mail' }])[0]!;
    expect(quit.state.sessions.macos.running).toEqual([]);
    expect(quit.routeIntent).toBeNull();
    expect(run(quit.state, [{ type: 'QUIT_APP', role: 'mail' }])[0]!.state).toBe(quit.state);
  });

  it('running apps persist with the session and parse back', () => {
    const state = last(
      run(booted('/macos'), [open('files'), settle('files'), open('terminal'), settle('terminal')]),
    ).state;
    const parsed = parsePersistedSessions(JSON.parse(JSON.stringify(toPersisted(state, 1, 'rev'))));
    expect(parsed?.sessions.macos?.running).toEqual(['files', 'terminal']);
    const junk = parsePersistedSessions({
      v: 1,
      savedAt: 1,
      contentRev: 'r',
      sessions: { macos: { os: 'macos', running: ['files', 'nope', 7, 'files'] } },
    });
    expect(junk?.sessions.macos?.running).toEqual(['files']);
  });
});

describe('MAC-WM-12 Hide Others / Show All', () => {
  const three = () =>
    last(
      run(booted('/macos'), [
        open('files'),
        settle('files'),
        open('github'),
        settle('github'),
        open('mail'),
        settle('mail'),
      ]),
    ).state;

  it('Hide Others minimizes every other window at once and keeps (or gives) focus to the one kept', () => {
    const hidden = run(three(), [{ type: 'HIDE_OTHERS', id: id('github') }])[0]!;
    const windows = hidden.state.sessions.macos.windows;
    expect(windows[id('files')]?.phase.s).toBe('minimized');
    expect(windows[id('mail')]?.phase.s).toBe('minimized');
    expect(windows[id('github')]?.phase.s).toBe('normal');
    expect(hidden.state.sessions.macos.focused).toBe(id('github'));
    expect(hidden.routeIntent).toBe('go'); // Mail was focused; GitHub now is
  });

  it('Show All brings every minimized window back and leaves focus where it is', () => {
    const hidden = run(three(), [{ type: 'HIDE_OTHERS', id: id('mail') }])[0]!.state;
    const shown = run(hidden, [{ type: 'SHOW_ALL' }])[0]!;
    for (const role of ['files', 'github', 'mail'] as const)
      expect(shown.state.sessions.macos.windows[id(role)]?.phase.s).toBe('normal');
    expect(shown.state.sessions.macos.focused).toBe(id('mail'));
    expect(shown.routeIntent).toBeNull();
    expect(run(shown.state, [{ type: 'SHOW_ALL' }])[0]!.state).toBe(shown.state);
  });

  it('Show All with nothing focused focuses the frontmost restored window', () => {
    const allMin = last(
      run(three(), [
        { type: 'HIDE_OTHERS', id: id('mail') },
        { type: 'MINIMIZE', id: id('mail') },
      ]),
    ).state;
    expect(allMin.sessions.macos.focused).toBeNull();
    const shown = run(allMin, [{ type: 'SHOW_ALL' }])[0]!;
    expect(shown.state.sessions.macos.focused).toBe(id('mail'));
    expect(shown.routeIntent).toBe('go');
  });
});

describe('Dock size bounds the workspace (Settings → Desktop & Dock)', () => {
  it('icon boxes per size and size class; insets follow', () => {
    const laptop = viewportFor(1440, 900, 'fine');
    const wide = viewportFor(1920, 1200, 'fine');
    expect([macDockIcon(laptop, 'small'), macDockIcon(laptop), macDockIcon(laptop, 'large')]).toEqual([40, 48, 56]);
    expect([macDockIcon(wide, 'small'), macDockIcon(wide), macDockIcon(wide, 'large')]).toEqual([52, 64, 76]);
    expect(macosInsets(laptop).bottom).toBe(68);
    expect(macosInsets(laptop, { dock: { magnification: true, size: 'large' } }).bottom).toBe(76);
    expect(workspaceInsets('macos', laptop, undefined, { dock: { magnification: true, size: 'small' } }).bottom).toBe(
      60,
    );
  });

  it('the reducer clamps with the visitor’s Dock size', () => {
    const deps = makeDeps({ prefs: { ...DEFAULT_PREFS, dock: { magnification: true, size: 'large' } } });
    const state = last(run(booted('/macos'), [open('files'), settle('files')], deps)).state;
    const low = run(
      state,
      [{ type: 'COMMIT_RECT', id: id('files'), rect: { x: 50, y: 5000, w: 800, h: 500 } }],
      deps,
    )[0]!;
    expect(low.state.sessions.macos.windows[id('files')]?.rect.expanded?.y).toBe(900 - 76 - 48);
  });
});

describe('A11Y-PREF-01 / MAC-SET-03 new preferences parse with defaults', () => {
  it('valid values survive; invalid ones fall back', () => {
    expect(parsePrefs({ wallpaper: 'dark', dock: { magnification: false, size: 'small' } })).toMatchObject({
      wallpaper: 'dark',
      dock: { magnification: false, size: 'small' },
    });
    expect(parsePrefs({ wallpaper: 'neon', dock: { magnification: 'yes', size: 'huge' } })).toMatchObject({
      wallpaper: 'auto',
      dock: { magnification: true, size: 'medium' },
    });
    expect(parsePrefs({ dock: 3 }).dock).toEqual(DEFAULT_PREFS.dock);
  });
});
