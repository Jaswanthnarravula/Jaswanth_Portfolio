/**
 * shared/23 content depth on Android — AND-GH-07 (the Case study tab and the full-screen deep-dive reader closed by
 * system Back) and AND-KEEP-07 (the pinned Now note). Real data through the selectors.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';
import AndroidShell from '@/components/os/android/Shell';
import { getPerson } from '@/data/selectors';
import { currentLocation, DEFAULT_CAPABILITIES } from '@/lib/kernel/state';
import { focusKeys, type AppLocation, type WindowId } from '@/lib/kernel/types';
import { dispatch, flushQueued, getKernel } from '@/stores/kernel-store';
import { prefsStore } from '@/stores/prefs-store';

let booted = false;
function boot() {
  if (!booted) {
    dispatch({
      type: 'BOOT',
      url: '/android',
      navType: 'navigate',
      viewport: { w: 412, h: 915, pointer: 'coarse' },
      persisted: null,
      capabilities: { ...DEFAULT_CAPABILITIES, pointer: 'coarse' },
    });
    booted = true;
  } else {
    dispatch({ type: 'VIEWPORT_CHANGED', w: 412, h: 915, pointer: 'coarse' });
    dispatch({ type: 'ROUTE_CHANGED', url: '/android' });
  }
}
function closeAll() {
  for (const id of Object.keys(getKernel().sessions.android.windows) as WindowId[]) {
    dispatch({ type: 'CLOSE_WINDOW', id });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id } });
  }
}
async function settle() {
  await act(async () => {
    flushQueued();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
function open(role: 'github' | 'notes', location?: AppLocation) {
  act(() => {
    dispatch({ type: 'OPEN_APP', os: 'android', role, ...(location ? { location } : {}) });
    dispatch({ type: 'PHASE_DONE', target: { kind: 'window', id: `android:${role}` as WindowId } });
  });
}
function shell() {
  return render(
    <div className="os-root" data-os="android">
      <AndroidShell
        os="android"
        heading={
          <h1 className="sr-only" data-focus-key={focusKeys.osHeading}>
            Android — Jaswanth&apos;s portfolio
          </h1>
        }
      />
    </div>,
  );
}
const project = (slug: string): AppLocation => ({ kind: 'content', ref: { section: 'projects', slug } });
const app = (name: string) => document.querySelector<HTMLElement>(`[data-app="${name}"]`)!;
/** Apps load lazily (their own chunk): wait until the app has mounted. */
const mounted = (name: string) =>
  waitFor(() => expect(document.querySelector(`[data-app="${name}"]`)).not.toBeNull(), { timeout: 5000 });

beforeEach(() => {
  boot();
  act(() => closeAll());
  prefsStore
    .getState()
    .patch({ androidNavigation: 'auto', androidPalette: 'sage', androidThemedIcons: false, notifications: false });
});

describe('AND-GH-07 Case study tab and the deep-dive reader', () => {
  it('the tab shows cards and results; README keeps the project text without the case study', async () => {
    open('github', project('enterprise-sso'));
    shell();
    await mounted('github');
    const tabs = within(app('github')).getByRole('tablist', { name: 'Repository' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['README', 'Case study', 'Stack', 'About']);
    expect(within(app('github')).queryByRole('heading', { name: 'Key decisions' })).toBeNull();
    fireEvent.click(within(tabs).getByRole('tab', { name: 'Case study' }));
    await settle();
    for (const part of ['The problem', 'My role', 'Key decisions', 'Results', 'Deep dives'])
      expect(within(app('github')).getByRole('heading', { name: part })).toBeInTheDocument();
    expect(within(app('github')).getByText('~3,000')).toBeInTheDocument();
  });

  it('a deep dive opens full screen with focus on its title; system Back closes it back to its list item', async () => {
    open('github', project('enterprise-sso'));
    shell();
    await mounted('github');
    fireEvent.click(within(app('github')).getByRole('tab', { name: 'Case study' }));
    await settle();
    fireEvent.click(
      within(app('github')).getByRole('button', { name: /Rotating signing keys without logging anyone out/ }),
    );
    await settle();
    const reader = within(app('github')).getByRole('region', {
      name: 'Rotating signing keys without logging anyone out',
    });
    expect(within(reader).getByRole('heading', { level: 3 })).toHaveFocus();
    expect(within(reader).getAllByRole('listitem')).toHaveLength(4);
    expect(currentLocation(getKernel().sessions.android.windows['android:github' as WindowId]!)).toEqual(
      project('enterprise-sso'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    await settle();
    expect(within(app('github')).queryByRole('region', { name: /Rotating signing keys/ })).toBeNull();
    expect(document.querySelector('[data-and-doc="rotating-signing-keys"]')).toHaveFocus();
    // Still on the repository page: Back closed the reader only.
    expect(getKernel().sessions.android.focused).toBe('android:github');
    // The new case-study markup is axe clean (the app-level nested <main> predates this work; AND-GH-06 owns it).
    const caseStudy = within(app('github')).getByRole('heading', { name: 'Key decisions' }).closest('section')!;
    const results = await axe.run(caseStudy, { rules: { region: { enabled: false } } });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it('a project without a case study has no Case study tab', async () => {
    open('github', project('asl-gesture-recognition'));
    shell();
    await mounted('github');
    expect(within(app('github')).queryByRole('tab', { name: 'Case study' })).toBeNull();
  });
});

describe('AND-KEEP-07 the pinned Now note', () => {
  it('is first among the pinned notes, carries the data, and opens like any note', async () => {
    open('notes');
    shell();
    await mounted('keep');
    const pinned = within(app('keep')).getByRole('heading', { name: 'Pinned' }).closest('section')!;
    const cards = within(pinned).getAllByRole('button');
    expect(cards[0]).toHaveTextContent(/^Now/);
    expect(cards[0]).toHaveTextContent('Building a clean-room OAuth/OIDC provider in Go');
    fireEvent.click(cards[0]!);
    await settle();
    const note = app('keep').querySelector('article')!;
    expect(within(note).getByRole('heading', { name: 'Now' })).toBeInTheDocument();
    for (const sentence of getPerson().now!.text.split(/(?<=\.)\s+/)) expect(note).toHaveTextContent(sentence);
    expect(note).toHaveTextContent('Updated Sep 2026');
  });
});
