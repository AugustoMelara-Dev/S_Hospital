"""Users and roles administration.

Rules (SPEC §5.11 and §6 "Usuarios"):
- Password policy (>= 12 with lower, upper, digit, symbol); new users and resets get
  ``must_change_password``; a reset closes every session of that user.
- Nobody can change their own role nor deactivate themselves.
- The system never stays without an active ``admin`` user.
- Deactivating requires a reason and closes the user's sessions.
- System roles cannot be deleted (no delete endpoint); ``admin`` cannot be edited.
- Anti-escalation: an actor can only assign roles/permissions they already hold.
"""

from __future__ import annotations

from typing import Any

from fastapi import Request
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.errors import (
    BusinessRuleError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationFailedError,
)
from app.core.pagination import PageQuery, paginate
from app.core.permissions import ADMIN_ROLE, ALL_PERMISSIONS, permission_catalog
from app.core.security import hash_password, validate_password_policy
from app.core.text import collapse_spaces
from app.models.users import Role, User, UserSession
from app.schemas.users import (
    RoleCreate,
    RoleOut,
    RolePatch,
    RolesOut,
    UserCreate,
    UserOut,
    UserPatch,
)
from app.services.settings import require_reason

# --- helpers ---------------------------------------------------------------------


def _get_user(db: Session, user_id: int) -> User:
    u = db.get(User, user_id)
    if u is None:
        raise NotFoundError("user_not_found", "El usuario no existe.")
    return u


def _get_role(db: Session, role_id: int, field: str | None = None) -> Role:
    role = db.get(Role, role_id)
    if role is None:
        if field:
            raise ValidationFailedError(fields={field: "El rol no existe."})
        raise NotFoundError("role_not_found", "El rol no existe.")
    return role


def _ensure_can_grant(actor: User, perms: frozenset[str] | set[str]) -> None:
    missing = set(perms) - set(actor.permissions)
    if missing:
        raise ForbiddenError(
            "cannot_grant_permissions",
            "No puede asignar permisos que usted no tiene.",
        )


def _active_admins(db: Session, exclude_user_id: int | None = None) -> int:
    stmt = (
        select(func.count(User.id))
        .join(Role, Role.id == User.role_id)
        .where(Role.code == ADMIN_ROLE, User.active.is_(True))
    )
    if exclude_user_id is not None:
        stmt = stmt.where(User.id != exclude_user_id)
    return db.scalar(stmt) or 0


def _ensure_not_last_admin(db: Session, user: User) -> None:
    if user.role.code == ADMIN_ROLE and user.active and _active_admins(db, user.id) == 0:
        raise BusinessRuleError(
            "last_admin", "No se puede dejar el sistema sin un usuario administrador activo."
        )


def _close_sessions(db: Session, user_id: int) -> int:
    result = db.execute(delete(UserSession).where(UserSession.user_id == user_id))
    return int(getattr(result, "rowcount", 0) or 0)


def _check_password(password: str) -> None:
    error = validate_password_policy(password)
    if error:
        raise ValidationFailedError(fields={"password": error})


def _normalize_email(email: str | None) -> str | None:
    if email is None:
        return None
    email = email.strip().lower()
    if not email:
        return None
    local, _, domain = email.partition("@")
    if not local or "." not in domain or " " in email:
        raise ValidationFailedError(fields={"email": "El correo no es válido."})
    return email


def _ensure_unique(
    db: Session, username: str | None, email: str | None, exclude_id: int | None = None
) -> None:
    if username is not None:
        other = db.scalar(select(User).where(func.lower(User.username) == username.lower()))
        if other is not None and other.id != exclude_id:
            raise ConflictError("username_taken", "El nombre de usuario ya está en uso.")
    if email is not None:
        other = db.scalar(select(User).where(func.lower(User.email) == email))
        if other is not None and other.id != exclude_id:
            raise ConflictError("email_taken", "El correo ya está en uso.")


def user_out(u: User) -> UserOut:
    return UserOut.model_validate(u)


