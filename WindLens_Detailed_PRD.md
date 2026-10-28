# WindLens — UK Wind Forecast Intelligence Dashboard
## Product Requirements Document (PRD)

**Version:** 1.0  
**Status:** Implementation-ready draft  
**Prepared:** 28 October 2026  
**Product type:** Full-stack web application  
**Assignment context:** REint Full Stack SWE Challenge v4.1 — Intern

---

## 1. Executive Summary

WindLens is a decision-support web application for a UK electricity utility team responsible for procuring electricity from the day-ahead wholesale market. The product helps users inspect national UK wind-generation forecasts available for a delivery period and evaluate forecast accuracy against observed generation.

Wind generation depends on weather. When forecast generation differs from actual generation, the utility may need to procure more or less power from other sources. WindLens makes forecast data, forecast publication times, actual generation, and forecast error visible in one place.

The assignment limits the scope to national-level wind-generation actuals and forecasts available from Elexon. The analysis must focus on delivery intervals relevant to purchase decisions for January 2026.

### Product goals

1. Show wind-generation forecasts with clear delivery and publication timestamps.
2. Compare forecasts with actual generation for matching delivery intervals.
3. Quantify forecast accuracy with transparent, reproducible metrics.
4. Make it easy to identify intervals with large forecast errors.
5. Provide a polished, deployable application with a maintainable codebase and clear technical documentation.

### Non-goals

- Forecasting wind generation independently or training a new machine-learning model.
- Recommending or executing actual electricity trades.
- Predicting wholesale electricity prices or calculating monetary exposure.
- Modeling thermal, solar, hydro, nuclear, or other generation types.
- Adding data providers beyond Elexon.
- Providing user accounts, roles, or enterprise permissions.
- Claiming a forecast is “the official decision-time forecast” unless its publication time and the decision cutoff support that claim.

---

## 2. Problem Statement

The utility’s procurement team needs to estimate how much electricity must be purchased from the day-ahead market beyond the generation expected from renewable sources such as wind. Forecasts are created before delivery and may be updated over time.

The team needs to answer:

- What wind generation was forecast for each delivery interval?
- When was each forecast published?
- Which forecast was available at the relevant purchasing decision time?
- How did the forecast compare with actual generation?
- How large were forecast errors, and were forecasts systematically high or low?
- Which intervals had the largest errors?

A dashboard that shows only the latest forecast can misrepresent what was known when a past purchasing decision was made. The product must preserve the distinction between **delivery time (`startTime`)** and **forecast publication time (`publishTime`)**.

---

## 3. Source Requirements vs. Product Recommendations

### Explicit requirements from the assignment

- Frontend must use React.
- Backend must use Python.
- Use Docker.
- Deploy the sample application to Vercel or Heroku.
- Use only national-level Elexon actual and forecast wind data for this challenge.
- Actual generation source: FUELHH stream; filter `fuelType = WIND`.
- Forecast source: WINDFOR stream.
- Actuals fields of interest: `startTime`, `generation`, and `fuelType`.
- Forecast fields of interest: `startTime`, `publishTime`, and `generation`.
- Consider data relevant to purchase decisions for delivery in January 2026.
- Include a README with directory/file details, startup instructions, deployment URL, and disclosure of AI tools used if applicable.
- Submit an unlisted YouTube video no longer than 10 minutes, split into a customer presentation and a technical review, each with a maximum 5-minute overview.
- Submit all required details through the provided Microsoft form.
- Check submitted URLs in an incognito window to verify access.
- Use an anonymous name for the public GitHub repository.
- Do not spend more than 16 hours on the assignment.

### Recommended implementation decisions

The following are product and engineering recommendations, not additional requirements stated by the assignment:

