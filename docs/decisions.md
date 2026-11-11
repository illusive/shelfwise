# Decisions

Material decisions agreed during discovery (see `docs/references/discovery-plan.md`) and made
during the build. Each rule has one home; link here rather than restating.

## Agreed decisions

| Topic          | Decision                                                                                                                                                                        | Rationale                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Repository     | Local git repo, no remote yet; commit locally, no automatic PRs.                                                                                                                | User preference.                                        |
| AI             | No live endpoint yet: typed `AnalysisProvider` + clearly badged mock adapter. Foundry adapter later, server-side.                                                               | Credentials must not reach the browser; contract first. |
| Data           | Frontend-only IndexedDB (Dexie) for reps, stores, drafts, blobs, visits, jobs, results, corrections, behind repository interfaces.                                              | Fast POC; API can replace it.                           |
| Share of Shelf | Visible facings: client ÷ all eligible beverage facings × 100. Shelves and coolers separate; overall aggregates counts; unknowns stay in the denominator.                       | Defensible, testable; avoids inflating client share.    |
| Denominator    | All beverages; overall + optional per-category (beer, soft drinks, water, energy/functional, RTD/cider, other).                                                                 | Matches how reps see shelves.                           |
| Client brands  | Everything Royal Unibrew sells in DK, owned + licensed/distributed, tagged `owned`/`licensed`.                                                                                  | Business reality (Pepsi, Heineken…).                    |
| Locations      | `shelf`, `cooler`, `display`; displays counted, excluded from SoS. Classification from analysis, not manual tags.                                                               | Faster capture than the incumbent tool.                             |
| Rep review     | Quick review of unresolved items only; AI values and rep corrections stored separately with provenance.                                                                         | Accuracy without re-keying everything.                  |
| Execution KPIs | Out-of-stock/must-stock and price compliance deferred; stores keep `mustStockProductIds` and `targetPrices`.                                                                    | Scope.                                                  |
| Reporting      | No export/manager reporting; data stays flat and versioned.                                                                                                                     | Scope.                                                  |
| Market         | English UI, centralised strings; DKK and da-DK number formats; pant separate; multibuy conditions kept.                                                                         | Danish-ready later.                                     |
| Devices        | iOS Safari 17+, Android Chrome; in-app `getUserMedia` with continuous capture + import fallback.                                                                                | Rapid repeated capture is the core interaction.         |
| Identity       | One default seeded rep (Alex Holm, matching the Figma) with no start-up picker; other test reps selectable from the user drawer (top right). Stored locally; no authentication. | POC; user request to roll with one user.                |
| Design         | Figma governs; invented screens extend its language and are listed in `docs/ui-guidelines.md`. Captures show number/time; labels only after analysis.                           | Agreed.                                                 |
| Stack          | Vite, React 19, TS, TanStack Router + Query, Radix, Motion, Zod 3, Dexie, vite-plugin-pwa, CSS Modules + tokens, Vitest, Playwright.                                            | Agreed.                                                 |
| Dev/test env   | Docker Compose (nginx) serving HTTPS on the LAN; self-signed by default, mkcert optional.                                                                                       | Phones need a secure context for the camera.            |

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
| Dates                   | English wording (en-GB patterns), store time zone (`Europe/Copenhagen`).                                                                                  |
| Versions                | Pinned mature majors (Vite 7, Vitest 3, TS 5.9, ESLint 9, Zod 3) over the very latest majors to keep APIs stable.                                         |
| Demo data               | _Add demo history_ renders shelf images on a canvas and stores backdated mock results through the same contract.                                          |
| Docker certs            | Named volume (no host file sharing needed); `npm run docker:certs` loads host/mkcert certs.                                                               |

## Open questions

- Backend/hosting choice and Foundry model/endpoint (and request/response limits).
- Real store list and rep assignments; RU SKU-level catalogue (EANs, pack sizes) and an
  authoritative owned/licensed list — the seed catalogue was compiled without access to
  royalunibrew.dk/brands/alle-brands during the build and must be validated against it.
- Representative photo sets and acceptance targets (SoS error, price read rate, overlap).
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
