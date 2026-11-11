# Shelfwise

Shelf and cooler share, observed prices and promotions from in-store photos — a proof of
concept for Royal Unibrew sales reps in Denmark.

> **Status: reduced POC.** Capture, persistence, the analysis contract, deterministic metrics
> and the full UI journey work end to end. Analysis currently runs on a **mock provider**
> (results are simulated and badged "Mock"). Live recognition with Microsoft AI Foundry and
> evaluation on real store photos are not done yet — see `docs/decisions.md`.

## Requirements

- Node.js ≥ 20.19 (developed on 24) and npm
- Docker Desktop (for the LAN/HTTPS test environment)
- Phones: iOS Safari 17+ or Android Chrome on the same Wi‑Fi as your computer

## Live test build (GitHub Pages)

Every push to `main` deploys to **https://illusive.github.io/shelfwise/** via
`.github/workflows/pages.yml` (lint, typecheck and unit tests, then a build with
`BASE_PATH=/shelfwise/`; `404.html` provides the SPA fallback for deep links). It is HTTPS, so
the camera works on phones directly. Data stays on each phone.

## Quick start (local)

```sh
npm ci
npm run dev            # http://localhost:5173 (camera works on localhost)
```

The app starts in Danish as the default test rep (Alex Holm); switch language or rep from the
user drawer (avatar, top right). Optionally use the drawer's **Add demo history**
to create backdated, analysed visits for comparisons.

## Run on a phone (Docker, HTTPS on the LAN)

The camera (`getUserMedia`) needs a secure context, so phones must use HTTPS.

```sh
cp .env.example .env      # set LAN_HOST to your computer's IP (macOS: ipconfig getifaddr en0)
npm run docker:up         # builds and serves https://<LAN_HOST>:8443
```

On first start the container creates a **self-signed** certificate for `localhost` and
`LAN_HOST` (stored in the `certs` Docker volume). Open `https://<LAN_HOST>:8443` on the phone
and accept the warning once:

- **Android Chrome:** _Advanced → Proceed_.
- **iOS Safari:** _Show Details → visit this website_. If the camera stays blocked, use a
  trusted certificate instead (below).

**Trusted certificate (recommended for iPhone):** install [mkcert](https://github.com/FiloSottile/mkcert)
(`brew install mkcert && mkcert -install`), then run `npm run docker:certs`. It creates
`certs/cert.pem`/`key.pem` for `localhost` and your LAN IP, copies them into the container
and restarts it. Install `$(mkcert -CAROOT)/rootCA.pem` on the phone (AirDrop it, install the
profile, then enable it under _Settings → General → About → Certificate Trust Settings_).

If your LAN IP changes, update `.env` and remove the volume:
`docker compose down -v && npm run docker:up`.

Other Docker commands: `npm run docker:logs`, `npm run docker:down`.

## Environment variables

See `.env.example`. All `VITE_*` values are public and bundled into the client — never put
credentials in them.

| Variable                       | Default         | Purpose                                                                      |
| ------------------------------ | --------------- | ---------------------------------------------------------------------------- |
| `VITE_ANALYSIS_PROVIDER`       | `mock`          | `live` is reserved; it falls back to mock until a server-side adapter exists |
| `VITE_MOCK_LATENCY_MS`         | `2500`          | Simulated analysis duration                                                  |
| `VITE_MOCK_FAIL_FIRST_ATTEMPT` | `false`         | Fail each job's first attempt (retryable) to demo recovery                   |
| `VITE_OVERLAP_TARGET`          | `0.25`          | Camera overlap guide target (share of photo width, clamped 0.1–0.5)          |
| `BASE_PATH`                    | `/`             | Public path the app is served from (`/shelfwise/` on GitHub Pages)           |
| `LAN_HOST`                     | —               | Docker: IP/hostname added to the self-signed certificate                     |
| `HTTPS_PORT` / `HTTP_PORT`     | `8443` / `8080` | Docker host ports (HTTP redirects to HTTPS)                                  |

## Mock vs live analysis

- **Mock (today):** `src/services/analysis/mockProvider.ts` generates deterministic,
  contract-valid results per visit, including overlapping photos, cooler reflections,
  unknown products, unreadable labels, multibuy and member prices, pant and displays.
  Bounding boxes are illustrative only. Every mock result is stored with `source: "mock"` and
  badged in the UI, including in history.
- **Live (not built):** needs a backend endpoint that holds the Foundry credentials, accepts
  the `AnalysisRequest` + images and returns an `AnalysisResponse`
  (`docs/analysis-contract.md`). Add an `AnalysisProvider` that calls that endpoint and wire it
  in `src/services/index.ts`.

## Testing

```sh
npm run check          # ESLint + tsc + Vitest (domain, contract, services, formatters)
npm run e2e:install    # once: Playwright Chromium + WebKit
npm run e2e            # builds (mode e2e) and runs the journey with a fake camera
E2E_BASE_URL=https://localhost:8443 npm run e2e   # same journey against Docker
```

The e2e journey covers the default rep and switching reps, store search, repeated camera capture, removal, import,
reload recovery, submission, results, rep review, report, photo evidence and archive, plus
camera-permission denial with the import fallback. Camera specs stub the vision worker to cover
live detection (ok/off/failing/slow) and the overlap guide (aligned, too far, too much overlap,
no match, slow, sensors denied) — capture must work in every case. `e2e/webkit/` runs the
overlap strip in WebKit with the iPhone 15 profile (persistent context, since WebKit's ephemeral
test contexts can't store Blobs in IndexedDB). Real-device validation (iPhone/Android)
is manual — see `docs/ux-guidelines.md`.

## Build

```sh
npm run build && npm run preview   # http://localhost:4173
```

Output is a static PWA in `dist/` (service worker precaches the app shell; data stays in
IndexedDB on the device). Installed apps pick up a new deploy the next time they are opened or
brought to the foreground (not while the camera is open); the user drawer shows the build
(`Version · build <commit>`). Docker builds are stamped via `npm run docker:up`.
