/**
 * Easter-egg commands — shared/21 (`EGG-SUDO-01`, `EGG-NEO-01`, `EGG-VIM-01`, `EGG-RMRF-01`, `EGG-COW-01`,
 * `EGG-MATRIX-01`). Dry, brief, never blocking: each one prints a few lines (or opens the calm vim buffer, which any of
 * `:q` / `:q!` / `:wq` / Esc leaves) and reports an `egg` effect so the host can count it once.
 */
import { wrap } from '@/components/content/format';
import { dim, err, line, padEnd, spansLine } from '../format';
import type { Command, Line } from '../types';
import { fail, ok } from './args';

export const EGG_IDS = {
  sudo: 'EGG-SUDO-01',
  neofetch: 'EGG-NEO-01',
  vim: 'EGG-VIM-01',
  rmrf: 'EGG-RMRF-01',
  cow: 'EGG-COW-01',
  matrix: 'EGG-MATRIX-01',
} as const;

export const sudo: Command = (args, ctx) => {
  const command = args.join(' ').trim();
  if (command !== 'hire-me' && command !== 'hire me')
    return fail([err(command ? 'sudo: permission denied — and none needed.' : 'usage: sudo <command>')]);
  const { contact } = ctx.data;
  return ok(
    [
      dim('[sudo] password for recruiter: ********'),
      line('✓ Offer accepted.', 'ok'),
      line(''),
      ...wrap(`${ctx.data.person.openTo} The fastest way to start:`, ctx.cols).map((t) => line(t)),
      spansLine([{ t: '  ' }, { t: contact.email, href: `mailto:${contact.email}` }]),
      ...contact.links.map((link) => spansLine([{ t: '  ' }, { t: link.url, href: link.url }])),
    ],
    [{ k: 'egg', id: EGG_IDS.sudo }],
  );
};

const MONOGRAM = ['   _____ ', '  |_   _|', '    | |  ', ' _  | |  ', '| |_| |  ', ' \\___/   '];

export const neofetch: Command = (_args, ctx) => {
  const { person, skills, education, experience, projects } = ctx.data;
  const languages = skills.find((group) => group.id === 'languages') ?? skills[0];
  const current = experience.find((role) => role.end === 'present');
  const rows: [string, string][] = [
    ['OS', 'PortfolioOS'],
    ['Host', person.name],
    ['Role', current?.role ? `${current.role} @ ${current.company}` : person.role],
    ['Location', person.location],
    ['Projects', String(projects.length)],
  ];
  if (languages)
    rows.push([
      'Languages',
      languages.items
        .slice(0, 5)
        .map((item) => item.name)
        .join(', '),
    ]);
  if (education[0]) rows.push(['Education', `${education[0].degree}, ${education[0].shortName}`]);
  const title = `jaswanth@portfolio`;
  const info: Line[] = [
    line(title, 'head'),
    line('─'.repeat(title.length), 'dim'),
    ...rows.map(([key, value]) => spansLine([{ t: `${key}: `, cls: 'head' }, { t: value }])),
  ];
  const lines: Line[] = [];
  const height = Math.max(MONOGRAM.length, info.length);
  for (let i = 0; i < height; i++) {
    const art = MONOGRAM[i] ?? ' '.repeat(9);
    const right = info[i];
    if (ctx.cols < 50) continue;
    lines.push(
      spansLine([
        { t: `${art}   `, cls: 'ok' },
        ...(right?.spans ?? (right ? [{ t: right.t, ...(right.cls ? { cls: right.cls } : {}) }] : [])),
      ]),
    );
  }
  return ok(ctx.cols < 50 ? info : lines, [{ k: 'egg', id: EGG_IDS.neofetch }]);
};

function editor(name: string): Command {
  return (args) =>
    ok(
      [],
      [
        { k: 'egg', id: EGG_IDS.vim },
        {
          k: 'pager',
          variant: 'vim',
          title: args[0] ? `${name} ${args[0]}` : name,
          lines: [
            line('~'),
            line('~'),
            line('~              Good luck exiting.', 'dim'),
            line('~'),
            line('~       type  :q  and press Enter to leave', 'dim'),
            line('~       (:q!  :wq  and Esc work too)', 'dim'),
            line('~'),
          ],
        },
      ],
    );
}
export const vim = editor('vim');
export const vi = editor('vi');
export const nano = editor('nano');
export const emacs = editor('emacs');

export const rm: Command = (args) => {
  const operands = args.filter((arg) => !arg.startsWith('-'));
  const recursive = args.some((arg) => /^-[a-zA-Z]*[rR]/.test(arg));
  // `~` has already expanded to /home/jaswanth; a trailing slash changes nothing.
  const career = new Set(['', '/*', '~', '/home', '/home/jaswanth', '/home/jaswanth/*']);
  if (recursive && operands.some((operand) => career.has(operand.replace(/\/+$/, ''))))
    return fail([err('rm: refusing to delete a career in progress')], 1, [{ k: 'egg', id: EGG_IDS.rmrf }]);
  if (operands.length === 0) return fail([err('rm: missing operand')], 1);
  return fail(operands.map((operand) => err(`rm: cannot remove '${operand}': Read-only file system`)));
};

export function cowsayLines(message: string, cols: number): Line[] {
  const textWidth = Math.max(10, Math.min(40, cols - 6));
  const body = wrap(message || 'Moo.', textWidth);
  const widest = Math.max(...body.map((value) => [...value].length));
  const top = ` ${'_'.repeat(widest + 2)}`;
  const bottom = ` ${'-'.repeat(widest + 2)}`;
  const middle =
    body.length === 1
      ? [`< ${padEnd(body[0]!, widest)} >`]
      : body.map((value, index) => {
          const [open, close] = index === 0 ? ['/', '\\'] : index === body.length - 1 ? ['\\', '/'] : ['|', '|'];
          return `${open} ${padEnd(value, widest)} ${close}`;
        });
  return [
    top,
    ...middle,
    bottom,
    '        \\   ^__^',
    '         \\  (oo)\\_______',
    '            (__)\\       )\\/\\',
    '                ||----w |',
    '                ||     ||',
  ].map((value) => line(value));
}

export const cowsay: Command = (args, ctx) =>
  ok(cowsayLines(args.join(' '), ctx.cols), [{ k: 'egg', id: EGG_IDS.cow }]);

export const FORTUNES: readonly string[] = [
  'There are two hard things in computer science: cache invalidation, naming things, and off-by-one errors.',
  'Make it work, make it right, make it fast — in that order.',
  'The fastest code is the code that never runs.',
  'An idempotent retry is a kindness to your future self.',
  'It is always DNS. Except when it is the clock.',
];

export const fortune: Command = (_args, ctx) => {
  const pick = FORTUNES[ctx.history.length % FORTUNES.length]!;
  return ok(
    wrap(pick, ctx.cols).map((value) => line(value)),
    [{ k: 'egg', id: EGG_IDS.cow }],
  );
};

/** The falling-glyph animation belongs to the Linux terminal tile (P7); every host shows this calm static line. */
export const cmatrix: Command = () =>
  ok(
    [dim('Wake up, Neo… (the rain is off here — nothing flashes in this terminal)')],
    [{ k: 'egg', id: EGG_IDS.matrix }],
  );
