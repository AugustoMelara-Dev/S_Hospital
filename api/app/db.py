"""Database engine, session factory, declarative ``Base`` and ``get_db``.

The engine is created lazily from ``SHS_DATABASE_URL``. Tests (or the CLI) can
rebind everything with :func:`init_engine`. Routers obtain a session with
``db: Session = Depends(get_db)``; the session is closed (not committed) at the
end of the request, so services/routers must ``db.commit()`` explicitly.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    DateTime,
    Dialect,
    Engine,
    Integer,
    LargeBinary,
    MetaData,
    create_engine,
    event,
)
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.types import TypeDecorator

from app.config import get_settings

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


# BIGINT on MySQL/MariaDB, INTEGER on SQLite (required for rowid autoincrement).
BigId = BigInteger().with_variant(Integer(), "sqlite")

# LONGBLOB on MySQL/MariaDB (logos, idempotent PDF bodies), BLOB elsewhere.
LongBlob = (
    LargeBinary()
    .with_variant(mysql.LONGBLOB(), "mysql")
    .with_variant(mysql.LONGBLOB(), "mariadb")
)


class UTCDateTime(TypeDecorator[datetime]):
    """Stores naive UTC in the DB; always returns timezone-aware UTC datetimes."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("UTCDateTime requiere datetimes con zona horaria")
        return value.astimezone(UTC).replace(tzinfo=None)

    def process_result_value(self, value: Any, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        if isinstance(value, str):  # defensive (SQLite raw strings)
            value = datetime.fromisoformat(value)
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


_engine: Engine | None = None
SessionLocal = sessionmaker(autoflush=False, expire_on_commit=False)


def make_engine(url: str) -> Engine:
    kwargs: dict[str, Any] = {"future": True, "pool_pre_ping": True}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        kwargs["pool_recycle"] = 3600
    engine = create_engine(url, **kwargs)
    if engine.dialect.name == "sqlite":

        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_conn: Any, _record: Any) -> None:
            cur = dbapi_conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.close()

    return engine


def init_engine(url: str | None = None) -> Engine:
    """(Re)create the global engine and bind ``SessionLocal`` to it."""
    global _engine
    if _engine is not None:
        _engine.dispose()
    _engine = make_engine(url or get_settings().resolved_database_url)
    SessionLocal.configure(bind=_engine)
    return _engine


def get_engine() -> Engine:
    return _engine if _engine is not None else init_engine()


def new_session() -> Session:
    get_engine()
    return SessionLocal()


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request (closed afterwards)."""
    db = new_session()
    try:
        yield db
    finally:
        db.close()
