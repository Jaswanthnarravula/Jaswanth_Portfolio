/**
 * Android Pixel rework (plans/android/08 Deviations log 2026-09-24): real Material Symbols, no text-character
 * stand-ins, and the build-time Material You palette (AND-ID-02) generated from the wallpaper seeds.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SYMBOL_PATHS } from '@/components/os/android/symbols.generated';
import { ROLE_GLYPH } from '@/components/os/android/model';

const ROOT = 'components/os/android';
const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.includes('.generated.') ? [path] : [];
  });

describe('AND-ID system glyphs are Material Symbols', () => {
  it('every <Symbol> name and glyph literal the Android code draws exists in symbols.generated.ts', () => {
    const missing: string[] = [];
    for (const file of sources(ROOT)) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/<Symbol(?: filled(?:=\{[^}]*\})?)?>([a-z][a-z0-9_]*)<\/Symbol>/g))
        if (!(match[1]! in SYMBOL_PATHS)) missing.push(`${file}: ${match[1]}`);
      for (const match of text.matchAll(/glyph: '([a-z][a-z0-9_]*)'/g))
        if (!(match[1]! in SYMBOL_PATHS)) missing.push(`${file}: ${match[1]}`);
    }
    for (const glyph of Object.values(ROLE_GLYPH)) if (!(glyph in SYMBOL_PATHS)) missing.push(`ROLE_GLYPH: ${glyph}`);
    expect(missing).toEqual([]);
  });

  it('no Unicode stand-ins for system glyphs remain in the Android UI', () => {
    const offenders: string[] = [];
    for (const file of sources(ROOT)) {
      const text = readFileSync(file, 'utf8');
      // The old placeholders: status-bar triangles/blocks, 3-button ◀ ● ■, ⌕ ⌘ ◖)) ☆ ⋮ ✓ × as visible glyphs.
      for (const match of text.matchAll(/>[^<{]*[▾◢█◀●■⌕⌘◖☆⋮✓×▦▤▣◇◎◒◉♢➤↕]+[^<{]*</g))
        offenders.push(`${file}: ${match[0].trim()}`);
    }
    expect(offenders).toEqual([]);
  });

  it('generated paths use the Material Symbols viewBox coordinate space', () => {
    for (const paths of Object.values(SYMBOL_PATHS)) for (const d of paths) expect(d).toMatch(/^[Mm][\d.-]/);
  });
});

describe('AND-ID-02 build-time Material You palette', () => {
  it('the committed palette block is exactly what the seeds generate, and every text pair is ≥ 4.5:1', async () => {
    const { build } = (await import('../../../scripts/build-android-palette.mjs')) as { build: () => Promise<string> };
    const generated = await build();
    const css = readFileSync('styles/os/android.css', 'utf8').replace(/\r\n/g, '\n');
    expect(css).toContain(generated);
  });

  it('each palette has a light and a dark scheme, and ink for text drawn on its wallpaper', () => {
    const css = readFileSync('styles/os/android.css', 'utf8');
    for (const scope of [
      "[data-os='android'] {",
      "[data-os='android'][data-palette='blue'] {",
      "[data-os='android'][data-palette='violet'] {",
      "[data-os='android'][data-palette='coral'] {",
    ]) {
      expect(css).toContain(scope);
      expect(css).toContain(`:root[data-theme='dark'] ${scope}`);
    }
    expect(css.match(/--android-ink:/g)?.length).toBe(12);
  });
});
