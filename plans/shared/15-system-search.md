# shared/15 — System-wide search

## Purpose
Everything in the portfolio is findable by typing, from any OS, through that OS's native search surface. One
index and one matcher; five skins. Requirement: N11 (supports R14, R18, R28).

## Decisions

| Decision | Rationale | Rejected |
|---|---|---|
| One **build-time index** generated from `data/content-index` + the OS registry + the command table | Same results everywhere; no runtime cost to build | Per-OS search logic |
| **Dependency-free matcher** (token + prefix + ≤ 1 typo) | ≤ 4 KB; the corpus is tiny | Fuse.js / lunr |
| Results are **typed actions**, not URLs | The kernel opens them with normal app rules | Navigating by string URL |
| The search surface writes no history; choosing a result = one `OPEN_APP` + one `go` | Back never steps through keystrokes | History entry per query |

## Specification

### Index entry
```ts
type SearchKind = 'app' | 'content' | 'action' | 'command';
interface SearchEntry { id: string; kind: SearchKind; title: string; subtitle?: string; keywords: readonly string[];
  ref?: ContentRef; role?: AppRole; action?: KernelActionId; command?: string; weight: number }
interface SearchResult extends SearchEntry { score: number; matched: readonly [start: number, end: number][] }
```
Sources: **apps** (per active OS binding: title + slug + aliases like "browser", "email") · **content** (every
project, role, school, skill, plus `about`/`resume`/`contact`) · **actions** (Switch OS, Toggle sound, Reduce
motion, Open résumé, Start tour, Show shortcuts) · **commands** (Linux command table; shown in other OSes as
"Run in Terminal").

### Matching and ranking
Normalize (lowercase, strip diacritics) → tokenise → per-token best of: exact (1.0) · prefix (0.8) · word-prefix
(0.7) · substring (0.5) · Damerau-Levenshtein ≤ 1 for tokens ≥ 4 chars (0.4). Score = Σ token scores × field
weight (title 1.0, keywords 0.7, subtitle 0.4) × entry weight (apps 1.2, résumé/contact 1.15, featured projects
1.1). Ties → kind order app › content › action › command, then alphabetical. Empty query → **zero state**:
Résumé, Projects, Contact, then recent items.

### Per-OS skins (owned by each OS's search surface file)

| OS | Surface | Invocation | Result action |
|---|---|---|---|
| macOS | Spotlight bar (centered) | Ctrl/Cmd+K, menu-bar magnifier | Opens window; Spotlight closes |
| Windows | Taskbar Search flyout (Start shares it) | taskbar search, typing in Start, Ctrl/Cmd+K | Opens window |
| iOS | Spotlight (pull-down / Search pill) | pill, pull gesture, Ctrl/Cmd+K | App flight from the result row |
| Android | Launcher search bar + drawer search | bar, drawer field, Ctrl/Cmd+K | Container transform from the row |
| Linux | `search <q>` · `find` · `grep -r` · Tab completion | typing | Prints matches as paths; **never opens automatically** |

### Accessibility contract
`Combobox` + `Listbox` primitive: `aria-activedescendant`, grouped options with group labels, result count in a
debounced polite status ("6 results"), Esc clears then closes, focus returns to the invoker. Options are real
clickable elements.

### Budgets
Matcher ≤ 4 KB; index ≤ 10 KB gz (titles, keywords, refs — no long text). Loaded at OS idle; the search surface
opens instantly and shows the zero state while the index chunk resolves.

## Edge cases
No results → OS-idiomatic empty state + "Search the plain portfolio" link. Unreleased OS apps are never indexed.
Query is a terminal command (e.g. `ls`) in a graphical OS → offers "Run in Terminal" which opens Terminal with
the command **inserted, not executed**. IME composition → match on `compositionend`.

## Feature IDs + acceptance tests

| ID | Feature | Acceptance test |
|---|---|---|
| `SRCH-INDEX-01` | Build-time index from data + registry + commands | `unit: every ContentRef and app binding indexed; size ≤ 10 KB gz` |
| `SRCH-MATCH-01` | Matcher scoring + typo tolerance | `unit: ranking table fixtures (exact > prefix > typo)` |
| `SRCH-ZERO-01` | Zero state | `cmp: empty query lists Résumé, Projects, Contact first` |
| `SRCH-ACT-01` | Result → one kernel action, one history write | `e2e: S1 selecting a result adds exactly one history entry` |
| `SRCH-PARITY-01` | Same content found in every OS | `e2e: S1 same query, same top content result across five OSes` |
| `SRCH-TERM-01` | Command results insert, never execute | `e2e: "Run in Terminal" leaves the command unsubmitted` |
| `SRCH-A11Y-01` | Combobox semantics + count status | `cmp: Spotlight activedescendant + debounced count` |
| `SRCH-LAZY-01` | Index lazy, surface instant | `perf: search chunk absent from OS first load` |

## Open questions
None.
