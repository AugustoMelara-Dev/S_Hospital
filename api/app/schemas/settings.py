"""Schemas for institutional settings, fiscal sequences (CAI) and tax rates."""

from __future__ import annotations

from datetime import date

from pydantic import Field

from app.schemas.base import HNDateTime, InputSchema, OutputSchema, Reason

# --- settings -----------------------------------------------------------------


class SettingsOut(OutputSchema):
    hospital_name: str
    rtn: str
    address: str
    phone: str
    slogan: str
    government_line: str
    secretariat_line: str
    receipt_location: str
    receipt_footer_text: str
    default_tax_rate_bp: int
    partial_payments_enabled: bool
    has_logo: bool
    logo_mime: str | None
    updated_at: HNDateTime


class SettingsUpdate(InputSchema):
    """Partial update: omitted (or null) fields keep their value.

    ``reason`` (>= 5 chars) is required when ``rtn`` changes.
    ``default_tax_rate_bp`` is not settable here: it follows the default tax rate.
    """

    hospital_name: str | None = Field(None, min_length=1, max_length=160)
    rtn: str | None = Field(None, max_length=20)
    address: str | None = Field(None, max_length=255)
    phone: str | None = Field(None, max_length=60)
    slogan: str | None = Field(None, max_length=160)
    government_line: str | None = Field(None, max_length=160)
    secretariat_line: str | None = Field(None, max_length=160)
    receipt_location: str | None = Field(None, max_length=160)
    receipt_footer_text: str | None = Field(None, max_length=2000)
    partial_payments_enabled: bool | None = None
    reason: str | None = Field(None, max_length=500)


# --- fiscal sequences -------------------------------------------------------------

SEQ_MAX = 99_999_999
PREFIX_PATTERN = r"^[0-9A-Za-z][0-9A-Za-z-]*$"


class FiscalSequenceIn(InputSchema):
    prefix: str = Field(min_length=1, max_length=32, pattern=PREFIX_PATTERN)
    cai: str = Field(min_length=1, max_length=128)
    min_number: int = Field(ge=1, le=SEQ_MAX)
    max_number: int = Field(ge=1, le=SEQ_MAX)
    current_number: int | None = Field(None, ge=0, le=SEQ_MAX)  # default: min_number - 1
    valid_until: date
    active: bool = True


class FiscalSequencePatch(InputSchema):
    prefix: str | None = Field(None, min_length=1, max_length=32, pattern=PREFIX_PATTERN)
    cai: str | None = Field(None, min_length=1, max_length=128)
    min_number: int | None = Field(None, ge=1, le=SEQ_MAX)
    max_number: int | None = Field(None, ge=1, le=SEQ_MAX)
    current_number: int | None = Field(None, ge=0, le=SEQ_MAX)
    valid_until: date | None = None
    active: bool | None = None
    reason: Reason


class FiscalSequenceOut(OutputSchema):
    id: int
    prefix: str
    cai: str
    min_number: int
    max_number: int
    current_number: int
    next_number: int | None
    next_number_formatted: str | None
    remaining: int
    valid_until: date
    active: bool
    expired: bool
    exhausted: bool
    low_range: bool
    created_at: HNDateTime
    updated_at: HNDateTime


# --- tax rates -------------------------------------------------------------------


class TaxRateIn(InputSchema):
    name: str = Field(min_length=1, max_length=60)
    rate_bp: int = Field(ge=0, le=9999)
    active: bool = True
    is_default: bool = False


class TaxRatePatch(InputSchema):
    name: str | None = Field(None, min_length=1, max_length=60)
    rate_bp: int | None = Field(None, ge=0, le=9999)
    active: bool | None = None
    is_default: bool | None = None
    reason: Reason


class TaxRateDelete(InputSchema):
    reason: Reason


class TaxRateOut(OutputSchema):
    id: int
    name: str
    rate_bp: int
    active: bool
    is_default: bool
    services_count: int = 0
