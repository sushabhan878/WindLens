import asyncio
import gzip
import json
import httpx
import pytest
from app import source


def test_stream_windows_and_normalization(monkeypatch):
    observed = []
    def handler(request):
        observed.append(request)
        dataset = "WINDFOR" if "WINDFOR" in request.url.path else "FUELHH"
        record = dict(startTime="2026-01-01T00:00:00Z", publishTime="2025-12-31T09:30:00Z", generation=100, dataset=dataset)
        if dataset == "FUELHH":
            record.update(fuelType="WIND", publishTime="2026-01-01T00:30:00Z")
        return httpx.Response(200, json=[record])
    original_client = httpx.AsyncClient
    monkeypatch.setattr(source.httpx, "AsyncClient", lambda **kwargs: original_client(**kwargs, transport=httpx.MockTransport(handler)))
    result = asyncio.run(source.fetch_snapshot())
    assert len(observed) == 73
    assert all(set(r.url.params.keys()) == {"publishDateTimeFrom", "publishDateTimeTo"} for r in observed)
    assert any(r.url.params["publishDateTimeFrom"].startswith("2025-12-25") for r in observed)
    assert len(result["actuals"]) == len(result["forecasts"]) == 1
    assert result["provider"] == "Elexon"


@pytest.mark.parametrize("payload", [{"data": []}, "unexpected"])
def test_malformed_stream_aborts_instead_of_saving(monkeypatch, payload):
    original_client = httpx.AsyncClient
    monkeypatch.setattr(source.httpx, "AsyncClient", lambda **kwargs: original_client(**kwargs, transport=httpx.MockTransport(lambda _: httpx.Response(200, json=payload))))
    with pytest.raises(source.SourceError):
        asyncio.run(source.fetch_snapshot())


def test_snapshot_round_trip_and_unavailable_error(monkeypatch, tmp_path):
    path = tmp_path / "data" / "snapshot.json.gz"
    monkeypatch.setattr(source, "DATA_PATH", path)
    with pytest.raises(source.SourceError):
        source.read_snapshot()
    value = dict(schema_version=1, actuals=[], forecasts=[], retrieved_at="2026-10-28T00:00:00Z")
    source.write_snapshot(value)
    assert source.read_snapshot() == value
    assert not path.with_suffix(".tmp").exists()
    with gzip.open(path, "wt") as file:
        json.dump({"schema_version": 999}, file)
    with pytest.raises(source.SourceError):
        source.read_snapshot()
