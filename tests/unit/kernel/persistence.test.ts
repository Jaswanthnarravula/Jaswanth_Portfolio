import { describe, expect, it } from 'vitest';
import { createSafeStorage, readJson } from '@/lib/kernel/persist/safe-storage';
import { parsePrefs, PREFS_KEY } from '@/lib/kernel/persist/prefs';
import { parsePersistedSessions, SESSIONS_KEY, toPersisted } from '@/lib/kernel/persist/sessions';
import { DEFAULT_PREFS } from '@/lib/kernel/state';
import { canPlay } from '@/lib/audio/policy';
import { detectCapabilities, deviceClassFor, isAppleTouch } from '@/lib/kernel/capabilities';
import { booted, fixtureCatalog, last, run } from '../../fixtures/portfolio';

class FakeStorage implements Storage {
  data = new Map<string, string>();
  failWrites = false;
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException('quota', 'QuotaExceededError');
    this.data.set(key, value);
  }
}

const immediate = (run: () => void) => {
  run();
  return () => undefined;
};

describe('KRN-PERSIST-01 safe storage + migrations', () => {
  it('writes are debounced and flushed', () => {
    const backing = new FakeStorage();
    const timers: (() => void)[] = [];
    const storage = createSafeStorage({
      backing: () => backing,
      schedule: (run) => (timers.push(run), () => undefined),
    });
    storage.setItem('a', '1');
    storage.setItem('a', '2');
    expect(backing.getItem('a')).toBeNull();
    expect(storage.getItem('a')).toBe('2');
    storage.flush();
    expect(backing.getItem('a')).toBe('2');
  });

  it('quota error → memory fallback, never throws', () => {
    const backing = new FakeStorage();
    const storage = createSafeStorage({ backing: () => backing, schedule: immediate });
    backing.failWrites = true;
    expect(() => storage.setItem('k', 'v')).not.toThrow();
    expect(storage.mode).toBe('memory');
    expect(storage.getItem('k')).toBe('v');
  });

  it('blocked storage (SecurityError) → memory mode', () => {
    const storage = createSafeStorage({
      backing: () => {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    expect(storage.mode).toBe('memory');
    storage.setItem('k', 'v');
    expect(storage.getItem('k')).toBe('v');
  });

  it('corrupt JSON → defaults', () => {
    const backing = new FakeStorage();
    backing.data.set(PREFS_KEY, '{nope');
    backing.data.set(SESSIONS_KEY, '[1,2');
    const storage = createSafeStorage({ backing: () => backing });
    expect(parsePrefs(readJson(storage, PREFS_KEY))).toEqual(DEFAULT_PREFS);
    expect(parsePersistedSessions(readJson(storage, SESSIONS_KEY))).toBeNull();
  });

  it('prefs parsing is a validating merge', () => {
    const prefs = parsePrefs({
      state: {
        persona: 'guest',
        lastOs: 'beos',
        sound: { enabled: false, volume: 9 },
        motion: 'reduced',
        eggsFound: ['vim', 'vim', 3],
      },
      version: 1,
    });
    expect(prefs).toMatchObject({
      persona: 'guest',
      lastOs: null,
      sound: { enabled: false, volume: 1, ui: false },
      motion: 'reduced',
      eggsFound: ['vim'],
    });
  });

  it('expired governor demotions are dropped', () => {
    expect(parsePrefs({ demotion: { tier: 0, exp: 100 } }, 50).demotion).toEqual({ tier: 0, exp: 100 });
    expect(parsePrefs({ demotion: { tier: 0, exp: 100 } }, 200).demotion).toBeNull();
    expect(parsePrefs({ demotion: { tier: 2, exp: 1e15 } }, 0).demotion).toBeNull();
  });

  it('round-trips a session through JSON', () => {
    const state = last(run(booted('/macos'), [{ type: 'OPEN_APP', role: 'files' }])).state;
    const persisted = JSON.parse(JSON.stringify(toPersisted(state, 5, fixtureCatalog.rev)));
    expect(parsePersistedSessions(persisted)?.sessions.macos?.windows['macos:files']?.role).toBe('files');
  });
});

describe('KRN-PERSIST-02 prefs survive a session schema bump', () => {
  it('sessions are discarded, prefs intact', () => {
    const backing = new FakeStorage();
    backing.data.set(
      PREFS_KEY,
      JSON.stringify({
        state: { ...DEFAULT_PREFS, persona: 'developer', introSeen: true, lastOs: 'linux' },
        version: 1,
      }),
    );
    backing.data.set(SESSIONS_KEY, JSON.stringify({ v: 99, savedAt: 1, contentRev: 'x', sessions: {} }));
    const storage = createSafeStorage({ backing: () => backing });
    expect(parsePersistedSessions(readJson(storage, SESSIONS_KEY))).toBeNull();
    expect(parsePrefs(readJson(storage, PREFS_KEY))).toMatchObject({
      persona: 'developer',
      introSeen: true,
      lastOs: 'linux',
    });
  });
});

describe('CONT-MEM-01 continuity is in-memory only', () => {
  it('continuity is absent from the persisted payload', () => {
    const state = last(
      run(booted('/macos'), [
        {
          type: 'OPEN_APP',
          role: 'github',
          location: { kind: 'content', ref: { section: 'projects', slug: 'rocket' } },
        },
      ]),
    ).state;
    expect(state.continuity).not.toBeNull();
    const payload = JSON.stringify(toPersisted(state, 1, fixtureCatalog.rev));
    expect(payload).not.toContain('continuity');
    expect(payload).not.toContain('fromOs');
  });
});

describe('KRN-SOUND-01 sound preference', () => {
  it('only the intro sound is enabled by default', () => {
    expect(canPlay('intro', DEFAULT_PREFS.sound)).toBe(true);
    expect(canPlay('ui', DEFAULT_PREFS.sound)).toBe(false);
    expect(canPlay('intro', { ...DEFAULT_PREFS.sound, enabled: false })).toBe(false);
    expect(canPlay('ui', { ...DEFAULT_PREFS.sound, ui: true })).toBe(true);
  });
});

describe('KRN-CAP-01 capability profile', () => {
  const env = (queries: Record<string, boolean>, dataset: DOMStringMap = { tier: '1' }, saveData = false) => ({
    matchMedia: (query: string) => ({ matches: queries[query] ?? false }),
    navigator: { connection: { saveData } } as never,
    screen: { width: 390, height: 844 },
    documentElement: { dataset },
  });
  it('has the specified shape', () => {
    const profile = detectCapabilities(
      env({ '(pointer: coarse)': true }, { tier: '0', motion: 'reduced', glass: 'solid' }, true),
    );
    expect(Object.keys(profile).sort()).toEqual([
      'appleTouch',
      'deviceClass',
      'hover',
      'pointer',
      'reducedMotion',
      'reducedTransparency',
      'saveData',
      'tier',
      'webgl2',
    ]);
    expect(profile).toMatchObject({
      tier: 0,
      deviceClass: 'phone',
      pointer: 'coarse',
      reducedMotion: true,
      reducedTransparency: true,
      saveData: true,
      appleTouch: false, // no supports() probe available → never guessed
    });
    const apple = detectCapabilities({ ...env({ '(pointer: coarse)': true }), supports: () => true });
    expect(apple.appleTouch).toBe(true);
    const desktop = detectCapabilities({ ...env({ '(pointer: fine)': true }), supports: () => true });
    expect(desktop.appleTouch).toBe(false); // only meaningful on touch devices
  });
  it('classifies devices without the user agent', () => {
    expect(deviceClassFor('fine', 400)).toBe('desktop');
    expect(deviceClassFor('coarse', 390)).toBe('phone');
    expect(deviceClassFor('coarse', 820)).toBe('tablet');
    expect(isAppleTouch({ supports: () => true })).toBe(true);
    expect(
      isAppleTouch({
        supports: () => {
          throw new Error('x');
        },
      }),
    ).toBe(false);
  });
  it('a governor demotion is persisted through prefs', () => {
    const demoted = parsePrefs({ state: { ...DEFAULT_PREFS, demotion: { tier: 0, exp: 10_000 } } }, 1);
    expect(demoted.demotion).toEqual({ tier: 0, exp: 10_000 });
  });
});
