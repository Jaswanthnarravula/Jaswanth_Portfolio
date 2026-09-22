/**
 * OSHost + TransitionDriver recovery (shared/04 `KRN-SWITCH-*`, plans/04 `CHOOSE-FAIL-01`): a chunk that failed while
 * offline is loaded again on the next attempt — the `online` event or Retry — and the shell mounts. Regression: the
 * host used to load once on mount, so a successful retry left the kernel idle on an empty OS.
 */
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OSHost } from '@/components/shell/OSHost';
import { TransitionDriver } from '@/components/shell/TransitionDriver';
import { DEFAULT_CAPABILITIES } from '@/lib/kernel/state';
import { dispatch, getKernel } from '@/stores/kernel-store';

const network = vi.hoisted(() => ({ online: false, calls: 0 }));

vi.mock('@/lib/os-loaders', () => ({
  loadOs: (os: string) => {
    network.calls += 1;
    return network.online
      ? Promise.resolve({ default: () => <p>{os} shell</p> })
      : Promise.reject(new Error('ChunkLoadError: offline'));
  },
}));

describe('OSHost after a failed load', () => {
  it('mounts the shell when the kernel retries once the network is back', async () => {
    dispatch({
      type: 'BOOT',
      url: '/',
      navType: 'navigate',
      viewport: { w: 1280, h: 800, pointer: 'fine' },
      persisted: null,
      capabilities: DEFAULT_CAPABILITIES,
    });
    const { container } = render(
      <>
        <TransitionDriver />
        <OSHost os="android" heading={null} />
      </>,
    );
    act(() => {
      dispatch({ type: 'SWITCH_OS', to: 'android', via: 'chooser' });
    });
    await waitFor(() => expect(getKernel().transition.phase).toBe('failed'));
    expect(container.querySelector('[data-os-shell]')).toBeNull();

    network.online = true;
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(getKernel().transition.phase).toBe('idle'));
    expect(getKernel().activeOs).toBe('android');
    await waitFor(() =>
      expect(container.querySelector('[data-os-shell="android"]')).toHaveTextContent('android shell'),
    );
  });
});
