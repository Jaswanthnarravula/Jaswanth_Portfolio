import type { ContentRef } from '@/data/schema';
import { getBinding } from '@/lib/kernel/registry';

export const ANDROID_ROLES = ['files', 'browser', 'github', 'mail', 'notes', 'settings'] as const;
export type AndroidRole = (typeof ANDROID_ROLES)[number];

export type AndroidOverlay = 'drawer' | 'shade' | 'recents' | 'folder' | 'shortcuts' | 'wallpaper-menu' | 'switch-os';

export const HOME_APPS: readonly AndroidRole[] = ['github', 'notes', 'settings'];
export const FAVORITES: readonly AndroidRole[] = ['files', 'browser', 'github', 'mail'];
export const DRAWER_APPS: readonly AndroidRole[] = ['browser', 'files', 'mail', 'github', 'notes', 'settings'];

export const androidBinding = (role: AndroidRole) => {
  const binding = getBinding('android', role);
  if (!binding) throw new Error(`Android binding missing for ${role}`);
  return binding;
};

export const androidIcon = (role: AndroidRole): string => androidBinding(role).icon;

export const ROLE_LABEL: Readonly<Record<AndroidRole, string>> = {
  browser: 'Chrome',
  files: 'Files',
  github: 'GitHub',
  mail: 'Gmail',
  notes: 'Keep',
  settings: 'Settings',
};

export const ROLE_GLYPH: Readonly<Record<AndroidRole, string>> = {
  browser: 'language',
  files: 'folder',
  github: 'account_tree',
  mail: 'mail',
  notes: 'lightbulb',
  settings: 'settings',
};

export interface AndroidNotification {
  readonly id: string;
  readonly role: AndroidRole;
  readonly app: string;
  readonly title: string;
  readonly body: string;
  readonly ref?: ContentRef;
  readonly silent?: boolean;
}

export function baseNotifications(input: {
  readonly updated: string;
  readonly projectCount: number;
  readonly featured: string;
  readonly openTo: string;
}): readonly AndroidNotification[] {
  return [
    {
      id: 'resume',
      role: 'files',
      app: 'Files',
      title: 'Résumé ready to view',
      body: `Updated ${input.updated}`,
      ref: { section: 'resume' },
    },
    {
      id: 'projects',
      role: 'github',
      app: 'GitHub',
      title: `${input.projectCount} projects`,
      body: `${input.featured} and more`,
      ref: { section: 'projects' },
    },
    {
      id: 'contact',
      role: 'mail',
      app: 'Gmail',
      title: input.openTo,
      body: 'Say hello',
      ref: { section: 'contact' },
      silent: true,
    },
  ];
}

export type BackLayer =
  'dialog' | 'sheet' | 'menu' | 'query' | 'shade-expanded' | 'overlay' | 'app-stack' | 'app-root' | 'launcher';

/** The Android Back contract, kept pure so all input sources share one ordering. */
export function resolveBack(input: {
  readonly dialog: boolean;
  readonly sheet: boolean;
  readonly menu: boolean;
  readonly query: boolean;
  readonly shadeExpanded: boolean;
  readonly overlay: boolean;
  readonly appDepth: number;
  readonly appOpen: boolean;
}): BackLayer {
  if (input.dialog) return 'dialog';
  if (input.sheet) return 'sheet';
  if (input.menu) return 'menu';
  if (input.query) return 'query';
  if (input.shadeExpanded) return 'shade-expanded';
  if (input.overlay) return 'overlay';
  if (input.appOpen && input.appDepth > 0) return 'app-stack';
  if (input.appOpen) return 'app-root';
  return 'launcher';
}

export const navMode = (preference: 'auto' | 'gesture' | 'buttons', pointer: 'fine' | 'coarse' | 'none') =>
  preference === 'auto' ? (pointer === 'fine' ? 'buttons' : 'gesture') : preference;

export const schemeFor = (palette: 'sage' | 'blue' | 'violet' | 'coral') => palette;

export const appShortcutLabels = (role: AndroidRole, projects: readonly string[] = []): readonly string[] => {
  switch (role) {
    case 'files':
      return ['Open résumé', 'Download résumé', 'Experience', 'Education'];
    case 'github':
      return projects.slice(0, 4);
    case 'mail':
      return ['Compose', 'Copy address'];
    case 'browser':
      return ['About Jaswanth', 'Plain version'];
    case 'notes':
      return ['Skills', 'How I work'];
    case 'settings':
      return ['Accessibility', 'Switch OS'];
  }
};
