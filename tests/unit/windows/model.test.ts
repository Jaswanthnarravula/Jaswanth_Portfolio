/**
 * The Windows view model and motion tokens (pure — no DOM):
 *   WIN-WM-08 taskbar click decision table (open · restore · focus · minimize when active; E1 parity) ·
 *   WIN-TASK-02 pills · WIN-TASK-04 jump lists from data · WIN-START-02 pinned + recommended from the registry and data ·
 *   WIN-LOCK-01 / WIN-LOCK-05 status cards from data, identical for every profile, continuity replacing the third ·
 *   WIN-ID-03 live blur ≤ 3 · WIN-CASE-04 / E20 arbiter (toasts wait behind higher surfaces) · WIN-WM-11 keyboard Snap
 *   (Alt+Shift+Arrow = Win+Arrow) · WIN-NOTIF-01/02/03 the toast machine (one shown, queue ≤ 3, all land in the Center) ·
 *   WIN-MOTION-01 the duration ladder and curves match plans/windows/03.
 */
import { describe, expect, it } from 'vitest';
import { getFeaturedProjects, getPerson, getProjects, getResume } from '@/data/selectors';
import { reduce } from '@/lib/kernel/reducers';
import { PERSONA_IDS, type AppRole } from '@/lib/kernel/ids';
import type { KernelAction } from '@/lib/kernel/actions';
import { emptySession } from '@/lib/kernel/state';
import type { OsSession, WindowId, WindowInstance } from '@/lib/kernel/types';
import {
  allApps,
  edgeTab,
  explorerPlace,
  jumpList,
  keyboardSnap,
  liveAcrylic,
  lockCards,
  pillFor,
  pillSuffix,
  startPinned,
  startRecommended,
  taskbarActions,
  taskbarApps,
  taskbarDecision,
  TASKBAR_ORDER,
  toastMayShow,
  windowLabel,
  windowTitle,
  winBinding,
} from '@/components/os/windows/model';
import { WIN_CURVES, WIN_DURATIONS, WIN_MOTION } from '@/components/os/windows/motion';
import { INITIAL_TOASTS, toastReducer, type ToastState } from '@/components/os/windows/surfaces/Notifications';
import { booted, last, makeDeps, run } from '../../fixtures/portfolio';

const id = (role: AppRole) => `windows:${role}` as WindowId;
const deps = makeDeps();

function session(windows: readonly WindowInstance[], focused: WindowId | null): OsSession {
  return {
    ...emptySession('windows', 'expanded', 'x'),
    windows: Object.fromEntries(windows.map((window) => [window.id, window])),
    zOrder: windows.map((window) => window.id),
    focused,
  };
}
const windowOf = (role: AppRole, phase: WindowInstance['phase']): WindowInstance => ({
  id: id(role),
  os: 'windows',
  role,
  phase,
  rect: {},
  nav: { entries: [{ kind: 'root' }], index: 0 },
  scrollTop: 0,
});

