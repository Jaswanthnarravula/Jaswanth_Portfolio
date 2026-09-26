/**
 * Asset manifest + resolver — shared/11 `ASSET-MAN-01`, `ASSET-MODE-01`, `ASSET-ORIG-01`.
 * Official artwork is a removable overlay over a complete original baseline: flipping `NEXT_PUBLIC_ASSET_MODE` to
 * `original` (TAKEDOWN.md) swaps every asset without code changes. Boxes are identical in both modes, so the switch
 * never shifts layout. Third-party marks never appear in the site's title, favicon, OG cards or manifest.
 */
import { publicEnv, type AssetMode } from '@/lib/config/environment';
import { OS_IDS, PERSONA_IDS, type AppRole, type OsId, type PersonaId } from '@/lib/kernel/ids';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import { assetId, type AssetId } from '@/lib/kernel/types';
import type { GlyphId } from './glyphs';
import officialJson from './official.generated.json';

export type AssetKind = 'app-icon' | 'system-icon' | 'wallpaper' | 'avatar' | 'audio' | 'wordmark' | 'device-frame';
export type IconShape = 'squircle' | 'rounded' | 'circle' | 'none';

export interface OfficialSource {
  readonly src: string;
  readonly srcSet?: string;
  readonly width?: number;
  readonly height?: number;
  readonly bytes: readonly number[];
  readonly owner: string;
  readonly sourceUrl: string;
  readonly retrieved: string;
  readonly terms: string;
  readonly label: string;
  /** Rendered as a mask filled with the current colour (single-colour marks). */
  readonly monochrome: boolean;
  /** A stand-in derived from another official file until the real one is supplied. */
  readonly derived: boolean;
}

export type OriginalSource =
  | {
      readonly parametric: {
        readonly glyph: GlyphId;
        readonly gradient: readonly [string, string];
        readonly shape: IconShape;
      };
    }
  | { readonly face: { readonly gradient: readonly [string, string] } }
  | { readonly mark: 'apple' | 'windows' | 'android' | 'wordmark' }
  | { readonly css: string }
  | { readonly synth: 'chime' };

export interface AssetEntry {
  readonly id: AssetId;
  readonly kind: AssetKind;
  readonly os?: OsId;
  readonly label: string;
  /** Intrinsic box, identical in both modes. */
  readonly box: { readonly w: number; readonly h: number };
  readonly official?: OfficialSource;
  readonly original: OriginalSource;
  readonly alt: '';
}

export type ResolvedAsset = AssetEntry & { readonly mode: AssetMode } & (
    | { readonly render: 'image'; readonly src: string; readonly srcSet?: string; readonly monochrome: boolean }
    | { readonly render: 'original'; readonly source: OriginalSource }
    | { readonly render: 'audio'; readonly src: string }
  );

// --- Original baseline --------------------------------------------------------------------------------------------

/** Parametric originals per role: a gradient tile in the OS idiom + an openly licensed glyph. */
const ROLE_ORIGINALS: Readonly<Record<AppRole, { glyph: GlyphId; gradient: readonly [string, string] }>> = {
  browser: { glyph: 'compass', gradient: ['#6fd0ff', '#1a73e8'] },
  github: { glyph: 'branch', gradient: ['#5b6474', '#141821'] },
  mail: { glyph: 'mail', gradient: ['#5cc8ff', '#1768e3'] },
  messages: { glyph: 'message', gradient: ['#6ee07a', '#22a94a'] },
  files: { glyph: 'folder', gradient: ['#7cc2ff', '#2d6ff0'] },
  viewer: { glyph: 'image', gradient: ['#c49bff', '#6d3be8'] },
  editor: { glyph: 'code', gradient: ['#4cc3ff', '#1f5fd6'] },
  terminal: { glyph: 'terminal', gradient: ['#3d4552', '#0b0e13'] },
  notes: { glyph: 'notebook', gradient: ['#ffe28a', '#f2a900'] },
  settings: { glyph: 'settings', gradient: ['#b4bac4', '#5d6571'] },
};

