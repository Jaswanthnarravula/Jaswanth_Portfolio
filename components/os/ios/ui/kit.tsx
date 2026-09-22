'use client';
/**
 * iOS controls (plans/ios/01 "Tokens", 05 "Semantics map"): inset-grouped lists and rows (≥ 44 pt, hairlines inset
 * 16 pt, dim-on-press — never a ripple), switches (`role="switch"`), segmented controls (`radiogroup`), the search
 * field (17 pt: no focus zoom), the tab bar (`nav` of links with `aria-current`) and in-app push links (real hrefs).
 * Rows with a context preview open it four ways (`IOS-QA-03`): long-press, right-click, Shift+F10 / Menu key, and a
 * visible "⋯" button beside the focused row — never nested inside the row's link.
 */
import { useId, useRef, type AnchorHTMLAttributes, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { hrefFor } from '@/components/shell/KernelLink';
import { usePress } from '@/components/primitives/Press';
import type { ContentRef } from '@/data/schema';
import { routeCodec } from '@/lib/kernel/route';
import type { AppLocation, WindowId } from '@/lib/kernel/types';
import { parseWindowId } from '@/lib/kernel/types';
import { dispatchSoon } from '@/stores/kernel-store';
import { scaleDip } from '../motion';
import { Glyph, type GlyphName } from './glyphs';
import styles from './ui.module.css';

export { styles as uiStyles };

const isPlainClick = (event: MouseEvent) =>
  !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/** The URL a location inside an iOS app has (the same the kernel will write). */
export function appHref(id: WindowId, location: AppLocation): string {
  const { os, role } = parseWindowId(id);
  return routeCodec.encode({ kind: 'os', os, focus: { role, location } });
}

type AnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'> & {
  readonly ref?: React.Ref<HTMLAnchorElement>;
};

/**
 * An in-app push (plans/ios/02 "Push/pop stack"): a real link to the pushed place (works without JS, opens in a new
 * tab on a modified click) whose plain click becomes one `NAVIGATE_IN_APP` — one history entry, Back pops it.
 */
export function PushLink({
  app,
  location,
  replace,
  children,
  onActivate,
  ...rest
}: AnchorProps & {
  readonly app: WindowId;
  readonly location: AppLocation;
  readonly replace?: boolean;
  readonly children: ReactNode;
  readonly onActivate?: () => void;
}) {
  return (
    <a
      {...rest}
      href={appHref(app, location)}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        onActivate?.();
        dispatchSoon({ type: 'NAVIGATE_IN_APP', id: app, location, ...(replace ? { replace: true } : {}) });
      }}
    >
      {children}
    </a>
  );
}

/** A link to content in whichever iOS app owns it (Files → Résumé; Notes → a project opens GitHub). */
export const contentHref = (ref: ContentRef) => hrefFor({ os: 'ios', ref });

// --- Grouped lists ------------------------------------------------------------------------------------------------------

export function Group({
  header,
  footer,
  children,
  id,
  plain = false,
  className,
}: {
  readonly header?: ReactNode;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
  readonly id?: string;
  /** Plain (edge-to-edge) instead of inset-grouped. */
  readonly plain?: boolean;
  readonly className?: string;
}) {
  const auto = useId();
  const headerId = id ?? `grp-${auto}`;
  return (
    <section
      className={`${styles.group} ${className ?? ''}`}
      data-plain={plain || undefined}
      aria-labelledby={header ? headerId : undefined}
    >
      {header ? (
        <h4 className={styles.groupHeader} id={headerId}>
          {header}
        </h4>
      ) : null}
      <ul className={styles.groupList} role="list">
        {children}
      </ul>
      {footer ? <p className={styles.groupFooter}>{footer}</p> : null}
    </section>
  );
}

export interface RowIcon {
  readonly glyph?: GlyphName;
  /** Tinted rounded-square background (Settings' 29 pt tiles). */
  readonly tint?: string;
  readonly node?: ReactNode;
}

export interface RowPreview {
  /** Opens the context preview for this row (the shell draws it). */
  readonly open: (anchor: HTMLElement) => void;
  /** The ⋯ button's name, "{title} actions". */
  readonly label: string;
}

