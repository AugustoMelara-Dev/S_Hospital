"""Audit trail helper (``audit_logs`` is insert-only).

Usage (inside the same transaction as the business change)::

    from app.core.audit import audit
    audit(db, user, "service.price_changed", entity=service, reason=data.reason,
          old={"price_cents": old}, new={"price_cents": service.price_cents},
          request=request)
    db.commit()

``audit`` only ``db.add``s the row; the caller commits (pass ``commit=True`` for
stand-alone events such as a failed login or a denied action).
Action naming: ``<domain>.<verb>`` e.g. ``auth.login``, ``invoice.issued``,
``cash.opened``, ``receipt.reprinted``. ``result``: success | failed | denied.
"""

from __future__ import annotations

from typing import Any

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.models.system import AuditLog
from app.models.users import User

Entity = Any  # ORM instance with ``__tablename__``/``id``, or a ``(type, id)`` tuple


def client_ip(request: Request | None) -> str | None:
    if request is None or request.client is None:
        return None
    return request.client.host[:45]


def _entity_ref(entity: Entity) -> tuple[str | None, int | None]:
    if entity is None:
        return None, None
    if isinstance(entity, tuple):
        etype, eid = entity
        return str(etype), (int(eid) if eid is not None else None)
    return getattr(entity, "__tablename__", type(entity).__name__), getattr(entity, "id", None)


def audit(
    db: Session,
    user: User | int | None,
    action: str,
    entity: Entity = None,
    result: str = "success",
    reason: str | None = None,
    old: dict[str, Any] | None = None,
    new: dict[str, Any] | None = None,
    request: Request | None = None,
    *,
    commit: bool = False,
) -> AuditLog:
    entity_type, entity_id = _entity_ref(entity)
    user_id = user.id if isinstance(user, User) else user
    log = AuditLog(
        user_id=user_id,
        action=action[:80],
        entity_type=entity_type,
        entity_id=entity_id,
        result=result,
        reason=(reason[:500] if reason else None),
        old_values=jsonable_encoder(old) if old is not None else None,
        new_values=jsonable_encoder(new) if new is not None else None,
        ip=client_ip(request),
    )
    db.add(log)
    if commit:
        db.commit()
    return log
