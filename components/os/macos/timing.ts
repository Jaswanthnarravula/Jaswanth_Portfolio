/**
 * The macOS timing table (plans/macos/03-motion.md `MAC-MOTION-01`) for the P3 surfaces — menus, the Dock, Spotlight,
 * banners, the Notification Center, Mission Control, sheets, the lock screen and Settings. Window motion (open, close,
 * minimize, restore, zoom, the exit beat, the Finder column push) lives in `MAC_MOTION` (./motion). Components read
 * these tokens (JS) or the matching `--mac-dur-*` custom properties (CSS); no duration or curve is typed anywhere else.
 */
export const EASE_OUT = 'cubic-bezier(0.2, 0.9, 0.3, 1)';
export const EASE_IN = 'cubic-bezier(0.4, 0, 1, 1)';
export const EASE_OVERVIEW = 'cubic-bezier(0.3, 0, 0.1, 1)';

export const MAC_TIMING = {
  /** Menus open in 0 ms; a chosen item blinks for 60 ms; the menu fades out over 130 ms. */
  menu: { openMs: 0, blinkMs: 60, fadeOutMs: 130 },
  /** Dock magnification envelope spring (per-icon transforms); launch bounce only while loading. */
  dock: { magnify: { response: 0.18, damping: 1 }, bounceMs: 520, bouncePx: 18 },
  spotlight: { inMs: 120, inScale: 0.98, outMs: 100, ease: EASE_OUT },
  banner: { in: { response: 0.4, damping: 0.85 }, outMs: 250, outEase: 'cubic-bezier(0.4, 0, 1, 1)', dwellMs: 6000 },
  center: { ms: 300, ease: EASE_OUT },
  mission: { ms: 420, ease: EASE_OVERVIEW },
  sheet: { dropMs: 260, liftMs: 200, ease: EASE_OUT, liftEase: EASE_IN },
  /** Finder's Quick Look scales from the row (plans/macos/apps/finder.md "Motion"). */
  quickLook: { ms: 220, ease: EASE_OUT },
  lock: { contentMs: 220, wallpaperMs: 260, staggerMs: 60 },
  settings: { paneMs: 140, switchMs: 160 },
} as const;

/** CSS custom properties for the stylesheet-driven motions (written once on the macOS root). */
export function timingVars(): Record<string, string> {
  return {
    '--mac-dur-spotlight-in': `${MAC_TIMING.spotlight.inMs}ms`,
    '--mac-dur-pane': `${MAC_TIMING.settings.paneMs}ms`,
    '--mac-dur-switch': `${MAC_TIMING.settings.switchMs}ms`,
    '--mac-dur-center': `${MAC_TIMING.center.ms}ms`,
    '--mac-dur-menu-fade': `${MAC_TIMING.menu.fadeOutMs}ms`,
    '--mac-ease-out': EASE_OUT,
  };
}
