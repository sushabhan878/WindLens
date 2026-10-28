"""Pure selection and accuracy functions. No network or persistence dependencies."""
from collections import defaultdict
from datetime import datetime, date, time, timedelta, timezone
from math import isfinite, sqrt
from zoneinfo import ZoneInfo

UTC = timezone.utc
LONDON = ZoneInfo("Europe/London")
SCOPE_START = datetime(2026, 1, 1, tzinfo=UTC)
SCOPE_END = datetime(2026, 2, 1, tzinfo=UTC)


def timestamp(value: str) -> datetime:
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("Source timestamps must contain an explicit timezone")
    return result.astimezone(UTC)


def iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


def number(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        result = float(value)
        return result if isfinite(result) else None
    except (ValueError, TypeError, OverflowError):
        return None


def normalize(actuals: list, forecasts: list) -> tuple[list, list, dict]:
    """Keep latest-published actual; dedupe forecast (delivery, publication).

    Identical-key conflicting forecasts use the smallest numeric generation value
    deterministically (not upstream order), and are disclosed as conflicts.
    At an identical publication time, valid values win over null duplicates.
    A newer actual publication wins even if its generation is null.
    """
    quality = dict(duplicate_actuals=0, duplicate_forecasts=0,
                   conflicting_forecasts=0, invalid_records=0, invalid_values=0)
    actual_map, forecast_map = {}, {}
    for records, is_forecast in ((actuals, False), (forecasts, True)):
        for raw in records:
            if not isinstance(raw, dict):
                quality["invalid_records"] += 1
                continue
            if not is_forecast and raw.get("fuelType") != "WIND":
                continue
            try:
                start = timestamp(raw["startTime"])
                published = timestamp(raw["publishTime"])
            except (KeyError, ValueError, TypeError, AttributeError):
                quality["invalid_records"] += 1
                continue
            if not SCOPE_START <= start < SCOPE_END:
                continue
            generation = number(raw.get("generation"))
            if generation is None and raw.get("generation") is not None:
                quality["invalid_values"] += 1
            record = dict(start_time=iso(start), publish_time=iso(published), generation=generation)
            key = (record["start_time"], record["publish_time"]) if is_forecast else record["start_time"]
            target = forecast_map if is_forecast else actual_map
            old = target.get(key)
            if old:
                quality["duplicate_forecasts" if is_forecast else "duplicate_actuals"] += 1
                if is_forecast:
                    if old["generation"] != generation:
                        quality["conflicting_forecasts"] += 1
                    candidates = [v for v in (old["generation"], generation) if v is not None]
                    record["generation"] = min(candidates) if candidates else None
                else:
                    # Latest publication wins, including a newly published null.
                    # Equal publication timestamps have an order-independent tie break.
                    rank = lambda r: (timestamp(r["publish_time"]), r["generation"] is not None,
                                      -(r["generation"] or 0))
                    record = max((old, record), key=rank)
            target[key] = record
    return (sorted(actual_map.values(), key=lambda r: r["start_time"]),
            sorted(forecast_map.values(), key=lambda r: (timestamp(r["start_time"]), timestamp(r["publish_time"]))), quality)


def cutoff_for(start: datetime, cutoff: time) -> datetime:
    previous_day = start.astimezone(LONDON).date() - timedelta(days=1)
    return datetime.combine(previous_day, cutoff, LONDON).astimezone(UTC)


def policy_info(cutoff: time) -> dict:
    label = cutoff.strftime("%H:%M")
    return dict(id="day_ahead_assumed_cutoff", cutoff=label, timezone="Europe/London",
                is_assumption=True,
                description=f"Latest publication by {label} Europe/London on the day before delivery")


def build_pairs(actuals: list, forecasts: list, start: datetime, end: datetime, cutoff: time) -> list:
    by_start = defaultdict(list)
    for record in forecasts:
        by_start[record["start_time"]].append(record)
    actual_map = {r["start_time"]: r["generation"] for r in actuals}
    # Half-hour grid makes missing observations visible, including fully absent intervals.
    starts = set()
    cursor = start
    while cursor < end:
        starts.add(iso(cursor))
        cursor += timedelta(minutes=30)
    starts.update(s for s in by_start if start <= timestamp(s) < end)
    starts.update(s for s in actual_map if start <= timestamp(s) < end)
    pairs = []
    for delivery in sorted(starts):
        deadline = cutoff_for(timestamp(delivery), cutoff)
        versions = by_start[delivery]
        eligible = [r for r in versions if timestamp(r["publish_time"]) <= deadline]
        selected = max(eligible, key=lambda r: timestamp(r["publish_time"]), default=None)
        f = selected["generation"] if selected else None
        a = actual_map.get(delivery)
        error = f - a if f is not None and a is not None else None
        pairs.append(dict(start_time=delivery, forecast_publish_time=selected["publish_time"] if selected else None,
                          forecast_generation=f, actual_generation=a, error=error,
                          absolute_error=abs(error) if error is not None else None,
                          eligible=selected is not None, cutoff_time=iso(deadline),
                          version_count=len(versions), eligible_version_count=len(eligible),
                          selection_policy_id="day_ahead_assumed_cutoff"))
    return pairs


def metrics(pairs: list) -> dict:
    matched = [r for r in pairs if r["error"] is not None]
    n = len(matched)
    percentage = [r for r in matched if r["actual_generation"] != 0]
    return dict(mean_forecast=sum(r["forecast_generation"] for r in matched) / n if n else None,
                mean_actual=sum(r["actual_generation"] for r in matched) / n if n else None,
                mae=sum(r["absolute_error"] for r in matched) / n if n else None,
                rmse=sqrt(sum(r["error"] ** 2 for r in matched) / n) if n else None,
                bias=sum(r["error"] for r in matched) / n if n else None,
                mape=100 * sum(r["absolute_error"] / abs(r["actual_generation"]) for r in percentage) / len(percentage) if percentage else None,
                mape_pair_count=len(percentage), matched_pairs=n)
