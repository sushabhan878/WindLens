import asyncio
import csv
import io
import os
from datetime import date, datetime, time, timezone
from pathlib import Path
from typing import Annotated, Literal
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()

from .analytics import SCOPE_START, SCOPE_END, build_pairs, iso, metrics, policy_info, timestamp
from .source import SourceError, fetch_snapshot, read_snapshot, write_snapshot
from .config import cors_origins

app = FastAPI(title="WindLens API", version="1.0.0", description="January 2026 national wind generation intelligence. All timestamps UTC; policy timezone Europe/London. End dates are exclusive.")
app.add_middleware(CORSMiddleware, allow_origins=cors_origins(os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")), allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
snapshot_cache = None
refresh_lock = asyncio.Lock()
last_refresh_attempt = None
last_refresh_error = None


@app.exception_handler(SourceError)
async def source_error_handler(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(status_code=503, content={"detail": str(exc)})


def period(start: date = date(2026, 1, 1), end: date = date(2026, 2, 1),
           cutoff: str = Query(default=os.getenv("DEFAULT_CUTOFF", "11:00"), pattern=r"^([01]\d|2[0-3]):[0-5]\d$"),
           policy: Literal["day_ahead_assumed_cutoff"] = "day_ahead_assumed_cutoff"):
    begin = datetime.combine(start, time.min, timezone.utc)
    finish = datetime.combine(end, time.min, timezone.utc)
    if not SCOPE_START <= begin < finish <= SCOPE_END:
        raise HTTPException(422, "Choose a non-empty delivery range within January 2026. End is exclusive (latest 2026-02-01).")
    return begin, finish, time.fromisoformat(cutoff)


Period = Annotated[tuple, Depends(period)]


def get_snapshot():
    global snapshot_cache
    if snapshot_cache is None:
        snapshot_cache = read_snapshot()
    return snapshot_cache


def analysis(params):
    start, end, cutoff = params
    source = get_snapshot()
    rows = build_pairs(source["actuals"], source["forecasts"], start, end, cutoff)
    return source, rows


def summary_for(source, rows, params):
    start, end, cutoff = params
    result = metrics(rows)
    counts = dict(expected_intervals=int((end - start).total_seconds() / 1800),
                  actual_records=sum(r["actual_generation"] is not None for r in rows),
                  forecast_records=sum(r["version_count"] for r in rows),
                  forecast_delivery_intervals=sum(r["version_count"] > 0 for r in rows),
                  matched_pairs=result["matched_pairs"],
                  missing_actuals=sum(r["actual_generation"] is None for r in rows),
                  missing_forecasts=sum(r["version_count"] == 0 for r in rows),
                  no_eligible_forecast=sum(r["version_count"] > 0 and not r["eligible"] for r in rows),
                  null_selected_values=sum(r["eligible"] and r["forecast_generation"] is None for r in rows))
    return dict(period=dict(start=start.date().isoformat(), end_exclusive=end.date().isoformat()),
                forecast_policy=policy_info(cutoff), metrics=result, counts=counts, unit="MW",
                retrieved_at=source["retrieved_at"], source_mode=source.get("source_mode", "snapshot"),
                provider="Elexon", timezone="UTC", quality=source["quality"],
                provenance=source["provenance"], last_refresh_error=last_refresh_error)


@app.get("/api/health")
def health():
    try:
        source = get_snapshot()
        return dict(status="ok", snapshot_available=True, retrieved_at=source["retrieved_at"])
    except SourceError:
        return dict(status="degraded", snapshot_available=False, retrieved_at=None)


@app.get("/api/summary")
def summary(params: Period):
    source, rows = analysis(params)
    return summary_for(source, rows, params)


@app.get("/api/timeseries")
def timeseries(params: Period):
    _, rows = analysis(params)
    return dict(data=rows, timezone="UTC", unit="MW")


@app.get("/api/dashboard")
def dashboard(params: Period):
    source, rows = analysis(params)
    errors = sorted((r for r in rows if r["error"] is not None), key=lambda r: (-r["absolute_error"], r["start_time"]))
    return dict(summary=summary_for(source, rows, params), timeseries=rows, errors=errors[:20])


@app.get("/api/errors")
def errors(params: Period, limit: int = Query(20, ge=1, le=1488)):
    _, rows = analysis(params)
    ranked = sorted((r for r in rows if r["error"] is not None), key=lambda r: (-r["absolute_error"], r["start_time"]))
    return dict(data=ranked[:limit], total=len(ranked), unit="MW")


@app.get("/api/forecasts")
def forecasts(params: Period, delivery_time: str | None = None,
              sort: Literal["delivery", "publication", "absolute_error"] = "publication",
              order: Literal["asc", "desc"] = "desc",
              offset: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=1000)):
    source, rows = analysis(params)
    start, end, cutoff = params
    exact = None
    if delivery_time is not None:
        try:
            exact = timestamp(delivery_time)
        except (ValueError, TypeError):
            raise HTTPException(422, "delivery_time must be an ISO 8601 timestamp with a timezone.")
        if not start <= exact < end:
            raise HTTPException(422, "The delivery interval must fall within the selected period.")
    pairs = {r["start_time"]: r for r in rows}
    versions = []
    for forecast in source["forecasts"]:
        delivery = timestamp(forecast["start_time"])
        if not start <= delivery < end or (exact is not None and delivery != exact):
            continue
        pair = pairs[forecast["start_time"]]
        actual, generation = pair["actual_generation"], forecast["generation"]
        error = generation - actual if generation is not None and actual is not None else None
        versions.append(dict(**forecast, actual_generation=actual, error=error,
                             absolute_error=abs(error) if error is not None else None,
                             eligible_under_policy=timestamp(forecast["publish_time"]) <= timestamp(pair["cutoff_time"]),
                             selected=forecast["publish_time"] == pair["forecast_publish_time"],
                             cutoff_time=pair["cutoff_time"]))
    key = {"delivery": "start_time", "publication": "publish_time", "absolute_error": "absolute_error"}[sort]
    valid = [v for v in versions if v[key] is not None]
    missing = [v for v in versions if v[key] is None]
    valid.sort(key=lambda r: (r[key] if key == "absolute_error" else timestamp(r[key]),
                             timestamp(r["start_time"]), timestamp(r["publish_time"])), reverse=order == "desc")
    versions = valid + missing
    return dict(data=versions[offset:offset + limit], total=len(versions), offset=offset, limit=limit,
                interval=pairs.get(iso(exact)) if exact is not None else None, unit="MW", timezone="UTC")


@app.get("/api/export")
def export(params: Period):
    _, rows = analysis(params)
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=list(rows[0]) if rows else [])
    writer.writeheader()
    writer.writerows(rows)
    return Response(output.getvalue(), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="windlens-january-2026.csv"'})


@app.post("/api/refresh")
async def refresh():
    global snapshot_cache, last_refresh_attempt, last_refresh_error
    now = datetime.now(timezone.utc)
    if refresh_lock.locked():
        raise HTTPException(409, "An Elexon refresh is already running.")
    if last_refresh_attempt and (now - last_refresh_attempt).total_seconds() < 300:
        raise HTTPException(429, "Please wait five minutes between Elexon refresh attempts.")
    async with refresh_lock:
        last_refresh_attempt = now
        try:
            data = await fetch_snapshot()
            # Vercel's deployment filesystem is read-only; its instance uses memory.
            if not os.getenv("VERCEL"):
                write_snapshot(data)
            snapshot_cache = data | {"source_mode": "live_cache"}
            last_refresh_error = None
            return dict(status="ok", retrieved_at=data["retrieved_at"], actual_records=len(data["actuals"]), forecast_records=len(data["forecasts"]))
        except SourceError as exc:
            last_refresh_error = str(exc)
            raise
        except OSError as exc:
            last_refresh_error = "Data was retrieved but could not be saved. Check the snapshot path permissions."
            raise SourceError(last_refresh_error) from exc


frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
# Docker/local production serves a combined app. Vercel Services serves React
# independently, so only the frontend service should own its static assets.
if not os.getenv("VERCEL") and frontend_dist.exists():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
