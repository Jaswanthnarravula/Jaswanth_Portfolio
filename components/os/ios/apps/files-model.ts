/**
 * iOS Files — the pure part (plans/ios/apps/files.md): where the URL says the app is, the virtual tree built from data
 * (`On My iPhone › {given name} › Experience/{Company} — {Role}` · `Education/{School}` · `Résumé.pdf` · aliases), the
 * session "trail" of folders that have no URL of their own, sorting and the stack tags. No React, no DOM.
 */
import type { ContentRef, Education, Experience, PartialDate, Project } from '@/data/schema';
import { formatPeriod } from '@/components/content/format';
import type { AppLocation } from '@/lib/kernel/types';

export type Section = 'experience' | 'education';

/** Where the URL puts Files (`/ios/files` · `/experience[/{slug}]` · `/education[/{slug}]` · `/resume`). */
export type Place =
  | { readonly kind: 'root' }
  | { readonly kind: 'folder'; readonly section: Section }
  | { readonly kind: 'doc'; readonly section: Section; readonly slug: string }
  | { readonly kind: 'resume' };

export const ROOT: Place = { kind: 'root' };
export const RESUME: Place = { kind: 'resume' };

export function placeOf(location: AppLocation | null | undefined): Place {
  if (!location || location.kind !== 'content') return ROOT;
  const { ref } = location;
  if (ref.section === 'resume') return RESUME;
  if (ref.section === 'experience' || ref.section === 'education') {
    const slug = 'slug' in ref ? ref.slug : undefined;
    return slug ? { kind: 'doc', section: ref.section, slug } : { kind: 'folder', section: ref.section };
  }
  return ROOT;
}

export function locationOf(place: Place): AppLocation {
  switch (place.kind) {
    case 'root':
      return { kind: 'root' };
    case 'resume':
      return { kind: 'content', ref: { section: 'resume' } };
    case 'folder':
      return { kind: 'content', ref: { section: place.section } };
    case 'doc':
      return { kind: 'content', ref: { section: place.section, slug: place.slug } };
  }
}

/** '' · 'experience' · 'experience/{slug}' · 'resume' — a place as a stable key (screen keys, session state). */
export function placeKey(place: Place): string {
  switch (place.kind) {
    case 'root':
      return '';
    case 'resume':
      return 'resume';
    case 'folder':
      return place.section;
    case 'doc':
      return `${place.section}/${place.slug}`;
  }
}

export function placeFromKey(key: string | undefined): Place {
  if (!key) return ROOT;
  if (key === 'resume') return RESUME;
  const [section, slug] = key.split('/');
  if (section !== 'experience' && section !== 'education') return ROOT;
  return slug ? { kind: 'doc', section, slug } : { kind: 'folder', section };
}

// --- The trail: session folders between the tab root and the URL's screens -------------------------------------------

/**
 * Trail entries: `iphone` (On My iPhone), `jaswanth` (the owner's folder — named from data), `tag:{name}`, and `@` —
 * an invisible marker meaning "the document was opened straight from Browse" (search), so no folder sits under it.
 */
export type TrailEntry = 'iphone' | 'jaswanth' | '@' | `tag:${string}`;

export const isTrailEntry = (value: unknown): value is TrailEntry =>
  value === 'iphone' ||
  value === 'jaswanth' ||
  value === '@' ||
  (typeof value === 'string' && value.startsWith('tag:'));

const last = <T>(items: readonly T[]): T | undefined => items[items.length - 1];

/** A document opened from a tag list, a search result or Recents sits straight on that screen (no folder under it). */
export const opensDirect = (trail: readonly TrailEntry[]): boolean => {
  const tail = last(trail);
  return tail === '@' || (tail?.startsWith('tag:') ?? false);
};

/**
 * The trail to draw for a place. A stored trail is honoured while it can lead there; otherwise (a deep link, the Dock's
 * `/ios/files/resume`) the tree's own path is synthesized — the owner's folder — so Back / Done have somewhere to go
 * (`IOS-FILES-05`). At the root an unknown trail is empty.
 */
export function resolveTrail(place: Place, stored: unknown): TrailEntry[] {
  const trail = Array.isArray(stored) && stored.every(isTrailEntry) ? (stored as TrailEntry[]) : null;
  const synthesized: TrailEntry[] = ['jaswanth'];
  if (place.kind === 'root') return trail ?? [];
  if (!trail) return synthesized;
  const tail = last(trail);
  if (trail.length === 0 || tail === 'jaswanth') return trail;
  if (place.kind !== 'folder' && opensDirect(trail)) return trail;
  return synthesized;
}

