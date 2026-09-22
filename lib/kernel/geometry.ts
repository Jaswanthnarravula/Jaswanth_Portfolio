/**
 * Size classes, posture and window geometry — shared/08 `RESP-CLASS-01`, shared/04 `KRN-GEO-01`.
 * Geometry is stored in px, clamped, and bucketed per size class.
 */
import type { Posture, SizeClass } from './ids';
import type { PxRect, SnapZone, Viewport, WindowInstance, WindowPolicy, WorkspaceInsets } from './types';

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

const NO_INSETS: WorkspaceInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/** The window workspace: the page minus the OS chrome (menu bar, Dock, taskbar). */
export function workspaceFor(viewport: Pick<Viewport, 'w' | 'h'>, insets: WorkspaceInsets = NO_INSETS): Workspace {
  return {
    x: insets.left,
    y: insets.top,
    w: Math.max(0, viewport.w - insets.left - insets.right),
    h: Math.max(0, viewport.h - insets.top - insets.bottom),
  };
}

/**
 * A policy's default rect: fractions of the page when the policy places by fraction, else its preferred size centred
 * in the workspace (the page minus the chrome insets), else its px default.
 */
export function defaultRectFor(
  policy: WindowPolicy,
  sizeClass: SizeClass,
  viewport?: Pick<Viewport, 'w' | 'h'>,
  insets?: WorkspaceInsets,
): PxRect {
  const fraction = policy.defaultFraction;
  if (fraction && viewport)
    return {
      x: Math.round(fraction.x * viewport.w),
      y: Math.round(fraction.y * viewport.h),
      w: Math.round(fraction.w * viewport.w),
      h: Math.round(fraction.h * viewport.h),
    };
  const size = policy.centered?.[sizeClass];
  if (size && viewport) {
    const area = workspaceFor(viewport, insets);
    const w = Math.min(size.w, area.w);
    const h = Math.min(size.h, area.h);
    return { x: Math.round(area.x + (area.w - w) / 2), y: Math.round(area.y + (area.h - h) / 2), w, h };
  }
  return policy.defaultRect[sizeClass];
}

/** Geometry for a window in a size class: its own bucket → learned rect → policy default. */
export function rectFor(
  window: Pick<WindowInstance, 'rect'>,
  sizeClass: SizeClass,
  policy: WindowPolicy,
  learned?: Partial<Record<SizeClass, PxRect>>,
  viewport?: Pick<Viewport, 'w' | 'h'>,
  insets?: WorkspaceInsets,
): PxRect {
  return window.rect[sizeClass] ?? learned?.[sizeClass] ?? defaultRectFor(policy, sizeClass, viewport, insets);
}

// --- Snap (plans/windows/02) --------------------------------------------------------------------------------------

/** The ½ + ½ shared edge may move between these fractions of the workspace width. */
export const SNAP_SPLIT_RANGE = [0.25, 0.75] as const;
export const clampSplit = (split: number): number =>
  Number.isFinite(split) ? Math.min(SNAP_SPLIT_RANGE[1], Math.max(SNAP_SPLIT_RANGE[0], split)) : 0.5;

/** The rect a snapped window occupies: a pure function of its zone and the workspace (re-derived on every resize). */
export function snapRect(zone: SnapZone, workspace: Workspace, split = 0.5): PxRect {
  const { x, y, w, h } = workspace;
  const half = Math.round(w * clampSplit(split));
  const midX = Math.round(w / 2);
  const midY = Math.round(h / 2);
  const third = Math.round(w / 3);
  const twoThirds = Math.round((w * 2) / 3);
  switch (zone) {
    case 'left':
      return { x, y, w: half, h };
    case 'right':
      return { x: x + half, y, w: w - half, h };
    case 'tl':
      return { x, y, w: midX, h: midY };
    case 'tr':
      return { x: x + midX, y, w: w - midX, h: midY };
    case 'bl':
      return { x, y: y + midY, w: midX, h: h - midY };
    case 'br':
      return { x: x + midX, y: y + midY, w: w - midX, h: h - midY };
    case 'left-two-thirds':
      return { x, y, w: twoThirds, h };
    case 'third-l':
      return { x, y, w: third, h };
    case 'third-c':
      return { x: x + third, y, w: twoThirds - third, h };
    case 'third-r':
      return { x: x + twoThirds, y, w: w - twoThirds, h };
  }
}

/** Where a drag would snap: an edge (half), a corner (quarter) or the top edge (maximize). */
export type SnapTarget = 'left' | 'right' | 'tl' | 'tr' | 'bl' | 'br' | 'top';

/**
 * The snap target under a dragging pointer: within `edge` px of the left/right edge → that half, or a quarter when
 * the pointer is also within `corner` px of the top/bottom; within `edge` px of the top → maximize.
 */
export function snapTargetAt(
  point: { readonly x: number; readonly y: number },
  workspace: Workspace,
  { edge = 12, corner = 96 }: { edge?: number; corner?: number } = {},
): SnapTarget | null {
  const left = point.x <= workspace.x + edge;
  const right = point.x >= workspace.x + workspace.w - edge;
  const top = point.y <= workspace.y + edge;
  const nearTop = point.y <= workspace.y + corner;
  const nearBottom = point.y >= workspace.y + workspace.h - corner;
  if (left || right) {
    if (nearTop) return left ? 'tl' : 'tr';
    if (nearBottom) return left ? 'bl' : 'br';
    return left ? 'left' : 'right';
  }
  return top ? 'top' : null;
}

export const sameRect = (a: PxRect | undefined, b: PxRect | undefined): boolean =>
  !!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
