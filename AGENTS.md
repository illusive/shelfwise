# AGENTS.md

Shelfwise is a mobile-first React PWA proof of concept for Royal Unibrew (Denmark) sales reps:
**select store → capture shelf/cooler photos → submit for analysis → review results → compare
with previous visits.** It is frontend-only for now (IndexedDB) with a clearly badged **mock**
analysis provider behind a provider-agnostic, Zod-validated contract.

## Working agreements

- Read `docs/decisions.md` before changing behaviour; record new material decisions there.
  Don't re-ask questions already answered there.
- Figma (`Shelfwise.fig`, kept locally in `.references/figma/`) governs the design. Screens not in Figma extend
  its language and are listed in `docs/ui-guidelines.md` for review.
- Metrics are calculated deterministically in `src/domain` from validated observations. Never
  average percentages; never silently drop unknowns.
- Mock and live results must always be distinguishable (`source` + `MockBadge`).
- Remote: `illusive/shelfwise` (public). Pushing `main` deploys GitHub Pages
  (https://illusive.github.io/shelfwise/). Never commit `.references/` or other client material.
  Do not open pull requests until asked.
- The user tests in their own Docker environment from this checkout. After meaningful
  changes, run `npm run docker:up` and confirm `https://<LAN-IP>:8443` responds.

## Commands

| Task                        | Command                                           |
| --------------------------- | ------------------------------------------------- |
| Install                     | `npm ci`                                          |
| Dev server                  | `npm run dev` (HTTPS on LAN: `npm run dev:lan`)   |
| Lint / types / unit tests   | `npm run check`                                   |
| E2E (Chromium, fake camera) | `npm run e2e:install` once, then `npm run e2e`    |
| E2E against Docker          | `E2E_BASE_URL=https://localhost:8443 npm run e2e` |
| Build                       | `npm run build`                                   |
| Docker (HTTPS on LAN)       | `npm run docker:up` · logs `npm run docker:logs`  |

## Where things are

- `README.md` — setup, environment, running, testing, mock vs live.
- `docs/product.md` — scope, terminology, journeys, acceptance.
- `docs/architecture.md` — boundaries, data ownership, persistence, integrations.
- `docs/coding-guidelines.md` — structure, components, typing, styling, libraries.
- `docs/ux-guidelines.md` — capture, navigation, feedback, accessibility, recovery.
- `docs/ui-guidelines.md` — design references, tokens, primitives, motion, invented screens.
- `docs/analysis-contract.md` — request/response schemas, metric definitions, unknowns.
- `docs/decisions.md` — decisions, rationale, open questions, known limits.
- `docs/model-training.md` — training-data flywheel, labelling, evaluation, privacy prerequisites.
- `.references/` — original brief, approved plan, Figma and competitor material. Local only:
  gitignored and never committed (the repo is public).
