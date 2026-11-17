"""Public endpoints (no session).

GET /api/health         -> {status: "ok", version}
GET /api/branding       -> {hospital_name, slogan, has_logo}
GET /api/branding/logo  -> image bytes | 404
"""

from __future__ import annotations

from fastapi import APIRouter, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import undefer

from app.config import get_settings
from app.core.deps import DB
from app.core.errors import NotFoundError
from app.models.settings import SETTINGS_ID, Setting

router = APIRouter(tags=["public"])


class HealthOut(BaseModel):
    status: str
    version: str


class BrandingOut(BaseModel):
    hospital_name: str
    slogan: str
    has_logo: bool


@router.get("/health", response_model=HealthOut)
def health() -> HealthOut:
    return HealthOut(status="ok", version=get_settings().app_version)


@router.get("/branding", response_model=BrandingOut)
def branding(db: DB) -> BrandingOut:
    s = db.get(Setting, SETTINGS_ID)
    if s is None:
        return BrandingOut(hospital_name="", slogan="", has_logo=False)
    return BrandingOut(hospital_name=s.hospital_name, slogan=s.slogan, has_logo=s.has_logo)


@router.get("/branding/logo")
def branding_logo(db: DB) -> Response:
    s = db.scalar(select(Setting).where(Setting.id == SETTINGS_ID).options(undefer(Setting.logo)))
    if s is None or not s.logo or not s.logo_mime:
        raise NotFoundError("logo_not_found", "No hay logo configurado.")
    return Response(content=s.logo, media_type=s.logo_mime,
                    headers={"Cache-Control": "no-cache"})
