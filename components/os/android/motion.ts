export const ANDROID_EASING = {
  emphasized:
    'linear(0, .002 3.2%, .033 11.4%, .108 18.3%, .333 26.6%, .571 31.7%, .716 35.2%, .823 39.3%, .897 43.8%, .948 49.4%, .979 56.1%, .995 65.2%, 1)',
  decelerate: 'cubic-bezier(.05,.7,.1,1)',
  accelerate: 'cubic-bezier(.3,0,.8,.15)',
  standard: 'cubic-bezier(.2,0,0,1)',
} as const;

export const ANDROID_DURATION = { short: 150, medium: 300, open: 450, close: 350 } as const;

export const ANDROID_PATTERNS = {
  sharedAxisForward: [
    { transform: 'translateX(30px)', opacity: 0 },
    { transform: 'translateX(0)', opacity: 1 },
  ],
  sharedAxisBack: [
    { transform: 'translateX(-30px)', opacity: 0 },
    { transform: 'translateX(0)', opacity: 1 },
  ],
  fadeThrough: [
    { transform: 'scale(.92)', opacity: 0 },
    { transform: 'scale(1)', opacity: 1 },
  ],
} as const;

/** Material ripple, originating at the pointer. The span is removed after its compositor-only animation. */
export function materialRipple(event: { currentTarget: EventTarget & HTMLElement; clientX: number; clientY: number }) {
  if (document.documentElement.dataset.motion === 'reduced') return;
  const host = event.currentTarget;
  const rect = host.getBoundingClientRect();
  const size =
    Math.hypot(
      Math.max(event.clientX - rect.left, rect.right - event.clientX),
      Math.max(event.clientY - rect.top, rect.bottom - event.clientY),
    ) * 2;
  const ripple = document.createElement('span');
  ripple.dataset.ripple = '';
  Object.assign(ripple.style, {
    width: `${size}px`,
    height: `${size}px`,
    left: `${event.clientX - rect.left - size / 2}px`,
    top: `${event.clientY - rect.top - size / 2}px`,
  });
  host.append(ripple);
  const animation = ripple.animate(
    [
      { transform: 'scale(0)', opacity: 0.18 },
      { transform: 'scale(1)', opacity: 0 },
    ],
    { duration: 450, easing: ANDROID_EASING.decelerate },
  );
  animation.finished.then(
    () => ripple.remove(),
    () => ripple.remove(),
  );
}
