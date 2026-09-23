import { describe, expect, it, vi } from 'vitest';
import { gsap } from 'gsap';
import { revealLines } from '@/components/os/shared/terminal/reveal';
import { appendBlock, scrollbackText, trim } from '@/components/os/shared/terminal/scrollback';

describe('P7 Linux imperative output model', () => {
  it('LNX-OUT-01 appends one fragment per command and trims only whole oldest blocks', () => {
    const list = document.createElement('div');
    const writes = vi.spyOn(list, 'append');
    appendBlock(list, {
      echo: { prompt: 'jaswanth@portfolio:~$ ', command: 'one' },
      lines: [{ t: 'one-a' }, { t: 'one-b' }],
      onInsert: vi.fn(),
    });
    expect(writes).toHaveBeenCalledTimes(1);
    appendBlock(list, {
      echo: { prompt: 'jaswanth@portfolio:~$ ', command: 'two' },
      lines: [{ t: 'two-a' }, { t: 'two-b' }],
      onInsert: vi.fn(),
    });
    trim(list, 4);
    expect(list.querySelectorAll('[data-block]')).toHaveLength(1);
    expect(scrollbackText(list)).toEqual(['jaswanth@portfolio:~$ two', 'two-a', 'two-b']);
  });

  it('LNX-A11Y-07 output inserts are named buttons and insert without execution', () => {
    const list = document.createElement('div');
    const insert = vi.fn();
    appendBlock(list, { echo: null, lines: [{ t: 'projects/', insert: 'cd projects/' }], onInsert: insert });
    const button = list.querySelector('button');
    expect(button).toHaveAttribute('aria-label', 'Insert command: cd projects/');
    button?.click();
    expect(insert).toHaveBeenCalledWith('cd projects/');
  });

  it('LNX-OUT-07 leaves no live timelines after 200 completed reveals', () => {
    const baseline = gsap.globalTimeline.getChildren(true, true, true).length;
    const line = document.createElement('div');
    for (let index = 0; index < 200; index += 1) revealLines([line], false)?.finish();
    expect(gsap.globalTimeline.getChildren(true, true, true)).toHaveLength(baseline);
  });
});
