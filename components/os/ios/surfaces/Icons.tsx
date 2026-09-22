'use client';
/**
 * Home Screen items — app icons, generated shortcut icons, the Career folder icon and the widgets
 * (plans/ios/surfaces/home-screen.md, dock.md, folders.md, widgets.md).
 *   · Icons are **links** to `/ios/{slug}` (they work without JavaScript); a plain click launches the app with the
 *     flight from this icon's rect. Press dims (80 in / 200 out), never a ripple (`IOS-ID-04`).
 *   · Quick actions open four ways (`IOS-QA-03`): long-press (500 ms, cancelled by > 10 pt movement), right-click,
 *     Shift+F10 / Menu key (the `contextmenu` event), and the visible "⋯" beside the focused / hovered icon.
 *   · Badges are part of the accessible name ("Mail, 1 unread") and drawn as the red 20 pt circle.
 *   · The squircle mask is identical in both asset modes (`IOS-ID-02`): the artwork is clipped by the same
 *     continuous-corner path, so boxes never change.
 * Shortcut and folder artwork is our own (generated tinted squircles with a symbol) — identical in both asset modes.
 */
import { type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { usePress } from '@/components/primitives/Press';
import { hrefFor } from '@/components/shell/KernelLink';
import { AssetIcon } from '@/components/ui/AssetIcon';
import type { ContentRef } from '@/data/schema';
import { focusKeys, type AppLocation } from '@/lib/kernel/types';
import { iconAsset, iosBinding, type FolderShortcut, type IosRole } from '../model';
import { scaleDip } from '../motion';
import { Glyph, type GlyphName } from '../ui/glyphs';
import styles from '../ios.module.css';

const isPlainClick = (event: MouseEvent) =>
  !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/** The squircle-clipped app artwork at a given size. */
export function AppArt({ role, size }: { readonly role: IosRole; readonly size: number }) {
  return (
    <span className={styles.art} style={{ width: size, height: size }} data-art="" data-app={role}>
      <AssetIcon id={iconAsset(role)} size={size} fluid priority />
    </span>
  );
}

const SYMBOL_GLYPH: Readonly<Record<FolderShortcut['symbol'] | 'about' | 'projects' | 'contact', GlyphName>> = {
  briefcase: 'briefcase',
  graduation: 'graduation',
  document: 'doc',
  person: 'person',
  about: 'person',
  projects: 'repo',
  contact: 'envelope',
};

/** A generated shortcut icon: a tinted squircle and a white symbol (our own artwork, both asset modes). */
export function ShortcutArt({
  symbol,
  tint,
  size,
}: {
  readonly symbol: keyof typeof SYMBOL_GLYPH;
  readonly tint: readonly [string, string];
  readonly size: number;
}) {
  return (
    <span
      className={`${styles.art} ${styles.shortcutArt}`}
      style={{ width: size, height: size, background: `linear-gradient(180deg, ${tint[0]}, ${tint[1]})` }}
      data-art=""
    >
      <Glyph name={SYMBOL_GLYPH[symbol]} size={Math.round(size * 0.52)} strokeWidth={2} />
    </span>
  );
}

export interface LaunchOrigin {
  /** Stable key of the item the flight starts from ("app:github", "dock:files", "folder:career/resume", …). */
  readonly key: string;
  readonly element: HTMLElement;
}

export interface IconHandlers {
  readonly onLaunch: (role: IosRole, location: AppLocation | undefined, origin: LaunchOrigin) => void;
  readonly onQuickActions: (role: IosRole, anchor: HTMLElement) => void;
  readonly onPrefetch: (role: IosRole) => void;
  /** Which launcher key holds the app's focus key (the item it last opened from). */
  readonly focusKeyFor: (role: IosRole, itemKey: string) => string | undefined;
}

export interface AppIconProps extends IconHandlers {
  readonly role: IosRole;
  readonly itemKey: string;
  readonly size: number;
  readonly label: boolean;
  readonly badge: number;
  readonly name: string;
  readonly location?: AppLocation;
  readonly roving?: boolean;
  readonly flying?: boolean;
  readonly className?: string;
}

/** One app icon (grid or Dock). */
export function AppIcon({
  role,
  itemKey,
  size,
  label,
  badge,
  name,
  location,
  roving = true,
  flying = false,
  className,
  onLaunch,
  onQuickActions,
  onPrefetch,
  focusKeyFor,
}: AppIconProps) {
  const binding = iosBinding(role);
  const href = hrefFor({ os: 'ios', role, location });
  const press = usePress({
    onLongPress: (_origin, _point) => {
      const el = document.getElementById(`ios-icon-${itemKey}`);
      scaleDip(el?.querySelector<HTMLElement>('[data-art]') ?? null);
      if (el) onQuickActions(role, el);
    },
  });
  return (
    <div className={`${styles.iconCell} ${className ?? ''}`} data-flying={flying || undefined}>
      <a
        id={`ios-icon-${itemKey}`}
        href={href}
        className={`${styles.icon} ${styles.pressable}`}
        aria-label={name}
        aria-keyshortcuts="Shift+F10"
        data-roving-item={roving ? '' : undefined}
        data-label={binding.title}
        data-item={itemKey}
        data-role={role}
        {...(focusKeyFor(role, itemKey) ? { 'data-focus-key': focusKeyFor(role, itemKey) } : {})}
        draggable={false}
        onPointerEnter={() => onPrefetch(role)}
        onFocus={() => onPrefetch(role)}
        onPointerDown={(event) => {
          onPrefetch(role);
          press.onPointerDown(event);
        }}
        onPointerMove={press.onPointerMove}
        onPointerUp={press.onPointerUp}
        onPointerCancel={press.onPointerCancel}
        onContextMenu={press.onContextMenu}
        onKeyDown={(event: KeyboardEvent<HTMLAnchorElement>) => {
          if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
            event.preventDefault();
            onQuickActions(role, event.currentTarget);
          }
        }}
        onClick={(event) => {
          press.onClick(event as never);
          if (!isPlainClick(event)) return;
          event.preventDefault();
          onLaunch(role, location, { key: itemKey, element: event.currentTarget });
        }}
      >
        <span className={styles.artWrap}>
          <AppArt role={role} size={size} />
          {badge > 0 ? (
            <span className={styles.badge} aria-hidden="true">
              {badge}
            </span>
          ) : null}
        </span>
        {label ? (
          <span className={styles.iconLabel} aria-hidden="true">
            {binding.title}
          </span>
        ) : null}
      </a>
      <button
        type="button"
        tabIndex={-1}
        className={styles.iconMore}
        aria-label={`${binding.title} actions`}
        onClick={(event) => {
          const icon = document.getElementById(`ios-icon-${itemKey}`);
          onQuickActions(role, icon ?? event.currentTarget);
        }}
      >
        <Glyph name="ellipsis" size={18} />
      </button>
    </div>
  );
}