def _user_values(u: User) -> dict[str, Any]:
    return {"name": u.name, "username": u.username, "email": u.email, "role_id": u.role_id,
            "active": u.active}


# --- users ----------------------------------------------------------------------


def list_users(
    db: Session, params: PageQuery, search: str | None, role_id: int | None,
    active: bool | None,
) -> dict[str, Any]:
    stmt = select(User)
    if search and search.strip():
        like = f"%{search.strip().lower()}%"
        stmt = stmt.where(or_(
            func.lower(User.name).like(like),
            func.lower(User.username).like(like),
            func.lower(User.email).like(like),
        ))
    if role_id is not None:
        stmt = stmt.where(User.role_id == role_id)
    if active is not None:
        stmt = stmt.where(User.active.is_(active))
    stmt = stmt.order_by(User.active.desc(), User.name, User.id)
    return paginate(db, stmt, params, UserOut)


def get_user(db: Session, user_id: int) -> User:
    return _get_user(db, user_id)


def create_user(db: Session, actor: User, data: UserCreate, request: Request | None) -> User:
    role = _get_role(db, data.role_id, field="role_id")
    _ensure_can_grant(actor, role.permissions)
    _check_password(data.password)
    username = data.username.lower()
    email = _normalize_email(data.email)
    _ensure_unique(db, username, email)
    u = User(
        name=collapse_spaces(data.name), username=username, email=email,
        password_hash=hash_password(data.password), role_id=role.id, active=True,
        must_change_password=True,
    )
    db.add(u)
    db.flush()
    audit(db, actor, "user.created", entity=u,
          new={**_user_values(u), "role": role.code}, request=request)
    db.commit()
    db.refresh(u)
    return u


def update_user(
    db: Session, actor: User, user_id: int, data: UserPatch, request: Request | None
) -> User:
    u = _get_user(db, user_id)
    fields = data.model_dump(exclude_unset=True, exclude={"reason"})
    values: dict[str, Any] = {}
    if fields.get("name") is not None:
        values["name"] = collapse_spaces(fields["name"])
    if fields.get("username") is not None:
        values["username"] = fields["username"].lower()
    if "email" in fields:
        values["email"] = _normalize_email(fields["email"])
    if fields.get("role_id") is not None:
        values["role_id"] = fields["role_id"]
    old = _user_values(u)
    changed = {k: v for k, v in values.items() if old[k] != v}
    if not changed:
        return u
    if "role_id" in changed:
        if u.id == actor.id:
            raise BusinessRuleError("cannot_change_own_role", "No puede cambiar su propio rol.")
        new_role = _get_role(db, changed["role_id"], field="role_id")
        _ensure_can_grant(actor, new_role.permissions)
        if u.role.code == ADMIN_ROLE and new_role.code != ADMIN_ROLE:
            _ensure_not_last_admin(db, u)
    if "username" in changed or "email" in changed:
        _ensure_unique(db, changed.get("username"), changed.get("email"), exclude_id=u.id)
    old_role = u.role.code
    for k, v in changed.items():
        setattr(u, k, v)
    db.flush()
    db.refresh(u)
    audit(db, actor, "user.updated", entity=u, reason=data.reason or None,
          old={k: old[k] for k in changed}, new=changed, request=request)
    if "role_id" in changed:
        audit(db, actor, "user.role_changed", entity=u, reason=data.reason or None,
              old={"role": old_role}, new={"role": u.role.code}, request=request)
    db.commit()
    return u


def toggle_active(
    db: Session, actor: User, user_id: int, reason: str | None, request: Request | None
) -> User:
    u = _get_user(db, user_id)
    if u.active:
        if u.id == actor.id:
            raise BusinessRuleError(
                "cannot_deactivate_self", "No puede desactivar su propia cuenta."
            )
        reason = require_reason(reason)
        _ensure_not_last_admin(db, u)
        u.active = False
        closed = _close_sessions(db, u.id)
        audit(db, actor, "user.deactivated", entity=u, reason=reason,
              old={"active": True}, new={"active": False, "sessions_closed": closed},
              request=request)
    else:
        _ensure_can_grant(actor, u.role.permissions)
        u.active = True
        audit(db, actor, "user.activated", entity=u, reason=(reason or None),
              old={"active": False}, new={"active": True}, request=request)
    db.commit()
    return u