describe('WIN-WM-08 the taskbar click decision table', () => {
  it('not running → open · minimized → restore · behind → focus · active → minimize', () => {
    const files = windowOf('files', { s: 'normal' });
    const github = windowOf('github', { s: 'normal' });
    const s = session([files, github], id('github'));
    expect(taskbarDecision(s, 'mail')).toBe('open');
    expect(taskbarDecision(s, 'files')).toBe('focus');
    expect(taskbarDecision(s, 'github')).toBe('minimize');
    const min = session(
      [{ ...files, phase: { s: 'minimized', restore: { x: 0, y: 0, w: 1, h: 1 }, wasMaximized: false } }],
      null,
    );
    expect(taskbarDecision(min, 'files')).toBe('restore');
    expect(taskbarDecision(session([{ ...files, phase: { s: 'closing' } }], null), 'files')).toBe('open');
  });

  it('a click on an app still opening settles it first, so rapid clicks alternate (E1)', () => {
    const opening = session([windowOf('files', { s: 'opening', originId: null })], id('files'));
    expect(
      taskbarActions(opening, 'files', { originId: 'tb-explorer', invoker: 'x' }).map((action) => action.type),
    ).toEqual(['PHASE_DONE', 'MINIMIZE']);
  });

  it('E1: ten rapid clicks leave one window whose state matches the click parity', () => {
    let state = booted('/windows');
    for (let click = 1; click <= 10; click++) {
      for (const action of taskbarActions(state.sessions.windows, 'files', { originId: 'tb-explorer', invoker: 'x' }))
        state = reduce(state, action, deps).state;
      const window = state.sessions.windows.windows[id('files')]!;
      expect(Object.keys(state.sessions.windows.windows)).toEqual([id('files')]);
      // Odd clicks: open / restore (visible, focused); even clicks: minimize.
      expect(window.phase.s === 'minimized').toBe(click % 2 === 0);
    }
  });
});

describe('WIN-TASK-02 pills and names', () => {
  it('none · running (grey, also minimized) · active (accent) with the spoken suffixes', () => {
    const s = session(
      [
        windowOf('files', { s: 'normal' }),
        windowOf('github', { s: 'minimized', restore: { x: 0, y: 0, w: 1, h: 1 }, wasMaximized: false }),
      ],
      id('files'),
    );
    expect(pillFor(s, 'files')).toBe('active');
    expect(pillFor(s, 'github')).toBe('running');
    expect(pillFor(s, 'mail')).toBe('none');
    expect(pillSuffix('active', false)).toBe(', active, press to minimize');
    expect(pillSuffix('running', true)).toBe(', running, minimized');
    expect(pillSuffix('none', false)).toBe('');
  });
  it('the taskbar lists the pinned apps in the storyboard order (Settings included)', () => {
    expect(TASKBAR_ORDER).toEqual(['files', 'browser', 'github', 'mail', 'editor', 'terminal', 'settings']);
    expect(taskbarApps(emptySession('windows', 'expanded', 'x'))).toEqual(TASKBAR_ORDER);
  });
});

describe('WIN-TASK-04 jump lists come from data', () => {
  it('GitHub lists the featured projects; Explorer lists Experience and Education; Edge its two tabs', () => {
    expect(jumpList('github').items.map((item) => item.label)).toEqual(
      getFeaturedProjects().map((project) => project.name),
    );
    expect(jumpList('files').items.map((item) => item.label)).toEqual(['Experience', 'Education']);
    expect(jumpList('browser').items.map((item) => item.label)).toEqual([
      `About ${getPerson().givenName}`,
      'Résumé.pdf',
    ]);
  });
});

describe('WIN-START-02 Start from the registry and data', () => {
  it('Pinned: every Windows app, then Résumé, Projects, Experience, Contact', () => {
    const pinned = startPinned();
    expect(pinned.slice(0, 7).map((tile) => tile.role)).toEqual([
      'files',
      'browser',
      'github',
      'mail',
      'editor',
      'terminal',
      'settings',
    ]);
    expect(pinned.slice(7).map((tile) => tile.label)).toEqual(['Résumé', 'Projects', 'Experience', 'Contact']);
  });
  it('Recommended: Résumé.pdf first (updated date), the featured projects, the current role, Say hello — ≤ 6', () => {
    const recommended = startRecommended();
    expect(recommended[0]).toMatchObject({ title: 'Résumé.pdf', kind: 'pdf' });
    expect(recommended[0]!.detail).toContain(getResume().updated.slice(0, 4));
    expect(recommended.filter((item) => item.kind === 'project').map((item) => item.title)).toEqual(
      getFeaturedProjects()
        .slice(0, 3)
        .map((project) => project.name),
    );
    expect(recommended.at(-1)).toMatchObject({ title: 'Say hello', kind: 'mail' });
    expect(recommended.length).toBeLessThanOrEqual(6);
  });
  it('All apps are alphabetical, grouped by letter', () => {
    const letters = allApps().map((group) => group.letter);
    expect(letters).toEqual([...letters].sort());
    expect(allApps().flatMap((group) => group.apps)).toHaveLength(7);
  });
});

