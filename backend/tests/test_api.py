import asyncio
from copy import deepcopy
import pytest
from fastapi.testclient import TestClient
from app import main
from app.analytics import normalize
from app.source import SourceError
from test_analytics import actual, forecast


@pytest.fixture
def client(monkeypatch):
    actuals, forecasts, quality = normalize([actual(generation=100), actual("2026-01-01T01:00:00Z", 200)],
        [forecast(generation=130), forecast("2026-01-01T01:00:00Z", 180), forecast(generation=140, publish="2025-12-31T12:00:00Z")])
    snapshot = dict(schema_version=1, actuals=actuals, forecasts=forecasts, quality=quality,
                    retrieved_at="2026-10-28T00:00:00Z", source_mode="snapshot", provenance={})
    monkeypatch.setattr(main, "snapshot_cache", snapshot)
    monkeypatch.setattr(main, "last_refresh_attempt", None)
    monkeypatch.setattr(main, "last_refresh_error", None)
    monkeypatch.setattr(main, "refresh_lock", asyncio.Lock())
    return TestClient(main.app)


def test_summary_and_dashboard_consistent(client):
    summary = client.get("/api/summary").json()
    dashboard = client.get("/api/dashboard").json()
    assert summary == dashboard["summary"]
    assert summary["metrics"]["mae"] == 25
    assert summary["counts"]["matched_pairs"] == 2
    assert summary["forecast_policy"]["is_assumption"] is True
    assert len(dashboard["timeseries"]) == 1488


@pytest.mark.parametrize("query", ["start=2025-12-31", "end=2026-02-02", "start=2026-01-03&end=2026-01-02", "start=bad", "cutoff=25:00", "policy=latest"])
def test_invalid_range_and_policy(client, query):
    assert client.get(f"/api/summary?{query}").status_code == 422


def test_all_versions_traceable_and_later_versions_not_selected(client):
    result = client.get("/api/forecasts?delivery_time=2026-01-01T00:00:00Z").json()
    assert result["total"] == 2
    assert result["data"][0]["eligible_under_policy"] is False
    assert result["data"][1]["selected"] is True
    assert result["interval"]["forecast_generation"] == 130


def test_forecast_delivery_validation_and_error_ranking(client):
    assert client.get("/api/forecasts?delivery_time=bad").status_code == 422
    assert client.get("/api/forecasts?delivery_time=2026-02-01T00:00:00Z").status_code == 422
    result = client.get("/api/errors?limit=1").json()
    assert result["data"][0]["error"] == 30
    assert result["total"] == 2
    assert client.get("/api/errors?limit=0").status_code == 422


def test_cutoff_changes_selection(client):
    assert client.get("/api/summary?cutoff=13:00").json()["metrics"]["mae"] == 30


def test_csv_keeps_missing_cells_empty(client):
    response = client.get("/api/export?start=2026-01-01&end=2026-01-02")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    lines = response.text.splitlines()
    assert len(lines) == 49
    assert "None" not in response.text
    assert ",,," in lines[2]


def test_empty_data_is_a_valid_result(client, monkeypatch):
    source = deepcopy(main.snapshot_cache)
    source["actuals"] = source["forecasts"] = []
    monkeypatch.setattr(main, "snapshot_cache", source)
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    assert response.json()["summary"]["metrics"]["mae"] is None
    assert response.json()["errors"] == []


def test_snapshot_failure_is_controlled(client, monkeypatch):
    monkeypatch.setattr(main, "snapshot_cache", None)
    def failed():
        raise SourceError("Snapshot unavailable")
    monkeypatch.setattr(main, "read_snapshot", failed)
    assert client.get("/api/summary").status_code == 503
    assert client.get("/api/health").json()["status"] == "degraded"


def test_upstream_failure_retains_snapshot_and_throttles(client, monkeypatch):
    previous = main.snapshot_cache
    async def failed():
        raise SourceError("Elexon unavailable")
    monkeypatch.setattr(main, "fetch_snapshot", failed)
    response = client.post("/api/refresh")
    assert response.status_code == 503
    assert main.snapshot_cache is previous
    assert client.get("/api/summary").json()["last_refresh_error"] == "Elexon unavailable"
    assert client.post("/api/refresh").status_code == 429


def test_successful_refresh_updates_memory_and_storage(client, monkeypatch):
    new = deepcopy(main.snapshot_cache)
    new["retrieved_at"] = "2026-10-28T12:00:00Z"
    saved = []
    async def fetch():
        return new
    monkeypatch.delenv("VERCEL", raising=False)
    monkeypatch.setattr(main, "fetch_snapshot", fetch)
    monkeypatch.setattr(main, "write_snapshot", saved.append)
    assert client.post("/api/refresh").status_code == 200
    assert saved == [new]
    assert client.get("/api/summary").json()["source_mode"] == "live_cache"


def test_cors_only_allows_configured_origins(client):
    good = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    bad = client.get("/api/health", headers={"Origin": "https://untrusted.example"})
    assert good.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-origin" not in bad.headers
