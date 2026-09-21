'use client';
/**
 * React bindings for the kernel and prefs stores. Components subscribe with narrow selectors (each window subscribes
 * to its own slice), so a change re-renders only what depends on it.
 */
import { useStore } from 'zustand';
import type { KernelState, UserPreferences } from '@/lib/kernel/types';
import { dispatch, kernelStore } from './kernel-store';
import { prefsStore } from './prefs-store';

export function useKernel<T>(selector: (state: KernelState) => T): T {
  return useStore(kernelStore, (store) => selector(store.kernel));
}

export function usePrefs<T>(selector: (prefs: UserPreferences) => T): T {
  return useStore(prefsStore, (store) => selector(store.prefs));
}

export const useDispatch = () => dispatch;
