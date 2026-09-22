/**
 * Windows Settings + winver in jsdom (plans/windows/apps/settings.md), rendered in the real window frame:
 * WIN-SET-01 (NavigationView, breadcrumb headers, cards, search that narrows the pages and flashes a card, intents,
 * responsive postures) · WIN-SET-02 (Accessibility controls apply at once and persist) · WIN-SET-03 (Personalization
 * incl. taskbar alignment) · WIN-SET-04 (Privacy + Legal notices from the manifest) · WIN-SET-05 (Switch OS + Back to
 * chooser dispatch SWITCH_OS) · WIN-SET-06 (the winver dialog egg, EGG-WINVER-01) · WIN-SET-07 (semantics + axe).
 */
import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Settings from '@/components/os/windows/apps/Settings';
import { requestIntent, resetIntents } from '@/components/os/windows/intents';
import { useWinShell, WinShellProvider, type WinShellServices } from '@/components/os/windows/shell-context';
import { Winver } from '@/components/os/windows/surfaces/Winver';
import { WinWindow } from '@/components/os/windows/window/Window';
import { contentRev } from '@/data/content-index';
import { getContact, getPerson, getResume } from '@/data/selectors';
import { analytics } from '@/lib/analytics/loader';
import { eggProgress } from '@/lib/eggs';
import type { KernelAction } from '@/lib/kernel/actions';
import { OS_NAMES } from '@/lib/kernel/ids';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import { VISIBLE_OSES } from '@/lib/kernel/route';
import { DEFAULT_CAPABILITIES, DEFAULT_PREFS } from '@/lib/kernel/state';
import { dispatch, getKernel, kernelStore, subscribeEffects } from '@/stores/kernel-store';
import { prefsStore } from '@/stores/prefs-store';

const ID = 'windows:settings' as const;

let booted = false;
function boot(w = 1440, h = 900) {
  if (!booted) {
    dispatch({
      type: 'BOOT',
      url: '/windows',
      navType: 'navigate',
      viewport: { w, h, pointer: 'fine' },
      persisted: null,
      capabilities: DEFAULT_CAPABILITIES,
    });
    booted = true;
  } else dispatch({ type: 'VIEWPORT_CHANGED', w, h, pointer: 'fine' });
}

function openSettings() {
  dispatch({ type: 'OPEN_APP', os: 'windows', role: 'settings' });
  dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id: ID } });
}

/** The shell's own no-op services (what an app sees outside the shell), with the overrides a test spies on. */
function services(overrides: Partial<WinShellServices> = {}): WinShellServices {
  const probe = renderHook(() => useWinShell());
  const fallback = probe.result.current;
  probe.unmount();
  return { ...fallback, ...overrides };
}

function renderSettings({ compact = false, shell = services() }: { compact?: boolean; shell?: WinShellServices } = {}) {
  return render(
    <WinShellProvider value={shell}>
      <WinWindow
        id={ID}
        zIndex={100}
        focused
        compact={compact}
        touch={false}
        shownInCompact
        dimmed={false}
        body={(props) => <Settings {...props} />}
      />
    </WinShellProvider>,
  );
}

const settingsNav = () => screen.getByRole('navigation', { name: 'Settings' });
const pageHeading = () =>
  within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('heading', { level: 3 });
const prefs = () => prefsStore.getState().prefs;

async function goTo(user: ReturnType<typeof userEvent.setup>, page: string) {
  await user.click(within(settingsNav()).getByRole('button', { name: page }));
  expect(pageHeading()).toHaveTextContent(page);
}

beforeEach(() => {
  boot();
  resetIntents();
  prefsStore.setState({ prefs: DEFAULT_PREFS });
  act(() => openSettings());
});

afterEach(() => {
  resetIntents();
});

