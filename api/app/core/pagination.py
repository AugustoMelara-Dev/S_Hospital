"""Pagination helpers producing the SPEC list envelope.

Usage::

    from app.core.pagination import PageParams, paginate

    @router.get("/things")
    def list_things(db: DB, params: PageParams, user=Depends(require("x.view"))):
        stmt = select(Thing).order_by(Thing.id.desc())
        return paginate(db, stmt, params, ThingOut)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Any

from fastapi import Depends, Query
from pydantic import BaseModel
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class PageQuery:
    page: int = 1
    per_page: int = 25

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.per_page


def _page_params(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=200),
) -> PageQuery:
    return PageQuery(page=page, per_page=per_page)


PageParams = Annotated[PageQuery, Depends(_page_params)]


def paginate(
    db: Session,
    stmt: Select[Any],
    params: PageQuery,
    schema: type[BaseModel] | None = None,
) -> dict[str, Any]:
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.scalars(stmt.limit(params.per_page).offset(params.offset)).unique().all()
    items: list[Any] = [schema.model_validate(r) for r in rows] if schema else list(rows)
    return {"items": items, "page": params.page, "per_page": params.per_page, "total": total}
