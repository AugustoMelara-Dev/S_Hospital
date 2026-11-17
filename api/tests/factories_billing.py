"""HTTP helpers for billing/cash/payment tests."""

from __future__ import annotations

import uuid
from collections.abc import Callable
from typing import Any

from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ERYTHROPOIETIN_RULE, CashRegister, CashSession, ReceiptSeries, Service, User
from tests.factories import make_service, open_cash_session


def ipost(client: TestClient, url: str, json: Any = None, key: str | None = None) -> Response:
    """POST to an [IDEM] endpoint with a fresh (or given) Idempotency-Key."""
    return client.post(url, json=json, headers={"Idempotency-Key": key or uuid.uuid4().hex})


def create_invoice(
    client: TestClient,
    items: list[tuple[int, int]] | list[int],
    *,
    patient: str = "Juan Pérez",
    dialysis: bool = False,
    key: str | None = None,
) -> Response:
    norm = [(it, 100) if isinstance(it, int) else it for it in items]
    body = {
        "patient_name": patient,
        "items": [{"service_id": sid, "quantity_hundredths": q} for sid, q in norm],
        "dialysis_prescription": dialysis,
    }
    return ipost(client, "/api/invoices", body, key)


def pay(
    client: TestClient,
    invoice_id: int,
    amount: int,
    *,
    method: str = "cash",
    received: int | None = None,
    reference: str = "",
    key: str | None = None,
) -> Response:
    body: dict[str, Any] = {"method": method, "amount_cents": amount, "reference": reference}
    if received is not None:
        body["received_cents"] = received
    return ipost(client, f"/api/invoices/{invoice_id}/payments", body, key)


def ok(resp: Response, status: int = 200) -> Any:
    assert resp.status_code == status, resp.text
    return resp.json()


def err(resp: Response, status: int, code: str | None = None) -> dict[str, Any]:
    assert resp.status_code == status, resp.text
    body = resp.json()["error"]
    if code is not None:
        assert body["code"] == code, body
    return body


def setup_cashier(
    db: Session, login_as: Callable[..., User], role: str = "cajero", opening_cents: int = 0,
    **user_kwargs: Any,
) -> tuple[User, CashSession]:
    """Log ``client`` in as a new user of ``role`` with an open cash session."""
    user = login_as(role, **user_kwargs)
    return user, open_cash_session(db, user, opening_cents=opening_cents)


def epo_service(db: Session, price_cents: int = 250_000, taxable: bool = False) -> Service:
    return make_service(
        db, name="Eritropoyetina prueba", price_cents=price_cents, taxable=taxable,
        special_rule_code=ERYTHROPOIETIN_RULE,
    )


def active_series(db: Session) -> ReceiptSeries:
    series = db.scalar(select(ReceiptSeries).where(ReceiptSeries.active.is_(True)))
    assert series is not None
    return series


def set_series_active(db: Session, active: bool) -> ReceiptSeries:
    series = db.scalar(select(ReceiptSeries).where(ReceiptSeries.series == "REC-A"))
    assert series is not None
    series.set_active(active)
    db.commit()
    return series


def open_session_new_register(db: Session, user: User, opening_cents: int = 0) -> CashSession:
    """Open a session for ``user`` on a brand-new register (the seed has only one)."""
    n = uuid.uuid4().hex[:8]
    reg = CashRegister(code=f"caja-{n}", name=f"Caja {n}", active=True)
    db.add(reg)
    db.flush()
    sess = CashSession(cash_register_id=reg.id, user_id=user.id, opening_cents=opening_cents)
    sess.mark_open()
    db.add(sess)
    db.commit()
    return sess
