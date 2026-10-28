"""Official Elexon stream retrieval and atomic, auditable snapshot storage."""
import asyncio
import gzip
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
import httpx
from dotenv import load_dotenv
from .analytics import normalize, iso

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

DATA_PATH = Path(os.getenv("WINDLENS_SNAPSHOT_PATH", str(Path(__file__).resolve().parents[1] / "data" / "january-2026.json.gz")))
API_BASE = os.getenv("ELEXON_API_BASE", "https://data.elexon.co.uk/bmrs/api/v1").rstrip("/")


class SourceError(Exception):
    pass


async def fetch_snapshot() -> dict:
    semaphore = asyncio.Semaphore(4)
    async with httpx.AsyncClient(timeout=httpx.Timeout(30), follow_redirects=True,
                                headers={"User-Agent": "WindLens/1.0", "Accept": "application/json"}) as client:
        async def chunk(dataset, day):
            params = dict(publishDateTimeFrom=iso(day), publishDateTimeTo=iso(day + timedelta(days=1)))
            async with semaphore:
                for attempt in range(3):
                    try:
                        response = await client.get(f"{API_BASE}/datasets/{dataset}/stream", params=params)
                        if response.status_code in (429, 500, 502, 503, 504) and attempt < 2:
                            await asyncio.sleep(1 + attempt * 2)
                            continue
                        response.raise_for_status()
                        payload = response.json()
                        if not isinstance(payload, list):
                            raise SourceError("Elexon returned an unexpected stream response; previous data was retained.")
                        return dataset, payload
                    except (httpx.HTTPError, ValueError) as exc:
                        if attempt < 2:
                            await asyncio.sleep(1 + attempt)
                        else:
                            raise SourceError("Elexon could not be reached or returned invalid data. Previous data was retained; retry later.") from exc

        tasks = []
        # WINDFOR has a 72-hour published horizon in the inspected January data.
        # Include a 7-day buffer before January and 2 days after it for history.
        # Actual publication windows include 2 days after delivery for delayed outturns.
        for dataset, first in (("WINDFOR", datetime(2025, 12, 25, tzinfo=timezone.utc)),
                               ("FUELHH", datetime(2026, 1, 1, tzinfo=timezone.utc))):
            day = first
            while day < datetime(2026, 2, 3, tzinfo=timezone.utc):
                tasks.append(chunk(dataset, day))
                day += timedelta(days=1)
        results = await asyncio.gather(*tasks, return_exceptions=True)
        failures = [r for r in results if isinstance(r, BaseException)]
        if failures:
            raise SourceError("A retrieval window failed. The previous complete snapshot was retained; retry later.") from failures[0]
    raw_actuals, raw_forecasts = [], []
    for dataset, records in results:
        (raw_forecasts if dataset == "WINDFOR" else raw_actuals).extend(records)
    actuals, forecasts, quality = normalize(raw_actuals, raw_forecasts)
    if not actuals or not forecasts:
        raise SourceError("Elexon returned no usable January data for one of the streams. Previous data was retained.")
    return dict(schema_version=1, provider="Elexon", retrieved_at=iso(datetime.now(timezone.utc)),
                unit="MW", source_mode="snapshot", actuals=actuals, forecasts=forecasts,
                quality=quality,
                provenance=dict(api_base=API_BASE, datasets=["FUELHH", "WINDFOR"],
                    publication_window_start="2025-12-25T00:00:00Z", publication_window_end_exclusive="2026-02-03T00:00:00Z",
                    retrieval="Daily publication windows; stream arrays have no pagination. Inclusive boundary duplicates are removed.",
                    forecast_resolution="hourly in inspected January records", actual_resolution="half-hourly"))


def read_snapshot() -> dict:
    try:
        with gzip.open(DATA_PATH, "rt", encoding="utf-8") as file:
            data = json.load(file)
        if data.get("schema_version") != 1 or not isinstance(data.get("actuals"), list) or not isinstance(data.get("forecasts"), list):
            raise ValueError("Invalid snapshot schema")
        return data
    except (OSError, ValueError, TypeError) as exc:
        raise SourceError("The saved Elexon dataset is unavailable. Select Refresh data to retrieve it, then try again.") from exc


def write_snapshot(data: dict):
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = DATA_PATH.with_suffix(".tmp")
    with gzip.open(temporary, "wt", encoding="utf-8") as file:
        json.dump(data, file, separators=(",", ":"), allow_nan=False)
    temporary.replace(DATA_PATH)
