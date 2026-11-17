"""Fiscal sequences (CAI) rules (SPEC §5 / §6)."""

from __future__ import annotations

from collections.abc import Callable
from datetime import timedelta
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.timeutil import hn_today
from app.models import FiscalSequence, User
from tests.factories import make_fiscal_sequence
from tests.factories_admin import REASON, audits, error_code


def _payload(**over: Any) -> dict[str, Any]:
    data: dict[str, Any] = {
        "prefix": "000-001-01",
        "cai": "ABC123-DEF456-7890",
        "min_number": 1,
        "max_number": 5000,
        "valid_until": (hn_today() + timedelta(days=90)).isoformat(),
    }
    data.update(over)
    return data


def _active_ids(db: Session) -> list[int]:
    db.expire_all()
    return list(db.scalars(select(FiscalSequence.id).where(FiscalSequence.active.is_(True))))


def test_create_defaults_and_shape(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    login_as("admin")
    resp = client.post("/api/fiscal-sequences", json=_payload())
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["current_number"] == 0
    assert body["next_number"] == 1
    assert body["next_number_formatted"] == "000-001-01-00000001"
    assert body["remaining"] == 5000
    assert body["active"] is True
    assert body["expired"] is False and body["exhausted"] is False
    assert body["low_range"] is False
    assert len(audits(db, "fiscal_sequence.created")) == 1


def test_list_requires_settings_view(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("cajero")
    assert client.get("/api/fiscal-sequences").status_code == 403


def test_list_envelope(client: TestClient, db: Session, login_as: Callable[..., User]) -> None:
    make_fiscal_sequence(db)
    login_as("auditor")
    resp = client.get("/api/fiscal-sequences")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1 and body["page"] == 1
    assert body["items"][0]["cai"] == "TEST-CAI-0000"


def test_auditor_cannot_create(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("auditor")
    assert client.post("/api/fiscal-sequences", json=_payload()).status_code == 403


def test_max_must_be_gte_min(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("admin")
    resp = client.post("/api/fiscal-sequences", json=_payload(min_number=100, max_number=50))
    assert resp.status_code == 422
    assert "max_number" in resp.json()["error"]["fields"]


def test_current_plus_one_must_be_in_range(
    client: TestClient, login_as: Callable[..., User]
) -> None:
    login_as("admin")
    resp = client.post("/api/fiscal-sequences",
                       json=_payload(min_number=10, max_number=20, current_number=20))
    assert resp.status_code == 422
    assert "current_number" in resp.json()["error"]["fields"]
    resp = client.post("/api/fiscal-sequences",
                       json=_payload(min_number=10, max_number=20, current_number=5))
    assert resp.status_code == 422
    ok = client.post("/api/fiscal-sequences",
                     json=_payload(min_number=10, max_number=20, current_number=19))
    assert ok.status_code == 201
    assert ok.json()["next_number"] == 20
    assert ok.json()["low_range"] is True


def test_valid_until_cannot_be_past(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("admin")
    yesterday = (hn_today() - timedelta(days=1)).isoformat()
    resp = client.post("/api/fiscal-sequences", json=_payload(valid_until=yesterday))
    assert resp.status_code == 422
    assert "valid_until" in resp.json()["error"]["fields"]
    today = client.post("/api/fiscal-sequences", json=_payload(valid_until=hn_today().isoformat()))
    assert today.status_code == 201


def test_blank_cai_rejected(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("admin")
    assert client.post("/api/fiscal-sequences", json=_payload(cai="  ")).status_code == 422


def test_only_one_active(client: TestClient, db: Session, login_as: Callable[..., User]) -> None:
    first = make_fiscal_sequence(db)
    login_as("admin")
    resp = client.post("/api/fiscal-sequences", json=_payload(prefix="000-002-01"))
    assert resp.status_code == 201
    new_id = resp.json()["id"]
    assert _active_ids(db) == [new_id]
    # Re-activate the first one: the second is deactivated.
    resp = client.patch(f"/api/fiscal-sequences/{first.id}", json={"active": True,
                                                                     "reason": REASON})
    assert resp.status_code == 200, resp.text
    assert _active_ids(db) == [first.id]


def test_create_inactive(client: TestClient, db: Session, login_as: Callable[..., User]) -> None:
    first = make_fiscal_sequence(db)
    login_as("admin")
    resp = client.post("/api/fiscal-sequences", json=_payload(active=False))
    assert resp.status_code == 201
    assert resp.json()["active"] is False
    assert _active_ids(db) == [first.id]


def test_patch_requires_reason(client: TestClient, db: Session, login_as: Callable[..., User]
                               ) -> None:
    seq = make_fiscal_sequence(db)
    login_as("admin")
    resp = client.patch(f"/api/fiscal-sequences/{seq.id}", json={"cai": "NUEVO-CAI"})
    assert resp.status_code == 422
    assert "reason" in resp.json()["error"]["fields"]
    resp = client.patch(f"/api/fiscal-sequences/{seq.id}", json={"cai": "NUEVO-CAI",
                                                                  "reason": "abc"})
    assert resp.status_code == 422


def test_patch_cai_audited(client: TestClient, db: Session, login_as: Callable[..., User]) -> None:
    seq = make_fiscal_sequence(db)
    login_as("admin")
    resp = client.patch(f"/api/fiscal-sequences/{seq.id}",
                        json={"cai": "NUEVO-CAI-2027", "reason": REASON})
    assert resp.status_code == 200
    assert resp.json()["cai"] == "NUEVO-CAI-2027"
    rows = audits(db, "fiscal_sequence.updated")
    assert len(rows) == 1
    assert rows[0].reason == REASON
    assert rows[0].old_values == {"cai": "TEST-CAI-0000"}
    assert rows[0].new_values == {"cai": "NUEVO-CAI-2027"}


def test_current_never_decreases(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    seq = make_fiscal_sequence(db, current_number=50)
    login_as("admin")
    resp = client.patch(f"/api/fiscal-sequences/{seq.id}",
                        json={"current_number": 49, "reason": REASON})
    assert resp.status_code == 400
    assert error_code(resp) == "fiscal_current_decrease"
    resp = client.patch(f"/api/fiscal-sequences/{seq.id}",
                        json={"current_number": 60, "reason": REASON})
    assert resp.status_code == 200
    assert resp.json()["next_number"] == 61


def test_patch_range_revalidated(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    seq = make_fiscal_sequence(db, current_number=50, max_number=100)
    login_as("admin")
    resp = client.patch(f"/api/fiscal-sequences/{seq.id}",
                        json={"max_number": 50, "reason": REASON})
    assert resp.status_code == 422
    resp = client.patch(f"/api/fiscal-sequences/{seq.id}",
                        json={"min_number": 200, "reason": REASON})
    assert resp.status_code == 422


def test_patch_valid_until_past_rejected(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    seq = make_fiscal_sequence(db)
    login_as("admin")
    resp = client.patch(f"/api/fiscal-sequences/{seq.id}", json={
        "valid_until": (hn_today() - timedelta(days=2)).isoformat(), "reason": REASON})
    assert resp.status_code == 422


def test_cannot_activate_expired(client: TestClient, db: Session, login_as: Callable[..., User]
                                 ) -> None:
    old = make_fiscal_sequence(db, valid_until=hn_today() - timedelta(days=1), active=False)
    login_as("admin")
    resp = client.patch(f"/api/fiscal-sequences/{old.id}", json={"active": True,
                                                                   "reason": REASON})
    assert resp.status_code == 400
    assert error_code(resp) == "fiscal_sequence_expired"


def test_expired_flag_in_listing(client: TestClient, db: Session, login_as: Callable[..., User]
                                 ) -> None:
    make_fiscal_sequence(db, valid_until=hn_today() - timedelta(days=1))
    login_as("admin")
    item = client.get("/api/fiscal-sequences").json()["items"][0]
    assert item["expired"] is True


def test_deactivate(client: TestClient, db: Session, login_as: Callable[..., User]) -> None:
    seq = make_fiscal_sequence(db)
    login_as("admin")
    resp = client.patch(f"/api/fiscal-sequences/{seq.id}", json={"active": False,
                                                                   "reason": REASON})
    assert resp.status_code == 200
    assert _active_ids(db) == []


def test_patch_unknown_404(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("admin")
    resp = client.patch("/api/fiscal-sequences/9999", json={"cai": "X", "reason": REASON})
    assert resp.status_code == 404
