"""Tax rates: CRUD, default sync, delete-in-use protection."""

from __future__ import annotations

from collections.abc import Callable

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Setting, TaxRate, User
from tests.factories import isv_rate, make_service
from tests.factories_admin import REASON, audits, error_code, make_tax_rate


def _default_bp(db: Session) -> int:
    db.expire_all()
    s = db.get(Setting, 1)
    assert s is not None
    return s.default_tax_rate_bp


def _defaults(db: Session) -> list[str]:
    db.expire_all()
    return list(db.scalars(select(TaxRate.name).where(TaxRate.is_default.is_(True))))


def test_list_tax_rates(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("auditor")
    resp = client.get("/api/tax-rates")
    assert resp.status_code == 200
    items = {i["name"]: i for i in resp.json()["items"]}
    assert items["ISV 15 %"]["rate_bp"] == 1500
    assert items["ISV 15 %"]["is_default"] is True
    assert items["ISV 15 %"]["services_count"] > 0
    assert items["Exento 0 %"]["rate_bp"] == 0


def test_cajero_cannot_list(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("cajero")
    assert client.get("/api/tax-rates").status_code == 403


def test_create_tax_rate(client: TestClient, db: Session, login_as: Callable[..., User]) -> None:
    login_as("admin")
    resp = client.post("/api/tax-rates", json={"name": "ISV 18 %", "rate_bp": 1800})
    assert resp.status_code == 201, resp.text
    assert resp.json()["is_default"] is False
    assert resp.json()["services_count"] == 0
    assert len(audits(db, "tax_rate.created")) == 1
    assert _default_bp(db) == 1500


def test_create_validates_rate_range(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("admin")
    assert client.post("/api/tax-rates", json={"name": "X", "rate_bp": 10000}).status_code == 422
    assert client.post("/api/tax-rates", json={"name": "X", "rate_bp": -1}).status_code == 422


def test_create_duplicate_name(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("admin")
    resp = client.post("/api/tax-rates", json={"name": "isv 15 %", "rate_bp": 1500})
    assert resp.status_code == 409


def test_create_default_syncs_settings(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    login_as("admin")
    resp = client.post("/api/tax-rates", json={"name": "ISV 18 %", "rate_bp": 1800,
                                               "is_default": True})
    assert resp.status_code == 201
    assert _defaults(db) == ["ISV 18 %"]
    assert _default_bp(db) == 1800


def test_patch_requires_reason(client: TestClient, db: Session, login_as: Callable[..., User]
                               ) -> None:
    login_as("admin")
    rate = isv_rate(db)
    resp = client.patch(f"/api/tax-rates/{rate.id}", json={"rate_bp": 1600})
    assert resp.status_code == 422


def test_patch_default_rate_syncs_settings(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    login_as("admin")
    rate = isv_rate(db)
    resp = client.patch(f"/api/tax-rates/{rate.id}", json={"rate_bp": 1600, "reason": REASON})
    assert resp.status_code == 200, resp.text
    assert resp.json()["rate_bp"] == 1600
    assert _default_bp(db) == 1600
    rows = audits(db, "tax_rate.updated")
    assert rows[-1].old_values == {"rate_bp": 1500}
    assert rows[-1].new_values == {"rate_bp": 1600}
    assert rows[-1].reason == REASON


def test_switch_default(client: TestClient, db: Session, login_as: Callable[..., User]) -> None:
    other = make_tax_rate(db, "ISV 18 %", 1800)
    login_as("admin")
    resp = client.patch(f"/api/tax-rates/{other.id}", json={"is_default": True,
                                                             "reason": REASON})
    assert resp.status_code == 200
    assert _defaults(db) == ["ISV 18 %"]
    assert _default_bp(db) == 1800
    listed = {i["name"]: i["is_default"] for i in client.get("/api/tax-rates").json()["items"]}
    assert listed["ISV 15 %"] is False and listed["ISV 18 %"] is True


def test_cannot_unset_default(client: TestClient, db: Session, login_as: Callable[..., User]
                              ) -> None:
    login_as("admin")
    rate = isv_rate(db)
    resp = client.patch(f"/api/tax-rates/{rate.id}", json={"is_default": False,
                                                            "reason": REASON})
    assert resp.status_code == 400
    assert error_code(resp) == "tax_rate_default_required"


def test_cannot_deactivate_rate_in_use(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    other = make_tax_rate(db, "ISV 18 %", 1800)
    svc = make_service(db, taxable=False)
    svc.tax_rate_id = other.id
    db.commit()
    login_as("admin")
    resp = client.patch(f"/api/tax-rates/{other.id}", json={"active": False, "reason": REASON})
    assert resp.status_code == 400
    assert error_code(resp) == "tax_rate_in_use"


def test_delete_blocked_when_in_use(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    other = make_tax_rate(db, "ISV 18 %", 1800)
    svc = make_service(db, taxable=False)
    svc.tax_rate_id = other.id
    db.commit()
    login_as("admin")
    resp = client.request("DELETE", f"/api/tax-rates/{other.id}", json={"reason": REASON})
    assert resp.status_code == 400
    assert error_code(resp) == "tax_rate_in_use"


def test_delete_blocked_for_default(
    client: TestClient, db: Session, login_as: Callable[..., User]
) -> None:
    login_as("admin")
    resp = client.request("DELETE", f"/api/tax-rates/{isv_rate(db).id}", json={"reason": REASON})
    assert resp.status_code == 400
    assert error_code(resp) == "tax_rate_is_default"


def test_delete_unused_rate(client: TestClient, db: Session, login_as: Callable[..., User]
                            ) -> None:
    rate_id = make_tax_rate(db, "ISV 18 %", 1800).id
    login_as("admin")
    resp = client.request("DELETE", f"/api/tax-rates/{rate_id}", json={"reason": "abc"})
    assert resp.status_code == 422
    resp = client.request("DELETE", f"/api/tax-rates/{rate_id}", json={"reason": REASON})
    assert resp.status_code == 204
    db.expire_all()
    assert db.get(TaxRate, rate_id) is None
    assert len(audits(db, "tax_rate.deleted")) == 1


def test_supervisor_cannot_modify_tax(client: TestClient, db: Session,
                                      login_as: Callable[..., User]) -> None:
    login_as("supervisor")
    resp = client.patch(f"/api/tax-rates/{isv_rate(db).id}", json={"rate_bp": 1, "reason": REASON})
    assert resp.status_code == 403
