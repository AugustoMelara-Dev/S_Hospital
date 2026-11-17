"""Receipt series, print profiles, institutional receipts and print events."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.timeutil import now_utc
from app.db import Base, BigId, UTCDateTime
from app.models.base import IdMixin, TimestampMixin

RECEIPT_ISSUED = "issued"
RECEIPT_VOID = "void"
THERMAL_PAPERS = ("thermal_80", "thermal_58")


class ReceiptSeries(IdMixin, TimestampMixin, Base):
    """Only one active series (``active_marker`` = 1 when active, NULL otherwise)."""

    __tablename__ = "receipt_series"

    series: Mapped[str] = mapped_column(String(32), nullable=False)
    prefix: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    min_number: Mapped[int] = mapped_column(BigInteger, nullable=False, default=1)
    max_number: Mapped[int] = mapped_column(BigInteger, nullable=False)
    current_number: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    range_authorization: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    legal_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    number_color: Mapped[str] = mapped_column(String(9), nullable=False, default="#b91c1c")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    active_marker: Mapped[int | None] = mapped_column(SmallInteger, unique=True, nullable=True)

    def set_active(self, active: bool) -> None:
        self.active = active
        self.active_marker = 1 if active else None

    def format_number(self, number: int) -> str:
        """``REC-A-00000001``."""
        return f"{self.series}-{number:08d}"


class PrintProfile(IdMixin, TimestampMixin, Base):
    """Only one default (``default_marker`` = 1 when default, NULL otherwise)."""

    __tablename__ = "print_profiles"

    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    paper: Mapped[str] = mapped_column(String(20), nullable=False)
    width_mm: Mapped[float] = mapped_column(Numeric(6, 1, asdecimal=False), nullable=False)
    height_mm: Mapped[float] = mapped_column(Numeric(6, 1, asdecimal=False), nullable=False)
    margins_mm: Mapped[float] = mapped_column(
        Numeric(5, 1, asdecimal=False), nullable=False, default=10
    )
    copies_mode: Mapped[str] = mapped_column(String(30), nullable=False, default="original_only")
    show_seal_space: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    use_logo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    default_marker: Mapped[int | None] = mapped_column(SmallInteger, unique=True, nullable=True)

    def set_default(self, is_default: bool) -> None:
        self.is_default = is_default
        self.default_marker = 1 if is_default else None

    @property
    def allowed_for_institutional(self) -> bool:
        """Thermal profiles are not valid for the main institutional receipt."""
        return self.paper not in THERMAL_PAPERS


class InstitutionalReceipt(IdMixin, TimestampMixin, Base):
    """One issued receipt per invoice: ``issued_invoice_marker`` = invoice_id while
    issued, NULL when void (unique-null pattern)."""

    __tablename__ = "institutional_receipts"

    invoice_id: Mapped[int] = mapped_column(
        BigId, ForeignKey("invoices.id"), nullable=False, index=True
    )
    issued_invoice_marker: Mapped[int | None] = mapped_column(BigId, unique=True, nullable=True)
    series_id: Mapped[int] = mapped_column(BigId, ForeignKey("receipt_series.id"), nullable=False)
    number: Mapped[int] = mapped_column(BigInteger, nullable=False)
    number_full: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False, default=RECEIPT_ISSUED)
    amount_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    amount_words: Mapped[str] = mapped_column(String(255), nullable=False)
    payer_name: Mapped[str] = mapped_column(String(180), nullable=False)
    cash_session_id: Mapped[int | None] = mapped_column(
        BigId, ForeignKey("cash_sessions.id"), nullable=True, index=True
    )
    issued_by: Mapped[int] = mapped_column(BigId, ForeignKey("users.id"), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=now_utc, nullable=False, index=True
    )
    snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    reprint_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    voided_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    void_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    def mark_issued(self) -> None:
        self.status = RECEIPT_ISSUED
        self.issued_invoice_marker = self.invoice_id

    def mark_void(self, reason: str, at: datetime) -> None:
        self.status = RECEIPT_VOID
        self.issued_invoice_marker = None
        self.void_reason = reason
        self.voided_at = at


class ReceiptPrintEvent(IdMixin, TimestampMixin, Base):
    __tablename__ = "receipt_print_events"

    receipt_id: Mapped[int | None] = mapped_column(
        BigId, ForeignKey("institutional_receipts.id"), nullable=True, index=True
    )
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # first_print|reprint|test
    reason: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    profile_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    user_id: Mapped[int] = mapped_column(BigId, ForeignKey("users.id"), nullable=False)
