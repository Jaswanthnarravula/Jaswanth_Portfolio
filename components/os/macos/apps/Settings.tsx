'use client';
/**
 * System Settings (plans/macos/apps/system-settings.md, `MAC-SET-01…07`).
 *   · a 220 px sidebar (search field + panes) and a content pane of inset-grouped rows, 13 px labels, controls right;
 *   · every control writes `SET_PREF` at once (no Apply button) — theme, motion, glass and text size reach `<html>`
 *     immediately (the runtime applies prefs) and persist in `pf.prefs.v1` (`MAC-SET-02/03`);
 *   · search filters the panes and highlights the matching controls (`MAC-SET-01`);
 *   · Privacy (what is counted, DNT/GPC status, no cookies) and General → About → Legal notices (`MAC-SET-04`);
 *   · General → Switch Operating System (visible OSes → `SWITCH_OS`) and Back to chooser (`MAC-SET-05`);
 *   · semantics: the sidebar is a `nav` list; panes are labelled regions with headings; switches are
 *     `role="switch"` buttons with visible labels; swatches and choices are native radio groups (`MAC-SET-07`);
 *   · compact: the sidebar list pushes the pane (a back chevron returns), rows 44 px.
 * A system preference that conflicts with the visitor's choice is noted, and the visitor's choice wins.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { formatUpdated, LegalNotice, PrivacyNotice } from '@/components/content';
import { contentIndex } from '@/data/content-index';
import { getContact, getPerson, getResume } from '@/data/selectors';
import { COUNTED } from '@/lib/analytics/notice';
import { readPrivacySignals } from '@/lib/analytics';
import { assetCredits, ASSET_MODE, resolveAsset } from '@/lib/assets/manifest';
import { GLYPH_CREDIT } from '@/lib/assets/glyphs';
import { browserAudioEnvironment, createAudioEngine } from '@/lib/audio/engine';
import { eggProgress } from '@/lib/eggs';
import { getSafeStorage } from '@/lib/kernel/persist/storage';
import type { AccentId, DockSize, UserPreferences } from '@/lib/kernel/types';
import { usePrefs } from '@/stores/kernel-context';
import { dispatchSoon } from '@/stores/kernel-store';
import type { SettingsPane } from '../commands';
import {
  AccessibilityGlyph,
  DockGlyph,
  GearGlyph,
  HandGlyph,
  KeyboardGlyph,
  PaletteGlyph,
  SpeakerGlyph,
} from '../glyphs';
import { ChevronLeft, SearchGlyph } from '../icons';
import { runMacCommand } from '../run-command';
import { SwitchOsList } from '../surfaces/SwitchOsList';
import { macShortcuts } from '../shortcuts';
import { setAppState, useAppState } from '../ui';
import type { WindowBodyProps } from '../window/Window';
import app from './app.module.css';
import styles from './settings.module.css';

type Glyph = (props: { size?: number }) => ReactNode;

const PANES: readonly { id: SettingsPane; label: string; glyph: Glyph; tint: string }[] = [
  { id: 'appearance', label: 'Appearance', glyph: PaletteGlyph, tint: 'graphite' },
  { id: 'accessibility', label: 'Accessibility', glyph: AccessibilityGlyph, tint: 'blue' },
  { id: 'sound', label: 'Sound', glyph: SpeakerGlyph, tint: 'pink' },
  { id: 'desktop', label: 'Desktop & Dock', glyph: DockGlyph, tint: 'graphite' },
  { id: 'keyboard', label: 'Keyboard', glyph: KeyboardGlyph, tint: 'grey' },
  { id: 'privacy', label: 'Privacy', glyph: HandGlyph, tint: 'blue' },
  { id: 'general', label: 'General', glyph: GearGlyph, tint: 'grey' },
];

/** Every control, by pane, with the words search matches (labels + synonyms). */
const CONTROLS: readonly { id: string; pane: SettingsPane; words: string }[] = [
  { id: 'theme', pane: 'appearance', words: 'appearance theme light dark mode auto' },
  { id: 'accent', pane: 'appearance', words: 'accent colour color highlight tint' },
  { id: 'wallpaper', pane: 'appearance', words: 'wallpaper background desktop picture' },
  { id: 'motion', pane: 'accessibility', words: 'reduce motion animation movement' },
  { id: 'transparency', pane: 'accessibility', words: 'reduce transparency glass blur vibrancy' },
  { id: 'contrast', pane: 'accessibility', words: 'increase contrast high contrast borders' },
  { id: 'text', pane: 'accessibility', words: 'larger text size font zoom' },
  { id: 'single-keys', pane: 'accessibility', words: 'single-key shortcuts keyboard slash question' },
  { id: 'plain', pane: 'accessibility', words: 'plain portfolio reader text only' },
  { id: 'ui-sounds', pane: 'sound', words: 'ui sounds sound effects audio' },
  { id: 'volume', pane: 'sound', words: 'volume loudness audio' },
  { id: 'intro', pane: 'sound', words: 'play intro sound chime again' },
  { id: 'magnification', pane: 'desktop', words: 'dock magnification zoom icons' },
  { id: 'dock-size', pane: 'desktop', words: 'dock size small medium large' },
  { id: 'minimize', pane: 'desktop', words: 'minimize using scale genie effect' },
  { id: 'shortcuts', pane: 'keyboard', words: 'keyboard shortcuts keys chords' },
  { id: 'analytics', pane: 'privacy', words: 'privacy analytics tracking cookies do not track gpc' },
  { id: 'about', pane: 'general', words: 'about name headline location résumé resume updated eggs build version' },
  { id: 'legal', pane: 'general', words: 'legal notices credits trademarks licence license' },
  { id: 'switch-os', pane: 'general', words: 'switch operating system os chooser ios windows android linux' },
  { id: 'tour', pane: 'general', words: 'tour guide help start' },
];

