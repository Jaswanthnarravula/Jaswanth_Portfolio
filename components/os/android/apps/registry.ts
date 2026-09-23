import type { ComponentType } from 'react';
import type { AndroidRole } from '../model';
import type { AndroidAppProps } from './types';

type Loader = () => Promise<{ default: ComponentType<AndroidAppProps> }>;
export const APP_LOADERS: Readonly<Record<AndroidRole, Loader>> = {
  browser: () => import('./Chrome'),
  github: () => import('./GitHub'),
  files: () => import('./Files'),
  mail: () => import('./Gmail'),
  notes: () => import('./Keep'),
  settings: () => import('./Settings'),
};

const loaded = new Map<AndroidRole, ComponentType<AndroidAppProps>>();
const pending = new Map<AndroidRole, Promise<ComponentType<AndroidAppProps>>>();
export const loadedApp = (role: AndroidRole) => loaded.get(role) ?? null;
export function loadApp(role: AndroidRole) {
  const ready = loaded.get(role);
  if (ready) return Promise.resolve(ready);
  const active = pending.get(role);
  if (active) return active;
  const request = APP_LOADERS[role]().then(
    (module) => {
      loaded.set(role, module.default);
      pending.delete(role);
      return module.default;
    },
    (error) => {
      pending.delete(role);
      throw error;
    },
  );
  pending.set(role, request);
  return request;
}
export const prefetchApp = (role: AndroidRole) => void loadApp(role).catch(() => undefined);
