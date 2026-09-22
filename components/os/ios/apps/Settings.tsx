'use client';
/**
 * Settings — the iOS Settings app (plans/ios/apps/settings.md, `IOS-SET-01…05`; shared/09 `A11Y-PREF-01`, shared/11
 * `ASSET-LEGAL-01`, shared/18 `ANL-NOTICE-01`, shared/21 found counter).
 *   · inset-grouped lists on the grouped background, 29 pt tinted glyph tiles, a profile cell on top (initials, name,
 *     headline → About), large title "Settings" with a search field under it;
 *   · Switch Operating System (the shell's Switch OS surface) · Take the Tour; Display & Brightness (Appearance as a
 *     radio group of preview tiles, Text Size slider), Accessibility (switches + Open Plain Portfolio), Sounds, Privacy,
 *     General → About (facts, version, easter eggs n / N, Legal Notices);
 *   · every control is one `SET_PREF`: applied at once (the shell writes `<html>`), persisted by the prefs store — the
 *     same prefs Control Center shows;
 *   · the pushed path is session state (`WindowInstance.ui`), so the URL stays `/ios/settings`;
 *   · search filters rows across every screen; choosing one pushes its screen and highlights the row (600 ms fade,
 *     instant under reduced motion);
 *   · full page: split view (settings list · detail); phone landscape: one column with wider margins.
 * Portfolio facts come only from `data/selectors`; legal and privacy text are the shared content views.
 * Intents: `{ kind: 'settings', screen }` (Control Center, Spotlight, quick actions) pushes that screen.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { formatUpdated, LegalNotice, PrivacyNotice } from '@/components/content';
import { contentRev } from '@/data/content-index';
import { getContact, getPerson, getResume } from '@/data/selectors';
import { readPrivacySignals } from '@/lib/analytics';
import { COUNTED } from '@/lib/analytics/notice';
import { GLYPH_CREDIT } from '@/lib/assets/glyphs';
import { assetCredits, ASSET_MODE, resolveAsset } from '@/lib/assets/manifest';
import { browserAudioEnvironment, createAudioEngine } from '@/lib/audio/engine';
import { eggProgress } from '@/lib/eggs';
import { TEXT_SCALE_RANGE } from '@/lib/kernel/persist/prefs';
import { getSafeStorage } from '@/lib/kernel/persist/storage';
import type { ThemePref, UserPreferences } from '@/lib/kernel/types';
import { useKernel, usePrefs } from '@/stores/kernel-context';
import { dispatch, dispatchSoon } from '@/stores/kernel-store';
import { subscribeIntents, takeIntent, type SettingsScreen } from '../intents';
import { initialsOf } from '../model';
import { useAppUi, useAppUiJson, useIos, type IosServices } from '../shell-context';
import { Glyph, GLYPH_CREDIT as IOS_GLYPH_CREDIT, type GlyphName } from '../ui/glyphs';
import { Group, Row, SearchField, Switch, uiStyles } from '../ui/kit';
import { NavStack, type NavScreen } from '../ui/NavStack';
import type { IosAppProps } from './registry';
import {
  cleanStack,
  FLASH_MS,
  SCREEN_PATH,
  SCREEN_TITLES,
  searchSettings,
  stackForIntent,
  whereOf,
  type Screen,
  type SettingEntry,
} from './settings-model';
import styles from './settings.module.css';

type Patch = Partial<UserPreferences>;
/** A press: the control paints first, the preference commits in the next task (shared/10 INP). */
const setPref = (patch: Patch) => dispatchSoon({ type: 'SET_PREF', patch });
/** A dragged slider or a native radio is controlled: commit now so the thumb never snaps back for a frame. */
const setPrefNow = (patch: Patch) => dispatch({ type: 'SET_PREF', patch });

const THEME_LABEL: Readonly<Record<ThemePref, string>> = { light: 'Light', dark: 'Dark', system: 'Automatic' };

