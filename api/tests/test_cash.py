"""HTTP tests: cash registers, sessions, reconciliation and closing (SPEC §5 rule 7)."""

from __future__ import annotations

from collections.abc import Callable
from datetime import timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.timeutil import hn_today
from app.models import AuditLog, CashMovement, CashRegister, CashSession, User
from tests.conftest import login
from tests.factories import make_fiscal_sequence, make_service, make_user, update_settings
from tests.factories_billing import (
    create_invoice,
    err,
    ipost,
    ok,
    open_session_new_register,
    pay,
    set_series_active,
    setup_cashier,
)

LoginAs = Callable[..., User]


@pytest.fixture(autouse=True)
def fiscal(db: Session) -> None:
    make_fiscal_sequence(db)


def _count(db: Session, model: type, *where: Any) -> int:
    db.expire_all()
    return db.scalar(select(func.count()).select_from(model).where(*where)) or 0


def _open(client: TestClient, body: dict[str, Any] | None = None, key: str | None = None) -> Any:
    return ipost(client, "/api/cash-sessions/open", body or {"opening_cents": 0}, key)


def _close(client: TestClient, sid: int, body: dict[str, Any], key: str | None = None) -> Any:
    return ipost(client, f"/api/cash-sessions/{sid}/close", body, key)


# --- registers / open ------------------------------------------------------------

def test_list_registers(client: TestClient, login_as: LoginAs) -> None:
    login_as("cajero")
    regs = ok(client.get("/api/cash-registers"))
    assert [(r["code"], r["name"], r["active"]) for r in regs] == [
        ("principal", "Caja principal", True)
    ]


def test_current_is_null_without_session(client: TestClient, login_as: LoginAs) -> None:
    login_as("cajero")
    resp = client.get("/api/cash-sessions/current")
    assert resp.status_code == 200
    assert resp.json() is None


