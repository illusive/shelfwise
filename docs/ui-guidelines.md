# UI guidelines

## References

- **Governing design:** `Shelfwise.fig` with its PNG export, decoded tokens and screen copy.
  These are kept locally in `.references/figma/` and are not in the repo. Frames: Home, In store,
  Camera, Analysis & summary, Archive, Daily captures (402 × 874).
- Where the Figma and the agreed decisions differ, decisions win and are noted below.

## Tokens (`src/ui/tokens.css`)

| Group                      | Values                                                                                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Colour (Figma)             | primary `#173d32`, deep `#102b24`, accent/lime `#d8ed94`, paper `#f5f4ee`, muted text `#68746c`, lines `#d2d8cc`/`#d9ded4`, surface muted `#eaede4`, sage `#9bae8c`/`#c6d2c6`/`#b8c3b7`, warning `#edead9`/`#725f30`/`#9c8650` |
| Colour (extension)         | danger `#9a3b2a`/`#f3e3dc`, overlay, evidence box colours                                                                                                                                                                      |
| Type                       | Manrope 500/600/700, IBM Plex Mono 400 (self-hosted via @fontsource). Sizes 9–36 px and 86 px display; display tracking −4.5 % (from Figma)                                                                                    |
| Radii (Figma)              | 2, 6, 10, 12, 18, 20, 26                                                                                                                                                                                                       |
| Spacing                    | 4 px grid, 18 px page gutter                                                                                                                                                                                                   |
| Elevation, motion, z-index | Extensions (Figma has no effects): sheet/float shadows; 120/200/320 ms, `cubic-bezier(.2,.8,.2,1)`; nav < action < camera UI < overlay < sheet < toast                                                                         |

## Primitives (`src/ui/primitives`)

`Button` (primary with lime arrow circle, secondary, ghost, accent pill, danger), `IconButton`,
`Screen` (page shell + fixed action + bottom nav, entry transition), `TopBar`, `Wordmark`,
`BottomNav`, `Sheet` (Radix Dialog + spring), `Segmented` (Radix ToggleGroup), `Eyebrow` (mono
caps + step dashes), `Mono`, `Badge`, `Notice` (white card, tinted icon badge for the tone, title + muted text, optional compact secondary `Button` action), `SectionHeader`, `EmptyState`,
`Divider`, `BlobImage`, `Toast` (optional action, e.g. _Undo_), `SwipeToConfirm`, `Switch` (Radix Switch in a white setting row: label + muted hint, 48 × 28 track, primary when on with a lime thumb, 44 px target). Shared feature components: `AppHeader` + `UserDrawer` + `Avatar`, `VisitRow`, `PriceRow`,
`ShareHero`, `FacingGrid`, `EvidenceCrop`, `PhotoWall`, `Lightbox`, `SubmitBar`.

## Field-app patterns (extensions following the user's other app)

- **StoreHeader** (`features/shared/StoreHeader`): full-bleed dark-green header with outlined back
  button, white logo circle (`StoreLogo`), name, two-line Danish address and status chips. Used
  on every store-related screen, followed by a `PageTitle`.
- **Planned visits on Home** use the original Figma list-row language (like "Recent visits"):
  round chain logo with a small route-number badge, store name, street (+ floor) and mono
  postcode/city line, a right-aligned value (days since the last visit, empty for stores never visited; visited/in-progress as
  badges) and a chevron, separated by dividers. Visit tags are kept
  in the data but not shown. **DayStrip**: Monday–Sunday, selected day filled, today ringed, dot
  when visits are planned. The heading is a standard `SectionHeader` with the visit count.
- **Store logos** (`StoreLogo`, metadata in `features/shared/storeLogos.ts`): the logo fills the
  whole round bubble — square/round marks edge to edge (`cover`), wordmarks on the brand colour
  at a per-chain scale. Brand colours live with the logo metadata, not in components.
- **Close/back controls** in modals, the lightbox, the camera and headers use `IconButton`
  tones `outline`/`outline-light` (circular border, 44 px touch target).
- **Lightbox**: icon-only actions (previous, retake, remove, next) and a zoom toggle/double-tap
  that shows the photo at full resolution with panning. The camera's captures sheet opens the
  same lightbox.

## Live detection overlay (camera)

`DetectionOverlay`: rounded corner brackets (2.5 px, `--color-accent`, faint lime fill) per tracked
drink, positioned through the preview's `object-fit: cover` mapping, eased (~140 ms) between
updates and smoothed by an EMA tracker; boxes fade in/out and dim while briefly lost. Chip above the
shutter: dark translucent pill with a lime dot. Toggle: scan icon in the camera top bar (lime when
on). Under reduced motion boxes are static.

