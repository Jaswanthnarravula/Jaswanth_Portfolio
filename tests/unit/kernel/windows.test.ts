import { describe, expect, it } from 'vitest';
import { reduce } from '@/lib/kernel/reducers';
import { clampGeometry, TITLE_REACH } from '@/lib/kernel/geometry';
import type { KernelAction } from '@/lib/kernel/actions';
import type { KernelState, WindowId } from '@/lib/kernel/types';
import { booted, last, makeDeps, run } from '../../fixtures/portfolio';

const deps = makeDeps();
const finder = 'macos:files' as WindowId;
const safari = 'macos:browser' as WindowId;
const open = (role: 'files' | 'browser' | 'github'): KernelAction => ({ type: 'OPEN_APP', role });
const settle = (id: WindowId): KernelAction => ({ type: 'PHASE_DONE', target: { kind: 'window', id } });

function desktop(): KernelState {
  return booted('/macos');
}

describe('KRN-WIN-01 idempotent open / focus', () => {
  it('open() on an open app raises instead of duplicating', () => {
    const results = run(desktop(), [open('files'), settle(finder), open('browser'), settle(safari), open('files')]);
    const state = last(results).state;
    const session = state.sessions.macos;
    expect(Object.keys(session.windows)).toEqual(['macos:files', 'macos:browser']);
    expect(session.zOrder).toEqual([safari, finder]);
    expect(session.focused).toBe(finder);
  });

  it('opening the focused, topmost app again returns the identical state reference', () => {
    const [first, second] = run(desktop(), [open('files'), settle(finder)]);
    const again = reduce(second!.state, open('files'), deps);
    expect(first!.state.sessions.macos.windows[finder]).toBeDefined();
    expect(again.state).toBe(second!.state);
  });
});

describe('KRN-WIN-02 phase guard table', () => {
  const opened = () => last(run(desktop(), [open('files')])).state;
  const normal = () => last(run(desktop(), [open('files'), settle(finder)])).state;
  const minimized = () => last(run(normal(), [{ type: 'MINIMIZE', id: finder }])).state;
  const closing = () => last(run(normal(), [{ type: 'CLOSE_WINDOW', id: finder }])).state;

  const illegal: [string, () => KernelState, KernelAction][] = [
    ['opening + MINIMIZE', opened, { type: 'MINIMIZE', id: finder }],
    ['opening + RESTORE', opened, { type: 'RESTORE', id: finder }],
    ['opening + TOGGLE_MAX', opened, { type: 'TOGGLE_MAXIMIZE', id: finder }],
    ['normal + RESTORE', normal, { type: 'RESTORE', id: finder }],
    ['normal + PHASE_DONE', normal, settle(finder)],
    ['minimized + MINIMIZE', minimized, { type: 'MINIMIZE', id: finder }],
    ['minimized + TOGGLE_MAX', minimized, { type: 'TOGGLE_MAXIMIZE', id: finder }],
    ['closing + FOCUS', closing, { type: 'FOCUS_WINDOW', id: finder }],
    ['closing + MINIMIZE', closing, { type: 'MINIMIZE', id: finder }],
    ['closing + RESTORE', closing, { type: 'RESTORE', id: finder }],
    ['closing + TOGGLE_MAX', closing, { type: 'TOGGLE_MAXIMIZE', id: finder }],
    ['closing + CLOSE', closing, { type: 'CLOSE_WINDOW', id: finder }],
    ['(none) + CLOSE', desktop, { type: 'CLOSE_WINDOW', id: finder }],
    ['(none) + FOCUS', desktop, { type: 'FOCUS_WINDOW', id: finder }],
  ];

  it.each(illegal)('%s returns the identical state reference', (_name, make, action) => {
    const state = make();
    expect(reduce(state, action, deps).state).toBe(state);
  });

  it('legal transitions follow the table', () => {
    expect(opened().sessions.macos.windows[finder]?.phase.s).toBe('opening');
    expect(normal().sessions.macos.windows[finder]?.phase.s).toBe('normal');
    expect(minimized().sessions.macos.windows[finder]?.phase.s).toBe('minimized');
    expect(closing().sessions.macos.windows[finder]?.phase.s).toBe('closing');
    // closing + OPEN = re-open (cancel close)
    expect(last(run(closing(), [open('files')])).state.sessions.macos.windows[finder]?.phase.s).toBe('opening');
    // closing + PHASE_DONE = removed
    expect(last(run(closing(), [settle(finder)])).state.sessions.macos.windows[finder]).toBeUndefined();
    // minimized + FOCUS = restore
    expect(
      last(run(minimized(), [{ type: 'FOCUS_WINDOW', id: finder }])).state.sessions.macos.windows[finder]?.phase.s,
    ).toBe('normal');
    // opening + CLOSE = closing
    expect(
      last(run(opened(), [{ type: 'CLOSE_WINDOW', id: finder }])).state.sessions.macos.windows[finder]?.phase.s,
    ).toBe('closing');
  });
});

