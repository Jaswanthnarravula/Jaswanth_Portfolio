'use client';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ContentRef } from '@/data/schema';
import type { AppLocation, WindowId } from '@/lib/kernel/types';
import { useKernel } from '@/stores/kernel-context';
import { dispatchSoon } from '@/stores/kernel-store';
import type { AndroidRole } from './model';

export interface AndroidServices {
  readonly layout: 'phone' | 'large';
  openApp(role: AndroidRole, location?: AppLocation, origin?: HTMLElement | null): void;
  openContent(ref: ContentRef, origin?: HTMLElement | null): void;
  back(): void;
  home(): void;
  notify(message: string, action?: { label: string; run: () => void }): void;
  openSettings(screen: string): void;
  openSwitchOs(from?: HTMLElement | null): void;
  downloadResume(): void;
  registerBack(id: WindowId, handler: (() => boolean) | null): void;
}

const Context = createContext<AndroidServices | null>(null);
export const AndroidProvider = ({ value, children }: { value: AndroidServices; children: ReactNode }) => (
  <Context.Provider value={value}>{children}</Context.Provider>
);
export function useAndroid() {
  const value = useContext(Context);
  if (!value) throw new Error('useAndroid outside Android shell');
  return value;
}

export function useAppUi(id: WindowId, key: string, fallback: string): [string, (next: string | null) => void] {
  const value = useKernel((state) => state.sessions.android.windows[id]?.ui?.[key]);
  return [
    value ?? fallback,
    useCallback((next: string | null) => dispatchSoon({ type: 'SET_APP_UI', id, key, value: next }), [id, key]),
  ];
}

export function useAppUiJson<T>(id: WindowId, key: string, fallback: T): [T, (next: T | null) => void] {
  const [raw, setRaw] = useAppUi(id, key, '');
  const [initial] = useState(fallback);
  const value = useMemo(() => {
    try {
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  }, [raw, initial]);
  return [value, useCallback((next: T | null) => setRaw(next === null ? null : JSON.stringify(next)), [setRaw])];
}
