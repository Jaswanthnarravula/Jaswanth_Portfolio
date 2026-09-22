/**
 * Windows 11 window manager at the kernel (plans/windows/02-window-manager.md, 06-edge-cases.md):
 *   WIN-WM-01 (centred placement at the app's size, File Explorer at the storyboard's fraction, 32 px cascade, the
 *   taskbar reserved) · WIN-WM-04/06/07 (Snap: zones → rects, pre-snap rect kept, drag-away floats, viewport re-derives,
 *   paired ½ + ½ resize, closing one keeps the other's half — E5) · WIN-WM-09 (maximize/restore keeps the snap tag) ·
 *   WIN-WM-13 (history: snap / maximize / move / resize write nothing; open / focus / close / minimize go()) ·
 *   the Edge `home` route (`/windows/edge` = About) · persistence of the snap tag.
 */
import { describe, expect, it } from 'vitest';
import type { KernelAction } from '@/lib/kernel/actions';
import { clampSplit, snapRect, snapTargetAt, viewportFor, workspaceFor } from '@/lib/kernel/geometry';
import type { AppRole } from '@/lib/kernel/ids';
import { parsePersistedSessions } from '@/lib/kernel/persist/sessions';
import { reduce } from '@/lib/kernel/reducers';
import { OS_REGISTRY, registryProblems, WINDOWS_CHROME, windowsInsets } from '@/lib/kernel/registry';
import { refForLocation } from '@/lib/kernel/route/codec';
import { titleFor } from '@/lib/kernel/route/title';
import { focusKeys, type KernelState, type WindowId } from '@/lib/kernel/types';
import { booted, fixtureCatalog, fixtureCodec, last, makeDeps, run } from '../../fixtures/portfolio';

const deps = makeDeps();
const id = (role: AppRole) => `windows:${role}` as WindowId;
const open = (role: AppRole): KernelAction => ({ type: 'OPEN_APP', os: 'windows', role });
const settle = (role: AppRole): KernelAction => ({ type: 'PHASE_DONE', target: { kind: 'window', id: id(role) } });
const win = (state: KernelState, role: AppRole) => state.sessions.windows.windows[id(role)]!;
const opened = (...roles: AppRole[]) =>
  last(
    run(
      booted('/windows'),
      roles.flatMap((role) => [open(role), settle(role)]),
    ),
  ).state;

describe('WIN-WM-01 placement: centred at the app size above the 48 px taskbar; Explorer at the frame fraction', () => {
  it('reserves the taskbar (48 px, 40 px compact landscape) and nothing else', () => {
    expect(windowsInsets(viewportFor(1440, 900, 'fine'))).toEqual({ top: 0, right: 0, bottom: 48, left: 0 });
    expect(windowsInsets(viewportFor(844, 390, 'coarse')).bottom).toBe(WINDOWS_CHROME.taskbar.compactLandscape);
    expect(windowsInsets(viewportFor(390, 844, 'coarse')).bottom).toBe(WINDOWS_CHROME.taskbar.base);
  });

  it('File Explorer opens at x 2 %, y 3 %, 48 % × 83 % of the page (plans/windows/01 "Visual target")', () => {
    const rect = win(opened('files'), 'files').rect.expanded!;
    expect(rect).toEqual({ x: 29, y: 27, w: 691, h: 747 });
  });

  it('other apps open centred at their spec size in the workspace; a second window cascades 32 px', () => {
    const state = opened('github');
    const workspace = workspaceFor({ w: 1440, h: 900 }, windowsInsets(state.viewport));
    const rect = win(state, 'github').rect.expanded!;
    expect({ w: rect.w, h: rect.h }).toEqual({ w: 1040, h: 680 });
    expect(rect.x).toBe(Math.round((workspace.w - 1040) / 2));
    expect(rect.y).toBe(Math.round((workspace.h - 680) / 2));
    // Outlook (1020 × 640) centres elsewhere; Edge and VS Code share 1100 × 700 → the second cascades by 32 px.
    const both = opened('browser', 'editor');
    const edge = win(both, 'browser').rect.expanded!;
    const code = win(both, 'editor').rect.expanded!;
    expect(code.x - edge.x).toBe(32);
    expect(code.y - edge.y).toBe(32);
  });

  it('large viewports open windows 12 % larger', () => {
    const state = last(run(booted('/windows', { w: 1920, h: 1200 }), [open('terminal')])).state;
    expect(win(state, 'terminal').rect.large).toMatchObject({ w: Math.round(760 * 1.12), h: Math.round(480 * 1.12) });
  });

  it('the registry stays valid with Edge’s home section and Settings pinned (the frame’s taskbar)', () => {
    expect(registryProblems()).toEqual([]);
    expect(OS_REGISTRY.windows.apps.find((app) => app.role === 'settings')?.pinned).toBe(true);
    expect(OS_REGISTRY.windows.apps.find((app) => app.role === 'browser')?.home).toBe('about');
  });
});

