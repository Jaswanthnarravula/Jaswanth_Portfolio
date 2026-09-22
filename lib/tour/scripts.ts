/**
 * Tour scripts per OS (shared/20 "Standard graphical script"; each OS's `07-cross-os-features.md` owns the wording and
 * the anchors). Every action is a real kernel action (`TOUR-REAL-01`) — the tour demonstrates true behaviour. OSes add
 * their script in their own phase.
 */
import { focusKeys } from '@/lib/kernel/types';
import type { TourScript } from './index';

/** plans/macos/07-cross-os-features.md "Guided tour": Dock → Safari · GitHub · traffic lights · résumé stack · Spotlight. */
export const MACOS_TOUR: TourScript = {
  os: 'macos',
  home: focusKeys.home('macos'),
  steps: [
    {
      id: 'apps',
      say: 'Everything here is an app — this is the Dock.',
      pointAt: 'mac-dock',
      action: { type: 'OPEN_APP', os: 'macos', role: 'browser', originId: 'dock-safari' },
      waitFor: 'settled',
    },
    {
      id: 'projects',
      say: 'Projects live in GitHub.',
      pointAt: 'dock-github',
      action: { type: 'OPEN_APP', os: 'macos', role: 'github', originId: 'dock-github' },
      waitFor: 'settled',
    },
    { id: 'windows', say: 'Windows move, minimize and zoom.', pointAt: 'mac-lights-github', waitFor: 5000 },
    { id: 'resume', say: 'The résumé is always one click away.', pointAt: 'dock-resume', waitFor: 5000 },
    { id: 'search', say: 'Spotlight finds anything — Ctrl/Cmd+K.', pointAt: 'menubar-spotlight', waitFor: 5000 },
  ],
};

/**
 * plans/windows/07-cross-os-features.md "Guided tour": Start → Edge → GitHub snapped beside it (Snap, shown honestly)
 * → the pinned résumé → Search. The Windows shell opens Start for step 1 and snaps the pair on step 3 (real kernel
 * actions); every other step is a real `OPEN_APP` or a pointer.
 */
export const WINDOWS_TOUR: TourScript = {
  os: 'windows',
  home: focusKeys.home('windows'),
  steps: [
    { id: 'start', say: 'Everything starts here.', pointAt: 'tb-start', waitFor: 5000 },
    {
      id: 'overview',
      say: 'This is the overview.',
      pointAt: 'tb-edge',
      action: { type: 'OPEN_APP', os: 'windows', role: 'browser', originId: 'tb-edge' },
      waitFor: 'settled',
    },
    {
      id: 'snap',
      say: 'Projects live in GitHub — and windows snap side by side.',
      pointAt: 'tb-github',
      action: { type: 'OPEN_APP', os: 'windows', role: 'github', originId: 'tb-github' },
      waitFor: 'settled',
    },
    { id: 'resume', say: 'The résumé is pinned to your taskbar.', pointAt: 'tb-resume', waitFor: 5000 },
    { id: 'search', say: 'Search finds anything — Ctrl+K.', pointAt: 'tb-search', waitFor: 5000 },
  ],
};
