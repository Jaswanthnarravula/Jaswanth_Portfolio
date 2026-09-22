'use client';
/**
 * Terminal — the shared terminal engine in a macOS window (plans/macos/apps/terminal.md, `MAC-TERM-01…06`).
 *   · zsh voice: `jaswanth@MacBook-Pro ~ % `; title `jaswanth — -zsh — 80×24` with the live columns × rows;
 *   · profiles "Basic" (light) / "Pro" (dark) follow the theme; Bigger / Smaller text from the View menu;
 *   · a slim tab bar only once a second tab is open (max 2; the second tab is a fresh, unsaved session);
 *   · the engine is a lazy chunk; a static "Last login: …" line shows at once (`MAC-TERM-04`);
 *   · effects map to macOS: `open` launches the app that owns the content (the terminal stays open behind it),
 *     `open .` reveals the folder in Finder, `exit` closes the tab / window (`MAC-TERM-03`);
 *   · the first tab's cwd, history and capped scrollback persist with the macOS session (`MAC-TERM-05`);
 *   · Spotlight's "Run in Terminal" and the Help menu insert a command at the prompt — never execute it.
 * The accessibility contract is the shared one (TerminalView), identical to Linux (`MAC-TERM-06`).
 */
import { useEffect, useRef, useState } from 'react';
import { TerminalView, type TerminalViewHandle } from '@/components/os/shared/terminal/TerminalView';
import { windowId } from '@/lib/kernel/types';
import type { Effect } from '@/lib/terminal';
import { getKernel, dispatch, dispatchSoon } from '@/stores/kernel-store';
import { useAppCommands } from '../commands';
import { runTerminalEffect } from '../run-command';
import { setTerminalInsert, useMacUi } from '../ui';
import type { WindowBodyProps } from '../window/Window';
import app from './app.module.css';
import styles from './terminal.module.css';

const TEXT_SIZES = [11, 12, 13, 14, 16, 18, 20] as const;
const DEFAULT_SIZE = 2; // 13 px (plans/macos/apps/terminal.md "Anatomy")
const WINDOW_ID = windowId('macos', 'terminal');

interface Tab {
  readonly id: number;
  /** Only the first tab is the saved session; a second tab is fresh and forgotten on close. */
  readonly saved: boolean;
}

/** "Last login: Tue Sep 22 09:41:07 on ttys000" — the real Terminal's first line, from the visitor's clock. */
function lastLogin(now: Date): string {
  const day = now.toLocaleDateString('en-US', { weekday: 'short' });
  const month = now.toLocaleDateString('en-US', { month: 'short' });
  const date = String(now.getDate()).padStart(2, ' ');
  const time = now.toLocaleTimeString('en-GB', { hour12: false });
  return `Last login: ${day} ${month} ${date} ${time} on ttys000`;
}

