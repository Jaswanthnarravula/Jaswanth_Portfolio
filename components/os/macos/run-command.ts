/**
 * `runMacCommand` — the one place macOS commands become kernel actions (menu-bar items, context menus, notification
 * actions, Spotlight results, the Control Center, Terminal effects). Commands are data (commands.ts); surfaces never
 * dispatch window actions of their own for these. Shell-owned behaviour (the compact window switcher, keyboard move /
 * size modes, the tour director) is reached through hooks the Shell registers while it is mounted.
 */
import { copyText, mailtoUrl } from '@/components/content';
import { resolveTarget } from '@/components/shell/KernelLink';
import type { ContentRef } from '@/data/schema';
import { getContact, getResume } from '@/data/selectors';
import { analytics } from '@/lib/analytics/loader';
import { recordEgg } from '@/lib/eggs';
import type { AppRole, OsId } from '@/lib/kernel/ids';
import { windowId, type AppLocation, type WindowId } from '@/lib/kernel/types';
import { goPath } from '@/lib/seo/metadata';
import type { Effect } from '@/lib/terminal';
import { dispatchSoon, getKernel } from '@/stores/kernel-store';
import { getPrefs } from '@/stores/prefs-store';
import { emitAppCommand, type MacCommand, type SettingsPane } from './commands';
import { openMailto, openPlain } from './hand-off';
import {
  closeOverlay,
  macUi,
  notify,
  openDialog,
  requestOverlay,
  setAppState,
  setLocked,
  setSpotlightQuery,
  setTerminalInsert,
} from './ui';

export interface MacShellHooks {
  /** Mission Control (expanded) or the compact window switcher. */
  readonly overview: () => void;
  /** Keyboard move / size mode on the focused window (`MAC-WM-09`). */
  readonly windowMode: (id: WindowId, mode: 'move' | 'size' | 'center' | 'tile-left' | 'tile-right' | 'fill') => void;
  readonly startTour: () => void;
  readonly selectAllDesktop: () => void;
  /** Replay the boot for fun (Apple menu → Restart…, after its confirm sheet). */
  readonly restart: () => void;
}

let hooks: MacShellHooks | null = null;

/** The Shell registers its hooks while mounted; returns the disposer. */
export function registerMacShellHooks(next: MacShellHooks): () => void {
  hooks = next;
  return () => {
    if (hooks === next) hooks = null;
  };
}

const MAC: OsId = 'macos';

function open(role: AppRole, location?: AppLocation, origin?: string | null): void {
  dispatchSoon({
    type: 'OPEN_APP',
    os: MAC,
    role,
    ...(location ? { location } : {}),
    originId: origin ?? null,
    invoker: origin ? origin : null,
  });
}

/** Open the app that owns a piece of content, at that content (Finder for Experience, GitHub for a project…). */
export function openRef(ref: ContentRef, origin?: string | null): void {
  const { role, location } = resolveTarget({ os: MAC, ref });
  open(role, location, origin);
}

export function openResume(origin?: string | null): void {
  openRef({ section: 'resume' }, origin);
}

/** Download the PDF (a real `<a download>` click), count it once, confirm with a banner (`MAC-PREV-03`). */
export function downloadResume(): void {
  const resume = getResume();
  const link = document.createElement('a');
  link.href = resume.file;
  link.download = resume.downloadName;
  link.type = 'application/pdf';
  document.body.append(link);
  link.click();
  link.remove();
  analytics.track({ name: 'resume_downloaded', os: MAC });
  notify({ kind: 'resume-downloaded' });
}

/** Copy a content's canonical link (`/go/*` — opens in any OS); a manual field is the fallback (the caller's). */
export async function copyLink(ref: ContentRef): Promise<'copied' | 'fallback'> {
  const url = `${window.location.origin}${goPath(ref)}`;
  const outcome = await copyText(url, navigator.clipboard);
  if (outcome === 'copied') notify({ kind: 'link-copied' });
  return outcome;
}

/** Count an egg once (identical for every visitor): `prefs.eggsFound` + one `egg_found` event. */
export function foundEgg(id: string): void {
  const next = recordEgg(getPrefs().eggsFound, id);
  if (!next) return;
  dispatchSoon({ type: 'SET_PREF', patch: { eggsFound: next } });
  analytics.track({ name: 'egg_found', id });
}

const focusedWindow = (): WindowId | null => getKernel().sessions.macos.focused;

export function openSettings(pane?: SettingsPane): void {
  if (pane) setAppState('settings:pane', pane);
  open('settings');
}

