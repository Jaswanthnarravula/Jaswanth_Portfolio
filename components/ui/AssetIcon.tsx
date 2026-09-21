/**
 * Renders any manifest asset (app icon, boot mark, avatar) in the current `ASSET_MODE`, inside a fixed box that is
 * identical in both modes — switching modes never shifts layout (shared/06 `DS-ICONBOX-01`). Icons are decorative
 * (`alt=""`): the surrounding label names the app. Hook-free; server- and client-renderable.
 */
import type { CSSProperties } from 'react';
import { GLYPHS, type GlyphElement } from '@/lib/assets/glyphs';
import { resolveAsset, type IconShape, type OriginalSource } from '@/lib/assets/manifest';
import { squirclePath } from '@/lib/assets/squircle';
import type { AssetMode } from '@/lib/config/environment';

export interface AssetIconProps {
  readonly id: string;
  /** Rendered box in CSS pixels (square unless the asset's box says otherwise). */
  readonly size: number;
  readonly mode?: AssetMode;
  readonly className?: string;
  readonly priority?: boolean;
  /**
   * Fill the parent's width instead of a fixed `size` (e.g. avatars that scale from 84 to 200 px). The box keeps the
   * asset's aspect ratio in both modes, so switching modes still never shifts layout.
   */
  readonly fluid?: boolean;
}

const VIEW = 100;

function shapePath(shape: IconShape): string | null {
  switch (shape) {
    case 'squircle':
      return squirclePath(VIEW);
    case 'circle':
      return `M50 0A50 50 0 1 1 49.99 0Z`;
    case 'rounded':
      return 'M22 0H78A22 22 0 0 1 100 22V78A22 22 0 0 1 78 100H22A22 22 0 0 1 0 78V22A22 22 0 0 1 22 0Z';
    case 'none':
      return null;
  }
}

function Glyph({ elements, stroke }: { elements: readonly GlyphElement[]; stroke: string }) {
  return (
    <g fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {elements.map((element, index) => {
        switch (element.t) {
          case 'path':
            return <path key={index} d={element.d} />;
          case 'circle':
            return <circle key={index} cx={element.cx} cy={element.cy} r={element.r} />;
          case 'rect':
            return (
              <rect key={index} x={element.x} y={element.y} width={element.w} height={element.h} rx={element.rx} />
            );
        }
      })}
    </g>
  );
}

/** Original artwork (parametric tile + glyph, geometric face, or the site's own monogram). */
function OriginalArt({
  source,
  id,
  width,
  height,
}: {
  source: OriginalSource;
  id: string;
  width: number | string;
  height: number | string;
}) {
  const gradientId = `ai-${id.replace(/[^a-z0-9]/gi, '-')}`;
  if ('parametric' in source) {
    const { glyph, gradient, shape } = source.parametric;
    const outline = shapePath(shape);
    // Free-form (Windows) icons: the glyph itself carries the gradient; tiles carry a white glyph.
    const tileScale = outline ? 0.52 : 0.8;
    const offset = (VIEW - 24 * (VIEW / 24) * tileScale) / 2;
    return (
      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} width={width} height={height} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={gradient[0]} />
            <stop offset="1" stopColor={gradient[1]} />
          </linearGradient>
        </defs>
        {outline ? <path d={outline} fill={`url(#${gradientId})`} /> : null}
        <g transform={`translate(${offset} ${offset}) scale(${(VIEW / 24) * tileScale})`}>
          <Glyph elements={GLYPHS[glyph]} stroke={outline ? '#ffffff' : `url(#${gradientId})`} />
        </g>
      </svg>
    );
  }
  if ('face' in source) {
    const [top, bottom] = source.face.gradient;
    return (
      <svg viewBox="0 0 100 100" width={width} height={height} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={top} />
            <stop offset="1" stopColor={bottom} />
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="8" fill={`url(#${gradientId})`} />
        <circle cx="34" cy="40" r="6.5" fill="#fff" />
        <circle cx="66" cy="40" r="6.5" fill="#fff" />
        <path d="M30 62c10 11 30 11 40 0" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      </svg>
    );
  }
  // Boot marks and the name wordmark in original mode: the site's own monogram (never a third-party mark).
  return (
    <svg viewBox="0 0 64 64" width={width} height={height} aria-hidden="true" focusable="false">
      <path
        d="M38 14v24.5c0 6.9-4.7 11.5-11.2 11.5-4.6 0-8.3-2.2-10.3-5.8l5.3-3.6c1.1 1.9 2.9 3.1 5 3.1 3 0 5-2.1 5-5.4V14z"
        fill="currentColor"
      />
      <circle cx="46" cy="18" r="3.4" fill="currentColor" opacity=".85" />
    </svg>
  );
}

export function AssetIcon({ id, size, mode, className, priority = false, fluid = false }: AssetIconProps) {
  const asset = resolveAsset(id, mode);
  const ratio = asset.box.w && asset.box.h ? asset.box.h / asset.box.w : 1;
  const width = size;
  const height = Math.round(size * ratio);
  const box: CSSProperties = fluid
    ? { width: '100%', height: 'auto', aspectRatio: `${width} / ${height}` }
    : { width, height };
  const common = { className, 'data-asset': asset.id, 'data-asset-mode': asset.mode } as const;

  if (asset.render === 'image') {
    if (asset.monochrome) {
      return (
        <span
          {...common}
          aria-hidden="true"
          style={{
            ...box,
            display: 'inline-block',
            backgroundColor: 'currentColor',
            mask: `url("${asset.src}") center / contain no-repeat`,
            WebkitMask: `url("${asset.src}") center / contain no-repeat`,
          }}
        />
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element -- pre-optimized, content-hashed, fixed-size assets
      <img
        {...common}
        src={asset.src}
        srcSet={asset.srcSet}
        sizes={asset.srcSet ? `${width}px` : undefined}
        width={width}
        height={height}
        alt=""
        draggable={false}
        decoding="async"
        loading={priority ? 'eager' : 'lazy'}
        style={box}
      />
    );
  }
  if (asset.render === 'audio') return null;
  return (
    <span {...common} aria-hidden="true" style={{ ...box, display: 'inline-block', lineHeight: 0 }}>
      <OriginalArt
        source={asset.source}
        id={asset.id}
        width={fluid ? '100%' : width}
        height={fluid ? '100%' : height}
      />
    </span>
  );
}
