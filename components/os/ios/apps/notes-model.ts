/**
 * Notes — pure formatters that turn the portfolio into notes (plans/ios/apps/notes.md "Portfolio mapping",
 * `IOS-NOTES-02`). Nothing here is typed by hand: every fact arrives as an argument (the app passes `data/selectors`
 * output), so a note can never drift from the data (north-star B9). The only literals are the notes' own UI words.
 *
 *   📌 Skills            SkillGroup[] → a heading per group, each skill a checklist line (+ a 5-dot meter and years only
 *                        when the owner published them — never inferred)
 *   📌 How I work        person summary (paragraphs) + recurring highlights: the lead highlight of each role, and the
 *                        tools that recur across roles and projects
 *   Stack by project     projects × stack → a table (project → technologies)
 *   Currently learning   skills with a published level ≤ 2 → bullets; absent when there are none
 *
 * React-free, DOM-free: the app renders the blocks; unit tests snapshot them.
 */
import type { Experience, Person, Project, SkillGroup } from '@/data/schema';

export type NoteId = 'skills' | 'how-i-work' | 'stack' | 'learning';

export interface SkillLine {
  readonly name: string;
  readonly level?: number;
  readonly years?: number;
}

export type NoteBlock =
  | { readonly kind: 'heading'; readonly text: string }
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'bullets'; readonly items: readonly string[] }
  | { readonly kind: 'checklist'; readonly group: string; readonly items: readonly SkillLine[] }
  | {
      readonly kind: 'table';
      readonly caption: string;
      readonly columns: readonly [string, string];
      readonly rows: readonly { readonly slug: string; readonly name: string; readonly stack: readonly string[] }[];
    };

export interface Note {
  readonly id: NoteId;
  readonly title: string;
  readonly pinned: boolean;
  /** Without the leading "#". */
  readonly tags: readonly string[];
  readonly blocks: readonly NoteBlock[];
  /** The list row's second line (the first line of the body). */
  readonly preview: string;
}

export interface NotesInput {
  readonly skills: readonly SkillGroup[];
  readonly person: Pick<Person, 'summary'>;
  readonly experience: readonly Pick<Experience, 'highlights' | 'stack'>[];
  readonly projects: readonly Pick<Project, 'slug' | 'name' | 'stack'>[];
}

/** Level at or below which a skill counts as "currently learning". */
export const LEARNING_MAX_LEVEL = 2;
/** Many skills → each group shows this many lines and a "Show all" (plans/ios/apps/notes "Edge cases"). */
export const SKILL_COLLAPSE = { whenMoreThan: 30, visible: 6 } as const;
/** How many recurring tools "How I work" lists, and how many tags a note carries. */
const RECURRING_MAX = 8;
const TAG_MAX = 3;

export const NOTE_TITLES: Readonly<Record<NoteId, string>> = {
  skills: 'Skills',
  'how-i-work': 'How I work',
  stack: 'Stack by project',
  learning: 'Currently learning',
};

