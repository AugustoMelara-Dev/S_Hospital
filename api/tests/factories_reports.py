"""Direct-insert factories for receipts/reports tests (bypass billing services on purpose).

``make_invoice`` writes an invoice + items + payments (+ cash movements) and, when it
ends fully paid, an issued institutional receipt with a snapshot. Totals follow the
SPEC formulas in a simplified per-line way (enough for report assertions).
"""

from __future__ import annotations

import itertools
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.money import amount_in_words
from app.core.timeutil import now_utc
from app.models import (
    CashMovement,
    CashRegister,
    CashSession,
    FiscalSequence,
    InstitutionalReceipt,
    Invoice,
    InvoiceItem,
    Payment,
    ReceiptSeries,
    Service,
    User,
)
from app.services.pdf_receipt import snapshot_from_models
from tests.factories import make_fiscal_sequence

_numbers = itertools.count(1)


def active_fiscal(db: Session) -> FiscalSequence:
    seq = db.scalar(select(FiscalSequence).where(FiscalSequence.active.is_(True)))
    return seq or make_fiscal_sequence(db)


def make_invoice(
    db: Session,
    user: User,
    session: CashSession,
    lines: list[dict[str, Any]],
    *,
    payments: list[tuple[str, int]] | None = None,
    patient_name: str = "Paciente de Prueba",
    issued_at: datetime | None = None,
    paid_at: datetime | None = None,
    void: bool = False,
    reversed_: bool = False,
    with_receipt: bool = True,
) -> Invoice:
    """``lines``: ``{"name", "price_cents", "qty" (hundredths, default 100),
    "rate_bp" (default 0), "free" (bool), "service" (Service|None), "category"}``."""
    seq = active_fiscal(db)
    n = next(_numbers)
    issued_at = issued_at or now_utc()
    invoice = Invoice(
        number=f"{seq.prefix}-{n:08d}", fiscal_sequence_id=seq.id, fiscal_cai=seq.cai,
        fiscal_range_from=f"{seq.prefix}-{seq.min_number:08d}",
        fiscal_range_to=f"{seq.prefix}-{seq.max_number:08d}",
        fiscal_valid_until=seq.valid_until, hospital_name="Hospital de Prueba",
        hospital_rtn="08011999000001", government_line="Gobierno de Honduras",
        secretariat_line="Secretaría de Salud", patient_name=patient_name,
        cash_session_id=session.id, issued_by=user.id, issued_at=issued_at,
    )
    subtotal = taxable = tax = 0
    breakdown: dict[int, list[int]] = {}
    for pos, spec in enumerate(lines):
        qty = spec.get("qty", 100)
        registered = spec["price_cents"]
        free = bool(spec.get("free"))
        unit = 0 if free else registered
        line_sub = (unit * qty + 50) // 100
        adjust = (registered * qty + 50) // 100 - line_sub
        rate = spec.get("rate_bp", 0)
        line_tax = (line_sub * rate + 5000) // 10000
        svc: Service | None = spec.get("service")
        invoice.items.append(InvoiceItem(
            service_id=svc.id if svc else None, service_name=spec.get("name") or (
                svc.name if svc else "Concepto"),
            category_name=spec.get("category", svc.category.name if svc else ""),
            quantity_hundredths=qty, unit_price_registered_cents=registered,
            unit_price_cents=unit, rule_adjustment_cents=adjust, rate_bp=rate,
            line_subtotal_cents=line_sub, tax_cents=line_tax,
            line_total_cents=line_sub + line_tax, special_rule_applied=free, position=pos,
        ))
        subtotal += line_sub
        tax += line_tax
        if rate:
            taxable += line_sub
            b = breakdown.setdefault(rate, [0, 0])
            b[0] += line_sub
            b[1] += line_tax
    total = subtotal + tax
    invoice.subtotal_cents = subtotal
    invoice.taxable_cents = taxable
    invoice.exempt_cents = subtotal - taxable
    invoice.tax_cents = tax
    invoice.total_cents = total
    invoice.tax_breakdown = [
        {"rate_bp": r, "base_cents": b, "tax_cents": t, "label": f"ISV {r // 100} %"}
        for r, (b, t) in breakdown.items()
    ]
    paid = 0
    db.add(invoice)
    db.flush()
    for method, amount in payments or []:
        pay = Payment(invoice_id=invoice.id, cash_session_id=session.id, user_id=user.id,
                      method=method, amount_cents=amount,
                      reference="REF-1" if method in ("card", "transfer") else "",
                      paid_at=paid_at or issued_at)
        invoice.payments.append(pay)
        db.flush()
        db.add(CashMovement(cash_session_id=session.id, payment_id=pay.id, user_id=user.id,
                            type="payment", method=method, amount_cents=amount,
                            occurred_at=paid_at or issued_at))
        paid += amount
    invoice.paid_cents = paid
    invoice.balance_cents = total - paid
    if total == 0:
        invoice.status = "paid"
        invoice.settlement = "free_by_rule" if any(s.get("free") for s in lines) else "zero_price"
    elif paid >= total:
        invoice.status, invoice.settlement = "paid", "paid"
    elif paid:
        invoice.status = "partial"
    if void:
        invoice.status = "void"
        invoice.voided_by = user.id
        invoice.voided_at = issued_at
        invoice.void_reason = "Anulada en prueba"
        invoice.reversed = reversed_
        for p in invoice.payments:
            if reversed_:
                p.status = "void"
    db.flush()
    if with_receipt and invoice.status == "paid":
        make_receipt(db, invoice, user)
    db.commit()
    return invoice


def open_session_on_new_register(db: Session, user: User, opening_cents: int = 0
                                 ) -> CashSession:
    """Open session on a freshly created register (one open session per register)."""
    n = next(_numbers)
    reg = CashRegister(code=f"caja-{n}", name=f"Caja {n}", active=True)
    db.add(reg)
    db.flush()
    sess = CashSession(cash_register_id=reg.id, user_id=user.id, opening_cents=opening_cents)
    sess.mark_open()
    db.add(sess)
    db.commit()
    return sess


def make_receipt(db: Session, invoice: Invoice, user: User) -> InstitutionalReceipt:
    series = db.scalar(select(ReceiptSeries).where(ReceiptSeries.active.is_(True)))
    assert series is not None
    series.current_number = max(series.current_number + 1, series.min_number)
    number = series.current_number
    receipt = InstitutionalReceipt(
        invoice_id=invoice.id, series_id=series.id, number=number,
        number_full=series.format_number(number), amount_cents=invoice.total_cents,
        amount_words=amount_in_words(invoice.total_cents), payer_name=invoice.patient_name,
        cash_session_id=invoice.cash_session_id, issued_by=user.id,
        issued_at=invoice.issued_at,
    )
    receipt.mark_issued()
    db.add(receipt)
    db.flush()
    receipt.snapshot = snapshot_from_models(
        invoice=invoice, receipt=receipt, series=series, cashier_name=user.name,
        register_name="Caja principal",
    )
    db.commit()
    return receipt


def receipt_of(db: Session, invoice: Invoice) -> InstitutionalReceipt:
    r = db.scalar(select(InstitutionalReceipt).where(InstitutionalReceipt.invoice_id == invoice.id))
    assert r is not None
    return r