- Use FastAPI for the Python API.
- Use TypeScript with React.
- Use a charting library such as Recharts.
- Use a small caching or persistence layer if useful, but do not build unnecessary infrastructure.
- Provide Overview, Forecast Accuracy, and Forecast Explorer views.
- Include MAE, RMSE, bias, and optionally MAPE with suitable handling of zero actual values.
- Make forecast-selection rules visible in the UI and documentation.
- Provide loading, empty, error, and partial-data states.

---

## 4. Users and Primary Jobs-to-be-Done

### Primary user: Day-ahead electricity procurement analyst

**Needs**
- Understand expected national wind generation for delivery intervals in January 2026.
- Inspect forecast versions by publication time.
- Understand forecast accuracy from matched actual data.
- Quickly locate intervals where forecast errors were unusually large.

**Success**
- Can identify forecast and actual generation for a selected delivery interval.
- Can tell when the forecast was published and whether it qualifies under the stated decision-time rule.
- Can interpret accuracy metrics without ambiguity.

### Secondary user: Technical reviewer

**Needs**
- Understand data retrieval, normalization, forecast selection, and metric calculations.
- Reproduce the app locally using documented instructions and Docker.
- Review assumptions, limitations, and error handling.

---

## 5. Product Scope and Information Architecture

Build a responsive single-page application with a compact left navigation or top navigation.

### Navigation

1. **Overview**
2. **Forecast Accuracy**
3. **Forecast Explorer**
4. **Data & Methodology** (can be a modal, drawer, or section)

Keep the scope intentionally small. Do not build authentication or a complex settings system.

---

## 6. Functional Requirements

### 6.1 Overview Dashboard

**Purpose:** Give users a fast summary of wind generation and forecast quality.

#### Required UI elements

- Page title: `UK Wind Forecast Intelligence`
- Context label: `National wind generation · January 2026`
- Data freshness / source status indicator showing the most recent successful retrieval time.
- Date-range selector constrained to the January 2026 delivery period.
- Forecast selection mode indicator describing which forecast publication rule is active.
- KPI cards:
  - Mean forecast generation over the selected intervals (unit must match the source data).
  - Mean actual generation over matched intervals.
  - MAE.
  - Forecast bias.
- Main time-series chart:
  - Actual generation series.
  - Selected forecast series.
  - Shared delivery-time x-axis.
  - Clear units and legend.
  - Tooltip showing delivery time, forecast value, actual value, and error.
- Summary note that explains the currently selected forecast policy and sample size.

#### Behaviors

- Changing the delivery date range refreshes all charts, KPIs, and tables.
- Selecting a point or interval opens its details in the Forecast Explorer or a detail panel.
- If actual data is not yet available for an interval, show forecast data without treating the missing actual as zero.
- If no matched intervals exist, show an informative empty state rather than misleading metrics.

#### Acceptance criteria

- Users can see forecast and actual generation for the same delivery intervals.
- Units are displayed consistently.
- KPI metrics use only valid matched forecast/actual pairs.
- The UI does not imply that a later forecast was available at an earlier decision time.
- Missing data is visibly distinct from a numeric zero.

### 6.2 Forecast Accuracy

**Purpose:** Quantify forecast errors and help users understand their direction and magnitude.

#### Metrics

Let:
- `F_t` = selected forecast generation for delivery interval `t`.
- `A_t` = actual generation for the same delivery interval.
- `e_t = F_t - A_t`.
- `n` = number of valid matched intervals.

**Mean Absolute Error (MAE)**

`MAE = (1/n) × Σ |F_t − A_t|`

Interpretation: average absolute difference between forecast and actual generation.

**Root Mean Squared Error (RMSE)**

`RMSE = sqrt((1/n) × Σ (F_t − A_t)^2)`

Interpretation: emphasizes larger errors more strongly than MAE.

**Forecast Bias**

`Bias = (1/n) × Σ (F_t − A_t)`

Interpretation: positive bias means forecasts were higher than actuals on average; negative bias means forecasts were lower than actuals on average. Confirm this sign convention in labels and documentation.

