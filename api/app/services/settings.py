"""Institutional settings, logo, fiscal sequences (CAI) and tax rates.

Every change writes ``audit_logs`` in the same transaction; functions commit.
Rules (SPEC §5):
- RTN change requires a reason (>= 5). RTN: empty or 14 digits.
- Fiscal sequence: max >= min; next (current+1) within [min, max]; current never
  decreases; valid_until >= today (when set/changed or when activating); only one
  active (``FiscalSequence.set_active``); every PATCH requires a reason.
- Tax rates: ``is_default`` unique and synced to ``settings.default_tax_rate_bp``;
  the default cannot be unset/deactivated/deleted directly; a rate used by services
  cannot be deleted nor deactivated.
"""

from __future__ import annotations

import re
from typing import Any

from fastapi import Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.errors import BusinessRuleError, ConflictError, NotFoundError, ValidationFailedError
from app.core.text import search_key
from app.core.timeutil import hn_today
from app.models.catalog import Service
from app.models.settings import SETTINGS_ID, FiscalSequence, Setting, TaxRate
from app.models.users import User
from app.schemas.settings import (
    FiscalSequenceIn,
    FiscalSequenceOut,
    FiscalSequencePatch,
    SettingsOut,
    SettingsUpdate,
    TaxRateIn,
    TaxRateOut,
    TaxRatePatch,
)

REASON_MESSAGE = "Indique un motivo de al menos 5 caracteres."
LOGO_MAX_BYTES = 2 * 1024 * 1024
LOW_RANGE_THRESHOLD = 100
RTN_PATTERN = re.compile(r"^\d{14}$")


def require_reason(reason: str | None, field: str = "reason") -> str:
    """Return the stripped reason or raise 422 when shorter than 5 characters."""
    text = (reason or "").strip()
    if len(text) < 5:
        raise ValidationFailedError(fields={field: REASON_MESSAGE})
    return text


# --- settings -------------------------------------------------------------------

SETTINGS_TEXT_FIELDS = (
    "hospital_name", "rtn", "address", "phone", "slogan", "government_line",
    "secretariat_line", "receipt_location", "receipt_footer_text",
)


def get_settings_row(db: Session) -> Setting:
    s = db.get(Setting, SETTINGS_ID)
    if s is None:
        s = Setting(id=SETTINGS_ID, hospital_name="Hospital General", default_tax_rate_bp=1500)
        db.add(s)
        db.flush()
    return s


def settings_out(s: Setting) -> SettingsOut:
    return SettingsOut.model_validate(s)


def update_settings(
    db: Session, user: User, data: SettingsUpdate, request: Request | None
) -> Setting:
    s = get_settings_row(db)
    values = data.model_dump(exclude_unset=True, exclude={"reason"})
    old: dict[str, Any] = {}
    new: dict[str, Any] = {}
    for field, value in values.items():
        if value is None:
            continue
        if field == "rtn":
            value = value.replace("-", "").replace(" ", "")
            if value and not RTN_PATTERN.match(value):
                raise ValidationFailedError(fields={"rtn": "El RTN debe tener 14 dígitos."})
        if getattr(s, field) != value:
            old[field] = getattr(s, field)
            new[field] = value
    reason = None
    if "rtn" in new:
        reason = require_reason(data.reason)
    elif data.reason:
        reason = data.reason
    if not new:
        return s
    for field, value in new.items():
        setattr(s, field, value)
    audit(db, user, "settings.updated", entity=s, reason=reason, old=old, new=new,
          request=request)
    if "rtn" in new:
        audit(db, user, "settings.rtn_changed", entity=s, reason=reason,
              old={"rtn": old["rtn"]}, new={"rtn": new["rtn"]}, request=request)
    db.commit()
    return s


def _detect_image_mime(content: bytes) -> str | None:
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    return None


