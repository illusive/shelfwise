# Coding guidelines

## Structure

Organise by feature (`src/features/<area>`) on a small shared foundation (`domain`,
`contracts`, `services`, `ui`, `i18n`, `app`). See `docs/architecture.md` for what each layer
owns and may import. Keep business rules in `src/domain`; keep data access and orchestration in
`src/services`; keep presentation in features.

## Components

- One screen per file (`*Page.tsx`) with a co-located CSS Module. Extract a component when it is
  reused (e.g. `VisitRow`, `PriceRow`, `ShareHero`) — not for hypothetical reuse.
- Pages read data through hooks in `src/app/data.ts` and act through services or
  `useVisitActions`; after a mutation call `useInvalidate()`.
- All hooks run before any early return.
- Route components only map params to page props (`src/app/router.tsx`); pages do not import
  route objects.
- Navigation uses typed TanStack Router `navigate({ to, params })`/`<Link>`.

## Typing

- `strict` TypeScript. External boundaries are explicit: Zod schemas in `src/contracts`,
  repository interfaces in `src/services/repositories.ts`, `AppConfig` in `src/app/config.ts`.
- Provider output is `unknown` until validated with `analysisResponseSchema`.
- Use explicit `null` for missing/unresolved values; don't invent fallbacks.
- Money is integer øre; volumes are ml; timestamps are ISO strings (UTC), formatted in the
  store's time zone.

## Styling

- CSS Modules + CSS variables from `src/ui/tokens.css`. No hard-coded colours, radii, shadows,
  z-indexes or durations in components — add a token instead.
- Shared layout helpers live in `src/features/shared/shared.module.css`.
- Inputs use ≥16 px font size (avoids iOS zoom). Minimum touch target `--tap-min` (44 px).

## Strings and formats

All copy lives in `src/i18n/da.ts` and `src/i18n/en.ts` (same shape, checked by a test) and is
read through the `t` proxy in `src/i18n/strings.ts`. Read `t.*` during render, never at module
load, so language switches apply. Formatters live in `src/i18n/format.ts` (DKK/decimals always
`da-DK`; dates and words follow the language, in the store time zone). The language is
persisted in `localStorage` (`src/i18n/language.ts`). No user-facing literals in components.

## Libraries (one per concern)

| Concern               | Library                                                                   |
| --------------------- | ------------------------------------------------------------------------- |
| Routing               | `@tanstack/react-router` (code-based routes)                              |
| Data fetching/cache   | `@tanstack/react-query` over repositories                                 |
| Accessible primitives | Radix (`react-dialog` for sheets, `react-toggle-group` for segmented)     |
| Animation             | `motion` (`motion/react`), wrapped in `MotionConfig reducedMotion="user"` |
| Validation            | `zod` (v3 API)                                                            |
| Storage               | `dexie` (IndexedDB)                                                       |
| PWA                   | `vite-plugin-pwa` (generateSW, autoUpdate)                                |
| Tests                 | Vitest + Testing Library + fake-indexeddb; Playwright                     |

Avoid adding overlapping libraries; prefer platform APIs.

## Tests

- Unit-test every metric rule in `src/domain` (SoS, overlap, pricing, comparison, aggregation)
  and contract validation; service tests cover idempotency, retries and drafts.
- The Playwright journey (`e2e/journey.spec.ts`) must stay green; add steps when the journey
  changes. Use roles/labels first, `data-testid` only where no accessible name exists.
- Run `npm run check` and `npm run e2e` before committing.
