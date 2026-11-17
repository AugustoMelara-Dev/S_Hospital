"""Institutional settings + logo (SPEC §6 "Ajustes")."""

from __future__ import annotations

from collections.abc import Callable

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Setting, User
from tests.factories_admin import REASON, audit_count, audits, error_code

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64


def _settings(db: Session) -> Setting:
    db.expire_all()
    s = db.get(Setting, 1)
    assert s is not None
    return s


def test_get_settings_shape(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("auditor")
    resp = client.get("/api/settings")
    assert resp.status_code == 200
    body = resp.json()
    for key in ("hospital_name", "rtn", "address", "phone", "slogan", "government_line",
                "secretariat_line", "receipt_location", "receipt_footer_text",
                "default_tax_rate_bp", "partial_payments_enabled", "has_logo", "updated_at"):
        assert key in body
    assert body["default_tax_rate_bp"] == 1500
    assert body["has_logo"] is False
    assert "logo" not in body


def test_settings_permissions(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("cajero")
    assert client.get("/api/settings").status_code == 403
    assert client.put("/api/settings", json={"slogan": "x"}).status_code == 403


def test_supervisor_can_view_but_not_update(
    client: TestClient, login_as: Callable[..., User]
) -> None:
    login_as("supervisor")
    assert client.get("/api/settings").status_code == 200
    assert client.put("/api/settings", json={"slogan": "x"}).status_code == 403
    assert client.post("/api/settings/logo", files={"file": ("l.png", PNG, "image/png")}
                       ).status_code == 403


def test_put_partial_update_and_audit(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    login_as("admin")
    before = _settings(db)
    resp = client.put("/api/settings", json={"slogan": "Servir con calidad",
                                             "partial_payments_enabled": True})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["slogan"] == "Servir con calidad"
    assert body["partial_payments_enabled"] is True
    assert body["hospital_name"] == before.hospital_name  # untouched
    rows = audits(db, "settings.updated")
    assert len(rows) == 1
    assert rows[0].new_values == {"slogan": "Servir con calidad", "partial_payments_enabled": True}
    assert rows[0].old_values == {"slogan": "", "partial_payments_enabled": False}


def test_put_without_changes_writes_no_audit(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    login_as("admin")
    name = _settings(db).hospital_name
    assert client.put("/api/settings", json={"hospital_name": name}).status_code == 200
    assert audit_count(db, "settings.updated") == 0


def test_rtn_change_requires_reason(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    login_as("admin")
    resp = client.put("/api/settings", json={"rtn": "08011999000001"})
    assert resp.status_code == 422
    assert "reason" in resp.json()["error"]["fields"]
    resp = client.put("/api/settings", json={"rtn": "08011999000001", "reason": "abc"})
    assert resp.status_code == 422
    resp = client.put("/api/settings", json={"rtn": "0801-1999-000001", "reason": REASON})
    assert resp.status_code == 200
    assert resp.json()["rtn"] == "08011999000001"
    rows = audits(db, "settings.rtn_changed")
    assert len(rows) == 1 and rows[0].reason == REASON


def test_rtn_format_validated(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("admin")
    resp = client.put("/api/settings", json={"rtn": "12345", "reason": REASON})
    assert resp.status_code == 422
    assert "rtn" in resp.json()["error"]["fields"]


def test_hospital_name_cannot_be_blank(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("admin")
    assert client.put("/api/settings", json={"hospital_name": "   "}).status_code == 422


def test_default_tax_rate_not_settable_via_put(
    client: TestClient, login_as: Callable[..., User]
) -> None:
    login_as("admin")
    resp = client.put("/api/settings", json={"default_tax_rate_bp": 1800})
    assert resp.status_code == 422


def test_upload_png_logo_and_public_branding(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    login_as("admin")
    resp = client.post("/api/settings/logo", files={"file": ("logo.png", PNG, "image/png")})
    assert resp.status_code == 200, resp.text
    assert resp.json()["has_logo"] is True
    assert resp.json()["logo_mime"] == "image/png"
    logo = client.get("/api/branding/logo")
    assert logo.status_code == 200
    assert logo.content == PNG
    assert audit_count(db, "settings.logo_updated") == 1


def test_upload_jpeg_logo_detects_type_by_content(
    client: TestClient, login_as: Callable[..., User]
) -> None:
    login_as("admin")
    resp = client.post("/api/settings/logo", files={"file": ("x.bin", JPEG, "text/plain")})
    assert resp.status_code == 200
    assert resp.json()["logo_mime"] == "image/jpeg"


def test_upload_rejects_non_image(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("admin")
    resp = client.post("/api/settings/logo",
                       files={"file": ("x.png", b"GIF89a....", "image/png")})
    assert resp.status_code == 422
    assert "file" in resp.json()["error"]["fields"]


def test_upload_rejects_large_file(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("admin")
    big = PNG + b"\x00" * (2 * 1024 * 1024)
    resp = client.post("/api/settings/logo", files={"file": ("big.png", big, "image/png")})
    assert resp.status_code == 422
    assert "2 MB" in resp.json()["error"]["fields"]["file"]


def test_delete_logo(client: TestClient, db: Session, login_as: Callable[..., User]) -> None:
    login_as("admin")
    client.post("/api/settings/logo", files={"file": ("logo.png", PNG, "image/png")})
    resp = client.delete("/api/settings/logo")
    assert resp.status_code == 200
    assert resp.json()["has_logo"] is False
    assert client.get("/api/branding/logo").status_code == 404
    assert audit_count(db, "settings.logo_deleted") == 1
    # Deleting again is a no-op.
    assert client.delete("/api/settings/logo").status_code == 200
    assert audit_count(db, "settings.logo_deleted") == 1


def test_settings_require_login(client: TestClient) -> None:
    assert client.get("/api/settings").status_code == 401
    assert error_code(client.get("/api/settings")) == "unauthenticated"
