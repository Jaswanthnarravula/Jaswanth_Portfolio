/**
 * Safe storage — shared/04 `KRN-PERSIST-01`: try/catch around every access, in-memory fallback (private mode, quota,
 * blocked storage), debounced writes (250 ms) and a synchronous flush on `pagehide`. Never throws.
 */
export interface SafeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** Write pending values now (called on `pagehide`). */
  flush(): void;
  /** `memory` once the backing store failed or was unavailable. */
  readonly mode: 'local' | 'memory';
}

export interface SafeStorageOptions {
  /** Resolves the backing store lazily; may throw (e.g. `SecurityError` when storage is blocked). */
  backing?: () => Storage | null | undefined;
  debounceMs?: number;
  schedule?: (callback: () => void, ms: number) => () => void;
}

const defaultSchedule = (callback: () => void, ms: number) => {
  const handle = setTimeout(callback, ms);
  return () => clearTimeout(handle);
};

const defaultBacking = (): Storage | null => (typeof window === 'undefined' ? null : window.localStorage);

export function createSafeStorage({
  backing = defaultBacking,
  debounceMs = 250,
  schedule = defaultSchedule,
}: SafeStorageOptions = {}): SafeStorage {
  const memory = new Map<string, string | null>();
  const pending = new Map<string, string | null>();
  let store: Storage | null = null;
  let mode: 'local' | 'memory' = 'memory';
  let cancel: (() => void) | null = null;

  try {
    store = backing() ?? null;
    if (store) {
      // Probe: Safari private mode used to expose a storage that throws on write.
      const probe = '__pf_probe__';
      store.setItem(probe, '1');
      store.removeItem(probe);
      mode = 'local';
    }
  } catch {
    store = null;
    mode = 'memory';
  }

  const degrade = () => {
    mode = 'memory';
    store = null;
  };

  const write = () => {
    cancel = null;
    if (!store) {
      pending.clear();
      return;
    }
    for (const [key, value] of pending) {
      try {
        if (value === null) store.removeItem(key);
        else store.setItem(key, value);
      } catch {
        // Quota exceeded or storage revoked: keep serving from memory for the rest of the session.
        degrade();
        break;
      }
    }
    pending.clear();
  };

  const enqueue = (key: string, value: string | null) => {
    memory.set(key, value);
    pending.set(key, value);
    if (!cancel) cancel = schedule(write, debounceMs);
  };

  return {
    get mode() {
      return mode;
    },
    getItem(key) {
      if (memory.has(key)) return memory.get(key) ?? null;
      if (!store) return null;
      try {
        const value = store.getItem(key);
        memory.set(key, value);
        return value;
      } catch {
        degrade();
        return null;
      }
    },
    setItem(key, value) {
      enqueue(key, value);
    },
    removeItem(key) {
      enqueue(key, null);
    },
    flush() {
      cancel?.();
      write();
    },
  };
}

/** Flush pending writes when the page is hidden or unloaded (bfcache-safe: never `unload`). */
export function bindFlushOnPageHide(
  storage: SafeStorage,
  target: Pick<Window, 'addEventListener'>,
  signal: AbortSignal,
): void {
  target.addEventListener('pagehide', () => storage.flush(), { signal });
  target.addEventListener(
    'visibilitychange',
    () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') storage.flush();
    },
    { signal },
  );
}

/** Parse JSON defensively: corrupt input yields `null`, never an exception. */
export function readJson(storage: Pick<SafeStorage, 'getItem'>, key: string): unknown {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