**Mean Absolute Percentage Error (MAPE), optional**

`MAPE = (100/n') × Σ |(F_t − A_t) / A_t|`, calculated only over intervals where `A_t != 0`; disclose the number of intervals included in `n'`. Consider omitting MAPE from the main KPI row if zero or near-zero actual values make it misleading.

#### Required UI elements

- KPI cards for MAE, RMSE, bias, and valid pair count.
- Actual-vs-forecast chart.
- Error-over-time chart showing `F_t − A_t`.
- Table of the largest absolute errors, sorted descending.
- Metric definitions in a tooltip, expandable panel, or methodology section.
- Clear indication of the selected forecast rule and the period being evaluated.

#### Behaviors

- All metrics must be calculated from the same matched set of intervals, except optional MAPE, which must clearly disclose any excluded zero-actual intervals.
- Missing forecasts or actuals are excluded from matched metrics and counted in a data-quality summary.
- Metrics must not silently substitute zero for missing values.
- The table should show delivery time, forecast publication time, forecast value, actual value, signed error, and absolute error.

#### Acceptance criteria

- Given a known set of forecast/actual pairs, the backend returns the expected MAE, RMSE, bias, and valid-pair count.
- Positive and negative bias are interpreted consistently with the documented formula.
- Error ranking uses absolute error, not signed error.
- A missing actual or forecast does not become a false zero.
- Metrics show a clear unit consistent with generation values.

### 6.3 Forecast Explorer

**Purpose:** Allow the user to inspect individual delivery intervals and available forecast versions.

#### Required UI elements

- Delivery interval date/time filter.
- Optional exact interval selector.
- Table with:
  - Delivery time (`startTime`).
  - Forecast publication time (`publishTime`).
  - Forecast generation.
  - Actual generation.
  - Signed error.
  - Absolute error.
  - Decision-cutoff eligibility/status.
- Sorting by delivery time, publication time, or absolute error.
- A detail view or expanded row listing multiple forecast versions for the same delivery interval.

#### Behaviors

- Group forecasts by delivery interval.
- Display multiple publications for the same interval rather than silently collapsing them.
- Clearly distinguish:
  1. all available forecast versions,
  2. the forecast selected by the configured evaluation rule,
  3. the actual generation.
- If the data does not include a publication that satisfies the selected cutoff, show `No eligible forecast` rather than choosing a later one.
- Keep timestamps in a consistent timezone and label the timezone. Preserve raw timestamps in backend records if useful for auditability.

#### Acceptance criteria

- The user can inspect multiple forecast publications for the same `startTime`.
- The selected forecast can be traced to its `publishTime`.
- The selection rule is displayed in the UI and documented.
- Forecast versions are not accidentally joined to actuals by publication time; actuals and forecasts are matched by delivery interval.

### 6.4 Data & Methodology

Provide a small page, drawer, or modal that explains:

- Elexon is the sole data provider for this assignment.
- Actuals use FUELHH records where `fuelType = WIND`.
- Forecasts use WINDFOR records.
- Delivery timestamps and forecast publication timestamps are different concepts.
- The selected forecast policy and its decision cutoff.
- Metric formulas, units, missing-data rules, and known limitations.
- The time the data was last retrieved successfully.
- Any fallback/sample-data mode, clearly marked if implemented.

### 6.5 Data retrieval and refresh

- Backend retrieves actual and forecast records from the official Elexon endpoints.
- Normalize responses into a consistent internal schema.
- Filter actuals to `fuelType = WIND`.
- Restrict analysis to January 2026 delivery intervals.
- Handle pagination, streaming, or query parameters according to the actual API documentation and response behavior.
- Avoid repeated upstream requests for every frontend render; use a lightweight cache or saved snapshot if appropriate.
- Include timeouts and graceful error handling.
- Display a useful error state if Elexon is unavailable.
- Do not fabricate missing observations.
- If a static snapshot is used to improve reliability, identify it as a snapshot and show its retrieval timestamp.

