/**
 * File Explorer's address bar (plans/windows/apps/file-explorer.md `WIN-EXP-04`, plans/windows/06 E19): the path
 * formatter and parser — round trips for every place, mixed separators, wrong case, the root aliases, relative names,
 * and the "Windows can't find" error for everything else. File names come from the selectors, never from here.
 */
import { describe, expect, it } from 'vitest';
import {
  explorerFileName,
  explorerFiles,
  explorerPathError,
  fileSafe,
  formatExplorerPath,
  parseExplorerPath,
  userRoot,
} from '@/components/os/windows/apps/explorer-path';
import type { ContentRef } from '@/data/schema';
import { getEducation, getExperience, getPerson } from '@/data/selectors';
import type { AppLocation } from '@/lib/kernel/types';

const at = (ref: ContentRef): AppLocation => ({ kind: 'content', ref });
const ROOT: AppLocation = { kind: 'root' };

const experience = getExperience();
const education = getEducation();
const role = experience[0]!;
const school = education[0]!;

/** Every place the Explorer (or its shortcuts) can show. */
const PLACES: readonly AppLocation[] = [
  ROOT,
  at({ section: 'experience' }),
  at({ section: 'education' }),
  ...experience.map((entry) => at({ section: 'experience', slug: entry.slug })),
  ...education.map((entry) => at({ section: 'education', slug: entry.slug })),
  at({ section: 'projects' }),
  at({ section: 'resume' }),
  at({ section: 'about' }),
];

const parsed = (text: string, from?: AppLocation) => {
  const result = parseExplorerPath(text, from);
  if (!result.ok) throw new Error(`expected "${text}" to parse: ${result.error}`);
  return result.location;
};

