import { portfolio, type PortfolioData } from './portfolio';
import {
  SECTION_IDS,
  isCollectionSection,
  refSlug,
  type CollectionSection,
  type ContentRef,
  type Portfolio,
  type SectionId,
} from './schema';

export type ProjectSlug = PortfolioData['projects'][number]['slug'];
export type ExperienceSlug = PortfolioData['experience'][number]['slug'];
export type EducationSlug = PortfolioData['education'][number]['slug'];
/** A `ContentRef` whose slugs are checked against the real data at compile time. */
export type PortfolioRef = ContentRef<ProjectSlug, ExperienceSlug, EducationSlug>;

export interface IndexEntry {
  readonly ref: ContentRef;
  /** `section` or `section/slug` — stable, URL-safe. */
  readonly key: string;
  readonly title: string;
  readonly summary: string;
  readonly keywords: readonly string[];
  readonly parent: ContentRef | null;
}

/** Runtime view of the content the kernel and route codec validate against. */
export interface ContentCatalog {
  readonly rev: string;
  readonly entries: readonly IndexEntry[];
  has(ref: ContentRef): boolean;
  get(ref: ContentRef): IndexEntry | undefined;
  slugs(section: CollectionSection): readonly string[];
  /** Nearest resolvable ancestor: a removed slug truncates to its section. */
  repair(ref: ContentRef): ContentRef;
}

export const SECTION_TITLES: Readonly<Record<SectionId, string>> = {
  about: 'About',
  projects: 'Projects',
  experience: 'Experience',
  skills: 'Skills',
  education: 'Education',
  resume: 'Résumé',
  contact: 'Contact',
};

export const refKey = (ref: ContentRef): string => {
  const slug = refSlug(ref);
  return slug ? `${ref.section}/${slug}` : ref.section;
};

/** FNV-1a (32-bit) over a stable serialization — cheap, deterministic, good enough to detect change. */
export function hashContent(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const words = (...values: readonly (string | null | undefined)[]): string[] =>
  values
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.toLowerCase().split(/[^\p{L}\p{N}+#.]+/u))
    .filter((word) => word.length > 1);

const unique = (values: readonly string[]): string[] => [...new Set(values)];

function sectionSummary(data: Portfolio, section: SectionId): string {
  switch (section) {
    case 'about':
      return data.person.headline;
    case 'projects':
      return data.projects.length
        ? data.projects.map((project) => project.name).join(' · ')
        : 'No projects listed yet.';
    case 'experience':
      return data.experience.length
        ? data.experience.map((role) => (role.role ? `${role.role}, ${role.company}` : role.company)).join(' · ')
        : 'No roles listed yet.';
    case 'education':
      return data.education.length
        ? data.education.map((school) => `${school.degree}, ${school.shortName}`).join(' · ')
        : 'No education listed yet.';
    case 'skills':
      return data.skills.map((group) => group.label).join(' · ');
    case 'resume':
      return `${data.person.name} — résumé (PDF), updated ${data.resume.updated}.`;
    case 'contact':
      return `Email ${data.contact.email} or connect on ${data.contact.links.map((link) => link.label).join(' and ')}.`;
    default: {
      const exhaustive: never = section;
      return exhaustive;
    }
  }
}

export function buildContentIndex(data: Portfolio): ContentCatalog {
  const entries: IndexEntry[] = [];
  for (const section of SECTION_IDS) {
    entries.push({
      ref: { section } as ContentRef,
      key: section,
      title: SECTION_TITLES[section],
      summary: sectionSummary(data, section),
      keywords: unique(words(section, SECTION_TITLES[section], section === 'resume' ? 'cv resume pdf' : undefined)),
      parent: null,
    });
  }
  for (const project of data.projects) {
    entries.push({
      ref: { section: 'projects', slug: project.slug },
      key: `projects/${project.slug}`,
      title: project.name,
      summary: project.tagline,
      keywords: unique(
        words(project.name, project.context, ...project.stack, ...(project.deepDives ?? []).map((dive) => dive.title)),
      ),
      parent: { section: 'projects' },
    });
  }
  for (const role of data.experience) {
    entries.push({
      ref: { section: 'experience', slug: role.slug },
      key: `experience/${role.slug}`,
      title: role.role ? `${role.role} · ${role.company}` : role.company,
      summary: role.summary,
      keywords: unique(words(role.company, role.client, role.role, ...role.stack)),
      parent: { section: 'experience' },
    });
  }
  for (const school of data.education) {
    entries.push({
      ref: { section: 'education', slug: school.slug },
      key: `education/${school.slug}`,
      title: school.school,
      summary: school.degree,
      keywords: unique(words(school.school, school.shortName, school.degree)),
      parent: { section: 'education' },
    });
  }

  const byKey = new Map(entries.map((entry) => [entry.key, entry]));
  const slugsBySection: Readonly<Record<CollectionSection, readonly string[]>> = {
    projects: data.projects.map((project) => project.slug),
    experience: data.experience.map((role) => role.slug),
    education: data.education.map((school) => school.slug),
  };
  return {
    rev: hashContent(data),
    entries,
    has: (ref) => byKey.has(refKey(ref)),
    get: (ref) => byKey.get(refKey(ref)),
    slugs: (section) => slugsBySection[section],
    repair: (ref) => {
      if (byKey.has(refKey(ref))) return ref;
      return { section: ref.section } as ContentRef;
    },
  };
}

export const contentIndex: ContentCatalog = buildContentIndex(portfolio);
export const contentRev: string = contentIndex.rev;

export const isCollectionRef = (ref: ContentRef): ref is Extract<ContentRef, { section: CollectionSection }> =>
  isCollectionSection(ref.section);
