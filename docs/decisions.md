# Decisions

Material decisions agreed during discovery (the original brief and discovery plan are kept locally in `.references/`, not in the repo) and made
during the build. Each rule has one home; link here rather than restating.

## Agreed decisions

| Topic              | Decision                                                                                                                                                                                         | Rationale                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Repository         | Local git repo, no remote yet; commit locally, no automatic PRs.                                                                                                                                 | User preference.                                        |
| AI                 | No live endpoint yet: typed `AnalysisProvider` + clearly badged mock adapter. Foundry adapter later, server-side.                                                                                | Credentials must not reach the browser; contract first. |
| Data               | Frontend-only IndexedDB (Dexie) for reps, stores, drafts, blobs, visits, jobs, results, corrections, behind repository interfaces.                                                               | Fast POC; API can replace it.                           |
| Share of Shelf     | Visible facings: client ÷ all eligible beverage facings × 100. Shelves and coolers separate; overall aggregates counts; unknowns stay in the denominator.                                        | Defensible, testable; avoids inflating client share.    |
| Denominator        | All beverages; overall + optional per-category (beer, soft drinks, water, energy/functional, RTD/cider, other).                                                                                  | Matches how reps see shelves.                           |
| Client brands      | Everything Royal Unibrew sells in DK, owned + licensed/distributed, tagged `owned`/`licensed`.                                                                                                   | Business reality (Pepsi, Heineken…).                    |
| Locations          | `shelf`, `cooler`, `display`; displays counted, excluded from SoS. Classification from analysis, not manual tags.                                                                                | Faster capture than the incumbent tool.                 |
| Rep review         | Quick review of unresolved items only; AI values and rep corrections stored separately with provenance.                                                                                          | Accuracy without re-keying everything.                  |
| Execution KPIs     | Out-of-stock/must-stock and price compliance deferred; stores keep `mustStockProductIds` and `targetPrices`.                                                                                     | Scope.                                                  |
| Reporting          | No export/manager reporting; data stays flat and versioned.                                                                                                                                      | Scope.                                                  |
| Market             | Danish UI by default, English selectable in the user drawer (persisted per device); all strings in `src/i18n/{da,en}.ts`; DKK and da-DK number formats; pant separate; multibuy conditions kept. | User request.                                           |
| Devices            | iOS Safari 17+, Android Chrome; in-app `getUserMedia` with continuous capture + import fallback.                                                                                                 | Rapid repeated capture is the core interaction.         |
| Identity           | One default seeded rep (Alex Holm, matching the Figma) with no start-up picker; other test reps selectable from the user drawer (top right). Stored locally; no authentication.                  | POC; user request to roll with one user.                |
| Design             | Figma governs; invented screens extend its language and are listed in `docs/ui-guidelines.md`. Captures show number/time; labels only after analysis.                                            | Agreed.                                                 |
| Stack              | Vite, React 19, TS, TanStack Router + Query, Radix, Motion, Zod 3, Dexie, vite-plugin-pwa, CSS Modules + tokens, Vitest, Playwright.                                                             | Agreed.                                                 |
| Dev/test env       | GitHub Pages (`illusive/shelfwise`, public) deployed by Actions on every push to `main`, for phone testing over HTTPS; Docker Compose (nginx, HTTPS on the LAN) kept for local testing.          | Phones need a secure context for the camera.            |
| Reference material | The brief, discovery plan, Figma file and competitor deck are kept locally in `.references/` (gitignored) and were removed from git history before the first push.                               | The repository is public; the material is confidential. |

## Build-time decisions

