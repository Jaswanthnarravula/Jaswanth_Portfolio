'use client';
/**
 * The open Career folder — plans/ios/surfaces/folders.md (`IOS-FOLD-01…04`). It **expands from its icon** into a
 * centred rounded panel (radius 38 pt, material `thick`, ≈ 86 % wide — max 520 pt on the full page) with the title
 * "Career" above and a 3 × 3 grid of 60 pt shortcut icons; the Home Screen behind blurs and dims (one blur surface).
 * Tap outside / swipe down / Esc / the Home indicator close it back into its icon (the same physics as apps:
 * open r 0.42 ζ 0.86, close r 0.50 ζ 0.80). Items are links: an item opens its app **from that item's rect**; on Home
 * the return flight targets the folder icon (the shell's fallback order). Modal `dialog` labelled "Career", a `ul`
 * of links in a 2-D roving group; focus → the first item; closing returns focus to the folder button.
 */
import { useEffect, useLayoutEffect, useRef, type MouseEvent } from 'react';
import { RovingGroup } from '@/components/primitives/RovingGroup';
import { hrefFor } from '@/components/shell/KernelLink';
import type { ContentRef } from '@/data/schema';
import { drag } from '@/lib/motion/drag';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { commits, type FolderShortcut } from '../model';
import { IOS_SPRINGS, springSamples } from '../motion';
import { ShortcutArt, type LaunchOrigin } from './Icons';
import styles from '../ios.module.css';

const isPlainClick = (event: MouseEvent) =>
  !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

export interface FolderPanelProps {
  readonly shortcuts: readonly FolderShortcut[];
  readonly closing: boolean;
  /** The folder icon (the panel grows out of it and returns into it). */
  readonly origin: () => HTMLElement | null;
  readonly onClose: () => void;
  readonly onClosed: () => void;
  readonly onOpenItem: (ref: ContentRef, origin: LaunchOrigin) => void;
}

/** A uniform transform that maps the panel's box onto the icon's box (scale about the centres). */
function iconTransform(panel: DOMRect, icon: DOMRect): string {
  const scale = icon.width / panel.width;
  const dx = icon.left + icon.width / 2 - (panel.left + panel.width / 2);
  const dy = icon.top + icon.height / 2 - (panel.top + panel.height / 2);
  return `translate(${dx}px, ${dy}px) scale(${scale})`;
}

export function FolderPanel({ shortcuts, closing, origin, onClose, onClosed, onOpenItem }: FolderPanelProps) {
  const panel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const opened = useRef(false);

  // Open: grow out of the folder icon (spring sampled into keyframes, compositor-only); focus the first item.
  useLayoutEffect(() => {
    const el = panel.current;
    const icon = origin();
    el?.querySelector<HTMLElement>('[data-roving-item]')?.focus({ preventScroll: true });
    if (!el || opened.current) return;
    opened.current = true;
    if (!icon || typeof el.animate !== 'function') return;
    if (prefersReducedMotion()) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
      backdrop.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
      return;
    }
    const from = iconTransform(el.getBoundingClientRect(), icon.getBoundingClientRect());
    const { values, durationMs } = springSamples(IOS_SPRINGS.folderOpen, 18);
    el.animate(
      values.map((v, index) => ({ transform: index === values.length - 1 ? 'none' : blend(from, v) })),
      { duration: durationMs },
    );
    backdrop.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
    // Once per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close: back into the icon (re-measured now), then unmount.
  useEffect(() => {
    if (!closing) return;
    const el = panel.current;
    const icon = origin();
    if (!el || typeof el.animate !== 'function') {
      onClosed();
      return;
    }
    const reduced = prefersReducedMotion();
    const to = icon ? iconTransform(el.getBoundingClientRect(), icon.getBoundingClientRect()) : 'scale(0.85)';
    const { values, durationMs } = springSamples(IOS_SPRINGS.folderClose, 18);
    const animation = reduced
      ? el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' })
      : el.animate(
          values.map((v) => ({
            transform: blend(to, 1 - Math.min(1, v)),
            opacity: v > 0.92 ? Math.max(0, (1 - v) * 12) : 1,
          })),
          { duration: Math.min(durationMs, 480), fill: 'forwards' },
        );
    backdrop.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduced ? 150 : 260, fill: 'forwards' });
    animation.onfinish = onClosed;
    animation.oncancel = onClosed;
    // An interrupted exit (a reopen, or the surface replaced) is not a close: detach before cancelling.
    return () => {
      animation.onfinish = null;
      animation.oncancel = null;
      animation.cancel();
    };
  }, [closing, origin, onClosed]);

  // Swipe down on the panel closes it (projected); Esc closes; outside press closes.
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('a')) return;
    const el = panel.current;
    if (!el) return;
    let velocity = 0;
    let last = { t: performance.now(), y: 0 };
    drag(el, event.nativeEvent, {
      threshold: 6,
      onMove: (_dx, dy) => {
        const t = performance.now();
        if (t > last.t) velocity = ((dy - last.y) / (t - last.t)) * 1000;
        last = { t, y: dy };
        el.style.transform = `translateY(${Math.max(0, dy)}px)`;
      },
      onEnd: ({ dy, moved }) => {
        el.style.transform = '';
        if (moved && commits(Math.max(0, dy) / 400, velocity / 400)) onClose();
      },
    });
  };

  return (
    <div className={styles.folderLayer} data-folder-layer="" data-closing={closing || undefined}>
      <div
        ref={backdrop}
        className={styles.folderBackdrop}
        aria-hidden="true"
        onClick={onClose}
        data-folder-backdrop=""
      />
      {/* A modal surface owns Esc / Tab and its drag (keys reach it from the control inside). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-folder-title"
        className={styles.folderPanel}
        data-folder-panel=""
        onPointerDown={onPointerDown}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
          if (event.key === 'Tab') event.preventDefault();
        }}
      >
        <h2 id="ios-folder-title" className={styles.folderTitle}>
          Career
        </h2>
        <RovingGroup as="ul" orientation="grid" className={styles.folderGrid} role="list" aria-label="Career shortcuts">
          {shortcuts.map((shortcut) => (
            <li key={shortcut.id}>
              <a
                id={`ios-icon-folder:career/${shortcut.id}`}
                href={hrefFor({ os: 'ios', ref: shortcut.ref })}
                className={`${styles.icon} ${styles.pressable}`}
                data-roving-item=""
                data-label={shortcut.label}
                aria-label={shortcut.label}
                draggable={false}
                onClick={(event) => {
                  if (!isPlainClick(event)) return;
                  event.preventDefault();
                  onOpenItem(shortcut.ref, { key: `folder:career/${shortcut.id}`, element: event.currentTarget });
                }}
              >
                <span className={styles.artWrap}>
                  <ShortcutArt symbol={shortcut.symbol} tint={shortcut.tint} size={60} />
                </span>
                <span className={styles.iconLabel} aria-hidden="true">
                  {shortcut.label}
                </span>
              </a>
            </li>
          ))}
        </RovingGroup>
      </div>
    </div>
  );
}

/** Mix `translate(x, y) scale(s)` toward identity by `t` (0 = the transform, 1 = identity). */
function blend(transform: string, t: number): string {
  const match = transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/);
  if (!match) {
    const scale = transform.match(/scale\(([-\d.]+)\)/);
    const s = scale ? Number(scale[1]) : 1;
    return `scale(${s + (1 - s) * t})`;
  }
  const [, x, y, s] = match.map(Number) as [number, number, number, number];
  return `translate(${x * (1 - t)}px, ${y * (1 - t)}px) scale(${s + (1 - s) * t})`;
}
