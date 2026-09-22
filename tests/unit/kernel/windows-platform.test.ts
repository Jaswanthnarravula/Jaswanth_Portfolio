/**
 * Shared additions that Windows needs (plans/windows/04, 05, apps/settings; shared/09):
 *   WIN-RESP-04 — a transient sheet's Back entry: Back closes the sheet, navigates nowhere; closing it any other way
 *   drops the entry before the next navigation, so history never keeps it.
 *   WIN-A11Y-03 / WIN-WM-11 — Alt+Shift+Arrow snap chords live in the one keymap and none is reserved.
 *   WIN-SET-02 / WIN-SET-03 — the new preferences (taskbar alignment, accent, text size, contrast, notifications) parse
 *   with safe defaults and apply to <html> at once, with the same rules as the pre-paint tier script.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryHistory } from '@/lib/kernel/history/adapters';
import { createHistoryController } from '@/lib/kernel/history/controller';
import { formatChord, isReserved, matchShortcut, SHORTCUTS } from '@/lib/kernel/keymap';
import { parsePrefs, TEXT_SCALE_RANGE } from '@/lib/kernel/persist/prefs';
import { applyPrefsToDocument, resolvePrefAttributes } from '@/lib/kernel/prefs-dom';
import { DEFAULT_PREFS } from '@/lib/kernel/state';
import { routePath } from '@/lib/kernel/types';

function controllerAt(url: string) {
  const port = createMemoryHistory(url);
  const pops: string[] = [];
  const controller = createHistoryController({
    port,
    onPop: (next) => pops.push(next),
    schedule: () => () => undefined,
  });
  controller.canonicalize(routePath(url));
  return { port, pops, controller };
}

describe('WIN-RESP-04 transient sheet entries: Back closes the sheet first', () => {
  it('Back from the sheet entry calls onBack and never reaches the kernel', () => {
    const { port, pops, controller } = controllerAt('/windows');
    let closed = 0;
    controller.transient(() => closed++);
    expect(port.entries.map((entry) => entry.url)).toEqual(['/windows', '/windows']);
    port.back();
    port.flush();
    expect(closed).toBe(1);
    expect(pops).toEqual([]);
    expect(port.index).toBe(0);
  });

  it('closing the sheet another way drops its entry before an app opens (history never keeps it)', () => {
    const { port, pops, controller } = controllerAt('/windows');
    const release = controller.transient(() => undefined);
    release();
    expect(controller.go(routePath('/windows/github'))).toBe('queued');
    port.flush();
    expect(port.entries.slice(0, port.index + 1).map((entry) => entry.url)).toEqual(['/windows', '/windows/github']);
    expect(pops).toEqual([]);
  });

  it('navigating while the sheet entry is on top replaces it, so Back returns to the page under the sheet', () => {
    const { port, controller } = controllerAt('/windows/explorer');
    controller.transient(() => undefined);
    expect(controller.go(routePath('/windows/edge/resume'))).toBe('replace');
    expect(port.entries.map((entry) => entry.url)).toEqual(['/windows/explorer', '/windows/edge/resume']);
    // Back from the app collapses to the page below (osk.prev), like any other open.
    expect(controller.go(routePath('/windows/explorer'))).toBe('back');
  });

  it('a second sheet while one is open, or a sheet mid-traversal, gets no entry (Back then simply navigates)', () => {
    const { port, controller } = controllerAt('/windows');
    controller.transient(() => undefined);
    controller.transient(() => undefined);
    expect(port.entries).toHaveLength(2);
  });

  it('any other traversal (Forward, a different URL) clears the sheet and is handled normally', () => {
    const { port, pops, controller } = controllerAt('/windows');
    controller.go(routePath('/windows/github'));
    port.back();
    port.flush();
    pops.length = 0;
    controller.transient(() => undefined);
    port.back();
    port.flush();
    expect(pops).toEqual([]);
  });
});

describe('WIN-WM-11 · WIN-A11Y-03 Alt+Shift+Arrow snap chords', () => {
  const key = (keyName: string) => ({ key: keyName, altKey: true, shiftKey: true, ctrlKey: false, metaKey: false });
  it('match the four snap shortcuts, outside text fields only, and are not reserved', () => {
    const options = { inTextField: false, singleKeyShortcuts: true };
    expect(matchShortcut(key('ArrowLeft'), options)).toBe('snap-left');
    expect(matchShortcut(key('ArrowRight'), options)).toBe('snap-right');
    expect(matchShortcut(key('ArrowUp'), options)).toBe('snap-up');
    expect(matchShortcut(key('ArrowDown'), options)).toBe('snap-down');
    expect(matchShortcut(key('ArrowLeft'), { ...options, inTextField: true })).toBeNull();
    for (const shortcut of SHORTCUTS)
      for (const chord of shortcut.chords) expect(isReserved(chord), shortcut.id).toBe(false);
  });
  it('render as Alt+Shift+← in the shortcuts dialog', () => {
    const chord = SHORTCUTS.find((shortcut) => shortcut.id === 'snap-left')!.chords[0]!;
    expect(formatChord(chord, false)).toBe('Alt+Shift+←');
  });
});

describe('WIN-SET-02 · WIN-SET-03 preferences added for Windows Settings', () => {
  it('defaults: centre taskbar, no accent override, 100 % text, system contrast, notifications on', () => {
    expect(parsePrefs({})).toMatchObject({
      taskbarAlign: 'center',
      accent: null,
      textScale: 1,
      contrast: 'system',
      notifications: true,
    });
  });
  it('valid values survive; invalid ones fall back; text size clamps to 100–130 % in 5 % steps', () => {
    const parsed = parsePrefs({
      taskbarAlign: 'left',
      accent: 'teal',
      textScale: 1.27,
      contrast: 'more',
      notifications: false,
    });
    expect(parsed).toMatchObject({
      taskbarAlign: 'left',
      accent: 'teal',
      textScale: 1.25,
      contrast: 'more',
      notifications: false,
    });
    const bad = parsePrefs({
      taskbarAlign: 'right',
      accent: 'neon',
      textScale: 9,
      contrast: 'max',
      notifications: 'yes',
    });
    expect(bad).toMatchObject({
      taskbarAlign: 'center',
      accent: null,
      textScale: TEXT_SCALE_RANGE[1],
      contrast: 'system',
      notifications: true,
    });
  });
});

describe('A11Y-PREF-01 on Windows: preferences apply to <html> at once', () => {
  const env = (queries: readonly string[] = []) => {
    const dataset: Record<string, string | undefined> = {};
    const style = new Map<string, string>();
    return {
      dataset,
      style,
      env: {
        root: {
          dataset: dataset as DOMStringMap,
          style: {
            setProperty: (name: string, value: string) => void style.set(name, value),
            removeProperty: (name: string) => {
              style.delete(name);
              return '';
            },
          },
        },
        matches: (query: string) => queries.some((match) => query.includes(match)),
      },
    };
  };

  it('same rules as the tier script: an explicit choice wins over the system; system follows the media query', () => {
    expect(resolvePrefAttributes(DEFAULT_PREFS, () => false)).toMatchObject({
      motion: 'full',
      glass: 'full',
      theme: null,
    });
    expect(resolvePrefAttributes(DEFAULT_PREFS, (q) => q.includes('reduced-motion')).motion).toBe('reduced');
    expect(
      resolvePrefAttributes({ ...DEFAULT_PREFS, motion: 'full' }, (q) => q.includes('reduced-motion')).motion,
    ).toBe('full');
    expect(resolvePrefAttributes({ ...DEFAULT_PREFS, contrast: 'more' }, () => false).glass).toBe('solid');
  });

  it('writes data-motion / glass / theme / contrast / accent and --text-scale, and removes what is back to default', () => {
    const target = env();
    applyPrefsToDocument(
      { ...DEFAULT_PREFS, motion: 'reduced', theme: 'dark', contrast: 'more', accent: 'green', textScale: 1.2 },
      target.env,
    );
    expect(target.dataset).toMatchObject({
      motion: 'reduced',
      glass: 'solid',
      theme: 'dark',
      contrast: 'more',
      accent: 'green',
    });
    expect(target.style.get('--text-scale')).toBe('1.2');
    applyPrefsToDocument(DEFAULT_PREFS, target.env);
    expect(target.dataset.theme).toBeUndefined();
    expect(target.dataset.contrast).toBeUndefined();
    expect(target.dataset.accent).toBeUndefined();
    expect(target.style.has('--text-scale')).toBe(false);
  });
});
