/**
 * Visual-viewport tracking (plans/macos/04 "Virtual keyboard", linux/10 `LNX-RESP-02`): a rAF-throttled
 * `visualViewport` resize/scroll listener writes `--vvh` (the visible height) and `--vv-top` (its offset) on an element,
 * so sheets and prompts bounded by `var(--vvh, 100dvh)` sit directly above an on-screen keyboard. It also reports
 * whether a keyboard is probably up (the visible height lost more than 120 px). Raw rAF lives here (lib/motion owns
 * timing). Returns a disposer; a no-op where `visualViewport` does not exist.
 */
const KEYBOARD_PX = 120;

export function trackVisualViewport(
  el: HTMLElement,
  onKeyboard?: (up: boolean) => void,
  view: (Window & typeof globalThis) | undefined = typeof window === 'undefined' ? undefined : window,
): () => void {
  const vv = view?.visualViewport;
  if (!view || !vv) return () => undefined;
  let frame = 0;
  let keyboard = false;
  const write = () => {
    frame = 0;
    el.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
    el.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`);
    const up = view.innerHeight - vv.height > KEYBOARD_PX;
    if (up !== keyboard) {
      keyboard = up;
      onKeyboard?.(up);
    }
  };
  const schedule = () => {
    if (!frame) frame = view.requestAnimationFrame(write);
  };
  vv.addEventListener('resize', schedule);
  vv.addEventListener('scroll', schedule);
  write();
  return () => {
    vv.removeEventListener('resize', schedule);
    vv.removeEventListener('scroll', schedule);
    if (frame) view.cancelAnimationFrame(frame);
    el.style.removeProperty('--vvh');
    el.style.removeProperty('--vv-top');
  };
}
