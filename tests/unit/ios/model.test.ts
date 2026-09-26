/**
 * iOS model (plans/ios/): IOS-HOME-01/06/07 configured grid + deterministic packing + page memory by icon ·
 * IOS-HOME-03 badges in names · IOS-DOCK-04 recents · IOS-FOLD-01 data-driven shortcuts · IOS-QA-01 data-driven
 * quick actions + clamped placement · IOS-LOCK-01/05 notifications from data, identical for every profile ·
 * IOS-NOTIF-01/02/04 trigger table + queue + Center · IOS-MOTION-02 projection decisions · IOS-CASE-02 arbiter table ·
 * IOS-FLIGHT-05 warm LRU(3) · IOS-STAT-01 the full-page date line.
 */
import { describe, expect, it } from 'vitest';
import {
  arbitrateIos,
  backStep,
  badgeFor,
  bannerFor,
  bannerMayShow,
  careerShortcuts,
  commits,
  DOCK,
  dockLocation,
  dockRecents,
  folderName,
  HOME_APPS,
  homeLayout,
  homeOutcome,
  releaseKinematics,
  iconName,
  iconSize,
  layoutFor,
  lockNotifications,
  mountedApps,
  pack,
  pageOf,
  project,
  pullRequest,
  pullTarget,
  quickActionsFor,
  statusDate,
  statusTime,
  widgetActions,
  type HomeItem,
} from '@/components/os/ios/model';
import { bannerReducer, INITIAL_BANNERS } from '@/components/os/ios/surfaces/Notifications';
import { menuPlacement } from '@/components/os/ios/surfaces/QuickActions';
import { getExperience, getFeaturedProjects } from '@/data/selectors';
import { viewportFor } from '@/lib/kernel/geometry';
import { PERSONA_IDS } from '@/lib/kernel/ids';
import type { WindowId } from '@/lib/kernel/types';

const ids = (layout: ReturnType<typeof homeLayout>, page: number) => layout.pages[page]!.items.map((p) => p.item.id);

describe('IOS-HOME-01 configured grid (apps, folder, widget) — order from the owner frame', () => {
  it('page 1 holds the Résumé widget then Safari · GitHub · Notes · Messages · Settings · Career (phone)', () => {
    const layout = homeLayout(viewportFor(390, 844, 'coarse'), { hasProject: true });
    expect(layout.layout).toBe('phone');
    expect(ids(layout, 0)).toEqual([
      'widget:resume',
      'app:browser',
      'app:github',
      'app:notes',
      'app:messages',
      'app:settings',
      'folder:career',
    ]);
    expect(ids(layout, 1)).toEqual([
      'widget:open-to-work',
      'widget:projects',
      'shortcut:about',
      'shortcut:projects',
      'shortcut:contact',
    ]);
  });
  it('the Résumé widget spans 4 × 2 cells on the phone, the small widgets 2 × 2', () => {
    const layout = homeLayout(viewportFor(390, 844, 'coarse'), { hasProject: true });
    expect(layout.pages[0]!.items[0]).toMatchObject({ col: 0, row: 0, w: 4, h: 2 });
    expect(layout.pages[0]!.items[1]).toMatchObject({ col: 0, row: 2, w: 1, h: 1 });
    expect(layout.pages[1]!.items[1]).toMatchObject({ w: 2, h: 2 });
  });
  it('no featured project → the Projects widget is omitted and its cells return to icons', () => {
    const layout = homeLayout(viewportFor(390, 844, 'coarse'), { hasProject: false });
    expect(ids(layout, 1)).not.toContain('widget:projects');
    expect(ids(layout, 1)[1]).toBe('shortcut:about');
  });
});

describe('IOS-WIDG-05 the Now widget on page 2', () => {
  it('sits after Open to work, 2 × 2, with no overlap, in portrait and landscape', () => {
    for (const viewport of [viewportFor(390, 844, 'coarse'), viewportFor(844, 390, 'coarse')]) {
      const layout = homeLayout(viewport, { hasProject: true, hasNow: true });
      expect(ids(layout, 1).slice(0, 3)).toEqual(['widget:open-to-work', 'widget:now', 'widget:projects']);
      const cells = new Set<string>();
      for (const placed of layout.pages[1]!.items)
        for (let c = placed.col; c < placed.col + placed.w; c++)
          for (let r = placed.row; r < placed.row + placed.h; r++) {
            expect(cells.has(`${c},${r}`)).toBe(false);
            cells.add(`${c},${r}`);
          }
      expect(layout.pages[1]!.items.find((placed) => placed.item.id === 'widget:now')).toMatchObject({ w: 2, h: 2 });
    }
  });
  it('no Now note → no Now widget', () => {
    expect(ids(homeLayout(viewportFor(390, 844, 'coarse'), { hasProject: true }), 1)).not.toContain('widget:now');
  });
});

