"""Authentication service: login with lockout, sessions, password change."""

from __future__ import annotations

from datetime import timedelta

from fastapi import Request
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.audit import audit, client_ip
from app.core.errors import ForbiddenError, LockedError, UnauthorizedError, ValidationFailedError
from app.core.security import (
    DUMMY_HASH,
    hash_password,
    hash_token,
    new_session_token,
    password_needs_rehash,
    validate_password_policy,
    verify_password,
)
from app.core.timeutil import now_utc
from app.models.users import LoginAttempt, User, UserSession
from app.schemas.auth import MeOut, RoleRef

INVALID_CREDENTIALS = "Usuario o contraseña incorrectos."


def normalize_login(login: str) -> str:
    return login.strip().lower()


def find_user_by_login(db: Session, login: str) -> User | None:
    norm = normalize_login(login)
    return db.scalar(
        select(User).where(
            or_(func.lower(User.username) == norm, func.lower(User.email) == norm)
        )
    )


def _failures_since(db: Session, column: object, value: str, since: object) -> int:
    return db.scalar(
        select(func.count(LoginAttempt.id)).where(
            column == value,  # type: ignore[operator]
            LoginAttempt.success.is_(False),
            LoginAttempt.attempted_at >= since,
        )
    ) or 0


def is_locked(db: Session, login: str, ip: str | None) -> bool:
    """5 failures of the same login, or 20 of the same IP, within 15 minutes.

    Failures before the last successful login of that login do not count.
    """
    cfg = get_settings()
    window_start = now_utc() - timedelta(minutes=cfg.login_lock_minutes)
    last_ok = db.scalar(
        select(func.max(LoginAttempt.attempted_at)).where(
            LoginAttempt.login == login, LoginAttempt.success.is_(True)
        )
    )
    since = max(window_start, last_ok) if last_ok else window_start
    if _failures_since(db, LoginAttempt.login, login, since) >= cfg.login_max_failures_per_login:
        return True
    return bool(ip) and _failures_since(db, LoginAttempt.ip, ip, window_start) >= (
        cfg.login_max_failures_per_ip
    )


def create_session(db: Session, user: User, request: Request | None) -> str:
    token = new_session_token()
    now = now_utc()
    db.add(
        UserSession(
            token_hash=hash_token(token),
            user_id=user.id,
            ip=client_ip(request),
            user_agent=(request.headers.get("user-agent", "")[:255] if request else None),
            last_seen_at=now,
            expires_at=now + timedelta(hours=get_settings().session_hours),
        )
    )
    return token


def login(db: Session, login_value: str, password: str, request: Request) -> tuple[User, str]:
    """Validate credentials and open a session. Returns ``(user, raw_token)``. Commits."""
    login_norm = normalize_login(login_value)[:160]
    ip = client_ip(request)

    if is_locked(db, login_norm, ip):
        audit(db, None, "auth.login", result="denied", reason="Bloqueo por intentos fallidos",
              new={"login": login_norm}, request=request, commit=True)
        raise LockedError()

    user = find_user_by_login(db, login_norm)
    ok = verify_password(user.password_hash if user else DUMMY_HASH, password)
    db.add(LoginAttempt(login=login_norm, ip=ip, success=ok and user is not None))

    if not ok or user is None:
        audit(db, user, "auth.login", entity=user, result="failed",
              reason="Credenciales inválidas", new={"login": login_norm}, request=request)
        db.commit()
        raise UnauthorizedError("invalid_credentials", INVALID_CREDENTIALS)

    if not user.active:
        audit(db, user, "auth.login", entity=user, result="denied", reason="Cuenta desactivada",
              request=request)
        db.commit()
        raise ForbiddenError("account_inactive",
                             "La cuenta está desactivada. Consulte con administración.")

    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
    user.last_login_at = now_utc()
    token = create_session(db, user, request)
    audit(db, user, "auth.login", entity=user, request=request)
    db.commit()
    return user, token


def logout(db: Session, token: str | None, request: Request) -> None:
    if not token:
        return
    sess = db.scalar(select(UserSession).where(UserSession.token_hash == hash_token(token)))
    if sess is None:
        return
    audit(db, sess.user_id, "auth.logout", entity=("users", sess.user_id), request=request)
    db.delete(sess)
    db.commit()


def change_password(
    db: Session,
    user: User,
    current_session: UserSession,
    current_password: str,
    new_password: str,
    request: Request,
) -> User:
    if not verify_password(user.password_hash, current_password):
        audit(db, user, "auth.password_changed", entity=user, result="failed",
              reason="Contraseña actual incorrecta", request=request, commit=True)
        raise ValidationFailedError(
            fields={"current_password": "La contraseña actual no es correcta."}
        )
    policy_error = validate_password_policy(new_password)
    if policy_error:
        raise ValidationFailedError(fields={"new_password": policy_error})
    if verify_password(user.password_hash, new_password):
        raise ValidationFailedError(
            fields={"new_password": "La nueva contraseña debe ser diferente de la actual."}
        )
    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    # Close every other session of this user.
    db.execute(
        delete(UserSession).where(
            UserSession.user_id == user.id, UserSession.id != current_session.id
        )
    )
    audit(db, user, "auth.password_changed", entity=user, request=request)
    db.commit()
    return user


def me_payload(user: User) -> MeOut:
    return MeOut(
        id=user.id,
        name=user.name,
        username=user.username,
        email=user.email,
        role=RoleRef(code=user.role.code, name=user.role.name),
        permissions=sorted(user.permissions),
        must_change_password=user.must_change_password,
    )
