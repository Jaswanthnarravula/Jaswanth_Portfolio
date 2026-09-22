'use client';
/**
 * The pager (`less`, `man`, text files opened with `open`) and the vim egg's calm buffer — plans/linux/04
 * `LNX-CMD-less`, shared/21 `EGG-VIM-01`. A labelled, focusable region over the terminal body: Space / PageDown page,
 * b / PageUp back, g / G top and bottom, `/` searches, q or Esc quits (vim: `:q`, `:q!`, `:wq` or Esc). Every key has a
 * visible button too. Page flips are instant (terminals don't ease). Focus returns to the prompt on quit.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { Line } from '@/lib/terminal/types';
import { lineNode } from './scrollback';

export interface PagerProps {
  readonly lines: readonly Line[];
  readonly title: string;
  readonly variant?: 'vim';
  readonly onQuit: () => void;
  readonly onInsert: (text: string) => void;
  readonly className?: string;
}

export function Pager({ lines, title, variant, onQuit, onInsert, className }: PagerProps) {
  const region = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [command, setCommand] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const fieldId = useId();

  useEffect(() => {
    const node = body.current;
    if (!node) return;
    node.replaceChildren(...lines.map((line) => lineNode(node.ownerDocument, line, onInsert)));
    region.current?.focus({ preventScroll: true });
  }, [lines, onInsert]);

  const page = (direction: 1 | -1) => {
    const node = body.current;
    if (node) node.scrollTop += direction * Math.max(40, node.clientHeight - 24);
  };
  const edge = (bottom: boolean) => {
    const node = body.current;
    if (node) node.scrollTop = bottom ? node.scrollHeight : 0;
  };
  const search = (query: string) => {
    const node = body.current;
    if (!node || !query) return;
    const rows = [...node.querySelectorAll<HTMLElement>('[data-line]')];
    const hit = rows.find(
      (row) => row.offsetTop > node.scrollTop + 1 && row.textContent?.toLowerCase().includes(query.toLowerCase()),
    );
    const target = hit ?? rows.find((row) => row.textContent?.toLowerCase().includes(query.toLowerCase()));
    if (target) {
      node.scrollTop = target.offsetTop;
      setStatus('');
    } else setStatus(`Pattern not found: ${query}`);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (command !== null || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onQuit();
      return;
    }
    if (variant === 'vim') {
      if (event.key === ':') {
        event.preventDefault();
        setCommand(':');
      }
      return;
    }
    const actions: Record<string, () => void> = {
      q: onQuit,
      ' ': () => page(1),
      PageDown: () => page(1),
      f: () => page(1),
      b: () => page(-1),
      PageUp: () => page(-1),
      g: () => edge(false),
      Home: () => edge(false),
      G: () => edge(true),
      End: () => edge(true),
      '/': () => setCommand('/'),
      j: () => body.current && (body.current.scrollTop += 20),
      ArrowDown: () => body.current && (body.current.scrollTop += 20),
      k: () => body.current && (body.current.scrollTop -= 20),
      ArrowUp: () => body.current && (body.current.scrollTop -= 20),
    };
    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };

  // The pager is a document region, so its keys are a native listener (always the latest handler).
  const keys = useRef(onKeyDown);
  useLayoutEffect(() => {
    keys.current = onKeyDown;
  });
  useEffect(() => {
    const node = region.current;
    if (!node) return;
    const listener = (event: KeyboardEvent) => {
      if ((event.target as Element).closest('form')) return;
      keys.current(event);
    };
    node.addEventListener('keydown', listener);
    return () => node.removeEventListener('keydown', listener);
  }, []);

  const submitCommand = (value: string) => {
    setCommand(null);
    if (variant === 'vim') {
      if (/^:(q!?|wq|x)$/.test(value.trim())) onQuit();
      else setStatus(`E492: Not an editor command: ${value.replace(/^:/, '')}`);
      region.current?.focus({ preventScroll: true });
      return;
    }
    search(value.replace(/^\//, ''));
    region.current?.focus({ preventScroll: true });
  };

  return (
    <div
      ref={region}
      className={className}
      role="region"
      aria-label={variant === 'vim' ? `${title} — press Escape to leave` : `${title} — pager, q to quit`}
      tabIndex={-1}
      data-pager={variant ?? 'less'}
    >
      <div ref={body} data-pager-body="" />
      <div data-pager-bar="">
        {command !== null ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitCommand(command);
            }}
          >
            <label className="sr-only" htmlFor={fieldId}>
              {variant === 'vim' ? 'Editor command' : 'Search'}
            </label>
            <input
              id={fieldId}
              // The visitor asked for this field by pressing ':' or '/'.
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              value={command}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setCommand(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  setCommand(null);
                  region.current?.focus({ preventScroll: true });
                }
              }}
            />
          </form>
        ) : (
          <span data-pager-status="" aria-live="polite">
            {status || (variant === 'vim' ? `"${title}" [readonly]` : title)}
          </span>
        )}
        <span data-pager-actions="">
          {variant === 'vim' ? null : (
            <>
              <button type="button" onClick={() => page(-1)}>
                Page up
              </button>
              <button type="button" onClick={() => page(1)}>
                Page down
              </button>
            </>
          )}
          <button type="button" onClick={onQuit}>
            {variant === 'vim' ? 'Quit (:q)' : 'Quit (q)'}
          </button>
        </span>
      </div>
    </div>
  );
}
