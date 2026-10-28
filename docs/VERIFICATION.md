# Local verification — 28 October 2026

Production update: the separate frontend at `https://windlens-web.vercel.app` and backend at `https://windlens-api-beryl.vercel.app` are now deployed. The historical local-only status and services-migration notes below describe earlier verification stages.

The application was initially delivered locally. A two-service Vercel deployment is now being prepared; service names and public routing await the user's requested confirmation. Cloud deployment, YouTube upload, and application-form submission have not been performed by the agent.

## Automated and runtime checks

- **38 backend tests pass** on Windows/Python 3.14.2, covering known metrics, selection boundaries, subsecond publication order, London timezone behavior, missing/zero values, duplicate normalization, API validation, CSV, CORS, snapshot I/O, upstream response shape, and refresh behavior.
- React production build passes TypeScript strict checks and Vite 6.4.5 bundling. Main JavaScript and chart vendor bundles are split.
- `npm audit` reports **0 vulnerabilities** for both production dependencies and the full dependency tree. Rollup is pinned to 4.59.0 because the registry's originally resolved newer tarball was unavailable; Vite is pinned to 6.4.5. Package lock is included in the project source.
- Docker multi-stage build succeeds using Node 22 and Python 3.12 on Linux. Container runs as an unprivileged user and reports **healthy**.
- Container `/`, `/api/health`, `/api/dashboard`, `/api/export`, and `/docs` return successful responses. Default dashboard has 1,488 interval rows, 744 matched pairs, and 20 largest errors.
- Real upstream refresh was exercised inside the container: succeeded with 1,488 actuals and 18,104 forecast versions; cache mode changed to `live_cache`. The final container starts from the original documented bundled snapshot.
- FastAPI's installed Starlette version emits a deprecation warning for the httpx-based test client. It does not affect application runtime or passing tests; it is an upstream testing-API migration notice.

## Browser checks

Tested the React development build and Docker production build in the in-app browser:

- Overview shows real metrics, distinguishable actual/forecast series, source snapshot/freshness, and coverage.
- First-week preset changes the range to 1–7 January and updates metrics/sample size to 168 pairs; full month has 744.
- Accuracy view shows comparison, signed errors, correlation chart, and descending absolute-error ranking.
- Explorer supports coverage/time filters, absolute-error sorting, pagination, and publication history. For 1 January 00:00 UTC, the selected publication is 31 December 09:30 UTC at the 11:00 previous-day cutoff; later publications are excluded.
- Missing half-hour forecasts show em dashes, retained actual generation, zero versions, and unavailable policy status.
- Changing cutoff to 00:00 reduces matched pairs to 682 and explicitly reports 62 delivery starts with forecast versions but no eligible publication.
- Explorer filters with no results show an informative empty state.
- Invalid date ordering displays a validation alert and suppresses stale analysis/export. A browser-discovered native date-input event issue was fixed by handling input as well as change events.
- An isolated test server with an unavailable snapshot displays a recoverable error screen. Replacing it with an empty test dataset and using Try again displays null metrics, zero matched pairs, missing-interval counts, and empty rankings. The test dataset is outside the production data directory and ignored by Git.
- Interval drawer opens, lists versions/eligibility, and closes with Escape.
- Narrow-screen testing used a 390×844 viewport override (effective CSS width is affected by the host's display scale). Date control overflow was fixed; document width equals viewport width. Mobile navigation and stacked controls render correctly. Hidden mobile navigation is removed from focus/accessibility flow with CSS visibility.
- Temporary browser viewport overrides were reset after testing.

## Real-data provenance

Bundled snapshot: `backend/data/january-2026.json.gz`.

SHA-256: `47A7196B5B9E1F6FECA89D2735078173B2F73AEA4559A4D9CFB8E32294B94AB4`.

Retrieved at `2026-10-28T13:35:42.787696Z`. Default 11:00 London previous-day policy yields:

| Metric | Value |
| --- | ---: |
| Valid pairs | 744 |
| Mean selected forecast | 13,421.0336 MW |
| Mean matched actual | 11,581.1129 MW |
| MAE | 2,107.1761 MW |
| RMSE | 2,611.2429 MW |
| Bias | +1,839.9207 MW |
| MAPE | 21.8772% across 744 nonzero-actual pairs |

No data has been fabricated to fill unmatched starts. The documented cutoff remains a prototype assumption. Historical publication/correction coverage is bounded by the retrieval windows.

## External verification limits

Vercel configuration is prepared but has not been executed against a cloud account, so cloud routing/runtime is not claimed as tested. GitHub Actions configuration is included but has not run on GitHub. Public/incognito URL checks and video/submission tasks apply only if publication is requested later.

## Vercel Services migration verification

- Replaced the single-app deployment configuration with two explicit services, `backend` and `frontend`; removed the obsolete root `api/index.py` function shim.
- Backend root `backend`, FastAPI entrypoint `app.main:app`, Python 3.12 pinned inside the service, and `data/**` included relative to its root. Function limits and file settings are scoped to the backend service.
- Frontend root `frontend`, Vite framework, `npm ci`, `npm run build`, output `dist`. Runtime/build fields are absent from the root configuration.
- Public routes `/api/*`, `/docs`, `/docs/*`, and `/openapi.json` enter the backend; the final catch-all enters the frontend. API paths retain the `/api` prefix and existing browser fetch/export URLs are same-origin.
- No internal bindings: the frontend is a static browser application and makes no function-to-function calls. External Elexon requests remain configured by `ELEXON_API_BASE`; standalone localhost development URLs are not used as deployed service discovery.
- Configuration passes validation against the current official `https://openapi.vercel.sh/vercel.json` schema.
- Vercel CLI **65.5.0** with `dev -L` detected exactly the two services and started the local router successfully. This CLI deprecates `-L` in favor of `--local`.
- Through the Vercel local router, `/`, `/api/health`, `/api/summary`, `/docs`, `/docs/oauth2-redirect`, and `/openapi.json` returned HTTP 200. Summary reported 744 matched pairs and MAE 2,107.1761 MW from the bundled snapshot.
- Backend tests: 38 passed after migration. Production frontend build passes.
- These are local services checks, not a claim that a Vercel cloud deployment has succeeded. Changes have not been pushed or deployed pending the requested service-layout confirmation.

## Production data-loading repair

- Diagnosed the deployed bundle's API base as `https://windlens-api-beryl.vercel.app/`, which created `//api/...` redirects.
- Direct production API calls returned HTTP 200 and real data. CORS allowed `https://windlens-web.vercel.app/`, but omitted `Access-Control-Allow-Origin` for the browser's actual origin `https://windlens-web.vercel.app`. This exact mismatch reproduced the reported “Failed to fetch”.
- Commit `3915517` normalizes frontend API origins and backend CORS configuration, including whitespace/trailing slashes and canonical host/port formatting. Invalid CORS values fail closed; untrusted origins stay disallowed.
- Regression verification: **47 backend tests pass**, including real CORSMiddleware GET and POST-preflight behavior for copied slash-terminated origins. Frontend production build passes.
- Pushed the correction through the existing GitHub connection; both production projects updated automatically. Confirmed that the API now returns the correct CORS allow-origin header and the frontend serves the updated bundle.
- Verified in a fresh browser session that Overview and Methodology load real data, 744 matched pairs and 18,104 publications are displayed, actual/forecast curve paths render, and no browser errors are logged. CSV export URL uses a single `/api/` separator.
