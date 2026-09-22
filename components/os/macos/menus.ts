/**
 * The menu bar's menus as data (plans/macos/surfaces/menu-bar.md `MAC-MENU-02/05/07/08`; each app's "Menu-bar menus"
 * section in plans/macos/apps/*). The bar shows the Apple menu, the focused app's bold menu, that app's own menus,
 * Window and Help — "Finder" and its menus when no window is focused, as on a real Mac. Shortcut hints are labels only
 * and come from the keymap registry (the chords this site actually handles — never ⌘ combos the browser would take).
 * Compact collapses the app's menus into one menu of submenus.
 */
import type { AppRole } from '@/lib/kernel/ids';
import { formatChord, SHORTCUTS, type ShortcutId } from '@/lib/kernel/keymap';
import type { WindowId } from '@/lib/kernel/types';
import type { MacCommand, SettingsPane } from './commands';

export type MenuSpec =
  | {
      readonly kind: 'item';
      readonly id: string;
      readonly label: string;
      readonly command: MacCommand;
      readonly shortcut?: ShortcutId;
      readonly disabled?: boolean;
    }
  | {
      readonly kind: 'checkbox';
      readonly id: string;
      readonly label: string;
      readonly checked: boolean;
      readonly command: MacCommand;
    }
  | { readonly kind: 'separator'; readonly id: string }
  | {
      readonly kind: 'submenu';
      readonly id: string;
      readonly label: string;
      readonly items: readonly MenuSpec[];
      readonly disabled?: boolean;
    };

export interface MenuBarMenu {
  readonly id: string;
  readonly label: string;
  readonly items: readonly MenuSpec[];
}

export interface MenuContext {
  /** The focused app (null → Finder, as on a real Mac). */
  readonly role: AppRole | null;
  readonly appName: string;
  /** A window is focused (window items are enabled). */
  readonly windowOpen: boolean;
  readonly zoomed: boolean;
  readonly compact: boolean;
  /** The touch posture (medium / coarse pointer): the Window menu adds Tile Left / Tile Right / Fill. */
  readonly touch?: boolean;
  readonly windows: readonly { readonly id: WindowId; readonly label: string; readonly focused: boolean }[];
  readonly projects: readonly {
    readonly slug: string;
    readonly name: string;
    readonly repo?: string;
    readonly live?: string;
  }[];
  /** App state the menus reflect (checkmarks), keyed `role:setting`. */
  readonly appState?: Readonly<Record<string, string | boolean | undefined>>;
  readonly vscodeFiles?: readonly { readonly id: string; readonly label: string }[];
}

let separators = 0;
const sep = (): MenuSpec => ({ kind: 'separator', id: `sep-${++separators}` });
const item = (
  id: string,
  label: string,
  command: MacCommand,
  extra: { shortcut?: ShortcutId; disabled?: boolean } = {},
): MenuSpec => ({
  kind: 'item',
  id,
  label,
  command,
  ...extra,
});
const app = (role: AppRole, command: string, arg?: string): MacCommand => ({
  kind: 'app',
  role,
  command,
  ...(arg ? { arg } : {}),
});
const check = (id: string, label: string, checked: boolean, command: MacCommand): MenuSpec => ({
  kind: 'checkbox',
  id,
  label,
  checked,
  command,
});

/** The label for a registry shortcut: `⌥⇧W` on Apple keyboards, `Alt+Shift+W` elsewhere. */
export function shortcutLabel(id: ShortcutId, apple: boolean): string | undefined {
  const shortcut = SHORTCUTS.find((candidate) => candidate.id === id);
  const chord = shortcut?.chords[0];
  return chord ? formatChord(chord, apple) : undefined;
}

export function appleMenu(): MenuBarMenu {
  return {
    id: 'apple',
    label: 'Apple',
    items: [
      item('about-this-mac', 'About This Mac', { kind: 'about-this-mac' }),
      item('settings', 'System Settings…', { kind: 'settings' }),
      sep(),
      item('switch-os', 'Switch Operating System…', { kind: 'switch-os' }, { shortcut: 'switch-os' }),
      item('tour', 'Take the Tour', { kind: 'tour' }),
      sep(),
      item('lock', 'Lock Screen', { kind: 'lock' }),
      item('restart', 'Restart…', { kind: 'restart' }),
    ],
  };
}

