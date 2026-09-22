/**
 * KRN-FOCUS-01 — focus target per action; focus never rests on <body> across open / close / minimize / restore.
 * VIEW-SLOT-01 — the same view navigates shallowly inside an OS (KernelLink) and fully in the fallback (<a>).
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import { ProjectList } from '@/components/content';
import StubOs from '@/components/shell/StubOs';
import { KernelLink } from '@/components/shell/KernelLink';
import { getProjects } from '@/data/selectors';
import { startFocusManager } from '@/lib/kernel/focus-manager';
import { DEFAULT_CAPABILITIES } from '@/lib/kernel/state';
import { dispatch, getKernel, subscribeEffects } from '@/stores/kernel-store';

beforeAll(() => {
  dispatch({
    type: 'BOOT',
    url: '/macos',
    navType: 'navigate',
    viewport: { w: 1440, h: 900, pointer: 'fine' },
    persisted: null,
    capabilities: DEFAULT_CAPABILITIES,
  });
  startFocusManager(subscribeEffects);
});

const notOnBody = () => expect(document.activeElement).not.toBe(document.body);

describe('KRN-FOCUS-01 focus never on body', () => {
  it('open → window; minimize → Dock button; restore → window; close → invoker', async () => {
    const user = userEvent.setup();
    render(<StubOs os="macos" heading={null} />);
    expect(getKernel().activeOs).toBe('macos');

    await user.click(screen.getByRole('link', { name: 'Finder' }));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Finder' })).toHaveFocus());
    notOnBody();

    act(() => {
      dispatch({ type: 'MINIMIZE', id: 'macos:files' });
    });
    await waitFor(() => expect(screen.getByRole('link', { name: 'Finder' })).toHaveFocus());
    notOnBody();

    act(() => {
      dispatch({ type: 'RESTORE', id: 'macos:files' });
    });
    await waitFor(() => expect(screen.getByRole('region', { name: 'Finder' })).toHaveFocus());

    await user.click(screen.getByRole('link', { name: 'Safari' }));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Safari' })).toHaveFocus());
    await user.click(screen.getByRole('button', { name: 'Close Safari' }));
    // Next topmost window takes focus.
    await waitFor(() => expect(screen.getByRole('region', { name: 'Finder' })).toHaveFocus());
    notOnBody();

    await user.click(screen.getByRole('button', { name: 'Close Finder' }));
    // No window left: the recorded invoker (the Finder launcher) gets focus.
    await waitFor(() => expect(screen.getByRole('link', { name: 'Finder' })).toHaveFocus());
    notOnBody();
  });
});

describe('VIEW-SLOT-01 link slot swaps between <a> and KernelLink', () => {
  it('fallback: plain anchors to /go/* (full navigation)', () => {
    render(<ProjectList data={getProjects().slice(0, 2)} />);
    const link = screen.getByRole('link', { name: 'Enterprise SSO Identity Provider' });
    expect(link).toHaveAttribute('href', '/go/projects/enterprise-sso');
    let preventedByView: boolean | null = null;
    // Runs after the view's own handlers: record, then stop jsdom from attempting a real navigation.
    const record = (event: Event) => {
      preventedByView = event.defaultPrevented;
      event.preventDefault();
    };
    document.addEventListener('click', record);
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    document.removeEventListener('click', record);
    expect(preventedByView).toBe(false);
  });

  it('inside an OS: the same view navigates shallowly through the kernel', async () => {
    render(
      <ProjectList
        data={getProjects().slice(0, 2)}
        slots={{
          Link: ({ to, children, ...rest }) => (
            <KernelLink to={{ os: 'macos', ref: to }} {...rest}>
              {children}
            </KernelLink>
          ),
        }}
      />,
    );
    const link = screen.getByRole('link', { name: 'Full-Stack Sales Platform' });
    expect(link).toHaveAttribute('href', '/macos/github/sales-platform');
    const allowed = fireEvent.click(link);
    expect(allowed).toBe(false); // default prevented: no document navigation
    // The kernel commits right after the press paints (shared/10 INP), so the window appears a task later.
    await waitFor(() =>
      expect(getKernel().sessions.macos.windows['macos:github']?.nav.entries.at(-1)).toEqual({
        kind: 'content',
        ref: { section: 'projects', slug: 'sales-platform' },
      }),
    );
  });

  it('modified clicks keep native behaviour (new tab)', () => {
    render(<KernelLink to={{ os: 'macos', role: 'mail' }}>Mail</KernelLink>);
    let preventedByLink: boolean | null = null;
    const record = (event: Event) => {
      preventedByLink = event.defaultPrevented;
      event.preventDefault();
    };
    document.addEventListener('click', record);
    fireEvent.click(screen.getByRole('link', { name: 'Mail' }), { metaKey: true });
    document.removeEventListener('click', record);
    expect(preventedByLink).toBe(false);
  });
});
