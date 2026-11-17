"""Printing of institutional receipts (first print, reprint, test and draft PDFs)
and receipt print settings (series / profiles).

Issuance (numbering, snapshot) lives in ``app.services.receipt_issue``; this module
only READS issued receipts and renders them with :mod:`app.services.pdf_receipt`.

First-print policy (``GET /api/receipts/{id}/pdf``):
- no ``first_print`` event yet -> renders the clean ORIGINAL and records ``first_print``;
- afterwards the same GET is only a *consultation* view: it requires
  ``receipts.reprint`` (otherwise 409 ``receipt_already_printed``: use Reimprimir) and
  the operate rule (or ``receipts.reprint_any``); the PDF carries the watermark
  "COPIA DE CONSULTA", records nothing and does not increment ``reprint_count``;
- void receipts render with the watermark "ANULADO - SIN VALIDEZ" (no event).
"""

from __future__ import annotations

from typing import Any

from fastapi import Request
from sqlalchemy import exists, select, update
from sqlalchemy.orm import Session

from app.core import access
from app.core.audit import audit
from app.core.errors import (
    AppError,
    BusinessRuleError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)
from app.core.money import amount_in_words
from app.core.timeutil import iso_hn, now_utc
from app.models import (
    SETTINGS_ID,
    CashSession,
    FiscalSequence,
    InstitutionalReceipt,
    Invoice,
    PrintProfile,
    ReceiptPrintEvent,
    ReceiptSeries,
    Setting,
    User,
)
from app.models.catalog import ERYTHROPOIETIN_RULE
from app.models.receipts import RECEIPT_VOID
from app.schemas.receipts import (
    DraftReceiptIn,
    PrintProfilePatch,
    ReceiptSeriesIn,
    ReceiptSeriesPatch,
    ReprintIn,
)
from app.services import pdf_receipt
from app.services.pdf_receipt import (
    WATERMARK_DRAFT,
    WATERMARK_TEST,
    WATERMARK_VIEW,
    WATERMARK_VOID,
)

# --- lookups -------------------------------------------------------------------

def get_receipt(db: Session, receipt_id: int) -> InstitutionalReceipt:
    receipt = db.get(InstitutionalReceipt, receipt_id)
    if receipt is None:
        raise NotFoundError("receipt_not_found", "El recibo no existe.")
    return receipt


def _invoice_of(db: Session, receipt: InstitutionalReceipt) -> Invoice:
    invoice = db.get(Invoice, receipt.invoice_id)
    if invoice is None:  # pragma: no cover - FK guarantees it
        raise NotFoundError("invoice_not_found", "La factura no existe.")
    return invoice


def ensure_can_view(user: User, invoice: Invoice) -> None:
    if not access.can_view_invoice(user, invoice):
        raise ForbiddenError(
            "cannot_view_invoice", "Solo puede ver recibos de facturas emitidas por usted hoy."
        )


def ensure_can_reprint(user: User, invoice: Invoice) -> None:
    if not user.has_permission("receipts.reprint"):
        raise ForbiddenError()
    if user.has_permission("receipts.reprint_any"):
        return
    access.ensure_can_operate_invoice(user, invoice)


def resolve_profile(db: Session, code: str | None) -> PrintProfile:
    if code:
        profile = db.scalar(select(PrintProfile).where(PrintProfile.code == code))
        if profile is None:
            raise NotFoundError("print_profile_not_found", "El perfil de impresión no existe.")
    else:
        profile = db.scalar(select(PrintProfile).where(PrintProfile.is_default.is_(True)))
        if profile is None:
            profile = db.scalar(
                select(PrintProfile)
                .where(PrintProfile.active.is_(True))
                .where(PrintProfile.paper.not_in(pdf_receipt.THERMAL_PAPERS))
                .order_by(PrintProfile.id)
            )
        if profile is None:
            raise BusinessRuleError(
                "print_profile_missing", "No hay un perfil de impresión configurado."
            )
    pdf_receipt.ensure_institutional_profile(profile)
    return profile


def load_logo(db: Session, profile: PrintProfile) -> bytes | None:
    if not profile.use_logo:
        return None
    settings = db.get(Setting, SETTINGS_ID)
    if settings is None or not settings.has_logo:
        return None
    return settings.logo


