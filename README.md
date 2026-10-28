# WindLens

UK national wind forecast intelligence for January 2026. React + TypeScript, Python + FastAPI, and a single Docker image. The dashboard evaluates the forecast that was available at an explicitly configured decision cutoff, preserving every retrieved publication for inspection.

## Delivery status

The application, real Elexon snapshot, backend tests, production frontend, Docker setup, CI, and demo/submission guides are included. **The two-service Vercel configuration is prepared locally; production deployment is pending confirmation and verification.** No external submission or YouTube upload has been made. Add the verified production URL after deployment.

## Run with Docker

Install Docker Desktop and start its engine. From the repository root:

```sh
docker compose up --build -d
```

Open [WindLens](http://localhost:8000) and [interactive API documentation](http://localhost:8000/docs). The image builds the frontend and serves it and the Python API on one origin. It runs as an unprivileged user and includes a health check and the real-data snapshot. No Elexon key is required.

```sh
docker compose logs -f
docker compose down
```

Refreshes are saved inside the running container; rebuilding or recreating the container restores the bundled snapshot. To retain updates externally, set `WINDLENS_SNAPSHOT_PATH` to a writable path on a mounted volume. Historical records do not need automatic polling.

## Run locally

Requirements: Python 3.12+ and Node.js 22.12+. Windows convenience command:

```powershell
.\scripts\start.ps1
```

This installs dependencies, builds React, and runs the combined application at `http://127.0.0.1:8000`. If your PowerShell policy prevents running a script, use the manual commands below.

For development with hot reload, from the root:

```sh
python -m venv .venv
```

Activate `.venv` (`.venv\Scripts\Activate.ps1` on Windows, `source .venv/bin/activate` on macOS/Linux), then:

```sh
pip install -r backend/requirements-dev.txt
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

In another terminal:

```sh
npm --prefix frontend ci
npm --prefix frontend run dev
```

Open [the React development server](http://127.0.0.1:5173). Vite proxies `/api` to Python. For a local production build, run `npm --prefix frontend run build` and restart Uvicorn; Python will serve the built frontend at port 8000.

Copy `backend/.env.example` to `backend/.env` if you need configuration. For separate frontend hosting, set `VITE_API_BASE_URL` in `frontend/.env` and allow that frontend origin in `CORS_ORIGINS`. Same-origin Docker/Vercel deployments need no CORS changes. Environment values are read at startup; restart after changing them.

## Features

- Overview with selected forecast and actual generation, mean values, MAE, bias, source freshness, coverage, and largest deviations.
- Accuracy view with MAE, RMSE, bias, pair count, comparison chart, signed error timeline, scatter plot, and error ranking.
- Explorer with delivery date/time, coverage and sort controls, pagination, and a complete publication audit panel for each interval.
- Configurable previous-day cutoff, January-constrained inclusive date controls, and exact UTC matching.
- Data & Methodology page with formulas, source links, deduplication, provenance, limitations, and missing-data rules.
- CSV export, real-data snapshot, live refresh, graceful errors and empty states, responsive navigation, keyboard controls, and reduced-motion support.

## Data and analytical decisions

Data comes exclusively from the official [Elexon Insights API](https://developer.data.elexon.co.uk/). Schema was checked against the [official OpenAPI definition](https://data.elexon.co.uk/swagger/v1/swagger.json) and successful January requests. See [source verification](docs/DATA_SOURCES.md).

| Item | Rule |
| --- | --- |
| Actuals | `/datasets/FUELHH/stream`; filter `fuelType == WIND` |
| Forecasts | `/datasets/WINDFOR/stream`; keep all distinct `(startTime, publishTime)` versions |
| Units | MW; actuals are half-hour average generation |
| Delivery scope | `[2026-01-01T00:00:00Z, 2026-02-01T00:00:00Z)` |
| Matching | Equal UTC delivery timestamps; never publication timestamps |
| Default policy | Latest publication at or before 11:00 Europe/London on the day before delivery |
| Policy status | **Prototype assumption**, not a confirmed UK market rule; change in the UI or `DEFAULT_CUTOFF` |
| Missing values | Null, never zero-filled; only valid matched pairs enter primary metrics |
| Duplicates | Latest-published actual; forecasts deduplicated by delivery/publication; conflicting same-key numeric forecast values use the minimum deterministically and are counted |

The snapshot was retrieved **28 October 2026 at 13:35:42 UTC** and contains **1,488 actual observations**, **18,104 forecast versions**, and **744 hourly forecast delivery starts**. The remaining 744 half-hour starts have actuals but no matching WINDFOR timestamp. We do not interpolate forecasts or resample actuals. Charts show native forecast delivery starts; Explorer/CSV retain all half-hour actuals and missing starts.

At the default cutoff, 744 valid pairs yield approximately: mean forecast 13,421 MW, mean actual 11,581 MW, MAE 2,107 MW, RMSE 2,611 MW, bias +1,840 MW. These are dataset/policy-specific observations, not a general guarantee of forecast quality. Elexon describes Great Britain operationally metered generation; the national UK product title should not be read as comprehensive coverage of every embedded or unmetered wind farm.

For each valid pair, `error = forecast − actual`. MAE is `mean(abs(error))`; RMSE is `sqrt(mean(error²))`; bias is `mean(error)`. Positive bias means overforecasting. Both mean generation KPIs use the same matched sample as these metrics. Optional MAPE excludes zero actuals and reports its separate sample size.

To reproduce the snapshot (from the root with the Python environment active):

```sh
python -m backend.app.refresh
```

Restart the API after a command-line refresh so it reloads the snapshot. The UI refresh button updates the running API immediately. Retrieval requests daily **publication** windows, including December forecasts of January delivery, then applies the delivery filter. Stream responses are arrays without pagination. The bounded history includes forecast publications from 25 December through 2 February and actual publications from 1 January through 2 February. Publications or late corrections outside these windows are not claimed to be present. Failed windows retain the previous snapshot. Requests have timeouts and bounded retries; refresh is limited to once per five minutes per server process.

## API

All timestamps are ISO 8601 with UTC offsets; date-only analysis boundaries are UTC. `end` is **exclusive**. The UI's “Through” date is inclusive and converted to the next midnight for API calls. `cutoff` is `HH:MM` in Europe/London. The only accepted policy identifier is `day_ahead_assumed_cutoff`.

| Endpoint | Response / parameters |
| --- | --- |
| `GET /api/health` | Service and snapshot status; `ok` or `degraded` |
| `GET /api/summary` | KPIs, policy, coverage, source status, quality counters |
| `GET /api/timeseries` | `{data, timezone, unit}`; all half-hour starts plus any off-grid observations |
| `GET /api/dashboard` | `{summary, timeseries, errors}` combined UI payload |
| `GET /api/errors` | Largest absolute errors; `limit` 1–1488 (default 20) |
| `GET /api/forecasts` | Every retrieved version; optional timezone-aware `delivery_time`; `sort=delivery\|publication\|absolute_error`, `order=asc\|desc`, `offset`, `limit` 1–1000 |
| `GET /api/export` | CSV of the selected-policy interval data; missing fields are empty |
| `POST /api/refresh` | Retrieve Elexon history, atomically update snapshot/cache; 409 if running, 429 if throttled, 503 on upstream failure |

All analytical endpoints accept `start`, `end`, `cutoff`, and `policy` query parameters. Defaults cover the whole month with the 11:00 cutoff. Invalid ranges, unknown policies, malformed times, and out-of-range intervals return 422. Missing/unreadable snapshots return 503 on analysis endpoints. Quality counters describe the full snapshot; coverage follows the requested range.

Example: `/api/summary?start=2026-01-01&end=2026-01-08&cutoff=11:00`. API documentation is available at `/docs` and schema at `/openapi.json`.

## Tests and verification

```sh
cd backend
python -m pytest -q
cd ..
npm --prefix frontend run build
npm --prefix frontend audit
docker compose build
```

Tests cover metrics and bias signs, cutoff inclusivity and subsecond ordering, London timezone handling, December publications, missing/zero values, actual revisions, exact joins, duplicate forecast conflicts, API contracts and parameter validation, CSV output, CORS, snapshot persistence, malformed upstream streams, and failed/successful refresh behavior. GitHub Actions runs backend tests, the frontend build, and a container smoke test. See [verification notes](docs/VERIFICATION.md) for recorded local checks and remaining external checks.

## Deploy to Vercel

The repository root contains a Vercel Services configuration in `vercel.json`. It declares two independently built services: `frontend` (Vite, rooted at `frontend/`) and `backend` (FastAPI, rooted at `backend/`, entrypoint `app.main:app`). Each service owns its build/runtime settings. `/api/*`, `/docs`, `/docs/*`, and `/openapi.json` route to the backend; remaining paths route to the frontend. Vercel preserves the original request path, matching FastAPI's existing `/api/...` routes.

React runs in the browser and calls relative public `/api/...` URLs, including CSV export. There are no server-to-server calls between the two services, so **no service bindings are required or declared**. Runtime-only binding URLs must not be supplied as `VITE_API_BASE_URL` or embedded in the browser build. The Python backend calls Elexon's external API, which is not a Vercel service. The localhost proxy in `frontend/vite.config.ts` is only for standalone Vite development; Vercel owns public routing in services mode. Docker remains a combined same-origin application for local use.

The snapshot is included with the backend function (`data/**` relative to its service root), so startup needs no upstream request. Vercel refreshes use instance memory because deployed files are read-only; a cold instance starts from the bundled snapshot. Refresh/rate limits are per instance. Python 3.12 is selected by `backend/.python-version`. This small historical prototype does not require a shared database.

1. Create a public GitHub repository with an anonymous name, e.g. `national-generation-study`, and push the project. Do not push `.env`, `.venv`, or `node_modules`.
2. Import that repository in Vercel with this repository as the project root. Use the Services configuration in `vercel.json`: frontend framework `vite`, install `npm ci`, build `npm run build`, output `dist`; backend framework `fastapi`, entrypoint `app.main:app`. Clear any previous single-app build/output overrides in the project settings. Keep the two service roots at `frontend` and `backend`; no third root `app` service is needed.
3. Test the service router locally with `npx vercel dev --local` (or `npx vercel dev` for a linked project). Vercel CLI 65.5.0 also accepts `-L` but marks that shorthand deprecated. Then deploy from Vercel, or use `npx vercel login` followed by `npx vercel --prod` from the root. Leave `VITE_API_BASE_URL` unset; no Elexon API key or manually configured binding URL is needed.
4. Check `/`, `/api/health`, `/api/summary`, and `/docs`; change a date/cutoff and inspect a forecast history. Verify in a signed-out/incognito window and configure public access for the submission if Vercel Deployment Protection prevents it.
5. Add your verified production and repository URLs to the delivery status at the top of this README.

Vercel settings are prepared but a production cloud deployment has not been claimed without account access. This repository also includes a production Docker image that can run on a container host using `PORT`.

## Directory guide

```text
frontend/src/App.tsx       Views, filters, explorer, and publication drawer
frontend/src/Charts.tsx    Time series, error and correlation charts
frontend/src/api.ts        API client and human-readable errors
frontend/src/types.ts      Typed API contracts
frontend/src/styles.css    Responsive visual system and accessibility states
backend/app/main.py       FastAPI routes, validation, cache and CSV export
backend/app/analytics.py  Pure normalization, cutoff, joins and metric functions
backend/app/source.py     Elexon retrieval, retries and atomic snapshot storage
backend/app/refresh.py    Reproducible real-data snapshot command
backend/data/             Compressed real Elexon snapshot and provenance
backend/tests/            Unit, API, and source integration tests
vercel.json               Two Vercel services, public routing, backend snapshot bundle
backend/.python-version   Python runtime selection for the backend service
Dockerfile                Multi-stage React build + unprivileged Python server
docker-compose.yml        One-command local production startup
scripts/start.ps1         Windows setup/build/start helper
docs/                     Sources, verification, demo narrative and submission checklist
.github/workflows/ci.yml  Backend, frontend and container verification
```

## AI tool disclosure

OpenAI Codex was used to interpret the PRD, research official Elexon/Vercel documentation, implement and debug the application, write tests and documentation, and verify local browser/container behavior. All bundled observations were retrieved from Elexon; they were not generated by AI. No AI forecasting model or trading recommendation is provided.