describe('WIN-EXP-04 formatExplorerPath', () => {
  it('names Home as Windows 11 does and puts folders and files under the profile folder', () => {
    expect(userRoot()).toBe(`C:\\Users\\${fileSafe(getPerson().givenName)}`);
    expect(formatExplorerPath(ROOT)).toBe('Home');
    expect(formatExplorerPath(at({ section: 'experience' }))).toBe(`${userRoot()}\\Experience`);
    expect(formatExplorerPath(at({ section: 'education' }))).toBe(`${userRoot()}\\Education`);
    expect(formatExplorerPath(at({ section: 'experience', slug: role.slug }))).toBe(
      `${userRoot()}\\Experience\\${fileSafe(role.company)}.docx`,
    );
    expect(formatExplorerPath(at({ section: 'education', slug: school.slug }))).toBe(
      `${userRoot()}\\Education\\${fileSafe(school.school)}.docx`,
    );
    expect(formatExplorerPath(at({ section: 'resume' }))).toBe(`${userRoot()}\\Résumé.pdf`);
    expect(formatExplorerPath(at({ section: 'projects' }))).toBe(`${userRoot()}\\Projects.lnk`);
  });

  it('derives one {Company}.docx per role and one {School}.docx per school from the selectors', () => {
    expect(explorerFiles('experience').map((file) => file.slug)).toEqual(experience.map((entry) => entry.slug));
    expect(explorerFiles('education').map((file) => file.slug)).toEqual(education.map((entry) => entry.slug));
    for (const file of [...explorerFiles('experience'), ...explorerFiles('education')]) {
      expect(file.name).toMatch(/\.docx$/);
      expect(file.name).not.toMatch(/[\\/:*?"<>|]|[. ]\.docx$/);
    }
    expect(explorerFileName('experience', 'no-such-role')).toBeNull();
  });

  it('makes names Windows-legal: no reserved characters, no trailing dot or space', () => {
    expect(fileSafe('Acme Inc.')).toBe('Acme Inc');
    expect(fileSafe('A/B')).toBe('A-B');
    expect(fileSafe('x<y>z|w')).toBe('x-y-z-w');
    expect(fileSafe('Name. . ')).toBe('Name');
  });
});

describe('WIN-EXP-04 parseExplorerPath round trip', () => {
  it('parse(format(place)) is the place, for every place', () => {
    for (const place of PLACES) expect(parsed(formatExplorerPath(place))).toEqual(place);
  });

  it('format(parse(text)) is canonical, whatever the spelling', () => {
    const typed = `c:/USERS/${getPerson().givenName.toLowerCase()}//experience/`;
    expect(formatExplorerPath(parsed(typed))).toBe(`${userRoot()}\\Experience`);
  });
});

describe('WIN-EXP-04 · E19 normalization: separators, case, roots, names', () => {
  const folder = at({ section: 'experience' });
  const file = at({ section: 'experience', slug: role.slug });

  it('accepts forward slashes, mixed and repeated separators, trailing separators and quotes', () => {
    expect(parsed(`C:/Users/${getPerson().givenName}/Experience`)).toEqual(folder);
    expect(parsed(`C:\\Users/${getPerson().givenName}\\\\Experience\\`)).toEqual(folder);
    expect(parsed(`"${formatExplorerPath(file)}"`)).toEqual(file);
    expect(parsed('  Experience/  ')).toEqual(folder);
  });

  it('ignores case and accents', () => {
    expect(parsed(`c:\\users\\${getPerson().givenName.toUpperCase()}\\EXPERIENCE`)).toEqual(folder);
    expect(parsed('resume.PDF')).toEqual(at({ section: 'resume' }));
    expect(parsed('Résumé')).toEqual(at({ section: 'resume' }));
  });

  it('accepts the root aliases Home, This PC, %USERPROFILE% and the profile folder itself', () => {
    for (const root of ['Home', 'home', 'This PC', 'this pc', '%USERPROFILE%', userRoot(), `${userRoot()}\\`])
      expect(parsed(root)).toEqual(ROOT);
    expect(parsed('%userprofile%\\Education')).toEqual(at({ section: 'education' }));
    expect(parsed('Home\\Experience')).toEqual(folder);
    expect(parsed('This PC/Experience')).toEqual(folder);
  });

  it('finds a file by its name with or without .docx, by company / school name, or by slug', () => {
    const name = explorerFileName('experience', role.slug)!;
    expect(parsed(`Experience\\${name}`)).toEqual(file);
    expect(parsed(`Experience\\${name.replace(/\.docx$/, '')}`)).toEqual(file);
    expect(parsed(`experience/${role.company.toLowerCase()}`)).toEqual(file);
    expect(parsed(`Experience/${role.slug}`)).toEqual(file);
    expect(parsed(`Education\\${school.shortName}`)).toEqual(at({ section: 'education', slug: school.slug }));
    expect(parsed(`education/${school.school}.docx`)).toEqual(at({ section: 'education', slug: school.slug }));
  });

  it('resolves a bare name inside the current folder first, then under the profile folder; handles . and ..', () => {
    expect(parsed(role.slug, folder)).toEqual(file);
    expect(parsed('..', folder)).toEqual(ROOT);
    expect(parsed('.', folder)).toEqual(folder);
    expect(parsed('..\\Education', file)).toEqual(at({ section: 'education' }));
    expect(parsed('Education', folder)).toEqual(at({ section: 'education' }));
    expect(parsed('Projects', file)).toEqual(at({ section: 'projects' }));
  });

  it('opens the shortcuts: Projects.lnk, Résumé.pdf, About {name}.url', () => {
    expect(parsed('Projects.lnk')).toEqual(at({ section: 'projects' }));
    expect(parsed(`About ${getPerson().givenName}.url`)).toEqual(at({ section: 'about' }));
    expect(parsed(`${userRoot()}\\Résumé.pdf`)).toEqual(at({ section: 'resume' }));
  });
});

describe('WIN-EXP-04 · E19 invalid paths → "Windows can\'t find"', () => {
  it.each([
    '',
    '   ',
    'C:\\',
    'D:\\Users',
    'C:\\Windows\\System32',
    'C:\\Users\\Someone\\Experience',
    `${userRoot()}\\..`,
    '..',
    'Downloads',
    'Experience\\no-such-role.docx',
    'Experience\\Sub\\Folder',
    'Projects.lnk\\anything',
    'Résumé.docx',
  ])('rejects %j with the Windows message', (text) => {
    const result = parseExplorerPath(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe(explorerPathError(text.trim()));
  });

  it('quotes exactly what was typed', () => {
    expect(explorerPathError('Downloads')).toBe("Windows can't find 'Downloads'. Check the spelling and try again.");
  });
});
