"""Invoices: preview, issue, list/detail, void and reverse (SPEC §5 rules 1–6).

All functions only flush; the router commits through ``idem.respond`` (or the
request session) so the business change and the stored idempotent response are
atomic.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import Request
from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session

from app.core.access import can_operate_invoice, can_view_any_invoices, can_view_invoice
from app.core.access import ensure_can_operate_invoice as _ensure_operate
from app.core.audit import audit
from app.core.errors import (
    AppError,
    BusinessRuleError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationFailedError,
)
from app.core.timeutil import hn_day_bounds, hn_range_bounds, hn_today, now_utc
from app.models.billing import (
    INVOICE_ISSUED,
    INVOICE_PAID,
    INVOICE_PARTIAL,
    INVOICE_VOID,
    PAYMENT_POSTED,
    PAYMENT_VOID,
    SETTLEMENT_FREE_BY_RULE,
    SETTLEMENT_PENDING,
    SETTLEMENT_ZERO_PRICE,
    Invoice,
    InvoiceItem,
    Payment,
)
from app.models.cash import CashMovement, CashSession
from app.models.catalog import ERYTHROPOIETIN_RULE, Service
from app.models.settings import SETTINGS_ID, Setting
from app.models.users import User
from app.schemas.invoices import InvoiceCreateIn, InvoiceItemIn
from app.services import cash as cash_service
from app.services.fiscal import take_next_invoice_number
from app.services.receipt_issue import (
    issue_institutional_receipt,
    issued_receipt_of,
    latest_receipt_of,
)
from app.services.totals import LineInput, Totals, compute_totals

DIALYSIS_PERMISSION = "patients.mark_dialysis_prescription"
LIST_STATUSES = ("issued", "partial", "paid", "void", "without_charge")


# --- helpers ---------------------------------------------------------------

def _load_services(db: Session, items: list[InvoiceItemIn]) -> list[Service]:
    ids = {it.service_id for it in items}
    found = {s.id: s for s in db.scalars(select(Service).where(Service.id.in_(ids))).unique()}
    out: list[Service] = []
    errors: dict[str, str] = {}
    for idx, it in enumerate(items):
        svc = found.get(it.service_id)
        if svc is None:
            errors[f"items.{idx}.service_id"] = "El concepto no existe."
        elif not (
            svc.active and svc.visible_in_billing and svc.is_billable and svc.category.active
        ):
            errors[f"items.{idx}.service_id"] = f"«{svc.name}» no está disponible para cobro."
        else:
            out.append(svc)
    if errors:
        raise ValidationFailedError(
            "service_unavailable",
            "Uno o más conceptos no están disponibles para cobro.",
            fields=errors,
        )
    return out


def _check_dialysis_permission(
    db: Session, user: User, dialysis: bool, request: Request | None, *, action: str
) -> None:
    if dialysis and not user.has_permission(DIALYSIS_PERMISSION):
        audit(db, user, action, result="denied", reason="dialysis_prescription sin permiso",
              request=request, commit=True)
        raise ForbiddenError(
            "dialysis_permission_required",
            "No tiene permiso para marcar receta de diálisis.",
        )


def _totals_for(services: list[Service], items: list[InvoiceItemIn], dialysis: bool) -> Totals:
    return compute_totals(
        [
            LineInput(svc.price_cents, it.quantity_hundredths, svc.rate_bp, svc.special_rule_code)
            for svc, it in zip(services, items, strict=True)
        ],
        dialysis_prescription=dialysis,
    )


def _user_ref(names: dict[int, str], uid: int | None) -> dict[str, Any] | None:
    if uid is None:
        return None
    return {"id": uid, "name": names.get(uid, "")}


# --- preview ---------------------------------------------------------------

def preview(
    db: Session, user: User, items: list[InvoiceItemIn], dialysis: bool,
    request: Request | None = None,
) -> dict[str, Any]:
    _check_dialysis_permission(db, user, dialysis, request, action="invoice.preview")
    services = _load_services(db, items)
    totals = _totals_for(services, items, dialysis)
    lines = []
    for idx, (svc, it, lt) in enumerate(zip(services, items, totals.lines, strict=True)):
        lines.append({
            "position": idx + 1,
            "service_id": svc.id,
            "service_name": svc.name,
            "category_name": svc.category.name,
            "quantity_hundredths": it.quantity_hundredths,
            "unit_price_registered_cents": lt.unit_price_registered_cents,
            "unit_price_cents": lt.unit_price_cents,
            "rule_adjustment_cents": lt.rule_adjustment_cents,
            "rate_bp": lt.rate_bp,
            "line_subtotal_cents": lt.line_subtotal_cents,
            "tax_cents": lt.tax_cents,
            "line_total_cents": lt.line_total_cents,
            "special_rule_applied": lt.special_rule_applied,
            "rule_eligible": svc.special_rule_code == ERYTHROPOIETIN_RULE,
        })
    return {
        "items": lines,
        "subtotal_cents": totals.subtotal_cents,
        "exempt_cents": totals.exempt_cents,
        "taxable_cents": totals.taxable_cents,
        "tax_cents": totals.tax_cents,
        "total_cents": totals.total_cents,
        "rule_adjustment_cents": totals.rule_adjustment_cents,
        "tax_breakdown": totals.tax_breakdown,
        "dialysis_prescription": dialysis,
        "has_rule_eligible_items": any(line["rule_eligible"] for line in lines),
    }


# --- issue -----------------------------------------------------------------

def issue_invoice(
    db: Session, user: User, data: InvoiceCreateIn, request: Request | None = None
) -> tuple[Invoice, str | None]:
    """Create the invoice. Returns ``(invoice, receipt_error)``."""
    _check_dialysis_permission(
        db, user, data.dialysis_prescription, request, action="invoice.issue"
    )
    session = cash_service.require_own_open_session(db, user)
    services = _load_services(db, data.items)
    totals = _totals_for(services, data.items, data.dialysis_prescription)
    fiscal = take_next_invoice_number(db)
    settings = db.get(Setting, SETTINGS_ID)
    assert settings is not None
    now = now_utc()

    invoice = Invoice(
        number=fiscal.number_full,
        fiscal_sequence_id=fiscal.sequence.id,
        fiscal_cai=fiscal.sequence.cai,
        fiscal_range_from=fiscal.range_from,
        fiscal_range_to=fiscal.range_to,
        fiscal_valid_until=fiscal.sequence.valid_until,
        hospital_name=settings.hospital_name,
        hospital_rtn=settings.rtn,
        hospital_address=settings.address,
        hospital_phone=settings.phone,
        government_line=settings.government_line,
        secretariat_line=settings.secretariat_line,
        receipt_location=settings.receipt_location,
        receipt_footer_text=settings.receipt_footer_text,
        patient_name=data.patient_name,
        subtotal_cents=totals.subtotal_cents,
        exempt_cents=totals.exempt_cents,
        taxable_cents=totals.taxable_cents,
        tax_cents=totals.tax_cents,
        total_cents=totals.total_cents,
        paid_cents=0,
        balance_cents=totals.total_cents,
        tax_breakdown=totals.tax_breakdown,
        status=INVOICE_ISSUED,
        settlement=SETTLEMENT_PENDING,
        dialysis_prescription=data.dialysis_prescription,
        cash_session_id=session.id,
        issued_by=user.id,
        issued_at=now,
        reversed=False,
    )
    for idx, (svc, lt) in enumerate(zip(services, totals.lines, strict=True)):
        invoice.items.append(InvoiceItem(
            service_id=svc.id,
            service_name=svc.name,
            category_name=svc.category.name,
            area_name=svc.area.name if svc.area is not None else "",
            quantity_hundredths=lt.quantity_hundredths,
            unit_price_registered_cents=lt.unit_price_registered_cents,
            unit_price_cents=lt.unit_price_cents,
            rule_adjustment_cents=lt.rule_adjustment_cents,
            rate_bp=lt.rate_bp,
            line_subtotal_cents=lt.line_subtotal_cents,
            tax_cents=lt.tax_cents,
            line_total_cents=lt.line_total_cents,
            special_rule_applied=lt.special_rule_applied,
            position=idx + 1,
        ))
    zero = totals.total_cents == 0
    if zero:
        invoice.status = INVOICE_PAID
        invoice.settlement = (
            SETTLEMENT_FREE_BY_RULE if totals.any_rule_applied else SETTLEMENT_ZERO_PRICE
        )
    db.add(invoice)
    db.flush()
    audit(db, user, "invoice.issued", entity=invoice, request=request, new={
        "number": invoice.number,
        "patient_name": invoice.patient_name,
        "total_cents": invoice.total_cents,
        "dialysis_prescription": invoice.dialysis_prescription,
        "rule_adjustment_cents": totals.rule_adjustment_cents,
        "settlement": invoice.settlement,
    })
    receipt_error: str | None = None
    if zero:
        try:
            issue_institutional_receipt(db, invoice, user, request=request)
        except AppError as exc:
            receipt_error = exc.message
    return invoice, receipt_error


# --- loading / serialization ----------------------------------------------

def get_invoice(db: Session, invoice_id: int, *, lock: bool = False) -> Invoice:
    stmt = select(Invoice).where(Invoice.id == invoice_id)
    if lock:
        stmt = stmt.with_for_update()
    invoice = db.scalar(stmt)
    if invoice is None:
        raise NotFoundError("invoice_not_found", "La factura no existe.")
    return invoice


def get_visible_invoice(db: Session, user: User, invoice_id: int) -> Invoice:
    invoice = get_invoice(db, invoice_id)
    if not can_view_invoice(user, invoice):
        raise ForbiddenError(
            "forbidden", "Solo puede consultar facturas emitidas por usted hoy."
        )
    return invoice


def ensure_can_operate(user: User, invoice: Invoice) -> None:
    _ensure_operate(user, invoice)


def _sessions_open(db: Session, ids: set[int]) -> bool:
    if not ids:
        return True
    rows = db.scalars(select(CashSession.status).where(CashSession.id.in_(ids))).all()
    return len(rows) == len(ids) and all(s == "open" for s in rows)


def actions_for(db: Session, user: User, invoice: Invoice) -> dict[str, bool]:
    operate = can_operate_invoice(user, invoice)
    posted = [p for p in invoice.payments if p.status == PAYMENT_POSTED]
    receipt = issued_receipt_of(db, invoice.id)
    not_void = invoice.status != INVOICE_VOID
    payable = invoice.status in (INVOICE_ISSUED, INVOICE_PARTIAL)
    can_pay = (
        payable and operate and user.has_permission("payments.create")
        and cash_service.own_open_session(db, user) is not None
    )
    can_void = (
        not_void and operate and user.has_permission("invoices.void") and not posted
        and _sessions_open(db, {invoice.cash_session_id})
    )
    can_reverse = (
        not_void and operate and user.has_permission("invoices.reverse") and bool(posted)
        and _sessions_open(db, {p.cash_session_id for p in posted})
    )
    can_reprint = receipt is not None and user.has_permission("receipts.reprint") and (
        operate or user.has_permission("receipts.reprint_any")
    )
    can_issue_receipt = (
        invoice.status == INVOICE_PAID and receipt is None and operate
        and user.has_permission("payments.create")
    )
    return {
        "can_pay": bool(can_pay),
        "can_void": bool(can_void),
        "can_reverse": bool(can_reverse),
        "can_reprint": bool(can_reprint),
        "can_issue_receipt": bool(can_issue_receipt),
    }


def receipt_summary(db: Session, invoice_id: int) -> dict[str, Any] | None:
    r = latest_receipt_of(db, invoice_id)
    if r is None:
        return None
    return {"id": r.id, "number_full": r.number_full, "status": r.status,
            "reprint_count": r.reprint_count}


def payment_dict(p: Payment, names: dict[int, str]) -> dict[str, Any]:
    return {
        "id": p.id,
        "invoice_id": p.invoice_id,
        "cash_session_id": p.cash_session_id,
        "user": _user_ref(names, p.user_id),
        "method": p.method,
        "amount_cents": p.amount_cents,
        "received_cents": p.received_cents,
        "change_cents": p.change_cents,
        "reference": p.reference,
        "status": p.status,
        "paid_at": p.paid_at,
        "void_reason": p.void_reason,
        "voided_at": p.voided_at,
    }


def summary_dict(invoice: Invoice, names: dict[int, str]) -> dict[str, Any]:
    return {
        "id": invoice.id,
        "number": invoice.number,
        "patient_name": invoice.patient_name,
        "status": invoice.status,
        "settlement": invoice.settlement,
        "total_cents": invoice.total_cents,
        "paid_cents": invoice.paid_cents,
        "balance_cents": invoice.balance_cents,
        "dialysis_prescription": invoice.dialysis_prescription,
        "reversed": invoice.reversed,
        "issued_at": invoice.issued_at,
        "issued_by": _user_ref(names, invoice.issued_by),
        "cash_session_id": invoice.cash_session_id,
    }


def invoice_dict(
    db: Session, user: User, invoice: Invoice, *, receipt_error: str | None = None
) -> dict[str, Any]:
    db.flush()
    db.refresh(invoice, ["items", "payments"])
    names = cash_service.user_names(
        db, {invoice.issued_by, invoice.voided_by, *(p.user_id for p in invoice.payments)}
    )
    out = summary_dict(invoice, names)
    out.update({
        "subtotal_cents": invoice.subtotal_cents,
        "exempt_cents": invoice.exempt_cents,
        "taxable_cents": invoice.taxable_cents,
        "tax_cents": invoice.tax_cents,
        "rule_adjustment_cents": sum(it.rule_adjustment_cents for it in invoice.items),
        "tax_breakdown": invoice.tax_breakdown or [],
        "fiscal": {
            "cai": invoice.fiscal_cai,
            "range_from": invoice.fiscal_range_from,
            "range_to": invoice.fiscal_range_to,
            "valid_until": invoice.fiscal_valid_until,
        },
        "voided_at": invoice.voided_at,
        "voided_by": _user_ref(names, invoice.voided_by),
        "void_reason": invoice.void_reason,
        "items": [
            {
                "id": it.id,
                "position": it.position,
                "service_id": it.service_id,
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
        "payments": [payment_dict(p, names) for p in invoice.payments],
        "receipt": receipt_summary(db, invoice.id),
        "receipt_error": receipt_error,
        "actions": actions_for(db, user, invoice),
    })
    return out


# --- list ------------------------------------------------------------------

def list_invoices_stmt(
    user: User,
    *,
    search: str | None,
    status: str | None,
    date_from: date | None,
    date_to: date | None,
    cash_session_id: int | None,
    pending: bool,
) -> Select[Any]:
    stmt = select(Invoice)
    if not can_view_any_invoices(user):
        start, end = hn_day_bounds(hn_today())
        stmt = stmt.where(
            Invoice.issued_by == user.id, Invoice.issued_at >= start, Invoice.issued_at < end
        )
    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(or_(Invoice.patient_name.ilike(term), Invoice.number.ilike(term)))
    if status == "without_charge":
        stmt = stmt.where(
            Invoice.status == INVOICE_PAID,
            Invoice.settlement.in_((SETTLEMENT_FREE_BY_RULE, SETTLEMENT_ZERO_PRICE)),
        )
    elif status:
        stmt = stmt.where(Invoice.status == status)
    if pending:
        stmt = stmt.where(Invoice.status.in_((INVOICE_ISSUED, INVOICE_PARTIAL)))
    if date_from or date_to:
        start, end = hn_range_bounds(date_from or date(2000, 1, 1), date_to or date(2999, 12, 31))
        stmt = stmt.where(Invoice.issued_at >= start, Invoice.issued_at < end)
    if cash_session_id is not None:
        stmt = stmt.where(Invoice.cash_session_id == cash_session_id)
    return stmt.order_by(Invoice.issued_at.desc(), Invoice.id.desc())


# --- void / reverse --------------------------------------------------------

def _ensure_not_void(invoice: Invoice) -> None:
    if invoice.status == INVOICE_VOID:
        raise ConflictError("invoice_already_void", "La factura ya está anulada.")


def void_invoice(
    db: Session, user: User, invoice_id: int, reason: str, request: Request | None = None
) -> Invoice:
    invoice = get_invoice(db, invoice_id, lock=True)
    ensure_can_operate(user, invoice)
    _ensure_not_void(invoice)
    if any(p.status == PAYMENT_POSTED for p in invoice.payments):
        raise BusinessRuleError(
            "invoice_has_payments",
            "La factura tiene pagos registrados. Use «Revertir» en lugar de anular.",
        )
    if not _sessions_open(db, {invoice.cash_session_id}):
        raise BusinessRuleError(
            "cash_session_closed", "La caja en la que se emitió la factura ya está cerrada."
        )
    now = now_utc()
    old = {"status": invoice.status, "balance_cents": invoice.balance_cents}
    receipt = issued_receipt_of(db, invoice.id)
    if receipt is not None:  # zero-total invoices have a receipt without payments
        receipt.mark_void(reason, now)
    invoice.status = INVOICE_VOID
    invoice.voided_by = user.id
    invoice.voided_at = now
    invoice.void_reason = reason
    invoice.balance_cents = 0
    audit(db, user, "invoice.voided", entity=invoice, reason=reason, old=old,
          new={"status": INVOICE_VOID}, request=request)
    db.flush()
    return invoice


def reverse_invoice(
    db: Session, user: User, invoice_id: int, reason: str, request: Request | None = None
) -> Invoice:
    invoice = get_invoice(db, invoice_id, lock=True)
    ensure_can_operate(user, invoice)
    _ensure_not_void(invoice)
    posted = [p for p in invoice.payments if p.status == PAYMENT_POSTED]
    if not posted:
        raise BusinessRuleError(
            "invoice_without_payments",
            "La factura no tiene pagos registrados. Use «Anular» en lugar de revertir.",
        )
    if not _sessions_open(db, {p.cash_session_id for p in posted} | {invoice.cash_session_id}):
        raise BusinessRuleError(
            "cash_session_closed",
            "Alguna caja relacionada con la factura o sus pagos ya está cerrada.",
        )
    now = now_utc()
    old = {"status": invoice.status, "paid_cents": invoice.paid_cents,
           "balance_cents": invoice.balance_cents}
    for p in posted:
        p.status = PAYMENT_VOID
        p.void_reason = reason
        p.voided_by = user.id
        p.voided_at = now
        db.add(CashMovement(
            cash_session_id=p.cash_session_id, payment_id=p.id, user_id=user.id,
            type=cash_service.MOVEMENT_PAYMENT_VOID, method=p.method,
            amount_cents=-p.amount_cents, notes=reason, occurred_at=now,
        ))
    receipt = issued_receipt_of(db, invoice.id)
    if receipt is not None:
        receipt.mark_void(reason, now)
    invoice.status = INVOICE_VOID
    invoice.reversed = True
    invoice.voided_by = user.id
    invoice.voided_at = now
    invoice.void_reason = reason
    invoice.paid_cents = 0
    invoice.balance_cents = 0
    audit(db, user, "invoice.reversed", entity=invoice, reason=reason, old=old, new={
        "status": INVOICE_VOID, "reversed": True,
        "voided_payments": [p.id for p in posted],
        "receipt_voided": receipt.number_full if receipt is not None else None,
    }, request=request)
    db.flush()
    return invoice


def issue_missing_receipt(
    db: Session, user: User, invoice_id: int, request: Request | None = None
) -> Invoice:
    invoice = get_invoice(db, invoice_id, lock=True)
    ensure_can_operate(user, invoice)
    issue_institutional_receipt(db, invoice, user, request=request)
    return invoice