def full_snapshot(db: Session, receipt: InstitutionalReceipt) -> dict[str, Any]:
    """Stored snapshot completed (never overridden) with data rebuilt from the DB."""
    invoice = _invoice_of(db, receipt)
    cashier = db.get(User, invoice.issued_by)
    session = db.get(CashSession, invoice.cash_session_id)
    base = pdf_receipt.snapshot_from_models(
        invoice=invoice,
        receipt=receipt,
        series=db.get(ReceiptSeries, receipt.series_id),
        cashier_name=cashier.name if cashier else "",
        register_name=session.cash_register.name if session and session.cash_register else "",
    )
    return pdf_receipt.merge_snapshot(base, receipt.snapshot or {})


def _has_first_print(db: Session, receipt_id: int) -> bool:
    return bool(db.scalar(select(exists().where(
        ReceiptPrintEvent.receipt_id == receipt_id, ReceiptPrintEvent.type == "first_print"
    ))))


def receipt_payload(db: Session, receipt: InstitutionalReceipt) -> dict[str, Any]:
    invoice = db.get(Invoice, receipt.invoice_id)
    issuer = db.get(User, receipt.issued_by)
    rows = db.execute(
        select(ReceiptPrintEvent, User.name)
        .join(User, User.id == ReceiptPrintEvent.user_id, isouter=True)
        .where(ReceiptPrintEvent.receipt_id == receipt.id)
        .order_by(ReceiptPrintEvent.id)
    ).all()
    events = [
        {"type": ev.type, "reason": ev.reason, "profile_code": ev.profile_code,
         "user_name": name, "created_at": ev.created_at}
        for ev, name in rows
    ]
    return {
        "id": receipt.id,
        "invoice_id": receipt.invoice_id,
        "invoice_number": invoice.number if invoice else None,
        "number_full": receipt.number_full,
        "status": receipt.status,
        "amount_cents": receipt.amount_cents,
        "amount_words": receipt.amount_words,
        "payer_name": receipt.payer_name,
        "cash_session_id": receipt.cash_session_id,
        "issued_by": receipt.issued_by,
        "issued_by_name": issuer.name if issuer else None,
        "issued_at": receipt.issued_at,
        "reprint_count": receipt.reprint_count,
        "printed": any(e["type"] == "first_print" for e in events),
        "voided_at": receipt.voided_at,
        "void_reason": receipt.void_reason,
        "events": events,
    }


def receipt_filename(receipt: InstitutionalReceipt, suffix: str = "") -> str:
    return f"recibo-{receipt.number_full}{suffix}.pdf"


# --- printing ------------------------------------------------------------------

def print_receipt(
    db: Session, user: User, receipt_id: int, profile_code: str | None, request: Request
) -> tuple[bytes, str]:
    """``GET /receipts/{id}/pdf``. Commits when the first print is recorded."""
    receipt = get_receipt(db, receipt_id)
    invoice = _invoice_of(db, receipt)
    ensure_can_view(user, invoice)
    profile = resolve_profile(db, profile_code)
    snapshot = full_snapshot(db, receipt)
    labels = pdf_receipt.copy_labels_for(profile)
    logo = load_logo(db, profile)

    if receipt.status == RECEIPT_VOID:
        pdf = pdf_receipt.render_institutional_receipt(
            snapshot, profile, labels, None, WATERMARK_VOID, logo)
        return pdf, receipt_filename(receipt, "-anulado")

    if not _has_first_print(db, receipt.id):
        pdf = pdf_receipt.render_institutional_receipt(snapshot, profile, labels, None, None, logo)
        db.add(ReceiptPrintEvent(receipt_id=receipt.id, type="first_print", reason="",
                                 profile_code=profile.code, user_id=user.id))
        audit(db, user, "receipt.printed", entity=receipt,
              new={"number_full": receipt.number_full, "profile": profile.code},
              request=request)
        db.commit()
        return pdf, receipt_filename(receipt)

    if not user.has_permission("receipts.reprint"):
        raise ConflictError(
            "receipt_already_printed",
            "El recibo ya fue impreso. Use Reimprimir e indique el motivo.",
        )
    ensure_can_reprint(user, invoice)
    pdf = pdf_receipt.render_institutional_receipt(
        snapshot, profile, labels, receipt.reprint_count or None, WATERMARK_VIEW, logo)
    return pdf, receipt_filename(receipt, "-consulta")