/** iOS Settings' tile colours (system palette; the glyphs are decorative). */
const TILE: Readonly<Record<string, { glyph: GlyphName; tint: string }>> = {
  'switch-os': { glyph: 'switch', tint: '#5856d6' },
  tour: { glyph: 'tour', tint: '#ff9500' },
  display: { glyph: 'brightness', tint: '#007aff' },
  accessibility: { glyph: 'access', tint: '#007aff' },
  sounds: { glyph: 'speaker', tint: '#ff2d55' },
  privacy: { glyph: 'hand-raised', tint: '#007aff' },
  about: { glyph: 'gear', tint: '#8e8e93' },
};

export default function Settings({ id, layout, landscape, headingId }: IosAppProps) {
  const ios = useIos();
  const [rawStack, setStackRaw] = useAppUiJson<readonly string[]>(id, 'stack', []);
  const [query, setQuery] = useAppUi(id, 'q', '');
  const [flash, setFlash] = useState<string | null>(null);
  const [memoryOnly] = useState(() => typeof window !== 'undefined' && getSafeStorage().mode === 'memory');
  const root = useRef<HTMLDivElement>(null);
  const stack = cleanStack(rawStack);
  const setStack = (next: readonly Screen[]) => setStackRaw(next.length ? [...next] : null);
  const pad = layout === 'pad';

  // Intents from other surfaces: one waiting at mount, and any that arrive while Settings is open.
  const applyRef = useRef<(screen: SettingsScreen) => void>(() => undefined);
  useEffect(() => {
    applyRef.current = (screen) => {
      const next = stackForIntent(screen);
      if (next === null) ios.openSwitchOs(null);
      else setStackRaw(next.length ? [...next] : null);
    };
  });
  useEffect(() => {
    const waiting = takeIntent('settings');
    if (waiting) applyRef.current(waiting.screen);
    return subscribeIntents((intent) => {
      if (intent.kind !== 'settings') return;
      takeIntent('settings');
      applyRef.current(intent.screen);
    });
  }, []);

  // The highlighted row scrolls into view, then fades (CSS) and clears.
  useLayoutEffect(() => {
    if (!flash) return;
    const el = root.current?.querySelector<HTMLElement>(`.${styles.flash}`);
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center' });
    // The chosen result is gone with the results list; when no push moved focus to a screen title, the matched row
    // takes it (focus never falls to <body>).
    const active = document.activeElement;
    if (el && (!active || active === document.body || !root.current?.contains(active)))
      el.querySelector<HTMLElement>('button, a, input')?.focus({ preventScroll: true });
    const timer = setTimeout(() => setFlash(null), FLASH_MS + 100);
    return () => clearTimeout(timer);
  }, [flash, rawStack, query]);

  // Every screen has one place in the stack (Legal sits under About), so a push is that screen's path.
  const push = (screen: Screen) => setStack(SCREEN_PATH[screen]);
  const choose = (entry: SettingEntry) => {
    setQuery(null);
    setStack(entry.path);
    setFlash(entry.id);
  };

  const ctx: Ctx = { ios, flash, memoryOnly, push };

  const results = searchSettings(query);
  const searchField = (
    <SearchField
      value={query}
      onChange={(value) => setQuery(value || null)}
      label="Search settings"
      onCancel={() => setQuery(null)}
      onSubmit={() => results[0] && choose(results[0])}
    />
  );
  const resultsView = (
    <>
      {results.length === 0 ? (
        <p className={styles.noResults} role="status">
          No Results for “{query.trim()}”
        </p>
      ) : (
        <Group header="Results">
          {results.map((entry) => (
            <Row
              key={entry.id}
              kind="button"
              title={entry.label}
              subtitle={whereOf(entry)}
              accessory="chevron"
              onPress={() => choose(entry)}
            />
          ))}
        </Group>
      )}
    </>
  );

  const selected = pad ? (stack[0] ?? 'about') : null;
  const rootList = () => (query.trim() ? resultsView : <RootList ctx={ctx} selected={selected} />);

  const screenFor = (screen: Screen): NavScreen => ({
    key: screen,
    title: SCREEN_TITLES[screen],
    render: () => <ScreenBody screen={screen} ctx={ctx} />,
  });

  if (pad) {
    const detail = stack.length ? stack : (['about'] as const);
    return (
      <div ref={root} className={`${styles.settings} ${styles.split}`} aria-labelledby={headingId}>
        <nav className={styles.sidebar} aria-labelledby="settings-sidebar-title">
          <h3 id="settings-sidebar-title" className={styles.sidebarTitle}>
            Settings
          </h3>
          <div className={styles.sidebarSearch}>{searchField}</div>
          {rootList()}
        </nav>
        <div className={styles.detail}>
          <NavStack
            id="settings-detail"
            window={id}
            screens={detail.map(screenFor)}
            onPop={(to) => setStack(detail.slice(0, to + 1))}
          />
        </div>
      </div>
    );
  }

  const screens: NavScreen[] = [
    { key: 'root', title: 'Settings', large: true, accessory: searchField, render: rootList },
    ...stack.map(screenFor),
  ];
  return (
    <div ref={root} className={styles.settings} data-landscape={landscape || undefined} aria-labelledby={headingId}>
      <NavStack id="settings" window={id} screens={screens} onPop={(to) => setStack(stack.slice(0, to))} />
    </div>
  );
}

