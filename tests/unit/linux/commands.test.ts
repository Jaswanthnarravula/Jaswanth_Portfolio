import { describe, expect, it } from 'vitest';
import { sh, texts } from '../terminal/helpers';

describe('P7 Linux system commands', () => {
  it('LNX-CMD-settings/theme/motion/sound/hints return validated preference effects', () => {
    expect(sh('theme dark').effects).toEqual([{ k: 'pref', key: 'theme', value: 'dark' }]);
    expect(sh('motion reduced').effects).toEqual([{ k: 'pref', key: 'motion', value: 'reduced' }]);
    expect(sh('sound off').effects).toEqual([{ k: 'pref', key: 'sound', value: 'off' }]);
    expect(sh('hints on').effects).toEqual([{ k: 'pref', key: 'hints', value: 'on' }]);
    expect(sh('settings set textsize 125').effects).toEqual([{ k: 'pref', key: 'textScale', value: 1.25 }]);
    expect(sh('theme neon').exitCode).toBe(2);
    expect(sh('settings set textsize 999').exitCode).toBe(2);
  });

  it('LNX-CMD-search prints insertable shared facts and never opens them', () => {
    const run = sh('search rocket');
    expect(texts(run.lines).join('\n')).toContain('projects/rocket.md');
    expect(run.lines.flatMap((line) => line.spans ?? []).find((span) => span.insert)).toMatchObject({
      insert: 'open projects/rocket',
    });
    expect(run.effects).toEqual([]);
    expect(sh('search definitely-missing').exitCode).toBe(1);
  });

  it('LNX-CMD-switch/tour/legal and system identity commands have their P7 effects', () => {
    expect(sh('switch macos').effects).toEqual([{ k: 'switch-os', to: 'macos' }]);
    expect(sh('switch chooser').effects).toEqual([{ k: 'switch-os' }]);
    expect(sh('tour').effects).toEqual([{ k: 'tour' }]);
    expect(sh('legal').effects[0]).toMatchObject({ k: 'pager', title: 'legal' });
    expect(texts(sh('uname -a').lines)[0]).toContain('GNU/Linux');
    expect(texts(sh('hostname').lines)).toEqual(['portfolio']);
    expect(texts(sh('id').lines)[0]).toContain('uid=1000(jaswanth)');
    expect(texts(sh('finger').lines).join('\n')).toContain('Ada Example');
  });

  it('LNX-CMD-plain/date/uptime use explicit navigation and data-derived values', () => {
    expect(sh('plain').effects).toEqual([{ k: 'plain' }]);
    expect(texts(sh('date').lines)).toEqual(['Thu, 01 Jan 2026 09:41:00 GMT']);
    expect(texts(sh('uptime').lines)).toEqual(['up 6 years, 1 user']);
  });
});