def reprint_receipt(
    db: Session, user: User, receipt_id: int, data: ReprintIn, request: Request
) -> tuple[bytes, str]:
    """``POST /receipts/{id}/reprint``. Does not commit (``idem.respond_bytes`` does)."""
    receipt = get_receipt(db, receipt_id)
    invoice = _invoice_of(db, receipt)
    if receipt.status == RECEIPT_VOID:
        raise BusinessRuleError("receipt_void", "No se puede reimprimir un recibo anulado.")
    ensure_can_reprint(user, invoice)
    profile = resolve_profile(db, data.profile)
    # Atomic increment (safe under concurrent reprints on MariaDB).
    db.execute(
        update(InstitutionalReceipt)
        .where(InstitutionalReceipt.id == receipt.id)
        .values(reprint_count=InstitutionalReceipt.reprint_count + 1)
    )
    db.refresh(receipt)
    number = receipt.reprint_count
    db.add(ReceiptPrintEvent(receipt_id=receipt.id, type="reprint", reason=data.reason,
                             profile_code=profile.code, user_id=user.id))
    audit(db, user, "receipt.reprinted", entity=receipt, reason=data.reason,
          new={"number_full": receipt.number_full, "reprint_no": number,
               "profile": profile.code}, request=request)
    pdf = pdf_receipt.render_institutional_receipt(
        full_snapshot(db, receipt), profile, pdf_receipt.copy_labels_for(profile), number, None,
        load_logo(db, profile))
    return pdf, receipt_filename(receipt, f"-reimpresion-{number}")


def _sample_snapshot(db: Session) -> dict[str, Any]:
    settings = db.get(Setting, SETTINGS_ID)
    series = db.scalar(select(ReceiptSeries).where(ReceiptSeries.active.is_(True)))
    fiscal = db.scalar(select(FiscalSequence).where(FiscalSequence.active.is_(True)))
    snap = pdf_receipt.snapshot_from_models(settings=settings, series=series)
    items = [
        {"name": "Consulta de ejemplo", "quantity_hundredths": 100,
         "unit_price_registered_cents": 10_000, "unit_price_cents": 10_000,
         "rule_adjustment_cents": 0, "line_subtotal_cents": 10_000, "tax_cents": 0,
         "line_total_cents": 10_000, "rate_bp": 0},
        {"name": "Medicamento de ejemplo", "quantity_hundredths": 200,
         "unit_price_registered_cents": 5_000, "unit_price_cents": 5_000,
         "rule_adjustment_cents": 0, "line_subtotal_cents": 10_000, "tax_cents": 1_500,
         "line_total_cents": 11_500, "rate_bp": 1500},
    ]
    total = 21_500
    snap.update({
        "fiscal": {
            "cai": fiscal.cai if fiscal else "",
            "range_from": f"{fiscal.prefix}-{fiscal.min_number:08d}" if fiscal else "",
            "range_to": f"{fiscal.prefix}-{fiscal.max_number:08d}" if fiscal else "",
            "valid_until": fiscal.valid_until.isoformat() if fiscal else None,
        },
        "invoice": {"number": "000-000-00-00000000", "issued_at": iso_hn(now_utc()),
                    "patient_name": "Paciente de prueba", "cashier_name": "Usuario de prueba",
                    "register_name": "Caja de prueba"},
        "items": items,
        "totals": {"subtotal_cents": 20_000, "exempt_cents": 10_000, "taxable_cents": 10_000,
                   "tax_cents": 1_500, "total_cents": total, "paid_cents": total,
                   "balance_cents": 0,
                   "tax_breakdown": [
                       {"rate_bp": 1500, "base_cents": 10_000, "tax_cents": 1_500,
                        "label": "ISV 15 %"},
                       {"rate_bp": 0, "base_cents": 10_000, "tax_cents": 0, "label": "Exento"}]},
        "payments": [{"method": "cash", "reference": "", "amount_cents": total}],
        "receipt": {"number_full": f"{series.series if series else 'REC'}-PRUEBA",
                    "amount_words": amount_in_words(total), "issued_at": iso_hn(now_utc())},
    })
    return snap


def test_print(db: Session, user: User, code: str, request: Request) -> tuple[bytes, str]:
    """Test PDF: watermark, records a ``test`` event, consumes no numbers. Commits."""
    profile = resolve_profile(db, code)
    pdf = pdf_receipt.render_institutional_receipt(
        _sample_snapshot(db), profile, pdf_receipt.copy_labels_for(profile), None,
        WATERMARK_TEST, load_logo(db, profile))
    db.add(ReceiptPrintEvent(receipt_id=None, type="test", reason="PDF de prueba",
                             profile_code=profile.code, user_id=user.id))
    audit(db, user, "receipt.test_printed", entity=profile, new={"profile": profile.code},
          request=request)
    db.commit()
    return pdf, f"prueba-{profile.code}.pdf"