describe('WIN-LOCK-01 · WIN-LOCK-05 lock-screen cards from data, the same for every visitor', () => {
  it('Résumé ready · the project count with the featured project · open to — and continuity replaces the third', () => {
    const cards = lockCards(null);
    expect(cards.map((card) => card.id)).toEqual(['resume', 'projects', 'contact']);
    expect(cards[1]!.title).toBe(`${getProjects().length} projects`);
    expect(cards[2]!.title).toBe(getPerson().openTo);
    const offer = lockCards({ ref: { section: 'projects' }, title: 'Projects', from: 'macOS' });
    expect(offer[2]).toMatchObject({ id: 'continuity', title: 'Continue from macOS', app: 'github' });
  });
  it('no input is a persona: the cards are one pure function of the data', () => {
    const first = JSON.stringify(lockCards(null));
    for (const _persona of PERSONA_IDS) expect(JSON.stringify(lockCards(null))).toBe(first);
  });
});

describe('WIN-ID-03 live blur budget ≤ 3 and the E20 arbiter', () => {
  it('the taskbar always, then transient surfaces in arbiter order', () => {
    const all = liveAcrylic({ menu: true, panel: 'start', toast: true, terminal: true, lock: false });
    expect([...all]).toEqual(['taskbar', 'menu', 'panel']);
    expect(all.size).toBeLessThanOrEqual(3);
    expect([...liveAcrylic({ menu: false, panel: null, toast: false, terminal: true, lock: false })]).toEqual([
      'taskbar',
      'terminal',
    ]);
    expect([...liveAcrylic({ menu: false, panel: null, toast: false, terminal: false, lock: true })]).toEqual(['lock']);
  });
  it('a toast pops up only when no dialog, menu, launcher, Task View or drag is up', () => {
    const idle = { panel: null, menu: false, dialog: false, dragging: false } as const;
    expect(toastMayShow(idle)).toBe(true);
    expect(toastMayShow({ ...idle, panel: 'start' })).toBe(false);
    expect(toastMayShow({ ...idle, panel: 'taskview' })).toBe(false);
    expect(toastMayShow({ ...idle, menu: true })).toBe(false);
    expect(toastMayShow({ ...idle, dragging: true })).toBe(false);
    expect(toastMayShow({ ...idle, panel: 'quick' })).toBe(true);
  });
});

