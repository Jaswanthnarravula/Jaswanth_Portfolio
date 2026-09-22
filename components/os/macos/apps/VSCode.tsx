'use client';
/**
 * Visual Studio Code — Skills as a read-only workspace (plans/macos/apps/vscode.md, `MAC-CODE-01…08`).
 * The editor body is the one shared component (`components/os/shared/editor/EditorBody`, no fork); macOS supplies only
 * its chrome: a unified title bar under the traffic lights with the command centre (the workspace name — pressing it
 * opens Spotlight, the one search system), and the global menu bar (File · Edit · Selection · View · Go · Terminal)
 * driving the editor through its handle. The files come from data (`buildWorkspace`), the panel's Terminal is the
 * shared engine in the zsh voice, lazy-loaded the first time the panel opens (`MAC-CODE-06`).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { fileKey, workspaceName } from '@/components/content';
import { Combobox } from '@/components/primitives/Combobox';
import {
  DEFAULT_LAYOUT,
  EditorBody,
  type EditorHandle,
  type EditorIcons,
  type EditorLayout,
} from '@/components/os/shared/editor/EditorBody';
import { TerminalView } from '@/components/os/shared/terminal/TerminalView';
import { getPerson, getSkills } from '@/data/selectors';
import { useAppCommands } from '../commands';
import {
  BlocksGlyph,
  BranchGlyph,
  CheckGlyph,
  ChevronDownGlyph,
  ErrorGlyph,
  FileGlyph,
  FilesGlyph,
  SearchLineGlyph,
  WarningGlyph,
  XGlyph,
} from '../glyphs';
import { ChevronLeft, ChevronRight, SearchGlyph } from '../icons';
import { runMacCommand, runTerminalEffect } from '../run-command';
import { setAppState } from '../ui';
import { macWorkspace } from '../vscode-files';
import type { WindowBodyProps } from '../window/Window';
import app from './app.module.css';
import styles from './vscode.module.css';

const ICONS: EditorIcons = {
  explorer: <FilesGlyph size={24} />,
  search: <SearchLineGlyph size={24} />,
  scm: <BranchGlyph size={24} />,
  extensions: <BlocksGlyph size={24} />,
  file: <FileGlyph size={16} />,
  chevronRight: <ChevronRight size={16} />,
  chevronDown: <ChevronDownGlyph size={16} />,
  back: <ChevronLeft size={18} />,
  close: <XGlyph size={14} />,
  branch: <BranchGlyph size={14} />,
  error: <ErrorGlyph size={14} />,
  warning: <WarningGlyph size={14} />,
  check: <CheckGlyph size={14} />,
};

function QuickOpen({ onPick, onClose }: { onPick: (key: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const all = macWorkspace();
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const options = all
    .filter((file) => words.every((word) => fileKey(file).toLowerCase().includes(word)))
    .map((file) => ({ id: fileKey(file), label: file.name, description: file.path.slice(0, -1).join('/') }));
  return (
    <div className={styles.quickOpen}>
      <Combobox
        label="Open file"
        placeholder="Search files by name"
        value={query}
        onChange={setQuery}
        groups={[{ id: 'files', label: 'Files', options }]}
        onSelect={onPick}
        onClose={onClose}
        // The visitor asked for the quick pick (File → Open File…): focus moves into it.
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        emptyState={<p className={styles.empty}>No matching files</p>}
        className={styles.combobox}
      />
    </div>
  );
}

export default function VSCode({ titleId, focused, compact }: WindowBodyProps) {
  const editor = useRef<EditorHandle>(null);
  const workspace = useMemo(() => macWorkspace(), []);
  const person = getPerson();
  const name = workspaceName(person);
  const [layout, setLayout] = useState<EditorLayout>(DEFAULT_LAYOUT);
  const [quickOpen, setQuickOpen] = useState(false);

  useEffect(() => setAppState('editor:panel', layout.panel), [layout.panel]);
  useEffect(() => setAppState('editor:minimap', layout.minimap), [layout.minimap]);

  useAppCommands('editor', (command, arg) => {
    const handle = editor.current;
    switch (command) {
      case 'quick-open':
        setQuickOpen(true);
        break;
      case 'close-tab':
        handle?.closeActive();
        break;
      case 'view':
        if (arg === 'explorer' || arg === 'search' || arg === 'extensions' || arg === 'scm') handle?.show(arg);
        break;
      case 'toggle-panel':
        setLayout((current) => ({ ...current, panel: !current.panel }));
        break;
      case 'toggle-minimap':
        setLayout((current) => ({ ...current, minimap: !current.minimap }));
        break;
      case 'toggle-sidebar':
        setLayout((current) => ({ ...current, sidebar: !current.sidebar }));
        break;
      case 'open':
        if (arg) handle?.open(arg, 'pinned');
        break;
      case 'new-terminal':
        handle?.openPanel();
        break;
      case 'select-all':
        handle?.selectAll();
        break;
      case 'copy':
        void navigator.clipboard?.writeText(handle?.copyText() ?? '').catch(() => undefined);
        break;
    }
  });

  return (
    <div className={`${app.app} ${styles.vscode}`} data-body="">
      <header className={styles.titlebar} data-drag-region="">
        <h2 id={titleId} className="sr-only">
          Visual Studio Code — {name}
        </h2>
        <button
          type="button"
          className={styles.commandCenter}
          onClick={() => runMacCommand({ kind: 'spotlight' })}
          aria-label={`Search ${name} (opens Spotlight)`}
        >
          <SearchGlyph size={13} />
          <span aria-hidden="true">{name}</span>
        </button>
      </header>
      {quickOpen ? (
        <QuickOpen
          onPick={(key) => {
            setQuickOpen(false);
            editor.current?.open(key, 'pinned');
          }}
          onClose={() => setQuickOpen(false)}
        />
      ) : null}
      <EditorBody
        ref={editor}
        files={workspace}
        skills={getSkills()}
        workspace={name}
        root={`/Users/${name.split('-')[0]}/portfolio`}
        pathSeparator="/"
        layout={layout}
        onLayout={setLayout}
        icons={ICONS}
        compact={compact}
        terminal={() => (
          <TerminalView
            flavor="zsh"
            os="macos"
            session={null}
            className={styles.terminal}
            onEffect={(effect) => {
              if (effect.k === 'exit') setLayout((current) => ({ ...current, panel: false }));
              else runTerminalEffect(effect);
            }}
            active={focused}
            focusOnMount
          />
        )}
      />
    </div>
  );
}