/** A content shortcut on the Home Screen (page 2: About · Projects · Contact) — a link into the owning app. */
export function ShortcutIcon({
  itemKey,
  label,
  target,
  symbol,
  tint,
  size,
  onOpen,
  focusKey,
}: {
  readonly itemKey: string;
  readonly label: string;
  readonly target: ContentRef;
  readonly symbol: 'about' | 'projects' | 'contact';
  readonly tint: readonly [string, string];
  readonly size: number;
  readonly onOpen: (ref: ContentRef, origin: LaunchOrigin) => void;
  readonly focusKey?: string;
}) {
  return (
    <div className={styles.iconCell}>
      <a
        id={`ios-icon-${itemKey}`}
        href={hrefFor({ os: 'ios', ref: target })}
        className={`${styles.icon} ${styles.pressable}`}
        data-roving-item=""
        data-label={label}
        data-item={itemKey}
        aria-label={label}
        {...(focusKey ? { 'data-focus-key': focusKey } : {})}
        draggable={false}
        onClick={(event) => {
          if (!isPlainClick(event)) return;
          event.preventDefault();
          onOpen(target, { key: itemKey, element: event.currentTarget });
        }}
      >
        <span className={styles.artWrap}>
          <ShortcutArt symbol={symbol} tint={tint} size={size} />
        </span>
        <span className={styles.iconLabel} aria-hidden="true">
          {label}
        </span>
      </a>
    </div>
  );
}

