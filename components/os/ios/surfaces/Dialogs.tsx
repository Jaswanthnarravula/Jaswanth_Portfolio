'use client';
/**
 * iOS system sheets and the tour's coach mark:
 *   · Switch OS (plans/ios/surfaces/control-center "Switch OS", 07 `IOS-X-05`): a sheet listing the other operating
 *     systems (the visible set) and "Back to chooser" — choosing one parks the iOS session (`SWITCH_OS`).
 *   · Keyboard shortcuts (the `?` dialog): the shared registry (shared/09 `A11Y-KEY-01`) in iOS words, plus
 *     "Take the Tour".
 *   · The coach mark (plans/ios/07 "Guided tour"): a material `thick` rounded card with a small pointer and an accent
 *     highlight ring on its target (a pulse on touch); Next / End buttons; never a dimming overlay.
 */
import { useLayoutEffect, useRef } from 'react';
import { formatChord, SHORTCUTS } from '@/lib/kernel/keymap';
import { OS_NAMES, type OsId } from '@/lib/kernel/ids';
import { VISIBLE_OSES } from '@/lib/kernel/route';
import type { TourStep } from '@/lib/tour';
import { Group, Row } from '../ui/kit';
import { Sheet } from '../ui/Sheet';
import styles from '../ios.module.css';

export function SwitchOsSheet({
  open,
  onCancel,
  onChoose,
  returnFocus,
}: {
  readonly open: boolean;
  readonly onCancel: () => void;
  readonly onChoose: (os: OsId | null) => void;
  readonly returnFocus?: HTMLElement | null;
}) {
  const others = VISIBLE_OSES.filter((os) => os !== 'ios');
  return (
    <Sheet
      open={open}
      title="Switch Operating System"
      cancelLabel="Cancel"
      onCancel={onCancel}
      detent="medium"
      returnFocus={returnFocus}
    >
      <div className={styles.sheetPad}>
        <Group footer="Your place in iOS is kept — come back any time.">
          {others.map((os) => (
            <Row
              key={os}
              kind="button"
              title={OS_NAMES[os]}
              accessory="chevron"
              onPress={() => onChoose(os)}
              dataAttrs={{ 'data-switch-os': os }}
            />
          ))}
        </Group>
        <Group>
          <Row
            kind="button"
            title="Back to chooser"
            onPress={() => onChoose(null)}
            dataAttrs={{ 'data-switch-os': 'chooser' }}
          />
        </Group>
      </div>
    </Sheet>
  );
}

const SHORTCUT_WORDS: Partial<Record<(typeof SHORTCUTS)[number]['id'], string>> = {
  search: 'Search (Spotlight)',
  'search-slash': 'Search (Spotlight)',
  home: 'Go Home',
  overview: 'App Switcher',
  'switch-os': 'Switch operating system',
  dismiss: 'Back one level (sheet → screen → Home)',
  help: 'Keyboard shortcuts',
};

export function ShortcutsSheet({
  open,
  onCancel,
  onTour,
}: {
  readonly open: boolean;
  readonly onCancel: () => void;
  readonly onTour: () => void;
}) {
  const apple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const rows = SHORTCUTS.filter((shortcut) => SHORTCUT_WORDS[shortcut.id]);
  return (
    <Sheet open={open} title="Keyboard Shortcuts" cancelLabel="Done" onCancel={onCancel} detent="large">
      <div className={styles.sheetPad}>
        <Group>
          {rows.map((shortcut) => (
            <Row
              key={shortcut.id}
              kind="static"
              title={SHORTCUT_WORDS[shortcut.id]}
              value={
                <kbd className={styles.kbd}>
                  {shortcut.chords.map((chord) => formatChord(chord, apple)).join(' / ')}
                </kbd>
              }
            />
          ))}
          <Row kind="static" title="Move between icons" value={<kbd className={styles.kbd}>← ↑ → ↓</kbd>} />
          <Row
            kind="static"
            title="Quick actions for the focused icon"
            value={<kbd className={styles.kbd}>Shift+F10</kbd>}
          />
        </Group>
        <Group>
          <Row kind="button" title="Take the Tour" onPress={onTour} accessory="chevron" />
        </Group>
      </div>
    </Sheet>
  );
}

export function CoachMark({
  step,
  index,
  total,
  onNext,
  onEnd,
}: {
  readonly step: TourStep;
  readonly index: number;
  readonly total: number;
  readonly onNext: () => void;
  readonly onEnd: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLSpanElement>(null);
  // Measure the target, then place the card and the ring (static geometry, written once per step).
  useLayoutEffect(() => {
    const target = step.pointAt ? document.getElementById(step.pointAt) : null;
    const rect = target?.getBoundingClientRect() ?? null;
    const el = card.current;
    if (!el) return;
    const width = Math.min(320, window.innerWidth - 32);
    const height = el.getBoundingClientRect().height || 120;
    let x = (window.innerWidth - width) / 2;
    let y = window.innerHeight * 0.3;
    if (rect) {
      const below = rect.bottom + 16 + height < window.innerHeight - 24;
      x = Math.min(Math.max(16, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 16);
      y = below ? rect.bottom + 16 : Math.max(16, rect.top - 16 - height);
    }
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    const r = ring.current;
    if (r) {
      r.hidden = !rect;
      if (rect) {
        r.style.left = `${rect.left - 6}px`;
        r.style.top = `${rect.top - 6}px`;
        r.style.width = `${rect.width + 12}px`;
        r.style.height = `${rect.height + 12}px`;
      }
    }
    el.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }, [step]);
  return (
    <div className={styles.coachLayer} data-coach="">
      <span ref={ring} className={styles.coachRing} aria-hidden="true" hidden />
      <div ref={card} className={styles.coach} role="dialog" aria-label={`Tour, step ${index + 1} of ${total}`}>
        <p className={styles.coachStep}>
          {index + 1} of {total}
        </p>
        <p className={styles.coachText}>{step.say}</p>
        <div className={styles.coachButtons}>
          <button type="button" onClick={onEnd}>
            End Tour
          </button>
          <button type="button" data-primary="" onClick={onNext}>
            {index + 1 === total ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
