"""Auth schemas."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.base import InputSchema


class LoginIn(InputSchema):
    login: str = Field(min_length=1, max_length=160)
    password: str = Field(min_length=1, max_length=256)


class ChangePasswordIn(InputSchema):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=1, max_length=256)


class RoleRef(BaseModel):
    code: str
    name: str


class MeOut(BaseModel):
    id: int
    name: str
    username: str
    email: str | None
    role: RoleRef
    permissions: list[str]
    must_change_password: bool