interface RowBase {
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  readonly detail?: ReactNode;
  readonly value?: ReactNode;
  readonly icon?: RowIcon;
  readonly accessory?: 'chevron' | 'check' | 'none' | 'external';
  readonly preview?: RowPreview;
  /** Marks the row that pushed a screen (focus returns to it on pop). */
  readonly pushKey?: string;
  readonly destructive?: boolean;
  readonly selected?: boolean;
  readonly className?: string;
  readonly 'aria-label'?: string;
  readonly 'aria-current'?: 'page' | 'true';
  readonly dataAttrs?: Readonly<Record<string, string>>;
}

export type RowProps = RowBase &
  (
    | {
        readonly kind: 'push';
        readonly app: WindowId;
        readonly location: AppLocation;
        readonly replace?: boolean;
        readonly onActivate?: () => void;
      }
    | {
        readonly kind: 'href';
        readonly href: string;
        readonly external?: boolean;
        readonly download?: string;
        readonly onActivate?: () => void;
        readonly onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
      }
    | {
        readonly kind: 'button';
        readonly onPress: (el: HTMLElement) => void;
        readonly pressed?: boolean;
        readonly disabled?: boolean;
      }
    | { readonly kind: 'static' }
    | { readonly kind: 'control'; readonly control: ReactNode; readonly labelFor?: string }
  );

function RowInner({ title, subtitle, detail, value, icon, accessory }: RowBase) {
  return (
    <>
      {icon ? (
        <span
          className={styles.rowIcon}
          data-tint={icon.tint ? '' : undefined}
          style={icon.tint ? { background: icon.tint } : undefined}
          aria-hidden="true"
        >
          {icon.node ??
            (icon.glyph ? (
              <Glyph name={icon.glyph} size={icon.tint ? 18 : 22} strokeWidth={icon.tint ? 2.1 : 1.9} />
            ) : null)}
        </span>
      ) : null}
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        {subtitle ? <span className={styles.rowSubtitle}>{subtitle}</span> : null}
        {detail ? <span className={styles.rowDetail}>{detail}</span> : null}
      </span>
      {value !== undefined && value !== null ? <span className={styles.rowValue}>{value}</span> : null}
      {accessory === 'chevron' ? (
        <Glyph name="chevron-right" size={16} strokeWidth={2.4} className={styles.chevron} />
      ) : null}
      {accessory === 'external' ? (
        <Glyph name="arrow-up-right" size={16} strokeWidth={2.2} className={styles.chevron} />
      ) : null}
      {accessory === 'check' ? <Glyph name="check" size={18} strokeWidth={2.4} className={styles.check} /> : null}
    </>
  );
}

/**
 * One row. Its preview (long-press / right-click / Shift+F10 / ⋯) never replaces the native menu inside text: only the
 * row itself listens.
 */
