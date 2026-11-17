"""Invoices (never deleted), invoice items (snapshots) and payments."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import JSON, BigInteger, Boolean, Date, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.timeutil import now_utc
from app.db import Base, BigId, UTCDateTime
from app.models.base import IdMixin, TimestampMixin, money

# invoices.status
INVOICE_ISSUED = "issued"
INVOICE_PARTIAL = "partial"
INVOICE_PAID = "paid"
INVOICE_VOID = "void"
# invoices.settlement
SETTLEMENT_PENDING = "pending"
SETTLEMENT_PAID = "paid"
SETTLEMENT_FREE_BY_RULE = "free_by_rule"
SETTLEMENT_ZERO_PRICE = "zero_price"
# payments
PAYMENT_METHODS = ("cash", "transfer", "card", "other")
PAYMENT_POSTED = "posted"
PAYMENT_VOID = "void"


class Invoice(IdMixin, TimestampMixin, Base):
    __tablename__ = "invoices"
    __table_args__ = (
        Index("ix_invoices_status_issued", "status", "issued_at"),
        Index("ix_invoices_issued_by_issued", "issued_by", "issued_at"),
    )

    number: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    fiscal_sequence_id: Mapped[int] = mapped_column(
        BigId, ForeignKey("fiscal_sequences.id"), nullable=False, index=True
    )
    # Fiscal snapshots
    fiscal_cai: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    fiscal_range_from: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    fiscal_range_to: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    fiscal_valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Institution snapshots
    hospital_name: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    hospital_rtn: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    hospital_address: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    hospital_phone: Mapped[str] = mapped_column(String(60), nullable=False, default="")
    government_line: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    secretariat_line: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    receipt_location: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    receipt_footer_text: Mapped[str] = mapped_column(Text, nullable=False, default="")

    patient_name: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    subtotal_cents: Mapped[int] = money()
    exempt_cents: Mapped[int] = money()
    taxable_cents: Mapped[int] = money()
    tax_cents: Mapped[int] = money()
    total_cents: Mapped[int] = money()
    paid_cents: Mapped[int] = money()
    balance_cents: Mapped[int] = money()
    tax_breakdown: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(10), nullable=False, default=INVOICE_ISSUED)
    settlement: Mapped[str] = mapped_column(String(20), nullable=False, default=SETTLEMENT_PENDING)
    dialysis_prescription: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    cash_session_id: Mapped[int] = mapped_column(
        BigId, ForeignKey("cash_sessions.id"), nullable=False, index=True
    )
    issued_by: Mapped[int] = mapped_column(BigId, ForeignKey("users.id"), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=now_utc, nullable=False, index=True
    )
    voided_by: Mapped[int | None] = mapped_column(BigId, ForeignKey("users.id"), nullable=True)
    voided_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    void_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reversed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    items: Mapped[list[InvoiceItem]] = relationship(
        back_populates="invoice", order_by="InvoiceItem.position", lazy="selectin"
    )
    payments: Mapped[list[Payment]] = relationship(
        back_populates="invoice", order_by="Payment.id", lazy="selectin"
    )


class InvoiceItem(IdMixin, TimestampMixin, Base):
    __tablename__ = "invoice_items"

    invoice_id: Mapped[int] = mapped_column(
        BigId, ForeignKey("invoices.id"), nullable=False, index=True
    )
    service_id: Mapped[int | None] = mapped_column(
        BigId, ForeignKey("services.id", ondelete="SET NULL"), nullable=True, index=True
    )
    service_name: Mapped[str] = mapped_column(String(160), nullable=False)
    category_name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    area_name: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    quantity_hundredths: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price_registered_cents: Mapped[int] = money()
    unit_price_cents: Mapped[int] = money()
    rule_adjustment_cents: Mapped[int] = money()
    rate_bp: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    line_subtotal_cents: Mapped[int] = money()
    tax_cents: Mapped[int] = money()
    line_total_cents: Mapped[int] = money()
    special_rule_applied: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    invoice: Mapped[Invoice] = relationship(back_populates="items")


class Payment(IdMixin, TimestampMixin, Base):
    __tablename__ = "payments"
    __table_args__ = (Index("ix_payments_session_status", "cash_session_id", "status"),)

    invoice_id: Mapped[int] = mapped_column(
        BigId, ForeignKey("invoices.id"), nullable=False, index=True
    )
    cash_session_id: Mapped[int] = mapped_column(
        BigId, ForeignKey("cash_sessions.id"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(BigId, ForeignKey("users.id"), nullable=False, index=True)
    method: Mapped[str] = mapped_column(String(20), nullable=False)
    amount_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    received_cents: Mapped[int | None] = money(nullable=True)
    change_cents: Mapped[int | None] = money(nullable=True)
    reference: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(10), nullable=False, default=PAYMENT_POSTED)
    void_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    voided_by: Mapped[int | None] = mapped_column(BigId, ForeignKey("users.id"), nullable=True)
    voided_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    paid_at: Mapped[datetime] = mapped_column(
        UTCDateTime, default=now_utc, nullable=False, index=True
    )

    invoice: Mapped[Invoice] = relationship(back_populates="payments")