def set_logo(db: Session, user: User, content: bytes, request: Request | None) -> Setting:
    if not content:
        raise ValidationFailedError(fields={"file": "El archivo está vacío."})
    if len(content) > LOGO_MAX_BYTES:
        raise ValidationFailedError(fields={"file": "El logo debe pesar como máximo 2 MB."})
    mime = _detect_image_mime(content)
    if mime is None:
        raise ValidationFailedError(fields={"file": "El logo debe ser una imagen PNG o JPEG."})
    s = get_settings_row(db)
    old_mime = s.logo_mime
    s.logo = content
    s.logo_mime = mime
    audit(db, user, "settings.logo_updated", entity=s, old={"logo_mime": old_mime},
          new={"logo_mime": mime, "size_bytes": len(content)}, request=request)
    db.commit()
    return s


def delete_logo(db: Session, user: User, request: Request | None) -> Setting:
    s = get_settings_row(db)
    if s.has_logo:
        old_mime = s.logo_mime
        s.logo = None
        s.logo_mime = None
        audit(db, user, "settings.logo_deleted", entity=s, old={"logo_mime": old_mime},
              request=request)
        db.commit()
    return s


# --- fiscal sequences -------------------------------------------------------------


def fiscal_out(seq: FiscalSequence) -> FiscalSequenceOut:
    nxt = seq.current_number + 1
    next_number = nxt if seq.min_number <= nxt <= seq.max_number else None
    return FiscalSequenceOut(
        id=seq.id,
        prefix=seq.prefix,
        cai=seq.cai,
        min_number=seq.min_number,
        max_number=seq.max_number,
        current_number=seq.current_number,
        next_number=next_number,
        next_number_formatted=(
            f"{seq.prefix}-{next_number:08d}" if next_number is not None else None
        ),
        remaining=max(seq.max_number - max(seq.current_number, seq.min_number - 1), 0),
        valid_until=seq.valid_until,
        active=seq.active,
        expired=seq.valid_until < hn_today(),
        exhausted=nxt > seq.max_number,
        low_range=(seq.max_number - seq.current_number) <= LOW_RANGE_THRESHOLD,
        created_at=seq.created_at,
        updated_at=seq.updated_at,
    )


def list_fiscal_sequences(db: Session) -> list[FiscalSequence]:
    return list(
        db.scalars(
            select(FiscalSequence).order_by(FiscalSequence.active.desc(), FiscalSequence.id.desc())
        )
    )


def _get_sequence(db: Session, seq_id: int) -> FiscalSequence:
    seq = db.get(FiscalSequence, seq_id)
    if seq is None:
        raise NotFoundError("fiscal_sequence_not_found", "La secuencia fiscal no existe.")
    return seq


def _validate_range(min_number: int, max_number: int, current: int) -> None:
    if max_number < min_number:
        raise ValidationFailedError(
            fields={"max_number": "El número final debe ser mayor o igual que el inicial."}
        )
    nxt = current + 1
    if not (min_number <= nxt <= max_number):
        raise ValidationFailedError(
            fields={"current_number": (
                "El correlativo actual debe dejar el siguiente número dentro del rango "
                "autorizado (desde − 1 hasta hasta − 1)."
            )}
        )


def _validate_valid_until(valid_until: Any) -> None:
    if valid_until < hn_today():
        raise ValidationFailedError(
            fields={"valid_until": "La fecha límite de emisión no puede estar vencida."}
        )


def _activate(db: Session, seq: FiscalSequence) -> None:
    for other in db.scalars(
        select(FiscalSequence).where(FiscalSequence.active.is_(True), FiscalSequence.id != seq.id)
    ):
        other.set_active(False)
    db.flush()
    seq.set_active(True)


def _seq_values(seq: FiscalSequence) -> dict[str, Any]:
    return {
        "prefix": seq.prefix, "cai": seq.cai, "min_number": seq.min_number,
        "max_number": seq.max_number, "current_number": seq.current_number,
        "valid_until": seq.valid_until, "active": seq.active,
    }


