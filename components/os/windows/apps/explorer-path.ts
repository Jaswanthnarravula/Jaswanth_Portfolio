/**
 * File Explorer paths — plans/windows/apps/file-explorer.md (`WIN-EXP-04`) and plans/windows/06 E19. Pure: the
 * address bar's text form of a place and the parser behind "type a path, press Enter". The virtual tree is the one
 * every OS shares (Home › Experience › {Company}.docx · Home › Education › {School}.docx · shortcuts Projects.lnk,
 * Résumé.pdf, About {name}.url) — file names are derived from the selectors, never typed (north-star B9).
 *   · `formatExplorerPath`: Home → `Home` (as Windows 11 shows it) · folders → `C:\Users\{name}\Experience` · files →
 *     `C:\Users\{name}\Experience\{Company}.docx` · shortcuts → `C:\Users\{name}\Résumé.pdf` …
 *   · `parseExplorerPath`: accepts `/` or `\`, any case, accents or none, quotes (Copy as path), repeated or trailing
 *     separators, `.` / `..`, the roots `Home`, `This PC`, `C:\Users\{name}`, `%USERPROFILE%`, file names with or
 *     without `.docx`, company / school names and slugs; a bare name also resolves inside the current folder. Anything
 *     else is "Windows can't find '…'. Check the spelling and try again."
 */
import { SECTION_TITLES } from '@/data/content-index';
import type { ContentRef, Education, Experience } from '@/data/schema';
import { getEducation, getExperience, getPerson } from '@/data/selectors';
import type { AppLocation } from '@/lib/kernel/types';
import { fileSafe, userFolder, userRoot } from '../model';

export type ExplorerSection = 'experience' | 'education';
export type ExplorerShortcut = 'projects' | 'resume' | 'about';

export type ExplorerPathResult =
  { readonly ok: true; readonly location: AppLocation } | { readonly ok: false; readonly error: string };

export { fileSafe, userFolder, userRoot };

export interface ExplorerFile {
  readonly slug: string;
  /** Display name with its extension, e.g. `IBM.docx`. */
  readonly name: string;
  /** Other names the address bar accepts for it (company / school, short name, the "{Company} - {Role}" form). */
  readonly aliases: readonly string[];
}

/** Windows never shows two items with one name: a repeat becomes "Name (2).docx". */
function unique(entries: readonly { slug: string; base: string; aliases: readonly string[] }[]): ExplorerFile[] {
  const seen = new Map<string, number>();
  return entries.map(({ slug, base, aliases }) => {
    const key = normalize(base);
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    const stem = count === 1 ? base : `${base} (${count})`;
    return { slug, name: `${stem}.docx`, aliases };
  });
}

const roleAliases = (role: Experience): string[] =>
  [role.company, role.role ? `${fileSafe(role.company)} - ${fileSafe(role.role)}` : null, role.slug].filter(
    (value): value is string => !!value,
  );

/** The files of a folder, in the selectors' order (Experience: newest first). */
export function explorerFiles(section: ExplorerSection): readonly ExplorerFile[] {
  if (section === 'experience')
    return unique(
      getExperience().map((role: Experience) => ({
        slug: role.slug,
        base: fileSafe(role.company) || role.slug,
        aliases: roleAliases(role),
      })),
    );
  return unique(
    getEducation().map((school: Education) => ({
      slug: school.slug,
      base: fileSafe(school.school) || school.slug,
      aliases: [school.school, school.shortName, school.slug],
    })),
  );
}

export const explorerFileName = (section: ExplorerSection, slug: string): string | null =>
  explorerFiles(section).find((file) => file.slug === slug)?.name ?? null;

/** The shortcuts in Home: Projects.lnk (→ GitHub), Résumé.pdf (→ Edge PDF tab), About {name}.url (→ Edge). */
export function shortcutName(kind: ExplorerShortcut): { readonly stem: string; readonly ext: string } {
  switch (kind) {
    case 'projects':
      return { stem: SECTION_TITLES.projects, ext: '.lnk' };
    case 'resume':
      return { stem: SECTION_TITLES.resume, ext: '.pdf' };
    case 'about':
      return { stem: `${SECTION_TITLES.about} ${fileSafe(getPerson().givenName)}`, ext: '.url' };
  }
}

export const FOLDER_NAMES: Readonly<Record<ExplorerSection, string>> = {
  experience: SECTION_TITLES.experience,
  education: SECTION_TITLES.education,
};

// --- Format ----------------------------------------------------------------------------------------------------------