describe('WIN-WM-11 keyboard Snap mirrors Win+Arrow', () => {
  const at = (zone: WindowInstance['snap'], phase: WindowInstance['phase'] = { s: 'normal' }) => ({
    ...windowOf('files', phase),
    ...(zone ? { snap: zone } : {}),
  });
  const kinds = (actions: readonly KernelAction[]) =>
    actions.map((action) => (action.type === 'SNAP_WINDOW' ? `snap:${action.zone ?? 'none'}` : action.type));
  it('Left/Right snap halves; the opposite half restores; quarters move sideways', () => {
    expect(kinds(keyboardSnap(at(undefined), 'left'))).toEqual(['snap:left']);
    expect(kinds(keyboardSnap(at({ zone: 'right' }), 'left'))).toEqual(['snap:none']);
    expect(kinds(keyboardSnap(at({ zone: 'tr' }), 'left'))).toEqual(['snap:tl']);
    expect(kinds(keyboardSnap(at({ zone: 'left' }), 'left'))).toEqual([]);
    expect(
      kinds(keyboardSnap(at(undefined, { s: 'maximized', restore: { x: 0, y: 0, w: 9, h: 9 } }), 'right')),
    ).toEqual(['snap:right']);
  });
  it('Up: half → top quarter, float → maximize; Down: maximize → restore, half → bottom quarter, float → minimize', () => {
    expect(kinds(keyboardSnap(at({ zone: 'left' }), 'up'))).toEqual(['snap:tl']);
    expect(kinds(keyboardSnap(at(undefined), 'up'))).toEqual(['TOGGLE_MAXIMIZE']);
    expect(kinds(keyboardSnap(at(undefined, { s: 'maximized', restore: { x: 0, y: 0, w: 9, h: 9 } }), 'down'))).toEqual(
      ['TOGGLE_MAXIMIZE'],
    );
    expect(kinds(keyboardSnap(at({ zone: 'right' }), 'down'))).toEqual(['snap:br']);
    expect(kinds(keyboardSnap(at({ zone: 'tl' }), 'down'))).toEqual(['snap:left']);
    expect(kinds(keyboardSnap(at(undefined), 'down'))).toEqual(['MINIMIZE']);
  });
  it('the actions are valid for the kernel (a snapped-left window really moves to its quarter)', () => {
    let state = last(
      run(booted('/windows'), [
        { type: 'OPEN_APP', os: 'windows', role: 'files' },
        { type: 'PHASE_DONE', target: { kind: 'window', id: id('files') } },
      ]),
    ).state;
    for (const direction of ['left', 'up'] as const)
      for (const action of keyboardSnap(state.sessions.windows.windows[id('files')]!, direction))
        state = reduce(state, action, deps).state;
    expect(state.sessions.windows.windows[id('files')]!.snap?.zone).toBe('tl');
  });
});

describe('Windows titles and places', () => {
  it('Explorer names its folder, Edge its tab; labels prefix the app', () => {
    const explorer = {
      ...windowOf('files', { s: 'normal' }),
      nav: { entries: [{ kind: 'content' as const, ref: { section: 'experience' as const } }], index: 0 },
    };
    expect(windowTitle(explorer)).toEqual({
      visible: 'Experience',
      spoken: 'File Explorer — Experience',
      app: 'File Explorer',
    });
    expect(explorerPlace({ kind: 'root' })).toEqual({ folder: 'home', slug: null });
    const edge = {
      ...windowOf('browser', { s: 'normal' }),
      nav: { entries: [{ kind: 'content' as const, ref: { section: 'resume' as const } }], index: 0 },
    };
    expect(edgeTab(edge.nav.entries[0]!)).toBe('resume');
    expect(windowLabel(edge)).toBe('Microsoft Edge — Résumé.pdf');
    expect(windowLabel(windowOf('github', { s: 'normal' }))).toBe('GitHub — Projects');
    expect(winBinding('terminal').title).toBe('Terminal');
  });
});

describe('WIN-NOTIF-01 · WIN-NOTIF-02 · WIN-NOTIF-03 the toast machine', () => {
  const toast = (id: string) => ({ id, app: 'system' as const, appName: 'Windows', title: id });
  const push = (state: ToastState, id: string, canShow = true) =>
    toastReducer(state, { type: 'push', toast: toast(id), canShow, now: 1 });
  it('one shown at a time; the rest queue (≤ 3, overflow straight to the Center); done → next, into the Center', () => {
    let state = push(INITIAL_TOASTS, 'a');
    state = push(push(push(push(state, 'b'), 'c'), 'd'), 'e');
    expect(state.shown?.id).toBe('a');
    expect(state.queue.map((item) => item.id)).toEqual(['b', 'c', 'd']);
    expect(state.center.map((item) => item.id)).toEqual(['e']);
    state = toastReducer(state, { type: 'done', id: 'a', canShow: true, now: 2 });
    expect(state.shown?.id).toBe('b');
    expect(state.center.map((item) => item.id)).toEqual(['a', 'e']);
  });
  it('the same trigger never stacks twice; blocked toasts wait until flushed', () => {
    let state = push(INITIAL_TOASTS, 'welcome', false);
    state = push(state, 'welcome', false);
    expect(state.queue).toHaveLength(1);
    expect(state.shown).toBeNull();
    state = toastReducer(state, { type: 'flush', canShow: true });
    expect(state.shown?.id).toBe('welcome');
  });
  it('with the Center open a toast goes straight into its list; expired offers leave the Center', () => {
    let state = toastReducer(INITIAL_TOASTS, {
      type: 'center',
      toast: { ...toast('continuity'), expires: 100 },
      now: 1,
    });
    expect(state.shown).toBeNull();
    expect(state.center.map((item) => item.id)).toEqual(['continuity']);
    state = toastReducer(state, { type: 'expire', now: 200 });
    expect(state.center).toEqual([]);
  });
});