interface Ctx {
  readonly ios: IosServices;
  readonly flash: string | null;
  readonly memoryOnly: boolean;
  readonly push: (screen: Screen) => void;
}

const flashClass = (ctx: Ctx, rowId: string) => (ctx.flash === rowId ? styles.flash : undefined);

const storageNote = (ctx: Ctx) => (ctx.memoryOnly ? 'Changes last for this visit.' : undefined);

// --- Root list ---------------------------------------------------------------------------------------------------------

function RootList({ ctx, selected }: { readonly ctx: Ctx; readonly selected: Screen | null }) {
  const person = getPerson();
  const theme = usePrefs((prefs) => prefs.theme);
  const pushRow = (screen: Screen, title: string, value?: string, className?: string) => {
    const on = selected === screen;
    return (
      <Row
        kind="button"
        title={title}
        value={value}
        icon={TILE[screen]}
        accessory={selected ? 'none' : 'chevron'}
        pushKey={screen}
        aria-current={on ? 'true' : undefined}
        className={`${on ? styles.current : ''} ${flashClass(ctx, screen) ?? ''} ${className ?? ''}`}
        onPress={() => ctx.push(screen)}
      />
    );
  };
  return (
    <>
      <section className={uiStyles.group} aria-label="Profile">
        <ul className={uiStyles.groupList} role="list">
          <li
            className={`${uiStyles.rowItem} ${selected === 'about' ? styles.current : ''} ${flashClass(ctx, 'profile') ?? ''}`}
          >
            <button
              type="button"
              className={`${uiStyles.row} ${uiStyles.press} ${styles.profile}`}
              data-push-key="about"
              aria-current={selected === 'about' ? 'true' : undefined}
              onClick={() => ctx.push('about')}
            >
              <span className={styles.avatar} aria-hidden="true">
                {initialsOf(person.name)}
              </span>
              <span className={styles.profileText}>
                <span className={styles.profileName}>{person.name}</span>
                <span className={styles.profileHeadline}>{person.headline}</span>
              </span>
              {selected ? null : <Glyph name="chevron-right" size={16} strokeWidth={2.4} className={styles.chevron} />}
            </button>
          </li>
        </ul>
      </section>
      <Group>
        <Row
          kind="button"
          title="Switch Operating System"
          icon={TILE['switch-os']}
          accessory="chevron"
          className={flashClass(ctx, 'switch-os')}
          onPress={(el) => ctx.ios.openSwitchOs(el)}
        />
        <Row
          kind="button"
          title="Take the Tour"
          icon={TILE.tour}
          accessory="chevron"
          className={flashClass(ctx, 'tour')}
          onPress={() => ctx.ios.startTour()}
        />
      </Group>
      <Group>
        {pushRow('display', SCREEN_TITLES.display, THEME_LABEL[theme])}
        {pushRow('accessibility', SCREEN_TITLES.accessibility)}
        {pushRow('sounds', SCREEN_TITLES.sounds)}
      </Group>
      <Group>{pushRow('privacy', SCREEN_TITLES.privacy)}</Group>
      <Group header="General" footer={storageNote(ctx)}>
        {pushRow('about', SCREEN_TITLES.about)}
      </Group>
    </>
  );
}

