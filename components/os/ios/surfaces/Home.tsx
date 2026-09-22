'use client';
/**
 * The Home Screen and the Dock — plans/ios/surfaces/home-screen.md (`IOS-HOME-01…07`), dock.md (`IOS-DOCK-01…05`),
 * widgets.md (`IOS-WIDG-01…04`).
 *   · Pages are a native horizontal scroll-snap container (no JS physics); each page is a `ul` of links in ONE roving
 *     group spanning pages (2-D arrows by measured columns; Right at the last column crosses to the next page — the
 *     pager scrolls and focus follows); page dots are real buttons ("Page 1 of 2", `aria-current`).
 *   · The Search pill sits above the Dock and morphs into the page dots while the pages scroll (iOS 16+); pressing it
 *     opens Spotlight. With a mouse: click-drag pages, the wheel pages too, dots and arrow keys always work.
 *   · Full page (tablets, laptops, desktops): the iPadOS layout of the owner's frame — widgets block leading, the
 *     grid to the right, floating Dock with recents; phone: the Résumé widget on top, 4 × 6 grid, Dock plate;
 *     phone landscape: 6 × 3 with the Dock on the trailing edge.
 *   · Widgets are static per session — no timers, tickers or loops (`IOS-WIDG-04`).
 * Layout is the model's deterministic packing (`homeLayout`), so reflow and "page memory by icon" are testable.
 */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { RovingGroup } from '@/components/primitives/RovingGroup';
import { hrefFor } from '@/components/shell/KernelLink';
import type { ContentRef } from '@/data/schema';
import type { AppRole } from '@/lib/kernel/ids';
import { drag } from '@/lib/motion/drag';
import { prefersReducedMotion } from '@/lib/motion/dur';
import {
  badgeFor,
  DOCK,
  dockLocation,
  folderName,
  iconName,
  iosBinding,
  SHORTCUT_TARGET,
  type FolderShortcut,
  type HomeItem,
  type HomeLayout,
  type IosRole,
  type WidgetId,
} from '../model';
import { Glyph } from '../ui/glyphs';
import { AppIcon, FolderIcon, ShortcutIcon, WidgetFrame, type IconHandlers, type LaunchOrigin } from './Icons';
import styles from '../ios.module.css';

export interface WidgetData {
  readonly name: string;
  readonly roleLine: string;
  readonly updated: string;
  readonly openTo: string;
  readonly location: string;
  readonly hasPdf: boolean;
  readonly project: {
    readonly slug: string;
    readonly name: string;
    readonly meta: string;
  } | null;
}

export interface HomeHandle {
  /** Jump (no animation) to a page — the close flight's step 1. */
  jumpTo(page: number): void;
  page(): number;
  element(): HTMLElement | null;
}

export interface HomeProps extends IconHandlers {
  readonly layout: HomeLayout;
  readonly shortcuts: readonly FolderShortcut[];
  readonly widgets: WidgetData;
  readonly badges: { readonly mailRead: boolean; readonly featured: number };
  readonly folderOpen: boolean;
  readonly flying: string | null;
  readonly initialPage: number;
  readonly onPage: (page: number) => void;
  readonly onFolder: (button: HTMLElement) => void;
  readonly onSearch: (from: HTMLElement) => void;
  readonly onOpenContent: (ref: ContentRef, origin: LaunchOrigin) => void;
  readonly onWidgetActions: (widget: WidgetId, anchor: HTMLElement) => void;
  readonly onDownload: () => void;
  /** A downward pull on the pages (Spotlight follows it): travel in px, then the release with its velocity. */
  readonly onPull: (dy: number) => void;
  readonly onPullEnd: (dy: number, velocity: number) => void;
  readonly onEmptyLongPress: () => void;
  readonly folderFocusKey?: string;
}

const CELL_STYLE = (placed: { col: number; row: number; w: number; h: number }) => ({
  gridColumn: `${placed.col + 1} / span ${placed.w}`,
  gridRow: `${placed.row + 1} / span ${placed.h}`,
});

