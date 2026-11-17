"""Institutional receipt PDF engine, printing/reprint endpoints and receipt settings."""

from __future__ import annotations

import io
import sys
from typing import Any

import pytest
from pypdf import PdfReader
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleError
from app.models import (
    AuditLog,
    InstitutionalReceipt,
    PrintProfile,
    ReceiptPrintEvent,
    ReceiptSeries,
)
from app.services.pdf_receipt import render_institutional_receipt
from tests.factories import make_role, make_service, make_user, open_cash_session
from tests.factories_reports import make_invoice, receipt_of

LINES = [
    {"name": "Consulta general", "price_cents": 25_000},
    {"name": "Eritropoyetina 4000 UI", "price_cents": 50_000, "qty": 150, "free": True},
    {"name": "Curación", "price_cents": 10_000, "rate_bp": 1500},
]
TOTAL = 25_000 + 10_000 + 1_500


def pdf_text(content: bytes) -> tuple[int, str]:
    assert content.startswith(b"%PDF")
    reader = PdfReader(io.BytesIO(content))
    return len(reader.pages), "\n".join(p.extract_text() or "" for p in reader.pages)


def paid_receipt(db: Session, user: Any) -> InstitutionalReceipt:
    sess = open_cash_session(db, user)
    inv = make_invoice(db, user, sess, LINES, payments=[("cash", TOTAL)],
                       patient_name="María José Núñez")
    return receipt_of(db, inv)


def idem(key: str) -> dict[str, str]:
    return {"Idempotency-Key": key}


# --- engine ------------------------------------------------------------------------------

def test_engine_renders_every_institutional_profile(db: Session, login_as: Any) -> None:
    user = login_as("cajero")
    receipt = paid_receipt(db, user)
    profiles = db.scalars(select(PrintProfile).where(
        PrintProfile.paper.not_in(("thermal_80", "thermal_58")))).all()
    assert len(profiles) == 5
    for profile in profiles:
        pdf = render_institutional_receipt(receipt.snapshot, profile,
                                           ["ORIGINAL", "PRIMERA COPIA"], 3, None)
        pages, text = pdf_text(pdf)
        assert pages == 2, profile.code
        for expected in ("RECIBO INSTITUCIONAL", "ORIGINAL", "PRIMERA COPIA", "REIMPRESIÓN #3",
                         receipt.number_full, "María José Núñez", "Sin cobro por receta",
                         "Monto en letras", "Firma del enterante", "Sello y firma autorizada",
                         "Gravado 15 %", "ISV 15 %", "L 365.00", "Detalle de servicios"):
            assert expected in text, (profile.code, expected)


def test_engine_rejects_thermal_profiles(db: Session) -> None:
    thermal = db.scalar(select(PrintProfile).where(PrintProfile.code == "thermal_80"))
    with pytest.raises(BusinessRuleError) as exc:
        render_institutional_receipt({}, thermal, ["ORIGINAL"], None, None)
    assert exc.value.code == "thermal_profile_not_allowed"


def test_engine_tolerates_partial_snapshot_and_watermark(db: Session) -> None:
    profile = db.scalar(select(PrintProfile).where(PrintProfile.code == "a5_horizontal"))
    pdf = render_institutional_receipt({"invoice": {"patient_name": "Ana"}}, profile, None, None,
                                       "BORRADOR - SIN VALIDEZ")
    pages, text = pdf_text(pdf)
    assert pages == 1
    assert "BORRADOR - SIN VALIDEZ" in text and "Ana" in text


# --- GET receipt / pdf ----------------------------------------------------------------------

