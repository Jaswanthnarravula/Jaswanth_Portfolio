'use client';
/**
 * Windows Terminal — plans/windows/apps/windows-terminal.md (`WIN-TERM-01…07`). The shared engine (lib/terminal, a lazy
 * chunk) inside the shared host (TerminalView — the Linux terminal contract: a labelled input, a readable scrollback, a
 * separate log announcer, Tab never a trap), skinned and wired the Windows way:
 *   · the title bar (Mica, tall) holds an APG tablist — "Windows PowerShell" · "+" · ▾ profiles (Windows PowerShell ·
 *     Command Prompt · Ubuntu). Each tab is a fresh session, at most 3; the first binds to the kernel's Windows terminal
 *     session (history, cwd and scrollback persist with it), the others are local. Closing the last tab — or `exit` in
 *     it — closes the window. Tabs open and close in 167 ms; Delete closes the focused tab (`WIN-TERM-01`).
 *   · the body is Acrylic — one live blur, which the shell's budget can drop to its tint (`data-terminal-acrylic`), solid
 *     on tier 0 / solid glass — in Campbell colours, Cascadia at 14 px; Command Prompt swaps the prompt and colours.
 *   · what is typed passes through the Windows adapter (lib/terminal/powershell: `\` paths, `dir` / `type` / `cls` /
 *     `start` / `ii` / `Get-Help`; `winver` opens the About dialog — `WIN-TERM-02/03`); the engine's effects open the
 *     Windows app that owns the content (`start resume` → Edge's PDF tab — `WIN-TERM-05`) through `effectOutcomes`.
 *   · Ubuntu never switches silently: a modal confirm, then `SWITCH_OS` to Linux (`WIN-TERM-07`).
 *   · Search's "Run in Terminal" and the tour *insert* a command at the prompt — never executed.
 *   · coarse pointers get the shared accessory key row (hidden after a hardware key) plus a `\` key.
 * Terminal behaviour comes only from lib/terminal and TerminalView (`WIN-TERM-06`); the native context menu is never
 * overridden here.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { mailtoUrl } from '@/components/content/contact-actions';
import { TerminalView, type AccessoryKey, type TerminalViewHandle } from '@/components/os/shared/terminal/TerminalView';
import { FocusScope } from '@/components/primitives/FocusScope';
import type { ContentRef } from '@/data/schema';
import { getContact, getResume } from '@/data/selectors';
import type { AnalyticsEvent } from '@/lib/analytics/events';
import { analytics } from '@/lib/analytics/loader';
import { recordEgg } from '@/lib/eggs';
import type { KernelAction } from '@/lib/kernel/actions';
import type { AppRole } from '@/lib/kernel/ids';
import { parsePrefs } from '@/lib/kernel/persist/prefs';
import type { Json } from '@/lib/kernel/persist/validate';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import type { UserPreferences } from '@/lib/kernel/types';
import { dur, EASE } from '@/lib/motion/dur';
import type { Effect, VfsPath } from '@/lib/terminal';
import { commandPromptFor, powershellPromptFor, toEngineInput } from '@/lib/terminal/powershell';
import { useKernel } from '@/stores/kernel-context';
import { dispatchSoon, getKernel } from '@/stores/kernel-store';
import { getPrefs } from '@/stores/prefs-store';
import { flDismiss } from '../fluent.generated';
import { flAdd, flChevronDown, flConsole } from '../fluent.apps.generated';
import { Fl } from '../icons';
import { subscribeIntents, takeIntent } from '../intents';
import { useWinShell, type ToastSpec, type WinShellServices } from '../shell-context';
import { downloadToast } from '../slots';
import { TitleBar, type WindowBodyProps } from '../window/Window';
import styles from './terminal.module.css';

/** At most three tabs (plans/windows/apps/windows-terminal "Behaviour"). */
export const MAX_TABS = 3;
/** Tab open / close (plans/windows/apps/windows-terminal "Motion"). */
const TAB_MS = 167;

type Profile = 'powershell' | 'cmd';

