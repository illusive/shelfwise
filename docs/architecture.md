# Architecture

## Overview

```mermaid
flowchart LR
  UI[features/* screens] -->|query hooks| Data[app/data.ts TanStack Query]
  UI -->|commands| Svc[services: captures, analysis]
  Data --> Repos[Repositories interface]
  Svc --> Repos
  Svc --> Provider[AnalysisProvider]
  Provider -.->|default| Mock[mockProvider]
  Provider -.->|POC live| CS[Copilot Studio agent<br/>Agents SDK + tester's Entra token]
  Provider -.->|later| Foundry[Microsoft AI Foundry]
  Repos --> Dexie[(IndexedDB via Dexie)]
  Data --> Domain[domain: metrics, SoS, overlap, pricing, comparison]
  Svc --> Contract[contracts: Zod analysis schema]
```

## Layers and boundaries

| Folder           | Owns                                                                                                                                                     | May depend on                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `src/domain`     | Models, catalogue types, SoS, overlap reconciliation, corrections, pricing, comparison, aggregation. Framework-free, reusable in React Native.           | `contracts` (types only)                          |
| `src/contracts`  | Zod schemas for analysis request/response; schema version.                                                                                               | `domain/categories`                               |
| `src/services`   | Repository interfaces and Dexie implementation, seed data, capture/draft service, analysis job service, providers, demo data, visit summaries. No React. | `domain`, `contracts`                             |
| `src/app`        | Composition: config, Microsoft sign-in (`auth.ts`), services context, query hooks, router, root layout, PWA updates.                                     | everything                                        |
| `src/features/*` | Screens by area: `session`, `home`, `stores`, `capture`, `visit`, `results`, `archive`, `shared`. Presentation + calling services.                       | `app`, `services` (types), `domain`, `ui`, `i18n` |
| `src/ui`         | Tokens, global CSS, icons, primitives (Button, Screen/TopBar, BottomNav, Sheet, Segmented, Badge/Notice, BlobImage, Toast).                              | `i18n`                                            |
| `src/i18n`       | All user-facing strings and locale formatters.                                                                                                           | `domain` types                                    |

Business rules live in `domain`; orchestration in `services`; components only render and call
services, then invalidate queries.

## Data ownership and persistence

All data is on the device in IndexedDB (`ShelfwiseDb`, Dexie):

