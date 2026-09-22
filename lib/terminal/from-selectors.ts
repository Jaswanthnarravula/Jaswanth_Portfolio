/** The live `TerminalData`: the real portfolio through `data/selectors` (the only read API for facts). */
import { contentRev } from '@/data/content-index';
import {
  getContact,
  getCredentials,
  getEducation,
  getExperience,
  getMoreOnGithub,
  getPerson,
  getProjects,
  getResume,
  getResumeFileMeta,
  getSkills,
  githubRepoFor,
} from '@/data/selectors';
import type { TerminalData } from './data';

let cached: TerminalData | null = null;

export function selectorsTerminalData(): TerminalData {
  cached ??= {
    person: getPerson(),
    contact: getContact(),
    experience: getExperience(),
    projects: getProjects(),
    education: getEducation(),
    credentials: getCredentials(),
    skills: getSkills(),
    resume: getResume(),
    resumeFile: getResumeFileMeta(),
    contentRev,
    githubFor: (project) => githubRepoFor(project),
    moreOnGithub: getMoreOnGithub(),
  };
  return cached;
}