// --- Files ---------------------------------------------------------------------------------------------------------

export type FileKind = 'folder' | 'doc' | 'pdf' | 'alias';

export interface FileItem {
  readonly key: string;
  readonly kind: FileKind;
  /** Visible name ("Acme — Senior Engineer", "State University", "Résumé.pdf"). */
  readonly name: string;
  /** Secondary line (dates, degree · dates, size). */
  readonly secondary: string;
  /** The row's accessible name ("Acme — Senior Engineer, 2022 to present"). */
  readonly label: string;
  /** Newest-first sort value. */
  readonly date: number;
  /** In-app place (folders and documents), or a session folder (`trail`). */
  readonly place?: Place;
  readonly trail?: TrailEntry;
  /** Content another app owns (aliases: Projects → GitHub, About → Safari). */
  readonly ref?: ContentRef;
  readonly tint?: string;
}

/** "Jan 2024 – Present" → "Jan 2024 to Present" (a list row's spoken name). */
export const spokenPeriod = (period: string | null): string => (period ? period.replace(/\s+–\s+/g, ' to ') : '');

/** Sort value of a partial date: `present` newest, unknown oldest. */
export function dateValue(value: PartialDate | 'present' | null | undefined): number {
  if (value === 'present') return 999_999;
  if (!value) return 0;
  const [year = '0', month = '0'] = value.split('-');
  return Number(year) * 100 + Number(month);
}

export const roleName = (role: Experience): string => (role.role ? `${role.company} — ${role.role}` : role.company);

export function roleItem(role: Experience): FileItem {
  const period = formatPeriod(role.start, role.end);
  const name = roleName(role);
  return {
    key: `experience/${role.slug}`,
    kind: 'doc',
    name,
    secondary: [role.client ? `for ${role.client}` : null, period].filter(Boolean).join(' · '),
    label: period ? `${name}, ${spokenPeriod(period)}` : name,
    date: Math.max(dateValue(role.end), dateValue(role.start)),
    place: { kind: 'doc', section: 'experience', slug: role.slug },
  };
}

export function schoolItem(school: Education): FileItem {
  const period = formatPeriod(school.start, school.end);
  const name = school.school;
  return {
    key: `education/${school.slug}`,
    kind: 'doc',
    name,
    secondary: [school.degree, period].filter(Boolean).join(' · '),
    label: `${name} — ${school.degree}${period ? `, ${spokenPeriod(period)}` : ''}`,
    date: Math.max(dateValue(school.end), dateValue(school.start)),
    place: { kind: 'doc', section: 'education', slug: school.slug },
  };
}

export const itemsLabel = (count: number): string => `${count} ${count === 1 ? 'item' : 'items'}`;

export type SortKey = 'name' | 'date';

export function sortItems(items: readonly FileItem[], sort: SortKey): FileItem[] {
  const copy = [...items];
  if (sort === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  return copy.sort((a, b) => b.date - a.date);
}

export function searchItems(items: readonly FileItem[], query: string): FileItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return items.filter((item) => `${item.name} ${item.secondary}`.toLowerCase().includes(needle));
}

// --- Tags ----------------------------------------------------------------------------------------------------------

/** Files' tag colours (Red · Orange · Yellow · Green · Blue · Purple · Grey) — data colours, cycled by rank. */
export const TAG_COLORS = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#007aff', '#af52de', '#8e8e93'] as const;

export interface Tag {
  readonly name: string;
  readonly color: string;
  readonly count: number;
}

/** The stack tags: every technology on a role or project, most used first (ties by name), at most `limit`. */
export function tagsFrom(roles: readonly Experience[], projects: readonly Project[], limit = 8): Tag[] {
  const counts = new Map<string, number>();
  for (const item of [...roles, ...projects])
    for (const tech of new Set(item.stack)) counts.set(tech, (counts.get(tech) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count], index) => ({ name, count, color: TAG_COLORS[index % TAG_COLORS.length]! }));
}

export function tagged(tag: string, roles: readonly Experience[], projects: readonly Project[]) {
  return {
    roles: roles.filter((role) => role.stack.includes(tag)),
    projects: projects.filter((project) => project.stack.includes(tag)),
  };
}