const OS_SHAPE: Readonly<Record<OsId, IconShape>> = {
  macos: 'squircle',
  ios: 'squircle',
  windows: 'none',
  android: 'circle',
  linux: 'rounded',
};

/** Glyph refinements where an OS's own app differs (Edge/Chrome are globes; Keep is a note). */
const GLYPH_OVERRIDES: Readonly<Partial<Record<`${OsId}.${string}`, GlyphId>>> = {
  'windows.edge': 'globe',
  'android.chrome': 'globe',
  'android.keep': 'note',
  'windows.explorer': 'folder',
  'linux.viewer': 'document',
};

/** Android palettes other than the default (sage), each with its own wallpaper (`wallpaper.android-{palette}`). */
export const ANDROID_WALLPAPER_PALETTES = ['blue', 'violet', 'coral'] as const;

const ICON_BOX: Readonly<Record<OsId, number>> = { macos: 128, windows: 64, ios: 180, android: 144, linux: 64 };

const AVATAR_COLOURS: Readonly<Record<PersonaId, readonly [string, string]>> = {
  recruiter: ['#2ec5f2', '#0a78b8'],
  developer: ['#b9bec6', '#5f6670'],
  adventurer: ['#ffc83d', '#e8890c'],
  designer: ['#ff5a4f', '#c3121b'],
  guest: ['#4fe08a', '#138a4a'],
};

type OfficialJson = {
  v: 1;
  entries: Record<string, Omit<OfficialSource, 'bytes'> & { bytes: number[]; kind: string }>;
};
const OFFICIAL = (officialJson as OfficialJson).entries;

const official = (id: string): OfficialSource | undefined => {
  const entry = OFFICIAL[id];
  if (!entry) return undefined;
  const { kind: _kind, ...rest } = entry;
  return rest;
};

function buildManifest(): readonly AssetEntry[] {
  const entries: AssetEntry[] = [];
  for (const os of OS_IDS) {
    for (const binding of OS_REGISTRY[os].apps) {
      const base = ROLE_ORIGINALS[binding.role];
      const id = `app.${os}.${binding.slug}`;
      const size = ICON_BOX[os];
      entries.push({
        id: assetId(id),
        kind: 'app-icon',
        os,
        label: binding.title,
        box: { w: size, h: size },
        official: official(id),
        original: {
          parametric: {
            glyph: GLYPH_OVERRIDES[`${os}.${binding.slug}`] ?? base.glyph,
            gradient: base.gradient,
            shape: OS_SHAPE[os],
          },
        },
        alt: '',
      });
    }
  }
  const marks: {
    id: string;
    os: OsId;
    mark: 'apple' | 'windows' | 'android';
    label: string;
    box: { w: number; h: number };
  }[] = [
    { id: 'system.apple-logo', os: 'macos', mark: 'apple', label: 'Startup mark', box: { w: 84, h: 100 } },
    { id: 'system.windows-logo', os: 'windows', mark: 'windows', label: 'Startup mark', box: { w: 96, h: 96 } },
    { id: 'system.android-boot', os: 'android', mark: 'android', label: 'Startup mark', box: { w: 120, h: 68 } },
  ];
  for (const mark of marks)
    entries.push({
      id: assetId(mark.id),
      kind: 'system-icon',
      os: mark.os,
      label: mark.label,
      box: mark.box,
      official: official(mark.id),
      original: { mark: mark.mark },
      alt: '',
    });
  // Windows shell artwork (desktop items, File Explorer): free-form like every Windows icon.
  const winShell: { id: string; label: string; glyph: GlyphId; gradient: readonly [string, string] }[] = [
    { id: 'system.windows-folder', label: 'Folder', glyph: 'folder', gradient: ['#ffd65c', '#e8a400'] },
    { id: 'system.windows-this-pc', label: 'This PC', glyph: 'window', gradient: ['#6fc3ff', '#1a73e8'] },
    { id: 'system.windows-recycle-bin', label: 'Recycle Bin', glyph: 'document', gradient: ['#e8eef7', '#9aa6b8'] },
  ];
  for (const item of winShell)
    entries.push({
      id: assetId(item.id),
      kind: 'system-icon',
      os: 'windows',
      label: item.label,
      box: { w: 96, h: 96 },
      official: official(item.id),
      original: { parametric: { glyph: item.glyph, gradient: item.gradient, shape: 'none' } },
      alt: '',
    });
  for (const persona of PERSONA_IDS)
    entries.push({
      id: assetId(`avatar.${persona}`),
      kind: 'avatar',
      label: `${persona} avatar`,
      box: { w: 200, h: 200 },
      official: official(`avatar.${persona}`),
      original: { face: { gradient: AVATAR_COLOURS[persona] } },
      alt: '',
    });
  entries.push({
    id: assetId('audio.intro'),
    kind: 'audio',
    label: 'Intro sound',
    box: { w: 0, h: 0 },
    official: official('audio.intro'),
    original: { synth: 'chime' },
    alt: '',
  });
  // Original in both modes: the name wordmark (inline SVG) and device frames. Wallpapers are CSS originals, with an
  // official overlay where the owner chose one (iOS: the iPhone 16 wallpaper — plans/ios/01 "Wallpaper and depth").
  entries.push({
    id: assetId('wordmark.name'),
    kind: 'wordmark',
    label: 'Name wordmark',
    box: { w: 640, h: 160 },
    original: { mark: 'wordmark' },
    alt: '',
  });
  for (const os of OS_IDS) {
    entries.push({
      id: assetId(`wallpaper.${os}`),
      kind: 'wallpaper',
      os,
      label: `${os} wallpaper`,
      box: { w: 16, h: 10 },
      official: official(`wallpaper.${os}`),
      original: { css: `var(--wallpaper-${os})` },
      alt: '',
    });
    // Android: one genuine Pixel wallpaper per Material You palette; the palette's CSS gradient is the original.
    if (os === 'android')
      for (const palette of ANDROID_WALLPAPER_PALETTES)
        entries.push({
          id: assetId(`wallpaper.android-${palette}`),
          kind: 'wallpaper',
          os,
          label: `android wallpaper (${palette})`,
          box: { w: 16, h: 10 },
          official: official(`wallpaper.android-${palette}`),
          original: { css: 'var(--wallpaper-android)' },
          alt: '',
        });
    entries.push({
      id: assetId(`frame.${os}`),
      kind: 'device-frame',
      os,
      label: `${os} device frame`,
      box: { w: 16, h: 10 },
      original: { css: `frame-${os}` },
      alt: '',
    });
  }
  return entries;
}