# --- draft receipt (preview) --------------------------------------------------

def _compute_preview(
    db: Session, user: User, data: DraftReceiptIn, request: Request
) -> dict[str, Any]:
    """Adapter to the billing domain's server-side preview (single source of truth).

    Uses ``app.services.billing.preview(db, user, items, dialysis, request)`` which
    validates services, enforces ``patients.mark_dialysis_prescription`` (403 + audit)
    and applies ``app.services.totals.compute_totals``. Returns
    ``{items:[...line fields...], subtotal_cents, ..., total_cents, tax_breakdown}``.
    If the billing module is unavailable the draft endpoint answers 503.
    """
    try:
        from app.schemas.invoices import InvoiceItemIn
        from app.services import billing

        preview = billing.preview
    except (ImportError, AttributeError) as exc:
        raise AppError(
            "totals_unavailable",
            "La vista previa del recibo aún no está disponible.",
            status=503,
        ) from exc
    items = [InvoiceItemIn(**i.model_dump()) for i in data.items]
    return _as_dict(preview(db, user, items, data.dialysis_prescription, request))


def _as_dict(obj: Any) -> Any:
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if isinstance(obj, dict):
        return {k: _as_dict(v) for k, v in obj.items()}
    if isinstance(obj, list | tuple):
        return [_as_dict(v) for v in obj]
    if hasattr(obj, "__dict__") and not isinstance(obj, type):
        return {k: _as_dict(v) for k, v in vars(obj).items() if not k.startswith("_")}
    return obj


def draft_receipt(db: Session, user: User, data: DraftReceiptIn, request: Request) -> bytes:
    """Draft PDF (watermark "BORRADOR - SIN VALIDEZ"); consumes no numbers, writes nothing."""
    profile = resolve_profile(db, data.profile)
    preview = _compute_preview(db, user, data, request)
    totals = preview.get("totals") if isinstance(preview.get("totals"), dict) else preview
    lines = []
    for raw in preview.get("items") or preview.get("lines") or []:
        line = dict(raw)
        line.setdefault("name", line.get("service_name") or line.get("name") or "")
        if "special_rule_applied" not in line:
            line["special_rule_applied"] = line.get("special_rule_code") == ERYTHROPOIETIN_RULE \
                and data.dialysis_prescription
        lines.append(line)
    total = int(totals.get("total_cents") or 0)
    settings = db.get(Setting, SETTINGS_ID)
    series = db.scalar(select(ReceiptSeries).where(ReceiptSeries.active.is_(True)))
    fiscal = db.scalar(select(FiscalSequence).where(FiscalSequence.active.is_(True)))
    snap = pdf_receipt.snapshot_from_models(settings=settings, series=series)
    snap.update({
        "fiscal": {"cai": fiscal.cai if fiscal else "",
                   "valid_until": fiscal.valid_until.isoformat() if fiscal else None},
        "invoice": {"number": "BORRADOR", "issued_at": iso_hn(now_utc()),
                    "patient_name": data.patient_name or "—", "cashier_name": user.name,
                    "register_name": ""},
        "items": lines,
        "totals": {
            "subtotal_cents": totals.get("subtotal_cents", 0),
            "exempt_cents": totals.get("exempt_cents", 0),
            "taxable_cents": totals.get("taxable_cents", 0),
            "tax_cents": totals.get("tax_cents", 0),
            "total_cents": total, "paid_cents": 0, "balance_cents": total,
            "tax_breakdown": totals.get("tax_breakdown") or [],
        },
        "payments": [],
        "receipt": {"number_full": "BORRADOR", "amount_words": amount_in_words(max(total, 0)),
                    "issued_at": iso_hn(now_utc())},
    })
    return pdf_receipt.render_institutional_receipt(
        snap, profile, ["ORIGINAL"], None, WATERMARK_DRAFT, load_logo(db, profile))


# --- receipt settings ------------------------------------------------------------

def receipt_settings(db: Session) -> dict[str, Any]:
    return {
        "series": list(db.scalars(select(ReceiptSeries).order_by(ReceiptSeries.id))),
        "profiles": list(db.scalars(select(PrintProfile).order_by(PrintProfile.id))),
    }


def _series_dict(s: ReceiptSeries) -> dict[str, Any]:
    return {k: getattr(s, k) for k in (
        "series", "prefix", "min_number", "max_number", "current_number",
        "range_authorization", "legal_text", "number_color", "active")}


