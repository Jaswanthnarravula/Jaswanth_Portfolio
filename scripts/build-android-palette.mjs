/**
 * AND-ID-02 — build-time Material You colour (plans/android/01-identity "Dynamic colour").
 *
 * Each Android palette has a genuine Pixel wallpaper (scripts/asset-sources.mjs `wallpaper.android*`). This script
 * samples the wallpaper once, derives a seed (chroma-weighted mean hue in OKLCH), builds Tonal Spot palettes
 * (primary · secondary · tertiary · neutral · neutral-variant) where "tone" is CIELAB L* as in Material's HCT, and
 * writes the light + dark schemes as CSS custom properties into the generated block of styles/os/android.css.
 * Every on-colour / container pair is checked for ≥ 4.5:1 contrast; the script fails otherwise.
 *
 * Nothing is sampled in the browser. The seeds recorded below were sampled from the wallpapers (`--sample` prints them
 * again from assets-inbox), so the output is reproducible on a clean clone without the inbox.
 *
 *   node scripts/build-android-palette.mjs            # rewrite the block
 *   node scripts/build-android-palette.mjs --check    # fail if the committed block is stale
 *   node scripts/build-android-palette.mjs --sample   # print each wallpaper's sampled seed
 */
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';

const CSS_PATH = 'styles/os/android.css';
const START = '/* @generated android-palette:start — scripts/build-android-palette.mjs */';
const END = '/* @generated android-palette:end */';

/**
 * palette → its wallpaper in assets-inbox, the seed sampled from it, and the ink for text drawn straight on it (labels,
 * At-a-glance, status bar): light on mid/dark wallpapers, dark on pale ones — as the Pixel launcher does.
 */
export const PALETTES = {
  sage: { file: 'assets-inbox/wallpapers/android-pixel6-la-mer.jpg', seed: { h: 200.7, c: 0.036 }, ink: 'light' },
  blue: { file: 'assets-inbox/wallpapers/android-pixel6-art-4.png', seed: { h: 244.8, c: 0.041 }, ink: 'light' },
  violet: { file: 'assets-inbox/wallpapers/android-pixel6-art-13.png', seed: { h: 356.1, c: 0.041 }, ink: 'dark' },
  coral: { file: 'assets-inbox/wallpapers/android-pixel6-art-9.png', seed: { h: 17.3, c: 0.18 }, ink: 'light' },
};

