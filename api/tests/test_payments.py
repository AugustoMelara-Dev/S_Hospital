"""HTTP tests: payments, automatic receipts, void and reverse (SPEC §5 rules 4–6, 8)."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AuditLog,
    CashMovement,
    CashSession,
    FiscalSequence,
    InstitutionalReceipt,
    Invoice,
    Payment,
    ReceiptSeries,
    User,
)
from tests.conftest import login
from tests.factories import (
    make_fiscal_sequence,
    make_role,
    make_service,
    make_user,
    update_settings,
)
from tests.factories_billing import (
    create_invoice,
    epo_service,
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
def fiscal(db: Session) -> FiscalSequence:
    update_settings(db, hospital_name="Hospital Escuela", rtn="08019999000001",
                    government_line="Gobierno de la República",
                    secretariat_line="Secretaría de Salud",
                    receipt_location="Tegucigalpa, M.D.C.", receipt_footer_text="Gracias")
    return make_fiscal_sequence(db, cai="CAI-ABC-123")


def _count(db: Session, model: type, *where: Any) -> int:
    db.expire_all()
    return db.scalar(select(func.count()).select_from(model).where(*where)) or 0


def _invoice(client: TestClient, db: Session, price: int = 10_000, **kw: Any) -> dict[str, Any]:
    svc = make_service(db, price_cents=price, **kw)
    return ok(create_invoice(client, [svc.id]), 201)


# --- payment basics -------------------------------------------------------------

def test_full_cash_payment_with_change_issues_receipt(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    user, session = setup_cashier(db, login_as, opening_cents=50_000, name="Carla Cajera")
    inv = _invoice(client, db, price=100_000)  # total 115,000
    res = ok(pay(client, inv["id"], 115_000, received=120_000), 201)
    assert set(res) == {"invoice", "payment", "receipt", "receipt_error"}
    p = res["payment"]
    assert p["method"] == "cash"
    assert (p["amount_cents"], p["received_cents"], p["change_cents"]) == (115_000, 120_000, 5_000)
    assert p["status"] == "posted"
    assert p["cash_session_id"] == session.id
    assert p["user"] == {"id": user.id, "name": "Carla Cajera"}
    assert res["invoice"]["status"] == "paid"
    assert res["invoice"]["settlement"] == "paid"
    assert res["invoice"]["paid_cents"] == 115_000
    assert res["invoice"]["balance_cents"] == 0
    assert res["receipt"] == {"id": res["receipt"]["id"], "number_full": "REC-A-00000001",
                              "status": "issued", "reprint_count": 0}
    assert res["receipt_error"] is None
    assert res["invoice"]["actions"]["can_reprint"] is True
    assert res["invoice"]["actions"]["can_pay"] is False

    mov = db.scalars(select(CashMovement).where(CashMovement.type == "payment")).all()
    assert [(m.amount_cents, m.method, m.cash_session_id) for m in mov] == [
        (115_000, "cash", session.id)
    ]
    assert _count(db, AuditLog, AuditLog.action == "payment.created") == 1
    assert _count(db, AuditLog, AuditLog.action == "receipt.issued") == 1


def test_receipt_snapshot_structure(client: TestClient, db: Session, login_as: LoginAs) -> None:
    user, session = setup_cashier(db, login_as, name="Carla Cajera")
    epo = epo_service(db, price_cents=80_000)
    lab = make_service(db, name="Hemograma", price_cents=123_400, taxable=False)
    inv = ok(create_invoice(client, [epo.id, (lab.id, 100)], patient="Rosa Díaz",
                            dialysis=True), 201)
    assert inv["total_cents"] == 123_400
    ok(pay(client, inv["id"], 123_400, method="card", reference="VISA-7781"), 201)
    rec = db.scalar(select(InstitutionalReceipt))
    assert rec is not None
    assert rec.number_full == "REC-A-00000001"
    assert rec.amount_cents == 123_400
    assert rec.amount_words == "UN MIL DOSCIENTOS TREINTA Y CUATRO LEMPIRAS CON 00/100"
    assert rec.payer_name == "Rosa Díaz"
    assert rec.cash_session_id == session.id
    s = rec.snapshot
    assert s["version"] == 1
    assert s["receipt"]["number_full"] == "REC-A-00000001"
    assert s["receipt"]["amount_words"] == rec.amount_words
    assert s["receipt"]["issued_at"].endswith("-06:00")
    assert s["series"]["number_color"] == "#b91c1c"
    assert s["series"]["legal_text"]
    assert s["institution"] == {
        "hospital_name": "Hospital Escuela", "rtn": "08019999000001", "address": "",
        "phone": "", "government_line": "Gobierno de la República",
        "secretariat_line": "Secretaría de Salud", "receipt_location": "Tegucigalpa, M.D.C.",
        "receipt_footer_text": "Gracias",
    }
    assert s["fiscal"]["cai"] == "CAI-ABC-123"
    assert s["fiscal"]["range_from"] == "000-001-01-00000001"
    assert s["fiscal"]["valid_until"]
    assert s["invoice"]["number"] == inv["number"]
    assert s["invoice"]["patient_name"] == "Rosa Díaz"
    assert s["invoice"]["cashier_name"] == "Carla Cajera"
    assert s["invoice"]["register_name"] == "Caja principal"
    assert s["patient"] == {"name": "Rosa Díaz"}
    assert s["cashier"] == {"id": user.id, "name": "Carla Cajera"}
    assert s["cash_register"]["name"] == "Caja principal"
    assert [i["name"] for i in s["items"]] == ["Eritropoyetina prueba", "Hemograma"]
    assert s["items"][0]["special_rule_applied"] is True
    assert s["items"][0]["unit_price_registered_cents"] == 80_000
    assert s["items"][0]["rule_adjustment_cents"] == 80_000
    assert s["items"][0]["line_total_cents"] == 0
    assert s["totals"]["total_cents"] == 123_400
    assert s["totals"]["paid_cents"] == 123_400
    assert s["totals"]["balance_cents"] == 0
    assert s["totals"]["rule_adjustment_cents"] == 80_000
    assert s["totals"]["tax_breakdown"][-1]["label"] == "Exento"
    assert s["payments"] == [{
        "id": s["payments"][0]["id"], "method": "card", "method_label": "Tarjeta",
        "reference": "VISA-7781", "amount_cents": 123_400, "received_cents": None,
        "change_cents": None, "paid_at": s["payments"][0]["paid_at"], "status": "posted",
    }]


def test_cash_without_received_defaults_to_exact(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    setup_cashier(db, login_as)
    inv = _invoice(client, db)
    p = ok(pay(client, inv["id"], 11_500), 201)["payment"]
    assert (p["received_cents"], p["change_cents"]) == (11_500, 0)


def test_cash_received_less_than_amount(client: TestClient, db: Session, login_as: LoginAs) -> None:
    setup_cashier(db, login_as)
    inv = _invoice(client, db)
    body = err(pay(client, inv["id"], 11_500, received=10_000), 422, "insufficient_cash")
    assert body["message"] == "El monto recibido es menor que el total a cobrar."
    assert _count(db, Payment) == 0


@pytest.mark.parametrize("method", ["card", "transfer"])
def test_card_and_transfer_require_reference(
    client: TestClient, db: Session, login_as: LoginAs, method: str
) -> None:
    setup_cashier(db, login_as)
    inv = _invoice(client, db)
    body = err(pay(client, inv["id"], 11_500, method=method, reference="  "), 422,
               "reference_required")
    assert "reference" in body["fields"]
    p = ok(pay(client, inv["id"], 11_500, method=method, reference="REF-1",
               received=99_999), 201)["payment"]
    assert p["reference"] == "REF-1"
    assert p["received_cents"] is None and p["change_cents"] is None


def test_other_method_without_reference(client: TestClient, db: Session, login_as: LoginAs) -> None:
    setup_cashier(db, login_as)
    inv = _invoice(client, db)
    ok(pay(client, inv["id"], 11_500, method="other"), 201)


def test_invalid_payment_inputs(client: TestClient, db: Session, login_as: LoginAs) -> None:
    setup_cashier(db, login_as)
    inv = _invoice(client, db)
    err(pay(client, inv["id"], 0), 422)
    err(pay(client, inv["id"], 100, method="bitcoin"), 422)
    err(pay(client, 999_999, 100), 404, "invoice_not_found")


def test_overpayment_rejected(client: TestClient, db: Session, login_as: LoginAs) -> None:
    setup_cashier(db, login_as)
    inv = _invoice(client, db)
    err(pay(client, inv["id"], 11_501), 400, "payment_exceeds_balance")


def test_partial_payments_require_setting(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    setup_cashier(db, login_as)
    inv = _invoice(client, db)
    err(pay(client, inv["id"], 5_000), 400, "partial_payments_disabled")
    update_settings(db, partial_payments_enabled=True)
    first = ok(pay(client, inv["id"], 5_000), 201)
    assert first["invoice"]["status"] == "partial"
    assert first["invoice"]["balance_cents"] == 6_500
    assert first["receipt"] is None and first["receipt_error"] is None
    assert first["invoice"]["actions"]["can_pay"] is True
    err(pay(client, inv["id"], 6_501), 400, "payment_exceeds_balance")
    second = ok(pay(client, inv["id"], 6_500, method="transfer", reference="TR-9"), 201)
    assert second["invoice"]["status"] == "paid"
    assert second["receipt"]["number_full"] == "REC-A-00000001"
    rec = db.scalar(select(InstitutionalReceipt))
    assert rec is not None
    assert [p["amount_cents"] for p in rec.snapshot["payments"]] == [5_000, 6_500]


def test_cannot_pay_paid_or_void_invoice(
    client: TestClient, db: Session, login_as: LoginAs, make_client: Callable[[], TestClient]
) -> None:
    setup_cashier(db, login_as, "supervisor")
    inv = _invoice(client, db)
    ok(pay(client, inv["id"], 11_500), 201)
    err(pay(client, inv["id"], 100), 400, "invoice_already_paid")
    other = _invoice(client, db)
    ok(ipost(client, f"/api/invoices/{other['id']}/void", {"reason": "Error de captura"}))
    err(pay(client, other["id"], 11_500), 400, "invoice_void")


def test_payment_requires_own_open_session(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    _, session = setup_cashier(db, login_as)
    inv = _invoice(client, db)
    session.mark_closed()
    db.commit()
    err(pay(client, inv["id"], 11_500), 400, "cash_session_required")


def test_payment_requires_permission(
    client: TestClient, db: Session, login_as: LoginAs, make_client: Callable[[], TestClient]
) -> None:
    setup_cashier(db, login_as)
    inv = _invoice(client, db)
    auditor = make_user(db, "auditor")
    c2 = make_client()
    assert login(c2, auditor.username).status_code == 200
    err(pay(c2, inv["id"], 11_500), 403, "forbidden")


def test_supervisor_pays_cashier_invoice_in_own_session(
    client: TestClient, db: Session, login_as: LoginAs, make_client: Callable[[], TestClient]
) -> None:
    setup_cashier(db, login_as)
    inv = _invoice(client, db)
    sup = make_user(db, "supervisor")
    sup_session = open_session_new_register(db, sup)
    c2 = make_client()
    assert login(c2, sup.username).status_code == 200
    res = ok(pay(c2, inv["id"], 11_500), 201)
    assert res["payment"]["cash_session_id"] == sup_session.id
    assert res["receipt"]["number_full"] == "REC-A-00000001"


def test_idempotent_payment_replay_does_not_duplicate(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    update_settings(db, partial_payments_enabled=True)
    setup_cashier(db, login_as)
    inv = _invoice(client, db)
    first = pay(client, inv["id"], 5_000, key="pago-1")
    again = pay(client, inv["id"], 5_000, key="pago-1")
    assert first.status_code == again.status_code == 201
    assert again.headers.get("Idempotent-Replay") == "true"
    assert first.json() == again.json()
    assert _count(db, Payment) == 1
    assert _count(db, CashMovement, CashMovement.type == "payment") == 1
    row = db.get(Invoice, inv["id"])
    assert row is not None and row.paid_cents == 5_000
    err(pay(client, inv["id"], 6_000, key="pago-1"), 409, "idempotency_key_mismatch")


# --- automatic receipt -----------------------------------------------------------

def test_receipt_failure_keeps_payment_then_issue_missing_receipt(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    setup_cashier(db, login_as)
    inv = _invoice(client, db)
    set_series_active(db, False)
    res = ok(pay(client, inv["id"], 11_500), 201)
    assert res["receipt"] is None
    assert res["receipt_error"] == "No hay una serie de recibos activa."
    assert res["invoice"]["status"] == "paid"
    assert res["invoice"]["actions"]["can_issue_receipt"] is True
    assert _count(db, Payment) == 1
    assert _count(db, InstitutionalReceipt) == 0
    # missing receipt blocks closing
    cur = ok(client.get("/api/cash-sessions/current"))
    assert cur["reconciliation"]["missing_receipts_count"] == 1
    assert cur["reconciliation"]["can_close"] is False

    err(ipost(client, f"/api/invoices/{inv['id']}/receipt"), 400, "receipt_series_missing")
    set_series_active(db, True)
    fixed = ok(ipost(client, f"/api/invoices/{inv['id']}/receipt"), 201)
    assert fixed["receipt"]["number_full"] == "REC-A-00000001"
    err(ipost(client, f"/api/invoices/{inv['id']}/receipt"), 409, "receipt_already_issued")


def test_issue_receipt_rejects_unpaid_invoice(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    setup_cashier(db, login_as)
    inv = _invoice(client, db)
    err(ipost(client, f"/api/invoices/{inv['id']}/receipt"), 400, "invoice_not_paid")


def test_receipt_series_exhausted(client: TestClient, db: Session, login_as: LoginAs) -> None:
    setup_cashier(db, login_as)
    series = db.scalar(select(ReceiptSeries).where(ReceiptSeries.active.is_(True)))
    assert series is not None
    series.current_number = 5
    series.max_number = 6
    db.commit()
    a = _invoice(client, db)
    b = _invoice(client, db)
    assert ok(pay(client, a["id"], 11_500), 201)["receipt"]["number_full"] == "REC-A-00000006"
    res = ok(pay(client, b["id"], 11_500), 201)
    assert res["receipt"] is None
    assert "agotó" in res["receipt_error"]


def test_receipt_numbering_respects_min_and_is_sequential(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    setup_cashier(db, login_as)
    series = db.scalar(select(ReceiptSeries).where(ReceiptSeries.active.is_(True)))
    assert series is not None
    series.min_number = 100
    db.commit()
    numbers = []
    for _ in range(3):
        inv = _invoice(client, db)
        numbers.append(ok(pay(client, inv["id"], 11_500), 201)["receipt"]["number_full"])
    assert numbers == ["REC-A-00000100", "REC-A-00000101", "REC-A-00000102"]


# --- void ------------------------------------------------------------------------

def test_void_invoice_without_payments(client: TestClient, db: Session, login_as: LoginAs) -> None:
    user, _ = setup_cashier(db, login_as, "supervisor")
    inv = _invoice(client, db)
    err(ipost(client, f"/api/invoices/{inv['id']}/void", {"reason": "abc"}), 422)
    out = ok(ipost(client, f"/api/invoices/{inv['id']}/void", {"reason": "Paciente se retiró"}))
    assert out["status"] == "void"
    assert out["void_reason"] == "Paciente se retiró"
    assert out["voided_by"]["id"] == user.id
    assert out["voided_at"].endswith("-06:00")
    assert out["reversed"] is False
    assert out["actions"]["can_void"] is False
    assert _count(db, Invoice) == 1  # never deleted
    assert _count(db, AuditLog, AuditLog.action == "invoice.voided") == 1
    err(ipost(client, f"/api/invoices/{inv['id']}/void", {"reason": "Otra vez nada"}), 409,
        "invoice_already_void")


def test_void_requires_permission_and_no_payments(
    client: TestClient, db: Session, login_as: LoginAs, make_client: Callable[[], TestClient]
) -> None:
    setup_cashier(db, login_as)  # cajero: no invoices.void
    inv = _invoice(client, db)
    assert ok(client.get(f"/api/invoices/{inv['id']}"))["actions"]["can_void"] is False
    err(ipost(client, f"/api/invoices/{inv['id']}/void", {"reason": "Error de captura"}), 403,
        "forbidden")
    update_settings(db, partial_payments_enabled=True)
    ok(pay(client, inv["id"], 1_000), 201)
    sup = make_user(db, "supervisor")
    c2 = make_client()
    assert login(c2, sup.username).status_code == 200
    err(ipost(c2, f"/api/invoices/{inv['id']}/void", {"reason": "Error de captura"}), 400,
        "invoice_has_payments")


def test_cashier_role_with_void_can_void_own_invoice_today(
    client: TestClient, db: Session, login_as: LoginAs, make_client: Callable[[], TestClient]
) -> None:
    make_role(db, "cajero_plus", {"invoices.view", "invoices.create", "invoices.void",
                                  "payments.create", "cash.open"})
    setup_cashier(db, login_as, "cajero_plus")
    inv = _invoice(client, db)
    other_user = make_user(db, "cajero_plus")
    c2 = make_client()
    assert login(c2, other_user.username).status_code == 200
    err(ipost(c2, f"/api/invoices/{inv['id']}/void", {"reason": "Error de captura"}), 403,
        "cannot_operate_invoice")
    ok(ipost(client, f"/api/invoices/{inv['id']}/void", {"reason": "Error de captura"}))


def test_void_requires_invoice_session_open(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    _, session = setup_cashier(db, login_as, "supervisor")
    inv = _invoice(client, db)
    session.mark_closed()
    db.commit()
    err(ipost(client, f"/api/invoices/{inv['id']}/void", {"reason": "Error de captura"}), 400,
        "cash_session_closed")


def test_void_zero_total_invoice_voids_receipt(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    setup_cashier(db, login_as, "supervisor")
    inv = _invoice(client, db, price=0)
    assert inv["receipt"]["status"] == "issued"
    out = ok(ipost(client, f"/api/invoices/{inv['id']}/void", {"reason": "Error de captura"}))
    assert out["receipt"]["status"] == "void"


# --- reverse ---------------------------------------------------------------------

def test_reverse_paid_invoice(client: TestClient, db: Session, login_as: LoginAs) -> None:
    update_settings(db, partial_payments_enabled=True)
    _, session = setup_cashier(db, login_as, "supervisor", opening_cents=10_000)
    inv = _invoice(client, db)
    ok(pay(client, inv["id"], 6_500, received=7_000), 201)
    ok(pay(client, inv["id"], 5_000, method="card", reference="POS-1"), 201)
    before = ok(client.get("/api/cash-sessions/current"))["reconciliation"]
    assert before["expected_cash_cents"] == 16_500
    assert before["method_totals"] == {"cash": 6_500, "card": 5_000, "transfer": 0, "other": 0}

    err(ipost(client, f"/api/invoices/{inv['id']}/reverse", {"reason": "abc"}), 422)
    out = ok(ipost(client, f"/api/invoices/{inv['id']}/reverse",
                   {"reason": "Cobro duplicado"}, key="rev-1"))
    assert out["status"] == "void"
    assert out["reversed"] is True
    assert out["paid_cents"] == 0 and out["balance_cents"] == 0
    assert {p["status"] for p in out["payments"]} == {"void"}
    assert out["receipt"]["status"] == "void"
    assert all(out["actions"][k] is False for k in ("can_pay", "can_void", "can_reverse",
                                                    "can_reprint", "can_issue_receipt"))
    voids = db.scalars(select(CashMovement).where(CashMovement.type == "payment_void")).all()
    assert sorted((m.method, m.amount_cents) for m in voids) == [("card", -5_000),
                                                                ("cash", -6_500)]
    assert all(m.cash_session_id == session.id for m in voids)
    after = ok(client.get("/api/cash-sessions/current"))["reconciliation"]
    assert after["expected_cash_cents"] == 10_000
    assert after["payments_count"] == 0
    assert after["method_totals"]["card"] == 0

    replay = ipost(client, f"/api/invoices/{inv['id']}/reverse",
                   {"reason": "Cobro duplicado"}, key="rev-1")
    assert replay.headers.get("Idempotent-Replay") == "true"
    assert _count(db, CashMovement, CashMovement.type == "payment_void") == 2
    rec = db.scalar(select(InstitutionalReceipt))
    assert rec is not None and rec.status == "void" and rec.issued_invoice_marker is None
    assert _count(db, AuditLog, AuditLog.action == "invoice.reversed") == 1
    err(ipost(client, f"/api/invoices/{inv['id']}/reverse", {"reason": "Otra vez nada"}), 409,
        "invoice_already_void")


def test_reverse_rules(
    client: TestClient, db: Session, login_as: LoginAs, make_client: Callable[[], TestClient]
) -> None:
    _, session = setup_cashier(db, login_as, "supervisor")
    unpaid = _invoice(client, db)
    err(ipost(client, f"/api/invoices/{unpaid['id']}/reverse", {"reason": "Sin pagos aún"}), 400,
        "invoice_without_payments")
    paid = _invoice(client, db)
    ok(pay(client, paid["id"], 11_500), 201)
    cashier = make_user(db, "cajero")
    c2 = make_client()
    assert login(c2, cashier.username).status_code == 200
    err(ipost(c2, f"/api/invoices/{paid['id']}/reverse", {"reason": "Cobro duplicado"}), 403,
        "forbidden")
    session.mark_closed()
    db.commit()
    err(ipost(client, f"/api/invoices/{paid['id']}/reverse", {"reason": "Cobro duplicado"}), 400,
        "cash_session_closed")
    assert _count(db, Payment, Payment.status == "posted") == 1


def test_reverse_frees_invoice_for_new_receipt_number(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    setup_cashier(db, login_as, "supervisor")
    a = _invoice(client, db)
    ok(pay(client, a["id"], 11_500), 201)
    ok(ipost(client, f"/api/invoices/{a['id']}/reverse", {"reason": "Cobro duplicado"}))
    b = _invoice(client, db)
    assert ok(pay(client, b["id"], 11_500), 201)["receipt"]["number_full"] == "REC-A-00000002"
    sessions = db.scalars(select(CashSession)).all()
    assert len(sessions) == 1