describe('IOS-HOME-06 layouts: phone portrait 4 × 6, landscape 6 × 3 (Dock trailing), full page 6/7/8 columns', () => {
  it('phone portrait / landscape', () => {
    const portrait = homeLayout(viewportFor(390, 844, 'coarse'), { hasProject: true });
    expect(portrait).toMatchObject({ columns: 4, rows: 6, icon: 60, dock: 'bottom' });
    const landscape = homeLayout(viewportFor(844, 390, 'coarse'), { hasProject: true });
    expect(landscape).toMatchObject({ layout: 'phone', columns: 6, rows: 3, dock: 'trailing' });
    expect(landscape.pages[0]!.items[0]).toMatchObject({ w: 3, h: 2 });
  });
  it('full page: never the phone grid stretched — columns by size class minus the two widget columns', () => {
    expect(layoutFor('compact')).toBe('phone');
    for (const [w, h, total] of [
      [1024, 768, 6],
      [1440, 900, 7],
      [1920, 1080, 8],
    ] as const) {
      const layout = homeLayout(viewportFor(w, h, 'fine'), { hasProject: true });
      expect(layout.layout).toBe('pad');
      expect(layout.columns).toBe(total - 2);
      expect(layout.pages[0]!.widgetsBlock).toBe(true);
      expect(ids(layout, 0)).toEqual(HOME_APPS.map((item) => item.id));
    }
  });
  it('icon size follows the viewport: clamp(64px, 8.4vh, 96px); 60 pt on phones', () => {
    expect(iconSize(viewportFor(1440, 900, 'fine'))).toBe(76);
    expect(iconSize(viewportFor(1920, 1200, 'fine'))).toBe(96);
    expect(iconSize(viewportFor(1100, 600, 'fine'))).toBe(64);
    expect(iconSize(viewportFor(390, 844, 'coarse'))).toBe(60);
  });
  it('rows fit the height: 4–5 on the full page', () => {
    expect(homeLayout(viewportFor(1440, 900, 'fine'), { hasProject: true }).rows).toBeGreaterThanOrEqual(4);
    expect(homeLayout(viewportFor(1440, 900, 'fine'), { hasProject: true }).rows).toBeLessThanOrEqual(5);
    expect(homeLayout(viewportFor(1366, 650, 'fine'), { hasProject: true }).rows).toBe(4);
  });
});

describe('IOS-HOME-07 deterministic reflow + page memory by icon', () => {
  it('the same viewport always packs identically', () => {
    const a = homeLayout(viewportFor(1366, 650, 'fine'), { hasProject: true });
    const b = homeLayout(viewportFor(1366, 650, 'fine'), { hasProject: true });
    expect(a).toEqual(b);
  });
  it('overflow flows onto the next page deterministically, never dropped', () => {
    const many: HomeItem[] = Array.from({ length: 30 }, () => HOME_APPS[0]!);
    const pages = pack([many], 4, 5, false);
    expect(pages.length).toBe(2);
    expect(pages[0]!.items.length).toBe(20);
    expect(pages[1]!.items.length).toBe(10);
  });
  it('pageOf finds an item by icon (not by page number) after any reflow', () => {
    for (const [w, h, pointer] of [
      [390, 844, 'coarse'],
      [844, 390, 'coarse'],
      [1440, 900, 'fine'],
    ] as const) {
      const layout = homeLayout(viewportFor(w, h, pointer), { hasProject: true });
      expect(pageOf(layout, 'app:github')).toBe(0);
      expect(pageOf(layout, 'shortcut:contact')).toBe(1);
    }
  });
});

describe('IOS-HOME-03 badges are data and part of the accessible name', () => {
  it('Mail "1" until read this session; GitHub = featured projects', () => {
    const featured = getFeaturedProjects().length;
    expect(badgeFor('mail', { mailRead: false, featured })).toBe(1);
    expect(badgeFor('mail', { mailRead: true, featured })).toBe(0);
    expect(badgeFor('github', { mailRead: false, featured })).toBe(featured);
    expect(iconName('Mail', 'mail', 1)).toBe('Mail, 1 unread');
    expect(iconName('Safari', 'browser', 0)).toBe('Safari');
  });
});