## Overlap guide (camera, extension)

`OverlapGuide`: the previous photo's right-edge strip at 50 % opacity, pinned left at the
target width (25 %), with a 2 px lime inner edge. A dashed lime target band spans target ±
tolerance and fills faintly when aligned. A vertical marker (2 px white line + 14 × 44 px pill
handle, panorama-style) sits where the previous photo ends in the live view and turns
`--color-accent` when aligned; it is hidden while confidence is low. The hint replaces the
camera tip (same dark translucent card). _Ny sektion_: dark translucent pill, bottom-left above
the detection chip. `LevelIndicator`: 64 px horizon line over a dashed 96 px reference, white →
lime when level, degrees in mono below. Toggle: overlapping-frames icon in the top bar (lime
when on). Marker and horizon ease with `--duration-base`/`--duration-fast`; static under reduced
motion.

## Navigation (extension following the user's other field app)

The Figma's full-width tab bar is replaced by a floating, inset, dark-green bar of connected
"gooey" blobs, matching the navigation of the user's existing field app: icon-only items (Home
in the left blob, Stores in the larger centre circle, Archive in the right blob), joined by an SVG
goo filter. The active item gets a white disc with a dark-green icon (centre: white disc with a
dark-green inner ring) that glides between items via a shared Motion `layoutId` (instant under
reduced motion). Each item has an accessible name, ≥ 44 px target, visible focus ring, and the
bar sits above the safe-area inset.

## Motion

- Screens: 200 ms fade + 8 px rise on entry (no exit delay).
- Bottom sheets: spring slide (interruptible), overlay fade.
- Thumbnails: layout animation on add/remove; count badge spring; the camera thumbnail is a
  fan of up to three photos (newest on top).
- Results: share counts up from 0 and the facing grid fills in order (≈0.9 s, replays on
  scope change).
- Submit: swipe-to-confirm thumb springs back if released early.
- Navigation: active indicator glides between items.
- Capture: 250 ms white flash. Never delays the next capture.
- `MotionConfig reducedMotion="user"`; CSS durations collapse under reduced motion.

## Deviations from Figma

- Currency DKK in da-DK format (`12,95 kr.`) with pant shown separately (Figma shows £).
- Share of Shelf is for the client (Royal Unibrew, owned + licensed), not a brand dropdown;
  legend shows client, largest competitor company, and "Other & unknown".
- Captures show "Capture 01 · 14:24" instead of shelf names (agreed).
- Home stat "Average shelf share" became "Shelf share this month", aggregated from counts
  (percentages are never averaged).
- A user avatar with a circular border (top right of Home, Stores and Archive) opens the user
  drawer; Mock badges throughout.
- Danish is the default UI language (English selectable); addresses use the Danish order
  "Vesterbrogade 12, 1. sal, 1620 København V"; customer numbers are not shown.
- Results open on _Overall_ (order Overall · Shelves · Coolers); the "Saved to store" line was
  dropped.
- No Mock badge or simulated-analysis notices (user decision; see `docs/decisions.md`).
- Home shows planned visits instead of the hero banner and recent visits.
- Draft screens use a swipe-to-analyse bar with a round discard button instead of a primary
  button; with more than one photo, a photo wall (≈3 per row) replaces the large lead image.
- Bottom navigation follows the user's other app (see Navigation).

## Screens invented beyond Figma (for review)

1. User drawer (current rep, language, data-use switch, switch rep, _Add demo history_,
   developer-only training export in a dashed panel, build stamp in mono at the bottom) opened
   from the top-right avatar.
1. Home planned visits: day strip + Figma-style list rows.
1. Shared store header on all store-related screens.
1. Report gate sheet when unresolved items remain.
1. Stores: assigned + full-catalogue search with address disambiguation.
1. Store overview (no draft): latest result card, history, empty state, _Start visit_.
1. Camera blocking states (denied, unavailable, insecure, interrupted), captures sheet, tips sheet.
1. Camera live guidance: detection brackets + chip, overlap guide (previous-photo strip, target
   band, marker, hints, _Ny sektion_) and level indicator.
1. Photo wall with quick remove (+ _Undo_ toast), full-screen lightbox with _Retake_/_Remove_/back,
   and the swipe-to-analyse bar with discard confirmation.
1. Processing / failure screen with job id, attempts, steps, retry and edit.
1. Results extensions: Overall/Shelves/Coolers toggle, unavailable/qualified states, category
   breakdown, review notice, promotions and displays.
1. Full product report (coverage, SoS table, client products, prices by group, promotions,
   photos).
1. Photo viewer with evidence boxes and legend.
1. Quick review (unresolved products and prices).
