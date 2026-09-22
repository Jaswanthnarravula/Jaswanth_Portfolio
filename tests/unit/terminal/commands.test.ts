/**
 * Commands — plans/linux/04-commands.md. Each command: `L1` golden output at 80 and 40 columns + its listed errors and
 * exit codes (LNX-CMD-*), the registry that generates help / man / which / /usr/bin / completion / search
 * (LNX-CMD-registry) and the alias set (LNX-CMD-aliases). Easter eggs (shared/21) are covered at the engine level.
 */
import { describe, expect, it } from 'vitest';
import { fixturePortfolio } from '../../fixtures/portfolio';
import { COMMAND_TABLE } from '@/lib/terminal/commands';
import { manPage } from '@/lib/terminal/commands/shell';
import { EGG_IDS } from '@/lib/terminal/commands/eggs';
import { complete } from '@/lib/terminal/completion';
import { aliasesFor } from '@/lib/terminal/engine';
import { MAN_PAGES } from '@/lib/terminal/man-pages';
import { BASHRC_ALIASES, COMMANDS, searchableCommands } from '@/lib/terminal/manifest';
import { HOME } from '@/lib/terminal/vfs';
import { buildSearchIndex } from '@/lib/search/index-builder';
import { OS_REGISTRY } from '@/lib/kernel/registry';
import { fixtureCatalog } from '../../fixtures/portfolio';
import { out, sh, texts, vfs } from './helpers';

/** Golden at both widths: a snapshot per width, and nothing wider than the terminal (except unbreakable tokens). */
function golden(input: string, cwd?: readonly string[]) {
  const wide = out(input, { cols: 80, cwd });
  const narrow = out(input, { cols: 40, cwd });
  expect({ input, wide, narrow }).toMatchSnapshot();
  return { wide, narrow };
}

