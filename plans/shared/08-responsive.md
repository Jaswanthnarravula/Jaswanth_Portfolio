    # shared/08 — Responsive behaviour

## Purpose
Phones, tablets and laptops are each **designed for**, not shrunk to. This file fixes the size classes, input
axes, viewport rules and the gesture ↔ alternative inventory. Per-OS layouts live in `{os}/04-responsive.md`.
Requirements: R42, D.

## Decisions

| Decision | Rationale | Rejected |
|---|---|---|
| **Size class** (CSS) and **input modality** are separate axes | A touch laptop and a mouse-driven tablet exist | Width-only breakpoints |
| Same DOM in every posture; CSS decides layout, kernel `posture` only gates *behaviour* | No hydration mismatch, no CLS, rotation is free | Rendering different trees per device |
| **Every OS fills the whole page at every size — no device frames.** iOS/Android: phone layout on phones, **full-page iPadOS / large-screen Android layout** on tablets, laptops and desktops (owner decision 2026-09-21) | The visitor should be *inside* the OS, not looking at a picture of a phone; frames also shrink tap targets and waste the page | Phone/tablet mock-up frame on laptops · `transform: scale()` mock-ups · stretching the iPhone grid across a landscape page |
| macOS/Windows on phones: **compact window mode** | Free-floating windows are unusable at ~390 px | Shrunk desktop |
| No user-agent sniffing, no orientation lock, no `/m/` routes | Unreliable; WCAG 1.3.4; breaks shared links | — |

## Specification

### Size classes (CSS custom media / container queries)
- `compact`: `(max-width: 699.98px), (max-height: 499.98px)`
- `medium`: 700–1099.98 px wide and ≥ 500 px tall
- `expanded`: 1100–1599.98 px wide
- `large`: ≥ 1600 px

Input: size tap targets with `(any-pointer: coarse)`; gate hover effects with `(hover: hover) and (pointer: fine)`;
JS tracks the last `pointerType`. Kernel **posture**: `compact` · `touch` (medium, or primary coarse pointer) ·
`pointer`. Compact mode also engages at 400 % zoom on a laptop (WCAG 1.4.10 Reflow).

### Behaviour matrix (summary)

| | Phone portrait | Phone landscape | Tablet | Laptop | Desktop |
|---|---|---|---|---|---|
| Hello / Netflix | Single column, `svh` sizing, 2-col profile grid | Two columns, no scroll | Centred 640 px column | + top-tier WebGL after LCP | Capped width |
| OS chooser | 2-col link cards (5th spans), ≥ 88 px tall | 5 compact tiles | 3 + 2 grid | 5 across, preview on hover **and** focus | same |
| iOS | Full-bleed, 4-col grid, real safe areas | Grid reflows, Dock to trailing edge | Full page, iPadOS layout: 6-col, widgets block, floating Dock, split-view apps | **Full page**: 7-col viewport-sized grid, floating Dock, apps open to the whole page; hover platter, click-drag = swipe | Full page, 8-col, grid centred with margins |
| macOS | Compact mode: one maximized window, scrolling Dock, single 44 px window-controls menu | Dock as left rail | Floating windows, touch drag, 44 px resize corner, tile from menu | Full fidelity | Larger default windows |
| Windows | Compact: 48 px taskbar, Start as full-height sheet | 40 px taskbar, 2-col Start | Tablet posture, Snap from caption menu | Full fidelity + edge Snap | same |
| Android | Full-bleed launcher | Dock to side, shade as side panel | Full page, large-screen launcher: 6 cols, taskbar, two-pane shade | **Full page**: 7-col viewport-sized grid, taskbar with Back/Home/Recents (3-button default), apps open to the whole page | Full page, 8-col, grid centred with margins |
| Linux | Full-bleed terminal + accessory key row | Title strip hides with keyboard up | Full-bleed, accessory row on coarse pointer | Terminal tile + viewer tile on `open` | Wider |

### Viewport units and safe areas (`RESP-VP-01`)
Shell root `height: 100dvh`; document never scrolls; `overscroll-behavior: none` on OS routes only. Hello/plain
hero sizing uses `svh`; fixed wallpaper uses `100lvh`; never bare `vh`. Safe-area tokens `--sa-{t,r,b,l}:
env(safe-area-inset-*, 0px)` on `:root` (requires `viewportFit: 'cover'`); components read tokens only (tests
override them). No horizontal gestures within 24 px of a screen edge (system Back owns it). Home-indicator pill
is a real button above `--sa-b`. `touch-action: manipulation` on controls, `none` only on active drag handles.