const ACCENTS: readonly { id: AccentId; name: string }[] = [
  { id: 'blue', name: 'Blue' },
  { id: 'purple', name: 'Purple' },
  { id: 'plum', name: 'Pink' },
  { id: 'red', name: 'Red' },
  { id: 'orange', name: 'Orange' },
  { id: 'green', name: 'Green' },
];

const TEXT_SCALES: readonly { value: number; label: string }[] = [
  { value: 1, label: '100 %' },
  { value: 1.15, label: '115 %' },
  { value: 1.3, label: '130 %' },
];

const DOCK_SIZES: readonly { value: DockSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

const setPref = (patch: Partial<Omit<UserPreferences, 'v'>>) => dispatchSoon({ type: 'SET_PREF', patch });

/** Lower-case, accents stripped ("résumé" matches "resume"). */
const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();

/** Panes and controls matching a query (every word must match the pane label or a control's words). */
export function searchSettings(query: string): { panes: readonly SettingsPane[]; controls: readonly string[] } {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return { panes: PANES.map((pane) => pane.id), controls: [] };
  const controls = CONTROLS.filter((control) => {
    const hay = normalize(`${control.words} ${PANES.find((pane) => pane.id === control.pane)?.label ?? ''}`);
    return words.every((word) => hay.includes(word));
  });
  const panes = PANES.filter(
    (pane) =>
      controls.some((control) => control.pane === pane.id) ||
      words.every((word) => normalize(pane.label).includes(word)),
  ).map((pane) => pane.id);
  return { panes, controls: controls.map((control) => control.id) };
}

const matchesMedia = (query: string) => typeof matchMedia === 'function' && matchMedia(query).matches;

// --- Row building blocks ------------------------------------------------------------------------------------------

function Row({
  id,
  label,
  note,
  children,
  match,
}: {
  id: string;
  label: ReactNode;
  note?: ReactNode;
  children?: ReactNode;
  match: readonly string[];
}) {
  return (
    <li className={styles.row} data-control={id} data-match={match.includes(id) || undefined}>
      <span className={styles.rowText}>
        <span id={`set-${id}-label`} className={styles.label}>
          {label}
        </span>
        {note ? (
          <span id={`set-${id}-note`} className={styles.note}>
            {note}
          </span>
        ) : null}
      </span>
      {children}
    </li>
  );
}

function Switch({
  id,
  checked,
  onChange,
  hasNote,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  hasNote?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      className={styles.switch}
      aria-checked={checked}
      aria-labelledby={`set-${id}-label`}
      aria-describedby={hasNote ? `set-${id}-note` : undefined}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.thumb} />
    </button>
  );
}

