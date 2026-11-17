"""HTTP tests: invoice preview, issue, list/detail, access rules (SPEC §5 rules 1–3)."""

from __future__ import annotations

from collections.abc import Callable
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.timeutil import hn_today, now_utc
from app.models import (
    AuditLog,
    CashMovement,
    Category,
    FiscalSequence,
    InstitutionalReceipt,
    Invoice,
    Payment,
    User,
)
from tests.conftest import login
from tests.factories import make_fiscal_sequence, make_service, make_user, update_settings
from tests.factories_billing import (
    create_invoice,
    epo_service,
    err,
    ipost,
    ok,
    open_session_new_register,
    set_series_active,
    setup_cashier,
)

LoginAs = Callable[..., User]


@pytest.fixture(autouse=True)
def fiscal(db: Session) -> FiscalSequence:
    update_settings(db, hospital_name="Hospital Escuela", rtn="08019999000001", phone="2232-0000")
    return make_fiscal_sequence(db)


def count(db: Session, model: type) -> int:
    db.expire_all()
    return db.scalar(select(func.count()).select_from(model)) or 0


# --- preview ----------------------------------------------------------------

def test_preview_computes_totals_without_persisting(
    client: TestClient, db: Session, login_as: LoginAs, fiscal: FiscalSequence
) -> None:
    setup_cashier(db, login_as)
    a = make_service(db, price_cents=10_000)
    b = make_service(db, price_cents=3_333, taxable=False)
    body = ok(client.post("/api/invoices/preview", json={
        "items": [{"service_id": a.id, "quantity_hundredths": 100},
                  {"service_id": b.id, "quantity_hundredths": 150}],
        "dialysis_prescription": False,
    }))
    assert body["subtotal_cents"] == 15_000
    assert body["exempt_cents"] == 5_000
    assert body["taxable_cents"] == 10_000
    assert body["tax_cents"] == 1_500
    assert body["total_cents"] == 16_500
    assert [b["label"] for b in body["tax_breakdown"]] == ["ISV 15 %", "Exento"]
    assert body["items"][1]["line_subtotal_cents"] == 5_000
    assert body["has_rule_eligible_items"] is False
    assert count(db, Invoice) == 0
    db.refresh(fiscal)
    assert fiscal.current_number == 0