/** `#frontend`-style tag from any label: lower-case, alphanumerics joined by "-". */
export const tagOf = (label: string): string =>
  label
    .toLowerCase()
    .replace(/\+/g, 'p')
    .replace(/#/g, 'sharp')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** "TypeScript: 4 of 5, 6 years" — the meter's accessible name (only when a level exists). */
export function meterLabel(skill: SkillLine): string | null {
  if (!skill.level) return null;
  const years = skill.years ? `, ${skill.years} ${skill.years === 1 ? 'year' : 'years'}` : '';
  return `${skill.name}: ${skill.level} of 5${years}`;
}

/** The visible text beside a skill: "4 of 5 · 6 yrs", "6 yrs", or nothing. */
export function skillMeta(skill: SkillLine): string {
  const parts: string[] = [];
  if (skill.level) parts.push(`${skill.level} of 5`);
  if (skill.years) parts.push(`${skill.years} ${skill.years === 1 ? 'yr' : 'yrs'}`);
  return parts.join(' · ');
}

/** Technologies used in at least two roles/projects, most used first (ties alphabetical). */
export function recurringTools(
  input: Pick<NotesInput, 'experience' | 'projects'>,
): readonly { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const entry of [...input.experience, ...input.projects])
    for (const tech of new Set(entry.stack)) counts.set(tech, (counts.get(tech) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
}

const skillsNote = (skills: readonly SkillGroup[]): Note => {
  const blocks: NoteBlock[] = [];
  for (const group of skills) {
    if (group.items.length === 0) continue;
    blocks.push({ kind: 'heading', text: group.label });
    blocks.push({
      kind: 'checklist',
      group: group.id,
      items: group.items.map((skill) => ({
        name: skill.name,
        ...(skill.level ? { level: skill.level } : {}),
        ...(skill.years ? { years: skill.years } : {}),
      })),
    });
  }
  const first = skills.find((group) => group.items.length > 0);
  return {
    id: 'skills',
    title: NOTE_TITLES.skills,
    pinned: true,
    tags: skills.filter((group) => group.items.length > 0).map((group) => tagOf(group.id)),
    blocks,
    preview: first ? `${first.label}: ${first.items.map((skill) => skill.name).join(', ')}` : '',
  };
};

const howIWorkNote = (input: NotesInput): Note => {
  const blocks: NoteBlock[] = input.person.summary.map((text) => ({ kind: 'paragraph', text }));
  const leads = input.experience.map((role) => role.highlights[0]).filter((text): text is string => Boolean(text));
  if (leads.length > 0) blocks.push({ kind: 'heading', text: 'What I keep doing' }, { kind: 'bullets', items: leads });
  const tools = recurringTools(input).slice(0, RECURRING_MAX);
  if (tools.length > 0)
    blocks.push(
      { kind: 'heading', text: 'Tools I keep reaching for' },
      { kind: 'bullets', items: tools.map((tool) => `${tool.name} — ${tool.count} roles and projects`) },
    );
  return {
    id: 'how-i-work',
    title: NOTE_TITLES['how-i-work'],
    pinned: true,
    tags: tools.slice(0, TAG_MAX).map((tool) => tagOf(tool.name)),
    blocks,
    preview: input.person.summary[0] ?? leads[0] ?? '',
  };
};

const stackNote = (projects: NotesInput['projects']): Note | null => {
  const rows = projects.filter((project) => project.stack.length > 0);
  if (rows.length === 0) return null;
  const counts = recurringTools({ experience: [], projects: rows });
  return {
    id: 'stack',
    title: NOTE_TITLES.stack,
    pinned: false,
    tags: counts.slice(0, TAG_MAX).map((tool) => tagOf(tool.name)),
    blocks: [
      {
        kind: 'table',
        caption: 'Technologies used in each project',
        columns: ['Project', 'Technologies'],
        rows: rows.map((project) => ({ slug: project.slug, name: project.name, stack: project.stack })),
      },
    ],
    preview: rows.map((project) => project.name).join(', '),
  };
};

const learningNote = (skills: readonly SkillGroup[]): Note | null => {
  const learning = skills.flatMap((group) =>
    group.items
      .filter((skill) => skill.level !== undefined && skill.level <= LEARNING_MAX_LEVEL)
      .map((skill) => ({ group, skill })),
  );
  if (learning.length === 0) return null;
  const items = learning.map(({ skill }) => skill.name);
  return {
    id: 'learning',
    title: NOTE_TITLES.learning,
    pinned: false,
    tags: [...new Set(learning.map(({ group }) => tagOf(group.id)))],
    blocks: [{ kind: 'bullets', items }],
    preview: items.join(', '),
  };
};

/** Every note, pinned first, in the plan's order. "Currently learning" is absent when nothing is at level ≤ 2. */
export function buildNotes(input: NotesInput): readonly Note[] {
  return [skillsNote(input.skills), howIWorkNote(input), stackNote(input.projects), learningNote(input.skills)].filter(
    (note): note is Note => note !== null,
  );
}

/** The pinned notes (id + title) — the Notes icon's quick actions (`QuickData.pinnedNotes`). */
export const pinnedNotes = (notes: readonly Note[]) =>
  notes.filter((note) => note.pinned).map((note) => ({ id: note.id, title: note.title }));

/**
 * Every string a note's body renders, in reading order (Find in note highlights exactly these; the title is the screen
 * title, drawn by the nav stack).
 */
export function noteStrings(note: Note): readonly string[] {
  const out: string[] = [];
  for (const block of note.blocks) {
    switch (block.kind) {
      case 'heading':
      case 'paragraph':
        out.push(block.text);
        break;
      case 'bullets':
        out.push(...block.items);
        break;
      case 'checklist':
        out.push(...block.items.map((item) => item.name));
        break;
      case 'table':
        out.push(...block.columns);
        for (const row of block.rows) out.push(row.name, row.stack.join(', '));
        break;
    }
  }
  out.push(...note.tags.map((tag) => `#${tag}`));
  return out;
}

/** Non-overlapping, case-insensitive occurrences of `query` in `text`. */
export function countIn(text: string, query: string): number {
  const needle = query.trim().toLowerCase();
  if (!needle) return 0;
  const hay = text.toLowerCase();
  let count = 0;
  for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + needle.length)) count += 1;
  return count;
}

/** Find in note: how many matches the note holds (the rendered `<mark>`s follow the same order). */
export const countMatches = (note: Note, query: string): number =>
  noteStrings(note).reduce((sum, text) => sum + countIn(text, query), 0);

/** Splits `text` into plain and matching parts (the renderer wraps matches in `<mark>`). */
export function splitMatches(
  text: string,
  query: string,
): readonly { readonly text: string; readonly match: boolean }[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [{ text, match: false }];
  const hay = text.toLowerCase();
  const parts: { text: string; match: boolean }[] = [];
  let from = 0;
  for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + needle.length)) {
    if (at > from) parts.push({ text: text.slice(from, at), match: false });
    parts.push({ text: text.slice(at, at + needle.length), match: true });
    from = at + needle.length;
  }
  if (from < text.length) parts.push({ text: text.slice(from), match: false });
  return parts;
}

/** Notes list search: title or any rendered text. */
export const noteMatches = (note: Note, query: string): boolean =>
  !query.trim() || [note.title, ...noteStrings(note)].some((text) => countIn(text, query) > 0);

/** Tag filter: notes that carry the tag. */
export const notesWithTag = (notes: readonly Note[], tag: string | null): readonly Note[] =>
  tag ? notes.filter((note) => note.tags.includes(tag)) : notes;

/** Total skill lines — when it exceeds `SKILL_COLLAPSE.whenMoreThan`, long groups collapse behind "Show all". */
export const skillCount = (skills: readonly SkillGroup[]): number =>
  skills.reduce((sum, group) => sum + group.items.length, 0);

export const shouldCollapse = (skills: readonly SkillGroup[]): boolean =>
  skillCount(skills) > SKILL_COLLAPSE.whenMoreThan;

/** The list row's date, as Notes shows an older note: "9/21/26". */
export function shortDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  if (!year || !month) return year ?? '';
  return `${Number(month)}/${day ? Number(day) : 1}/${year.slice(-2)}`;
}
