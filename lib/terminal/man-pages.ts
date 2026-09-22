/**
 * Manual text for `man` (linux/04 `LNX-CMD-man`): DESCRIPTION and EXAMPLES per command. NAME and SYNOPSIS come from
 * the command table, so a page can never describe a different synopsis than `help` shows.
 */
export const MAN_PAGES: Readonly<
  Record<string, { readonly description: string; readonly examples: readonly string[] }>
> = {
  ls: {
    description:
      'List directory contents. Directories are blue, programs cyan, the résumé magenta. -l shows mode, links, owner, group, size and date; -a includes dotfiles; -h prints human sizes; -1 prints one entry per line.',
    examples: ['ls', 'ls -la ~', 'ls -lh projects'],
  },
  cd: {
    description: 'Change the working directory. With no argument, go home. "cd -" returns to the previous directory.',
    examples: ['cd projects', 'cd ..', 'cd -', 'cd ~/experience'],
  },
  pwd: { description: 'Print the absolute path of the working directory.', examples: ['pwd'] },
  tree: {
    description: 'Print a directory and everything below it as a tree. -L limits the depth; -a includes dotfiles.',
    examples: ['tree', 'tree -L 1', 'tree projects'],
  },
  find: {
    description:
      'Walk a directory tree and print every path that matches. -name takes a glob; -type f or d filters files or directories.',
    examples: ['find . -name "*.md"', 'find projects -type f'],
  },
  grep: {
    description:
      'Print lines that match a pattern. -i ignores case, -n numbers lines, -r searches directories, -v inverts the match, -c counts. Exits 1 when nothing matches.',
    examples: ['grep -r Go .', 'grep -in kubernetes projects', 'cat about.txt | grep -i backend'],
  },
  open: {
    description:
      'Open something in its own app: the résumé, a project, a role or a school opens its viewer; a folder opens in the file manager (Linux: changes into it and lists it); other text files open in the pager.',
    examples: ['open resume', 'open projects/<name>', 'open .'],
  },
  less: {
    description: 'Page through text. Space or b pages, / searches, g and G jump to the top and bottom, q quits.',
    examples: ['less about.txt', 'grep -r Go . | less'],
  },
  whoami: { description: 'Print the user name, then who that is.', examples: ['whoami'] },
  about: { description: 'The overview: the same text as ~/about.txt.', examples: ['about'] },
  projects: {
    description: 'A table of the projects, featured first. --all also lists public repositories not tied to a project.',
    examples: ['projects', 'projects --all', 'cd projects && ls'],
  },
  experience: { description: 'Every role, newest first, with dates and a one-line summary.', examples: ['experience'] },
  education: { description: 'Schools, degrees and dates.', examples: ['education'] },
  skills: {
    description: 'Skills by group. Give a group name to show only that group.',
    examples: ['skills', 'skills backend'],
  },
  contact: { description: 'Every way to reach me. "mail" opens your own mail app.', examples: ['contact', 'mail'] },
  resume: {
    description: 'Open the résumé. --download saves the PDF instead.',
    examples: ['resume', 'resume --download'],
  },
  mail: {
    description:
      'Hand a new message to your own mail app (a mailto: link — nothing is sent from here). -s sets the subject.',
    examples: ['mail', 'mail -s "Hello"'],
  },
  cat: {
    description: 'Print files one after another. -n numbers the lines.',
    examples: ['cat about.txt', 'cat -n skills.txt'],
  },
  head: {
    description: 'Print the first lines (10 by default) of a file or of piped input.',
    examples: ['head -n 3 about.txt', 'ls | head -2'],
  },
  tail: {
    description: 'Print the last lines (10 by default) of a file or of piped input.',
    examples: ['tail -n 5 skills.txt'],
  },
  wc: {
    description: 'Count lines, words and bytes. -l, -w and -c pick one.',
    examples: ['wc about.txt', 'ls | wc -l'],
  },
  sort: {
    description: 'Sort lines. -r reverses, -n compares numbers, -u drops duplicates, -f ignores case.',
    examples: ['ls | sort -r'],
  },
  uniq: {
    description: 'Collapse adjacent repeated lines. -c prefixes counts.',
    examples: ['cat skills.txt | sort | uniq -c'],
  },
  echo: { description: 'Print the arguments after expansion.', examples: ['echo $HOME', 'echo "cwd: $PWD"'] },
  help: { description: 'List the commands, grouped. "help cmd" summarises one.', examples: ['help', 'help grep'] },
  man: { description: 'Show the manual page for a command.', examples: ['man ls'] },
  history: {
    description: 'List the commands you ran this session, numbered. -c clears the list; !n runs number n again.',
    examples: ['history', '!!', '!3'],
  },
  clear: { description: 'Clear the screen. Ctrl+L does the same.', examples: ['clear'] },
  which: { description: 'Print where a command lives, or its alias.', examples: ['which ls', 'which ll'] },
  type: { description: 'Say whether a name is an alias, a builtin or a program.', examples: ['type cd', 'type ll'] },
  alias: {
    description: 'List the aliases defined in ~/.bashrc. The filesystem is read-only, so new ones cannot be saved.',
    examples: ['alias', 'alias ll'],
  },
  exit: { description: 'Close this terminal.', examples: ['exit'] },
};