**Important:** Verify the current Elexon API schema, pagination behavior, time zone conventions, and available historical records before implementation. Do not assume undocumented parameters or fields.

---

## 7. Forecast Selection and Decision-Time Logic

This is a critical analytical requirement.

The forecast dataset contains:
- `startTime`: delivery interval being forecast.
- `publishTime`: when the forecast was published.
- `generation`: forecast generation.

Actuals contain:
- `startTime`: delivery interval.
- `generation`: observed generation.
- `fuelType`: generation type.

### Required data relationship

Join forecast and actual records using the same delivery interval (`startTime`) after normalizing timestamp formats and time zones. Do not join on `publishTime`.

### Forecast policy

The assignment says procurement decisions are made one day before delivery, but it does not define an exact hour or minute cutoff. Therefore:

1. Implement the cutoff as a named, configurable policy rather than burying it in code.
2. Document the assumed day-ahead cutoff, including timezone.
3. For each delivery interval, select only forecasts published at or before the applicable cutoff.
4. Among eligible forecasts, use the latest publication at or before that cutoff, unless the API documentation or business clarification establishes another rule.
5. If no eligible forecast exists, mark the interval as unavailable for that policy.
6. Keep later forecast versions available in the Explorer, but do not use them in a retrospective decision-time accuracy metric.

If the exact market decision schedule cannot be confirmed within the assignment time, explicitly label the cutoff as an **assumption for the prototype**. Do not claim it is an official UK market rule.

### January 2026 scope

Filter on delivery `startTime` in January 2026, using a clearly documented timezone and inclusive/exclusive boundaries. Forecast `publishTime` may fall before the start of January if it forecasts an interval at the beginning of January; do not filter forecast records solely by publication month.

---

## 8. Data Model

A database is optional for the assignment. These are logical data structures; they may be represented in Python models or persisted tables.

### ActualGeneration

| Field | Type | Description |
|---|---|---|
| `start_time` | datetime | Delivery interval start |
| `generation` | number or null | Actual wind generation from Elexon |
| `fuel_type` | string | Must be `WIND` for included actual records |
| `source` | string | `FUELHH` |
| `retrieved_at` | datetime | Time the application retrieved the record |

### WindForecast

| Field | Type | Description |
|---|---|---|
| `start_time` | datetime | Target delivery interval |
| `publish_time` | datetime | Forecast publication timestamp |
| `generation` | number or null | Forecast generation |
| `source` | string | `WINDFOR` |
| `retrieved_at` | datetime | Time the application retrieved the record |

### SelectedForecastActualPair

This is a derived view, not necessarily a stored table.

| Field | Type | Description |
|---|---|---|
| `start_time` | datetime | Shared delivery interval |
| `selected_publish_time` | datetime or null | Publication time of selected forecast |
| `forecast_generation` | number or null | Selected forecast |
| `actual_generation` | number or null | Matched actual |
| `error` | number or null | Forecast minus actual |
| `absolute_error` | number or null | Absolute forecast error |
| `eligible` | boolean | Whether forecast meets the policy cutoff |
| `selection_policy_id` | string | Policy used to select the forecast |

### Data quality checks

- Detect duplicate records using relevant source keys.
- Preserve multiple forecasts for the same delivery interval if publication times differ.
- Detect duplicate forecast records with identical `startTime` and `publishTime`; apply a documented deduplication rule only after inspecting the source.
- Validate numeric generation values and handle nulls.
- Track missing actuals, missing forecasts, and unmatched delivery intervals.
- Ensure the date range is based on delivery time, not publication time.
- Avoid assuming the generation unit; confirm it in API documentation and label it consistently.

---

## 9. API Design

The following REST endpoints are recommended. Exact paths can be adjusted.

### `GET /api/health`

Returns service status.

Example:
```json
{
  "status": "ok"
}
```

