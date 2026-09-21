/**
 * Static Open Graph cards — shared/19 `OG-GEN-01`, `OG-FIT-01`, `OG-MARK-01`. One design keyed by `ContentRef`,
 * rendered at build with `next/og`. Original artwork only: brand gradient, five abstract tiles (no logos, no icons,
 * no third-party styling). Inter is embedded for deterministic rendering.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const OG_SIZE = { width: 1200, height: 630 } as const;

/** Truncate on a word boundary to ≤ `max` characters (with an ellipsis). */
export function truncateWords(text: string, max = 110): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const boundary = cut.lastIndexOf(' ');
  return `${(boundary > max * 0.6 ? cut.slice(0, boundary) : cut).replace(/[\s,.;:—–-]+$/, '')}…`;
}

/** Inter Bold advance ≈ 0.58 em on average; titles auto-fit between 56 and 84 px on at most two lines. */
export function fitTitle(title: string, width = 1040): { fontSize: number; lines: number; text: string } {
  const perChar = 0.58;
  for (let fontSize = 84; fontSize >= 56; fontSize -= 4) {
    const perLine = Math.floor(width / (fontSize * perChar));
    const lines = wrapCount(title, perLine);
    if (lines <= 2) return { fontSize, lines, text: title };
  }
  const perLine = Math.floor(width / (56 * perChar));
  return { fontSize: 56, lines: 2, text: truncateWords(title, perLine * 2 - 2) };
}

function wrapCount(text: string, perLine: number): number {
  let lines = 1;
  let length = 0;
  for (const word of text.split(' ')) {
    if (length === 0) length = word.length;
    else if (length + 1 + word.length <= perLine) length += 1 + word.length;
    else {
      lines++;
      length = word.length;
    }
  }
  return lines;
}

export interface OgCardInput {
  readonly eyebrow: string;
  readonly title: string;
  readonly summary: string;
  readonly tags?: readonly string[];
  readonly name: string;
  readonly headline: string;
}

let fonts: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 700 }[]> | null = null;
const loadFonts = () =>
  (fonts ??= Promise.all([
    readFile(join(process.cwd(), 'app/fonts/inter-400.ttf')),
    readFile(join(process.cwd(), 'app/fonts/inter-700.ttf')),
  ]).then(([regular, bold]) => [
    {
      name: 'Inter',
      data: regular.buffer.slice(regular.byteOffset, regular.byteOffset + regular.byteLength) as ArrayBuffer,
      weight: 400 as const,
    },
    {
      name: 'Inter',
      data: bold.buffer.slice(bold.byteOffset, bold.byteOffset + bold.byteLength) as ArrayBuffer,
      weight: 700 as const,
    },
  ]));

/** Five abstract tiles — a hint of "five operating systems", no likeness of any. */
const TILES = [
  { x: 0, y: 0, r: 22, c: 'rgba(125, 170, 255, 0.9)' },
  { x: 58, y: 0, r: 10, c: 'rgba(160, 130, 255, 0.85)' },
  { x: 116, y: 0, r: 4, c: 'rgba(95, 205, 235, 0.85)' },
  { x: 29, y: 58, r: 26, c: 'rgba(255, 150, 190, 0.8)' },
  { x: 87, y: 58, r: 2, c: 'rgba(130, 225, 170, 0.85)' },
];

export async function renderOgCard(input: OgCardInput): Promise<ImageResponse> {
  const title = fitTitle(input.title);
  const summary = truncateWords(input.summary);
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 80px',
        color: '#F5F7FF',
        fontFamily: 'Inter',
        background:
          'radial-gradient(60% 80% at 8% 0%, rgba(59,99,237,0.55) 0%, rgba(0,0,0,0) 70%), radial-gradient(50% 70% at 100% 10%, rgba(150,80,230,0.4) 0%, rgba(0,0,0,0) 70%), linear-gradient(160deg, #0B1022 0%, #121A38 55%, #1A1540 100%)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>{input.name}</div>
          <div style={{ fontSize: 22, color: 'rgba(225,230,255,0.72)', marginTop: 6, maxWidth: 760 }}>
            {truncateWords(input.headline, 80)}
          </div>
        </div>
        <div style={{ display: 'flex', position: 'relative', width: 164, height: 106 }}>
          {TILES.map((tile) => (
            <div
              key={`${tile.x}-${tile.y}`}
              style={{
                position: 'absolute',
                left: tile.x,
                top: tile.y,
                width: 46,
                height: 46,
                borderRadius: tile.r,
                background: tile.c,
              }}
            />
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#8FB2FF', textTransform: 'uppercase', letterSpacing: 3 }}>
          {input.eyebrow}
        </div>
        <div
          style={{
            fontSize: title.fontSize,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
            marginTop: 14,
            maxWidth: 1040,
          }}
        >
          {title.text}
        </div>
        <div style={{ fontSize: 28, lineHeight: 1.35, color: 'rgba(225,230,255,0.8)', marginTop: 22, maxWidth: 1000 }}>
          {summary}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {(input.tags ?? []).slice(0, 4).map((tag) => (
          <div
            key={tag}
            style={{
              fontSize: 22,
              padding: '8px 18px',
              borderRadius: 999,
              border: '1.5px solid rgba(200,210,255,0.35)',
              color: 'rgba(230,235,255,0.9)',
            }}
          >
            {tag}
          </div>
        ))}
      </div>
    </div>,
    { ...OG_SIZE, fonts: await loadFonts() },
  );
}
