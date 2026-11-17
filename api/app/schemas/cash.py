"""Cash register / cash session schemas (SPEC §6 "Caja")."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.base import HNDateTime, InputSchema, OutputSchema

DENOMINATION_KEYS = ("500", "200", "100", "50", "20", "10", "5", "2", "1")


class CashRegisterOut(OutputSchema):
    id: int
    code: str
    name: str
    active: bool


class CashOpenIn(InputSchema):
    cash_register_id: int | None = Field(default=None, ge=1)
    opening_cents: int = Field(ge=0, le=10_000_000_000)
    notes: str = Field(default="", max_length=500)


class BreakdownIn(InputSchema):
    bills: dict[str, int] = Field(default_factory=dict)
    coins_cents: int = Field(default=0, ge=0)

    @field_validator("bills")
    @classmethod
    def _bills(cls, v: dict[str, int]) -> dict[str, int]:
        for key, n in v.items():
            if key not in DENOMINATION_KEYS:
                raise ValueError(f"Denominación no válida: {key}.")
            if n < 0:
                raise ValueError("Las cantidades no pueden ser negativas.")
        return v


class CashCloseIn(InputSchema):
    counted_cents: int = Field(ge=0, le=10_000_000_000)
    notes: str = Field(default="", max_length=1000)
    breakdown: BreakdownIn | None = None


class UserRef(BaseModel):
    id: int
    name: str


class RegisterRef(BaseModel):
    id: int
    code: str
    name: str


class Blocker(BaseModel):
    code: str
    message: str
    count: int


class MethodTotals(BaseModel):
    cash: int
    transfer: int
    card: int
    other: int


class Reconciliation(BaseModel):
    opening_cents: int
    expected_cash_cents: int
    method_totals: MethodTotals
    payments_count: int
    payments_total_cents: int
    pending_count: int
    pending_cents: int
    missing_receipts_count: int
    can_close: bool
    blockers: list[Blocker]


class MovementOut(BaseModel):
    id: int
    type: Literal["opening", "payment", "payment_void", "closing"]
    method: str | None
    amount_cents: int
    notes: str
    occurred_at: HNDateTime
    payment_id: int | None
    invoice_id: int | None
    invoice_number: str | None
    reference: str
    user_id: int


class CashSessionOut(BaseModel):
    id: int
    status: Literal["open", "closed"]
    cash_register: RegisterRef
    user: UserRef
    opening_cents: int
    opening_notes: str
    opened_at: HNDateTime
    closed_at: HNDateTime | None
    closed_by: UserRef | None
    counted_cents: int | None
    expected_cash_cents: int | None
    difference_cents: int | None
    closing_notes: str
    closing_breakdown: dict[str, object] | None
    method_totals: dict[str, int] | None
    payments_count: int
    payments_total_cents: int
    reconciliation: Reconciliation | None = None
    movements: list[MovementOut] | None = None
