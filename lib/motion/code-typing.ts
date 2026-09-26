/**
 * Reader About code card typing loop (`ROUTE-PLAIN-01` deviation, owner 2026-09-26). Every line is already real text;
 * this only animates `clip-path` on each line's code (`data-fx-text`) and `transform` on one caret (`data-fx-caret`),
 * with Web Animations — no React state, no text rewriting, so screen readers and search always get the whole file.
 *
 * One cycle: type each line character by character (a longer beat after a line that opens a block), hold the finished
 * file, erase bottom-up, pause, repeat. It starts on the finished file, so nothing is hidden before the first erase.
 * Hover or focus on the card jumps to the finished file and holds it (input always wins); off screen it pauses.
 * The caller skips it for reduced motion and tier 0.
 */

const CHAR_MS = 34;
const LINE_PAUSE_MS = 220;
const OPEN_PAUSE_MS = 480;
const START_MS = 300;
const HOLD_MS = 3600;
const ERASE_CHAR_MS = 8;
const ERASE_LINE_MAX_MS = 180;
const BLANK_MS = 600;
const HIDDEN = 'inset(0 100% 0 0)';
const SHOWN = 'inset(0 0 0 0)';

interface Line {
  readonly text: HTMLElement;
  readonly chars: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly typeAt: number;
  readonly typeFor: number;
  eraseAt: number;
  eraseFor: number;
}

export function startCodeTyping(root: HTMLElement): () => void {
  const pre = root.querySelector<HTMLElement>('[data-fx-type]');
  const caret = pre?.querySelector<HTMLElement>('[data-fx-caret]');
  const card = pre?.closest<HTMLElement>('figure') ?? pre;
  if (!pre || !caret || !card || typeof pre.animate !== 'function') return () => {};

  let animations: Animation[] = [];
  let holdAt = 0;
  let onScreen = false;
  let engaged = false;

  const sync = () => {
    for (const animation of animations) {
      if (engaged) animation.currentTime = holdAt;
      if (onScreen && !engaged) animation.play();
      else animation.pause();
    }
  };

  const build = () => {
    const current = animations[0]?.currentTime;
    for (const animation of animations) animation.cancel();
    animations = [];

    const box = pre.getBoundingClientRect();
    let t = START_MS;
    const lines: Line[] = [...pre.querySelectorAll<HTMLElement>('[data-fx-text]')].map((text) => {
      const rect = text.getBoundingClientRect();
      const source = text.textContent ?? '';
      const line: Line = {
        text,
        chars: source.length,
        x: rect.left - box.left,
        y: rect.top - box.top,
        width: rect.width,
        typeAt: t,
        typeFor: source.length * CHAR_MS,
        eraseAt: 0,
        eraseFor: 0,
      };
      t += line.typeFor + (/[{(]$/.test(source.trimEnd()) ? OPEN_PAUSE_MS : LINE_PAUSE_MS);
      return line;
    });
    const first = lines[0];
    if (!first) return;
    holdAt = t;
    t += HOLD_MS;
    for (const line of [...lines].reverse()) {
      line.eraseAt = t;
      line.eraseFor = Math.min(line.chars * ERASE_CHAR_MS, ERASE_LINE_MAX_MS);
      t += line.eraseFor;
    }
    const total = t + BLANK_MS;
    const at = (ms: number) => ms / total;
    const timing: KeyframeAnimationOptions = { duration: total, iterations: Infinity };

    for (const line of lines) {
      if (!line.chars) continue;
      const steps = `steps(${line.chars}, end)`;
      animations.push(
        line.text.animate(
          [
            { offset: 0, clipPath: HIDDEN },
            { offset: at(line.typeAt), clipPath: HIDDEN, easing: steps },
            { offset: at(line.typeAt + line.typeFor), clipPath: SHOWN },
            { offset: at(line.eraseAt), clipPath: SHOWN, easing: steps },
            { offset: at(line.eraseAt + line.eraseFor), clipPath: HIDDEN },
            { offset: 1, clipPath: HIDDEN },
          ],
          timing,
        ),
      );
    }

    // The caret walks each line as it is typed, waits at its end, then jumps to the next line.
    const frames: Keyframe[] = [];
    const place = (ms: number, x: number, y: number, easing: string) =>
      frames.push({ offset: at(ms), transform: `translate(${x}px, ${y}px)`, easing });
    place(0, first.x, first.y, 'steps(1, end)');
    for (const line of lines) {
      place(line.typeAt, line.x, line.y, `steps(${Math.max(line.chars, 1)}, end)`);
      place(line.typeAt + line.typeFor, line.x + line.width, line.y, 'steps(1, end)');
    }
    for (const line of [...lines].reverse()) {
      place(line.eraseAt, line.x + line.width, line.y, `steps(${Math.max(line.chars, 1)}, end)`);
      place(line.eraseAt + line.eraseFor, line.x, line.y, 'steps(1, end)');
    }
    place(total, first.x, first.y, 'linear');
    animations.push(caret.animate(frames, timing));

    for (const animation of animations) animation.currentTime = typeof current === 'number' ? current : holdAt;
    sync();
  };

  let resizeTimer = 0;
  const resize = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(build, 150);
  });
  const visibility = new IntersectionObserver(([entry]) => {
    onScreen = entry?.isIntersecting ?? false;
    sync();
  });
  const engage = () => {
    engaged = true;
    sync();
  };
  const release = (event: Event) => {
    if (event.type === 'focusout' && card.contains((event as FocusEvent).relatedTarget as Node | null)) return;
    if (event.type === 'pointerleave' && card.contains(document.activeElement)) return;
    engaged = false;
    sync();
  };

  pre.setAttribute('data-fx-typing', '');
  build();
  resize.observe(pre);
  visibility.observe(pre);
  card.addEventListener('pointerenter', engage);
  card.addEventListener('focusin', engage);
  card.addEventListener('pointerleave', release);
  card.addEventListener('focusout', release);

  return () => {
    clearTimeout(resizeTimer);
    resize.disconnect();
    visibility.disconnect();
    card.removeEventListener('pointerenter', engage);
    card.removeEventListener('focusin', engage);
    card.removeEventListener('pointerleave', release);
    card.removeEventListener('focusout', release);
    for (const animation of animations) animation.cancel();
    animations = [];
    pre.removeAttribute('data-fx-typing');
  };
}
