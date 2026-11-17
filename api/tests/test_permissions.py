from collections.abc import Callable
from datetime import timedelta
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.access import can_operate_invoice, can_view_any_invoices
from app.core.timeutil import now_utc
from app.models import User
from tests.factories import make_role, make_user

pytestmark = pytest.mark.usefixtures("app_with_probe")


def test_require_without_session_is_401(client: TestClient) -> None:
    assert client.get("/api/_probe/settings-update").status_code == 401


def test_require_forbidden(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("cajero")
    resp = client.get("/api/_probe/settings-update")
    assert resp.status_code == 403
    assert resp.json()["error"] == {
        "code": "forbidden",
        "message": "No tiene permiso para realizar esta acción.",
        "fields": {},
    }


def test_require_admin_has_everything(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("admin")
    assert client.get("/api/_probe/settings-update").status_code == 200
    assert client.get("/api/_probe/all-of").status_code == 200


def test_require_all_vs_any(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("cajero")  # has invoices.view + reports.own, not cash.close_any
    assert client.get("/api/_probe/all-of").status_code == 403
    assert client.get("/api/_probe/any-of").status_code == 200


def test_soporte_lacks_reports(client: TestClient, login_as: Callable[..., User]) -> None:
    login_as("soporte")
    assert client.get("/api/_probe/any-of").status_code == 403


def test_custom_role(client: TestClient, db: Session, login_as: Callable[..., User]) -> None:
    make_role(db, "contable", {"settings.update"})
    login_as("contable")
    assert client.get("/api/_probe/settings-update").status_code == 200
    me = client.get("/api/auth/me").json()
    assert me["permissions"] == ["settings.update"]


def test_access_rules(db: Session) -> None:
    cajero = make_user(db, "cajero")
    other = make_user(db, "cajero")
    supervisor = make_user(db, "supervisor")
    auditor = make_user(db, "auditor")

    today = SimpleNamespace(issued_by=cajero.id, issued_at=now_utc())
    yesterday = SimpleNamespace(issued_by=cajero.id, issued_at=now_utc() - timedelta(days=2))

    assert can_operate_invoice(cajero, today)
    assert not can_operate_invoice(cajero, yesterday)
    assert not can_operate_invoice(other, today)
    assert can_operate_invoice(supervisor, yesterday)
    assert not can_operate_invoice(auditor, today)

    assert not can_view_any_invoices(cajero)
    assert can_view_any_invoices(supervisor)
    assert can_view_any_invoices(auditor)
