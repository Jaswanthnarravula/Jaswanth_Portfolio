/**
 * The macOS overlay table (plans/macos/06-edge-cases.md "Overlay arbiter", E15 / E22): one transient surface at a time,
 * in the order modal dialog › menu › Spotlight › Mission Control › banner. Menus and popovers (menu-bar menus, context
 * menus, Control Center, Notification Center) close whenever something else is asked for — Spotlight invoked with a
 * menu open closes the menu first (surfaces/spotlight.md). Spotlight is ignored while Mission Control is up (E15).
 * Banners never compete and never take focus.
 */
import { arbitrate, pick, type ArbiterTable, type Verdict } from '@/components/os/shared/overlay-arbiter';

export type MacOverlay =
  'dialog' | 'menu' | 'context' | 'control-center' | 'notification-center' | 'spotlight' | 'mission' | 'banner';

export const MAC_OVERLAYS: ArbiterTable<MacOverlay> = {
  priority: ['dialog', 'menu', 'context', 'control-center', 'notification-center', 'spotlight', 'mission', 'banner'],
  dismissable: ['menu', 'context', 'control-center', 'notification-center'],
  coexisting: ['banner'],
  blocks: [
    ['mission', 'spotlight'],
    ['dialog', 'spotlight'],
    ['dialog', 'mission'],
  ],
};

export const arbitrateMac = (open: MacOverlay | null, requested: MacOverlay): Verdict =>
  arbitrate(MAC_OVERLAYS, open, requested);

export const pickMac = (requests: readonly MacOverlay[]): MacOverlay | null => pick(MAC_OVERLAYS, requests);