def create_fiscal_sequence(
    db: Session, user: User, data: FiscalSequenceIn, request: Request | None
) -> FiscalSequence:
    current = data.current_number if data.current_number is not None else data.min_number - 1
    _validate_range(data.min_number, data.max_number, current)
    _validate_valid_until(data.valid_until)
    seq = FiscalSequence(
        prefix=data.prefix, cai=data.cai, min_number=data.min_number,
        max_number=data.max_number, current_number=current, valid_until=data.valid_until,
    )
    seq.set_active(False)
    db.add(seq)
    db.flush()
    if data.active:
        _activate(db, seq)
    audit(db, user, "fiscal_sequence.created", entity=seq, new=_seq_values(seq),
          request=request)
    db.commit()
    return seq


def update_fiscal_sequence(
    db: Session, user: User, seq_id: int, data: FiscalSequencePatch, request: Request | None
) -> FiscalSequence:
    seq = _get_sequence(db, seq_id)
    reason = require_reason(data.reason)
    values = {k: v for k, v in data.model_dump(exclude_unset=True, exclude={"reason"}).items()
              if v is not None}
    old = _seq_values(seq)
    changed = {k: v for k, v in values.items() if old[k] != v}
    if not changed:
        return seq

    min_n = changed.get("min_number", seq.min_number)
    max_n = changed.get("max_number", seq.max_number)
    current = changed.get("current_number", seq.current_number)
    if current < seq.current_number:
        raise BusinessRuleError(
            "fiscal_current_decrease", "El correlativo actual no puede disminuir."
        )
    if {"min_number", "max_number", "current_number"} & changed.keys():
        _validate_range(min_n, max_n, current)
    valid_until = changed.get("valid_until", seq.valid_until)
    if "valid_until" in changed:
        _validate_valid_until(valid_until)
    if changed.get("active") is True:
        if valid_until < hn_today():
            raise BusinessRuleError(
                "fiscal_sequence_expired", "No se puede activar una secuencia vencida."
            )
        if current + 1 > max_n:
            raise BusinessRuleError(
                "fiscal_sequence_exhausted", "No se puede activar una secuencia agotada."
            )

    for field in ("prefix", "cai", "min_number", "max_number", "current_number", "valid_until"):
        if field in changed:
            setattr(seq, field, changed[field])
    if "active" in changed:
        if changed["active"]:
            _activate(db, seq)
        else:
            seq.set_active(False)
    new = _seq_values(seq)
    audit(db, user, "fiscal_sequence.updated", entity=seq, reason=reason,
          old={k: old[k] for k in changed}, new={k: new[k] for k in changed}, request=request)
    db.commit()
    return seq


# --- tax rates -------------------------------------------------------------------


def _tax_usage(db: Session) -> dict[int, int]:
    rows = db.execute(
        select(Service.tax_rate_id, func.count(Service.id))
        .where(Service.tax_rate_id.is_not(None))
        .group_by(Service.tax_rate_id)
    ).all()
    return {int(rid): int(n) for rid, n in rows}


def tax_rate_out(rate: TaxRate, usage: dict[int, int]) -> TaxRateOut:
    return TaxRateOut(
        id=rate.id, name=rate.name, rate_bp=rate.rate_bp, active=rate.active,
        is_default=rate.is_default, services_count=usage.get(rate.id, 0),
    )


def list_tax_rates(db: Session) -> list[TaxRateOut]:
    usage = _tax_usage(db)
    rates = db.scalars(select(TaxRate).order_by(TaxRate.rate_bp.desc(), TaxRate.name))
    return [tax_rate_out(r, usage) for r in rates]


def get_tax_rate(db: Session, rate_id: int) -> TaxRate:
    rate = db.get(TaxRate, rate_id)
    if rate is None:
        raise NotFoundError("tax_rate_not_found", "La tasa de impuesto no existe.")
    return rate


def default_tax_rate(db: Session) -> TaxRate | None:
    return db.scalar(
        select(TaxRate).where(TaxRate.is_default.is_(True), TaxRate.active.is_(True))
    )


def _ensure_unique_name(db: Session, name: str, exclude_id: int | None = None) -> None:
    key = search_key(name)
    for rate in db.scalars(select(TaxRate)):
        if rate.id != exclude_id and search_key(rate.name) == key:
            raise ConflictError("tax_rate_duplicate", "Ya existe una tasa con ese nombre.")


