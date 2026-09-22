/**
 * KRN-FOCUS-01 with "input always wins": the FocusManager applies a request on the next frame — unless the visitor
 * pressed a key or pointer in between and focus moved with it (a fast Tab / arrow on a busy device): that request is
 * stale. Focus moved by code alone never cancels it; a request whose origin disappeared, or whose new focus sits
 * somewhere unusable (inert), still lands, so focus never rests on <body>.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { startFocusManager } from '@/lib/kernel/focus-manager';
import type { FocusTarget } from '@/lib/kernel/types';

type Listener = (effect: { focusTarget: FocusTarget | null }) => void;

function setup() {
  document.body.innerHTML = `
    <button id="origin">Skip intro</button>
    <h1 id="heading" tabindex="-1" data-focus-key="profiles-heading">Who’s watching?</h1>
    <button id="first">Recruiter</button>
    <div inert><button id="hidden">behind</button></div>`;
  const listeners = new Set<Listener>();
  const stop = startFocusManager((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  });
  const request = () => {
    for (const listener of listeners) listener({ focusTarget: { candidates: ['profiles-heading'] } });
  };
  const byId = (id: string) => document.getElementById(id) as HTMLElement;
  return { stop, request, byId };
}

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

afterEach(() => {
  document.body.innerHTML = '';
});

describe('FocusManager and visitor input', () => {
  it('applies the request on the next frame when focus stayed put', async () => {
    const { stop, request, byId } = setup();
    byId('origin').focus();
    request();
    await nextFrame();
    expect(document.activeElement).toBe(byId('heading'));
    stop();
  });

  it('drops a stale request once the visitor has moved focus', async () => {
    const { stop, request, byId } = setup();
    byId('origin').focus();
    request();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' })); // Tab pressed before the frame…
    byId('first').focus(); // …moves focus on
    await nextFrame();
    expect(document.activeElement).toBe(byId('first'));
    stop();
  });

  it('focus moved by code alone (no input) does not cancel the request', async () => {
    const { stop, request, byId } = setup();
    byId('origin').focus();
    request();
    byId('first').focus(); // e.g. a lazily mounted surface focusing its own heading
    await nextFrame();
    expect(document.activeElement).toBe(byId('heading'));
    stop();
  });

  it('still lands when the origin vanished (focus fell to body)', async () => {
    const { stop, request, byId } = setup();
    byId('origin').focus();
    request();
    byId('origin').remove();
    await nextFrame();
    expect(document.activeElement).toBe(byId('heading'));
    stop();
  });

  it('still lands when focus moved somewhere unusable (inert)', async () => {
    const { stop, request, byId } = setup();
    byId('origin').focus();
    request();
    document.dispatchEvent(new PointerEvent('pointerdown'));
    Object.defineProperty(document, 'activeElement', { configurable: true, get: () => byId('hidden') });
    try {
      await nextFrame();
    } finally {
      delete (document as unknown as { activeElement?: unknown }).activeElement;
    }
    expect(document.activeElement).toBe(byId('heading'));
    stop();
  });
});