describe('WIN-WM-06 snap geometry: zones derive from the workspace', () => {
  const workspace = { x: 0, y: 0, w: 1440, h: 852 };
  it('halves, quarters and thirds tile the workspace exactly', () => {
    expect(snapRect('left', workspace)).toEqual({ x: 0, y: 0, w: 720, h: 852 });
    expect(snapRect('right', workspace)).toEqual({ x: 720, y: 0, w: 720, h: 852 });
    expect(snapRect('tl', workspace)).toEqual({ x: 0, y: 0, w: 720, h: 426 });
    expect(snapRect('br', workspace)).toEqual({ x: 720, y: 426, w: 720, h: 426 });
    expect(snapRect('left-two-thirds', workspace).w + snapRect('third-r', workspace).w).toBe(1440);
    const thirds = (['third-l', 'third-c', 'third-r'] as const).map((zone) => snapRect(zone, workspace));
    expect(thirds.reduce((sum, rect) => sum + rect.w, 0)).toBe(1440);
    expect(thirds[1]!.x).toBe(thirds[0]!.w);
  });
  it('the ½ + ½ split moves the shared edge, clamped to 25–75 %', () => {
    expect(snapRect('left', workspace, 0.6).w).toBe(864);
    expect(snapRect('right', workspace, 0.6)).toEqual({ x: 864, y: 0, w: 576, h: 852 });
    expect(clampSplit(0.9)).toBe(0.75);
    expect(clampSplit(Number.NaN)).toBe(0.5);
  });
  it('snapTargetAt: edges → halves, edge corners → quarters, top edge → maximize (12 px, 24 px on touch)', () => {
    expect(snapTargetAt({ x: 4, y: 400 }, workspace)).toBe('left');
    expect(snapTargetAt({ x: 1436, y: 400 }, workspace)).toBe('right');
    expect(snapTargetAt({ x: 2, y: 30 }, workspace)).toBe('tl');
    expect(snapTargetAt({ x: 1439, y: 830 }, workspace)).toBe('br');
    expect(snapTargetAt({ x: 700, y: 3 }, workspace)).toBe('top');
    expect(snapTargetAt({ x: 700, y: 400 }, workspace)).toBeNull();
    expect(snapTargetAt({ x: 20, y: 400 }, workspace)).toBeNull();
    expect(snapTargetAt({ x: 20, y: 400 }, workspace, { edge: 24 })).toBe('left');
  });
});