// --- Pushed screens ------------------------------------------------------------------------------------------------------

function ScreenBody({ screen, ctx }: { readonly screen: Screen; readonly ctx: Ctx }) {
  switch (screen) {
    case 'display':
      return <DisplayScreen ctx={ctx} />;
    case 'accessibility':
      return <AccessibilityScreen ctx={ctx} />;
    case 'sounds':
      return <SoundsScreen ctx={ctx} />;
    case 'privacy':
      return <PrivacyScreen ctx={ctx} />;
    case 'about':
      return <AboutScreen ctx={ctx} />;
    case 'legal':
      return <LegalScreen />;
  }
}

function SwitchRow({
  ctx,
  rowId,
  title,
  checked,
  onChange,
}: {
  readonly ctx: Ctx;
  readonly rowId: string;
  readonly title: string;
  readonly checked: boolean;
  readonly onChange: (next: boolean) => void;
}) {
  return (
    <Row
      kind="control"
      title={title}
      className={flashClass(ctx, rowId)}
      control={<Switch checked={checked} onChange={onChange} label={title} />}
    />
  );
}

function SliderRow({
  ctx,
  rowId,
  title,
  min,
  max,
  step,
  value,
  valueText,
  onChange,
  low,
  high,
}: {
  readonly ctx: Ctx;
  readonly rowId: string;
  readonly title: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  readonly valueText: string;
  readonly onChange: (value: number) => void;
  readonly low: ReactNode;
  readonly high: ReactNode;
}) {
  const inputId = useId();
  return (
    <li className={`${uiStyles.rowItem} ${flashClass(ctx, rowId) ?? ''}`}>
      <div className={`${uiStyles.row} ${styles.sliderRow}`} data-static="">
        <span className={styles.sliderHead}>
          <label htmlFor={inputId}>{title}</label>
          <span className={styles.sliderValue} aria-hidden="true">
            {valueText}
          </span>
        </span>
        <span className={styles.sliderLine}>
          <span className={styles.sliderEnd} aria-hidden="true">
            {low}
          </span>
          <input
            id={inputId}
            className={styles.slider}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            aria-valuetext={valueText}
            onChange={(event) => onChange(Number(event.target.value))}
          />
          <span className={styles.sliderEnd} aria-hidden="true">
            {high}
          </span>
        </span>
      </div>
    </li>
  );
}

function DisplayScreen({ ctx }: { readonly ctx: Ctx }) {
  const theme = usePrefs((prefs) => prefs.theme);
  const textScale = usePrefs((prefs) => prefs.textScale);
  const name = useId();
  const scale = Math.round(textScale * 100);
  return (
    <>
      <section className={`${uiStyles.group} ${flashClass(ctx, 'appearance') ?? ''}`} aria-labelledby={`${name}-h`}>
        <h4 id={`${name}-h`} className={uiStyles.groupHeader}>
          Appearance
        </h4>
        <div role="radiogroup" aria-labelledby={`${name}-h`} className={styles.tiles}>
          {(['light', 'dark', 'system'] as const).map((mode) => (
            <label key={mode} className={styles.tile}>
              <span className={styles.tileArt} data-mode={mode} aria-hidden="true">
                <span className={styles.tileTime}>9:41</span>
                <span className={styles.tileIcons}>
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              </span>
              <span className={styles.tileLabel}>{THEME_LABEL[mode]}</span>
              <input
                type="radio"
                name={name}
                className={styles.radio}
                checked={theme === mode}
                onChange={() => setPrefNow({ theme: mode })}
              />
            </label>
          ))}
        </div>
      </section>
      <Group header="Text" footer="Apps that support Dynamic Type adjust to this reading size.">
        <SliderRow
          ctx={ctx}
          rowId="text-size"
          title="Text Size"
          min={TEXT_SCALE_RANGE[0] * 100}
          max={TEXT_SCALE_RANGE[1] * 100}
          step={5}
          value={scale}
          valueText={`${scale}%`}
          onChange={(value) => setPrefNow({ textScale: value / 100 })}
          low={<span className={styles.smallA}>A</span>}
          high={<span className={styles.bigA}>A</span>}
        />
      </Group>
      {ctx.memoryOnly ? <p className={styles.note}>{storageNote(ctx)}</p> : null}
    </>
  );
}

