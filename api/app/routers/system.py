"""Sistema: auditoría, respaldos y estado.

    GET  /api/audit-logs?search&action&user_id&result&entity_type&entity_id&date_from&date_to&page
                                               audit.view
    GET  /api/backups?page                     backups.view   (+ last_success)
    POST /api/backups                          backups.create -> 202 (runs in a thread)
    GET  /api/backups/{id}/download            backups.download (audited)
    GET  /api/system/status                    system.status
"""

from __future__ import annotations

import shutil
from datetime import date
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session, aliased

from app.config import API_ROOT, get_settings
from app.core.audit import audit
from app.core.deps import DB, require
from app.core.pagination import PageParams, paginate
from app.core.timeutil import hn_day_bounds, iso_hn, now_utc
from app.db import get_engine
from app.models import (
    AuditLog,
    Backup,
    CashSession,
    InstitutionalReceipt,
    Invoice,
    Service,
    User,
)
from app.schemas.system import AuditLogOut, BackupOut, BackupPage
from app.services import backups

router = APIRouter(tags=["system"])

AuditViewer = Annotated[User, Depends(require("audit.view"))]
BackupViewer = Annotated[User, Depends(require("backups.view"))]
BackupCreator = Annotated[User, Depends(require("backups.create"))]
BackupDownloader = Annotated[User, Depends(require("backups.download"))]
StatusViewer = Annotated[User, Depends(require("system.status"))]


@router.get("/audit-logs", response_model=dict[str, Any])
def list_audit_logs(
    db: DB,
    user: AuditViewer,
    params: PageParams,
    search: Annotated[str | None, Query(max_length=120)] = None,
    action: Annotated[str | None, Query(max_length=80)] = None,
    user_id: Annotated[int | None, Query(ge=1)] = None,
    result: Literal["success", "failed", "denied"] | None = None,
    entity_type: Annotated[str | None, Query(max_length=60)] = None,
    entity_id: Annotated[int | None, Query(ge=1)] = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict[str, Any]:
    actor = aliased(User)
    stmt = select(AuditLog).outerjoin(actor, actor.id == AuditLog.user_id)
    if action:
        stmt = stmt.where(or_(AuditLog.action == action, AuditLog.action.like(f"{action}.%")))
    if user_id:
        stmt = stmt.where(AuditLog.user_id == user_id)
    if result:
        stmt = stmt.where(AuditLog.result == result)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(AuditLog.entity_id == entity_id)
    if date_from:
        stmt = stmt.where(AuditLog.created_at >= hn_day_bounds(date_from)[0])
    if date_to:
        stmt = stmt.where(AuditLog.created_at < hn_day_bounds(date_to)[1])
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(or_(
            AuditLog.action.ilike(like), AuditLog.reason.ilike(like),
            AuditLog.entity_type.ilike(like), actor.name.ilike(like),
            actor.username.ilike(like),
        ))
    page = paginate(db, stmt.order_by(AuditLog.id.desc()), params)
    page["items"] = [AuditLogOut(
        id=log.id, created_at=log.created_at, user_id=log.user_id,
        user_name=log.user.name if log.user else None,
        username=log.user.username if log.user else None,
        action=log.action, entity_type=log.entity_type, entity_id=log.entity_id,
        result=log.result, reason=log.reason, old_values=log.old_values,
        new_values=log.new_values, ip=log.ip,
    ) for log in page["items"]]
    return page


def _names(db: Session, ids: set[int]) -> dict[int, str]:
    ids.discard(0)
    if not ids:
        return {}
    return dict(db.execute(select(User.id, User.name).where(User.id.in_(ids))).all())


@router.get("/backups", response_model=BackupPage)
def list_backups(db: DB, user: BackupViewer, params: PageParams) -> dict[str, Any]:
    page = paginate(db, select(Backup).order_by(Backup.id.desc()), params)
    last = backups.last_success(db)
    ids = {b.created_by or 0 for b in page["items"]}
    if last is not None:
        ids.add(last.created_by or 0)
    names = _names(db, ids)
    page["items"] = [backups.backup_payload(b, names) for b in page["items"]]
    page["last_success"] = backups.backup_payload(last, names)
    return page


@router.post("/backups", response_model=BackupOut, status_code=202)
def create_backup(request: Request, db: DB, user: BackupCreator) -> dict[str, Any] | None:
    backup = backups.request_backup(db, user, "manual", request)
    backups.start_backup_thread(backup.id)
    return backups.backup_payload(backup, {user.id: user.name})


@router.get("/backups/{backup_id}/download")
def download_backup(backup_id: int, request: Request, db: DB, user: BackupDownloader
                    ) -> FileResponse:
    backup, path = backups.get_backup_file(db, backup_id)
    audit(db, user, "backup.downloaded", entity=backup, new={"filename": backup.filename},
          request=request, commit=True)
    return FileResponse(path, media_type="application/octet-stream", filename=backup.filename)


def _alembic_revisions(db: Session) -> tuple[str | None, str | None]:
    current = head = None
    try:
        current = db.scalar(text("SELECT version_num FROM alembic_version"))
    except Exception:
        db.rollback()
    try:
        from alembic.config import Config
        from alembic.script import ScriptDirectory

        cfg = Config(str(API_ROOT / "alembic.ini"))
        cfg.set_main_option("script_location", str(API_ROOT / "migrations"))
        head = ScriptDirectory.from_config(cfg).get_current_head()
    except Exception:
        head = None
    return current, head


@router.get("/system/status")
def system_status(db: DB, user: StatusViewer) -> dict[str, Any]:
    settings = get_settings()
    engine = get_engine()
    current, head = _alembic_revisions(db)
    disk: dict[str, Any] | None = None
    try:
        usage = shutil.disk_usage(backups.backup_dir())
        disk = {"path": str(backups.backup_dir()), "total_bytes": usage.total,
                "free_bytes": usage.free, "used_bytes": usage.used}
    except OSError:
        disk = None
    version_info = engine.dialect.server_version_info
    last = backups.last_success(db)
    count = lambda stmt: int(db.scalar(stmt) or 0)  # noqa: E731
    return {
        "version": settings.app_version,
        "server_time": iso_hn(now_utc()),
        "timezone": settings.tz,
        "database": {
            "dialect": engine.dialect.name,
            "server_version": ".".join(str(p) for p in version_info) if version_info else None,
            "migration": current,
            "migration_head": head,
            "up_to_date": (current == head) if current and head else None,
        },
        "disk": disk,
        "backups": {
            "last_success": backups.backup_payload(last),
            "dump_tool_available": backups.dump_tool() is not None
            if engine.dialect.name != "sqlite" else True,
            "dedicated_key": bool(settings.backup_key),
            "daily_time": settings.daily_backup_time,
        },
        "counts": {
            "users_active": count(select(func.count(User.id)).where(User.active.is_(True))),
            "services_active": count(select(func.count(Service.id))
                                     .where(Service.active.is_(True))),
            "invoices": count(select(func.count(Invoice.id))),
            "receipts": count(select(func.count(InstitutionalReceipt.id))),
            "open_cash_sessions": count(select(func.count(CashSession.id))
                                        .where(CashSession.status == "open")),
            "backups": count(select(func.count(Backup.id))),
        },
    }
