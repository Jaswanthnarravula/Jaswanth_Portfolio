/**
 * The only read API for portfolio facts (shared/02 `DATA-SEL-01`). UI code — OS shells, content views, pages —
 * imports from here, never from `data/portfolio`.
 */
import snapshotJson from './generated/github.json';
import resumeJson from './generated/resume.json';
import type { GithubRepo, GithubSnapshot } from './github-schema';
import {
  contentIndex,
  type EducationSlug,
  type ExperienceSlug,
  type IndexEntry,
  type ProjectSlug,
} from './content-index';
import { portfolio } from './portfolio';
import type {
  Contact,
  ContactLink,
  ContentRef,
  Credential,
  Education,
  Experience,
  PartialDate,
  Person,
  Portfolio,
  Project,
  Resume,
  ResumeBlock,
  ResumePage,
  SkillGroup,
} from './schema';

const data: Portfolio = portfolio;
const github = snapshotJson as unknown as GithubSnapshot;

/** Sort key for partial dates: `present` is newest, unknown sorts last. */
const dateValue = (value: PartialDate | 'present' | null): number => {
  if (value === 'present') return Number.POSITIVE_INFINITY;
  if (value === null) return Number.NEGATIVE_INFINITY;
  const [year, month] = value.split('-');
  return Number(year) * 12 + (month ? Number(month) - 1 : 0);
};

const stableSort = <T>(items: readonly T[], compare: (a: T, b: T) => number): readonly T[] =>
  items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => compare(a.item, b.item) || a.index - b.index)
    .map(({ item }) => item);

export const getPerson = (): Person => data.person;
export const getContact = (): Contact => data.contact;
export const getContactChannels = (): readonly ContactLink[] => data.contact.links;
export const getCredentials = (): readonly Credential[] => data.credentials;
export const getSkills = (): readonly SkillGroup[] => data.skills;
export const getResume = (): Resume => data.resume;
export const getResumeFile = (): Resume['file'] => data.resume.file;
export const getProvenance = (): Portfolio['provenance'] => data.provenance;

const resumeMeta = resumeJson as unknown as {
  readonly file?: string;
  readonly bytes?: number;
  readonly pages?: number;
  readonly images?: readonly ResumePage[];
  readonly text?: readonly ResumeBlock[];
};
const resumePublished = resumeMeta.file === data.resume.file;

/** Size and page count of the published PDF (scripts/build-resume.mjs); `null` if it has not been built. */
export function getResumeFileMeta(): { readonly bytes: number; readonly pages: number } | null {
  const { bytes, pages } = resumeMeta;
  if (!resumePublished || typeof bytes !== 'number' || typeof pages !== 'number') return null;
  return { bytes, pages };
}

/** The published PDF's pages as images — what every viewer shows; `[]` if they could not be rendered. */
export const getResumePages = (): readonly ResumePage[] => (resumePublished ? (resumeMeta.images ?? []) : []);

/** The published PDF's own text as reading blocks — the résumé's text version; `[]` if it was not extracted. */
export const getResumeText = (): readonly ResumeBlock[] => (resumePublished ? (resumeMeta.text ?? []) : []);

/** Featured first, then newest (by year) first; author order breaks ties. */
export const getProjects = (): readonly Project[] =>
  stableSort(data.projects, (a, b) => Number(b.featured) - Number(a.featured) || (b.year ?? 0) - (a.year ?? 0));

export const getFeaturedProjects = (): readonly Project[] => getProjects().filter((project) => project.featured);

export const getProject = (slug: ProjectSlug): Project | undefined =>
  data.projects.find((project) => project.slug === slug);

/** Newest first: current roles lead; roles without published dates follow. */
export const getExperience = (): readonly Experience[] =>
  stableSort(data.experience, (a, b) => dateValue(b.end) - dateValue(a.end) || dateValue(b.start) - dateValue(a.start));

export const getExperienceEntry = (slug: ExperienceSlug): Experience | undefined =>
  data.experience.find((role) => role.slug === slug);

export const getCurrentRole = (): Experience | undefined => getExperience().find((role) => role.end === 'present');

export const getEducation = (): readonly Education[] =>
  stableSort(data.education, (a, b) => dateValue(b.end) - dateValue(a.end));

