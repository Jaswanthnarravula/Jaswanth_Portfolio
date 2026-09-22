/**
 * macOS window manager at the kernel (plans/macos/02-window-manager.md):
 *   MAC-WM-01 (placement from the storyboard's fractions, 24 px cascade, learned rects on reopen) ·
 *   MAC-WM-08 (Dock click decision table) · MAC-WM-11 (history rule per window event) ·
 *   workspace insets: windows live between the menu bar and the Dock (macos/04 "Safe areas and viewport").
 */
import { describe, expect, it } from 'vitest';
import { reduce } from '@/lib/kernel/reducers';
import { MACOS_CHROME, macosInsets, workspaceInsets } from '@/lib/kernel/registry';
import { viewportFor } from '@/lib/kernel/geometry';
import { TITLE_REACH } from '@/lib/kernel/geometry';
import type { KernelAction } from '@/lib/kernel/actions';
import type { AppRole } from '@/lib/kernel/ids';
import type { KernelState, WindowId } from '@/lib/kernel/types';
import { booted, last, makeDeps, run } from '../../fixtures/portfolio';

const deps = makeDeps();
const id = (role: AppRole) => `macos:${role}` as WindowId;
const open = (role: AppRole): KernelAction => ({ type: 'OPEN_APP', role });
const settle = (role: AppRole): KernelAction => ({ type: 'PHASE_DONE', target: { kind: 'window', id: id(role) } });
const rectOf = (state: KernelState, role: AppRole) => state.sessions.macos.windows[id(role)]?.rect.expanded;