### `GET /api/summary?start=2026-01-01&end=2026-02-01`

Returns summary KPIs and source status for the selected delivery period.

Example response shape:
```json
{
  "period": {
    "start": "2026-01-01",
    "end_exclusive": "2026-02-01"
  },
  "forecast_policy": {
    "id": "day_ahead_assumed_cutoff",
    "description": "Latest forecast published by the configured day-ahead cutoff",
    "is_assumption": true
  },
  "counts": {
    "actual_records": 0,
    "forecast_records": 0,
    "matched_pairs": 0
  },
  "metrics": {
    "mean_forecast": null,
    "mean_actual": null,
    "mae": null,
    "rmse": null,
    "bias": null,
    "mape": null
  },
  "retrieved_at": null
}
```

Numbers above are placeholders for response shape only, not real results.

### `GET /api/timeseries?start=...&end=...&policy=...`

Returns one record per delivery interval for charting.

Recommended fields:
- `start_time`
- `forecast_generation`
- `actual_generation`
- `forecast_publish_time`
- `error`
- `absolute_error`
- `eligible`

### `GET /api/forecasts?start=...&end=...&delivery_time=...`

Returns all available forecast versions for the selected period or delivery interval.

Recommended fields:
- `start_time`
- `publish_time`
- `generation`
- `eligible_under_policy`

### `GET /api/errors?start=...&end=...&limit=20&policy=...`

Returns the largest absolute forecast errors, sorted descending.

### API behavior requirements

- Validate query parameters.
- Use consistent datetime formats, preferably ISO 8601.
- Document timezone assumptions.
- Return meaningful HTTP status codes and human-readable error messages.
- Avoid returning fabricated values if the source is unavailable.
- Keep API response shapes stable and documented.

---

## 10. UX and Visual Design Requirements

### Visual direction

Use a professional energy-trading / operations-analytics aesthetic. Prioritize clarity and trust over decorative visuals.

Recommended direction:
- Light neutral or deep navy background with restrained green/teal accents.
- High-contrast typography and clear chart labels.
- Compact KPI cards and a spacious main chart.
- Subtle borders, consistent spacing, and restrained shadows.
- Avoid unnecessary gradients, glassmorphism, excessive animation, and decorative cards.
- Use green/teal for forecast data and a contrasting but accessible color for actuals; do not rely on color alone to distinguish series.

### Layout

- Desktop-first but responsive to tablet and mobile widths.
- Persistent compact navigation.
- Page header with title, period, and data status.
- Main chart takes visual priority.
- KPI row above or beside the main chart.
- Tables use sticky headers only if useful.
- Tooltip and labels must remain readable.

### Accessibility

- Provide text labels for controls.
- Use sufficient contrast.
- Make controls keyboard accessible.
- Provide chart legends and textual summaries.
- Use icons with text labels where icon meaning may not be obvious.
- Do not communicate data status by color alone.

### States

Implement these states deliberately:
- Initial loading.
- Data loaded successfully.
- No records available for selected filters.
- Partial data / missing intervals.
- Upstream API error.
- Invalid date filter.
- No eligible forecast under the chosen cutoff.
- Static snapshot/fallback mode, if implemented.

---

## 11. Technical Architecture and Stack

### Required

- Frontend: React.
- Backend: Python.
- Containerization: Docker.
- Deployment: Vercel or Heroku, as specified by the assignment.
- Public GitHub repository with an anonymous repository name.

### Recommended

- React + TypeScript + Vite.
- FastAPI + Pydantic.
- Pandas for joining and calculating metrics, if it reduces implementation time.
- Recharts or another lightweight charting library.
- `httpx` or `requests` for upstream API calls.
- `pytest` for backend metric and selection-policy tests.
- Docker Compose for local development.

### Suggested project structure

