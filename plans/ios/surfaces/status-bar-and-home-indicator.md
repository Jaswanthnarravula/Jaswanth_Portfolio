# iOS / surfaces — Status bar and Home indicator

## Role + requirement refs
The top status strip and the bottom Home indicator — the two pieces of persistent system chrome, and the keyboard /
non-gesture entry points to Home, the App Switcher, Notification Center and Control Center. R14, R42, B10.

## Portfolio mapping
None.

## Anatomy
**Status bar** (height = max(`--sa-t`, 44 pt) on phones; 24 pt across the full page width on tablets, laptops and
desktops, where the left side shows time **and date** — `9:41  Mon 21 Sep`, as iPadOS does):
left = time (`<time>`, 15 pt semibold) · right = signal/Wi-Fi glyphs (decorative) + battery glyph (decorative,
fixed ~80 %). Text colour adapts to the content under it (light/dark via the foreground app's declared
`statusBarStyle`).
**On a real phone** (full-bleed): we **do not draw a fake notch or Dynamic Island** — the device already has one;
our status content sits inside the real safe area. **Larger screens:** the page is the screen, so there is **no
notch, cut-out or bezel drawn anywhere** (north-star B17).
**Home indicator:** 134 × 5 pt pill, 8 pt above `--sa-b`, colour adapts to content; hit area 44 pt tall × 60 % width.

## Behaviour & states
| Element | Interaction | Result |
|---|---|---|
| Home indicator | Tap / Enter | **Home** (app closes into its icon; on Home → goes to page 1) |
| Home indicator | Drag up | Interactive Home gesture; pause → App Switcher (`IOS-FLIGHT-03`) |
| Home indicator | Long-press (500 ms) / Alt+Shift+O | App Switcher |
| Status bar — left/centre | Click/tap, or pull down | Notification Center |
| Status bar — right third | Click/tap, or pull down | Control Center |
| Status bar — time | Tap while in an app | Scrolls the app's content to top (authentic iOS behaviour) |

## Navigation & routes
Home → `go('/ios')` (collapses to the previous entry when applicable).

## Motion
Indicator press: scale-x 1.1 + opacity 0.8 (120 ms). Status bar style crossfades 200 ms between apps.

## Responsive
Phone landscape: status bar hidden (as on iPhones in landscape for most apps) — its two entry points move to small
grab handles at the top-left and top-right; Home indicator stays. Full page (tablets, laptops, desktops): status bar
persistent across the full width with time + date; Home indicator `clamp(134px, 12vw, 220px)` wide and, on fine
pointers, visibly clickable (thickens on hover, tooltip "Home · hold for App Switcher").

## Accessibility
Status bar = `group` "Status bar" with two real buttons: "Notification Center" and "Control Center" (visually they
are the bar's zones). Home indicator = `<button>` "Home" with `aria-description` "Long press for App Switcher". Decorative
glyphs `aria-hidden`. Both remain reachable while an app is open (they are outside the app's `inert` scope).

## Edge cases
Real-device safe areas of 0 (older phones) → status bar uses its 44 pt minimum. Keyboard up → indicator hides with the
browser chrome; `--sa-b` tokens keep layouts stable. Reduced motion → no indicator animation.

## Feature IDs + acceptance tests
| ID | Feature | Acceptance test | Phase |
|---|---|---|---|
| `IOS-STAT-01` | Status bar inside the real safe area on phones, full-width with date on larger screens; **no notch, cut-out or bezel drawn at any size** | `e2e: iphone and chromium-desktop projects have no notch/cut-out/bezel element; desktop status bar spans the viewport` | P5 |
| `IOS-STAT-02` | Status-bar zones as buttons → Notification Center / Control Center; time scrolls to top | `e2e: both open by click and keyboard` | P5 |
| `IOS-STAT-03` | Home indicator: tap = Home, drag = gesture, long-press = switcher | `e2e: I1 all three` | P5 |
| `IOS-STAT-04` | Adaptive status style per app | `cmp: light/dark style follows app declaration` | P5 |
| `IOS-STAT-05` | Landscape handles + pad variant | `e2e: iphone-landscape + ipad` | P5 |

## Not like the others
A **Home indicator pill** instead of navigation buttons, and **two pull-down zones** in the status bar (Android: a
status bar that pulls into one shade + a gesture bar / 3-button navigation with a real **Back**).