/** The closed Career folder: a material squircle with a 3 × 3 mini-grid of its first nine shortcuts. */
export function FolderIcon({
  shortcuts,
  size,
  name,
  open,
  focusKey,
  onOpen,
  flying,
}: {
  readonly shortcuts: readonly FolderShortcut[];
  readonly size: number;
  readonly name: string;
  readonly open: boolean;
  readonly focusKey?: string;
  readonly onOpen: (button: HTMLElement) => void;
  readonly flying?: boolean;
}) {
  return (
    <div className={styles.iconCell} data-flying={flying || undefined}>
      <button
        type="button"
        id="ios-icon-folder:career"
        className={`${styles.icon} ${styles.pressable}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={name}
        data-roving-item=""
        data-label="Career"
        data-item="folder:career"
        {...(focusKey ? { 'data-focus-key': focusKey } : {})}
        onClick={(event) => onOpen(event.currentTarget)}
      >
        <span className={styles.artWrap}>
          <span
            className={`${styles.art} ${styles.folderArt}`}
            style={{ width: size, height: size }}
            data-art=""
            data-folder-art=""
          >
            {shortcuts.slice(0, 9).map((shortcut) => (
              <ShortcutArt
                key={shortcut.id}
                symbol={shortcut.symbol}
                tint={shortcut.tint}
                size={Math.round(size * 0.24)}
              />
            ))}
          </span>
        </span>
        <span className={styles.iconLabel} aria-hidden="true">
          Career
        </span>
      </button>
    </div>
  );
}

/** A widget's shared frame: an `article` with a heading; the whole face is one link, extra controls are siblings. */
export function WidgetFrame({
  id,
  size,
  eyebrow,
  children,
  href,
  label,
  onOpen,
  aside,
  onLongPress,
}: {
  readonly id: string;
  readonly size: 'large' | 'medium' | 'small';
  readonly eyebrow: string;
  readonly children: ReactNode;
  readonly href: string;
  readonly label: string;
  readonly onOpen: (origin: LaunchOrigin) => void;
  readonly aside?: ReactNode;
  readonly onLongPress: (anchor: HTMLElement) => void;
}) {
  const press = usePress({
    onLongPress: () => {
      const el = document.getElementById(`ios-widget-${id}`);
      scaleDip(el);
      if (el) onLongPress(el);
    },
  });
  return (
    <article
      id={`ios-widget-${id}`}
      className={styles.widget}
      data-size={size}
      data-widget={id}
      aria-labelledby={`ios-widget-${id}-h`}
    >
      <a
        href={href}
        className={`${styles.widgetMain} ${styles.pressable}`}
        aria-label={label}
        aria-keyshortcuts="Shift+F10"
        draggable={false}
        onPointerDown={press.onPointerDown}
        onPointerMove={press.onPointerMove}
        onPointerUp={press.onPointerUp}
        onPointerCancel={press.onPointerCancel}
        onContextMenu={press.onContextMenu}
        onKeyDown={(event) => {
          if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
            event.preventDefault();
            const el = document.getElementById(`ios-widget-${id}`);
            if (el) onLongPress(el);
          }
        }}
        onClick={(event) => {
          press.onClick(event as never);
          if (!isPlainClick(event)) return;
          event.preventDefault();
          const el = document.getElementById(`ios-widget-${id}`) ?? event.currentTarget;
          onOpen({ key: `widget:${id}`, element: el });
        }}
      >
        <h3 id={`ios-widget-${id}-h`} className={styles.widgetEyebrow}>
          {eyebrow}
        </h3>
        {children}
      </a>
      {aside}
    </article>
  );
}

export { focusKeys };
