/**
 * The persistent shell (shared/01 `ARCH-SHELL-01`) and its runtime: the runtime boots the kernel, flushes what the
 * welcome island queued (kernel bridge), keeps a polite status region in the page before anything is announced
 * (A11Y-LIVE-01), and makes the semantic page inert only while an OS or the chooser covers it. The shell loads the
 * runtime in idle time on `/`, never on `/plain` (where only analytics starts, for the reader's page view).
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

beforeEach(() => {
  document.body.innerHTML = '<div id="page-layer"><button id="inside">in the page</button></div>';
});
afterEach(() => {
  vi.resetModules();
  vi.doUnmock('@/components/shell/ShellRuntime');
  vi.doUnmock('@/lib/analytics/loader');
  window.history.replaceState(null, '', '/');
  delete document.documentElement.dataset.shell;
});

describe('ShellRuntime', () => {
  it('boots the kernel, flushes the welcome queue and exposes a status region before any message', async () => {
    const { sendToKernel } = await import('@/stores/kernel-bridge');
    sendToKernel({ type: 'ONBOARDING_ADVANCE', to: 'intro' }); // queued before the kernel exists
    const { ShellRuntime } = await import('@/components/shell/ShellRuntime');
    const { getKernel } = await import('@/stores/kernel-store');
    const { unmount } = render(<ShellRuntime />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toBeEmptyDOMElement();
    await waitFor(() => expect(getKernel().boot).toBe('ready'));
    expect(getKernel().onboarding).toBe('intro');
    expect(document.documentElement.dataset.shellInstance).toBeTruthy();
    const page = document.getElementById('page-layer')!;
    expect(page.inert).toBe(false); // the welcome page is not covered
    unmount();
  });

  it('an OS covers the page: it becomes inert and hidden from assistive tech', async () => {
    window.history.replaceState(null, '', '/macos');
    const { ShellRuntime } = await import('@/components/shell/ShellRuntime');
    render(<ShellRuntime />);
    const page = document.getElementById('page-layer')!;
    await waitFor(() => expect(page.inert).toBe(true));
    expect(page).toHaveAttribute('aria-hidden', 'true');
    expect(document.documentElement.dataset.shell).toBe('os');
  });
});

describe('Shell', () => {
  it('on / the runtime arrives in idle time; the first render is only the page', async () => {
    vi.doMock('@/components/shell/ShellRuntime', () => ({ ShellRuntime: () => <p>runtime</p> }));
    const { Shell } = await import('@/components/shell/Shell');
    render(
      <Shell>
        <p>page</p>
      </Shell>,
    );
    expect(screen.getByText('page')).toBeInTheDocument();
    expect(screen.queryByText('runtime')).toBeNull();
    await waitFor(() => expect(screen.getByText('runtime')).toBeInTheDocument(), { timeout: 3000 });
  });

  it('on /plain the runtime never loads; analytics starts for the reader page view', async () => {
    window.history.replaceState(null, '', '/plain');
    const reader = vi.fn();
    vi.doMock('@/lib/analytics/loader', () => ({ startReaderAnalytics: reader }));
    vi.doMock('@/components/shell/ShellRuntime', () => ({ ShellRuntime: () => <p>runtime</p> }));
    const { Shell } = await import('@/components/shell/Shell');
    render(
      <Shell>
        <p>reader</p>
      </Shell>,
    );
    await waitFor(() => expect(reader).toHaveBeenCalledWith('/plain'), { timeout: 3000 });
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(screen.queryByText('runtime')).toBeNull();
  });
});
