"""Reusable test factories. All helpers commit so API calls see the data."""

from __future__ import annotations

import itertools
from datetime import date, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.core.timeutil import hn_today
from app.models import (
    CashRegister,
    CashSession,
    Category,
    FiscalSequence,
    Role,
    Service,
    Setting,
    TaxRate,
    User,
)

DEFAULT_PASSWORD = "Prueba#Segura2026"
_seq = itertools.count(1)


def get_role(db: Session, code: str) -> Role:
    role = db.scalar(select(Role).where(Role.code == code))
    assert role is not None, f"role {code} not seeded"
    return role


def make_role(db: Session, code: str, permissions: set[str], name: str | None = None) -> Role:
    role = Role(code=code, name=name or code.title(), is_system=False)
    role.set_permissions(permissions)
    db.add(role)
    db.commit()
    return role


def make_user(
    db: Session,
    role_code: str = "cajero",
    *,
    username: str | None = None,
    name: str | None = None,
    email: str | None = None,
    password: str = DEFAULT_PASSWORD,
    active: bool = True,
    must_change_password: bool = False,
) -> User:
    n = next(_seq)
    user = User(
        name=name or f"Usuario {role_code} {n}",
        username=username or f"{role_code}{n}",
        email=email,
        password_hash=hash_password(password),
        role_id=get_role(db, role_code).id,
        active=active,
        must_change_password=must_change_password,
    )
    db.add(user)
    db.commit()
    return user


def make_fiscal_sequence(
    db: Session,
    *,
    prefix: str = "000-001-01",
    cai: str = "TEST-CAI-0000",
    min_number: int = 1,
    max_number: int = 99_999_999,
    current_number: int = 0,
    valid_until: date | None = None,
    active: bool = True,
) -> FiscalSequence:
    if active:
        for other in db.scalars(select(FiscalSequence).where(FiscalSequence.active.is_(True))):
            other.set_active(False)
        db.flush()
    seq = FiscalSequence(
        prefix=prefix, cai=cai, min_number=min_number, max_number=max_number,
        current_number=current_number, valid_until=valid_until or hn_today() + timedelta(days=30),
    )
    seq.set_active(active)
    db.add(seq)
    db.commit()
    return seq


def principal_register(db: Session) -> CashRegister:
    reg = db.scalar(select(CashRegister).where(CashRegister.code == "principal"))
    assert reg is not None
    return reg


def open_cash_session(db: Session, user: User, opening_cents: int = 0) -> CashSession:
    """Insert an open cash session directly (bypasses the cash service)."""
    sess = CashSession(
        cash_register_id=principal_register(db).id, user_id=user.id, opening_cents=opening_cents
    )
    sess.mark_open()
    db.add(sess)
    db.commit()
    return sess


def isv_rate(db: Session) -> TaxRate:
    rate = db.scalar(select(TaxRate).where(TaxRate.rate_bp == 1500))
    assert rate is not None
    return rate


def get_service(db: Session, name: str) -> Service:
    svc = db.scalar(select(Service).where(Service.name == name))
    assert svc is not None, f"service {name} not seeded"
    return svc


def make_service(
    db: Session,
    *,
    name: str | None = None,
    price_cents: int = 10_000,
    taxable: bool = True,
    category: Category | None = None,
    **extra: Any,
) -> Service:
    n = next(_seq)
    category = category or db.scalars(select(Category).order_by(Category.id)).first()
    assert category is not None
    svc = Service(
        category_id=category.id,
        name=name or f"Servicio prueba {n}",
        slug=f"servicio-prueba-{n}",
        price_cents=price_cents,
        tax_rate_id=isv_rate(db).id if taxable else None,
        **extra,
    )
    db.add(svc)
    db.commit()
    return svc


def update_settings(db: Session, **values: Any) -> Setting:
    s = db.get(Setting, 1)
    assert s is not None
    for k, v in values.items():
        setattr(s, k, v)
    db.commit()
    return s