function Choices<T extends string | number>({
  id,
  options,
  value,
  onChange,
  variant = 'segmented',
}: {
  id: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'segmented' | 'thumbs';
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={`set-${id}-label`}
      className={variant === 'thumbs' ? styles.thumbs : styles.segmented}
    >
      {options.map((option) => (
        <label key={String(option.value)} className={styles.choice} data-value={String(option.value)}>
          <input
            type="radio"
            name={`set-${id}`}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          {variant === 'thumbs' ? <span className={styles.preview} aria-hidden="true" /> : null}
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className={styles.groupWrap}>
      {title ? <h3 className={styles.groupTitle}>{title}</h3> : null}
      <ul className={styles.group}>{children}</ul>
    </div>
  );
}

// --- Panes --------------------------------------------------------------------------------------------------------

function Appearance({ match }: { match: readonly string[] }) {
  const theme = usePrefs((prefs) => prefs.theme);
  const accent = usePrefs((prefs) => prefs.accent) ?? 'blue';
  const wallpaper = usePrefs((prefs) => prefs.wallpaper);
  return (
    <>
      <Group>
        <Row id="theme" label="Appearance" match={match}>
          <Choices
            id="theme"
            variant="thumbs"
            value={theme}
            onChange={(value) => setPref({ theme: value })}
            options={[
              { value: 'system', label: 'Auto' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Row>
      </Group>
      <Group>
        <Row id="accent" label="Accent colour" note={ACCENTS.find((item) => item.id === accent)?.name} match={match}>
          <div role="radiogroup" aria-labelledby="set-accent-label" className={styles.swatches}>
            {ACCENTS.map((item) => (
              <label key={item.id} className={styles.swatch} data-accent-swatch={item.id}>
                <input
                  type="radio"
                  name="set-accent"
                  checked={item.id === accent}
                  onChange={() => setPref({ accent: item.id === 'blue' ? null : item.id })}
                />
                <span className="sr-only">{item.name}</span>
              </label>
            ))}
          </div>
        </Row>
        <Row id="wallpaper" label="Wallpaper" match={match}>
          <Choices
            id="wallpaper"
            value={wallpaper}
            onChange={(value) => setPref({ wallpaper: value })}
            options={[
              { value: 'auto', label: 'Automatic' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Row>
      </Group>
    </>
  );
}

function Accessibility({ match }: { match: readonly string[] }) {
  const motion = usePrefs((prefs) => prefs.motion);
  const glass = usePrefs((prefs) => prefs.glass);
  const contrast = usePrefs((prefs) => prefs.contrast);
  const textScale = usePrefs((prefs) => prefs.textScale);
  const singleKeys = usePrefs((prefs) => prefs.singleKeyShortcuts);
  // The system's own preferences, for the "your system prefers…" notes (read once per render; the pane is small).
  const systemReduced = matchesMedia('(prefers-reduced-motion: reduce)');
  const systemSolid = matchesMedia('(prefers-reduced-transparency: reduce)');
  const systemContrast = matchesMedia('(prefers-contrast: more)');
  const reduced = motion === 'reduced' || (motion === 'system' && systemReduced);
  const solid = glass === 'solid' || contrast === 'more' || (glass === 'system' && (systemSolid || systemContrast));
  const more = contrast === 'more';
  const nearest = TEXT_SCALES.reduce((best, item) =>
    Math.abs(item.value - textScale) < Math.abs(best.value - textScale) ? item : best,
  );
  return (
    <>
      <Group title="Display">
        <Row
          id="motion"
          label="Reduce motion"
          note={systemReduced && motion === 'full' ? 'Your system prefers reduced motion.' : undefined}
          match={match}
        >
          <Switch
            id="motion"
            checked={reduced}
            hasNote={systemReduced && motion === 'full'}
            onChange={(next) => setPref({ motion: next ? 'reduced' : systemReduced ? 'full' : 'system' })}
          />
        </Row>
        <Row
          id="transparency"
          label="Reduce transparency"
          note={more ? 'On while Increase contrast is on.' : undefined}
          match={match}
        >
          <Switch
            id="transparency"
            checked={solid}
            hasNote={more}
            onChange={(next) => setPref({ glass: next ? 'solid' : systemSolid || systemContrast ? 'full' : 'system' })}
          />
        </Row>
        <Row
          id="contrast"
          label="Increase contrast"
          note={systemContrast && !more ? 'Your system prefers more contrast.' : 'Solid surfaces and stronger borders.'}
          match={match}
        >
          <Switch
            id="contrast"
            checked={more}
            hasNote
            onChange={(next) => setPref({ contrast: next ? 'more' : 'system' })}
          />
        </Row>
        <Row id="text" label="Larger text" match={match}>
          <Choices
            id="text"
            value={nearest.value}
            onChange={(value) => setPref({ textScale: value })}
            options={TEXT_SCALES}
          />
        </Row>
      </Group>
      <Group title="Keyboard">
        <Row
          id="single-keys"
          label="Single-key shortcuts"
          note="“/” opens Spotlight and “?” lists shortcuts."
          match={match}
        >
          <Switch
            id="single-keys"
            checked={singleKeys}
            hasNote
            onChange={(next) => setPref({ singleKeyShortcuts: next })}
          />
        </Row>
      </Group>
      <Group>
        <Row id="plain" label="Plain portfolio" note="Everything on one readable page." match={match}>
          <a className={styles.button} href="/plain">
            Open plain portfolio
          </a>
        </Row>
      </Group>
    </>
  );
}

function Sound({ match }: { match: readonly string[] }) {
  const sound = usePrefs((prefs) => prefs.sound);
  const engine = useRef<ReturnType<typeof createAudioEngine> | null>(null);
  useEffect(() => () => engine.current?.dispose(), []);
  const playIntro = () => {
    const audio = resolveAsset('audio.intro');
    engine.current ??= createAudioEngine({
      src: audio.render === 'audio' ? audio.src : null,
      env: browserAudioEnvironment(),
    });
    // An explicit press: it unlocks audio and plays once (nothing here ever plays on its own).
    engine.current.unlock();
    engine.current.prefetch();
    engine.current.playIntro({ enabled: true, volume: sound.volume });
  };
  return (
    <Group>
      <Row id="ui-sounds" label="Play user interface sound effects" match={match}>
        <Switch id="ui-sounds" checked={sound.ui} onChange={(next) => setPref({ sound: { ...sound, ui: next } })} />
      </Row>
      <Row id="volume" label="Volume" note={`${Math.round(sound.volume * 100)} %`} match={match}>
        <input
          className={styles.slider}
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(sound.volume * 100)}
          aria-labelledby="set-volume-label"
          aria-valuetext={`${Math.round(sound.volume * 100)} percent`}
          onChange={(event) => setPref({ sound: { ...sound, volume: Number(event.target.value) / 100 } })}
        />
      </Row>
      <Row id="intro" label="Intro sound" match={match}>
        <button type="button" className={styles.button} onClick={playIntro}>
          Play intro sound again
        </button>
      </Row>
    </Group>
  );
}

function Desktop({ match }: { match: readonly string[] }) {
  const dock = usePrefs((prefs) => prefs.dock);
  return (
    <Group title="Dock">
      <Row
        id="magnification"
        label="Magnification"
        note="Only with a mouse or trackpad on wider screens."
        match={match}
      >
        <Switch
          id="magnification"
          checked={dock.magnification}
          hasNote
          onChange={(next) => setPref({ dock: { ...dock, magnification: next } })}
        />
      </Row>
      <Row id="dock-size" label="Size" match={match}>
        <Choices
          id="dock-size"
          value={dock.size}
          onChange={(value) => setPref({ dock: { ...dock, size: value } })}
          options={DOCK_SIZES}
        />
      </Row>
      <Row id="minimize" label="Minimize windows using" match={match}>
        <select className={styles.select} aria-labelledby="set-minimize-label" defaultValue="scale">
          <option value="scale">Scale effect</option>
          <option value="genie" disabled>
            Genie effect (not available)
          </option>
        </select>
      </Row>
    </Group>
  );
}

function Keyboard({ match }: { match: readonly string[] }) {
  const singleKeys = usePrefs((prefs) => prefs.singleKeyShortcuts);
  const shortcuts = useMemo(() => macShortcuts({ singleKeys }), [singleKeys]);
  return (
    <Group title="Keyboard shortcuts">
      {shortcuts.map((shortcut) => (
        <li
          key={shortcut.id}
          className={styles.row}
          data-control="shortcuts"
          data-match={match.includes('shortcuts') || undefined}
        >
          <span className={styles.label}>{shortcut.label}</span>
          <kbd className={styles.keys}>{shortcut.keys}</kbd>
        </li>
      ))}
    </Group>
  );
}

function Privacy({ match }: { match: readonly string[] }) {
  const [signals] = useState(() =>
    typeof window === 'undefined' ? null : readPrivacySignals(window, process.env.NODE_ENV === 'production'),
  );
  const off = signals ? signals.doNotTrack || signals.globalPrivacyControl || signals.saveData : false;
  return (
    <>
      <Group>
        <Row
          id="analytics"
          label="Analytics"
          note={
            off
              ? 'Your browser asks not to be tracked — nothing is counted.'
              : 'Cookieless and anonymous. No cookies are set.'
          }
          match={match}
        >
          <span className={styles.value}>{off ? 'Off' : 'Anonymous'}</span>
        </Row>
        <li className={styles.row}>
          <span className={styles.label}>Do Not Track</span>
          <span className={styles.value}>{signals?.doNotTrack ? 'On' : 'Off'}</span>
        </li>
        <li className={styles.row}>
          <span className={styles.label}>Global Privacy Control</span>
          <span className={styles.value}>{signals?.globalPrivacyControl ? 'On' : 'Off'}</span>
        </li>
      </Group>
      <div className={styles.prose}>
        <PrivacyNotice data={{ counted: COUNTED }} headingLevel={3} />
      </div>
    </>
  );
}

function General({ match }: { match: readonly string[] }) {
  const eggsFound = usePrefs((prefs) => prefs.eggsFound);
  const person = getPerson();
  const resume = getResume();
  const eggs = eggProgress(eggsFound, 'macos');
  return (
    <>
      <Group title="About">
        <Row id="about" label="Name" match={match}>
          <span className={styles.value}>{person.name}</span>
        </Row>
        <li className={styles.row} data-control="about" data-match={match.includes('about') || undefined}>
          <span className={styles.label}>Headline</span>
          <span className={styles.value}>{person.headline}</span>
        </li>
        <li className={styles.row} data-control="about" data-match={match.includes('about') || undefined}>
          <span className={styles.label}>Location</span>
          <span className={styles.value}>{person.location}</span>
        </li>
        <li className={styles.row} data-control="about" data-match={match.includes('about') || undefined}>
          <span className={styles.label}>Résumé updated</span>
          <span className={styles.value}>
            <time dateTime={resume.updated}>{formatUpdated(resume.updated)}</time>
          </span>
        </li>
        <li className={styles.row} data-control="about" data-match={match.includes('about') || undefined}>
          <span className={styles.label}>Easter eggs found</span>
          <span className={styles.value}>
            {eggs.found} / {eggs.total}
          </span>
        </li>
        <li className={styles.row} data-control="about" data-match={match.includes('about') || undefined}>
          <span className={styles.label}>Build</span>
          <span className={styles.value}>{contentIndex.rev.slice(0, 8)}</span>
        </li>
      </Group>
      <div className={styles.groupWrap} data-control="switch-os" data-match={match.includes('switch-os') || undefined}>
        <h3 className={styles.groupTitle} id="set-switch-os-label">
          Switch Operating System
        </h3>
        <SwitchOsList />
      </div>
      <Group title="Tour">
        <Row id="tour" label="Take the 20-second tour" match={match}>
          <button type="button" className={styles.button} onClick={() => runMacCommand({ kind: 'tour' })}>
            Start tour
          </button>
        </Row>
      </Group>
      <div className={styles.prose} data-control="legal" data-match={match.includes('legal') || undefined}>
        <LegalNotice
          data={{
            credits: assetCredits(),
            contactEmail: getContact().email,
            glyphCredit: GLYPH_CREDIT,
            assetMode: ASSET_MODE,
          }}
          headingLevel={3}
        />
      </div>
    </>
  );
}

const PANE_VIEWS: Readonly<Record<SettingsPane, (props: { match: readonly string[] }) => ReactNode>> = {
  appearance: Appearance,
  accessibility: Accessibility,
  sound: Sound,
  desktop: Desktop,
  keyboard: Keyboard,
  privacy: Privacy,
  general: General,
};

// --- The window ---------------------------------------------------------------------------------------------------

export default function Settings({ titleId, compact }: WindowBodyProps) {
  const appState = useAppState();
  const pane = (appState['settings:pane'] as SettingsPane | undefined) ?? 'appearance';
  const [query, setQuery] = useState('');
  const [drilled, setDrilled] = useState(false);
  const [storageNote] = useState(() => typeof window !== 'undefined' && getSafeStorage().mode === 'memory');
  const content = useRef<HTMLDivElement>(null);
  const result = searchSettings(query);
  const shown = PANES.filter((item) => result.panes.includes(item.id));
  const current = PANES.find((item) => item.id === pane)!;
  const View = PANE_VIEWS[pane];

  // A pane chosen from the menu bar (View → pane) while compact shows it at once.
  const [lastPane, setLastPane] = useState(pane);
  if (lastPane !== pane) {
    setLastPane(pane);
    if (compact) setDrilled(true);
  }

  const choose = (next: SettingsPane) => {
    setAppState('settings:pane', next);
    setDrilled(true);
  };

  // Search: the first matching pane shows, and its first matching control scrolls into view (highlighted by CSS).
  const search = (next: string) => {
    setQuery(next);
    const found = searchSettings(next);
    if (next.trim() && found.panes.length && !found.panes.includes(pane)) setAppState('settings:pane', found.panes[0]);
  };
  useEffect(() => {
    if (!result.controls.length) return;
    content.current?.querySelector('[data-match]')?.scrollIntoView?.({ block: 'nearest' });
  }, [pane, result.controls]);

  const showList = !compact || !drilled;
  const showPane = !compact || drilled;

  return (
    <div className={`${app.app} ${styles.settings}`} data-body="">
      <div className={app.split}>
        {showList ? (
          <nav className={styles.sidebar} aria-label="Settings">
            <div className={styles.sidebarTop} data-drag-region="">
              {compact ? (
                <h2 id={titleId} className={styles.largeTitle}>
                  System Settings
                </h2>
              ) : null}
            </div>
            <label className={styles.search}>
              <SearchGlyph size={13} />
              <input
                type="search"
                placeholder="Search"
                aria-label="Search settings"
                value={query}
                onChange={(event) => search(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && query) {
                    event.preventDefault();
                    search('');
                  }
                }}
              />
            </label>
            {shown.length ? (
              <ul className={styles.panes}>
                {shown.map((item) => {
                  const Icon = item.glyph;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={styles.paneItem}
                        aria-current={item.id === pane && !compact ? 'true' : undefined}
                        onClick={() => choose(item.id)}
                      >
                        <span className={styles.tile} data-tint={item.tint} aria-hidden="true">
                          <Icon size={14} />
                        </span>
                        {item.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.noResults} role="status">
                No results for “{query}”
              </p>
            )}
          </nav>
        ) : null}
        {showPane ? (
          <section className={styles.main} aria-labelledby={titleId}>
            <header className={styles.toolbar} data-drag-region="">
              {compact ? (
                <button type="button" className={app.tool} onClick={() => setDrilled(false)} aria-label="All settings">
                  <ChevronLeft size={18} />
                </button>
              ) : null}
              <h2 id={titleId} className={styles.toolbarTitle}>
                <span className="sr-only">System Settings — </span>
                {current.label}
              </h2>
            </header>
            <div ref={content} key={pane} className={styles.content}>
              {storageNote ? (
                <p className={styles.quiet}>This browser isn’t saving site data — settings last for this visit.</p>
              ) : null}
              <View match={result.controls} />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
