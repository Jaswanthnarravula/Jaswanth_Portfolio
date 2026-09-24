/**
 * CHOOSE-REL-01 (the chooser renders the released set — exactly the OSes it is given, nothing else) ·
 * CHOOSE-BADGE-01 (recommendation badge removed) · CHOOSE-CARD-01 (cards are links named
 * "{OS} — {character}"; snapshots are decorative).
 */
import { render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import Chooser from '@/components/welcome/Chooser';
import { OS_IDS } from '@/lib/kernel/ids';
import { DEFAULT_CAPABILITIES } from '@/lib/kernel/state';
import { dispatch } from '@/stores/kernel-store';

beforeAll(() => {
  dispatch({
    type: 'BOOT',
    url: '/',
    navType: 'navigate',
    viewport: { w: 1440, h: 900, pointer: 'fine' },
    persisted: null,
    capabilities: { ...DEFAULT_CAPABILITIES, pointer: 'fine', hover: true, deviceClass: 'desktop' },
  });
});

const cards = () => [...document.querySelectorAll<HTMLElement>('[data-chooser-card]')];

describe('CHOOSE-REL-01 only released OSes are shown', () => {
  it('renders exactly the OS preview cards it is given, in order; visible OSes can be entered', () => {
    render(<Chooser oses={['macos', 'linux']} />);
    expect(cards().map((card) => card.dataset.chooserCard)).toEqual(['macos', 'linux']);
    // This environment previews every OS (NEXT_PUBLIC_OS_PREVIEW=all), so each card is a live link.
    expect(cards().some((card) => card.getAttribute('aria-disabled') === 'true')).toBe(false);
    expect(screen.queryByText('Coming soon')).toBeNull();
  });
  it('by default shows the visible set (released + previewed): all five in a preview build', () => {
    const { unmount } = render(<Chooser />);
    expect(document.querySelectorAll('[data-chooser-card]')).toHaveLength(OS_IDS.length);
    unmount();
    render(<Chooser oses={[]} />);
    expect(document.querySelectorAll('[data-chooser-card]')).toHaveLength(0);
    expect(screen.getByText(/The operating systems open here as each one is finished/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip the OS' })).toHaveAttribute('href', '/plain');
  });

  it('does not ask GSAP to animate cards when no OS is released', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(<Chooser oses={[]} />);
    expect(warning).not.toHaveBeenCalledWith(expect.stringContaining('GSAP target'));
    warning.mockRestore();
  });
});

describe('CHOOSE-CARD-01 / CHOOSE-BADGE-01 neutral card names', () => {
  it('each card is named "{OS} — {character}", has no recommendation badge, and snapshots are decorative', () => {
    render(<Chooser oses={['ios', 'macos', 'windows']} />);
    expect(screen.getByRole('link', { name: 'iOS — Tap through apps' })).toHaveAttribute('href', '/ios');
    expect(screen.getByRole('link', { name: 'macOS — A desktop of windows' })).toHaveAttribute('href', '/macos');
    for (const card of cards())
      for (const img of within(card).queryAllByRole('img', { hidden: true })) expect(img).toHaveAttribute('alt', '');
    expect(screen.queryByText('Suits your device')).not.toBeInTheDocument();
  });
});