describe('WIN-WM-04 · WIN-WM-06 · WIN-WM-07 · WIN-WM-09 snap in the kernel', () => {
  it('snapping keeps the pre-snap rect; a committed move leaves Snap (drag away restores it)', () => {
    const state = opened('files');
    const before = win(state, 'files').rect.expanded!;
    const snapped = reduce(state, { type: 'SNAP_WINDOW', id: id('files'), zone: 'left' }, deps).state;
    expect(win(snapped, 'files').snap).toEqual({ zone: 'left', split: 0.5 });
    expect(win(snapped, 'files').rect.expanded).toEqual(before);
    expect(win(snapped, 'files').phase.s).toBe('normal');
    const moved = reduce(snapped, { type: 'COMMIT_RECT', id: id('files'), rect: { ...before, x: 300 } }, deps).state;
    expect(win(moved, 'files').snap).toBeUndefined();
    expect(win(moved, 'files').rect.expanded?.x).toBe(300);
  });

  it('snapping the same zone twice returns the same state; SNAP null floats in place', () => {
    const snapped = reduce(opened('files'), { type: 'SNAP_WINDOW', id: id('files'), zone: 'right' }, deps).state;
    expect(reduce(snapped, { type: 'SNAP_WINDOW', id: id('files'), zone: 'right' }, deps).state).toBe(snapped);
    const floated = reduce(snapped, { type: 'SNAP_WINDOW', id: id('files'), zone: null }, deps).state;
    expect(win(floated, 'files').snap).toBeUndefined();
  });

  it('maximizing a snapped window keeps its tag; restoring returns it to its zone; minimize/restore too', () => {
    const snapped = reduce(opened('files'), { type: 'SNAP_WINDOW', id: id('files'), zone: 'tl' }, deps).state;
    const max = reduce(snapped, { type: 'TOGGLE_MAXIMIZE', id: id('files') }, deps).state;
    expect(win(max, 'files').phase.s).toBe('maximized');
    expect(win(max, 'files').snap?.zone).toBe('tl');
    const back = reduce(max, { type: 'TOGGLE_MAXIMIZE', id: id('files') }, deps).state;
    expect(win(back, 'files').phase.s).toBe('normal');
    expect(win(back, 'files').snap?.zone).toBe('tl');
    const min = reduce(back, { type: 'MINIMIZE', id: id('files') }, deps).state;
    const restored = reduce(min, { type: 'RESTORE', id: id('files') }, deps).state;
    expect(win(restored, 'files').snap?.zone).toBe('tl');
  });

  it('snapping a maximized window leaves maximize and keeps the pre-maximize rect as its restore rect', () => {
    const state = opened('files');
    const before = win(state, 'files').rect.expanded!;
    const max = reduce(state, { type: 'TOGGLE_MAXIMIZE', id: id('files') }, deps).state;
    const snapped = reduce(max, { type: 'SNAP_WINDOW', id: id('files'), zone: 'right' }, deps).state;
    expect(win(snapped, 'files').phase.s).toBe('normal');
    expect(win(snapped, 'files').rect.expanded).toEqual(before);
  });

  it('paired resize moves the shared edge of both halves; closing one keeps the other’s half (E5)', () => {
    let state = opened('files', 'github');
    state = last(
      run(state, [
        { type: 'SNAP_WINDOW', id: id('files'), zone: 'left' },
        { type: 'SNAP_WINDOW', id: id('github'), zone: 'right' },
        { type: 'SET_SNAP_SPLIT', os: 'windows', split: 0.62 },
      ]),
    ).state;
    expect(win(state, 'files').snap?.split).toBe(0.62);
    expect(win(state, 'github').snap?.split).toBe(0.62);
    const closed = last(run(state, [{ type: 'CLOSE_WINDOW', id: id('github') }, settle('github')])).state;
    expect(win(closed, 'files').snap).toEqual({ zone: 'left', split: 0.62 });
  });

  it('a new half lines up with its partner’s shared edge', () => {
    let state = opened('files', 'github');
    state = last(
      run(state, [
        { type: 'SNAP_WINDOW', id: id('files'), zone: 'left' },
        { type: 'SET_SNAP_SPLIT', os: 'windows', split: 0.4 },
        { type: 'SNAP_WINDOW', id: id('github'), zone: 'right' },
      ]),
    ).state;
    expect(win(state, 'github').snap).toEqual({ zone: 'right', split: 0.4 });
  });

  it('snap tags survive persistence; unknown zones float', () => {
    const snapped = reduce(opened('files'), { type: 'SNAP_WINDOW', id: id('files'), zone: 'third-c' }, deps).state;
    const payload = JSON.parse(
      JSON.stringify({ v: 1, savedAt: 1, contentRev: 'x', sessions: snapped.sessions, learnedRects: {} }),
    );
    expect(parsePersistedSessions(payload)?.sessions.windows?.windows[id('files')]?.snap).toEqual({ zone: 'third-c' });
    payload.sessions.windows.windows['windows:files'].snap = { zone: 'diagonal' };
    expect(parsePersistedSessions(payload)?.sessions.windows?.windows[id('files')]?.snap).toBeUndefined();
  });
});

