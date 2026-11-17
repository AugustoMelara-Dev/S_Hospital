"""Institutional settings (singleton), fiscal sequences (CAI) and tax rates."""

from __future__ import annotations

from datetime import date

from sqlalchemy import BigInteger, Boolean, Date, Integer, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, LongBlob
from app.models.base import IdMixin, TimestampMixin

SETTINGS_ID = 1


class Setting(IdMixin, TimestampMixin, Base):
    """Singleton row (id=1). Load with ``db.get(Setting, SETTINGS_ID)``."""

    __tablename__ = "settings"

    hospital_name: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    rtn: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    address: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    phone: Mapped[str] = mapped_column(String(60), nullable=False, default="")
    slogan: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    government_line: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    secretariat_line: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    receipt_location: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    receipt_footer_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    default_tax_rate_bp: Mapped[int] = mapped_column(Integer, nullable=False, default=1500)
    partial_payments_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    logo: Mapped[bytes | None] = mapped_column(LongBlob, nullable=True, deferred=True)
    logo_mime: Mapped[str | None] = mapped_column(String(60), nullable=True)

    @property
    def has_logo(self) -> bool:
        return bool(self.logo_mime)


class FiscalSequence(IdMixin, TimestampMixin, Base):
    """CAI numbering. Only one active: ``active_marker`` is 1 when active, NULL otherwise."""

    __tablename__ = "fiscal_sequences"

    prefix: Mapped[str] = mapped_column(String(32), nullable=False)
    cai: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    min_number: Mapped[int] = mapped_column(BigInteger, nullable=False)
    max_number: Mapped[int] = mapped_column(BigInteger, nullable=False)
    current_number: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    valid_until: Mapped[date] = mapped_column(Date, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    active_marker: Mapped[int | None] = mapped_column(SmallInteger, unique=True, nullable=True)

    def set_active(self, active: bool) -> None:
        self.active = active
        self.active_marker = 1 if active else None


class TaxRate(IdMixin, TimestampMixin, Base):
    __tablename__ = "tax_rates"

    name: Mapped[str] = mapped_column(String(60), nullable=False)
    rate_bp: Mapped[int] = mapped_column(Integer, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