describe('WIN-SET-01 NavigationView, breadcrumb headers, cards + expanders, search', () => {
  it('lists every page; each page renders its breadcrumb header and cards; the current page is aria-current', async () => {
    const user = userEvent.setup();
    renderSettings();
    const region = screen.getByRole('region', { name: 'Settings' });
    expect(within(region).getByRole('heading', { level: 2 })).toHaveTextContent('Settings');
    const items = within(settingsNav()).getAllByRole('button');
    expect(items.map((item) => item.textContent)).toEqual([
      'System',
      'Personalization',
      'Accessibility',
      'Privacy & security',
      'Apps',
      'Switch operating system',
      'Tour',
    ]);
    expect(items[0]).toHaveAttribute('aria-current', 'page');
    expect(pageHeading()).toHaveTextContent('System');
    // The user tile: initials, name, "Local account".
    expect(screen.getByText(getPerson().name)).toBeInTheDocument();
    expect(screen.getByText('Local account')).toBeInTheDocument();

    const expected: [string, string][] = [
      ['Personalization', 'Taskbar alignment'],
      ['Accessibility', 'Text size'],
      ['Privacy & security', 'Cookies'],
      ['Apps', 'Installed apps'],
      ['Switch operating system', 'Back to chooser'],
      ['Tour', 'Guided tour'],
      ['System', 'Notifications'],
    ];
    for (const [page, card] of expected) {
      await goTo(user, page);
      expect(within(settingsNav()).getByRole('button', { name: page })).toHaveAttribute('aria-current', 'page');
      expect(within(region).getAllByText(card).length).toBeGreaterThan(0);
    }
    expect(
      within(settingsNav())
        .getAllByRole('button')
        .filter((item) => item.hasAttribute('aria-current')),
    ).toHaveLength(1);
  });

  it('drills into System › About and back through the breadcrumb', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole('button', { name: 'About' }));
    const crumbs = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(crumbs).getByRole('button', { name: 'System' })).toBeInTheDocument();
    expect(pageHeading()).toHaveTextContent('About');
    expect(pageHeading()).toHaveAttribute('aria-current', 'page');
    await user.click(within(crumbs).getByRole('button', { name: 'System' }));
    expect(pageHeading()).toHaveTextContent('System');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'About' })));
  });

  it('search narrows the pages; choosing a result opens its page, focuses the card and flashes it', async () => {
    const user = userEvent.setup();
    const { container } = renderSettings();
    const input = screen.getByRole('combobox', { name: 'Find a setting' });
    await user.type(input, 'taskbar');
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options[0]).toHaveTextContent('Taskbar alignment');
    expect(options[0]).toHaveTextContent('Personalization');
    expect(
      within(settingsNav())
        .getAllByRole('button')
        .map((item) => item.textContent),
    ).toEqual(['Personalization']);

    await user.keyboard('{Enter}');
    expect(pageHeading()).toHaveTextContent('Personalization');
    expect(input).toHaveValue('');
    expect(within(settingsNav()).getAllByRole('button')).toHaveLength(7);
    const card = container.querySelector<HTMLElement>('[data-card="taskbar-alignment"]');
    expect(card).toHaveAttribute('data-flash');
    expect(document.activeElement).toBe(card);

    // A card inside an expander on a sub-page: the page opens, the expander opens, the card flashes.
    await user.type(input, 'legal');
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: /Legal notices/ }));
    expect(pageHeading()).toHaveTextContent('About');
    expect(screen.getByRole('button', { name: 'Legal notices' })).toHaveAttribute('aria-expanded', 'true');
    expect(container.querySelector('[data-card="legal"]')).toHaveAttribute('data-flash');

    await user.type(input, 'zzzz');
    expect(screen.getByText('No results found')).toBeInTheDocument();
    expect(within(settingsNav()).getAllByRole('button')).toHaveLength(7);
  });

  it('takes a pending settings intent on mount, and follows one that arrives while open', async () => {
    requestIntent({ kind: 'settings', page: 'accessibility', card: 'contrast' });
    const { container } = renderSettings();
    expect(pageHeading()).toHaveTextContent('Accessibility');
    expect(container.querySelector('[data-card="contrast"]')).toHaveAttribute('data-flash');

    act(() => requestIntent({ kind: 'settings', page: 'privacy' }));
    expect(pageHeading()).toHaveTextContent('Privacy & security');
    act(() => requestIntent({ kind: 'settings', page: 'system', card: 'sound' }));
    expect(pageHeading()).toHaveTextContent('System');
    expect(screen.getByRole('button', { name: 'Sound' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('restarts the guided tour from Settings → Tour (TOUR-RESTART-01 entry point)', async () => {
    const user = userEvent.setup();
    const startTour = vi.fn();
    renderSettings({ shell: services({ startTour }) });
    await goTo(user, 'Tour');
    await user.click(screen.getByRole('button', { name: 'Start tour' }));
    expect(startTour).toHaveBeenCalledTimes(1);
  });

  it('compact: the page list first, then the page pushed with a back arrow', async () => {
    const user = userEvent.setup();
    const { container } = renderSettings({ compact: true });
    expect(container.querySelector('[data-layout="compact"]')).not.toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
    await user.click(within(settingsNav()).getByRole('button', { name: 'Accessibility' }));
    expect(screen.queryByRole('navigation', { name: 'Settings' })).toBeNull();
    expect(pageHeading()).toHaveTextContent('Accessibility');
    await waitFor(() => expect(document.activeElement).toBe(pageHeading()));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(within(settingsNav()).getByRole('button', { name: 'Accessibility' })),
    );
  });

  it('medium: the NavigationView collapses behind the hamburger; Esc closes it', async () => {
    const user = userEvent.setup();
    act(() => boot(900, 800));
    try {
      const { container } = renderSettings();
      expect(container.querySelector('[data-layout="collapsed"]')).not.toBeNull();
      const hamburger = screen.getByRole('button', { name: 'Open navigation' });
      expect(hamburger).toHaveAttribute('aria-expanded', 'false');
      await user.click(hamburger);
      expect(hamburger).toHaveAttribute('aria-expanded', 'true');
      expect(container.querySelector('[data-nav-open]')).not.toBeNull();
      await waitFor(() =>
        expect(document.activeElement).toBe(within(settingsNav()).getByRole('button', { name: 'System' })),
      );
      await user.keyboard('{Escape}');
      expect(hamburger).toHaveAttribute('aria-expanded', 'false');
      await waitFor(() => expect(document.activeElement).toBe(hamburger));
    } finally {
      act(() => boot());
    }
  });
});

describe('WIN-SET-02 Accessibility controls apply instantly and persist (A11Y-PREF-01)', () => {
  it('animation, contrast, transparency, single-key toggles and the text size slider write the preferences', async () => {
    const user = userEvent.setup();
    renderSettings();
    await goTo(user, 'Accessibility');

    const animation = screen.getByRole('switch', { name: 'Animation effects' });
    expect(animation).toHaveAttribute('aria-checked', 'true');
    await user.click(animation);
    await waitFor(() => expect(prefs().motion).toBe('reduced'));
    expect(animation).toHaveAttribute('aria-checked', 'false');
    await user.click(animation);
    await waitFor(() => expect(prefs().motion).toBe('full'));

    await user.click(screen.getByRole('switch', { name: 'Contrast themes' }));
    await waitFor(() => expect(prefs().contrast).toBe('more'));
    expect(screen.getByRole('switch', { name: 'Contrast themes' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('switch', { name: 'Transparency effects' }));
    await waitFor(() => expect(prefs().glass).toBe('solid'));

    await user.click(screen.getByRole('switch', { name: 'Single-key shortcuts' }));
    await waitFor(() => expect(prefs().singleKeyShortcuts).toBe(false));

    const textSize = screen.getByRole('slider', { name: 'Text size' });
    expect(textSize).toHaveAttribute('min', '100');
    expect(textSize).toHaveAttribute('max', '130');
    expect(textSize).toHaveAttribute('step', '5');
    fireEvent.change(textSize, { target: { value: '120' } });
    expect(prefs().textScale).toBe(1.2);
    expect(textSize).toHaveAttribute('aria-valuetext', '120%');
    expect(screen.getByText('Text size preview')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /Open plain portfolio/ })).toHaveAttribute('href', '/plain');
    // Persisted in pf.prefs.v1 (the safe storage writes after its 250 ms debounce).
    await waitFor(() => expect(window.localStorage.getItem('pf.prefs.v1')).toContain('"textScale":1.2'));
    expect(window.localStorage.getItem('pf.prefs.v1')).toContain('"contrast":"more"');
  });

  it('System: sound and notifications controls write the preferences', async () => {
    const user = userEvent.setup();
    renderSettings();
    const sound = screen.getByRole('button', { name: 'Sound' });
    expect(sound).toHaveAttribute('aria-expanded', 'false');
    await user.click(sound);
    expect(sound).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(screen.getByRole('slider', { name: 'Volume' }), { target: { value: '40' } });
    expect(prefs().sound.volume).toBe(0.4);
    await user.click(screen.getByRole('switch', { name: 'UI sounds' }));
    await waitFor(() => expect(prefs().sound.ui).toBe(true));
    await user.click(screen.getByRole('switch', { name: 'Play intro sound' }));
    await waitFor(() => expect(prefs().sound.enabled).toBe(false));
    expect(prefs().sound).toEqual({ enabled: false, volume: 0.4, ui: true });
    await user.click(screen.getByRole('switch', { name: 'Notifications' }));
    await waitFor(() => expect(prefs().notifications).toBe(false));
  });
});

describe('WIN-SET-03 Personalization incl. taskbar alignment Center / Left', () => {
  it('the alignment radios set prefs.taskbarAlign (the preview follows); theme, accent and transparency too', async () => {
    const user = userEvent.setup();
    const { container } = renderSettings();
    await goTo(user, 'Personalization');

    const alignment = screen.getByRole('radiogroup', { name: 'Taskbar alignment' });
    expect(within(alignment).getByRole('radio', { name: 'Center' })).toBeChecked();
    await user.click(within(alignment).getByRole('radio', { name: 'Left' }));
    await waitFor(() => expect(prefs().taskbarAlign).toBe('left'));
    expect(within(alignment).getByRole('radio', { name: 'Left' })).toBeChecked();
    expect(container.querySelector('[data-align="left"]')).not.toBeNull();
    await user.click(within(alignment).getByRole('radio', { name: 'Center' }));
    await waitFor(() => expect(prefs().taskbarAlign).toBe('center'));

    const mode = screen.getByRole('radiogroup', { name: 'Choose your mode' });
    expect(within(mode).getByRole('radio', { name: 'System' })).toBeChecked();
    await user.click(within(mode).getByRole('radio', { name: 'Dark' }));
    await waitFor(() => expect(prefs().theme).toBe('dark'));

    const colors = screen.getByRole('radiogroup', { name: 'Windows colors' });
    expect(within(colors).getAllByRole('radio')).toHaveLength(10);
    expect(within(colors).getByRole('radio', { name: 'Automatic' })).toBeChecked();
    await user.click(within(colors).getByRole('radio', { name: 'Teal' }));
    await waitFor(() => expect(prefs().accent).toBe('teal'));
    await user.click(within(colors).getByRole('radio', { name: 'Automatic' }));
    await waitFor(() => expect(prefs().accent).toBeNull());

    await user.click(screen.getByRole('switch', { name: 'Transparency effects' }));
    await waitFor(() => expect(prefs().glass).toBe('solid'));
  });
});

describe('WIN-SET-04 Privacy + Legal notices surfaces', () => {
  it('Privacy shows what is counted, DNT/GPC status and no cookies; About → Legal notices shows the manifest credits', async () => {
    const user = userEvent.setup();
    renderSettings();
    await goTo(user, 'Privacy & security');
    expect(screen.getByRole('button', { name: 'Diagnostics & feedback' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { level: 4, name: 'Privacy' })).toBeInTheDocument();
    expect(screen.getByText(/Anonymous loading-speed measurements/)).toBeInTheDocument();
    expect(screen.getByText('Do Not Track: off · Global Privacy Control: off')).toBeInTheDocument();
    expect(screen.getByText('No cookies')).toBeInTheDocument();

    await goTo(user, 'System');
    await user.click(screen.getByRole('button', { name: 'About' }));
    const person = getPerson();
    expect(screen.getByText(person.role, { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText(person.location, { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText(contentRev, { selector: 'dd' })).toBeInTheDocument();
    expect(screen.getByText('Easter eggs found')).toBeInTheDocument();
    expect(screen.getByText(`0 / ${eggProgress([], 'windows').total}`)).toBeInTheDocument();

    const legal = screen.getByRole('button', { name: 'Legal notices' });
    expect(legal).toHaveAttribute('aria-expanded', 'false');
    await user.click(legal);
    expect(legal).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('heading', { level: 4, name: /Legal/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: getContact().email })).toHaveAttribute(
      'href',
      expect.stringContaining(`mailto:${getContact().email}`),
    );
    expect(screen.getByText(/Fluent UI System Icons \(© Microsoft Corporation, MIT License\)/)).toBeInTheDocument();
    expect(screen.getByText(/Original icon glyphs: Lucide/)).toBeInTheDocument();
  });
});

describe('WIN-SET-05 Switch operating system page + Back to chooser', () => {
  it('each OS card switches (SWITCH_OS via switch); Back to chooser switches to null', async () => {
    const user = userEvent.setup();
    const switches: KernelAction[] = [];
    const stop = subscribeEffects((effect) => {
      if (effect.action.type === 'SWITCH_OS') switches.push(effect.action);
    });
    try {
      renderSettings();
      await goTo(user, 'Switch operating system');
      const others = VISIBLE_OSES.filter((os) => os !== 'windows');
      expect(others.length).toBeGreaterThan(0);
      for (const os of others)
        expect(screen.getByRole('link', { name: `Switch to ${OS_NAMES[os]}` })).toHaveAttribute('href', `/${os}`);
      expect(screen.queryByRole('link', { name: `Switch to ${OS_NAMES.windows}` })).toBeNull();

      const snapshot = getKernel();
      await user.click(screen.getByRole('link', { name: `Switch to ${OS_NAMES[others[0]!]}` }));
      await waitFor(() => expect(switches).toEqual([{ type: 'SWITCH_OS', to: others[0], via: 'switch' }]));
      act(() => kernelStore.setState({ kernel: snapshot }));

      const chooser = screen.getByRole('link', { name: 'Back to chooser' });
      expect(chooser).toHaveAttribute('href', '/');
      await user.click(chooser);
      await waitFor(() => expect(switches.at(-1)).toEqual({ type: 'SWITCH_OS', to: null, via: 'switch' }));
      act(() => kernelStore.setState({ kernel: snapshot }));
    } finally {
      stop();
    }
  });

  it('Apps lists the seven Windows apps with Open links', async () => {
    const user = userEvent.setup();
    renderSettings();
    await goTo(user, 'Apps');
    for (const binding of OS_REGISTRY.windows.apps)
      expect(screen.getByRole('link', { name: `Open ${binding.title}` })).toHaveAttribute(
        'href',
        `/windows/${binding.slug}`,
      );
    expect(screen.getByText(`${OS_REGISTRY.windows.apps.length} apps found`)).toBeInTheDocument();
  });
});

describe('WIN-SET-06 winver dialog (EGG-WINVER-01)', () => {
  it('shows the data-driven version, focuses OK, closes on Esc, records the egg once', async () => {
    const track = vi.spyOn(analytics, 'track');
    const onClose = vi.fn();
    const opener = document.createElement('button');
    opener.textContent = 'opener';
    document.body.append(opener);
    opener.focus();
    try {
      const first = render(<Winver onClose={onClose} />);
      const dialog = screen.getByRole('dialog', { name: 'About Windows' });
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(within(dialog).getByText(`${getPerson().givenName}’s Portfolio`)).toBeInTheDocument();
      expect(dialog).toHaveTextContent(`Version ${getResume().updated} (OS Build ${contentRev})`);
      expect(dialog).toHaveTextContent('This product is licensed to: you, the visitor');
      const ok = within(dialog).getByRole('button', { name: 'OK' });
      expect(document.activeElement).toBe(ok);

      fireEvent.keyDown(ok, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(prefs().eggsFound.filter((id) => id === 'EGG-WINVER-01')).toHaveLength(1);
      expect(track).toHaveBeenCalledTimes(1);
      expect(track).toHaveBeenCalledWith({ name: 'egg_found', id: 'EGG-WINVER-01' });

      first.unmount();
      expect(document.activeElement).toBe(opener);

      // Opening it again never counts twice.
      const second = render(<Winver onClose={onClose} />);
      await userEvent.setup().click(screen.getByRole('button', { name: 'OK' }));
      expect(onClose).toHaveBeenCalledTimes(2);
      expect(prefs().eggsFound.filter((id) => id === 'EGG-WINVER-01')).toHaveLength(1);
      expect(track).toHaveBeenCalledTimes(1);
      second.unmount();

      // The found counter in Settings → System → About reflects it.
      const user = userEvent.setup();
      renderSettings();
      await user.click(screen.getByRole('button', { name: 'About' }));
      expect(screen.getByText(`1 / ${eggProgress([], 'windows').total}`)).toBeInTheDocument();
    } finally {
      opener.remove();
    }
  });

  it('traps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(<Winver onClose={() => undefined} />);
    const dialog = screen.getByRole('dialog', { name: 'About Windows' });
    const close = within(dialog).getByRole('button', { name: 'Close' });
    const ok = within(dialog).getByRole('button', { name: 'OK' });
    expect(document.activeElement).toBe(ok);
    await user.tab();
    expect(document.activeElement).toBe(close);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(ok);
  });

  it('closing returns focus to the focused window when its invoker is gone (winver chosen in Search) — never <body>', async () => {
    renderSettings(); // windows:settings is the kernel's focused window
    (document.activeElement as HTMLElement | null)?.blur(); // the Search field that chose winver has unmounted
    expect(document.activeElement).toBe(document.body);
    const dialog = render(<Winver onClose={() => undefined} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'OK' }));
    dialog.unmount();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Settings' })));
  });
});

describe('WIN-SET-07 semantics: switches, sliders, radio groups, expanders, breadcrumb; axe clean', () => {
  it('every page is axe clean for headings, labels, ARIA attributes and lists', async () => {
    const user = userEvent.setup();
    const { container } = renderSettings();
    const rules = [
      'heading-order',
      'label',
      'aria-allowed-attr',
      'aria-valid-attr-value',
      'list',
      'listitem',
      'button-name',
      'link-name',
      'landmark-unique',
      'definition-list',
      'dlitem',
    ];
    const check = async () => {
      const results = await axe.run(container, { runOnly: { type: 'rule', values: rules } });
      expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes[0]?.html}`)).toEqual([]);
    };

    // Structure: the NavigationView is a nav list with aria-current; the header is a breadcrumb nav with the h3.
    const navList = within(settingsNav()).getByRole('list');
    expect(within(navList).getAllByRole('listitem')).toHaveLength(7);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toContainElement(pageHeading());
    // Expander = a button with aria-expanded controlling the body.
    const sound = screen.getByRole('button', { name: 'Sound' });
    const body = document.getElementById(sound.getAttribute('aria-controls')!);
    expect(body).not.toBeNull();
    expect(body).not.toBeVisible();
    await user.click(sound);
    expect(sound).toHaveAttribute('aria-expanded', 'true');
    expect(body).toBeVisible();
    // Real switches and a labelled native range.
    for (const control of screen.getAllByRole('switch')) {
      expect(control.tagName).toBe('BUTTON');
      expect(control).toHaveAttribute('aria-checked');
      expect(control).toHaveAccessibleName();
    }
    const volume = screen.getByRole('slider', { name: 'Volume' });
    expect(volume).toHaveAttribute('type', 'range');
    await check();

    await user.click(screen.getByRole('button', { name: 'About' }));
    await user.click(screen.getByRole('button', { name: 'Legal notices' }));
    await check();

    for (const page of [
      'Personalization',
      'Accessibility',
      'Privacy & security',
      'Apps',
      'Switch operating system',
      'Tour',
    ]) {
      await goTo(user, page);
      await check();
    }
  }, 30_000); // axe over all seven pages is slow on a loaded machine

  it('Personalization radio groups are native radios named by their card', async () => {
    const user = userEvent.setup();
    renderSettings();
    await goTo(user, 'Personalization');
    for (const name of ['Choose your mode', 'Windows colors', 'Taskbar alignment']) {
      const group = screen.getByRole('radiogroup', { name });
      for (const radio of within(group).getAllByRole('radio')) {
        expect(radio.tagName).toBe('INPUT');
        expect(radio).toHaveAccessibleName();
      }
    }
  });
});