const PROFILES: Readonly<Record<Profile, { title: string; banner: string; prompt: (cwd: VfsPath) => string }>> = {
  powershell: {
    title: 'Windows PowerShell',
    banner: 'Windows PowerShell\n\nGet-Help lists every command. Try dir, or start resume.\n',
    prompt: powershellPromptFor,
  },
  cmd: {
    title: 'Command Prompt',
    banner: 'Microsoft Windows [Version 10.0.26100]\n\nhelp lists every command. Try dir, or start resume.\n',
    prompt: commandPromptFor,
  },
};

interface Tab {
  readonly key: number;
  readonly profile: Profile;
  /** Bound to the kernel's Windows terminal session (the first tab); the others are local and fresh. */
  readonly primary: boolean;
}

interface StripState {
  readonly tabs: readonly Tab[];
  readonly active: number;
  /** Tabs fading out (167 ms) before they leave the strip: they no longer count as open. */
  readonly fading: ReadonlySet<number>;
}

const FIRST: StripState = { tabs: [{ key: 0, profile: 'powershell', primary: true }], active: 0, fading: new Set() };
const openOf = (strip: StripState) => strip.tabs.filter((tab) => !strip.fading.has(tab.key));

// --- Effects → Windows (pure) ------------------------------------------------------------------------------------------

/** What an engine effect asks of the Windows shell; `effectOutcomes` is pure, the Terminal performs the outcomes. */
export type TerminalOutcome =
  | { readonly kind: 'dispatch'; readonly action: KernelAction }
  | { readonly kind: 'track'; readonly event: AnalyticsEvent }
  | { readonly kind: 'mailto'; readonly href: string }
  | { readonly kind: 'download' }
  | { readonly kind: 'tour' }
  | { readonly kind: 'close-tab' };

/** Preferences a command may change (never the kernel's own bookkeeping: persona, last OS, eggs, demotion). */
const TERMINAL_PREFS = [
  'sound',
  'motion',
  'glass',
  'theme',
  'singleKeyShortcuts',
  'taskbarAlign',
  'accent',
  'textScale',
  'contrast',
  'notifications',
  'wallpaper',
] as const satisfies readonly (keyof UserPreferences)[];

type PrefPatch = Partial<Omit<UserPreferences, 'v'>>;

/** A `pref` effect → a SET_PREF patch, when the key is a known preference and the value is valid for it. */
export function prefPatch(key: string, value: unknown, prefs: UserPreferences): PrefPatch | null {
  const pref = TERMINAL_PREFS.find((name) => name === key);
  if (!pref) return null;
  const parsed = parsePrefs({ ...prefs, [pref]: value } as unknown as Json)[pref];
  return JSON.stringify(parsed) === JSON.stringify(value) ? ({ [pref]: parsed } as PrefPatch) : null;
}

const ownerOf = (ref: ContentRef): AppRole => OS_REGISTRY.windows.sectionOwner[ref.section];

const openIn = (role: AppRole, ref: ContentRef | null): KernelAction => ({
  type: 'OPEN_APP',
  os: 'windows',
  role,
  location: ref ? { kind: 'content', ref } : { kind: 'root' },
});

const dispatchOf = (action: KernelAction): TerminalOutcome => ({ kind: 'dispatch', action });

/**
 * The Windows meaning of each engine effect (`WIN-TERM-05`): content opens in the Windows app that owns it (`resume` →
 * Edge's PDF tab, a project → GitHub, a role → File Explorer); a folder opens File Explorer (or its section's owner);
 * `mail` hands off to `mailto:`; an egg counts once. Only the first tab writes the kernel's terminal session.
 */