### Virtual keyboard (`RESP-KB-01`)
`interactiveWidget: 'resizes-content'` (Android Chrome). iOS Safari: a rAF-throttled `visualViewport`
resize/scroll listener writes `--vvh` and `--vv-top`; terminal root uses `position: fixed; height: var(--vvh, 100dvh)`.
Prompts are `<form>` + `<input enterkeyhint="send">`; read `input.value` on `input` events (Android IMEs report
keyCode 229); accessory keys `preventDefault()` on `pointerdown` so the input keeps focus; all inputs ≥ 16 px on
coarse pointers (prevents iOS focus zoom).

### Tap targets (visual size may stay authentic; hit area may not)
iOS 44 × 44 · Android 48 × 48 with 8 dp gaps · Windows 40 × 40 coarse / 32 fine (caption 46 × 32 → 48 × 44) ·
macOS 24 × 24 fine (traffic lights 14 px dots on a 24 px pitch), one 44 px controls menu on coarse · Linux
accessory keys 44 px, `ls` rows ≥ 28 px on coarse.

### Rotation and resize (`RESP-ROT-01`)
rAF-debounced `VIEWPORT_CHANGED`; window rects re-clamped from the matching size-class bucket; an in-flight drag
commits its last valid rect; grids reflow; return flights re-measure the icon's **current** rect.

### Gesture ↔ alternative inventory (every gesture must have its row)

| Gesture | Non-gesture alternative |
|---|---|
| Drag window | Window menu → Move (arrows, Enter, Esc) + Tile / Center |
| Resize at edge | Size mode, Maximize, Snap |
| Double-click title bar | Maximize button |
| Right-click / long-press (500 ms) | `contextmenu` event (Shift+F10, Menu key, VO shortcut) + visible "⋯" on the selected item |
| Swipe between home pages (CSS scroll-snap) | Page-dot buttons; arrow keys cross pages |
| Swipe up to go home | Home pill button, Esc, browser Back |
| Pull down for search | Search pill, Ctrl/Cmd+K, `/` |
| Swipe a banner away | Close button; the item stays in Notification Center |
| Swipe for drawer / shade | "All apps" button / status-bar button |
| Tap an `ls` entry (inserts, never runs) | Typing, Tab completion |
| Dock hover magnify + label | Label also shown on `:focus-visible` |

Deliberately **not built**: icon rearranging / jiggle mode (would need a full keyboard alternative, adds nothing).

## Edge cases
Short, wide laptop viewport (e.g. 1366 × 650 after browser chrome) → iOS/Android grids drop to fewer rows (icon size
is derived from height) and the overflow moves to the next Home page deterministically. Ultra-wide screens (21:9,
≥ 2560 px) → grids stay centred at their max width; the wallpaper covers the extra space. Split-screen/foldables →
size class re-evaluated live. Browser URL-bar collapse → `dvh` handles it; nothing is pinned with `vh`.

## Feature IDs + acceptance tests

| ID | Feature | Acceptance test |
|---|---|---|
| `RESP-CLASS-01` | Size classes + posture | `unit: classify(844×390)=compact; classify(1180×820,coarse)=touch` |
| `RESP-DOM-01` | Same DOM across postures | `e2e: X2 ARIA snapshot identical structure at 390 and 1440 wide` |
| `RESP-VP-01` | dvh/svh + safe-area tokens | `e2e: X4 no horizontal scroll at 320 px; safe-area override respected` |
| `RESP-KB-01` | Virtual keyboard handling | `e2e: L3 simulated visualViewport change keeps the prompt visible` |
| `RESP-TAP-01` | Tap-target minimums per OS | `e2e: X3 tap-target audit green on every OS home` |
| `RESP-ROT-01` | Rotation/resize re-clamp | `e2e: O1 rotate mid-session; windows clamped; drag committed` |
| `RESP-GEST-01` | Every gesture has its alternative | `e2e: M1 keyboard-only journey; no gesture-only path in any OS` |
| `RESP-ZOOM-01` | 400 % zoom → compact mode; 200 % text OK | `e2e: zoomed laptop project usable, no clipped controls` |

## Open questions
None.