function AccessibilityScreen({ ctx }: { readonly ctx: Ctx }) {
  const prefs = usePrefs((value) => value);
  const caps = useKernel((state) => state.capabilities);
  const reduced = prefs.motion === 'reduced' || (prefs.motion === 'system' && caps.reducedMotion);
  const visitorWins = caps.reducedMotion && prefs.motion === 'full';
  const more = prefs.contrast === 'more';
  const solid = prefs.glass === 'solid' || more || (prefs.glass === 'system' && caps.reducedTransparency);
  return (
    <>
      <Group
        header="Motion"
        footer={
          visitorWins
            ? 'Your device asks for reduced motion. Your choice here wins.'
            : 'Reduce the motion of the interface, including app opening and screen transitions.'
        }
      >
        <SwitchRow
          ctx={ctx}
          rowId="reduce-motion"
          title="Reduce Motion"
          checked={reduced}
          onChange={(on) => setPref({ motion: on ? 'reduced' : caps.reducedMotion ? 'full' : 'system' })}
        />
      </Group>
      <Group
        header="Display"
        footer={
          more
            ? 'Transparency stays reduced while Increase Contrast is on.'
            : 'Solid backgrounds instead of blurred glass.'
        }
      >
        <SwitchRow
          ctx={ctx}
          rowId="reduce-transparency"
          title="Reduce Transparency"
          checked={solid}
          onChange={(on) => setPref({ glass: on ? 'solid' : caps.reducedTransparency ? 'full' : 'system' })}
        />
        <SwitchRow
          ctx={ctx}
          rowId="increase-contrast"
          title="Increase Contrast"
          checked={more}
          onChange={(on) => setPref({ contrast: on ? 'more' : 'system' })}
        />
      </Group>
      <Group header="Keyboard" footer="“/” opens Spotlight and “?” lists the shortcuts.">
        <SwitchRow
          ctx={ctx}
          rowId="single-key"
          title="Single-key Shortcuts"
          checked={prefs.singleKeyShortcuts}
          onChange={(singleKeyShortcuts) => setPref({ singleKeyShortcuts })}
        />
      </Group>
      <Group footer={storageNote(ctx) ?? 'Everything on one readable page.'}>
        <Row
          kind="href"
          href="/plain"
          title="Open Plain Portfolio"
          icon={{ glyph: 'plain', tint: '#34c759' }}
          className={flashClass(ctx, 'plain')}
        />
      </Group>
    </>
  );
}