export function runMacCommand(command: MacCommand): void {
  const top = focusedWindow();
  switch (command.kind) {
    case 'open':
      open(command.role, command.location, command.origin);
      return;
    case 'open-ref':
      openRef(command.ref, command.origin);
      return;
    case 'resume-open':
      openResume(command.origin);
      return;
    case 'resume-download':
      downloadResume();
      return;
    case 'settings':
      openSettings(command.pane);
      return;
    case 'about-this-mac':
      openDialog({ kind: 'about-this-mac' });
      foundEgg('EGG-ABOUT-01');
      return;
    case 'switch-os':
      openDialog({ kind: 'switch-os' });
      return;
    case 'tour':
      hooks?.startTour();
      return;
    case 'tour-dismiss':
      dispatchSoon({ type: 'SET_PREF', patch: { tourOffered: true } });
      return;
    case 'lock':
      setLocked(true);
      return;
    case 'restart':
      openDialog({ kind: 'restart' });
      return;
    case 'restart-now':
      hooks?.restart();
      return;
    case 'about-app':
      openDialog({ kind: 'about-app', role: command.role });
      return;
    case 'hide-app': {
      const id = windowId(MAC, command.role);
      if (getKernel().sessions.macos.windows[id]) dispatchSoon({ type: 'MINIMIZE', id });
      return;
    }
    case 'hide-others':
      if (top) dispatchSoon({ type: 'HIDE_OTHERS', id: top });
      return;
    case 'show-all':
      dispatchSoon({ type: 'SHOW_ALL', os: MAC });
      return;
    case 'quit':
      dispatchSoon({ type: 'QUIT_APP', role: command.role, os: MAC });
      return;
    case 'close-window':
      if (top) dispatchSoon({ type: 'CLOSE_WINDOW', id: top });
      return;
    case 'minimize':
      if (top) dispatchSoon({ type: 'MINIMIZE', id: top });
      return;
    case 'zoom':
      if (top) dispatchSoon({ type: 'TOGGLE_MAXIMIZE', id: top });
      return;
    case 'move':
    case 'size':
    case 'center':
      if (top) hooks?.windowMode(top, command.kind);
      return;
    case 'tile':
      if (top) hooks?.windowMode(top, command.side === 'fill' ? 'fill' : `tile-${command.side}`);
      return;
    case 'focus-window':
      dispatchSoon({ type: 'FOCUS_WINDOW', id: command.id });
      return;
    case 'mission-control':
      hooks?.overview();
      return;
    case 'shortcuts':
      openDialog({ kind: 'shortcuts' });
      return;
    case 'plain':
      openPlain();
      return;
    case 'spotlight':
      if (requestOverlay('spotlight')) setSpotlightQuery(command.query ?? '');
      return;
    case 'notification-center':
      if (macUi.getState().overlay === 'notification-center') closeOverlay('notification-center');
      else requestOverlay('notification-center');
      return;
    case 'control-center':
      if (macUi.getState().overlay === 'control-center') closeOverlay('control-center');
      else requestOverlay('control-center');
      return;
    case 'copy-link':
      void copyLink(command.ref);
      return;
    case 'get-info':
      openDialog({ kind: 'get-info', ref: command.ref });
      return;
    case 'quick-look':
      openDialog({ kind: 'quick-look', ref: command.ref, origin: command.origin ?? null });
      return;
    case 'terminal-insert':
      // Inserted at the prompt, never executed (MAC-SPOT-04): the Terminal picks it up when it mounts or is open.
      setTerminalInsert(command.command);
      open('terminal');
      return;
    case 'select-all-desktop':
      hooks?.selectAllDesktop();
      return;
    case 'app':
      emitAppCommand(command.role, command.command, command.arg);
      return;
    default: {
      const exhaustive: never = command;
      return exhaustive;
    }
  }
}

/** Where a Terminal (the app, or VS Code's panel) sends engine effects it does not handle itself. */
export function runTerminalEffect(effect: Effect): void {
  switch (effect.k) {
    case 'open':
      if (effect.ref === 'resume') openResume();
      else openRef(effect.ref);
      return;
    case 'reveal': {
      // `open .` / `open experience/`: the folder in Finder (its own sections), or the app that owns it.
      const ref = effect.ref;
      if (!ref) open('files');
      else openRef(ref);
      return;
    }
    case 'download':
      downloadResume();
      return;
    case 'mailto':
      analytics.track({ name: 'contact_initiated', channel: 'mailto' });
      openMailto(mailtoUrl({ email: getContact().email, subject: effect.subject }));
      return;
    case 'egg':
      foundEgg(effect.id);
      return;
    case 'switch-os':
      if (effect.to) dispatchSoon({ type: 'SWITCH_OS', to: effect.to, via: 'switch' });
      else openDialog({ kind: 'switch-os' });
      return;
    case 'tour':
      hooks?.startTour();
      return;
    case 'plain':
      return;
    case 'pref':
      // The engine names a preference and a value; only known keys are applied (never an arbitrary patch).
      applyTerminalPref(effect.key, effect.value);
      return;
    case 'exit':
    case 'cd':
    case 'clear':
    case 'pager':
    case 'history-clear':
      return; // the host view / app handles these
    default: {
      const exhaustive: never = effect;
      return exhaustive;
    }
  }
}

function applyTerminalPref(key: string, value: unknown): void {
  if (key === 'theme' && (value === 'system' || value === 'light' || value === 'dark'))
    dispatchSoon({ type: 'SET_PREF', patch: { theme: value } });
  else if (key === 'motion' && (value === 'system' || value === 'reduced' || value === 'full'))
    dispatchSoon({ type: 'SET_PREF', patch: { motion: value } });
  else if (key === 'glass' && (value === 'system' || value === 'solid' || value === 'full'))
    dispatchSoon({ type: 'SET_PREF', patch: { glass: value } });
}