function appMenu(ctx: MenuContext): MenuBarMenu {
  const role = ctx.role ?? 'files';
  return {
    id: 'app',
    label: ctx.appName,
    items: [
      item('about-app', `About ${ctx.appName}`, { kind: 'about-app', role }),
      item('app-settings', 'Settings…', { kind: 'settings' }),
      sep(),
      item('hide-app', `Hide ${ctx.appName}`, { kind: 'hide-app', role }, { disabled: !ctx.windowOpen }),
      item(
        'hide-others',
        'Hide Others',
        { kind: 'hide-others' },
        { disabled: !ctx.windowOpen || ctx.windows.length < 2 },
      ),
      item('show-all', 'Show All', { kind: 'show-all' }),
      sep(),
      item('quit', `Quit ${ctx.appName}`, { kind: 'quit', role }),
    ],
  };
}

const SETTINGS_PANES: readonly [SettingsPane, string][] = [
  ['appearance', 'Appearance'],
  ['accessibility', 'Accessibility'],
  ['sound', 'Sound'],
  ['desktop', 'Desktop & Dock'],
  ['keyboard', 'Keyboard'],
  ['privacy', 'Privacy'],
  ['general', 'General'],
];

/** Each app's own menus (plans/macos/apps/*.md "Menu-bar menus"). */
function ownMenus(ctx: MenuContext): MenuBarMenu[] {
  const role = ctx.role ?? 'files';
  const state = ctx.appState ?? {};
  const close = item(
    'close-window',
    'Close Window',
    { kind: 'close-window' },
    { shortcut: 'close-window', disabled: !ctx.windowOpen },
  );
  switch (role) {
    case 'files': {
      const view = (state['files:view'] as string | undefined) ?? 'columns';
      return [
        {
          id: 'file',
          label: 'File',
          items: [
            item('new-finder-window', 'New Finder Window', { kind: 'open', role: 'files' }),
            item('get-info', 'Get Info', app('files', 'get-info'), { disabled: !ctx.windowOpen }),
            item('quick-look', 'Quick Look', app('files', 'quick-look'), { disabled: !ctx.windowOpen }),
            sep(),
            close,
          ],
        },
        {
          id: 'edit',
          label: 'Edit',
          items: [
            item('undo', 'Undo', app('files', 'undo'), { disabled: true }),
            sep(),
            item('select-all', 'Select All', { kind: 'select-all-desktop' }),
          ],
        },
        {
          id: 'view',
          label: 'View',
          items: [
            check('as-icons', 'as Icons', view === 'icons', app('files', 'view', 'icons')),
            check('as-list', 'as List', view === 'list', app('files', 'view', 'list')),
            check('as-columns', 'as Columns', view === 'columns', app('files', 'view', 'columns')),
            sep(),
            check('path-bar', 'Show Path Bar', state['files:pathBar'] !== false, app('files', 'toggle-path-bar')),
            check(
              'status-bar',
              'Show Status Bar',
              state['files:statusBar'] !== false,
              app('files', 'toggle-status-bar'),
            ),
          ],
        },
        {
          id: 'go',
          label: 'Go',
          items: [
            item('back', 'Back', app('files', 'back'), { disabled: !ctx.windowOpen }),
            item('forward', 'Forward', app('files', 'forward'), { disabled: !ctx.windowOpen }),
            sep(),
            item('go-experience', 'Experience', { kind: 'open-ref', ref: { section: 'experience' } }),
            item('go-education', 'Education', { kind: 'open-ref', ref: { section: 'education' } }),
            item('go-projects', 'Projects', { kind: 'open-ref', ref: { section: 'projects' } }),
            item('go-resume', 'Résumé', { kind: 'resume-open' }),
            item('go-home', 'Home', { kind: 'open', role: 'files', location: { kind: 'root' } }),
          ],
        },
      ];
    }
    case 'browser':
      return [
        {
          id: 'file',
          label: 'File',
          items: [
            item('new-tab', 'New Tab', app('browser', 'new-tab')),
            item('close-tab', 'Close Tab', app('browser', 'close-tab')),
            sep(),
            close,
          ],
        },
        {
          id: 'view',
          label: 'View',
          items: [
            item('reload', 'Reload Page', app('browser', 'reload')),
            check(
              'favourites',
              'Show Favourites Bar',
              state['browser:favourites'] !== false,
              app('browser', 'toggle-favourites'),
            ),
          ],
        },
        {
          id: 'history',
          label: 'History',
          items: [
            item('history-about', 'About', app('browser', 'tab', 'about')),
            item('history-now', 'Now', app('browser', 'tab', 'now')),
          ],
        },
        {
          id: 'bookmarks',
          label: 'Bookmarks',
          items: [
            item('bm-github', 'GitHub', { kind: 'open', role: 'github' }),
            item('bm-resume', 'Résumé', { kind: 'resume-open' }),
            item('bm-mail', 'Mail', { kind: 'open', role: 'mail' }),
          ],
        },
      ];
    case 'github': {
      const current = state['github:project'] as string | undefined;
      const project = ctx.projects.find((entry) => entry.slug === current);
      return [
        { id: 'file', label: 'File', items: [close] },
        {
          id: 'view',
          label: 'View',
          items: [
            item('pinned', 'Pinned', app('github', 'list')),
            item('all-repos', 'All Repositories', app('github', 'all')),
            {
              kind: 'submenu',
              id: 'projects',
              label: 'Projects',
              items: ctx.projects.map((entry) =>
                item(`project-${entry.slug}`, entry.name, {
                  kind: 'open-ref',
                  ref: { section: 'projects', slug: entry.slug },
                }),
              ),
            },
            sep(),
            item('reload', 'Reload', app('github', 'reload')),
          ],
        },
        {
          id: 'repository',
          label: 'Repository',
          items: [
            item('open-github', 'Open on GitHub ↗', app('github', 'open-repo'), { disabled: !project?.repo }),
            item('open-live', 'Open Live Site ↗', app('github', 'open-live'), { disabled: !project?.live }),
            item(
              'copy-link',
              'Copy Link',
              project
                ? { kind: 'copy-link', ref: { section: 'projects', slug: project.slug } }
                : { kind: 'copy-link', ref: { section: 'projects' } },
            ),
          ],
        },
      ];
    }
    case 'viewer':
      return [
        {
          id: 'file',
          label: 'File',
          items: [
            item('download', 'Download', { kind: 'resume-download' }),
            item('print', 'Print…', app('viewer', 'print')),
            sep(),
            close,
          ],
        },
        {
          id: 'view',
          label: 'View',
          items: [
            check('thumbnails', 'Thumbnails', state['viewer:thumbnails'] !== false, app('viewer', 'toggle-thumbnails')),
            sep(),
            item('zoom-in', 'Zoom In', app('viewer', 'zoom-in')),
            item('zoom-out', 'Zoom Out', app('viewer', 'zoom-out')),
            item('actual-size', 'Actual Size', app('viewer', 'actual-size')),
            sep(),
            check('text-version', 'Text Version', state['viewer:text'] === true, app('viewer', 'toggle-text')),
          ],
        },
        {
          id: 'go',
          label: 'Go',
          items: [
            item('next-page', 'Next Page', app('viewer', 'next-page')),
            item('previous-page', 'Previous Page', app('viewer', 'previous-page')),
          ],
        },
      ];
    case 'mail':
      return [
        {
          id: 'file',
          label: 'File',
          items: [item('new-message', 'New Message', app('mail', 'compose')), sep(), close],
        },
        {
          id: 'message',
          label: 'Message',
          items: [
            item('reply', 'Reply', app('mail', 'reply')),
            item('copy-address', 'Copy Address', app('mail', 'copy-address')),
          ],
        },
        {
          id: 'mailbox',
          label: 'Mailbox',
          items: [
            item('inbox', 'Inbox', app('mail', 'mailbox', 'inbox')),
            item('sent', 'Sent', app('mail', 'mailbox', 'sent')),
            item('drafts', 'Drafts', app('mail', 'mailbox', 'drafts')),
          ],
        },
      ];
    case 'editor':
      return [
        {
          id: 'file',
          label: 'File',
          items: [
            item('open-file', 'Open File…', app('editor', 'quick-open')),
            item('close-tab', 'Close Tab', app('editor', 'close-tab')),
            sep(),
            close,
          ],
        },
        {
          id: 'view',
          label: 'View',
          items: [
            item('explorer', 'Explorer', app('editor', 'view', 'explorer')),
            item('search', 'Search', app('editor', 'view', 'search')),
            item('extensions', 'Extensions', app('editor', 'view', 'extensions')),
            sep(),
            check('panel', 'Toggle Panel', state['editor:panel'] === true, app('editor', 'toggle-panel')),
            check('minimap', 'Toggle Minimap', state['editor:minimap'] !== false, app('editor', 'toggle-minimap')),
          ],
        },
        {
          id: 'go',
          label: 'Go',
          items: (ctx.vscodeFiles ?? []).map((file) =>
            item(`go-${file.id}`, file.label, app('editor', 'open', file.id)),
          ),
        },
        {
          id: 'terminal',
          label: 'Terminal',
          items: [item('new-terminal', 'New Terminal', app('editor', 'new-terminal'))],
        },
      ];
    case 'terminal':
      return [
        {
          id: 'shell',
          label: 'Shell',
          items: [
            item('new-tab', 'New Tab', app('terminal', 'new-tab')),
            item('close-tab', 'Close Tab', app('terminal', 'close-tab')),
            sep(),
            item('clear', 'Clear to Start', app('terminal', 'clear')),
            sep(),
            close,
          ],
        },
        {
          id: 'edit',
          label: 'Edit',
          items: [
            item('copy', 'Copy', app('terminal', 'copy')),
            item('paste', 'Paste', app('terminal', 'paste')),
            item('select-all', 'Select All', app('terminal', 'select-all')),
          ],
        },
        {
          id: 'view',
          label: 'View',
          items: [
            item('bigger', 'Bigger', app('terminal', 'bigger')),
            item('smaller', 'Smaller', app('terminal', 'smaller')),
          ],
        },
      ];
    case 'settings':
      return [
        {
          id: 'view',
          label: 'View',
          items: SETTINGS_PANES.map(([pane, label]) => item(`pane-${pane}`, label, { kind: 'settings', pane })),
        },
      ];
    default:
      return [{ id: 'file', label: 'File', items: [close] }];
  }
}

