'use client';
import { useEffect, useMemo, useState } from 'react';
import { LegalNotice, PrivacyNotice, formatUpdated } from '@/components/content';
import { contentRev } from '@/data/content-index';
import { getContact, getPerson, getResume } from '@/data/selectors';
import { assetCredits, ASSET_MODE } from '@/lib/assets/manifest';
import { useKernel, usePrefs } from '@/stores/kernel-context';
import { dispatch } from '@/stores/kernel-store';
import type { CapabilityProfile, UserPreferences } from '@/lib/kernel/types';
import { eggProgress } from '@/lib/eggs';
import { Switch, Symbol, TopBar } from '../ui';
import { useAndroid, useAppUi } from '../shell-context';
import type { AndroidAppProps } from './types';
import styles from '../android.module.css';

type Screen =
  | 'root'
  | 'wallpaper'
  | 'accessibility'
  | 'sound'
  | 'navigation'
  | 'notifications'
  | 'privacy'
  | 'apps'
  | 'about'
  | 'legal';
const ROWS: readonly { id: Screen; title: string; subtitle: string; glyph: string }[] = [
  { id: 'wallpaper', title: 'Wallpaper & style', subtitle: 'Colours, dark theme, themed icons', glyph: 'palette' },
  {
    id: 'accessibility',
    title: 'Accessibility',
    subtitle: 'Motion, contrast, text and shortcuts',
    glyph: 'accessibility_new',
  },
  { id: 'sound', title: 'Sound & vibration', subtitle: 'Volume and interface sounds', glyph: 'volume_up' },
  { id: 'navigation', title: 'Navigation mode', subtitle: 'Gesture or 3-button navigation', glyph: 'gesture' },
  { id: 'notifications', title: 'Notifications', subtitle: 'Heads-up alerts', glyph: 'notifications' },
  { id: 'privacy', title: 'Privacy', subtitle: 'Anonymous analytics, no cookies', glyph: 'shield' },
  { id: 'apps', title: 'Apps', subtitle: 'App info for six apps', glyph: 'apps' },
  { id: 'about', title: 'About phone', subtitle: "Jaswanth's Portfolio", glyph: 'info' },
];