def test_open_session_defaults_to_principal(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    user = login_as("cajero", name="Carla Cajera")
    s = ok(_open(client, {"opening_cents": 50_000, "notes": "Fondo"}), 201)
    assert s["status"] == "open"
    assert s["cash_register"]["code"] == "principal"
    assert s["cash_register"]["name"] == "Caja principal"
    assert s["user"] == {"id": user.id, "name": "Carla Cajera"}
    assert s["opening_cents"] == 50_000
    assert s["opening_notes"] == "Fondo"
    assert s["opened_at"].endswith("-06:00")
    assert s["reconciliation"]["expected_cash_cents"] == 50_000
    assert s["reconciliation"]["can_close"] is True
    cur = ok(client.get("/api/cash-sessions/current"))
    assert cur["id"] == s["id"]
    assert set(cur["reconciliation"]) == {
        "opening_cents", "expected_cash_cents", "method_totals", "payments_count",
        "payments_total_cents", "pending_count", "pending_cents", "missing_receipts_count",
        "can_close", "blockers",
    }
    movs = db.scalars(select(CashMovement)).all()
    assert [(m.type, m.amount_cents) for m in movs] == [("opening", 50_000)]
    assert _count(db, AuditLog, AuditLog.action == "cash.opened") == 1


def test_open_validation_and_permissions(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    login_as("auditor")
    err(_open(client), 403, "forbidden")
    login_as("cajero")
    err(_open(client, {"opening_cents": -1}), 422)
    err(_open(client, {"opening_cents": 0, "cash_register_id": 999}), 404,
        "cash_register_not_found")
    reg = CashRegister(code="vieja", name="Caja vieja", active=False)
    db.add(reg)
    db.commit()
    err(_open(client, {"opening_cents": 0, "cash_register_id": reg.id}), 400,
        "cash_register_inactive")


def test_one_open_session_per_user_and_per_register(
    client: TestClient, db: Session, login_as: LoginAs, make_client: Callable[[], TestClient]
) -> None:
    login_as("cajero")
    ok(_open(client), 201)
    body = err(_open(client), 409, "cash_session_already_open")
    assert "ya tiene una caja abierta" in body["message"]

    other = make_user(db, "cajero")
    c2 = make_client()
    assert login(c2, other.username).status_code == 200
    body = err(_open(c2), 409, "cash_register_busy")
    assert "Caja principal" in body["message"]
    reg2 = CashRegister(code="caja2", name="Caja 2", active=True)
    db.add(reg2)
    db.commit()
    s2 = ok(_open(c2, {"opening_cents": 0, "cash_register_id": reg2.id}), 201)
    assert s2["cash_register"]["code"] == "caja2"


def test_open_idempotent_replay(client: TestClient, db: Session, login_as: LoginAs) -> None:
    login_as("cajero")
    a = _open(client, {"opening_cents": 100}, key="abrir-1")
    b = _open(client, {"opening_cents": 100}, key="abrir-1")
    assert a.status_code == b.status_code == 201
    assert b.headers.get("Idempotent-Replay") == "true"
    assert _count(db, CashSession) == 1
    assert _count(db, CashMovement) == 1


# --- reconciliation / close --------------------------------------------------------

def test_reconciliation_and_close_blocked_by_pending_invoice(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    _, session = setup_cashier(db, login_as, opening_cents=20_000)
    svc = make_service(db, price_cents=10_000)
    paid = ok(create_invoice(client, [svc.id]), 201)
    ok(pay(client, paid["id"], 11_500, received=20_000), 201)
    card = ok(create_invoice(client, [svc.id]), 201)
    ok(pay(client, card["id"], 11_500, method="card", reference="POS-1"), 201)
    pending = ok(create_invoice(client, [svc.id]), 201)

    rec = ok(client.get("/api/cash-sessions/current"))["reconciliation"]
    assert rec["opening_cents"] == 20_000
    assert rec["expected_cash_cents"] == 31_500  # change is not counted
    assert rec["method_totals"] == {"cash": 11_500, "transfer": 0, "card": 11_500, "other": 0}
    assert rec["payments_count"] == 2
    assert rec["payments_total_cents"] == 23_000
    assert rec["pending_count"] == 1
    assert rec["pending_cents"] == 11_500
    assert rec["missing_receipts_count"] == 0
    assert rec["can_close"] is False
    assert [b["code"] for b in rec["blockers"]] == ["pending_invoices"]
    assert rec["blockers"][0]["count"] == 1

    err(_close(client, session.id, {"counted_cents": 31_500}), 400, "cash_close_blocked")
    ok(pay(client, pending["id"], 11_500), 201)
    closed = ok(_close(client, session.id, {"counted_cents": 43_000}))
    assert closed["status"] == "closed"
    assert closed["expected_cash_cents"] == 43_000
    assert closed["difference_cents"] == 0
    assert closed["method_totals"]["card"] == 11_500
    assert closed["payments_count"] == 3
    assert closed["payments_total_cents"] == 34_500
    assert closed["closed_by"]["id"] == session.user_id
    assert [m["type"] for m in closed["movements"]] == [
        "payment", "payment", "payment", "closing"
    ]  # opening inserted directly by the factory has no movement
    assert closed["movements"][0]["invoice_number"] == paid["number"]
    assert ok(client.get("/api/cash-sessions/current")) is None


def test_close_blocked_by_missing_receipt(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    _, session = setup_cashier(db, login_as)
    svc = make_service(db)
    inv = ok(create_invoice(client, [svc.id]), 201)
    set_series_active(db, False)
    ok(pay(client, inv["id"], 11_500), 201)
    body = err(_close(client, session.id, {"counted_cents": 11_500}), 400, "cash_close_blocked")
    assert "recibo" in body["message"]
    set_series_active(db, True)
    ok(ipost(client, f"/api/invoices/{inv['id']}/receipt"), 201)
    ok(_close(client, session.id, {"counted_cents": 11_500}))


def test_close_difference_requires_note(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    login_as("cajero")
    s = ok(_open(client, {"opening_cents": 10_000}), 201)
    body = err(_close(client, s["id"], {"counted_cents": 9_000}), 422, "closing_note_required")
    assert "notes" in body["fields"]
    err(_close(client, s["id"], {"counted_cents": 9_000, "notes": "nop"}), 422)
    closed = ok(_close(client, s["id"], {"counted_cents": 9_000, "notes": "Faltan 10 lempiras"}))
    assert closed["difference_cents"] == -1_000
    assert closed["closing_notes"] == "Faltan 10 lempiras"
    assert _count(db, AuditLog, AuditLog.action == "cash.closed") == 1
    err(_close(client, s["id"], {"counted_cents": 9_000, "notes": "Otra vez cierre"}), 409,
        "cash_session_closed")


def test_close_with_breakdown(client: TestClient, db: Session, login_as: LoginAs) -> None:
    login_as("cajero")
    s = ok(_open(client, {"opening_cents": 73_250}), 201)
    bad = {"counted_cents": 73_250, "breakdown": {"bills": {"500": 1}, "coins_cents": 0}}
    err(_close(client, s["id"], bad), 422, "breakdown_mismatch")
    err(_close(client, s["id"], {"counted_cents": 73_250,
                                 "breakdown": {"bills": {"1000": 1}}}), 422)
    err(_close(client, s["id"], {"counted_cents": 73_250,
                                 "breakdown": {"bills": {"500": -1}}}), 422)
    good = {"counted_cents": 73_250,
            "breakdown": {"bills": {"500": 1, "200": 1, "20": 1, "10": 1, "2": 1},
                          "coins_cents": 50}}
    closed = ok(_close(client, s["id"], good))
    assert closed["closing_breakdown"]["bills"]["500"] == 1
    assert closed["closing_breakdown"]["bills"]["100"] == 0
    assert closed["closing_breakdown"]["coins_cents"] == 50
    assert closed["closing_breakdown"]["total_cents"] == 73_250


def test_close_other_users_session_requires_close_any(
    client: TestClient, db: Session, login_as: LoginAs, make_client: Callable[[], TestClient]
) -> None:
    owner = make_user(db, "cajero")
    sess = open_session_new_register(db, owner, opening_cents=0)
    login_as("cajero")
    err(_close(client, sess.id, {"counted_cents": 0}), 403, "forbidden")
    sup = make_user(db, "supervisor")
    c2 = make_client()
    assert login(c2, sup.username).status_code == 200
    closed = ok(_close(c2, sess.id, {"counted_cents": 0}))
    assert closed["closed_by"]["id"] == sup.id
    assert closed["user"]["id"] == owner.id
    err(_close(c2, 999_999, {"counted_cents": 0}), 404, "cash_session_not_found")


def test_auditor_cannot_close(client: TestClient, db: Session, login_as: LoginAs) -> None:
    owner = make_user(db, "cajero")
    sess = open_session_new_register(db, owner)
    login_as("auditor")
    err(_close(client, sess.id, {"counted_cents": 0}), 403, "forbidden")


def test_close_idempotent_replay(client: TestClient, db: Session, login_as: LoginAs) -> None:
    login_as("cajero")
    s = ok(_open(client, {"opening_cents": 0}), 201)
    a = _close(client, s["id"], {"counted_cents": 0}, key="cierre-1")
    b = _close(client, s["id"], {"counted_cents": 0}, key="cierre-1")
    assert a.status_code == b.status_code == 200
    assert b.headers.get("Idempotent-Replay") == "true"
    assert _count(db, CashMovement, CashMovement.type == "closing") == 1


# --- list / detail -------------------------------------------------------------------

def _closed_session(db: Session, user: User, difference: int) -> CashSession:
    sess = open_session_new_register(db, user)
    sess.counted_cents = 1_000 + difference
    sess.expected_cash_cents = 1_000
    sess.difference_cents = difference
    sess.mark_closed()
    db.commit()
    return sess


def test_list_sessions_filters_and_scope(
    client: TestClient, db: Session, login_as: LoginAs, make_client: Callable[[], TestClient]
) -> None:
    other = make_user(db, "cajero")
    balanced = _closed_session(db, other, 0)
    short = _closed_session(db, other, -500)
    over = _closed_session(db, other, 700)
    me, mine = setup_cashier(db, login_as)

    own = ok(client.get("/api/cash-sessions"))
    assert [s["id"] for s in own["items"]] == [mine.id]
    err(client.get(f"/api/cash-sessions/{balanced.id}"), 403)

    sup = make_user(db, "supervisor")
    c2 = make_client()
    assert login(c2, sup.username).status_code == 200
    assert ok(c2.get("/api/cash-sessions"))["total"] == 4

    def ids(**params: Any) -> set[int]:
        return {s["id"] for s in ok(c2.get("/api/cash-sessions", params=params))["items"]}

    assert ids(difference="balanced") == {balanced.id}
    assert ids(difference="shortage") == {short.id}
    assert ids(difference="overage") == {over.id}
    assert ids(difference="all") == {balanced.id, short.id, over.id, mine.id}
    assert ids(status="open") == {mine.id}
    assert ids(user_id=other.id) == {balanced.id, short.id, over.id}
    assert ids(cash_register_id=mine.cash_register_id) == {mine.id}
    today = hn_today().isoformat()
    assert len(ids(date_from=today, date_to=today)) == 4
    assert ids(date_to=(hn_today() - timedelta(days=1)).isoformat()) == set()
    err(c2.get("/api/cash-sessions", params={"difference": "x"}), 422)

    detail = ok(c2.get(f"/api/cash-sessions/{mine.id}"))
    assert detail["user"]["id"] == me.id
    assert detail["reconciliation"]["can_close"] is True
    assert detail["movements"] == []
    err(c2.get("/api/cash-sessions/999999"), 404, "cash_session_not_found")


def test_session_detail_has_movements(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    update_settings(db, partial_payments_enabled=False)
    login_as("cajero")
    s = ok(_open(client, {"opening_cents": 5_000}), 201)
    svc = make_service(db)
    inv = ok(create_invoice(client, [svc.id]), 201)
    ok(pay(client, inv["id"], 11_500, method="transfer", reference="TRX-77"), 201)
    detail = ok(client.get(f"/api/cash-sessions/{s['id']}"))
    movs = detail["movements"]
    assert [(m["type"], m["method"], m["amount_cents"]) for m in movs] == [
        ("opening", "cash", 5_000), ("payment", "transfer", 11_500)
    ]
    assert movs[1]["reference"] == "TRX-77"
    assert movs[1]["invoice_id"] == inv["id"]
    assert movs[1]["occurred_at"].endswith("-06:00")
    assert detail["reconciliation"]["expected_cash_cents"] == 5_000
