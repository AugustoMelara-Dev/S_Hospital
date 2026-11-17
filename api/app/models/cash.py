"""Cash registers, cash sessions (shifts) and cash movements."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, BigInteger, Boolean, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.timeutil import now_utc
from app.db import Base, BigId, UTCDateTime
from app.models.base import IdMixin, TimestampMixin, money
from app.models.users import User

CASH_OPEN = "open"
CASH_CLOSED = "closed"


class CashRegister(IdMixin, TimestampMixin, Base):
    __tablename__ = "cash_registers"

    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class CashSession(IdMixin, TimestampMixin, Base):
    """One open session per register and per user, enforced by unique-null markers:
    ``open_register_marker = cash_register_id`` / ``open_user_marker = user_id`` while
    open, both NULL once closed. Use :meth:`mark_open` / :meth:`mark_closed`.
    """

    __tablename__ = "cash_sessions"
    __table_args__ = (Index("ix_cash_sessions_status_opened", "status", "opened_at"),)

    cash_register_id: Mapped[int] = mapped_column(
        BigId, ForeignKey("cash_registers.id"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(BigId, ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(10), nullable=False, default=CASH_OPEN)
    open_register_marker: Mapped[int | None] = mapped_column(BigId, unique=True, nullable=True)
    open_user_marker: Mapped[int | None] = mapped_column(BigId, unique=True, nullable=True)
    opening_cents: Mapped[int] = money()
    opening_notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    opened_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now_utc, nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    closed_by: Mapped[int | None] = mapped_column(BigId, ForeignKey("users.id"), nullable=True)
    counted_cents: Mapped[int | None] = money(nullable=True)
    expected_cash_cents: Mapped[int | None] = money(nullable=True)
    difference_cents: Mapped[int | None] = money(nullable=True)
    closing_notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    closing_breakdown: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    method_totals: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    payments_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    payments_total_cents: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)

    cash_register: Mapped[CashRegister] = relationship(lazy="joined")
    user: Mapped[User] = relationship(foreign_keys=[user_id], lazy="joined")

    def mark_open(self) -> None:
        self.status = CASH_OPEN
        self.open_register_marker = self.cash_register_id
        self.open_user_marker = self.user_id

    def mark_closed(self) -> None:
        self.status = CASH_CLOSED
        self.open_register_marker = None
        self.open_user_marker = None

    @property
    def is_open(self) -> bool:
        return self.status == CASH_OPEN


class CashMovement(IdMixin, TimestampMixin, Base):
    __tablename__ = "cash_movements"

    cash_session_id: Mapped[int] = mapped_column(
        BigId, ForeignKey("cash_sessions.id"), nullable=False, index=True
    )
    payment_id: Mapped[int | None] = mapped_column(
        BigId, ForeignKey("payments.id"), nullable=True, index=True
    )
    user_id: Mapped[int] = mapped_column(BigId, ForeignKey("users.id"), nullable=False)
    # opening | payment | payment_void | closing
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    amount_cents: Mapped[int] = money()  # signed
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    occurred_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now_utc, nullable=False)
