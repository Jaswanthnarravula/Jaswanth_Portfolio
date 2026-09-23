import { describe, expect, it } from 'vitest';
import {
  bootLines,
  HOME,
  motdLines,
  nextHint,
  pathLabel,
  promptText,
  viewerMode,
  type HintProgress,
} from '@/components/os/linux/model';

const progress = (patch: Partial<HintProgress> = {}): HintProgress => ({
  ranHelp: false,
  listed: false,
  enteredDirectory: false,
  listedProjects: false,
  openedProject: false,
  openedResume: false,
  visitedExperience: false,
  usedContact: false,
  cwd: HOME,
  ...patch,
});

describe('P7 Linux presentation model', () => {
  it('LNX-ID-01 formats the authentic prompt and collapses long paths', () => {
    expect(promptText(HOME)).toBe('jaswanth@portfolio:~$ ');
    expect(promptText([...HOME, 'projects'])).toBe('jaswanth@portfolio:~/projects$ ');
    expect(pathLabel(['usr', 'local', 'share', 'a-very-long-portfolio-directory'])).toBe(
      '/…/a-very-long-portfolio-directory',
    );
  });

  it('LNX-HINT-03 selects every contextual progression without executing anything', () => {
    expect(nextHint(progress(), 'featured').command).toBe('help');
    expect(nextHint(progress({ ranHelp: true }), 'featured').command).toBe('ls');
    expect(nextHint(progress({ ranHelp: true, listed: true }), 'featured').command).toBe('cd projects');
    expect(
      nextHint(
        progress({ ranHelp: true, listed: true, enteredDirectory: true, cwd: [...HOME, 'projects'] }),
        'featured',
      ).command,
    ).toBe('ls');
    expect(
      nextHint(
        progress({
          ranHelp: true,
          listed: true,
          enteredDirectory: true,
          listedProjects: true,
          cwd: [...HOME, 'projects'],
        }),
        'featured',
      ).command,
    ).toBe('open projects/featured');
    expect(nextHint(progress({ typo: 'projects' }), 'featured')).toEqual({
      command: 'projects',
      sentence: 'Looks like a typo.',
    });
  });

  it('LNX-BOOT-01/03 uses real counts and exposes insert-only MOTD commands', () => {
    expect(bootLines('abc123', 4, 2).join('\n')).toContain('4 projects, 2 roles');
    const motd = motdLines(4, 'Open to work');
    expect(motd.find((line) => line.insert === 'open resume')?.t).toContain('résumé');
    expect(motd.find((line) => line.insert === 'cd projects && ls')?.t).toContain('4 projects');
  });

  it('LNX-RESP-01 chooses pager, overlay and split modes', () => {
    expect(viewerMode(390, 44)).toBe('pager');
    expect(viewerMode(900, 100)).toBe('overlay');
    expect(viewerMode(1440, 120)).toBe('split');
    expect(viewerMode(1440, 60)).toBe('overlay');
  });
});