function SoundsScreen({ ctx }: { readonly ctx: Ctx }) {
  const sound = usePrefs((prefs) => prefs.sound);
  const engine = useRef<ReturnType<typeof createAudioEngine> | null>(null);
  useEffect(() => () => engine.current?.dispose(), []);
  const volume = Math.round(sound.volume * 100);
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
    <>
      <Group
        header="System Sounds"
        footer="Small interface sounds, such as a pop when a banner arrives. Off by default."
      >
        <SwitchRow
          ctx={ctx}
          rowId="ui-sounds"
          title="UI Sounds"
          checked={sound.ui}
          onChange={(ui) => setPref({ sound: { ...sound, ui } })}
        />
      </Group>
      <Group header="Volume">
        <SliderRow
          ctx={ctx}
          rowId="volume"
          title="Volume"
          min={0}
          max={100}
          step={5}
          value={volume}
          valueText={`${volume}%`}
          onChange={(value) => setPrefNow({ sound: { ...sound, volume: value / 100 } })}
          low={<Glyph name="speaker-off" size={18} />}
          high={<Glyph name="speaker" size={20} />}
        />
      </Group>
      <Group footer={storageNote(ctx) ?? 'The chime from the start of the visit — it only ever plays when you ask.'}>
        <Row
          kind="button"
          title={<span className={styles.action}>Play Intro Sound</span>}
          icon={{ glyph: 'play', tint: '#ff2d55' }}
          className={flashClass(ctx, 'intro')}
          onPress={playIntro}
        />
      </Group>
    </>
  );
}

function PrivacyScreen({ ctx }: { readonly ctx: Ctx }) {
  const [signals] = useState(() =>
    typeof window === 'undefined' ? null : readPrivacySignals(window, process.env.NODE_ENV === 'production'),
  );
  const off = signals ? signals.doNotTrack || signals.globalPrivacyControl || signals.saveData : false;
  return (
    <>
      <Group
        header="Analytics"
        footer={
          off
            ? 'Your browser asks not to be tracked — nothing is counted.'
            : 'Cookieless and anonymous. Nothing identifies you.'
        }
      >
        <Row
          kind="static"
          title="Analytics"
          value={off ? 'Off' : 'Anonymous'}
          className={flashClass(ctx, 'analytics')}
        />
        <Row
          kind="static"
          title="Do Not Track"
          value={signals?.doNotTrack ? 'On' : 'Off'}
          className={flashClass(ctx, 'dnt')}
        />
        <Row kind="static" title="Global Privacy Control" value={signals?.globalPrivacyControl ? 'On' : 'Off'} />
        <Row kind="static" title="Cookies" value="No cookies" className={flashClass(ctx, 'cookies')} />
      </Group>
      <div className={styles.prose}>
        <PrivacyNotice data={{ counted: COUNTED }} headingLevel={4} />
      </div>
    </>
  );
}

function AboutScreen({ ctx }: { readonly ctx: Ctx }) {
  const eggsFound = usePrefs((prefs) => prefs.eggsFound);
  const person = getPerson();
  const resume = getResume();
  const eggs = eggProgress(eggsFound, 'ios');
  return (
    <>
      <Group>
        <Row kind="static" title="Name" value={person.name} className={flashClass(ctx, 'about')} />
        <Row kind="static" title="Role" value={person.role} />
        <Row kind="static" title="Location" value={person.location} />
        <Row
          kind="static"
          title="Résumé updated"
          value={<time dateTime={resume.updated}>{formatUpdated(resume.updated)}</time>}
        />
        <Row kind="static" title="Version" value={contentRev.slice(0, 8)} className={flashClass(ctx, 'version')} />
        <Row
          kind="static"
          title="Easter Eggs Found"
          value={`${eggs.found} / ${eggs.total}`}
          className={flashClass(ctx, 'eggs')}
        />
      </Group>
      <Group>
        <Row
          kind="button"
          title="Legal Notices"
          icon={{ glyph: 'doc', tint: '#8e8e93' }}
          accessory="chevron"
          pushKey="legal"
          className={flashClass(ctx, 'legal')}
          onPress={() => ctx.push('legal')}
        />
      </Group>
    </>
  );
}

function LegalScreen() {
  return (
    <div className={styles.prose}>
      <LegalNotice
        data={{
          credits: assetCredits(),
          contactEmail: getContact().email,
          glyphCredit: GLYPH_CREDIT,
          assetMode: ASSET_MODE,
        }}
        headingLevel={4}
      />
      <p>{IOS_GLYPH_CREDIT}</p>
    </div>
  );
}
