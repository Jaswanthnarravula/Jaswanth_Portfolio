/** KRN-PERSIST-01 — validating parse of persisted sessions: every field is checked; invalid parts are dropped. */
import { describe, expect, it } from 'vitest';
import { parsePersistedSessions } from '@/lib/kernel/persist/sessions';
import { parseLocation, parseRect, parseTerminal, parseWindow } from '@/lib/kernel/persist/validate';
import { createOsLoader } from '@/lib/os-loaders';

const window = (overrides: Record<string, unknown> = {}) => ({
  id: 'macos:files',
  os: 'macos',
  role: 'files',
  phase: { s: 'normal' },
  rect: { expanded: { x: 10, y: 30, w: 600, h: 400 }, compact: { x: 0, y: 0, w: -1, h: 5 } },
  nav: { entries: [{ kind: 'root' }, { kind: 'content', ref: { section: 'experience', slug: 'acme' } }], index: 9 },
  scrollTop: -5,
  draft: 'Hello',
  invoker: 'dock:finder',
  ...overrides,
});

describe('persisted window parsing', () => {
  it('keeps valid fields, clamps and drops the rest', () => {
    const parsed = parseWindow(window());
    expect(parsed).toMatchObject({
      id: 'macos:files',
      phase: { s: 'normal' },
      scrollTop: 0,
      draft: 'Hello',
      invoker: 'dock:finder',
    });
    expect(parsed?.rect).toEqual({ expanded: { x: 10, y: 30, w: 600, h: 400 } });
    expect(parsed?.nav.index).toBe(1);
  });
  it.each([
    [
      { s: 'opening', originId: 'dock' },
      { s: 'opening', originId: 'dock' },
    ],
    [
      { s: 'opening', originId: 3 },
      { s: 'opening', originId: null },
    ],
    [{ s: 'closing' }, { s: 'closing' }],
    [
      { s: 'maximized', restore: { x: 1, y: 2, w: 3, h: 4 } },
      { s: 'maximized', restore: { x: 1, y: 2, w: 3, h: 4 } },
    ],
    [
      { s: 'minimized', restore: { x: 1, y: 2, w: 3, h: 4 }, wasMaximized: true },
      { s: 'minimized', restore: { x: 1, y: 2, w: 3, h: 4 }, wasMaximized: true },
    ],
  ])('phase %j', (phase, expected) => {
    expect(parseWindow(window({ phase }))?.phase).toEqual(expected);
  });
  it.each([
    [{ phase: { s: 'maximized' } }],
    [{ phase: { s: 'flying' } }],
    [{ phase: null }],
    [{ nav: { entries: [] } }],
    [{ nav: null }],
    [{ id: 'macos:browser' }],
    [{ os: 'beos' }],
    [{ role: 'toaster' }],
  ])('rejects %j', (overrides) => {
    expect(parseWindow(window(overrides))).toBeNull();
  });
  it('locations: root, content (with or without slug), vfs; anything else is dropped', () => {
    expect(parseLocation({ kind: 'root' })).toEqual({ kind: 'root' });
    expect(parseLocation({ kind: 'vfs', path: ['projects', 'x'] })).toEqual({ kind: 'vfs', path: ['projects', 'x'] });
    expect(parseLocation({ kind: 'vfs', path: ['a', 3] })).toBeNull();
    expect(parseLocation({ kind: 'content', ref: { section: 'about' } })).toEqual({
      kind: 'content',
      ref: { section: 'about' },
    });
    expect(parseLocation({ kind: 'content', ref: { section: 'projects', slug: 4 } })).toBeNull();
    expect(parseLocation({ kind: 'content', ref: { section: 'hobbies' } })).toBeNull();
    expect(parseLocation('root')).toBeNull();
    expect(parseRect({ x: 1, y: 1, w: 0, h: 1 })).toBeNull();
    expect(parseRect({ x: 1, y: 1, w: Infinity, h: 1 })).toBeNull();
  });
  it('terminal sessions keep strings only and cap their length', () => {
    const terminal = parseTerminal({
      cwd: ['home', 1, 'jaswanth'],
      history: Array.from({ length: 300 }, (_, i) => `c${i}`),
      scrollback: 'nope',
    });
    expect(terminal).toMatchObject({ cwd: ['home', 'jaswanth'], scrollback: [] });
    expect(terminal?.history).toHaveLength(200);
    expect(parseTerminal(null)).toBeNull();
  });
  it('whole payloads: z-order and focus are filtered to known windows; learned rects need valid ids', () => {
    const parsed = parsePersistedSessions({
      v: 1,
      savedAt: 5,
      contentRev: 'r',
      sessions: {
        macos: {
          os: 'macos',
          windows: { 'macos:files': window() },
          zOrder: ['macos:files', 'macos:browser', 'macos:files', 7],
          focused: 'macos:browser',
          terminal: { cwd: ['home'], history: [], scrollback: [], draft: 'keep this' },
          parkedAt: 3,
          contentRev: 'r',
          bootSeen: true,
          lockSeen: 'yes',
        },
        windows: { os: 'ios' },
        ios: 'broken',
      },
      learnedRects: {
        'macos:files': { expanded: { x: 1, y: 2, w: 300, h: 200 } },
        'nope:files': {},
        'macos:toaster': {},
      },
    });
    expect(parsed?.sessions.macos).toMatchObject({
      zOrder: ['macos:files'],
      focused: null,
      parkedAt: 3,
      bootSeen: true,
      lockSeen: false,
      terminal: { draft: 'keep this' },
    });
    expect(parsed?.sessions.windows).toBeUndefined();
    expect(parsed?.sessions.ios).toBeUndefined();
    expect(Object.keys(parsed?.learnedRects ?? {})).toEqual(['macos:files']);
  });
});

describe('OS chunk loader: once per OS, two retries, failures not cached', () => {
  it('retries twice, then rejects, then succeeds on a later call', async () => {
    let calls = 0;
    let fail = true;
    const chunk = { default: () => null };
    const load = createOsLoader(
      {
        macos: () => {
          calls++;
          return fail ? Promise.reject(new Error('chunk')) : Promise.resolve(chunk);
        },
        windows: () => Promise.resolve(chunk),
        ios: () => Promise.resolve(chunk),
        android: () => Promise.resolve(chunk),
        linux: () => Promise.resolve(chunk),
      },
      0,
    );
    await expect(load('macos')).rejects.toThrow('chunk');
    expect(calls).toBe(3);
    fail = false;
    await expect(load('macos')).resolves.toBe(chunk);
    await load('macos');
    expect(calls).toBe(4); // cached after success
    expect(load('windows')).toBe(load('windows'));
  });
});
