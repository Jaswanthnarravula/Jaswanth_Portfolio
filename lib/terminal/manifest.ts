/**
 * The command table — linux/04 `LNX-CMD-registry`. One list generates `help`, `man`, `which`, `/usr/bin`, completion
 * and the search index's "Run in Terminal" entries, so none of them can drift. Data only (no behaviour): the search
 * chunk imports it without pulling in the engine. Behaviour lives in `commands/`, keyed by the same names.
 */

export type CommandGroup = 'explore' | 'about' | 'files' | 'system';

export interface CommandMeta {
  readonly name: string;
  readonly group: CommandGroup;
  readonly summary: string;
  readonly synopsis: string;
  /** Single-letter flags it accepts (`-l`), and long options (`--all`). */
  readonly flags?: string;
  readonly long?: readonly string[];
  /** Absent from `help`; present in completion after the second letter (easter eggs, write commands). */
  readonly hidden?: true;
  /** A shell builtin (`type cd` → "cd is a shell builtin"); others live in `/usr/bin`. */
  readonly builtin?: true;
}

export const COMMANDS: readonly CommandMeta[] = [
  // Explore
  {
    name: 'ls',
    group: 'explore',
    summary: 'list a directory',
    synopsis: 'ls [-l] [-a] [-A] [-1] [-h] [-F] [-d] [path…]',
    flags: 'laA1hFd',
  },
  { name: 'cd', group: 'explore', summary: 'change directory', synopsis: 'cd [dir | - | ~]', builtin: true },
  {
    name: 'pwd',
    group: 'explore',
    summary: 'print the current directory',
    synopsis: 'pwd',
    flags: 'LP',
    builtin: true,
  },
  {
    name: 'tree',
    group: 'explore',
    summary: 'show a directory as a tree',
    synopsis: 'tree [-L n] [-a] [path]',
    flags: 'La',
  },
  {
    name: 'find',
    group: 'explore',
    summary: 'find files by name or type',
    synopsis: 'find [path] [-name glob] [-type f|d]',
  },
  {
    name: 'grep',
    group: 'explore',
    summary: 'search text in files',
    synopsis: 'grep [-i] [-n] [-r] [-v] [-c] <pattern> [path…]',
    flags: 'inrvcRlH',
  },
  {
    name: 'open',
    group: 'explore',
    summary: 'open the résumé, a project, a role or a folder',
    synopsis: 'open <resume | path>',
  },
  { name: 'less', group: 'explore', summary: 'page through a file', synopsis: 'less <file>  ·  … | less' },
  // About me
  { name: 'whoami', group: 'about', summary: 'who this is', synopsis: 'whoami' },
  { name: 'about', group: 'about', summary: 'the overview (= cat ~/about.txt)', synopsis: 'about' },
  {
    name: 'projects',
    group: 'about',
    summary: 'the projects, featured first',
    synopsis: 'projects [--all]',
    long: ['--all'],
  },
  { name: 'experience', group: 'about', summary: 'roles, newest first', synopsis: 'experience' },
  { name: 'education', group: 'about', summary: 'schools and degrees', synopsis: 'education' },
  { name: 'skills', group: 'about', summary: 'skills by group', synopsis: 'skills [group]' },
  { name: 'contact', group: 'about', summary: 'how to reach me', synopsis: 'contact' },
  {
    name: 'resume',
    group: 'about',
    summary: 'open (or download) the résumé',
    synopsis: 'resume [--download]',
    long: ['--download'],
  },
  {
    name: 'mail',
    group: 'about',
    summary: 'write to me in your own mail app',
    synopsis: 'mail [-s subject]',
    flags: 's',
  },
  // Files
  { name: 'cat', group: 'files', summary: 'print files', synopsis: 'cat [-n] <file…>', flags: 'n' },
  {
    name: 'head',
    group: 'files',
    summary: 'first lines of a file or input',
    synopsis: 'head [-n N] [file]',
    flags: 'n',
  },
  {
    name: 'tail',
    group: 'files',
    summary: 'last lines of a file or input',
    synopsis: 'tail [-n N] [file]',
    flags: 'n',
  },
  {
    name: 'wc',
    group: 'files',
    summary: 'count lines, words and bytes',
    synopsis: 'wc [-l] [-w] [-c] [file…]',
    flags: 'lwc',
  },
  { name: 'sort', group: 'files', summary: 'sort lines', synopsis: 'sort [-r] [-n] [-u] [-f] [file]', flags: 'rnuf' },
  { name: 'uniq', group: 'files', summary: 'collapse repeated lines', synopsis: 'uniq [-c] [-d] [file]', flags: 'cd' },
  {
    name: 'echo',
    group: 'files',
    summary: 'print arguments',
    synopsis: 'echo [-n] [args…]',
    flags: 'n',
    builtin: true,
  },
  // System
  { name: 'help', group: 'system', summary: 'this list', synopsis: 'help [cmd]', builtin: true },
  { name: 'man', group: 'system', summary: 'the manual for a command', synopsis: 'man <cmd>' },
  {
    name: 'history',
    group: 'system',
    summary: 'commands you ran',
    synopsis: 'history [-c] [n]',
    flags: 'c',
    builtin: true,
  },
  { name: 'clear', group: 'system', summary: 'clear the screen (Ctrl+L)', synopsis: 'clear' },
  { name: 'which', group: 'system', summary: 'where a command lives', synopsis: 'which <cmd…>' },
  { name: 'type', group: 'system', summary: 'what kind of command it is', synopsis: 'type <cmd…>', builtin: true },
  { name: 'alias', group: 'system', summary: 'the aliases in ~/.bashrc', synopsis: 'alias [name]', builtin: true },
  { name: 'exit', group: 'system', summary: 'close this terminal', synopsis: 'exit', builtin: true },
  {
    name: 'settings',
    group: 'system',
    summary: 'show or change portfolio preferences',
    synopsis: 'settings [list | set <key> <value>]',
  },
  {
    name: 'theme',
    group: 'system',
    summary: 'choose dark, light or system theme',
    synopsis: 'theme dark|light|system',
  },
  {
    name: 'motion',
    group: 'system',
    summary: 'choose full, reduced or system motion',
    synopsis: 'motion full|reduced|system',
  },
  { name: 'sound', group: 'system', summary: 'turn interface sound on or off', synopsis: 'sound on|off' },
  { name: 'hints', group: 'system', summary: 'control contextual terminal hints', synopsis: 'hints on|off|status' },
  { name: 'search', group: 'explore', summary: 'search portfolio content', synopsis: 'search <query>' },
  { name: 'switch', group: 'system', summary: 'switch operating system', synopsis: 'switch [os]', builtin: true },
  { name: 'tour', group: 'system', summary: 'start the suggest-and-wait tour', synopsis: 'tour' },
  { name: 'legal', group: 'system', summary: 'read the legal notice', synopsis: 'legal' },
  { name: 'plain', group: 'system', summary: 'open the plain portfolio', synopsis: 'plain' },
  { name: 'date', group: 'system', summary: 'show the portfolio date', synopsis: 'date' },
  { name: 'uname', group: 'system', summary: 'show system information', synopsis: 'uname [-a]', flags: 'a' },
  { name: 'hostname', group: 'system', summary: 'show this host name', synopsis: 'hostname' },
  { name: 'uptime', group: 'system', summary: 'show career uptime', synopsis: 'uptime' },
  { name: 'id', group: 'system', summary: 'show the active user', synopsis: 'id' },
  { name: 'finger', group: 'about', summary: 'show Jaswanth and his plan', synopsis: 'finger [jaswanth]' },
  // Read-only filesystem: truthful refusals (linux/12 E6).
  { name: 'touch', group: 'files', summary: 'create a file (read-only here)', synopsis: 'touch <file…>', hidden: true },
  {
    name: 'mkdir',
    group: 'files',
    summary: 'make a directory (read-only here)',
    synopsis: 'mkdir <dir…>',
    hidden: true,
  },
  {
    name: 'rmdir',
    group: 'files',
    summary: 'remove a directory (read-only here)',
    synopsis: 'rmdir <dir…>',
    hidden: true,
  },
  { name: 'cp', group: 'files', summary: 'copy files (read-only here)', synopsis: 'cp <from> <to>', hidden: true },
  { name: 'mv', group: 'files', summary: 'move files (read-only here)', synopsis: 'mv <from> <to>', hidden: true },
  {
    name: 'chmod',
    group: 'files',
    summary: 'change modes (read-only here)',
    synopsis: 'chmod <mode> <file…>',
    hidden: true,
  },
  // Easter eggs (shared/21): hidden from help, found by the curious.
  { name: 'sudo', group: 'system', summary: 'run as someone else', synopsis: 'sudo <command>', hidden: true },
  { name: 'neofetch', group: 'system', summary: 'system information', synopsis: 'neofetch', hidden: true },
  { name: 'vim', group: 'files', summary: 'edit a file', synopsis: 'vim [file]', hidden: true },
  { name: 'vi', group: 'files', summary: 'edit a file', synopsis: 'vi [file]', hidden: true },
  { name: 'nano', group: 'files', summary: 'edit a file', synopsis: 'nano [file]', hidden: true },
  { name: 'emacs', group: 'files', summary: 'edit a file', synopsis: 'emacs [file]', hidden: true },
  { name: 'rm', group: 'files', summary: 'remove files', synopsis: 'rm [-rf] <path…>', flags: 'rfRi', hidden: true },
  { name: 'cowsay', group: 'system', summary: 'a talking cow', synopsis: 'cowsay <text>', hidden: true },
  { name: 'fortune', group: 'system', summary: 'an engineering one-liner', synopsis: 'fortune', hidden: true },
  { name: 'cmatrix', group: 'system', summary: 'falling glyphs', synopsis: 'cmatrix', hidden: true },
];

