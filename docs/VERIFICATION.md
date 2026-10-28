# Local verification — 28 October 2026

Local delivery requested by the user. Cloud deployment, public repository publication, YouTube upload, and application-form submission are deferred.

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
