/**
 * The terminal's scrollback as an imperative DOM list (plans/linux/07-output-animation.md): each command is one block
 * (the echoed prompt + command, then its output lines); lines are created once, as finished nodes, inside a
 * DocumentFragment in a single write — never typed character by character, never re-rendered by React. Tappable
 * entries are real buttons that *insert* their text (they never execute); links are real anchors. The list is capped
 * at 500 lines, dropping whole blocks, oldest first.
 */
import type { Line, Span } from '@/lib/terminal/types';

export const SCROLLBACK_CAP = 500;

export interface BlockOptions {
  readonly echo?: { readonly prompt: string; readonly command: string } | null;
  readonly lines: readonly Line[];
  readonly onInsert: (text: string) => void;
}

function spanNode(doc: Document, span: Span, onInsert: (text: string) => void): Node {
  if (span.href) {
    const a = doc.createElement('a');
    a.href = span.href;
    a.textContent = span.t;
    if (/^https?:/.test(span.href)) {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      const hint = doc.createElement('span');
      hint.className = 'sr-only';
      hint.textContent = ' (opens in a new tab)';
      a.append(hint);
    }
    if (span.cls) a.dataset.cls = span.cls;
    return a;
  }
  if (span.insert) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.textContent = span.t;
    button.dataset.insert = span.insert;
    button.setAttribute('aria-label', `Insert command: ${span.insert}`);
    if (span.cls) button.dataset.cls = span.cls;
    button.addEventListener('click', () => onInsert(span.insert!));
    return button;
  }
  if (!span.cls) return doc.createTextNode(span.t);
  const el = doc.createElement('span');
  el.dataset.cls = span.cls;
  el.textContent = span.t;
  return el;
}

export function lineNode(doc: Document, line: Line, onInsert: (text: string) => void): HTMLElement {
  const el = doc.createElement('div');
  el.dataset.line = '';
  if (line.cls) el.dataset.cls = line.cls;
  const spans: readonly Span[] = line.spans ?? [
    { t: line.t, ...(line.href ? { href: line.href } : {}), ...(line.insert ? { insert: line.insert } : {}) },
  ];
  // A whole-line class applies to its spans too (e.g. an error line).
  for (const span of spans) el.append(spanNode(doc, span, onInsert));
  if (line.t === '') el.append(doc.createTextNode('​'));
  return el;
}

/** Append one block; returns the output line elements (the reveal animates these). */
export function appendBlock(list: HTMLElement, { echo, lines, onInsert }: BlockOptions): HTMLElement[] {
  const doc = list.ownerDocument;
  const block = doc.createElement('div');
  block.dataset.block = '';
  const fragment = doc.createDocumentFragment();
  if (echo) {
    const head = doc.createElement('div');
    head.dataset.line = '';
    head.dataset.echo = '';
    const prompt = doc.createElement('span');
    prompt.dataset.prompt = '';
    prompt.textContent = echo.prompt;
    head.append(prompt, doc.createTextNode(echo.command));
    block.append(head);
  }
  const outputs = lines.map((line) => lineNode(doc, line, onInsert));
  for (const node of outputs) block.append(node);
  fragment.append(block);
  list.append(fragment);
  trim(list);
  return outputs;
}

/** Drop whole blocks, oldest first, until the list holds at most `cap` lines (never half a block). */
export function trim(list: HTMLElement, cap = SCROLLBACK_CAP): void {
  let count = list.querySelectorAll('[data-line]').length;
  while (count > cap && list.firstElementChild && list.children.length > 1) {
    const first = list.firstElementChild;
    count -= first.querySelectorAll('[data-line]').length;
    first.remove();
  }
}

/** Plain text of the last `limit` lines (what persists with the session). */
export function scrollbackText(list: HTMLElement, limit = SCROLLBACK_CAP): string[] {
  return [...list.querySelectorAll<HTMLElement>('[data-line]')]
    .slice(-limit)
    .map((node) => (node.textContent ?? '').replace(/​/g, '').replace(/ \(opens in a new tab\)/g, ''));
}

/** What the announcer says for a command's output: in full up to 10 lines, else a summary (linux/11). */
export function announcement(command: string, lines: readonly Line[]): string {
  const texts = lines.map((line) => (line.cls === 'err' ? `Error: ${line.t}` : line.t)).filter((text) => text.trim());
  if (texts.length === 0) return '';
  if (texts.length <= 10) return texts.join('\n');
  return `${command}: ${texts.length} lines. ${texts[0]}`;
}