// ---------- colour maths (OKLab ⇄ linear sRGB, CIELAB L*, WCAG luminance) ----------
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function srgbToOklab(r, g, b) {
  const [R, G, B] = [r, g, b].map((v) => toLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function oklchToLinear(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const inGamut = (rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const lstar = (Y) => (Y <= 216 / 24389 ? (Y * 24389) / 27 : 116 * Math.cbrt(Y) - 16);

/** The in-gamut OKLCH colour of hue h, chroma ≤ c, whose CIELAB L* equals `tone` (Material "tone"). */
export function tone(h, c, t) {
  if (t >= 100) return { L: 1, C: 0, h };
  if (t <= 0) return { L: 0, C: 0, h };
  let chroma = c;
  for (;;) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (lstar(luminance(oklchToLinear(mid, chroma, h))) < t) lo = mid;
      else hi = mid;
    }
    const L = (lo + hi) / 2;
    if (inGamut(oklchToLinear(L, chroma, h)) || chroma <= 0) return { L, C: chroma, h };
    chroma = Math.max(0, chroma - 0.002);
  }
}
const linearOf = ({ L, C, h }) => oklchToLinear(L, C, h).map((v) => Math.min(1, Math.max(0, v)));
export const contrast = (x, y) => {
  const [a, b] = [luminance(linearOf(x)), luminance(linearOf(y))].sort((p, q) => q - p);
  return (a + 0.05) / (b + 0.05);
};
const css = ({ L, C, h }) => `oklch(${+L.toFixed(3)} ${+C.toFixed(3)} ${C < 0.0005 ? 0 : +h.toFixed(1)})`;

// ---------- seed from the wallpaper ----------
async function sampleSeed(file) {
  const { default: sharp } = await import('sharp');
  const { data, info } = await sharp(file).resize(96, 96, { fit: 'cover' }).removeAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  let [sa, sb, sw] = [0, 0, 0];
  for (let i = 0; i < info.width * info.height; i++) {
    const [, a, b] = srgbToOklab(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
    const chroma = Math.hypot(a, b);
    sa += a * chroma;
    sb += b * chroma;
    sw += chroma;
  }
  const a = sa / sw;
  const b = sb / sw;
  return { h: +(((Math.atan2(b, a) * 180) / Math.PI + 360) % 360).toFixed(1), c: +Math.hypot(a, b).toFixed(3) };
}

// ---------- Tonal Spot scheme ----------
function scheme(seed, dark) {
  const P = (t) => tone(seed.h, Math.max(0.07, Math.min(seed.c * 1.6, 0.11)), t);
  const S = (t) => tone(seed.h, 0.03, t);
  const T = (t) => tone((seed.h + 60) % 360, 0.06, t);
  const N = (t) => tone(seed.h, 0.008, t);
  const NV = (t) => tone(seed.h, 0.018, t);
  const E = (t) => tone(27, 0.16, t);
  return dark
    ? {
        primary: P(80),
        'on-primary': P(20),
        'primary-container': P(30),
        'on-primary-container': P(90),
        secondary: S(80),
        'secondary-container': S(30),
        'on-secondary-container': S(90),
        tertiary: T(80),
        'tertiary-container': T(30),
        'on-tertiary-container': T(90),
        error: E(80),
        'error-container': E(30),
        'on-error-container': E(90),
        surface: N(6),
        'surface-dim': N(6),
        'surface-bright': N(24),
        'surface-container-lowest': N(4),
        'surface-container-low': N(10),
        'surface-container': N(12),
        'surface-container-high': N(17),
        'surface-container-highest': N(22),
        'on-surface': N(90),
        'on-surface-variant': NV(80),
        outline: NV(60),
        'outline-variant': NV(30),
        'inverse-surface': N(90),
        'inverse-on-surface': N(20),
        'inverse-primary': P(40),
      }
    : {
        primary: P(40),
        'on-primary': P(100),
        'primary-container': P(90),
        'on-primary-container': P(10),
        secondary: S(40),
        'secondary-container': S(90),
        'on-secondary-container': S(10),
        tertiary: T(40),
        'tertiary-container': T(90),
        'on-tertiary-container': T(10),
        error: E(40),
        'error-container': E(90),
        'on-error-container': E(10),
        surface: N(98),
        'surface-dim': N(87),
        'surface-bright': N(98),
        'surface-container-lowest': N(100),
        'surface-container-low': N(96),
        'surface-container': N(94),
        'surface-container-high': N(92),
        'surface-container-highest': N(90),
        'on-surface': N(10),
        'on-surface-variant': NV(30),
        outline: NV(50),
        'outline-variant': NV(80),
        'inverse-surface': N(20),
        'inverse-on-surface': N(95),
        'inverse-primary': P(80),
      };
}

/** Pairs that carry text; each must reach 4.5:1 (AND-ID-02). */
export const TEXT_PAIRS = [
  ['on-primary', 'primary'],
  ['on-primary-container', 'primary-container'],
  ['on-secondary-container', 'secondary-container'],
  ['on-tertiary-container', 'tertiary-container'],
  ['on-error-container', 'error-container'],
  ['on-surface', 'surface'],
  ['on-surface', 'surface-container-highest'],
  ['on-surface-variant', 'surface'],
  ['on-surface-variant', 'surface-container-highest'],
  ['primary', 'surface'],
  ['primary', 'surface-container-high'],
  ['inverse-on-surface', 'inverse-surface'],
];

function block(name, roles) {
  const lines = Object.entries(roles).map(([role, value]) => `  --md-${role}: ${css(value)};`);
  return lines.join('\n');
}

export async function build() {
  const out = [START];
  for (const [name, palette] of Object.entries(PALETTES)) {
    const seed = palette.seed;
    for (const dark of [false, true]) {
      const roles = scheme(seed, dark);
      for (const [fg, bg] of TEXT_PAIRS) {
        const ratio = contrast(roles[fg], roles[bg]);
        if (ratio < 4.5)
          throw new Error(`${name} ${dark ? 'dark' : 'light'}: --md-${fg} on --md-${bg} is ${ratio.toFixed(2)}:1`);
      }
      const scope = name === 'sage' ? `[data-os='android']` : `[data-os='android'][data-palette='${name}']`;
      const ink =
        dark || palette.ink === 'light'
          ? ['  --android-ink: oklch(1 0 0);', '  --android-ink-shadow: 0 1px 3px oklch(0 0 0 / 0.5);']
          : [
              `  --android-ink: ${css(tone(seed.h, 0.02, 12))};`,
              '  --android-ink-shadow: 0 0 6px oklch(1 0 0 / 0.55);',
            ];
      const body = `  /* seed ${seed.h}° C ${seed.c} */\n${block(name, roles)}\n${ink.join('\n')}`;
      const nested = body
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n');
      if (!dark) out.push(`${scope} {\n${body}\n}`);
      else
        out.push(
          `@media (prefers-color-scheme: dark) {\n  :root:not([data-theme='light']) ${scope} {\n${nested}\n  }\n}\n` +
            `:root[data-theme='dark'] ${scope} {\n${body}\n}`,
        );
    }
  }
  out.push(END);
  return out.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('build-android-palette.mjs')) {
  if (process.argv.includes('--sample')) {
    for (const [name, palette] of Object.entries(PALETTES))
      console.log(name, existsSync(palette.file) ? await sampleSeed(palette.file) : 'inbox file missing');
    process.exit(0);
  }
  const generated = await build();
  const source = await readFile(CSS_PATH, 'utf8');
  const [before, rest] = source.split(START);
  if (rest === undefined) throw new Error(`${CSS_PATH}: generated block markers missing`);
  const after = rest.split(END)[1] ?? '';
  const next = `${before}${generated}${after}`;
  if (process.argv.includes('--check')) {
    if (next !== source) {
      console.error(`${CSS_PATH}: the android palette block is stale — run node scripts/build-android-palette.mjs`);
      process.exit(1);
    }
    console.log('[android-palette] up to date');
  } else {
    await writeFile(CSS_PATH, next);
    console.log('[android-palette] wrote', CSS_PATH);
  }
}
