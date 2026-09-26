import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DRAWER_APPS,
  FAVORITES,
  HOME_APPS,
  appShortcutLabels,
  baseNotifications,
  navMode,
  resolveBack,
} from '@/components/os/android/model';
import { ANDROID_DURATION, ANDROID_EASING, ANDROID_PATTERNS } from '@/components/os/android/motion';
import { DEFAULT_PREFS } from '@/lib/kernel/state';
import { parsePrefs } from '@/lib/kernel/persist/prefs';

describe('AND-HOME / AND-FAV / AND-DRAWER launcher model', () => {
  it('keeps a sparse configured Home, four favorites and all six drawer apps', () => {
    expect(HOME_APPS).toEqual(['notes', 'settings']);
    expect(FAVORITES).toEqual(['files', 'browser', 'github', 'mail']);
    expect(DRAWER_APPS).toEqual(['browser', 'files', 'github', 'mail', 'notes', 'settings']);
  });

  it('derives lock/shade cards from data and marks contact silent', () => {
    const cards = baseNotifications({
      updated: '2026-09-22',
      projectCount: 4,
      featured: 'Portfolio OS',
      openTo: 'Open',
    });
    expect(cards.map((item) => item.id)).toEqual(['resume', 'projects', 'contact']);
    expect(cards[0]).toMatchObject({ role: 'files', ref: { section: 'resume' } });
    expect(cards[2]).toMatchObject({ role: 'mail', silent: true });
  });

  it('builds the required shortcut rows', () => {
    expect(appShortcutLabels('files')).toEqual(['Open résumé', 'Download résumé', 'Experience', 'Education']);
    expect(appShortcutLabels('github', ['One', 'Two', 'Three', 'Four', 'Five'])).toHaveLength(4);
  });
});

describe('AND-A11Y-03 / AND-CASE-02 Back ordering', () => {
  const base = {
    dialog: false,
    sheet: false,
    menu: false,
    query: false,
    shadeExpanded: false,
    overlay: false,
    appDepth: 0,
    appOpen: false,
  };
  it.each([
    [{ dialog: true }, 'dialog'],
    [{ sheet: true }, 'sheet'],
    [{ menu: true }, 'menu'],
    [{ query: true }, 'query'],
    [{ shadeExpanded: true }, 'shade-expanded'],
    [{ overlay: true }, 'overlay'],
    [{ appOpen: true, appDepth: 2 }, 'app-stack'],
    [{ appOpen: true }, 'app-root'],
    [{}, 'launcher'],
  ] as const)('resolves %o to %s', (patch, expected) => expect(resolveBack({ ...base, ...patch })).toBe(expected));
});

describe('AND-BARS-02 navigation and Android preferences', () => {
  it('uses gestures on coarse pointers and buttons on fine pointers unless explicitly chosen', () => {
    expect(navMode('auto', 'coarse')).toBe('gesture');
    expect(navMode('auto', 'fine')).toBe('buttons');
    expect(navMode('gesture', 'fine')).toBe('gesture');
  });
  it('validates and defaults Material You settings', () => {
    expect(DEFAULT_PREFS).toMatchObject({
      androidPalette: 'sage',
      androidThemedIcons: false,
      androidNavigation: 'auto',
    });
    expect(
      parsePrefs({ androidPalette: 'violet', androidThemedIcons: true, androidNavigation: 'buttons' }),
    ).toMatchObject({ androidPalette: 'violet', androidThemedIcons: true, androidNavigation: 'buttons' });
    expect(parsePrefs({ androidPalette: 'neon', androidThemedIcons: 'yes', androidNavigation: 'wheel' })).toMatchObject(
      { androidPalette: 'sage', androidThemedIcons: false, androidNavigation: 'auto' },
    );
  });
});

describe('AND-MOTION-01/02 Material motion tokens', () => {
  it('matches the planned duration and easing table', () => {
    expect(ANDROID_DURATION).toEqual({ short: 150, medium: 300, open: 450, close: 350 });
    expect(ANDROID_EASING.decelerate).toBe('cubic-bezier(.05,.7,.1,1)');
    expect(ANDROID_EASING.accelerate).toBe('cubic-bezier(.3,0,.8,.15)');
    expect(ANDROID_PATTERNS.fadeThrough.at(-1)).toEqual({ transform: 'scale(1)', opacity: 1 });
  });
  it('contains no Android backdrop filter', () => {
    const sources = [
      readFileSync('styles/os/android.css', 'utf8'),
      readFileSync('components/os/android/android.module.css', 'utf8'),
    ]
      .join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    expect(sources).not.toMatch(/backdrop-filter\s*:/);
  });
});
