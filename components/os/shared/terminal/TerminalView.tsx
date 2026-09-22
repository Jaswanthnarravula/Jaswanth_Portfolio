'use client';
/**
 * TerminalView — the host for the shared terminal engine (`lib/terminal`), used by the macOS Terminal app (plans/macos/
 * apps/terminal.md) and the Windows Terminal app; each OS maps the engine's effects to its own kernel actions and skins
 * it with CSS variables. Accessibility is the Linux contract (plans/linux/11, shared/09 "Terminal"):
 *   · a labelled native `<input>` in a `<form>` ("Command, current directory ~/projects"); the visual prompt is hidden
 *     from assistive tech; typing is never blocked (commands entered while the engine chunk loads run when it lands);
 *   · the scrollback is a labelled, focusable region of ordinary text (an imperative DOM list — zero React renders per
 *     line); tappable entries are buttons that insert, never execute;
 *   · a separate visually hidden `role="log"` announcer receives each output's final text synchronously (summarised
 *     past 10 lines); the visitor's own echo is not announced;
 *   · Tab completes only with a non-empty token and candidates — empty input lets Tab move focus; Esc then Tab always
 *     leaves; Ctrl+C cancels only when no text is selected (otherwise the browser copies); the native context menu is
 *     never overridden.
 * Output lines arrive with the capped reveal (≤ 240 ms) that any input completes; the view stays pinned to the bottom
 * unless the visitor scrolled up, in which case a "↓ new output" chip appears.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';
import type { OsId } from '@/lib/kernel/ids';
import type { Completion, Effect, Execution, Flavor, Line, ShellState, Terminal, VfsPath } from '@/lib/terminal';
// Only the dependency-free helpers are imported statically; the engine itself is a lazy chunk (`MAC-TERM-04`).
import { cursorAt, newer, older, record, reverseSearch, type HistoryCursor } from '@/lib/terminal/history';
import { controlAction, editLine, INPUT_CAP, trimPaste } from '@/lib/terminal/line-editing';
import { prefersReducedMotion } from '@/lib/motion/dur';
import { Pager } from './Pager';
import { revealLines, type Reveal } from './reveal';
import { announcement, appendBlock } from './scrollback';
import styles from './terminal.module.css';

export interface TerminalSessionSnapshot {
  readonly cwd: readonly string[];
  readonly history: readonly string[];
  readonly scrollback: readonly string[];
}

export interface TerminalViewHandle {
  /** Put a command at the prompt, unsubmitted (Spotlight's "Run in Terminal", tour hints). */
  insert(command: string): void;
  focus(): void;
  /** Clear the scrollback (a menu's "Clear to Start" — the same as Ctrl+L). */
  clear(): void;
}

export interface TerminalViewProps {
  readonly flavor: Flavor;
  readonly os: OsId;
  readonly session: TerminalSessionSnapshot | null;
  /** The prompt string for a cwd (defaults to the engine's own voice). */
  readonly promptFor?: (cwd: VfsPath) => string;
  /** Shown at once, before the engine chunk arrives (e.g. "Last login: …"). */
  readonly firstLine?: string;
  /** Rewrite a submitted line before the engine sees it (e.g. Windows `\` paths). The echo shows what was typed. */
  readonly inputTransform?: (line: string) => string;
  /** Every effect the view does not handle itself (it handles clear, pager and history-clear). */
  readonly onEffect: (effect: Effect) => void;
  /** Persistence: a command ran (its echo + output as plain text). */
  readonly onRecord?: (command: string, output: readonly string[]) => void;
  readonly onClear?: () => void;
  readonly onSize?: (size: { cols: number; rows: number }) => void;
  /** The window holding it is focused (caret solid) or not (hollow). */
  readonly active?: boolean;
  /** Focus the prompt on mount (fine pointers only — callers decide). */
  readonly focusOnMount?: boolean;
  /** The same as `focusOnMount` (kept for existing callers). */
  readonly autoFocus?: boolean;
  /**
   * Show the accessory key row (Tab · arrows · / ~ - | · Ctrl+C · Esc · Enter) above an on-screen keyboard: coarse
   * pointer + focused prompt, hidden after a physical key press until the next focus (linux/10 `LNX-RESP-03`).
   */
  readonly accessory?: boolean;
  /** Extra text keys for the accessory row, placed after `|` (Windows Terminal adds the backslash). */
  readonly accessoryExtra?: readonly AccessoryKey[];
  readonly className?: string;
  /** Test seam: how the engine chunk is loaded. */
  readonly loadEngine?: (flavor: Flavor, os: OsId) => Promise<Terminal>;
}