export const Home = forwardRef<HomeHandle, HomeProps>(function Home(props, ref) {
  const { layout, onPage, initialPage } = props;
  const pager = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(Math.min(initialPage, layout.pages.length - 1));
  const [scrolling, setScrolling] = useState(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageRef = useRef(page);

  useImperativeHandle(
    ref,
    () => ({
      jumpTo(index) {
        const el = pager.current;
        if (!el) return;
        const clamped = Math.max(0, Math.min(layout.pages.length - 1, index));
        el.scrollTo({ left: clamped * el.clientWidth, behavior: 'instant' as ScrollBehavior });
        pageRef.current = clamped;
        setPage(clamped);
      },
      page: () => pageRef.current,
      element: () => pager.current,
    }),
    [layout.pages.length],
  );

  // Restore the remembered page on mount (paging is session state).
  useEffect(() => {
    const el = pager.current;
    if (el && page > 0) el.scrollLeft = page * el.clientWidth;
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the visible page after a reflow (rotation / resize): stay on the same page index.
  useEffect(() => {
    const el = pager.current;
    if (!el) return;
    const keep = Math.min(pageRef.current, layout.pages.length - 1);
    el.scrollLeft = keep * el.clientWidth;
  }, [layout]);

  // Page from the scroll position (native scroll-snap); the pill shows dots while it moves.
  const onScroll = () => {
    const el = pager.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    if (index !== pageRef.current) {
      pageRef.current = index;
      setPage(index);
      onPage(index);
    }
    setScrolling(true);
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => setScrolling(false), 900);
  };
  useEffect(
    () => () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    },
    [],
  );

  const goPage = (index: number) => {
    const el = pager.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  // Mouse: click-drag pages (touch pages natively); the wheel turns one page per gesture.
  const wheelLock = useRef(0);
  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return; // trackpad horizontal: native
    if (Math.abs(event.deltaY) < 12 || event.timeStamp - wheelLock.current < 450) return;
    wheelLock.current = event.timeStamp;
    const next = pageRef.current + (event.deltaY > 0 ? 1 : -1);
    if (next >= 0 && next < layout.pages.length) goPage(next);
  };
  const emptyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    const onItem = target.closest('a, button, [data-widget]');
    // Long-press on an empty area (2 s): the no-jiggle-mode egg (EGG-SHAKE-01).
    if (!onItem && event.button === 0) {
      const start = { x: event.clientX, y: event.clientY };
      const cancel = () => {
        if (emptyTimer.current) clearTimeout(emptyTimer.current);
        emptyTimer.current = null;
        window.removeEventListener('pointerup', cancel);
        window.removeEventListener('pointermove', move);
      };
      const move = (moveEvent: PointerEvent) => {
        if (Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y) > 10) cancel();
      };
      emptyTimer.current = setTimeout(() => {
        cancel();
        props.onEmptyLongPress();
      }, 2000);
      window.addEventListener('pointerup', cancel);
      window.addEventListener('pointermove', move, { passive: true });
    }
    // One drag, locked to its first clear direction: sideways pages (mouse — touch pages natively), downward
    // pulls Spotlight (plans/ios/surfaces/home-screen "Pull down on the grid", threshold 60 pt, interactive).
    if (event.button > 0) return;
    const el = pager.current;
    if (!el) return;
    const startLeft = el.scrollLeft;
    let axis: 'x' | 'y' | null = null;
    let velocity = 0;
    let last = { t: performance.now(), y: 0 };
    drag(el, event.nativeEvent, {
      threshold: 8,
      lazyCapture: true,
      onMove: (dx, dy) => {
        if (!axis) {
          axis = Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? 'y' : null) : event.pointerType === 'mouse' ? 'x' : null;
          if (axis === 'x') el.style.scrollSnapType = 'none';
          if (!axis) return;
        }
        if (axis === 'x') el.scrollLeft = startLeft - dx;
        else {
          const t = performance.now();
          if (t > last.t) velocity = ((dy - last.y) / (t - last.t)) * 1000;
          last = { t, y: dy };
          props.onPull(Math.max(0, dy));
        }
      },
      onEnd: ({ dx, dy, moved }) => {
        if (axis === 'y') {
          props.onPullEnd(Math.max(0, dy), velocity);
          return;
        }
        el.style.scrollSnapType = '';
        if (!moved || axis !== 'x') return;
        const width = el.clientWidth;
        const base = Math.round(startLeft / width);
        const next = Math.abs(dx) > width * 0.18 ? base + (dx < 0 ? 1 : -1) : base;
        goPage(Math.max(0, Math.min(layout.pages.length - 1, next)));
      },
    });
  };

  const pad = layout.layout === 'pad';
  const total = layout.pages.length;

  const renderItem = (item: HomeItem) => {
    switch (item.kind) {
      case 'app': {
        const binding = iosBinding(item.role);
        const badge = badgeFor(item.role, props.badges);
        return (
          <AppIcon
            role={item.role}
            itemKey={item.id}
            size={layout.icon}
            label
            badge={badge}
            name={iconName(binding.title, item.role, badge)}
            flying={props.flying === item.id}
            onLaunch={props.onLaunch}
            onQuickActions={props.onQuickActions}
            onPrefetch={props.onPrefetch}
            focusKeyFor={props.focusKeyFor}
          />
        );
      }
      case 'folder':
        return (
          <FolderIcon
            shortcuts={props.shortcuts}
            size={layout.icon}
            name={folderName(props.shortcuts)}
            open={props.folderOpen}
            focusKey={props.folderFocusKey}
            onOpen={props.onFolder}
            flying={props.flying === item.id}
          />
        );
      case 'shortcut': {
        const target = SHORTCUT_TARGET[item.shortcut];
        const tints: Record<typeof item.shortcut, readonly [string, string]> = {
          about: ['#5ac8fa', '#007aff'],
          projects: ['#8e8e93', '#3a3a3c'],
          contact: ['#64d2ff', '#0a84ff'],
        };
        return (
          <ShortcutIcon
            itemKey={item.id}
            label={target.label}
            target={target.ref}
            symbol={item.shortcut}
            tint={tints[item.shortcut]}
            size={layout.icon}
            onOpen={props.onOpenContent}
          />
        );
      }
      case 'widget':
        return (
          <Widget id={item.widget} size={pad ? 'small' : item.widget === 'resume' ? 'medium' : 'small'} {...props} />
        );
    }
  };

  return (
    <div
      className={styles.homeScreen}
      data-home-screen=""
      data-layout={layout.layout}
      data-landscape={layout.landscape || undefined}
    >
      <RovingGroup as="div" orientation="grid" className={styles.pager} aria-label="Home Screen" role="group">
        <div
          ref={pager}
          className={styles.pagerTrack}
          onScroll={onScroll}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          data-pager=""
        >
          {layout.pages.map((pageSpec) => (
            <div
              key={pageSpec.index}
              className={styles.page}
              data-page={pageSpec.index}
              style={{
                ['--cols' as string]: layout.columns,
                ['--rows' as string]: layout.rows,
                ['--icon' as string]: `${layout.icon}px`,
              }}
            >
              {pageSpec.widgetsBlock ? (
                <div className={styles.widgetsBlock} data-widgets-block="">
                  <Widget id="resume" size="large" {...props} />
                  <div className={styles.widgetRow}>
                    <Widget id="open-to-work" size="small" {...props} />
                    {props.widgets.project ? <Widget id="projects" size="small" {...props} /> : null}
                  </div>
                </div>
              ) : null}
              <ul className={styles.grid} aria-label={`Page ${pageSpec.index + 1} of ${total}`} role="list">
                {pageSpec.items.map((placed) => (
                  <li
                    key={placed.item.id}
                    className={styles.cell}
                    style={CELL_STYLE(placed)}
                    data-cell={placed.item.id}
                  >
                    {renderItem(placed.item)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </RovingGroup>
      <div className={styles.searchDock} data-scrolling={scrolling || undefined}>
        <button
          type="button"
          className={styles.searchPill}
          id="ios-search-pill"
          onClick={(event) => props.onSearch(event.currentTarget)}
        >
          <Glyph name="search" size={13} strokeWidth={2.6} />
          Search
        </button>
        <div className={styles.dots} role="group" aria-label="Pages">
          {layout.pages.map((pageSpec) => (
            <button
              key={pageSpec.index}
              type="button"
              className={styles.dot}
              aria-label={`Page ${pageSpec.index + 1} of ${total}`}
              aria-current={pageSpec.index === page ? 'true' : undefined}
              onClick={() => goPage(pageSpec.index)}
              onFocus={() => setScrolling(true)}
              onBlur={() => setScrolling(false)}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

function Widget({
  id,
  size,
  widgets,
  onOpenContent,
  onWidgetActions,
  onDownload,
}: HomeProps & { readonly id: WidgetId; readonly size: 'large' | 'medium' | 'small' }) {
  if (id === 'resume') {
    const ref: ContentRef = { section: 'resume' };
    return (
      <WidgetFrame
        id="resume"
        size={size}
        eyebrow="Résumé"
        href={hrefFor({ os: 'ios', ref })}
        label="Résumé — open"
        onOpen={(origin) => onOpenContent(ref, origin)}
        onLongPress={(anchor) => onWidgetActions('resume', anchor)}
        aside={
          widgets.hasPdf ? (
            <button type="button" className={styles.widgetDownload} onClick={onDownload}>
              Download<span className="sr-only"> résumé (PDF)</span>
            </button>
          ) : null
        }
      >
        <span className={styles.widgetTitle}>{widgets.name}</span>
        <span className={styles.widgetLine}>{widgets.roleLine}</span>
        <span className={styles.widgetMuted}>Updated {widgets.updated}</span>
        <span className={styles.widgetOpen} aria-hidden="true">
          Open
        </span>
      </WidgetFrame>
    );
  }
  if (id === 'open-to-work') {
    const ref: ContentRef = { section: 'contact' };
    return (
      <WidgetFrame
        id="open-to-work"
        size={size}
        eyebrow="Open to work"
        href={hrefFor({ os: 'ios', ref })}
        label={`Open to work: ${widgets.openTo} — open Mail`}
        onOpen={(origin) => onOpenContent(ref, origin)}
        onLongPress={(anchor) => onWidgetActions('open-to-work', anchor)}
      >
        <span className={styles.widgetStrong}>{widgets.openTo}</span>
        <span className={styles.widgetMuted}>{widgets.location}</span>
      </WidgetFrame>
    );
  }
  if (!widgets.project) return null;
  const ref: ContentRef = { section: 'projects', slug: widgets.project.slug };
  return (
    <WidgetFrame
      id="projects"
      size={size}
      eyebrow="Projects"
      href={hrefFor({ os: 'ios', ref })}
      label={`Projects: ${widgets.project.name} — open in GitHub`}
      onOpen={(origin) => onOpenContent(ref, origin)}
      onLongPress={(anchor) => onWidgetActions('projects', anchor)}
    >
      <span className={styles.widgetStrong}>{widgets.project.name}</span>
      <span className={styles.widgetLine}>{widgets.project.meta}</span>
    </WidgetFrame>
  );
}

export interface DockProps extends IconHandlers {
  readonly layout: HomeLayout;
  readonly recents: readonly IosRole[];
  readonly badges: { readonly mailRead: boolean; readonly featured: number };
  readonly flying: string | null;
}

/**
 * The Dock (plans/ios/surfaces/dock.md): four fixed apps on a frosted plate, no labels, no running indicators; Files'
 * Dock icon opens straight to the résumé. Full page: a floating Dock with a divider and up to three recent apps.
 * `nav[aria-label="Dock"] > ul > li > a`, roving Left/Right (Up/Down on the trailing edge).
 */
export function Dock({ layout, recents, badges, flying, ...handlers }: DockProps) {
  const vertical = layout.dock === 'trailing';
  const pad = layout.layout === 'pad';
  const size = layout.icon;
  const names: Readonly<Partial<Record<AppRole, string>>> = { files: 'Files, Résumé' };
  const icon = (role: IosRole, key: string, location = dockLocation(role)) => {
    const badge = badgeFor(role, badges);
    const binding = iosBinding(role);
    return (
      <li key={key}>
        <AppIcon
          role={role}
          itemKey={key}
          size={size}
          label={false}
          badge={badge}
          name={iconName(names[role] ?? binding.title, role, badge)}
          location={location}
          flying={flying === key}
          {...handlers}
        />
      </li>
    );
  };
  return (
    <nav className={styles.dock} aria-label="Dock" data-dock="" data-layout={layout.layout} data-edge={layout.dock}>
      <RovingGroup as="ul" orientation={vertical ? 'vertical' : 'horizontal'} className={styles.dockList} role="list">
        {DOCK.map((role) => icon(role, `dock:${role}`))}
        {pad && recents.length > 0 ? (
          <>
            <li className={styles.dockDivider} aria-hidden="true" />
            {recents.map((role) => icon(role, `recent:${role}`, undefined))}
          </>
        ) : null}
      </RovingGroup>
    </nav>
  );
}

/** Measure an item (by key) for a flight; `null` when it is not on screen. */
export const itemElement = (key: string): HTMLElement | null => document.getElementById(`ios-icon-${key}`);