def reset_password(
    db: Session, actor: User, user_id: int, password: str, reason: str,
    request: Request | None,
) -> User:
    u = _get_user(db, user_id)
    reason = require_reason(reason)
    _ensure_can_grant(actor, u.role.permissions)
    _check_password(password)
    u.password_hash = hash_password(password)
    u.must_change_password = True
    closed = _close_sessions(db, u.id)
    audit(db, actor, "user.password_reset", entity=u, reason=reason,
          new={"must_change_password": True, "sessions_closed": closed}, request=request)
    db.commit()
    return u


# --- roles ----------------------------------------------------------------------


def _role_out(role: Role, users_count: int) -> RoleOut:
    return RoleOut(
        id=role.id, code=role.code, name=role.name, is_system=role.is_system,
        editable=role.code != ADMIN_ROLE, permissions=sorted(role.permissions),
        users_count=users_count,
    )


def _users_per_role(db: Session) -> dict[int, int]:
    rows = db.execute(select(User.role_id, func.count(User.id)).group_by(User.role_id)).all()
    return {int(r): int(n) for r, n in rows}


def list_roles(db: Session) -> RolesOut:
    counts = _users_per_role(db)
    roles = list(db.scalars(select(Role).order_by(Role.is_system.desc(), Role.name)))
    items = [_role_out(r, counts.get(r.id, 0)) for r in roles]
    return RolesOut(items=items, page=1, per_page=max(len(items), 1), total=len(items),
                    permission_catalog=permission_catalog())


def role_out(db: Session, role: Role) -> RoleOut:
    return _role_out(role, _users_per_role(db).get(role.id, 0))


def _clean_permissions(perms: list[str]) -> set[str]:
    unknown = sorted(p for p in perms if p not in ALL_PERMISSIONS)
    if unknown:
        raise ValidationFailedError(
            fields={"permissions": f"Permisos desconocidos: {', '.join(unknown)}."}
        )
    return set(perms)


def create_role(db: Session, actor: User, data: RoleCreate, request: Request | None) -> Role:
    perms = _clean_permissions(data.permissions)
    _ensure_can_grant(actor, perms)
    if db.scalar(select(Role).where(Role.code == data.code)) is not None:
        raise ConflictError("role_code_taken", "Ya existe un rol con ese código.")
    role = Role(code=data.code, name=collapse_spaces(data.name), is_system=False)
    role.set_permissions(perms)
    db.add(role)
    db.flush()
    audit(db, actor, "role.created", entity=role,
          new={"code": role.code, "name": role.name, "permissions": sorted(perms)},
          request=request)
    db.commit()
    return role


def update_role(
    db: Session, actor: User, role_id: int, data: RolePatch, request: Request | None
) -> Role:
    role = _get_role(db, role_id)
    if role.code == ADMIN_ROLE:
        raise BusinessRuleError("role_not_editable", "El rol de Administración no se puede editar.")
    old: dict[str, Any] = {}
    new: dict[str, Any] = {}
    if data.name is not None and collapse_spaces(data.name) != role.name:
        old["name"], new["name"] = role.name, collapse_spaces(data.name)
    if data.permissions is not None:
        perms = _clean_permissions(data.permissions)
        current = set(role.permissions)
        if perms != current:
            if actor.role_id == role.id:
                raise BusinessRuleError(
                    "cannot_edit_own_role", "No puede modificar los permisos de su propio rol."
                )
            _ensure_can_grant(actor, perms - current)
            old["permissions"], new["permissions"] = sorted(current), sorted(perms)
    if not new:
        return role
    if "name" in new:
        role.name = new["name"]
    if "permissions" in new:
        role.set_permissions(set(new["permissions"]))
    audit(db, actor, "role.updated", entity=role, reason=data.reason or None, old=old, new=new,
          request=request)
    db.commit()
    db.refresh(role)
    return role