def test_preview_epo_frees_only_eligible_line(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    login_as("cajero")
    epo = epo_service(db)
    other = make_service(db, price_cents=10_000)
    items = [{"service_id": epo.id, "quantity_hundredths": 100},
             {"service_id": other.id, "quantity_hundredths": 100}]
    body = ok(client.post("/api/invoices/preview",
                          json={"items": items, "dialysis_prescription": True}))
    assert body["has_rule_eligible_items"] is True
    assert body["items"][0]["special_rule_applied"] is True
    assert body["items"][0]["rule_adjustment_cents"] == 250_000
    assert body["items"][0]["line_total_cents"] == 0
    assert body["total_cents"] == 11_500
    assert body["rule_adjustment_cents"] == 250_000


def test_preview_requires_invoices_create(
    client: TestClient, login_as: LoginAs, db: Session
) -> None:
    login_as("auditor")
    svc = make_service(db)
    err(client.post("/api/invoices/preview", json={
        "items": [{"service_id": svc.id, "quantity_hundredths": 100}]}), 403, "forbidden")


def test_dialysis_flag_without_permission_is_403_and_audited(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    setup_cashier(db, login_as, "supervisor")  # supervisor lacks patients.mark_dialysis_*
    epo = epo_service(db)
    err(create_invoice(client, [epo.id], dialysis=True), 403, "dialysis_permission_required")
    err(client.post("/api/invoices/preview", json={
        "items": [{"service_id": epo.id, "quantity_hundredths": 100}],
        "dialysis_prescription": True}), 403, "dialysis_permission_required")
    assert count(db, Invoice) == 0
    denied = db.scalars(select(AuditLog).where(AuditLog.result == "denied")).all()
    assert {a.action for a in denied} == {"invoice.issue", "invoice.preview"}


def test_unavailable_services_are_rejected(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    setup_cashier(db, login_as)
    inactive = make_service(db, active=False)
    hidden = make_service(db, visible_in_billing=False)
    not_billable = make_service(db, is_billable=False)
    cat = Category(name="Cerrada", slug="cerrada", active=False)
    db.add(cat)
    db.commit()
    in_closed_cat = make_service(db, category=cat)
    for svc in (inactive, hidden, not_billable, in_closed_cat):
        body = err(create_invoice(client, [svc.id]), 422, "service_unavailable")
        assert "items.0.service_id" in body["fields"]
    err(create_invoice(client, [999_999]), 422, "service_unavailable")
    assert count(db, Invoice) == 0


# --- issue -----------------------------------------------------------------

def test_issue_invoice_with_snapshots_and_sequential_numbers(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    user, session = setup_cashier(db, login_as)
    svc = make_service(db, name="Consulta general", price_cents=20_000)
    inv = ok(create_invoice(client, [(svc.id, 150)], patient="  María   José  López "), 201)
    assert inv["number"] == "000-001-01-00000001"
    assert inv["patient_name"] == "María José López"
    assert inv["status"] == "issued"
    assert inv["settlement"] == "pending"
    assert inv["total_cents"] == 34_500
    assert inv["balance_cents"] == 34_500
    assert inv["paid_cents"] == 0
    assert inv["cash_session_id"] == session.id
    assert inv["issued_by"] == {"id": user.id, "name": user.name}
    assert inv["fiscal"]["cai"] == "TEST-CAI-0000"
    assert inv["fiscal"]["range_from"] == "000-001-01-00000001"
    assert inv["fiscal"]["range_to"] == "000-001-01-99999999"
    assert inv["issued_at"].endswith("-06:00")
    assert inv["items"][0]["service_name"] == "Consulta general"
    assert inv["items"][0]["quantity_hundredths"] == 150
    assert inv["receipt"] is None
    assert inv["actions"] == {"can_pay": True, "can_void": False, "can_reverse": False,
                              "can_reprint": False, "can_issue_receipt": False}
    second = ok(create_invoice(client, [svc.id]), 201)
    assert second["number"] == "000-001-01-00000002"

    row = db.get(Invoice, inv["id"])
    assert row is not None
    assert row.hospital_name == "Hospital Escuela"
    assert row.hospital_rtn == "08019999000001"
    assert db.scalar(select(AuditLog).where(AuditLog.action == "invoice.issued")) is not None
    assert count(db, Payment) == 0


def test_snapshots_survive_later_catalog_changes(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    setup_cashier(db, login_as)
    svc = make_service(db, name="Rayos X", price_cents=50_000)
    inv = ok(create_invoice(client, [svc.id]), 201)
    svc.price_cents = 99_900
    svc.name = "Rayos X digital"
    svc.tax_rate_id = None
    db.commit()
    update_settings(db, hospital_name="Otro nombre")
    again = ok(client.get(f"/api/invoices/{inv['id']}"))
    assert again["items"][0]["service_name"] == "Rayos X"
    assert again["items"][0]["unit_price_cents"] == 50_000
    assert again["items"][0]["rate_bp"] == 1500
    assert again["total_cents"] == 57_500
    db.expire_all()
    row = db.get(Invoice, inv["id"])
    assert row is not None and row.hospital_name == "Hospital Escuela"


def test_issue_requires_open_cash_session(
    client: TestClient, db: Session, login_as: LoginAs, fiscal: FiscalSequence
) -> None:
    login_as("cajero")
    svc = make_service(db)
    body = err(create_invoice(client, [svc.id]), 400, "cash_session_required")
    assert "Abra caja" in body["message"]
    db.refresh(fiscal)
    assert fiscal.current_number == 0


@pytest.mark.parametrize(
    ("kwargs", "code"),
    [
        ({"valid_until_delta": -1}, "fiscal_sequence_expired"),
        ({"current_number": 10, "max_number": 10}, "fiscal_sequence_exhausted"),
        ({"cai": "   "}, "fiscal_cai_missing"),
        ({"active": False}, "fiscal_sequence_missing"),
    ],
)
def test_fiscal_numbering_errors(
    client: TestClient, db: Session, login_as: LoginAs, fiscal: FiscalSequence,
    kwargs: dict[str, object], code: str,
) -> None:
    setup_cashier(db, login_as)
    svc = make_service(db)
    delta = kwargs.pop("valid_until_delta", None)
    if kwargs.get("active") is False:
        fiscal.set_active(False)
        db.commit()
    else:
        if delta is not None:
            kwargs["valid_until"] = hn_today() + timedelta(days=int(delta))  # type: ignore[call-overload]
        make_fiscal_sequence(db, **kwargs)  # type: ignore[arg-type]
    err(create_invoice(client, [svc.id]), 400, code)
    assert count(db, Invoice) == 0


def test_fiscal_sequence_valid_until_today_is_still_valid(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    setup_cashier(db, login_as)
    make_fiscal_sequence(db, prefix="000-002-01", valid_until=hn_today(), min_number=500)
    svc = make_service(db)
    inv = ok(create_invoice(client, [svc.id]), 201)
    assert inv["number"] == "000-002-01-00000500"


def test_last_number_of_range_is_usable(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    setup_cashier(db, login_as)
    make_fiscal_sequence(db, current_number=9, max_number=10)
    svc = make_service(db)
    assert ok(create_invoice(client, [svc.id]), 201)["number"].endswith("00000010")
    err(create_invoice(client, [svc.id]), 400, "fiscal_sequence_exhausted")


@pytest.mark.parametrize(
    "body",
    [
        {"patient_name": "   ", "items": [{"service_id": 1, "quantity_hundredths": 100}]},
        {"patient_name": "Ana", "items": []},
        {"patient_name": "Ana", "items": [{"service_id": 1, "quantity_hundredths": 0}]},
        {"patient_name": "A" * 181, "items": [{"service_id": 1, "quantity_hundredths": 100}]},
        {"patient_name": "Ana", "items": [{"service_id": 1, "quantity_hundredths": 100}] * 101},
        {"items": [{"service_id": 1, "quantity_hundredths": 100}]},
    ],
)
def test_issue_validation(
    client: TestClient, db: Session, login_as: LoginAs, body: dict[str, object]
) -> None:
    setup_cashier(db, login_as)
    err(ipost(client, "/api/invoices", body), 422)


def test_issue_requires_idempotency_key(client: TestClient, db: Session, login_as: LoginAs) -> None:
    setup_cashier(db, login_as)
    svc = make_service(db)
    resp = client.post("/api/invoices", json={
        "patient_name": "Ana", "items": [{"service_id": svc.id, "quantity_hundredths": 100}]})
    err(resp, 428, "idempotency_key_required")


def test_idempotent_replay_does_not_duplicate_invoice(
    client: TestClient, db: Session, login_as: LoginAs, fiscal: FiscalSequence
) -> None:
    setup_cashier(db, login_as)
    svc = make_service(db)
    first = create_invoice(client, [svc.id], key="factura-1")
    again = create_invoice(client, [svc.id], key="factura-1")
    assert first.status_code == again.status_code == 201
    assert again.headers.get("Idempotent-Replay") == "true"
    assert first.json() == again.json()
    assert count(db, Invoice) == 1
    db.refresh(fiscal)
    assert fiscal.current_number == 1
    err(create_invoice(client, [svc.id], patient="Otro", key="factura-1"), 409,
        "idempotency_key_mismatch")


def test_duplicate_epo_lines_and_mixed_invoice(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    setup_cashier(db, login_as)
    epo = epo_service(db, price_cents=100_000)
    lab = make_service(db, price_cents=10_000)
    inv = ok(create_invoice(client, [(epo.id, 200), lab.id, (epo.id, 100)], dialysis=True), 201)
    assert [i["special_rule_applied"] for i in inv["items"]] == [True, False, True]
    assert inv["rule_adjustment_cents"] == 300_000
    assert inv["total_cents"] == 11_500
    assert inv["status"] == "issued"
    assert inv["dialysis_prescription"] is True


# --- zero-total invoices ----------------------------------------------------

def test_zero_total_by_rule_is_paid_with_receipt_and_no_payment(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    setup_cashier(db, login_as)
    epo = epo_service(db)
    inv = ok(create_invoice(client, [epo.id], dialysis=True), 201)
    assert inv["status"] == "paid"
    assert inv["settlement"] == "free_by_rule"
    assert inv["total_cents"] == 0
    assert inv["balance_cents"] == 0
    assert inv["payments"] == []
    assert inv["receipt"]["number_full"] == "REC-A-00000001"
    assert inv["receipt"]["status"] == "issued"
    assert inv["receipt_error"] is None
    assert count(db, Payment) == 0
    assert db.scalar(select(func.count()).select_from(CashMovement)
                     .where(CashMovement.type == "payment")) == 0
    rec = db.scalar(select(InstitutionalReceipt))
    assert rec is not None
    assert rec.amount_words == "CERO LEMPIRAS CON 00/100"
    assert rec.snapshot["items"][0]["special_rule_applied"] is True
    assert rec.snapshot["items"][0]["rule_adjustment_cents"] == 250_000


def test_zero_price_settlement(client: TestClient, db: Session, login_as: LoginAs) -> None:
    setup_cashier(db, login_as)
    free = make_service(db, price_cents=0)
    inv = ok(create_invoice(client, [free.id]), 201)
    assert (inv["status"], inv["settlement"]) == ("paid", "zero_price")


def test_epo_flag_without_eligible_line_frees_nothing(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    setup_cashier(db, login_as)
    svc = make_service(db, price_cents=10_000)
    inv = ok(create_invoice(client, [svc.id], dialysis=True), 201)
    assert inv["total_cents"] == 11_500
    assert inv["status"] == "issued"
    assert inv["settlement"] == "pending"


def test_zero_total_receipt_failure_keeps_invoice(
    client: TestClient, db: Session, login_as: LoginAs
) -> None:
    setup_cashier(db, login_as)
    set_series_active(db, False)
    free = make_service(db, price_cents=0)
    inv = ok(create_invoice(client, [free.id]), 201)
    assert inv["status"] == "paid"
    assert inv["receipt"] is None
    assert "serie de recibos" in inv["receipt_error"]
    assert inv["actions"]["can_issue_receipt"] is True
    set_series_active(db, True)
    fixed = ok(ipost(client, f"/api/invoices/{inv['id']}/receipt"), 201)
    assert fixed["receipt"]["number_full"] == "REC-A-00000001"
    assert fixed["actions"]["can_issue_receipt"] is False
    err(ipost(client, f"/api/invoices/{inv['id']}/receipt"), 409, "receipt_already_issued")


# --- list / detail / access ------------------------------------------------

def _other_cashier_invoice(
    db: Session, make_client: Callable[[], TestClient], name: str = "Pedro Otro"
) -> dict[str, object]:
    other = make_user(db, "cajero")
    open_session_new_register(db, other)
    c2 = make_client()
    assert login(c2, other.username).status_code == 200
    svc = make_service(db)
    return ok(create_invoice(c2, [svc.id], patient=name), 201)


def test_cashier_cannot_view_or_operate_other_cashier_invoice(
    client: TestClient, db: Session, login_as: LoginAs, make_client: Callable[[], TestClient]
) -> None:
    foreign = _other_cashier_invoice(db, make_client)
    setup_cashier(db, login_as)
    err(client.get(f"/api/invoices/{foreign['id']}"), 403)
    err(ipost(client, f"/api/invoices/{foreign['id']}/payments",
              {"method": "cash", "amount_cents": 11_500}), 403, "cannot_operate_invoice")
    listing = ok(client.get("/api/invoices"))
    assert listing["total"] == 0


def test_list_scoping_and_filters(
    client: TestClient, db: Session, login_as: LoginAs, make_client: Callable[[], TestClient]
) -> None:
    _other_cashier_invoice(db, make_client, name="Pedro Otro")
    _, session = setup_cashier(db, login_as)
    svc = make_service(db, price_cents=10_000)
    a = ok(create_invoice(client, [svc.id], patient="Ana Martínez"), 201)
    b = ok(create_invoice(client, [svc.id], patient="Bruno Díaz"), 201)
    ok(ipost(client, f"/api/invoices/{b['id']}/payments",
             {"method": "cash", "amount_cents": 11_500}), 201)

    own = ok(client.get("/api/invoices"))
    assert own["total"] == 2
    assert {i["patient_name"] for i in own["items"]} == {"Ana Martínez", "Bruno Díaz"}
    assert own["items"][0]["id"] == b["id"]  # newest first
    assert set(own["items"][0]) >= {"number", "status", "total_cents", "balance_cents",
                                    "issued_by", "settlement", "issued_at"}
    assert ok(client.get("/api/invoices", params={"search": "ana"}))["total"] == 1
    assert ok(client.get("/api/invoices", params={"search": a["number"]}))["total"] == 1
    assert ok(client.get("/api/invoices", params={"status": "paid"}))["total"] == 1
    pending = ok(client.get("/api/invoices", params={"pending": 1}))
    assert [i["id"] for i in pending["items"]] == [a["id"]]
    today = hn_today().isoformat()
    assert ok(client.get("/api/invoices", params={"date_from": today, "date_to": today}))[
        "total"] == 2
    yesterday = (hn_today() - timedelta(days=1)).isoformat()
    assert ok(client.get("/api/invoices", params={"date_to": yesterday}))["total"] == 0
    assert ok(client.get("/api/invoices", params={"cash_session_id": session.id}))["total"] == 2
    err(client.get("/api/invoices", params={"status": "nope"}), 422)

    sup = make_client()
    supervisor = make_user(db, "supervisor")
    assert login(sup, supervisor.username).status_code == 200
    assert ok(sup.get("/api/invoices"))["total"] == 3
    auditor = make_user(db, "auditor")
    aud = make_client()
    assert login(aud, auditor.username).status_code == 200
    assert ok(aud.get("/api/invoices"))["total"] == 3
    assert ok(aud.get(f"/api/invoices/{a['id']}"))["actions"]["can_pay"] is False


def test_previous_day_invoice_needs_operate_any(
    client: TestClient, db: Session, login_as: LoginAs, make_client: Callable[[], TestClient]
) -> None:
    setup_cashier(db, login_as)
    svc = make_service(db)
    inv = ok(create_invoice(client, [svc.id]), 201)
    row = db.get(Invoice, inv["id"])
    assert row is not None
    row.issued_at = now_utc() - timedelta(days=2)
    db.commit()
    err(client.get(f"/api/invoices/{inv['id']}"), 403)
    assert ok(client.get("/api/invoices"))["total"] == 0
    err(ipost(client, f"/api/invoices/{inv['id']}/payments",
              {"method": "cash", "amount_cents": 11_500}), 403, "cannot_operate_invoice")

    supervisor = make_user(db, "supervisor")
    open_session_new_register(db, supervisor)
    sup = make_client()
    assert login(sup, supervisor.username).status_code == 200
    detail = ok(sup.get(f"/api/invoices/{inv['id']}"))
    assert detail["actions"]["can_pay"] is True
    ok(ipost(sup, f"/api/invoices/{inv['id']}/payments",
             {"method": "cash", "amount_cents": 11_500}), 201)


def test_invoice_not_found(client: TestClient, db: Session, login_as: LoginAs) -> None:
    login_as("supervisor")
    err(client.get("/api/invoices/424242"), 404, "invoice_not_found")
