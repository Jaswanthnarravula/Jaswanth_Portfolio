# Linux / 03 — Virtual filesystem (VFS)

## Role + requirement refs
A read-only filesystem **generated from the portfolio data** — the same selectors that feed Finder, Explorer and the
mobile Files apps. Requirements: R8, R29, R44. Nothing here is hand-typed career content.

## Tree
```
/
├─ home/
│  └─ jaswanth/                      ← $HOME, shown as ~
│     ├─ README.md                   what this place is + the five most useful commands
│     ├─ about.txt                   renderText(AboutOverview)
│     ├─ skills.txt                  renderText(SkillsMatrix)
│     ├─ contact.txt                 renderText(ContactPanel)
│     ├─ resume.pdf                  binary marker → open resume
│     ├─ projects/
│     │  ├─ README.md                index of projects (name — tagline)
│     │  └─ {slug}.md                renderText(ProjectDetail)   one per project
│     ├─ experience/
│     │  └─ {slug}.md                renderText(ExperienceDetail) one per role
│     ├─ education/
│     │  └─ {slug}.md                one per school
│     ├─ .bashrc                     the alias table (real: it is what the engine loads)
│     ├─ .plan                       person.openTo (finger-style)
│     └─ .ssh/                       directory, mode 700 → "Permission denied" for everyone (dry humour)
├─ etc/
│  ├─ motd                           the message of the day (08-boot-and-motd.md)
│  ├─ os-release                     NAME="PortfolioOS" VERSION="{resume.updated}" BUILD_ID="{contentRev}"
│  └─ hostname                       portfolio
├─ usr/bin/                          one executable entry per command (so `ls /usr/bin` and `which` are truthful)
└─ tmp/                              empty, world-writable in appearance; writes still fail (read-only FS)
```

## Node model
```ts
type VfsNode =
  | { kind: 'dir';  name: string; mode: number; mtime: string; children: readonly VfsNode[] }
  | { kind: 'file'; name: string; mode: number; mtime: string; mime: 'text' | 'pdf' | 'exe';
      size: number; read: (cols: number) => readonly string[]; ref?: ContentRef | 'resume' };
interface Vfs { resolve(cwd: VfsPath, input: string): ResolveResult; list(p: VfsPath): readonly VfsNode[]; walk(): Iterable<[VfsPath, VfsNode]> }
type ResolveResult = { ok: true; path: VfsPath; node: VfsNode } | { ok: false; reason: 'ENOENT' | 'ENOTDIR' | 'EACCES'; at: string };
```
- **Path resolution:** absolute and relative, `.`, `..` (never above `/`), `~`, `~/x`, `-` (for `cd -`), trailing
  slashes, repeated slashes; case-**sensitive** (it's Linux). Returned paths are normalized.
- **Metadata is truthful where it can be:** `size` = UTF-8 byte length of the rendered text at 80 cols (PDF = real file
  size); `mtime` = the role's end date / project year / `resume.updated`; `mode` = `0444` files, `0555` dirs and
  executables, `0700` for `.ssh`. Owner/group always `jaswanth jaswanth`.
- **File text is width-aware:** `read(cols)` wraps prose to the terminal width; `renderText` guarantees the same
  facts the GUI apps show.
- `ref` links a file to its `ContentRef`, which is how `open`, the URL codec, continuity and search all agree.

## URL mapping
cwd ↔ `/linux/terminal/{path relative to ~ without extension}` — `~` → `/linux`, `~/projects` →
`/linux/terminal/projects`. cwd outside `$HOME` (e.g. `/etc`) → `/linux/terminal` with the cwd kept in session only
(not addressable — nothing portfolio-worthy lives there). Sibling names are unique without extensions (build check).

## Generation
Built once per session from selectors (`buildVfs(portfolio, commands)`), memoized by `contentRev`; ≤ 5 ms for a
typical portfolio; no network, no storage.

## Edge cases
Empty collections → the directory exists and is empty (`ls` prints nothing, like a real shell). Slugs that collide
with reserved names (`README`) → build error. Very long file → `cat` prints it all (capped by the engine's 2000-line
limit), with the MOTD recommending `less`. Unicode names display correctly and sort by codepoint.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `LNX-FS-01` | Tree generated from selectors (no hand-typed content) | `unit: VFS from fixture matches expected tree; every ContentRef has a file` | P3 |
| `LNX-FS-02` | Path resolution incl. `.`, `..`, `~`, `-`, slashes, case sensitivity | `unit: resolution table; '..' at '/' stays '/'` | P3 |
| `LNX-FS-03` | Truthful metadata (size, mtime, mode, owner) | `unit: ls -l fields derive from data` | P3 |
| `LNX-FS-04` | Width-aware file text via `renderText` | `unit: about.txt at 80 and 40 cols` | P3 |
| `LNX-FS-05` | `.bashrc` is the real alias source; `/usr/bin` mirrors the command table | `unit: alias table parsed from .bashrc; which/ls /usr/bin agree with the registry` | P3 |
| `LNX-FS-06` | cwd ↔ URL mapping; unique extension-less sibling names | `unit: codec round-trip; build fails on collision` | P3 |
| `LNX-FS-07` | Permission-denied and read-only behaviours | `unit: cd .ssh → EACCES; touch x → Read-only file system` | P3 |

## Not like the others
The other OSes *present* the virtual tree through file-manager UIs; here the tree **is the interface**, with truthful
`ls -l` metadata, dotfiles, `/etc` and `/usr/bin` so that exploring beyond the obvious is rewarded.
