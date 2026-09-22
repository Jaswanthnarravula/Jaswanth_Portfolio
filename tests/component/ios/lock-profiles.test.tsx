/**
 * IOS-LOCK-05 (plans/ios/surfaces/lock-screen): the Lock Screen is identical for every "Who's watching?" profile.
 * The real iOS shell is rendered on a first chooser arrival (the lock shows) once per `PersonaId` in the prefs store,
 * and the Lock Screen's DOM is compared across the five profiles.
 */
import { act, cleanup, render } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import IosShell from '@/components/os/ios/Shell';
import { PERSONA_IDS } from '@/lib/kernel/ids';
import { DEFAULT_CAPABILITIES, DEFAULT_PREFS } from '@/lib/kernel/state';
import { focusKeys, type WindowId } from '@/lib/kernel/types';
import { dispatch, getKernel, kernelStore } from '@/stores/kernel-store';
import { prefsStore } from '@/stores/prefs-store';

beforeAll(() => {
  // A fixed clock: the lock's time and date must not tick between two profiles' renders.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-22T09:41:00'));
  dispatch({
    type: 'BOOT',
    url: '/ios',
    navType: 'navigate',
    viewport: { w: 390, h: 844, pointer: 'coarse' },
    persisted: null,
    capabilities: DEFAULT_CAPABILITIES,
  });
});
afterAll(() => {
  vi.useRealTimers();
  prefsStore.setState({ prefs: DEFAULT_PREFS });
  kernelStore.setState({ kernel: { ...getKernel(), arrival: null } });
});

/** Arrive from the chooser with the lock unseen and nothing open (the only state that shows the lock). */
function arriveFromChooser() {
  for (const id of Object.keys(getKernel().sessions.ios.windows) as WindowId[]) {
    dispatch({ type: 'CLOSE_WINDOW', id });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
  }
  const state = getKernel();
  kernelStore.setState({
    kernel: {
      ...state,
      arrival: 'chooser',
      sessions: { ...state.sessions, ios: { ...state.sessions.ios, lockSeen: false, focused: null } },
    },
  });
}

/** React's `useId` values are render-order counters, not content: normalize them before comparing. */
const normalize = (html: string) => html.replace(/_r_[\w]+_|«r[\w]+»|:r[\w]+:/g, '<id>');

function lockFor(persona: (typeof PERSONA_IDS)[number]) {
  prefsStore.setState({ prefs: { ...DEFAULT_PREFS, persona, introSeen: true, tourOffered: true } });
  arriveFromChooser();
  const view = render(
    <>
      <div role="status" aria-live="polite" id="system-status" className="sr-only" />
      <div className="os-root" data-os="ios">
        <IosShell
          os="ios"
          heading={
            <h1 className="sr-only" tabIndex={-1} data-focus-key={focusKeys.osHeading}>
              iOS — Jaswanth&apos;s portfolio
            </h1>
          }
        />
      </div>
    </>,
  );
  const lock = view.container.querySelector<HTMLElement>('[data-lock]');
  const html = lock ? normalize(lock.outerHTML) : null;
  const text = lock?.textContent ?? null;
  const notifications = lock
    ? [...lock.querySelectorAll('[data-lock-notification]')].map((el) => el.getAttribute('aria-label'))
    : [];
  act(() => cleanup());
  return { html, text, notifications };
}

describe('IOS-LOCK-05 the Lock Screen is identical for every "Who\'s watching?" profile', () => {
  it('IOS-LOCK-05 the lock rendered under each PersonaId has the same DOM, text and notifications', () => {
    const results = PERSONA_IDS.map((persona) => ({ persona, ...lockFor(persona) }));
    for (const result of results) {
      expect(result.html, `${result.persona}: the lock shows`).not.toBeNull();
      expect(result.notifications.length, result.persona).toBeGreaterThanOrEqual(3);
    }
    const [first, ...rest] = results;
    for (const result of rest) {
      expect(result.notifications, result.persona).toEqual(first!.notifications);
      expect(result.text, result.persona).toBe(first!.text);
      expect(result.html, result.persona).toBe(first!.html);
    }
  });
});
