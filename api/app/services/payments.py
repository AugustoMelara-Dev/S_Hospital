"""Payments (SPEC §5 rule 4).

``register_payment`` requires the caller's own open cash session, a payable
invoice the caller may operate, ``amount <= balance`` (partial only when
``settings.partial_payments_enabled``), a reference for card/transfer and, for
cash, ``received_cents >= amount`` (``change_cents`` computed). It creates the
payment + a ``payment`` cash movement and updates paid/balance/status. When the
balance reaches 0 the institutional receipt is issued automatically; if that
fails the payment is still kept and ``receipt_error`` explains why.
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Request
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.errors import AppError, BusinessRuleError, ValidationFailedError
from app.core.timeutil import now_utc
from app.models.billing import (
    INVOICE_PAID,
    INVOICE_PARTIAL,
    INVOICE_VOID,
    SETTLEMENT_PAID,
    Invoice,
    Payment,
)
from app.models.cash import CashMovement
from app.models.receipts import InstitutionalReceipt
from app.models.settings import SETTINGS_ID, Setting
from app.models.users import User
from app.schemas.invoices import PaymentIn
from app.services import billing
from app.services import cash as cash_service
from app.services.receipt_issue import issue_institutional_receipt

REFERENCE_REQUIRED = ("card", "transfer")


@dataclass
class PaymentResult:
    invoice: Invoice
    payment: Payment
    receipt: InstitutionalReceipt | None
    receipt_error: str | None


def register_payment(
    db: Session, user: User, invoice_id: int, data: PaymentIn, request: Request | None = None
) -> PaymentResult:
    invoice = billing.get_invoice(db, invoice_id, lock=True)
    billing.ensure_can_operate(user, invoice)
    session = cash_service.require_own_open_session(db, user)
    if invoice.status == INVOICE_VOID:
        raise BusinessRuleError("invoice_void", "La factura está anulada; no admite cobros.")
    if invoice.status == INVOICE_PAID or invoice.balance_cents <= 0:
        raise BusinessRuleError("invoice_already_paid", "La factura ya está pagada.")
    amount = data.amount_cents
    if amount > invoice.balance_cents:
        raise BusinessRuleError(
            "payment_exceeds_balance",
            "El monto excede el saldo pendiente de la factura.",
        )
    if amount < invoice.balance_cents:
        settings = db.get(Setting, SETTINGS_ID)
        if settings is None or not settings.partial_payments_enabled:
            raise BusinessRuleError(
                "partial_payments_disabled",
                "Los abonos parciales no están habilitados. Cobre el saldo completo.",
            )
    reference = data.reference.strip()
    if data.method in REFERENCE_REQUIRED and not reference:
        raise ValidationFailedError(
            "reference_required",
            "Ingrese la referencia del pago con tarjeta o transferencia.",
            fields={"reference": "La referencia es obligatoria para tarjeta y transferencia."},
        )
    received: int | None = None
    change: int | None = None
    if data.method == "cash":
        received = data.received_cents if data.received_cents is not None else amount
        if received < amount:
            raise ValidationFailedError(
                "insufficient_cash",
                "El monto recibido es menor que el total a cobrar.",
                fields={"received_cents": "El monto recibido es menor que el total a cobrar."},
            )
        change = received - amount

    now = now_utc()
    payment = Payment(
        invoice_id=invoice.id,
        cash_session_id=session.id,
        user_id=user.id,
        method=data.method,
        amount_cents=amount,
        received_cents=received,
        change_cents=change,
        reference=reference,
        paid_at=now,
    )
    invoice.payments.append(payment)
    db.flush()
    db.add(CashMovement(
        cash_session_id=session.id, payment_id=payment.id, user_id=user.id,
        type=cash_service.MOVEMENT_PAYMENT, method=data.method, amount_cents=amount,
        notes=invoice.number, occurred_at=now,
    ))
    invoice.paid_cents += amount
    invoice.balance_cents -= amount
    if invoice.balance_cents == 0:
        invoice.status = INVOICE_PAID
        invoice.settlement = SETTLEMENT_PAID
    else:
        invoice.status = INVOICE_PARTIAL
    audit(db, user, "payment.created", entity=payment, request=request, new={
        "invoice_id": invoice.id, "invoice_number": invoice.number, "method": data.method,
        "amount_cents": amount, "balance_cents": invoice.balance_cents,
    })
    db.flush()

    receipt: InstitutionalReceipt | None = None
    receipt_error: str | None = None
    if invoice.balance_cents == 0:
        try:
            receipt = issue_institutional_receipt(db, invoice, user, request=request)
        except AppError as exc:
            receipt_error = exc.message
    return PaymentResult(invoice, payment, receipt, receipt_error)
