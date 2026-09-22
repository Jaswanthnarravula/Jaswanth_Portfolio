/**
 * FocusManager binding — applies each action's `focusTarget` right after React commits the new state (next frame),
 * with `preventScroll`. One owner of programmatic focus (shared/04 `KRN-FOCUS-01`). Input always wins: if the
 * visitor presses a key or a pointer between the action and that frame (a fast Tab or arrow on a busy device) and
 * focus moved because of it, the request is stale and is dropped rather than pulling focus back. Focus moved by code
 * alone (e.g. a lazily mounted surface focusing its heading) never cancels the kernel's request.
 */
import { applyFocus, focusMovedSince } from './focus';
import type { FocusTarget } from './types';

export function startFocusManager(
  subscribe: (listener: (effect: { focusTarget: FocusTarget | null }) => void) => () => void,
  onBodyFocus?: () => void,
): () => void {
  let frame = 0;
  let pending: FocusTarget | null = null;
  /** Where focus was, and how many inputs had happened, when the first pending request arrived. */
  let origin: Element | null = null;
  let inputs = 0;
  let inputsAtRequest = 0;
  const onInput = () => void inputs++;
  document.addEventListener('keydown', onInput, true);
  document.addEventListener('pointerdown', onInput, true);

  const unsubscribe = subscribe(({ focusTarget }) => {
    if (!focusTarget) return;
    if (!pending) {
      origin = document.activeElement;
      inputsAtRequest = inputs;
    }
    pending = focusTarget;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const target = pending;
      const stale = inputs !== inputsAtRequest && focusMovedSince(origin);
      pending = null;
      origin = null;
      if (!stale) applyFocus(target, { onBodyFocus });
    });
  });
  return () => {
    cancelAnimationFrame(frame);
    document.removeEventListener('keydown', onInput, true);
    document.removeEventListener('pointerdown', onInput, true);
    unsubscribe();
  };
}