```text
windlens/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── charts/
│   │   ├── services/
│   │   ├── types/
│   │   └── App.tsx
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── services/
│   │   ├── analytics/
│   │   ├── schemas/
│   │   └── main.py
│   ├── tests/
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── docker-compose.yml
├── README.md
└── .gitignore
```

The exact structure is flexible; keep it proportional to the 16-hour time limit.

### Architecture principles

- Keep API access separate from metric calculation.
- Keep forecast-selection logic in a testable service/module.
- Keep presentation logic in React and business/data logic in Python.
- Centralize timestamp parsing and timezone normalization.
- Keep upstream URL and environment-specific settings configurable.
- Never commit secrets or local environment files.
- Avoid overengineering: a database, authentication, background workers, or complex infrastructure are not necessary unless a clear need emerges.

---

## 12. Error Handling, Reliability, and Security

- Use upstream request timeouts.
- Catch and report upstream API errors without crashing the app.
- Validate and normalize external API payloads.
- Display last successful retrieval time.
- Avoid logging secrets or unnecessary personal information.
- Do not expose stack traces to end users.
- Configure CORS to allow only the deployed frontend and local development origin where practical.
- Use environment variables for configuration.
- Commit `.env.example`, not `.env`.
- Use a clearly labeled data snapshot if a live upstream call is too slow or unreliable during the demo.
- If live data and snapshot data are both supported, show which source mode is active.

---

## 13. Testing Strategy

### Unit tests

1. MAE calculation.
2. RMSE calculation.
3. Bias calculation and sign convention.
4. Optional MAPE with zero actual values.
5. Matching forecasts and actuals by delivery interval.
6. Selecting the latest eligible forecast before a configured cutoff.
7. Returning no eligible forecast when all publications are after the cutoff.
8. Excluding missing values from matched metrics.
9. Filtering actual records to `fuelType = WIND`.
10. Filtering by delivery date while allowing relevant earlier forecast publication timestamps.

### Integration checks

- API endpoints return the documented response shapes.
- Invalid date parameters produce useful errors.
- Upstream API failures produce a controlled response.
- Empty datasets do not cause server errors.
- Frontend renders loading, error, empty, and populated states.

### Manual acceptance checks

- Open the app on desktop and a narrow viewport.
- Confirm tooltips and labels show the correct interval.
- Verify selected forecast publication time.
- Confirm the accuracy table sorts by absolute error.
- Confirm missing values do not appear as zero.
- Run the documented Docker startup instructions from a clean checkout.

---

## 14. Acceptance Criteria / Definition of Done

The MVP is complete when:

- [ ] The React application runs and communicates with the Python backend.
- [ ] The backend retrieves or loads clearly identified Elexon actual and forecast data.
- [ ] Actual records are filtered to `fuelType = WIND`.
- [ ] The evaluated delivery period is January 2026.
- [ ] The UI distinguishes delivery time from forecast publication time.
- [ ] Forecasts and actuals are matched by delivery interval.
- [ ] A documented, configurable forecast selection policy is applied.
- [ ] The dashboard displays forecast and actual time series.
- [ ] The app calculates MAE, RMSE, and bias correctly for matched pairs.
- [ ] The app identifies intervals with the largest absolute errors.
- [ ] Missing or ineligible data is handled transparently.
- [ ] The app includes a methodology explanation.
- [ ] Docker configuration and local startup instructions work.
- [ ] The application is deployed to an allowed platform.
- [ ] README documents the project structure, startup steps, deployed URL, and AI tool usage if applicable.
- [ ] The code is in a public GitHub repository with an anonymous name.
- [ ] An unlisted YouTube demo no longer than 10 minutes has both customer and technical sections.
- [ ] The submission form is completed.
- [ ] Every submitted URL is checked in incognito mode.

---

## 15. Delivery and Submission Plan

### Deliverable 1: Deployed app

- Deploy the frontend and backend using a supported arrangement.
- Confirm API connectivity and CORS configuration.
- Verify the live app works without local credentials or local files.
- Copy the final public app URL.

