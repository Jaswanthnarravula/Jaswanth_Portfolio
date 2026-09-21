/**
 * Preferences store — `pf.prefs.v1` (shared/04 `KRN-PERSIST-*`). Zustand `persist` with `skipHydration`, the kernel's
 * safe storage, a validating `merge` and a versioned `migrate`. Long-lived and independent of the sessions key.
 */
import { createJSONStorage, persist } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';
import { migratePrefs, parsePrefs, PREFS_KEY } from '@/lib/kernel/persist/prefs';
import { getSafeStorage } from '@/lib/kernel/persist/storage';
import { DEFAULT_PREFS } from '@/lib/kernel/state';
import type { UserPreferences } from '@/lib/kernel/types';

export interface PrefsStore {
  readonly prefs: UserPreferences;
  patch(patch: Partial<Omit<UserPreferences, 'v'>>): void;
}

export const prefsStore = createStore<PrefsStore>()(
  persist(
    (set) => ({
      prefs: DEFAULT_PREFS,
      patch: (patch) => set((state) => ({ prefs: parsePrefs({ ...state.prefs, ...patch }) })),
    }),
    {
      name: PREFS_KEY,
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => getSafeStorage()),
      partialize: (state) => state.prefs,
      migrate: (persisted, version) => migratePrefs(persisted, version),
      merge: (persisted, current) => ({ ...current, prefs: parsePrefs(persisted) }),
    },
  ),
);

export const getPrefs = (): UserPreferences => prefsStore.getState().prefs;
