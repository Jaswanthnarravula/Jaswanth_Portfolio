/**
 * Size classes, posture and window geometry — shared/08 `RESP-CLASS-01`, shared/04 `KRN-GEO-01`.
 * Geometry is stored in px, clamped, and bucketed per size class.
 */
import type { Posture, SizeClass } from './ids';
import type { PxRect, Viewport, WindowInstance, WindowPolicy } from './types';

export type PointerKind = 'fine' | 'coarse' | 'none';

/** `compact`: < 700 wide or < 500 tall · `medium`: 700–1099 · `expanded`: 1100–1599 · `large`: ≥ 1600. */
export function classify(w: number, h: number): SizeClass {
  if (w < 700 || h < 500) return 'compact';
  if (w < 1100) return 'medium';
  if (w < 1600) return 'expanded';
  return 'large';
}

/** Kernel posture only gates behaviour; CSS decides layout (same DOM in every posture). */
export function postureFor(sizeClass: SizeClass, pointer: PointerKind): Posture {
  if (sizeClass === 'compact') return 'compact';
  if (sizeClass === 'medium' || pointer === 'coarse') return 'touch';
  return 'pointer';
}

export function viewportFor(w: number, h: number, pointer: PointerKind): Viewport {
  const sizeClass = classify(w, h);
  return { w, h, sizeClass, posture: postureFor(sizeClass, pointer), orientation: w >= h ? 'landscape' : 'portrait' };
}

/** Pixels of title bar that must stay reachable on every edge. */
export const TITLE_REACH = 48;

export interface Workspace {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/** Clamp a rect into the workspace, keeping ≥ 48 px of its title bar on-screen and respecting the minimum size. */
export function clampGeometry(rect: PxRect, workspace: Workspace, minPx: { w: number; h: number }): PxRect {
  const w = Math.round(clamp(rect.w, Math.min(minPx.w, workspace.w), workspace.w));
  const h = Math.round(clamp(rect.h, Math.min(minPx.h, workspace.h), workspace.h));
  const x = Math.round(clamp(rect.x, workspace.x - w + TITLE_REACH, workspace.x + workspace.w - TITLE_REACH));
  const y = Math.round(clamp(rect.y, workspace.y, workspace.y + workspace.h - TITLE_REACH));
  return { x, y, w, h };
}

/** Geometry for a window in a size class: its own bucket → learned rect → policy default. */
export function rectFor(
  window: Pick<WindowInstance, 'rect'>,
  sizeClass: SizeClass,
  policy: WindowPolicy,
  learned?: Partial<Record<SizeClass, PxRect>>,
): PxRect {
  return window.rect[sizeClass] ?? learned?.[sizeClass] ?? policy.defaultRect[sizeClass];
}

export const sameRect = (a: PxRect | undefined, b: PxRect | undefined): boolean =>
  !!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
