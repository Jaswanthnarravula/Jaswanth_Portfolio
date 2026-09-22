/**
 * Edge refraction for the Hello lens — owner decision 2026-09-21 (plans/06 Deviations log), after the technique of
 * GlassiFy (github.com/Saviru/GlassiFy, MIT): the backdrop is bent through an SVG displacement map inside
 * `backdrop-filter`. The map here is our own, generated for the lens's exact size and corner radius: neutral inside,
 * and within `band` of the rim it pushes each sample outward along the edge normal, strongest at the rim — so the
 * field's colours outside the glass bend into its edge, as Liquid Glass bends what is around it.
 *   - Outward samples must stay inside the filter's input, so the refracting layer is `margin` larger than the lens on
 *     every side and clipped back to the lens (`margin` ≥ `scale` / 2).
 *   - Normals come from a rounder rectangle (radius ≥ the band), so the corners bend smoothly instead of along a mitre.
 *   - Chromium only (Safari and Firefox do not run SVG filters inside `backdrop-filter`); anywhere else, and on T0 or
 *     solid glass, the lens keeps its CSS glass. A slow first flight (`flightFailed`) turns it off for the page.
 */
import { forcedRefraction } from '@/lib/kernel/persist/storage';
import { sampleFrames } from '@/lib/motion/frames';
import { flightFailed } from '@/lib/motion/governor';

export const LENS_REFRACTION = {
  /** Width of the bending band inside the rim (CSS px). */
  band: 120,
  /** feDisplacementMap scale: the largest bend is scale / 2 CSS px, at the rim. */
  scale: 260,
  /** Profile exponent: higher keeps the bend closer to the rim. */
  power: 2,
  /** How far the refracting layer reaches past the lens (CSS px). */
  margin: 135,
  /** Map pixels per CSS px (the map is stretched smoothly over the layer). */
  resolution: 0.5,
} as const;

export interface RefractionMap {
  readonly width: number;
  readonly height: number;
  /** RGBA: R = x bend, G = y bend (128 = none), B = 128, A = 255. */
  readonly data: Uint8ClampedArray<ArrayBuffer>;
}

/** Signed distance to a rounded rectangle centred at (cx, cy) with half sizes (hx, hy) and corner radius r. */
function roundRect(x: number, y: number, cx: number, cy: number, hx: number, hy: number, r: number): number {
  const qx = Math.abs(x - cx) - (hx - r);
  const qy = Math.abs(y - cy) - (hy - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** The displacement map for a `width` × `height` lens with corner `radius` (all CSS px). Deterministic. */
export function refractionMap(
  width: number,
  height: number,
  radius: number,
  { band, margin, power, resolution }: Omit<typeof LENS_REFRACTION, 'scale'> = LENS_REFRACTION,
): RefractionMap {
  const k = resolution;
  const w = Math.max(1, Math.round((width + 2 * margin) * k));
  const h = Math.max(1, Math.round((height + 2 * margin) * k));
  const cx = w / 2;
  const cy = h / 2;
  const hx = (width / 2) * k;
  const hy = (height / 2) * k;
  const r = Math.min(radius * k, hx, hy);
  const b = band * k;
  const rn = Math.min(Math.max(r, b * 1.15), hx, hy);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const d = roundRect(px, py, cx, cy, hx, hy, r);
      let bx = 0;
      let by = 0;
      if (d <= 0 && d > -b) {
        const gx = roundRect(px + 0.5, py, cx, cy, hx, hy, rn) - roundRect(px - 0.5, py, cx, cy, hx, hy, rn);
        const gy = roundRect(px, py + 0.5, cx, cy, hx, hy, rn) - roundRect(px, py - 0.5, cx, cy, hx, hy, rn);
        const length = Math.hypot(gx, gy) || 1;
        const m = Math.pow(1 + d / b, power);
        bx = (gx / length) * m;
        by = (gy / length) * m;
      }
      const i = (y * w + x) * 4;
      data[i] = Math.round(128 + 127 * bx);
      data[i + 1] = Math.round(128 + 127 * by);
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

export interface RefractionEnvironment {
  /** `navigator.userAgentData` exists only in Chromium, the one engine that runs SVG filters in `backdrop-filter`. */
  readonly chromium: boolean;
  readonly dataset: DOMStringMap;
  readonly matches: (query: string) => boolean;
}

/** Chromium, full glass, not T0, and a desktop-class screen (the bend is sized for the desktop lens). */
export function refractionEligible({ chromium, dataset, matches }: RefractionEnvironment): boolean {
  return (
    chromium &&
    dataset.glass === 'full' &&
    dataset.tier !== '0' &&
    matches('(pointer: fine)') &&
    matches('(min-width: 1024px)') &&
    !matches('(forced-colors: active)')
  );
}

/**
 * Starts the lens refraction: paints the map and puts it in `filter` as its first primitive (an `<feImage>` created
 * only now, with its href, so no empty URL is ever fetched), marks `<html data-refract="on">` (CSS then swaps the
 * lens's blur for the refracting layer), repaints on resize, and after one sampled flight either keeps it or marks
 * `data-refract="slow"` (CSS falls back to the blur). Aborting `signal` undoes it.
 */
export function startLensRefraction(lens: HTMLElement, filter: SVGFilterElement, signal: AbortSignal): void {
  const html = document.documentElement;
  const env: RefractionEnvironment = {
    chromium: 'userAgentData' in navigator,
    dataset: html.dataset,
    matches: (query) => window.matchMedia(query).matches,
  };
  if (!refractionEligible(env)) return;
  const canvas = document.createElement('canvas');
  const image = document.createElementNS('http://www.w3.org/2000/svg', 'feImage');
  image.setAttribute('preserveAspectRatio', 'none');
  image.setAttribute('result', 'map');
  image.setAttribute('data-refract-map', '');
  const paint = (): boolean => {
    const rect = lens.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const radius = Number.parseFloat(getComputedStyle(lens).borderTopLeftRadius) || 0;
    const map = refractionMap(rect.width, rect.height, radius);
    canvas.width = map.width;
    canvas.height = map.height;
    const context = canvas.getContext('2d');
    if (!context) return false;
    context.putImageData(new ImageData(map.data, map.width, map.height), 0, 0);
    image.setAttribute('href', canvas.toDataURL());
    return true;
  };
  if (!paint()) return;
  filter.prepend(image);
  html.dataset.refract = 'on';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const observer = new ResizeObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(paint, 150);
  });
  observer.observe(lens);
  const stop = (state?: 'slow') => {
    observer.disconnect();
    clearTimeout(timer);
    if (state) html.dataset.refract = state;
    else delete html.dataset.refract;
    image.remove();
  };
  signal.addEventListener('abort', () => stop(), { once: true });
  if (forcedRefraction()) return; // CI: software rendering always fails the frame check
  void sampleFrames(1500, signal).then((deltas) => {
    if (!signal.aborted && flightFailed(deltas)) stop('slow');
  });
}
