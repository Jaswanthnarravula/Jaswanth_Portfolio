/**
 * CHOOSE-REL-01 (the chooser renders the released set — exactly the OSes it is given, nothing else) ·
 * CHOOSE-BADGE-01 (one badge, identical for every PersonaId) · CHOOSE-CARD-01 (cards are links named
 * "{OS} — {character}", the badge part of the name; snapshots are decorative).
 */
import { render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import Chooser from '@/components/welcome/Chooser';
import { PERSONA_IDS } from '@/lib/kernel/ids';
import { VISIBLE_OSES } from '@/lib/kernel/route';
import { DEFAULT_CAPABILITIES } from '@/lib/kernel/state';
import { dispatch } from '@/stores/kernel-store';
import { prefsStore } from '@/stores/prefs-store';

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

const cards = () =>
  screen.queryAllByRole('link').filter((link) => link.hasAttribute('data-chooser-card')) as HTMLAnchorElement[];

describe('CHOOSE-REL-01 only released OSes are shown', () => {
  it('renders exactly the OSes it is given, in order, as links to /{os}', () => {
    render(<Chooser oses={['macos', 'linux']} />);
    expect(cards().map((card) => card.getAttribute('href'))).toEqual(['/macos', '/linux']);
  });
  it('defaults to the visible set, and says so plainly when nothing is released', () => {
    const { unmount } = render(<Chooser />);
    expect(cards().map((card) => card.dataset.chooserCard)).toEqual([...VISIBLE_OSES]);
    unmount();
    render(<Chooser oses={[]} />);
    expect(cards()).toEqual([]);
    expect(screen.getByText(/The operating systems open here as each one is finished/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip the OS' })).toHaveAttribute('href', '/plain');
  });
});

describe('CHOOSE-CARD-01 / CHOOSE-BADGE-01 names and the badge', () => {
  it('each card is named "{OS} — {character}"; the badge joins the name (label in name); snapshots are decorative', () => {
    render(<Chooser oses={['ios', 'macos', 'windows']} />);
    expect(screen.getByRole('link', { name: 'iOS — Tap through apps' })).toHaveAttribute('href', '/ios');
    expect(screen.getByRole('link', { name: 'macOS — A desktop of windows, suits your device' })).toHaveAttribute(
      'href',
      '/macos',
    );
    for (const card of cards())
      for (const img of within(card).queryAllByRole('img', { hidden: true })) expect(img).toHaveAttribute('alt', '');
    expect(screen.getAllByText('Suits your device')).toHaveLength(1);
  });

  it('the badge is identical for all five profiles', () => {
    const badged: (string | undefined)[] = [];
    for (const persona of PERSONA_IDS) {
      prefsStore.getState().patch({ persona });
      const { unmount } = render(<Chooser />);
      badged.push(cards().find((card) => card.textContent?.includes('Suits your device'))?.dataset.chooserCard);
      unmount();
    }
    expect(new Set(badged)).toEqual(new Set(['macos']));
  });
});
