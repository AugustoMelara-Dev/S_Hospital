"""Catálogo: categorías, áreas y servicios (SPEC §6 "Catálogo").

``catalog.view`` for reads, ``catalog.manage`` for writes::

    GET    /api/categories?active          -> lista completa (con services_count)
    POST   /api/categories                 -> 201
    PATCH  /api/categories/{id}            (motivo si cambia ``active``)
    GET    /api/areas?active | POST | PATCH /api/areas/{id}   (igual que categorías)
    GET    /api/services?search&category_id&area_id&active&billing=1&page&per_page
    GET    /api/services/export.csv?category_id   (UTF-8 con BOM)
    GET    /api/services/export.xlsx?category_id
    POST   /api/services/import?mode=preview|apply   (multipart: file, reason)
    PATCH  /api/services/bulk-tax          {category_id|service_ids, tax_rate_id|null, reason}
    GET    /api/services/{id}
    POST   /api/services                   -> 201
    PATCH  /api/services/{id}              (motivo si cambia precio, impuesto o disponibilidad)
    GET    /api/services/{id}/history?page&per_page
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, File, Form, Query, Request, Response, UploadFile

from app.core.deps import DB, require
from app.core.pagination import PageParams
from app.models.catalog import Area, Category
from app.models.users import User
from app.schemas.catalog import (
    BulkTaxIn,
    BulkTaxOut,
    GroupIn,
    GroupOut,
    GroupPatch,
    ImportReport,
    ServiceIn,
    ServiceOut,
    ServicePatch,
)
from app.services import catalog as svc

router = APIRouter(tags=["catalog"])

Viewer = Annotated[User, Depends(require("catalog.view"))]
Manager = Annotated[User, Depends(require("catalog.manage"))]


def _full_list(items: list[Any]) -> dict[str, Any]:
    return {"items": items, "page": 1, "per_page": max(len(items), 1), "total": len(items)}


# --- categories ------------------------------------------------------------------


@router.get("/categories")
def list_categories(db: DB, user: Viewer, active: bool | None = None) -> dict[str, Any]:
    return _full_list(svc.list_groups(db, Category, active))


@router.post("/categories", status_code=201, response_model=GroupOut)
def create_category(data: GroupIn, request: Request, db: DB, user: Manager) -> GroupOut:
    g = svc.create_group(db, user, Category, data, request)
    return svc.group_out(db, Category, g)


@router.patch("/categories/{category_id}", response_model=GroupOut)
def update_category(
    category_id: int, data: GroupPatch, request: Request, db: DB, user: Manager
) -> GroupOut:
    g = svc.update_group(db, user, Category, category_id, data, request)
    return svc.group_out(db, Category, g)


# --- areas -----------------------------------------------------------------------


@router.get("/areas")
def list_areas(db: DB, user: Viewer, active: bool | None = None) -> dict[str, Any]:
    return _full_list(svc.list_groups(db, Area, active))


@router.post("/areas", status_code=201, response_model=GroupOut)
def create_area(data: GroupIn, request: Request, db: DB, user: Manager) -> GroupOut:
    g = svc.create_group(db, user, Area, data, request)
    return svc.group_out(db, Area, g)


@router.patch("/areas/{area_id}", response_model=GroupOut)
def update_area(
    area_id: int, data: GroupPatch, request: Request, db: DB, user: Manager
) -> GroupOut:
    g = svc.update_group(db, user, Area, area_id, data, request)
    return svc.group_out(db, Area, g)


# --- services (static paths first) -------------------------------------------------


@router.get("/services")
def list_services(
    db: DB,
    user: Viewer,
    params: PageParams,
    search: str | None = Query(None, max_length=160),
    category_id: int | None = None,
    area_id: int | None = None,
    active: bool | None = None,
    billing: bool = False,
) -> dict[str, Any]:
    return svc.list_services(
        db, params, search=search, category_id=category_id, area_id=area_id, active=active,
        billing=billing,
    )


@router.get("/services/export.csv")
def export_csv(db: DB, user: Viewer, category_id: int | None = None) -> Response:
    return Response(
        content=svc.export_csv(db, category_id),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition":
                 f'attachment; filename="{svc.export_filename("csv")}"'},
    )


@router.get("/services/export.xlsx")
def export_xlsx(db: DB, user: Viewer, category_id: int | None = None) -> Response:
    return Response(
        content=svc.export_xlsx(db, category_id),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition":
                 f'attachment; filename="{svc.export_filename("xlsx")}"'},
    )


@router.post("/services/import", response_model=ImportReport)
async def import_services(
    request: Request,
    db: DB,
    user: Manager,
    mode: Literal["preview", "apply"] = Query("preview"),
    file: UploadFile = File(...),
    reason: str | None = Form(None, max_length=500),
) -> ImportReport:
    content = await file.read(svc.IMPORT_MAX_BYTES + 1)
    return svc.import_services(db, user, content, mode, reason, request)


@router.patch("/services/bulk-tax", response_model=BulkTaxOut)
def bulk_tax(data: BulkTaxIn, request: Request, db: DB, user: Manager) -> BulkTaxOut:
    ids = svc.bulk_tax(db, user, data, request)
    return BulkTaxOut(updated=len(ids), service_ids=ids)


@router.post("/services", status_code=201, response_model=ServiceOut)
def create_service(data: ServiceIn, request: Request, db: DB, user: Manager) -> ServiceOut:
    return svc.service_out(svc.create_service(db, user, data, request))


@router.get("/services/{service_id}", response_model=ServiceOut)
def get_service(service_id: int, db: DB, user: Viewer) -> ServiceOut:
    return svc.service_out(svc.get_service(db, service_id))


@router.patch("/services/{service_id}", response_model=ServiceOut)
def update_service(
    service_id: int, data: ServicePatch, request: Request, db: DB, user: Manager
) -> ServiceOut:
    return svc.service_out(svc.update_service(db, user, service_id, data, request))


@router.get("/services/{service_id}/history")
def service_history(service_id: int, db: DB, user: Viewer, params: PageParams) -> dict[str, Any]:
    return svc.price_history(db, service_id, params)
