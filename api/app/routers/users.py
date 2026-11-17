"""Usuarios y roles (SPEC §6 "Usuarios"). ``users.view`` reads, ``users.manage`` writes::

    GET    /api/users?search&role_id&active&page&per_page   -> lista paginada
    GET    /api/users/{id}
    POST   /api/users                           -> 201 (must_change_password=true)
    PATCH  /api/users/{id}                      {name?, username?, email?, role_id?, reason?}
    POST   /api/users/{id}/toggle-active        {reason}  (obligatorio al desactivar)
    POST   /api/users/{id}/reset-password       {password, reason}
    GET    /api/roles        -> {items, page, per_page, total, permission_catalog}
    POST   /api/roles                           -> 201 {code, name, permissions[]}
    PATCH  /api/roles/{id}                      {name?, permissions?, reason?}
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Request

from app.core.deps import DB, require
from app.core.pagination import PageParams
from app.models.users import User
from app.schemas.users import (
    ResetPasswordIn,
    RoleCreate,
    RoleOut,
    RolePatch,
    RolesOut,
    ToggleActiveIn,
    UserCreate,
    UserOut,
    UserPatch,
)
from app.services import users as svc

router = APIRouter(tags=["users"])

Viewer = Annotated[User, Depends(require("users.view"))]
Manager = Annotated[User, Depends(require("users.manage"))]


@router.get("/users")
def list_users(
    db: DB,
    user: Viewer,
    params: PageParams,
    search: str | None = Query(None, max_length=120),
    role_id: int | None = None,
    active: bool | None = None,
) -> dict[str, Any]:
    return svc.list_users(db, params, search, role_id, active)


@router.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: DB, user: Viewer) -> UserOut:
    return svc.user_out(svc.get_user(db, user_id))


@router.post("/users", status_code=201, response_model=UserOut)
def create_user(data: UserCreate, request: Request, db: DB, user: Manager) -> UserOut:
    return svc.user_out(svc.create_user(db, user, data, request))


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int, data: UserPatch, request: Request, db: DB, user: Manager
) -> UserOut:
    return svc.user_out(svc.update_user(db, user, user_id, data, request))


@router.post("/users/{user_id}/toggle-active", response_model=UserOut)
def toggle_active(
    user_id: int, data: ToggleActiveIn, request: Request, db: DB, user: Manager
) -> UserOut:
    return svc.user_out(svc.toggle_active(db, user, user_id, data.reason, request))


@router.post("/users/{user_id}/reset-password", response_model=UserOut)
def reset_password(
    user_id: int, data: ResetPasswordIn, request: Request, db: DB, user: Manager
) -> UserOut:
    return svc.user_out(
        svc.reset_password(db, user, user_id, data.password, data.reason, request)
    )


@router.get("/roles", response_model=RolesOut)
def list_roles(db: DB, user: Viewer) -> RolesOut:
    return svc.list_roles(db)


@router.post("/roles", status_code=201, response_model=RoleOut)
def create_role(data: RoleCreate, request: Request, db: DB, user: Manager) -> RoleOut:
    return svc.role_out(db, svc.create_role(db, user, data, request))


@router.patch("/roles/{role_id}", response_model=RoleOut)
def update_role(
    role_id: int, data: RolePatch, request: Request, db: DB, user: Manager
) -> RoleOut:
    return svc.role_out(db, svc.update_role(db, user, role_id, data, request))