describe('IOS-DOCK-01/02/04 the Dock', () => {
  it('four fixed apps; Files opens straight to the résumé', () => {
    expect(DOCK).toEqual(['files', 'browser', 'github', 'mail']);
    expect(dockLocation('files')).toEqual({ kind: 'content', ref: { section: 'resume' } });
    expect(dockLocation('browser')).toBeUndefined();
  });
  it('recents: up to three warm apps that are not pinned', () => {
    expect(dockRecents(['notes', 'github', 'messages', 'settings', 'mail'])).toEqual(['notes', 'messages', 'settings']);
    expect(dockRecents([])).toEqual([]);
  });
});

describe('IOS-FOLD-01 the Career folder derives from data', () => {
  it('Experience · Education · Résumé + one per current role (max 2)', () => {
    const roles = getExperience().filter((role) => role.end === 'present');
    const shortcuts = careerShortcuts(roles);
    expect(shortcuts.slice(0, 3).map((item) => item.label)).toEqual(['Experience', 'Education', 'Résumé']);
    expect(shortcuts.length).toBe(3 + Math.min(2, roles.length));
    for (const [index, role] of roles.slice(0, 2).entries())
      expect(shortcuts[3 + index]).toMatchObject({
        label: role.company,
        ref: { section: 'experience', slug: role.slug },
      });
    expect(folderName(shortcuts)).toBe(`Career folder, ${shortcuts.length} shortcuts`);
  });
});

describe('IOS-QA-01 quick actions derive from data; menus are clamped', () => {
  it('GitHub lists up to four featured projects + All Projects; Files hides Download without a PDF', () => {
    const featured = [
      { slug: 'a', name: 'A' },
      { slug: 'b', name: 'B' },
      { slug: 'c', name: 'C' },
      { slug: 'd', name: 'D' },
      { slug: 'e', name: 'E' },
    ];
    const github = quickActionsFor('github', { featured, pinnedNotes: [], hasPdf: true });
    expect(github.map((action) => action.label)).toEqual(['A', 'B', 'C', 'D', 'All Projects']);
    expect(quickActionsFor('files', { featured, pinnedNotes: [], hasPdf: false }).map((a) => a.id)).toEqual([
      'open-resume',
      'experience',
      'education',
    ]);
    expect(quickActionsFor('mail', { featured, pinnedNotes: [], hasPdf: true }).map((a) => a.label)).toEqual([
      'New Message',
      'Copy Address',
    ]);
    expect(widgetActions({ section: 'resume' }, { kind: 'plain' }, true).map((a) => a.label)).toEqual([
      'Open',
      'Download PDF',
      'Copy link',
    ]);
  });
  it('below the icon when it fits, else above; aligned to the nearest edge; never outside the safe area', () => {
    const viewport = { w: 390, h: 844 };
    const top = menuPlacement({ x: 20, y: 100, w: 60, h: 60 }, { w: 250, h: 200 }, viewport);
    expect(top).toMatchObject({ placement: 'below', x: 20, y: 170 });
    const bottom = menuPlacement({ x: 300, y: 740, w: 60, h: 60 }, { w: 250, h: 200 }, viewport);
    expect(bottom.placement).toBe('above');
    expect(bottom.x + 250).toBeLessThanOrEqual(390 - 12);
    const huge = menuPlacement({ x: 0, y: 400, w: 10, h: 10 }, { w: 900, h: 2000 }, viewport);
    expect(huge.x).toBe(12);
    expect(huge.y).toBe(48);
  });
});

describe('IOS-LOCK-01/05 lock notifications from data, identical for every profile', () => {
  const data = {
    updatedLabel: 'September 21, 2026',
    projects: 7,
    featuredName: 'X',
    openTo: 'Open.',
    continuity: null,
  };
  it('Files · GitHub · Mail; a continuity offer replaces #3', () => {
    expect(lockNotifications(data).map((item) => item.id)).toEqual(['resume', 'github', 'mail']);
    const offered = lockNotifications({
      ...data,
      continuity: { title: 'T', from: 'macOS', role: 'github', ref: { section: 'projects' } },
    });
    expect(offered.map((item) => item.id)).toEqual(['resume', 'github', 'continuity']);
    expect(offered[2]).toMatchObject({ title: 'T', body: 'From macOS' });
  });
  it('content is independent of PersonaId (the function takes no persona at all)', () => {
    const outputs = PERSONA_IDS.map(() => JSON.stringify(lockNotifications(data)));
    expect(new Set(outputs).size).toBe(1);
    expect(lockNotifications.length).toBe(1);
  });
});