export default function Settings({ id, headingId, layout }: AndroidAppProps) {
  const android = useAndroid();
  const prefs = usePrefs((value) => value);
  const caps = useKernel((state) => state.capabilities);
  const [screen, setScreen] = useAppUi(id, 'screen', 'root');
  const [query, setQuery] = useState('');
  const current = (ROWS.some((row) => row.id === screen) || screen === 'legal' ? screen : 'root') as Screen;
  useEffect(
    () =>
      android.registerBack(id, () => {
        if (query) {
          setQuery('');
          return true;
        }
        if (current !== 'root') {
          setScreen('root');
          return true;
        }
        return false;
      }),
    [android, id, query, current, setScreen],
  );
  const results = useMemo(
    () => ROWS.filter((row) => `${row.title} ${row.subtitle}`.toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  const setPref = (patch: Partial<Omit<UserPreferences, 'v'>>) => dispatch({ type: 'SET_PREF', patch });
  const detail = (
    <SettingsDetail
      screen={current}
      prefs={prefs}
      caps={caps}
      setPref={setPref}
      android={android}
      setScreen={(value) => setScreen(value)}
    />
  );
  const list = (
    <>
      <header className={styles.settingsHero}>
        <h3>Settings</h3>
        <label>
          <Symbol>search</Symbol>
          <input
            aria-label="Search settings"
            placeholder="Search settings"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </header>
      <ul className={styles.settingsList}>
        {(query ? results : ROWS).map((row) => (
          <li key={row.id}>
            <button
              aria-current={layout === 'large' && current === row.id ? 'page' : undefined}
              onClick={() => {
                setScreen(row.id);
                setQuery('');
              }}
            >
              <span className={styles.tonalIcon}>
                <Symbol>{row.glyph}</Symbol>
              </span>
              <span>
                <strong>{row.title}</strong>
                <small>{query ? `Settings › ${row.subtitle}` : row.subtitle}</small>
              </span>
              <Symbol>chevron_right</Symbol>
            </button>
          </li>
        ))}
        <li>
          <button onClick={(event) => android.openSwitchOs(event.currentTarget)}>
            <span className={styles.tonalIcon}>
              <Symbol>power_settings_new</Symbol>
            </span>
            <span>
              <strong>Switch operating system</strong>
              <small>macOS, Windows, iOS, Linux</small>
            </span>
            <Symbol>chevron_right</Symbol>
          </button>
        </li>
      </ul>
    </>
  );
  return (
    <div className={styles.app} aria-labelledby={headingId} data-app="settings">
      {layout === 'large' ? (
        <div className={styles.settingsSplit}>
          <nav aria-label="Settings categories">{list}</nav>
          <section>
            {current === 'root' ? (
              <SettingsDetail
                screen="about"
                prefs={prefs}
                caps={caps}
                setPref={setPref}
                android={android}
                setScreen={(value) => setScreen(value)}
              />
            ) : (
              detail
            )}
          </section>
        </div>
      ) : current === 'root' ? (
        <main className={styles.appScroller}>{list}</main>
      ) : (
        <>
          <TopBar title={ROWS.find((row) => row.id === current)?.title ?? 'Legal information'} back={android.back} />
          <main className={styles.appScroller}>{detail}</main>
        </>
      )}
    </div>
  );
}

function SettingsDetail({
  screen,
  prefs,
  caps,
  setPref,
  android,
  setScreen,
}: {
  screen: Screen;
  prefs: UserPreferences;
  caps: CapabilityProfile;
  setPref: (patch: Partial<Omit<UserPreferences, 'v'>>) => void;
  android: ReturnType<typeof useAndroid>;
  setScreen: (value: Screen) => void;
}) {
  const section = (title: string, children: React.ReactNode) => (
    <section className={styles.settingsSection}>
      <h4>{title}</h4>
      {children}
    </section>
  );
  const row = (title: string, subtitle: React.ReactNode, control?: React.ReactNode) => (
    <div className={styles.settingRow}>
      <span>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      {control}
    </div>
  );
  if (screen === 'wallpaper')
    return (
      <div className={styles.settingsPage}>
        {section(
          'Wallpaper',
          <div className={styles.wallpaperChoices} role="radiogroup" aria-label="Wallpaper">
            {(['sage', 'blue', 'violet', 'coral'] as const).map((value) => (
              <label key={value}>
                <span data-palette={value} />
                <input
                  type="radio"
                  name="palette"
                  checked={prefs.androidPalette === value}
                  onChange={() => setPref({ androidPalette: value })}
                />
                <b>{value}</b>
              </label>
            ))}
          </div>,
        )}
        {section(
          'Style',
          <>
            {row(
              'Dark theme',
              prefs.theme === 'dark' ? 'On' : 'Off',
              <Switch
                label="Dark theme"
                checked={prefs.theme === 'dark'}
                onChange={(on) => setPref({ theme: on ? 'dark' : 'light' })}
              />,
            )}
            {row(
              'Themed icons',
              prefs.androidThemedIcons ? 'On' : 'Off',
              <Switch
                label="Themed icons"
                checked={prefs.androidThemedIcons}
                onChange={(androidThemedIcons) => setPref({ androidThemedIcons })}
              />,
            )}
          </>,
        )}
      </div>
    );
  if (screen === 'accessibility')
    return (
      <div className={styles.settingsPage}>
        {section(
          'Motion',
          row(
            'Remove animations',
            prefs.motion === 'reduced' ? 'On' : 'Off',
            <Switch
              label="Remove animations"
              checked={prefs.motion === 'reduced'}
              onChange={(on) => setPref({ motion: on ? 'reduced' : caps.reducedMotion ? 'full' : 'system' })}
            />,
          ),
        )}
        {section(
          'Display',
          <>
            {row(
              'Solid surfaces',
              prefs.glass === 'solid' ? 'On' : 'Off',
              <Switch
                label="Solid surfaces"
                checked={prefs.glass === 'solid'}
                onChange={(on) => setPref({ glass: on ? 'solid' : 'system' })}
              />,
            )}
            {row(
              'High contrast text',
              prefs.contrast === 'more' ? 'On' : 'Off',
              <Switch
                label="High contrast text"
                checked={prefs.contrast === 'more'}
                onChange={(on) => setPref({ contrast: on ? 'more' : 'system' })}
              />,
            )}
            {row(
              'Font size',
              `${Math.round(prefs.textScale * 100)}%`,
              <input
                aria-label="Font size"
                type="range"
                min="100"
                max="130"
                step="5"
                value={prefs.textScale * 100}
                onChange={(event) => setPref({ textScale: Number(event.target.value) / 100 })}
              />,
            )}
            {row(
              'Single-key shortcuts',
              prefs.singleKeyShortcuts ? 'On' : 'Off',
              <Switch
                label="Single-key shortcuts"
                checked={prefs.singleKeyShortcuts}
                onChange={(singleKeyShortcuts) => setPref({ singleKeyShortcuts })}
              />,
            )}
            <a className={styles.settingLink} href="/plain">
              Open plain portfolio
            </a>
          </>,
        )}
      </div>
    );
  if (screen === 'sound')
    return (
      <div className={styles.settingsPage}>
        {section(
          'System sounds',
          <>
            {row(
              'UI sounds',
              prefs.sound.ui ? 'On' : 'Off',
              <Switch
                label="UI sounds"
                checked={prefs.sound.ui}
                onChange={(ui) => setPref({ sound: { ...prefs.sound, ui } })}
              />,
            )}
            {row(
              'Volume',
              `${Math.round(prefs.sound.volume * 100)}%`,
              <input
                aria-label="Volume"
                type="range"
                min="0"
                max="100"
                value={prefs.sound.volume * 100}
                onChange={(event) => setPref({ sound: { ...prefs.sound, volume: Number(event.target.value) / 100 } })}
              />,
            )}
          </>,
        )}
      </div>
    );
  if (screen === 'navigation')
    return (
      <div className={styles.settingsPage}>
        {section(
          'Navigation mode',
          <div className={styles.radioCards} role="radiogroup" aria-label="Navigation mode">
            {(
              [
                ['gesture', 'Gesture navigation'],
                ['buttons', '3-button navigation'],
              ] as const
            ).map(([value, label]) => (
              <label key={value}>
                <span aria-hidden="true">{value === 'gesture' ? '━' : '◀  ●  ■'}</span>
                <b>{label}</b>
                <input
                  type="radio"
                  name="nav"
                  checked={prefs.androidNavigation === value}
                  onChange={() => setPref({ androidNavigation: value })}
                />
              </label>
            ))}
          </div>,
        )}
      </div>
    );
  if (screen === 'notifications')
    return (
      <div className={styles.settingsPage}>
        {section(
          'Notifications',
          row(
            'Heads-up notifications',
            prefs.notifications ? 'On' : 'Off',
            <Switch
              label="Heads-up notifications"
              checked={prefs.notifications}
              onChange={(notifications) => setPref({ notifications })}
            />,
          ),
        )}
      </div>
    );
  if (screen === 'privacy')
    return (
      <div className={styles.settingsPage}>
        <PrivacyNotice data={{ counted: ['Anonymous page views', 'Performance measurements'] }} headingLevel={4} />
        <p>No cookies. Do Not Track and Global Privacy Control are respected.</p>
      </div>
    );
  if (screen === 'apps')
    return (
      <div className={styles.settingsPage}>
        {section(
          'Installed apps',
          <ul className={styles.appInfoList}>
            {['Chrome', 'Files', 'Gmail', 'GitHub', 'Keep', 'Settings'].map((name) => (
              <li key={name}>
                <span className={styles.tonalIcon}>
                  <Symbol>apps</Symbol>
                </span>
                <span>
                  <strong>{name}</strong>
                  <small>Version 1.0 · Portfolio content app</small>
                </span>
              </li>
            ))}
          </ul>,
        )}
      </div>
    );
  if (screen === 'legal')
    return (
      <div className={styles.settingsPage}>
        <LegalNotice
          data={{
            credits: assetCredits(),
            contactEmail: getContact().email,
            glyphCredit: 'Material-style symbols are rendered with original text glyphs.',
            assetMode: ASSET_MODE,
          }}
          headingLevel={4}
        />
      </div>
    );
  const eggs = eggProgress(prefs.eggsFound, 'android');
  return (
    <div className={styles.settingsPage}>
      {section(
        'Device details',
        <>
          {row('Device name', "Jaswanth's Portfolio")}
          {row('Owner', getPerson().name)}
          {row('Role', getPerson().role)}
          {row('Résumé updated', formatUpdated(getResume().updated))}
          {row('Content build', contentRev.slice(0, 8))}
          {row('Easter eggs found', `${eggs.found} / ${eggs.total}`)}
          <button className={styles.settingLink} onClick={() => setScreen('legal')}>
            Legal information
          </button>
          <button className={styles.settingLink} onClick={() => android.notify('Tour ready · Swipe up for all apps')}>
            Start tour
          </button>
        </>,
      )}
    </div>
  );
}