### Deliverable 2: Public GitHub repository

- Use an anonymous repository name, as requested.
- Include frontend, backend, Docker configuration, tests, and README.
- Do not commit `.env`, credentials, or tokens.
- Include the deployment URL and AI tool disclosure if applicable.

### Deliverable 3: Unlisted YouTube video

**Part 1 — Customer presentation (up to 5 minutes)**
1. Explain the procurement problem.
2. Demonstrate the dashboard and forecast timeline.
3. Explain accuracy metrics and one or two observations supported by the data.
4. Show how the product helps analysts inspect forecast uncertainty.
5. State limitations and assumptions honestly.

**Part 2 — Technical review (up to 5 minutes)**
1. Explain React/Python architecture.
2. Show data retrieval and normalization.
3. Explain timestamp matching and forecast selection.
4. Explain metric calculations and tests.
5. Show Docker setup, project structure, and deployment.

Keep the complete video to 10 minutes or less and set its YouTube visibility to Unlisted.

### Deliverable 4: Submission form

Complete the Microsoft form specified by the assignment:
https://forms.cloud.microsoft/r/FTX6K2bbnU

Check all submitted links in an incognito window before final submission.

---

## 16. Suggested 16-Hour Implementation Plan

| Workstream | Time budget | Output |
|---|---:|---|
| Inspect Elexon schemas and validate January data | 2 hours | Confirmed sample payloads and data assumptions |
| Build Python retrieval, normalization, and selection logic | 3 hours | Working backend services |
| Build React layout, KPIs, and main chart | 4 hours | Usable overview dashboard |
| Add accuracy metrics, error table, and explorer | 2 hours | Complete core workflow |
| Docker, tests, deployment, and fixes | 2 hours | Reproducible deployed MVP |
| README and 10-minute demo | 3 hours | Submission-ready deliverables |
| **Total** | **16 hours** | |

If time runs short, prioritize data correctness, the overview chart, accuracy metrics, a reliable deployment, and the required video over secondary UI features.

---

## 17. Risks and Open Questions

### Open questions that must be resolved or explicitly documented

1. **Decision cutoff:** The brief says purchasing decisions occur one day before delivery but does not specify the exact time. Confirm it if possible; otherwise document the chosen prototype assumption.
2. **Timezone and market intervals:** Confirm the source API's timestamp convention and normalize timestamps consistently. January data can be filtered by a documented boundary convention.
3. **Generation units:** Verify the unit from official Elexon documentation and label every chart and metric accordingly.
4. **Historical data availability:** Confirm the endpoints return the required January 2026 actuals and forecast publication history.
5. **API pagination and query semantics:** Validate the endpoint behavior rather than assuming it.
6. **Deployment architecture:** Confirm the selected hosting arrangement can run both the React frontend and Python API.
7. **Forecast policy validity:** Ensure the configured cutoff represents a defensible interpretation of the day-ahead decision point, and clearly label any unverified assumption.

### Key risks and mitigations

- **Historical forecast versions are unavailable:** Verify early; use only data actually available from Elexon and document limitations.
- **Forecast selection leaks future information:** Select only publications eligible at the cutoff.
- **Missing data distorts metrics:** Exclude missing pairs and display coverage counts.
- **Upstream API is unreliable during demo:** Cache a real, clearly timestamped snapshot.
- **Scope exceeds 16 hours:** Keep the UI to three core views and avoid authentication or unnecessary infrastructure.
- **Metrics are misinterpreted:** Show formulas, units, pair counts, and bias sign convention.

---

## 18. Final Product Principle

WindLens should help a procurement analyst understand not only **what wind generation was forecast**, but also **which forecast was available at the time of the decision and how reliable that forecast proved to be**.

Every chart, KPI, and table should preserve that distinction. Data provenance, transparent assumptions, and correct matching matter more than feature count.

