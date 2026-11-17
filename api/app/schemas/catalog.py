"""Schemas for the catalog: categories, areas, services, price history, import."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, model_validator

from app.schemas.base import HNDateTime, InputSchema, OutputSchema, Reason

# --- categories / areas -------------------------------------------------------------


class GroupIn(InputSchema):
    name: str = Field(min_length=1, max_length=120)
    sort_order: int = Field(0, ge=0, le=100_000)
    active: bool = True


class GroupPatch(InputSchema):
    """``reason`` (>= 5) is required when ``active`` changes."""

    name: str | None = Field(None, min_length=1, max_length=120)
    sort_order: int | None = Field(None, ge=0, le=100_000)
    active: bool | None = None
    reason: str | None = Field(None, max_length=500)


class GroupOut(OutputSchema):
    id: int
    name: str
    slug: str
    active: bool
    sort_order: int
    services_count: int = 0


# --- services -------------------------------------------------------------------


class Ref(OutputSchema):
    id: int
    name: str


class TaxRateRef(OutputSchema):
    id: int
    name: str
    rate_bp: int


class ServiceOut(OutputSchema):
    id: int
    name: str
    category: Ref
    area: Ref | None
    price_cents: int
    tax_rate: TaxRateRef | None
    active: bool
    visible_in_billing: bool
    is_billable: bool
    special_rule_code: str | None
    aliases: str
    description: str
    updated_at: HNDateTime


class ServiceIn(InputSchema):
    """``tax_rate_id`` omitted -> default tax rate; ``null`` -> exento.

    ``special_rule_code`` is intentionally absent (cannot be set via API).
    """

    name: str = Field(min_length=1, max_length=160)
    category_id: int
    area_id: int | None = None
    price_cents: int = Field(ge=0, le=99_999_999_99)
    tax_rate_id: int | None = None
    active: bool = True
    visible_in_billing: bool = True
    is_billable: bool = True
    description: str = Field("", max_length=255)
    aliases: str = Field("", max_length=2000)


class ServicePatch(InputSchema):
    """Partial update. ``reason`` (>= 5) is required when price, tax or availability
    (active / visible_in_billing / is_billable) change. ``area_id``/``tax_rate_id``
    accept ``null`` (no area / exento)."""

    name: str | None = Field(None, min_length=1, max_length=160)
    category_id: int | None = None
    area_id: int | None = None
    price_cents: int | None = Field(None, ge=0, le=99_999_999_99)
    tax_rate_id: int | None = None
    active: bool | None = None
    visible_in_billing: bool | None = None
    is_billable: bool | None = None
    description: str | None = Field(None, max_length=255)
    aliases: str | None = Field(None, max_length=2000)
    reason: str | None = Field(None, max_length=500)


class PriceHistoryOut(BaseModel):
    id: int
    old_price_cents: int
    new_price_cents: int
    reason: str
    changed_by: Ref | None
    changed_at: HNDateTime


class BulkTaxIn(InputSchema):
    category_id: int | None = None
    service_ids: list[int] | None = Field(None, min_length=1, max_length=5000)
    tax_rate_id: int | None
    reason: Reason

    @model_validator(mode="after")
    def _one_target(self) -> BulkTaxIn:
        if (self.category_id is None) == (self.service_ids is None):
            raise ValueError("Indique category_id o service_ids (solo uno).")
        return self


class BulkTaxOut(BaseModel):
    updated: int
    service_ids: list[int]


# --- import ----------------------------------------------------------------------


class ImportLine(BaseModel):
    line: int
    category: str
    name: str
    action: str  # create | update | unchanged | error
    service_id: int | None = None
    new_category: bool = False
    changes: dict[str, dict[str, Any]] = {}
    errors: list[str] = []


class ImportSummary(BaseModel):
    total: int
    create: int
    update: int
    unchanged: int
    error: int
    new_categories: list[str]


class ImportReport(BaseModel):
    mode: str
    applied: bool
    summary: ImportSummary
    lines: list[ImportLine]
