'use client';
/**
 * Control Center (plans/macos/surfaces/menu-bar.md "Status items", `MAC-MENU-06`): the menu bar's status popover with
 * the quick controls — Sound, Reduce Motion, Reduce Transparency, Appearance (Auto / Light / Dark) and Switch OS. Every
 * control writes `SET_PREF` at once and persists (the same preferences Settings shows). A non-modal labelled region
 * under the menu bar: focus moves to its first control when opened, Esc or an outside press closes it, and focus
 * returns to the Control Center button.
 */
import { useEffect, useRef } from 'react';
import type { UserPreferences } from '@/lib/kernel/types';
import { usePrefs } from '@/stores/kernel-context';
import { dispatchSoon } from '@/stores/kernel-store';
import { AccessibilityGlyph, EyeGlyph, MonitorGlyph, SpeakerGlyph } from '../glyphs';
import { runMacCommand } from '../run-command';
import { closeOverlay, returnFocus, useMacUi } from '../ui';
import styles from './control-center.module.css';

const setPref = (patch: Partial<Omit<UserPreferences, 'v'>>) => dispatchSoon({ type: 'SET_PREF', patch });
const systemPrefers = (query: string) => typeof matchMedia === 'function' && matchMedia(query).matches;

export function ControlCenter() {
  const open = useMacUi((state) => state.overlay === 'control-center');
  const sound = usePrefs((prefs) => prefs.sound);
  const motion = usePrefs((prefs) => prefs.motion);
  const glass = usePrefs((prefs) => prefs.glass);
  const contrast = usePrefs((prefs) => prefs.contrast);
  const theme = usePrefs((prefs) => prefs.theme);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const node = panel.current;
    node?.querySelector<HTMLElement>('button, input')?.focus({ preventScroll: true });
    const close = (restore: boolean) => {
      closeOverlay('control-center');
      if (restore) returnFocus('control-center');
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      close(true);
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (node?.contains(target) || target.closest('[data-control-center-button]')) return;
      close(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [open]);

  if (!open) return null;
  const reducedSystem = systemPrefers('(prefers-reduced-motion: reduce)');
  const solidSystem = systemPrefers('(prefers-reduced-transparency: reduce), (prefers-contrast: more)');
  const reduced = motion === 'reduced' || (motion === 'system' && reducedSystem);
  const solid = glass === 'solid' || contrast === 'more' || (glass === 'system' && solidSystem);

  const toggles = [
    {
      id: 'sound',
      label: 'Sound',
      state: sound.enabled ? 'On' : 'Off',
      pressed: sound.enabled,
      icon: <SpeakerGlyph size={18} />,
      toggle: () => setPref({ sound: { ...sound, enabled: !sound.enabled } }),
    },
    {
      id: 'motion',
      label: 'Reduce Motion',
      state: reduced ? 'On' : 'Off',
      pressed: reduced,
      icon: <AccessibilityGlyph size={18} />,
      toggle: () => setPref({ motion: reduced ? (reducedSystem ? 'full' : 'system') : 'reduced' }),
    },
    {
      id: 'transparency',
      label: 'Reduce Transparency',
      state: solid ? 'On' : 'Off',
      pressed: solid,
      icon: <EyeGlyph size={18} />,
      toggle: () => setPref({ glass: solid ? (solidSystem ? 'full' : 'system') : 'solid' }),
    },
  ] as const;

  return (
    <section ref={panel} className={styles.panel} aria-labelledby="mac-cc-title" data-control-center="">
      <h2 id="mac-cc-title" className="sr-only">
        Control Center
      </h2>
      <ul className={styles.grid}>
        {toggles.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={styles.tile}
              aria-pressed={item.pressed}
              onClick={item.toggle}
              data-cc={item.id}
            >
              <span className={styles.icon} aria-hidden="true">
                {item.icon}
              </span>
              <span className={styles.tileText}>
                <span className={styles.tileLabel}>{item.label}</span>
                <span className={styles.tileState} aria-hidden="true">
                  {item.state}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.module}>
        <p className={styles.moduleTitle} id="mac-cc-appearance">
          <MonitorGlyph size={14} /> Appearance
        </p>
        <div role="radiogroup" aria-labelledby="mac-cc-appearance" className={styles.segmented}>
          {(
            [
              ['system', 'Auto'],
              ['light', 'Light'],
              ['dark', 'Dark'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className={styles.choice}>
              <input
                type="radio"
                name="mac-cc-theme"
                checked={theme === value}
                onChange={() => setPref({ theme: value })}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>
      <button
        type="button"
        className={styles.wide}
        onClick={() => {
          closeOverlay('control-center');
          runMacCommand({ kind: 'switch-os' });
        }}
      >
        Switch Operating System…
      </button>
    </section>
  );
}
