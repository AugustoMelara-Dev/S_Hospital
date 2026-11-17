"""Shared pytest fixtures.

Every test gets a fresh SQLite database (copied from a template that was built
once with ``Base.metadata.create_all`` + the non-demo seeder: roles, settings,
tax rates, areas, catalog, print profiles, receipt series, cash register).

Fixtures:
- ``db``: SQLAlchemy session bound to the per-test database.
- ``app``: a fresh FastAPI app (``create_app()``); add test-only routes freely.
- ``client``: ``TestClient`` sending ``X-Requested-With: shospital`` by default.
- ``login_as(role_code, **user_kwargs) -> User``: creates a user with that role
  (see ``tests.factories.make_user``) and logs ``client`` in as that user.
- ``make_client()``: an extra independent client (another browser).
Factories for other domains live in ``tests/factories.py``.
"""

from __future__ import annotations

import os
import shutil
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import pytest

os.environ["SHS_WEB_DIST"] = str(Path(__file__).parent / "_no_web_dist")
os.environ.setdefault("SHS_SECRET_KEY", "test-secret")
os.environ["SHS_DAILY_BACKUP_TIME"] = "off"  # no background scheduler in tests

from app.config import get_settings

get_settings.cache_clear()

from fastapi import APIRouter, Depends, FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

import app.models  # noqa: E402
from app.core.deps import CurrentUser, require, require_any  # noqa: E402
from app.core.security import configure_hasher  # noqa: E402
from app.db import Base, init_engine, new_session  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models import User  # noqa: E402
from app.seed.seeder import seed  # noqa: E402
from tests.factories import DEFAULT_PASSWORD, make_user  # noqa: E402

# Cheap argon2 parameters keep the suite fast; production uses library defaults.
configure_hasher(time_cost=1, memory_cost=64, parallelism=1)

CSRF_HEADERS = {"X-Requested-With": "shospital"}


def _sqlite_url(path: Path) -> str:
    return f"sqlite:///{path.as_posix()}"


@pytest.fixture(scope="session")
def template_db(tmp_path_factory: pytest.TempPathFactory) -> Path:
    path = tmp_path_factory.mktemp("template") / "template.db"
    engine = init_engine(_sqlite_url(path))
    Base.metadata.create_all(engine)
    with new_session() as db:
        seed(db, demo=False)
    engine.dispose()
    return path


@pytest.fixture(autouse=True)
def _database(template_db: Path, tmp_path: Path) -> Iterator[None]:
    path = tmp_path / "test.db"
    shutil.copyfile(template_db, path)
    engine = init_engine(_sqlite_url(path))
    yield
    engine.dispose()


@pytest.fixture
def db() -> Iterator[Session]:
    session = new_session()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def app() -> FastAPI:
    return create_app()


@pytest.fixture
def make_client(app: FastAPI) -> Iterator[Callable[[], TestClient]]:
    clients: list[TestClient] = []

    def _make() -> TestClient:
        c = TestClient(app, headers=CSRF_HEADERS)
        c.__enter__()
        clients.append(c)
        return c

    yield _make
    for c in clients:
        c.__exit__(None, None, None)


@pytest.fixture
def client(make_client: Callable[[], TestClient]) -> TestClient:
    return make_client()


def login(client: TestClient, login_value: str, password: str = DEFAULT_PASSWORD) -> Any:
    return client.post("/api/auth/login", json={"login": login_value, "password": password})


@pytest.fixture
def login_as(client: TestClient, db: Session) -> Callable[..., User]:
    def _login_as(role_code: str, **user_kwargs: Any) -> User:
        password = user_kwargs.pop("password", DEFAULT_PASSWORD)
        user = make_user(db, role_code, password=password, **user_kwargs)
        resp = login(client, user.username, password)
        assert resp.status_code == 200, resp.text
        return user

    return _login_as


@pytest.fixture
def app_with_probe(app: FastAPI) -> None:
    """Adds test-only routes under ``/api/_probe`` to exercise auth dependencies."""
    router = APIRouter(prefix="/api/_probe")

    @router.get("/any-user")
    def any_user(user: CurrentUser) -> dict[str, str]:
        return {"username": user.username}

    @router.get("/settings-update")
    def settings_update(user: User = Depends(require("settings.update"))) -> dict[str, bool]:
        return {"ok": True}

    @router.get("/all-of")
    def all_of(user: User = Depends(require("invoices.view", "cash.close_any"))) -> dict[str, bool]:
        return {"ok": True}

    @router.get("/any-of")
    def any_of(user: User = Depends(require_any("reports.own", "reports.all"))) -> dict[str, bool]:
        return {"ok": True}

    app.include_router(router)
