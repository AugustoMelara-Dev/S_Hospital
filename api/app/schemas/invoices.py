"""Invoice, payment and receipt-summary schemas (SPEC §5–6)."""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.core.text import collapse_spaces
from app.schemas.base import HNDateTime, InputSchema, Reason

PaymentMethod = Literal["cash", "transfer", "card", "other"]


# --- input -----------------------------------------------------------------

class InvoiceItemIn(InputSchema):
    service_id: int = Field(ge=1)
    quantity_hundredths: int = Field(ge=1, le=10_000_000)


class InvoicePreviewIn(InputSchema):
    items: list[InvoiceItemIn] = Field(min_length=1, max_length=100)
    dialysis_prescription: bool = False


class InvoiceCreateIn(InvoicePreviewIn):
    patient_name: str = Field(min_length=1, max_length=180)

    @field_validator("patient_name")
    @classmethod
    def _collapse(cls, v: str) -> str:
        v = collapse_spaces(v)
        if not v:
            raise ValueError("Ingrese el nombre del paciente.")
        return v


class PaymentIn(InputSchema):
    method: PaymentMethod
    amount_cents: int = Field(ge=1)
    received_cents: int | None = Field(default=None, ge=0)
    reference: str = Field(default="", max_length=120)


class ReasonIn(InputSchema):
    reason: Reason


# --- output ----------------------------------------------------------------

class UserRef(BaseModel):
    id: int
    name: str


class TaxBreakdownOut(BaseModel):
    rate_bp: int
    base_cents: int
    tax_cents: int
    label: str


class PreviewLineOut(BaseModel):
    position: int
    service_id: int
    service_name: str
    category_name: str
    quantity_hundredths: int
    unit_price_registered_cents: int
    unit_price_cents: int
    rule_adjustment_cents: int
    rate_bp: int
    line_subtotal_cents: int
    tax_cents: int
    line_total_cents: int
    special_rule_applied: bool
    rule_eligible: bool


class InvoicePreviewOut(BaseModel):
    items: list[PreviewLineOut]
    subtotal_cents: int
    exempt_cents: int
    taxable_cents: int
    tax_cents: int
    total_cents: int
    rule_adjustment_cents: int
    tax_breakdown: list[TaxBreakdownOut]
    dialysis_prescription: bool
    has_rule_eligible_items: bool


class InvoiceItemOut(BaseModel):
    id: int
    position: int
    service_id: int | None
    service_name: str
    category_name: str
    area_name: str
    quantity_hundredths: int
    unit_price_registered_cents: int
    unit_price_cents: int
    rule_adjustment_cents: int
    rate_bp: int
    line_subtotal_cents: int
    tax_cents: int
    line_total_cents: int
    special_rule_applied: bool


class PaymentOut(BaseModel):
    id: int
    invoice_id: int
    cash_session_id: int
    user: UserRef
    method: PaymentMethod
    amount_cents: int
    received_cents: int | None
    change_cents: int | None
    reference: str
    status: Literal["posted", "void"]
    paid_at: HNDateTime
    void_reason: str | None
    voided_at: HNDateTime | None


class ReceiptSummaryOut(BaseModel):
    id: int
    number_full: str
    status: Literal["issued", "void"]
    reprint_count: int


class InvoiceActions(BaseModel):
    can_pay: bool
    can_void: bool
    can_reverse: bool
    can_reprint: bool
    can_issue_receipt: bool


class FiscalOut(BaseModel):
    cai: str
    range_from: str
    range_to: str
    valid_until: date | None


class InvoiceSummaryOut(BaseModel):
    id: int
    number: str
    patient_name: str
    status: Literal["issued", "partial", "paid", "void"]
    settlement: Literal["pending", "paid", "free_by_rule", "zero_price"]
    total_cents: int
    paid_cents: int
    balance_cents: int
    dialysis_prescription: bool
    reversed: bool
    issued_at: HNDateTime
    issued_by: UserRef
    cash_session_id: int


class InvoiceOut(InvoiceSummaryOut):
    subtotal_cents: int
    exempt_cents: int
    taxable_cents: int
    tax_cents: int
    rule_adjustment_cents: int
    tax_breakdown: list[TaxBreakdownOut]
    fiscal: FiscalOut
    voided_at: HNDateTime | None
    voided_by: UserRef | None
    void_reason: str | None
    items: list[InvoiceItemOut]
    payments: list[PaymentOut]
    receipt: ReceiptSummaryOut | None
    receipt_error: str | None = None
    actions: InvoiceActions


class PaymentResultOut(BaseModel):
    invoice: InvoiceOut
    payment: PaymentOut
    receipt: ReceiptSummaryOut | None
    receipt_error: str | None

