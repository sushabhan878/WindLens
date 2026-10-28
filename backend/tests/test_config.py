import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient
from app.config import cors_origins


def test_copied_deployment_origins_are_normalized_without_widening_access():
    value = " https://windlens-web.vercel.app/ , https://WINDLENS-WEB.vercel.app:443///, http://localhost:5173/ , "
    assert cors_origins(value) == ["https://windlens-web.vercel.app", "http://localhost:5173"]


@pytest.mark.parametrize("value", ["*", "https://example.com/path", "https://user:pass@example.com", "https://example.com?query=1", "https://example.com#fragment", "https://example.com:bad", "file:///example"])
def test_invalid_origins_fail_closed(value):
    with pytest.raises(ValueError):
        cors_origins(value)


def test_browser_origin_matches_copy_with_slash_and_preflight_is_allowed():
    app = FastAPI()
    app.add_middleware(CORSMiddleware,
                       allow_origins=cors_origins(" https://windlens-web.vercel.app/ "),
                       allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
    @app.get("/api/health")
    def health():
        return {"status": "ok"}
    client = TestClient(app)
    origin = "https://windlens-web.vercel.app"
    response = client.get("/api/health", headers={"Origin": origin})
    assert response.headers["access-control-allow-origin"] == origin
    preflight = client.options("/api/refresh", headers={"Origin": origin,
        "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "Content-Type"})
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == origin
    untrusted = client.get("/api/health", headers={"Origin": "https://untrusted.example"})
    assert "access-control-allow-origin" not in untrusted.headers