def _make_default(db: Session, rate: TaxRate) -> None:
    for other in db.scalars(
        select(TaxRate).where(TaxRate.id != rate.id, TaxRate.is_default.is_(True))
    ):
        other.is_default = False
    rate.is_default = True
    get_settings_row(db).default_tax_rate_bp = rate.rate_bp


def services_using(db: Session, rate_id: int) -> int:
    return db.scalar(select(func.count(Service.id)).where(Service.tax_rate_id == rate_id)) or 0


def create_tax_rate(
    db: Session, user: User, data: TaxRateIn, request: Request | None
) -> TaxRate:
    _ensure_unique_name(db, data.name)
    if data.is_default and not data.active:
        raise BusinessRuleError(
            "tax_rate_default_inactive", "La tasa predeterminada debe estar activa."
        )
    rate = TaxRate(name=data.name, rate_bp=data.rate_bp, active=data.active, is_default=False)
    db.add(rate)
    db.flush()
    if data.is_default:
        _make_default(db, rate)
    audit(db, user, "tax_rate.created", entity=rate,
          new={"name": rate.name, "rate_bp": rate.rate_bp, "active": rate.active,
               "is_default": rate.is_default}, request=request)
    db.commit()
    db.refresh(rate)
    return rate


def update_tax_rate(
    db: Session, user: User, rate_id: int, data: TaxRatePatch, request: Request | None
) -> TaxRate:
    rate = get_tax_rate(db, rate_id)
    reason = require_reason(data.reason)
    values = {k: v for k, v in data.model_dump(exclude_unset=True, exclude={"reason"}).items()
              if v is not None}
    old = {"name": rate.name, "rate_bp": rate.rate_bp, "active": rate.active,
           "is_default": rate.is_default}
    changed = {k: v for k, v in values.items() if old[k] != v}
    if not changed:
        return rate
    if "name" in changed:
        _ensure_unique_name(db, changed["name"], exclude_id=rate.id)
    will_be_default = changed.get("is_default", rate.is_default)
    will_be_active = changed.get("active", rate.active)
    if rate.is_default and changed.get("is_default") is False:
        raise BusinessRuleError(
            "tax_rate_default_required",
            "Debe existir una tasa predeterminada. Marque otra tasa como predeterminada.",
        )
    if will_be_default and not will_be_active:
        raise BusinessRuleError(
            "tax_rate_default_inactive", "La tasa predeterminada debe estar activa."
        )
    if changed.get("active") is False and services_using(db, rate.id):
        raise BusinessRuleError(
            "tax_rate_in_use",
            "La tasa está asignada a productos o servicios. Cámbielos antes de desactivarla.",
        )
    for field in ("name", "rate_bp", "active"):
        if field in changed:
            setattr(rate, field, changed[field])
    if changed.get("is_default") is True:
        _make_default(db, rate)
    elif rate.is_default and "rate_bp" in changed:
        get_settings_row(db).default_tax_rate_bp = rate.rate_bp
    new = {"name": rate.name, "rate_bp": rate.rate_bp, "active": rate.active,
           "is_default": rate.is_default}
    audit(db, user, "tax_rate.updated", entity=rate, reason=reason,
          old={k: old[k] for k in changed}, new={k: new[k] for k in changed}, request=request)
    db.commit()
    db.refresh(rate)
    return rate


def delete_tax_rate(
    db: Session, user: User, rate_id: int, reason: str, request: Request | None
) -> None:
    rate = get_tax_rate(db, rate_id)
    reason = require_reason(reason)
    if rate.is_default:
        raise BusinessRuleError(
            "tax_rate_is_default", "No se puede eliminar la tasa predeterminada."
        )
    in_use = services_using(db, rate.id)
    if in_use:
        raise BusinessRuleError(
            "tax_rate_in_use",
            f"No se puede eliminar: la tasa está asignada a {in_use} producto(s) o servicio(s).",
        )
    audit(db, user, "tax_rate.deleted", entity=rate, reason=reason,
          old={"name": rate.name, "rate_bp": rate.rate_bp}, request=request)
    db.delete(rate)
    db.commit()
