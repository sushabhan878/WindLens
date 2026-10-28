# WindLens demo guide — target 8–9 minutes

This is a recording guide, not a claim that a video has been recorded or uploaded.

## Customer presentation — 0:00 to 4:15

**0:00–0:40 — The problem.** Procurement analysts need to inspect expected wind generation before delivery and compare it with what was observed. Looking at the latest forecast after delivery can use information that was unavailable when a decision was made.

**0:40–1:35 — Overview.** Show January 2026, the Elexon snapshot label and retrieval time, the forecast/actual chart, and the four metrics. Explain that MW measures generation, not energy or monetary exposure. Show the first-week date preset and restore the full month.

**1:35–2:20 — Decision-time policy.** Point to the 11:00 London previous-day cutoff. Explain that it is a prototype assumption. Change it and show that results follow the selected publications. Do not describe it as an official market rule.

**2:20–3:10 — Accuracy.** Show MAE, RMSE, signed bias, and pair count. In the bundled snapshot at the default cutoff, MAE is about 2,107 MW and bias is about +1,840 MW across 744 pairs. Positive bias means forecasts were above actuals on average for this source and policy. The largest recorded deviation is 12 January 01:00 UTC: forecast 20,905 MW versus actual 14,048 MW, or +6,857 MW. Verify against the current snapshot before recording in case the data was refreshed.

**3:10–3:50 — Audit trail.** Open that interval and show its selected publication at 11 January 09:30 UTC, alongside later versions excluded by the cutoff. Inspect one half-hour start to demonstrate missing forecast values remain unavailable.

**3:50–4:15 — Limits.** Forecasts have hourly starts; actuals are half-hourly, so 744 of 1,488 starts match exactly. No interpolation, pricing, or trading recommendations are provided. Source scope is operationally metered GB generation rather than every wind generator in the UK.

## Technical review — 4:15 to 8:45

**4:15–5:00 — Architecture.** React/TypeScript/Vite UI; FastAPI API; pure Python analytics; gzip real-data snapshot; single multi-stage Docker image. Vite proxies local development; Docker/Vercel use one origin.

**5:00–6:00 — Retrieval and normalization.** Show `source.py`. Official FUELHH/WINDFOR streams, daily publication windows, December buffer, timeouts/retries, explicit WIND filter, duplicates, timezone-aware timestamps, and atomic snapshot replacement. Mention bounded correction history and failure retention.

**6:00–6:50 — Selection and metrics.** Show `analytics.py`. Join on delivery timestamp, apply previous-calendar-day London cutoff, pick latest eligible publication, exclude null pairs, compute MAE/RMSE/bias, distinguish zero from missing.

**6:50–7:35 — Verification.** Run `cd backend; python -m pytest -q`. Explain known-pair metric tests, cutoff/subsecond boundary tests, missing values, API contracts, upstream failures, CSV, and persistence. Show `npm --prefix frontend run build` and Docker health.

**7:35–8:20 — Reproducibility and deployment.** Show `docker compose up --build -d`, README directory guide, Vercel Python entry point/configuration and the verified public application URL once deployed. Explain that Vercel refreshes cache in instance memory while the bundled snapshot provides cold-start reliability.

**8:20–8:45 — Close.** Show methodology and export. Confirm the repository and application links are accessible signed out. Keep each section below 5 minutes and the total video below 10 minutes.