export const getEducationEntry = (slug: EducationSlug): Education | undefined =>
  data.education.find((school) => school.slug === slug);

export const getIndexEntry = (ref: ContentRef): IndexEntry | undefined => contentIndex.get(ref);
export const getIndex = (): readonly IndexEntry[] => contentIndex.entries;

export type ResolvedContent =
  | {
      readonly section: 'about';
      readonly person: Person;
      readonly featured: readonly Project[];
      readonly current?: Experience;
    }
  | { readonly section: 'projects'; readonly projects: readonly Project[] }
  | { readonly section: 'project'; readonly project: Project; readonly github?: GithubRepo }
  | { readonly section: 'experience'; readonly roles: readonly Experience[] }
  | { readonly section: 'role'; readonly role: Experience }
  | {
      readonly section: 'education';
      readonly schools: readonly Education[];
      readonly credentials: readonly Credential[];
    }
  | { readonly section: 'school'; readonly school: Education }
  | { readonly section: 'skills'; readonly groups: readonly SkillGroup[] }
  | { readonly section: 'resume'; readonly resume: Resume; readonly person: Person }
  | { readonly section: 'contact'; readonly contact: Contact; readonly person: Person };

/** Resolve any `ContentRef` to its data; a removed slug resolves to its parent section (shared/05). */
export function resolveContent(input: ContentRef): ResolvedContent {
  const ref = contentIndex.repair(input);
  switch (ref.section) {
    case 'about':
      return { section: 'about', person: data.person, featured: getFeaturedProjects(), current: getCurrentRole() };
    case 'projects': {
      const project = ref.slug ? data.projects.find((item) => item.slug === ref.slug) : undefined;
      return project
        ? { section: 'project', project, github: githubRepoFor(project) }
        : { section: 'projects', projects: getProjects() };
    }
    case 'experience': {
      const role = ref.slug ? data.experience.find((item) => item.slug === ref.slug) : undefined;
      return role ? { section: 'role', role } : { section: 'experience', roles: getExperience() };
    }
    case 'education': {
      const school = ref.slug ? data.education.find((item) => item.slug === ref.slug) : undefined;
      return school
        ? { section: 'school', school }
        : { section: 'education', schools: getEducation(), credentials: data.credentials };
    }
    case 'skills':
      return { section: 'skills', groups: data.skills };
    case 'resume':
      return { section: 'resume', resume: data.resume, person: data.person };
    case 'contact':
      return { section: 'contact', contact: data.contact, person: data.person };
    default: {
      const exhaustive: never = ref;
      return exhaustive;
    }
  }
}

// --- GitHub enrichment (shared/17 `GH-MERGE-01`) ---------------------------------------------------------------

const normalizeRepoUrl = (url: string): string =>
  url
    .toLowerCase()
    .replace(/\.git$/, '')
    .replace(/\/+$/, '');

export const getGithubSnapshot = (): GithubSnapshot => github;

export function githubRepoFor(project: Project, snapshot: GithubSnapshot = github): GithubRepo | undefined {
  if (!project.repo) return undefined;
  const target = normalizeRepoUrl(project.repo);
  return snapshot.repos.find((repo) => normalizeRepoUrl(repo.url) === target);
}

export interface EnrichedProject {
  readonly project: Project;
  readonly github?: GithubRepo;
}

/** Résumé projects stay the source of truth; GitHub only adds stats to matched ones. */
export function getProjectsWithGithub(snapshot: GithubSnapshot = github): readonly EnrichedProject[] {
  return getProjects().map((project) => ({ project, github: githubRepoFor(project, snapshot) }));
}

/** Repositories not referenced by any project: top 6 by stars, non-archived — "More on GitHub" only. */
export function getMoreOnGithub(snapshot: GithubSnapshot = github): readonly GithubRepo[] {
  const referenced = new Set(
    data.projects.flatMap((project) => (project.repo ? [normalizeRepoUrl(project.repo)] : [])),
  );
  return [...snapshot.repos]
    .filter((repo) => !repo.archived && !referenced.has(normalizeRepoUrl(repo.url)))
    .sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name))
    .slice(0, 6);
}