describe('IOS-NOTIF-01/02/04 banners: trigger table, queue ≤ 3, dwell, Center keeps everything', () => {
  it('maps every trigger to its copy', () => {
    expect(bannerFor({ kind: 'welcome' }).title).toMatch(/tap any app/);
    expect(bannerFor({ kind: 'tour-offer' }).title).toMatch(/20-second tour/);
    expect(bannerFor({ kind: 'handoff', title: 'Enterprise SSO', from: 'macOS', role: 'github' })).toMatchObject({
      title: 'Handoff · Enterprise SSO',
      body: 'From macOS',
    });
    expect(bannerFor({ kind: 'resume-saved' }).title).toBe('Résumé.pdf saved');
    expect(bannerFor({ kind: 'copied' }).title).toBe('Copied');
    expect(bannerFor({ kind: 'offline' }).title).toMatch(/content still works/);
  });
  it('one at a time, queued while a flight runs, expired ones dropped; every ended banner lands in the Center', () => {
    const a = { id: 'a', role: null, app: 'X', title: 'A' } as const;
    const b = { id: 'b', role: null, app: 'X', title: 'B' } as const;
    const c = { id: 'c', role: null, app: 'Y', title: 'C', expires: 10 } as const;
    let state = bannerReducer(INITIAL_BANNERS, { type: 'push', banner: a, canShow: false, now: 0 });
    expect(state.shown).toBeNull();
    state = bannerReducer(state, { type: 'push', banner: b, canShow: false, now: 0 });
    state = bannerReducer(state, { type: 'push', banner: c, canShow: false, now: 0 });
    state = bannerReducer(state, { type: 'flush', canShow: true, now: 20 });
    expect(state.shown?.id).toBe('a');
    state = bannerReducer(state, { type: 'done', id: 'a', canShow: true, now: 30 });
    expect(state.shown?.id).toBe('b');
    expect(state.center.map((item) => item.id)).toEqual(['a']);
    state = bannerReducer(state, { type: 'done', id: 'b', canShow: true, now: 40 });
    expect(state.shown).toBeNull(); // c expired at 10
    expect(state.center.map((item) => item.id)).toEqual(['b', 'a']);
    state = bannerReducer(state, { type: 'clear', app: 'X' });
    expect(state.center).toEqual([]);
  });
  it('E10: never while a flight runs, locked or with notifications off', () => {
    const base = { flying: false, locked: false, booting: false, notificationsOn: true };
    expect(bannerMayShow(base)).toBe(true);
    expect(bannerMayShow({ ...base, flying: true })).toBe(false);
    expect(bannerMayShow({ ...base, locked: true })).toBe(false);
    expect(bannerMayShow({ ...base, notificationsOn: false })).toBe(false);
  });
});