| Topic                   | Decision                                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate matches       | Count as unknown in SoS and need review; only `matched` (or rep-corrected) facings are credited.                                                          |
| Qualification threshold | Unknown share > 25 % qualifies a measure.                                                                                                                 |
| Overlap                 | `physicalPositionId`/`physicalLabelId` dedupe; clear view beats unclear; conflicts become unknown; missing ids qualify the scope.                         |
| Comparisons             | Previous = latest completed visit to the same store (any rep) before this one. Coverage differs if location count differs or usable photos differ > 1.5×. |
| Photos                  | Stored at full stream/file resolution (JPEG q 0.92 from camera); thumbnails ~480 px for lists. Camera requests up to 3840×2160.                           |
| Draft model             | One open draft per store and rep; _Edit photos_ after a failure cancels the job and issues a new idempotency key.                                         |
| Home stat               | "Shelf share this month" = latest visit per store this month, counts aggregated.                                                                          |
| Dates                   | Wording follows the UI language (da-DK or en-GB patterns), store time zone (`Europe/Copenhagen`).                                                         |
| Addresses               | Danish order: street and number, floor (etage, optional), postcode and city. Customer numbers are kept in data but not shown.                             |
| Photo removal           | Immediate with an _Undo_ toast; images purged after the toast expires, orphans swept at start-up.                                                         |
| Mock label text         | Mock promotions and conditions are written in Danish, as they would appear on Danish shelf labels.                                                        |
| Versions                | Pinned mature majors (Vite 7, Vitest 3, TS 5.9, ESLint 9, Zod 3) over the very latest majors to keep APIs stable.                                         |
| Demo data               | _Add demo history_ renders shelf images on a canvas and stores backdated mock results through the same contract.                                          |
| Docker certs            | Named volume (no host file sharing needed); `npm run docker:certs` loads host/mkcert certs.                                                               |

## Field-app alignment (user requests, Nov 2026)

| Topic          | Decision                                                                                                                                                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Home           | Shows the rep's **planned visits** (week day-strip + Figma-style list rows; tags kept in data but not shown), not recent visits; the Figma hero banner and recent-visits list were dropped. History lives in the archive and store pages.                                                                          |
| Planned visits | New `PlannedVisit` model (rep, store, store-local date, route order, tags) behind `repos.plannedVisits`; demo plans are generated per week at start-up (`src/services/seed/plans.ts`) and can be replaced by an API. Tapping a plan opens that visit (starts/resumes the draft; completed → results).              |
| Store header   | One shared full-bleed header (logo, name, two-line address, status) on every store-related screen; the "Store visit" title, slogan, eyebrow and three-step progress dashes were removed.                                                                                                                           |
| Store logos    | Real chain logos bundled for demo data only; they are trademarks of their owners and are listed with sources in `docs/logo-sources.md`. Replace before production use. The Danish Netto mark is used; logos fill the round bubble in the brand colour.                                                             |
| Mock indicator | **User-directed override of the brief's "mocked results clearly identifiable":** the Mock badge, the simulated-analysis notice and the mock-boxes notice are no longer shown. Results still store `source: "mock"` so they remain distinguishable in data, and a live provider must keep setting `source: "live"`. |
| Report gate    | Opening the full report with unresolved items asks the rep to review them first (or continue). The review notice sits directly under the page title.                                                                                                                                                               |
| Wording        | Swipe bar reads "Analysér …"; discard confirmation's cancel is "Annuller".                                                                                                                                                                                                                                         |

## Live drink detection (camera)

| Topic      | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope      | Optional, generic on-device detection of bottles/cans as **framing guidance only** ("12 drikkevarer i billedet"). No brand/SKU recognition. It never feeds Share of Shelf, prices or any stored result, and capture never depends on it.                                                                                                                                                                                                                                                                               |
| Engine     | MediaPipe Tasks Vision `ObjectDetector` (Apache-2.0, maintained by Google) with **EfficientDet-Lite0 int8** (COCO; Apache-2.0), classes `bottle` and `cup`. Runs in a module Web Worker on the **CPU (WASM SIMD) delegate** — the GPU delegate silently returned no detections in testing. Assets are self-hosted: `public/models/efficientdet_lite0_int8.tflite` (from `storage.googleapis.com/mediapipe-models`) and the wasm runtime copied from `node_modules` at build time (`public/mediapipe/`, not committed). |
| Cost       | ~19.7 MB raw / ~8 MB gzip, fetched only once the camera is running, then cached (Workbox CacheFirst, not precached). Desktop Chromium: model ready ≈0.8 s, ≈50 ms per inference, throttled to ≤8 fps; shutter feedback ≈40 ms with detection running.                                                                                                                                                                                                                                                                  |
| Safeguards | Throttled (125 ms), frames skipped while busy, paused when the page is hidden or a sheet/lightbox is open, auto-off when average inference > 300 ms or the model/wasm fails. Toggle in the camera (persisted, default on).                                                                                                                                                                                                                                                                                             |
| Limits     | COCO EfficientDet-Lite0 finds bottles well but **under-detects cans** (on a real cooler photo: 23 bottles found, almost no cans) and counts only what is in the cropped preview. Needs validation on the user's iPhone 15.                                                                                                                                                                                                                                                                                             |

