"""Receipt, receipt series and print profile schemas."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.base import HNDateTime, InputSchema, OutputSchema, Reason

HexColor = Annotated[str, Field(pattern=r"^#[0-9a-fA-F]{6}$")]
CopiesMode = Literal["original_only", "original_first", "original_first_second"]


class PrintEventOut(BaseModel):
    type: str
    reason: str
    profile_code: str | None
    user_name: str | None
    created_at: HNDateTime


class ReceiptOut(BaseModel):
    id: int
    invoice_id: int
    invoice_number: str | None
    number_full: str
    status: str
    amount_cents: int
    amount_words: str
    payer_name: str
    cash_session_id: int | None
    issued_by: int
    issued_by_name: str | None
    issued_at: HNDateTime
    reprint_count: int
    printed: bool
    voided_at: HNDateTime | None
    void_reason: str | None
    events: list[PrintEventOut]


class ReprintIn(InputSchema):
    reason: Reason
    profile: str | None = Field(default=None, max_length=40)


class ReceiptSeriesOut(OutputSchema):
    id: int
    series: str
    prefix: str
    min_number: int
    max_number: int
    current_number: int
    range_authorization: str
    legal_text: str
    number_color: str
    active: bool


class ReceiptSeriesIn(InputSchema):
    series: str = Field(min_length=1, max_length=32, pattern=r"^[A-Za-z0-9-]+$")
    prefix: str = Field(default="", max_length=32)
    min_number: int = Field(default=1, ge=1)
    max_number: int = Field(ge=1, le=99_999_999)
    current_number: int = Field(default=0, ge=0)
    range_authorization: str = Field(default="", max_length=128)
    legal_text: str = Field(default="", max_length=2000)
    number_color: HexColor = "#b91c1c"
    active: bool = False

    @model_validator(mode="after")
    def _ranges(self) -> ReceiptSeriesIn:
        if self.max_number < self.min_number:
            raise ValueError("El número final debe ser mayor o igual que el inicial.")
        if self.current_number > self.max_number:
            raise ValueError("El correlativo actual no puede superar el número final.")
        return self


class ReceiptSeriesPatch(InputSchema):
    prefix: str | None = Field(default=None, max_length=32)
    max_number: int | None = Field(default=None, ge=1, le=99_999_999)
    current_number: int | None = Field(default=None, ge=0)
    range_authorization: str | None = Field(default=None, max_length=128)
    legal_text: str | None = Field(default=None, max_length=2000)
    number_color: HexColor | None = None
    active: bool | None = None
    reason: str | None = Field(default=None, max_length=500)


class PrintProfileOut(OutputSchema):
    id: int
    code: str
    name: str
    paper: str
    width_mm: float
    height_mm: float
    margins_mm: float
    copies_mode: str
    show_seal_space: bool
    use_logo: bool
    active: bool
    is_default: bool
    allowed_for_institutional: bool


class PrintProfilePatch(InputSchema):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    margins_mm: float | None = Field(default=None, ge=0, le=40)
    copies_mode: CopiesMode | None = None
    show_seal_space: bool | None = None
    use_logo: bool | None = None
    active: bool | None = None
    is_default: bool | None = None


class ReceiptSettingsOut(BaseModel):
    series: list[ReceiptSeriesOut]
    profiles: list[PrintProfileOut]


class DraftItemIn(InputSchema):
    service_id: int = Field(ge=1)
    quantity_hundredths: int = Field(ge=1, le=10_000_000)


class DraftReceiptIn(InputSchema):
    patient_name: str = Field(default="", max_length=180)
    items: list[DraftItemIn] = Field(min_length=1, max_length=100)
    dialysis_prescription: bool = False
    profile: str | None = Field(default=None, max_length=40)
