from datetime import time, datetime, timezone
from math import sqrt
import pytest
from app.analytics import build_pairs, cutoff_for, metrics, normalize, timestamp, number


def actual(start="2026-01-01T00:00:00Z", generation=100, fuel="WIND", publish="2026-01-01T00:30:00Z"):
    return dict(startTime=start, generation=generation, fuelType=fuel, publishTime=publish)


def forecast(start="2026-01-01T00:00:00Z", generation=110, publish="2025-12-31T10:30:00Z"):
    return dict(startTime=start, generation=generation, publishTime=publish)


def pairs(a, f, cutoff=time(11)):
    a, f, _ = normalize(a, f)
    return build_pairs(a, f, timestamp("2026-01-01T00:00:00Z"), timestamp("2026-01-02T00:00:00Z"), cutoff)


def test_known_metric_values_and_bias_sign():
    data = pairs([actual(generation=100), actual("2026-01-01T01:00:00Z", 200)],
                 [forecast(generation=130), forecast("2026-01-01T01:00:00Z", 180)])
    result = metrics(data)
    assert result["matched_pairs"] == 2
    assert result["mae"] == 25
    assert result["rmse"] == pytest.approx(sqrt(650))
    assert result["bias"] == 5
    assert result["mean_forecast"] == 155
    assert result["mean_actual"] == 150
    assert result["mape"] == 20


def test_cutoff_inclusive_latest_eligible_and_december_publication():
    versions = [forecast(generation=10, publish="2025-12-31T07:30:00Z"),
                forecast(generation=20, publish="2025-12-31T11:00:00Z"),
                forecast(generation=999, publish="2025-12-31T11:00:01Z")]
    pair = pairs([actual()], versions)[0]
    assert pair["forecast_generation"] == 20
    assert pair["forecast_publish_time"] == "2025-12-31T11:00:00Z"
    assert pair["version_count"] == 3
    assert pair["eligible_version_count"] == 2


def test_all_publications_after_cutoff_are_unavailable():
    pair = pairs([actual()], [forecast(publish="2025-12-31T12:00:00Z")])[0]
    assert not pair["eligible"]
    assert pair["forecast_generation"] is None
    assert pair["error"] is None


def test_zero_is_valid_missing_is_not_and_mape_excludes_zero():
    data = pairs([actual(generation=0), actual("2026-01-01T01:00:00Z", None)],
                 [forecast(generation=0), forecast("2026-01-01T01:00:00Z", 20)])
    result = metrics(data)
    assert result["matched_pairs"] == 1
    assert result["mae"] == 0
    assert result["mape"] is None
    assert result["mape_pair_count"] == 0


def test_no_matched_pairs_metrics_are_null():
    result = metrics(pairs([], []))
    assert result["matched_pairs"] == 0
    for key in ("mae", "rmse", "bias", "mean_actual", "mean_forecast", "mape"):
        assert result[key] is None


def test_join_uses_delivery_not_publication_and_no_half_hour_fill():
    result = pairs([actual(), actual("2026-01-01T00:30:00Z", 200)], [forecast()])
    assert len(result) == 48
    assert result[0]["error"] == 10
    assert result[1]["actual_generation"] == 200
    assert result[1]["forecast_generation"] is None
    assert result[1]["version_count"] == 0


def test_normalization_fuel_scope_timezone_and_revisions():
    a, f, q = normalize([actual(fuel="CCGT"), actual(generation=100),
                          actual(generation=120, publish="2026-01-01T01:00:00Z"),
                          actual("2026-02-01T00:00:00Z"), {"startTime": "bad", "fuelType": "WIND"}],
                         [forecast(start="2026-01-01T01:00:00+01:00"), forecast()])
    assert len(a) == 1 and a[0]["generation"] == 120
    assert len(f) == 1
    assert q["duplicate_actuals"] == 1
    assert q["duplicate_forecasts"] == 1
    assert q["invalid_records"] == 1


def test_conflicting_duplicates_are_order_independent():
    a, f, q = normalize([], [forecast(generation=100), forecast(generation=90)])
    _, reverse, _ = normalize([], [forecast(generation=90), forecast(generation=100)])
    assert f == reverse
    assert f[0]["generation"] == 90
    assert q["conflicting_forecasts"] == 1


def test_null_latest_eligible_does_not_fall_back_to_older_value():
    data = pairs([actual()], [forecast(generation=50, publish="2025-12-31T09:00:00Z"), forecast(generation=None)])
    assert data[0]["eligible"]
    assert data[0]["forecast_generation"] is None
    assert metrics(data)["matched_pairs"] == 0


@pytest.mark.parametrize("value", ["NaN", "Infinity", True, "bad", None, float("inf")])
def test_nonfinite_and_invalid_generation(value):
    assert number(value) is None


def test_naive_timestamps_rejected():
    with pytest.raises(ValueError):
        timestamp("2026-01-01T00:00:00")


def test_cutoff_uses_london_calendar_not_rolling_24_hours():
    assert cutoff_for(timestamp("2026-01-02T23:30:00Z"), time(11)) == timestamp("2026-01-01T11:00:00Z")
    # Same helper remains correct in BST even though analysis is January-only.
    assert cutoff_for(datetime(2026, 7, 2, 0, tzinfo=timezone.utc), time(11)) == timestamp("2026-07-01T10:00:00Z")


def test_subsecond_publication_order_and_cutoff_boundary():
    result = pairs([actual()], [forecast(generation=20, publish="2025-12-31T10:00:00Z"),
        forecast(generation=30, publish="2025-12-31T10:00:00.500Z"),
        forecast(generation=99, publish="2025-12-31T11:00:00.001Z")])
    assert result[0]["forecast_generation"] == 30
    assert result[0]["eligible_version_count"] == 2