describe('LNX-CMD-* golden output (80 / 40 columns)', () => {
  it('LNX-CMD-help — generated from the registry: every visible command exactly once', () => {
    const { wide } = golden('help');
    const visible = COMMANDS.filter((meta) => !meta.hidden).map((meta) => meta.name);
    for (const name of visible) expect(wide.filter((line) => line.trim().split(/\s+/)[0] === name)).toHaveLength(1);
    for (const hidden of COMMANDS.filter((meta) => meta.hidden))
      expect(wide.join('\n')).not.toMatch(new RegExp(`^  ${hidden.name} `, 'm'));
    expect(wide.at(-1)).toBe("Some commands aren't listed.");
    expect(out('help grep')).toEqual([
      'grep — search text in files',
      'Usage: grep [-i] [-n] [-r] [-v] [-c] <pattern> [path…]',
      'More: man grep',
    ]);
    expect(out('help nope')).toEqual(["help: no help topics match 'nope'"]);
  });

  it('LNX-CMD-man — a page for every command, opened in the pager (printed when piped)', () => {
    for (const meta of COMMANDS) {
      const page = manPage(meta.name)!;
      expect(texts(page).slice(0, 5)).toEqual([
        'NAME',
        `       ${meta.name} — ${meta.summary}`,
        '',
        'SYNOPSIS',
        `       ${meta.synopsis}`,
      ]);
      if (!meta.hidden) expect(MAN_PAGES[meta.name], meta.name).toBeDefined();
    }
    const run = sh('man ls');
    expect(run.lines).toEqual([]);
    expect(run.effects).toEqual([{ k: 'pager', lines: manPage('ls'), title: 'ls(1)' }]);
    expect(out('man ls | head -2')).toEqual(['NAME', '       ls — list a directory']);
    const missing = sh('man nope');
    expect(texts(missing.lines)).toEqual(['No manual entry for nope']);
    expect(missing.exitCode).toBe(16);
    expect(sh('man').exitCode).toBe(1);
  });

  it('LNX-CMD-pwd', () => {
    golden('pwd', [...HOME, 'projects']);
    expect(out('pwd -Z')).toEqual(["pwd: invalid option -- 'Z'", "Try 'man pwd' for more information."]);
  });

  it('LNX-CMD-cd — incl. -, ~ and cd into a file → Not a directory', () => {
    expect(sh('cd').state.cwd).toEqual(HOME);
    expect(sh('cd ~').state.cwd).toEqual(HOME);
    expect(sh(['cd /etc', 'cd']).state.cwd).toEqual(HOME);
    expect(out('cd about.txt')).toEqual(['bash: cd: about.txt: Not a directory']);
  });

  it('LNX-CMD-ls — column fitting at 80/40; -la fields; entries insertable', () => {
    const { wide, narrow } = golden('ls');
    expect(wide).toEqual([
      'README.md  contact.txt  experience  resume.pdf',
      'about.txt  education    projects    skills.txt',
    ]);
    expect(Math.max(...narrow.map((line) => line.length))).toBeLessThanOrEqual(40);
    golden('ls -la');
    golden('ls -F projects /usr/bin/ls');
    const cells = sh('ls')
      .lines.flatMap((line) => line.spans ?? [])
      .filter((span) => span.insert);
    expect(cells.find((span) => span.t === 'projects')).toMatchObject({ cls: 'dir', insert: 'cd projects/' });
    expect(cells.find((span) => span.t === 'about.txt')).toMatchObject({ insert: 'cat about.txt' });
    expect(cells.find((span) => span.t === 'resume.pdf')).toMatchObject({ cls: 'pdf', insert: 'open resume.pdf' });
    expect(out('ls -1 projects')).toEqual(['README.md', 'portfolio-os.md', 'rocket.md']);
    expect(out('ls projects experience')).toEqual([
      'experience:',
      'acme.md  globex.md',
      '',
      'projects:',
      'README.md  portfolio-os.md  rocket.md',
    ]);
    const both = out('ls about.txt nope');
    expect(both).toEqual(["ls: cannot access 'nope': No such file or directory", 'about.txt']);
    expect(sh('ls about.txt nope').exitCode).toBe(2);
  });

  it('LNX-CMD-tree', () => {
    golden('tree');
    golden('tree -L 1 ~');
    expect(out('tree nope')[0]).toBe('nope [error opening dir]');
    expect(out('tree -L 0')).toEqual([
      'tree: Invalid level, must be greater than 0.',
      "Try 'man tree' for more information.",
    ]);
  });

  it('LNX-CMD-cat — incl. the binary notice and cat dir → Is a directory', () => {
    golden('cat skills.txt');
    expect(out('cat resume.pdf')).toEqual(["resume.pdf: binary file — try 'open resume'"]);
    expect(out('cat projects')).toEqual(['cat: projects: Is a directory']);
    expect(out('cat -n .plan')).toEqual(['     1\tOpen to tests.']);
    expect(out('echo piped | cat')).toEqual(['piped']);
    expect(out('echo piped | cat - .plan')).toEqual(['piped', 'Open to tests.']);
    expect(out('cat /usr/bin/ls')).toEqual(["/usr/bin/ls: binary file — try 'man ls'"]);
  });

  it('LNX-CMD-head / LNX-CMD-tail — stdin and file', () => {
    expect(out('head -n 2 about.txt')).toEqual(['Ada Example', 'Engineer of examples']);
    expect(out('cat about.txt | head -1')).toEqual(['Ada Example']);
    expect(out('tail -n 1 .bashrc')).toEqual([`alias xdg-open='open'`]);
    expect(out('ls | tail -2')).toEqual(['resume.pdf', 'skills.txt']);
    expect(out('tail -n 0 about.txt')).toEqual([]);
    expect(out('head -n x about.txt')).toEqual([
      "head: invalid number of lines: 'x'",
      "Try 'man head' for more information.",
    ]);
    expect(sh('head -n').exitCode).toBe(2);
    expect(out('head nope')).toEqual(['head: nope: No such file or directory']);
  });

  it('LNX-CMD-less — pager effect (q quits in the host); prints when not the last stage', () => {
    const run = sh('less about.txt');
    expect(run.effects).toEqual([{ k: 'pager', lines: expect.any(Array), title: 'about.txt' }]);
    expect(sh('cat about.txt | less').effects[0]).toMatchObject({ k: 'pager', title: 'stdin' });
    expect(out('less about.txt | head -1')).toEqual(['Ada Example']);
    expect(out('more about.txt')).toEqual([]); // alias → less
    expect(out('less nope')).toEqual(['less: nope: No such file or directory']);
    expect(out('less')).toEqual([
      'less: missing filename ("less --help" for help)',
      "Try 'man less' for more information.",
    ]);
    expect(out('less resume.pdf')).toEqual(["resume.pdf: binary file — try 'open resume.pdf'"]);
  });

  it('LNX-CMD-grep — highlights and exit codes, -r walks the VFS', () => {
    const hit = sh('grep -n Go skills.txt');
    expect(texts(hit.lines)).toEqual(['3:Go, TypeScript']);
    expect(hit.lines[0]!.spans).toEqual([{ t: '3:', cls: 'dim' }, { t: 'Go', cls: 'match' }, { t: ', TypeScript' }]);
    expect(hit.exitCode).toBe(0);
    const none = sh('grep zzz skills.txt');
    expect(none.lines).toEqual([]);
    expect(none.exitCode).toBe(1);
    expect(out('grep -ri rocket projects')).toEqual([
      'projects/README.md:Rocket — Goes up.',
      'projects/rocket.md:Rocket',
    ]);
    expect(out('grep -c Go skills.txt')).toEqual(['1']);
    expect(out('grep -l Go -r .')).toContain('./skills.txt');
    expect(out('cat skills.txt | grep -v Go')).toEqual(['LANGUAGES', '─────────────']);
    expect(out('grep Go projects')).toEqual(['grep: projects: Is a directory']);
    expect(sh('grep Go nope').exitCode).toBe(2);
    expect(out('grep')).toEqual([
      'Usage: grep [OPTION]... PATTERNS [FILE]...',
      "Try 'grep --help' for more information.",
    ]);
    expect(sh('grep "(" .plan').exitCode).toBe(1); // an invalid regex matches literally
    expect(out('grep -r x ~/.ssh')[0]).toBe('grep: /home/jaswanth/.ssh: Permission denied');
  });

  it('LNX-CMD-find — -name / -type', () => {
    golden('find projects');
    expect(out('find . -name "*.txt"')).toEqual([
      "find: './.ssh': Permission denied",
      './about.txt',
      './contact.txt',
      './skills.txt',
    ]);
    expect(out('find ~ -type d -name "e*"')).toEqual([
      "find: '/home/jaswanth/.ssh': Permission denied",
      '/home/jaswanth/education',
      '/home/jaswanth/experience',
    ]);
    expect(out('find nope')).toEqual(["find: 'nope': No such file or directory"]);
    expect(out('find -type x')).toEqual(['find: Unknown argument to -type: x', "Try 'man find' for more information."]);
    expect(out('find . -type d')).toContain("find: './.ssh': Permission denied");
  });

  it('LNX-CMD-wc — counts', () => {
    expect(out('wc -l .plan')).toEqual(['1 .plan']);
    expect(out('echo one two | wc')).toEqual(['1 2 8']);
    expect(out('ls | wc -l')).toEqual(['8']);
    expect(out('wc .plan .bashrc').at(-1)).toMatch(/ total$/);
  });

  it('LNX-CMD-sort / LNX-CMD-uniq', () => {
    expect(out('ls | sort -r | head -3')).toEqual(['skills.txt', 'resume.pdf', 'projects']);
    expect(out('ls /usr/bin | sort | uniq | wc -l')).toEqual(out('ls /usr/bin | wc -l'));
    const doubled = sh('cat .plan .plan | uniq -c');
    expect(texts(doubled.lines)).toEqual(['      2 Open to tests.']);
    expect(out('cat .plan .plan | sort -u')).toEqual(['Open to tests.']);
    expect(out('cat .plan .plan | uniq -d')).toEqual(['Open to tests.']);
  });

  it('LNX-CMD-echo — expansion applied', () => {
    expect(out('echo $HOME "$USER" \'$USER\' ~')).toEqual(['/home/jaswanth jaswanth $USER /home/jaswanth']);
    expect(out('echo -n hi')).toEqual(['hi']);
    expect(out('echo')).toEqual(['']);
  });

  it('LNX-CMD-open — an effect per target kind', () => {
    expect(sh('open resume').effects).toEqual([{ k: 'open', ref: 'resume' }]);
    expect(sh('open ~/resume.pdf').effects).toEqual([{ k: 'open', ref: 'resume' }]);
    expect(sh('open projects/rocket.md').effects).toEqual([
      { k: 'open', ref: { section: 'projects', slug: 'rocket' } },
    ]);
    expect(sh('open experience/acme.md').effects).toEqual([
      { k: 'open', ref: { section: 'experience', slug: 'acme' } },
    ]);
    expect(sh('open education/state-u.md').effects).toEqual([
      { k: 'open', ref: { section: 'education', slug: 'state-u' } },
    ]);
    // A directory: Linux changes into it and lists it; other OSes reveal it in their own file manager.
    const linux = sh('open projects');
    expect(linux.effects).toEqual([{ k: 'cd', to: [...HOME, 'projects'] }]);
    expect(texts(linux.lines)).toEqual(['README.md  portfolio-os.md  rocket.md']);
    expect(sh('open projects', { os: 'macos' }).effects).toEqual([
      { k: 'reveal', path: [...HOME, 'projects'], ref: { section: 'projects' } },
    ]);
    expect(sh('open .', { os: 'macos' }).effects).toEqual([{ k: 'reveal', path: HOME, ref: null }]);
    // Text without a rich view → pager.
    expect(sh('open about.txt').effects[0]).toMatchObject({ k: 'pager', title: '/home/jaswanth/about.txt' });
    expect(out('open nope')).toEqual(['open: nope: No such file or directory']);
    expect(out('open')).toEqual(['open: missing operand — try: open resume', "Try 'man open' for more information."]);
    expect(out('open .ssh')).toEqual(['open: .ssh: Permission denied']);
    expect(out('open /usr/bin/ls')).toEqual(["open: /usr/bin/ls: cannot open a program — try 'man ls'"]);
    expect(sh('xdg-open resume').effects).toEqual([{ k: 'open', ref: 'resume' }]);
  });

  it('LNX-CMD-history / LNX-CMD-clear', () => {
    expect(out(['pwd', 'history'])).toEqual(['    1  pwd', '    2  history']);
    expect(sh('clear').effects).toEqual([{ k: 'clear' }]);
  });

  it('LNX-CMD-which / LNX-CMD-type — path, alias, builtin', () => {
    expect(out('which ls ll cd')).toEqual(['/usr/bin/ls', "alias ll='ls -l'", 'cd: shell built-in command']);
    expect(sh('which nope').lines).toEqual([]);
    expect(sh('which nope').exitCode).toBe(1);
    golden('type ls ll cd');
    expect(out('type nope')).toEqual(['bash: type: nope: not found']);
  });

  it('LNX-CMD-alias — listing from .bashrc; defining is refused (read-only)', () => {
    expect(out('alias ll')).toEqual(["alias ll='ls -l'"]);
    expect(out('alias x=y')).toEqual(["alias: ~/.bashrc is on a read-only file system — 'x' was not saved"]);
    expect(out('alias nope')).toEqual(['bash: alias: nope: not found']);
  });

  it('LNX-CMD-whoami / LNX-CMD-about', () => {
    golden('whoami');
    expect(out('about')).toEqual(out('cat ~/about.txt'));
  });

  it('LNX-CMD-projects — table from data, featured first, footer insertables', () => {
    const { wide, narrow } = golden('projects');
    expect(wide[0]).toMatch(/^SLUG\s+NAME\s+STACK\s+YEAR$/);
    expect(wide[1]).toMatch(/^portfolio-os\s+Portfolio OS\s+TypeScript\s+2026$/);
    expect(narrow[0]).toMatch(/^slug\s+portfolio-os$/); // stacked under 50 columns
    const run = sh('projects');
    const footer = run.lines.at(-1)!;
    expect(footer.spans?.filter((span) => span.insert).map((span) => span.insert)).toEqual([
      'cd ~/projects && ls',
      'open ~/projects/',
    ]);
    expect(run.lines[1]!.spans?.[0]).toMatchObject({
      t: expect.stringMatching(/^portfolio-os/),
      insert: 'open ~/projects/portfolio-os.md',
    });
  });

  it('LNX-CMD-skills — groups (bars only for published levels) + filter', () => {
    golden('skills');
    expect(out('skills langs')[0]).toBe('Languages  (skills langs)');
    expect(out('skills nope')).toEqual(["skills: no group matches 'nope'", 'groups: langs']);
  });

  it('LNX-CMD-experience / LNX-CMD-education', () => {
    golden('experience');
    golden('education');
  });

  it('LNX-CMD-contact — real links', () => {
    golden('contact');
    const links = sh('contact')
      .lines.flatMap((line) => line.spans ?? [])
      .filter((span) => span.href);
    expect(links.map((span) => span.href)).toEqual(['mailto:ada@example.com', 'https://github.com/ada']);
  });

  it('LNX-CMD-resume — open / --download effects', () => {
    expect(sh('resume').effects).toEqual([{ k: 'open', ref: 'resume' }]);
    const download = sh('resume --download');
    expect(texts(download.lines)).toEqual(['saved: Ada-Resume.pdf']);
    expect(download.effects).toEqual([{ k: 'download' }]);
    expect(sh('cv').effects).toEqual([{ k: 'open', ref: 'resume' }]);
  });

  it('LNX-CMD-mail — the mailto effect (same builder as the GUI apps)', () => {
    expect(sh('mail').effects).toEqual([{ k: 'mailto' }]);
    expect(sh('mail -s "Hello there"').effects).toEqual([{ k: 'mailto', subject: 'Hello there' }]);
    expect(out('mail')).toEqual(['Handing off to your mail client…', 'ada@example.com']);
    expect(out('mail -s')).toEqual([
      "mail: option requires an argument -- 's'",
      "Try 'man mail' for more information.",
    ]);
  });

  it('LNX-CMD-exit (P3 builtin: closes the terminal)', () => {
    expect(sh('exit').effects).toEqual([{ k: 'exit' }]);
    expect(sh('quit').effects).toEqual([{ k: 'exit' }]);
  });
});

