"""Helpers for settings / catalog / users tests (all commit when they write)."""

from __future__ import annotations

import itertools
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.text import slugify
from app.models import Area, AuditLog, Category, Service, TaxRate, UserSession

_seq = itertools.count(1)

REASON = "Ajuste autorizado por dirección"


def audits(db: Session, action: str, result: str = "success") -> list[AuditLog]:
    db.expire_all()
    return list(
        db.scalars(
            select(AuditLog)
            .where(AuditLog.action == action, AuditLog.result == result)
            .order_by(AuditLog.id)
        )
    )


def audit_count(db: Session, action: str) -> int:
    return len(audits(db, action))


def sessions_of(db: Session, user_id: int) -> int:
    return db.scalar(select(func.count(UserSession.id)).where(UserSession.user_id == user_id)) or 0


def make_category(db: Session, name: str | None = None, **extra: Any) -> Category:
    name = name or f"Categoría prueba {next(_seq)}"
    cat = Category(name=name, slug=slugify(name), **extra)
    db.add(cat)
    db.commit()
    return cat


def make_area(db: Session, name: str | None = None, **extra: Any) -> Area:
    name = name or f"Área prueba {next(_seq)}"
    area = Area(name=name, slug=slugify(name), **extra)
    db.add(area)
    db.commit()
    return area


def make_tax_rate(db: Session, name: str, rate_bp: int, **extra: Any) -> TaxRate:
    rate = TaxRate(name=name, rate_bp=rate_bp, **extra)
    db.add(rate)
    db.commit()
    return rate


def tax_rate_named(db: Session, name: str) -> TaxRate:
    rate = db.scalar(select(TaxRate).where(TaxRate.name == name))
    assert rate is not None
    return rate


def reload_service(db: Session, service_id: int) -> Service:
    db.expire_all()
    svc = db.get(Service, service_id)
    assert svc is not None
    return svc


def error_code(resp: Any) -> str:
    return str(resp.json()["error"]["code"])
