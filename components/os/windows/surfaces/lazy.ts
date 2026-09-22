'use client';
/**
 * The shell's on-demand surfaces (shared/10: the Windows shell ≤ 38 KB gz). Start / Search, Task View, the Quick
 * Settings and Notification Center flyouts, the dialogs and About Windows load on first use — or before it, in idle
 * time after the desktop paints, and the launcher as soon as the pointer or focus reaches Start / Search — so the first
 * load carries only what the arrival shows: the desktop, the taskbar, the window frame, toasts and the lock screen.
 */
import { lazy } from 'react';
import { afterFirstPaint } from '@/lib/motion/idle';

const loaders = {
  launcher: () => import('./Launcher'),
  taskView: () => import('./TaskView'),
  panels: () => import('./Panels'),
  dialogs: () => import('./Dialogs'),
  winver: () => import('./Winver'),
} as const;

export type Surface = keyof typeof loaders;

export const Launcher = lazy(() => loaders.launcher().then((module) => ({ default: module.Launcher })));
export const TaskView = lazy(() => loaders.taskView().then((module) => ({ default: module.TaskView })));
export const QuickSettings = lazy(() => loaders.panels().then((module) => ({ default: module.QuickSettings })));
export const NotificationCenter = lazy(() =>
  loaders.panels().then((module) => ({ default: module.NotificationCenter })),
);
export const PropertiesDialog = lazy(() => loaders.dialogs().then((module) => ({ default: module.PropertiesDialog })));
export const ShortcutsDialog = lazy(() => loaders.dialogs().then((module) => ({ default: module.ShortcutsDialog })));
export const CoachMark = lazy(() => loaders.dialogs().then((module) => ({ default: module.CoachMark })));
export const Winver = lazy(() => loaders.winver().then((module) => ({ default: module.Winver })));

/** Warm one surface's chunk (the Start / Search buttons warm the launcher on hover and focus). */
export const warmSurface = (surface: Surface): void => void loaders[surface]().catch(() => undefined);

/** Warm every surface in idle time after the first paint, the launcher first (the one a visitor opens soonest). */
export function warmSurfaces(signal: AbortSignal): void {
  afterFirstPaint(
    () => {
      if (signal.aborted) return;
      for (const surface of Object.keys(loaders) as Surface[]) warmSurface(surface);
    },
    { signal, idleTimeout: 1500 },
  );
}
