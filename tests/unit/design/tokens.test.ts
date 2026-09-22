/**
 * DS-TOKEN-01 (every semantic token defined for all five OS scopes), DS-DISTINCT-01 (no two OS scopes share the same
 * (radius, font, target, material) tuple), DS-SCRIM-01 (scrims ≥ 4.5:1 on worst-case backdrops; the brand reader's
 * text, accent fills and résumé paper ≥ 4.5:1 in both themes).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OS_IDS } from '@/lib/kernel/ids';

export const SEMANTIC_TOKENS = [
  '--surface-base',
  '--surface-raised',
  '--surface-overlay',
  '--surface-chrome',
  '--text-primary',
  '--text-secondary',
  '--text-tertiary',
  '--text-on-accent',
  '--border-subtle',
  '--border-strong',
  '--accent',
  '--focus-ring',
  '--scrim-light',
  '--scrim-dark',
  '--radius-control',
  '--radius-card',
  '--radius-window',
  '--radius-icon',
  '--radius-sheet',
  '--target-min',
  '--font-ui',
  '--font-display',
  '--font-mono',
  '--font-size-caption',
  '--font-size-body',
  '--font-size-title',
  '--font-size-large',
  '--elevation-1',
  '--elevation-2',
  '--elevation-3',
  '--elevation-4',
  '--elevation-5',
  '--material-thin',
  '--material-regular',
  '--material-thick',
  '--material-chrome',
] as const;

const css = (os: string) => readFileSync(`styles/os/${os}.css`, 'utf8');

/** Declarations of the first `selector { … }` block in a stylesheet. */
function blockScope(stylesheet: string, selector: string): Map<string, string> {
  const source = stylesheet.replace(/\/\*[\s\S]*?\*\//g, '');
  const start = source.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No block for ${selector}`);
  let depth = 0;
  let end = start;
  for (let index = source.indexOf('{', start); index < source.length; index++) {
    if (source[index] === '{') depth++;
    if (source[index] === '}') depth--;
    if (depth === 0) {
      end = index;
      break;
    }
  }
  const body = source.slice(source.indexOf('{', start) + 1, end);
  const declarations = new Map<string, string>();
  for (const match of body.matchAll(/([\w-]+)\s*:\s*([^;{}]+);/g))
    declarations.set(match[1]!, match[2]!.trim().replace(/\s+/g, ' '));
  return declarations;
}

/** The base scope of an OS skin: its first `[data-os='x'] { … }` block. */
const baseScope = (os: string) => blockScope(css(os), `[data-os='${os}']`);

const resolveVar = (scope: Map<string, string>, value: string): string =>
  value.replace(/var\((--[\w-]+)(?:,[^)]*)?\)/g, (_all, name: string) => resolveVar(scope, scope.get(name) ?? ''));

describe('DS-TOKEN-01 three-layer tokens + [data-os] scopes', () => {
  it.each(OS_IDS)('%s defines every semantic token', (os) => {
    const scope = baseScope(os);
    expect(SEMANTIC_TOKENS.filter((token) => !scope.has(token))).toEqual([]);
  });
  it('the brand layer defines every semantic token too', () => {
    const tokens = readFileSync('styles/tokens.css', 'utf8');
    for (const token of SEMANTIC_TOKENS) expect(tokens, token).toMatch(new RegExp(`${token}\\s*:`));
  });
  it('primitives live in @theme', () => {
    const globals = readFileSync('app/globals.css', 'utf8');
    for (const primitive of ['--space-1:', '--space-12:', '--z-windows:', '--z-stage:', '--color-brand-500:'])
      expect(globals).toContain(primitive);
  });
});

describe('DS-DISTINCT-01 OS skins differ on every listed token', () => {
  it('no two OS scopes share the same (radius, font, target, material) tuple', () => {
    const tuples = OS_IDS.map((os) => {
      const scope = baseScope(os);
      return [
        scope.get('--radius-window'),
        scope.get('--font-ui'),
        scope.get('--target-min'),
        resolveVar(scope, scope.get('--material-regular') ?? ''),
      ].join(' | ');
    });
    expect(new Set(tuples).size).toBe(OS_IDS.length);
  });
  it('each distinctness-contract value matches the identity files', () => {
    expect(baseScope('macos').get('--radius-window')).toBe('12px');
    expect(baseScope('windows').get('--radius-window')).toBe('8px');
    expect(baseScope('android').get('--target-min')).toBe('48px');
    expect(baseScope('ios').get('--target-min')).toBe('44px');
    expect(baseScope('android').get('--material-blur')).toBe('none');
    expect(baseScope('linux').get('--font-ui')).toMatch(/monospace/);
    expect(baseScope('windows').get('--font-size-body')).toBe('14px');
    expect(baseScope('macos').get('--font-size-body')).toBe('13px');
  });
});

// --- colour math: OKLCH → linear sRGB → WCAG contrast ------------------------------------------------------------

type RGBA = { r: number; g: number; b: number; a: number };

function parseColor(input: string): RGBA {
  const value = input.trim();
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1]!, 16);
    return {
      r: toLinear(((n >> 16) & 255) / 255),
      g: toLinear(((n >> 8) & 255) / 255),
      b: toLinear((n & 255) / 255),
      a: 1,
    };
  }
  const oklch = value.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\s*\)$/);
  if (!oklch) throw new Error(`Unparseable colour: ${value}`);
  const [L, C, H, A] = [
    Number(oklch[1]),
    Number(oklch[2]),
    Number(oklch[3]),
    oklch[4] === undefined ? 1 : Number(oklch[4]),
  ];
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const [l, m, s] = [l_ ** 3, m_ ** 3, s_ ** 3];
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  return {
    r: clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a: A,
  };
}
function toLinear(channel: number) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}
const encode = (linear: number) => (linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055);
/** Alpha compositing happens in gamma-encoded sRGB, as browsers do. */
function over(top: RGBA, bottom: RGBA): RGBA {
  const mix = (t: number, b: number) => toLinear(encode(t) * top.a + encode(b) * (1 - top.a));
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}
const luminance = (c: RGBA) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
export function contrast(a: RGBA, b: RGBA) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('DS-SCRIM-01 guaranteed contrast over wallpaper', () => {
  const WHITE = parseColor('#ffffff');
  const BLACK = parseColor('#000000');
  const worst: Record<string, string[]> = {
    // The storyboard gradient's stops (plans/macos/01-identity): #f3d3a4 · #e3a873 · #3f78a8 · #1f4f7a.
    macos: [
      'oklch(0.883 0.071 77.1)',
      'oklch(0.775 0.098 62.5)',
      'oklch(0.555 0.096 246.1)',
      'oklch(0.417 0.089 248.7)',
    ],
    // The storyboard gradient's stops (plans/windows/01-identity): #7fc0ff · #2f6fe0 · #0b1f5c.
    windows: ['#7fc0ff', '#2f6fe0', '#0b1f5c'],
    ios: ['oklch(0.86 0.08 200)', 'oklch(0.82 0.1 200)', 'oklch(0.8 0.12 30)'],
    android: ['oklch(0.9 0.04 245)', 'oklch(0.84 0.07 200)', 'oklch(0.42 0.1 258)'],
    linux: ['oklch(0.17 0.01 260)', 'oklch(0.985 0.003 90)'],
  };

  it.each(OS_IDS)('%s: white text on the dark scrim ≥ 4.5:1 over every worst-case backdrop', (os) => {
    const scrim = parseColor(baseScope(os).get('--scrim-dark')!);
    for (const backdrop of [...worst[os]!, '#ffffff'].map(parseColor))
      expect(contrast(WHITE, over(scrim, backdrop))).toBeGreaterThanOrEqual(4.5);
  });
  it.each(OS_IDS)('%s: dark text on the light scrim ≥ 4.5:1 over every worst-case backdrop', (os) => {
    const scrim = parseColor(baseScope(os).get('--scrim-light')!);
    for (const backdrop of [...worst[os]!, '#000000'].map(parseColor))
      expect(contrast(BLACK, over(scrim, backdrop))).toBeGreaterThanOrEqual(4.5);
  });
  it('the worst-case colours listed in the skins are covered', () => {
    for (const os of ['macos', 'windows', 'ios', 'android'] as const) {
      const declared = baseScope(os).get(`--wallpaper-${os}-worst`);
      expect(worst[os]).toContain(declared);
    }
  });
  it('base text tokens meet 4.5:1 on their surfaces (light scopes)', () => {
    for (const os of ['macos', 'windows', 'ios'] as const) {
      const scope = baseScope(os);
      const surface = parseColor(resolveVar(scope, scope.get('--surface-base')!));
      for (const token of ['--text-primary', '--text-secondary', '--text-tertiary']) {
        const text = over(parseColor(resolveVar(scope, scope.get(token)!)), surface);
        expect(contrast(text, surface), `${os} ${token}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe('DS-SCRIM-01 (brand) reader text and accent fills ≥ 4.5:1 in both themes', () => {
  const tokens = readFileSync('styles/tokens.css', 'utf8');
  const themes = {
    dark: blockScope(tokens, ':root'),
    light: new Map([...blockScope(tokens, ':root'), ...blockScope(tokens, ":root[data-theme='light']")]),
  };
  const color = (scope: Map<string, string>, token: string) => parseColor(resolveVar(scope, scope.get(token)!));

  it.each(Object.entries(themes))('%s: text tokens and the accent read on the base surface', (_theme, scope) => {
    const surface = color(scope, '--surface-base');
    for (const token of ['--text-primary', '--text-secondary', '--text-tertiary', '--accent'])
      expect(contrast(over(color(scope, token), surface), surface), token).toBeGreaterThanOrEqual(4.5);
  });
  it.each(Object.entries(themes))('%s: text on the filled accent (primary buttons)', (_theme, scope) => {
    expect(contrast(color(scope, '--text-on-accent'), color(scope, '--accent-strong'))).toBeGreaterThanOrEqual(4.5);
  });
  it('the résumé paper re-scopes ink tokens that read on paper in every theme', () => {
    const paper = blockScope(readFileSync('styles/document.css', 'utf8'), '.cv-paper');
    const sheet = parseColor(paper.get('background')!);
    for (const token of ['--text-primary', '--text-secondary', '--text-tertiary', '--accent'])
      expect(contrast(color(paper, token), sheet), token).toBeGreaterThanOrEqual(4.5);
  });
});

describe('MAC-ID-01 the macOS token scope carries plans/macos/01-identity', () => {
  const scope = () => baseScope('macos');
  it('type, radii, targets, accent, traffic lights (identity table)', () => {
    const s = scope();
    expect(s.get('--font-ui')).toMatch(/^-apple-system, BlinkMacSystemFont, 'SF Pro Text'/);
    expect([s.get('--font-size-body'), s.get('--font-size-caption'), s.get('--font-size-title')]).toEqual([
      '13px',
      '11px',
      '15px',
    ]);
    expect(s.get('--font-size-large')).toBe('26px');
    expect([
      s.get('--radius-window'),
      s.get('--radius-sheet'),
      s.get('--radius-control'),
      s.get('--radius-menu'),
    ]).toEqual(['12px', '10px', '6px', '8px']);
    expect(s.get('--radius-icon')).toBe('22.37%');
    expect(s.get('--target-min')).toBe('24px');
    expect(s.get('--accent')).toBe('oklch(0.62 0.19 255)');
    expect([s.get('--light-close'), s.get('--light-minimize'), s.get('--light-zoom')]).toEqual([
      '#ff5f57',
      '#febc2e',
      '#28c840',
    ]);
    expect(css('macos')).toMatch(/@media \(any-pointer: coarse\)\s*{\s*\[data-os='macos'\]\s*{\s*--target-min: 44px;/);
  });
  it('the storyboard frame values: wallpaper, window, toolbar, sidebar, selection, tags, menu bar, Dock', () => {
    const s = scope();
    expect(s.get('--wallpaper-macos')).toBe(
      'linear-gradient(150deg, #1f4f7a 0%, #3f78a8 35%, #e3a873 78%, #f3d3a4 100%)',
    );
    expect([s.get('--mac-window'), s.get('--mac-toolbar'), s.get('--mac-hairline')]).toEqual([
      '#f6f6f7',
      '#e9e9eb',
      '#d3d3d6',
    ]);
    expect(s.get('--mac-sidebar')).toBe('rgb(225 229 236 / 0.9)');
    expect(s.get('--mac-selection')).toBe('#2f6fe4');
    expect(s.get('--mac-tag-border')).toBe('#c9ccd3');
    expect(s.get('--mac-light-off')).toBe('#c9c9cc');
    expect([s.get('--mac-menubar'), s.get('--mac-dock'), s.get('--mac-dock-rim')]).toEqual([
      'rgb(255 255 255 / 0.55)',
      'rgb(255 255 255 / 0.38)',
      'rgb(255 255 255 / 0.55)',
    ]);
  });
  it('macOS text colours stay ≥ 4.5:1 where they sit (inactive titles and secondary text included)', () => {
    const s = scope();
    const c = (token: string) => parseColor(s.get(token)!);
    const sidebar = over({ ...parseColor('#e1e5ec'), a: 0.9 }, parseColor('#f6f6f7'));
    const pairs: [string, ReturnType<typeof parseColor>][] = [
      ['--mac-dim', c('--mac-window')],
      ['--mac-dim', c('--mac-toolbar')],
      ['--mac-dim', sidebar],
      ['--mac-title-inactive', c('--mac-toolbar')],
      ['--mac-title', c('--mac-toolbar')],
      ['--mac-row-text', c('--mac-window')],
      ['--mac-tag-text', c('--mac-window')],
      ['--mac-link', c('--mac-content')],
    ];
    for (const [token, surface] of pairs) expect(contrast(c(token), surface), token).toBeGreaterThanOrEqual(4.5);
    expect(contrast(parseColor('#ffffff'), c('--mac-selection')), 'white on the selection').toBeGreaterThanOrEqual(4.5);
  });
});
