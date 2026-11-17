"""Catalog: categories, areas, services and price history."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.timeutil import now_utc
from app.db import Base, BigId, UTCDateTime
from app.models.base import IdMixin, TimestampMixin
from app.models.settings import TaxRate

ERYTHROPOIETIN_RULE = "ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION"


class Category(IdMixin, TimestampMixin, Base):
    __tablename__ = "categories"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(140), unique=True, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Area(IdMixin, TimestampMixin, Base):
    __tablename__ = "areas"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(140), unique=True, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Service(IdMixin, TimestampMixin, Base):
    __tablename__ = "services"
    __table_args__ = (
        UniqueConstraint("category_id", "slug", name="uq_services_category_slug"),
        CheckConstraint("price_cents >= 0", name="price_non_negative"),
    )

    category_id: Mapped[int] = mapped_column(
        BigId, ForeignKey("categories.id"), nullable=False, index=True
    )
    area_id: Mapped[int | None] = mapped_column(
        BigId, ForeignKey("areas.id"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(180), nullable=False)
    source_key: Mapped[str | None] = mapped_column(String(191), unique=True, nullable=True)
    aliases: Mapped[str] = mapped_column(Text, nullable=False, default="")
    description: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    price_cents: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    tax_rate_id: Mapped[int | None] = mapped_column(
        BigId, ForeignKey("tax_rates.id"), nullable=True, index=True
    )
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    visible_in_billing: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_billable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    special_rule_code: Mapped[str | None] = mapped_column(String(80), nullable=True)

    category: Mapped[Category] = relationship(lazy="joined")
    area: Mapped[Area | None] = relationship(lazy="joined")
    tax_rate: Mapped[TaxRate | None] = relationship(lazy="joined")

    @property
    def rate_bp(self) -> int:
        """Tax rate in basis points (0 when exempt)."""
        return self.tax_rate.rate_bp if self.tax_rate else 0


class ServicePriceHistory(IdMixin, TimestampMixin, Base):
    __tablename__ = "service_price_history"

    service_id: Mapped[int] = mapped_column(
        BigId, ForeignKey("services.id"), nullable=False, index=True
    )
    old_price_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    new_price_cents: Mapped[int] = mapped_column(BigInteger, nullable=False)
    reason: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    changed_by: Mapped[int | None] = mapped_column(BigId, ForeignKey("users.id"), nullable=True)
    changed_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now_utc, nullable=False)
