"""Fiscal (CAI) invoice numbering (SPEC §5 rule 3).

``take_next_invoice_number`` locks the single active sequence (``FOR UPDATE``),
validates it and consumes the next number. Call it inside the invoice
transaction so the consumed number rolls back with a failed issue.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import BusinessRuleError
from app.core.timeutil import hn_today
from app.models.settings import FiscalSequence


@dataclass(frozen=True)
class FiscalNumber:
    sequence: FiscalSequence
    number: int
    number_full: str
    range_from: str
    range_to: str


def format_fiscal_number(prefix: str, number: int) -> str:
    return f"{prefix}-{number:08d}"


def take_next_invoice_number(db: Session) -> FiscalNumber:
    seq = db.scalar(
        select(FiscalSequence).where(FiscalSequence.active.is_(True)).with_for_update()
    )
    if seq is None:
        raise BusinessRuleError(
            "fiscal_sequence_missing",
            "No hay una numeración fiscal activa. Configure el CAI en Ajustes institucionales.",
        )
    if not (seq.cai or "").strip():
        raise BusinessRuleError(
            "fiscal_cai_missing", "La numeración fiscal activa no tiene CAI registrado."
        )
    if seq.valid_until < hn_today():
        raise BusinessRuleError(
            "fiscal_sequence_expired",
            "La numeración fiscal activa venció. Registre un nuevo CAI antes de facturar.",
        )
    nxt = max(seq.current_number + 1, seq.min_number)
    if nxt > seq.max_number:
        raise BusinessRuleError(
            "fiscal_sequence_exhausted",
            "El rango de numeración fiscal autorizado se agotó. Registre un nuevo CAI.",
        )
    seq.current_number = nxt
    return FiscalNumber(
        sequence=seq,
        number=nxt,
        number_full=format_fiscal_number(seq.prefix, nxt),
        range_from=format_fiscal_number(seq.prefix, seq.min_number),
        range_to=format_fiscal_number(seq.prefix, seq.max_number),
    )
