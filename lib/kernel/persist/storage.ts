/** The one safe-storage instance for the browser session (created lazily, flushed on `pagehide`). */
import { bindFlushOnPageHide, createSafeStorage, readJson, type SafeStorage } from './safe-storage';
import { parsePersistedSessions, SESSIONS_KEY } from './sessions';
import type { PersistedSessionsV1 } from '../types';

let instance: SafeStorage | null = null;
let lifecycle: AbortController | null = null;

export function getSafeStorage(): SafeStorage {
  if (!instance) {
    instance = createSafeStorage();
    if (typeof window !== 'undefined') {
      lifecycle = new AbortController();
      bindFlushOnPageHide(instance, window, lifecycle.signal);
    }
  }
  return instance;
}

export function readPersistedSessions(): PersistedSessionsV1 | null {
  return parsePersistedSessions(readJson(getSafeStorage(), SESSIONS_KEY));
}

export function writePersistedSessions(payload: PersistedSessionsV1): void {
  getSafeStorage().setItem(SESSIONS_KEY, JSON.stringify(payload));
}

/** Debug switch for the history contract suite (`pf.debug.history` in sessionStorage): native (default) or next-router. */
export function historyAdapterOverride(): 'native' | 'next-router' {
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem('pf.debug.history') === 'next-router'
      ? 'next-router'
      : 'native';
  } catch {
    return 'native';
  }
}

/**
 * Debug switch for the WebGL tier in CI (`pf.debug.tier=2` in sessionStorage): forces Tier 2 candidacy with software
 * GL allowed, so the Hello `GlassStage` path is testable where only SwiftShader exists (shared/12 "WebGL in CI").
 */
export function forcedTier2(): boolean {
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem('pf.debug.tier') === '2';
  } catch {
    return false;
  }
}

/**
 * Debug switch for the Hello lens refraction in CI (`pf.debug.refract=on` in sessionStorage): skips the frame check,
 * which software-rendered headless browsers always fail, so the refracting path is testable there.
 */
export function forcedRefraction(): boolean {
  try {
    return typeof window !== 'undefined' && window.sessionStorage.getItem('pf.debug.refract') === 'on';
  } catch {
    return false;
  }
}
