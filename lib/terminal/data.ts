/**
 * The facts the terminal reads — exactly the selectors every GUI app reads (shared/02 `DATA-SEL-01`), gathered once.
 * Nothing here is typed by hand: the VFS files, `projects`, `whoami`, `neofetch`… all render from this object, so the
 * shell can never disagree with Finder or GitHub (linux/03 `LNX-FS-01`).
 */
import type { GithubRepo } from '@/data/github-schema';
import type {
  Contact,
  Credential,
  Education,
  Experience,
  Person,
  Portfolio,
  Project,
  Resume,
  SkillGroup,
} from '@/data/schema';

export interface TerminalData {
  readonly person: Person;
  readonly contact: Contact;
  /** Newest first. */
  readonly experience: readonly Experience[];
  /** Featured first, then newest. */
  readonly projects: readonly Project[];
  readonly education: readonly Education[];
  readonly credentials: readonly Credential[];
  readonly skills: readonly SkillGroup[];
  readonly resume: Resume;
  /** Size and page count of the published PDF; `null` before it is built. */
  readonly resumeFile: { readonly bytes: number; readonly pages: number } | null;
  readonly contentRev: string;
  readonly githubFor: (project: Project) => GithubRepo | undefined;
  /** Public repositories no project references ("More on GitHub"). */
  readonly moreOnGithub: readonly GithubRepo[];
}

/** Build from a portfolio object whose collections are already in display order (tests use the fixture). */
export function terminalDataFrom(
  portfolio: Portfolio,
  contentRev: string,
  extras: Partial<Pick<TerminalData, 'resumeFile' | 'githubFor' | 'moreOnGithub'>> = {},
): TerminalData {
  return {
    person: portfolio.person,
    contact: portfolio.contact,
    experience: portfolio.experience,
    projects: portfolio.projects,
    education: portfolio.education,
    credentials: portfolio.credentials,
    skills: portfolio.skills,
    resume: portfolio.resume,
    resumeFile: extras.resumeFile ?? null,
    contentRev,
    githubFor: extras.githubFor ?? (() => undefined),
    moreOnGithub: extras.moreOnGithub ?? [],
  };
}

export const currentRole = (data: TerminalData): Experience | undefined =>
  data.experience.find((role) => role.end === 'present');
