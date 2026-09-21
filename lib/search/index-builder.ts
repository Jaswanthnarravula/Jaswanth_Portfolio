/**
 * Search index — shared/15 `SRCH-INDEX-01`: generated from the content index + the OS registry + the command table.
 * Titles, keywords and refs only (no long text), so it stays ≤ 10 KB gzipped. Unreleased OS apps are never indexed.
 */
import type { ContentCatalog } from '@/data/content-index';
import type { OsId } from '@/lib/kernel/ids';
import type { OsRegistry } from '@/lib/kernel/types';
import type { CommandInfo, SearchEntry } from './types';

const APP_ALIASES: Readonly<Record<string, readonly string[]>> = {
  browser: ['browser', 'web', 'about', 'overview'],
  github: ['github', 'repos', 'repositories', 'code', 'projects'],
  mail: ['email', 'mail', 'contact', 'compose'],
  messages: ['messages', 'chat', 'text'],
  files: ['files', 'folders', 'documents', 'experience', 'education'],
  viewer: ['pdf', 'resume', 'cv', 'viewer', 'document'],
  editor: ['editor', 'code', 'skills', 'vscode', 'ide'],
  terminal: ['terminal', 'shell', 'console', 'command line', 'bash'],
  notes: ['notes', 'skills'],
  settings: ['settings', 'preferences', 'accessibility', 'privacy', 'legal'],
};

const ACTIONS: readonly SearchEntry[] = [
  {
    id: 'action:switch-os',
    kind: 'action',
    title: 'Switch operating system',
    keywords: ['switch', 'os', 'change', 'chooser', 'exit'],
    action: 'switch-os',
    weight: 1,
  },
  {
    id: 'action:open-resume',
    kind: 'action',
    title: 'Open résumé',
    keywords: ['resume', 'cv', 'pdf', 'download'],
    action: 'open-resume',
    weight: 1.15,
  },
  {
    id: 'action:toggle-sound',
    kind: 'action',
    title: 'Toggle sound',
    keywords: ['sound', 'mute', 'audio', 'volume'],
    action: 'toggle-sound',
    weight: 1,
  },
  {
    id: 'action:reduce-motion',
    kind: 'action',
    title: 'Reduce motion',
    keywords: ['motion', 'animation', 'accessibility'],
    action: 'reduce-motion',
    weight: 1,
  },
  {
    id: 'action:start-tour',
    kind: 'action',
    title: 'Start tour',
    keywords: ['tour', 'help', 'guide', 'lost'],
    action: 'start-tour',
    weight: 1,
  },
  {
    id: 'action:show-shortcuts',
    kind: 'action',
    title: 'Show keyboard shortcuts',
    keywords: ['shortcuts', 'keyboard', 'keys', 'help'],
    action: 'show-shortcuts',
    weight: 1,
  },
];

export interface IndexSources {
  readonly os: OsId;
  readonly registry: OsRegistry;
  readonly catalog: ContentCatalog;
  readonly visible: readonly OsId[];
  readonly commands?: readonly CommandInfo[];
  readonly featured?: readonly string[];
}

export function buildSearchIndex({
  os,
  registry,
  catalog,
  visible,
  commands = [],
  featured = [],
}: IndexSources): readonly SearchEntry[] {
  if (!visible.includes(os)) return [];
  const entries: SearchEntry[] = [];
  for (const binding of registry[os].apps) {
    entries.push({
      id: `app:${binding.role}`,
      kind: 'app',
      title: binding.title,
      subtitle: 'Application',
      keywords: [binding.slug, ...(APP_ALIASES[binding.role] ?? [])],
      role: binding.role,
      weight: 1.2,
    });
  }
  for (const entry of catalog.entries) {
    const slug = 'slug' in entry.ref ? entry.ref.slug : undefined;
    const isResumeOrContact = entry.ref.section === 'resume' || entry.ref.section === 'contact';
    entries.push({
      id: `content:${entry.key}`,
      kind: 'content',
      title: entry.title,
      subtitle: entry.parent ? catalog.get(entry.parent)?.title : undefined,
      keywords: entry.keywords,
      ref: entry.ref,
      weight: isResumeOrContact ? 1.15 : slug && featured.includes(slug) ? 1.1 : 1,
    });
  }
  entries.push(...ACTIONS);
  for (const command of commands)
    entries.push({
      id: `command:${command.name}`,
      kind: 'command',
      title: command.name,
      subtitle: os === 'linux' ? command.summary : 'Run in Terminal',
      keywords: [command.summary, ...(command.aliases ?? [])],
      command: command.name,
      weight: 0.9,
    });
  return entries;
}