describe('IOS-MOTION-02 velocity projection decides every gesture', () => {
  it('project(position, v) = position + v × 0.499', () => {
    expect(project(0.1, 1)).toBeCloseTo(0.599);
    expect(project(100, -200)).toBeCloseTo(0.2);
  });
  it('Home gesture: slow short drag cancels, a flick goes Home, a pause goes to the App Switcher', () => {
    expect(homeOutcome({ travel: 0.2, velocity: 0, pausedMs: 0, speedPx: 300 })).toBe('cancel');
    expect(homeOutcome({ travel: 0.2, velocity: 1.2, pausedMs: 0, speedPx: 900 })).toBe('home');
    expect(homeOutcome({ travel: 0.5, velocity: -2, pausedMs: 0, speedPx: 900 })).toBe('cancel'); // dragged back down
    expect(homeOutcome({ travel: 0.3, velocity: 0, pausedMs: 300, speedPx: 10 })).toBe('switcher');
    expect(homeOutcome({ travel: 0.3, velocity: 0, pausedMs: 120, speedPx: 10 })).toBe('cancel');
  });
  it('release kinematics come from pointer timestamps: a starved frame clock never turns a slow drag into a flick', () => {
    // Six fast steps up, a rest, a small step back down, then the release (what a headless WebKit run delivers).
    const up = [0, 1, 2, 3, 4, 5, 6].map((step) => ({ t: 1000 + step, y: 900 - step * 8 }));
    const back = releaseKinematics([...up, { t: 1078, y: 860 }], { t: 1081, y: 860 });
    expect(back.velocity).toBeLessThanOrEqual(0); // the burst was long before the release: no flick
    expect(homeOutcome({ travel: 40 / 558, velocity: back.velocity / 558, pausedMs: back.stillMs, speedPx: 0 })).toBe(
      'cancel',
    );
    expect(back.stillMs).toBe(3);
    // A real flick: 260 px in 45 ms.
    const flick = releaseKinematics(
      [0, 15, 30].map((t, index) => ({ t: 2000 + t, y: 900 - index * 86 })),
      { t: 2045, y: 640 },
    );
    expect(flick.velocity).toBeGreaterThan(5000);
    // A rest of 420 ms before the release: no speed, a pause.
    const rest = releaseKinematics(
      [
        { t: 3000, y: 900 },
        { t: 3040, y: 680 },
      ],
      { t: 3460, y: 680 },
    );
    expect(rest.stillMs).toBe(420);
    expect(Math.abs(rest.velocity)).toBeLessThan(50);
    expect(
      homeOutcome({
        travel: 0.39,
        velocity: rest.velocity / 558,
        pausedMs: rest.stillMs,
        speedPx: Math.abs(rest.velocity),
      }),
    ).toBe('switcher');
    // A release with no other samples has no velocity.
    expect(releaseKinematics([], { t: 1, y: 1 })).toEqual({ velocity: 0, stillMs: 0 });
  });
  it('edge swipe / sheet drag commit past half (projected): slow halfway cancels, a flick commits', () => {
    expect(commits(0.45, 0)).toBe(false);
    expect(commits(0.3, 1)).toBe(true);
    expect(commits(0.6, -0.5)).toBe(false);
  });
  it('pull-down zones split at 60 % of the width', () => {
    expect(pullTarget(100, 390)).toBe('center');
    expect(pullTarget(300, 390)).toBe('control');
  });
});

describe('IOS-CASE-02 overlay arbitration (E9, E14)', () => {
  it('one transient at a time; menus close on any request; the switcher blocks Spotlight', () => {
    expect(arbitrateIos(null, 'control')).toBe('open');
    expect(arbitrateIos('control', 'control')).toBe('keep');
    expect(arbitrateIos('quick-actions', 'spotlight')).toBe('replace');
    expect(arbitrateIos('control', 'center')).toBe('replace');
    expect(arbitrateIos('switcher', 'spotlight')).toBe('drop');
    expect(arbitrateIos('switch-os', 'folder')).toBe('drop');
    expect(arbitrateIos('control', 'banner')).toBe('coexist');
  });
  it('E9: a second pull while the first still animates waits for rest', () => {
    expect(pullRequest({ open: 'control', animating: true }, 'center')).toBe('defer');
    expect(pullRequest({ open: 'control', animating: false }, 'center')).toBe('replace');
  });
  it('E14 / Esc: sheet → overlay → pop → Home; never the OS', () => {
    const base = { sheet: false, overlay: null, canPop: false, appOpen: false } as const;
    expect(backStep({ ...base, sheet: true, overlay: 'control', canPop: true, appOpen: true })).toBe('sheet');
    expect(backStep({ ...base, overlay: 'spotlight', appOpen: true })).toBe('overlay');
    expect(backStep({ ...base, canPop: true, appOpen: true })).toBe('pop');
    expect(backStep({ ...base, appOpen: true })).toBe('home');
    expect(backStep(base)).toBe('none');
  });
});

describe('IOS-FLIGHT-05 warm LRU(3)', () => {
  it('the foreground app + the three most recent others stay mounted', () => {
    const z = ['ios:mail', 'ios:notes', 'ios:files', 'ios:github', 'ios:browser'] as WindowId[];
    expect(mountedApps(z, 'ios:browser')).toEqual(['ios:browser', 'ios:github', 'ios:files', 'ios:notes']);
    expect(mountedApps(z, null)).toEqual(['ios:browser', 'ios:github', 'ios:files']);
  });
});

describe('IOS-STAT-01 status-bar time and date (full page: "9:41  Mon 21 Sep")', () => {
  it('formats the clock without AM/PM and the date in the iPadOS order', () => {
    const date = new Date(2026, 8, 21, 9, 41);
    expect(statusTime(date)).toBe('9:41');
    expect(statusDate(date)).toBe('Mon 21 Sep');
  });
});
