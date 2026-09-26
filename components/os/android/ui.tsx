'use client';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { ICON_PLATE, ROLE_GLYPH, androidIcon, type AndroidRole } from './model';
import { materialRipple } from './motion';
import { SYMBOL_PATHS, type SymbolName } from './symbols.generated';
import styles from './android.module.css';

export type { SymbolName };

/**
 * A Material Symbols Rounded glyph (plans/android/01-identity "System glyphs"): the official outline, or the filled
 * variant for selected states. Drawn as inline SVG in `currentColor`, sized by the `--symbol` custom property (24 px).
 */
export function Symbol({ children, filled = false }: { children: SymbolName | (string & {}); filled?: boolean }) {
  // JSX text children type as `string`, so the name is checked by a unit test (every glyph the Android code uses is
  // in symbols.generated.ts) rather than by the compiler.
  const paths: readonly string[] | undefined = SYMBOL_PATHS[children as SymbolName];
  if (!paths) return null;
  const d = filled && paths.length > 1 ? paths[1] : paths[0];
  return (
    <svg
      className={styles.symbol}
      data-symbol={children}
      data-filled={filled || undefined}
      viewBox="0 -960 960 960"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}

/**
 * A launcher icon on the circular adaptive plate (AND-ID-05). The size comes from `--icon-size` on an ancestor (the
 * home grid, favourites, taskbar, drawer…), so every surface shares one icon shape. With themed icons on, the app's
 * monochrome glyph on the primary container replaces the artwork — as Pixel's "Themed icons" does. The artwork box is
 * the same in both asset modes (DS-ICONBOX-01).
 */
export function AdaptiveIcon({ app: role }: { app: AndroidRole }) {
  return (
    <span className={styles.adaptive} data-plate={ICON_PLATE[role]} aria-hidden="true">
      <span className={styles.adaptiveArt}>
        <AssetIcon id={androidIcon(role)} size={144} fluid />
      </span>
      <span className={styles.themedGlyph}>
        <Symbol>{ROLE_GLYPH[role]}</Symbol>
      </span>
    </span>
  );
}

export function IconButton({
  label,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      type="button"
      className={`${styles.iconButton} ${className}`}
      aria-label={label}
      onPointerDown={(event) => {
        materialRipple(event);
        props.onPointerDown?.(event);
      }}
    >
      {children}
    </button>
  );
}

export function TopBar({ title, back, actions }: { title: string; back?: () => void; actions?: ReactNode }) {
  return (
    <header className={styles.topBar}>
      {back ? (
        <IconButton label="Navigate up" onClick={back}>
          <Symbol>arrow_back</Symbol>
        </IconButton>
      ) : null}
      <h3 tabIndex={-1}>{title}</h3>
      <span className={styles.topActions}>{actions}</span>
    </header>
  );
}

export function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={styles.switch}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function BottomNav({
  items,
  current,
  onChange,
}: {
  items: readonly { id: string; label: string; glyph: SymbolName }[];
  current: string;
  onChange: (id: string) => void;
}) {
  return (
    <nav className={styles.bottomNav} aria-label="App navigation">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-current={current === item.id ? 'page' : undefined}
          onClick={() => onChange(item.id)}
        >
          <span className={styles.navIndicator}>
            <Symbol filled={current === item.id}>{item.glyph}</Symbol>
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
