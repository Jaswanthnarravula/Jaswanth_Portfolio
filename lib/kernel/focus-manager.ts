/**
 * FocusManager binding — applies each action's `focusTarget` right after React commits the new state (next frame),
 * with `preventScroll`. One owner of programmatic focus (shared/04 `KRN-FOCUS-01`).
 */
import { applyFocus } from './focus';
import type { FocusTarget } from './types';

export function startFocusManager(
  subscribe: (listener: (effect: { focusTarget: FocusTarget | null }) => void) => () => void,
  onBodyFocus?: () => void,
): () => void {
  let frame = 0;
  let pending: FocusTarget | null = null;
  const unsubscribe = subscribe(({ focusTarget }) => {
    if (!focusTarget) return;
    pending = focusTarget;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const target = pending;
      pending = null;
      applyFocus(target, { onBodyFocus });
    });
  });
  return () => {
    cancelAnimationFrame(frame);
    unsubscribe();
  };
}