describe('macOS workspace insets', () => {
  it('reserve the menu bar (24 px pointer / 28 px touch) and the Dock (icon + padding + margin)', () => {
    expect(macosInsets(viewportFor(1440, 900, 'fine'))).toEqual({ top: 24, right: 0, bottom: 68, left: 0 });
    expect(macosInsets(viewportFor(1920, 1200, 'fine')).bottom).toBe(
      MACOS_CHROME.dockIcon.large + MACOS_CHROME.dockPadding * 2 + MACOS_CHROME.dockMargin,
    );
    expect(macosInsets(viewportFor(1024, 768, 'coarse')).top).toBe(28);
    expect(macosInsets(viewportFor(390, 844, 'coarse')).top).toBe(28);
    // OSes without floating windows have none.
    expect(workspaceInsets('ios', viewportFor(390, 844, 'coarse'))).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('a committed rect can never put the title bar under the menu bar, nor below the Dock line', () => {
    const state = last(run(booted('/macos'), [open('files'), settle('files')])).state;
    const up = reduce(state, { type: 'COMMIT_RECT', id: id('files'), rect: { x: 50, y: -400, w: 800, h: 500 } }, deps);
    expect(rectOf(up.state, 'files')?.y).toBe(24);
    const down = reduce(
      state,
      { type: 'COMMIT_RECT', id: id('files'), rect: { x: 50, y: 5000, w: 800, h: 500 } },
      deps,
    );
    expect(rectOf(down.state, 'files')?.y).toBe(900 - 68 - TITLE_REACH);
  });
});

describe('MAC-WM-01 open placement, cascade and learned rects', () => {
  it('Finder and GitHub open exactly where the storyboard frame places them (fractions of 1440 × 900)', () => {
    const state = last(run(booted('/macos'), [open('github'), settle('github'), open('files'), settle('files')])).state;
    expect(rectOf(state, 'github')).toEqual({ x: 432, y: 117, w: 720, h: 468 });
    expect(rectOf(state, 'files')).toEqual({ x: 101, y: 216, w: 893, h: 486 });
    expect(state.sessions.macos.zOrder).toEqual([id('github'), id('files')]); // GitHub behind, Finder front
  });

  it('the second window sharing a default position opens 24 px down-right of the first', () => {
    const state = last(run(booted('/macos'), [open('browser'), settle('browser'), open('mail'), settle('mail')])).state;
    const safari = rectOf(state, 'browser')!;
    const mail = rectOf(state, 'mail')!;
    expect({ dx: mail.x - safari.x, dy: mail.y - safari.y }).toEqual({ dx: 24, dy: 24 });
    const third = last(run(state, [open('editor'), settle('editor')])).state;
    expect(rectOf(third, 'editor')).toMatchObject({ x: safari.x + 48, y: safari.y + 48 });
  });

  it('reopening a closed window restores the rect the visitor left it at', () => {
    const moved = last(
      run(booted('/macos'), [
        open('browser'),
        settle('browser'),
        { type: 'COMMIT_RECT', id: id('browser'), rect: { x: 300, y: 200, w: 700, h: 480 } },
        { type: 'CLOSE_WINDOW', id: id('browser') },
        settle('browser'),
      ]),
    ).state;
    expect(moved.sessions.macos.windows[id('browser')]).toBeUndefined();
    const reopened = last(run(moved, [open('browser')])).state;
    expect(rectOf(reopened, 'browser')).toEqual({ x: 300, y: 200, w: 700, h: 480 });
  });
});

describe('MAC-WM-08 Dock click decision table (OPEN_APP from a Dock icon)', () => {
  const base = () =>
    last(run(booted('/macos'), [open('files'), settle('files'), open('github'), settle('github')])).state;

  it('no window → open (animated from the icon)', () => {
    const result = reduce(base(), { ...open('browser'), originId: 'dock-safari' } as KernelAction, deps);
    expect(result.state.sessions.macos.windows[id('browser')]?.phase).toEqual({
      s: 'opening',
      originId: 'dock-safari',
    });
    expect(result.routeIntent).toBe('go');
  });

  it('minimized → restore and focus', () => {
    const minimized = reduce(base(), { type: 'MINIMIZE', id: id('github') }, deps).state;
    const result = reduce(minimized, open('github'), deps);
    expect(result.state.sessions.macos.windows[id('github')]?.phase.s).toBe('normal');
    expect(result.state.sessions.macos.focused).toBe(id('github'));
    expect(result.focusTarget?.candidates[0]).toBe('window:macos:github');
  });

  it('behind → raise and focus', () => {
    const result = reduce(base(), open('files'), deps);
    expect(result.state.sessions.macos.zOrder.at(-1)).toBe(id('files'));
    expect(result.state.sessions.macos.focused).toBe(id('files'));
  });

  it('already focused → no-op (identical state; not a minimize, which is Windows behaviour)', () => {
    const state = base();
    const result = reduce(state, open('github'), deps);
    expect(result.state).toBe(state);
    expect(result.routeIntent).toBeNull();
  });
});

describe('MAC-WM-11 history rule per window event (shared/05 event → history table)', () => {
  const base = () =>
    last(run(booted('/macos'), [open('files'), settle('files'), open('github'), settle('github')])).state;
  const intent = (action: KernelAction, state = base()) => reduce(state, action, deps).routeIntent;

  it('open, focus, close, minimize and in-app navigation go(); zoom and move write nothing', () => {
    expect(intent(open('browser'))).toBe('go');
    expect(intent({ type: 'FOCUS_WINDOW', id: id('files') })).toBe('go');
    expect(intent({ type: 'CLOSE_WINDOW', id: id('github') })).toBe('go');
    expect(intent({ type: 'MINIMIZE', id: id('github') })).toBe('go');
    expect(intent({ type: 'TOGGLE_MAXIMIZE', id: id('github') })).toBeNull();
    expect(intent({ type: 'COMMIT_RECT', id: id('github'), rect: { x: 40, y: 60, w: 600, h: 400 } })).toBeNull();
    expect(
      intent({
        type: 'NAVIGATE_IN_APP',
        id: id('files'),
        location: { kind: 'content', ref: { section: 'experience' } },
      }),
    ).toBe('go');
  });

  it('close and minimize hand the URL to the next focused window, else to the OS home', () => {
    const closed = reduce(base(), { type: 'CLOSE_WINDOW', id: id('github') }, deps).state;
    expect(closed.route).toMatchObject({ kind: 'os', os: 'macos', focus: { role: 'files' } });
    const onlyOne = last(run(booted('/macos'), [open('files'), settle('files')])).state;
    const minimized = reduce(onlyOne, { type: 'MINIMIZE', id: id('files') }, deps).state;
    expect(minimized.route).toEqual({ kind: 'os', os: 'macos', focus: null });
  });
});
