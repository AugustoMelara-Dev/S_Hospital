"""Audit log listing/filters and system status."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.timeutil import hn_today
from tests.factories import make_user


def seed_logs(db: Session) -> tuple[Any, Any]:
    ana = make_user(db, "cajero", name="Ana Cajera")
    beto = make_user(db, "supervisor", name="Beto Supervisor")
    audit(db, ana, "receipt.reprinted", entity=("institutional_receipts", 5),
          reason="Paciente extravió copia")
    audit(db, ana, "cash.opened", entity=("cash_sessions", 1))
    audit(db, beto, "invoice.voided", entity=("invoices", 9), reason="Error de digitación",
          result="success")
    audit(db, None, "auth.login", result="failed", reason="credenciales")
    old = audit(db, beto, "receipt.printed", entity=("institutional_receipts", 6))
    old.created_at = datetime.now(UTC) - timedelta(days=10)
    db.commit()
    return ana, beto


def test_audit_logs_filters(db: Session, client: Any, login_as: Any) -> None:
    _ana, beto = seed_logs(db)
    login_as("auditor")
    r = client.get("/api/audit-logs")
    assert r.status_code == 200, r.text
    data = r.json()
    assert {"items", "page", "per_page", "total"} <= set(data)
    actions = [i["action"] for i in data["items"]]
    assert "receipt.reprinted" in actions and "auth.login" in actions
    assert data["items"][0]["id"] > data["items"][-1]["id"]  # newest first
    first = next(i for i in data["items"] if i["action"] == "receipt.reprinted")
    assert first["user_name"] == "Ana Cajera" and first["entity_id"] == 5
    assert first["created_at"].endswith("-06:00")

    def actions_for(query: str) -> set[str]:
        resp = client.get(f"/api/audit-logs?{query}")
        assert resp.status_code == 200, resp.text
        return {i["action"] for i in resp.json()["items"]}

    assert actions_for("action=receipt") == {"receipt.reprinted", "receipt.printed"}
    assert actions_for("action=cash.opened") == {"cash.opened"}
    assert actions_for(f"user_id={beto.id}") == {"invoice.voided", "receipt.printed"}
    assert actions_for("search=beto") == {"invoice.voided", "receipt.printed"}
    assert actions_for("search=digitaci") == {"invoice.voided"}
    assert actions_for("result=failed") == {"auth.login"}
    assert actions_for("entity_type=invoices&entity_id=9") == {"invoice.voided"}
    today = hn_today().isoformat()
    assert "receipt.printed" not in actions_for(f"date_from={today}&date_to={today}")
    old_day = (hn_today() - timedelta(days=10)).isoformat()
    assert actions_for(f"date_from={old_day}&date_to={old_day}") == {"receipt.printed"}

    page = client.get("/api/audit-logs?per_page=2&page=2").json()
    assert page["page"] == 2 and len(page["items"]) == 2 and page["total"] >= 6


def test_audit_logs_permission(client: Any, login_as: Any) -> None:
    login_as("cajero")
    assert client.get("/api/audit-logs").status_code == 403
    login_as("soporte")
    assert client.get("/api/audit-logs").status_code == 403


def test_system_status(client: Any, login_as: Any) -> None:
    login_as("cajero")
    assert client.get("/api/system/status").status_code == 403
    login_as("soporte")
    r = client.get("/api/system/status")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["version"]
    assert data["database"]["dialect"] == "sqlite"
    assert data["database"]["migration"] is None  # test DBs are built with create_all
    assert data["database"]["migration_head"]
    assert data["disk"]["free_bytes"] > 0
    assert data["backups"]["last_success"] is None
    assert data["counts"]["services_active"] > 0
    assert data["counts"]["users_active"] >= 2
    assert data["server_time"].endswith("-06:00")