def _deactivate_other_series(db: Session, keep_id: int | None) -> None:
    for other in db.scalars(select(ReceiptSeries).where(ReceiptSeries.active.is_(True))):
        if other.id != keep_id:
            other.set_active(False)
    db.flush()


def create_series(db: Session, user: User, data: ReceiptSeriesIn, request: Request
                  ) -> ReceiptSeries:
    if db.scalar(select(ReceiptSeries).where(ReceiptSeries.series == data.series)):
        raise ConflictError("series_exists", "Ya existe una serie con ese nombre.")
    if data.current_number and data.current_number < data.min_number - 1:
        raise BusinessRuleError(
            "invalid_current_number", "El correlativo actual no puede ser menor al inicial."
        )
    has_active = db.scalar(select(ReceiptSeries).where(ReceiptSeries.active.is_(True)))
    activate = data.active or has_active is None
    if activate:
        _deactivate_other_series(db, None)
    series = ReceiptSeries(**data.model_dump(exclude={"active"}))
    series.set_active(activate)
    db.add(series)
    db.flush()
    audit(db, user, "receipt_series.created", entity=series, new=_series_dict(series),
          request=request)
    db.commit()
    return series


def update_series(db: Session, user: User, series_id: int, data: ReceiptSeriesPatch,
                  request: Request) -> ReceiptSeries:
    series = db.get(ReceiptSeries, series_id)
    if series is None:
        raise NotFoundError("series_not_found", "La serie no existe.")
    old = _series_dict(series)
    changes = data.model_dump(exclude_unset=True, exclude={"reason"})
    if "current_number" in changes and changes["current_number"] < series.current_number:
        raise BusinessRuleError(
            "current_number_decrease", "El correlativo actual no puede disminuir."
        )
    new_max = changes.get("max_number", series.max_number)
    new_current = changes.get("current_number", series.current_number)
    if new_max < series.min_number or new_max < new_current:
        raise BusinessRuleError(
            "invalid_max_number",
            "El número final no puede ser menor que el inicial ni que el correlativo actual.",
        )
    if changes.get("active") is False and series.active:
        raise BusinessRuleError(
            "active_series_required",
            "Debe haber una serie activa. Active otra serie en su lugar.",
        )
    for key, value in changes.items():
        if key == "active":
            continue
        setattr(series, key, value)
    if changes.get("active") is True and not series.active:
        _deactivate_other_series(db, series.id)
        series.set_active(True)
    audit(db, user, "receipt_series.updated", entity=series, reason=data.reason, old=old,
          new=_series_dict(series), request=request)
    db.commit()
    return series


def _profile_dict(p: PrintProfile) -> dict[str, Any]:
    return {k: getattr(p, k) for k in (
        "name", "margins_mm", "copies_mode", "show_seal_space", "use_logo", "active",
        "is_default")}


def update_profile(db: Session, user: User, profile_id: int, data: PrintProfilePatch,
                   request: Request) -> PrintProfile:
    profile = db.get(PrintProfile, profile_id)
    if profile is None:
        raise NotFoundError("print_profile_not_found", "El perfil de impresión no existe.")
    old = _profile_dict(profile)
    changes = data.model_dump(exclude_unset=True)
    becomes_default = changes.get("is_default", profile.is_default)
    becomes_active = changes.get("active", profile.active)
    if becomes_default and not profile.allowed_for_institutional:
        raise BusinessRuleError(
            "thermal_profile_not_default",
            "Un perfil térmico no puede ser el predeterminado.",
        )
    if profile.is_default and changes.get("is_default") is False:
        raise BusinessRuleError(
            "default_profile_required",
            "Debe haber un perfil predeterminado. Marque otro perfil como predeterminado.",
        )
    if becomes_default and not becomes_active:
        raise BusinessRuleError(
            "default_profile_inactive", "El perfil predeterminado debe estar activo."
        )
    for key in ("name", "margins_mm", "copies_mode", "show_seal_space", "use_logo", "active"):
        if key in changes:
            setattr(profile, key, changes[key])
    if changes.get("is_default") and not profile.is_default:
        for other in db.scalars(select(PrintProfile).where(PrintProfile.is_default.is_(True))):
            other.set_default(False)
        db.flush()
        profile.set_default(True)
    audit(db, user, "print_profile.updated", entity=profile, old=old,
          new=_profile_dict(profile), request=request)
    db.commit()
    return profile
