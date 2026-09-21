/** KRN-FOCUS-01 edge cases + ANL-PORT-01 loader/adapter wiring + KRN-SWITCH-02 failure UI (deterministic). */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TransitionDriver } from '@/components/shell/TransitionDriver';
import { applyFocus, focusIsOnBody, focusKeyAttr, moveFocusOutOf } from '@/lib/kernel/focus';
import { DEFAULT_CAPABILITIES } from '@/lib/kernel/state';
import { dispatch, getKernel } from '@/stores/kernel-store';

describe('FocusManager edge cases', () => {
  it('skips candidates that are missing, inert, hidden, aria-hidden or disabled', () => {
    render(
      <>
        <div inert>
          <button type="button" {...focusKeyAttr('a')}>
            inert
          </button>
        </div>
        <div hidden>
          <button type="button" {...focusKeyAttr('b')}>
            hidden
          </button>
        </div>
        <div aria-hidden="true">
          <button type="button" {...focusKeyAttr('c')}>
            aria-hidden
          </button>
        </div>
        <button type="button" disabled {...focusKeyAttr('d')}>
          disabled
        </button>
        <h1 {...focusKeyAttr('os-heading')}>Heading</h1>
      </>,
    );
    const focused = applyFocus({ candidates: ['missing', 'a', 'b', 'c', 'd'] });
    expect(focused).toBe(screen.getByRole('heading'));
    expect(screen.getByRole('heading')).toHaveAttribute('tabindex', '-1'); // made programmatically focusable
    expect(focusIsOnBody()).toBe(false);
  });
  it('reports when nothing could take focus', () => {
    const onBodyFocus = vi.fn();
    render(<p>nothing focusable</p>);
    (document.activeElement as HTMLElement | null)?.blur();
    expect(applyFocus({ candidates: ['nope'] }, { fallbacks: [], onBodyFocus })).toBeNull();
    expect(onBodyFocus).toHaveBeenCalledOnce();
    expect(applyFocus(null)).toBeNull();
  });
  it('moveFocusOutOf only acts when focus is inside the container', () => {
    render(
      <>
        <div data-testid="box">
          <button type="button">inside</button>
        </div>
        <button type="button" {...focusKeyAttr('target')}>
          target
        </button>
        <button type="button">outside</button>
      </>,
    );
    screen.getByText('outside').focus();
    moveFocusOutOf(screen.getByTestId('box'), { candidates: ['target'] });
    expect(screen.getByText('outside')).toHaveFocus();
    screen.getByText('inside').focus();
    moveFocusOutOf(screen.getByTestId('box'), { candidates: ['target'] });
    expect(screen.getByText('target')).toHaveFocus();
    moveFocusOutOf(null, { candidates: ['target'] });
  });
});

describe('KRN-SWITCH-02 failure path (component)', () => {
  it('shows Retry + the plain portfolio when the chunk fails; Retry and `online` recover', async () => {
    const user = userEvent.setup();
    dispatch({
      type: 'BOOT',
      url: '/macos',
      navType: 'navigate',
      viewport: { w: 1280, h: 800, pointer: 'fine' },
      persisted: null,
      capabilities: DEFAULT_CAPABILITIES,
    });
    // Drive the machine to `failed` before the driver is mounted, so nothing races the assertion.
    dispatch({ type: 'SWITCH_OS', to: 'android', via: 'switch' });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch: getKernel().epoch } });
    dispatch({ type: 'TRANSITION_FAILED', epoch: getKernel().epoch, reason: 'offline' });
    expect(getKernel().transition.phase).toBe('failed');
    render(<TransitionDriver />);
    expect(screen.getByRole('alert')).toHaveTextContent('you appear to be offline');
    expect(screen.getByRole('link', { name: 'Read the plain portfolio' })).toHaveAttribute('href', '/plain');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(getKernel().transition.phase).toBe('idle'), { timeout: 5000 });
    expect(getKernel().activeOs).toBe('android');
  });

  it('the `online` event retries automatically', async () => {
    dispatch({ type: 'SWITCH_OS', to: 'linux', via: 'switch' });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'os', epoch: getKernel().epoch } });
    dispatch({ type: 'TRANSITION_FAILED', epoch: getKernel().epoch, reason: 'chunk' });
    render(<TransitionDriver />);
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t load this operating system.');
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(getKernel().transition.phase).toBe('idle'), { timeout: 5000 });
    expect(getKernel().activeOs).toBe('linux');
  });
});

describe('ANL-PORT-01 loader + Vercel adapter', () => {
  it('outside production the loader attaches the noop adapter on idle and never throws', async () => {
    vi.resetModules();
    const { analytics, startAnalytics } = await import('@/lib/analytics/loader');
    startAnalytics();
    startAnalytics(); // idempotent
    analytics.track({ name: 'egg_found', id: 'x' });
    await new Promise((resolve) => setTimeout(resolve, 2100));
    expect(() => analytics.pageview('/' as never)).not.toThrow();
  }, 10_000);

  it('the Vercel adapter injects cookieless analytics + Speed Insights and maps events', async () => {
    vi.resetModules();
    const inject = vi.fn();
    const track = vi.fn();
    const pageview = vi.fn();
    const injectSpeedInsights = vi.fn();
    vi.doMock('@vercel/analytics', () => ({ inject, track, pageview }));
    vi.doMock('@vercel/speed-insights', () => ({ injectSpeedInsights }));
    const { createVercelAdapter } = await import('@/lib/analytics/vercel');
    const adapter = createVercelAdapter();
    expect(inject).toHaveBeenCalledWith({ mode: 'production', disableAutoTrack: true });
    expect(injectSpeedInsights).toHaveBeenCalledOnce();
    adapter.track({ name: 'app_opened', os: 'macos', role: 'github', section: 'projects' });
    expect(track).toHaveBeenCalledWith('app_opened', { os: 'macos', role: 'github', section: 'projects' });
    adapter.pageview('/macos/go/projects' as never);
    expect(pageview).toHaveBeenCalledWith({ route: '/macos/go/projects', path: '/macos/go/projects' });
    vi.doUnmock('@vercel/analytics');
    vi.doUnmock('@vercel/speed-insights');
  });
});