export function effectOutcomes(
  effect: Effect,
  context: { readonly primary: boolean; readonly prefs: UserPreferences },
): readonly TerminalOutcome[] {
  switch (effect.k) {
    case 'cd':
      return context.primary ? [dispatchOf({ type: 'TERMINAL_SET_CWD', os: 'windows', cwd: effect.to })] : [];
    case 'open': {
      const ref: ContentRef = effect.ref === 'resume' ? { section: 'resume' } : effect.ref;
      return [dispatchOf(openIn(ownerOf(ref), ref))];
    }
    case 'reveal':
      return [dispatchOf(openIn(effect.ref ? ownerOf(effect.ref) : 'files', effect.ref))];
    case 'mailto': {
      const email = getContact().email;
      return [
        { kind: 'mailto', href: mailtoUrl(effect.subject ? { email, subject: effect.subject } : { email }) },
        { kind: 'track', event: { name: 'contact_initiated', channel: 'mailto' } },
      ];
    }
    case 'download':
      return [{ kind: 'download' }];
    case 'switch-os':
      return [dispatchOf({ type: 'SWITCH_OS', to: effect.to ?? null, via: 'switch' })];
    case 'pref': {
      const patch = prefPatch(effect.key, effect.value, context.prefs);
      return patch ? [dispatchOf({ type: 'SET_PREF', patch })] : [];
    }
    case 'tour':
      return [{ kind: 'tour' }];
    case 'egg': {
      const found = recordEgg(context.prefs.eggsFound, effect.id);
      return found
        ? [
            dispatchOf({ type: 'SET_PREF', patch: { eggsFound: found } }),
            { kind: 'track', event: { name: 'egg_found', id: effect.id } },
          ]
        : [];
    }
    case 'exit':
      return [{ kind: 'close-tab' }];
    // `history -c` also empties the saved history (first tab only); the view clears and pages itself.
    case 'history-clear':
      return context.primary ? [dispatchOf({ type: 'TERMINAL_CLEAR', os: 'windows', history: true })] : [];
    case 'clear':
    case 'pager':
      return [];
  }
}

/** `resume --download`: the résumé view's own download link when one is on screen, else a temporary `<a download>`. */
function downloadResume(notify: (toast: ToastSpec) => void) {
  const existing = document.querySelector<HTMLAnchorElement>('a[data-resume-download]');
  if (existing) {
    existing.click(); // records `resume_downloaded` and raises the toast itself
    return;
  }
  const resume = getResume();
  const link = document.createElement('a');
  link.href = resume.file;
  link.download = resume.downloadName;
  link.type = 'application/pdf';
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  analytics.track({ name: 'resume_downloaded', os: 'windows' });
  notify(downloadToast(resume.downloadName));
}

/** The shared accessory row (plans/linux/10 `LNX-RESP-04`) plus the `\` key Windows paths need. */
const BACKSLASH_KEY: readonly AccessoryKey[] = [{ id: 'backslash', glyph: '\\', label: 'Backslash', text: '\\' }];

// --- The app -------------------------------------------------------------------------------------------------------------

type PendingFocus = { readonly key: number; readonly target: 'tab' | 'prompt' } | { readonly target: 'profiles' };

