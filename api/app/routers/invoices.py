"""Facturas y pagos (SPEC §6 "Facturas"), all mounted under ``/api``::

    POST   /api/invoices/preview                 invoices.create   -> InvoicePreview
    POST   /api/invoices                [IDEM]   invoices.create   -> 201 Invoice
    GET    /api/invoices?search&status&date_from&date_to&cash_session_id&pending=1&page
                                                 invoices.view     -> Page[InvoiceSummary]
    GET    /api/invoices/{id}                    invoices.view     -> Invoice
    POST   /api/invoices/{id}/payments  [IDEM]   payments.create   -> 201 PaymentResult
    POST   /api/invoices/{id}/void      [IDEM]   invoices.void     -> Invoice
    POST   /api/invoices/{id}/reverse   [IDEM]   invoices.reverse  -> Invoice
    POST   /api/invoices/{id}/receipt   [IDEM]   payments.create   -> 201 Invoice

``POST /api/invoices/draft-receipt.pdf`` lives in the receipts/PDF module.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request, Response

from app.core.deps import DB, require
from app.core.idempotency import Idem
from app.core.pagination import PageParams, paginate
from app.models.users import User
from app.schemas.base import Page
from app.schemas.invoices import (
    InvoiceCreateIn,
    InvoiceOut,
    InvoicePreviewIn,
    InvoicePreviewOut,
    InvoiceSummaryOut,
    PaymentIn,
    PaymentResultOut,
    ReasonIn,
)
from app.services import billing
from app.services import cash as cash_service
from app.services import payments as payments_service

router = APIRouter(tags=["invoices"])

Creator = Annotated[User, Depends(require("invoices.create"))]
Viewer = Annotated[User, Depends(require("invoices.view"))]
Payer = Annotated[User, Depends(require("payments.create"))]
Voider = Annotated[User, Depends(require("invoices.void"))]
Reverser = Annotated[User, Depends(require("invoices.reverse"))]

StatusFilter = Literal["issued", "partial", "paid", "void", "without_charge"]


@router.post("/invoices/preview", response_model=InvoicePreviewOut)
def preview(data: InvoicePreviewIn, request: Request, db: DB, user: Creator) -> InvoicePreviewOut:
    return InvoicePreviewOut.model_validate(
        billing.preview(db, user, data.items, data.dialysis_prescription, request)
    )


@router.post("/invoices", status_code=201, response_model=InvoiceOut)
def create_invoice(
    data: InvoiceCreateIn, request: Request, db: DB, user: Creator, idem: Idem
) -> Response:
    invoice, receipt_error = billing.issue_invoice(db, user, data, request)
    out = InvoiceOut.model_validate(
        billing.invoice_dict(db, user, invoice, receipt_error=receipt_error)
    )
    return idem.respond(201, out)


@router.get("/invoices", response_model=Page[InvoiceSummaryOut])
def list_invoices(
    db: DB,
    user: Viewer,
    params: PageParams,
    search: str | None = Query(None, max_length=180),
    status: StatusFilter | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    cash_session_id: int | None = None,
    pending: bool = False,
) -> dict[str, object]:
    stmt = billing.list_invoices_stmt(
        user, search=search, status=status, date_from=date_from, date_to=date_to,
        cash_session_id=cash_session_id, pending=pending,
    )
    page = paginate(db, stmt, params)
    names = cash_service.user_names(db, {inv.issued_by for inv in page["items"]})
    page["items"] = [billing.summary_dict(inv, names) for inv in page["items"]]
    return page


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
def get_invoice(invoice_id: int, db: DB, user: Viewer) -> InvoiceOut:
    invoice = billing.get_visible_invoice(db, user, invoice_id)
    return InvoiceOut.model_validate(billing.invoice_dict(db, user, invoice))


@router.post("/invoices/{invoice_id}/payments", status_code=201, response_model=PaymentResultOut)
def pay(
    invoice_id: int, data: PaymentIn, request: Request, db: DB, user: Payer, idem: Idem
) -> Response:
    result = payments_service.register_payment(db, user, invoice_id, data, request)
    invoice = billing.invoice_dict(db, user, result.invoice)
    names = cash_service.user_names(db, {result.payment.user_id})
    out = PaymentResultOut.model_validate({
        "invoice": invoice,
        "payment": billing.payment_dict(result.payment, names),
        "receipt": invoice["receipt"] if result.receipt is not None else None,
        "receipt_error": result.receipt_error,
    })
    return idem.respond(201, out)


@router.post("/invoices/{invoice_id}/void", response_model=InvoiceOut)
def void(
    invoice_id: int, data: ReasonIn, request: Request, db: DB, user: Voider, idem: Idem
) -> Response:
    invoice = billing.void_invoice(db, user, invoice_id, data.reason, request)
    return idem.respond(200, InvoiceOut.model_validate(billing.invoice_dict(db, user, invoice)))


@router.post("/invoices/{invoice_id}/reverse", response_model=InvoiceOut)
def reverse(
    invoice_id: int, data: ReasonIn, request: Request, db: DB, user: Reverser, idem: Idem
) -> Response:
    invoice = billing.reverse_invoice(db, user, invoice_id, data.reason, request)
    return idem.respond(200, InvoiceOut.model_validate(billing.invoice_dict(db, user, invoice)))


@router.post("/invoices/{invoice_id}/receipt", status_code=201, response_model=InvoiceOut)
def issue_receipt(
    invoice_id: int, request: Request, db: DB, user: Payer, idem: Idem
) -> Response:
    invoice = billing.issue_missing_receipt(db, user, invoice_id, request)
    return idem.respond(201, InvoiceOut.model_validate(billing.invoice_dict(db, user, invoice)))