/** The address bar's text for a place (what Windows shows when the breadcrumb turns into a text field). */
export function formatExplorerPath(location: AppLocation): string {
  if (location.kind !== 'content') return 'Home';
  const root = userRoot();
  const { ref } = location;
  switch (ref.section) {
    case 'experience':
    case 'education': {
      const folder = `${root}\\${FOLDER_NAMES[ref.section]}`;
      const slug = 'slug' in ref ? ref.slug : undefined;
      const file = slug ? explorerFileName(ref.section, slug) : null;
      return file ? `${folder}\\${file}` : folder;
    }
    case 'projects':
    case 'resume':
    case 'about': {
      const { stem, ext } = shortcutName(ref.section);
      return `${root}\\${stem}${ext}`;
    }
    default:
      return 'Home';
  }
}

// --- Parse -----------------------------------------------------------------------------------------------------------

/** Case-, accent- and spacing-insensitive comparison key ("Résumé" = "resume"). */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export const explorerPathError = (text: string): string =>
  `Windows can't find '${text}'. Check the spelling and try again.`;

const content = (ref: ContentRef): AppLocation => ({ kind: 'content', ref });

function matchFolder(part: string): ExplorerSection | null {
  const key = normalize(part);
  for (const section of ['experience', 'education'] as const)
    if (key === normalize(FOLDER_NAMES[section]) || key === section) return section;
  return null;
}

function matchFile(section: ExplorerSection, part: string): string | null {
  let key = normalize(part);
  if (key.endsWith('.docx')) key = key.slice(0, -'.docx'.length).trim();
  for (const file of explorerFiles(section)) {
    const stem = normalize(file.name.slice(0, -'.docx'.length));
    if (key === stem || file.aliases.some((alias) => normalize(alias) === key)) return file.slug;
  }
  return null;
}

function matchShortcut(part: string): ExplorerShortcut | null {
  const key = normalize(part);
  for (const kind of ['projects', 'resume', 'about'] as const) {
    const { stem, ext } = shortcutName(kind);
    const names = [normalize(stem), kind];
    if (names.some((name) => key === name || key === `${name}${ext}`)) return kind;
  }
  return null;
}

/** Resolve path segments below the profile folder. */
function resolve(segments: readonly string[]): AppLocation | null {
  if (segments.length === 0) return { kind: 'root' };
  const [first, second, ...rest] = segments as [string, string | undefined, ...string[]];
  if (rest.length > 0) return null;
  const folder = matchFolder(first);
  if (folder) {
    if (second === undefined) return content({ section: folder });
    const slug = matchFile(folder, second);
    return slug ? content({ section: folder, slug } as ContentRef) : null;
  }
  if (second !== undefined) return null;
  const shortcut = matchShortcut(first);
  return shortcut ? content({ section: shortcut }) : null;
}

/** Collapse `.` and `..`; `null` when the path climbs above the profile folder (nothing to show there). */
function collapse(segments: readonly string[]): string[] | null {
  const out: string[] = [];
  for (const segment of segments) {
    if (segment === '.') continue;
    if (segment === '..') {
      if (out.length === 0) return null;
      out.pop();
      continue;
    }
    out.push(segment);
  }
  return out;
}

const ROOT_ALIASES = ['home', 'this pc', '%userprofile%', '%homepath%'];

/** The folder a location is in (bare names typed in the address bar resolve there first). */
function folderSegments(location: AppLocation | undefined): string[] {
  if (location?.kind !== 'content') return [];
  const { section } = location.ref;
  return section === 'experience' || section === 'education' ? [FOLDER_NAMES[section]] : [];
}

/**
 * Parse what the visitor typed into the address bar. `from` is the current place: a relative name ("IBM", "..")
 * resolves inside the current folder first, then under the profile folder.
 */
export function parseExplorerPath(input: string, from?: AppLocation): ExplorerPathResult {
  const text = input
    .trim()
    .replace(/^"(.*)"$/, '$1')
    .trim();
  const failed: ExplorerPathResult = { ok: false, error: explorerPathError(text) };
  if (!text) return failed;
  const parts = text
    .replace(/\//g, '\\')
    .split('\\')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return failed;

  const head = normalize(parts[0]!);
  let absolute: string[] | null = null;
  if (/^[a-z]:$/.test(head)) {
    // Only the profile folder exists on this PC's drive.
    if (head !== 'c:' || normalize(parts[1] ?? '') !== 'users' || normalize(parts[2] ?? '') !== normalize(userFolder()))
      return failed;
    absolute = parts.slice(3);
  } else if (ROOT_ALIASES.includes(head)) absolute = parts.slice(1);

  const candidates = absolute ? [absolute] : [[...folderSegments(from), ...parts], parts];
  for (const candidate of candidates) {
    const segments = collapse(candidate);
    if (!segments) continue;
    const location = resolve(segments);
    if (location) return { ok: true, location };
  }
  return failed;
}
