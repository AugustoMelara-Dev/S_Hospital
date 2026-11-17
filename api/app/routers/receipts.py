"""Recibos institucionales, ajustes de impresión, borrador y resumen de caja (PDF).

    GET    /api/receipts/{id}                       receipts.view
    GET    /api/receipts/{id}/pdf?profile=code      receipts.view (1st print records event;
                                                    later: consultation copy, see
                                                    app.services.receipt_print)
    POST   /api/receipts/{id}/reprint      [IDEM]   receipts.reprint (+operate|reprint_any)
    GET    /api/receipt-settings                    receipt_settings.view
    POST   /api/receipt-series                      receipt_settings.update
    PATCH  /api/receipt-series/{id}                 receipt_settings.update
    PATCH  /api/print-profiles/{id}                 receipt_settings.update
    POST   /api/print-profiles/{code}/test.pdf      receipt_settings.view
    POST   /api/invoices/draft-receipt.pdf          invoices.create
    GET    /api/cash-sessions/{id}/summary.pdf      cash.view (own, or close_any/reports.all)

``POST /api/invoices/{id}/receipt`` (issue if missing) belongs to the issuance domain.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response

from app.core.deps import DB, require
from app.core.idempotency import Idem
from app.models.users import User
from app.schemas.receipts import (
    DraftReceiptIn,
    PrintProfileOut,
    PrintProfilePatch,
    ReceiptOut,
    ReceiptSeriesIn,
    ReceiptSeriesOut,
    ReceiptSeriesPatch,
    ReceiptSettingsOut,
    ReprintIn,
)
from app.services import receipt_print, reports

router = APIRouter(tags=["receipts"])

Viewer = Annotated[User, Depends(require("receipts.view"))]
Reprinter = Annotated[User, Depends(require("receipts.reprint"))]
SettingsViewer = Annotated[User, Depends(require("receipt_settings.view"))]
SettingsEditor = Annotated[User, Depends(require("receipt_settings.update"))]
Drafter = Annotated[User, Depends(require("invoices.create"))]
CashViewer = Annotated[User, Depends(require("cash.view"))]


def pdf_response(pdf: bytes, filename: str) -> Response:
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"',
                 "Cache-Control": "no-store"},
    )


@router.get("/receipts/{receipt_id}", response_model=ReceiptOut)
def get_receipt(receipt_id: int, db: DB, user: Viewer) -> dict[str, object]:
    receipt = receipt_print.get_receipt(db, receipt_id)
    receipt_print.ensure_can_view(user, receipt_print._invoice_of(db, receipt))
    return receipt_print.receipt_payload(db, receipt)


@router.get("/receipts/{receipt_id}/pdf")
def receipt_pdf(
    receipt_id: int,
    request: Request,
    db: DB,
    user: Viewer,
    profile: Annotated[str | None, Query(max_length=40)] = None,
) -> Response:
    pdf, filename = receipt_print.print_receipt(db, user, receipt_id, profile, request)
    return pdf_response(pdf, filename)


@router.post("/receipts/{receipt_id}/reprint")
def reprint_receipt(
    receipt_id: int, data: ReprintIn, request: Request, db: DB, user: Reprinter, idem: Idem
) -> Response:
    pdf, filename = receipt_print.reprint_receipt(db, user, receipt_id, data, request)
    return idem.respond_bytes(
        pdf, "application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/receipt-settings", response_model=ReceiptSettingsOut)
def get_receipt_settings(db: DB, user: SettingsViewer) -> dict[str, object]:
    return receipt_print.receipt_settings(db)


@router.post("/receipt-series", response_model=ReceiptSeriesOut, status_code=201)
def create_receipt_series(
    data: ReceiptSeriesIn, request: Request, db: DB, user: SettingsEditor
) -> object:
    return receipt_print.create_series(db, user, data, request)


@router.patch("/receipt-series/{series_id}", response_model=ReceiptSeriesOut)
def update_receipt_series(
    series_id: int, data: ReceiptSeriesPatch, request: Request, db: DB, user: SettingsEditor
) -> object:
    return receipt_print.update_series(db, user, series_id, data, request)


@router.patch("/print-profiles/{profile_id}", response_model=PrintProfileOut)
def update_print_profile(
    profile_id: int, data: PrintProfilePatch, request: Request, db: DB, user: SettingsEditor
) -> object:
    return receipt_print.update_profile(db, user, profile_id, data, request)


@router.post("/print-profiles/{code}/test.pdf")
def print_profile_test(code: str, request: Request, db: DB, user: SettingsViewer) -> Response:
    pdf, filename = receipt_print.test_print(db, user, code, request)
    return pdf_response(pdf, filename)


@router.post("/invoices/draft-receipt.pdf")
def draft_receipt_pdf(data: DraftReceiptIn, request: Request, db: DB, user: Drafter) -> Response:
    pdf = receipt_print.draft_receipt(db, user, data, request)
    return pdf_response(pdf, "borrador-recibo.pdf")


@router.get("/cash-sessions/{session_id}/summary.pdf")
def cash_session_summary_pdf(session_id: int, db: DB, user: CashViewer) -> Response:
    pdf, filename = reports.cash_session_summary_pdf(db, user, session_id)
    return pdf_response(pdf, filename)
