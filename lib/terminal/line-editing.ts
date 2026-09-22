/**
 * Line editing — linux/02 `LNX-SH-08`, as pure functions over the prompt's value and selection: Ctrl+A / Ctrl+E (start /
 * end), Ctrl+U (kill to start), Ctrl+K (kill to end), Ctrl+W (kill the word before the caret), multi-line paste →
 * first line only (+ a notice), and the 1000-character input cap. Ctrl+C / Ctrl+D / Ctrl+L are decided here too, so
 * every host behaves the same; Ctrl+C acts **only when no text is selected** (otherwise the browser copies).
 */

export interface LineState {
  readonly value: string;
  readonly start: number;
  readonly end: number;
}

export const INPUT_CAP = 1000;

export type EditKey = 'a' | 'e' | 'u' | 'k' | 'w';

export function editLine(state: LineState, key: EditKey): LineState {
  const { value } = state;
  const caret = Math.min(state.start, state.end);
  switch (key) {
    case 'a':
      return { value, start: 0, end: 0 };
    case 'e':
      return { value, start: value.length, end: value.length };
    case 'u':
      return { value: value.slice(caret), start: 0, end: 0 };
    case 'k':
      return { value: value.slice(0, caret), start: caret, end: caret };
    case 'w': {
      let from = caret;
      while (from > 0 && /\s/.test(value[from - 1]!)) from--;
      while (from > 0 && !/\s/.test(value[from - 1]!)) from--;
      return { value: value.slice(0, from) + value.slice(caret), start: from, end: from };
    }
  }
}

/** Multi-line paste keeps the first line; long text is cut at the cap. */
export function trimPaste(text: string): { text: string; trimmed: 'lines' | 'length' | null } {
  const first = text.split(/\r\n|\r|\n/)[0] ?? '';
  if (first.length !== text.replace(/[\r\n]+$/, '').length)
    return { text: first.slice(0, INPUT_CAP), trimmed: 'lines' };
  if (first.length > INPUT_CAP) return { text: first.slice(0, INPUT_CAP), trimmed: 'length' };
  return { text: first, trimmed: null };
}

export type ControlAction = 'edit' | 'cancel' | 'copy' | 'clear' | 'exit' | 'search' | null;

/** What a Ctrl chord does at the prompt (`selection` = the page has selected text; `empty` = the input is empty). */
export function controlAction(
  key: string,
  { selection, empty }: { selection: boolean; empty: boolean },
): ControlAction {
  switch (key.toLowerCase()) {
    case 'a':
    case 'e':
    case 'u':
    case 'k':
    case 'w':
      return 'edit';
    case 'c':
      return selection ? 'copy' : 'cancel';
    case 'l':
      return 'clear';
    case 'd':
      return empty ? 'exit' : null;
    case 'r':
      return 'search';
    default:
      return null;
  }
}
