"""System schemas: audit log rows and backups."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from app.schemas.base import HNDateTime


class AuditLogOut(BaseModel):
    id: int
    created_at: HNDateTime
    user_id: int | None
    user_name: str | None
    username: str | None
    action: str
    entity_type: str | None
    entity_id: int | None
    result: str
    reason: str | None
    old_values: dict[str, Any] | None
    new_values: dict[str, Any] | None
    ip: str | None


class BackupOut(BaseModel):
    id: int
    filename: str
    size_bytes: int | None
    sha256: str | None
    status: str
    kind: str
    error: str | None
    created_by: int | None
    created_by_name: str | None
    created_at: HNDateTime
    completed_at: HNDateTime | None


class BackupPage(BaseModel):
    items: list[BackupOut]
    page: int
    per_page: int
    total: int
    last_success: BackupOut | None
