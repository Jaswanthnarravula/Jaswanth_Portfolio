/**
 * The welcome island (plans/02, plans/03): HELLO-TAP-01 (tap advances at once; a second tap changes nothing) ·
 * NFLX-SKIP-01 (skip, or any key, lands on the profiles with focus on the heading) · NFLX-PROF-02 (one handler: the
 * first pick wins and sends one SELECT_PERSONA) · HELLO-MUTE-01 (the toggle and its merged prefs patch) ·
 * HELLO-RETURN-01 / NFLX-RETURN-01 (a returning visitor starts on the profiles, last one pressed) · arrows move
 * between profiles · a kernel that never arrives shows the plain-portfolio way out.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Welcome } from '@/components/welcome/Welcome';
import type { KernelAction } from '@/lib/kernel/actions';
import { DEFAULT_PREFS } from '@/lib/kernel/state';
import { attachKernel, resetKernelBridge } from '@/stores/kernel-bridge';

const root = () => document.querySelector<HTMLElement>('[data-screen]')!;
const sent: KernelAction[] = [];
const attach = () =>
  attachKernel({
    dispatch: (action) => sent.push(action),
    prefs: () => ({ ...DEFAULT_PREFS, sound: { enabled: true, volume: 0.4, ui: false } }),
  });

beforeEach(() => {
  document.documentElement.dataset.motion = 'reduced'; // no greeting loop, short fades
  sent.length = 0;
});
afterEach(() => {
  resetKernelBridge();
  for (const key of ['motion', 'welcome', 'persona', 'sound']) delete document.documentElement.dataset[key];
  vi.useRealTimers();
});

describe('Hello → intro → profiles', () => {
  it('tap advances at once; a second tap changes nothing; skip lands on the focused profiles heading', async () => {
    attach();
    render(<Welcome />);
    expect(root().dataset.screen).toBe('hello');
    const pill = screen.getByRole('button', { name: /Tap to begin/ });
    fireEvent.click(pill);
    expect(root().dataset.screen).toBe('intro');
    fireEvent.click(pill);
    expect(sent.filter((a) => a.type === 'ONBOARDING_ADVANCE')).toEqual([{ type: 'ONBOARDING_ADVANCE', to: 'intro' }]);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Skip intro', hidden: true })).toHaveFocus());
    fireEvent.click(screen.getByRole('button', { name: 'Skip intro', hidden: true }));
    expect(root().dataset.screen).toBe('profiles');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Who’s watching?', hidden: true })).toHaveFocus());
    expect(sent).toContainEqual({ type: 'ONBOARDING_ADVANCE', to: 'profiles' });
  });

  it('any key during the intro skips it (Tab does not)', async () => {
    render(<Welcome />);
    fireEvent.click(screen.getByRole('button', { name: /Tap to begin/ }));
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(root().dataset.screen).toBe('intro');
    fireEvent.keyDown(window, { key: 'a' });
    await waitFor(() => expect(root().dataset.screen).toBe('profiles'));
  });

  it('the first profile picked wins: one SELECT_PERSONA, one transition', async () => {
    attach();
    render(<Welcome />);
    fireEvent.click(screen.getByRole('button', { name: /Tap to begin/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip intro', hidden: true }));
    fireEvent.click(screen.getByRole('button', { name: /^Designer/, hidden: true }));
    fireEvent.click(screen.getByRole('button', { name: /^Guest/, hidden: true }));
    expect(root().dataset.screen).toBe('leaving');
    expect(sent.filter((a) => a.type === 'SELECT_PERSONA')).toEqual([{ type: 'SELECT_PERSONA', id: 'designer' }]);
  });

  it('replay runs the intro again from the profiles', () => {
    document.documentElement.dataset.welcome = 'profiles';
    render(<Welcome />);
    fireEvent.click(screen.getByRole('button', { name: 'Replay intro', hidden: true }));
    expect(root().dataset.screen).toBe('intro');
  });
});

describe('returning visitors, sound and keyboard', () => {
  it('a returning visitor starts on the profiles with the last profile pressed', () => {
    document.documentElement.dataset.welcome = 'profiles';
    document.documentElement.dataset.persona = 'adventurer';
    render(<Welcome />);
    expect(root().dataset.screen).toBe('profiles');
    expect(screen.getByRole('button', { name: /^Adventurer/, hidden: true })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Recruiter/, hidden: true })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Sound toggles, marks the page and sends a prefs patch that keeps the volume', () => {
    render(<Welcome />);
    const sound = screen.getByRole('button', { name: 'Sound' });
    expect(sound).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(sound);
    expect(sound).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement.dataset.sound).toBe('off');
    attach(); // the queued patch is built from the live prefs when the kernel arrives
    expect(sent).toContainEqual({ type: 'SET_PREF', patch: { sound: { enabled: false, volume: 0.4, ui: false } } });
  });

  it('arrow keys move between the five profiles and wrap', () => {
    document.documentElement.dataset.welcome = 'profiles';
    render(<Welcome />);
    const recruiter = screen.getByRole('button', { name: /^Recruiter/, hidden: true });
    recruiter.focus();
    fireEvent.keyDown(recruiter, { key: 'ArrowLeft' });
    expect(screen.getByRole('button', { name: /^Guest/, hidden: true })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(recruiter).toHaveFocus();
    fireEvent.keyDown(recruiter, { key: 'ArrowDown' });
    expect(screen.getByRole('button', { name: /^Developer/, hidden: true })).toHaveFocus();
  });

  it('if the kernel never arrives after a pick, the way out is offered', async () => {
    vi.useFakeTimers();
    document.documentElement.dataset.welcome = 'profiles';
    render(<Welcome />);
    fireEvent.click(screen.getByRole('button', { name: /^Guest/, hidden: true }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6500);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('The operating systems couldn’t load.');
    expect(screen.getByRole('link', { name: 'read the plain portfolio' })).toHaveAttribute('href', '/plain');
  });
});
