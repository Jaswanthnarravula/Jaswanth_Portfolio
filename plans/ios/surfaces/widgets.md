# iOS / surfaces — Widgets

## Role + requirement refs
Home Screen widgets that surface the most valuable content at a glance and act as one-tap shortcuts. R14, N5.

## Portfolio mapping

| Widget | Size | Content (from data) | Tap target |
|---|---|---|---|
| **Résumé** | medium (2 rows × 4 cols) | Name, headline, current role + company, "Updated {resume.updated}", two inline actions **Open** · **Download** | `/ios/files/resume` (Open) / PDF download |
| **Open to work** | small (2 × 2), page 2 | `person.openTo` in one or two lines + location | `/ios/mail` |
| **Projects** | small (2 × 2), page 2 | Featured project name + stack dots, cycles only on re-entry (no timers) | `/ios/github/{slug}` |
| **Now** (`IOS-WIDG-05`, `shared/23`) | small (2 × 2), page 2, after Open to work | "Now" caption, `person.now.text` clamped to 3 lines, "Updated {now.updated}" | `/ios/safari` (About) |

## Anatomy
Rounded rectangle, radius 22 pt, fills its grid cells exactly (icon-grid aligned), label under the widget like an app
("Résumé"). Backgrounds: brand gradient (Résumé), tinted material (others). Typography: 13 pt caption caps for the
eyebrow, 17 pt semibold title, 13 pt secondary. Content padding 16 pt.

## Behaviour & states
- The whole widget is a link; inline actions (Open/Download) are separate nested-free controls laid **beside** the
  main link area (no interactive-inside-interactive): main area → Open; a distinct Download button sits in the
  bottom-right corner.
- Tap → dim → flight opens the target app **from the widget's rect**; return flight targets the widget.
- No live timers, tickers or animation loops (battery + `PERF` rules). Content is static per session.
- Long-press → quick actions: Open · Download PDF · Copy link.

## Navigation & routes
Links as in the table. Download emits `resume_downloaded`.

## Motion
Press dim 80/200 ms. Flight per `IOS-FLIGHT-01` with the widget radius (22 pt) as the start radius.

## Responsive
Landscape phone: medium widget becomes a 2 × 3 cell block. Pad: widgets may occupy a left column (3 stacked).
Laptops/desktops: same as pad — the widgets block sits on the leading side of the full-page Home Screen, the Résumé
widget large (2 × 2) on top.

## Accessibility
Each widget is an `article` with a heading (name) and a primary link ("Résumé — open"); Download is a sibling button
"Download résumé (PDF)". Contrast on gradients via scrim tokens.

## Edge cases
Placeholder data → widget shows the placeholder headline; production guard prevents shipping it. Missing PDF →
Download hidden. No featured project → Projects widget hidden and its cells return to icons.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-WIDG-01` | Résumé (medium), Open-to-work and Projects (small) widgets from data | `cmp: render from fixture; hidden when data absent` | P5 |
| `IOS-WIDG-02` | Widget = link; separate Download control (no nested interactives) | `e2e: X1 axe clean; both actions work` | P5 |
| `IOS-WIDG-03` | Flight from/to the widget rect | `e2e: I1 from the Résumé widget` | P5 |
| `IOS-WIDG-04` | No timers/loops; static per session | `perf: no intervals/animations at rest` | P5 |
| `IOS-WIDG-05` | Small "Now" widget on page 2 from `person.now`, opens Safari About | `cmp: widget text from data, clamped; packer places it without overlap; link opens Safari` | P8 |

## Not like the others
Grid-aligned **rounded widgets with app-like labels** that launch apps with the icon flight (Android uses the
**At-a-glance** line and chips; desktops surface the résumé through a Dock stack / pinned taskbar item).
