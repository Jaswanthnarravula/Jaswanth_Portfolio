/**
 * NFLX-INTRO-01 "input always wins" on a slow device: the intro ends on the wall clock counted from the tap, even when
 * the motion timeline lags (GSAP lag-smooths long frames) or never completes. The deadline finishes the timeline, so
 * its own end state and hand-over run exactly once.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Welcome } from '@/components/welcome/Welcome';

const intro = vi.hoisted(() => ({ finished: 0 }));

vi.mock('@/components/welcome/motion', () => ({
  // A timeline stuck on a janky device: it never completes by itself; finish() lands its end state.
  playIntro: (_wordmark: Element, { onDone }: { onDone: () => void }) => ({
    finish: () => {
      intro.finished += 1;
      onDone();
    },
    kill: () => undefined,
  }),
  profilesEntrance: () => ({ finish: () => undefined, kill: () => undefined }),
  greetingLoop: () => () => undefined,
  handOff: () => Promise.resolve(new DOMRect()),
}));

const root = () => document.querySelector<HTMLElement>('[data-screen]')!;

beforeEach(() => {
  document.documentElement.dataset.motion = 'reduced'; // an 800 ms intro keeps the test short
  intro.finished = 0;
});
afterEach(() => {
  for (const key of ['motion', 'welcome', 'persona', 'sound']) delete document.documentElement.dataset[key];
});

describe('the intro deadline', () => {
  it('hands over to the profiles on time although the timeline never completes', async () => {
    render(<Welcome />);
    fireEvent.click(screen.getByRole('button', { name: /Tap to begin/ }));
    const tappedAt = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(root().dataset.screen).toBe('intro'); // not cut short
    await waitFor(() => expect(root().dataset.screen).toBe('profiles'), { timeout: 1500 });
    expect(performance.now() - tappedAt).toBeLessThan(1300);
    expect(intro.finished).toBe(1); // the timeline was finished, once
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Who’s watching?', hidden: true })).toHaveFocus());
  });
});