export function Row(props: RowProps) {
  const { preview, pushKey, className, destructive, selected } = props;
  const rowRef = useRef<HTMLElement | null>(null);
  const press = usePress({
    onLongPress: preview
      ? () => {
          scaleDip(rowRef.current);
          if (rowRef.current) preview.open(rowRef.current);
        }
      : undefined,
  });
  const common = {
    className: `${styles.row} ${styles.press}`,
    'data-push-key': pushKey,
    'data-selected': selected || undefined,
    'data-destructive': destructive || undefined,
    'aria-label': props['aria-label'],
    'aria-current': props['aria-current'],
    ...(props.dataAttrs ?? {}),
    ...(preview
      ? {
          onPointerDown: press.onPointerDown,
          onPointerMove: press.onPointerMove,
          onPointerUp: press.onPointerUp,
          onPointerCancel: press.onPointerCancel,
          onContextMenu: press.onContextMenu,
          onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
            if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
              event.preventDefault();
              if (rowRef.current) preview.open(rowRef.current);
            }
          },
        }
      : {}),
  };
  const setRef = (el: HTMLElement | null) => {
    rowRef.current = el;
  };
  let body: ReactNode;
  switch (props.kind) {
    case 'push':
      body = (
        <PushLink
          {...common}
          ref={setRef as never}
          app={props.app}
          location={props.location}
          replace={props.replace}
          onActivate={props.onActivate}
          onClickCapture={preview ? (event) => press.onClick(event as never) : undefined}
        >
          <RowInner {...props} accessory={props.accessory ?? 'chevron'} />
        </PushLink>
      );
      break;
    case 'href':
      body = (
        <a
          {...common}
          ref={setRef as never}
          href={props.href}
          download={props.download}
          {...(props.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          onClick={(event) => {
            if (preview) press.onClick(event as never);
            if (event.defaultPrevented) return;
            props.onClick?.(event);
            if (!event.defaultPrevented) props.onActivate?.();
          }}
        >
          <RowInner {...props} accessory={props.accessory ?? (props.external ? 'external' : 'chevron')} />
          {props.external ? <span className="sr-only"> (opens in a new tab)</span> : null}
        </a>
      );
      break;
    case 'button':
      body = (
        <button
          {...common}
          ref={setRef as never}
          type="button"
          disabled={props.disabled}
          aria-pressed={props.pressed}
          onClick={(event) => {
            if (preview) press.onClick(event as never);
            if (event.defaultPrevented) return;
            props.onPress(event.currentTarget);
          }}
        >
          <RowInner {...props} accessory={props.accessory ?? 'none'} />
        </button>
      );
      break;
    case 'control':
      body = (
        <div className={styles.row} data-static="">
          <RowInner {...props} accessory="none" />
          <span className={styles.rowControl}>{props.control}</span>
        </div>
      );
      break;
    default:
      body = (
        <div className={styles.row} data-static="" ref={setRef as never}>
          <RowInner {...props} accessory={props.accessory ?? 'none'} />
        </div>
      );
  }
  return (
    <li className={`${styles.rowItem} ${className ?? ''}`} data-has-actions={preview ? '' : undefined}>
      {body}
      {preview ? (
        <button
          type="button"
          className={styles.rowMore}
          aria-label={preview.label}
          onClick={(event) => preview.open(rowRef.current ?? event.currentTarget)}
        >
          <Glyph name="ellipsis" size={20} />
        </button>
      ) : null}
    </li>
  );
}

// --- Switch, segmented control, search, buttons --------------------------------------------------------------------------

export function Switch({
  checked,
  onChange,
  label,
  id,
  describedBy,
}: {
  readonly checked: boolean;
  readonly onChange: (next: boolean) => void;
  readonly label?: string;
  readonly id?: string;
  readonly describedBy?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      className={styles.switch}
      data-on={checked || undefined}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.switchThumb} aria-hidden="true" />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  readonly value: T;
  readonly options: readonly { readonly id: T; readonly label: string }[];
  readonly onChange: (next: T) => void;
  readonly label: string;
  readonly className?: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.id === value),
  );
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (delta: number) => {
    const next = (index + delta + options.length) % options.length;
    onChange(options[next]!.id);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`${styles.segmented} ${className ?? ''}`}
      style={{ ['--seg-count' as string]: options.length, ['--seg-index' as string]: index }}
    >
      <span className={styles.segThumb} aria-hidden="true" />
      {options.map((option, i) => (
        <button
          key={option.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={option.id === value}
          tabIndex={option.id === value ? 0 : -1}
          className={styles.segment}
          onClick={() => onChange(option.id)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
              event.preventDefault();
              move(1);
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
              event.preventDefault();
              move(-1);
            }
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  label,
  placeholder = 'Search',
  onCancel,
  onSubmit,
  inputRef,
  id,
}: {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly label: string;
  readonly placeholder?: string;
  /** Shows iOS's "Cancel" beside the field while it has text or focus. */
  readonly onCancel?: () => void;
  readonly onSubmit?: () => void;
  readonly inputRef?: React.Ref<HTMLInputElement>;
  readonly id?: string;
}) {
  return (
    <div className={styles.searchRow} role="search">
      <label className={styles.searchField}>
        <Glyph name="search" size={17} strokeWidth={2.2} className={styles.searchGlyph} />
        <span className="sr-only">{label}</span>
        <input
          ref={inputRef}
          id={id}
          type="search"
          value={value}
          placeholder={placeholder}
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSubmit?.();
            if (event.key === 'Escape' && value) {
              event.preventDefault();
              event.stopPropagation();
              onChange('');
            }
          }}
        />
        {value ? (
          <button type="button" className={styles.searchClear} aria-label="Clear text" onClick={() => onChange('')}>
            <Glyph name="xmark" size={12} strokeWidth={3} />
          </button>
        ) : null}
      </label>
      {onCancel && value ? (
        <button type="button" className={styles.textButton} onClick={onCancel}>
          Cancel
        </button>
      ) : null}
    </div>
  );
}