| Table            | Contents                                                                                                                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reps`, `stores` | Seeded (`services/seed`, versioned by `SEED_VERSION`). Stores keep `mustStockProductIds`/`targetPrices` for deferred KPIs.                                                                                           |
| `visits`         | One record per visit: store, rep, status (`draft`/`submitted`/`completed`), idempotency key, job/result ids, timestamps, `dataUse` (training consent, retain-until). Never overwritten by later visits.              |
| `captures`       | Photo metadata: sequence, captured/stored time, source (`camera`/`import`/`demo`), dimensions, blob ids, overlap `placement`, coarse `device`, `camera` settings, `containsPeople`, `originalPurgedAt`. No location. |
| `blobs`          | Original JPEG/imported files (full resolution) and ~480 px thumbnails.                                                                                                                                               |
| `jobs`           | Analysis jobs: status, attempts, real preparation progress, failure.                                                                                                                                                 |
| `results`        | Validated `AnalysisResponse` per job (`result-<jobId>`), plus storage time.                                                                                                                                          |
| `corrections`    | Rep corrections keyed by result and target (facing key or label id).                                                                                                                                                 |
| `plannedVisits`  | Route plans per rep and store-local day (`[repId+date]`); demo weeks generated at start-up.                                                                                                                          |
| `meta`           | Current rep id, seed version, per-rep training consent (`trainingConsent:<repId>`, default off).                                                                                                                     |

The catalogue (`services/seed/catalogue.ts`, version `dk-seed-2026.11`) is code, exposed via
`repos.catalogue`. Metrics are **not stored**; they are recomputed from the stored response +
corrections, so the calculation method stays explicit (`SOS_METHOD_VERSION`) and results stay
export-friendly (flat, versioned observations).

Photo removal keeps the image blobs until the _Undo_ window ends (`purgeRemoved`); start-up
runs `sweepOrphanBlobs` for anything left behind.

**Data use and retention.** A visit records the rep's training consent when it starts, and again
right before submission (`captures.recordDataUse`, run by `analysis.submitVisit`'s
`beforeSubmit`). Submitted visits are never changed. `retainUntil` = created + `VITE_RETENTION_DAYS`
(365). At start-up, `applyRetention` replaces the originals of _analysed_ visits past that date
with their thumbnails, so history, metrics and evidence keep working; drafts and in-flight
submissions are never touched. Authoritative retention belongs to the backend, which receives
`dataUse` in every analysis request.

Storage limits: browsers may evict IndexedDB under pressure; the app requests persistent
storage (`navigator.storage.persist()`) but this is not guaranteed. Photos are stored at full
camera resolution (~1–4 MB each). This is not an offline-sync system: data does not leave the
device until a live backend exists.

## Analysis flow

1. `analysis.submitVisit(visitId)` → `repos.visits.attachJob` runs in a single IndexedDB
   transaction: returns the existing job or creates one and marks the visit `submitted`.
   Repeated taps cannot create a second job.
2. The job runner (module-level, survives navigation) reads each photo blob
   (`preparing`, real `done/total`), builds and validates an `AnalysisRequest`, calls the
   provider (`analysing`), validates the response, and completes in one transaction
   (`visits.completeJob`): result stored under a deterministic id, visit and job completed —
   only if the visit still owns the job and the job wasn't cancelled. Retries reuse the job
   and overwrite the same result id. Job writes never override a `cancelled` status.
3. Failures are stored on the job with `retryable`. _Edit photos_ (`visits.reopen`) cancels the
   job and reopens the draft with a new idempotency key in one transaction.
4. Submission first waits for in-flight capture writes (`captures.whenIdle`), so a photo saved
   just before tapping _Analyze_ is never dropped or left out.
5. On app start, `resumeInterrupted()` restarts jobs left `queued/preparing/analysing`.
6. UI polls IndexedDB while a submitted visit awaits its result (TanStack Query
   `refetchInterval`).

## Live camera guidance (optional)

`features/capture/vision/`: `useVision` runs one frame pump (at most every 125 ms, skipped while
busy, paused when hidden or under a sheet/lightbox) and grabs each frame once — a 480 px
`ImageBitmap` for detection and/or a 96 px-wide grayscale of the visible viewfinder for
alignment — and posts both to a single module worker (`vision.worker.ts`). The worker lazily
loads MediaPipe `ObjectDetector` (CPU delegate) only when detection is on and runs the overlap
matcher against the reference strip set after each capture. Each task has its own speed budget
and switches itself off independently.

- `detection/`: `updateTracks` (IoU matching + EMA smoothing), `InferenceGovernor`, overlay.
- `guide/`: pure `alignment.ts` (normalised cross-correlation → overlap + confidence),
  `guide.ts` (status/hints, smoothing, tilt maths, runs), `motion.ts` (iOS permission,
  `useTilt`), `OverlapGuide`/`LevelIndicator`.

Only the placement estimate at capture time is persisted (`Capture.placement`). Tests replace
the worker via `window.__SHELFWISE_VISION__` (e2e: detector ok/fail/slow, alignment aligned/too
much/too little/no match/slow) and cover the pure logic with synthetic shifted images (unit).

## Training export (developer-only)

`services/training/`: `coco.ts` (pure observation → COCO conversion + corrections layer),
`manifest.ts`, `jpeg.ts` (metadata segment walker/stripper), `sanitize.ts` (camera JPEGs pass
through; imports with metadata are re-encoded via canvas, or stripped if decoding fails),
`exportPackage.ts` (streams photos one by one into an fflate `Zip`, collapsing output into
16 MB Blobs). Loaded with `import()` only when a developer exports, so fflate is not in the
main bundle. The UI (`features/session/TrainingExport`) is shown only with `?dev=1` /
`VITE_DEV_TOOLS`. See docs/model-training.md.

## App updates

`app/pwa.ts` registers the service worker (prompt mode) and checks for updates on
visibility/focus and every 15 min. `app/updateGate.ts` applies a waiting update (reload) only
when nothing holds it (`useHoldUpdates`: camera open, export running) and the page is visible.
`app/build.ts` exposes the version/commit/time stamped at build.

## Live analysis (Copilot Studio, POC)

`services/analysis/copilotStudio/`:

- `provider.ts` calls the agent once per photo, in a fresh conversation, two photos at a time.
  It has a 120 s timeout per photo and retries throttling, timeouts and unreadable replies
  twice. It reports per-photo progress to the job.
- `sdkTransport.ts` uses the Microsoft 365 Agents SDK (`CopilotStudioClient`, direct-connect
  URL). It sends the photo, downscaled to a 2,560 px long edge, as a `data:` URL attachment,
  and maps HTTP 401/403/429/5xx to job failure codes.
- `contracts/agentPhoto.ts` is the lenient per-photo reply schema (`shelfwise-photo-v1`) and
  JSON extraction.
- `buildResponse.ts` maps replies into `AnalysisResponse`. It keeps catalogue IDs only (others
  become unknown, with a warning), converts DKK to øre, and splits grouped facings into columns.
  Each overlap-guide run forms one location. Facings inside the estimated overlap are paired by
  order, and a mismatch is left unreconciled (qualified) rather than guessed.

The result is then validated by the analysis service like any provider's.

**Auth:** `app/auth.ts` uses MSAL (`@azure/msal-browser`) with the redirect flow and a localStorage
cache, completed before the first render. Tokens are delegated
(`CopilotStudio.Copilots.Invoke`), so there's no secret and no backend. A missing or expired
sign-in fails the job with `sign-in-required`; it never redirects mid-analysis.
MSAL and the SDK form a lazily loaded `live-*.js` chunk (≈158 kB gzip), cached on first use
and not precached. Without the `VITE_CS_*` settings, mock stays in use. Handover for the agent
owner: `docs/copilot-studio-agent.md`.

## Integrations (planned)

- **Foundry** (once IT grants access): a small backend holding credentials, behind another
  `AnalysisProvider`. The UI and domain do not change.
- **Persistence API:** replace `createDexieRepositories` with an HTTP implementation of the
  same `Repositories` interface; keep IndexedDB for drafts/blobs until upload.
