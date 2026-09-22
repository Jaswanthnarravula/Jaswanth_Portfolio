'use client';
/**
 * Mission Control at desktop sizes (plans/macos/surfaces/mission-control.md `MAC-MC-01/02/04/05`). The live windows —
 * not screenshots — shrink into a non-overlapping grid computed by the shared pure packer (`packOverview`): every
 * window flies from its rect to its tile in one GSAP timeline (420 ms `0.3, 0, 0.1, 1`, one ticker pass), the wallpaper
 * dims, the Dock and menu bar stay. Windows are `inert` while in the overview. Choosing a tile focuses that window and
 * every window flies back; Esc or the empty space exits with the previous focus; a second request mid-flight reverses
 * the same timeline. Reduced motion: an instant layout switch (the scrim crossfades 150 ms).
 * A modal `dialog` "Mission Control" holding a list of buttons laid over the tiles ("{App} — {place}"): arrows move,
 * Enter chooses, Delete/Backspace closes the focused window (the ✕ is the visible alternative). No windows → "No open
 * windows" with shortcuts to Finder, GitHub and the résumé. Compact uses the carousel (./MissionControl).
 */
import { gsap } from 'gsap';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { packOverview, type PackedTile } from '@/components/os/shared/overview-pack';
import { FocusScope } from '@/components/primitives/FocusScope';
import { RovingGroup } from '@/components/primitives/RovingGroup';
import { AssetIcon } from '@/components/ui/AssetIcon';
import { macosInsets } from '@/lib/kernel/registry';
import type { WindowId } from '@/lib/kernel/types';
import { prefersReducedMotion, REDUCED_CROSSFADE_MS } from '@/lib/motion/dur';
import { useKernel } from '@/stores/kernel-context';
import { afterQueued, dispatchSoon, getKernel } from '@/stores/kernel-store';
import { getPrefs } from '@/stores/prefs-store';
import { CloseMark } from '../icons';
import { macBinding, windowLabel } from '../model';
import { MAC_MOTION } from '../motion';
import { runMacCommand } from '../run-command';
import { MAC_TIMING } from '../timing';
import styles from './overview.module.css';

const GAP = 28;
const LABEL = 30;
const MIN_TILE = 180;
const MARGIN = 40;

/** The windows Mission Control spreads out: open, not minimized, not closing — back to front. */
function liveWindows(): WindowId[] {
  const { windows, zOrder } = getKernel().sessions.macos;
  return zOrder.filter((id) => {
    const phase = windows[id]?.phase.s;
    return phase === 'normal' || phase === 'maximized' || phase === 'opening';
  });
}

interface Entry {
  readonly tiles: readonly PackedTile[];
  readonly rects: readonly { id: WindowId; rect: { x: number; y: number; w: number; h: number } }[];
}

/** Measure the live windows and pack them (once per entry, before the first paint). */
function measure(viewport: { w: number; h: number } & Parameters<typeof macosInsets>[0]): Entry {
  const rects = liveWindows().flatMap((id) => {
    const el = document.querySelector<HTMLElement>(`[data-window="${id}"]`);
    if (!el) return [];
    const box = el.getBoundingClientRect();
    return [{ id, rect: { x: box.left, y: box.top, w: box.width, h: box.height } }];
  });
  const insets = macosInsets(viewport, getPrefs());
  const area = {
    x: MARGIN,
    y: insets.top + MARGIN,
    w: viewport.w - MARGIN * 2,
    h: viewport.h - insets.top - insets.bottom - MARGIN * 2,
  };
  return { rects, tiles: packOverview(rects, { area, gap: GAP, label: LABEL, minWidth: MIN_TILE }).tiles };
}

