/**
 * VS Code's workspace files, built once per page from the selectors (`buildWorkspace`, plans/macos/apps/vscode.md
 * `MAC-CODE-02`). A light module: the menu bar's Go menu lists the files without loading the editor chunk.
 */
import { buildWorkspace, fileKey, type WorkspaceFile } from '@/components/content';
import { getContact, getExperience, getPerson, getProjects, getSkills } from '@/data/selectors';

let files: readonly WorkspaceFile[] | null = null;

export function macWorkspace(): readonly WorkspaceFile[] {
  files ??= buildWorkspace({
    person: getPerson(),
    skills: getSkills(),
    experience: getExperience(),
    projects: getProjects(),
    contact: getContact(),
  });
  return files;
}

/** The Go menu's entries. */
export const vscodeMenuFiles = () => macWorkspace().map((file) => ({ id: fileKey(file), label: fileKey(file) }));