describe('LNX-CMD-registry — one table generates help, man, which, /usr/bin, completion and search entries', () => {
  it('the behaviours and the table are the same set', () => {
    expect(Object.keys(COMMAND_TABLE).sort()).toEqual(COMMANDS.map((meta) => meta.name).sort());
  });

  it('all five views agree', () => {
    const visible = COMMANDS.filter((meta) => !meta.hidden)
      .map((meta) => meta.name)
      .sort();
    const helpNames = out('help')
      .filter((line) => line.startsWith('  '))
      .map((line) => line.trim().split(/\s+/)[0]!)
      .sort();
    expect(helpNames).toEqual(visible);
    for (const name of visible) expect(manPage(name)).not.toBeNull();
    const programs = COMMANDS.filter((meta) => !meta.builtin)
      .map((meta) => meta.name)
      .sort();
    expect(out('ls /usr/bin | cat')).toEqual(programs);
    for (const name of visible) expect(sh(`which ${name}`).exitCode).toBe(0);
    const ctx = { vfs, cwd: HOME, aliases: new Map<string, string>(), cols: 80, skillGroups: [] };
    for (const name of visible) {
      const result = complete(name, name.length, ctx, true);
      const offered =
        result.kind === 'insert'
          ? [result.value.trim()]
          : result.kind === 'list'
            ? texts(result.lines).join(' ').split(/\s+/)
            : [];
      expect(offered, name).toContain(name);
    }
    const index = buildSearchIndex({
      os: 'macos',
      registry: OS_REGISTRY,
      catalog: fixtureCatalog,
      visible: ['macos'],
      commands: searchableCommands(),
    });
    expect(
      index
        .filter((entry) => entry.kind === 'command')
        .map((entry) => entry.command)
        .sort(),
    ).toEqual(visible);
    expect(index.find((entry) => entry.id === 'command:ls')?.subtitle).toBe('Run in Terminal');
  });
});