export const GROUP_TITLES: Readonly<Record<CommandGroup, string>> = {
  explore: 'Explore',
  about: 'About me',
  files: 'Files',
  system: 'System',
};

/**
 * The alias table written into `~/.bashrc` (linux/04 "Aliases"). The engine reads aliases back *from that file*, so
 * `.bashrc`, `alias`, `which` and `type` always agree (`LNX-FS-05`). `type='cat'` is PowerShell-only (added by the
 * PowerShell voice so bash's own `type` is never shadowed).
 */
export const BASHRC_ALIASES: readonly (readonly [name: string, value: string])[] = [
  ['ll', 'ls -l'],
  ['la', 'ls -la'],
  ['l', 'ls -1'],
  ['..', 'cd ..'],
  ['cls', 'clear'],
  ['dir', 'ls'],
  ['more', 'less'],
  ['cv', 'resume'],
  ['work', 'experience'],
  ['repos', 'projects'],
  ['email', 'mail'],
  ['hello', 'contact'],
  ['quit', 'exit'],
  ['logout', 'exit'],
  ['poweroff', 'exit'],
  ['h', 'help'],
  ['?', 'help'],
  ['xdg-open', 'open'],
];

export const POWERSHELL_ALIASES: readonly (readonly [name: string, value: string])[] = [['type', 'cat']];

export const commandMeta = (name: string): CommandMeta | undefined => COMMANDS.find((meta) => meta.name === name);

/** The "Run in Terminal" entries for system search (shared/15): visible commands only, never the eggs. */
export function searchableCommands(): readonly { name: string; summary: string; aliases?: readonly string[] }[] {
  return COMMANDS.filter((meta) => !meta.hidden).map((meta) => {
    const aliases = BASHRC_ALIASES.filter(([, value]) => value === meta.name).map(([alias]) => alias);
    return aliases.length
      ? { name: meta.name, summary: meta.summary, aliases }
      : { name: meta.name, summary: meta.summary };
  });
}
