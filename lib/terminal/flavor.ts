/**
 * Flavor adapters — linux/02 `LNX-SH-09`. The same engine speaks bash (Linux), zsh (the macOS Terminal) or PowerShell
 * (the Windows Terminal): only the *voice* changes — prompt, shell-level error phrasing, path display. Parsing,
 * execution and effects never branch on the flavor.
 */
import type { Flavor, VfsPath } from './types';
import { HOME, USER } from './vfs';

export type CdFailure = 'ENOENT' | 'ENOTDIR' | 'EACCES' | 'OLDPWD' | 'ARGS';

export interface Voice {
  readonly shell: string;
  readonly shellPath: string;
  readonly hostname: string;
  notFound(command: string): string;
  cd(arg: string, failure: CdFailure): string;
  syntax(token: string): string;
  unterminated(quote: '"' | "'"): string;
  permission(path: string): string;
  isDirectory(path: string): string;
  noSuchPath(path: string): string;
  readOnly(target: string): string;
  eventNotFound(spec: string): string;
  tooDeep(): string;
  typeNotFound(name: string): string;
  aliasNotFound(name: string): string;
  /** How the shell writes a path (`pwd`, the prompt). */
  path(path: VfsPath): string;
  prompt(cwd: VfsPath): string;
}

const underHome = (path: VfsPath) => HOME.every((part, i) => path[i] === part);

const tilde = (path: VfsPath): string =>
  underHome(path)
    ? path.length === HOME.length
      ? '~'
      : `~/${path.slice(HOME.length).join('/')}`
    : `/${path.join('/')}`;

const absolute = (path: VfsPath) => `/${path.join('/')}`;

const bash: Voice = {
  shell: 'bash',
  shellPath: '/bin/bash',
  hostname: 'portfolio',
  notFound: (command) => `bash: ${command}: command not found`,
  cd: (arg, failure) =>
    failure === 'OLDPWD'
      ? 'bash: cd: OLDPWD not set'
      : failure === 'ARGS'
        ? 'bash: cd: too many arguments'
        : `bash: cd: ${arg}: ${failure === 'ENOENT' ? 'No such file or directory' : failure === 'ENOTDIR' ? 'Not a directory' : 'Permission denied'}`,
  syntax: (token) => `bash: syntax error near unexpected token '${token}'`,
  unterminated: (quote) => `bash: unexpected EOF while looking for matching '${quote}'`,
  permission: (path) => `bash: ${path}: Permission denied`,
  isDirectory: (path) => `bash: ${path}: Is a directory`,
  noSuchPath: (path) => `bash: ${path}: No such file or directory`,
  readOnly: (target) => `bash: ${target}: Read-only file system`,
  eventNotFound: (spec) => `bash: ${spec}: event not found`,
  tooDeep: () => 'bash: pipeline too long: at most 8 commands',
  typeNotFound: (name) => `bash: type: ${name}: not found`,
  aliasNotFound: (name) => `bash: alias: ${name}: not found`,
  path: absolute,
  prompt: (cwd) => `${USER}@portfolio:${tilde(cwd)}$ `,
};

const zsh: Voice = {
  shell: 'zsh',
  shellPath: '/bin/zsh',
  hostname: 'MacBook-Pro',
  notFound: (command) => `zsh: command not found: ${command}`,
  cd: (arg, failure) =>
    failure === 'OLDPWD'
      ? 'cd: no previous directory'
      : failure === 'ARGS'
        ? `cd: string not in pwd: ${arg}`
        : `cd: ${failure === 'ENOENT' ? 'no such file or directory' : failure === 'ENOTDIR' ? 'not a directory' : 'permission denied'}: ${arg}`,
  syntax: (token) => `zsh: parse error near '${token}'`,
  unterminated: (quote) => `zsh: unmatched ${quote}`,
  permission: (path) => `zsh: permission denied: ${path}`,
  isDirectory: (path) => `zsh: is a directory: ${path}`,
  noSuchPath: (path) => `zsh: no such file or directory: ${path}`,
  readOnly: (target) => `zsh: read-only file system: ${target}`,
  eventNotFound: (spec) => `zsh: event not found: ${spec.replace(/^!/, '')}`,
  tooDeep: () => 'zsh: pipeline too long: at most 8 commands',
  typeNotFound: (name) => `${name} not found`,
  aliasNotFound: (name) => `zsh: alias: ${name}: not found`,
  path: absolute,
  prompt: (cwd) => `${USER}@MacBook-Pro ${tilde(cwd)} % `,
};

/** PowerShell writes `/home/jaswanth` as `C:\Users\jaswanth`. */
const windowsPath = (path: VfsPath): string =>
  underHome(path)
    ? `C:\\Users\\${USER}${path.length > HOME.length ? `\\${path.slice(HOME.length).join('\\')}` : ''}`
    : `C:\\${path.join('\\')}`;

const powershell: Voice = {
  shell: 'PowerShell',
  shellPath: 'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
  hostname: 'DESKTOP-PORTFOLIO',
  notFound: (command) =>
    `${command}: The term '${command}' is not recognized as a name of a cmdlet, function, script file, or executable program.`,
  cd: (arg, failure) =>
    failure === 'OLDPWD'
      ? 'Set-Location: There is no location history left to navigate backwards.'
      : failure === 'ARGS'
        ? `Set-Location: A positional parameter cannot be found that accepts argument '${arg}'.`
        : failure === 'EACCES'
          ? `Set-Location: Access to the path '${arg}' is denied.`
          : failure === 'ENOTDIR'
            ? `Set-Location: Cannot find path '${arg}' because it is not a directory.`
            : `Set-Location: Cannot find path '${arg}' because it does not exist.`,
  syntax: (token) =>
    token === '|' ? 'ParserError: An empty pipe element is not allowed.' : `ParserError: Unexpected token '${token}'.`,
  unterminated: (quote) => `ParserError: The string is missing the terminator: ${quote}.`,
  permission: (path) => `${path}: Access to the path is denied.`,
  isDirectory: (path) => `${path}: The term '${path}' is a directory, not a program.`,
  noSuchPath: (path) =>
    `${path}: The term '${path}' is not recognized as a name of a cmdlet, function, script file, or executable program.`,
  readOnly: (target) => `Out-File: Access to the path '${target}' is denied (read-only file system).`,
  eventNotFound: (spec) => `Invoke-History: Cannot locate history for '${spec}'.`,
  tooDeep: () => 'ParserError: A pipeline can hold at most 8 commands.',
  typeNotFound: (name) => `Get-Command: The term '${name}' is not recognized.`,
  aliasNotFound: (name) =>
    `Get-Alias: This command cannot find a matching alias because an alias with the name '${name}' does not exist.`,
  path: windowsPath,
  prompt: (cwd) => `PS ${windowsPath(cwd)}> `,
};

export const VOICES: Readonly<Record<Flavor, Voice>> = { bash, zsh, powershell };

export const voice = (flavor: Flavor): Voice => VOICES[flavor];