export function Overview({ onClose }: { readonly onClose: () => void }) {
  const viewport = useKernel((state) => state.viewport);
  const focused = useKernel((state) => state.sessions.macos.focused);
  const windows = useKernel((state) => state.sessions.macos.windows);
  // Packed during the first render so the tile buttons exist when focus moves in.
  const [entry] = useState(() => measure(viewport));
  const tiles = entry.tiles;
  const timeline = useRef<gsap.core.Timeline | null>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);

  // Enter: fly every window into its tile at once (transform only).
  useLayoutEffect(() => {
    const elements = entry.rects
      .map(({ id }) => ({ id, el: document.querySelector<HTMLElement>(`[data-window="${id}"]`) }))
      .filter((item): item is { id: WindowId; el: HTMLElement } => item.el !== null);
    const rects = entry.rects;
    const packing = entry;
    const reduced = prefersReducedMotion();
    const tl = gsap.timeline({ paused: true });
    for (const { id, el } of elements) {
      const from = rects.find((item) => item.id === id)!.rect;
      const tile = packing.tiles.find((item) => item.id === id);
      if (!tile) continue;
      el.setAttribute('inert', '');
      el.dataset.overview = '';
      tl.fromTo(
        el,
        { x: 0, y: 0, scale: 1, transformOrigin: '0 0' },
        {
          x: tile.x - from.x,
          y: tile.y - from.y,
          scale: tile.scale,
          duration: reduced ? 0 : MAC_TIMING.mission.ms / 1000,
          ease: MAC_MOTION.zoom.ease,
        },
        0,
      );
    }
    if (scrim.current)
      tl.fromTo(
        scrim.current,
        { opacity: 0 },
        { opacity: 1, duration: (reduced ? REDUCED_CROSSFADE_MS : 200) / 1000, ease: 'none' },
        0,
      );
    timeline.current = tl;
    tl.play();
    return () => {
      tl.kill();
      for (const { el } of elements) {
        el.removeAttribute('inert');
        delete el.dataset.overview;
        gsap.set(el, { clearProps: 'transform,transformOrigin' });
      }
    };
    // Packed once per entry; a window opening or closing meanwhile ends the overview (regrid = re-enter).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Fly every window back (reversing from wherever the flight is), then leave. */
  const exit = (choose?: WindowId) => {
    if (leaving.current) return;
    leaving.current = true;
    if (choose) dispatchSoon({ type: 'FOCUS_WINDOW', id: choose });
    const tl = timeline.current;
    if (!tl || prefersReducedMotion()) {
      onClose();
      return;
    }
    tl.eventCallback('onReverseComplete', onClose);
    tl.reverse();
  };

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      exit();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // exit reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeWindow = (id: WindowId) => {
    dispatchSoon({ type: 'CLOSE_WINDOW', id });
    afterQueued(() => exit());
  };
  const onTileKey = (event: KeyboardEvent<HTMLButtonElement>, id: WindowId) => {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    event.preventDefault();
    closeWindow(id);
  };

  const empty = tiles.length === 0;
  return (
    <>
      <div ref={scrim} className={styles.scrim} aria-hidden="true" />
      <div
        className={styles.layer}
        role="dialog"
        aria-modal="true"
        aria-label="Mission Control"
        data-overview=""
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) exit();
        }}
      >
        <FocusScope trapped restoreFocus initialFocus>
          {empty ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>No open windows</p>
              <ul className={styles.shortcuts}>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      exit();
                      runMacCommand({ kind: 'open', role: 'files' });
                    }}
                  >
                    Open Finder
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      exit();
                      runMacCommand({ kind: 'open', role: 'github' });
                    }}
                  >
                    Open GitHub
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      exit();
                      runMacCommand({ kind: 'resume-open' });
                    }}
                  >
                    Open Résumé
                  </button>
                </li>
              </ul>
            </div>
          ) : (
            <RovingGroup as="ul" orientation="grid" role="list" className={styles.tiles} aria-label="Open windows">
              {tiles.map((tile) => {
                const window = windows[tile.id as WindowId];
                if (!window) return null;
                const label = windowLabel(window);
                return (
                  <li
                    key={tile.id}
                    className={styles.tile}
                    style={{ left: tile.x, top: tile.y, width: tile.w, height: tile.h + LABEL }}
                  >
                    <button
                      type="button"
                      className={styles.pick}
                      data-roving-item=""
                      aria-current={focused === tile.id ? 'true' : undefined}
                      onClick={() => exit(tile.id as WindowId)}
                      onKeyDown={(event) => onTileKey(event, tile.id as WindowId)}
                      style={{ height: tile.h }}
                    >
                      <span className={styles.label}>
                        <AssetIcon id={macBinding(window.role).icon} size={18} />
                        {label}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.close}
                      aria-label={`Close ${label}`}
                      onClick={() => closeWindow(tile.id as WindowId)}
                    >
                      <CloseMark />
                    </button>
                  </li>
                );
              })}
            </RovingGroup>
          )}
        </FocusScope>
      </div>
    </>
  );
}
