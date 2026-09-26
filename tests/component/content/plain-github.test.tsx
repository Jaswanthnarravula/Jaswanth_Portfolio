/**
 * ROUTE-PLAIN-01 reader GitHub panel: the contribution calendar draws every day with GitHub's own levels (or computed
 * quarters for older snapshots), labels months like the profile page, and names the total for assistive technology.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ContributionGraph, contributionLevel, monthLabels } from '@/app/plain/ContributionGraph';

describe('ROUTE-PLAIN-01 contribution graph', () => {
  it('levels: 0 for none, then quarters of the busiest day', () => {
    expect(contributionLevel(0, 12)).toBe(0);
    expect(contributionLevel(1, 12)).toBe(1);
    expect(contributionLevel(6, 12)).toBe(2);
    expect(contributionLevel(9, 12)).toBe(3);
    expect(contributionLevel(12, 12)).toBe(4);
    expect(contributionLevel(3, 0)).toBe(0);
  });

  it('month labels sit over the first week of each month; a label too close to the next gives way', () => {
    // 2025-09-21 is a Sunday: Sep (week 0), Oct starts in week 2, Nov in week 6.
    const labels = monthLabels('2025-09-21', 8);
    expect(labels).toEqual(['Sep', '', 'Oct', '', '', '', 'Nov', '']);
    // A Wednesday start: week 0 is Sep 24, week 1 starts Sep 28, week 2 Oct 5 → "Sep" at 0, "Oct" at 2.
    expect(monthLabels('2025-09-24', 3)).toEqual(['Sep', '', 'Oct']);
    // Sep 28 start: week 1 is already October → the September label gives way.
    expect(monthLabels('2025-09-28', 3)).toEqual(['', 'Oct', '']);
  });

  it('draws every day with GitHub levels and labels the total', () => {
    const weeks = [[0, 2, 4], ...Array.from({ length: 51 }, () => [0, 1, 2, 3, 4, 5, 8]), [1, 0]];
    const levels = weeks.map((week) => week.map((count) => Math.min(4, count)));
    const total = 975;
    const { container } = render(<ContributionGraph contributions={{ total, weeks, levels, start: '2025-09-24' }} />);
    const graph = screen.getByRole('img', { name: '975 contributions in the last year' });
    expect(graph.querySelectorAll('[data-level]')).toHaveLength(weeks.flat().length);
    const first = graph.querySelector('[data-first]')!;
    expect(first.children).toHaveLength(3);
    expect(first.children[2]).toHaveAttribute('data-level', '4');
    expect(container).toHaveTextContent('Sep');
    expect(screen.getByRole('link', { name: /Learn how GitHub counts contributions/ })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
  });
});