describe('WIN-MOTION-01 the Windows motion tokens match plans/windows/03', () => {
  it('ladder 83/167/250/333/500 ms and the three curves (+ minimize)', () => {
    expect(WIN_DURATIONS).toEqual([83, 167, 250, 333, 500]);
    expect(WIN_CURVES.entrance).toEqual([0, 0, 0, 1]);
    expect(WIN_CURVES.exit).toEqual([1, 0, 1, 1]);
    expect(WIN_CURVES.pointToPoint).toEqual([0.55, 0.55, 0, 1]);
    expect(WIN_CURVES.windowManager).toEqual([0.1, 0.9, 0.2, 1]);
    expect(WIN_CURVES.minimize).toEqual([0.8, 0, 0.78, 1]);
  });
  it('the timing table: open 250 from 0.9, close 167 to 0.95, maximize 250 / restore 200, flyouts 167/83, toasts 333/167', () => {
    expect(WIN_MOTION.open).toMatchObject({ ms: 250, curve: 'entrance', fromScale: 0.9 });
    expect(WIN_MOTION.close).toMatchObject({ ms: 167, curve: 'exit', toScale: 0.95 });
    expect(WIN_MOTION.minimize.ms).toBe(250);
    expect(WIN_MOTION.maximize.ms).toBe(250);
    expect(WIN_MOTION.unmaximize.ms).toBe(200);
    expect(WIN_MOTION.snapPreview).toMatchObject({ ms: 167, fromScale: 0.98 });
    expect(WIN_MOTION.snapCommit.ms).toBe(250);
    expect(WIN_MOTION.launcherOpen).toMatchObject({ ms: 250, rise: 56 });
    expect(WIN_MOTION.launcherClose.ms).toBe(167);
    expect([WIN_MOTION.flyoutIn.ms, WIN_MOTION.flyoutOut.ms]).toEqual([167, 83]);
    expect([WIN_MOTION.toastIn.ms, WIN_MOTION.toastOut.ms]).toEqual([333, 167]);
    expect([WIN_MOTION.taskViewIn.ms, WIN_MOTION.taskViewOut.ms]).toEqual([333, 250]);
    expect(WIN_MOTION.pill).toMatchObject({ ms: 167, curve: 'pointToPoint' });
    expect(WIN_MOTION.press).toEqual({ downMs: 83, upMs: 167, scale: 0.85 });
    expect(WIN_MOTION.drillIn).toMatchObject({ ms: 250, rise: 16 });
    expect(WIN_MOTION.lockSlide.ms).toBe(333);
    expect(WIN_MOTION.exit.windowsMs + WIN_MOTION.exit.taskbarMs).toBeLessThanOrEqual(300);
    // Every duration in the table sits on the ladder (200 ms restore is the plan's own exception).
    const durations = Object.values(WIN_MOTION).flatMap((entry) =>
      Object.entries(entry)
        .filter(([key]) => /ms$/i.test(key))
        .map(([, value]) => value as number),
    );
    for (const ms of durations) expect([...WIN_DURATIONS, 200]).toContain(ms);
  });
});
