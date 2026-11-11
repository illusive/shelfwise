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
caps + step dashes), `Mono`, `Badge`, `MockBadge`, `Notice`, `SectionHeader`, `EmptyState`,
`Divider`, `BlobImage`, `Toast` (optional action, e.g. _Undo_), `SwipeToConfirm`. Shared feature components: `AppHeader` + `UserDrawer` + `Avatar`, `VisitRow`, `PriceRow`,
`ShareHero`, `FacingGrid`, `EvidenceCrop`, `PhotoWall`, `Lightbox`, `SubmitBar`.

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
- Draft screens use a swipe-to-analyse bar with a round discard button instead of a primary
  button; with more than one photo, a photo wall (≈3 per row) replaces the large lead image.
- Bottom navigation follows the user's other app (see Navigation).

## Screens invented beyond Figma (for review)

1. User drawer (current rep, language, switch rep, _Add demo history_) opened from the top-right
   avatar.
2. Stores: assigned + full-catalogue search with address disambiguation.
3. Store overview (no draft): latest result card, history, empty state, _Start visit_.
4. Camera blocking states (denied, unavailable, insecure, interrupted), captures sheet, tips sheet.
5. Photo wall with quick remove (+ _Undo_ toast), full-screen lightbox with _Retake_/_Remove_/back,
   and the swipe-to-analyse bar with discard confirmation.
6. Processing / failure screen with job id, attempts, steps, retry and edit.
7. Results extensions: Overall/Shelves/Coolers toggle, unavailable/qualified states, category
   breakdown, review notice, promotions and displays.
8. Full product report (coverage, SoS table, client products, prices by group, promotions,
   photos).
9. Photo viewer with evidence boxes and legend.
10. Quick review (unresolved products and prices).