export const loadTerminalEngine = async (flavor: Flavor, os: OsId): Promise<Terminal> => {
  const [{ createTerminal }, { selectorsTerminalData }] = await Promise.all([
    import('@/lib/terminal'),
    import('@/lib/terminal/from-selectors'),
  ]);
  return createTerminal({ data: selectorsTerminalData(), flavor, os });
};

const HOME: VfsPath = ['home', 'jaswanth'];

/** `/home/jaswanth/projects` → `~/projects` (the input's accessible name). */
const tildePath = (path: VfsPath): string =>
  HOME.every((part, i) => path[i] === part)
    ? path.length === HOME.length
      ? '~'
      : `~/${path.slice(HOME.length).join('/')}`
    : `/${path.join('/')}`;
const LINE_HEIGHT = 1.35;

export interface AccessoryKey {
  readonly id: string;
  readonly glyph: string;
  readonly label: string;
  readonly key?: string;
  readonly ctrl?: boolean;
  readonly text?: string;
}

/** linux/10 `LNX-RESP-03`: the row above the keyboard, left → right (Enter repeated for one-handed use). */
export const ACCESSORY_KEYS: readonly AccessoryKey[] = [
  { id: 'tab', glyph: 'Tab', label: 'Tab (complete)', key: 'Tab' },
  { id: 'up', glyph: '↑', label: 'Previous command', key: 'ArrowUp' },
  { id: 'down', glyph: '↓', label: 'Next command', key: 'ArrowDown' },
  { id: 'left', glyph: '←', label: 'Cursor left' },
  { id: 'right', glyph: '→', label: 'Cursor right' },
  { id: 'slash', glyph: '/', label: 'Slash', text: '/' },
  { id: 'tilde', glyph: '~', label: 'Tilde', text: '~' },
  { id: 'dash', glyph: '-', label: 'Dash', text: '-' },
  { id: 'pipe', glyph: '|', label: 'Pipe', text: '|' },
  { id: 'ctrl-c', glyph: 'Ctrl+C', label: 'Cancel the line (Ctrl+C)', key: 'c', ctrl: true },
  { id: 'escape', glyph: 'Esc', label: 'Escape', key: 'Escape' },
  { id: 'enter', glyph: 'Enter', label: 'Enter (run)' },
];

/** The row with a host's extra text keys placed after the pipe. */
const withExtra = (extra: readonly AccessoryKey[] | undefined): readonly AccessoryKey[] => {
  if (!extra?.length) return ACCESSORY_KEYS;
  const at = ACCESSORY_KEYS.findIndex((key) => key.id === 'pipe') + 1;
  return [...ACCESSORY_KEYS.slice(0, at), ...extra, ...ACCESSORY_KEYS.slice(at)];
};

function initialState(session: TerminalSessionSnapshot | null): ShellState {
  return {
    cwd: session?.cwd.length ? session.cwd : HOME,
    oldpwd: null,
    lastExit: 0,
    history: session?.history ?? [],
  };
}

