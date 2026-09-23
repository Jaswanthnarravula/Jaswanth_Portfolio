import type { Line, VfsPath } from '@/lib/terminal';

export const HOME: VfsPath = ['home', 'jaswanth'];
export const HINT_IDLE_MS = 25_000;
export const HINT_RATE_MS = 60_000;
export const HINT_SESSION_CAP = 3;

export const pathLabel = (path: VfsPath): string => {
  const home = HOME.every((part, index) => path[index] === part);
  const full = home
    ? path.length === HOME.length
      ? '~'
      : `~/${path.slice(HOME.length).join('/')}`
    : `/${path.join('/')}`;
  if (full.length <= 32) return full;
  const parts = full.split('/');
  return `${parts[0]}/…/${parts.at(-1)}`;
};

export const promptText = (path: VfsPath): string => `jaswanth@portfolio:${pathLabel(path)}$ `;

export interface HintProgress {
  readonly ranHelp: boolean;
  readonly listed: boolean;
  readonly enteredDirectory: boolean;
  readonly listedProjects: boolean;
  readonly openedProject: boolean;
  readonly openedResume: boolean;
  readonly visitedExperience: boolean;
  readonly usedContact: boolean;
  readonly typo?: string;
  readonly cwd: VfsPath;
}

export interface HintSuggestion {
  readonly command: string;
  readonly sentence: string;
}

export function nextHint(state: HintProgress, featuredSlug: string | undefined): HintSuggestion {
  if (state.typo) return { command: state.typo, sentence: 'Looks like a typo.' };
  if (!state.ranHelp) return { command: 'help', sentence: 'See what this shell can do.' };
  if (!state.listed) return { command: 'ls', sentence: 'Look around — everything here is a file.' };
  if (!state.enteredDirectory) return { command: 'cd projects', sentence: 'Projects live in a folder. Step inside.' };
  if (pathLabel(state.cwd) === '~/projects' && !state.listedProjects)
    return { command: 'ls', sentence: 'List the projects.' };
  if (!state.openedProject && featuredSlug)
    return { command: `open projects/${featuredSlug}`, sentence: 'Open one in the viewer.' };
  if (!state.openedResume) return { command: 'open resume', sentence: 'The résumé is one command away.' };
  if (!state.visitedExperience) return { command: 'cd ~/experience && ls', sentence: 'Work history is a folder too.' };
  if (!state.usedContact) return { command: 'contact', sentence: 'Say hello.' };
  return { command: 'neofetch', sentence: "You've earned this." };
}

export function bootLines(contentRev: string, projects: number, roles: number): readonly string[] {
  return [
    `[    0.000000] PortfolioOS version ${contentRev} (jaswanth@portfolio)`,
    '[    0.004211] Command line: BOOT_IMAGE=/boot/career root=/dev/skills ro quiet',
    '[  OK  ] Loaded Portfolio Kernel.',
    '[  OK  ] Mounted /home/jaswanth.',
    `[  OK  ] Started Portfolio Data Layer (${projects} projects, ${roles} roles).`,
    '[  OK  ] Started Virtual Filesystem.',
    '[  OK  ] Started Command Interpreter.',
    '[  OK  ] Reached target Shell.',
  ];
}

export function motdLines(projects: number, openTo: string): readonly Line[] {
  return [
    { t: "Welcome. This is Jaswanth's portfolio — as a shell.", cls: 'dim' },
    { t: '' },
    { t: '  * résumé ready          →  open resume', insert: 'open resume' },
    {
      t: `  * ${projects} projects${' '.repeat(Math.max(1, 13 - String(projects).length))}→  cd projects && ls`,
      insert: 'cd projects && ls',
    },
    { t: `  * ${openTo}       →  contact`, insert: 'contact' },
    { t: '  * new here?             →  help        (or: tour)', insert: 'help' },
    { t: '' },
    { t: 'Tip: Tab completes, ↑ recalls, and nothing here can be broken.', cls: 'dim' },
  ];
}

export type ViewerMode = 'split' | 'overlay' | 'pager';
export const viewerMode = (width: number, cols: number): ViewerMode =>
  width < 700 ? 'pager' : width < 1100 || cols < 80 ? 'overlay' : 'split';
