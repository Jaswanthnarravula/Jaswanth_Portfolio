/**
 * Context menus as data (plans/macos/surfaces/context-menus.md `MAC-CTX-02`, dock.md `MAC-DOCK-06/07`). Each menu only
 * offers actions that exist elsewhere too (a context menu is never the only way to do something). Pure: the Shell
 * renders the result with the `Menu` primitive and runs the chosen command through `runMacCommand`.
 */
import type { ContentRef } from '@/data/schema';
import type { AppRole } from '@/lib/kernel/ids';
import type { MacCommand } from './commands';
import type { MenuSpec } from './menus';
import type { ContextTarget } from './ui';

export interface ContextFacts {
  /** Apps with a running instance (their Dock dot shows). */
  readonly running: readonly AppRole[];
  /** Apps with a window that is not minimized. */
  readonly visible: readonly AppRole[];
  /** App titles by role (from the registry). */
  readonly titles: Readonly<Partial<Record<AppRole, string>>>;
  readonly compact: boolean;
}

let separators = 0;
const sep = (): MenuSpec => ({ kind: 'separator', id: `ctx-sep-${++separators}` });
const item = (id: string, label: string, command: MacCommand, disabled = false): MenuSpec => ({
  kind: 'item',
  id,
  label,
  command,
  ...(disabled ? { disabled } : {}),
});

const isResume = (ref: ContentRef) => ref.section === 'resume';

export function contextMenuFor(target: ContextTarget, facts: ContextFacts): readonly MenuSpec[] {
  switch (target.kind) {
    case 'desktop':
      return [
        item('new-finder-window', 'New Finder Window', { kind: 'open', role: 'files' }),
        sep(),
        item('change-wallpaper', 'Change Wallpaper…', { kind: 'settings', pane: 'appearance' }),
        item('view-options', 'Show View Options', { kind: 'settings', pane: 'desktop' }, true),
        sep(),
        item('switch-os', 'Switch Operating System…', { kind: 'switch-os' }),
      ];
    case 'item':
      return [
        item('open', 'Open', { kind: 'open-ref', ref: target.ref }),
        // Every app is a singleton window on this Mac (plans/macos/02): shown, never offered.
        item('open-new-window', 'Open in New Window', { kind: 'open-ref', ref: target.ref }, true),
        sep(),
        item('get-info', 'Get Info', { kind: 'get-info', ref: target.ref }),
        item('quick-look', 'Quick Look', { kind: 'quick-look', ref: target.ref }),
        sep(),
        item('copy-link', 'Copy Link', { kind: 'copy-link', ref: target.ref }),
        ...(target.download || isResume(target.ref) ? [item('download', 'Download', { kind: 'resume-download' })] : []),
      ];
    case 'dock': {
      const title = facts.titles[target.role] ?? target.role;
      const running = facts.running.includes(target.role);
      const shown = facts.visible.includes(target.role);
      return [
        item('open', running ? `Show ${title}` : 'Open', { kind: 'open', role: target.role }),
        item('show-all-windows', 'Show All Windows', { kind: 'mission-control' }, !running),
        item('hide', `Hide ${title}`, { kind: 'hide-app', role: target.role }, !shown),
        ...(running ? [sep(), item('quit', `Quit ${title}`, { kind: 'quit', role: target.role })] : []),
        sep(),
        {
          kind: 'submenu',
          id: 'options',
          label: 'Options',
          items: [
            {
              kind: 'checkbox',
              id: 'keep-in-dock',
              label: 'Keep in Dock',
              checked: true,
              command: { kind: 'open', role: target.role },
            },
          ],
          disabled: true,
        },
      ];
    }
    case 'dock-resume':
      return [
        item('open-preview', 'Open in Preview', { kind: 'resume-open' }),
        item('download', 'Download PDF', { kind: 'resume-download' }),
      ];
    case 'handoff':
      return [item('open', 'Open', { kind: 'open', role: 'files' })];
    case 'titlebar':
      return [
        item('minimize', 'Minimize', { kind: 'minimize' }),
        item('zoom', 'Zoom', { kind: 'zoom' }, facts.compact),
        item('move', 'Move', { kind: 'move' }, facts.compact),
        item('size', 'Size', { kind: 'size' }, facts.compact),
        item('center', 'Center', { kind: 'center' }, facts.compact),
        sep(),
        item('close', 'Close', { kind: 'close-window' }),
      ];
    default: {
      const exhaustive: never = target;
      return exhaustive;
    }
  }
}

/** The menu's accessible name. */
export function contextMenuLabel(target: ContextTarget, facts: ContextFacts): string {
  switch (target.kind) {
    case 'desktop':
      return 'Desktop';
    case 'item':
      return target.label;
    case 'dock':
      return `${facts.titles[target.role] ?? target.role} (Dock)`;
    case 'dock-resume':
      return 'Résumé';
    case 'handoff':
      return 'Handoff';
    case 'titlebar':
      return `${facts.titles[target.role] ?? target.role} window`;
  }
}

export interface MenuBox {
  readonly w: number;
  readonly h: number;
}

export interface Workspace {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Coarse pointers: the menu sits above the finger by this much (plans/macos/surfaces/context-menus "Responsive"). */
export const FINGER_OFFSET = 12;
/** Gap kept between the menu and the workspace edges. */
const EDGE = 4;

/**
 * Where a context menu goes (`MAC-CTX-01`): at the pointer, flipped left / up when it would overflow, then clamped
 * inside the workspace — never under the menu bar or the Dock. On coarse pointers it opens above the finger.
 */
export function placeMenu(
  point: { readonly x: number; readonly y: number },
  box: MenuBox,
  space: Workspace,
  { coarse = false }: { coarse?: boolean } = {},
): { x: number; y: number } {
  let x = point.x;
  let y = coarse ? point.y - FINGER_OFFSET - box.h : point.y;
  if (x + box.w > space.right - EDGE) x = point.x - box.w;
  if (!coarse && y + box.h > space.bottom - EDGE) y = point.y - box.h;
  if (coarse && y < space.top + EDGE) y = point.y + FINGER_OFFSET;
  const maxX = Math.max(space.left + EDGE, space.right - EDGE - box.w);
  const maxY = Math.max(space.top + EDGE, space.bottom - EDGE - box.h);
  return {
    x: Math.round(Math.min(maxX, Math.max(space.left + EDGE, x))),
    y: Math.round(Math.min(maxY, Math.max(space.top + EDGE, y))),
  };
}
