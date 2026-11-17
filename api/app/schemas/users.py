"""Schemas for users and roles."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.schemas.base import HNDateTime, InputSchema, OutputSchema, Reason

USERNAME_PATTERN = r"^[A-Za-z0-9._-]{3,60}$"
ROLE_CODE_PATTERN = r"^[a-z][a-z0-9_]{1,39}$"


class UserRoleRef(OutputSchema):
    id: int
    code: str
    name: str


class UserOut(OutputSchema):
    id: int
    name: str
    username: str
    email: str | None
    role: UserRoleRef
    active: bool
    must_change_password: bool
    last_login_at: HNDateTime | None


class UserCreate(InputSchema):
    name: str = Field(min_length=1, max_length=120)
    username: str = Field(pattern=USERNAME_PATTERN)
    email: str | None = Field(None, max_length=160)
    password: str = Field(min_length=1, max_length=256)
    role_id: int


class UserPatch(InputSchema):
    name: str | None = Field(None, min_length=1, max_length=120)
    username: str | None = Field(None, pattern=USERNAME_PATTERN)
    email: str | None = Field(None, max_length=160)  # "" or null clears it
    role_id: int | None = None
    reason: str | None = Field(None, max_length=500)


class ToggleActiveIn(InputSchema):
    """``reason`` (>= 5) is required when deactivating."""

    reason: str | None = Field(None, max_length=500)


class ResetPasswordIn(InputSchema):
    password: str = Field(min_length=1, max_length=256)
    reason: Reason


class RoleOut(BaseModel):
    id: int
    code: str
    name: str
    is_system: bool
    editable: bool
    permissions: list[str]
    users_count: int


class RolesOut(BaseModel):
    items: list[RoleOut]
    page: int
    per_page: int
    total: int
    permission_catalog: list[dict[str, Any]]


class RoleCreate(InputSchema):
    code: str = Field(pattern=ROLE_CODE_PATTERN)
    name: str = Field(min_length=1, max_length=80)
    permissions: list[str] = Field(default_factory=list, max_length=200)


class RolePatch(InputSchema):
    name: str | None = Field(None, min_length=1, max_length=80)
    permissions: list[str] | None = Field(None, max_length=200)
    reason: str | None = Field(None, max_length=500)