describe('LNX-CMD-aliases — each alias resolves as listed', () => {
  it.each(BASHRC_ALIASES.map(([name, value]) => [name, value] as const))('%s → %s', (name, value) => {
    const viaAlias = sh(name === '..' ? ['cd projects', name] : name);
    const direct = sh(name === '..' ? ['cd projects', value] : value);
    expect(texts(viaAlias.lines)).toEqual(texts(direct.lines));
    expect(viaAlias.effects).toEqual(direct.effects);
    expect(aliasesFor(vfs, 'bash').get(name)).toBe(value);
  });
});

describe('shared/21 easter-egg commands (engine level; counted by the host through `egg` effects)', () => {
  it('EGG-SUDO-01 sudo hire-me — offer block with contact links; other sudo → permission denied', () => {
    const run = sh('sudo hire-me');
    expect(texts(run.lines)[0]).toBe('[sudo] password for recruiter: ********');
    expect(texts(run.lines)).toContain('✓ Offer accepted.');
    expect(run.effects).toEqual([{ k: 'egg', id: EGG_IDS.sudo }]);
    expect(out('sudo ls')).toEqual(['sudo: permission denied — and none needed.']);
  });

  it('EGG-NEO-01 neofetch — facts from data', () => {
    const run = sh('neofetch');
    expect(texts(run.lines).join('\n')).toContain(`Host: ${fixturePortfolio.person.name}`);
    expect(run.effects).toEqual([{ k: 'egg', id: EGG_IDS.neofetch }]);
    expect(out('neofetch', { cols: 40 })[0]).toBe('jaswanth@portfolio');
  });

  it('EGG-VIM-01 vim / vi — the calm buffer', () => {
    const run = sh('vim notes.txt');
    expect(run.effects[0]).toEqual({ k: 'egg', id: EGG_IDS.vim });
    expect(run.effects[1]).toMatchObject({ k: 'pager', variant: 'vim', title: 'vim notes.txt' });
    expect(texts((run.effects[1] as unknown as { lines: [] }).lines)).toContain('~              Good luck exiting.');
  });

  it('EGG-RMRF-01 rm -rf / — refuses; nothing changes', () => {
    const run = sh('rm -rf /');
    expect(texts(run.lines)).toEqual(['rm: refusing to delete a career in progress']);
    expect(run.effects).toEqual([{ k: 'egg', id: EGG_IDS.rmrf }]);
    expect(sh('rm -rf ~').effects).toEqual([{ k: 'egg', id: EGG_IDS.rmrf }]);
    expect(out('rm')).toEqual(['rm: missing operand']);
  });

  it('EGG-COW-01 cowsay / fortune', () => {
    expect(out('cowsay hello')).toMatchSnapshot();
    expect(
      out('cowsay a long message that must wrap across more than one line of the bubble', { cols: 40 }),
    ).toMatchSnapshot();
    expect(sh('fortune').effects).toEqual([{ k: 'egg', id: EGG_IDS.cow }]);
    expect(sh('cmatrix').effects).toEqual([{ k: 'egg', id: EGG_IDS.matrix }]);
  });
});

describe('narrow terminals (40 columns): every golden fits', () => {
  it.each([
    'help',
    'ls',
    'ls -la',
    'tree',
    'projects',
    'experience',
    'education',
    'skills',
    'contact',
    'whoami',
    'cat about.txt',
    'neofetch',
    'cowsay a long message that keeps going for a while',
  ])('%s', (input) => {
    for (const line of out(input, { cols: 40 })) expect([...line].length, line).toBeLessThanOrEqual(40);
  });
});
