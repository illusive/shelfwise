# UI guidelines

## References

- **Governing design:** `docs/references/figma/Shelfwise.fig` (decode with `decode.mjs` +
  `summarize.mjs`); export `Shelfwise.png`; decoded values in `decoded-tokens.txt` and copy in
  `screen-copy.txt`. Frames: Home, In store, Camera, Analysis & summary, Archive, Daily
  captures (402 × 874).
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
`Divider`, `BlobImage`, `Toast`. Shared feature components: `VisitRow`, `PriceRow`,
`ShareHero`, `FacingGrid`, `EvidenceCrop`.

## Motion

- Screens: 200 ms fade + 8 px rise on entry (no exit delay).
- Bottom sheets: spring slide (interruptible), overlay fade.
- Thumbnails: layout animation on add/remove; count badge spring.
- Capture: 250 ms white flash. Never delays the next capture.
- `MotionConfig reducedMotion="user"`; CSS durations collapse under reduced motion.

## Deviations from Figma

- Currency DKK in da-DK format (`12,95 kr.`) with pant shown separately (Figma shows £).
- Share of Shelf is for the client (Royal Unibrew, owned + licensed), not a brand dropdown;
  legend shows client, largest competitor company, and "Other & unknown".
- Captures show "Capture 01 · 14:24" instead of shelf names (agreed).
- Home stat "Average shelf share" became "Shelf share this month", aggregated from counts
  (percentages are never averaged).
- A user (switch rep) button on Home; Mock badges throughout.

## Screens invented beyond Figma (for review)

1. Test-rep picker and switch-rep sheet (with _Add demo history_).
2. Stores: assigned + full-catalogue search with address/customer number disambiguation.
3. Store overview (no draft): latest result card, history, empty state, _Start visit_.
4. Camera blocking states (denied, unavailable, insecure, interrupted), captures sheet, tips sheet.
5. Capture inspection sheet with _Retake_/_Remove_.
6. Processing / failure screen with job id, attempts, steps, retry and edit.
7. Results extensions: Shelves/Coolers/Overall toggle, unavailable/qualified states, category
   breakdown, review notice, promotions and displays.
8. Full product report (coverage, SoS table, client products, prices by group, promotions,
   photos).
9. Photo viewer with evidence boxes and legend.
10. Quick review (unresolved products and prices).
