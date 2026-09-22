'use client';
/**
 * iOS shell services — what an app (or a surface) may ask the shell to do. One context, provided by the shell, so apps
 * never reach into each other or into the Home Screen (`components/os/ios` only). Session state that belongs to an
 * app (its tab, pushed screens that write no history, a transcript) goes to the kernel as `WindowInstance.ui`
 * (`useAppUi`), so it survives eviction and reload (`IOS-FLIGHT-05`).
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ContentRef } from '@/data/schema';
import type { AppRole } from '@/lib/kernel/ids';
import type { AppLocation, WindowId } from '@/lib/kernel/types';
import { useKernel } from '@/stores/kernel-context';
import { dispatchSoon } from '@/stores/kernel-store';
import type { IosLayout, IosRole, QuickAction } from './model';

export interface BannerAction {
  readonly label: string;
  readonly run: () => void;
  readonly primary?: boolean;
}

export interface BannerSpec {
  readonly id: string;
  /** App the banner speaks for (its icon), or `null` for the system. */
  readonly role: IosRole | null;
  readonly app: string;
  readonly title: string;
  readonly body?: string;
  /** Tapping the banner itself (`origin` = the banner: apps open with a flight from its rect). */
  readonly primary?: (origin?: HTMLElement) => void;
  readonly actions?: readonly BannerAction[];
  readonly onDismiss?: () => void;
  /** Absolute time after which a queued banner is dropped (Handoff: 10 min). */
  readonly expires?: number;
}

/** A content row's context preview (plans/ios/surfaces/quick-actions "Context preview"). */
export interface PreviewSpec {
  readonly title: string;
  readonly summary?: string;
  readonly meta?: readonly string[];
  readonly ref?: ContentRef;
  readonly actions: readonly { readonly id: string; readonly label: string; readonly run: () => void }[];
  /** The row it lifts from (focus returns here; the menu anchors to it). */
  readonly anchor: HTMLElement;
}

export interface IosServices {
  readonly layout: IosLayout;
  readonly landscape: boolean;
  /** A banner from the top (never takes focus) — it also lands in Notification Center. */
  notify(banner: BannerSpec): void;
  /** Clipboard with the "Copied" banner; resolves false when blocked (the caller shows the text to select). */
  copy(text: string, what?: string): Promise<boolean>;
  /** Copy the canonical `/go/…` link to a piece of content. */
  copyLink(ref: ContentRef, label?: string): Promise<boolean>;
  /** Open an app (or content in its owning app) with a flight from `origin`'s rect (a banner, a row, a card). */
  openApp(role: AppRole, location?: AppLocation, origin?: HTMLElement | null): void;
  openContent(ref: ContentRef, origin?: HTMLElement | null): void;
  /** Go Home: the foreground app returns into its icon. */
  goHome(): void;
  /** Long-press / ⋯ on a content row: preview card + actions. */
  preview(spec: PreviewSpec): void;
  /** Icon quick actions for a role (widgets pass their own). */
  quickActions(role: IosRole, anchor: HTMLElement, actions?: readonly QuickAction[]): void;
  openSwitchOs(from?: HTMLElement | null): void;
  switchOs(): void;
  startTour(): void;
  openSpotlight(from?: HTMLElement | null, query?: string): void;
  /** `<a download>` of the résumé + banner "Résumé.pdf saved" + `resume_downloaded`. */
  downloadResume(): void;
  /** The app's scroll-to-top handler (status-bar time tap, plans/ios/surfaces/status-bar). */
  onScrollToTop(id: WindowId, handler: (() => void) | null): void;
  announce(message: string): void;
}

const IosShellContext = createContext<IosServices | null>(null);

export function IosShellProvider({ value, children }: { readonly value: IosServices; readonly children: ReactNode }) {
  return <IosShellContext.Provider value={value}>{children}</IosShellContext.Provider>;
}

export function useIos(): IosServices {
  const services = useContext(IosShellContext);
  if (!services) throw new Error('useIos() outside the iOS shell');
  return services;
}

/** Same, but `null` outside the shell (component tests of one app). */
export const useIosOptional = (): IosServices | null => useContext(IosShellContext);

/**
 * One key of an app's session state (`WindowInstance.ui`), with a setter that commits after paint (shared/10 INP).
 * `null` clears the key.
 */
export function useAppUi(id: WindowId, key: string, fallback: string): [string, (value: string | null) => void] {
  const value = useKernel((state) => state.sessions.ios.windows[id]?.ui?.[key]);
  const set = useCallback(
    (next: string | null) => dispatchSoon({ type: 'SET_APP_UI', id, key, value: next }),
    [id, key],
  );
  return [value ?? fallback, set];
}

/** A JSON value in the app's session state (arrays of screen keys, visited branches…). */
export function useAppUiJson<T>(id: WindowId, key: string, fallback: T): [T, (value: T | null) => void] {
  const [raw, setRaw] = useAppUi(id, key, '');
  const [initial] = useState(fallback);
  // Parsed once per stored string, so the value keeps its identity between renders (safe in effect deps).
  const value = useMemo(() => {
    if (!raw) return initial;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  }, [raw, initial]);
  const set = useCallback((next: T | null) => setRaw(next === null ? null : JSON.stringify(next)), [setRaw]);
  return [value, set];
}