export const TerminalView = forwardRef<TerminalViewHandle, TerminalViewProps>(function TerminalView(
  {
    flavor,
    os,
    session,
    promptFor,
    firstLine,
    inputTransform,
    onEffect,
    onRecord,
    onClear,
    onSize,
    active = true,
    focusOnMount: focusOnMountProp,
    autoFocus = false,
    accessory = false,
    accessoryExtra,
    className,
    loadEngine = loadTerminalEngine,
  },
  handle,
) {
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const announcer = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const caret = useRef<HTMLSpanElement>(null);
  const mirror = useRef<HTMLSpanElement>(null);
  const measure = useRef<HTMLSpanElement>(null);

  const engine = useRef<Terminal | null>(null);
  const shell = useRef<ShellState>(initialState(session));
  const queue = useRef<string[]>([]);
  const reveal = useRef<Reveal | null>(null);
  const history = useRef<HistoryCursor>(cursorAt(shell.current.history));
  const size = useRef({ cols: 80, rows: 24 });
  const pinned = useRef(true);
  const lastTab = useRef<string | null>(null);
  const escaped = useRef(false);
  /** The cwd a command was typed at (its echo shows that prompt, even if the command changes directory). */
  const submittedAt = useRef<VfsPath>(shell.current.cwd);

  const [value, setValue] = useState('');
  const [cwd, setCwd] = useState<VfsPath>(shell.current.cwd);
  const [lastExit, setLastExit] = useState(0);
  const [ready, setReady] = useState(false);
  const [pager, setPager] = useState<Extract<Effect, { k: 'pager' }> | null>(null);
  const [search, setSearch] = useState<{ query: string; index: number; match: string | null; draft: string } | null>(
    null,
  );
  const [chip, setChip] = useState(false);
  /** The accessory row: the prompt is focused with a coarse pointer and no hardware key has been pressed since. */
  const [keys, setKeys] = useState(false);

  const promptOf = useCallback(
    (at: VfsPath) => promptFor?.(at) ?? engine.current?.prompt(at) ?? `${tildePath(at)} $ `,
    [promptFor],
  );

  // Latest callbacks, read from event handlers (the view never re-subscribes).
  const callbacks = useRef({ onEffect, onRecord, onClear, onSize, inputTransform });
  useLayoutEffect(() => {
    callbacks.current = { onEffect, onRecord, onClear, onSize, inputTransform };
  });

  const finishReveal = () => {
    reveal.current?.finish();
    reveal.current = null;
  };

  const toBottom = () => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
    pinned.current = true;
    setChip(false);
  };

  const insertText = useCallback((text: string) => {
    const next = text.slice(0, INPUT_CAP);
    setValue(next);
    setSearch(null);
    const node = input.current;
    if (!node) return;
    node.focus({ preventScroll: true });
    queueMicrotask(() => node.setSelectionRange(next.length, next.length));
  }, []);

  /** Append a block, reveal it, announce it, keep the view pinned (or show the chip). */
  const emit = useCallback(
    (echo: { prompt: string; command: string } | null, lines: readonly Line[], announceAs: string | null) => {
      const node = list.current;
      if (!node) return;
      const wasPinned = pinned.current;
      const outputs = appendBlock(node, { echo, lines, onInsert: insertText });
      if (announceAs !== null && announcer.current) announcer.current.textContent = announcement(announceAs, lines);
      finishReveal();
      reveal.current = revealLines(outputs, prefersReducedMotion());
      if (wasPinned) toBottom();
      else if (lines.length) setChip(true);
    },
    [insertText],
  );

  const clearScrollback = useCallback(() => {
    finishReveal();
    list.current?.replaceChildren();
    callbacks.current.onClear?.();
  }, []);

  const apply = useCallback(
    (command: string, result: Execution) => {
      shell.current = result.state;
      history.current = cursorAt(result.state.history);
      setLastExit(result.exitCode);
      const echo = { prompt: promptOf(submittedAt.current), command };
      let cleared = false;
      for (const effect of result.effects) {
        if (effect.k === 'clear') {
          clearScrollback();
          cleared = true;
        } else if (effect.k === 'pager') setPager(effect);
        else if (effect.k === 'history-clear') callbacks.current.onEffect(effect);
        else {
          if (effect.k === 'cd') setCwd(effect.to);
          callbacks.current.onEffect(effect);
        }
      }
      const lines: Line[] = result.echo ? [{ t: result.echo }, ...result.lines] : [...result.lines];
      if (!cleared) emit(echo, lines, command);
      else if (lines.length) emit(null, lines, command);
      const texts = [`${echo.prompt}${command}`, ...lines.map((line) => line.t)];
      callbacks.current.onRecord?.(command, cleared ? lines.map((line) => line.t) : texts);
    },
    [clearScrollback, emit, promptOf],
  );

  const run = useCallback(
    (raw: string) => {
      finishReveal();
      const terminal = engine.current;
      if (!terminal) {
        queue.current.push(raw);
        return;
      }
      const line = callbacks.current.inputTransform?.(raw) ?? raw;
      submittedAt.current = shell.current.cwd;
      if (!line.trim()) {
        emit({ prompt: promptOf(shell.current.cwd), command: raw }, [], null);
        return;
      }
      const before = shell.current.history;
      const result = terminal.run(line, shell.current, size.current);
      // History recalls what was typed (`dir`), not the rewrite the engine ran (`ls`), like the echo.
      const recalled =
        line !== raw && result.state.history !== before && result.state.history.at(-1) === line
          ? { ...result, state: { ...result.state, history: record(before, raw) } }
          : result;
      apply(raw, recalled);
    },
    [apply, emit, promptOf],
  );

  // Load the engine (a lazy chunk): the static first line shows at once; queued commands run when it lands.
  useEffect(() => {
    let alive = true;
    loadEngine(flavor, os).then(
      (terminal) => {
        if (!alive) return;
        engine.current = terminal;
        setReady(true);
        for (const raw of queue.current.splice(0)) run(raw);
      },
      () => {
        if (alive)
          emit(null, [{ t: 'The terminal could not load — try again, or read the plain portfolio.', cls: 'err' }], '');
      },
    );
    return () => {
      alive = false;
    };
    // The engine is loaded once per view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore the session's scrollback, or print the first line.
  useEffect(() => {
    const node = list.current;
    if (!node || node.childElementCount) return;
    if (session?.scrollback.length) {
      appendBlock(node, {
        echo: null,
        lines: [...session.scrollback.map((t) => ({ t })), { t: '— session restored —', cls: 'dim' }],
        onInsert: insertText,
      });
      toBottom();
    } else if (firstLine) appendBlock(node, { echo: null, lines: [{ t: firstLine }], onInsert: insertText });
    if (focusOnMountProp ?? autoFocus) input.current?.focus({ preventScroll: true });
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Columns × rows from the measured character cell; re-measured when the view's box changes (debounced to commit).
  useEffect(() => {
    const node = scroller.current;
    const cell = measure.current;
    if (!node || !cell || typeof ResizeObserver === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const commit = () => {
      const width = cell.getBoundingClientRect().width / 10 || 8;
      const lineHeight = parseFloat(getComputedStyle(node).fontSize || '13') * LINE_HEIGHT;
      const next = {
        cols: Math.max(20, Math.floor((node.clientWidth - 16) / width)),
        rows: Math.max(4, Math.floor(node.clientHeight / lineHeight)),
      };
      if (next.cols === size.current.cols && next.rows === size.current.rows) return;
      finishReveal();
      size.current = next;
      callbacks.current.onSize?.(next);
    };
    const observer = new ResizeObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(commit, 80);
    });
    observer.observe(node);
    commit();
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, []);

  // Reading the scrollback (native listeners: the region is a document, not a widget).
  //   · typing a printable key there continues at the prompt (fine pointers; never for keys typed in the prompt);
  //   · a click that selected nothing puts the caret back at the prompt; a selection is left alone (copy works).
  const valueRef = useRef(value);
  useLayoutEffect(() => {
    valueRef.current = value;
  });
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const lifetime = new AbortController();
    node.addEventListener(
      'keydown',
      (event) => {
        const target = event.target as Element;
        if (target.closest('form') || event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
        if (!matchMedia('(pointer: fine)').matches) return;
        event.preventDefault();
        insertText(`${valueRef.current}${event.key}`);
      },
      { signal: lifetime.signal },
    );
    node.addEventListener(
      'mouseup',
      (event) => {
        if ((event.target as Element).closest('a,button')) return;
        if (!window.getSelection()?.toString()) input.current?.focus({ preventScroll: true });
      },
      { signal: lifetime.signal },
    );
    return () => lifetime.abort();
  }, [insertText]);

  // Any input completes the running reveal (keys, presses and wheel anywhere in the view).
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const lifetime = new AbortController();
    const finish = () => finishReveal();
    for (const type of ['keydown', 'pointerdown', 'wheel'] as const)
      node.addEventListener(type, finish, { capture: true, passive: true, signal: lifetime.signal });
    return () => lifetime.abort();
  }, []);

  // The block caret follows the input's caret (a mirror span measures the text before it; transform only).
  const placeCaret = useCallback(() => {
    const field = input.current;
    const text = mirror.current;
    const block = caret.current;
    if (!field || !text || !block) return;
    text.textContent = field.value.slice(0, field.selectionStart ?? field.value.length);
    block.style.transform = `translateX(${Math.max(0, text.offsetWidth - field.scrollLeft)}px)`;
  }, []);
  useLayoutEffect(placeCaret, [value, placeCaret]);

  useImperativeHandle(
    handle,
    () => ({
      insert: insertText,
      focus: () => input.current?.focus({ preventScroll: true }),
      clear: clearScrollback,
    }),
    [insertText, clearScrollback],
  );

  const complete = (field: HTMLInputElement, listing: boolean): Completion | null => {
    const terminal = engine.current;
    if (!terminal) return null;
    return terminal.complete(
      field.value,
      field.selectionStart ?? field.value.length,
      shell.current,
      size.current.cols,
      listing,
    );
  };

  const cancelLine = () => {
    emit({ prompt: promptOf(shell.current.cwd), command: `${value}^C` }, [], null);
    shell.current = { ...shell.current, lastExit: 130 };
    setLastExit(130);
    setValue('');
    setSearch(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const field = event.currentTarget;
    const key = event.key;
    // A physical keyboard (a trusted key with a real key code — virtual keyboards report 229 / Unidentified) hides
    // the accessory row until the next focus.
    if (keys && event.isTrusted && event.keyCode !== 229 && key !== 'Unidentified') setKeys(false);
    if (key !== 'Tab') lastTab.current = null;
    if (key === 'Tab') {
      if (escaped.current || event.shiftKey) {
        escaped.current = false;
        return; // Esc, then Tab always leaves the terminal
      }
      const second = lastTab.current === field.value;
      const result = complete(field, second);
      if (!result || result.kind === 'pass') return; // empty input: Tab moves focus as usual
      event.preventDefault();
      lastTab.current = field.value;
      if (result.kind === 'insert') {
        setValue(result.value);
        queueMicrotask(() => field.setSelectionRange(result.cursor, result.cursor));
        lastTab.current = result.value;
      } else if (result.kind === 'list')
        emit({ prompt: promptOf(shell.current.cwd), command: field.value }, result.lines, null);
      else bell();
      return;
    }
    escaped.current = key === 'Escape';
    if (key === 'Escape') {
      if (search) {
        setValue(search.draft);
        setSearch(null);
        event.preventDefault();
      }
      return;
    }
    if (event.ctrlKey && !event.altKey && !event.metaKey && key.length === 1) {
      const selection = typeof window !== 'undefined' ? (window.getSelection()?.toString() ?? '') : '';
      const fieldSelection = field.selectionStart !== field.selectionEnd;
      const action = controlAction(key, {
        selection: selection.length > 0 || fieldSelection,
        empty: field.value === '',
      });
      if (action === null || action === 'copy') return; // the browser's own chord (copy with a selection)
      event.preventDefault();
      if (action === 'edit') {
        const next = editLine(
          { value: field.value, start: field.selectionStart ?? 0, end: field.selectionEnd ?? 0 },
          key.toLowerCase() as 'a' | 'e' | 'u' | 'k' | 'w',
        );
        setValue(next.value);
        queueMicrotask(() => field.setSelectionRange(next.start, next.end));
      } else if (action === 'cancel') cancelLine();
      else if (action === 'clear') clearScrollback();
      else if (action === 'exit') callbacks.current.onEffect({ k: 'exit' });
      else if (action === 'search') {
        const entries = shell.current.history;
        const from = search ? search.index : entries.length;
        const query = search ? search.query : '';
        const hit = query ? reverseSearch(entries, query, from) : null;
        setSearch({
          query,
          index: hit?.index ?? from,
          match: hit?.match ?? search?.match ?? null,
          draft: search?.draft ?? field.value,
        });
        if (!search) setValue('');
      }
      return;
    }
    if (search && (key === 'ArrowLeft' || key === 'ArrowRight')) {
      setValue(search.match ?? search.draft);
      setSearch(null);
      return;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      event.preventDefault();
      const step = key === 'ArrowUp' ? older(history.current, field.value) : newer(history.current, field.value);
      history.current = step.cursor;
      setValue(step.value);
      queueMicrotask(() => field.setSelectionRange(step.value.length, step.value.length));
      return;
    }
    if (event.shiftKey && (key === 'PageUp' || key === 'PageDown')) {
      event.preventDefault();
      const node = scroller.current;
      if (node) node.scrollTop += (key === 'PageUp' ? -1 : 1) * (node.clientHeight - 20);
      return;
    }
    if (key === 'End' || (key.length === 1 && !event.ctrlKey && !event.metaKey)) if (!pinned.current) toBottom();
  };

  const bell = () => {
    const node = root.current;
    if (!node || prefersReducedMotion()) return;
    node.dataset.bell = '';
    setTimeout(() => delete node.dataset.bell, 150);
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text');
    const trimmed = trimPaste(text);
    if (!trimmed.trimmed) return;
    event.preventDefault();
    const field = event.currentTarget;
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? field.value.length;
    insertText(`${field.value.slice(0, start)}${trimmed.text}${field.value.slice(end)}`);
    emit(
      null,
      [
        {
          t:
            trimmed.trimmed === 'lines'
              ? 'Multi-line paste trimmed to its first line.'
              : `Input is limited to ${INPUT_CAP} characters.`,
          cls: 'dim',
        },
      ],
      '',
    );
  };

  /** An accessory key: the prompt keeps focus (pointerdown is cancelled) and the key acts as its keyboard twin. */
  const press = (key: AccessoryKey) => {
    const field = input.current;
    if (!field) return;
    finishReveal();
    if (key.text) {
      const start = field.selectionStart ?? field.value.length;
      const end = field.selectionEnd ?? field.value.length;
      const next = `${field.value.slice(0, start)}${key.text}${field.value.slice(end)}`.slice(0, INPUT_CAP);
      setValue(next);
      queueMicrotask(() => field.setSelectionRange(start + key.text!.length, start + key.text!.length));
      return;
    }
    if (key.id === 'enter') {
      field.form?.requestSubmit();
      return;
    }
    if (key.id === 'left' || key.id === 'right') {
      const at = Math.max(0, Math.min(field.value.length, (field.selectionStart ?? 0) + (key.id === 'left' ? -1 : 1)));
      field.setSelectionRange(at, at);
      placeCaret();
      return;
    }
    if (key.id === 'escape' && pager) {
      setPager(null);
      return;
    }
    // Tab, ↑, ↓, Ctrl+C, Esc: the same handler as the keyboard (an untrusted event never hides the row).
    field.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: key.key, ctrlKey: key.ctrl, bubbles: true, cancelable: true }),
    );
  };

  const label = `Command, current directory ${tildePath(cwd)}`;

  return (
    <div
      ref={root}
      className={`${styles.terminal} ${className ?? ''}`}
      data-terminal=""
      data-active={active || undefined}
      data-ready={ready || undefined}
    >
      <div
        ref={scroller}
        className={styles.scroller}
        role="region"
        aria-label="Terminal output"
        // A readable, selectable document: reachable by Tab so screen-reader and keyboard users can browse it.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        onScroll={(event) => {
          const node = event.currentTarget;
          pinned.current = node.scrollHeight - node.scrollTop - node.clientHeight < 2 * 18;
          if (pinned.current) setChip(false);
        }}
      >
        <div ref={list} className={styles.list} data-scrollback="" />
        <form
          className={styles.promptLine}
          onSubmit={(event) => {
            event.preventDefault();
            if (search) {
              const chosen = search.match ?? '';
              setSearch(null);
              setValue('');
              run(chosen);
              return;
            }
            const line = value;
            setValue('');
            run(line);
          }}
        >
          <span className={styles.prompt} aria-hidden="true" data-exit={lastExit || undefined}>
            {search ? `(reverse-i-search)'${search.query}': ` : promptOf(cwd)}
          </span>
          <span className={styles.field}>
            <input
              ref={input}
              className={styles.input}
              type="text"
              inputMode="text"
              enterKeyHint="send"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              maxLength={INPUT_CAP}
              aria-label={search ? 'Reverse search through history' : label}
              value={search ? search.query : value}
              onChange={(event) => {
                const next = event.target.value;
                if (search) {
                  const hit = reverseSearch(shell.current.history, next);
                  setSearch({
                    ...search,
                    query: next,
                    index: hit?.index ?? shell.current.history.length,
                    match: hit?.match ?? null,
                  });
                } else setValue(next);
              }}
              onKeyDown={onKeyDown}
              onFocus={() => {
                if (accessory && matchMedia('(any-pointer: coarse)').matches) setKeys(true);
              }}
              onBlur={() => setKeys(false)}
              onKeyUp={placeCaret}
              onSelect={placeCaret}
              onPaste={onPaste}
            />
            {search?.match ? (
              <span className={styles.searchMatch} aria-hidden="true">
                {search.match}
              </span>
            ) : null}
            <span ref={caret} className={styles.caret} aria-hidden="true" data-caret="" />
            <span ref={mirror} className={styles.mirror} aria-hidden="true" />
          </span>
        </form>
      </div>
      {keys ? (
        <div className={styles.accessory} role="toolbar" aria-label="Terminal keys" data-accessory="">
          {withExtra(accessoryExtra).map((key) => (
            <button
              key={key.id}
              type="button"
              aria-label={key.label}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => press(key)}
            >
              {key.glyph}
            </button>
          ))}
        </div>
      ) : null}
      {chip ? (
        <button type="button" className={styles.chip} onClick={toBottom}>
          ↓ new output
        </button>
      ) : null}
      {pager ? (
        <Pager
          className={styles.pager}
          lines={pager.lines}
          title={pager.title ?? 'less'}
          variant={pager.variant}
          onInsert={insertText}
          onQuit={() => {
            setPager(null);
            queueMicrotask(() => input.current?.focus({ preventScroll: true }));
          }}
        />
      ) : null}
      <span ref={measure} className={styles.measure} aria-hidden="true">
        0000000000
      </span>
      <div ref={announcer} className="sr-only" role="log" aria-live="polite" aria-atomic="true" data-announcer="" />
    </div>
  );
});
