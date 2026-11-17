"""Institutional receipt issuance (SPEC §5 rule 8).

``issue_institutional_receipt(db, invoice, user)`` creates the single issued
receipt of a paid invoice. Every precondition is checked BEFORE anything is
written, so a failure (``AppError``) leaves the session untouched and callers
(payment / zero-total issue) can still commit their own changes.

Numbering: the active series is locked (``FOR UPDATE``);
``next = max(current + 1, min)``; ``next > max`` -> ``receipt_series_exhausted``.
``number_full = f"{series}-{number:08d}"`` (e.g. ``REC-A-00000001``).

The ``snapshot`` JSON holds everything the PDF renderer needs (see
``build_snapshot``); the PDF must never re-read the live catalog/settings.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.errors import BusinessRuleError, ConflictError
from app.core.money import amount_in_words, format_money
from app.core.timeutil import iso_hn, now_utc
from app.models.billing import INVOICE_PAID, PAYMENT_POSTED, Invoice
from app.models.cash import CashSession
from app.models.receipts import InstitutionalReceipt, ReceiptSeries
from app.models.users import User

SNAPSHOT_VERSION = 1
METHOD_LABELS = {
    "cash": "Efectivo",
    "transfer": "Transferencia",
    "card": "Tarjeta",
    "other": "Otro",
}


def issued_receipt_of(db: Session, invoice_id: int) -> InstitutionalReceipt | None:
    return db.scalar(
        select(InstitutionalReceipt).where(InstitutionalReceipt.issued_invoice_marker == invoice_id)
    )


def latest_receipt_of(db: Session, invoice_id: int) -> InstitutionalReceipt | None:
    """The issued receipt, or else the most recent (void) one."""
    return issued_receipt_of(db, invoice_id) or db.scalar(
        select(InstitutionalReceipt)
        .where(InstitutionalReceipt.invoice_id == invoice_id)
        .order_by(InstitutionalReceipt.id.desc())
        .limit(1)
    )


def build_snapshot(
    db: Session,
    invoice: Invoice,
    series: ReceiptSeries,
    *,
    number: int,
    number_full: str,
    issued_at: datetime,
    cashier: User,
    cash_session: CashSession | None,
) -> dict[str, Any]:
    posted = [p for p in invoice.payments if p.status == PAYMENT_POSTED]
    issuer = db.get(User, invoice.issued_by)
    register = cash_session.cash_register if cash_session is not None else None
    return {
        "version": SNAPSHOT_VERSION,
        "receipt": {
            "number_full": number_full,
            "number": number,
            "series": series.series,
            "number_color": series.number_color,
            "legal_text": series.legal_text,
            "range_authorization": series.range_authorization,
            "issued_at": iso_hn(issued_at),
            "amount_cents": invoice.total_cents,
            "amount_words": amount_in_words(invoice.total_cents),
            "amount_display": format_money(invoice.total_cents),
        },
        "series": {
            "series": series.series,
            "prefix": series.prefix,
            "legal_text": series.legal_text,
            "number_color": series.number_color,
            "range_authorization": series.range_authorization,
        },
        "invoice": {
            "id": invoice.id,
            "number": invoice.number,
            "issued_at": iso_hn(invoice.issued_at),
            "issued_by_name": issuer.name if issuer is not None else "",
            "patient_name": invoice.patient_name,
            "cashier_name": cashier.name,
            "register_name": register.name if register is not None else "",
            "status": invoice.status,
            "settlement": invoice.settlement,
            "dialysis_prescription": invoice.dialysis_prescription,
        },
        "institution": {
            "hospital_name": invoice.hospital_name,
            "rtn": invoice.hospital_rtn,
            "address": invoice.hospital_address,
            "phone": invoice.hospital_phone,
            "government_line": invoice.government_line,
            "secretariat_line": invoice.secretariat_line,
            "receipt_location": invoice.receipt_location,
            "receipt_footer_text": invoice.receipt_footer_text,
        },
        "fiscal": {
            "cai": invoice.fiscal_cai,
            "range_from": invoice.fiscal_range_from,
            "range_to": invoice.fiscal_range_to,
            "valid_until": (
                invoice.fiscal_valid_until.isoformat() if invoice.fiscal_valid_until else None
            ),
        },
        "patient": {"name": invoice.patient_name},
        "cashier": {"id": cashier.id, "name": cashier.name},
        "cash_register": {
            "id": register.id if register is not None else None,
            "code": register.code if register is not None else "",
            "name": register.name if register is not None else "",
        },
        "cash_session_id": cash_session.id if cash_session is not None else None,
        "items": [
            {
                "position": it.position,
                "name": it.service_name,
                "service_name": it.service_name,
                "category_name": it.category_name,
                "area_name": it.area_name,
                "quantity_hundredths": it.quantity_hundredths,
                "unit_price_registered_cents": it.unit_price_registered_cents,
                "unit_price_cents": it.unit_price_cents,
                "rule_adjustment_cents": it.rule_adjustment_cents,
                "rate_bp": it.rate_bp,
                "line_subtotal_cents": it.line_subtotal_cents,
                "tax_cents": it.tax_cents,
                "line_total_cents": it.line_total_cents,
                "special_rule_applied": it.special_rule_applied,
            }
            for it in invoice.items
        ],
        "totals": {
            "subtotal_cents": invoice.subtotal_cents,
            "exempt_cents": invoice.exempt_cents,
            "taxable_cents": invoice.taxable_cents,
            "tax_cents": invoice.tax_cents,
            "total_cents": invoice.total_cents,
            "paid_cents": invoice.paid_cents,
            "balance_cents": invoice.balance_cents,
            "rule_adjustment_cents": sum(it.rule_adjustment_cents for it in invoice.items),
            "tax_breakdown": list(invoice.tax_breakdown or []),
        },
        "payments": [
            {
                "id": p.id,
                "method": p.method,
                "method_label": METHOD_LABELS.get(p.method, p.method),
                "reference": p.reference,
                "amount_cents": p.amount_cents,
                "received_cents": p.received_cents,
                "change_cents": p.change_cents,
                "paid_at": iso_hn(p.paid_at),
                "status": p.status,
            }
            for p in posted
        ],
    }


def issue_institutional_receipt(
    db: Session, invoice: Invoice, user: User, *, request: Request | None = None
) -> InstitutionalReceipt:
    # --- preconditions (no writes) ---
    if invoice.status != INVOICE_PAID or invoice.balance_cents != 0:
        raise BusinessRuleError(
            "invoice_not_paid", "Solo se emite recibo institucional para facturas pagadas."
        )
    if issued_receipt_of(db, invoice.id) is not None:
        raise ConflictError(
            "receipt_already_issued", "La factura ya tiene un recibo institucional emitido."
        )
    series = db.scalar(
        select(ReceiptSeries).where(ReceiptSeries.active.is_(True)).with_for_update()
    )
    if series is None:
        raise BusinessRuleError(
            "receipt_series_missing", "No hay una serie de recibos activa."
        )
    number = max(series.current_number + 1, series.min_number)
    if number > series.max_number:
        raise BusinessRuleError(
            "receipt_series_exhausted",
            "La serie de recibos activa se agotó. Configure una nueva serie.",
        )
    number_full = series.format_number(number)

    posted = [p for p in invoice.payments if p.status == PAYMENT_POSTED]
    session_id = posted[-1].cash_session_id if posted else invoice.cash_session_id
    cash_session = db.get(CashSession, session_id) if session_id else None
    now = now_utc()

    # --- writes ---
    series.current_number = number
    receipt = InstitutionalReceipt(
        invoice_id=invoice.id,
        series_id=series.id,
        number=number,
        number_full=number_full,
        amount_cents=invoice.total_cents,
        amount_words=amount_in_words(invoice.total_cents),
        payer_name=invoice.patient_name,
        cash_session_id=session_id,
        issued_by=user.id,
        issued_at=now,
        snapshot=build_snapshot(
            db, invoice, series, number=number, number_full=number_full, issued_at=now,
            cashier=user, cash_session=cash_session,
        ),
    )
    receipt.mark_issued()
    db.add(receipt)
    db.flush()
    audit(db, user, "receipt.issued", entity=receipt, request=request, new={
        "invoice_id": invoice.id, "number_full": number_full, "amount_cents": invoice.total_cents,
    })
    return receipt
