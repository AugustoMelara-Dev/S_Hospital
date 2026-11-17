"""Authentication / authorization dependencies.

Typical router usage::

    from app.core.deps import CurrentUser, DB, require, require_any

    @router.get("/settings")
    def read_settings(db: DB, user: User = Depends(require("settings.view"))): ...

    @router.get("/reports/today")
    def today(db: DB, user: User = Depends(require_any("reports.own", "reports.all"))): ...

    @router.get("/something")
    def any_logged_user(user: CurrentUser): ...

- No/invalid/expired cookie or inactive user -> 401 ``unauthenticated``.
- ``must_change_password`` -> 403 ``password_change_required`` on every route
  except ``/api/auth/*``.
- Missing permission -> 403 ``forbidden``.
The session expiry slides: each request pushes ``expires_at`` to now + 12 h.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import timedelta
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import hash_token
from app.core.timeutil import now_utc
from app.db import get_db
from app.models.users import User, UserSession

SESSION_COOKIE = "shs_session"
_SLIDE_EVERY = timedelta(seconds=60)

DB = Annotated[Session, Depends(get_db)]


def load_session(db: Session, token: str | None) -> UserSession | None:
    """Return the valid (non-expired) session for a cookie value, if any."""
    if not token:
        return None
    sess = db.scalar(select(UserSession).where(UserSession.token_hash == hash_token(token)))
    if sess is None:
        return None
    if sess.expires_at <= now_utc():
        db.delete(sess)
        db.commit()
        return None
    return sess


def get_current_session(request: Request, db: DB) -> UserSession:
    sess = load_session(db, request.cookies.get(SESSION_COOKIE))
    if sess is None:
        raise UnauthorizedError()
    user = sess.user
    if user is None or not user.active:
        db.delete(sess)
        db.commit()
        raise UnauthorizedError("account_inactive", "La cuenta está desactivada.")
    now = now_utc()
    if now - sess.last_seen_at >= _SLIDE_EVERY:
        sess.last_seen_at = now
        sess.expires_at = now + timedelta(hours=get_settings().session_hours)
        db.commit()
    request.state.user = user
    request.state.session = sess
    return sess


def get_current_user(
    request: Request, sess: UserSession = Depends(get_current_session)
) -> User:
    user = sess.user
    if user.must_change_password and not request.url.path.startswith("/api/auth/"):
        raise ForbiddenError(
            "password_change_required",
            "Debe cambiar su contraseña antes de continuar.",
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require(*perms: str) -> Callable[..., User]:
    """Dependency: the current user must have ALL the given permissions."""

    def _dep(user: CurrentUser) -> User:
        if not user.has_all(*perms):
            raise ForbiddenError()
        return user

    _dep.__name__ = f"require_{'_'.join(perms)}".replace(".", "_")
    return _dep


def require_any(*perms: str) -> Callable[..., User]:
    """Dependency: the current user must have AT LEAST ONE of the given permissions."""

    def _dep(user: CurrentUser) -> User:
        if not user.has_any(*perms):
            raise ForbiddenError()
        return user

    _dep.__name__ = f"require_any_{'_'.join(perms)}".replace(".", "_")
    return _dep