export default function Terminal({ window: win, titleId, focused, compact }: WindowBodyProps) {
  const shell = useWinShell();
  const coarse = useKernel((state) => state.capabilities.pointer === 'coarse');
  const [view, setView] = useState<StripState>(FIRST);
  const [confirming, setConfirming] = useState(false);
  // The kernel's session seeds the first tab once (TerminalView reads it on mount only).
  const [session] = useState(() => getKernel().sessions.windows.terminal);

  /** The strip as handlers see it: updated synchronously, so two presses within one frame count correctly. */
  const model = useRef<StripState>(FIRST);
  const services = useRef({ shell, coarse, focused });
  useLayoutEffect(() => {
    services.current = { shell, coarse, focused };
  });
  const nextKey = useRef(1);
  const strip = useRef<HTMLDivElement>(null);
  const profilesButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const handles = useRef(new Map<number, TerminalViewHandle>());
  const panels = useRef(new Map<number, HTMLDivElement>());
  const fadeOuts = useRef(new Map<number, Animation>());
  const pendingFocus = useRef<PendingFocus | null>(null);

  const update = (next: StripState) => {
    model.current = next;
    setView(next);
  };
  const tabElement = (key: number) => strip.current?.querySelector<HTMLElement>(`[data-tab-key="${key}"]`) ?? null;

  // Arrival: the prompt takes focus on fine pointers (plans/linux/11 "Focus"); a coarse pointer never pops the keyboard.
  useLayoutEffect(() => {
    if (services.current.focused && !services.current.coarse) handles.current.get(FIRST.active)?.focus();
  }, []);

  // Focus lands after the render that shows its target (a hidden panel's prompt cannot take focus); never on <body>.
  useLayoutEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    if (pending.target === 'profiles') profilesButton.current?.focus({ preventScroll: true });
    else if (pending.target === 'tab') tabElement(pending.key)?.focus({ preventScroll: true });
    else handles.current.get(pending.key)?.focus();
  });

  const commitClose = (key: number) => {
    fadeOuts.current.delete(key);
    const current = model.current;
    const fading = new Set(current.fading);
    fading.delete(key);
    update({ ...current, tabs: current.tabs.filter((tab) => tab.key !== key), fading });
  };

  /** Finish every fading tab now (a new tab must count only the tabs that are really open). */
  const settleFadeOuts = () => {
    for (const [key, animation] of [...fadeOuts.current]) {
      animation.onfinish = null;
      animation.cancel();
      commitClose(key);
    }
  };

  const closeTab = (key: number, how: 'pointer' | 'keyboard' | 'exit') => {
    const current = model.current;
    const open = openOf(current);
    const index = open.findIndex((tab) => tab.key === key);
    if (index < 0) return;
    const remaining = open.filter((tab) => tab.key !== key);
    if (remaining.length === 0) {
      settleFadeOuts();
      dispatchSoon({ type: 'CLOSE_WINDOW', id: win.id });
      return;
    }
    // The neighbour becomes active at once (input wins); the closed tab only fades out.
    const next = current.active === key ? remaining[Math.min(index, remaining.length - 1)]!.key : current.active;
    // Delete keeps the keyboard in the tab strip (APG); a click or `exit` continues at the active prompt.
    pendingFocus.current = { key: next, target: how === 'keyboard' || services.current.coarse ? 'tab' : 'prompt' };
    const element = tabElement(key);
    const ms = dur(TAB_MS);
    if (!element || ms === 0 || typeof element.animate !== 'function') {
      update({ ...current, active: next });
      commitClose(key);
      return;
    }
    const animation = element.animate(
      [
        { opacity: 1, transform: 'none' },
        { opacity: 0, transform: 'translateY(4px)' },
      ],
      { duration: ms, easing: EASE.winExit, fill: 'forwards' },
    );
    fadeOuts.current.set(key, animation);
    animation.onfinish = () => commitClose(key);
    update({ ...current, active: next, fading: new Set([...current.fading, key]) });
  };

  const addTab = (profile: Profile) => {
    settleFadeOuts();
    const current = model.current;
    if (openOf(current).length >= MAX_TABS) return;
    const key = nextKey.current++;
    update({ ...current, tabs: [...current.tabs, { key, profile, primary: false }], active: key });
    pendingFocus.current = { key, target: services.current.coarse ? 'tab' : 'prompt' };
  };

  const select = (key: number) => {
    update({ ...model.current, active: key });
    pendingFocus.current = { key, target: services.current.coarse ? 'tab' : 'prompt' };
  };

  // APG tabs: arrows / Home / End move and activate (the panels are already rendered); Delete closes the focused tab.
  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, key: number) => {
    const open = openOf(model.current);
    const index = Math.max(
      0,
      open.findIndex((tab) => tab.key === key),
    );
    let target: number;
    switch (event.key) {
      case 'ArrowRight':
        target = (index + 1) % open.length;
        break;
      case 'ArrowLeft':
        target = (index - 1 + open.length) % open.length;
        break;
      case 'Home':
        target = 0;
        break;
      case 'End':
        target = open.length - 1;
        break;
      case 'Delete':
        event.preventDefault();
        closeTab(key, 'keyboard');
        return;
      default:
        return;
    }
    event.preventDefault();
    const next = open[target]!.key;
    update({ ...model.current, active: next });
    pendingFocus.current = { key: next, target: 'tab' };
  };

  const openProfiles = (button: HTMLButtonElement) => {
    const box = button.getBoundingClientRect();
    const full = openOf(model.current).length >= MAX_TABS;
    shell.openMenu({
      label: 'Profiles',
      at: { x: box.left, y: box.bottom + 2 },
      returnFocusTo: button,
      items: [
        {
          kind: 'item',
          id: 'powershell',
          label: PROFILES.powershell.title,
          icon: <Fl icon={flConsole} className={styles.powershellGlyph} />,
          disabled: full,
          onSelect: () => addTab('powershell'),
        },
        {
          kind: 'item',
          id: 'cmd',
          label: PROFILES.cmd.title,
          icon: <Fl icon={flConsole} />,
          disabled: full,
          onSelect: () => addTab('cmd'),
        },
        { kind: 'item', id: 'ubuntu', label: 'Ubuntu', onSelect: () => setConfirming(true) },
      ],
    });
  };

  // Ubuntu: a modal confirm (focus starts on Cancel; Esc cancels; focus returns to the profiles button).
  const endConfirm = useCallback((choice: 'switch' | 'cancel') => {
    setConfirming(false);
    pendingFocus.current = { target: 'profiles' };
    if (choice === 'switch') dispatchSoon({ type: 'SWITCH_OS', to: 'linux', via: 'switch' });
  }, []);
  useEffect(() => {
    const node = dialog.current;
    if (!confirming || !node) return;
    cancelButton.current?.focus({ preventScroll: true });
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      endConfirm('cancel');
    };
    node.addEventListener('keydown', onKey);
    return () => node.removeEventListener('keydown', onKey);
  }, [confirming, endConfirm]);

  // "Run in Terminal" (Search) and tour hints insert into the active tab — never executed.
  useEffect(() => {
    const insert = (command: string) => handles.current.get(model.current.active)?.insert(command);
    const pending = takeIntent('terminal-insert');
    if (pending) insert(pending.command);
    return subscribeIntents((intent) => {
      if (intent.kind !== 'terminal-insert') return;
      takeIntent('terminal-insert');
      insert(intent.command);
    });
  }, []);

  const transform = useCallback((raw: string) => {
    const input = toEngineInput(raw);
    if (input.winver) services.current.shell.openWinver();
    return input.line;
  }, []);
  const record = useCallback(
    (command: string, output: readonly string[]) =>
      dispatchSoon({ type: 'TERMINAL_RECORD', os: 'windows', command, output }),
    [],
  );
  const clear = useCallback(() => dispatchSoon({ type: 'TERMINAL_CLEAR', os: 'windows' }), []);

  const perform = (tab: Tab, outcome: TerminalOutcome, host: WinShellServices) => {
    switch (outcome.kind) {
      case 'dispatch':
        dispatchSoon(outcome.action);
        return;
      case 'track':
        analytics.track(outcome.event);
        return;
      case 'mailto':
        window.location.assign(outcome.href);
        return;
      case 'download':
        downloadResume(host.notify);
        return;
      case 'tour':
        host.startTour();
        return;
      case 'close-tab':
        closeTab(tab.key, 'exit');
        return;
    }
  };

  const { tabs, active, fading } = view;
  const full = openOf(view).length >= MAX_TABS;
  const shown = tabs.find((tab) => tab.key === active) ?? tabs[0]!;
  const tabId = (key: number) => `${titleId}-tab-${key}`;
  const panelId = (key: number) => `${titleId}-panel-${key}`;

  return (
    <>
      <TitleBar tall>
        <div ref={strip} className={styles.strip} inert={confirming || undefined}>
          <div role="tablist" aria-label="Terminal tabs" className={styles.tablist}>
            {tabs.map((tab) => {
              const selected = tab.key === active;
              const title = PROFILES[tab.profile].title;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  id={tabId(tab.key)}
                  className={styles.tab}
                  aria-selected={selected}
                  aria-controls={panelId(tab.key)}
                  aria-keyshortcuts="Delete"
                  tabIndex={selected ? 0 : -1}
                  title={title}
                  data-tab-key={tab.key}
                  data-profile={tab.profile}
                  data-new={tab.key === 0 ? undefined : ''}
                  // A closing tab fades out (167 ms): already gone for assistive tech and input.
                  inert={fading.has(tab.key) || undefined}
                  aria-hidden={fading.has(tab.key) || undefined}
                  onClick={(event) => {
                    if ((event.target as Element).closest('[data-tab-close]')) closeTab(tab.key, 'pointer');
                    else select(tab.key);
                  }}
                  onAuxClick={(event) => {
                    if (event.button === 1) closeTab(tab.key, 'pointer'); // middle-click closes, as in Windows Terminal
                  }}
                  onKeyDown={(event) => onTabKey(event, tab.key)}
                >
                  <Fl icon={flConsole} className={styles.tabGlyph} />
                  <span className={styles.tabLabel}>{title}</span>
                  <span className={styles.tabClose} data-tab-close="" aria-hidden="true">
                    <Fl icon={flDismiss} size={12} />
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className={styles.stripButton}
            aria-label="New tab"
            title="New tab"
            disabled={full}
            onClick={() => addTab('powershell')}
          >
            <Fl icon={flAdd} size={16} />
          </button>
          <button
            ref={profilesButton}
            type="button"
            className={`${styles.stripButton} ${styles.profiles}`}
            aria-label="Profiles"
            aria-haspopup="menu"
            title="Open a profile"
            onClick={(event) => openProfiles(event.currentTarget)}
          >
            <Fl icon={flChevronDown} size={12} />
          </button>
        </div>
      </TitleBar>
      <div className={styles.body} data-profile={shown.profile} data-compact={compact || undefined} data-acrylic="">
        {tabs.map((tab) => {
          const selected = tab.key === shown.key;
          return (
            <div
              key={tab.key}
              ref={(node) => {
                if (node) panels.current.set(tab.key, node);
                else panels.current.delete(tab.key);
              }}
              role="tabpanel"
              id={panelId(tab.key)}
              aria-labelledby={tabId(tab.key)}
              className={styles.panel}
              data-profile={tab.profile}
              hidden={!selected}
            >
              <TerminalView
                ref={(handle) => {
                  if (handle) handles.current.set(tab.key, handle);
                  else handles.current.delete(tab.key);
                }}
                flavor="powershell"
                os="windows"
                session={tab.primary ? session : null}
                promptFor={PROFILES[tab.profile].prompt}
                firstLine={PROFILES[tab.profile].banner}
                inputTransform={transform}
                accessory
                accessoryExtra={BACKSLASH_KEY}
                onEffect={(effect) => {
                  for (const outcome of effectOutcomes(effect, { primary: tab.primary, prefs: getPrefs() }))
                    perform(tab, outcome, services.current.shell);
                }}
                onRecord={tab.primary ? record : undefined}
                onClear={tab.primary ? clear : undefined}
                active={focused && selected}
                className={styles.view}
              />
            </div>
          );
        })}
        {confirming ? (
          <div className={styles.smoke}>
            <FocusScope trapped>
              <div
                ref={dialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${titleId}-switch-title`}
                aria-describedby={`${titleId}-switch-body`}
                className={styles.dialog}
              >
                <div className={styles.dialogContent}>
                  <h3 id={`${titleId}-switch-title`} className={styles.dialogTitle}>
                    Switch to the Linux experience?
                  </h3>
                  <p id={`${titleId}-switch-body`} className={styles.dialogBody}>
                    Ubuntu is its own operating system here — the whole portfolio as a Linux shell. You can come back to
                    Windows at any time.
                  </p>
                </div>
                <div className={styles.dialogCommands}>
                  <button
                    type="button"
                    className={`${styles.button} ${styles.primary}`}
                    onClick={() => endConfirm('switch')}
                  >
                    Switch
                  </button>
                  <button
                    ref={cancelButton}
                    type="button"
                    className={styles.button}
                    onClick={() => endConfirm('cancel')}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </FocusScope>
          </div>
        ) : null}
      </div>
    </>
  );
}
