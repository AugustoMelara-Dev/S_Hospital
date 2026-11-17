"""Users, roles, permissions, sessions and login attempts."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.permissions import ADMIN_ROLE, ALL_PERMISSIONS
from app.core.timeutil import now_utc
from app.db import Base, BigId, UTCDateTime
from app.models.base import IdMixin, TimestampMixin


class Role(IdMixin, TimestampMixin, Base):
    __tablename__ = "roles"

    code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    role_permissions: Mapped[list[RolePermission]] = relationship(
        back_populates="role", cascade="all, delete-orphan", lazy="selectin"
    )

    @property
    def permissions(self) -> frozenset[str]:
        if self.code == ADMIN_ROLE:
            return ALL_PERMISSIONS
        return frozenset(rp.permission for rp in self.role_permissions)

    def set_permissions(self, perms: set[str] | frozenset[str]) -> None:
        current = {rp.permission: rp for rp in self.role_permissions}
        for code, rp in current.items():
            if code not in perms:
                self.role_permissions.remove(rp)
        for code in sorted(perms):
            if code not in current:
                self.role_permissions.append(RolePermission(permission=code))


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id: Mapped[int] = mapped_column(
        BigId, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )
    permission: Mapped[str] = mapped_column(String(60), primary_key=True)

    role: Mapped[Role] = relationship(back_populates="role_permissions")


class User(IdMixin, TimestampMixin, Base):
    __tablename__ = "users"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    username: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(160), unique=True, nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role_id: Mapped[int] = mapped_column(BigId, ForeignKey("roles.id"), nullable=False, index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)

    role: Mapped[Role] = relationship(lazy="joined")

    @property
    def permissions(self) -> frozenset[str]:
        return self.role.permissions if self.role else frozenset()

    def has_permission(self, code: str) -> bool:
        return code in self.permissions

    def has_any(self, *codes: str) -> bool:
        perms = self.permissions
        return any(c in perms for c in codes)

    def has_all(self, *codes: str) -> bool:
        perms = self.permissions
        return all(c in perms for c in codes)


class UserSession(IdMixin, TimestampMixin, Base):
    __tablename__ = "user_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    user_id: Mapped[int] = mapped_column(
        BigId, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_seen_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now_utc, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False, index=True)

    user: Mapped[User] = relationship(lazy="joined")


class LoginAttempt(IdMixin, TimestampMixin, Base):
    __tablename__ = "login_attempts"
    __table_args__ = (
        Index("ix_login_attempts_login_time", "login", "attempted_at"),
        Index("ix_login_attempts_ip_time", "ip", "attempted_at"),
    )

    login: Mapped[str] = mapped_column(String(160), nullable=False)
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    attempted_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now_utc, nullable=False)