## Shelf "slot" detection — licence review (11 Nov 2026)

Request: replace the COCO bottle/cup detector with a class-agnostic shelf-facing detector (e.g.
YOLO trained on SKU-110K) so cans and every facing are marked. **Outcome: not shipped** — no
ready-made weights are cleared for a commercial client POC. The COCO detector stays.

Why cans are missed today: COCO has no "can" class (only `bottle`/`cup`), the model runs at
320 px, and dense rows of small, identical items are exactly what general detectors handle worst.

| Option                                                                                                                                                            | Licence                                                                                                                                                                                                                                 | Verdict                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Any model trained on **SKU-110K** (incl. the authors' RetinaNet and community YOLO weights on Hugging Face/Roboflow)                                              | Dataset "for the exclusive use by the recipient and solely for academic and non-commercial purposes" (Trax)                                                                                                                             | ✗ Not usable for a commercial client; a weights file's own MIT/Apache tag does not lift the dataset terms.       |
| **Ultralytics** YOLOv5/v8/11 weights or training code                                                                                                             | AGPL-3.0 (or paid Enterprise licence)                                                                                                                                                                                                   | ✗ Unless the app is open-sourced under AGPL or a licence is bought.                                              |
| **YOLO-World** (open-vocabulary, "can"/"bottle" prompts)                                                                                                          | GPL-3.0                                                                                                                                                                                                                                 | ✗ Copyleft; also heavy for in-browser real time.                                                                 |
| **RT-DETR / D-FINE** with **Objects365**-pretrained weights (classes include bottle and canned goods)                                                             | Code + base weights Apache-2.0, **but** Objects365 is "available for the academic purpose only" (objects365.org/download.html); D-FINE's README: `*_obj365`/`*_obj2coco` checkpoints "should not be assumed to be commercially cleared" | ✗ Re-checked 11 Nov 2026 (see below).                                                                            |
| **OWLv2 / Grounding DINO** (open-vocabulary)                                                                                                                      | Apache-2.0 (verify per checkpoint)                                                                                                                                                                                                      | ◐ Licence-viable, far too large for on-device live use; candidates for the backend.                              |
| **Train our own** class-agnostic facing detector (YOLOX or RT-DETR, Apache-2.0) on Royal Unibrew / own shelf photos (+ Open Images "Bottle"/"Tin can", CC BY 4.0) | Our data + Apache-2.0                                                                                                                                                                                                                   | ✓ Cleanest and best long-term (also feeds the evaluation set); needs a labelled photo set and GPU training time. |
| **Licence SKU-110K commercially** from Trax                                                                                                                       | Commercial terms                                                                                                                                                                                                                        | ✗/? Trax sells retail-execution software (a competitor), so unlikely.                                            |

**Follow-up (11 Nov 2026):** tried the "licence-viable" route — smallest Objects365 checkpoint
(D-FINE-S `dfine_s_obj365`, 10M params; RT-DETR's Objects365 checkpoints are equivalent). The
specific checkpoint does **not** qualify: Objects365's download terms restrict it to academic use
and D-FINE's own README flags the Objects365 checkpoints as not commercially cleared. Nothing was
downloaded, exported or measured, and no new model shipped; the COCO EfficientDet-Lite0 overlay
remains the live detector. The data-cost rule (load models > ~15 MB only off metered/cellular
connections or after opt-in) applies to any future slot model.

Recommendation: keep the COCO overlay as framing help for now; collect and label 200–500 real
store photos during the field POC and train an Apache-licensed class-agnostic detector (YOLOX-nano
or RT-DETR-S) on them — the same photo set the brief needs for evaluation.

## Overlap guide (camera, 11 Nov 2026)

Reps photograph shelves sideways, left to right, each photo covering the full shelf height. The
guide helps them keep a small, consistent overlap (target 25 %, `VITE_OVERLAP_TARGET`, ±7 %)
with no gaps.

| Topic       | Decision                                                                                                                                                                                                                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scope       | **Guidance only.** No auto-capture; the shutter is never delayed or disabled by it. Estimates are stored as capture metadata for later reconciliation, never used in metrics. Toggle in the camera bar (persisted, default on).                                                                                                                                    |
| Strip       | After each new photo, the right 25 % of what the rep saw is shown translucently on the left of the viewfinder. A run resets on _Ny sektion_ or after a 2-minute pause; retakes do not move the run on.                                                                                                                                                             |
| Matching    | Framework-free zero-mean normalised cross-correlation of 96 px-wide grayscale frames (horizontal search, ±3 px vertical). Confidence combines peak strength and its margin over the next-best peak, so **repetitive shelves of identical cans read as low confidence** — the guide then says "Ret striben ind efter hylden" and leaves the strip to the rep's eye. |
| Runtime     | One shared vision worker and frame pump with live detection (no second frame grab). ≈2–4 ms per alignment on desktop Chromium; auto-off above 120 ms average; paused when hidden or under a sheet/lightbox.                                                                                                                                                        |
| Tilt        | `DeviceMotionEvent` gravity → roll; a level line turns lime within ±2.5°. iOS permission is requested from the tap that opens the camera (and a _Vis vaterpas_ button); denied/missing sensors simply hide the level. Tilt changes damp the overlap estimate. Roll sign is unverified on iOS.                                                                      |
| Metadata    | `Capture.placement = { run, position, overlap, confidence, rollDeg }`; `overlap`/`confidence` only when the match was confident at the moment of capture. Sent in the analysis request (see analysis-contract).                                                                                                                                                    |
| LiDAR/depth | **Out of scope for the web app** — iOS Safari exposes no LiDAR/depth API to web pages. Measured spacing, distance or 3D stitching would need a native (ARKit) app.                                                                                                                                                                                                 |

## Open questions

- Backend/hosting choice and Foundry model/endpoint (and request/response limits).
- Real store list and rep assignments; RU SKU-level catalogue (EANs, pack sizes) and an
  authoritative owned/licensed list — the seed catalogue was compiled without access to
  royalunibrew.dk/brands/alle-brands during the build and must be validated against it.
- Representative photo sets and acceptance targets (SoS error, price read rate, overlap).
- Is 25 % the right overlap target for the analysis/stitching approach chosen later?
- Overall SoS alongside shelf/cooler — implemented as proposed; confirm it's wanted.
- Category depth: top-level only, or beer styles too (the incumbent tool reports by style)?
- Should comparisons be limited to the same rep, or any rep (current)?

## Known POC limits

- **Analysis is mocked.** Results do not reflect photo content; boxes are illustrative. The
  brief's field-POC acceptance ("live analysis of actual store photos") is **not met**.
- **Blocked:** live analysis (needs endpoint, hosting and credentials) and evaluation (needs
  real photo sets, manual ground truth, targets, device validation).
- Data lives only on the device; browsers can evict IndexedDB; no sync or backup.
- No authentication; any device user can pick any test rep.
- Real-device camera behaviour (iOS/Android) has not been validated yet; automated tests use
  Chromium's synthetic camera.
- Upload size limits are not enforced client-side yet (no upload exists); define with the
  backend (expect 1–4 MB per photo).
