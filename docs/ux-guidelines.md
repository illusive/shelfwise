# UX guidelines

## Principles

- Optimise for experienced reps on a phone in a store; stay understandable on first use.
- One clear primary action per screen, fixed at the bottom (Figma "action" bar).
- The selected store (name + street) is visible on every visit screen, including the camera.
- No mandatory tutorials; guidance sits next to the action (camera tip, info sheet, store tips).

## Capture (highest priority)

- The in-app camera (`getUserMedia`, rear camera, up to 4K) stays open between photos.
  A tap captures immediately: white flash, light haptic (Android), count badge bump. Saving
  happens in the background; the shutter is never blocked by saving.
- No naming, tagging or confirmation during capture. Captures show number and time only;
  shelf/cooler labels appear after analysis.
- The last-photo thumbnail opens a sheet of all captures with _Retake_ (replaces that capture,
  keeps its number) and _Remove_ — without leaving the camera.
- Tips rotate from "Fit the full shelf and its price labels" to "Move along and overlap the
  last photo slightly"; the (i) sheet adds framing, level, overlap and cooler-reflection
  advice.
- The camera stops when the app is hidden and restarts when visible (no background camera).
- Fallbacks: permission denied, no camera, insecure context (HTTP) and interruptions show a
  plain explanation with _Try again_/_Resume camera_ and _Import photos_ (multi-select).
- Same flow for one photo or many.

## Navigation

Floating bottom navigation on Home, Stores and Archive (see `docs/ui-guidelines.md`). Visit
screens use a top bar with back. Flow:
Store → Camera → Daily captures → Processing → Results → Report → Photo / Quick review. A draft
is resumable from Home ("Resume visit · store") and the store page.

## Feedback and states

Every list/screen covers loading (blank, to avoid flashes on fast local reads), empty
(dashed empty state with guidance), partial (qualified measures, unusable photos), success and
failure. Toasts are reserved for removals (with _Undo_ for about 6 s) and failures. Processing shows only states the system
can measure: job created, _n of N photos ready_, analysing (indeterminate) — never fake
percentages.

## Home and planned visits

Home answers "what do I have to do": the week strip selects a day and the numbered list shows that
day's route with the route number, days since the last visit and visited/in-progress state.
One tap opens the visit. History is in the archive and on each store page.

## Draft actions

- Photos are removed directly from the photo wall (× on each photo); the toast offers _Undo_,
  which restores the photo with its number. Images are deleted only when the toast expires
  (left-over images are swept at the next start).
- Tapping a photo opens it full screen (icons: previous, retake, remove, next; zoom to full
  resolution by button or double-tap). The camera's captures sheet uses the same lightbox.
- Analysis starts by swiping the bar to the end (no accidental taps); keyboard and screen
  readers can activate it directly. The round × discards the draft after a confirmation sheet.

## Language

Danish by default; English can be chosen in the user drawer and is remembered on the device.

## Recovery

- Drafts and photos are saved to IndexedDB on capture; reload, navigation away or closing the
  tab keeps them (subject to browser storage eviction).
- Opening the full report with unresolved items first offers the quick review.
- Submission is idempotent; failures keep the visit and photos, offer _Retry analysis_
  (same job) or _Edit photos_ (reopens the draft).
- Jobs interrupted by reload resume automatically.

## Accessibility

- Text and icons accompany colour for status (badges, unresolved patterns, legends).
- Touch targets ≥ 44 px; inputs ≥ 16 px; focus rings visible.
- Sheets are Radix dialogs (focus trap, Escape, labelled). Segmented control is a radio group.
- Evidence boxes are keyboard-focusable with labels.
- `prefers-reduced-motion`: Motion disables transforms; CSS durations drop to 0.

## Device validation (manual, pending)

Test on iOS Safari 17+ and Android Chrome via the Docker HTTPS URL: permission prompt and
denial, rapid capture (10+ photos), retake/remove, background/foreground during capture,
import from library, reload during processing, install to home screen.
