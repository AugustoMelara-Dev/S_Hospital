"""Ajustes institucionales, numeración fiscal e impuestos (SPEC §6 "Ajustes").

    GET    /api/settings                      settings.view   -> Settings
    PUT    /api/settings                      settings.update (parcial; motivo si cambia RTN)
    POST   /api/settings/logo   (multipart)   settings.update (campo ``file``; PNG/JPEG ≤ 2 MB)
    DELETE /api/settings/logo                 settings.update -> Settings
    GET    /api/fiscal-sequences              settings.view   -> lista (todas)
    POST   /api/fiscal-sequences              settings.update -> 201 FiscalSequence
    PATCH  /api/fiscal-sequences/{id}         settings.update (motivo)
    GET    /api/tax-rates                     settings.view   -> lista (todas)
    POST   /api/tax-rates                     settings.update -> 201 TaxRate
    PATCH  /api/tax-rates/{id}                settings.update (motivo)
    DELETE /api/tax-rates/{id}  {reason}      settings.update -> 204 (no si está en uso)

Short lookup lists are returned whole inside the SPEC list envelope
(``page=1``, ``per_page=total``).
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile

from app.core.deps import DB, require
from app.models.users import User
from app.schemas.settings import (
    FiscalSequenceIn,
    FiscalSequenceOut,
    FiscalSequencePatch,
    SettingsOut,
    SettingsUpdate,
    TaxRateDelete,
    TaxRateIn,
    TaxRateOut,
    TaxRatePatch,
)
from app.services import settings as svc

router = APIRouter(tags=["settings"])

Viewer = Annotated[User, Depends(require("settings.view"))]
Editor = Annotated[User, Depends(require("settings.update"))]


def full_list(items: list[Any]) -> dict[str, Any]:
    return {"items": items, "page": 1, "per_page": max(len(items), 1), "total": len(items)}


# --- settings -------------------------------------------------------------------


@router.get("/settings", response_model=SettingsOut)
def read_settings(db: DB, user: Viewer) -> SettingsOut:
    s = svc.get_settings_row(db)
    return svc.settings_out(s)


@router.put("/settings", response_model=SettingsOut)
def update_settings(data: SettingsUpdate, request: Request, db: DB, user: Editor) -> SettingsOut:
    return svc.settings_out(svc.update_settings(db, user, data, request))


@router.post("/settings/logo", response_model=SettingsOut)
async def upload_logo(
    request: Request, db: DB, user: Editor, file: UploadFile = File(...)
) -> SettingsOut:
    content = await file.read(svc.LOGO_MAX_BYTES + 1)
    return svc.settings_out(svc.set_logo(db, user, content, request))


@router.delete("/settings/logo", response_model=SettingsOut)
def delete_logo(request: Request, db: DB, user: Editor) -> SettingsOut:
    return svc.settings_out(svc.delete_logo(db, user, request))


# --- fiscal sequences -------------------------------------------------------------


@router.get("/fiscal-sequences")
def list_fiscal_sequences(db: DB, user: Viewer) -> dict[str, Any]:
    return full_list([svc.fiscal_out(s) for s in svc.list_fiscal_sequences(db)])


@router.post("/fiscal-sequences", status_code=201, response_model=FiscalSequenceOut)
def create_fiscal_sequence(
    data: FiscalSequenceIn, request: Request, db: DB, user: Editor
) -> FiscalSequenceOut:
    return svc.fiscal_out(svc.create_fiscal_sequence(db, user, data, request))


@router.patch("/fiscal-sequences/{seq_id}", response_model=FiscalSequenceOut)
def update_fiscal_sequence(
    seq_id: int, data: FiscalSequencePatch, request: Request, db: DB, user: Editor
) -> FiscalSequenceOut:
    return svc.fiscal_out(svc.update_fiscal_sequence(db, user, seq_id, data, request))


# --- tax rates -------------------------------------------------------------------


@router.get("/tax-rates")
def list_tax_rates(db: DB, user: Viewer) -> dict[str, Any]:
    return full_list(svc.list_tax_rates(db))


@router.post("/tax-rates", status_code=201, response_model=TaxRateOut)
def create_tax_rate(data: TaxRateIn, request: Request, db: DB, user: Editor) -> TaxRateOut:
    rate = svc.create_tax_rate(db, user, data, request)
    return svc.tax_rate_out(rate, {})


@router.patch("/tax-rates/{rate_id}", response_model=TaxRateOut)
def update_tax_rate(
    rate_id: int, data: TaxRatePatch, request: Request, db: DB, user: Editor
) -> TaxRateOut:
    rate = svc.update_tax_rate(db, user, rate_id, data, request)
    return svc.tax_rate_out(rate, {rate.id: svc.services_using(db, rate.id)})


@router.delete("/tax-rates/{rate_id}", status_code=204)
def delete_tax_rate(
    rate_id: int, data: TaxRateDelete, request: Request, db: DB, user: Editor
) -> Response:
    svc.delete_tax_rate(db, user, rate_id, data.reason, request)
    return Response(status_code=204)
