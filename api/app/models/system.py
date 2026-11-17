"""Audit logs (insert-only), idempotency keys and backups."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    event,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, BigId, LongBlob, UTCDateTime
from app.models.base import IdMixin, TimestampMixin
from app.models.users import User


class AuditLog(IdMixin, TimestampMixin, Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_created", "created_at"),
        Index("ix_audit_logs_action_created", "action", "created_at"),
        Index("ix_audit_logs_entity", "entity_type", "entity_id"),
    )

    user_id: Mapped[int | None] = mapped_column(
        BigId, ForeignKey("users.id"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(60), nullable=True)
    entity_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    result: Mapped[str] = mapped_column(String(10), nullable=False, default="success")
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    old_values: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    new_values: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)

    user: Mapped[User | None] = relationship(lazy="joined")


@event.listens_for(AuditLog, "before_update")
@event.listens_for(AuditLog, "before_delete")
def _audit_is_insert_only(*_args: Any) -> None:
    raise RuntimeError("audit_logs es de solo inserción")


class IdempotencyKey(IdMixin, TimestampMixin, Base):
    """Stored responses for [IDEM] endpoints. ``status_code == 0`` means in progress."""

    __tablename__ = "idempotency_keys"
    __table_args__ = (UniqueConstraint("user_id", "route", "key", name="uq_idempotency_keys"),)

    user_id: Mapped[int] = mapped_column(
        BigId, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    route: Mapped[str] = mapped_column(String(255), nullable=False)
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    status_code: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    headers: Mapped[dict[str, str] | None] = mapped_column(JSON, nullable=True)
    body: Mapped[bytes | None] = mapped_column(LongBlob, nullable=True)


class Backup(IdMixin, TimestampMixin, Base):
    __tablename__ = "backups"

    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="pending")
    kind: Mapped[str] = mapped_column(String(10), nullable=False, default="manual")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int | None] = mapped_column(BigId, ForeignKey("users.id"), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
