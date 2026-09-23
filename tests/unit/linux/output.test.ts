import { describe, expect, it } from 'vitest';
import { REVEAL, staggerFor } from '@/components/os/shared/terminal/reveal';
import { announcement } from '@/components/os/shared/terminal/scrollback';

describe('P7 Linux output invariants', () => {
  it('LNX-OUT-02 keeps every animated reveal within 240 ms and skips huge output', () => {
    expect(REVEAL).toMatchObject({ lineS: 0.09, staggerS: 0.012, capS: 0.24, animated: 24, skipAbove: 200 });
    for (let count = 1; count <= REVEAL.animated; count += 1) {
      const duration = REVEAL.lineS + staggerFor(count) * (count - 1);
      expect(duration).toBeLessThanOrEqual(REVEAL.capS);
    }
  });

  it('LNX-OUT-06 announces errors immediately and summarizes output longer than ten lines', () => {
    expect(announcement('cat nope', [{ t: 'cat: nope: No such file or directory', cls: 'err' }])).toBe(
      'Error: cat: nope: No such file or directory',
    );
    const long = Array.from({ length: 11 }, (_, index) => ({ t: `line ${index + 1}` }));
    expect(announcement('help', long)).toBe('help: 11 lines. line 1');
  });
});
