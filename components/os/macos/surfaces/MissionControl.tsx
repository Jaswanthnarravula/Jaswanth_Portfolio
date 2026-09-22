'use client';
/**
 * Mission Control in compact mode — plans/macos/surfaces/mission-control.md, P2 scope `MAC-MC-03`: with one window
 * visible at a time, this is *the* window switcher. A vertical carousel of cards (one per window, 70 % of the height,
 * scroll-snapped) over the dimmed wallpaper; tap or Enter chooses, the ✕ on a card (or Delete/Backspace) closes that
 * window, Esc or the empty space exits. A modal `dialog` "Mission Control" whose cards are buttons named
 * "{App} — {place}"; focus returns to the invoker. The full grid overview (desktop sizes) is P3 (`MAC-MC-01/02/04/05`).
 */
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { FocusScope } from '@/components/primitives/FocusScope';
import { RovingGroup } from '@/components/primitives/RovingGroup';
import { AssetIcon } from '@/components/ui/AssetIcon';
import type { WindowId, WindowInstance } from '@/lib/kernel/types';
import { useKernel } from '@/stores/kernel-context';
import { afterQueued, dispatchSoon as dispatch } from '@/stores/kernel-store';
import { CloseMark } from '../icons';
import { macBinding, windowLabel } from '../model';
import styles from '../macos.module.css';

export function MissionControl({ onClose }: { readonly onClose: () => void }) {
  const windows = useKernel((state) => state.sessions.macos.windows);
  const zOrder = useKernel((state) => state.sessions.macos.zOrder);
  const focused = useKernel((state) => state.sessions.macos.focused);
  const root = useRef<HTMLDivElement>(null);
  // Front-most first, minimized windows included (choosing one restores it).
  const cards = [...zOrder]
    .reverse()
    .map((id) => windows[id])
    .filter((window): window is WindowInstance => !!window && window.phase.s !== 'closing');

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const choose = (id: WindowId) => {
    dispatch({ type: 'FOCUS_WINDOW', id });
    onClose();
  };
  const close = (id: WindowId) => {
    dispatch({ type: 'CLOSE_WINDOW', id });
    // Keep focus inside the switcher on the next card (the closing card leaves the list).
    afterQueued(() => root.current?.querySelector<HTMLElement>('[data-card]')?.focus({ preventScroll: true }));
  };
  const onCardKey = (event: KeyboardEvent<HTMLButtonElement>, id: WindowId) => {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    event.preventDefault();
    close(id);
  };

  return (
    <div
      ref={root}
      className={styles.mission}
      role="dialog"
      aria-modal="true"
      aria-label="Mission Control"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <FocusScope trapped restoreFocus initialFocus>
        {cards.length === 0 ? (
          <p className={styles.missionEmpty}>No open windows</p>
        ) : (
          <RovingGroup as="ul" orientation="vertical" role="list" className={styles.cards} aria-label="Open windows">
            {cards.map((window) => {
              const binding = macBinding(window.role);
              const label = windowLabel(window);
              return (
                <li key={window.id} className={styles.cardItem}>
                  <button
                    type="button"
                    className={styles.card}
                    data-card=""
                    data-roving-item=""
                    aria-current={focused === window.id ? 'true' : undefined}
                    onClick={() => choose(window.id)}
                    onKeyDown={(event) => onCardKey(event, window.id)}
                  >
                    <span className={styles.cardChrome} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <AssetIcon id={binding.icon} size={64} className={styles.cardIcon} />
                    <span className={styles.cardTitle}>{label}</span>
                    {window.phase.s === 'minimized' ? <span className={styles.cardState}>Minimized</span> : null}
                  </button>
                  <button
                    type="button"
                    className={styles.cardClose}
                    aria-label={`Close ${label}`}
                    onClick={() => close(window.id)}
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
  );
}