export default function Terminal({ titleId, focused, compact }: WindowBodyProps) {
  // The saved session is read once: the view owns its live state, the kernel only records it.
  const [saved] = useState(() => getKernel().sessions.macos.terminal);
  const [firstLine] = useState(() => lastLogin(new Date()));
  const [tabs, setTabs] = useState<readonly Tab[]>([{ id: 1, saved: true }]);
  const [active, setActive] = useState(1);
  const [size, setSize] = useState({ cols: 80, rows: 24 });
  const [text, setText] = useState(DEFAULT_SIZE);
  const views = useRef(new Map<number, TerminalViewHandle | null>());
  const nextId = useRef(2);
  const insert = useMacUi((state) => state.terminalInsert);

  const current = () => views.current.get(active) ?? null;

  // A pending insert (Spotlight "Run in Terminal", tour hints): typed at the prompt, never run.
  useEffect(() => {
    if (insert === null) return;
    const view = views.current.get(active);
    if (!view) return;
    view.insert(insert);
    setTerminalInsert(null);
  }, [insert, active]);

  const closeTab = (id: number) => {
    if (tabs.length === 1) {
      dispatchSoon({ type: 'CLOSE_WINDOW', id: WINDOW_ID });
      return;
    }
    const rest = tabs.filter((tab) => tab.id !== id);
    setTabs(rest);
    if (active === id) setActive(rest[0]!.id);
    queueMicrotask(() => views.current.get(rest[0]!.id)?.focus());
  };

  const newTab = () => {
    if (tabs.length >= 2) {
      const other = tabs.find((tab) => tab.id !== active);
      if (other) setActive(other.id);
      return;
    }
    const id = nextId.current++;
    setTabs([...tabs, { id, saved: false }]);
    setActive(id);
  };

  useAppCommands('terminal', (command) => {
    const view = current();
    switch (command) {
      case 'new-tab':
        newTab();
        break;
      case 'close-tab':
        closeTab(active);
        break;
      case 'clear':
        view?.clear();
        view?.focus();
        break;
      case 'copy':
        void navigator.clipboard?.writeText(window.getSelection()?.toString() ?? '').catch(() => undefined);
        break;
      case 'paste':
        void navigator.clipboard
          ?.readText()
          .then((clip) => view?.insert(clip.split(/\r?\n/)[0] ?? ''))
          .catch(() => view?.focus());
        break;
      case 'select-all': {
        const output = document.querySelector(`[data-terminal-tab="${active}"] [data-scrollback]`);
        if (output) window.getSelection()?.selectAllChildren(output);
        break;
      }
      case 'bigger':
        setText((value) => Math.min(TEXT_SIZES.length - 1, value + 1));
        break;
      case 'smaller':
        setText((value) => Math.max(0, value - 1));
        break;
      case 'help':
        view?.insert('help');
        break;
    }
  });

  const onEffect = (tab: Tab) => (effect: Effect) => {
    if (effect.k === 'exit') {
      closeTab(tab.id);
      return;
    }
    if (effect.k === 'history-clear') {
      if (tab.saved) dispatch({ type: 'TERMINAL_CLEAR', os: 'macos', history: true });
      return;
    }
    if (effect.k === 'cd') {
      if (tab.saved) dispatchSoon({ type: 'TERMINAL_SET_CWD', os: 'macos', cwd: effect.to });
      return;
    }
    runTerminalEffect(effect);
  };

  const title = `jaswanth — -zsh — ${size.cols}×${size.rows}`;

  return (
    <div
      className={`${app.app} ${styles.terminal}`}
      data-body=""
      style={{ ['--term-size' as string]: `${TEXT_SIZES[text]}px` }}
    >
      <header className={styles.titlebar} data-drag-region="">
        <h2 id={titleId} className={styles.title}>
          <span className="sr-only">Terminal — </span>
          {title}
        </h2>
      </header>
      {tabs.length > 1 ? (
        <div className={styles.tabbar}>
          <div role="tablist" aria-label="Terminal tabs" className={styles.tabs}>
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`mac-term-tab-${tab.id}`}
                aria-selected={tab.id === active}
                aria-controls={`mac-term-panel-${tab.id}`}
                tabIndex={tab.id === active ? 0 : -1}
                onClick={() => setActive(tab.id)}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                  event.preventDefault();
                  const other = tabs[(index + 1) % tabs.length]!;
                  setActive(other.id);
                  event.currentTarget.parentElement
                    ?.querySelectorAll<HTMLElement>('[role="tab"]')
                    [(index + 1) % tabs.length]?.focus();
                }}
              >
                -zsh
              </button>
            ))}
          </div>
          <button type="button" className={styles.closeTab} aria-label="Close tab" onClick={() => closeTab(active)}>
            ×
          </button>
        </div>
      ) : null}
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={styles.panel}
          data-terminal-tab={tab.id}
          {...(tabs.length > 1
            ? {
                role: 'tabpanel',
                id: `mac-term-panel-${tab.id}`,
                'aria-labelledby': `mac-term-tab-${tab.id}`,
              }
            : {})}
          hidden={tab.id !== active || undefined}
        >
          <TerminalView
            ref={(handle) => {
              views.current.set(tab.id, handle);
            }}
            flavor="zsh"
            os="macos"
            session={tab.saved ? saved : null}
            firstLine={tab.saved ? firstLine : undefined}
            onEffect={onEffect(tab)}
            onRecord={
              tab.saved
                ? (command, output) => dispatchSoon({ type: 'TERMINAL_RECORD', os: 'macos', command, output })
                : undefined
            }
            onClear={tab.saved ? () => dispatchSoon({ type: 'TERMINAL_CLEAR', os: 'macos' }) : undefined}
            onSize={tab.id === active ? setSize : undefined}
            active={focused}
            focusOnMount={
              !compact && tab.id === active && typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches
            }
            accessory={compact}
          />
        </div>
      ))}
    </div>
  );
}
