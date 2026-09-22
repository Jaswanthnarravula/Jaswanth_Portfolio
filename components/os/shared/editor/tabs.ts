/**
 * The editor group's tab rules (plans/macos/apps/vscode.md "Open file", shared with Windows): single click opens a
 * **preview** tab (italic; one preview slot — the next preview replaces it in place), double click opens it
 * **pinned**; at most 6 tabs, past that the oldest preview closes (else the oldest other tab). New tabs open to the
 * right of the active one, as VS Code does. Pure — the editor keeps the result as session state.
 */

export interface EditorTab {
  readonly key: string;
  readonly preview: boolean;
  /** Open order (monotonic): "oldest" is the smallest. */
  readonly at: number;
}

export const MAX_TABS = 6;

let clock = 0;

export function openTab(
  tabs: readonly EditorTab[],
  key: string,
  mode: 'preview' | 'pinned',
  active: string | null,
): readonly EditorTab[] {
  const existing = tabs.findIndex((tab) => tab.key === key);
  if (existing >= 0)
    return mode === 'pinned' && tabs[existing]!.preview
      ? tabs.map((tab, index) => (index === existing ? { ...tab, preview: false } : tab))
      : tabs;
  const next: EditorTab = { key, preview: mode === 'preview', at: ++clock };
  const slot = tabs.findIndex((tab) => tab.preview);
  if (mode === 'preview' && slot >= 0) return tabs.map((tab, index) => (index === slot ? next : tab));
  const after = tabs.findIndex((tab) => tab.key === active);
  const result = [...tabs];
  result.splice(after >= 0 ? after + 1 : result.length, 0, next);
  while (result.length > MAX_TABS) {
    const others = result.filter((tab) => tab.key !== key);
    const oldest = (list: readonly EditorTab[]) => list.reduce((a, b) => (b.at < a.at ? b : a));
    const previews = others.filter((tab) => tab.preview);
    result.splice(result.indexOf(oldest(previews.length ? previews : others)), 1);
  }
  return result;
}

/** Close `key`; if it was active, the tab to its right (else left) becomes active. */
export function closeTab(
  tabs: readonly EditorTab[],
  key: string,
  active: string | null,
): { readonly tabs: readonly EditorTab[]; readonly active: string | null } {
  const index = tabs.findIndex((tab) => tab.key === key);
  if (index < 0) return { tabs, active };
  const rest = tabs.filter((tab) => tab.key !== key);
  if (active !== key) return { tabs: rest, active };
  return { tabs: rest, active: (rest[index] ?? rest[index - 1])?.key ?? null };
}

/** A pinned starting tab (the workspace opens on its README, as VS Code does for a new folder). */
export const firstTab = (key: string): EditorTab => ({ key, preview: false, at: ++clock });
