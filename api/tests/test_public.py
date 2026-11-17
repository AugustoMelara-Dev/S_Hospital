from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import get_settings
from tests.factories import update_settings


def test_health(client: TestClient) -> None:
    assert client.get("/api/health").json() == {"status": "ok", "version": "2.0.0"}


def test_branding_without_logo(client: TestClient) -> None:
    assert client.get("/api/branding").json() == {
        "hospital_name": "Hospital General", "slogan": "", "has_logo": False,
    }
    resp = client.get("/api/branding/logo")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "logo_not_found"


def test_branding_with_logo(client: TestClient, db: Session) -> None:
    png = b"\x89PNG\r\n\x1a\nfake"
    update_settings(db, logo=png, logo_mime="image/png", slogan="Servimos con calidad")
    body = client.get("/api/branding").json()
    assert body["has_logo"] is True
    assert body["slogan"] == "Servimos con calidad"
    resp = client.get("/api/branding/logo")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/png"
    assert resp.content == png


def test_unknown_api_route_envelope(client: TestClient) -> None:
    resp = client.get("/api/no-existe")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"


def test_method_not_allowed_envelope(client: TestClient) -> None:
    resp = client.delete("/api/health")
    assert resp.status_code == 405
    assert resp.json()["error"]["code"] == "method_not_allowed"


def test_spa_fallback(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<html>spa</html>", encoding="utf-8")
    (dist / "assets" / "app.js").write_text("console.log(1)", encoding="utf-8")
    monkeypatch.setenv("SHS_WEB_DIST", str(dist))
    get_settings.cache_clear()
    try:
        from app.main import create_app

        with TestClient(create_app()) as c:
            assert c.get("/").text == "<html>spa</html>"
            assert c.get("/cobrar").text == "<html>spa</html>"
            assert c.get("/assets/app.js").text == "console.log(1)"
            assert c.get("/../secret").text == "<html>spa</html>"
            assert c.get("/api/nope").status_code == 404
            assert c.get("/api/nope").headers["content-type"].startswith("application/json")
    finally:
        monkeypatch.undo()
        get_settings.cache_clear()
