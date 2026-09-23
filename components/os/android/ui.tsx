'use client';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { materialRipple } from './motion';
import styles from './android.module.css';

const SYMBOLS: Readonly<Record<string, string>> = {
  accessibility_new: '◎',
  add: '+',
  android: '◆',
  apps: '▦',
  arrow_back: '←',
  arrow_outward: '↗',
  attach_file: '⌕',
  brightness_high: '☀',
  brightness_low: '☼',
  brush: '✎',
  check_box: '☑',
  chevron_right: '›',
  close: '×',
  dark_mode: '◒',
  description: '▤',
  download: '↓',
  draft: '▧',
  edit: '✎',
  expand_less: '⌃',
  expand_more: '⌄',
  folder: '▰',
  gesture: '〰',
  grid_view: '▦',
  home: '⌂',
  image: '▧',
  inbox: '▣',
  info: 'ⓘ',
  keyboard_arrow_up: '⌃',
  lightbulb: '♢',
  lock: '●',
  lock_open: '○',
  mail: '✉',
  menu: '☰',
  mic: '●',
  more_vert: '⋮',
  motion_photos_off: '◌',
  navigation: '▲',
  notifications: '♢',
  opacity: '◐',
  palette: '◉',
  person: '●',
  picture_as_pdf: 'PDF',
  power_settings_new: '⏻',
  push_pin: '⌖',
  search: '⌕',
  send: '➤',
  settings: '⚙',
  share: '↗',
  shield: '◇',
  smartphone: '▯',
  sort: '↕',
  source: '⌘',
  star: '☆',
  view_agenda: '▤',
  view_list: '☷',
  volume_up: '◖))',
  work: '▣',
  school: '◇',
};

export function Symbol({ children, filled = false }: { children: ReactNode; filled?: boolean }) {
  const glyph = typeof children === 'string' ? (SYMBOLS[children] ?? '•') : children;
  return (
    <span className={styles.symbol} data-filled={filled || undefined} aria-hidden="true">
      {glyph}
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
  items: readonly { id: string; label: string; glyph: string }[];
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
