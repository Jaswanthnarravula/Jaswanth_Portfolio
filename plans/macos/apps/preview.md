# macOS / apps — Preview

## Role + requirement refs
The **résumé viewer** — target of the résumé fast path on macOS (`RES-IDIOM-01`). R23, R24, N5.
`AppRole: viewer` · slug `preview` · owns `resume`.

## Portfolio mapping
`ResumeView` (`shared/03`): the PDF at `portfolio.resume.file` + metadata (updated date, pages). Fallback content:
the semantic résumé built from data (experience, education, skills) when the PDF is absent or can't render inline.

## Anatomy
Window 820 × 920 default, clamped to the workspace (min 480 × 480). Title "Résumé.pdf". Toolbar: sidebar toggle
(page thumbnails) · zoom out / zoom in / actual size · page indicator "1 / N" · **Download** · Share (Copy Link →
`/go/resume`) · Print (calls `window.print()` on a print-styled semantic résumé). Body: pages on a neutral grey
canvas with soft page shadows; thumbnails sidebar 140 px.

## Behaviour & states
| State | Behaviour |
|---|---|
| Render | The PDF's pre-rendered page images (generated at build from the owner's `Resume.pdf`; shared/03 `VIEW-RESUME-01` — no inline `<object>`) at the zoomed width; selectable text layer omitted — the PDF's own text is offered as "Text version"; thumbnails are the same page images |
| Zoom | 50–300 % in steps; Ctrl/Cmd + wheel **inside the canvas only**; fit-width default |
| Thumbnails | Click jumps to page; current page highlighted |
| Download | `<a download="Jaswanth-Resume.pdf">`; emits `resume_downloaded`; banner "Résumé.pdf downloaded" |
| Text version | Toggles to the semantic résumé (content views) — also what screen readers get first |
| Missing PDF (placeholder phase) | Text version only; Download hidden |

## Navigation & routes
`/macos/preview` (single-section app). Zoom/page are session state.

## Menu-bar menus
File: Download · Print… · Close Window. View: Thumbnails · Zoom In/Out · Actual Size · Text Version. Go: Next/Previous Page.

## Motion
Open from the Dock stack / desktop item rect. Page jump: smooth scroll 240 ms (instant under reduced motion).

## Responsive
`medium`: thumbnails hidden by default. `compact`: toolbar reduces to Download · Share · Text version; pinch-zoom is
left to the browser on the page images (no custom gesture); pages fit width.

## Accessibility
The **Text version is first in DOM order** (visually toggled), so AT users get real headings and lists; the PDF
pages (decorative images) have a "Download PDF (120 KB)" link beside them. Toolbar is a `toolbar` role group with labelled
buttons. Page indicator is not live.

## Edge cases
PDF blocked by the browser's viewer settings → images + text version. Very tall window → pages centre with max
width 900 px. Print → print stylesheet hides all OS chrome.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `MAC-PREV-01` | Viewer window with toolbar, thumbnails, page canvas | `e2e: Q1 opens from Dock stack and desktop item` | P3 |
| `MAC-PREV-02` | The PDF's pages as page images (shared/03 `VIEW-RESUME-01`) | `e2e: webkit project shows pages` | P3 |
| `MAC-PREV-03` | Download with filename + analytics + banner | `e2e: RES-DL-01 on macOS` | P3 |
| `MAC-PREV-04` | Text version first in DOM; toggle | `e2e: X1 axe clean; headings present` | P3 |
| `MAC-PREV-05` | Zoom scoped to the canvas | `e2e: ctrl+wheel zooms pages, not the OS` | P3 |
| `MAC-PREV-06` | Print stylesheet hides OS chrome | `unit: print CSS snapshot` | P3 |

## Not like the others
A dedicated document viewer with a thumbnail sidebar (Windows opens PDFs in **Edge**; iOS uses **Quick Look** inside
Files; Android uses a PDF viewer inside Files; Linux hands off to a viewer tile from `open resume`).