describe('KRN-WIN-03 minimize / restore / maximize round-trips', () => {
  it('restore returns the prior rect and wasMaximized', () => {
    const [, settled] = run(desktop(), [open('files'), settle(finder)]);
    const before = settled!.state.sessions.macos.windows[finder]!;
    const rect = before.rect.expanded;
    expect(rect).toBeDefined();

    const maximized = reduce(settled!.state, { type: 'TOGGLE_MAXIMIZE', id: finder }, deps).state;
    const maxWindow = maximized.sessions.macos.windows[finder]!;
    expect(maxWindow.phase).toEqual({ s: 'maximized', restore: rect });

    const minimized = reduce(maximized, { type: 'MINIMIZE', id: finder }, deps).state;
    expect(minimized.sessions.macos.windows[finder]!.phase).toEqual({
      s: 'minimized',
      restore: rect,
      wasMaximized: true,
    });

    const restored = reduce(minimized, { type: 'RESTORE', id: finder }, deps).state;
    expect(restored.sessions.macos.windows[finder]!.phase).toEqual({ s: 'maximized', restore: rect });

    const unmaximized = reduce(restored, { type: 'TOGGLE_MAXIMIZE', id: finder }, deps).state;
    expect(unmaximized.sessions.macos.windows[finder]!.phase).toEqual({ s: 'normal' });
    expect(unmaximized.sessions.macos.windows[finder]!.rect.expanded).toEqual(rect);
  });

  it('minimize from normal keeps the rect and wasMaximized=false', () => {
    const [, settled] = run(desktop(), [open('files'), settle(finder)]);
    const rect = settled!.state.sessions.macos.windows[finder]!.rect.expanded!;
    const minimized = reduce(settled!.state, { type: 'MINIMIZE', id: finder }, deps);
    expect(minimized.state.sessions.macos.windows[finder]!.phase).toEqual({
      s: 'minimized',
      restore: rect,
      wasMaximized: false,
    });
    // macos/05: minimize → focus the window's Dock tile, then the app's launcher.
    expect(minimized.focusTarget?.candidates.slice(0, 2)).toEqual(['dock-tile:macos:files', 'launcher:macos:files']);
    const restored = reduce(minimized.state, { type: 'RESTORE', id: finder }, deps);
    expect(restored.state.sessions.macos.windows[finder]!.phase).toEqual({ s: 'normal' });
    expect(restored.state.sessions.macos.windows[finder]!.rect.expanded).toEqual(rect);
  });

  it('fullscreen apps (iOS) cannot be minimized or maximized', () => {
    const ios = last(run(booted('/ios'), [open('files'), settle('ios:files')])).state;
    expect(reduce(ios, { type: 'MINIMIZE', id: 'ios:files' }, deps).state).toBe(ios);
    expect(reduce(ios, { type: 'TOGGLE_MAXIMIZE', id: 'ios:files' }, deps).state).toBe(ios);
  });
});

