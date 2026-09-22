/**
 * iOS Settings in jsdom (plans/ios/apps/settings.md): IOS-SET-01 (inset-grouped root with profile cell + tiles, pushed
 * screens as session state, search across every screen that pushes to the match and highlights it, intents) ·
 * IOS-SET-02 (Display / Accessibility / Sounds controls apply SET_PREF at once; visitor-wins and storage footnotes) ·
 * IOS-SET-03 (Switch OS + Tour rows call the shell) · IOS-SET-04 (About facts + eggs counter + Legal, Privacy notice) ·
 * IOS-SET-05 (pad split view; semantics + axe).
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Settings from '@/components/os/ios/apps/Settings';
import { requestIntent, resetIntents } from '@/components/os/ios/intents';
import { iosId } from '@/components/os/ios/model';
import { formatUpdated } from '@/components/content';
import { contentRev } from '@/data/content-index';
import { getPerson, getResume } from '@/data/selectors';
import { COUNTED } from '@/lib/analytics/notice';
import { eggProgress, eggsFor } from '@/lib/eggs';
import { DEFAULT_PREFS } from '@/lib/kernel/state';
import { dispatch, getKernel, kernelStore } from '@/stores/kernel-store';
import { getPrefs } from '@/stores/prefs-store';
import { closeAllIos, renderIosApp, settle } from './harness';

const mocks = vi.hoisted(() => ({ memory: false, played: [] as unknown[], unlocked: 0 }));
vi.mock('@/lib/kernel/persist/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/kernel/persist/storage')>();
  return {
    ...actual,
    getSafeStorage: () => {
      const storage = actual.getSafeStorage();
      return mocks.memory ? { ...storage, mode: 'memory' as const } : storage;
    },
  };
});
vi.mock('@/lib/audio/engine', () => ({
  browserAudioEnvironment: () => ({}),
  createAudioEngine: () => ({
    unlock: () => void (mocks.unlocked += 1),
    prefetch: () => undefined,
    playIntro: (options: unknown) => void mocks.played.push(options),
    dispose: () => undefined,
  }),
}));

const ID = iosId('settings');
const ui = () => getKernel().sessions.ios.windows[ID]?.ui ?? {};
const click = async (el: Element) => {
  fireEvent.click(el);
  await settle();
};
const row = (name: string | RegExp) => screen.getByRole('button', { name });
const title = (name: string) => screen.getByRole('heading', { level: 3, name });
const appRoot = () => document.querySelector<HTMLElement>('[data-app-surface] > h2 + *')!;
const flashed = () => appRoot().querySelector('[class*="flash"]');

beforeEach(() => {
  resetIntents();
  mocks.memory = false;
  mocks.played = [];
  mocks.unlocked = 0;
  dispatch({ type: 'SET_PREF', patch: DEFAULT_PREFS });
});
afterEach(() => {
  closeAllIos();
});

describe('IOS-SET-01 inset-grouped Settings, profile cell, pushed screens, search', () => {
  it('IOS-SET-01 root: large title, profile cell, tinted tiles; screens push as session state', async () => {
    renderIosApp(Settings, 'settings');
    expect(title('Settings')).toBeInTheDocument();
    const person = getPerson();
    const profile = row(new RegExp(person.name));
    expect(profile).toHaveTextContent(person.headline);
    // 29 pt tinted glyph tiles on the rows (decorative).
    const tiles = appRoot().querySelectorAll('[data-tint][aria-hidden="true"]');
    expect(tiles.length).toBeGreaterThanOrEqual(7);
    for (const name of [
      'Switch Operating System',
      'Take the Tour',
      /^Display & Brightness/,
      'Accessibility',
      'Sounds',
      'Privacy & Security',
      'About',
    ])
      expect(row(name)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'General' })).toBeInTheDocument();

    await click(profile);
    expect(title('About')).toHaveFocus();
    expect(JSON.parse(ui().stack!)).toEqual(['about']);
    await click(row('Legal Notices'));
    expect(title('Legal Notices')).toBeInTheDocument();
    expect(JSON.parse(ui().stack!)).toEqual(['about', 'legal']);
    // Back chevrons are labelled with the previous screen's title; focus returns to the row that pushed.
    await click(screen.getByRole('button', { name: 'Back to About' }));
    expect(row('Legal Notices')).toHaveFocus();
    await click(screen.getByRole('button', { name: 'Back to Settings' }));
    expect(ui().stack).toBeUndefined();
    // The URL never changed (one history entry).
    expect(getKernel().sessions.ios.windows[ID]?.nav.entries).toHaveLength(1);
  });

  it('IOS-SET-01 search filters rows across every screen and pushes to the match with a brief highlight', async () => {
    renderIosApp(Settings, 'settings');
    const search = screen.getByRole('searchbox', { name: 'Search settings' });
    fireEvent.change(search, { target: { value: 'contrast' } });
    await settle();
    const results = screen.getByRole('region', { name: 'Results' });
    const hit = within(results).getByRole('button', { name: /Increase Contrast/ });
    expect(hit).toHaveTextContent('Accessibility');
    await click(hit);
    expect(title('Accessibility')).toBeInTheDocument();
    expect(ui().q).toBeUndefined();
    // The matching row is highlighted, then the highlight clears (600 ms).
    expect(flashed()).not.toBeNull();
    expect(flashed()).toHaveTextContent('Increase Contrast');
    await act(() => new Promise((resolve) => setTimeout(resolve, 760)));
    expect(flashed()).toBeNull();

    // A keyword (not a label) finds a row two screens deep.
    await click(screen.getByRole('button', { name: 'Back to Settings' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search settings' }), { target: { value: 'trademarks' } });
    await settle();
    await click(screen.getByRole('button', { name: /Legal Notices/ }));
    expect(title('Legal Notices')).toBeInTheDocument();
    expect(JSON.parse(ui().stack!)).toEqual(['about', 'legal']);

    await click(screen.getByRole('button', { name: 'Back to About' }));
    await click(screen.getByRole('button', { name: 'Back to Settings' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search settings' }), { target: { value: 'qqqq' } });
    await settle();
    expect(screen.getByRole('status')).toHaveTextContent('No Results for “qqqq”');

    // A root-level result (no push): the matched row takes focus from the vanished results list.
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search settings' }), {
      target: { value: 'switch operating' },
    });
    await settle();
    await click(
      within(screen.getByRole('region', { name: 'Results' })).getByRole('button', { name: /Switch Operating System/ }),
    );
    expect(row('Switch Operating System')).toHaveFocus();
    expect(flashed()).toHaveTextContent('Switch Operating System');
  });

  it('IOS-SET-01 { kind: "settings" } intents push that screen (waiting at mount and while open)', async () => {
    requestIntent({ kind: 'settings', screen: 'accessibility' });
    const { calls } = renderIosApp(Settings, 'settings');
    await settle();
    expect(title('Accessibility')).toBeInTheDocument();
    act(() => requestIntent({ kind: 'settings', screen: 'legal' }));
    await settle();
    expect(title('Legal Notices')).toBeInTheDocument();
    expect(JSON.parse(ui().stack!)).toEqual(['about', 'legal']);
    act(() => requestIntent({ kind: 'settings', screen: 'root' }));
    await settle();
    expect(title('Settings')).toBeInTheDocument();
    act(() => requestIntent({ kind: 'settings', screen: 'switch-os' }));
    await settle();
    expect(calls.openSwitchOs).toHaveLength(1);
  });
});

describe('IOS-SET-02 controls apply instantly (SET_PREF) and persist', () => {
  it('IOS-SET-02 accessibility switches: Reduce Motion, Reduce Transparency, Increase Contrast, Single-key Shortcuts', async () => {
    renderIosApp(Settings, 'settings');
    await click(row('Accessibility'));
    const motion = screen.getByRole('switch', { name: 'Reduce Motion' });
    expect(motion).toHaveAttribute('aria-checked', 'false');
    await click(motion);
    expect(getPrefs().motion).toBe('reduced');
    expect(screen.getByRole('switch', { name: 'Reduce Motion' })).toHaveAttribute('aria-checked', 'true');
    await click(screen.getByRole('switch', { name: 'Reduce Motion' }));
    expect(getPrefs().motion).toBe('system');

    await click(screen.getByRole('switch', { name: 'Reduce Transparency' }));
    expect(getPrefs().glass).toBe('solid');
    await click(screen.getByRole('switch', { name: 'Increase Contrast' }));
    expect(getPrefs().contrast).toBe('more');
    expect(screen.getByText(/Transparency stays reduced while Increase Contrast is on/)).toBeInTheDocument();
    const singleKey = screen.getByRole('switch', { name: 'Single-key Shortcuts' });
    const before = getPrefs().singleKeyShortcuts;
    await click(singleKey);
    expect(getPrefs().singleKeyShortcuts).toBe(!before);

    const plain = screen.getByRole('link', { name: /Open Plain Portfolio/ });
    expect(plain).toHaveAttribute('href', '/plain');
  });

  it('IOS-SET-02 the device asks for reduced motion but the visitor turns it off → visitor wins, footnote explains', async () => {
    const caps = getKernel().capabilities;
    kernelStore.setState((state) => ({ kernel: { ...state.kernel, capabilities: { ...caps, reducedMotion: true } } }));
    try {
      renderIosApp(Settings, 'settings');
      await click(row('Accessibility'));
      const motion = screen.getByRole('switch', { name: 'Reduce Motion' });
      expect(motion).toHaveAttribute('aria-checked', 'true');
      await click(motion);
      expect(getPrefs().motion).toBe('full');
      expect(screen.getByText('Your device asks for reduced motion. Your choice here wins.')).toBeInTheDocument();
    } finally {
      kernelStore.setState((state) => ({ kernel: { ...state.kernel, capabilities: caps } }));
    }
  });

  it('IOS-SET-02 Display: Appearance radio tiles and the Text Size slider (100–130 %)', async () => {
    renderIosApp(Settings, 'settings');
    expect(row(/^Display & Brightness/)).toHaveTextContent('Automatic');
    await click(row(/^Display & Brightness/));
    const group = screen.getByRole('radiogroup', { name: 'Appearance' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((radio) => radio.closest('label')?.textContent)).toEqual([
      expect.stringContaining('Light'),
      expect.stringContaining('Dark'),
      expect.stringContaining('Automatic'),
    ]);
    expect(within(group).getByRole('radio', { name: /Automatic/ })).toBeChecked();
    fireEvent.click(within(group).getByRole('radio', { name: /Dark/ }));
    expect(getPrefs().theme).toBe('dark');
    expect(within(group).getByRole('radio', { name: /Dark/ })).toBeChecked();

    const slider = screen.getByRole('slider', { name: 'Text Size' });
    expect(slider).toHaveAttribute('min', '100');
    expect(slider).toHaveAttribute('max', '130');
    expect(slider).toHaveAttribute('step', '5');
    fireEvent.change(slider, { target: { value: '120' } });
    expect(getPrefs().textScale).toBe(1.2);
    expect(screen.getByRole('slider', { name: 'Text Size' })).toHaveAttribute('aria-valuetext', '120%');

    await click(screen.getByRole('button', { name: 'Back to Settings' }));
    expect(row(/^Display & Brightness/)).toHaveTextContent('Dark');
  });

  it('IOS-SET-02 Sounds: UI Sounds switch, Volume slider, Play Intro Sound (only on press)', async () => {
    renderIosApp(Settings, 'settings');
    await click(row('Sounds'));
    expect(mocks.played).toHaveLength(0);
    await click(screen.getByRole('switch', { name: 'UI Sounds' }));
    expect(getPrefs().sound.ui).toBe(true);
    const volume = screen.getByRole('slider', { name: 'Volume' });
    fireEvent.change(volume, { target: { value: '40' } });
    expect(getPrefs().sound.volume).toBe(0.4);
    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveAttribute('aria-valuetext', '40%');
    await click(row('Play Intro Sound'));
    expect(mocks.unlocked).toBe(1);
    expect(mocks.played).toEqual([{ enabled: true, volume: 0.4 }]);
  });

  it('IOS-SET-02 storage unavailable → "Changes last for this visit"', async () => {
    mocks.memory = true;
    renderIosApp(Settings, 'settings');
    expect(screen.getAllByText('Changes last for this visit.').length).toBeGreaterThan(0);
    await click(row('Accessibility'));
    expect(screen.getAllByText('Changes last for this visit.').length).toBeGreaterThan(0);
  });
});

describe('IOS-SET-03 Switch Operating System + Take the Tour', () => {
  it('IOS-SET-03 the rows call the shell (Switch OS surface from the row; the tour starts)', async () => {
    const { calls } = renderIosApp(Settings, 'settings');
    const switchRow = row('Switch Operating System');
    fireEvent.click(switchRow);
    expect(calls.openSwitchOs).toEqual([[switchRow]]);
    fireEvent.click(row('Take the Tour'));
    expect(calls.startTour).toHaveLength(1);
  });
});

describe('IOS-SET-04 About (facts, eggs counter, Legal Notices) and Privacy', () => {
  it('IOS-SET-04 About shows the portfolio facts, version and "Easter eggs found n / N"; Legal is reachable', async () => {
    renderIosApp(Settings, 'settings');
    await click(row('About'));
    const person = getPerson();
    const facts = appRoot().querySelector<HTMLElement>('[data-screen="about"]')!;
    for (const text of [
      person.name,
      person.role,
      person.location,
      formatUpdated(getResume().updated),
      contentRev.slice(0, 8),
    ])
      expect(within(facts).getByText(text)).toBeInTheDocument();
    const total = eggsFor('ios').length;
    expect(within(facts).getByText(`0 / ${total}`)).toBeInTheDocument();
    act(() => void dispatch({ type: 'SET_PREF', patch: { eggsFound: ['EGG-KONAMI-01', 'EGG-SUDO-01'] } }));
    // Only iOS's own eggs count.
    const progress = eggProgress(['EGG-KONAMI-01', 'EGG-SUDO-01'], 'ios');
    expect(within(facts).getByText(`${progress.found} / ${progress.total}`)).toBeInTheDocument();
    expect(progress.found).toBe(1);

    await click(row('Legal Notices'));
    expect(screen.getByRole('heading', { level: 4, name: 'Legal & credits' })).toBeInTheDocument();
    expect(screen.getByText(/not affiliated with/)).toBeInTheDocument();
  });

  it('IOS-SET-04 Privacy: what is counted (ANL-NOTICE-01), DNT / GPC status, no cookies', async () => {
    renderIosApp(Settings, 'settings');
    await click(row('Privacy & Security'));
    for (const line of COUNTED) expect(screen.getByText(line)).toBeInTheDocument();
    expect(screen.getByText('Do Not Track')).toBeInTheDocument();
    expect(screen.getByText('Global Privacy Control')).toBeInTheDocument();
    expect(screen.getByText('No cookies')).toBeInTheDocument();
  });
});

describe('IOS-SET-05 pad split view; semantics', () => {
  it('IOS-SET-05 pad: settings list · detail; the list marks the shown screen', async () => {
    renderIosApp(Settings, 'settings', { layout: 'pad' });
    const sidebar = screen.getByRole('navigation', { name: 'Settings' });
    expect(within(sidebar).getByRole('searchbox', { name: 'Search settings' })).toBeInTheDocument();
    // About shows until another screen is chosen; the profile cell and About row are current.
    expect(title('About')).toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: /^About$/ })).toHaveAttribute('aria-current', 'true');
    await click(within(sidebar).getByRole('button', { name: 'Accessibility' }));
    expect(title('Accessibility')).toBeInTheDocument();
    expect(within(sidebar).getByRole('button', { name: 'Accessibility' })).toHaveAttribute('aria-current', 'true');
    expect(within(sidebar).getByRole('button', { name: /^About$/ })).not.toHaveAttribute('aria-current');
    // No back button on a split view's first detail screen.
    expect(screen.queryByRole('button', { name: /^Back to/ })).toBeNull();
    await click(within(sidebar).getByRole('button', { name: /^About$/ }));
    await click(screen.getByRole('button', { name: 'Legal Notices' }));
    expect(title('Legal Notices')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to About' })).toBeInTheDocument();
  });

  it('IOS-SET-05 every screen is axe clean (switches, sliders, radiogroup, headings, lists)', async () => {
    renderIosApp(Settings, 'settings');
    const rules = [
      'heading-order',
      'label',
      'aria-allowed-attr',
      'aria-valid-attr-value',
      'aria-required-children',
      'aria-toggle-field-name',
      'list',
      'listitem',
      'button-name',
      'link-name',
      'landmark-unique',
      'duplicate-id-aria',
    ];
    const check = async () => {
      const results = await axe.run(appRoot(), { runOnly: { type: 'rule', values: rules } });
      expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes[0]?.html}`)).toEqual([]);
    };
    await check();
    for (const screenName of [
      'Accessibility',
      /^Display & Brightness/,
      'Sounds',
      'Privacy & Security',
      'About',
    ] as const) {
      await click(row(screenName));
      await check();
      if (screenName === 'About') {
        await click(row('Legal Notices'));
        await check();
        await click(screen.getByRole('button', { name: 'Back to About' }));
      }
      await click(screen.getByRole('button', { name: 'Back to Settings' }));
    }
    // Switches are button[role=switch] with visible labels.
    await click(row('Accessibility'));
    for (const toggle of screen.getAllByRole('switch')) {
      expect(toggle.tagName).toBe('BUTTON');
      expect(within(toggle.closest('li')!).getByText(toggle.getAttribute('aria-label')!)).toBeVisible();
    }
  });

  it('IOS-SET-05 pad layout is axe clean', async () => {
    renderIosApp(Settings, 'settings', { layout: 'pad' });
    const results = await axe.run(appRoot(), {
      runOnly: {
        type: 'rule',
        values: ['heading-order', 'label', 'list', 'listitem', 'button-name', 'landmark-unique', 'aria-allowed-attr'],
      },
    });
    expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes[0]?.html}`)).toEqual([]);
  });
});