describe('WIN-WM-13 history rule per window event on Windows', () => {
  it('open / focus / close / minimize go(); snap, split, maximize and move write nothing', () => {
    const state = opened('files', 'github');
    const intent = (action: KernelAction) => reduce(state, action, deps).routeIntent;
    expect(intent({ type: 'FOCUS_WINDOW', id: id('files') })).toBe('go');
    expect(intent({ type: 'MINIMIZE', id: id('github') })).toBe('go');
    expect(intent({ type: 'CLOSE_WINDOW', id: id('github') })).toBe('go');
    expect(intent({ type: 'SNAP_WINDOW', id: id('github'), zone: 'left' })).toBeNull();
    expect(intent({ type: 'SET_SNAP_SPLIT', os: 'windows', split: 0.3 })).toBeNull();
    expect(intent({ type: 'TOGGLE_MAXIMIZE', id: id('github') })).toBeNull();
    expect(intent({ type: 'COMMIT_RECT', id: id('github'), rect: { x: 10, y: 10, w: 800, h: 500 } })).toBeNull();
  });

  it('re-opening the app already in front changes nothing and writes nothing, but focus returns to its window', () => {
    const state = opened('files', 'github');
    const result = reduce(state, open('github'), deps);
    expect(result.state).toBe(state);
    expect(result.routeIntent).toBeNull();
    expect(result.focusTarget?.candidates[0]).toBe(focusKeys.window(id('github')));
  });
});

describe('Edge’s home route: /windows/edge is the About tab (WIN-EDGE-03)', () => {
  it('root ↔ /windows/edge, résumé ↔ /windows/edge/resume, the long form canonicalizes to the root', () => {
    const at = (location: { kind: 'root' } | { kind: 'content'; ref: { section: 'about' | 'resume' } }) =>
      fixtureCodec.encode({ kind: 'os', os: 'windows', focus: { role: 'browser', location } });
    expect(at({ kind: 'root' })).toBe('/windows/edge');
    expect(at({ kind: 'content', ref: { section: 'about' } })).toBe('/windows/edge');
    expect(at({ kind: 'content', ref: { section: 'resume' } })).toBe('/windows/edge/resume');
    const long = fixtureCodec.decode('/windows/edge/about');
    expect(long.ok && long.canonical).toBe('/windows/edge');
    expect(refForLocation('windows', 'browser', { kind: 'root' }, OS_REGISTRY)).toEqual({ section: 'about' });
    expect(
      titleFor(
        { kind: 'os', os: 'windows', focus: { role: 'browser', location: { kind: 'root' } } },
        { catalog: fixtureCatalog },
      ),
    ).toMatch(/^About · Microsoft Edge · Windows 11/);
  });

  it('opening About opens Edge at its root; its About tab counts for continuity', () => {
    const state = last(
      run(booted('/windows'), [
        { type: 'OPEN_APP', os: 'windows', role: 'browser', location: { kind: 'content', ref: { section: 'about' } } },
      ]),
    ).state;
    expect(win(state, 'browser').nav.entries[0]).toEqual({ kind: 'root' });
    expect(state.continuity?.ref).toEqual({ section: 'about' });
  });
});