describe('KRN-Z-01 z-order array semantics', () => {
  it('focus moves the id to the end; close removes it; index = z-index', () => {
    const results = run(desktop(), [
      open('files'),
      settle(finder),
      open('browser'),
      settle(safari),
      open('github'),
      settle('macos:github'),
    ]);
    let state = last(results).state;
    expect(state.sessions.macos.zOrder).toEqual([finder, safari, 'macos:github']);
    state = reduce(state, { type: 'FOCUS_WINDOW', id: finder }, deps).state;
    expect(state.sessions.macos.zOrder).toEqual([safari, 'macos:github', finder]);
    expect(state.sessions.macos.zOrder.indexOf(finder)).toBe(2);
    state = last(run(state, [{ type: 'CLOSE_WINDOW', id: finder }, settle(finder)])).state;
    expect(state.sessions.macos.zOrder).toEqual([safari, 'macos:github']);
    expect(state.sessions.macos.focused).toBe('macos:github');
  });

  it('close focuses the next topmost window, then the invoker, then the Dock button', () => {
    const state = last(
      run(desktop(), [{ type: 'OPEN_APP', role: 'files', invoker: 'dock:finder' }, settle(finder)]),
    ).state;
    const closed = reduce(state, { type: 'CLOSE_WINDOW', id: finder }, deps);
    expect(closed.focusTarget?.candidates.slice(0, 2)).toEqual(['dock:finder', 'launcher:macos:files']);
    expect(closed.routeIntent).toBe('go');
    expect(closed.state.route).toEqual({ kind: 'os', os: 'macos', focus: null });
  });
});

describe('KRN-GEO-01 px geometry, clamp, size-class buckets', () => {
  const workspace = { x: 0, y: 25, w: 1280, h: 775 };
  it('clampGeometry keeps 48 px of title bar on-screen', () => {
    const offRight = clampGeometry({ x: 5000, y: 100, w: 600, h: 400 }, workspace, { w: 300, h: 200 });
    expect(offRight.x).toBe(1280 - TITLE_REACH);
    const offLeft = clampGeometry({ x: -5000, y: 100, w: 600, h: 400 }, workspace, { w: 300, h: 200 });
    expect(offLeft.x + offLeft.w).toBe(TITLE_REACH);
    const offTop = clampGeometry({ x: 10, y: -300, w: 600, h: 400 }, workspace, { w: 300, h: 200 });
    expect(offTop.y).toBe(25);
    const offBottom = clampGeometry({ x: 10, y: 5000, w: 600, h: 400 }, workspace, { w: 300, h: 200 });
    expect(offBottom.y).toBe(25 + 775 - TITLE_REACH);
  });
  it('sizes are clamped between the minimum and the workspace', () => {
    expect(clampGeometry({ x: 0, y: 25, w: 50, h: 50 }, workspace, { w: 300, h: 200 })).toMatchObject({
      w: 300,
      h: 200,
    });
    expect(clampGeometry({ x: 0, y: 25, w: 9000, h: 9000 }, workspace, { w: 300, h: 200 })).toMatchObject({
      w: 1280,
      h: 775,
    });
  });
  it('geometry is bucketed per size class and re-clamped on resize', () => {
    const settled = last(run(desktop(), [open('files'), settle(finder)])).state;
    const committed = reduce(
      settled,
      { type: 'COMMIT_RECT', id: finder, rect: { x: 1300, y: 600, w: 700, h: 500 } },
      deps,
    ).state;
    expect(committed.sessions.macos.windows[finder]!.rect.expanded).toMatchObject({ w: 700, h: 500 });
    expect(committed.learnedRects[finder]?.expanded).toBeDefined();
    const small = reduce(committed, { type: 'VIEWPORT_CHANGED', w: 800, h: 600, pointer: 'fine' }, deps).state;
    expect(small.viewport.sizeClass).toBe('medium');
    expect(small.sessions.macos.sizeClass).toBe('medium');
    // The expanded bucket is kept for later; the medium bucket is independent.
    expect(small.sessions.macos.windows[finder]!.rect.expanded).toEqual(
      committed.sessions.macos.windows[finder]!.rect.expanded,
    );
  });
});