def test_get_receipt_and_view_scope(db: Session, client: Any, login_as: Any) -> None:
    owner = login_as("cajero")
    receipt = paid_receipt(db, owner)
    r = client.get(f"/api/receipts/{receipt.id}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["number_full"] == receipt.number_full
    assert body["printed"] is False and body["reprint_count"] == 0
    assert body["issued_at"].endswith("-06:00")

    login_as("cajero")  # another cashier
    assert client.get(f"/api/receipts/{receipt.id}").status_code == 403
    assert client.get("/api/receipts/999999").status_code in (403, 404)


def test_first_print_then_consultation_copy(db: Session, client: Any, login_as: Any,
                                            make_client: Any) -> None:
    owner = login_as("cajero")
    receipt = paid_receipt(db, owner)
    r = client.get(f"/api/receipts/{receipt.id}/pdf")
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "application/pdf"
    pages, text = pdf_text(r.content)
    assert pages == 1  # carta_vertical (default) = original only
    assert "COPIA DE CONSULTA" not in text and "REIMPRESIÓN" not in text
    events = db.scalars(select(ReceiptPrintEvent).where(
        ReceiptPrintEvent.receipt_id == receipt.id)).all()
    assert [e.type for e in events] == ["first_print"]

    r2 = client.get(f"/api/receipts/{receipt.id}/pdf?profile=media_carta_horizontal")
    assert r2.status_code == 200
    pages, text = pdf_text(r2.content)
    assert pages == 3 and "COPIA DE CONSULTA" in text and "SEGUNDA COPIA" in text
    db.expire_all()
    assert db.get(InstitutionalReceipt, receipt.id).reprint_count == 0
    assert db.scalar(select(func.count(ReceiptPrintEvent.id)).where(
        ReceiptPrintEvent.receipt_id == receipt.id)) == 1

    # auditor: can view receipts but not reprint -> must use reprint (409)
    other = make_client()
    auditor = make_user(db, "auditor")
    assert other.post("/api/auth/login", json={"login": auditor.username,
                                               "password": "Prueba#Segura2026"}).status_code == 200
    r3 = other.get(f"/api/receipts/{receipt.id}/pdf")
    assert r3.status_code == 409
    assert r3.json()["error"]["code"] == "receipt_already_printed"


def test_pdf_profile_errors(db: Session, client: Any, login_as: Any) -> None:
    owner = login_as("cajero")
    receipt = paid_receipt(db, owner)
    r = client.get(f"/api/receipts/{receipt.id}/pdf?profile=thermal_80")
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "thermal_profile_not_allowed"
    assert client.get(f"/api/receipts/{receipt.id}/pdf?profile=nope").status_code == 404


def test_void_receipt_pdf_watermarked_and_reprint_rejected(db: Session, client: Any,
                                                           login_as: Any) -> None:
    owner = login_as("cajero")
    receipt = paid_receipt(db, owner)
    receipt.mark_void("Reversión de prueba", receipt.issued_at)
    db.commit()
    r = client.get(f"/api/receipts/{receipt.id}/pdf")
    assert r.status_code == 200
    assert "ANULADO - SIN VALIDEZ" in pdf_text(r.content)[1]
    r = client.post(f"/api/receipts/{receipt.id}/reprint", json={"reason": "Copia para archivo"},
                    headers=idem("v1"))
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "receipt_void"


# --- reprint ------------------------------------------------------------------------------

def test_reprint_increments_and_is_idempotent(db: Session, client: Any, login_as: Any) -> None:
    owner = login_as("cajero")
    receipt = paid_receipt(db, owner)
    url = f"/api/receipts/{receipt.id}/reprint"
    assert client.post(url, json={"reason": "Copia"}).status_code == 428
    assert client.post(url, json={"reason": "abc"}, headers=idem("k0")).status_code == 422

    r1 = client.post(url, json={"reason": "Paciente extravió su copia"}, headers=idem("k1"))
    assert r1.status_code == 200, r1.text
    assert "REIMPRESIÓN #1" in pdf_text(r1.content)[1]
    replay = client.post(url, json={"reason": "Paciente extravió su copia"}, headers=idem("k1"))
    assert replay.headers.get("Idempotent-Replay") == "true"
    assert replay.content == r1.content

    r2 = client.post(url, json={"reason": "Segunda copia solicitada", "profile": "a5_horizontal"},
                     headers=idem("k2"))
    assert r2.status_code == 200
    assert "REIMPRESIÓN #2" in pdf_text(r2.content)[1]

    db.expire_all()
    assert db.get(InstitutionalReceipt, receipt.id).reprint_count == 2
    events = db.scalars(select(ReceiptPrintEvent).where(
        ReceiptPrintEvent.receipt_id == receipt.id, ReceiptPrintEvent.type == "reprint")).all()
    assert [e.reason for e in events] == ["Paciente extravió su copia", "Segunda copia solicitada"]
    assert db.scalar(select(func.count(AuditLog.id)).where(
        AuditLog.action == "receipt.reprinted")) == 2


def test_reprint_permissions(db: Session, client: Any, login_as: Any) -> None:
    owner = make_user(db, "cajero")
    receipt = paid_receipt(db, owner)
    url = f"/api/receipts/{receipt.id}/reprint"
    body = {"reason": "Copia para archivo"}

    login_as("auditor")  # no receipts.reprint
    assert client.post(url, json=body, headers=idem("a")).status_code == 403
    login_as("cajero")  # reprint but cannot operate another cashier's invoice
    r = client.post(url, json=body, headers=idem("b"))
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "cannot_operate_invoice"
    login_as("supervisor")  # reprint_any
    assert client.post(url, json=body, headers=idem("c")).status_code == 200
    db.expire_all()
    assert db.get(InstitutionalReceipt, receipt.id).reprint_count == 1


# --- receipt settings ------------------------------------------------------------------------

def test_receipt_settings_listing_and_permissions(client: Any, login_as: Any) -> None:
    login_as("cajero")
    assert client.get("/api/receipt-settings").status_code == 403
    login_as("soporte")
    r = client.get("/api/receipt-settings")
    assert r.status_code == 200
    data = r.json()
    assert [s["series"] for s in data["series"]] == ["REC-A"]
    thermal = next(p for p in data["profiles"] if p["code"] == "thermal_80")
    assert thermal["allowed_for_institutional"] is False


def test_receipt_series_rules(db: Session, client: Any, login_as: Any) -> None:
    login_as("supervisor")  # receipt_settings.view only
    assert client.post("/api/receipt-series", json={"series": "REC-B",
                                                    "max_number": 100}).status_code == 403
    login_as("soporte")
    r = client.post("/api/receipt-series", json={"series": "REC-B", "max_number": 500,
                                                 "current_number": 10, "number_color": "#1d4ed8"})
    assert r.status_code == 201, r.text
    new = r.json()
    assert new["active"] is False
    assert client.post("/api/receipt-series", json={"series": "REC-B",
                                                    "max_number": 5}).status_code == 409
    assert client.post("/api/receipt-series", json={"series": "REC-C", "max_number": 5,
                                                    "min_number": 10}).status_code == 422

    sid = new["id"]
    r = client.patch(f"/api/receipt-series/{sid}", json={"current_number": 5})
    assert r.status_code == 400 and r.json()["error"]["code"] == "current_number_decrease"
    r = client.patch(f"/api/receipt-series/{sid}", json={"max_number": 8})
    assert r.status_code == 400
    r = client.patch(f"/api/receipt-series/{sid}", json={"active": True, "current_number": 12})
    assert r.status_code == 200 and r.json()["active"] is True
    actives = db.scalars(select(ReceiptSeries).where(ReceiptSeries.active.is_(True))).all()
    assert [s.series for s in actives] == ["REC-B"]
    r = client.patch(f"/api/receipt-series/{sid}", json={"active": False})
    assert r.status_code == 400 and r.json()["error"]["code"] == "active_series_required"


def test_print_profile_rules(db: Session, client: Any, login_as: Any) -> None:
    login_as("soporte")
    profiles = {p.code: p.id for p in db.scalars(select(PrintProfile))}
    r = client.patch(f"/api/print-profiles/{profiles['thermal_80']}", json={"is_default": True})
    assert r.status_code == 400 and r.json()["error"]["code"] == "thermal_profile_not_default"
    r = client.patch(f"/api/print-profiles/{profiles['carta_vertical']}",
                     json={"is_default": False})
    assert r.status_code == 400
    r = client.patch(f"/api/print-profiles/{profiles['a5_horizontal']}",
                     json={"is_default": True, "copies_mode": "original_first"})
    assert r.status_code == 200, r.text
    assert r.json()["is_default"] is True and r.json()["copies_mode"] == "original_first"
    defaults = db.scalars(select(PrintProfile).where(PrintProfile.is_default.is_(True))).all()
    assert [p.code for p in defaults] == ["a5_horizontal"]
    r = client.patch(f"/api/print-profiles/{profiles['a5_horizontal']}", json={"active": False})
    assert r.status_code == 400


def test_test_pdf_consumes_no_numbers(db: Session, client: Any, login_as: Any) -> None:
    login_as("soporte")
    before = db.scalar(select(ReceiptSeries.current_number).where(ReceiptSeries.active.is_(True)))
    r = client.post("/api/print-profiles/media_carta_horizontal/test.pdf")
    assert r.status_code == 200, r.text
    pages, text = pdf_text(r.content)
    assert pages == 3 and "PRUEBA - SIN VALIDEZ" in text and "REC-A-PRUEBA" in text
    assert client.post("/api/print-profiles/thermal_58/test.pdf").status_code == 400
    db.expire_all()
    after = db.scalar(select(ReceiptSeries.current_number).where(ReceiptSeries.active.is_(True)))
    assert after == before
    assert db.scalar(select(func.count(InstitutionalReceipt.id))) == 0
    ev = db.scalars(select(ReceiptPrintEvent).where(ReceiptPrintEvent.type == "test")).all()
    assert len(ev) == 1 and ev[0].receipt_id is None
    assert ev[0].profile_code == "media_carta_horizontal"


# --- draft receipt ------------------------------------------------------------------------------

def test_draft_receipt_pdf(db: Session, client: Any, login_as: Any) -> None:
    login_as("cajero")
    svc = make_service(db, name="Ultrasonido abdominal", price_cents=10_000, taxable=True)
    body = {"patient_name": "Juan Pérez",
            "items": [{"service_id": svc.id, "quantity_hundredths": 200}],
            "dialysis_prescription": False}
    before = db.scalar(select(ReceiptSeries.current_number).where(ReceiptSeries.active.is_(True)))
    r = client.post("/api/invoices/draft-receipt.pdf", json=body)
    assert r.status_code == 200, r.text
    _pages, text = pdf_text(r.content)
    for expected in ("BORRADOR - SIN VALIDEZ", "Juan Pérez", "Ultrasonido abdominal",
                     "L 200.00", "L 30.00", "L 230.00"):
        assert expected in text, expected
    db.expire_all()
    assert db.scalar(select(ReceiptSeries.current_number).where(
        ReceiptSeries.active.is_(True))) == before
    assert db.scalar(select(func.count(InstitutionalReceipt.id))) == 0


def test_draft_receipt_without_billing_module(
    client: Any, login_as: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    import app.services as services_pkg

    login_as("cajero")
    monkeypatch.delattr(services_pkg, "billing", raising=False)
    monkeypatch.setitem(sys.modules, "app.services.billing", None)
    r = client.post("/api/invoices/draft-receipt.pdf",
                    json={"items": [{"service_id": 1, "quantity_hundredths": 100}]})
    assert r.status_code == 503 and r.json()["error"]["code"] == "totals_unavailable"


def test_draft_receipt_permissions(db: Session, client: Any, login_as: Any) -> None:
    login_as("auditor")
    body = {"items": [{"service_id": 1, "quantity_hundredths": 100}]}
    assert client.post("/api/invoices/draft-receipt.pdf", json=body).status_code == 403
    make_role(db, "emisor", {"invoices.create"})
    login_as("emisor")
    r = client.post("/api/invoices/draft-receipt.pdf",
                    json={**body, "dialysis_prescription": True})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "dialysis_permission_required"


# --- cash session summary ------------------------------------------------------------------------

def test_cash_session_summary_pdf(db: Session, client: Any, login_as: Any) -> None:
    owner = login_as("cajero")
    sess = open_cash_session(db, owner, opening_cents=50_000)
    make_invoice(db, owner, sess, LINES, payments=[("cash", TOTAL)])
    r = client.get(f"/api/cash-sessions/{sess.id}/summary.pdf")
    assert r.status_code == 200, r.text
    _pages, text = pdf_text(r.content)
    assert "Resumen de cierre de caja" in text
    assert "L 865.00" in text  # expected cash = 500 + 365
    login_as("cajero")
    assert client.get(f"/api/cash-sessions/{sess.id}/summary.pdf").status_code == 403
    login_as("supervisor")
    assert client.get(f"/api/cash-sessions/{sess.id}/summary.pdf").status_code == 200
    assert client.get("/api/cash-sessions/99999/summary.pdf").status_code == 404
