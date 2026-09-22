'use client';
/**
 * Control Center — plans/ios/surfaces/control-center.md (`IOS-CC-01…06`). A separate panel pulled from the top-right
 * (the shell drives the pull; the status bar's right zone and its keyboard button open it too): rounded modules
 * (material `thick`) in a 4-column grid — Sound (long-press or "More" → a volume slider + Play intro sound),
 * Reduce Motion, Reduce Transparency, Dark Mode, Brightness (session-only cosmetic dim, capped at 30 %, skipped under
 * `prefers-contrast: more`), Volume, Now (`person.openTo` → Mail), Switch OS, Résumé, Tour — and, on the full page, the
 * App Switcher (the visible alternative to swipe-and-pause). Toggles apply instantly (`SET_PREF`) and persist.
 * Phone: the whole screen blurs + dims behind it; full page: a 360 pt panel top-right over a plain scrim.
 * Modal `dialog` "Control Center"; toggles are `button[aria-pressed]`; sliders are native vertical ranges with
 * `aria-valuetext`; focus → the first toggle; closing returns focus to the status-bar button.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePress } from '@/components/primitives/Press';
import { resolveAsset } from '@/lib/assets/manifest';
import { browserAudioEnvironment, createAudioEngine } from '@/lib/audio/engine';
import { drag } from '@/lib/motion/drag';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { usePrefs } from '@/stores/kernel-context';
import { dispatchSoon } from '@/stores/kernel-store';
import { commits, type IosLayout } from '../model';
import { IOS_SPRINGS, scaleDip, springIn } from '../motion';
import { Glyph, type GlyphName } from '../ui/glyphs';
import styles from '../ios.module.css';

export interface ControlCenterProps {
  readonly layout: IosLayout;
  readonly closing: boolean;
  readonly interactive?: boolean;
  readonly dark: boolean;
  readonly brightness: number;
  readonly openTo: string;
  readonly onBrightness: (value: number) => void;
  readonly onClose: () => void;
  readonly onClosed: () => void;
  readonly onNow: (from: HTMLElement) => void;
  readonly onSwitchOs: (from: HTMLElement) => void;
  readonly onResume: (from: HTMLElement) => void;
  readonly onTour: () => void;
  readonly onSwitcher: () => void;
}

export function ControlCenter(props: ControlCenterProps) {
  const { layout, closing, interactive, dark, brightness, openTo, onClose, onClosed } = props;
  const panel = useRef<HTMLDivElement>(null);

  /** Close by swiping the panel up, as the Notification Center closes (plans/ios/surfaces/control-center "Close"). */
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('button, input, [role="slider"]')) return;
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
        el.style.transform = `translateY(${dy < 0 ? dy : dy / 4}px)`;
      },
      onEnd: ({ dy, moved }) => {
        if (!moved) return;
        const height = el.getBoundingClientRect().height;
        if (commits(Math.max(0, -dy) / height, -velocity / height)) {
          el.style.transform = '';
          onClose();
        } else el.style.transform = '';
      },
    });
  };
  const root = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const motion = usePrefs((prefs) => prefs.motion);
  const glass = usePrefs((prefs) => prefs.glass);
  const sound = usePrefs((prefs) => prefs.sound);
  const [expanded, setExpanded] = useState(false);
  const engine = useRef<ReturnType<typeof createAudioEngine> | null>(null);
  useEffect(() => () => engine.current?.dispose(), []);

  const reduceMotion = motion === 'reduced';
  const reduceTransparency = glass === 'solid';

  // Modules scale 0.9 → 1 with a 20 ms stagger (r 0.38 ζ 0.85); focus → the first toggle.
  useLayoutEffect(() => {
    grid.current?.querySelector<HTMLElement>('[data-cc-first]')?.focus({ preventScroll: true });
    if (interactive) return;
    const modules = [...(grid.current?.querySelectorAll<HTMLElement>('[data-module]') ?? [])];
    modules.forEach((module, index) =>
      springIn(
        module,
        IOS_SPRINGS.controlModules,
        { transform: 'scale(0.9)', opacity: 0 },
        { transform: 'scale(1)', opacity: 1 },
        index * 20,
      ),
    );
    if (prefersReducedMotion()) root.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
    else root.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
    // Entrance only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!closing) return;
    const el = root.current;
    if (!el || typeof el.animate !== 'function') {
      onClosed();
      return;
    }
    el.style.opacity = '';
    // Reduced Motion toggled here applies to its own closing animation at once (a fade either way).
    const out = el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: prefersReducedMotion() ? 150 : 200,
      fill: 'forwards',
    });
    out.onfinish = onClosed;
    out.oncancel = onClosed;
    // An interrupted exit (a reopen, or the surface replaced) is not a close: detach before cancelling.
    return () => {
      out.onfinish = null;
      out.oncancel = null;
      out.cancel();
    };
  }, [closing, onClosed]);

  const playIntro = () => {
    const audio = resolveAsset('audio.intro');
    engine.current ??= createAudioEngine({
      src: audio.render === 'audio' ? audio.src : null,
      env: browserAudioEnvironment(),
    });
    engine.current.unlock();
    engine.current.prefetch();
    engine.current.playIntro({ enabled: true, volume: sound.volume });
  };

  const soundPress = usePress({
    onLongPress: () => {
      scaleDip(document.getElementById('ios-cc-sound'));
      setExpanded(true);
    },
  });

  const toggle = (
    id: string,
    label: string,
    glyph: GlyphName,
    pressed: boolean,
    onToggle: () => void,
    first = false,
  ) => (
    <button
      type="button"
      id={id}
      className={styles.ccToggle}
      aria-pressed={pressed}
      data-module=""
      data-cc-first={first || undefined}
      onClick={onToggle}
    >
      <span className={styles.ccCircle} aria-hidden="true">
        <Glyph name={glyph} size={22} strokeWidth={2.1} />
      </span>
      <span className={styles.ccLabel}>{label}</span>
    </button>
  );

  const volumePct = Math.round(sound.volume * 100);
  const brightPct = Math.round((1 - brightness / 0.3) * 100);

  return (
    <div
      ref={root}
      className={styles.cc}
      data-layout={layout}
      data-control-center=""
      data-closing={closing || undefined}
      data-live={!reduceTransparency || undefined}
    >
      <div className={styles.ccBackdrop} aria-hidden="true" onClick={onClose} />
      {/* A modal surface owns Esc / Tab and its drag (keys reach it from the control inside). */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Control Center"
        className={styles.ccPanel}
        onPointerDown={onPointerDown}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            if (expanded) setExpanded(false);
            else onClose();
          }
          if (event.key === 'Tab') trap(event, event.currentTarget);
        }}
      >
        <div ref={grid} className={styles.ccGrid}>
          <div className={styles.ccSound} data-module="" data-expanded={expanded || undefined}>
            <button
              type="button"
              id="ios-cc-sound"
              className={styles.ccToggle}
              aria-pressed={sound.enabled}
              data-cc-first=""
              onPointerDown={soundPress.onPointerDown}
              onPointerMove={soundPress.onPointerMove}
              onPointerUp={soundPress.onPointerUp}
              onPointerCancel={soundPress.onPointerCancel}
              onContextMenu={soundPress.onContextMenu}
              onClick={(event) => {
                soundPress.onClick(event as never);
                if (event.defaultPrevented) return;
                dispatchSoon({ type: 'SET_PREF', patch: { sound: { ...sound, enabled: !sound.enabled } } });
              }}
            >
              <span className={styles.ccCircle} aria-hidden="true">
                <Glyph name={sound.enabled ? 'speaker' : 'speaker-off'} size={22} strokeWidth={2.1} />
              </span>
              <span className={styles.ccLabel}>Sound</span>
            </button>
            <button
              type="button"
              className={styles.ccMore}
              aria-expanded={expanded}
              aria-controls="ios-cc-sound-more"
              onClick={() => setExpanded((value) => !value)}
            >
              More<span className="sr-only"> sound controls</span>
            </button>
            {expanded ? (
              <div id="ios-cc-sound-more" className={styles.ccExpanded}>
                <label className={styles.ccInline}>
                  <span>Volume</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={volumePct}
                    aria-valuetext={`Volume ${volumePct} %`}
                    onChange={(event) =>
                      dispatchSoon({
                        type: 'SET_PREF',
                        patch: { sound: { ...sound, volume: Number(event.target.value) / 100 } },
                      })
                    }
                  />
                </label>
                <button type="button" className={styles.ccTextButton} onClick={playIntro}>
                  Play intro sound
                </button>
              </div>
            ) : null}
          </div>
          {toggle('ios-cc-motion', 'Reduce Motion', 'motion', reduceMotion, () =>
            dispatchSoon({ type: 'SET_PREF', patch: { motion: reduceMotion ? 'system' : 'reduced' } }),
          )}
          {toggle('ios-cc-glass', 'Reduce Transparency', 'transparency', reduceTransparency, () =>
            dispatchSoon({ type: 'SET_PREF', patch: { glass: reduceTransparency ? 'system' : 'solid' } }),
          )}
          {toggle('ios-cc-dark', 'Dark Mode', 'moon', dark, () =>
            dispatchSoon({ type: 'SET_PREF', patch: { theme: dark ? 'light' : 'dark' } }),
          )}
          <label className={styles.ccSlider} data-module="">
            <span className="sr-only">Brightness</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={brightPct}
              aria-valuetext={`Brightness ${brightPct} %`}
              // Vertical like iOS; arrow keys work natively.
              style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
              onChange={(event) => props.onBrightness(((100 - Number(event.target.value)) / 100) * 0.3)}
            />
            <Glyph name="brightness" size={20} className={styles.ccSliderGlyph} />
          </label>
          <label className={styles.ccSlider} data-module="">
            <span className="sr-only">Volume</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={volumePct}
              aria-valuetext={`Volume ${volumePct} %`}
              style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
              onChange={(event) =>
                dispatchSoon({
                  type: 'SET_PREF',
                  patch: { sound: { ...sound, volume: Number(event.target.value) / 100 } },
                })
              }
            />
            <Glyph name="speaker" size={20} className={styles.ccSliderGlyph} />
          </label>
          <button
            type="button"
            className={styles.ccWide}
            data-module=""
            onClick={(event) => props.onNow(event.currentTarget)}
          >
            <span className={styles.ccEyebrow}>Now</span>
            <span className={styles.ccNow}>{openTo}</span>
          </button>
          <button
            type="button"
            className={styles.ccWide}
            data-module=""
            aria-haspopup="dialog"
            onClick={(event) => props.onSwitchOs(event.currentTarget)}
          >
            <Glyph name="switch" size={22} />
            <span className={styles.ccWideLabel}>Switch OS</span>
          </button>
          <button
            type="button"
            className={styles.ccSquare}
            data-module=""
            onClick={(event) => props.onResume(event.currentTarget)}
          >
            <Glyph name="doc" size={22} />
            <span className={styles.ccLabel}>Résumé</span>
          </button>
          <button type="button" className={styles.ccSquare} data-module="" onClick={props.onTour}>
            <Glyph name="tour" size={22} />
            <span className={styles.ccLabel}>Tour</span>
          </button>
          {layout === 'pad' ? (
            <button
              type="button"
              className={styles.ccWide}
              data-module=""
              onClick={props.onSwitcher}
              data-cc-switcher=""
            >
              <Glyph name="tabs" size={22} />
              <span className={styles.ccWideLabel}>App Switcher</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function trap(event: React.KeyboardEvent, root: HTMLElement) {
  const items = [...root.querySelectorAll<HTMLElement>('button, input')].filter((el) => !el.hasAttribute('disabled'));
  if (items.length === 0) return;
  const first = items[0]!;
  const last = items[items.length - 1]!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