function windowMenu(ctx: MenuContext): MenuBarMenu {
  return {
    id: 'window',
    label: 'Window',
    items: [
      item('minimize', 'Minimize', { kind: 'minimize' }, { shortcut: 'minimize-window', disabled: !ctx.windowOpen }),
      item(
        'zoom',
        ctx.zoomed ? 'Restore' : 'Zoom',
        { kind: 'zoom' },
        { shortcut: 'maximize-window', disabled: !ctx.windowOpen || ctx.compact },
      ),
      item('move', 'Move', { kind: 'move' }, { disabled: !ctx.windowOpen || ctx.compact }),
      item('size', 'Size', { kind: 'size' }, { disabled: !ctx.windowOpen || ctx.compact }),
      item('center', 'Center', { kind: 'center' }, { disabled: !ctx.windowOpen || ctx.compact }),
      ...(ctx.touch && !ctx.compact
        ? [
            sep(),
            item('tile-left', 'Tile Left', { kind: 'tile', side: 'left' }, { disabled: !ctx.windowOpen }),
            item('tile-right', 'Tile Right', { kind: 'tile', side: 'right' }, { disabled: !ctx.windowOpen }),
            item('fill', 'Fill', { kind: 'tile', side: 'fill' }, { disabled: !ctx.windowOpen }),
          ]
        : []),
      sep(),
      item('mission-control', 'Mission Control', { kind: 'mission-control' }, { shortcut: 'overview' }),
      ...(ctx.windows.length ? [sep()] : []),
      ...ctx.windows.map((window) =>
        check(`window-${window.id}`, window.label, window.focused, { kind: 'focus-window', id: window.id }),
      ),
    ],
  };
}

function helpMenu(): MenuBarMenu {
  return {
    id: 'help',
    label: 'Help',
    items: [
      item('shortcuts', 'Keyboard Shortcuts', { kind: 'shortcuts' }, { shortcut: 'help' }),
      item('spotlight', 'Search', { kind: 'spotlight' }, { shortcut: 'search' }),
      sep(),
      item('plain', 'Skip to plain portfolio', { kind: 'plain' }),
    ],
  };
}

/** The whole bar for the focused app. */
export function menuBarFor(ctx: MenuContext): readonly MenuBarMenu[] {
  const own = [appMenu(ctx), ...ownMenus(ctx), windowMenu(ctx), helpMenu()];
  if (!ctx.compact) return [appleMenu(), ...own];
  // Compact: `` · AppName ▾`` — one menu holding the app menu's items and the rest as submenus.
  const [first, ...rest] = own;
  return [
    appleMenu(),
    {
      id: 'app',
      label: ctx.appName,
      items: [
        ...first!.items,
        sep(),
        ...rest.map((menu): MenuSpec => ({
          kind: 'submenu',
          id: `sub-${menu.id}`,
          label: menu.label,
          items: menu.items,
        })),
      ],
    },
  ];
}