/** Nav-bar / toolbar text or glyph button (≥ 44 × 44 pt hit area). */
export function BarButton({
  label,
  glyph,
  onPress,
  children,
  emphasized = false,
  disabled,
  id,
  ...rest
}: {
  readonly label: string;
  readonly glyph?: GlyphName;
  readonly onPress: (el: HTMLButtonElement) => void;
  readonly children?: ReactNode;
  readonly emphasized?: boolean;
  readonly disabled?: boolean;
  readonly id?: string;
  readonly 'aria-haspopup'?: 'menu' | 'dialog';
  readonly 'aria-expanded'?: boolean;
  readonly 'aria-pressed'?: boolean;
}) {
  return (
    <button
      {...rest}
      id={id}
      type="button"
      className={styles.barButton}
      data-emphasized={emphasized || undefined}
      aria-label={glyph && !children ? label : undefined}
      disabled={disabled}
      onClick={(event) => onPress(event.currentTarget)}
    >
      {glyph ? <Glyph name={glyph} size={22} /> : null}
      {children ?? (glyph ? null : label)}
    </button>
  );
}

// --- Tab bar -----------------------------------------------------------------------------------------------------------

export interface TabSpec<T extends string> {
  readonly id: T;
  readonly label: string;
  readonly glyph: GlyphName;
  readonly href: string;
}

/**
 * The tab bar (49 pt + the home-indicator inset): a `nav` of links with `aria-current` — tabs are navigation roots,
 * not an APG tab panel (plans/ios/apps/github "Accessibility"). Tapping the active tab pops to its root.
 */
export function TabBar<T extends string>({
  tabs,
  active,
  onSelect,
  label,
  className,
}: {
  readonly tabs: readonly TabSpec<T>[];
  readonly active: T;
  readonly onSelect: (id: T, again: boolean) => void;
  readonly label: string;
  readonly className?: string;
}) {
  return (
    <nav className={`${styles.tabBar} ${className ?? ''}`} aria-label={label} data-tab-bar="">
      <ul role="list">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <a
              href={tab.href}
              className={styles.tab}
              aria-current={tab.id === active ? 'page' : undefined}
              onClick={(event) => {
                if (!isPlainClick(event)) return;
                event.preventDefault();
                onSelect(tab.id, tab.id === active);
              }}
            >
              <Glyph name={tab.glyph} size={24} filled={tab.id === active} />
              <span>{tab.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Filled / tinted capsule buttons (GitHub's "Repository ↗", Mail's actions). */
export function PillButton({
  children,
  tone = 'filled',
  href,
  external,
  onPress,
  download,
  className,
  ...rest
}: {
  readonly children: ReactNode;
  readonly tone?: 'filled' | 'tinted' | 'plain';
  readonly href?: string;
  readonly external?: boolean;
  readonly download?: string;
  readonly onPress?: (el: HTMLElement) => void;
  readonly className?: string;
  readonly 'aria-label'?: string;
}) {
  const cls = `${styles.pill} ${styles.press} ${className ?? ''}`;
  if (href)
    return (
      <a
        {...rest}
        className={cls}
        data-tone={tone}
        href={href}
        download={download}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        onClick={(event) => onPress?.(event.currentTarget)}
      >
        {children}
        {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
      </a>
    );
  return (
    <button
      {...rest}
      type="button"
      className={cls}
      data-tone={tone}
      onClick={(event) => onPress?.(event.currentTarget)}
    >
      {children}
    </button>
  );
}

/** Tag chips (Notes tags, GitHub topics): real buttons when they filter, spans otherwise. */
export function Chip({
  children,
  onPress,
  selected,
}: {
  readonly children: ReactNode;
  readonly onPress?: () => void;
  readonly selected?: boolean;
}) {
  if (!onPress) return <span className={styles.chip}>{children}</span>;
  return (
    <button
      type="button"
      className={`${styles.chip} ${styles.press}`}
      aria-pressed={selected ?? false}
      onClick={onPress}
    >
      {children}
    </button>
  );
}

/** Visually hidden heading helper (the app's `h2`). */
export function HiddenHeading({ id, children }: { readonly id: string; readonly children: ReactNode }) {
  return (
    <h2 id={id} className="sr-only" tabIndex={-1}>
      {children}
    </h2>
  );
}