export const ASSET_MANIFEST: readonly AssetEntry[] = buildManifest();
const BY_ID = new Map(ASSET_MANIFEST.map((entry) => [entry.id as string, entry]));

export const ASSET_MODE: AssetMode = publicEnv.assetMode;

export function getAsset(id: AssetId | string): AssetEntry | undefined {
  return BY_ID.get(id);
}

/** Honours `ASSET_MODE`; falls back to the original when the official file is missing. Never throws for known ids. */
export function resolveAsset(id: AssetId | string, mode: AssetMode = ASSET_MODE): ResolvedAsset {
  const entry = BY_ID.get(id);
  if (!entry) throw new Error(`Unknown asset id: ${id}`);
  if (mode === 'official' && entry.official) {
    if (entry.kind === 'audio') return { ...entry, mode, render: 'audio', src: entry.official.src };
    return {
      ...entry,
      mode,
      render: 'image',
      src: entry.official.src,
      srcSet: entry.official.srcSet,
      monochrome: entry.official.monochrome,
    };
  }
  return { ...entry, mode: 'original', render: 'original', source: entry.original };
}

/** Per-asset credits for the Legal surface (only official assets need credit). */
export function assetCredits(): readonly {
  label: string;
  os?: OsId;
  owner: string;
  sourceUrl: string;
  retrieved: string;
  terms: string;
  derived: boolean;
}[] {
  return ASSET_MANIFEST.filter((entry) => entry.official).map((entry) => ({
    label: entry.official!.label,
    os: entry.os,
    owner: entry.official!.owner,
    sourceUrl: entry.official!.sourceUrl,
    retrieved: entry.official!.retrieved,
    terms: entry.official!.terms,
    derived: entry.official!.derived,
  }));
}
